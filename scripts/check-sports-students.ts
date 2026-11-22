/**
 * Task 2 check: the 100 green-gown students wait inside the sports hall in
 * campaign mode, and run out through the east door when the lock opens.
 *
 * Headless: the real sports chapter on the real opening-mode navigation, the
 * real campaign crowd and the real run-out helper. The chapter is attached
 * directly with a stage/emit seam, the same headless path the campaign host
 * uses; no DOM.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {SPORTS_DOOR,SPORTS_HALL,sportsDoorWorld} from '../src/model/sportsDoor';
import {CROWD,createStudentCrowd,crowdPlacements} from '../src/gameplay/studentCrowd';
import {createSportsChapter} from '../src/campaign/sportsChapter';
import {STUDENT_RUNOUT,createStudentRunout} from '../src/campaign/studentRunout';
import type {ChapterContext,Explorer} from '../src/campaign/types';
import type {CampaignEvent} from '../src/campaign/state';

let passed=0;
const failures:string[]=[];
function group(name:string,fn:()=>void):void{
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.stack:String(error));}
}

const nav=createNavigation(BUILDINGS,SITE,true);
const game=new CampusGame(nav,BUILDINGS,SITE);
const doorCentre=sportsDoorWorld(SITE.sportsZ);
const OUTSIDE_X=-47;
/**
 * The brief asks for "≤20 s of 1/60 steps". With the brief's own design values
 * the last student is released at 12·0.14 + 88·0.05 = 6.03 s, then walks up to
 * 37.4 m inside the 39 m hall at 2.4 m/s (15.6 s) and 2.6 m through the door at
 * 3.4 m/s (0.8 s): 22.4 s. The cap below is the honest bound for those values;
 * it still fails if anyone walks slower or the stagger grows.
 */
const OUTSIDE_DEADLINE=24;
const REST_DEADLINE=32;

type Counts={inside:number;outside:number;moving:number;crowd:string};
type RunoutDebug={open:()=>({sudoku:boolean;password:boolean;open:boolean});runout:()=>Counts};

/** A fresh chapter on the shared navigation, attached exactly as the host attaches it. */
function makeScenario(){
 game.doors[SPORTS_DOOR.id]=false;
 nav.setDoorOpen(SPORTS_DOOR.id,false);
 const scene=new T.Scene();
 const chapter=createSportsChapter();
 const emitted:CampaignEvent[]=[];
 const ctx={
  scene,root:()=>scene,deviceId:()=>'check-sports-students',
  explorer:{game,world:nav,enabled:true} as unknown as Explorer,
  stage:()=>'sports',emit:(event:CampaignEvent)=>{emitted.push(event);return true;},
  notify:()=>{},atmosphere:()=>undefined,openPanel:()=>{},closePanel:()=>{},resume:()=>{},
  card:async()=>{},cardSettled:async()=>{},
 } as unknown as ChapterContext;
 chapter.attach(ctx);
 const debug=chapter.debug as unknown as RunoutDebug;
 return{chapter,scene,emitted,debug,open:()=>debug.open(),counts:()=>debug.runout()};
}

function crowdRootOf(scene:T.Object3D):T.Group{
 const root=scene.getObjectByName(CROWD.name);
 assert.ok(root instanceof T.Group,`the scene contains the ${CROWD.name} group`);
 return root;
}

/** Placement index → world matrix, reconstructed from the instanced meshes. */
function studentPositions(root:T.Object3D){
 const positions=new Map<number,{x:number;y:number;z:number;scale:number}>();
 const matrix=new T.Matrix4(),position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3();
 for(const mesh of root.children){
  if(!(mesh instanceof T.InstancedMesh))continue;
  const indices=mesh.userData.studentIndices as number[]|undefined;
  assert.ok(Array.isArray(indices),`${mesh.name} carries userData.studentIndices`);
  assert.equal(indices!.length,mesh.count,`${mesh.name}: one placement index per instance`);
  for(let i=0;i<mesh.count;i++){
   const index=indices![i];
   assert.ok(Number.isInteger(index)&&index>=0&&index<CROWD.count,`${mesh.name}[${i}] maps to a placement index`);
   mesh.getMatrixAt(i,matrix);matrix.decompose(position,quaternion,scale);
   const previous=positions.get(index);
   if(previous){
    // Each student is drawn twice (atlas body + flat-colour parts): both instances must agree.
    assert.ok(Math.hypot(previous.x-position.x,previous.z-position.z)<1e-6,`placement ${index} is drawn at one position`);
   }else positions.set(index,{x:position.x,y:position.y,z:position.z,scale:scale.x});
  }
 }
 assert.equal(positions.size,CROWD.count,`${CROWD.count} students are drawn`);
 return positions;
}

group('(a) the 100 students wait inside the hall when the chapter attaches',()=>{
 const s=makeScenario();
 const positions=studentPositions(crowdRootOf(s.scene));
 for(const [index,p] of positions){
  assert.ok(p.x>SPORTS_HALL.x-SPORTS_HALL.width/2&&p.x<SPORTS_HALL.x+SPORTS_HALL.width/2,`student ${index} x ${p.x.toFixed(2)} is inside the hall`);
  assert.ok(p.z>SITE.sportsZ-SPORTS_HALL.depth/2&&p.z<SITE.sportsZ+SPORTS_HALL.depth/2,`student ${index} z ${p.z.toFixed(2)} is inside the hall`);
  assert.ok(Math.abs(p.y-SPORTS_HALL.floorTop)<1e-6,`student ${index} stands on the hall floor (y ${p.y.toFixed(3)})`);
  assert.equal(nav.blocked(p.x,p.z,p.y),false,`student ${index} at ${p.x.toFixed(2)},${p.z.toFixed(2)} is not in a wall`);
 }
 assert.deepEqual(s.counts(),{inside:100,outside:0,moving:0,crowd:CROWD.name});
 assert.ok(doorCentre.x>SPORTS_HALL.x,'the door is on the east wall');
 s.chapter.detach();
 assert.equal(s.scene.getObjectByName(CROWD.name),undefined,'detach removes the crowd from the world');
});

group('(b) createStudentCrowd returns the placements and one index per instance',()=>{
 const crowd=createStudentCrowd();
 try{
  assert.equal(crowd.placements.length,CROWD.count,`${CROWD.count} placements are returned`);
  assert.deepEqual(crowd.placements,crowdPlacements(),'the returned seats are the exact placement array');
  const all=new Set<number>();
  for(const mesh of crowd.meshes){
   assert.ok(Array.isArray(mesh.userData.studentIndices),`${mesh.name} carries studentIndices`);
   const indices=mesh.userData.studentIndices as number[];
   assert.equal(new Set(indices).size,indices.length,`${mesh.name} lists each placement once`);
   for(const index of indices)all.add(index);
  }
  assert.deepEqual([...all].sort((a,b)=>a-b),Array.from({length:CROWD.count},(_,i)=>i),'together the meshes cover every placement');
  // The brief's numbers, locked: gate −49.6, door −48.5, 2.4 inside, 3.4 at the door,
  // 12 students 0.14 s apart and the rest 0.05 s apart.
  assert.equal(STUDENT_RUNOUT.doorX,doorCentre.x);
  assert.equal(STUDENT_RUNOUT.doorZ,doorCentre.z);
  assert.equal(STUDENT_RUNOUT.gateX,-49.6);
  assert.equal(STUDENT_RUNOUT.insideSpeed,2.4);
  assert.equal(STUDENT_RUNOUT.doorSpeed,3.4);
  assert.equal(STUDENT_RUNOUT.firstLeavers,12);
  assert.equal(STUDENT_RUNOUT.firstGap,0.14);
  assert.equal(STUDENT_RUNOUT.restGap,0.05);
 }finally{crowd.dispose();}
});

group('(c) the door latch emits door_opened once and releases the students',()=>{
 const s=makeScenario();
 assert.deepEqual(s.open(),{sudoku:true,password:true,open:true},'the puzzle answers open the lock');
 assert.deepEqual(s.emitted,[],'the lock itself emits nothing; the chapter latch owns the event');
 s.chapter.update(1/60);
 assert.deepEqual(s.emitted,['door_opened']);
 assert.equal(game.doors[SPORTS_DOOR.id],true,'the door state is open');
 assert.deepEqual(s.counts(),{inside:100,outside:0,moving:1,crowd:CROWD.name},'the nearest student leaves immediately; the 0.14 s stagger holds the next');
 s.chapter.update(1/60);
 assert.deepEqual(s.emitted,['door_opened'],'a second frame does not emit again');
 s.chapter.detach();
});

group('(d) every student runs out, stays out of walls, and stops in the dispersal box',()=>{
 const s=makeScenario();
 s.open();
 s.chapter.update(1/60);
 let time=1/60,frames=1,outsideAt=-1,restAt=-1;
 while(time<REST_DEADLINE){
  s.chapter.update(1/60);time+=1/60;frames++;
  if(frames%5===0){
   for(const [index,p] of studentPositions(crowdRootOf(s.scene))){
    assert.equal(nav.blocked(p.x,p.z,p.y),false,`student ${index} is in a wall at ${time.toFixed(2)} s (${p.x.toFixed(2)},${p.z.toFixed(2)})`);
    if(p.x<STUDENT_RUNOUT.doorX)assert.ok(p.y>=SPORTS_HALL.floorTop-1e-6,`student ${index} keeps feet on the hall floor at ${time.toFixed(2)} s (y ${p.y.toFixed(3)})`);
    else assert.ok(p.y>=0.13-1e-6,`student ${index} stands on the terrain outside at ${time.toFixed(2)} s (y ${p.y.toFixed(3)})`);
   }
  }
  const counts=s.counts();
  if(outsideAt<0&&counts.outside===CROWD.count)outsideAt=time;
  if(outsideAt>=0&&counts.moving===0){restAt=time;break;}
 }
 assert.ok(outsideAt>0,`all ${CROWD.count} students are outside by ${OUTSIDE_DEADLINE} s (not yet at ${REST_DEADLINE} s)`);
 assert.ok(outsideAt<=OUTSIDE_DEADLINE,`all ${CROWD.count} students are outside at ${outsideAt.toFixed(2)} s`);
 assert.ok(restAt>0,`the crowd comes to rest by ${REST_DEADLINE} s (${s.counts().outside} outside, ${s.counts().moving} still moving)`);
 const final=studentPositions(crowdRootOf(s.scene));
 for(const [index,p] of final){
  assert.ok(p.x>=-44-1e-6&&p.x<=-36+1e-6,`student ${index} stops inside the dispersal box x [−44,−36] (${p.x.toFixed(2)})`);
  assert.ok(p.z>=-124-1e-6&&p.z<=-110+1e-6,`student ${index} stops inside the dispersal box z [−124,−110] (${p.z.toFixed(2)})`);
  assert.ok(p.x>OUTSIDE_X,`student ${index} ends outside the hall (${p.x.toFixed(2)})`);
 }
 assert.deepEqual(s.counts(),{inside:0,outside:100,moving:0,crowd:CROWD.name});
 s.chapter.detach();
});

group('(e) release() is idempotent',()=>{
 const aCrowd=createStudentCrowd(),bCrowd=createStudentCrowd();
 const a=createStudentRunout(aCrowd,nav),b=createStudentRunout(bCrowd,nav);
 try{
  assert.deepEqual(a.counts(),{inside:100,outside:0,moving:0},'before release everyone is seated inside');
  a.release();a.release();b.release();
  for(let i=0;i<420;i++){a.update(1/60);b.update(1/60);}
  assert.deepEqual(a.counts(),b.counts(),'a double release simulates exactly like a single release');
  const pa=studentPositions(aCrowd.root),pb=studentPositions(bCrowd.root);
  for(const [index,p] of pa){
   const q=pb.get(index)!;
   assert.ok(Math.abs(p.x-q.x)<1e-9&&Math.abs(p.y-q.y)<1e-9&&Math.abs(p.z-q.z)<1e-9,`student ${index} ends at the same point`);
  }
 }finally{a.dispose();b.dispose();aCrowd.dispose();bCrowd.dispose();}
});

if(failures.length){
 console.error(`\ncheck-sports-students: ${failures.length} failing group(s): ${failures.join(', ')}`);
 process.exit(1);
}
console.log(`\ncheck-sports-students: ${passed} groups passed`);
