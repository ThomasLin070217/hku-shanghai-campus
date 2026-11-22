import * as T from 'three';
import {SITE} from '../model/campusParameters';
import {SPORTS_HALL} from '../model/sportsDoor';
import type {createStudentCrowd} from '../gameplay/studentCrowd';

/**
 * The sports-hall run-out: when the east door opens, the 100 students walk to
 * the gate inside the hall, through the doorway, and fan out over the plaza.
 *
 * The route and every jitter come from the placement index through the same
 * seeded generator `studentCrowd` uses (no Math.random), so two runs — and the
 * check — produce identical positions. Released students are staggered from the
 * door outward: the 12 nearest leave 0.14 s apart, the rest 0.05 s apart.
 */
export interface StudentRunoutWorld{
 /** Terrain height under (x,z), or null when a step from `fromY` is not walkable. */
 support(x:number,z:number,fromY:number):number|null;
 /** Solid at feet height `y`; `exploration/navigation.blocked` supplies this in the game. */
 blocked?:(x:number,z:number,y:number)=>boolean;
}
type Crowd=ReturnType<typeof createStudentCrowd>;

export const STUDENT_RUNOUT={
 doorX:SPORTS_HALL.x+SPORTS_HALL.eastX,      // −48.5, the plane of the east door
 doorZ:SITE.sportsZ,                          // −117
 gateX:SPORTS_HALL.x+SPORTS_HALL.eastX-1.1,   // −49.6, the last metre inside the hall
 gateHalfZ:1,
 insideSpeed:2.4,
 doorSpeed:3.4,
 firstLeavers:12,
 firstGap:.14,
 restGap:.05,
 outsideMinX:-44,
 outsideMaxX:-36,
 stopMinZ:-124,
 stopMaxZ:-110,
 /** The check counts a student outside once past this x. */
 outsideX:-47,
 bob:.04,
 movingSpeed:.05,
 decelerate:1.5,
 /** Long frames are split so a student can never skip through a wall. */
 substep:1/30,
 sourceFile:'src/campaign/studentRunout.ts',
};

type Waypoint={x:number;z:number;speed:number};
interface Student{
 index:number;x:number;z:number;y:number;yaw:number;scale:number;
 releaseTime:number;released:boolean;speed:number;phase:number;
 goal:number;stopped:boolean;route:Waypoint[];
}
export interface RunoutCounts{inside:number;outside:number;moving:number}

/** Deterministic scatter, the same generator as `src/gameplay/studentCrowd.ts`. */
function random(seed:number){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

export function createStudentRunout(crowd:Crowd,world:StudentRunoutWorld){
 const {doorX,doorZ,gateX,gateHalfZ,insideSpeed,doorSpeed,outsideMinX,outsideMaxX,stopMinZ,stopMaxZ}=STUDENT_RUNOUT;
 const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
 const students:Student[]=crowd.placements.map((placement,index)=>{
  const next=random(20261122+index*7919);
  const gateZ=clamp(placement.z,doorZ-gateHalfZ,doorZ+gateHalfZ);
  const outsideX=outsideMinX+next()*(outsideMaxX-outsideMinX)*.25;
  const outsideZ=doorZ-2+next()*4;
  const stopX=outsideMinX+2+next()*(outsideMaxX-outsideMinX-2);
  const stopZ=clamp(stopMinZ+(index+.5)/crowd.count*(stopMaxZ-stopMinZ)+(next()-.5)*.8,stopMinZ,stopMaxZ);
  return{
   index,x:placement.x,z:placement.z,y:SPORTS_HALL.floorTop,scale:placement.scale,
   yaw:placement.yaw,releaseTime:Infinity,released:false,speed:0,phase:next()*Math.PI*2,
   goal:0,stopped:false,
   route:[
    {x:gateX,z:gateZ,speed:insideSpeed},
    {x:doorX,z:gateZ,speed:doorSpeed},
    {x:outsideX,z:outsideZ,speed:doorSpeed},
    {x:stopX,z:stopZ,speed:doorSpeed},
   ],
  };
 });
 const matrices=students.map(()=>new T.Matrix4());
 const position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3(),up=new T.Vector3(0,1,0);
 let elapsed=0,releasedAll=false;

 /** True while (x,z) is not inside an obstacle at the student's feet height. */
 function free(x:number,z:number,y:number){return !world.blocked||!world.blocked(x,z,y);}
 /** Move along (ux,uz); blocked steps slide along one axis or turn tangentially
  *  (the two basketball-hoop poles sit in the hall) so nobody stops on a pole. */
 function tryStep(student:Student,ux:number,uz:number,length:number){
  const dx=ux*length,dz=uz*length;
  if(free(student.x+dx,student.z+dz,student.y)){student.x+=dx;student.z+=dz;return length;}
  if(Math.abs(ux)>=Math.abs(uz)){
   if(free(student.x+dx,student.z,student.y)){student.x+=dx;return Math.abs(dx);}
   if(free(student.x,student.z+dz,student.y)){student.z+=dz;return Math.abs(dz);}
  }else{
   if(free(student.x,student.z+dz,student.y)){student.z+=dz;return Math.abs(dz);}
   if(free(student.x+dx,student.z,student.y)){student.x+=dx;return Math.abs(dx);}
  }
  for(const turn of [Math.PI/2,-Math.PI/2,Math.PI/4,-Math.PI/4]){
   const cos=Math.cos(turn),sin=Math.sin(turn),tx=ux*cos-uz*sin,tz=ux*sin+uz*cos;
   if(free(student.x+tx*length,student.z+tz*length,student.y)){student.x+=tx*length;student.z+=tz*length;return length;}
  }
  return 0;
 }
 /** Inside the hall the feet stay on the raised floor; outside they follow the terrain. */
 function settle(student:Student){
  if(student.x<doorX){student.y=SPORTS_HALL.floorTop;return;}
  const ground=world.support(student.x,student.z,student.y+.6);
  if(ground!==null)student.y=ground;
 }
 function advance(student:Student,dt:number):boolean{
  if(student.stopped)return false;
  if(!student.released){
   if(elapsed<student.releaseTime)return false;
   student.released=true;
  }
  const waypoint=student.route[student.goal];
  if(!waypoint){student.stopped=true;student.speed=0;return true;}
  const dx=waypoint.x-student.x,dz=waypoint.z-student.z,distance=Math.hypot(dx,dz);
  const last=student.goal===student.route.length-1;
  if(distance<1e-6){
   student.goal++;if(student.goal>=student.route.length){student.stopped=true;student.speed=0;}
   return true;
  }
  // Ease out over the last 1.5 m so the crowd stops in the dispersal box.
  const speed=last?Math.min(waypoint.speed,waypoint.speed*distance/STUDENT_RUNOUT.decelerate):waypoint.speed;
  if(last&&distance<=.06){
   student.x=waypoint.x;student.z=waypoint.z;student.goal++;student.stopped=true;student.speed=0;settle(student);return true;
  }
  const fromX=student.x,fromZ=student.z;
  const moved=tryStep(student,dx/distance,dz/distance,Math.min(speed*dt,distance));
  if(moved<=1e-9){student.speed=0;return false;}
  student.speed=speed;
  student.phase+=dt*(2.6+speed*1.7);
  const vx=student.x-fromX,vz=student.z-fromZ;
  if(Math.hypot(vx,vz)>1e-9)student.yaw=Math.atan2(-vx,-vz);
  if(distance-moved<=1e-4){student.goal++;if(student.goal>=student.route.length){student.stopped=true;student.speed=0;}}
  settle(student);
  return true;
 }
 /** Rewrite every instance matrix from its placement's student state. */
 function writeMatrices(){
  for(let i=0;i<students.length;i++){
   const student=students[i];
   const bob=student.speed>STUDENT_RUNOUT.movingSpeed?STUDENT_RUNOUT.bob*Math.abs(Math.sin(student.phase)):0;
   position.set(student.x,student.y+bob,student.z);
   quaternion.setFromAxisAngle(up,student.yaw);
   scale.setScalar(student.scale);
   matrices[i].compose(position,quaternion,scale);
  }
  for(const mesh of crowd.meshes){
   const indices=mesh.userData.studentIndices as number[]|undefined;
   if(!indices)continue;
   for(let i=0;i<indices.length;i++)mesh.setMatrixAt(i,matrices[indices[i]]);
   mesh.instanceMatrix.needsUpdate=true;
  }
 }
 /** Start the run-out once; the chapter calls this from its `door_opened` latch. */
 function release(){
  if(releasedAll)return false;
  releasedAll=true;elapsed=0;
  const order=students.map(student=>({student,distance:Math.hypot(student.x-doorX,student.z-doorZ)}))
   .sort((a,b)=>a.distance-b.distance||a.student.index-b.student.index);
  order.forEach(({student},rank)=>{
   student.releaseTime=rank<STUDENT_RUNOUT.firstLeavers
    ?rank*STUDENT_RUNOUT.firstGap
    :STUDENT_RUNOUT.firstLeavers*STUDENT_RUNOUT.firstGap+(rank-STUDENT_RUNOUT.firstLeavers)*STUDENT_RUNOUT.restGap;
  });
  return true;
 }
 function update(dt:number){
  if(!releasedAll||dt<=0)return;
  let remaining=dt,changed=false;
  while(remaining>1e-9){
   const step=Math.min(remaining,STUDENT_RUNOUT.substep);
   elapsed+=step;
   for(const student of students)if(advance(student,step))changed=true;
   remaining-=step;
  }
  if(changed)writeMatrices();
 }
 function counts():RunoutCounts{
  let inside=0,outside=0,moving=0;
  for(const student of students){
   if(student.x>STUDENT_RUNOUT.outsideX)outside++;else inside++;
   if(student.speed>STUDENT_RUNOUT.movingSpeed)moving++;
  }
  return{inside,outside,moving};
 }
 return{
  counts,update,release,
  /** True once every student has reached their stop. */
  get done(){return students.every(student=>student.stopped);},
  dispose(){students.length=0;releasedAll=false;},
 };
}
export type StudentRunout=ReturnType<typeof createStudentRunout>;
