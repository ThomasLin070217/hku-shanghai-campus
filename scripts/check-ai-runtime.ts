import assert from 'node:assert/strict';
import * as T from 'three';
import {createNavigation} from '../src/exploration/navigation';
import {cloneBuildings,SITE} from '../src/model/campusParameters';
import {CampusGame} from '../src/exploration/game';
import {CharacterPhysics} from '../src/exploration/physics';
import {perceive} from '../src/agent/perception';
import {findPath,type PathResult} from '../src/exploration/pathfind';
import {validDirective,DirectiveRunner,type Directive} from '../src/exploration/directives';
import {EXPLORATION as C} from '../src/exploration/config';

const specs=cloneBuildings();
const world=createNavigation(specs,SITE);
const game=new CampusGame(world,specs,SITE);
game.paused=false;game.armed=true;game.owner='test';game.epoch=game.epoch;
const spawn=game.body.position.clone();
const supportAt=(x:number,z:number,y=0)=>world.support(x,z,y)??0;
const posAt=(x:number,z:number):[number,number,number]=>[x,supportAt(x,z),z];
const floor2=(v:number)=>Math.round(v*100)/100;

let passed=0,failed=0;
function test(name:string,fn:()=>unknown){
 try{const detail=fn();passed++;console.log('PASS '+name+(detail===undefined?'':' '+JSON.stringify(detail)));}
 catch(e){failed++;console.log('FAIL '+name+' :: '+(e instanceof Error?e.message:String(e)));}
}

// ---------- perception ----------
test('perception: eye/forward/ground/underfoot',()=>{
 const p=perceive(game);
 assert.deepEqual(p.eye.map(floor2),[floor2(spawn.x),floor2(spawn.y+C.eyeHeight),floor2(spawn.z)]);
 const len=Math.hypot(p.forward[0],p.forward[1],p.forward[2]);
 assert.ok(Math.abs(len-1)<1e-6,'forward must be unit, got '+len);
 assert.ok(p.ground==='paving'||p.ground==='grass');
 assert.equal(typeof p.underfootY,'number');
 return{eye:p.eye,forward:p.forward,ground:p.ground,underfootY:p.underfootY};
});
test('perception: probes 0.6/1.5/3.0 m',()=>{
 const p=perceive(game);
 assert.deepEqual(p.probes.map(x=>x.distance),[0.6,1.5,3.0]);
 for(const probe of p.probes){
  assert.equal(typeof probe.supportY,'number','support at '+probe.distance);
  assert.equal(probe.blocked,false,'probe '+probe.distance+' should be clear at spawn');
  assert.ok(probe.stepUp!>=0&&probe.drop!>=0);
 }
 return p.probes;
});
test('perception: interactables sorted, distance/bearing',()=>{
 const p=perceive(game);
 const rec=p.interactables.find(a=>a.id==='record-cds-entry');
 assert.ok(rec,'record-cds-entry affordance');
 assert.ok(rec.distance>2.5&&rec.distance<4,'distance '+rec.distance);
 assert.ok(Math.abs(rec.bearingDeg)<5,'bearing '+rec.bearingDeg);
 assert.equal(rec.lineOfSight,true);
 assert.equal(rec.requiredDistance,2.7);
 assert.equal(rec.verb,'collect');
 assert.equal(rec.reachable,rec.distance<=2.7&&rec.lineOfSight);
 for(let i=1;i<p.interactables.length;i++)assert.ok(p.interactables[i].distance>=p.interactables[i-1].distance,'sorted');
 return{id:rec.id,distance:rec.distance,bearingDeg:rec.bearingDeg,inView:rec.inView,reachable:rec.reachable};
});
test('perception: bearing sign follows yaw convention (left positive)',()=>{
 game.yaw=Math.PI/2; // face west: the north record now sits to the right (-90)
 const p=perceive(game);
 const rec=p.interactables.find(a=>a.id==='record-cds-entry')!;
 assert.ok(rec.bearingDeg<-80&&rec.bearingDeg>-100,'bearing '+rec.bearingDeg);
 assert.equal(rec.inView,false);
 game.yaw=0;
 return{bearingDeg:rec.bearingDeg};
});
test('perception: far landmark line of sight blocked by B04',()=>{
 const saved=game.body.position.clone();
 game.body.position.set(58,supportAt(58,-40),-40);game.yaw=Math.PI; // face south through the teaching building
 const p=perceive(game);
 const far=p.interactables.find(a=>a.id==='record-hku-square');
 assert.ok(far,'far landmark present');
 assert.ok(far.distance>80,'far distance '+far.distance);
 assert.equal(far.lineOfSight,false,'B04 must occlude the HKU square record');
 game.body.position.copy(saved);game.yaw=0;
 return{id:far.id,distance:far.distance,lineOfSight:far.lineOfSight};
});
test('perception: reachable target when standing at the record',()=>{
 const saved=game.body.position.clone();
 game.body.position.set(58,supportAt(58,32.4),32.4);game.yaw=0;
 const p=perceive(game);
 const rec=p.interactables.find(a=>a.id==='record-cds-entry')!;
 assert.equal(rec.reachable,true);
 assert.ok(p.target,'survey target should lock on');
 assert.equal(p.target!.id,'record-cds-entry');
 assert.ok(p.target!.actions.includes('collect'));
 game.body.position.copy(saved);
 return{distance:rec.distance,target:p.target};
});
test('perception: hotbar equipment + computer/submit only with MacBook',()=>{
 let p=perceive(game);
 assert.equal(p.interactables.some(a=>a.id==='computer'),false,'no computer before equipping');
 assert.ok(game.inventory.move(9,0),'move MacBook into hotbar slot 1');
 assert.ok(game.selectHotbar(0));
 assert.ok(game.survey.equipped);
 p=perceive(game);
 const eq=p.interactables.find(a=>a.id==='macbook-air-13-silver');
 assert.ok(eq,'equip affordance');
 assert.equal(eq!.verb,'equip');assert.equal(eq!.distance,0);assert.equal(eq!.reachable,true);
 assert.ok(p.interactables.some(a=>a.id==='computer'&&a.verb==='open'));
 assert.ok(p.interactables.some(a=>a.id==='computer-submit'&&a.verb==='submit'));
 assert.ok(p.hud.some(line=>line.includes('已装备')));
 return{equipped:game.inventory.equipped?.itemId,hud:p.hud};
});
test('perception: nearby obstacles 12 m / max 8 / HUD lines',()=>{
 const saved=game.body.position.clone();
 game.body.position.set(58,supportAt(58,26),26);
 const p=perceive(game);
 assert.ok(p.nearby.length>=2&&p.nearby.length<=8,'nearby count '+p.nearby.length);
 assert.ok(p.nearby.every(n=>n.distance<=12&&Number.isFinite(n.bearingDeg)&&Number.isFinite(n.top)));
 for(let i=1;i<p.nearby.length;i++)assert.ok(p.nearby[i].distance>=p.nearby[i-1].distance,'sorted');
 assert.ok(p.nearby.some(n=>n.name.includes('security-pole')),'security pole should be detected');
 assert.ok(p.hud.length<=6);
 game.body.position.copy(saved);
 game.paused=true;game.pauseReason='window_blur';
 const paused=perceive(game);
 assert.ok(paused.hud.some(line=>line.includes('window_blur')),'paused HUD: '+paused.hud.join(' | '));
 game.paused=false;game.pauseReason=null;
 return{nearby:p.nearby.slice(0,3),hud:p.hud};
});

// ---------- pathfind ----------
function assertWalkableProfile(path:[number,number,number][]){
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.25));
  let y=a[1];
  for(let k=1;k<=n;k++){
   const t=k/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
   const h=world.support(x,z,y+C.maxStep);
   assert.ok(h!==null,`unsupported point ${x.toFixed(2)},${z.toFixed(2)}`);
   assert.ok(h-y<=C.maxStep+.02,`step up too high at ${x.toFixed(2)},${z.toFixed(2)}: ${h-y}`);
   assert.ok(y-h<=C.maxDrop+.02,`drop too deep at ${x.toFixed(2)},${z.toFixed(2)}: ${y-h}`);
   y=h;
  }
 }
}
test('pathfind: spawn -> B04 entrance',()=>{
 const from=spawn.toArray() as [number,number,number],to=posAt(58,23.5);
 const r=findPath(world,from,to);
 assert.ok(r.ok&&r.reachable&&!r.partial,'ok/reachable');
 assert.ok(r.visited>0&&r.path.length>=2);
 assert.ok(Math.hypot(r.path[0][0]-from[0],r.path[0][2]-from[2])<1e-6,'starts at from');
 assert.ok(Math.hypot(r.path.at(-1)![0]-to[0],r.path.at(-1)![2]-to[2])<1e-6,'ends at to');
 assert.ok(r.length>=9.5&&r.length<13,'length '+r.length);
 assertWalkableProfile(r.path);
 return{length:r.length,points:r.path.length,visited:r.visited,path:r.path.map(p=>p.map(floor2))};
});
test('pathfind: detour around B04 from north side',()=>{
 const from=posAt(58,-40),to=posAt(58,23.5);
 const r=findPath(world,from,to);
 assert.ok(r.ok&&r.reachable,'full path');
 assert.ok(r.length>70,'must detour, length '+r.length);
 for(const p of r.path)assert.ok(!(p[0]>28.5&&p[0]<87.5&&p[2]>-24&&p[2]<20),'path enters B04 '+JSON.stringify(p));
 assertWalkableProfile(r.path);
 return{length:r.length,points:r.path.length,visited:r.visited};
});
test('pathfind: climbs the auditorium stair (0.17 m treads)',()=>{
 const from=posAt(4,-20),to=posAt(4,-52);
 const r=findPath(world,from,to);
 assert.ok(r.ok,'stair path reachable');
 const end=r.path.at(-1)!;
 assert.ok(Math.abs(end[1]-supportAt(4,-52))<.05,'ends on stair landing, y='+end[1]);
 assertWalkableProfile(r.path);
 return{length:r.length,points:r.path.length,end:end.map(floor2)};
});
test('pathfind: out-of-bounds target -> partial, no throw',()=>{
 const r=findPath(world,posAt(58,-40),[58,0,300]);
 assert.equal(r.ok,false);assert.equal(r.reachable,false);assert.equal(r.partial,true);
 assert.equal(r.reason,'unreachable');
 assert.ok(r.path.length>1&&r.path.at(-1)![2]<114,'stops at the rim '+JSON.stringify(r.path.at(-1)));
 return{length:r.length,last:r.path.at(-1)!.map(floor2),reason:r.reason};
});
test('pathfind: maxNodes -> partial limit',()=>{
 const r=findPath(world,posAt(58,-40),posAt(58,23.5),{maxNodes:8});
 assert.equal(r.ok,false);assert.equal(r.partial,true);assert.equal(r.reason,'limit');
 assert.ok(r.visited<=8&&r.visited>=1,'visited '+r.visited);
 return{visited:r.visited,points:r.path.length,reason:r.reason};
});
test('pathfind: degenerate input never throws',()=>{
 const nan=findPath(world,[NaN,0,0],[0,0,0]);
 assert.equal(nan.ok,false);assert.equal(nan.reason,'blocked');
 const same=findPath(world,posAt(58,33.5),posAt(58,33.5));
 assert.equal(same.ok,true);assert.equal(same.length,0);
 return{nan:nan.reason,sameOk:same.ok};
});
test('pathfind: unreachable walled-in goal -> partial or unreachable',()=>{
 const r=findPath(world,posAt(58,33.5),posAt(58,-2)); // inside B04
 assert.equal(r.ok,false);
 assert.ok(r.partial||r.reason==='unreachable','partial/unreachable: '+JSON.stringify(r));
 return{r};
});

// ---------- directives ----------
test('directives: validDirective accepts legal shapes, rejects junk',()=>{
 assert.equal(validDirective({type:'walkTo',position:[1,0,2]}),true);
 assert.equal(validDirective({type:'walkTo',position:[1,0,2],toleranceM:.5,sprint:true}),true);
 assert.equal(validDirective({type:'approach',position:[1,0,2],stopDistanceM:2}),true);
 assert.equal(validDirective({type:'lookAt',position:[1,0,2],toleranceDeg:3}),true);
 assert.equal(validDirective({type:'followPath',path:[[0,0,0],[1,0,1]]}),true);
 for(const bad of [null,{},{type:'jump'},{type:'walkTo'},{type:'walkTo',position:[0,0]},{type:'walkTo',position:[0,0,0],move:{}},{type:'followPath',path:[]},{type:'lookAt',position:[0,0,0],toleranceDeg:999}]){
  assert.equal(validDirective(bad),false,'should reject '+JSON.stringify(bad));
 }
 return true;
});
function run(directive:Directive,body:CharacterPhysics,yaw:number,pitch:number,maxSeconds=30){
 const runner=new DirectiveRunner(directive,Date.now());
 const dt=C.fixedStep,steps=Math.ceil(maxSeconds/dt)+3;
 let result:ReturnType<DirectiveRunner['step']>|null=null;
 for(let i=0;i<steps;i++){
  result=runner.step(dt,{world,body,yaw,pitch});
  body.step(dt,result.intent,result.yaw,result.jump);
  yaw=result.yaw;pitch=result.pitch;
  if(result.done)break;
 }
 return {runner,result:result!,yaw,pitch,seconds:(runner.elapsedMs/1000)};
}
test('directives: walkTo reaches B04 entrance at 120 Hz',()=>{
 game.spawn();game.paused=false;game.armed=true;game.owner='test';
 const body=game.body,goal=posAt(58,23.5);
 const {result,seconds}=run({type:'walkTo',position:goal,toleranceM:.35,sprint:false},body,game.yaw,game.pitch);
 assert.equal(result.done,true);assert.equal(result.reached,true);assert.equal(result.reason,'goal_reached');
 const remaining=Math.hypot(body.position.x-goal[0],body.position.z-goal[2]);
 assert.ok(remaining<=.36,'remaining '+remaining);
 return{seconds:floor2(seconds),remaining:floor2(remaining),lookErrorDeg:result.lookErrorDeg};
});
test('directives: lookAt converges within 540 deg/s',()=>{
 game.spawn();const body=game.body,target:[number,number,number]=[58,1.5,10];
 const {result,yaw}=run({type:'lookAt',position:target,toleranceDeg:2},body,Math.PI,0,5); // facing away
 assert.equal(result.done,true);assert.equal(result.reached,true);assert.equal(result.reason,'goal_reached');
 assert.ok(result.lookErrorDeg<=2,'look error '+result.lookErrorDeg);
 const eyeY=body.position.y+C.eyeHeight,dx=target[0]-body.position.x,dz=target[2]-body.position.z,dy=target[1]-eyeY;
 const want=Math.atan2(-dx,-dz),have=yaw;
 const err=Math.abs(Math.atan2(Math.sin(want-have),Math.cos(want-have)))/Math.PI*180;
 assert.ok(err<2.5,'yaw error '+err);
 return{lookErrorDeg:result.lookErrorDeg,yawDeg:floor2(yaw/Math.PI*180),pitchDeg:floor2(result.pitch/Math.PI*180)};
});
test('directives: approach stops at 2.4 m then looks at target',()=>{
 game.spawn();const body=game.body,goal=posAt(58,30.5);
 const {result}=run({type:'approach',position:goal,stopDistanceM:2.4},body,game.yaw,game.pitch);
 assert.equal(result.done,true);assert.equal(result.reached,true);
 const remaining=Math.hypot(body.position.x-goal[0],body.position.z-goal[2]);
 assert.ok(remaining>=2.0&&remaining<=2.5,'stop distance '+remaining);
 assert.ok(result.lookErrorDeg<=2,'look error '+result.lookErrorDeg);
 return{remaining:floor2(remaining),lookErrorDeg:result.lookErrorDeg};
});
test('directives: followPath visits a polyline',()=>{
 game.spawn();const body=game.body,path:[number,number,number][]=[posAt(58,31),posAt(58,27),posAt(58,23.5)];
 const {result}=run({type:'followPath',path},body,game.yaw,game.pitch,15);
 assert.equal(result.done,true);assert.equal(result.reached,true);
 const remaining=Math.hypot(body.position.x-path[2][0],body.position.z-path[2][2]);
 assert.ok(remaining<=.36,'remaining '+remaining);
 return{remaining:floor2(remaining),waypoints:result?3:3};
});
test('directives: blocked goal at the boundary reports stuck',()=>{
 const body=new CharacterPhysics(world);body.position.set(58,supportAt(58,105),105);body.grounded=true;
 const {result,seconds}=run({type:'walkTo',position:[58,0,300],toleranceM:.35},body,0,0);
 assert.equal(result.done,true);assert.equal(result.reached,false);
 assert.equal(result.reason,'stuck','reason '+result.reason);
 return{seconds:floor2(seconds),reason:result.reason,position:body.position.toArray().map(floor2)};
});
test('directives: long reachable walk times out at 30 s',()=>{
 game.spawn();const body=game.body;
 const {result,seconds}=run({type:'walkTo',position:[58,0,113],toleranceM:.35},body,game.yaw,game.pitch);
 assert.equal(result.done,true);assert.equal(result.reached,false);
 assert.equal(result.reason,'timeout','reason '+result.reason);
 assert.ok(seconds>=29.9,'elapsed '+seconds);
 return{seconds:floor2(seconds),reason:result.reason};
});

world.dispose();
const total=passed+failed;
console.log(`\n${failed?'FAIL':'PASS'} check-ai-runtime: ${passed}/${total} passed, ${failed} failed`);
if(failed)process.exitCode=1;
