import type {CampusGame} from '../exploration/game';
import {createLocalAgent} from '../opening/agent';
import type {OpeningSave,OpeningState} from '../opening/contracts';
import {createMacBookExperience} from '../opening/macbook';
import {drawCampusMap} from '../opening/map';
import {syncRuntimeWithStory,type OpeningRuntime} from '../opening/runtime';
import {OPENING_EVENT_LOG} from '../opening/state';
import {BOSS,NODES,SAFE} from './combat';
import {createBossWorkbench} from './workbench';
import '../opening/opening.css';
import './macbook.css';

interface BossMacOptions extends ParametersOfWorkbench {
  opening:OpeningSave|null;
  game:CampusGame;
  status:()=>{repaired:number;runtime:OpeningRuntime;player:[number,number,number]};
}
type ParametersOfWorkbench=Parameters<typeof createBossWorkbench>[0];

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
  const content=document.createElement('div');content.className='boss-mac-content';
  const workbench=createBossWorkbench({...options,host:content,onClose:()=>goDesktop()});
  const keys=options.keys??{stun:'Q',lure:'R'};
  function objective() {
    const repaired=options.status().repaired;
    return NODES[repaired] ? '节点 '+(repaired+1)+' · '+NODES[repaired].name : '草坪修复完成';
  }
  function instruction() {
    const node=NODES[options.status().repaired];
    if(!node)return 'L001 已安全关机。';
    if(!workbench.getSkill('stun')||!workbench.getSkill('lure'))return '打开技能工作台。分别描述短时麻痹与助手牵制，查看生成规则，测试通过后部署到两个槽位。';
    return (node.kind==='stun'?'等冲撞预警亮起，按 '+keys.stun+' 麻痹 L001。':'先退出挥爪扇区，再在收招时按 '+keys.lure+' 呼叫助手。')+'在节点光圈内长按 F，提交修复。';
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
    agent,onClose:options.onClose,
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
      title:'技能工作台',location:'L001 · 草坪维护区',mapLegend:'上方为北。蓝色箭头标出你的位置，橙色标记是当前维护节点。',
      terminal:()=>[
        'HKU-SHANGHAI-MACBOOK — lawn recovery shell',
        'external network .... offline', 'local maintenance ... connected',
        '', 'L001  '+objective(),'修复进度  '+options.status().repaired+' / 3',
        ...(['stun','lure'] as const).map(k=>keys[k]+'  '+(workbench.getSkill(k)?'已部署':'空槽')),
        '', 'recovery@macbook ~ %',
      ],
      body:content,activate:()=>workbench.open(),
    },
  });
  overlay.append(mac.root);options.host.append(overlay);
  const desktopIcon=()=>mac.root.querySelector<HTMLButtonElement>('[data-launch-mission]')!;
  function goDesktop(){mac.showDesktop();desktopIcon().focus();}
  function currentView(){
    const {runtime,player}=options.status();
    return {story,runtime:syncRuntimeWithStory(runtime,story),objective:objective(),detail:instruction(),player,computerPage:'tasks' as const};
  }
  let previousFocus:HTMLElement|null=null;
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();options.onClose();return;}
    if(event.key!=='Tab')return;
    const items=Array.from(overlay.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)')).filter(e=>e.offsetParent!==null);
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  },true);
  overlay.addEventListener('keydown',e=>e.stopPropagation());
  overlay.addEventListener('keyup',e=>e.stopPropagation());
  return {
    open(){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;overlay.hidden=false;mac.open(currentView());desktopIcon().focus();},
    close(){workbench.close();overlay.hidden=true;previousFocus?.focus({preventScroll:true});previousFocus=null;},
    getSkill:workbench.getSkill, reset:workbench.reset,
    dispose(){workbench.dispose();mac.dispose();overlay.remove();},
  };
}
