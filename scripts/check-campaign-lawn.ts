/**
 * Task 3: the lawn guardian inside the one-world campaign.
 *
 * Builds the opening-mode campus headless, attaches the lawn chapter with a stub
 * ChapterContext and plays the fight through the chapter's own input routes:
 * Q (window keydown) during `chargeWarn`, then F (`chapter.interact()`, the
 * host's F route) held inside the shutdown ring, released by keyup.
 */
import assert from 'node:assert/strict';
import * as T from 'three';

// Node has no browser storage or window: the real mission/world-threat writers run against these.
const saved=new Map<string,string>();
const win=new EventTarget();
Object.assign(globalThis,{
 localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,String(v));},removeItem:(k:string)=>{saved.delete(k);}},
 window:win,
});
const key=(type:'keydown'|'keyup',code:string)=>win.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{code}));

const {buildSite}=await import('../src/model/buildSite');
const {BUILDINGS,SITE}=await import('../src/model/campusParameters');
const {createNavigation}=await import('../src/exploration/navigation');
const {CampusGame}=await import('../src/exploration/game');
const {EXPLORATION}=await import('../src/exploration/config');
const {findPath}=await import('../src/exploration/pathfind');
const {NOV13}=await import('../src/model/nov13Parameters');
const {NODES,SAFE,atMaintenance}=await import('../src/lionBoss/combat');
const {hasCorePowerCut,recordCorePowerCut}=await import('../src/lionBoss/mission');
const {loadWorldThreat}=await import('../src/gameplay/worldThreat');
const {OPENING_MAX_HEARTS,OPENING_CAPTURE_DAMAGE}=await import('../src/opening/runtime');
const {LAWN_ENTRY,createLawnChapter}=await import('../src/campaign/lawnChapter');
const {CAMPAIGN_TRANSITIONS,createCampaignState,reduceCampaign}=await import('../src/campaign/state');
type CampaignEvent=import('../src/campaign/state').CampaignEvent;
type Explorer=import('../src/campaign/types').Explorer;
type CombatState=import('../src/lionBoss/combat').CombatState;
type ChapterContext=import('../src/campaign/types').ChapterContext;
type CampaignStage=import('../src/campaign/state').CampaignStage;

interface LawnDebug{
 rig():{meshes:T.Object3D[];clips:Record<string,T.AnimationClip>}|null;
 state():CombatState|null;
 hearts():number;
}

const device='campaign-lawn-check-mac',dt=1/120;

/* The opening-mode world: one campus model, one navigation, one game. */
const asset=buildSite(BUILDINGS,SITE,true);
const world=createNavigation(BUILDINGS,SITE,true);
const game=new CampusGame(world,BUILDINGS,SITE);
game.paused=false;
const anchor=asset.root.getObjectByName(NOV13.lion.id);
assert.ok(anchor?.getObjectByName('Lion_body_uniform_scale'),'the opening campus model carries the authored L001 body');

/* The lawn entry is the standalone fight's shelter, reachable on foot from the B04 entrance. */
assert.deepEqual([LAWN_ENTRY.point[0],LAWN_ENTRY.point[2]],[SAFE.x,SAFE.z]);
assert.equal(LAWN_ENTRY.event,'reach_lawn');
assert.equal(CAMPAIGN_TRANSITIONS.reach_lawn.from,'to_lawn');
const chapter=createLawnChapter();
assert.deepEqual(chapter.approach[0],[58,25],'the approach starts at the B04 entrance outside point');
assert.deepEqual(chapter.approach.at(-1),[SAFE.x,SAFE.z],'the approach ends at the lawn entry');
const opts={clearance:EXPLORATION.radius,maxStepHeight:EXPLORATION.maxStep,maxDrop:EXPLORATION.maxDrop};
const leg=findPath(world,[58,0,25],LAWN_ENTRY.point,opts);
assert.ok(leg.ok&&leg.reachable,'the lawn entry is walkable from the B04 entrance: '+leg.reason);
// The drawn approach is walkable leg by leg (each corner reaches the next).
for(let i=1;i<chapter.approach.length;i++){
 const [ax,az]=chapter.approach[i-1],[bx,bz]=chapter.approach[i];
 const part=findPath(world,[ax,world.support(ax,az,2)??0,az],[bx,world.support(bx,bz,2)??0,bz],opts);
 assert.ok(part.ok&&part.reachable,`approach leg ${i} (${ax},${az})→(${bx},${bz}) is walkable: ${part.reason}`);
}

const explorer={game,world,camera:new T.PerspectiveCamera(),interactions:new Set<()=>void>(),pause(){game.pause('check');}} as unknown as Explorer;
const scene=new T.Scene();
const stubContext=(o:{stage:()=>CampaignStage;emit:(e:CampaignEvent)=>boolean;deviceId:string;hearts?:ChapterContext['hearts']}):ChapterContext=>({
 scene,root:()=>asset.root,explorer,deviceId:()=>o.deviceId,stage:o.stage,emit:o.emit,notify:()=>{},
 atmosphere:()=>undefined,openPanel(){},closePanel(){},resume(){},card:async()=>{},hearts:o.hearts});

/* debug.complete() is a lawn shortcut only: from a Building 4 stage it changes nothing. */
{
 const early=createLawnChapter(),tries:CampaignEvent[]=[];
 early.attach(stubContext({stage:()=>'b4_keyboard',emit:e=>{tries.push(e);return false;},deviceId:'campaign-lawn-early-mac'}));
 assert.equal((early.debug!.complete as ()=>unknown)(),'b4_keyboard','debug.complete() outside the lawn returns the stage unchanged');
 assert.deepEqual(tries,[],'debug.complete() outside the lawn emits nothing');
 assert.equal(hasCorePowerCut('campaign-lawn-early-mac'),false,'debug.complete() outside the lawn writes no core power cut');
 assert.deepEqual(loadWorldThreat().flags,{lionDefeated:false,powerCut:false,localModelCleared:false},'debug.complete() outside the lawn writes no world-threat flags');
 early.detach();
}

/* The one hearts store: the opening runtime, reached through ctx.hearts (a spy here). */
const heartCalls:string[]=[];let spyHearts=OPENING_MAX_HEARTS;
const hearts:NonNullable<ChapterContext['hearts']>={get:()=>spyHearts,max:OPENING_MAX_HEARTS,
 damage(n){heartCalls.push('damage:'+n);spyHearts=Math.max(0,spyHearts-n);return spyHearts;},
 heal(){heartCalls.push('heal');spyHearts=OPENING_MAX_HEARTS;return spyHearts;}};

/* Attach as the host does: during the to_lawn walk, before the fight. */
let campaign=createCampaignState(device);
for(const e of ['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected'] as const)campaign=reduceCampaign(campaign,e).state;
assert.equal(campaign.stage,'to_lawn');
const emitted:CampaignEvent[]=[];
const emit=(e:CampaignEvent)=>{const r=reduceCampaign(campaign,e);if(r.changed){campaign=r.state;emitted.push(e);}return r.changed;};
chapter.attach(stubContext({stage:()=>campaign.stage,emit,deviceId:device,hearts}));
const debug=chapter.debug as unknown as LawnDebug;

const rig=debug.rig?.();
assert.ok(rig,'attach builds the rigged boss on the opening campus root');
assert.ok(rig.meshes.length>0&&rig.meshes.every(m=>m instanceof T.SkinnedMesh),'the lion body is skinned');
assert.ok(anchor!.getObjectByName('Lion_body_uniform_scale')!.getObjectsByProperty('isSkinnedMesh',true).length>0,'the skinned body lives in the campus model');
for(const clip of ['idle','walk','charge','shutdown'])assert.ok(rig.clips[clip],'the rig has the '+clip+' clip');
assert.ok(scene.getObjectByName('L001_boss_gameplay'),'the fight props are in the one scene');

const pos=game.body.position;
const place=(at:{x:number;z:number})=>{pos.set(at.x,world.support(at.x,at.z,2)??0,at.z);game.body.velocity.set(0,0,0);};
const frames=(seconds:number)=>{for(let f=0;f<Math.ceil(seconds/dt);f++)chapter.update(dt);};
const until=(test:()=>boolean,timeout=25)=>{for(let f=0;f<timeout/dt;f++){if(test())return;chapter.update(dt);}assert.fail('timed out in '+debug.state()?.phase);};

place({x:58,z:25});frames(1);
assert.equal(debug.state()?.phase,'safe','the guardian sleeps while the player is still walking to the lawn');
assert.equal(chapter.interact(),false,'F is not consumed before the fight');

/* Arrival: the host emits reach_lawn inside the entry radius; the fight starts there, no teleport. */
place(SAFE);
assert.ok(emit('reach_lawn'));frames(dt);
assert.equal(debug.state()?.phase,'patrol','arriving on the lawn wakes L001');
assert.ok(atMaintenance(pos),'the player starts the fight on the shelter pad');
const lawn=chapter.objective('lawn');
assert.ok(lawn&&lawn.text.length>0&&lawn.target,'the objective line and marker come from the chapter');
assert.deepEqual([lawn.target[0],lawn.target[2]],[NODES[0].x,NODES[0].z]);

/* A capture costs hearts and returns the player to the shelter; no pause, no game over. */
const node=NODES[0],watcher={x:node.x,z:node.z+2.2};
const full=debug.hearts();
assert.equal(full,OPENING_MAX_HEARTS);
place(watcher);
until(()=>debug.state()?.phase==='charge');
until(()=>debug.hearts()<full);
assert.equal(debug.hearts(),full-OPENING_CAPTURE_DAMAGE,'one capture costs the shared capture damage');
assert.deepEqual(heartCalls,['damage:'+OPENING_CAPTURE_DAMAGE],'a capture damages the opening hearts through ctx.hearts');
assert.ok(atMaintenance(pos),'a capture returns the player to the lawn safe point');
assert.equal(game.paused,false,'a capture keeps the run going');
/* Zero hearts: heal and retry at the shelter. */
let captures=1;
for(;;){
 const before=debug.hearts();place(watcher);
 until(()=>debug.hearts()!==before,40);captures++;
 if(debug.hearts()>before)break;
 assert.ok(captures<=OPENING_MAX_HEARTS,'captures keep costing hearts until zero');
}
assert.equal(captures,Math.ceil(OPENING_MAX_HEARTS/OPENING_CAPTURE_DAMAGE),'the heal comes on the capture that empties the hearts');
assert.equal(debug.hearts(),OPENING_MAX_HEARTS,'zero hearts heals for the retry');
assert.deepEqual(heartCalls.slice(-2),['damage:'+OPENING_CAPTURE_DAMAGE,'heal'],'the emptying capture heals through ctx.hearts');
assert.equal(heartCalls.filter(c=>c==='heal').length,1,'heal is called once, at zero hearts');
assert.ok(atMaintenance(pos),'the retry starts at the shelter');
assert.notEqual(debug.state()?.phase,'complete');

/* Q during the wind-up, then hold F in the ring. */
place(watcher);
until(()=>debug.state()?.phase==='chase'||debug.state()?.phase==='chargeWarn');
key('keydown','KeyQ');
assert.notEqual(debug.state()?.phase,'stunned','Q before the wind-up does nothing');
until(()=>debug.state()?.phase==='chargeWarn');
key('keydown','KeyQ');
assert.equal(debug.state()?.phase,'stunned','Q interrupts the charge');
assert.equal(chapter.interact(),true,'F is the shutdown hold while L001 is frozen');
frames(.3);assert.equal(debug.state()!.submit,0,'holding F outside the ring does not charge the shutdown');
key('keyup','KeyF');
place(node);
assert.equal(chapter.interact(),true);
frames(.3);assert.ok(debug.state()!.submit>0,'holding F in the ring charges the shutdown');
key('keyup','KeyF');frames(dt);assert.equal(debug.state()!.submit,0,'releasing F resets the hold');
assert.equal(chapter.interact(),true);
frames(node.hold+.1);
assert.equal(debug.state()?.phase,'complete','holding F in the ring shuts L001 down');

/* Completion writes through the real writers and hands the campaign on. */
assert.deepEqual(emitted,['reach_lawn','guardian_shutdown']);
assert.equal(campaign.stage,'to_sports');
assert.equal(hasCorePowerCut(device),true,'core power is cut for this MacBook');
const threat=loadWorldThreat();
assert.equal(threat.flags.lionDefeated,true);
assert.equal(threat.flags.powerCut,true);
frames(2);
assert.equal(debug.state()?.phase,'complete','the guardian stays down');
key('keydown','KeyQ');assert.equal(chapter.interact(),false,'Q/F are released after the fight');

/* A resumed run past the lawn keeps the guardian down; detach restores the statue. */
chapter.detach();
assert.equal(scene.getObjectByName('L001_boss_gameplay'),undefined,'detach removes the fight props');
const again=createLawnChapter();
again.attach(stubContext({stage:()=>'to_sports',emit,deviceId:device}));
assert.equal((again.debug as unknown as LawnDebug).state()?.phase,'complete','a run past the lawn restores the shut-down guardian');
again.detach();

/* Core power already cut for this MacBook (e.g. on ?experience=lion-boss): the fight is skipped, but only on the lawn stage. */
{
 const mac='campaign-lawn-resume-mac';recordCorePowerCut(mac);
 let stage:CampaignStage='to_lawn';const sent:CampaignEvent[]=[];
 const resumed=createLawnChapter();
 resumed.attach(stubContext({stage:()=>stage,emit:e=>{sent.push(e);if(e==='guardian_shutdown'&&stage==='lawn'){stage='to_sports';return true;}return false;},deviceId:mac}));
 for(let f=0;f<60;f++)resumed.update(dt);
 assert.deepEqual(sent,[],'a power-cut device emits nothing while still walking to the lawn');
 stage='lawn';
 for(let f=0;f<60;f++)resumed.update(dt);
 assert.deepEqual(sent,['guardian_shutdown'],'on the lawn stage it emits guardian_shutdown once');
 assert.equal(stage,'to_sports');
 resumed.detach();
}

/* Without ctx.hearts (headless stub contexts) the chapter keeps a local count. */
{
 const local=createLawnChapter();
 local.attach(stubContext({stage:()=>'lawn',emit:()=>false,deviceId:'campaign-lawn-local-mac'}));
 const ld=local.debug as unknown as LawnDebug;
 place(SAFE);local.update(dt);
 const start=ld.hearts();place(watcher);
 for(let f=0;f<40/dt&&ld.hearts()===start;f++)local.update(dt);
 assert.equal(ld.hearts(),start-OPENING_CAPTURE_DAMAGE,'the local fallback count takes the capture');
 local.detach();
}
console.log('PASS campaign lawn: rigged L001 on the opening campus, walkable approach, Q/F shutdown, capture→shelter, heal-and-retry, core power cut');
