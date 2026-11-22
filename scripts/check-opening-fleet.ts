/**
 * Offline check for the eight-unit opening fleet.
 *
 * Drives every unit with the real CharacterPhysics and Navigation, far from the
 * player, and proves the patrol loops are walkable and distributed rather than
 * stacked on one another.
 *
 * Run: ./node_modules/.bin/tsx scripts/check-opening-fleet.ts
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {EXPLORATION as C} from '../src/exploration/config';
import {OPENING as O} from '../src/opening/spatialLayout';
import {createOpeningFleet} from '../src/opening/robots';
import {ROBOT,type OpeningRobot} from '../src/opening/robot';

const world=createNavigation(BUILDINGS,SITE,true);
const fleet=createOpeningFleet(world);
assert.equal(fleet.count,8,'the opening must deploy eight units');
assert.equal(new Set(fleet.units.map(u=>u.root.userData.fleetId)).size,8,'every unit has a stable id');
assert.equal(new Set(O.robotRoutes.map(r=>r.map(p=>p.join(',')).join(';'))).size,8,'every route is distinct');

const player=new T.Vector3(24,0,60);
const dt=1/30;
const visited=fleet.units.map(()=>new Set<number>());
const start=fleet.units.map(u=>u.position.clone());
const ids=fleet.units.map(u=>u.root.userData.fleetId);
for(const [i,unit]of fleet.units.entries()){
 assert.ok(Math.hypot(unit.position.x-O.robotFormation[i][0],unit.position.z-O.robotFormation[i][2])<.01,'every unit starts at its visible entrance post');
 assert.ok(!world.blocked(unit.position.x,unit.position.z,unit.position.y),'post must not be in a wall');
}
for(let i=0;i<120;i++){
 const quiet=fleet.standby(true);assert.equal(quiet.caught,false);assert.equal(quiet.warning,0);
 for(const [j,unit]of fleet.units.entries()){
  assert.equal(unit.root.visible,true);assert.ok(unit.position.distanceTo(start[j])<1e-6);
  assert.equal(unit.root.getObjectByName('opening-robot-scan-sector')!.visible,false,'friendly guards must not project red scan sectors');
 }
}
// Switching to alert reuses the same instances at the same coordinates, even while paused.
fleet.update(0,player,true,true);
assert.deepEqual(fleet.units.map(u=>u.root.userData.fleetId),ids);
for(const [i,unit]of fleet.units.entries())assert.ok(unit.position.distanceTo(start[i])<1e-6,'alert must not teleport the guard');
let previous=fleet.units.map(u=>u.position.clone());

for(let step=0;step<240*30;step++){
 const result=fleet.update(dt,player,true,false);
 assert.equal(result.caught,false,'a player far outside the route is never captured');
 for(const [i,unit] of fleet.units.entries()){
  const p=unit.position;
  assert.ok(Math.hypot(p.x-previous[i].x,p.z-previous[i].z)<.09&&Math.abs(p.y-previous[i].y)<=C.maxStep+.01,'deployment must move continuously, allowing physical stair steps');previous[i].copy(p);
  assert.equal(world.blocked(p.x,p.z,p.y),false,`unit ${i} entered a solid at ${p.toArray().map(n=>n.toFixed(2))}`);
  const floor=world.support(p.x,p.z,p.y+C.maxStep);
  assert.notEqual(floor,null,`unit ${i} left the walkable site`);
  O.robotRoutes[i].forEach(([x,,z],index)=>{if(Math.hypot(p.x-x,p.z-z)<1.4)visited[i].add(index);});
 }
}
for(const [i,seen] of visited.entries()){
 assert.equal(seen.size,O.robotRoutes[i].length,`unit ${i} must visit every authored waypoint, visited ${[...seen].join(',')}`);
}
for(const [i,unit] of fleet.units.entries()){
 assert.ok(unit.position.distanceTo(start[i])>0.5,`unit ${i} actually moved`);
}
// Distribution: no two units start or patrol on exactly the same spot.
for(let a=0;a<fleet.units.length;a++)for(let b=a+1;b<fleet.units.length;b++){
 assert.ok(start[a].distanceTo(start[b])>1.5,`units ${a} and ${b} must occupy distinct entrance posts`);
}
// Render budget (T25/T26): merged shell, shared buffers, only the nearest units lit.
const fleetMeshes:T.Mesh[]=[];
fleet.root.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh)fleetMeshes.push(mesh);});
const fleetGeometries=new Set(fleetMeshes.map(mesh=>mesh.geometry));
const fleetMaterials=new Set(fleetMeshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]));
// Per unit: body, band, head, eye, beacon, scan sector, and four legs of three meshes each.
assert.equal(fleetMeshes.length,8*18,`eight units x eighteen meshes = ${fleetMeshes.length}`);
assert.equal(fleetGeometries.size,16,`eight shared shell and leg buffers plus one scan sector per unit (${fleetGeometries.size})`);
assert.equal(fleetMaterials.size,27,`three shared materials plus three emissive ones per unit (${fleetMaterials.size})`);
const shadowed=fleet.units.filter(unit=>(unit.root.getObjectByName('robot-body') as T.Mesh).castShadow);
assert.equal(shadowed.length,ROBOT.shadowUnits,`only the nearest ${ROBOT.shadowUnits} units cast shadows (${shadowed.length})`);
let visibleLights=0;
fleet.root.traverse(object=>{const light=object as T.PointLight;if(light.isPointLight&&light.visible)visibleLights++;});
assert.equal(visibleLights,ROBOT.shadowUnits,`and only they keep a point light (${visibleLights})`);
const eyeMaterials=fleet.units.map(unit=>{
 const eye=unit.root.getObjectByName('opening-robot-eye') as T.Mesh;
 return (Array.isArray(eye.material)?eye.material[0]:eye.material) as T.MeshStandardMaterial;
});
assert.equal(new Set(eyeMaterials).size,fleet.count,'every unit keeps its own eye material');
assert.ok(eyeMaterials.every(material=>material.emissive.r>0.6&&material.emissive.g<0.3),'every eye still glows red on alert');
// Coordination (T28): a player far outside every route never reaches the blackboard.
assert.equal(fleet.blackboard.sighting,null,'no unit reports a sighting it never had');
assert.equal(fleet.blackboard.alert,0,'so the fleet alert stays at zero');
// Render-only polling keeps the aggregate and all unit state stable.
const cached=fleet.update(0,player,true,true);
for(let i=0;i<120;i++)assert.equal(fleet.update(0,player,true,true),cached,'render reads reuse the simulation result');
// The fleet is read-only while inactive/paused and resets cleanly.
const frozen=fleet.units.map(u=>u.position.toArray().join(','));
for(let i=0;i<60;i++)fleet.update(dt,player,false,false);
assert.deepEqual(fleet.units.map(u=>u.position.toArray().join(',')),frozen,'inactive units are frozen');
// Standing down (campaign `to_lawn` onwards) puts every unit back in the standing pose,
// wherever its trot was when the patrol stopped.
const legJoints=(unit:OpeningRobot)=>['fl','fr','rl','rr'].map(key=>{
 const leg=unit.root.getObjectByName('robot-leg-'+key)!;
 const knee=leg.getObjectByName('robot-leg-lower')!.parent!;
 return [leg.rotation.x,leg.rotation.z,knee.rotation.x];
});
const midStride=fleet.units.filter(unit=>{const j=legJoints(unit);return j.some(v=>Math.abs(v[0]-j[0][0])>1e-3);}).length;
assert.ok(midStride>0,`scenario: some units are mid-stride before standing down, so the standing-pose check is not vacuous (${midStride}/8)`);
fleet.standby(true);
const standPose=legJoints(fleet.units[0])[0];
for(const [i,unit] of fleet.units.entries()){
 for(const joint of legJoints(unit))assert.ok(joint.every((v,k)=>Math.abs(v-standPose[k])<1e-9),`unit ${i} stands down into the standing pose`);
 assert.equal(unit.root.getObjectByName('opening-security-robot-rig')!.position.y,0,`unit ${i} stops bobbing on standby`);
}
assert.deepEqual(fleet.units.map(u=>u.position.toArray().join(',')),frozen,'standing down never moves a unit');
console.log(`  standby: ${midStride}/8 units were mid-stride before standing down; all 8 now hold the standing pose`);
fleet.reset();
for(const [i,unit] of fleet.units.entries()){
 assert.equal(unit.state,'patrol',`unit ${i} resets to patrol`);
 assert.ok(unit.position.distanceTo(start[i])<0.01,`unit ${i} resets to its authored start`);
}
console.log('PASS 8-unit opening fleet: visible 4+4 entrance posts, peaceful standby, continuous deployment, every patrol waypoint visited, no solids, reset and freeze; shared shell pool, nearest-3 shadow budget, no phantom sightings');
// The shared pool and every per-unit resource are released exactly once on teardown.
const geometryDispose=new Map<T.BufferGeometry,number>();
const materialDispose=new Map<T.Material,number>();
for(const geometry of fleetGeometries){
 const original=geometry.dispose.bind(geometry);geometryDispose.set(geometry,0);
 geometry.dispose=()=>{geometryDispose.set(geometry,(geometryDispose.get(geometry)??0)+1);original();};
}
for(const material of fleetMaterials){
 const original=material.dispose.bind(material);materialDispose.set(material,0);
 material.dispose=()=>{materialDispose.set(material,(materialDispose.get(material)??0)+1);original();};
}
fleet.dispose();
assert.ok([...geometryDispose.values()].every(n=>n===1),'every fleet geometry is disposed exactly once');
assert.ok([...materialDispose.values()].every(n=>n===1),'every fleet material is disposed exactly once');

// ---------------------------------------------------------------- B5 exit corridor fairness
// Chapter 1 sends the player north out of Building 5 along x = 58 and across the forecourt.
// The stealth section must stay lethal to a careless player, but walking the HUD route must
// not be a guaranteed capture: the loops patrol beside the corridor, not along it.
const SIM_DT=1/30;
const CORRIDOR:readonly (readonly [number,number])[]=O.routeB4.slice(0,3).map(([x,z])=>[x,z] as [number,number]);
const legLength=(a:readonly [number,number],b:readonly [number,number])=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const CORRIDOR_LENGTH=CORRIDOR.slice(1).reduce((sum,point,index)=>sum+legLength(CORRIDOR[index],point),0);
/** Point on the authored collision route at a given travelled distance. */
const corridorPoint=(distance:number):[number,number]=>{
 let left=distance;
 for(let i=1;i<CORRIDOR.length;i++){
  const a=CORRIDOR[i-1],b=CORRIDOR[i],length=legLength(a,b);
  if(left<=length||i===CORRIDOR.length-1){
   const t=length<=1e-9?0:Math.min(1,left/length);
   return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }
  left-=length;
 }
 return [...CORRIDOR[CORRIDOR.length-1]] as [number,number];
};
interface CorridorRun{caughtAt:number|null;by:string|null;at:[number,number]|null;seconds:number;chased:boolean}
/** Deploy the fleet, pre-roll the patrol to `phase` seconds, then walk/sprint the corridor. */
function runCorridor(speed:number,phase:number):CorridorRun{
 const simFleet=createOpeningFleet(world);
 const away=new T.Vector3(24,0,60);
 for(let step=0;step<Math.round(phase/SIM_DT);step++)simFleet.update(SIM_DT,away,true,false);
 let floor=world.support(CORRIDOR[0][0],CORRIDOR[0][1],2)??0;
 const player=new T.Vector3(CORRIDOR[0][0],floor,CORRIDOR[0][1]);
 let travelled=0,chased=false,result:CorridorRun={caughtAt:null,by:null,at:null,seconds:0,chased:false};
 const maxSteps=Math.round(40/SIM_DT);
 for(let step=0;step<maxSteps;step++){
  travelled=Math.min(CORRIDOR_LENGTH,travelled+speed*SIM_DT);
  const [x,z]=corridorPoint(travelled);
  floor=world.support(x,z,floor+C.maxStep)??floor;
  player.set(x,floor,z);
  const update=simFleet.update(SIM_DT,player,true,false);
  chased=chased||update.chasing;
  if(update.caught){
   const unit=simFleet.units.find(candidate=>candidate.diagnostics.caught);
   result={caughtAt:(step+1)*SIM_DT,by:unit?String(unit.root.userData.fleetId):null,at:[x,z],seconds:(step+1)*SIM_DT,chased};
   break;
  }
  if(travelled>=CORRIDOR_LENGTH){
   result={caughtAt:null,by:null,at:null,seconds:(step+1)*SIM_DT,chased};
   break;
  }
 }
 simFleet.dispose();
 return result;
}
/** A player standing on a patrol edge must still be found and caught. */
function standOnLoop(loopIndex:number,edgeIndex:number,phase=60):{caughtAt:number|null;by:string|null}{
 const loop=O.robotRoutes[loopIndex];
 const a=loop[edgeIndex],b=loop[(edgeIndex+1)%loop.length];
 const x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;
 const simFleet=createOpeningFleet(world);
 const away=new T.Vector3(24,0,60);
 for(let step=0;step<Math.round(phase/SIM_DT);step++)simFleet.update(SIM_DT,away,true,false);
 const player=new T.Vector3(x,world.support(x,z,2)??0,z);
 let caughtAt:number|null=null,by:string|null=null;
 // One long loop period plus the waypoint dwells, so the unit always comes back around.
 for(let step=0;step<Math.round(60/SIM_DT);step++){
  const update=simFleet.update(SIM_DT,player,true,false);
  if(update.caught){
   caughtAt=(step+1)*SIM_DT;
   const unit=simFleet.units.find(candidate=>candidate.diagnostics.caught);
   by=unit?String(unit.root.userData.fleetId):null;
   break;
  }
 }
 simFleet.dispose();
 return {caughtAt,by};
}
const PHASES=[0,5,10,15,20,25];
const walkPhases=PHASES.map(offset=>runCorridor(C.speed,45+offset));
const sprintPhases=PHASES.map(offset=>runCorridor(C.sprintSpeed,45+offset));
// The sampled points sit outside every other loop's own 7.4m detection range, so the
// sighting that starts the capture comes from the loop's own unit; a nearby unit may
// then support, exactly as the shared blackboard is meant to work.
const standLoop0=standOnLoop(0,3);
const standLoop3=standOnLoop(3,1);
const show=(name:string,offset:number,run:CorridorRun)=>console.log(`  ${name} phase ${String(offset).padStart(2)}s: ${run.caughtAt===null?'SAFE':'CAUGHT at '+run.caughtAt.toFixed(1)+'s by '+run.by+' at ('+run.at!.map(n=>n.toFixed(1))+')'}  chased=${run.chased}`);
console.log('B5 exit corridor (x = 58, forecourt; 6 patrol phases):');
walkPhases.forEach((run,index)=>show('walk  ',PHASES[index],run));
sprintPhases.forEach((run,index)=>show('sprint',PHASES[index],run));
console.log(`  stand on loop 0 edge: ${standLoop0.caughtAt===null?'NOT CAUGHT':'caught at '+standLoop0.caughtAt.toFixed(1)+'s by '+standLoop0.by}`);
console.log(`  stand on loop 3 edge: ${standLoop3.caughtAt===null?'NOT CAUGHT':'caught at '+standLoop3.caughtAt.toFixed(1)+'s by '+standLoop3.by}`);
const walkSafe=walkPhases.filter(run=>run.caughtAt===null).length;
const sprintSafe=sprintPhases.filter(run=>run.caughtAt===null).length;
assert.ok(walkSafe>=5,`walking the authored route must survive most patrol phases, not ${6-walkSafe}/6 captures`);
assert.equal(sprintSafe,6,'sprinting the authored route must survive every sampled patrol phase');
assert.notEqual(standLoop0.caughtAt,null,'a player standing on a patrol edge must still be caught');
assert.notEqual(standLoop3.caughtAt,null,'a player standing on a patrol edge must still be caught');
// No patrol edge may run along the corridor itself, otherwise the capture is phase-independent.
for(const [index,loop] of O.robotRoutes.entries()){
 for(let i=0;i<loop.length;i++){
  const a=loop[i],b=loop[(i+1)%loop.length];
  for(let step=0;step<=20;step++){
   const t=step/20,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
   if(z<-61.5||z>-26)continue;
   assert.ok(Math.abs(x-58)>=1.2,`loop ${index} runs within ${Math.abs(x-58).toFixed(2)}m of the x=58 corridor at (${x.toFixed(1)},${z.toFixed(1)})`);
  }
 }
}
console.log(`PASS B5 exit fairness: ${walkSafe}/6 walking phases and ${sprintSafe}/6 sprinting phases reach the forecourt uncaught, standing on a patrol edge is still caught, no loop hugs the corridor`);
world.dispose();
