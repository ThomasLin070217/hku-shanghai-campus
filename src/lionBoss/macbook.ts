import type {CampusGame} from '../exploration/game';
import {createLocalAgent} from '../opening/agent';
import type {OpeningSave,OpeningState} from '../opening/contracts';
import {createMacBookExperience} from '../opening/macbook';
import {drawCampusMap} from '../opening/map';
import {syncRuntimeWithStory,type OpeningRuntime} from '../opening/runtime';
import {OPENING_EVENT_LOG} from '../opening/state';
import {BOSS,NODES,SAFE} from './combat';
import {createLawnVibeService,type ProjectId} from './consoleService';
import {getCampusComputeSession,type CampusComputeSession,type RobotDevice} from './deviceServices';
import {createDeviceApps} from './deviceApps';
import {evaluateSkill,type SkillKind} from './rules';
import type {CombatState} from './combat';
import '../opening/opening.css';
import './macbook.css';

interface BossMacOptions {
  host:HTMLElement;
  storageKey:string;
  instanceId:string;
  keys:Record<'stun'|'lure',string>;
  canCompile:()=>boolean;
  onDeploy:()=>void;
  onClose:()=>void;
  opening:OpeningSave|null;
  game:CampusGame;
  status:()=>{repaired:number;runtime:OpeningRuntime;player:[number,number,number];combat:CombatState;canAct:boolean};
  requestDistract:()=>{ok:boolean;message:string};
}

export function createBossMacBook(options:BossMacOptions) {
  // A standalone lawn entry starts after the same B4 handoff as a continued game.
  const story:OpeningState=options.opening?.story??{
    schemaVersion:1,stage:'complete',invitation_read:true,laptop_acquired:true,campus_alert_triggered:true,
    alert_read:true,events:[...OPENING_EVENT_LOG],elapsedSeconds:0,
  };
  const overlay=document.createElement('div');
  overlay.className='boss-mac-overlay';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','MacBook Air');
  const {keys}=options;
  const localVibe=createLawnVibeService(options.storageKey,keys,kind=>options.status().combat.cooldown[kind],options.canCompile);
  let lastHelperResult='';
  function devices():RobotDevice[]{
    const {combat,player,canAct}=options.status();
    const active=combat.phase==='helperRun'||combat.phase==='lured';
    const rule=localVibe.getFieldRule('lure');
    const distance=Math.hypot(player[0]-combat.lion.x,player[2]-combat.lion.z);
    const check=rule?evaluateSkill(rule,{phase:combat.phase,distance,cooldown:combat.cooldown.lure,helperReady:!active}):{ok:false,message:'请先部署 Robot Hijack。'};
    return [{id:'lawn/ashu',name:'阿树 · 草坪助手',status:active?'执行牵制':'在线',permission:rule?'已装备侧翼牵制程序。':'可读遥测；牵制程序未部署。',
      remainingSeconds:active?combat.remaining:undefined,lastResult:lastHelperResult,
      commands:[{id:'telemetry',label:'读取遥测',enabled:true},
        {id:'distract',label:'Distract',enabled:canAct&&check.ok,reason:rule&&!canAct?'进入草坪后按 '+(localVibe.slots().equipped.lure??'技能键')+' 接管阿树。':check.ok?'':check.message}]},
      {id:'L001',name:'草坪防御单元',status:combat.repaired===3?'已停机':'防御协议激活',permission:'仅开放观测遥测。',commands:[]}];
  }
  const localSession:CampusComputeSession={vibe:localVibe,energy:()=>{const b=localVibe.slots().budget;return b?'B4 · '+b.available+' / '+b.total+' 算力':'B4 备用供电';},robotics:{devices,async execute(id,cmd){
    const device=devices().find(d=>d.id===id),command=device?.commands.find(c=>c.id===cmd);
    if(!command?.enabled)return {ok:false,message:command?.reason||'当前未获得设备指令权限。'};
    if(cmd==='telemetry'){
      const {helper,phase}=options.status().combat;
      const reply='阿树已应答 · x '+helper.x.toFixed(1)+' / z '+helper.z.toFixed(1)+' m · '+phase;
      lastHelperResult=reply;return {ok:true,value:reply};
    }
    const result=options.requestDistract();lastHelperResult=result.message;
    return result.ok?{ok:true,value:result.message}:{ok:false,message:result.message};
  }}};
  const connected=()=>getCampusComputeSession(options.instanceId);
  const session=()=>connected()??localSession;
  const apps=createDeviceApps(session,()=>goDesktop(),options.onDeploy);
  function objective() {
    const repaired=options.status().repaired;
    return NODES[repaired] ? '节点 '+(repaired+1)+' · '+NODES[repaired].name : '草坪修复完成';
  }
  function instruction() {
    const node=NODES[options.status().repaired];
    if(!node)return 'L001 已安全关机。';
    if(Object.keys(session().vibe.slots().equipped).length<2)return '在 Vibe Console 编写项目、检查方案、测试并部署到两个槽位。';
    if(session().field)return '查看 HUD 上的已编译技能和合法目标。选择合适的施放时机，然后在节点光圈内长按 F。';
    return '走到'+node.name+'的光圈，施放任一已装备技能。狮子冻结或转移目标后，长按 F 操作装置。';
  }
  const agent=createLocalAgent({
    prompt:ctx=>'You are the campus MacBook recovery assistant in the L001 lawn encounter. Answer concisely in the player’s language. Current objective: '+objective()+'. '+instruction()+' Hearts: '+ctx.runtime.hearts+'/'+ctx.runtime.maxHearts+'.',
    greeting:()=>'已连接草坪维护端。'+objective()+'。'+instruction(),
    suggestions:['我现在要做什么？','怎么部署技能？','我的心值是多少？'],
    reply(text,ctx){
      if(/心|体力|heart|health/i.test(text))return '当前心值 '+ctx.runtime.hearts+'/'+ctx.runtime.maxHearts+'，已提交的修复 '+options.status().repaired+'/3。';
      if(/技能|部署|deploy|skill/i.test(text))return '在程序坞打开技能工作台，用一句话写明施放条件与效果。点击生成规则，测试有效时机和失败条件，再部署到对应技能槽。';
      return objective()+'。'+instruction();
    },
  });
  const mac=createMacBookExperience({
    agent,onClose:options.onClose,sessionKey:'hku.macbook.chat.'+options.instanceId,
    computeAccess:()=>'connected',
    energy:()=>session().energy?.()??'Local device power',
    robotics:{body:apps.roboticsBody,activate:apps.openRobotics},
    drawMap(canvas,large){
      const target=NODES[options.status().repaired]??SAFE;
      drawCampusMap(canvas,options.game,{
        target,route:[],focus:{x:BOSS.x,z:BOSS.z+2,width:39,depth:43},
        markers:[
          {...SAFE,label:'维护区'},{...BOSS,label:'L001'},
          ...NODES.map((n,i)=>({...n,label:'0'+(i+1)+' '+n.name})),
        ],
      },large);
    },
    mission:{
      title:'Vibe Console',location:'L001 · 草坪维护区',mapLegend:'上方为北。蓝色箭头标出你的位置，橙色标记是当前维护节点。',
      terminal:()=>[
        'HKU-SHANGHAI-MACBOOK — lawn recovery shell',
        'external network .... offline', 'local maintenance ... connected',
        '', 'L001  '+objective(),'修复进度  '+options.status().repaired+' / 3',
        ...Object.entries(session().vibe.slots().equipped).map(([project,key])=>key+'  '+project),
        '', 'recovery@macbook ~ %',
      ],
      body:apps.missionBody,activate:apps.openVibe,
    },
  });
  overlay.append(mac.root);options.host.append(overlay);
  const desktopIcon=()=>mac.root.querySelector<HTMLButtonElement>('[data-launch-mission]')!;
  function goDesktop(){mac.showDesktop();desktopIcon()?.focus();}
  function currentView(){
    const {runtime,player}=options.status();
    return {story,runtime:syncRuntimeWithStory(runtime,story),objective:objective(),detail:instruction(),player,computerPage:'tasks' as const};
  }
  let previousFocus:HTMLElement|null=null;
  let lastUpdate=0;
  overlay.addEventListener('keydown',event=>{
    if(event.defaultPrevented)return;
    if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();if(!mac.handleEscape())options.onClose();return;}
    if(event.key!=='Tab')return;
    const items=Array.from(overlay.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),select:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')).filter(e=>e.offsetParent!==null);
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  overlay.addEventListener('keydown',e=>e.stopPropagation());
  overlay.addEventListener('keyup',e=>e.stopPropagation());
  return {
    open(){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;overlay.hidden=false;mac.open(currentView());desktopIcon()?.focus();},
    close(){mac.suspend();overlay.hidden=true;previousFocus?.focus({preventScroll:true});previousFocus=null;},
    update(){const now=performance.now();if(!overlay.hidden&&now-lastUpdate>=450){lastUpdate=now;mac.update(currentView());}},
    getSkill:(id:SkillKind)=>session().vibe.getFieldRule(id),
    session,logCast:(id:ProjectId,result:string)=>{if(id==='lure')lastHelperResult=result;},
    dispose(){apps.dispose();mac.dispose();overlay.remove();},
  };
}
