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
console.log('PASS 8-unit opening fleet: visible 4+4 entrance posts, peaceful standby, continuous deployment, every patrol waypoint visited, no solids, reset and freeze');
fleet.dispose();
world.dispose();
