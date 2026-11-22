import assert from 'node:assert/strict';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {OPENING as O} from '../src/opening/spatialLayout';
import {B4_PHRASE,createKeyboardState,pressKeyboard,createFlipState,flipTiles,flipSolved,pullBreaker,connectMacBook,b4StepOf,sweepTiles,autoFinishTiles} from '../src/campaign/b4Puzzle';
import {B4_LAYOUT,B4_LOBBY,B4_OBSTACLES,B4_STATIONS,B4_DOOR_OBSTACLE,B4_FOCUS_FRAME,setB4FlipPanel,partBounds} from '../src/opening/b4Layout';
import {buildB4Shell,B4_RACK_LED} from '../src/opening/b4Shell';
import {buildObservedFeatureRoom,flipWallTiles} from '../src/model/observedFeatureRooms';
import {createB5FlipWall} from '../src/opening/b5FlipWall';
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
 assert.equal(pullBreaker('flip').ok,false,'the breaker is behind the closed service wall');assert.equal(pullBreaker('breaker').event,'breaker_pulled');
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
const order=['keyboard','breaker','port'] as const;
// The keyboard stand is on the floor, in front of the lowest tier (no climb, no 0.1 m shift
// needed). Assert it right after the entry→keyboard leg: at the end of the full loop the body
// stands at the port, so the old placement silently tested the port stand instead.
{
 const s=B4_STATIONS.keyboard;route('entry -> keyboard',[[s.stand[0],s.stand[2]]]);
 assert.ok(Math.abs(g.body.position.y-O.b4.floor)<.05,`the keyboard stand is on the B04 floor, y=${g.body.position.y}`);
}
let from='keyboard';
for(const id of ['breaker','port'] as const){const s=B4_STATIONS[id];route(from+' -> '+id,[[s.stand[0],s.stand[2]]]);from=id;}
// The closed service shutter is solid; with it gone the closet mouth is open. Sample 0.10 m off
// the shutter's room-side face at x 60: within the 0.28 m body radius of the shutter, but well
// outside the radius of the closet rect (its mouth ends at z 7.93). The old samples at z 8.09/
// 8.19 sat inside that radius and passed even with no shutter at all.
const SH=B4_LAYOUT.shutter,probeZ=SH.z1+.10,probeY=O.b4.floor+.003;
assert.ok(w.obstacles.some(o=>o.name===SH.name),'the closed service shutter exists as a collision obstacle');
assert.ok(w.blocked(60,probeZ,probeY),'the closed service shutter blocks a body 0.10 m off its room-side face');
setB4FlipPanel(w,false);assert.ok(!w.obstacles.some(o=>o.name===SH.name),'the lifted service shutter leaves no obstacle');
assert.equal(w.blocked(60,probeZ,probeY),false,'with the shutter lifted the closet mouth is open');

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
function framed(id:'keyboard'){
 camera.updateMatrixWorld();
 const f=B4_FOCUS_FRAME[id],acrossX=f.facing[0]!==0;
 // `facing` points from the wall into the room, so the camera looks along its negation.
 const normal=acrossX?new T.Vector3(-f.facing[0],0,0):new T.Vector3(0,0,-f.facing[1]);
 const forward=camera.getWorldDirection(new T.Vector3()),angle=forward.angleTo(normal)*180/Math.PI;
 assert.ok(angle<=10,`${id} focus camera is ${angle.toFixed(1)}° off the wall normal`);
 // The panel is a vertical rectangle; project its four corners on the panel surface.
 const surface=acrossX?(f.facing[0]<0?f.box.x0:f.box.x1):(f.facing[1]<0?f.box.z0:f.box.z1);
 const corners=acrossX?[[surface,f.box.y0,f.box.z0],[surface,f.box.y0,f.box.z1],[surface,f.box.y1,f.box.z0],[surface,f.box.y1,f.box.z1]]
  :[[f.box.x0,f.box.y0,surface],[f.box.x1,f.box.y0,surface],[f.box.x0,f.box.y1,surface],[f.box.x1,f.box.y1,surface]];
 for(const [x,y,z] of corners){const v=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&v.z<1,`${id} corner ${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)} projects outside the view: ${v.toArray().map(n=>n.toFixed(2))}`);}
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
// D5: the chapter's own build must skip the 561 flip tiles. The builder test further down
// passes even if the chapter asks for the full room and throws the tiles away, so read the
// chapter's own count after it attaches (0 = it built the closet part only).
assert.equal(dbg.flipTilesBuilt(),0,'the chapter builds no flip tiles (a full build would allocate 561)');
cs={...cs,stage:'b4_keyboard'};step();
// Render vs nav: builder parts placed by the chapter equal the layout rects within 5 cm.
{
 const props=site.root.getObjectByName('B04_campaign_rooms');assert.ok(props,'chapter props are in the world');
 const near=(a:number,b:number,what:string)=>assert.ok(Math.abs(a-b)<=.05,`${what}: built ${a.toFixed(3)} vs layout ${b.toFixed(3)}`);
 // The Keyboard Wall is built from the observed panel, turned to face west: compare in world space.
 // The union (timber backing + panel) matches `keyboardBox`; the panel alone is what the player sees.
 const kb=partBounds(props!,'Keyboard_timber_wall').union(partBounds(props!,'Keyboard_wall')),kbox=B4_LAYOUT.keyboardBox,kp=B4_LAYOUT.keyboardPanel;
 near(kb.min.x,kbox.x0,'keyboard x0');near(kb.max.y,kbox.y1,'keyboard top');near(kb.min.z,kbox.z0,'keyboard z0');near(kb.max.z,kbox.z1,'keyboard z1');
 const panel=partBounds(props!,'Keyboard_wall');
 near(panel.min.x,kp.x0,'panel x0');near(panel.max.y,kp.y1,'panel top');near(panel.min.z,kp.z0,'panel z0');near(panel.max.z,kp.z1,'panel z1');
 // The panel's back runs into the east wall (hidden); its front face is what the player sees.
 assert.ok(kb.max.x>=B4_LAYOUT.room.x1-.01-B4_LAYOUT.wall,`keyboard backing reaches into the east wall: built ${kb.max.x.toFixed(3)}`);
 // The service shutter: the chapter's own slab covers the closet mouth.
 const sh=partBounds(props!,'opening-b4-service-shutter'),S=B4_LAYOUT.shutter;
 near(sh.min.x,S.x0,'shutter x0');near(sh.max.x,S.x1,'shutter x1');near(sh.min.z,S.z0,'shutter z0');near(sh.max.z,S.z1,'shutter z1');near(sh.max.y,S.top,'shutter top');
 // The HKU flip wall is not in B4 any more.
 assert.equal(site.root.getObjectByName('HKU_flip_wall'),undefined,'the HKU flip wall no longer stands in B4');
 // The tiers: three timber steps from the layout rects, drawn by the shell. Each tier is a
 // riser plus a tread; the tread overlaps the riser by 2 mm and tops out 2 mm proud of the
 // collision top, so the two materials never share a plane (coplanar faces flicker).
 for(const t of B4_LAYOUT.tiers){const riser=partBounds(site.root,t.name),tread=partBounds(site.root,t.name+'_tread'),b=riser.clone().union(tread),r=B4_OBSTACLES.find(o=>o.name===t.name)!;
  near(b.min.x,r.x0,t.name+' x0');near(b.max.x,r.x1,t.name+' x1');near(b.min.z,r.z0,t.name+' z0');near(b.max.z,r.z1,t.name+' z1');near(b.max.y,r.top,t.name+' top');
  const proud=tread.max.y-r.top;
  assert.ok(proud>=.001&&proud<=.005,`${t.name}: the tread top is 1–5 mm proud of the collision top (${(proud*1000).toFixed(1)} mm)`);
  assert.ok(tread.max.y-riser.max.y>=.04,`${t.name}: the tread stacks clear of the riser (${(tread.max.y-riser.max.y).toFixed(3)} m)`);}
 const cl=partBounds(props!,'Aux_power_closet'),cr=B4_OBSTACLES.filter(r=>r.name.startsWith('opening-b4-closet'));
 near(cl.min.x,Math.min(...cr.map(r=>r.x0)),'closet x0');near(cl.max.x,Math.max(...cr.map(r=>r.x1)),'closet x1');near(cl.max.z,Math.max(...cr.map(r=>r.z1)),'closet z1');near(cl.max.y,Math.max(...cr.map(r=>r.top)),'closet top');
 const lever=partBounds(props!,'Aux_breaker_lever').getCenter(new T.Vector3()),bp=B4_STATIONS.breaker.point;
 near(lever.x,bp[0],'lever x');near(lever.y,bp[1],'lever y');near(lever.z,bp[2],'lever z');
 for(const [name,id] of [['Aux_breaker_panel','breaker'],['Aux_power_rail','port']] as const){const b=partBounds(props!,name),s=B4_STATIONS[id].box;
  near(b.min.x,s.x0,name+' x0');near(b.max.x,s.x1,name+' x1');near(b.min.y,s.y0,name+' y0');near(b.max.y,s.y1,name+' y1');near(b.max.z,s.z1,name+' z1');}
 const panelCentre=partBounds(props!,'Keyboard_wall').getCenter(new T.Vector3()),kpt=B4_STATIONS.keyboard.point;near(panelCentre.z,kpt[2],'keyboard point z');
 assert.throws(()=>partBounds(new T.Group(),'Keyboard_wall'),/missing/,'a missing builder part throws');
 console.log('PASS render vs nav: builder parts match the layout rects within 5 cm');
}
// The lobby scenery reads as specified, not just as boxes: the cream border is a ring over the
// teal rug, the rack LEDs face the room, and the armchair backs sit on their seats.
{
 const ringMesh=site.root.getObjectByName('B4_lobby_rug_border') as T.Mesh|undefined;
 assert.ok(ringMesh,'the lobby rug border is in the shell');
 const ringGeom=ringMesh!.geometry as unknown as {type:string;parameters:{innerRadius:number;outerRadius:number}};
 assert.equal(ringGeom.type,'RingGeometry','the rug border is a ring, not a solid disc on top of the rug');
 assert.ok(Math.abs(ringGeom.parameters.innerRadius-(B4_LOBBY.rug.r-.22))<.001&&Math.abs(ringGeom.parameters.outerRadius-B4_LOBBY.rug.r)<.001,
  `the rug border spans r-0.22…r (${ringGeom.parameters.innerRadius}…${ringGeom.parameters.outerRadius})`);
 const rackRect=B4_OBSTACLES.find(o=>o.render==='rack')!;
 const strip=partBounds(site.root,'B4_rack_status_strip');
 assert.ok(Math.abs(strip.min.z-(rackRect.z1+.001))<.0015&&strip.max.z<=rackRect.z1+.022,
  `rack status strips sit on the room-facing south face (z ${strip.min.z.toFixed(3)}…${strip.max.z.toFixed(3)}, rack face ${rackRect.z1})`);
 assert.ok(Math.abs((strip.min.x+strip.max.x)/2-(rackRect.x0+rackRect.x1)/2)<.01,'rack status strips are centred across their cabinet');
 // The plinth is inset 1 cm on the faces the room can see (its south face and its two outer x
 // faces). A shared plane with a rack body flickers: the 12 cm band at the base of the racks.
 // The plinth's north face stays against the north wall with the racks' back faces, inside it.
 const plinth=partBounds(site.root,'B4_rack_plinth');
 for(const rack of B4_OBSTACLES.filter(o=>o.render==='rack')){
  const body=partBounds(site.root,rack.name);
  for(const [p,f,face] of [[plinth.max.z,body.max.z,'south'],[plinth.min.x,body.min.x,'west'],[plinth.max.x,body.max.x,'east']] as const)
   assert.ok(Math.abs(p-f)>=.005,`the plinth ${face} face ${p.toFixed(3)} is coplanar with ${rack.name} (${f.toFixed(3)})`);
 }
 const seat=partBounds(site.root,'B4_lobby_armchair_seat'),back=partBounds(site.root,'B4_lobby_armchair_back');
 assert.ok(back.min.y<=seat.max.y+.001,`the armchair back is seated, not floating (back bottom ${back.min.y.toFixed(3)}, seat top ${seat.max.y.toFixed(3)})`);
 assert.ok(back.min.y>=seat.max.y-.03,`the armchair back is not buried in the seat (back bottom ${back.min.y.toFixed(3)}, seat top ${seat.max.y.toFixed(3)})`);
 // The AABB minimum is the buried rear-bottom corner and cannot see the wedge gap at the front.
 // Read the back's front-bottom edge from its own world matrix: the compacted scene merges the
 // seat and back into one mesh and loses the tilt, so build a fresh, uncompacted shell.
 const shell=buildB4Shell();shell.updateMatrixWorld(true);
 const armchairs:T.Group[]=[];shell.traverse(o=>{if(o instanceof T.Group&&/^B4_lobby_armchair_\d$/.test(o.name))armchairs.push(o);});
 assert.equal(armchairs.length,2,'the shell draws both armchairs');
 for(const arm of armchairs){
  const backMesh=arm.getObjectByName('B4_lobby_armchair_back') as T.Mesh,seatMesh=arm.getObjectByName('B4_lobby_armchair_seat') as T.Mesh;
  const size=(backMesh.geometry as T.BoxGeometry).parameters;
  const front=Math.max(...[-1,1].map(sx=>new T.Vector3(sx*size.width/2,-size.height/2,size.depth/2).applyMatrix4(backMesh.matrixWorld).y));
  const seatTop=new T.Box3().setFromObject(seatMesh).max.y;
  assert.ok(front<=seatTop+.002,`${arm.name}: the back's front-bottom edge floats ${((front-seatTop)*1000).toFixed(1)} mm above the seat (front ${front.toFixed(4)}, seat top ${seatTop.toFixed(4)})`);
 }
 disposeAsset(shell);
 console.log('PASS lobby scenery: rug ring, room-facing rack LEDs, seated armchair backs, inset plinth');
}
// D5: B4 asks the observed-room builder for the closet part only, so the 561 flip tiles and the
// corridor shell are never allocated; the same builder still yields the wall B5 mounts.
{
 const closetOnly=buildObservedFeatureRoom('flipWall',{parts:['closet']});
 assert.ok(closetOnly.getObjectByName('Aux_power_closet'),'the closet-only build has the aux power closet');
 assert.equal(closetOnly.getObjectByName('HKU_flip_wall'),undefined,'the closet-only build has no flip wall');
 assert.equal(closetOnly.getObjectByName('Corridor_structure'),undefined,'the closet-only build has no corridor shell');
 assert.equal(flipWallTiles(closetOnly).length,0,'the closet-only build allocates no flip tiles');
 const fullRoom=buildObservedFeatureRoom('flipWall');
 assert.ok(fullRoom.getObjectByName('HKU_flip_wall'),'the full build still has the HKU flip wall for B5');
 assert.equal(flipWallTiles(fullRoom).length,561,'the full build still has all 561 flip tiles');
 disposeAsset(closetOnly);disposeAsset(fullRoom);
 console.log('PASS flip-wall parts selector: closet only for B4, the full wall still available for B5');
}
// The moved B5 wall: the plaque ink stands proud of the lobby-facing face so it can be read.
{
 const b5=createB5FlipWall();b5.root.updateMatrixWorld(true);
 const plaque=b5.root.getObjectByName('B5_flip_wall_plaque') as T.Mesh;
 assert.ok(plaque,'the B5 plaque is built');
 const ink=plaque.children.filter((c):c is T.Mesh=>c instanceof T.Mesh&&c.name==='B5_flip_wall_plaque_line');
 assert.equal(ink.length,3,'the plaque carries three ink lines');
 const east=plaque.position.x+.01;
 for(const line of ink){
  const b=new T.Box3().setFromObject(line);
  assert.ok(b.min.x>=east+.0005&&b.max.x<=east+.0055,`plaque ink is 0.5–5.5 mm proud of the plaque's east face (${((b.min.x-east)*1000).toFixed(1)}…${((b.max.x-east)*1000).toFixed(1)} mm)`);
 }
 assert.equal(b5.debug.state().total,561,'the B5 wall carries its 561 tiles');
 b5.dispose();
 console.log('PASS B5 flip wall: plaque ink proud of the east face, 561 tiles mounted');
}
// Room lights stay inside the room, and only while the chapter runs.
const lights=()=>{const out:T.PointLight[]=[];site.root.traverse(o=>{if(o instanceof T.PointLight&&hitPath(o).includes('B04_campaign_rooms'))out.push(o);});return out;};
/** Ruling 39: after the MacBook connects, B4 keeps 1–2 dim lights whose range stays inside the room, plus emissive ceiling and racks. */
function poweredState(when:string){
 const group=site.root.getObjectByName('B4_powered_lights');assert.ok(group,`${when}: the powered B4 state is present`);
 const ls:T.PointLight[]=[];group!.traverse(o=>{if(o instanceof T.PointLight)ls.push(o);});
 assert.ok(ls.length>=1&&ls.length<=2,`${when}: one or two powered lights (${ls.length})`);
 for(const l of ls){const p=l.getWorldPosition(new T.Vector3());
  assert.ok(l.distance>0&&l.intensity>0&&l.intensity<=24,`${when}: a low, bounded light (I ${l.intensity}, d ${l.distance})`);
  assert.ok(p.x-l.distance>=O.b4.x0&&p.x+l.distance<=O.b4.x1&&p.z-l.distance>=O.b4.z0&&p.z+l.distance<=O.b4.z1-.1,`${when}: light at ${p.toArray().map(n=>n.toFixed(1))} d ${l.distance} reaches outside the B04 room`);}
 const glow=(name:string)=>{let out=-1;site.root.traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name===name){const e=m.emissive;out=Math.max(out,m.emissiveIntensity*(e.r+e.g+e.b)/3);}});return out;};
 assert.ok(glow('B4 room ceiling')>.03,`${when}: the ceiling panels glow (${glow('B4 room ceiling').toFixed(3)})`);
 assert.ok(glow('B4 rack body')>.1,`${when}: the rack panels glow (${glow('B4 rack body').toFixed(3)})`);
}
{
 const ls=lights();assert.ok(ls.length>=3,'room lights while the chapter runs');
 for(const l of ls){const p=l.getWorldPosition(new T.Vector3());assert.ok(l.distance>0&&p.z+l.distance<=O.b4.z1-.1,`light at ${p.toArray()} d=${l.distance} reaches past the entrance`);assert.ok(p.x-l.distance>=28.15&&p.x+l.distance<=87.85,'light stays inside B04');}
 console.log('PASS room lights bounded inside B04:',ls.length);
}
// Reach to the nearest point of the interactable; gold highlight; held item hidden in B4.
{
 g2.body.position.set(...B4_STATIONS.keyboard.stand);step(1);
 assert.equal(dbg.state().near,'keyboard','the Keyboard Wall is in reach from its stand');
 const outline=(id:string)=>site.root.getObjectByName('B4_highlight_'+id)!;
 assert.ok(outline('keyboard')?.visible,'the in-range Keyboard Wall is outlined');assert.equal(outline('breaker').visible,false);
 assert.equal(viewHidden,true,'B4 asks the explorer to hide the view model inside B04');assert.equal(socket.visible,true,'B4 never writes the socket itself (one owner)');
 const text=b4.objective('b4_keyboard')!.text;assert.match(text,/Press F/);assert.doesNotMatch(text,/\bE\b/);
 g2.body.position.set(...O.handoff);step(1);assert.equal(viewHidden,false,'outside B04 B4 releases its hide flag');assert.equal(socket.visible,true);
 g2.body.position.set(...B4_STATIONS.keyboard.stand);step(1);
 dbg.focus('keyboard');assert.equal(viewHidden,true,'entering focus hides the view model at once');step(1);assert.equal(viewHidden,true,'focus view keeps the view model hidden');assert.equal(arms.visible,true,'B4 never writes the arms itself (one owner)');
 framed('keyboard');
 dbg.type('ILOVECDS');dbg.enter();step(1);assert.equal(cs.stage,'b4_flip');
 // Spelling the phrase lights every cap: the solved wall reads clearly at a glance.
 assert.ok((dbg.caps() as {intensity:number}[]).every(c=>c.intensity>0),'every cap glows once CPU 01 is online');
 // b4_flip is the automatic beat: the service wall lifts by itself and no station is in reach.
 assert.equal(dbg.state().near,null,'no station is in reach while the service wall lifts');
 assert.match(b4.objective('b4_flip')!.text,/Wait for the service wall to open/);
 g2.body.position.set(...B4_STATIONS.breaker.stand);step(1);
 assert.equal(b4.interact(),true,'F while the wall lifts only says so');assert.match(notes[notes.length-1]??'',/service wall is lifting/);
 assert.equal(cs.stage,'b4_flip','the beat cannot be skipped by pressing F');
 assert.ok(w2.obstacles.some(o=>o.name===SH.name),'the service shutter is solid during the beat');
 assert.ok(dbg.state().shutter>0,'the service wall is visibly lifting');
 for(let i=0;i<3;i++)b4.update(.5);
 assert.equal(cs.stage,'b4_breaker','the beat ends by itself in about 1.2 s');
 assert.ok(!w2.obstacles.some(o=>o.name===SH.name),'the lifted service shutter leaves no obstacle');
 // A restored run at b4_breaker never re-arms the beat (check-campaign-reload reloads at b4_breaker, so this matters).
 {
  const restored=createB4Chapter(),keep=cs;cs={...cs,stage:'b4_breaker'};restored.attach(ctx);
  for(let i=0;i<6;i++)restored.update(.5);
  assert.equal(cs.stage,'b4_breaker','a restored run at b4_breaker does not emit flip_solved again');
  restored.detach();cs=keep;
 }
 step(1);
 assert.ok(outline('breaker').visible,'the breaker is outlined in range');
 const lever=site.root.getObjectByName('Aux_breaker_lever') as T.Mesh,lm=lever.material as T.MeshStandardMaterial;
 assert.equal(lm.emissive.getHex(),0xffb648,'the in-range lever glows gold');assert.ok(lm.emissiveIntensity>0);
 assert.equal(b4.interact(),true);step(1);assert.equal(cs.stage,'b4_connect');assert.equal(dbg.state().hum,true,'the hum plays from b4_connect on');
 g2.body.position.set(...B4_STATIONS.port.stand);step(1);assert.equal(b4.interact(),true);step(1);assert.equal(cs.stage,'to_lawn');
 // Ruling 26 (Task 6): the room stays fully lit while the player is still inside.
 assert.ok(lights().length>0,'room lights stay on while the player is still at the port');
 g2.body.position.set(...O.handoff);step(1);
 // Ruling 39 (FU6): once out, the chapter lights give way to a dim, contained powered state.
 assert.equal(site.root.getObjectByName('B4_room_lights'),undefined,'the chapter lights are removed once the player has left B04');
 poweredState('to_lawn, player outside');
 // FU3: with no lights the restored room still reads as powered: the racks keep a green emissive.
 const rackGlow=(name:string)=>{let out=-1;site.root.traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name===name){const e=m.emissive;out=Math.max(out,m.emissiveIntensity*(e.r+e.g+e.b)/3);}});return out;};
 assert.ok(rackGlow(B4_RACK_LED)>.5,`rack LEDs glow at to_lawn with the player outside (${rackGlow(B4_RACK_LED).toFixed(3)})`);
 assert.ok(rackGlow('B4 rack body')>.02,`rack bodies keep a green emissive at to_lawn with the player outside (${rackGlow('B4 rack body').toFixed(3)})`);
 console.log('PASS focus, highlight, automatic service-wall beat, lights off after B4, F at every station');
}
// Reload at b4_connect keeps the supercomputer humming.
{
 viewHidden=true;b4.detach();assert.equal(viewHidden,false,'detach releases the hide flag');assert.ok(w2.blocked(O.b4.door,O.b4.z1+.9,O.b4.floor+.06),'detach closes the door again');
 assert.match(hitPath(doorRay()?.object??null),/B04_entrance_door/,'detach slides the leaves shut');
 assert.equal(site.root.getObjectByName('B4_powered_lights'),undefined,'detach removes the powered state');
 cs={...cs,stage:'b4_connect'};const again=createB4Chapter();again.attach(ctx);again.update(.1);
 assert.equal((again.debug as Record<string,()=>{hum:boolean}>).state().hum,true,'after a reload at b4_connect the hum resumes');again.detach();
 // Ruling 39: a reload at to_lawn or later (player outside) shows the powered room at once, without the chapter lights.
 for(const stage of ['to_lawn','sports','done'] as const){
  cs={...cs,stage};g2.body.position.set(...O.handoff);const later=createB4Chapter();later.attach(ctx);later.update(.016);
  assert.equal(site.root.getObjectByName('B4_room_lights'),undefined,`reload at ${stage}: no chapter lights`);
  poweredState('reload at '+stage);later.detach();
 }
 console.log('PASS detach restores the door; hum resumes after reload');
}
disposeAsset(site.root);w2.dispose();
console.log('PASS campaign b4 checks');
