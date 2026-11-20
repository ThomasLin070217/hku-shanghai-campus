import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {OPENING as O} from '../src/opening/spatialLayout';
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
route('Building5 to Building6 pickup space',O.staff,O.routeB6);
route('Building6 back to Building5',[7.3,5.1,-58.2],[...O.routeB6].reverse());
route('Building5 to Building4 handoff',O.staff,O.routeB4);
let called=0;g.scenario={interact(){called++;g.openPanel('computer');return{ok:true,code:'test_modal',message:'Paused'};},computer(){called++;g.openPanel('computer');return{ok:true,code:'page_ready',message:'Paused'};},tick(){},snapshot(){return{};},spawn(){}};
g.panel=null;g.enableAI();g.acquireControl('opening-test');const epoch=g.epoch,before=g.body.position.toArray();g.act({commandId:'open-modal',controlEpoch:epoch,durationMs:100,interact:'opening-staff',move:{forward:1,right:0}},1000);g.step(1/120,1001);assert.equal(called,1);assert.deepEqual(g.body.position.toArray(),before);assert.equal(g.owner,null);assert.equal(g.paused,true);assert.equal(g.act({commandId:'old',controlEpoch:epoch,durationMs:100},1002).ok,false);results.push({name:'Shared RPC route, modal same-frame stop and epoch invalidation',passed:true});
const baseline=buildSite(),opening=buildSite(undefined,undefined,true),baseIndex=sceneRegistry(baseline.root),index=sceneRegistry(opening.root),migrations=baseIndex.entities.filter(e=>!index.byId.has(e.id)).map(e=>({oldId:e.id,authorKey:e.authorKey,newId:e.buildingId==='B05'?'B05':e.buildingId==='B06'?'B06':null,reason:'Opening mode doorway/room cavity replaces this fully clipped source part. Survey mode retains the original.'}));
assert.ok(migrations.every(m=>m.newId),'Unexpected ID removal outside opening buildings');
for(const room of [O.b5,O.b6]){const origin=new T.Vector3(room.door,room.floor+1.3,room.z1+1.1),ray=new T.Raycaster(origin,new T.Vector3(0,0,-1),0,4);const building=opening.byId.get(room.id)!;building.updateWorldMatrix(true,true);const hits=ray.intersectObject(building,true);assert.equal(hits.length,0,`${room.id} door has hidden core/glass backing: ${hits[0]?.object.name}`);assert.equal(w.blocked(room.door,room.z1-.5,room.floor),false);}
results.push({name:'Visual doorway rays match collision openings',passed:true});
fs.mkdirSync('evidence/opening-implementation',{recursive:true});fs.writeFileSync('evidence/opening-implementation/routes.json',JSON.stringify(results,null,2));fs.writeFileSync('evidence/opening-implementation/scene-id-migration.json',JSON.stringify({scope:'opening asset mode only',baselineRevision:baseIndex.revision,openingRevision:index.revision,migrations},null,2));
disposeAsset(baseline.root);disposeAsset(opening.root);w.dispose();console.log('PASS',results.length,'opening integration checks; explicit removed-part migrations:',migrations.length);
