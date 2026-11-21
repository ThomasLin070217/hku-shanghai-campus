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
import {createBossMacBook} from './macbook';
import type {SkillRule} from './rules';
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
      <div id="boss-actions"><span id="boss-q"></span><span id="boss-r"></span><span id="boss-f"></span></div>
      <div class="boss-controls">WASD 移动 · 拖动鼠标转向 · Shift 奔跑 · V 切换视角</div></div>
    <section id="boss-brief"><div class="boss-card"><small>第一章　失控的开学典礼</small><h1 id="boss-title"></h1>
      <p id="boss-story"></p><div class="boss-buttons"><button class="boss-primary" id="boss-mac">打开 MacBook　C</button>
      <button id="boss-start">进入草坪</button><button id="boss-back">返回维护区</button></div>
      <p id="boss-slots"></p><details id="boss-bindings"><summary>技能按键</summary>
        <label>短时麻痹 <select id="boss-stun-key"></select></label>
        <label>助手牵制 <select id="boss-lure-key"></select></label></details>
      <a id="boss-home" href="./">返回校园开场</a></div></section>
    <div id="boss-workbench-host"></div>
  </main>`;
const element = (id:string) => document.getElementById('boss-'+id)!;
const button = (id:string) => element(id) as HTMLButtonElement;
const view = element('view');
const viewer = createSiteViewer(view);
const buildings = cloneBuildings();
const campus = buildSite(buildings, SITE);
viewer.scene.add(campus.root);
void prepareModelTextures(campus.root).catch(() => {});
viewer.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
viewer.controls.enabled = false;
const explorer = createExplorer(viewer.renderer.domElement, viewer.scene, buildings, SITE);
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
const choices = ['Q','R','T','G','X','Z'];
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
  opening:openingSave, game,
  status:() => ({repaired:state.repaired,runtime,player:[game.body.position.x,game.body.position.y,game.body.position.z]}),
  host:element('workbench-host'), storageKey:saveKey+'.skills', keys:skillKeys,
  onClose() { workbench.close(); inWorkbench = false; explorer.closePanel(); refresh(); },
  onDeploy() { sound.play('equip'); refresh(); },
});
const equipped = () => !!workbench.getSkill('stun') && !!workbench.getSkill('lure');
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
  if (playing) returnToMaintenance();
  holding = false; inWorkbench = true;
  explorer.openPanel('computer');
  workbench.open();
  refresh();
}
function returnToMaintenance() {
  playing = false; holding = false;
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
  refresh();
}
function cast(kind:SkillRule['kind']) {
  if (!playing || game.paused || game.panel || game.inventoryOpen) return;
  if (game.inventory.equipped?.instanceId !== mac.instanceId) { feedback('请在快捷栏选中 MacBook，或按 E 从背包取出。'); return; }
  const rule = workbench.getSkill(kind);
  if (!rule) { feedback('请先在 MacBook 部署这个技能。'); return; }
  const result = combat.cast(rule,game.body.position);
  feedback(result.message);
  if (result.ok) sound.play('equip');
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
  tick:simulate, interact:operation, computer() { openMac(); return {ok:inWorkbench,code:'workbench',message:inWorkbench?'技能工作台已打开':'请返回维护区'}; },
  snapshot:() => ({combat:structuredClone(state),player:game.body.position.toArray(),hearts:runtime.hearts,catches:runtime.catches,paused:game.paused,playing,inWorkbench,
    macInstance:mac.instanceId,view:game.view,inventory:game.inventory.snapshot(),skills:{stun:workbench.getSkill('stun'),lure:workbench.getSkill('lure')}}),
  spawn:returnToMaintenance,
};
explorer.computers.add(openMac);
explorer.interactions.add(() => { if (playing) holding = true; });
const events = new AbortController();
window.addEventListener('keydown', event => {
  if (event.repeat || game.paused || event.ctrlKey || event.metaKey || event.altKey || game.panel || game.inventoryOpen) return;
  for (const kind of ['stun','lure'] as const) {
    if (event.code === 'Key'+skillKeys[kind]) { event.preventDefault(); cast(kind); }
  }
},{signal:events.signal});
window.addEventListener('keyup',e => { if (e.code === 'KeyF') holding = false; },{signal:events.signal});
const point = new Vector3();
function refresh() {
  const idx = state.repaired;
  const done = idx === 3;
  const briefing = !inWorkbench && !game.inventoryOpen && (game.paused || !playing);
  const live = !briefing && !inWorkbench && !game.inventoryOpen && !done;
  document.body.classList.toggle('exploring',live);
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
      '清除病毒时，校园防御系统把你标为了入侵者。用手里的 MacBook 写出短时麻痹和助手牵制，在草坪反制 L001，提交三步修复。');
    element('mac').hidden = done || playing || hurt;
    element('back').hidden = done || (!playing && !hurt);
    element('start').hidden = !done && !equipped();
    setText(element('start'),done?'再次挑战':hurt?'重试当前节点':playing?'继续战斗':'进入草坪');
    setText(element('slots'),done?'维修记录　3 / 3':(skillKeys.stun+' 短时麻痹　'+(workbench.getSkill('stun')?'已部署':'未部署')+'　　 '+skillKeys.lure+' 助手牵制　'+(workbench.getSkill('lure')?'已部署':'未部署')));
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
  for (const [id,kind,label] of [['q','stun','短时麻痹'],['r','lure','助手牵制']] as const) {
    const cooldown = state.cooldown[kind];
    setText(element(id),skillKeys[kind]+'　'+label+'　'+(cooldown > 0 ? cooldown.toFixed(1)+'s' : '就绪'));
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
button('start').onclick = launch;
button('back').onclick = () => { hurt = false; returnToMaintenance(); };
button('pause').onclick = () => explorer.pause('pause_button');
explorer.setEnabled(true);
place(restored === 0 || restored === 3 ? SAFE : checkpoint(restored));
viewer.beforeRender.add(dt => {
  explorer.update(dt);
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
  vitals.dispose(); explorer.dispose(); sound.dispose(); disposeAsset(campus.root); viewer.dispose();
});
