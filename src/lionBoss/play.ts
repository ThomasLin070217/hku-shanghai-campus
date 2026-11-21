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

document.title = 'L001 草坪防御 · HKU Shanghai';
document.body.classList.add('lion-game');
document.querySelector('#app')!.innerHTML = `
  <main id="boss-field" aria-label="校园草坪狮子战"><div id="boss-view"></div>
    <header class="boss-header"><div><span>HKU SHANGHAI</span><strong>草坪防御 / L001</strong></div>
    <div class="boss-telemetry"><div id="boss-health"></div><b id="boss-progress"></b><small id="boss-compute" hidden></small><button id="boss-pause">暂停 Esc</button></div></header>
    <div id="boss-waypoint" hidden></div><div id="boss-aim" hidden>＋ 信标</div>
    <aside id="boss-alert" hidden role="status"><small>CAMPUS DEFENSE SYSTEM</small><strong>检测到未授权管理员</strong><span>THREAT LEVEL: HIGH · DEFENSE UNIT L001</span><b>NEUTRALIZE INTRUDER</b></aside>
    <div id="boss-black" hidden role="status">连接中断 · 正在返回维护区</div>
    <div id="boss-live" hidden><div id="boss-hint"></div><div id="boss-feedback" role="status"></div>
      <div id="boss-actions"><div id="boss-q" class="boss-skill"></div><div id="boss-r" class="boss-skill"></div><span id="boss-f"></span></div>
      <div class="boss-controls" id="boss-controls">WASD 移动 · 拖动鼠标转向 · Shift 奔跑 · V 切换视角</div></div>
    <section id="boss-brief"><div class="boss-card"><small>2030　/　校园安防网络</small><h1 id="boss-title"></h1>
      <p id="boss-story"></p><div class="boss-buttons"><button class="boss-primary" id="boss-mac">打开 MacBook　C</button>
      <button id="boss-start">进入草坪</button><a class="boss-next" id="boss-next" hidden>前往体育馆 · 篮球馆救援</a></div>
      <p id="boss-slots"></p><details id="boss-bindings"><summary>技能按键</summary>
        <label>技能槽 1 <select id="boss-stun-key"></select></label>
        <label>技能槽 2 <select id="boss-lure-key"></select></label></details>
      <nav class="boss-links" aria-label="其他关卡"><a href="?experience=levels">选择关卡</a><a id="boss-home" href="?experience=opening">返回校园开场</a></nav></div></section>
    <aside id="boss-ai-ping" hidden role="status" aria-live="polite" aria-label="岚的提醒">
      <div class="boss-ping-head"><span class="boss-ping-avatar">岚</span><div><b>岚 · 本地核心</b><small>MacBook Air</small></div>
        <button id="boss-ping-close" aria-label="关闭提醒">×</button></div>
      <p>L001 把你标成了入侵者。先退回绿色维护区，再按 C 打开 MacBook，在 Vibe Console 里 Vibe Coding 两个技能。</p>
      <div class="boss-ping-actions"><button id="boss-ping-open">打开 MacBook</button><button id="boss-ping-later">稍后</button></div>
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
const vitals = createVitalsHud('生命');
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
  catch { feedback('浏览器存储不可用，本次进度可继续。'); }
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
    feedback(seenAwakening?'先退至草坪南侧绿色维护区。':'先沿路靠近草坪守卫。');return;
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
  if(!canCast())return {ok:false,message:'请在草坪装备 MacBook 后施放。'};
  const rule=workbench.getSkill(id);
  if(!rule)return {ok:false,message:'此技能尚未部署。'};
  return combat.cast(rule,game.body.position,id==='ghost'?signalAim():undefined);
}
function fieldStatus(id:ProjectId):FieldSkillStatus{
  const service=workbench.session();
  if(service.field)return service.field.read(id);
  const rule=workbench.getSkill(id),cooldown=state.cooldown[id];
  const check=rule?combat.check(rule,game.body.position,id==='ghost'?signalAim():undefined):{ok:false,message:'尚未编译'};
  return {target:id==='stun'?'L001':id==='lure'?'阿树':'准星信标',canCast:canCast()&&check.ok,
    reason:check.message,cooldown,cooldownTotal:SKILL_SPECS[id].cooldown};
}
const castsInFlight=new Set<ProjectId>();
async function cast(id:ProjectId) {
  if(!canCast()||castsInFlight.has(id))return {ok:false,message:'当前无法发送技能。'};
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
  }catch(error){result={ok:false,message:error instanceof Error?error.message:'技能接口未响应。'};}
  finally{castsInFlight.delete(id);}
  feedback(result.message);workbench.logCast(id,result.message);
  if(result.ok){
    lastCast={skill:id,message:result.message,frame:game.frame};saveProgress();
    sound.play(id==='ghost'?'view':id==='stun'?'equip':'collect','sfx',undefined,.9,id==='stun'?.65:id==='ghost'?1.4:1.1);
  }
  return result;
}
const phases:Record<string,string> = {
  patrol:'巡逻 · 靠近装置再施放',alert:'已被发现',chase:'L001 追近中',return:'警戒巡航',
  chargeWarn:'冲撞蓄力 · 横移或施放',charge:'避开冲撞路径',chargeRecover:'冲撞收招',
  swipeWarn:'扇区挥爪 · 退出扇区或施放',swipeRecover:'挥爪收招',stunned:'运动系统冻结',
  helperRun:'阿树正在前往侧翼',lured:'L001 正追踪阿树',ghosted:'L001 正追踪信标'
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
  feedback('受到攻击 −'+hit.lost+' 心 · 短暂保护');
  if(hit.dead){
    needsRetry=true;playing=false;blackoutUntil=performance.now()+1650;
    explorer.pause('boss_capture');combat.reset(state.repaired);
  }
  saveProgress();
}
function resumeAfterCapture(){
  needsRetry=false;blackoutUntil=0;runtime=healOpeningHearts(runtime);
  resetToShelter();respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;
  trainingHint='已回到维护区，生命已恢复。技能和已经解除的防御锁已保留。';saveProgress();
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
      if(recordCorePowerCut(mac.instanceId,3))game.event('ai_core_power_cut','AI 核心电源已关闭',{next:'sports-hall'});
    }
    feedback(idx===2?'Emergency Shutdown 已执行':'已解除 '+NODES[idx].name+' · 警戒升级');saveProgress();
  }else if(before!==state.phase&&(state.phase==='chargeWarn'||state.phase==='swipeWarn')){
    sound.play('select','sfx',undefined,.9,state.phase==='chargeWarn'?.65:1.4);
  }
  visuals.syncCollision(state);
}
async function bossAction(action:BossAction,stillCurrent:()=>boolean):Promise<Outcome>{
  const deny=(message:string)=>({ok:false,code:'denied',message});
  if(!stillCurrent()||!game.owner||!game.armed)return deny('控制权已撤销。');
  const service=workbench.session().vibe;
  if(action.type==='cast'){
    const key=action.slot===1?skillKeys.stun:skillKeys.lure;
    const id=service.projects.find(p=>service.slots().equipped[p.id]===key)?.id;
    if(!id)return deny('装备槽为空。');
    const result=await cast(id);
    return {...result,code:result.ok?'cast':'rejected'};
  }
  const allowed=()=>stillCurrent()&&leg==='prepare'&&atMaintenance(game.body.position)&&game.inventory.equipped?.instanceId===mac.instanceId&&workbench.session().vibe===service;
  if(!allowed())return deny('请在维护区装备 MacBook，并保持控制权。');
  service.edit(action.project,action.prompt);
  const plan=action.source==='preset'?await service.preset?.(action.project,action.prompt):await service.preview(action.project,action.prompt);
  if(!plan?.ok)return deny(plan?.message??'当前编译服务没有离线方案。');
  if(!allowed())return deny('编译权限已变化。');
  const tests=await service.test(plan.value);
  if(!tests.ok)return deny(tests.message);
  if(!tests.value.length||tests.value.some(t=>t.actual!==t.expected)||!allowed())return deny('规则测试失败或授权过期。');
  const installed=await service.install(plan.value);
  if(!installed.ok)return deny(installed.message);
  const project=plan.value.project;
  if(!allowed()||!service.slots().equipped[project])return deny('未收到有效装备回执。');
  return {ok:true,code:'compiled',id:project,message:SKILL_SPECS[project].name+' 已部署。'};
}
const operation = () => ({ok:false,code:'manual_hold',message:'在安全窗口内靠近当前装置并长按 F。'});
game.scenario = {
  tick:simulate,interact:operation,bossAction,
  computer(){if(game.owner)return {ok:false,code:'use_compile',message:'通过受控的 compile 动作编译。'};openMac();return {ok:inWorkbench,code:'workbench',message:inWorkbench?'技能工作台已打开':'请返回维护区'};},
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
  node.innerHTML='<kbd></kbd><i aria-hidden="true"></i><b></b><small></small><progress value="0" max="1" aria-label="冷却进度"></progress>';
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
  setText(element('progress'),done?'核心已断电':'防御锁　'+locks+' / 2');
  vitals.update(runtime.hearts);
  const service=workbench.session().vibe,slots=service.slots(),equipment=slots.equipped;
  element('compute').hidden=leg!=='combat'||!slots.budget;
  if(slots.budget)setText(element('compute'),'B4 余量 '+slots.budget.available+' / '+slots.budget.total);
  if(briefing){
    const info=leg==='arrival'?
      ['草坪上的守卫','B4 备用超算已上线。草坪上的 L001 守卫着核心电源。进入草坪，靠近狮子检查它的状态。','进入草坪']:
      leg==='withdraw'?['撤回维护区','L001 已将你标记为入侵者。沿绿色标记退回维护区，用手中的电脑接入备用超算。','返回现场']:
      leg==='prepare'?['草坪维护区',trainingHint||'在电脑的 Vibe Console 任选两个项目，用自己的话描述意图，检查参数、测试、编译并部署。三个技能均可为防御锁创造操作窗口。','开始行动']:
      done?['L001 已安全关机','核心电源已切断。狮子的眼灯熄灭，校园正在恢复。篮球馆的救援通道现已开放。','再次挑战']:
      ['行动已暂停','两个防御锁解除后才能关闭电源。看准警告、靠近装置，用软件技能创造安全窗口，再长按 F。','继续行动'];
    setText(element('title'),info[0]);setText(element('story'),info[1]);setText(element('start'),info[2]);
    element('mac').hidden=leg!=='prepare'&&!(leg==='combat'&&atMaintenance(game.body.position));
    element('start').hidden=leg==='prepare'&&!equipped();element('next').hidden=!done;
    element('bindings').hidden=done;
    setText(element('slots'),done?'任务记录 · ai_core_power_cut':leg==='prepare'?'Vibe Console　'+Object.keys(equipment).length+' / '+slots.capacity+' 已部署':'WASD 移动 · Shift 奔跑 · 拖动鼠标转向');
  }
  element('aim').hidden=true;element('waypoint').hidden=!live;
  if(!live)return;
  const node=NODES[idx];
  const objective=leg==='arrival'?{name:'L001 守卫',...trigger}:leg==='withdraw'||leg==='prepare'?{name:'草坪维护区',...SAFE}:node;
  const range=distanceTo(objective);
  let hint=leg==='arrival'?'靠近草坪守卫，检查安防连接':leg==='withdraw'?(atMaintenance(game.body.position)&&seenAwakening?'已进入维护区，按 C 打开 MacBook':'系统误判入侵 · 沿标记退回绿色维护区'):leg==='prepare'?'在维护区编译两个技能':'';
  if(leg==='combat'){
    hint=phases[state.phase]??'靠近装置，准备施放';
    if(canSubmit(state))hint='安全窗口 '+state.remaining.toFixed(1)+' s · '+(range>SUBMIT_RADIUS?'进入装置光圈':'长按 F '+(idx===2?'紧急断电':'解除防御锁'));
    else if(atMaintenance(game.body.position))hint='出发前可按 C 修改程序，向装置方向移动开始行动';
    if(respawnGrace>0)hint+=' · 保护 '+respawnGrace.toFixed(1)+' s';
  }
  setText(element('hint'),objective.name+'　/　'+hint);
  setText(element('feedback'),noticeTime>0?notice:'');
  const active=leg==='combat';
  element('actions').hidden=!active;
  setText(element('controls'),active&&equipment.ghost?'拖动鼠标移动青色信标落点 · '+equipment.ghost+' 投放 · Shift 奔跑 · V 切换视角':'WASD 移动 · 拖动鼠标转向 · Shift 奔跑 · Space 跳跃 · V 切换视角');
  if(active){
    const keys=[skillKeys.stun,skillKeys.lure];
    for(const [index,slot] of hudSlots.entries()){
      const project=service.projects.find(p=>equipment[p.id]===keys[index]);slot.node.hidden=!project;
      if(!project)continue;
      const status=fieldStatus(project.id);
      setText(slot.key,keys[index]);setText(slot.icon,skillMark[project.id]);setText(slot.label,project.name);
      setText(slot.status,status.cooldown>0?'冷却 '+status.cooldown.toFixed(1)+' s':status.canCast?'可施放 · '+status.target:status.reason);
      slot.node.title=status.reason;slot.node.classList.toggle('can-cast',status.canCast);
      const fraction=status.cooldownTotal>0?1-Math.min(1,status.cooldown/status.cooldownTotal):1;
      if(slot.progress.value!==fraction)slot.progress.value=fraction;
    }
    setText(element('f'),state.submit>0?'F　'+Math.round(state.submit*100)+'%':'F　长按操作');
    if(equipment.ghost)mapMarker(element('aim'),signalAim(),.25,false);
  }
  const marker=element('waypoint'),behind=mapMarker(marker,objective,1.15,true);
  setText(marker,(behind?'转身　':'')+'◇ '+objective.name+'　'+range.toFixed(1)+' m');
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
