/** Thomas opening: red-eye security robot.
 *
 * Local finite state machine for one encounter only: slow patrol -> red-eye scan ->
 * confirmed chase -> search of the last known position -> patrol. It never learns the
 * player position behind cover, it moves with the shared CharacterPhysics/Navigation
 * stack, and there is no damage system at all, so the player cannot attack it.
 *
 * Caller contract (already written by the integrator, see src/opening/experience.ts):
 *   const robot = createOpeningRobot(explorer.world);
 *   scene.add(robot.root);
 *   robot.update(dt, playerPosition, active, false);    // fixed physics tick
 *   robot.update(0, playerPosition, active && ..., true); // render read, no simulation
 * dt <= 0 or paused must never advance detection, timers or lastSeen and must never
 * move the robot; only reset() restores the initial patrol.
 */
import * as T from 'three';
import {CharacterPhysics} from '../exploration/physics';
import {EXPLORATION as C} from '../exploration/config';
import {OPENING as O} from './spatialLayout';
import type {Navigation} from '../exploration/navigation';

const DEG=Math.PI/180;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const headingTo=(dx:number,dz:number)=>Math.atan2(-dx,-dz);
const turnToward=(yaw:number,target:number,rate:number)=>{const d=wrap(target-yaw);return Math.abs(d)<=rate?target:yaw+Math.sign(d)*rate;};

export type OpeningRobotState='patrol'|'scanning'|'chase'|'search'|'caught';
/** Alias kept for callers that used the shorter name. */
export type RobotState=OpeningRobotState;
export interface OpeningRobotUpdate{caught:boolean;state:OpeningRobotState;warning:number}
/** Alias kept for callers that used the shorter name. */
export type RobotResult=OpeningRobotUpdate;

export interface OpeningRobotParams{
 /** Ground speed while patrolling, m/s. The player walks at 2.6 m/s, so this stays slower. */
 patrolSpeed:number;
 /** Ground speed while chasing a confirmed target, m/s. */
 chaseSpeed:number;
 /** Ground speed while walking to the last known position, m/s. */
 searchSpeed:number;
 /** Maximum eye-to-chest distance that can be detected, metres. */
 range:number;
 /** Half angle of the red-eye sector, radians. */
 halfAngle:number;
 /** Continuous visibility needed before a target counts as confirmed, seconds. */
 confirm:number;
 /** Horizontal distance needed to catch the player, metres. */
 capture:number;
 /** Allowed foot height difference for a capture, metres. */
 captureRise:number;
 /** Height of the robot eye above its feet, metres. */
 eyeHeight:number;
 /** Height of the player torso used as the detection target, metres. */
 chestHeight:number;
 /** Peak head sweep while idling at a waypoint, radians. */
 sweep:number;
 /** Head sweep speed, radians per second. */
 sweepRate:number;
 /** Eye spin while searching in place, radians per second. */
 spinRate:number;
 /** Arrival radius while chasing, metres. */
 reach:number;
 /** Arrival radius at a patrol waypoint, metres. */
 patrolReach:number;
 /** Time without progress before a leg counts as blocked, seconds. */
 stall:number;
 /** Route re-plan interval, seconds. */
 replan:number;
 /** Re-plans allowed for one leg before it is abandoned. */
 maxReplans:number;
 /** How long the robot searches the last known position, seconds. */
 searchSeconds:number;
 /** Body turn rate, radians per second. */
 turnRate:number;
 /** Minimum chase time before a capture is allowed, seconds. */
 captureGrace:number;
 /** Pause at every patrol waypoint while sweeping the sector, seconds. */
 patrolDwell:number;
 /** Arrival radius for intermediate graph waypoints, metres. */
 waypointRadius:number;
 /** Length of the drawn scan sector, metres. */
 scanVisualRange:number;
 /** Rays used to shorten the drawn sector against walls. */
 scanSamples:number;
 /** Height of the drawn sector above the floor, metres. */
 scanVisualHeight:number;
 /** Height used for the sector probes, metres. Low kerbs shorten the sector too. */
 scanProbeHeight:number;
}

/** Single tunable table. Mutating it at runtime is picked up on the next tick. */
export const ROBOT:OpeningRobotParams={
 patrolSpeed:1.25,
 chaseSpeed:1.35,
 searchSpeed:1.2,
 range:9,
 halfAngle:35*DEG,
 confirm:0.7,
 capture:0.65,
 captureRise:0.9,
 eyeHeight:1.05,
 chestHeight:1.15,
 sweep:50*DEG,
 sweepRate:42*DEG,
 spinRate:1.2,
 reach:0.5,
 patrolReach:0.55,
 stall:1.2,
 replan:0.35,
 maxReplans:3,
 searchSeconds:3,
 turnRate:4.2,
 captureGrace:0.25,
 patrolDwell:1.2,
 waypointRadius:0.45,
 scanVisualRange:9,
 scanSamples:11,
 // Drawn in the same plane the occlusion rays use, so a shortened wedge cannot poke past a surface.
 scanVisualHeight:0.3,
 scanProbeHeight:0.3,
};

/** Descriptive alias for the same live table. */
export const OPENING_ROBOT_PARAMS:OpeningRobotParams=ROBOT;

const sharedRay=new T.Raycaster();

/** Shared wall test: thick walls block the eye-to-chest line, low kerbs do not. */
export function openingRobotLineClear(world:Navigation,from:T.Vector3,to:T.Vector3):boolean{
 const offset=to.clone().sub(from),distance=offset.length();
 if(distance<0.001)return true;
 sharedRay.set(from,offset.divideScalar(distance));
 sharedRay.near=0.02;
 sharedRay.far=Math.max(0.04,distance-0.06);
 return sharedRay.intersectObjects(world.meshes,false).length===0;
}

interface GraphNode{x:number;z:number;y:number;name:string}
export interface GraphEdge{from:number;to:number;walked:boolean;seconds:number}
interface Graph{nodes:GraphNode[];links:number[][];edges:GraphEdge[]}

/**
 * Small waypoint graph around Building 5. Every candidate edge is proven by a real
 * CharacterPhysics walk before it is allowed, so the robot never plans through a wall.
 */
const graphCache=new WeakMap<Navigation,Graph>();
function graphFor(world:Navigation):Graph{
 const cached=graphCache.get(world);
 if(cached)return cached;
 const nodes:GraphNode[]=[];
 const add=(x:number,z:number,name:string)=>{
  if(nodes.some(n=>Math.abs(n.x-x)<0.01&&Math.abs(n.z-z)<0.01))return;
  nodes.push({x,z,y:world.support(x,z,C.maxStep)??0,name});
 };
 for(const [x,,z] of O.patrol)add(x,z,'patrol');
 add(O.b5.door,O.b5.z1+2.3,'b5-door-out');
 add(O.b5.door,O.b5.z1-1.9,'b5-door-in');
 add(O.staff[0],O.staff[2],'b5-staff');
 const links:number[][]=nodes.map(()=>[]);
 const edges:GraphEdge[]=[];
 const probe=new CharacterPhysics(world);
 const walkable=(a:number,b:number)=>{
  const goal=nodes[b];
  probe.position.set(nodes[a].x,nodes[a].y,nodes[a].z);
  probe.velocity.set(0,0,0);probe.grounded=true;
  let yaw=headingTo(goal.x-probe.position.x,goal.z-probe.position.z);
  let best=Number.POSITIVE_INFINITY,still=0,seconds=0;
  for(let i=0;i<1800;i++){
   yaw=turnToward(yaw,headingTo(goal.x-probe.position.x,goal.z-probe.position.z),ROBOT.turnRate/60);
   probe.step(1/60,{forward:ROBOT.chaseSpeed/C.speed,right:0,sprint:false},yaw,false);
   seconds+=1/60;
   const gap=Math.hypot(goal.x-probe.position.x,goal.z-probe.position.z);
   if(gap<=ROBOT.waypointRadius)return{ok:true,seconds};
   if(gap<best-0.04){best=gap;still=0;}else if(++still>90)return{ok:false,seconds};
  }
  return{ok:false,seconds};
 };
 const pair=(ax:number,az:number,bx:number,bz:number)=>{
  const a=nodes.findIndex(n=>Math.abs(n.x-ax)<0.01&&Math.abs(n.z-az)<0.01);
  const b=nodes.findIndex(n=>Math.abs(n.x-bx)<0.01&&Math.abs(n.z-bz)<0.01);
  if(a<0||b<0||a===b||links[a].includes(b))return;
  const result=walkable(a,b);
  edges.push({from:a,to:b,walked:result.ok,seconds:Math.round(result.seconds*100)/100});
  if(!result.ok)return;
  links[a].push(b);links[b].push(a);
 };
 const ring=O.patrol.map(p=>[p[0],p[2]] as [number,number]);
 for(let i=0;i<ring.length;i++)pair(ring[i][0],ring[i][1],ring[(i+1)%ring.length][0],ring[(i+1)%ring.length][1]);
 const doorOut=nodes.findIndex(n=>n.name==='b5-door-out');
 const doorIn=nodes.findIndex(n=>n.name==='b5-door-in');
 const staff=nodes.findIndex(n=>n.name==='b5-staff');
 if(doorOut>=0&&doorIn>=0)pair(nodes[doorOut].x,nodes[doorOut].z,nodes[doorIn].x,nodes[doorIn].z);
 // The doorway must work in both directions: link the outside of the door back to the
 // outside patrol points, otherwise the first cycle strands the robot inside the hall.
 if(doorOut>=0)pair(nodes[doorOut].x,nodes[doorOut].z,O.patrol[1][0],O.patrol[1][2]);
 if(doorOut>=0)pair(nodes[doorOut].x,nodes[doorOut].z,O.patrol[0][0],O.patrol[0][2]);
 if(doorIn>=0)pair(nodes[doorIn].x,nodes[doorIn].z,O.patrol[2][0],O.patrol[2][2]);
 if(doorIn>=0&&staff>=0)pair(nodes[doorIn].x,nodes[doorIn].z,nodes[staff].x,nodes[staff].z);
 if(staff>=0)pair(nodes[staff].x,nodes[staff].z,O.patrol[3][0],O.patrol[3][2]);
 const graph:Graph={nodes,links,edges};
 graphCache.set(world,graph);
 return graph;
}

export interface OpeningRobot{
 root:T.Group;
 update(dt:number,player:T.Vector3,active:boolean,paused:boolean):OpeningRobotUpdate;
 reset():void;
 dispose():void;
 /** Feet position of the robot body, same convention as the player body position. */
 readonly position:T.Vector3;
 readonly state:OpeningRobotState;
 readonly warning:number;
 /** Diagnostics for the offline checks; gameplay still flows through update(). */
 readonly diagnostics:OpeningRobotDiagnostics;
}

export interface OpeningRobotDiagnostics{
 state:OpeningRobotState;
 caught:boolean;
 warning:number;
 position:[number,number,number];
 lastSeen:[number,number,number]|null;
 visible:boolean;
 seenTime:number;
 searchClock:number;
 patrolIndex:number;
 heading:number;
 headOffset:number;
 /** Contacts reported by the shared integrator on the last physics step. */
 contacts:('wall'|'ceiling'|'landed'|'boundary')[];
 /** Routing internals, read by scripts/check-opening-robot.ts. */
 routing:{usedGraph:boolean;stalls:number;abandoned:boolean};
 goal:[number,number,number]|null;
 route:[number,number][];
 graph:GraphEdge[];
 graphNodes:[number,number,string][];
}

export function createOpeningRobot(world:Navigation):OpeningRobot{
 const graph=graphFor(world);
 const body=new CharacterPhysics(world);
 const ray=new T.Raycaster();
 const eye=new T.Vector3();
 const scratch=new T.Vector3();
 const wedgeOrigin=new T.Vector3(),wedgeDirection=new T.Vector3();

 // ---------- model: original blocky security unit, ~1.4 m, red eye, visible scan sector ----------
 const root=new T.Group();root.name='opening-security-robot';
 const rig=new T.Group();rig.name='opening-security-robot-rig';root.add(rig);
 const turret=new T.Group();turret.name='opening-security-robot-turret';rig.add(turret);
 const geometries:T.BufferGeometry[]=[];const materials:T.Material[]=[];
 const material=(color:number,roughness=.72,metalness=.2,emissive=0,emissiveIntensity=0)=>{
  const m=new T.MeshStandardMaterial({color,roughness,metalness});
  if(emissive){m.emissive.setHex(emissive);m.emissiveIntensity=emissiveIntensity;}
  materials.push(m);return m;
 };
 const box=(w:number,h:number,d:number,mat:T.Material,name:string,parent:T.Object3D=rig,x=0,y=0,z=0)=>{
  const g=new T.BoxGeometry(w,h,d);geometries.push(g);
  const m=new T.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const shell=material(0x39424a,.74,.24);
 const dark=material(0x1d2328,.9,.1);
 const trim=material(0xb7c1c6,.45,.4);
 const accent=material(0x13714f,.62,.15);
 const eyeMat=material(0x2a0b0b,.35,.1,0xff2b2b,1.4);
 const lampMat=material(0x3a1010,.4,.1,0xff4a30,.9);
 const beamMat=new T.MeshBasicMaterial({color:0xff3b30,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false});
 materials.push(beamMat);
 box(.58,.26,.52,dark,'robot-treads',rig,0,.13,0);
 box(.54,.62,.42,shell,'robot-torso',rig,0,.57,0);
 box(.56,.09,.44,accent,'robot-band',rig,0,.68,0);
 box(.62,.09,.46,trim,'robot-shoulder',rig,0,.93,0);
 box(.1,.3,.3,trim,'robot-pod-left',rig,-.33,.6,0);
 box(.1,.3,.3,trim,'robot-pod-right',rig,.33,.6,0);
 box(.16,.1,.16,trim,'robot-neck',rig,0,1.0,0);
 box(.4,.26,.34,shell,'robot-skull',turret,0,.13,0);
 box(.26,.09,.06,eyeMat,'opening-robot-eye',turret,0,.14,-.17);
 box(.42,.04,.06,trim,'robot-brow',turret,0,.27,-.09);
 box(.04,.16,.04,trim,'robot-mast',turret,.13,.36,.02);
 box(.07,.07,.07,lampMat,'robot-beacon',turret,.13,.46,.02);
 const sectorCount=Math.max(5,ROBOT.scanSamples);
 const sectorGeometry=new T.BufferGeometry();
 const sectorPositions=new Float32Array((sectorCount+1)*3);
 sectorGeometry.setAttribute('position',new T.BufferAttribute(sectorPositions,3));
 const sectorIndices:number[]=[];
 for(let i=0;i<sectorCount-1;i++)sectorIndices.push(0,i+1,i+2);
 sectorGeometry.setIndex(sectorIndices);
 geometries.push(sectorGeometry);
 const sector=new T.Mesh(sectorGeometry,beamMat);sector.name='opening-robot-scan-sector';sector.frustumCulled=false;sector.renderOrder=2;root.add(sector);

 // ---------- authoritative state ----------
 let state:OpeningRobotState='patrol';
 let caught=false,warning=0,seenTime=0,searchClock=0,scanClock=0;
 let patrolIndex=1,moveYaw=0,scanYaw=0,routeClock=0,progressClock=0,progressBest=Number.POSITIVE_INFINITY;
 let dwell=0,chaseClock=0,visibleNowCache=false;
 let routeUsedGraph=false,legStalls=0,legAbandoned=false;
 let route:{x:number;z:number}[]=[];
 const lastSeen=new T.Vector3();
 /** Where the body was when the current stall window opened; travel since then is real progress. */
 const progressAnchor=new T.Vector3();
 let hasLastSeen=false;

 const nodeNearest=(x:number,z:number)=>{
  let best=-1,bestD=Number.POSITIVE_INFINITY;
  for(let i=0;i<graph.nodes.length;i++){const d=Math.hypot(graph.nodes[i].x-x,graph.nodes[i].z-z);if(d<bestD){bestD=d;best=i;}}
  return best;
 };
 const shortestNodes=(from:number,to:number)=>{
  if(from<0||to<0)return null;
  if(from===to)return[from];
  const cost=graph.nodes.map(()=>Number.POSITIVE_INFINITY),prev=graph.nodes.map(()=>-1),seen=graph.nodes.map(()=>false);
  cost[from]=0;
  for(;;){
   let u=-1,uCost=Number.POSITIVE_INFINITY;
   for(let i=0;i<cost.length;i++)if(!seen[i]&&cost[i]<uCost){uCost=cost[i];u=i;}
   if(u<0||u===to)break;
   seen[u]=true;
   for(const v of graph.links[u]){const next=uCost+Math.hypot(graph.nodes[u].x-graph.nodes[v].x,graph.nodes[u].z-graph.nodes[v].z);if(next<cost[v]){cost[v]=next;prev[v]=u;}}
  }
  if(!Number.isFinite(cost[to]))return null;
  const path:number[]=[];
  for(let i=to;i>=0;i=prev[i]){path.unshift(i);if(i===from)break;}
  return path[0]===from?path:null;
 };

 /** Navigation-level corridor check; the physics walk in graphFor() proves the same edges. */
 function segmentClear(ax:number,az:number,bx:number,bz:number):boolean{
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
  if(len<1e-3)return true;
  const probe=body.position.y;
  const steps=Math.max(2,Math.ceil(len/.25));
  for(let i=1;i<=steps;i++){
   const t=i/steps,x=ax+dx*t,z=az+dz*t;
   const h=world.support(x,z,probe+C.maxStep);
   if(h===null)return false;
   if(h>probe+C.maxStep+.001||h<probe-C.maxDrop-.001)return false;
   if(world.blocked(x,z,h))return false;
  }
  return true;
 }

 /** Straight line only when the navigation proves it, otherwise the verified waypoint graph. */
 const planRoute=(goalX:number,goalZ:number,preferGraph:boolean):'straight'|'graph'|'direct'=>{
  const here=body.position;
  if(!preferGraph&&segmentClear(here.x,here.z,goalX,goalZ)){route=[{x:goalX,z:goalZ}];return 'straight';}
  // A mid-leg re-plan has to continue forwards. Anchoring the search on the robot itself
  // would pick the nearest node, which sits behind the body once it has passed it, and the
  // robot would turn around on every re-plan. Anchor on the waypoint being followed instead.
  const anchor=preferGraph&&route.length?route[0]:here;
  const a=nodeNearest(anchor.x,anchor.z),b=nodeNearest(goalX,goalZ),nodes=shortestNodes(a,b);
  if(nodes&&nodes.length){
   const path=nodes.map(i=>({x:graph.nodes[i].x,z:graph.nodes[i].z}));
   const tail={x:goalX,z:goalZ};
   route=Math.hypot(path[0].x-here.x,path[0].z-here.z)<0.4?path.slice(1).concat([tail]):path.concat([tail]);
   return 'graph';
  }
  // No proven corridor exists to that goal: keep the direct attempt, but the stall budget below abandons it.
  route=[{x:goalX,z:goalZ}];
  return 'direct';
 };

 const steer=(goal:{x:number;z:number},reach:number,speed:number,dt:number)=>{
  const dx=goal.x-body.position.x,dz=goal.z-body.position.z,distance=Math.hypot(dx,dz);
  if(distance<=reach)return true;
  moveYaw=turnToward(moveYaw,headingTo(dx,dz),ROBOT.turnRate*dt);
  body.step(dt,{forward:speed/C.speed,right:0,sprint:false},moveYaw,false);
  return false;
 };
 /** Follows the current route. True on arrival, and also when the leg is abandoned after repeated stalls. */
 const following=(goalX:number,goalZ:number,reach:number,speed:number,dt:number)=>{
  routeClock-=dt;
  legAbandoned=false;
  if(!route.length||routeClock<=0){routeUsedGraph=planRoute(goalX,goalZ,routeUsedGraph)!=='straight';routeClock=ROBOT.replan;}
  let arrived=false;
  while(route.length){
   arrived=steer(route[0],reach,speed,dt);
   if(!arrived)break;
   route.shift();
  }
  if(!arrived){
   // Progress is measured on the point actually being steered at, plus real displacement, so a longer
   // verified detour is never mistaken for being stuck; only a body that goes nowhere counts as grinding.
   const steerTarget=route.length?route[0]:{x:goalX,z:goalZ};
   const gap=Math.hypot(steerTarget.x-body.position.x,steerTarget.z-body.position.z);
   if(gap<progressBest-0.03){progressBest=gap;progressClock=0;progressAnchor.copy(body.position);}
   else if((progressClock+=dt)>ROBOT.stall){
    progressClock=0;routeClock=0;
    if(Math.hypot(body.position.x-progressAnchor.x,body.position.z-progressAnchor.z)>0.4){
     // The body travelled: keep walking instead of treating a detour as a blocked leg.
     progressAnchor.copy(body.position);progressBest=gap;
    }else{
     route=[];
     if(routeUsedGraph&&++legStalls>=ROBOT.maxReplans){legStalls=0;routeUsedGraph=false;legAbandoned=true;return true;}
    }
   }
  }else{progressBest=Number.POSITIVE_INFINITY;progressClock=0;legStalls=0;routeUsedGraph=false;progressAnchor.copy(body.position);}
  return arrived;
 };

 const visibleNow=(player:T.Vector3)=>{
  const dx=player.x-body.position.x,dz=player.z-body.position.z;
  const horizontal=Math.hypot(dx,dz);
  if(horizontal>ROBOT.range||horizontal<0.001)return false;
  const cos=Math.cos(wrap(headingTo(dx,dz)-scanYaw));
  if(cos<Math.cos(ROBOT.halfAngle))return false;
  eye.set(body.position.x,body.position.y+ROBOT.eyeHeight,body.position.z);
  scratch.set(player.x,player.y+ROBOT.chestHeight,player.z);
  return openingRobotLineClear(world,eye,scratch);
 };
 /** Reaching the player only counts when the same wall test proves the near side. */
 const canTouchPlayer=(player:T.Vector3)=>{
  eye.set(body.position.x,body.position.y+ROBOT.eyeHeight,body.position.z);
  scratch.set(player.x,player.y+ROBOT.chestHeight,player.z);
  return openingRobotLineClear(world,eye,scratch);
 };

 const poseInitial=()=>{
  const [px,,pz]=O.patrol[0];
  body.position.set(px,world.support(px,pz,C.maxStep)??0,pz);
  body.velocity.set(0,0,0);body.grounded=true;body.contacts=[];
  patrolIndex=1%O.patrol.length;
  const next=O.patrol[patrolIndex];
  moveYaw=scanYaw=headingTo(next[0]-px,next[2]-pz);
  progressAnchor.copy(body.position);
 progressBest=Number.POSITIVE_INFINITY;progressClock=0;legStalls=0;routeUsedGraph=false;
 };
 poseInitial();

 function updateSector(){
  const count=sectorCount;
  const probeY=body.position.y+ROBOT.scanProbeHeight;
  const origin=wedgeOrigin.set(body.position.x,probeY,body.position.z);
  for(let i=0;i<count;i++){
   const t=count===1?0:i/(count-1);
   const angle=scanYaw+(t*2-1)*ROBOT.halfAngle;
   const dx=-Math.sin(angle),dz=-Math.cos(angle);
   ray.set(origin,wedgeDirection.set(dx,0,dz));
   ray.near=0.02;ray.far=ROBOT.scanVisualRange;
   const hits=ray.intersectObjects(world.meshes,false);
   // Land short of the blocker, so the drawn wedge always stays inside what the eye can actually see.
   const length=hits.length?Math.min(ROBOT.scanVisualRange,Math.max(0.35,hits[0].distance-Math.max(.12,Math.min(.4,hits[0].distance*.1)))):ROBOT.scanVisualRange;
   sectorPositions[(i+1)*3]=dx*length;
   sectorPositions[(i+1)*3+1]=ROBOT.scanVisualHeight;
   sectorPositions[(i+1)*3+2]=dz*length;
  }
  sectorPositions[0]=0;sectorPositions[1]=ROBOT.scanVisualHeight;sectorPositions[2]=0;
  sectorGeometry.attributes.position.needsUpdate=true;
 }

 const publish=(dt:number)=>{
  root.position.copy(body.position);
  rig.rotation.y=moveYaw;
  turret.rotation.y=wrap(scanYaw-moveYaw);
  beamMat.opacity=state==='patrol'?.12:state==='scanning'?.18:state==='search'?.16:.26;
  const pulse=dt>0?Math.sin(scanClock*(state==='chase'||state==='caught'?9:2.2)):0;
  eyeMat.emissiveIntensity=(state==='chase'||state==='caught'?2.2:state==='search'?1.7:1.1)+pulse*0.3;
  lampMat.emissiveIntensity=(state==='caught'?2.4:.9)+pulse*0.4;
  // The wedge is rebuilt every frame. Refreshing it on a slower timer left it stale
  // relative to the body, and a cone that lags behind the robot can be drawn through a
  // wall it can no longer see past.
  updateSector();
 };
 publish(0);

 const snapshot=():OpeningRobotUpdate=>({caught,state,warning});

 const nextPatrolIndex=()=>{
  let best=0,bestD=Number.POSITIVE_INFINITY;
  for(let i=0;i<O.patrol.length;i++){const d=Math.hypot(O.patrol[i][0]-body.position.x,O.patrol[i][2]-body.position.z);if(d<bestD){bestD=d;best=i;}}
  return best;
 };

 function advance(dt:number,player:T.Vector3){
  scanClock+=dt;
  const seen=visibleNow(player);
  visibleNowCache=seen;
  const gap=Math.hypot(player.x-body.position.x,player.z-body.position.z);
  const rise=Math.abs(player.y-body.position.y);
  if(seen){seenTime+=dt;lastSeen.copy(player);hasLastSeen=true;}
  else seenTime=Math.max(0,seenTime-dt*2);

  if(state==='patrol'||state==='scanning'){
   // A visible target only becomes a chase after the confirm window; being seen is never a failure.
   if(seen&&seenTime>=ROBOT.confirm){
    state='chase';chaseClock=0;route=[];routeClock=0;progressBest=Number.POSITIVE_INFINITY;progressClock=0;searchClock=0;routeUsedGraph=false;legStalls=0;legAbandoned=false;
   }else if(seen&&state==='patrol')state='scanning';
   else if(!seen&&state==='scanning')state='patrol';
  }else if(state==='chase'){
   chaseClock+=dt;
   if(!seen){
    // Lost sight: the remembered spot is the only allowed goal, never the live position behind cover.
    state='search';searchClock=0;route=[];routeClock=0;progressBest=Number.POSITIVE_INFINITY;progressClock=0;
   }
  }

  switch(state){
   case 'patrol':
   case 'scanning':{
    if(dwell>0){
     dwell-=dt;
     scanYaw=turnToward(scanYaw,moveYaw+Math.sin(scanClock*ROBOT.sweepRate)*ROBOT.sweep,ROBOT.turnRate*dt);
     body.step(dt,{forward:0,right:0,sprint:false},moveYaw,false);
    }else{
     scanYaw=turnToward(scanYaw,moveYaw+Math.sin(scanClock*ROBOT.sweepRate)*ROBOT.sweep,ROBOT.turnRate*dt);
     const [tx,,tz]=O.patrol[patrolIndex];
     if(following(tx,tz,ROBOT.patrolReach,ROBOT.patrolSpeed,dt)){
      patrolIndex=(patrolIndex+1)%O.patrol.length;route=[];routeClock=0;dwell=ROBOT.patrolDwell;
     }
    }
    warning=state==='scanning'?0.15+0.35*Math.min(1,seenTime/ROBOT.confirm):0;
    break;
   }
   case 'chase':{
    const goalX=seen?player.x:lastSeen.x,goalZ=seen?player.z:lastSeen.z;
    following(goalX,goalZ,ROBOT.reach,ROBOT.chaseSpeed,dt);
    // A goal it cannot physically reach is treated as lost sight, never ground into the wall.
    if(legAbandoned){state='search';searchClock=0;route=[];routeClock=0;}
    scanYaw=turnToward(scanYaw,headingTo(goalX-body.position.x,goalZ-body.position.z),ROBOT.turnRate*dt);
    warning=0.7+0.3*Math.max(0,1-Math.hypot(goalX-body.position.x,goalZ-body.position.z)/ROBOT.range);
    if(seen&&chaseClock>=ROBOT.captureGrace&&gap<=ROBOT.capture&&rise<=ROBOT.captureRise&&canTouchPlayer(player)){
     caught=true;state='caught';warning=1;seenTime=0;
    }
    break;
   }
   case 'search':{
    if(seen&&seenTime>=ROBOT.confirm){
     state='chase';chaseClock=0;route=[];routeClock=0;
    }else{
     if(hasLastSeen){
      // Walk to the last visible position, then look around for searchSeconds.
      if(following(lastSeen.x,lastSeen.z,ROBOT.patrolReach,ROBOT.searchSpeed,dt))searchClock+=dt;
     }else searchClock+=dt;
     scanYaw=wrap(scanYaw+ROBOT.spinRate*dt);
     warning=0.4;
     if(searchClock>=ROBOT.searchSeconds){
      state='patrol';seenTime=0;route=[];routeClock=0;patrolIndex=nextPatrolIndex();dwell=ROBOT.patrolDwell;hasLastSeen=false;
     }
    }
    break;
   }
   case 'caught':
    warning=1;
    break;
  }
 }

 function reset(){
  caught=false;state='patrol';warning=0;seenTime=0;searchClock=0;scanClock=0;chaseClock=0;
  hasLastSeen=false;lastSeen.set(0,0,0);visibleNowCache=false;
  route=[];routeClock=0;progressBest=Number.POSITIVE_INFINITY;progressClock=0;dwell=0;
  routeUsedGraph=false;legStalls=0;legAbandoned=false;
  poseInitial();
  publish(0);
 }

 root.visible=true;

 return{
  root,
  /**
   * active=false -> hide the model and freeze everything.
   * paused=true or dt<=0 -> read only: same state, warning and timers, no movement, no lastSeen change.
   */
  update(dt:number,player:T.Vector3,active:boolean,paused:boolean):OpeningRobotUpdate{
   root.visible=active;
   if(!active||paused||!(dt>0))return snapshot();
   advance(dt,player);
   publish(dt);
   return snapshot();
  },
  reset,
  dispose(){
   root.removeFromParent();
   for(const g of geometries)g.dispose();
   for(const m of materials)m.dispose();
   geometries.length=0;materials.length=0;
   graphCache.delete(world);
  },
  get position(){return body.position;},
  get state(){return state;},
  get warning(){return warning;},
  get diagnostics(){
   return{
    state,caught,warning,
    position:body.position.toArray() as [number,number,number],
    lastSeen:hasLastSeen?lastSeen.toArray() as [number,number,number]:null,
    visible:visibleNowCache,seenTime,searchClock,patrolIndex,
    heading:moveYaw,headOffset:wrap(scanYaw-moveYaw),
    contacts:body.contacts.map(c=>c.type) as ('wall'|'ceiling'|'landed'|'boundary')[],
    routing:{usedGraph:routeUsedGraph,stalls:legStalls,abandoned:legAbandoned},
    goal:route.length?[route[route.length-1].x,0,route[route.length-1].z] as [number,number,number]:null,
    route:route.map(r=>[Math.round(r.x*100)/100,Math.round(r.z*100)/100] as [number,number]),
    graph:graph.edges,
    graphNodes:graph.nodes.map(n=>[n.x,n.z,n.name] as [number,number,string]),
   };
  },
 };
}
