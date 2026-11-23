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
    schemaVersion:1,stage:'complete',invitation_read:true,ambassador:true,laptop_acquired:true,campus_alert_triggered:true,
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
    const check=rule?evaluateSkill(rule,{phase:combat.phase,distance,cooldown:combat.cooldown.lure,helperReady:!active}):{ok:false,message:'Deploy Robot Hijack first.'};
    return [{id:'lawn/ashu',name:'Ashu · Lawn assistant',status:active?'Distracting':'Online',permission:rule?'Flank distraction program equipped.':'Telemetry available; distraction program not deployed.',
      remainingSeconds:active?combat.remaining:undefined,lastResult:lastHelperResult,
      commands:[{id:'telemetry',label:'Read telemetry',enabled:true},
        {id:'distract',label:'Distract',enabled:canAct&&check.ok,reason:rule&&!canAct?'After entering the lawn, press '+(localVibe.slots().equipped.lure??'the skill key')+' to take over Ashu.':check.ok?'':check.message}]},
      {id:'L001',name:'Lawn defense unit',status:combat.repaired===3?'Shut down':'Defense protocol active',permission:'Observation telemetry only.',commands:[]}];
  }
  const localSession:CampusComputeSession={vibe:localVibe,energy:()=>{const b=localVibe.slots().budget;return b?'B4 · '+b.available+' / '+b.total+' compute':'B4 backup power';},robotics:{devices,async execute(id,cmd){
    const device=devices().find(d=>d.id===id),command=device?.commands.find(c=>c.id===cmd);
    if(!command?.enabled)return {ok:false,message:command?.reason||'No device command permission right now.'};
    if(cmd==='telemetry'){
      const {helper,phase}=options.status().combat;
      const reply='Ashu responded · x '+helper.x.toFixed(1)+' / z '+helper.z.toFixed(1)+' m · '+phase;
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
    return NODES[repaired] ? 'Node '+(repaired+1)+' · '+NODES[repaired].name : 'Lawn repair complete';
  }
  function instruction() {
    const node=NODES[options.status().repaired];
    if(!node)return 'L001 is safely shut down.';
    if(Object.keys(session().vibe.slots().equipped).length<2)return 'In Vibe Console, write a project, review the plan, test it, and deploy to both slots.';
    if(session().field)return 'Check the compiled skills and valid targets on the HUD. Pick the right moment to cast, then hold F inside the node ring.';
    return 'Walk to the ring at '+node.name+', then cast any equipped skill. Once the lion is frozen or distracted, hold F to operate the device.';
  }
  const agent=createLocalAgent({
    prompt:ctx=>'You are the campus MacBook recovery assistant in the L001 lawn encounter. Answer concisely in the player’s language. Current objective: '+objective()+'. '+instruction()+' Hearts: '+ctx.runtime.hearts+'/'+ctx.runtime.maxHearts+'.',
    greeting:()=>'Connected to the lawn maintenance terminal. '+objective()+'. '+instruction(),
    suggestions:['What do I do now?','How do I deploy a skill?','What is my health?'],
    reply(text,ctx){
      if(/心|体力|heart|health/i.test(text))return 'Health '+ctx.runtime.hearts+'/'+ctx.runtime.maxHearts+', repairs submitted '+options.status().repaired+'/3.';
      if(/技能|部署|deploy|skill/i.test(text))return 'Open the skill workbench from the dock and state the cast condition and effect in one sentence. Generate the rule, test the valid timing and failure cases, then deploy it to the matching skill slot.';
      return objective()+'。'+instruction();
    },
  });
  const mac=createMacBookExperience({
    agent,onClose:options.onClose,sessionKey:'hku.macbook.chat.'+options.instanceId,
    startApp:'mission',computeAccess:()=>'connected',
    energy:()=>session().energy?.()??'Local device power',
    robotics:{body:apps.roboticsBody,activate:apps.openRobotics},
    drawMap(canvas,large){
      const target=NODES[options.status().repaired]??SAFE;
      drawCampusMap(canvas,options.game,{
        target,route:[],focus:{x:BOSS.x,z:BOSS.z+2,width:39,depth:43},
        markers:[
          {...SAFE,label:'Maintenance area'},{...BOSS,label:'L001'},
          ...NODES.map((n,i)=>({...n,label:'0'+(i+1)+' '+n.name})),
        ],
      },large);
    },
    mission:{
      title:'Vibe Console',location:'L001 · Lawn maintenance area',mapLegend:'North is up. The blue arrow is you; the orange markers are the current maintenance nodes.',
      terminal:()=>[
        'HKU-SHANGHAI-MACBOOK — lawn recovery shell',
        'external network .... offline', 'local maintenance ... connected',
        '', 'L001  '+objective(),'Repair progress  '+options.status().repaired+' / 3',
        'L001 status  '+options.status().combat.phase,'Health  '+options.status().runtime.hearts+' / '+options.status().runtime.maxHearts,
        ...Object.entries(session().vibe.slots().equipped).map(([project,key])=>key+'  '+project),
        '', 'recovery@macbook ~ %',
      ],
      body:apps.missionBody,activate:apps.openVibe,
    },
  });
  overlay.append(mac.root);options.host.append(overlay);
  const desktopIcon=()=>mac.root.querySelector<HTMLButtonElement>('.mac-dock-item[data-app="mission"]');
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
    open(){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;overlay.hidden=false;mac.open(currentView());mac.showApp('mission');mac.focusFirst();},
    close(){mac.suspend();overlay.hidden=true;previousFocus?.focus({preventScroll:true});previousFocus=null;},
    update(){const now=performance.now();if(!overlay.hidden&&now-lastUpdate>=450){lastUpdate=now;mac.update(currentView());}},
    getSkill:(id:SkillKind)=>session().vibe.getFieldRule(id),
    session,logCast:(id:ProjectId,result:string)=>{if(id==='lure')lastHelperResult=result;},
    dispose(){apps.dispose();mac.dispose();overlay.remove();},
  };
}
