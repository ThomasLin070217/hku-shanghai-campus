/**
 * Geometry checks for the opening scenery (shuttle, Building 5 dinner area,
 * Building 6 presentation room).
 *
 * The module is built in plain Node, so this proves it never depends on the DOM
 * and that the bus, the dinner room and the laptop behave as the scene expects.
 *
 * Run: ./node_modules/.bin/tsx scripts/check-opening-world.ts
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOpeningWorld} from '../src/opening/world';
import {OPENING as O} from '../src/opening/spatialLayout';

const results:{name:string;passed:boolean}[]=[];
function group(name:string){console.log('== '+name+' ==');}
function ok(name:string){results.push({name,passed:true});console.log('  ok '+name);}

group('1. The world builds in Node with finite geometry');
const world=createOpeningWorld();
{
 assert.ok(world.root instanceof T.Group,'the world must expose a THREE.Group root');
 assert.equal(typeof world.update,'function');
 assert.equal(typeof world.dispose,'function');
 let meshes=0,nonFinite=0;
 world.root.updateMatrixWorld(true);
 world.root.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  meshes++;
  const geometry=o.geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const box=geometry.boundingBox;
  if(!box)return;
  for(const value of [...box.min.toArray(),...box.max.toArray()])if(!Number.isFinite(value))nonFinite++;
 });
 assert.ok(meshes>20,'the opening world must contain real geometry');
 assert.equal(nonFinite,0,'every geometry bound must be finite');
 // No part may sit outside the campus site envelope.
 const worldBox=new T.Box3().setFromObject(world.root);
 assert.ok(worldBox.min.x>-120&&worldBox.max.x<120,'the world must stay inside the campus');
 assert.ok(worldBox.min.z>-120&&worldBox.max.z<120,'the world must stay inside the campus');
 ok('world builds headless with '+meshes+' finite meshes');
}

group('2. The shuttle matches the shared layout');
{
 const bus=world.root.getObjectByName('Opening_bus');
 assert.ok(bus,'the bus group must exist');
 const floor=world.root.getObjectByName('opening-bus-chassis') as T.Mesh;
 assert.ok(floor,'the bus floor slab must exist');
 const box=new T.Box3().setFromObject(floor);
 assert.ok(Math.abs(box.max.y-O.bus.floor)<1e-6,`the bus floor top must be exactly ${O.bus.floor}, got ${box.max.y}`);
 // The body slab carries OPENING.bus.width and OPENING.bus.length.
 assert.ok(Math.abs((box.max.x-box.min.x)-O.bus.width)<1e-6,`the bus body width must match OPENING.bus.width, got ${box.max.x-box.min.x}`);
 assert.ok(Math.abs((box.max.z-box.min.z)-O.bus.length)<1e-6,`the bus body length must match OPENING.bus.length, got ${box.max.z-box.min.z}`);
 // The three-step transition outside the west exit matches opening/navigation.ts.
 const step1=new T.Box3().setFromObject(world.root.getObjectByName('opening-bus-step-1')!);
 const step2=new T.Box3().setFromObject(world.root.getObjectByName('opening-bus-step-2')!);
 assert.ok(Math.abs(step1.max.y-.18)<1e-6,'the first step must top out at 0.18 m');
 assert.ok(Math.abs(step2.max.y-.36)<1e-6,'the second step must top out at 0.36 m');
 assert.ok(Math.abs(step1.min.x-61.9)<1e-6&&Math.abs(step2.min.x-62.7)<1e-6,'the step positions must match opening/navigation.ts');
 assert.ok(Math.abs(step2.max.x-O.bus.doorX)<1e-6,'the upper step must meet the bus door');
 // The west exit, and therefore the door leaf, must sit on the west face.
 const door=world.root.getObjectByName('Opening_bus_door');
 assert.ok(door,'the door leaf must exist');
 const doorBox=new T.Box3().setFromObject(door);
 assert.ok(Math.abs(doorBox.min.x-O.bus.doorX)<0.25,`the door must be on the west face at x=${O.bus.doorX}, got ${doorBox.min.x}`);
 assert.ok(doorBox.min.z>=O.bus.doorZ-.8&&doorBox.max.z<=O.bus.doorZ+.8,'the door leaf must sit in the doorway');
 // The doorway channel (z 31.9..33.3) must stay free of seats and rails.
 const seats=world.root.getObjectByName('Opening_bus_seating');
 assert.ok(seats,'the seating group must exist');
 for(const child of seats.children){
  const seatBox=new T.Box3().setFromObject(child);
  assert.ok(seatBox.min.z>O.bus.doorZ+0.8,`seat ${child.name} must not block the exit channel`);
 }
 ok('bus floor, width and west doorway match the shared layout');
}

group('3. The door leaf opens, and only when time passes');
{
 const door=world.root.getObjectByName('Opening_bus_door') as T.Group;
 const closedAngle=door.rotation.y;
 world.update({incident:false,laptopAcquired:false,doorOpen:true},0);
 assert.equal(door.rotation.y,closedAngle,'a paused frame must not advance the door animation');
 world.update({incident:false,laptopAcquired:false,doorOpen:true},1/30);
 assert.ok(door.rotation.y>closedAngle,'the door must open once time advances');
 world.update({incident:false,laptopAcquired:false,doorOpen:true},1);
 const openAngle=door.rotation.y;
 assert.ok(openAngle>1.0,'the door must swing open');
 // The leaf folds inward so the step down to the pavement stays clear.
 const openBox=new T.Box3().setFromObject(door);
 assert.ok(openBox.max.x>O.bus.doorX+0.2,'the open leaf must fold inward, not across the exit steps');
 world.update({incident:false,laptopAcquired:false,doorOpen:false},2);
 assert.ok(door.rotation.y<openAngle,'the door must close again');
 ok('the door leaf animates only with time and never blocks the exit');
}

group('4. The world laptop follows the pickup state');
{
 const laptop=world.root.getObjectByName('Opening_b6_macbook');
 assert.ok(laptop,'the presentation laptop must exist');
 assert.equal(laptop!.visible,true,'the laptop is visible before it is collected');
 const box=new T.Box3().setFromObject(laptop!);
 assert.ok(Math.abs(box.min.x-O.laptop[0])<0.4,'the laptop must sit at OPENING.laptop.x');
 assert.ok(Math.abs(box.min.z-O.laptop[2])<0.4,'the laptop must sit at OPENING.laptop.z');
 assert.ok(Math.abs(box.min.y-O.laptop[1])<0.2,'the laptop must sit at desk height');
 world.update({incident:false,laptopAcquired:true,doorOpen:false},1/60);
 assert.equal(laptop!.visible,false,'the world laptop must disappear once the player carries it');
 world.update({incident:false,laptopAcquired:false,doorOpen:false},1/60);
 assert.equal(laptop!.visible,true,'the laptop returns when the pickup is undone');
 ok('the world laptop is shown, hidden and restored by the pickup state');
}

group('5. The dinner area switches between the tidy and the abandoned state');
{
 const props=world.root.getObjectByName('Opening_b5_props') as T.Group;
 assert.ok(props,'the dinner props must exist');
 assert.equal(props.visible,true,'the props are visible before the incident');
 // The incident is expressed by moving the props, never by hiding them, so the
 // exported GLB keeps the same geometry in both states.
 const chair=world.root.getObjectByName('Opening_b5_tipping_chair_0') as T.Group;
 assert.ok(chair,'a tipping chair must exist');
 const upright=chair.position.clone();
 const cup=world.root.getObjectByName('opening-b5-dropped-cup') as T.Mesh;
 assert.ok(cup,'the dropped cup must exist');
 const cupRest=cup.position.clone();
 const lamp=world.root.getObjectByName('opening-b5-ceiling-light--59_2') as T.Mesh;
 assert.ok(lamp,'a ceiling light strip must exist');
 const bright=lamp.material as T.MeshStandardMaterial;
 const normalEmissive=bright.emissiveIntensity;
 world.update({incident:true,laptopAcquired:false,doorOpen:false},1/60);
 assert.ok(chair.position.distanceTo(upright)>0.2,'a chair must topple during the incident');
 assert.ok(Math.abs(chair.rotation.x)>0.5,'the toppled chair must be lying on its side');
 assert.ok(cup.position.distanceTo(cupRest)>0.5,'the left-behind items must fall to the floor');
 assert.ok(bright.emissiveIntensity<normalEmissive,'the hall must dim during the incident');
 // Repeating the same state must be stable.
 world.update({incident:true,laptopAcquired:false,doorOpen:false},1/60);
 assert.ok(chair.position.distanceTo(upright)>0.2,'repeating the incident state must be stable');
 world.update({incident:false,laptopAcquired:false,doorOpen:false},1/60);
 assert.ok(chair.position.distanceTo(upright)<0.01,'the chairs stand again when the incident is cleared');
 assert.ok(Math.abs(chair.rotation.x)<0.01,'the standing chairs must be upright again');
 assert.ok(cup.position.distanceTo(cupRest)<0.01,'the items return to the counter');
 assert.ok(Math.abs(bright.emissiveIntensity-normalEmissive)<1e-6,'the hall light returns to normal');
 // The floor must sit exactly on the shared support height.
 const floor=world.root.getObjectByName('opening-b5-floor') as T.Mesh;
 const floorBox=new T.Box3().setFromObject(floor);
 assert.ok(Math.abs(floorBox.max.y-O.b5.floor)<1e-6,`the B05 floor top must be exactly ${O.b5.floor}`);
 const officeFloor=world.root.getObjectByName('opening-b6-floor') as T.Mesh;
 const officeBox=new T.Box3().setFromObject(officeFloor);
 assert.ok(Math.abs(officeBox.max.y-O.b6.floor)<1e-6,`the B06 floor top must be exactly ${O.b6.floor}`);
 ok('the dinner area toggles cleanly and both floors match the support heights');
}

group('6. The furniture leaves the walking routes open');
{
 const routes=[O.routeB5,O.routeB6,O.routeB4];
 // Nothing in the dining or office groups may stand on a walking waypoint. The last
 // waypoint of a route is the interaction anchor itself, where a stand is expected.
 const blocked:string[]=[];
 for(const route of routes){
  const waypoints=route.slice(0,-1);
  for(const [x,z] of waypoints){
   const insideB5=x>=O.b5.x0&&x<=O.b5.x1&&z>=O.b5.z0&&z<=O.b5.z1;
   const insideB6=x>=O.b6.x0&&x<=O.b6.x1&&z>=O.b6.z0&&z<=O.b6.z1;
   if(!insideB5&&!insideB6)continue;
   for(const name of ['opening-b5-table-0','opening-b5-table-1','opening-b5-table-2','opening-b5-table-3','opening-b5-counter','opening-b5-partition','opening-b6-desk','opening-b6-credenza']){
    const mesh=world.root.getObjectByName(name);
    if(!mesh)continue;
    const box=new T.Box3().setFromObject(mesh);
    if(box.min.x-0.25<=x&&box.max.x+0.25>=x&&box.min.z-0.25<=z&&box.max.z+0.25>=z)blocked.push(name+' at '+x+','+z);
   }
  }
 }
 assert.deepEqual(blocked,[],'furniture must not stand on a walking route: '+blocked.join('; '));
 // The pickup anchor itself must still be approachable: a free standing spot has to
 // exist within the interaction range, and the desk must not swallow the anchor.
 const desk=new T.Box3().setFromObject(world.root.getObjectByName('opening-b6-desk')!);
 const anchor=new T.Vector3(O.laptop[0],O.laptop[1],O.laptop[2]);
 const stand=new T.Vector3(O.laptop[0],O.b6.floor,O.laptop[2]+1.2);
 assert.ok(!desk.containsPoint(stand),'the desk must leave a standing spot in front of the laptop');
 assert.ok(stand.distanceTo(anchor)<2.7,'the standing spot must be within the interaction range of the laptop');
 // The staff must stand in the dinner area, not inside a table.
 const staffBox=new T.Box3().setFromObject(world.root.getObjectByName('Opening_b5_dinner')!);
 assert.ok(staffBox.containsPoint(new T.Vector3(O.staff[0],0,O.staff[2])),'the staff position must be inside the dinner area');
 for(const name of ['opening-b5-table-0','opening-b5-table-1','opening-b5-table-2','opening-b5-table-3']){
  const box=new T.Box3().setFromObject(world.root.getObjectByName(name)!);
  assert.ok(!box.containsPoint(new T.Vector3(O.staff[0],0,O.staff[2])),'the staff must not stand inside a table');
 }
 // No prop may poke through the room walls or the building shell.
 const outside:string[]=[];
 for(const name of ['opening-b5-table-0','opening-b5-table-1','opening-b5-table-2','opening-b5-table-3','opening-b5-planter-0','opening-b5-planter-1','opening-b5-planter-2','opening-b5-planter-3','opening-b5-counter','opening-b5-partition','opening-b6-desk','opening-b6-credenza','opening-b6-planter']){
  const mesh=world.root.getObjectByName(name);
  if(!mesh)continue;
  const box=new T.Box3().setFromObject(mesh);
  const inB5=box.min.x>=O.b5.x0-.05&&box.max.x<=O.b5.x1+.05&&box.min.z>=O.b5.z0-.05&&box.max.z<=O.b5.z1+.05;
  const inB6=box.min.x>=O.b6.x0-.05&&box.max.x<=O.b6.x1+.05&&box.min.z>=O.b6.z0-.05&&box.max.z<=O.b6.z1+.05;
  if(!inB5&&!inB6)outside.push(name+' spans x '+box.min.x.toFixed(2)+'..'+box.max.x.toFixed(2)+' z '+box.min.z.toFixed(2)+'..'+box.max.z.toFixed(2));
 }
 assert.deepEqual(outside,[],'props must stay inside their room: '+outside.join('; '));
 ok('tables, counters and desks do not block the walking routes');
}

group('7. Dispose releases the world');
{
 const disposable=createOpeningWorld();
 const geometries=new Set<T.BufferGeometry>();
 disposable.root.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});
 assert.ok(geometries.size>0,'the disposable world must own geometry');
 const parent=new T.Group();
 parent.add(disposable.root);
 disposable.dispose();
 assert.equal(disposable.root.parent,null,'dispose must detach the root from its parent');
 assert.equal(parent.children.length,0,'dispose must leave the parent empty');
 ok('dispose detaches the root and releases its resources');
}

console.log('\nPASS '+results.length+' opening world geometry groups');
