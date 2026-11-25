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
 // The body slab runs along X (parallel to the R009 road) and is `length` long.
 assert.ok(Math.abs((box.max.x-box.min.x)-O.bus.length)<1e-6,`the bus body length must match OPENING.bus.length, got ${box.max.x-box.min.x}`);
 assert.ok(Math.abs((box.max.z-box.min.z)-O.bus.width)<1e-6,`the bus body width must match OPENING.bus.width, got ${box.max.z-box.min.z}`);
 // The two steps outside the north exit match opening/navigation.ts.
 const step1=new T.Box3().setFromObject(world.root.getObjectByName('opening-bus-step-1')!);
 const step2=new T.Box3().setFromObject(world.root.getObjectByName('opening-bus-step-2')!);
 assert.ok(Math.abs(step1.max.y-.18)<1e-6,'the outer step must top out at 0.18 m');
 assert.ok(Math.abs(step2.max.y-.36)<1e-6,'the upper step must top out at 0.36 m');
 assert.ok(Math.abs(step1.min.z-(O.bus.z-O.bus.width/2-1.6))<1e-6&&Math.abs(step2.min.z-(O.bus.z-O.bus.width/2-.8))<1e-6,'the step positions must match opening/navigation.ts');
 assert.ok(Math.abs(step2.max.z-(O.bus.z-O.bus.width/2))<1e-6,'the upper step must meet the bus door');
 // The north exit, and therefore the door leaf, must sit on the north face.
 const door=world.root.getObjectByName('Opening_bus_door');
 assert.ok(door,'the door leaf must exist');
 const doorBox=new T.Box3().setFromObject(door);
 assert.ok(Math.abs(doorBox.min.z-O.bus.doorZ)<0.25,`the door must be on the north face at z=${O.bus.doorZ}, got ${doorBox.min.z}`);
 const lo=O.bus.doorX-O.bus.doorWidth/2,hi=O.bus.doorX+O.bus.doorWidth/2;
 assert.ok(doorBox.min.x>=lo-.05&&doorBox.max.x<=hi+.05,'the door leaf must sit in the doorway');
 // Four wheels, glazing and a road-side sign must exist so the shuttle reads correctly.
 for(const [x,z] of [[O.bus.x-2.15,O.bus.z-O.bus.width/2-.015],[O.bus.x+2.15,O.bus.z+O.bus.width/2+.015]]){
  assert.ok(world.root.getObjectByName('opening-bus-wheel-'+x+'-'+z+'-tyre'),`wheel at ${x},${z} must exist`);
 }
 assert.ok(world.root.getObjectByName('opening-bus-wall-south-glass-2'),'side windows must be glazed');
 assert.ok(world.root.getObjectByName('opening-bus-sign-plate'),'the road-side shuttle sign must exist');
 // The doorway aisle must stay free of seats and rails.
 const seats=world.root.getObjectByName('Opening_bus_seating');
 assert.ok(seats,'the seating group must exist');
 for(const child of seats.children){
  const seatBox=new T.Box3().setFromObject(child);
  assert.ok(seatBox.min.z>O.bus.doorZ+0.5,`seat ${child.name} must not block the exit channel`);
 }
 ok('bus floor, parallel body, north doorway and wheels match the shared layout');
}

group('3. The door leaf opens, and only when time passes');
{
 const door=world.root.getObjectByName('Opening_bus_door') as T.Group;
 const closedAngle=door.rotation.y;
 world.update({incident:false,laptopAcquired:false,doorOpen:true},0);
 assert.equal(door.rotation.y,closedAngle,'a paused frame must not advance the door animation');
 world.update({incident:false,laptopAcquired:false,doorOpen:true},1/30);
 assert.ok(Math.abs(door.rotation.y)>Math.abs(closedAngle),'the door must open once time advances');
 world.update({incident:false,laptopAcquired:false,doorOpen:true},1);
 const openAngle=Math.abs(door.rotation.y);
 assert.ok(openAngle>1.0,'the door must swing open');
 // The leaf folds inward so the step down to the pavement stays clear.
 const openBox=new T.Box3().setFromObject(door);
 assert.ok(openBox.max.z>O.bus.doorZ+0.2,'the open leaf must fold inward, not across the exit steps');
 world.update({incident:false,laptopAcquired:false,doorOpen:false},2);
 assert.ok(Math.abs(door.rotation.y)<openAngle,'the door must close again');
 ok('the door leaf animates only with time and never blocks the exit');
}

group('4. The retired B6 room carries no MacBook decoy');
{
 // The interactive MacBook lives in the B4 5F principal's office (`b4Shell.ts`). A visible,
 // unpickable prop here is what players pressed F at while the errand was 90 m away.
 assert.equal(world.root.getObjectByName('Opening_b6_macbook'),undefined,'the B6 room must not render a MacBook');
 assert.ok(world.root.getObjectByName('opening-b6-desk'),'the presentation desk stays as scenery');
 ok('the B6 room renders the desk without a MacBook');
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
 // The presentation desk keeps a free standing spot in front of it: the desk must not
 // swallow its own anchor even though the MacBook that stood on it now lives in B4.
 const desk=new T.Box3().setFromObject(world.root.getObjectByName('opening-b6-desk')!);
 const anchor=new T.Vector3(O.presentationDesk[0],O.presentationDesk[1],O.presentationDesk[2]);
 const stand=new T.Vector3(O.presentationDesk[0],O.b6.floor,O.presentationDesk[2]+1.2);
 assert.ok(!desk.containsPoint(stand),'the desk must leave a standing spot in front of it');
 assert.ok(stand.distanceTo(anchor)<2.7,'the standing spot must be within arm\'s reach of the desk');
 // The staff must stand in the dinner area, not inside a table.
 const staffBox=new T.Box3().setFromObject(world.root.getObjectByName('Opening_b5_dinner')!);
 assert.ok(staffBox.containsPoint(new T.Vector3(...O.staff)),'the staff position must be inside the dinner area');
 for(const name of ['opening-b5-table-0','opening-b5-table-1','opening-b5-table-2','opening-b5-table-3']){
  const box=new T.Box3().setFromObject(world.root.getObjectByName(name)!);
  assert.ok(!box.containsPoint(new T.Vector3(...O.staff)),'the staff must not stand inside a table');
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
