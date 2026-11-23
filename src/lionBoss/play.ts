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
import {createCombat, NODES, SAFE, canSubmit} from './combat';
import {INTERRUPT_LABEL,INTERRUPT_RULE,SHUTDOWN_LABEL,distanceToNode,lawnHint,placeAtShelter,shutDownGuardian} from './encounter';
import {createBossScene} from './scene';
import {batchLawnScenery} from './scenery';
import {attachLawnAgent} from './agentControl';
import {hasCorePowerCut,sportsRescueLink} from './mission';
import {createOpeningAtmosphere} from '../opening/atmosphere';
import {loadWorldThreat,markLionDefeated,markPowerCut,markLocalModelCleared,resetWorldThreat,tryPurgeWorld,type WorldThreat} from '../gameplay/worldThreat';
import {KEYS} from '../exploration/config';
import type {BossAction} from '../agent/protocol';
import type {Outcome} from '../gameplay/survey';
import '../style.css';
import './play.css';

document.title = 'L001 Lawn Defense · HKU Shanghai';
document.body.classList.add('lion-game');
document.querySelector('#app')!.innerHTML = `
  <main id="boss-field" aria-label="Campus lawn lion encounter"><div id="boss-view"></div>
    <header class="boss-header"><div><span>HKU SHANGHAI</span><strong>Lawn Defense / L001</strong></div>
    <div class="boss-telemetry"><div id="boss-health"></div><b id="boss-progress"></b><a id="boss-chapters" class="boss-chapters" href="?experience=levels">Chapters</a><button id="boss-pause">Pause Esc</button></div></header>
    <div id="boss-waypoint" hidden></div>
    <div id="boss-black" hidden role="status">Connection lost · Returning to the maintenance area</div>
    <div id="boss-live" hidden><div id="boss-hint"></div><div id="boss-feedback" role="status"></div>
      <div id="boss-actions"><span id="boss-q" class="boss-skill">Q · ${INTERRUPT_LABEL}</span><span id="boss-f"></span></div>
      <div class="boss-controls" id="boss-controls">WASD Move · Drag to look · Shift Run · V Camera</div></div>
    <section id="boss-brief"><div class="boss-card"><small>2030 / Campus security network</small><h1 id="boss-title"></h1>
      <p id="boss-story"></p><div class="boss-buttons">
      <button id="boss-start">Enter the lawn</button><a class="boss-next" id="boss-next" hidden>Rescue the students →</a></div>
      <nav class="boss-links" aria-label="Other chapters"><a href="?experience=levels">Chapters</a><a id="boss-home" href="?experience=opening">Back to Chapter 1</a></nav></div></section>
  </main>`;
const element = (id:string) => document.getElementById('boss-'+id)!;
const button = (id:string) => element(id) as HTMLButtonElement;
const view = element('view');
let redrawUntil = performance.now()+1800;
const viewer = createSiteViewer(view,() => performance.now() < redrawUntil,1.4);
const buildings = cloneBuildings();
const campus = buildSite(buildings, SITE);
viewer.scene.add(campus.root);
// The campus sky is world state, not a chapter flag: entering the lawn after a
// sealed opening must keep the same dome until the campus is actually purged.
let worldThreat:WorldThreat=loadWorldThreat();
const atmosphere=createOpeningAtmosphere(viewer.scene,viewer.renderer,viewer.lights);
let sealed=worldThreat.phase==='sealed';
if(sealed)atmosphere.restoreSealed();
viewer.renderer.shadowMap.needsUpdate=true;
function syncWorldThreat(){
 worldThreat=loadWorldThreat();
 const next=worldThreat.phase==='sealed';
 if(next!==sealed){
  sealed=next;
  if(sealed)atmosphere.restoreSealed();
  else atmosphere.release();
 }
 viewer.renderer.shadowMap.needsUpdate=true;
 redrawUntil=Math.max(redrawUntil,performance.now()+1800);
}
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
let restored=0;
let runtime = openingSave?.runtime ?? createOpeningRuntime();
try {
  const save = JSON.parse(localStorage.getItem(saveKey) ?? 'null');
  if (Number.isInteger(save?.repaired) && save.repaired >= 0 && save.repaired <= 3) {
    if(save.version===3)restored=save.repaired===1?1:0;
    // V2 completed the hardware shutdown. V1 only tracked software repairs.
    else if(save.version===2&&save.repaired===3)restored=1;
    restoreKitLayout(game.inventory,save.slotOrder,save.selectedHotbar);
    if (save.view === 'first' || save.view === 'third') game.view = save.view;
    if (Number.isInteger(save.hearts) && save.hearts >= 0 && save.hearts <= OPENING_MAX_HEARTS) runtime = {...runtime,hearts:save.hearts};
    if (Number.isSafeInteger(save.catches) && save.catches >= 0) runtime = {...runtime,catches:save.catches};
  }
} catch { /* Storage is optional for one session. */ }
function finishMission() {
  const coreCut=shutDownGuardian(mac.instanceId);
  tryPurgeWorld();syncWorldThreat();
  return coreCut;
}
if(restored===1)finishMission();
else syncWorldThreat();
const combat=createCombat(restored);
const visuals=createBossScene(campus.root,explorer.world,viewer.scene);
const state=combat.state;
let playing=false,holding=false,notice='',noticeTime=0;
let needsRetry=restored===0&&runtime.hearts===0;
let lastCast:{skill:'stun';message:string;frame:number}|null=null;
let blackoutUntil=0,hitPulseUntil=0,shutdownUntil=0,respawnGrace=0;
const vitals=createVitalsHud('Health');
element('health').append(vitals.element);
(element('next') as HTMLAnchorElement).href=sportsRescueLink(mac.instanceId);

let savedRevision = game.inventory.revision, savedView = game.view;
function saveProgress() {
  savedRevision = game.inventory.revision; savedView = game.view;
  try { localStorage.setItem(saveKey,JSON.stringify({
    version:3,repaired:state.repaired,hearts:runtime.hearts,catches:runtime.catches,
    slotOrder:game.inventory.slots.map(slot=>slot?.instanceId ?? null),selectedHotbar:game.inventory.selectedHotbar,view:game.view,
  })); }
  catch { feedback('Browser storage is unavailable. You can keep playing this run.'); }
}
function place(at:{x:number;z:number}) {
  redrawUntil=performance.now()+1800;
  placeAtShelter(explorer.world,game,at);
}
function feedback(message:string) {
  notice = message; noticeTime = 2.4;
  setText(element('feedback'),message);
}
function resetToShelter(){
  holding=false;playing=false;combat.reset(0);place(SAFE);
  explorer.pause('maintenance');visuals.syncCollision(state);refresh();
}
function launch() {
  if(needsRetry)return;
  if(state.phase==='complete'){
    runtime=healOpeningHearts(runtime);resetToShelter();saveProgress();return;
  }
  game.inventory.equipItem(macId);playing=true;holding=false;combat.start();
  void sound.start();explorer.enterCompat();refresh();
}
function canAct(){
  return playing&&!game.paused&&!game.panel&&!game.inventoryOpen;
}
function freeze() {
  if(!canAct())return {ok:false,message:'Resume the encounter to use Q.'};
  const result=combat.cast(INTERRUPT_RULE,game.body.position);
  feedback(result.message);
  if(result.ok){
    lastCast={skill:'stun',message:result.message,frame:game.frame};
    sound.play('equip','sfx',undefined,.9,.65);
  }
  return result;
}
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
  saveProgress();
}
function simulate(dt:number) {
  if(game.armed&&!needsRetry&&state.phase==='safe'&&!game.paused){playing=true;combat.start();}
  if(!playing||state.phase==='complete'||needsRetry)return;
  noticeTime=Math.max(0,noticeTime-dt);
  respawnGrace=Math.max(0,respawnGrace-dt);
  const before=state.phase;
  const event=combat.step(dt,game.body.position,holding);
  if(event==='hit')damage();
  else if(event==='repair'){
    holding=false;playing=false;shutdownUntil=performance.now()+1750;redrawUntil=performance.now()+3500;
    sound.play('complete');explorer.pause('boss_complete');
    if(finishMission())game.event('ai_core_power_cut','AI core power is off',{next:'sports-hall'});
    saveProgress();
  }else if(before!==state.phase&&state.phase==='chargeWarn'){
    sound.play('select','sfx',undefined,.9,.65);
  }
  visuals.syncCollision(state);
}
async function bossAction(action:BossAction,stillCurrent:()=>boolean):Promise<Outcome>{
  if(!stillCurrent()||!game.owner||!game.armed)return {ok:false,code:'denied',message:'Control has been revoked.'};
  if(action.type!=='cast'||action.slot!==1)return {ok:false,code:'denied',message:'Use slot 1 to interrupt the charge.'};
  const result=freeze();
  return {...result,code:result.ok?'cast':'rejected'};
}
const operation=()=>({ok:false,code:'manual_hold',message:'Step into the lit shutdown ring and hold F.'});
game.scenario={
  tick:simulate,interact:operation,bossAction,
  computer:()=>({ok:false,code:'unavailable',message:'System Freeze is already assigned to Q.'}),
  snapshot:()=>({leg:state.phase==='complete'?'finished':'combat',combat:structuredClone(state),player:game.body.position.toArray(),yaw:game.yaw,safe:SAFE,nodes:NODES,
    hearts:runtime.hearts,catches:runtime.catches,paused:game.paused,playing,core:state.phase==='complete'?'off':'locked',
    objective:state.phase==='complete'?'Rescue the students':'Shut down L001',
    events:hasCorePowerCut(mac.instanceId)?['ai_core_power_cut']:[],lastCast,protection:respawnGrace,
    equipped:{stun:'Q'},cooldown:{...state.cooldown},macInstance:mac.instanceId,view:game.view,inventory:game.inventory.snapshot()}),
  spawn(){if(state.phase!=='complete')resetToShelter();},
};
const agent=attachLawnAgent({game,explorer,host:element('brief').querySelector('.boss-card')!,screenshot:()=>viewer.screenshot(),
  eligible:()=>!needsRetry&&state.phase!=='complete'});
explorer.interactions.add(()=>{if(canAct()&&canSubmit(state))holding=true;});
const events=new AbortController();
window.addEventListener('keydown',event=>{
  if(event.repeat||event.defaultPrevented||event.isComposing||game.panel||game.inventoryOpen||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.code===KEYS.pause&&game.armed){explorer.pause('human_takeover');return;}
  if(event.code!=='KeyQ'||game.paused)return;
  event.preventDefault();
  if(game.armed){explorer.pause('human_takeover');return;}
  freeze();
},{signal:events.signal});
window.addEventListener('keyup',event=>{if(event.code===KEYS.interact)holding=false;},{signal:events.signal});
const point = new Vector3();
function refresh() {
  const done=state.phase==='complete';
  const briefing=!game.inventoryOpen&&!needsRetry&&performance.now()>=shutdownUntil&&(game.paused||!playing&&!game.armed);
  const live=!briefing&&!game.inventoryOpen&&!done&&!needsRetry;
  document.body.classList.toggle('exploring',live);
  document.body.classList.toggle('boss-hit',hitPulseUntil>performance.now());
  if(!live||game.paused)holding=false;
  element('brief').hidden=!briefing;element('live').hidden=!live;element('pause').hidden=!live;
  element('black').hidden=!needsRetry;element('waypoint').hidden=!live;
  setText(element('progress'),done?'Objective · Rescue the students':'Objective · Shut down L001');
  vitals.update(runtime.hearts);
  if(briefing){
    setText(element('title'),done?'L001 is safely shut down':'The Lawn Guardian');
    setText(element('story'),done?'Head to the sports hall to rescue the trapped students.':
      'When L001 winds up its charge, press Q to interrupt it. Step into the glowing ring and hold F to shut it down.');
    setText(element('start'),done?'Replay':playing?'Continue':'Enter the lawn');
    element('next').hidden=!done;
  }
  if(!live)return;
  const node=NODES[0],range=distanceToNode(game.body.position),open=canSubmit(state);
  setText(element('hint'),lawnHint(state,range));
  setText(element('feedback'),noticeTime>0?notice:'');
  element('q').classList.toggle('can-cast',state.phase==='chargeWarn');
  element('f').hidden=!open;
  setText(element('f'),state.submit>0?'F · '+Math.round(state.submit*100)+'%':'F · '+SHUTDOWN_LABEL);
  point.set(node.x,1.15,node.z).project(explorer.camera);
  const behind=point.z>1;
  const x=behind?(point.x>0?.08:.92):Math.max(.08,Math.min(.92,point.x*.5+.5));
  const y=behind?.53:Math.max(.18,Math.min(.7,.5-point.y*.5));
  const marker=element('waypoint');
  marker.style.left=(x*100).toFixed(2)+'%';marker.style.top=(y*100).toFixed(2)+'%';
  setText(marker,(behind?'Turn around  ':'')+'◇ '+node.name+'  '+range.toFixed(1)+' m');
}
button('start').onclick=launch;
button('pause').onclick=()=>explorer.pause('pause_button');
explorer.setEnabled(true);
place(SAFE);
if(needsRetry)blackoutUntil=performance.now()+1000;
viewer.beforeRender.add(dt => {
  // The barrier descent/purge must keep drawing even when the fight is paused.
  const sealAnimating=atmosphere.releasing||(atmosphere.curtainProgress>0&&atmosphere.curtainProgress<1);
  if (!game.paused || sealAnimating) redrawUntil=performance.now()+1800;
  if (savedRevision !== game.inventory.revision || savedView !== game.view) redrawUntil=performance.now()+150;
  // The purge is a cinematic: it must keep moving while the fight is paused.
  atmosphere.update(dt,{incident:sealed,curtain:sealed,paused:game.paused&&!sealAnimating});
  if(needsRetry&&performance.now()>=blackoutUntil)resumeAfterCapture();
  if(state.phase==='complete'&&shutdownUntil>performance.now()){
    const yaw=Math.atan2(game.body.position.x-state.lion.x,game.body.position.z-state.lion.z);
    const blend=1-Math.exp(-6*dt);
    game.yaw+=Math.atan2(Math.sin(yaw-game.yaw),Math.cos(yaw-game.yaw))*blend;
    game.pitch+=(.02-game.pitch)*blend;
  }
  explorer.update(dt);
  scenery.update(explorer.camera);
  visuals.render(state,dt);
  const p = game.body.position;
  sound.update(explorer.student.gait,!playing || game.paused,explorer.world.surface(p.x,p.z,p.y),p,explorer.camera.position,game.yaw);
  if (savedRevision !== game.inventory.revision || savedView !== game.view) saveProgress();
  refresh();
});
if (import.meta.env.DEV || import.meta.env.MODE === 'review') {
  Object.assign(window,{__LION_BOSS:{
    snapshot:() => game.scenario?.snapshot(),
    // Evidence capture only: play the seated → standing awaken clip without starting patrol.
    awaken(){ explorer.enterCompat(); playing = true; combat.awaken(); },
    viewer, explorer,
    worldThreat:() => loadWorldThreat(),
    atmosphere:() => ({phase:atmosphere.phase,progress:atmosphere.curtainProgress,sealed}),
    markLionDefeated(){markLionDefeated();syncWorldThreat();},
    markPowerCut(){markPowerCut();syncWorldThreat();},
    markLocalModelCleared(){markLocalModelCleared();syncWorldThreat();},
    purgeWorld(){const purge=tryPurgeWorld();syncWorldThreat();return purge.purged;},
    resetWorld(){resetWorldThreat();syncWorldThreat();},
    tick(seconds:number){for(let i=0;i<Math.max(0,Math.round(seconds*60));i++)atmosphere.update(1/60,{incident:sealed,curtain:sealed,paused:false});},
  }});
}
refresh();
window.addEventListener('pagehide',event => {
  saveProgress();explorer.pause('page_hidden');
  if (event.persisted) return;
  events.abort(); agent.dispose(); observer.disconnect(); visuals.dispose(); atmosphere.dispose();
  vitals.dispose(); explorer.dispose(); sound.dispose(); scenery.dispose(); disposeAsset(campus.root); viewer.dispose();
});
