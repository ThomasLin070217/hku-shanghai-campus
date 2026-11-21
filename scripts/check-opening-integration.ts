import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {OPENING as O} from '../src/opening/spatialLayout';
import {setOpeningLift} from '../src/opening/navigation';
import {buildSite} from '../src/model/buildSite';
import {sceneRegistry} from '../src/scene/registry';
import {disposeAsset} from '../src/model/buildCampus';
const results:object[]=[];
const w=createNavigation(BUILDINGS,SITE,true),g=new CampusGame(w,BUILDINGS,SITE);
function route(name:string,start:readonly number[],points:readonly (readonly number[])[]){g.body.position.fromArray([...start]);g.body.velocity.set(0,0,0);g.paused=false;g.body.grounded=true;let total=0;
 for(const [x,z]of points){let count=0;while(Math.hypot(x-g.body.position.x,z-g.body.position.z)>.08&&count<14000){g.yaw=Math.atan2(-(x-g.body.position.x),-(z-g.body.position.z));g.human={forward:1,right:0,sprint:false};g.step(1/120);count++;}assert.ok(count<14000,`${name} blocked toward ${x},${z}, at ${g.body.position.toArray()}, contacts ${JSON.stringify(g.body.contacts)}`);total+=count;}
 results.push({name,seconds:total/120,end:g.body.position.toArray()});}
route('Bus inside to exit',O.spawn,[[O.bus.doorX,O.bus.z-O.bus.width/2-.35],[O.busExit[0],O.busExit[2]]]);
route('Building4 to Building5 then turn right',O.busExit,O.routeB5);
// The office is reached from the ground east side door and a lift: the grand stair
// now ends at the sealed 4F terrace, so this route stops at the ground call panel.
route('Building5 to the Building6 east side door and lift lobby',O.staff,O.routeB6);
setOpeningLift(w,{carY:O.b6Lift.ground,doorGround:1,doorUpper:0});
route('Ground lobby into the lift car',[O.liftPanelGround[0],O.b6Lobby.floor,O.liftPanelGround[2]],[[10.2,-60],[9.7,-60]]);
/** Move the car in small steps and let the fixed-step physics carry the player. */
function ride(from:number,to:number,name:string){
 const steps=Math.ceil(Math.abs(to-from)/.04);
 for(let i=1;i<=steps;i++){
  setOpeningLift(w,{carY:from+(to-from)*i/steps});
  g.human={forward:0,right:0,sprint:false};g.step(1/120);
 }
 assert.ok(Math.abs(g.body.position.y-to)<.3,`${name}: player must ride with the car, y=${g.body.position.y}`);
 results.push({name,seconds:steps/120,end:g.body.position.toArray()});
}
ride(O.b6Lift.ground,O.b6Lift.upper,'Ground lobby to the 5F office');
setOpeningLift(w,{carY:O.b6Lift.upper,doorGround:0,doorUpper:1});
route('5F lift car to the office desk',[9.7,O.b6.floor,-60],O.routeB6Office);
route('Office desk back into the lift car',[O.laptop[0],O.b6.floor,O.laptop[2]-1.0],[[8.0,-60],[9.7,-60]]);
ride(O.b6Lift.upper,O.b6Lift.ground,'5F office down to the ground lobby');
setOpeningLift(w,{carY:O.b6Lift.ground,doorGround:1,doorUpper:0});
route('Ground lift car back out through the side door',[9.7,O.b6Lobby.floor,-60],[[10.6,-60],[11.6,-59.4],[12.4,-57.6],[13.8,-56.1],[16,-56.1]]);
route('Building6 back to Building5',[16,O.b6Lobby.floor,-56.1],[...O.routeB6].reverse().slice(5));
route('Building5 to Building4 handoff',O.staff,O.routeB4);
// Interaction anchors stand on real support and the car carries the player at 5F.
assert.equal(w.support(O.liftPanelGround[0],O.liftPanelGround[2],O.b6Lobby.floor),O.b6Lobby.floor,'the ground call button must stand in the lobby');
assert.equal(w.support(O.liftPanelUpper[0],O.liftPanelUpper[2],O.b6.floor),O.b6.floor,'the 5F call button must stand in the office');
setOpeningLift(w,{carY:O.b6Lift.upper,doorGround:0,doorUpper:1});
assert.equal(w.support(9.7,-60,O.b6Lift.upper),O.b6Lift.upper,'the car floor must support the player at 5F');
assert.equal(w.blocked(O.b6SideDoor.x-.6,O.b6SideDoor.z,O.b6Lobby.floor),false,'the side door must stay clear');
results.push({name:'Lift call anchors, 5F car support and side-door clearance',passed:true});
let called=0;g.scenario={interact(){called++;g.openPanel('computer');return{ok:true,code:'test_modal',message:'Paused'};},computer(){called++;g.openPanel('computer');return{ok:true,code:'page_ready',message:'Paused'};},tick(){},snapshot(){return{};},spawn(){}};
g.panel=null;g.enableAI();g.acquireControl('opening-test');const epoch=g.epoch,before=g.body.position.toArray();g.act({commandId:'open-modal',controlEpoch:epoch,durationMs:100,interact:'opening-staff',move:{forward:1,right:0}},1000);g.step(1/120,1001);assert.equal(called,1);assert.deepEqual(g.body.position.toArray(),before);assert.equal(g.owner,null);assert.equal(g.paused,true);assert.equal(g.act({commandId:'old',controlEpoch:epoch,durationMs:100},1002).ok,false);results.push({name:'Shared RPC route, modal same-frame stop and epoch invalidation',passed:true});
const baseline=buildSite(),opening=buildSite(undefined,undefined,true),baseIndex=sceneRegistry(baseline.root),index=sceneRegistry(opening.root),migrations=baseIndex.entities.filter(e=>!index.byId.has(e.id)).map(e=>({oldId:e.id,authorKey:e.authorKey,newId:e.buildingId==='B05'?'B05':e.buildingId==='B06'?'B06':null,reason:'Opening mode doorway/room cavity replaces this fully clipped source part. Survey mode retains the original.'}));
assert.ok(migrations.every(m=>m.newId),'Unexpected ID removal outside opening buildings');
// B05 keeps its south doorway. B06 no longer opens onto the stair: its south wall
// is solid and the route enters through the ground east side-door aperture.
{
 const room=O.b5,origin=new T.Vector3(room.door,room.floor+1.3,room.z1+1.1),ray=new T.Raycaster(origin,new T.Vector3(0,0,-1),0,4);
 const building=opening.byId.get(room.id)!;building.updateWorldMatrix(true,true);const hits=ray.intersectObject(building,true);
 assert.equal(hits.length,0,`${room.id} door has hidden core/glass backing: ${hits[0]?.object.name}`);
 assert.equal(w.blocked(room.door,room.z1-.5,room.floor),false);
}
{
 const room=O.b6,origin=new T.Vector3(room.door,room.floor+1.3,room.z1+1.1),ray=new T.Raycaster(origin,new T.Vector3(0,0,-1),0,4);
 const building=opening.byId.get(room.id)!;building.updateWorldMatrix(true,true);const hits=ray.intersectObject(building,true);
 assert.ok(hits.length>0,`${room.id} south wall must be solid now that the stair stops at 4F`);
 assert.equal(w.blocked(room.door,room.z1+.05,room.floor),true);
 const doorOrigin=new T.Vector3(O.b6SideDoor.x+1.8,1.4,O.b6SideDoor.z),doorRay=new T.Raycaster(doorOrigin,new T.Vector3(-1,0,0),0,3.4);
 const doorHits=doorRay.intersectObject(building,true);
 assert.equal(doorHits.length,0,`${room.id} side door has hidden core/glass backing: ${doorHits[0]?.object.name}`);
 assert.equal(w.blocked(O.b6SideDoor.x-1.0,O.b6SideDoor.z,O.b6Lobby.floor),false,'the side door aperture must be walkable');
}
results.push({name:'Visual doorway rays match collision openings',passed:true});
fs.mkdirSync('evidence/opening-implementation',{recursive:true});fs.writeFileSync('evidence/opening-implementation/routes.json',JSON.stringify(results,null,2));fs.writeFileSync('evidence/opening-implementation/scene-id-migration.json',JSON.stringify({scope:'opening asset mode only',baselineRevision:baseIndex.revision,openingRevision:index.revision,migrations},null,2));
disposeAsset(baseline.root);disposeAsset(opening.root);w.dispose();console.log('PASS',results.length,'opening integration checks; explicit removed-part migrations:',migrations.length);
