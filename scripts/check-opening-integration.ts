import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {OPENING as O,OFFICE_LAYOUT} from '../src/opening/spatialLayout';
import {findPath} from '../src/exploration/pathfind';
import {EXPLORATION as C} from '../src/exploration/config';
import {buildSite} from '../src/model/buildSite';
import {PLANTING_BED} from '../src/model/groundLayout';
import {sceneRegistry} from '../src/scene/registry';
import {disposeAsset} from '../src/model/buildCampus';
const results:object[]=[];
const w=createNavigation(BUILDINGS,SITE,true),g=new CampusGame(w,BUILDINGS,SITE);
function route(name:string,start:readonly number[],points:readonly (readonly number[])[]){g.body.position.fromArray([...start]);g.body.velocity.set(0,0,0);g.paused=false;g.body.grounded=true;let total=0;
 for(const [x,z]of points){let count=0;while(Math.hypot(x-g.body.position.x,z-g.body.position.z)>.08&&count<14000){g.yaw=Math.atan2(-(x-g.body.position.x),-(z-g.body.position.z));g.human={forward:1,right:0,sprint:false};g.step(1/120);count++;}assert.ok(count<14000,`${name} blocked toward ${x},${z}, at ${g.body.position.toArray()}, contacts ${JSON.stringify(g.body.contacts)}`);total+=count;}
 results.push({name,seconds:total/120,end:g.body.position.toArray()});}
route('Bus inside to exit',O.spawn,[[O.bus.doorX,O.bus.z-O.bus.width/2-.35],[O.busExit[0],O.busExit[2]]]);
route('Building4 to Building5 then turn right',O.busExit,O.routeB5);
route('Building5 to Building6 pickup space',O.staff,O.routeB6);
const [pickupX,pickupZ]=O.routeB6.at(-1)!;
const pickup=[pickupX,O.b6.floor,pickupZ];
const eye=new T.Vector3(pickupX,O.b6.floor+1.64,pickupZ);
const toLaptop=new T.Vector3(...O.laptop).add(new T.Vector3(0,.1,0)).sub(eye);
assert.ok(toLaptop.length()<2.7,'The office aisle must put the laptop within interaction range');
const pickupRay=new T.Raycaster(eye,toLaptop.clone().normalize(),.03,toLaptop.length()-.15);
assert.equal(pickupRay.intersectObjects(w.meshes,false).length,0,'The office furniture must leave a clear sightline to the laptop');
for(const {x,z} of [OFFICE_LAYOUT.presentation,OFFICE_LAYOUT.credenza,OFFICE_LAYOUT.planter,...OFFICE_LAYOUT.workstations.flatMap(({desk,chair})=>[desk,chair])]){
 assert.ok(w.blocked(x,z,O.b6.floor+.003),`Office furniture should be solid at ${x}, ${z}`);
}
route('Building6 back to Building5',pickup,[...O.routeB6].reverse());
route('Building5 to Building4 handoff',O.staff,O.routeB4);
// The AI navigation directive and the agent bridge use findPath over the same world.
// Every Chapter 1 leg a human can walk must also be plannable; lengths are logged so a
// regression shows up as a distance change, not only as ok flipping to false.
const pickupPoint:[number,number,number]=[pickup[0],O.b6.floor,pickup[2]];
const pathLegs:[string,[number,number,number],[number,number,number]][]=[
 ['spawn -> busExit',[...O.spawn] as [number,number,number],[...O.busExit] as [number,number,number]],
 ['busExit -> staff',[...O.busExit] as [number,number,number],[...O.staff] as [number,number,number]],
 ['staff -> B6 pickup',[...O.staff] as [number,number,number],pickupPoint],
 ['B6 pickup -> staff',pickupPoint,[...O.staff] as [number,number,number]],
 ['staff -> handoff',[...O.staff] as [number,number,number],[...O.handoff] as [number,number,number]],
 ['B5 door -> handoff',[O.b5.door,0,-53.8], [...O.handoff] as [number,number,number]],
 ['b5safe -> handoff',[...O.checkpoints.b5safe] as [number,number,number],[...O.handoff] as [number,number,number]],
];
for(const [name,from,to] of pathLegs){
 const r=findPath(w,from,to,{clearance:C.radius,maxStepHeight:C.maxStep,maxDrop:C.maxDrop});
 assert.ok(r.ok,`findPath ${name} must be ok: ${JSON.stringify({ok:r.ok,reason:r.reason,length:r.length,last:r.path.at(-1)})}`);
 console.log('PASS pathfind',name,r.length+'m');
 results.push({name:'findPath '+name,length:r.length,points:r.path.length,visited:r.visited,end:r.path.at(-1)});
}
// The planting bed used to seal the Building 5 door axis. Walking straight north
// must cross the strip and reach its far (Building 4) edge, not stop on it.
const bedEdge=PLANTING_BED.middleRow-PLANTING_BED.setback+PLANTING_BED.depth/2;
route('Building5 door through the planting-bed gap',O.checkpoints.b5safe,[[O.b5.door,bedEdge+1]]);
assert.ok(g.body.position.z>bedEdge,`the planting-bed gap must open the Building 5 door axis; stopped at z=${g.body.position.z}, far edge ${bedEdge}`);
let called=0;g.scenario={interact(){called++;g.openPanel('computer');return{ok:true,code:'test_modal',message:'Paused'};},computer(){called++;g.openPanel('computer');return{ok:true,code:'page_ready',message:'Paused'};},tick(){},snapshot(){return{};},spawn(){}};
g.panel=null;g.enableAI();g.acquireControl('opening-test');const epoch=g.epoch,before=g.body.position.toArray();g.act({commandId:'open-modal',controlEpoch:epoch,durationMs:100,interact:'opening-staff',move:{forward:1,right:0}},1000);g.step(1/120,1001);assert.equal(called,1);assert.deepEqual(g.body.position.toArray(),before);assert.equal(g.owner,null);assert.equal(g.paused,true);assert.equal(g.act({commandId:'old',controlEpoch:epoch,durationMs:100},1002).ok,false);results.push({name:'Shared RPC route, modal same-frame stop and epoch invalidation',passed:true});
const baseline=buildSite(),opening=buildSite(undefined,undefined,true),baseIndex=sceneRegistry(baseline.root),index=sceneRegistry(opening.root),migrations=baseIndex.entities.filter(e=>!index.byId.has(e.id)).map(e=>({oldId:e.id,authorKey:e.authorKey,newId:e.buildingId==='B05'?'B05':e.buildingId==='B06'?'B06':null,reason:'Opening mode doorway/room cavity replaces this fully clipped source part. Survey mode retains the original.'}));
assert.ok(migrations.every(m=>m.newId),'Unexpected ID removal outside opening buildings');
for(const room of [O.b5,O.b6]){const origin=new T.Vector3(room.door,room.floor+1.3,room.z1+1.1),ray=new T.Raycaster(origin,new T.Vector3(0,0,-1),0,4);const building=opening.byId.get(room.id)!;building.updateWorldMatrix(true,true);const hits=ray.intersectObject(building,true);assert.equal(hits.length,0,`${room.id} door has hidden core/glass backing: ${hits[0]?.object.name}`);assert.equal(w.blocked(room.door,room.z1-.5,room.floor),false);}
results.push({name:'Visual doorway rays match collision openings',passed:true});
fs.mkdirSync('evidence/opening-implementation',{recursive:true});fs.writeFileSync('evidence/opening-implementation/routes.json',JSON.stringify(results,null,2));fs.writeFileSync('evidence/opening-implementation/scene-id-migration.json',JSON.stringify({scope:'opening asset mode only',baselineRevision:baseIndex.revision,openingRevision:index.revision,migrations},null,2));
disposeAsset(baseline.root);disposeAsset(opening.root);w.dispose();console.log('PASS',results.length,'opening integration checks; explicit removed-part migrations:',migrations.length);
