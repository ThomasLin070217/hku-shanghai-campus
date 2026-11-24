import assert from 'node:assert/strict';
import * as T from 'three';
import {createOpeningNPCs,OPENING_CAST} from '../src/opening/npcs';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {DINNER_LAYOUT,OPENING,dinnerHallPoint} from '../src/opening/spatialLayout';
const npcs=createOpeningNPCs(),world=createNavigation(BUILDINGS,SITE,true);
assert.equal(npcs.root.children.length,12);assert.equal(new Set(OPENING_CAST.map(a=>a.appearance.id)).size,12);
for(const spec of OPENING_CAST){
 const [x,y,z]=spec.position;assert.ok(!world.blocked(x,z,y),`${spec.appearance.id} is inside collision`);
 const actor=npcs.root.getObjectByName(spec.appearance.id)!;
 const head=actor.getObjectByName('head') as T.Mesh;
 const texture=(head.material as T.MeshStandardMaterial).map! as T.DataTexture;
 const data=texture.image.data as Uint8Array;
 const pixel=(f:number,px:number,py:number)=>{const o=((15-py)*96+f*16+px)*4;return Array.from(data.slice(o,o+3));};
 assert.deepEqual(pixel(4,4,9),[32,42,48],'front eye pupils must exist');
 assert.notDeepEqual(pixel(4,3,9),pixel(5,3,9),'face eye white must differ from rear hair');
 assert.ok(head.geometry,'reuse the shared character rig');
}
const coordinator=npcs.root.getObjectByName('opening-staff')!;
const player=new T.Vector3(OPENING.staff[0],OPENING.staff[1],OPENING.staff[2]+2);
for(let i=0;i<180;i++)npcs.update(1/60,false,false,player);
const forward=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),coordinator.rotation.y);
assert.ok(forward.dot(player.clone().sub(coordinator.position).normalize())>.999,'textured face must point toward player, not away');
// Incident. This used to assert that the cast vanished on the alert frame. The owner reported
// that as a defect (2026-11-24: 「那个任务做完，学生就会突然消失」), so the requirement is now the
// opposite: nobody disappears where they stand. The cast keeps rendering while the alert flips,
// walks out through the B5 door, and only then is each actor hidden.
const yaw=coordinator.rotation.y;
const startZ=coordinator.position.z;
npcs.update(1,true,true,new T.Vector3(0,0,0));
assert.equal(npcs.root.visible,true,'incident must not hide the cast on the alert frame');
assert.equal(coordinator.rotation.y,yaw,'a paused incident must not turn anyone');
// Nobody may walk through a dinner table on the way out. The first version of this walk-out
// sent every guest in a straight line to the door. `DINNER_LAYOUT.tables` are authored hall
// coordinates, so they have to be rotated into the world first — and the 1.2 x 5.4 footprint
// swaps axes in the rotation, exactly as the collision boxes in `navigation.ts` assume.
const tables=DINNER_LAYOUT.tables.map(([a,b])=>{
 const [x,z]=dinnerHallPoint(a,b);
 return{x0:x-DINNER_LAYOUT.tableLength/2-.25,x1:x+DINNER_LAYOUT.tableLength/2+.25,
  z0:z-DINNER_LAYOUT.tableWidth/2-.25,z1:z+DINNER_LAYOUT.tableWidth/2+.25};
});
const timeline:string[]=[];
let previousCount=npcs.root.children.filter(c=>c.visible).length;
for(let i=0;i<60*40;i++){
 npcs.update(1/60,true,false,new T.Vector3(0,0,0));
 const count=npcs.root.children.filter(c=>c.visible).length;
 assert.ok(previousCount-count<=1,`${previousCount-count} actors vanished in one frame at ${(i/60).toFixed(2)} s`);
 previousCount=count;
 if(i%120===0)timeline.push(`${count}@${Math.round(i/60)}s`);
 if(npcs.root.visible)for(const actor of npcs.root.children){
  if(!actor.visible)continue;
  const {x,z}=actor.position;
  for(const t of tables)assert.ok(!(x>t.x0&&x<t.x1&&z>t.z0&&z<t.z1),
   `${actor.name} walked through a dinner table at ${x.toFixed(2)},${z.toFixed(2)}`);
 }
}
assert.equal(npcs.root.visible,false,'everyone must have left the hall within 40 s');
assert.ok(Math.abs(coordinator.position.z-startZ)>1,'the coordinator must walk toward the door, not stand still');
for(const [index,actor] of [...npcs.root.children].entries()){
 assert.ok(Math.abs(actor.position.z-OPENING_CAST[index].position[2])>1||Math.abs(actor.position.x-OPENING_CAST[index].position[0])>1,
  `${actor.name} stood still instead of leaving`);
}
npcs.reset();
assert.equal(npcs.root.visible,true,'reset must bring the cast back');
assert.equal(coordinator.visible,true,'reset must restore every actor, not only the group');
npcs.update(1,false,true,player);assert.equal(npcs.root.visible,true);assert.equal(coordinator.rotation.y,OPENING_CAST[0].yaw);
npcs.dispose();world.dispose();console.log('PASS 12 opening NPCs: unique IDs, clear placements, existing eye pixels, face-toward-player, pause freeze, and an incident that walks the cast out instead of deleting it');
console.log('walk-out: '+timeline.join(' '));
