import {Vector3} from 'three';
import {cloneBuildings, SITE} from '../model/campusParameters';
import {buildSite} from '../model/buildSite';
import {disposeAsset} from '../model/buildCampus';
import {prepareModelTextures} from '../model/deferredTextures';
import {createSiteViewer} from '../viewer/siteViewer';
import {createExplorer} from '../exploration/controller';
import {OPENING_SAVE_KEY, parseOpeningSave} from '../opening/persistence';
import {OPENING_MAX_HEARTS, OPENING_RESPAWN_GRACE_SECONDS, createOpeningRuntime, damageOpeningHearts, healOpeningHearts} from '../opening/runtime';
import {createVitalsHud} from '../ui/vitals';
import {CampusAudio} from '../gameplay/audio';
import {DEFAULT_SETTINGS} from '../gameplay/save';
import {setText} from '../ui/dom';
import {restoreKitLayout} from './kit';
import {createCombat, BOSS, NODES, SAFE, checkpoint, canSubmit, SUBMIT_RADIUS} from './combat';
import {createBossScene} from './scene';
import {batchLawnScenery} from './scenery';
import {createBossMacBook} from './macbook';
import {COOLDOWN,evaluateSkill,type SkillKind} from './rules';
import type {FieldSkillStatus} from './deviceServices';
import type {ProjectId} from './consoleService';
import '../style.css';
import './play.css';

document.title = 'L001 草坪防御 · HKU Shanghai';
document.body.classList.add('lion-game');
document.querySelector('#app')!.innerHTML = `
  <main id="boss-field" aria-label="校园草坪狮子战"><div id="boss-view"></div>
    <header class="boss-header"><div><span>HKU SHANGHAI</span><strong>草坪防御 / L001</strong></div>
    <div class="boss-telemetry"><div id="boss-health"></div><b id="boss-progress"></b><button id="boss-pause">暂停 Esc</button></div></header>
    <div id="boss-waypoint" hidden></div>
    <div id="boss-live" hidden><div id="boss-hint"></div><div id="boss-feedback" role="status"></div>
      <div id="boss-actions"><div id="boss-q" class="boss-skill"></div><div id="boss-r" class="boss-skill"></div><span id="boss-f"></span></div>
      <div class="boss-controls">WASD 移动 · 拖动鼠标转向 · Shift 奔跑 · V 切换视角</div></div>
    <section id="boss-brief"><div class="boss-card"><small>第一章　失控的开学典礼</small><h1 id="boss-title"></h1>
      <p id="boss-story"></p><div class="boss-buttons"><button class="boss-primary" id="boss-mac">和 AI 对话　C</button>
      <button id="boss-start">进入草坪</button><button id="boss-back">返回维护区</button></div>
      <p id="boss-slots"></p>
      <nav class="boss-links" aria-label="其他关卡"><a href="?experience=levels">选择关卡</a><a id="boss-home" href="?experience=opening">返回校园开场</a></nav></div></section>
    <aside id="boss-ai-ping" hidden role="status" aria-live="polite" aria-label="岚的提醒">
      <div class="boss-ping-head"><span class="boss-ping-avatar">岚</span><div><b>岚 · 本地核心</b><small>MacBook Air</small></div>
        <button id="boss-ping-close" aria-label="关闭提醒">×</button></div>
      <p>前面就是 L001。开打前先在 MacBook 里 Vibe Coding 一下技能——按 C 打开，我已经把两套反制程序备好了。</p>
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
    if (opening?.story.stage === 'complete') return opening;
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
let restored = 0;
let runtime = openingSave?.runtime ?? createOpeningRuntime();
try {
  const save = JSON.parse(localStorage.getItem(saveKey) ?? 'null');
  if (Number.isInteger(save?.repaired) && save.repaired >= 0 && save.repaired <= 3) {
    restored = save.repaired;
    restoreKitLayout(game.inventory,save.slotOrder,save.selectedHotbar);
    if (save.view === 'first' || save.view === 'third') game.view = save.view;
    if (Number.isInteger(save.hearts) && save.hearts >= 0 && save.hearts <= OPENING_MAX_HEARTS) runtime = {...runtime,hearts:save.hearts};
    if (Number.isSafeInteger(save.catches) && save.catches >= 0) runtime = {...runtime,catches:save.catches};
  }
} catch { /* Storage is optional for one session. */ }
const combat = createCombat(restored);
const visuals = createBossScene(campus.root,explorer.world,viewer.scene);
const state = combat.state;
let playing = false, holding = false, inWorkbench = false, notice = '', noticeTime = 0;
let needsRetry = runtime.hearts === 0;
let hurt = needsRetry;
let respawnGrace = 0;
const vitals = createVitalsHud('生命');
element('health').append(vitals.element);
const skillKeys = {stun:'Q',lure:'R'};
const skillMark:Record<ProjectId,string> = {stun:'❄',lure:'⌘',ghost:'◎'};
const workbench = createBossMacBook({
  opening:openingSave,game,instanceId:mac.instanceId,requestDistract:()=>localCast('lure'),
  status:() => ({repaired:state.repaired,runtime,player:[game.body.position.x,game.body.position.y,game.body.position.z],combat:state,canAct:canCast()}),
  host:element('mac-host'), storageKey:saveKey+'.skills',
  onClose() { redrawUntil=performance.now()+900;workbench.close(); inWorkbench = false; explorer.closePanel(); refresh(); },
  onDeploy() { sound.play('equip'); refresh(); },
});
const equipped = () => Object.keys(workbench.session().vibe.slots().equipped).length===2;
void workbench.ensureSkills().then(()=>refresh()).catch(()=>{});

let savedRevision = game.inventory.revision, savedView = game.view;
function saveProgress() {
  savedRevision = game.inventory.revision; savedView = game.view;
  try { localStorage.setItem(saveKey,JSON.stringify({
    repaired:state.repaired,hearts:runtime.hearts,catches:runtime.catches,
    slotOrder:game.inventory.slots.map(slot=>slot?.instanceId ?? null),selectedHotbar:game.inventory.selectedHotbar,view:game.view,
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
function openMac() {
  if (inWorkbench || game.inventoryOpen || state.repaired === 3) return;
  if (playing && distanceTo(SAFE) > 2.5) { feedback('按 '+skillKeys.stun+' / '+skillKeys.lure+' 施放技能。按 Esc 可返回维护区。'); return; }
  if (!game.inventory.equipItem(macId)) return;
  hidePing();
  if (playing) returnToMaintenance();
  holding = false; inWorkbench = true;
  redrawUntil=performance.now()+900;
  explorer.openPanel('computer',true);
  workbench.open();
  refresh();
}
function returnToMaintenance() {
  playing = false; holding = false;
  hidePing();
  combat.reset(state.repaired);
  explorer.pause('maintenance');
  place(SAFE);
  refresh();
}
function launch() {
  if (state.repaired === 3) {
    combat.reset(0); runtime = healOpeningHearts(runtime); needsRetry = hurt = false; saveProgress(); returnToMaintenance(); return;
  }
  if (!equipped()) { openMac(); return; }
  if (needsRetry) { runtime = healOpeningHearts(runtime); needsRetry = false; saveProgress(); }
  if (hurt) respawnGrace = OPENING_RESPAWN_GRACE_SECONDS;
  hurt = false;
  game.inventory.equipItem(macId);
  playing = true;
  holding = false;
  void sound.start();
  explorer.enterCompat();
  window.setTimeout(showPing,1800);
  refresh();
}
function canCast(){
  return playing&&!game.paused&&!game.panel&&!game.inventoryOpen&&game.inventory.equipped?.instanceId===mac.instanceId;
}
function localCast(id:SkillKind) {
  if(!canCast())return {ok:false,message:'请在草坪装备 MacBook 后施放。'};
  const rule=workbench.getSkill(id);
  if(!rule)return {ok:false,message:'此技能尚未部署。'};
  return combat.cast(rule,game.body.position);
}
function fieldStatus(id:ProjectId):FieldSkillStatus{
  const service=workbench.session();
  if(service.field)return service.field.read(id);
  const rule=id==='ghost'?null:workbench.getSkill(id);
  if(!rule)return {target:null,canCast:false,reason:'未连接到战斗端',cooldown:0,cooldownTotal:0};
  const cooldown=state.cooldown[rule.kind];
  const check=evaluateSkill(rule,{phase:state.phase,cooldown,distance:distanceTo(state.lion),helperReady:state.phase!=='helperRun'&&state.phase!=='lured'});
  return {target:rule.kind==='stun'?'L001':'阿树 → L001',canCast:canCast()&&check.ok,reason:check.message,cooldown,cooldownTotal:COOLDOWN};
}
const castsInFlight=new Set<ProjectId>();
async function cast(id:ProjectId) {
  if(!canCast()){feedback('请在快捷栏选中 MacBook 后施放。');return;}
  if(castsInFlight.has(id))return;
  castsInFlight.add(id);
  try{
    const field=workbench.session().field;
    let result:{ok:boolean;message:string};
    if(field){
      const status=field.read(id);
      if(!status.canCast){feedback(status.reason);return;}
      const confirmed=await field.cast(id);
      result={ok:confirmed.ok,message:confirmed.ok?confirmed.value:confirmed.message};
    }else result=id==='ghost'?{ok:false,message:'运行时未注册此技能。'}:localCast(id);
    feedback(result.message);workbench.logCast(id,result.message);
    if(result.ok)sound.play('equip');
  }catch(error){feedback(error instanceof Error?error.message:'技能接口未响应。');}
  finally{castsInFlight.delete(id);}
}
const distanceTo = (point:{x:number;z:number}) => Math.hypot(game.body.position.x-point.x,game.body.position.z-point.z);
const phases:Record<string,string> = {
  safe:'前往标出的维护节点',ready:'留意 L001 的起手动作',chargeWarn:'冲撞蓄力',
  charge:'冲撞　·　横移躲开',chargeRecover:'冲撞结束　·　准备下一轮',
  swipeWarn:'挥爪预警　·　退出扇区，等它收爪',swipeRecover:'挥爪收招',
  stunned:'狮子已麻痹',helperRun:'阿树正前往牵制点',lured:'狮子正在追踪阿树',return:'狮子正在归位',
};
function simulate(dt:number) {
  if (!playing || state.repaired >= 3) return;
  if (noticeTime > 0) noticeTime -= dt;
  const idx = state.repaired;
  if (respawnGrace > 0) { respawnGrace = Math.max(0, respawnGrace-dt); return; }
  if (state.phase === 'safe' && (distanceTo(checkpoint(idx)) <= 1.45 || distanceTo(NODES[idx]) <= 1.8)) combat.start();
  const before = state.phase;
  const event = combat.step(dt,game.body.position,holding && game.inventory.equipped?.instanceId === mac.instanceId);
  if (event === 'hit') {
    const damage = damageOpeningHearts(runtime);
    runtime = damage.runtime; needsRetry = damage.dead; hurt = true;
    holding = false; playing = false; combat.reset(idx); explorer.pause('boss_hit'); place(checkpoint(idx));
    saveProgress();
  } else if (event === 'repair') {
    holding = false; sound.play('complete'); saveProgress();
    feedback('已提交 · '+NODES[idx].name);
    if (state.repaired >= 3) { playing = false; explorer.pause('boss_complete'); }
  } else if (before !== state.phase && (state.phase === 'chargeWarn' || state.phase === 'swipeWarn')) {
    sound.play('select','ui',undefined,0.8,state.phase === 'chargeWarn' ? 0.65 : 1.4);
  }
  visuals.syncCollision(state);
}
const operation = () => ({ok:false,code:'manual_hold',message:'在维护窗口内长按 F 提交'});
game.scenario = {
  tick:simulate, interact:operation, computer() { openMac(); return {ok:inWorkbench,code:'assistant',message:inWorkbench?'MacBook 已打开':'请返回维护区'}; },
  snapshot:() => ({combat:structuredClone(state),player:game.body.position.toArray(),hearts:runtime.hearts,catches:runtime.catches,paused:game.paused,playing,inWorkbench,
    macInstance:mac.instanceId,view:game.view,inventory:game.inventory.snapshot(),skills:{stun:workbench.getSkill('stun'),lure:workbench.getSkill('lure')}}),
  spawn:returnToMaintenance,
};
explorer.computers.add(openMac);
explorer.interactions.add(() => { if (playing) holding = true; });
const events = new AbortController();
window.addEventListener('keydown', event => {
  if (event.repeat || game.paused || event.ctrlKey || event.metaKey || event.altKey || game.panel || game.inventoryOpen) return;
  for(const [id,key] of Object.entries(workbench.session().vibe.slots().equipped)){
    if(event.code==='Key'+key.toUpperCase()){event.preventDefault();void cast(id as ProjectId);break;}
  }
},{signal:events.signal});
window.addEventListener('keyup',e => { if (e.code === 'KeyF') holding = false; },{signal:events.signal});
const point = new Vector3();
const hudSlots=['q','r'].map(name=>{
  const node=element(name);
  node.innerHTML='<kbd></kbd><i aria-hidden="true"></i><b></b><small></small><progress value="0" max="1" aria-label="冷却进度"></progress>';
  return {node,key:node.querySelector('kbd')!,icon:node.querySelector('i')!,label:node.querySelector('b')!,status:node.querySelector('small')!,progress:node.querySelector('progress')!};
});
function refresh() {
  const idx = state.repaired;
  const done = idx === 3;
  const briefing = !inWorkbench && !game.inventoryOpen && (game.paused || !playing);
  const live = !briefing && !inWorkbench && !game.inventoryOpen && !done;
  document.body.classList.toggle('exploring',live);
  document.body.classList.toggle('mac-in-use',inWorkbench);
  if (!live) holding = false;
  element('brief').hidden = !briefing;
  element('live').hidden = !live;
  element('pause').hidden = !live;
  setText(element('progress'),'系统修复　'+idx+' / 3');
  vitals.update(runtime.hearts);
  if (briefing) {
    setText(element('title'),done?'L001 已安全关机':hurt?'防御命中':playing?'已暂停':'草坪上的守卫');
    setText(element('story'),done?'防御系统已承认你的维修身份。狮子完成行礼，草坪恢复安全。入侵来源：未知。':
      hurt?(needsRetry?'体力耗尽。重试将恢复体力，已提交的修复继续有效。':'已退回当前节点安全点，继续后可以重新引招。'):
      playing?'战斗与维护窗口已冻结。继续可从当前时机接着操作。':
      '清除病毒时，校园防御系统把你标为了入侵者。往草坪深处走之前，岚会提醒你先 Vibe Coding 几个技能：MacBook 里已经备好两套反制程序，按 C 和岚确认 Q / R 的时机，再上草坪提交三步修复。');
    element('mac').hidden = done || playing || hurt;
    element('back').hidden = done || (!playing && !hurt);
    element('start').hidden = !done && !equipped();
    setText(element('start'),done?'再次挑战':hurt?'重试当前节点':playing?'继续战斗':'进入草坪');
    const slots=workbench.session().vibe.slots();
    setText(element('slots'),done?'维修记录　3 / 3':'本地 AI 已部署　'+Object.keys(slots.equipped).length+' / '+slots.capacity+'　·　Q 短时麻痹　R 助手牵制');
  }
  element('waypoint').hidden = !live;
  if (!live) return;
  const node = NODES[idx];
  const range = distanceTo(node);
  const remaining = Math.max(0,state.remaining).toFixed(1);
  let hint = phases[state.phase] ?? '';
  if (state.phase === 'ready' || state.phase === 'safe') hint += node.kind === 'stun' ? '　·　中距离诱出冲撞' : '　·　靠近引出挥爪';
  if (state.phase === 'chargeWarn') hint += node.kind === 'stun' ? '　·　按 '+skillKeys.stun+' 打断' : '　·　横移出箭头，再靠近诱出挥爪';
  if (state.phase === 'swipeRecover') hint += node.kind === 'lure' ? '　·　按 '+skillKeys.lure+' 呼叫阿树' : '　·　拉开距离诱出冲撞';
  const open = canSubmit(state);
  if (respawnGrace > 0) hint = '检查点保护　'+respawnGrace.toFixed(1)+' 秒';
  if (open) hint = '维护窗口 '+remaining+' 秒　·　'+(range > SUBMIT_RADIUS ? '走入节点光圈' : '现在长按 F 提交');
  else if (state.phase === 'stunned' || state.phase === 'lured') hint += '　·　本节点需要'+(node.kind === 'stun'?'麻痹':'助手牵制');
  setText(element('hint'),node.name+'　/　'+hint);
  setText(element('feedback'),noticeTime > 0 ? notice : '');
  const service=workbench.session().vibe,equipment=service.slots().equipped;
  const loadout=service.projects.filter(project=>equipment[project.id]);
  for(const [index,slot] of hudSlots.entries()){
    const project=loadout[index];slot.node.hidden=!project;
    if(!project)continue;
    const status=fieldStatus(project.id);
    setText(slot.key,equipment[project.id]!);setText(slot.icon,skillMark[project.id]);setText(slot.label,project.name);
    setText(slot.status,status.cooldown>0?'冷却 '+status.cooldown.toFixed(1)+' s':status.canCast?'目标就绪 · '+status.target:'等待合法目标');
    slot.node.title=status.reason;
    slot.node.classList.toggle('can-cast',status.canCast);
    const fraction=status.cooldownTotal>0?1-Math.min(1,status.cooldown/status.cooldownTotal):1;
    if(slot.progress.value!==fraction)slot.progress.value=fraction;
  }
  setText(element('f'),state.submit > 0?'F　提交 '+Math.round(state.submit*100)+'%':'F　长按提交');
  point.set(node.x,1.1,node.z).project(explorer.camera);
  const behind = point.z > 1;
  const x = behind ? (point.x > 0 ? 0.07 : 0.93) : Math.max(0.07,Math.min(0.93,point.x*.5+.5));
  const y = behind ? 0.54 : Math.max(0.18,Math.min(0.72,.5-point.y*.5));
  const marker = element('waypoint');
  marker.style.left = (x*100).toFixed(2)+'%'; marker.style.top = (y*100).toFixed(2)+'%';
  setText(marker,(behind?'转身　':'')+'◇ '+(idx+1)+' 号节点　'+range.toFixed(1)+' m');
}
button('mac').onclick = openMac;
pingOpen.onclick = () => { hidePing(); openMac(); };
pingClose.onclick = hidePing;
pingLater.onclick = hidePing;
button('start').onclick = launch;
button('back').onclick = () => { hurt = false; returnToMaintenance(); };
button('pause').onclick = () => explorer.pause('pause_button');
explorer.setEnabled(true);
place(restored === 0 || restored === 3 ? SAFE : checkpoint(restored));
viewer.beforeRender.add(dt => {
  if (!game.paused) redrawUntil=performance.now()+1800;
  if (savedRevision !== game.inventory.revision || savedView !== game.view) redrawUntil=performance.now()+150;
  explorer.update(dt);
  if(inWorkbench)workbench.update();
  scenery.update(explorer.camera);
  visuals.render(state);
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
  explorer.pause('page_hidden');
  if (event.persisted) return;
  events.abort(); observer.disconnect(); workbench.dispose(); visuals.dispose();
  vitals.dispose(); explorer.dispose(); sound.dispose(); scenery.dispose(); disposeAsset(campus.root); viewer.dispose();
});
