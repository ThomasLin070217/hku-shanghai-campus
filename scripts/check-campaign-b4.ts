import assert from 'node:assert/strict';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {OPENING as O} from '../src/opening/spatialLayout';
import {B4_PHRASE,createKeyboardState,pressKeyboard,createFlipState,flipTiles,flipSolved,pullBreaker,connectMacBook,b4StepOf} from '../src/campaign/b4Puzzle';
import {B4_LAYOUT,B4_OBSTACLES,B4_STATIONS,B4_DOOR_OBSTACLE,setB4FlipPanel} from '../src/campaign/b4Layout';
import {createB4Chapter} from '../src/campaign/b4Chapter';
import {buildSite} from '../src/model/buildSite';
import {disposeAsset} from '../src/model/buildCampus';

// (a) Pure puzzle rules.
{
 let s=createKeyboardState();
 for(const ch of 'I LOVE CDS'){const r=pressKeyboard(s,ch);s=r.state;assert.notEqual(r.result,'reset',`"${ch}" is part of the phrase`);}
 assert.equal(s.typed,B4_PHRASE);assert.equal(s.solved,false,'the phrase alone does not boot CPU 01; Enter does');
 const done=pressKeyboard(s,'Enter');assert.equal(done.result,'solved');assert.equal(done.state.solved,true);
 // A wrong cap resets the sequence.
 let w=createKeyboardState();for(const ch of 'ILO')w=pressKeyboard(w,ch).state;
 const wrong=pressKeyboard(w,'X');assert.equal(wrong.result,'reset');assert.equal(wrong.state.typed,'');
 // Enter before the phrase is complete is rejected and resets.
 let early=createKeyboardState();for(const ch of 'ILOVE')early=pressKeyboard(early,ch).state;
 const e=pressKeyboard(early,'Enter');assert.equal(e.result,'reset');assert.equal(e.state.solved,false);assert.equal(e.state.typed,'');
 // An extra letter after the full phrase is a wrong cap too.
 let extra=createKeyboardState();for(const ch of B4_PHRASE)extra=pressKeyboard(extra,ch).state;
 assert.equal(pressKeyboard(extra,'S').result,'reset');
 // Other words never solve it.
 let other=createKeyboardState();for(const ch of 'ILOVEHKU')other=pressKeyboard(other,ch).state;assert.equal(pressKeyboard(other,'Enter').state.solved,false);
 // Lower case is the same cap.
 let lower=createKeyboardState();for(const ch of 'ilovecds')lower=pressKeyboard(lower,ch).state;assert.equal(pressKeyboard(lower,'Enter').state.solved,true);
}
{
 let f=createFlipState(561);
 f=flipTiles(f,Array.from({length:560},(_,i)=>i),true);assert.equal(flipSolved(f),false,'560 of 561 is not enough');
 f=flipTiles(f,[560],true);assert.equal(flipSolved(f),true);
 f=flipTiles(f,[3]);assert.equal(flipSolved(f),false,'a toggle turns a tile back');
}
{
 assert.equal(b4StepOf('b4_keyboard'),'keyboard');assert.equal(b4StepOf('b4_flip'),'flip');assert.equal(b4StepOf('b4_breaker'),'breaker');assert.equal(b4StepOf('b4_connect'),'connect');
 assert.equal(pullBreaker('flip').ok,false,'the breaker is behind the flip wall');assert.equal(pullBreaker('breaker').event,'breaker_pulled');
 const written:string[]=[];const write=(id:string)=>{written.push(id);};
 assert.equal(connectMacBook('breaker','mac-1',write).ok,false,'breaker before connect');assert.deepEqual(written,[]);
 assert.equal(connectMacBook('connect','',write).ok,false,'no MacBook, no pairing');assert.deepEqual(written,[]);
 const c=connectMacBook('connect','mac-1',write);assert.equal(c.event,'macbook_connected');assert.deepEqual(written,['mac-1'],'the relay writer gets the device id');
}
console.log('PASS b4 puzzle rules');

// (d) Nav boxes come from b4Layout.
const w=createNavigation(BUILDINGS,SITE,true);
assert.ok(O.b4,'OPENING.b4 room parameters exist');
for(const r of B4_OBSTACLES){
 const o=w.obstacles.find(o=>o.name===r.name);assert.ok(o,`nav has ${r.name}`);
 assert.deepEqual([o.x-o.w/2,o.x+o.w/2,o.z-o.d/2,o.z+o.d/2,o.bottom,o.top].map(v=>+v.toFixed(4)),[r.x0,r.x1,r.z0,r.z1,r.bottom,r.top].map(v=>+v.toFixed(4)),`${r.name} nav box equals the layout rect`);
}
assert.equal(w.obstacles.filter(o=>o.name.startsWith('opening-b4-')).length,B4_OBSTACLES.length,'every opening-b4 nav box is a layout rect');
assert.ok(!w.obstacles.some(o=>o.name==='B04/wing'&&o.z-o.d/2<O.b4.z1&&o.z+o.d/2>O.b4.z0),'the B04 wing over the rooms is split open');
assert.ok(w.obstacles.some(o=>o.name===B4_DOOR_OBSTACLE),'the entrance doors stay a real obstacle until the chapter opens them');
console.log('PASS b4 nav = layout',B4_OBSTACLES.length,'boxes');

// (b) Walk from the Chapter 1 handoff through the B04 door to every station.
const g=new CampusGame(w,BUILDINGS,SITE);
w.setDoorOpen(B4_DOOR_OBSTACLE,true);
setB4FlipPanel(w,true);
function route(name:string,points:readonly (readonly number[])[]){g.paused=false;g.body.grounded=true;let total=0;
 for(const [x,z]of points){let count=0;while(Math.hypot(x-g.body.position.x,z-g.body.position.z)>.08&&count<14000){g.yaw=Math.atan2(-(x-g.body.position.x),-(z-g.body.position.z));g.human={forward:1,right:0,sprint:false};g.step(1/120);count++;}assert.ok(count<14000,`${name} blocked toward ${x},${z}, at ${g.body.position.toArray()}, contacts ${JSON.stringify(g.body.contacts)}`);total+=count;}
 g.human={forward:0,right:0,sprint:false};console.log('PASS walk',name,(total/120).toFixed(1)+'s',g.body.position.toArray().map(v=>+v.toFixed(2)).join(','));}
g.body.position.fromArray([...O.handoff]);g.body.velocity.set(0,0,0);
const chapter=createB4Chapter();
route('handoff -> B04 entry',[[O.handoff[0],O.handoff[2]],[chapter.entry.point[0],chapter.entry.point[2]]]);
assert.ok(Math.abs(g.body.position.y-O.b4.floor)<.05,`entry stands on the B04 floor, y=${g.body.position.y}`);
const order=['keyboard','flip','breaker','port'] as const;
for(const id of order){const s=B4_STATIONS[id];route('entry -> '+id,[...s.path,[s.stand[0],s.stand[2]]]);}
// The closed flip panel is solid; with it gone the closet mouth is open.
assert.ok(w.blocked(B4_STATIONS.flip.point[0],B4_LAYOUT.flipPanel.z0+.05,O.b4.floor+.003),'closed flip panel blocks');
setB4FlipPanel(w,false);assert.ok(!w.obstacles.some(o=>o.name==='opening-b4-flip-panel'),'opened flip panel leaves no obstacle');

// (c) Each stand point is within reach and has a clear sightline at eye height.
for(const id of order){const s=B4_STATIONS[id];const eye=new T.Vector3(s.stand[0],O.b4.floor+1.6,s.stand[2]),to=new T.Vector3(...s.point).sub(eye);
 assert.ok(to.length()<=2.2,`${id} stand is ${to.length().toFixed(2)} m from its interactable`);
 const hits=new T.Raycaster(eye,to.clone().normalize(),.03,to.length()-.15).intersectObjects(w.meshes,false);
 assert.equal(hits.length,0,`${id} sightline blocked by ${hits[0]?.object.name}`);
 console.log('PASS station',id,to.length().toFixed(2)+'m clear');
}
// The B04 doorway is open for collision once the chapter unlocks it.
assert.equal(w.blocked(O.b4.door,O.b4.z1-.3,O.b4.floor+.003),false,'B04 door passage is open');
// The model cut matches the collision opening: a ray through the B04 doorway at chest height
// meets no hidden core, glass or revolving door until the room's back wall.
{
 const site=buildSite(undefined,undefined,true),b04=site.byId.get('B04')!;b04.updateWorldMatrix(true,true);
 const ray=new T.Raycaster(new T.Vector3(O.b4.door,O.b4.floor+1.3,O.b4.z1+1.1),new T.Vector3(0,0,-1),0,O.b4.z1+1.1-O.b4.z0-.5);
 const hits=ray.intersectObject(b04,true);assert.equal(hits.length,0,`B04 doorway has hidden backing: ${hits[0]?.object.name} at z=${hits[0]?.point.z}`);
 disposeAsset(site.root);console.log('PASS B04 doorway ray is clear in the opening model');
}
w.dispose();console.log('PASS campaign b4 checks');
