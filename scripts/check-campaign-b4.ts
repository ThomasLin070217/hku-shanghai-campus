import assert from 'node:assert/strict';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {OPENING as O} from '../src/opening/spatialLayout';
import {B4_PHRASE,createKeyboardState,pressKeyboard,createFlipState,flipTiles,flipSolved,pullBreaker,connectMacBook,b4StepOf,sweepTiles,autoFinishTiles} from '../src/campaign/b4Puzzle';
import {B4_LAYOUT,B4_OBSTACLES,B4_STATIONS,B4_DOOR_OBSTACLE,B4_FOCUS_FRAME,setB4FlipPanel,partBounds} from '../src/opening/b4Layout';
import {buildB4Shell,B4_RACK_LED} from '../src/opening/b4Shell';
import {createCampaignState,reduceCampaign,type CampaignState} from '../src/campaign/state';
import type {ChapterContext,Explorer} from '../src/campaign/types';
import {createB4Chapter} from '../src/campaign/b4Chapter';
import {buildSite} from '../src/model/buildSite';
import {disposeAsset} from '../src/model/buildCampus';
import {firstPersonVisible} from '../src/exploration/viewmodel';

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
 const near95=flipTiles(createFlipState(561),Array.from({length:533},(_,i)=>i),true);assert.deepEqual(autoFinishTiles(near95),Array.from({length:28},(_,i)=>533+i),'at 95% the last tiles turn over by themselves');
 assert.deepEqual(autoFinishTiles(flipTiles(createFlipState(561),Array.from({length:532},(_,i)=>i),true)),[],'below 95% nothing turns by itself');
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
let from='entry';for(const id of order){const s=B4_STATIONS[id];route(from+' -> '+id,[[s.stand[0],s.stand[2]]]);from=id;}
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
// Sweep: one full horizontal drag covers at least an eighth of the wall.
assert.ok(sweepTiles({rows:17,columns:33},{row:8,column:0},{row:8,column:32}).length>=Math.ceil(561/8),'one full sweep must cover >= 561/8 tiles');
w.dispose();

// ---- The opening world with no campaign (Chapter 1), then the chapter attached. ----
const site=buildSite(undefined,undefined,true),w2=createNavigation(BUILDINGS,SITE,true),g2=new CampusGame(w2,BUILDINGS,SITE);
site.root.updateMatrixWorld(true);
const hitPath=(o:T.Object3D|null)=>{const names:string[]=[];for(;o;o=o.parent)names.push(o.name);return names.join('<');};
const doorRay=()=>new T.Raycaster(new T.Vector3(O.b4.door,O.b4.floor+1.3,O.handoff[2]),new T.Vector3(0,0,-1),0,O.handoff[2]-O.b4.z0).intersectObject(site.root,true)[0];
{
 const hit=doorRay();assert.ok(hit,'something closes the B04 doorway in Chapter 1');
 assert.match(hitPath(hit.object),/B04_entrance_door/,`Chapter 1: the first thing in the B04 doorway is the closed door, got ${hitPath(hit.object)} at z=${hit.point.z}`);
 assert.ok(w2.blocked(O.b4.door,O.b4.z1+.9,O.b4.floor+.06),'Chapter 1: the closed B04 door is solid');
 assert.ok(site.root.getObjectByName('B04_room_shell'),'the B04 room shell is part of the opening build');
 const inside=new T.Raycaster(new T.Vector3(O.b4.door,O.b4.floor+1.3,O.b4.z1-.3),new T.Vector3(0,0,-1),0,O.b4.z1-O.b4.z0).intersectObject(site.root,true)[0];
 assert.ok(inside&&inside.point.z>=O.b4.z0-.01&&inside.point.z<=O.b4.z0+.2,`B04 is capped behind the door (back wall), got ${inside?hitPath(inside.object):'nothing'} at z=${inside?.point.z}`);
 let shellLights=0;buildB4Shell().traverse(o=>{if(o instanceof T.Light)shellLights++;});assert.equal(shellLights,0,'the B04 shell carries no lights: the room cannot glow by itself in the daytime');
 const roomLights:string[]=[];site.root.traverse(o=>{if(o instanceof T.Light){const p=o.getWorldPosition(new T.Vector3());if(p.x>O.b4.x0&&p.x<O.b4.x1&&p.z>O.b4.z0&&p.z<O.b4.z1)roomLights.push(o.name||o.type);}});
 assert.deepEqual(roomLights,[],'Chapter 1: no light inside the B04 rooms');
 console.log('PASS Chapter 1: closed, solid B04 door; capped room shell; no room lights');
}
let cs:CampaignState={...createCampaignState('mac-1'),stage:'b4_enter'};
const camera=new T.PerspectiveCamera(70,16/9,.05,500),arms=new T.Group(),socket=new T.Group(),notes:string[]=[];arms.add(socket);
// B4 publishes "hide the view model" (in B04, in focus); the explorer is the one writer of arms/socket visibility.
let viewHidden:boolean|null=null;
const explorer={game:g2,world:w2,camera,firstPerson:{socket,root:arms},enabled:true,setFirstPersonHidden(v:boolean){viewHidden=v;}} as unknown as Explorer;
{
 const rule=(o:Partial<Parameters<typeof firstPersonVisible>[0]>)=>firstPersonVisible({enabled:true,first:true,story:true,deviceOpen:false,hidden:false,...o});
 assert.equal(rule({}),false,'story mode: no arms or MacBook while walking (Ruling 36)');
 assert.equal(rule({deviceOpen:true}),true,'story mode: the MacBook shows while opened with C');
 assert.equal(rule({deviceOpen:true,hidden:true}),false,'story mode: B4 hides it in B04 and in focus');
 assert.equal(rule({story:false}),true,'survey and legacy pages keep the held item while walking');
 assert.equal(rule({story:false,hidden:true}),false);
 assert.equal(rule({first:false,story:false}),false,'third person shows no view model');
 assert.equal(rule({enabled:false,story:false}),false);
 console.log('PASS first-person view model rule: stowed in story mode, held in survey');
}
const ctx:ChapterContext={scene:new T.Scene(),root:()=>site.root,explorer,deviceId:()=>'mac-1',stage:()=>cs.stage,
 emit:e=>{const r=reduceCampaign(cs,e);cs=r.state;return r.changed;},notify:t=>{notes.push(t);},atmosphere:()=>undefined,
 openPanel:()=>{g2.openPanel('door');},closePanel:()=>{g2.closePanel();},resume:()=>{g2.paused=false;},card:async()=>{}};
const b4=createB4Chapter(),dbg=b4.debug as Record<string,(...a:unknown[])=>any>;
/** The focus camera looks square-on at the station and the whole panel is inside the view. */
function framed(id:'keyboard'|'flip'){
 camera.updateMatrixWorld();const forward=camera.getWorldDirection(new T.Vector3()),angle=forward.angleTo(new T.Vector3(0,0,-1))*180/Math.PI;
 assert.ok(angle<=10,`${id} focus camera is ${angle.toFixed(1)}° off the wall normal`);
 const f=B4_FOCUS_FRAME[id];
 for(const [x,y] of [[f.x0,f.y0],[f.x1,f.y0],[f.x0,f.y1],[f.x1,f.y1]]){const v=new T.Vector3(x,y,f.z1).project(camera);assert.ok(Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&v.z<1,`${id} corner ${x.toFixed(2)},${y.toFixed(2)} projects outside the view: ${v.toArray().map(n=>n.toFixed(2))}`);}
 console.log('PASS',id,'focus framing: square-on',angle.toFixed(1)+'°, all four corners in view');
}
const step=(n=6)=>{for(let i=0;i<n;i++)b4.update(.5);};
b4.attach(ctx);step();
{
 const hit=doorRay();assert.ok(!hit||!/B04_entrance_door/.test(hitPath(hit.object)),`campaign: the door leaves slide open, got ${hit&&hitPath(hit.object)}`);
 assert.ok(hit&&hit.point.z<O.b4.z1-1,'campaign: the doorway ray reaches into the room');
 assert.equal(w2.blocked(O.b4.door,O.b4.z1+.9,O.b4.floor+.06),false,'campaign: the B04 door no longer blocks');
 console.log('PASS campaign start opens the B04 door (visual + collision)');
}
cs={...cs,stage:'b4_keyboard'};step();
// Render vs nav: builder parts placed by the chapter equal the layout rects within 5 cm.
{
 const props=site.root.getObjectByName('B04_campaign_rooms');assert.ok(props,'chapter props are in the world');
 const near=(a:number,b:number,what:string)=>assert.ok(Math.abs(a-b)<=.05,`${what}: built ${a.toFixed(3)} vs layout ${b.toFixed(3)}`);
 const rect=(n:string)=>B4_OBSTACLES.find(r=>r.name===n)!;
 const kb=partBounds(props!,'Keyboard_timber_wall').union(partBounds(props!,'Keyboard_wall')),kr=rect('opening-b4-keyboard-wall');
 near(kb.min.x,kr.x0,'keyboard x0');near(kb.max.x,kr.x1,'keyboard x1');near(kb.max.z,kr.z1,'keyboard z1');near(kb.max.y,kr.top,'keyboard top');near(Math.max(kb.min.z,kr.z0),kr.z0,'keyboard z0 (clipped to the back wall)');
 const fw=partBounds(props!,'HKU_flip_wall'),fp=B4_LAYOUT.flipPanel;
 near(fw.min.x,fp.x0,'flip x0');near(fw.max.x,fp.x1,'flip x1');near(fw.min.z,fp.z0,'flip z0');near(fw.max.z,fp.z1,'flip z1');near(fw.max.y,fp.top,'flip top');
 const cl=partBounds(props!,'Aux_power_closet'),cr=B4_OBSTACLES.filter(r=>r.name.startsWith('opening-b4-closet'));
 near(cl.min.x,Math.min(...cr.map(r=>r.x0)),'closet x0');near(cl.max.x,Math.max(...cr.map(r=>r.x1)),'closet x1');near(cl.max.z,Math.max(...cr.map(r=>r.z1)),'closet z1');near(cl.max.y,Math.max(...cr.map(r=>r.top)),'closet top');
 const lever=partBounds(props!,'Aux_breaker_lever').getCenter(new T.Vector3()),bp=B4_STATIONS.breaker.point;
 near(lever.x,bp[0],'lever x');near(lever.y,bp[1],'lever y');near(lever.z,bp[2],'lever z');
 for(const [name,id] of [['Aux_breaker_panel','breaker'],['Aux_power_rail','port']] as const){const b=partBounds(props!,name),s=B4_STATIONS[id].box;
  near(b.min.x,s.x0,name+' x0');near(b.max.x,s.x1,name+' x1');near(b.min.y,s.y0,name+' y0');near(b.max.y,s.y1,name+' y1');near(b.max.z,s.z1,name+' z1');}
 const panel=partBounds(props!,'Keyboard_wall').getCenter(new T.Vector3()),kp=B4_STATIONS.keyboard.point;near(panel.x,kp[0],'keyboard point x');
 assert.throws(()=>partBounds(new T.Group(),'Keyboard_wall'),/missing/,'a missing builder part throws');
 assert.equal(dbg.state().tiles,561);
 console.log('PASS render vs nav: builder parts match the layout rects within 5 cm');
}
// Room lights stay inside the room, and only while the chapter runs.
const lights=()=>{const out:T.PointLight[]=[];site.root.traverse(o=>{if(o instanceof T.PointLight&&hitPath(o).includes('B04_campaign_rooms'))out.push(o);});return out;};
{
 const ls=lights();assert.ok(ls.length>=3,'room lights while the chapter runs');
 for(const l of ls){const p=l.getWorldPosition(new T.Vector3());assert.ok(l.distance>0&&p.z+l.distance<=O.b4.z1-.1,`light at ${p.toArray()} d=${l.distance} reaches past the entrance`);assert.ok(p.x-l.distance>=28.15&&p.x+l.distance<=87.85,'light stays inside B04');}
 console.log('PASS room lights bounded inside B04:',ls.length);
}
// Reach to the nearest point of the interactable; gold highlight; held item hidden in B4.
{
 g2.body.position.set(47.6,O.b4.floor,9.0);step(1);
 assert.equal(dbg.state().near,'keyboard','the west end of the Keyboard Wall is in reach');
 const outline=(id:string)=>site.root.getObjectByName('B4_highlight_'+id)!;
 assert.ok(outline('keyboard')?.visible,'the in-range Keyboard Wall is outlined');assert.equal(outline('flip').visible,false);
 assert.equal(viewHidden,true,'B4 asks the explorer to hide the view model inside B04');assert.equal(socket.visible,true,'B4 never writes the socket itself (one owner)');
 const text=b4.objective('b4_keyboard')!.text;assert.match(text,/Press F/);assert.doesNotMatch(text,/\bE\b/);
 g2.body.position.set(...O.handoff);step(1);assert.equal(viewHidden,false,'outside B04 B4 releases its hide flag');assert.equal(socket.visible,true);
 g2.body.position.set(...B4_STATIONS.keyboard.stand);step(1);
 dbg.focus('keyboard');assert.equal(viewHidden,true,'entering focus hides the view model at once');step(1);assert.equal(viewHidden,true,'focus view keeps the view model hidden');assert.equal(arms.visible,true,'B4 never writes the arms itself (one owner)');
 framed('keyboard');
 dbg.type('ILOVECDS');dbg.enter();step(1);assert.equal(cs.stage,'b4_flip');
 // Flipped tiles read clearly: the back faces glow.
 const tile=site.root.getObjectByName('FlipTile_r0c0')!,face=(tile.children[0] as T.Mesh).material as T.MeshStandardMaterial[];
 assert.ok(face[5].emissiveIntensity>0&&face[5].emissive.getHex()!==face[4].emissive.getHex(),'the flipped face is clearly different');
 // Three full-screen drags from the flip stand finish the wall.
 g2.body.position.set(...B4_STATIONS.flip.stand);step(1);dbg.focus('flip');step(1);framed('flip');assert.equal(viewHidden,true);assert.equal(arms.visible,true);
 const one=dbg.sweepNdc([[-.98,0],[.98,0]]);assert.ok(one>=Math.ceil(561/8),`one drag flips ${one} tiles; needs >= ${Math.ceil(561/8)}`);
 const two=dbg.sweepNdc([[-.98,.55],[.98,.55]]);
 console.log('PASS sweep: one drag',one,'tiles, two drags',two);
 // 95%: the last tiles turn over by themselves in a short sweep and the step completes.
 const left=dbg.flipAllBut(28);assert.equal(left,561,'at 95% the wall completes itself');
 const last=site.root.getObjectByName('FlipTile_r16c32')!;step(0);b4.update(.05);
 assert.ok(last.rotation.y<Math.PI/2,'the last tile has not turned instantly');
 for(let i=0;i<14;i++)b4.update(.05);assert.ok(last.rotation.y>Math.PI/2,`after 0.75 s the last tile has turned (${last.rotation.y.toFixed(2)})`);
 assert.equal(cs.stage,'b4_flip','the step waits for the last tiles to turn');
 await new Promise(r=>setTimeout(r,2100));assert.equal(cs.stage,'b4_breaker','the solved wall opens the closet');
 console.log('PASS auto-finish: 28 last tiles turn over by themselves within 0.75 s');
 g2.body.position.set(...B4_STATIONS.breaker.stand);step(1);
 assert.ok(outline('breaker').visible,'the breaker is outlined in range');
 const lever=site.root.getObjectByName('Aux_breaker_lever') as T.Mesh,lm=lever.material as T.MeshStandardMaterial;
 assert.equal(lm.emissive.getHex(),0xffb648,'the in-range lever glows gold');assert.ok(lm.emissiveIntensity>0);
 assert.equal(b4.interact(),true);step(1);assert.equal(cs.stage,'b4_connect');assert.equal(dbg.state().hum,true,'the hum plays from b4_connect on');
 g2.body.position.set(...B4_STATIONS.port.stand);step(1);assert.equal(b4.interact(),true);step(1);assert.equal(cs.stage,'to_lawn');
 // Ruling 26 (Task 6): the room stays lit while the player is still inside, and goes dark once they are out of B04.
 assert.ok(lights().length>0,'room lights stay on while the player is still at the port');
 g2.body.position.set(...O.handoff);step(1);
 assert.equal(lights().length,0,'room lights are removed once the player has left B04');
 // FU3: with no lights the restored room still reads as powered: the racks keep a green emissive.
 const rackGlow=(name:string)=>{let out=-1;site.root.traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name===name){const e=m.emissive;out=Math.max(out,m.emissiveIntensity*(e.r+e.g+e.b)/3);}});return out;};
 assert.ok(rackGlow(B4_RACK_LED)>.5,`rack LEDs glow at to_lawn with the player outside (${rackGlow(B4_RACK_LED).toFixed(3)})`);
 assert.ok(rackGlow('B4 rack body')>.02,`rack bodies keep a green emissive at to_lawn with the player outside (${rackGlow('B4 rack body').toFixed(3)})`);
 console.log('PASS focus, highlight, flip-face contrast, lights off after B4, F at every station');
}
// Reload at b4_connect keeps the supercomputer humming.
{
 viewHidden=true;b4.detach();assert.equal(viewHidden,false,'detach releases the hide flag');assert.ok(w2.blocked(O.b4.door,O.b4.z1+.9,O.b4.floor+.06),'detach closes the door again');
 assert.match(hitPath(doorRay()?.object??null),/B04_entrance_door/,'detach slides the leaves shut');
 cs={...cs,stage:'b4_connect'};const again=createB4Chapter();again.attach(ctx);again.update(.1);
 assert.equal((again.debug as Record<string,()=>{hum:boolean}>).state().hum,true,'after a reload at b4_connect the hum resumes');again.detach();
 console.log('PASS detach restores the door; hum resumes after reload');
}
disposeAsset(site.root);w2.dispose();
console.log('PASS campaign b4 checks');
