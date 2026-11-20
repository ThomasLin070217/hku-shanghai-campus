/** Isolated offline physical fixture; never edits a browser player or AI grant. */
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSite} from '../src/model/buildSite';
import {disposeAsset} from '../src/model/buildCampus';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {createOpeningWorld} from '../src/opening/world';
import {OPENING as O,DINNER_LAYOUT as D,dinnerHallPoint} from '../src/opening/spatialLayout';
const w=createNavigation(BUILDINGS,SITE,true),world=createOpeningWorld(),g=new CampusGame(w,BUILDINGS,SITE);
g.paused=false;g.body.position.fromArray(O.staff);g.body.grounded=true;
for(const [x,z]of [[64,-63.1],[71.2,-63.1],[71.2,-56],[79.5,-56],[79.5,-63.1],[79.5,-77.3],[71.2,-77.3],[71.2,-63.1],[61,-63.1],[58,-61.5],[58,-53]]){
 let n=0;while(Math.hypot(x-g.body.position.x,z-g.body.position.z)>.25&&n++<7000){g.yaw=Math.atan2(-(x-g.body.position.x),-(z-g.body.position.z));g.human={forward:1,right:0,sprint:false};g.step(1/120);}
 assert.ok(n<7000,`hall route blocked toward ${x},${z}: ${g.body.position.toArray()}`);
}
world.root.updateMatrixWorld(true);
assert.equal(w.obstacles.some(o=>o.name==='opening-b5-hall-side'),false,'former separating wall must be absent');
assert.equal(new T.Raycaster(new T.Vector3(71.2,1.4,-63),new T.Vector3(0,0,1),0,7).intersectObject(world.root,true).length,0,'former corridor must connect visually to the hall');
assert.equal(w.blocked(60,-72,O.b5.floor),true,'timber wall must block walking through it');
assert.equal(w.blocked(60,-60,O.b5.floor),false,'right-turn portal must be physically open');
assert.equal(w.blocked(...dinnerHallPoint(...D.tables[0]),O.b5.floor),true,'long table must be solid');
assert.ok(O.b5.clearHeight>D.archSpring+D.archRise+.1,'vault must fit inside cavity');
world.root.updateMatrixWorld(true);
const crest=world.root.getObjectByName('Opening_b5_reference_crest');assert.ok(crest,'existing reference crest must be present');
for(let i=0;i<D.tables.length;i++){
 const b=new T.Box3().setFromObject(world.root.getObjectByName('opening-b5-table-'+i)!);
 assert.ok(b.max.x-b.min.x>4*(b.max.z-b.min.z),'furniture must read as long tables');
}
// Crossing under the stair must remain on the lower plane while its upper run survives.
g.body.position.set(18,0,-49);g.body.velocity.set(0,0,0);g.body.grounded=true;
let n=0;while(g.body.position.x>-18&&n++<4000){g.yaw=Math.PI/2;g.human={forward:1,right:0,sprint:false};g.step(1/120);assert.ok(g.body.position.y<.2,'underpass must not snap onto upper stair');}
assert.ok(n<4000,'stair underpass must be crossable');assert.ok((w.support(0,-49,5)??0)>4,'upper stair must remain supported');
const site=buildSite(undefined,undefined,true);site.root.updateMatrixWorld(true);const stairs=site.root.getObjectByName('Auditorium_Grand_Stair')!;
assert.equal(new T.Raycaster(new T.Vector3(17,1.65,-49),new T.Vector3(-1,0,0),0,34).intersectObject(stairs,true).length,0,'visible stair shell must also leave the underpass open');disposeAsset(site.root);
world.dispose();w.dispose();console.log('PASS B5 observed hall: long tables, cavity clearance, solid partitions, right-turn portal interior/exit walk, lower stair passage walk and visible shell clearance');
