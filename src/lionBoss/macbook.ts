import type {CampusGame} from '../exploration/game';
import {createLocalAgent} from '../opening/agent';
import type {OpeningSave,OpeningState} from '../opening/contracts';
import {createMacBookExperience} from '../opening/macbook';
import {drawCampusMap} from '../opening/map';
import {syncRuntimeWithStory,type OpeningRuntime} from '../opening/runtime';
import {OPENING_EVENT_LOG} from '../opening/state';
import {BOSS,NODES,SAFE} from './combat';
import {createLawnVibeService,type ProjectId} from './consoleService';
import {getCampusComputeSession,type CampusComputeSession} from './deviceServices';
import {evaluateSkill,type SkillKind} from './rules';
import type {CombatState} from './combat';
import './macbook.css';

interface BossMacOptions {
  host:HTMLElement;
  storageKey:string;
  instanceId:string;
  onDeploy:()=>void;
  onClose:()=>void;
  opening:OpeningSave|null;
  game:CampusGame;
  status:()=>{repaired:number;runtime:OpeningRuntime;player:[number,number,number];combat:CombatState;canAct:boolean};
  requestDistract:()=>{ok:boolean;message:string};
}

/** The two lawn programs are fixed. The player never edits rules: they ask the
 * on-device assistant, and that conversation talks to the same service the HUD
 * reads. A fresh save is provisioned automatically so the first fight is never
 * blocked on UI navigation. */
const skillName:Record<SkillKind,string>={stun:'System Freeze',lure:'Robot Hijack'};
const skillKey:Record<SkillKind,string>={stun:'Q',lure:'R'};
const skillIntent:Record<SkillKind,string>={
  stun:'如果 8 米内的狮子正在蓄力冲撞，我按下技能时就让它短暂停机，打断冲撞。',
  lure:'等狮子挥完爪，我按下技能时，让阿树从左侧牵制它。',
};

export function createBossMacBook(options:BossMacOptions) {
  const story:OpeningState=options.opening?.story??{
    schemaVersion:1,stage:'complete',invitation_read:true,laptop_acquired:true,campus_alert_triggered:true,
    alert_read:true,events:[...OPENING_EVENT_LOG],elapsedSeconds:0,
  };
  const overlay=document.createElement('div');
  overlay.className='boss-mac-overlay';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','MacBook Air');
  const localVibe=createLawnVibeService(options.storageKey,skillKey,kind=>options.status().combat.cooldown[kind]);
  const localSession:CampusComputeSession={
    vibe:localVibe,
    robotics:{devices:()=>[],async execute(){return {ok:false,message:'Not available.'};}},
  };
  const connected=()=>getCampusComputeSession(options.instanceId);
  const session=()=>connected()??localSession;
  let deploying:Promise<string>|null=null;

  function objective() {
    const repaired=options.status().repaired;
    return NODES[repaired] ? '节点 '+(repaired+1)+' · '+NODES[repaired].name : '草坪修复完成';
  }
  function deployed(kind:SkillKind){return Boolean(session().vibe.getFieldRule(kind));}
  function statusLine(){
    const stun=deployed('stun')?skillKey.stun+' 短时麻痹':'未部署';
    const lure=deployed('lure')?skillKey.lure+' 助手牵制':'未部署';
    return stun+' · '+lure;
  }
  function instruction() {
    const node=NODES[options.status().repaired];
    const hearts=options.status().runtime.hearts;
    if(!node)return 'L001 已安全关机，草坪恢复安全。';
    const mechanics=node.kind==='stun'
      ?'等它进入冲撞蓄力（提示“冲撞蓄力”），按 '+skillKey.stun+' 打断，再走进节点光圈长按 F 提交。'
      :'先退出挥爪扇区，等它收爪时按 '+skillKey.lure+'，再走进节点光圈长按 F 提交。';
    return mechanics+' 当前心值 '+hearts+'/'+options.status().runtime.maxHearts+'。';
  }

  async function deploy(kind:SkillKind):Promise<string>{
    const service=session().vibe;
    if(!service.projects.find(project=>project.id===kind)?.supported)return skillName[kind]+' 在当前草坪运行时不支持。';
    if(service.getFieldRule(kind))return skillName[kind]+' 已在 '+skillKey[kind]+' 槽。';
    service.edit(kind,skillIntent[kind]);
    const preview=await service.preview(kind,skillIntent[kind]);
    if(!preview.ok)return '部署 '+skillName[kind]+' 失败：'+preview.message;
    const tests=await service.test(preview.value);
    if(!tests.ok)return '部署 '+skillName[kind]+' 失败：'+tests.message;
    if(tests.value.some(test=>test.actual!==test.expected))return skillName[kind]+' 的规则测试没有通过。';
    const installed=await service.install(preview.value);
    if(!installed.ok)return '部署 '+skillName[kind]+' 失败：'+installed.message;
    options.onDeploy();
    return '已部署 '+skillName[kind]+' → '+skillKey[kind];
  }
  async function deployAll():Promise<string>{
    if(!deploying)deploying=(async()=>{
      const lines:string[]=[];
      for(const kind of ['stun','lure'] as const)lines.push(await deploy(kind));
      return lines.join('\n');
    })().finally(()=>{deploying=null;});
    return deploying;
  }
  function wantsDeploy(text:string){
    return /(部署|准备|给我|领取|装上|设置技能|vibe\s*cod|vibe|skill|deploy|equip|setup)/i.test(text);
  }
  async function conversationalDeploy(text:string):Promise<string[]>{
    if(!wantsDeploy(text))return [];
    const lower=text.toLowerCase();
    const both=/(都|两个|全部|技能|skill|deploy|准备|equip|all|both)/i.test(text);
    const stun=both||/(麻痹|freeze|stun|打断)/i.test(lower);
    const lure=both||/(牵制|hijack|lure|阿树|助手)/i.test(lower);
    const out:string[]=[];
    if(stun)out.push(await deploy('stun'));
    if(lure)out.push(await deploy('lure'));
    if(!out.length)out.push(await deployAll());
    return out;
  }

  const baseAgent=createLocalAgent({
    prompt:ctx=>'You are the on-device assistant inside the MacBook in the L001 lawn encounter. Speak briefly in the player’s language. '
      +'The player does not edit skill rules: the two programs are already installed and only fired with Q and R. '
      +'Current objective: '+objective()+'. '+instruction()+' Skills (prepared through Vibe Coding, never edited by the player): '+statusLine()+'. Hearts: '+ctx.runtime.hearts+'/'+ctx.runtime.maxHearts+'.',
    greeting:()=>'草坪维护端已连接。我们刚在 Vibe Coding 里把两个反制程序准备好了：'+statusLine()+'。'+objective()+'。'+instruction(),
    suggestions:['帮我 Vibe Coding 技能','什么时候按 Q？','我的修复进度？'],
    reply(text,ctx){
      if(/心|体力|heart|health/i.test(text))return '当前心值 '+ctx.runtime.hearts+'/'+ctx.runtime.maxHearts+'，已提交的修复 '+options.status().repaired+'/3。';
      if(/进度|修复|repair|progress/i.test(text))return objective()+'。已提交 '+options.status().repaired+'/3。'+instruction();
      if(/q|麻痹|freeze|stun/i.test(text))return 'Q 是短时麻痹。等 HUD 出现“冲撞蓄力”，狮子进入冲撞前按 Q，它会被定住；然后走进当前节点光圈长按 F 提交修复。';
      if(/r|牵制|lure|hijack|阿树/i.test(text))return 'R 是助手牵制。先离开挥爪扇区，等狮子收爪时按 R，阿树会从侧翼引开它；窗口出现后走到节点光圈长按 F。';
      if(/vibe|技能|部署|skill|deploy/i.test(text))return '两个程序都已经 Vibe Coding 并部署：'+statusLine()+'。直接按对应键，不需要打开工作台。';
      return objective()+'。'+instruction();
    },
  });
  const agent:typeof baseAgent={
    ...baseAgent,
    async ask(text,ctx,previous){
      const receipts=await conversationalDeploy(text);
      const reply=await baseAgent.ask(text,ctx,previous);
      return receipts.length?{...reply,text:receipts.join('\n')+'\n\n'+reply.text}:reply;
    },
  };

  const mac=createMacBookExperience({
    agent,onClose:options.onClose,sessionKey:'hku.macbook.chat.'+options.instanceId,startApp:'agent',
    computeAccess:()=>connected()?'connected':'exercise',
    energy:()=>session().energy?.()??'Local device power',
    drawMap(canvas,large){
      const target=NODES[options.status().repaired]??SAFE;
      drawCampusMap(canvas,options.game,{
        target,route:[],focus:{x:BOSS.x,z:BOSS.z+2,width:39,depth:43},
        markers:[
          {...SAFE,label:'维护区'},{...BOSS,label:'L001'},
          ...NODES.map((node,index)=>({...node,label:'0'+(index+1)+' '+node.name})),
        ],
      },large);
    },
    terminal:()=>{
      const {combat,runtime,repaired}=options.status();
      return [
        'HKU-SHANGHAI-MACBOOK — lawn recovery shell',
        'external network .... offline',
        'local assistant ..... ready',
        'skills .............. '+statusLine(),
        '',
        'L001 ................ '+combat.phase,
        'repair .............. '+repaired+' / 3',
        'hearts .............. '+runtime.hearts+' / '+runtime.maxHearts,
        '', 'recovery@macbook ~ %',
      ];
    },
  });
  overlay.append(mac.root);options.host.append(overlay);
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
  function currentView(){
    const {runtime,player}=options.status();
    return {story,runtime:syncRuntimeWithStory(runtime,story),objective:objective(),detail:instruction(),player,computerPage:'tasks' as const};
  }
  return {
    open(){
      previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      overlay.hidden=false;mac.open(currentView());
      mac.showApp('agent');mac.focusFirst();
    },
    close(){mac.suspend();overlay.hidden=true;previousFocus?.focus({preventScroll:true});previousFocus=null;},
    update(){const now=performance.now();if(!overlay.hidden&&now-lastUpdate>=450){lastUpdate=now;mac.update(currentView());}},
    ensureSkills:deployAll,
    getSkill:(id:SkillKind)=>session().vibe.getFieldRule(id),
    session,logCast:(id:ProjectId,result:string)=>{void id;void result;},
    dispose(){mac.dispose();overlay.remove();},
  };
}
