/**
 * The plaza crowd's state machine, pure: where each student stands, whether the crowd is shown,
 * whether it is walking, and whether the instance matrices must be re-baked this frame.
 *
 * Extracted from `experience.ts` on 2026-11-25 (review D4). The bug that made every student
 * vanish after the MacBook mission lived in that untested block: no gate ran the shipped crowd
 * code, so mutations that never showed the crowd, collapsed finished students, or let the stage
 * own visibility all passed. The parts that decide those outcomes live here now, with the story
 * stage, the clock and the floor query injected, so `check-opening-crowd-gate.ts` can run the
 * same code the game runs.
 *
 * The rule the owner asked for: the stage never decides whether the crowd EXISTS — only whether
 * it is on screen. From `crowd` the students stand on the plaza; from `to_b5` on they walk, the
 * latch stays on through every later stage, and each student leaves only by reaching the end of
 * their own route (`crowdWalk.ts`). A restored run finds them standing at `crowd` and arrived at
 * every later stage.
 */
import {crowdWalkGate,crowdRestoredAt} from './crowdWalk';

export interface CrowdSeat{x:number;z:number;yaw:number;scale:number}
export interface CrowdWaypoint{x:number;z:number}
export type CrowdRoute=readonly CrowdWaypoint[];

export interface CrowdStudent{
 x:number;y:number;z:number;
 /** Index into the student's own route of the waypoint being walked to. */
 target:number;
 speed:number;
 /** Walk-cycle phase; the renderer bobs a walking student by it. */
 phase:number;
 scale:number;
 yaw:number;
 done:boolean;
}

export interface CrowdDirectorOptions{
 seats:readonly CrowdSeat[];
 /** One route per seat; its last point is where that student stands for the rest of the chapter. */
 routes:readonly CrowdRoute[];
 /** Which waypoint a student joins the route at, from their seat. */
 startTarget:(seat:{x:number;z:number})=>number;
 /** The tick-free ground (`crowdWorld(...).support`); never the player's `support`. */
 floorAt:(x:number,z:number)=>number|null;
 /** Height used when the world has no floor under a student. */
 fallbackY?:number;
}

export interface CrowdFrame{
 shown:boolean;
 walking:boolean;
 /** True when the instance matrices must be rebuilt with the current student positions. */
 bake:boolean;
}

export interface CrowdDirector{
 students:CrowdStudent[];
 frame(stage:string,dt:number):CrowdFrame;
 reset(stage:string):void;
 readonly walking:boolean;
 readonly baked:boolean;
}

export function createCrowdDirector(options:CrowdDirectorOptions):CrowdDirector{
 const {seats,routes,startTarget,floorAt,fallbackY=.08}=options;
 if(routes.length!==seats.length)throw new Error(`one route per seat: ${routes.length} routes for ${seats.length} seats`);
 const yOf=(x:number,z:number)=>{const h=floorAt(x,z);return h===null?fallbackY:h;};
 const students:CrowdStudent[]=seats.map((seat,index)=>({
  x:seat.x,y:yOf(seat.x,seat.z),z:seat.z,target:startTarget(seat),
  speed:1.05+((index*37)%17)/17*.55,phase:(index*.618)%1,scale:seat.scale,yaw:seat.yaw,done:false,
 }));
 let walking=false,baked=false;
 function reset(stage:string){
  const arrived=crowdRestoredAt(stage)==='arrived';
  walking=arrived;
  for(let index=0;index<students.length;index++){
   const s=students[index]!,seat=seats[index]!,route=routes[index]!;
   const end=route[route.length-1];
   // Back on the plaza seat, facing the way the seat faces, joining the route again:
   // a reset that kept the old route index would send a student 100 m backwards.
   s.target=startTarget(seat);s.done=arrived;
   if(arrived&&end){s.x=end.x;s.z=end.z;s.yaw=Math.PI;}
   else{s.x=seat.x;s.z=seat.z;s.yaw=seat.yaw;}
   s.y=yOf(s.x,s.z);
  }
  baked=false;
 }
 function frame(stage:string,dt:number):CrowdFrame{
  const gate=crowdWalkGate(stage);
  if(gate.walking)walking=true;
  let moved=false;
  if(dt>0&&walking){
   for(let index=0;index<students.length;index++){
    const s=students[index]!;
    if(s.done)continue;
    const route=routes[index]!;
    const waypoint=route[s.target];
    // The end of the route: the student is a guest now and stays there. Nobody is removed.
    if(!waypoint){s.done=true;moved=true;continue;}
    const dx=waypoint.x-s.x,dz=waypoint.z-s.z,d=Math.hypot(dx,dz);
    if(d<.22){
     /* Snap to the waypoint before leaving it. Stopping up to .22 m short of the last one
      * would leave the student off the place the arrival check cleared — inside a chair or a
      * table edge, by exactly the tolerance. */
     s.x=waypoint.x;s.z=waypoint.z;s.y=yOf(s.x,s.z);
     s.target++;if(s.target>=route.length)s.done=true;moved=true;continue;
    }
    const step=Math.min(d,s.speed*dt);
    s.x+=dx/d*step;s.z+=dz/d*step;s.y=yOf(s.x,s.z);s.phase+=step*.9;
    const want=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(want-s.yaw),Math.cos(want-s.yaw));
    s.yaw+=delta*Math.min(1,dt*6);
    moved=true;
   }
  }
  /* Bake whenever the crowd is shown and has never been baked: at the `crowd` stage the
   * students are not walking yet, and the old early return left the instances on their
   * build-time matrices, 18-30 cm above the plaza floor (review D3). Also bake whenever
   * a student moved. */
  const bake=moved||(gate.shown&&!baked);
  if(bake)baked=true;
  return{shown:gate.shown,walking,bake};
 }
 return{
  students,frame,reset,
  get walking(){return walking},
  get baked(){return baked},
 };
}
