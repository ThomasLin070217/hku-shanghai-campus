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
import {ROBOT} from '../src/opening/robot';

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
assert.equal(fleetMeshes.length,48,`eight units x six merged meshes = ${fleetMeshes.length}`);
assert.equal(fleetGeometries.size,13,`five shared shell buffers plus one scan sector per unit (${fleetGeometries.size})`);
assert.equal(fleetMaterials.size,26,`two shared materials plus three emissive ones per unit (${fleetMaterials.size})`);
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
world.dispose();
