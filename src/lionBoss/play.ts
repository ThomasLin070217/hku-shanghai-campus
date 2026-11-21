import {Vector3} from 'three';
import {cloneBuildings, SITE} from '../model/campusParameters';
import {buildSite} from '../model/buildSite';
import {disposeAsset} from '../model/buildCampus';
import {prepareModelTextures} from '../model/deferredTextures';
import {createSiteViewer} from '../viewer/siteViewer';
import {createExplorer} from '../exploration/controller';
import {OPENING_SAVE_KEY, parseOpeningSave} from '../opening/persistence';
import {relayRestored} from '../opening/backupRelay';
import {getCampusComputeSession} from './deviceServices';
import {OPENING_MAX_HEARTS, OPENING_RESPAWN_GRACE_SECONDS, createOpeningRuntime, damageOpeningHearts, healOpeningHearts} from '../opening/runtime';
import {createVitalsHud} from '../ui/vitals';
import {CampusAudio} from '../gameplay/audio';
import {DEFAULT_SETTINGS} from '../gameplay/save';
import {setText} from '../ui/dom';
import {restoreKitLayout} from './kit';
import {createCombat, BOSS, NODES, SAFE, atMaintenance, canSubmit, SUBMIT_RADIUS} from './combat';
import {createBossScene} from './scene';
import {batchLawnScenery} from './scenery';
import {createBossMacBook} from './macbook';
import {DEFAULT_RANGE,SKILL_SPECS} from './skillCatalog';
import {attachLawnAgent} from './agentControl';
import {hasCorePowerCut,recordCorePowerCut,sportsRescueLink} from './mission';
import {BOSS_SKILL_KEYS,KEYS} from '../exploration/config';
import type {BossAction} from '../agent/protocol';
import type {Outcome} from '../gameplay/survey';
import type {FieldSkillStatus} from './deviceServices';
import type {ProjectId} from './consoleService';
import {skillMark} from './workbench';
import '../style.css';
import './play.css';

document.title = 'L001 Lawn Defense · HKU Shanghai';
document.body.classList.add('lion-game');
document.querySelector('#app')!.innerHTML = `
  <main id="boss-field" aria-label="Campus lawn lion encounter"><div id="boss-view"></div>
    <header class="boss-header"><div><span>HKU SHANGHAI</span><strong>Lawn Defense / L001</strong></div>
    <div class="boss-telemetry"><div id="boss-health"></div><b id="boss-progress"></b><small id="boss-compute" hidden></small><a id="boss-chapters" class="boss-chapters" href="?experience=levels">Chapters</a><button id="boss-pause">Pause Esc</button></div></header>
    <div id="boss-waypoint" hidden></div><div id="boss-aim" hidden>+ Beacon</div>
    <aside id="boss-alert" hidden role="status"><small>CAMPUS DEFENSE SYSTEM</small><strong>Unauthorized administrator detected</strong><span>THREAT LEVEL: HIGH · DEFENSE UNIT L001</span><b>NEUTRALIZE INTRUDER</b></aside>
    <div id="boss-black" hidden role="status">Connection lost · Returning to the maintenance area</div>
    <div id="boss-live" hidden><div id="boss-hint"></div><div id="boss-feedback" role="status"></div>
      <div id="boss-actions"><div id="boss-q" class="boss-skill"></div><div id="boss-r" class="boss-skill"></div><span id="boss-f"></span></div>
      <div class="boss-controls" id="boss-controls">WASD Move · Drag to look · Shift Run · V Camera</div></div>
    <section id="boss-brief"><div class="boss-card"><small>2030 / Campus security network</small><h1 id="boss-title"></h1>
      <p id="boss-story"></p><div class="boss-buttons"><button class="boss-primary" id="boss-mac">Open MacBook  C</button>
      <button id="boss-start">Enter the lawn</button><a class="boss-next" id="boss-next" hidden>Chapter 3 · Sports Hall Rescue</a></div>
      <p id="boss-slots"></p><details id="boss-bindings"><summary>Skill keys</summary>
        <label>Skill slot 1 <select id="boss-stun-key"></select></label>
        <label>Skill slot 2 <select id="boss-lure-key"></select></label></details>
      <nav class="boss-links" aria-label="Other chapters"><a href="?experience=levels">Chapters</a><a id="boss-home" href="?experience=opening">Back to Chapter 1</a></nav></div></section>
    <aside id="boss-ai-ping" hidden role="status" aria-live="polite" aria-label="LAN's reminder">
      <div class="boss-ping-head"><span class="boss-ping-avatar">LAN</span><div><b>LAN · Local core</b><small>MacBook Air</small></div>
        <button id="boss-ping-close" aria-label="Close reminder">×</button></div>
      <p>L001 has flagged you as an intruder. Fall back to the green maintenance area, press C to open the MacBook, and Vibe Code two skills in Vibe Console.</p>
      <div class="boss-ping-actions"><button id="boss-ping-open">Open MacBook</button><button id="boss-ping-later">Later</button></div>
    </aside>
    <div id="boss-mac-host"></div>
  </main>`;
const element = (id:string) => document.getElementById('boss-'+id)!;
const button = (id:string) => element(id) as HTMLButtonElement;
const aiPing = element('ai-ping');
const pingOpen = element('ping-open');
const pingClose = element('ping-close');
const pingLater = element('ping-later');
let pingShown = false, pingTimer = 0;
function hidePing(){aiPing.hidden=true;window.clearTimeout(pingTimer);}
function showPing(){
  if(pingShown||!playing||game.paused||inWorkbench||game.inventoryOpen)return;
  pingShown=true;aiPing.hidden=false;
  window.clearTimeout(pingTimer);
  pingTimer=window.setTimeout(()=>{aiPing.hidden=true;},16000);
}
const view = element('view');
let redrawUntil = performance.now()+1800;
const viewer = createSiteViewer(view,() => performance.now() < redrawUntil,1.4);
const buildings = cloneBuildings();
const campus = buildSite(buildings, SITE);
viewer.scene.add(campus.root);
const scenery = batchLawnScenery(campus.root);
void prepareModelTextures(campus.root).then(() => { redrawUntil=Math.max(redrawUntil,performance.now()+100); }).catch(() => {});
viewer.renderer.shadowMap.autoUpdate=false;
viewer.renderer.shadowMap.needsUpdate=true;
viewer.renderer.domElement.addEventListener('webglcontextrestored',() => {
  viewer.renderer.shadowMap.needsUpdate=true;
  redrawUntil=performance.now()+1800;
});
viewer.controls.enabled = false;
const explorer = createExplorer(viewer.renderer.domElement, viewer.scene, buildings, SITE);
explorer.student.root.traverse(object=>{ object.castShadow=false; });
const game = explorer.game;
viewer.setActiveCamera(explorer.camera);
const resize = () => explorer.resize(view.clientWidth,view.clientHeight);
const observer = new ResizeObserver(resize);
observer.observe(view);
resize();

const macId = 'macbook-air-13-silver';
function readCompletedOpening() {
  try {
    const opening = parseOpeningSave(JSON.parse(localStorage.getItem(OPENING_SAVE_KEY) ?? 'null'));
    if(opening?.story.stage==='complete'){
      const id=opening.slots.find(slot=>slot?.itemId===macId)?.instanceId;
      if(id&&(relayRestored(id)||getCampusComputeSession(id)))return opening;
    }
  } catch { /* A fresh standalone run also carries one laptop. */ }
  return null;
}
const openingSave = readCompletedOpening();
const settings = openingSave?.settings ?? DEFAULT_SETTINGS;
const sound = new CampusAudio(settings);
explorer.setSensitivity(settings.sensitivity);
explorer.setComfort(settings.fov,settings.bob);
const mac = openingSave?.slots.find(s => s?.itemId === macId) ?? {itemId:macId, instanceId:'lawn-demo-macbook', count:1};
if (openingSave) {
  game.inventory.slots.splice(0,game.inventory.slots.length,...structuredClone(openingSave.slots));
  game.inventory.select(openingSave.selectedHotbar);
} else {
  game.inventory.slots.fill(null);
  game.inventory.slots[0] = mac;
}
game.inventory.revision++;
game.view = openingSave?.view ?? 'third';
const saveKey = 'hku.lion-boss.v1.' + mac.instanceId;
type Leg='arrival'|'withdraw'|'prepare'|'combat'|'finished';
const trigger={x:BOSS.x+1,z:BOSS.z+7.5};
const entrance={x:SAFE.x,z:SAFE.z+3};
let restored = 0, seenAwakening=false;
const savedCooldown={stun:0,lure:0,ghost:0};
let runtime = openingSave?.runtime ?? createOpeningRuntime();
try {
  const save = JSON.parse(localStorage.getItem(saveKey) ?? 'null');
  if (Number.isInteger(save?.repaired) && save.repaired >= 0 && save.repaired <= 3) {
    // V1 recorded three software repairs. Its final repair did not operate the core switch.
    restored = save.version===2?save.repaired:Math.min(2,save.repaired);
    seenAwakening=save.version===2?!!save.awakened||restored>0:restored>0;
    if(save.version===2){
      if(restored===3)recordCorePowerCut(mac.instanceId,3);
      for(const id of ['stun','lure','ghost'] as const){
        const seconds=save.cooldown?.[id];
        if(Number.isFinite(seconds))savedCooldown[id]=Math.max(0,Math.min(SKILL_SPECS[id].cooldown,seconds));
      }
    }
    restoreKitLayout(game.inventory,save.slotOrder,save.selectedHotbar);
    if (save.view === 'first' || save.view === 'third') game.view = save.view;
    if (Number.isInteger(save.hearts) && save.hearts >= 0 && save.hearts <= OPENING_MAX_HEARTS) runtime = {...runtime,hearts:save.hearts};
    if (Number.isSafeInteger(save.catches) && save.catches >= 0) runtime = {...runtime,catches:save.catches};
  }
} catch { /* Storage is optional for one session. */ }
const combat = createCombat(restored);
const visuals = createBossScene(campus.root,explorer.world,viewer.scene);
const state = combat.state;
Object.assign(state.cooldown,savedCooldown);
let playing = false, holding = false, inWorkbench = false, notice = '', noticeTime = 0;
let needsRetry = runtime.hearts === 0;
let leg:Leg=restored===3?'finished':seenAwakening?'prepare':'arrival';
let lastCast: {skill:ProjectId;message:string;frame:number}|null=null;
let blackoutUntil=0,hitPulseUntil=0,shutdownUntil=0;
let trainingHint='';
(element('next') as HTMLAnchorElement).href=sportsRescueLink(mac.instanceId);
let respawnGrace = 0;
const vitals = createVitalsHud('Health');
element('health').append(vitals.element);
const skillKeys:{stun:string;lure:string} = {stun:BOSS_SKILL_KEYS.first,lure:BOSS_SKILL_KEYS.second};
const choices:readonly string[] = BOSS_SKILL_KEYS.choices;
try {
  const bindings = JSON.parse(localStorage.getItem('hku.lion-boss.keys') ?? 'null');
  if (choices.includes(bindings?.stun) && choices.includes(bindings?.lure) && bindings.stun !== bindings.lure) {
    skillKeys.stun = bindings.stun; skillKeys.lure = bindings.lure;
  }
} catch { /* Use the default controls. */ }
for (const kind of ['stun','lure'] as const) {
  const selector = element(kind+'-key') as HTMLSelectElement;
  for (const key of choices) selector.add(new Option(key,key));
  selector.value = skillKeys[kind];
  selector.onchange = () => {
    const other = kind === 'stun' ? 'lure' : 'stun';
    if (skillKeys[other] === selector.value) {
      skillKeys[other] = skillKeys[kind];
      (element(other+'-key') as HTMLSelectElement).value = skillKeys[other];
    }
    skillKeys[kind] = selector.value;
    try { localStorage.setItem('hku.lion-boss.keys',JSON.stringify(skillKeys)); } catch { /* Session only. */ }
    refresh();
  };
}
const workbench = createBossMacBook({
  opening:openingSave,game,instanceId:mac.instanceId,requestDistract:()=>localCast('lure'),
  canCompile:()=>leg==='prepare'&&atMaintenance(game.body.position)&&!needsRetry
    &&game.inventory.equipped?.instanceId===mac.instanceId&&(inWorkbench||!!(game.owner&&game.armed)),
  status:() => ({repaired:state.repaired,runtime,player:[game.body.position.x,game.body.position.y,game.body.position.z],combat:state,canAct:canCast()}),
  host:element('mac-host'), storageKey:saveKey+'.skills', keys:skillKeys,
  onClose() { redrawUntil=performance.now()+900;workbench.close(); inWorkbench = false; explorer.closePanel(); refresh(); },
  onDeploy() { sound.play('equip'); refresh(); },
});
const equipped = () => Object.keys(workbench.session().vibe.slots().equipped).length===2;
let savedRevision = game.inventory.revision, savedView = game.view;
function saveProgress() {
  savedRevision = game.inventory.revision; savedView = game.view;
  try { localStorage.setItem(saveKey,JSON.stringify({
    version:2,awakened:seenAwakening,repaired:state.repaired,hearts:runtime.hearts,catches:runtime.catches,
    slotOrder:game.inventory.slots.map(slot=>slot?.instanceId ?? null),selectedHotbar:game.inventory.selectedHotbar,view:game.view,cooldown:{...state.cooldown},
  })); }
  catch { feedback('Browser storage is unavailable. You can keep playing this run.'); }
}
function place(at:{x:number;z:number}) {
  redrawUntil=performance.now()+1800;
  const floor = explorer.world.support(at.x,at.z,0.3) ?? 0;
  game.body.position.set(at.x,floor,at.z);
  game.body.velocity.set(0,0,0);
  game.body.grounded = true;
  game.yaw = Math.atan2(at.x-BOSS.x,at.z-BOSS.z);
  game.pitch = 0;
}
function feedback(message:string) {
  notice = message; noticeTime = 2.4;
  setText(element('feedback'),message);
}
const distanceTo = (point:{x:number;z:number}) => Math.hypot(game.body.position.x-point.x,game.body.position.z-point.z);
function prepareAtShelter() {
  leg='prepare';playing=false;holding=false;hidePing();
  explorer.pause('maintenance');
  game.inventory.equipItem(macId);
}
function openMac() {
  if(inWorkbench||game.inventoryOpen||needsRetry||leg==='finished')return;
  if(!seenAwakening||!atMaintenance(game.body.position)||leg==='withdraw'&&state.phase==='awakening'){
    feedback(seenAwakening?'Fall back to the green maintenance area south of the lawn.':'Follow the path toward the lawn Guardian.');return;
  }
  prepareAtShelter();
  inWorkbench=true;redrawUntil=performance.now()+900;
  explorer.openPanel('computer',true);workbench.open();refresh();
}
function resetToShelter(){
  holding=false;combat.reset(state.repaired);place(SAFE);prepareAtShelter();
  visuals.syncCollision(state);refresh();
}
function launch() {
  if(needsRetry)return;
  if(leg==='finished'){
    combat.reset(0);leg='arrival';seenAwakening=false;runtime=healOpeningHearts(runtime);
    playing=false;place(entrance);visuals.syncCollision(state);saveProgress();refresh();return;
  }
  if(leg==='prepare'){
    if(!equipped()){openMac();return;}
    leg='combat';combat.start();
  }
  game.inventory.equipItem(macId);playing=true;holding=false;
  void sound.start();explorer.enterCompat();refresh();
}
function canCast(){
  return leg==='combat'&&playing&&!game.paused&&!game.panel&&!game.inventoryOpen&&game.inventory.equipped?.instanceId===mac.instanceId;
}
// A bearing aligned to the player's camera and a point on the lawn, shared by the marker and the cast.
function signalAim(){
  const p=game.body.position,range=workbench.getSkill('ghost')?.maxRange??DEFAULT_RANGE;
  const length=Math.min(range,Math.max(2,5.5+game.pitch*4));
  return {x:p.x-Math.sin(game.yaw)*length,z:p.z-Math.cos(game.yaw)*length};
}
function localCast(id:ProjectId) {
  if(!canCast())return {ok:false,message:'Equip the MacBook on the lawn before casting.'};
  const rule=workbench.getSkill(id);
  if(!rule)return {ok:false,message:'This skill is not deployed yet.'};
  return combat.cast(rule,game.body.position,id==='ghost'?signalAim():undefined);
}
function fieldStatus(id:ProjectId):FieldSkillStatus{
  const service=workbench.session();
  if(service.field)return service.field.read(id);
  const rule=workbench.getSkill(id),cooldown=state.cooldown[id];
  const check=rule?combat.check(rule,game.body.position,id==='ghost'?signalAim():undefined):{ok:false,message:'Not compiled yet'};
  return {target:id==='stun'?'L001':id==='lure'?'Ashu':'Crosshair beacon',canCast:canCast()&&check.ok,
    reason:check.message,cooldown,cooldownTotal:SKILL_SPECS[id].cooldown};
}
const castsInFlight=new Set<ProjectId>();
async function cast(id:ProjectId) {
  if(!canCast()||castsInFlight.has(id))return {ok:false,message:'Cannot send a skill right now.'};
  castsInFlight.add(id);
  let result:{ok:boolean;message:string};
  try{
    const field=workbench.session().field;
    if(field){
      const status=field.read(id);
      if(!status.canCast)result={ok:false,message:status.reason};
      else{
        const confirmed=await field.cast(id);
        result={ok:confirmed.ok,message:confirmed.ok?confirmed.value:confirmed.message};
      }
    }else result=localCast(id);
  }catch(error){result={ok:false,message:error instanceof Error?error.message:'The skill service did not respond.'};}
  finally{castsInFlight.delete(id);}
  feedback(result.message);workbench.logCast(id,result.message);
  if(result.ok){
    lastCast={skill:id,message:result.message,frame:game.frame};saveProgress();
    sound.play(id==='ghost'?'view':id==='stun'?'equip':'collect','sfx',undefined,.9,id==='stun'?.65:id==='ghost'?1.4:1.1);
  }
  return result;
}
const phases:Record<string,string> = {
  patrol:'Patrol · Approach the device before casting',alert:'Detected',chase:'L001 closing in',return:'Alert patrol',
  chargeWarn:'Charge wind-up · Strafe or cast',charge:'Clear the charge path',chargeRecover:'Charge recovery',
  swipeWarn:'Sector swipe · Leave the sector or cast',swipeRecover:'Swipe recovery',stunned:'Movement system frozen',
  helperRun:'Ashu is moving to the flank',lured:'L001 is tracking Ashu',ghosted:'L001 is tracking the beacon'
};
function damage(){
  if(respawnGrace>0)return;
  const hit=damageOpeningHearts(runtime);runtime=hit.runtime;holding=false;
  sound.play('view','sfx',undefined,.94,.52);hitPulseUntil=performance.now()+350;
  const p=game.body.position,dx=p.x-state.lion.x,dz=p.z-state.lion.z;
  const d=Math.hypot(dx,dz)||1;
  for(let i=0;i<8;i++){
    const x=p.x+dx/d*.12,z=p.z+dz/d*.12,y=explorer.world.support(x,z,p.y+.24);
    if(y===null||Math.abs(y-p.y)>.24||explorer.world.blocked(x,z,y+.003))break;
    p.set(x,y,z);
  }
  respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;
  feedback('Hit −'+hit.lost+' health · Brief protection');
  if(hit.dead){
    needsRetry=true;playing=false;blackoutUntil=performance.now()+1650;
    explorer.pause('boss_capture');combat.reset(state.repaired);
  }
  saveProgress();
}
function resumeAfterCapture(){
  needsRetry=false;blackoutUntil=0;runtime=healOpeningHearts(runtime);
  resetToShelter();respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;
  trainingHint='Back in the maintenance area. Health restored. Skills and released defense locks are kept.';saveProgress();
}
function simulate(dt:number) {
  if(game.armed&&leg==='prepare'&&equipped()&&!atMaintenance(game.body.position)){playing=true;leg='combat';combat.start();}
  if(!playing||leg==='finished'||needsRetry)return;
  noticeTime=Math.max(0,noticeTime-dt);
  respawnGrace=Math.max(0,respawnGrace-dt);
  if(leg==='arrival'){
    if(distanceTo(trigger)>2)return;
    combat.awaken();leg='withdraw';sound.play('view','sfx',undefined,1,.6);
  }
  if(leg==='withdraw'){
    combat.step(dt,game.body.position,false);
    if(state.phase!=='awakening'){
      if(!seenAwakening){seenAwakening=true;saveProgress();if(!equipped())showPing();}
      if(distanceTo(SAFE)<.7){prepareAtShelter();saveProgress();}
    }
    return;
  }
  if(leg!=='combat')return;
  const idx=state.repaired,before=state.phase;
  const event=combat.step(dt,game.body.position,holding&&game.inventory.equipped?.instanceId===mac.instanceId);
  if(event==='hit')damage();
  else if(event==='repair'){
    holding=false;sound.play('complete');
    if(state.repaired===3){
      leg='finished';playing=false;shutdownUntil=performance.now()+1750;redrawUntil=performance.now()+3500;explorer.pause('boss_complete');
      if(recordCorePowerCut(mac.instanceId,3))game.event('ai_core_power_cut','AI core power is off',{next:'sports-hall'});
    }
    feedback(idx===2?'Emergency Shutdown executed':'Released '+NODES[idx].name+' · Alert raised');saveProgress();
  }else if(before!==state.phase&&(state.phase==='chargeWarn'||state.phase==='swipeWarn')){
    sound.play('select','sfx',undefined,.9,state.phase==='chargeWarn'?.65:1.4);
  }
  visuals.syncCollision(state);
}
async function bossAction(action:BossAction,stillCurrent:()=>boolean):Promise<Outcome>{
  const deny=(message:string)=>({ok:false,code:'denied',message});
  if(!stillCurrent()||!game.owner||!game.armed)return deny('Control has been revoked.');
  const service=workbench.session().vibe;
  if(action.type==='cast'){
    const key=action.slot===1?skillKeys.stun:skillKeys.lure;
    const id=service.projects.find(p=>service.slots().equipped[p.id]===key)?.id;
    if(!id)return deny('The equip slot is empty.');
    const result=await cast(id);
    return {...result,code:result.ok?'cast':'rejected'};
  }
  const allowed=()=>stillCurrent()&&leg==='prepare'&&atMaintenance(game.body.position)&&game.inventory.equipped?.instanceId===mac.instanceId&&workbench.session().vibe===service;
  if(!allowed())return deny('Equip the MacBook in the maintenance area and keep control.');
  service.edit(action.project,action.prompt);
  const plan=action.source==='preset'?await service.preset?.(action.project,action.prompt):await service.preview(action.project,action.prompt);
  if(!plan?.ok)return deny(plan?.message??'The compile service has no offline plan.');
  if(!allowed())return deny('Compile permission has changed.');
  const tests=await service.test(plan.value);
  if(!tests.ok)return deny(tests.message);
  if(!tests.value.length||tests.value.some(t=>t.actual!==t.expected)||!allowed())return deny('Rule tests failed or the grant expired.');
  const installed=await service.install(plan.value);
  if(!installed.ok)return deny(installed.message);
  const project=plan.value.project;
  if(!allowed()||!service.slots().equipped[project])return deny('No valid equip receipt was received.');
  return {ok:true,code:'compiled',id:project,message:SKILL_SPECS[project].name+' deployed.'};
}
const operation = () => ({ok:false,code:'manual_hold',message:'Approach the current device during a safe window and hold F.'});
game.scenario = {
  tick:simulate,interact:operation,bossAction,
  computer(){if(game.owner)return {ok:false,code:'use_compile',message:'Compile through the controlled compile action.'};openMac();return {ok:inWorkbench,code:'workbench',message:inWorkbench?'Skill workbench is open':'Return to the maintenance area'};},
  snapshot:()=>({leg,combat:structuredClone(state),player:game.body.position.toArray(),yaw:game.yaw,safe:SAFE,trigger,nodes:NODES,hearts:runtime.hearts,catches:runtime.catches,paused:game.paused,playing,inWorkbench,
    locks:{A:state.repaired>=1,B:state.repaired>=2},core:state.repaired===3?'off':state.repaired===2?'unlocked':'locked',
    events:hasCorePowerCut(mac.instanceId)?['ai_core_power_cut']:[],lastCast,protection:respawnGrace,
    equipped:workbench.session().vibe.slots().equipped,resources:workbench.session().vibe.slots().budget,cooldown:{...state.cooldown},
    macInstance:mac.instanceId,view:game.view,inventory:game.inventory.snapshot(),skills:{stun:workbench.getSkill('stun'),lure:workbench.getSkill('lure'),ghost:workbench.getSkill('ghost')}}),
  spawn(){if(leg==='finished')return;if(!seenAwakening){playing=false;leg='arrival';combat.reset(0);place(entrance);return;}resetToShelter();},
};
const agent=attachLawnAgent({game,explorer,host:element('brief').querySelector('.boss-card')!,screenshot:()=>viewer.screenshot(),
  eligible:()=>!needsRetry&&(leg==='prepare'||leg==='combat')});
explorer.computers.add(openMac);
explorer.interactions.add(()=>{if(canCast())holding=true;});
const events=new AbortController();
window.addEventListener('keydown',event=>{
  if(event.repeat||event.defaultPrevented||event.isComposing||game.panel||game.inventoryOpen||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.code===KEYS.pause&&game.armed){explorer.pause('human_takeover');return;}
  if(game.paused)return;
  for(const [id,key] of Object.entries(workbench.session().vibe.slots().equipped)){
    if(event.code!=='Key'+key.toUpperCase())continue;
    event.preventDefault();
    if(game.armed){explorer.pause('human_takeover');return;}
    void cast(id as ProjectId);break;
  }
},{signal:events.signal});
window.addEventListener('keyup',e=>{if(e.code===KEYS.interact)holding=false;},{signal:events.signal});
const point = new Vector3();
const hudSlots=['q','r'].map(name=>{
  const node=element(name);
  node.innerHTML='<kbd></kbd><i aria-hidden="true"></i><b></b><small></small><progress value="0" max="1" aria-label="Cooldown progress"></progress>';
  return {node,key:node.querySelector('kbd')!,icon:node.querySelector('i')!,label:node.querySelector('b')!,status:node.querySelector('small')!,progress:node.querySelector('progress')!};
});
function mapMarker(marker:HTMLElement,target:{x:number;z:number},height:number,clamp:boolean){
  point.set(target.x,height,target.z).project(explorer.camera);
  const behind=point.z>1;
  let x=point.x*.5+.5,y=.5-point.y*.5;
  if(clamp){
    x=behind?(point.x>0?.08:.92):Math.max(.08,Math.min(.92,x));
    y=behind?.53:Math.max(.18,Math.min(.7,y));
  }else if(behind||x<0||x>1||y<.08||y>.92){marker.hidden=true;return;}
  marker.hidden=false;marker.style.left=(x*100).toFixed(2)+'%';marker.style.top=(y*100).toFixed(2)+'%';
  return behind;
}
function refresh() {
  const idx=state.repaired,done=leg==='finished';
  const briefing=!inWorkbench&&!game.inventoryOpen&&!needsRetry&&performance.now()>=shutdownUntil&&(game.paused||!playing&&!game.armed);
  const live=!briefing&&!inWorkbench&&!game.inventoryOpen&&!done&&!needsRetry;
  document.body.classList.toggle('exploring',live);
  document.body.classList.toggle('mac-in-use',inWorkbench);
  document.body.classList.toggle('boss-hit',hitPulseUntil>performance.now());
  if(!live)holding=false;
  element('brief').hidden=!briefing;element('live').hidden=!live;element('pause').hidden=!live;
  element('black').hidden=!needsRetry;
  element('alert').hidden=!live||state.phase!=='awakening';
  const locks=Math.min(idx,2);
  setText(element('progress'),done?'Core power off':'Defense locks  '+locks+' / 2');
  vitals.update(runtime.hearts);
  const service=workbench.session().vibe,slots=service.slots(),equipment=slots.equipped;
  element('compute').hidden=leg!=='combat'||!slots.budget;
  if(slots.budget)setText(element('compute'),'B4 budget '+slots.budget.available+' / '+slots.budget.total);
  if(briefing){
    const info=leg==='arrival'?
      ['The Lawn Guardian','B4 backup supercomputer is online. L001 guards the core power on the lawn. Enter the lawn and approach the lion to check its status.','Enter the lawn']:
      leg==='withdraw'?['Fall back to maintenance','L001 has flagged you as an intruder. Follow the green markers back to the maintenance area and use the laptop in your hands to reach the backup supercomputer.','Return to the lawn']:
      leg==='prepare'?['Lawn maintenance area',trainingHint||'In Vibe Console on the laptop, pick any two projects and describe your intent in your own words. Check the parameters and tests, then compile and deploy. All three skills can create a window for the defense locks.','Start']:
      done?['L001 is safely shut down','Core power is cut. The lion\'s eye lights are out and the campus is recovering. The rescue route in the basketball court is now open.','Replay']:
      ['Action paused','Power can only be cut once both defense locks are released. Watch for warnings, approach the device, use a software skill to create a safe window, then hold F.','Continue'];
    setText(element('title'),info[0]);setText(element('story'),info[1]);setText(element('start'),info[2]);
    element('mac').hidden=leg!=='prepare'&&!(leg==='combat'&&atMaintenance(game.body.position));
    element('start').hidden=leg==='prepare'&&!equipped();element('next').hidden=!done;
    element('bindings').hidden=done;
    setText(element('slots'),done?'Mission log · ai_core_power_cut':leg==='prepare'?'Vibe Console　'+Object.keys(equipment).length+' / '+slots.capacity+' deployed':'WASD Move · Shift Run · Drag to look');
  }
  element('aim').hidden=true;element('waypoint').hidden=!live;
  if(!live)return;
  const node=NODES[idx];
  const objective=leg==='arrival'?{name:'L001 Guardian',...trigger}:leg==='withdraw'||leg==='prepare'?{name:'Lawn maintenance area',...SAFE}:node;
  const range=distanceTo(objective);
  let hint=leg==='arrival'?'Approach the lawn Guardian and check the security link':leg==='withdraw'?(atMaintenance(game.body.position)&&seenAwakening?'In the maintenance area · Press C to open the MacBook':'System misread you as an intruder · Follow the markers back to the green maintenance area'):leg==='prepare'?'Compile two skills in the maintenance area':'';
  if(leg==='combat'){
    hint=phases[state.phase]??'Approach the device and prepare to cast';
    if(canSubmit(state))hint='Safe window '+state.remaining.toFixed(1)+' s · '+(range>SUBMIT_RADIUS?'Step into the device ring':'Hold F '+(idx===2?'for emergency shutdown':'to release the defense lock'));
    else if(atMaintenance(game.body.position))hint='Press C to edit programs before you leave; move toward the device to start';
    if(respawnGrace>0)hint+=' · Protected '+respawnGrace.toFixed(1)+' s';
  }
  setText(element('hint'),objective.name+'  /  '+hint);
  setText(element('feedback'),noticeTime>0?notice:'');
  const active=leg==='combat';
  element('actions').hidden=!active;
  setText(element('controls'),active&&equipment.ghost?'Drag to move the cyan beacon · '+equipment.ghost+' drops it · Shift Run · V Camera':'WASD Move · Drag to look · Shift Run · Space Jump · V Camera');
  if(active){
    const keys=[skillKeys.stun,skillKeys.lure];
    for(const [index,slot] of hudSlots.entries()){
      const project=service.projects.find(p=>equipment[p.id]===keys[index]);slot.node.hidden=!project;
      if(!project)continue;
      const status=fieldStatus(project.id);
      setText(slot.key,keys[index]);setText(slot.icon,skillMark[project.id]);setText(slot.label,project.name);
      setText(slot.status,status.cooldown>0?'Cooldown '+status.cooldown.toFixed(1)+' s':status.canCast?'Ready · '+status.target:status.reason);
      slot.node.title=status.reason;slot.node.classList.toggle('can-cast',status.canCast);
      const fraction=status.cooldownTotal>0?1-Math.min(1,status.cooldown/status.cooldownTotal):1;
      if(slot.progress.value!==fraction)slot.progress.value=fraction;
    }
    setText(element('f'),state.submit>0?'F  '+Math.round(state.submit*100)+'%':'F  Hold to operate');
    if(equipment.ghost)mapMarker(element('aim'),signalAim(),.25,false);
  }
  const marker=element('waypoint'),behind=mapMarker(marker,objective,1.15,true);
  setText(marker,(behind?'Turn around  ':'')+'◇ '+objective.name+'  '+range.toFixed(1)+' m');
}
button('mac').onclick = openMac;
pingOpen.onclick = () => { hidePing(); openMac(); };
pingClose.onclick = hidePing;
pingLater.onclick = hidePing;
button('start').onclick = launch;
button('pause').onclick = () => explorer.pause('pause_button');
explorer.setEnabled(true);
place(leg==='arrival'?entrance:SAFE);
if(leg==='prepare')game.inventory.equipItem(macId);
if(needsRetry)blackoutUntil=performance.now()+1000;
viewer.beforeRender.add(dt => {
  if (!game.paused) redrawUntil=performance.now()+1800;
  if (savedRevision !== game.inventory.revision || savedView !== game.view) redrawUntil=performance.now()+150;
  if(needsRetry&&performance.now()>=blackoutUntil)resumeAfterCapture();
  if(leg==='finished'&&shutdownUntil>performance.now()){
    const yaw=Math.atan2(game.body.position.x-state.lion.x,game.body.position.z-state.lion.z);
    const blend=1-Math.exp(-6*dt);
    game.yaw+=Math.atan2(Math.sin(yaw-game.yaw),Math.cos(yaw-game.yaw))*blend;
    game.pitch+=(.02-game.pitch)*blend;
  }
  explorer.update(dt);
  if(inWorkbench)workbench.update();
  scenery.update(explorer.camera);
  visuals.render(state,dt);
  const p = game.body.position;
  sound.update(explorer.student.gait,!playing || game.paused,explorer.world.surface(p.x,p.z,p.y),p,explorer.camera.position,game.yaw);
  if (savedRevision !== game.inventory.revision || savedView !== game.view) saveProgress();
  refresh();
});
if (import.meta.env.DEV || import.meta.env.MODE === 'review') {
  Object.assign(window,{__LION_BOSS:{snapshot:() => game.scenario?.snapshot()}});
}
refresh();
window.addEventListener('pagehide',event => {
  saveProgress();explorer.pause('page_hidden');
  if (event.persisted) return;
  events.abort(); agent.dispose(); observer.disconnect(); workbench.dispose(); visuals.dispose();
  vitals.dispose(); explorer.dispose(); sound.dispose(); scenery.dispose(); disposeAsset(campus.root); viewer.dispose();
});
