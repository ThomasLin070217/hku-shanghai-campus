/**
 * Task 6: the whole run on foot, headless, in one world.
 *
 * One CampusGame body on the opening-mode campus walks every authored route in
 * order, without teleporting between legs: shuttle → Building 5 → Building 6 →
 * Building 5 → Building 4 handoff (the Chapter 1 routes), then the real campaign
 * host with the real chapters takes over: B04 door → each B4 station → B04 exit →
 * lawn entry → sports hall east door. Each leg must complete; seconds per leg
 * are printed. Also covers the continuity fixes that a walk exposes:
 * the B4 room stays lit until the player has left B04, F goes to the campaign
 * first and the player always gets feedback, Q on the lawn ignores text fields,
 * and a reload past the lawn shows the shut-down rigged lion.
 */
import assert from 'node:assert/strict';
import * as T from 'three';

// Node has no browser storage or window: the real writers (relay, mission, world threat) run against these.
const saved=new Map<string,string>();
const storage={getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,String(v));},removeItem:(k:string)=>{saved.delete(k);},
 get length(){return saved.size;},key:(i:number)=>[...saved.keys()][i]??null,clear:()=>saved.clear()};
const win=new EventTarget();
Object.assign(globalThis,{localStorage:storage,window:win});

const {CampusGame}=await import('../src/exploration/game');
const {createNavigation}=await import('../src/exploration/navigation');
const {BUILDINGS,SITE}=await import('../src/model/campusParameters');
const {buildSite}=await import('../src/model/buildSite');
const {OPENING:O}=await import('../src/opening/spatialLayout');
const {createCampaignHost}=await import('../src/campaign/host');
const {CAMPAIGN_CHAPTERS}=await import('../src/campaign/chapters');
const {B4_STATIONS}=await import('../src/opening/b4Layout');
const {NOV13}=await import('../src/model/nov13Parameters');
const {NODES}=await import('../src/lionBoss/combat');
type ChapterContext=import('../src/campaign/types').ChapterContext;
type Explorer=import('../src/campaign/types').Explorer;
type CampaignStage=import('../src/campaign/state').CampaignStage;

let failures=0;
async function group(name:string,fn:()=>void|Promise<void>){
 try{await fn();console.log('PASS',name);}
 catch(error){failures++;console.log('FAIL',name,'\n     ',error instanceof Error?error.message.split('\n')[0]:String(error));}
}

const dt=1/120,device='campaign-walk-mac';
const asset=buildSite(BUILDINGS,SITE,true);
const world=createNavigation(BUILDINGS,SITE,true);
const game=new CampusGame(world,BUILDINGS,SITE);
const camera=new T.PerspectiveCamera(70,16/9,.05,800);
const explorer={game,world,camera,enabled:true,interactions:new Set<()=>void>(),pause(){},enter(){},enterCompat(){},openPanel(){},closePanel(){}} as unknown as Explorer;
const notices:string[]=[],cards:string[]=[];
const atmosphere={release(){},restoreSealed(){},reset(){},startIncident(){},update(){}};
const settled={then(ok?:()=>void){ok?.();return settled;},catch(){return settled;}} as unknown as Promise<void>;
function makeHost(){
 return createCampaignHost({
  context:{scene:new T.Scene(),root:()=>asset.root,explorer,notify:t=>{notices.push(t);},atmosphere:()=>atmosphere as never,
   openPanel:()=>{},closePanel:()=>{},resume:()=>{},card:(k,t)=>{cards.push(k+' · '+t);return settled;}} as Omit<ChapterContext,'stage'|'emit'|'deviceId'>,
  storage,chapters:CAMPAIGN_CHAPTERS,
 });
}
let host:ReturnType<typeof makeHost>|null=null;

/** Walk the real physics through x/z corners, one body, no teleport. The campaign host (if any) runs every step. */
function walk(points:readonly (readonly number[])[],max=16000){
 let total=0;game.paused=false;
 for(const [x,z] of points){let count=0;
  while(Math.hypot(x-game.body.position.x,z-game.body.position.z)>.1&&count<max){
   game.yaw=Math.atan2(-(x-game.body.position.x),-(z-game.body.position.z));game.human={forward:1,right:0,sprint:false};
   game.step(dt);host?.update(dt);count++;}
  assert.ok(count<max,`blocked toward ${x},${z} at ${game.body.position.toArray().map(v=>v.toFixed(2))} contacts ${JSON.stringify(game.body.contacts)}`);
  total+=count;}
 game.human={forward:0,right:0,sprint:false};
 return total;
}
const legs:[string,number][]=[];
async function leg(name:string,fn:()=>number|Promise<number>){await group('leg '+name,async()=>{const steps=await fn();const s=steps*dt;legs.push([name,s]);console.log('     ',name,s.toFixed(1)+' s');});}
const stage=()=>host?.stage()??null;
const expectStage=(want:CampaignStage)=>assert.equal(stage(),want,`stage ${stage()} (want ${want})`);
const idle=(frames:number)=>{for(let i=0;i<frames;i++){game.step(dt);host?.update(dt);}};
const roomLights=()=>asset.root.getObjectByName('B4_room_lights')??null;
const b4=()=>host!.debug.b4 as unknown as {type(t:string):string;enter():string;state():{near:string|null}};

/* ---------------- Chapter 1 on foot: the authored opening routes ---------------- */
game.body.position.fromArray([...O.spawn]);game.body.velocity.set(0,0,0);game.body.grounded=true;
await leg('shuttle -> bus exit',()=>walk([[O.bus.doorX,O.bus.z-O.bus.width/2-.35],[O.busExit[0],O.busExit[2]]]));
await leg('bus exit -> Building 5 coordinator',()=>walk(O.routeB5));
await leg('Building 5 -> Building 6 MacBook',()=>walk(O.routeB6));
await leg('Building 6 -> Building 5',()=>walk([...O.routeB6].reverse()));
await leg('Building 5 -> Building 4 handoff',()=>{const n=walk(O.routeB4);assert.ok(game.body.position.distanceTo(new T.Vector3(...O.handoff))<2.2,'ends inside the handoff radius');return n;});

/* ---------------- The campaign takes over at the handoff (relay offline) ---------------- */
host=makeHost();host.start(device,'b4_enter');host.update(dt);
await leg('handoff -> B04 door (enter_b4)',()=>{const c=CAMPAIGN_CHAPTERS.b4();const n=walk(c.approach);expectStage('b4_keyboard');return n;});
await leg('B04 entry -> Keyboard Wall',()=>{const n=walk([[B4_STATIONS.keyboard.stand[0],B4_STATIONS.keyboard.stand[2]]]);
 assert.equal(b4().state().near,'keyboard','the Keyboard Wall is in reach');b4().type('I LOVE CDS');b4().enter();expectStage('b4_flip');return n;});
await leg('Keyboard Wall -> service wall lifts (automatic)',()=>{
 // b4_flip is a short automatic beat: no station, no input, bounded wait for b4_breaker.
 let n=0;while(stage()!=='b4_breaker'&&n<240){game.step(dt);host!.update(dt);n++;}
 assert.equal(stage(),'b4_breaker','the service wall lifts by itself in under 2 s');
 assert.equal(b4().state().near,null,'no station is in reach while the wall lifts');
 return n;});
await leg('service wall -> breaker (F)',()=>{const n=walk([[B4_STATIONS.breaker.stand[0],B4_STATIONS.breaker.stand[2]]]);
 assert.equal(host!.interact(),true,'F at the breaker is the campaign\'s');expectStage('b4_connect');return n;});
await leg('breaker -> supercomputer port (F)',()=>{const n=walk([[B4_STATIONS.port.stand[0],B4_STATIONS.port.stand[2]]]);
 assert.equal(host!.interact(),true,'F at the port is the campaign\'s');expectStage('to_lawn');return n;});

await group('B4 room stays lit after the MacBook connects while the player is still inside',()=>{
 idle(30);assert.ok(roomLights(),'B4_room_lights is still in the world at to_lawn with the player at the port');
});
const inside=()=>{const p=game.body.position,r=O.b4;return p.x>r.x0&&p.x<r.x1&&p.z>r.z0&&p.z<r.z1;};
let litOnWayOut=true;
await leg('supercomputer port -> outside the B04 door',()=>{
 const before=host!.update;let n=0;
 // Walk back to the entry and out; the lights must stay on every frame the player is inside.
 const watch=()=>{if(inside()&&!roomLights())litOnWayOut=false;};
 host!.update=(d:number)=>{before(d);watch();};
 try{n=walk([...(['breaker','keyboard'] as const).map(id=>[B4_STATIONS[id].stand[0],B4_STATIONS[id].stand[2]]),[58,18],[58,25]]);}finally{host!.update=before;}
 assert.ok(!inside(),'the player is outside B04');return n;});
await group('B4 room lights go out once the player has left B04',()=>{
 assert.ok(litOnWayOut,'the room was lit on every frame of the walk out');
 idle(4);assert.equal(roomLights(),null,'B4_room_lights is removed once the player is outside');
});

/* ---------------- F arbitration: one press, one owner, always feedback ---------------- */
await group('F: the campaign first, then Chapter 1, otherwise the notice',async()=>{
 const {routeInteract}=await import('../src/opening/interactRoute');
 let opening=0;const said:string[]=[];
 const route=(campaign:{interact():boolean}|null)=>routeInteract({campaign:()=>campaign,reopenHandoff:()=>false,
  opening:()=>{opening++;return{ok:false,message:'Move closer and face the interaction.'};},notify:m=>{said.push(m);}});
 assert.equal(route(host),'notice','on a walking leg nothing consumes F');
 assert.equal(opening,1,'the Chapter 1 interaction runs only when the campaign did not consume the press');
 assert.deepEqual(said,['Move closer and face the interaction.'],'the player is told there is nothing here');
 assert.equal(route({interact:()=>true}),'campaign');assert.equal(opening,1,'a consumed press never reaches Chapter 1');
 assert.equal(routeInteract({campaign:()=>null,reopenHandoff:()=>true,opening:()=>{opening++;return{ok:true,message:''};},notify:()=>{}}),'handoff','with no campaign at Building 4, F reopens the handoff');
 assert.equal(opening,1);
});

await leg('B04 exit -> lawn entry (reach_lawn)',()=>{const n=walk(CAMPAIGN_CHAPTERS.lawn().approach);expectStage('lawn');return n;});

/* ---------------- Q on the lawn ignores text fields ---------------- */
await group('Q while typing in a HUD text field does not interrupt the charge',()=>{
 class FakeElement{constructor(readonly editable:boolean){}closest(sel:string){return this.editable&&/input/.test(sel)?this:null;}}
 const hadHTMLElement='HTMLElement' in globalThis,prior=(globalThis as {HTMLElement?:unknown}).HTMLElement;
 Object.assign(globalThis,{HTMLElement:FakeElement});
 try{
  const lawn=host!.debug.lawn as unknown as {state():{phase:string}};
  // Step out of the shelter to the ring's edge (as the lawn check's watcher) and wait for the wind-up.
  const node=NODES[0];let frames=0;
  for(let tries=0;tries<4&&lawn.state().phase!=='chargeWarn';tries++){walk([[node.x,node.z+2.2]]);
   frames=0;while(lawn.state().phase!=='chargeWarn'&&frames<120*20&&Math.hypot(game.body.position.x-node.x,game.body.position.z-node.z-2.2)<1){game.step(dt);host!.update(dt);frames++;}}
  assert.equal(lawn.state().phase,'chargeWarn','the lion winds up a charge');
  const q=(target:unknown)=>{const e=Object.assign(new Event('keydown',{cancelable:true}),{code:'KeyQ'});Object.defineProperty(e,'target',{value:target});win.dispatchEvent(e);return e.defaultPrevented;};
  assert.equal(q(new FakeElement(true)),false,'Q typed into a text field is left to the field');
  assert.equal(lawn.state().phase,'chargeWarn','the charge is not interrupted by typing');
  assert.equal(q(new FakeElement(false)),true,'Q on the game interrupts');
 }finally{if(hadHTMLElement)Object.assign(globalThis,{HTMLElement:prior});else delete (globalThis as {HTMLElement?:unknown}).HTMLElement;}
});

await group('lawn guardian shut down',()=>{(host!.debug.lawn as unknown as {complete():string}).complete();expectStage('to_sports');});
await leg('lawn shelter -> sports hall east door (reach_sports)',()=>{const n=walk(CAMPAIGN_CHAPTERS.sports().approach);expectStage('sports');return n;});

/* ---------------- Reload past the lawn: the world keeps the shut-down rigged lion ---------------- */
await group('a reload past the lawn shows the shut-down rigged lion, not the static statue',()=>{
 host!.dispose();host=makeHost();host.update(dt);
 expectStage('sports');
 assert.ok(host.attached().includes('lawn'),`the lawn chapter is part of the restored world (attached: ${host.attached()})`);
 const lawn=host.debug.lawn as unknown as {rig():{meshes:T.Object3D[]}|null;state():{phase:string}};
 assert.ok(lawn.rig(),'the rigged L001 is built');assert.equal(lawn.state().phase,'complete','L001 is shut down');
 assert.ok(asset.root.getObjectByName(NOV13.lion.id),'L001 anchor is still on the campus');
});

console.log('\nWalk legs (simulated seconds on foot):');
for(const [name,s] of legs)console.log('  '+s.toFixed(1).padStart(6)+' s  '+name);
console.log('  '+legs.reduce((a,[,s])=>a+s,0).toFixed(1).padStart(6)+' s  total');
host?.dispose();world.dispose();
if(failures){console.log(`\n${failures} check(s) failed`);process.exit(1);}
console.log('\nPASS campaign walk');
process.exit(0);
