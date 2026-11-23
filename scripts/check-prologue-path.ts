/**
 * The prologue camera path is one continuous take through the real doorways.
 * This gate samples the same Catmull-Rom spline the cinematic samples and
 * asserts, in world coordinates:
 *
 *  - every waypoint time is ordered and the last waypoint is exactly the
 *    player's spawn pose (no camera jump when control resumes);
 *  - the camera never enters a building solid (the carved B4/B5 ground rooms
 *    and their doorway tunnels are the only allowed interior volumes);
 *  - the take really passes through the B4 doorway, the B5 doorway and the
 *    B5 lobby partition into the dinner hall;
 *  - the sampled camera keeps a finite, plausible speed and turn rate.
 *
 * The path table is plain data in src/opening/prologueTimeline.ts; this script
 * reads the recorded narration durations for its beat times, so a re-record
 * moves the samples with the lines.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {BUILDINGS} from '../src/model/campusParameters';
import {prologuePath,type PrologueWaypoint} from '../src/opening/prologueTimeline';
import {PROLOGUE_LINES,PROLOGUE_TOTAL} from '../src/opening/prologueVoice';
import {DINNER_LAYOUT as D,OPENING as O} from '../src/opening/spatialLayout';

let passed=0;
const failures:string[]=[];
function check(name:string,fn:()=>void){
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message.split('\n')[0]:String(error));}
}

/** The captured spawn camera pose: eye height on the plaza, facing Building 5. */
const SPAWN={position:[58,1.8,25] as [number,number,number],look:[58,1.8,13] as [number,number,number]};
const waypoints:PrologueWaypoint[]=prologuePath(PROLOGUE_LINES,SPAWN);
const positionCurve=new T.CatmullRomCurve3(
 waypoints.map((waypoint)=>new T.Vector3(...waypoint.position)),false,'centripetal',0.5);
const lookCurve=new T.CatmullRomCurve3(
 waypoints.map((waypoint)=>new T.Vector3(...waypoint.look)),false,'centripetal',0.5);

/** The cinematic maps its clock to the spline parameter segment by segment
 * (waypoint times are not uniformly spaced), so this gate samples the same way:
 * uniform time, not uniform parameter. */
function parameterAt(t:number):number{
 if(t<=waypoints[0].t)return 0;
 const last=waypoints.length-1;
 if(t>=waypoints[last].t)return 1;
 let index=0;
 while(index<last-1&&t>waypoints[index+1].t)index++;
 const from=waypoints[index],to=waypoints[index+1];
 const local=(t-from.t)/Math.max(1e-9,to.t-from.t);
 return (index+Math.min(1,Math.max(0,local)))/last;
}
const SAMPLES=1200;
const samples:{t:number;position:T.Vector3;look:T.Vector3}[]=[];
for(let i=0;i<=SAMPLES;i++){
 const t=(i/SAMPLES)*PROLOGUE_TOTAL,u=parameterAt(t);
 samples.push({
  t,
  position:positionCurve.getPoint(u,new T.Vector3()),
  look:lookCurve.getPoint(u,new T.Vector3()),
 });
}

type Box={name:string;x0:number;x1:number;y0:number;y1:number;z0:number;z1:number};
const box=(name:string,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number):Box=>({name,x0,x1,y0,y1,z0,z1});
const inside=(point:T.Vector3,b:Box)=>point.x>=b.x0&&point.x<=b.x1&&point.y>=b.y0&&point.y<=b.y1&&point.z>=b.z0&&point.z<=b.z1;

/** The interior volumes the world actually carves out of the towers. */
const rooms:Box[]=[
 box('B4 ground room',O.b4.x0,O.b4.x1,O.b4.floor,O.b4.floor+O.b4.clearHeight,O.b4.z0,O.b4.z1),
 // The door cut reaches out through the shell (doorDepth 2.45 m) onto the plaza.
 box('B4 doorway',O.b4.door-O.b4.doorWidth/2,O.b4.door+O.b4.doorWidth/2,O.b4.floor,O.b4.floor+O.b4.doorHeight,O.b4.z1,O.b4.z1+O.b4.doorDepth),
 box('B5 ground floor',O.b5.x0,O.b5.x1,O.b5.floor,O.b5.floor+O.b5.clearHeight,O.b5.z0,O.b5.z1),
 box('B5 doorway',O.b5.door-O.b5.doorWidth/2,O.b5.door+O.b5.doorWidth/2,O.b5.floor,O.b5.floor+O.b5.doorHeight,O.b5.z1-3.3,O.b5.z1),
];
const solids:Box[]=BUILDINGS.map((building)=>box(building.id,
 building.x-building.width/2,building.x+building.width/2,0,building.height,
 building.z-building.depth/2,building.z+building.depth/2));

check('path: one waypoint per narration beat plus the aerial and the settle',()=>{
 assert.ok(waypoints.length>=40,`only ${waypoints.length} waypoints; the one-take route needs a dense table`);
 assert.equal(waypoints[0].t,0,'the take starts at t=0');
 for(let i=1;i<waypoints.length;i++)assert.ok(waypoints[i].t>waypoints[i-1].t,`waypoint ${i} does not advance in time`);
 assert.ok(Math.abs(waypoints[waypoints.length-1].t-PROLOGUE_TOTAL)<1e-9,'the last waypoint must land on the end of the last line');
 for(const waypoint of waypoints){
  for(const value of [...waypoint.position,...waypoint.look])assert.ok(Number.isFinite(value),'every waypoint coordinate must be finite');
 }
});

check('path: the last frame is exactly the player spawn pose',()=>{
 const last=waypoints[waypoints.length-1];
 assert.deepEqual(last.position,SPAWN.position,'the camera must end at the captured spawn position');
 assert.deepEqual(last.look,SPAWN.look,'the camera must end looking 12 m ahead of the spawn');
 const forward=new T.Vector3(...SPAWN.look).sub(new T.Vector3(...SPAWN.position)).normalize();
 assert.ok(forward.z<-.99,'the spawn must face Building 5 (north, -Z)');
 assert.ok(Math.abs(forward.y)<.01,'the spawn look must be level with the eye');
});

check('path: the camera never enters a building solid',()=>{
 const hits:string[]=[];
 for(const sample of samples){
  if(rooms.some((room)=>inside(sample.position,room)))continue;
  for(const solid of solids){
   if(inside(sample.position,solid)){hits.push(`${solid.name} at t=${sample.t.toFixed(2)} (${sample.position.toArray().map((n)=>n.toFixed(1)).join(', ')})`);break;}
  }
 }
 assert.equal(hits.length,0,`${hits.length} samples clip a wall: ${hits.slice(0,4).join(' | ')}`);
});

check('path: the take passes through the B4 doorway, the B5 doorway and the B5 partition',()=>{
 const b4=rooms[1],b5=rooms[3];
 const inB4=samples.some((sample)=>inside(sample.position,b4));
 const inB5=samples.some((sample)=>inside(sample.position,b5));
 assert.ok(inB4,'the camera never crosses the B4 doorway tunnel');
 assert.ok(inB5,'the camera never crosses the B5 doorway tunnel');
 const partition=samples.filter((sample)=>
  sample.position.x>=D.partitionX-0.35&&sample.position.x<=D.partitionX+0.35&&
  sample.position.z>=D.doorZ0&&sample.position.z<=D.doorZ1&&
  sample.position.y>=O.b5.floor&&sample.position.y<=O.b5.floor+O.b5.clearHeight);
 assert.ok(partition.length>0,'the camera never crosses the B5 lobby partition opening');
 const hall=samples.filter((sample)=>
  sample.position.x>=D.partitionX+1&&sample.position.z>=O.b5.z0+1&&sample.position.z<=O.b5.z1-1&&
  sample.position.y>=O.b5.floor&&sample.position.y<=O.b5.floor+O.b5.clearHeight);
 assert.ok(hall.length>0,'the camera never enters the dinner hall');
});

check('path: every wall crossing goes through the doorway it names',()=>{
 /** The camera crosses a plane between two samples; interpolate the crossing so a
  * 0.05 s sample step cannot hide a wall clip in the doorway margins. */
 const crossings=(plane:'z'|'x',value:number)=>{
  const hits:{x:number;y:number;z:number;t:number}[]=[];
  for(let i=1;i<samples.length;i++){
   const a=samples[i-1].position,b=samples[i].position;
   const da=a[plane]-value,db=b[plane]-value;
   if(da===0||da*db>0)continue;
   const f=(value-a[plane])/(b[plane]-a[plane]);
   hits.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f,t:samples[i].t});
  }
  return hits;
 };
 for(const [name,plane,value,axis,low,high,height] of [
  ['B4 doorway','z',O.b4.z1,'x',O.b4.door-O.b4.doorWidth/2,O.b4.door+O.b4.doorWidth/2,O.b4.floor+O.b4.doorHeight] as const,
  ['B5 doorway','z',O.b5.z1,'x',O.b5.door-O.b5.doorWidth/2,O.b5.door+O.b5.doorWidth/2,O.b5.floor+O.b5.doorHeight] as const,
 ]){
  // Only crossings over the wall itself count: the camera may fly past the same
  // plane outside the building footprint (the west-side transit does exactly that).
  const wall=name.startsWith('B4')?[O.b4.x0,O.b4.x1]:[O.b5.x0,O.b5.x1];
  const hits=crossings(plane,value).filter((hit)=>hit.y>=0&&hit.y<=height&&hit[axis]>=wall[0]&&hit[axis]<=wall[1]);
  assert.ok(hits.length>=2,`the take must cross the ${name} plane in and out; found ${hits.length}`);
  for(const hit of hits){
   assert.ok(hit[axis]>=low-.05&&hit[axis]<=high+.05,
    `the ${name} crossing at t=${hit.t.toFixed(2)} is ${hit[axis].toFixed(2)} on ${axis}, outside ${low.toFixed(2)}..${high.toFixed(2)}`);
  }
 }
 const partition=crossings('x',D.partitionX).filter((hit)=>
  hit.z>=O.b5.z0&&hit.z<=O.b5.z1&&hit.y>=O.b5.floor&&hit.y<=O.b5.floor+O.b5.clearHeight);
 assert.ok(partition.length>=2,`the take must cross the B5 partition in and out; found ${partition.length}`);
 for(const hit of partition){
  assert.ok(hit.z>=D.doorZ0-.05&&hit.z<=D.doorZ1+.05,
   `the partition crossing at t=${hit.t.toFixed(2)} is z=${hit.z.toFixed(2)}, outside ${D.doorZ0}..${D.doorZ1}`);
 }
});

check('path: the sampled take keeps a plausible speed and turn rate',()=>{
 let maxSpeed=0,maxTurn=0,worstSpeed='',worstTurn='';
 const step=PROLOGUE_TOTAL/SAMPLES;
 let previous=samples[0],previousForward=samples[0].look.clone().sub(samples[0].position).normalize();
 for(let i=1;i<samples.length;i++){
  const sample=samples[i];
  const speed=sample.position.distanceTo(previous.position)/step;
  if(speed>maxSpeed){maxSpeed=speed;worstSpeed=`t=${sample.t.toFixed(2)}`;}
  const forward=sample.look.clone().sub(sample.position).normalize();
  const turn=previousForward.angleTo(forward)/step;
  if(turn>maxTurn){maxTurn=turn;worstTurn=`t=${sample.t.toFixed(2)}`;}
  previous=sample;previousForward=forward;
 }
 assert.ok(maxSpeed<36,`the camera peaks at ${maxSpeed.toFixed(1)} m/s (${worstSpeed}); the take is a swoop, not a cut`);
 assert.ok(maxTurn<6,`the camera turns at ${maxTurn.toFixed(1)} rad/s (${worstTurn}); the look target whips`);
});

check('path: the dive descends without a cut and the interior stays under the ceiling',()=>{
 const heights=samples.map((sample)=>sample.position.y);
 assert.ok(Math.max(...heights)>60,'the take must open with a high aerial');
 assert.ok(Math.min(...heights)<2.2,'the take must come down to eye level inside the rooms');
 const b4=samples.filter((sample)=>
  sample.position.x>=O.b4.x0&&sample.position.x<=O.b4.x1&&
  sample.position.z>=O.b4.z0&&sample.position.z<=O.b4.z1);
 assert.ok(b4.length>0,'the take must spend time inside the B4 ground room');
 for(const sample of b4)assert.ok(sample.position.y<O.b4.floor+O.b4.clearHeight-.05,
  `the camera clips the B4 ceiling at t=${sample.t.toFixed(2)} (y=${sample.position.y.toFixed(2)})`);
 const b5=samples.filter((sample)=>
  sample.position.x>=O.b5.x0&&sample.position.x<=O.b5.x1&&
  sample.position.z>=O.b5.z0&&sample.position.z<=O.b5.z1);
 assert.ok(b5.length>0,'the take must spend time inside the B5 dinner hall');
 for(const sample of b5)assert.ok(sample.position.y<O.b5.floor+O.b5.clearHeight-.05,
  `the camera clips the B5 ceiling at t=${sample.t.toFixed(2)} (y=${sample.position.y.toFixed(2)})`);
});

if(failures.length){console.log(`\ncheck-prologue-path: ${failures.length} failed`);process.exit(1);}
console.log(`\n${passed+failures.length} checks, 0 failed`);
