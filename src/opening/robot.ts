/** Thomas opening: red-eye security robot.
 *
 * Local finite state machine for one encounter only: slow patrol -> red-eye scan ->
 * confirmed chase -> search of the last known position -> patrol. It never learns the
 * player position behind cover, it moves with the shared CharacterPhysics/Navigation
 * stack, and there is no damage system at all, so the player cannot attack it.
 *
 * Coordination (T28): a unit may publish a sighting only from its own line-of-sight hit.
 * The shared blackboard stores that stale point and an alert level; a nearby unit may
 * claim one search of the remembered point. Nobody ever receives the live player position
 * through a wall, and chase still requires the unit's own eye ray.
 *
 * Budget (T25/T26/T27): the static shell is two merged, vertex-coloured meshes shared by
 * the whole fleet; only `ROBOT.shadowUnits` units keep shadows and their point light; and
 * units farther than `ROBOT.farDistance` simulate at `ROBOT.farHz` while movement still
 * goes through the same physics step, so nothing teleports or clips.
 *
 * Look (fidelity round, task 3): a low-poly quadruped in the Unitree Go2 manner with four
 * articulated legs on shared thigh/shank/foot buffers. The trot is visual only: it advances
 * from real displacement and yaw change on simulated ticks, so render reads (dt=0), pauses
 * and standby never move a leg, and no detection, movement or timing value depends on it.
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
 /** Distance beyond which a unit drops to the far update tier, metres. */
 farDistance:number;
 /** Simulation rate for units beyond `farDistance`, Hz. Movement stays physics-stepped. */
 farHz:number;
 /** Extra distance around `farDistance` before the tier flips back, metres (hysteresis). */
 farHysteresis:number;
 /** Fleet-wide cap of units allowed to cast shadows and keep their point light. */
 shadowUnits:number;
 /** Re-ranking interval for the shadow budget, seconds. */
 shadowInterval:number;
 /** Distance margin before the last shadow slot changes hands, metres. */
 shadowHysteresis:number;
 /** How long a shared sighting stays actionable, seconds. */
 sightingFresh:number;
 /** Silence that starts a new sighting episode and frees the support claim, seconds. */
 sightingGap:number;
 /** Alert added by one sighting report. */
 alertGain:number;
 /** Alert lost per second once reports stop. */
 alertDecay:number;
 /** Units allowed to walk to one shared sighting. */
 supportResponders:number;
 /** A unit farther than this from a shared sighting ignores it, metres. */
 coordinationRadius:number;
 /** Minimum seconds between two sighting reports from the same unit. */
 reportInterval:number;
 /** Highest player speed the prediction may assume, m/s. Never above the real walk speed. */
 playerWalkSpeed:number;
 /** Velocity memory smoothing rate, 1/s. */
 velocitySmoothing:number;
 /** Lead used to predict where a target that just broke line of sight went, seconds. */
 predictTime:number;
 /** Hard cap on that prediction, metres. */
 predictMax:number;
 /** Prediction shorter than this is ignored, metres. */
 predictMin:number;
 /** Aim-ahead while chasing, seconds. */
 interceptLead:number;
 /** Hard cap on the chase aim-ahead, metres. */
 interceptMax:number;
 /** Seconds spent looking around each search point. */
 searchPointSeconds:number;
 /** Lateral spacing of the sweep points beside the last seen position, metres. */
 searchSpread:number;
 /** Travel allowance on top of the search look time before giving up, seconds. */
 searchTravelCap:number;
 /** Alert level that makes nearby units hold the guard point. */
 guardAlert:number;
 /** Dwell used while holding the guard point, seconds. */
 guardDwell:number;
 /** A patrol waypoint this close to the guard point can be held, metres. */
 guardRadius:number;
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
 farDistance:26,
 farHz:24,
 farHysteresis:3,
 shadowUnits:3,
 shadowInterval:0.5,
 shadowHysteresis:2,
 sightingFresh:6,
 sightingGap:2,
 alertGain:0.55,
 alertDecay:0.12,
 supportResponders:1,
 coordinationRadius:18,
 reportInterval:0.4,
 playerWalkSpeed:2.6,
 velocitySmoothing:8,
 predictTime:0.45,
 predictMax:4,
 predictMin:0.35,
 interceptLead:0.25,
 interceptMax:1.2,
 searchPointSeconds:1.1,
 searchSpread:2.2,
 searchTravelCap:4,
 guardAlert:0.6,
 guardDwell:2.4,
 guardRadius:3.5,
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

// ---------------------------------------------------------------- shared fleet assets (T25)

/** One merged, vertex-coloured shell shared by every unit of the fleet.
 *  The owner (the fleet, or a lone robot) calls dispose() exactly once. */
export interface OpeningRobotAssets{
 readonly bodyGeometry:T.BufferGeometry;
 readonly headGeometry:T.BufferGeometry;
 readonly bandGeometry:T.BufferGeometry;
 readonly eyeGeometry:T.BufferGeometry;
 readonly beaconGeometry:T.BufferGeometry;
 /** Thigh with its hip and knee hubs, hanging 0.26 m down from the hip pivot. */
 readonly legUpperGeometry:T.BufferGeometry;
 /** Shank, hanging 0.26 m down from the knee pivot. */
 readonly legLowerGeometry:T.BufferGeometry;
 /** Round 0.07 m foot at the end of the shank. */
 readonly footGeometry:T.BufferGeometry;
 readonly bodyMaterial:T.MeshStandardMaterial;
 readonly bandMaterial:T.MeshStandardMaterial;
 /** Dark graphite shared by every leg part of every unit. */
 readonly legMaterial:T.MeshStandardMaterial;
 dispose():void;
}

/** Quadruped rig dimensions in metres, rig space: +y up, the robot faces -z, left is -x.
 *  Go2-style proportions from .superpowers/sdd/2026-11-22-fidelity-round/task-3-brief.md (3A). */
const RIG={
 /** Hip pivots sit at x ±legX, z ±legZ, just outside the 0.46 m chassis. */
 legX:.26,legZ:.26,hipY:.5,
 /** Thigh and shank length. */
 segment:.26,
 footRadius:.035,
 /** Sensor-head turret pivot on the front of the deck. */
 turret:[0,.75,-.2] as const,
};
/** Standing pose: thigh slants back and down, shank forward and down, so each foot rests
 *  under its hip with the bottom of the foot exactly on the ground (rig origin, y 0). */
const STAND_ANGLE=Math.acos((RIG.hipY-RIG.footRadius)/(2*RIG.segment));
const STAND_THIGH=-STAND_ANGLE,STAND_KNEE=2*STAND_ANGLE;

const SHELL=0xe6eaed,SHELL_LIGHT=0xc9d0d5,GRAPHITE=0x2a2f34,SENSOR=0x14181b,HUB=0x4a535a;

/**
 * Gait and posture, visual only: nothing here feeds detection, movement or any timer.
 * Amplitudes come from .superpowers/sdd/2026-11-22-fidelity-round/task-3-brief.md (3B/3C).
 */
const GAIT={
 /** Thigh pitch either side of the standing pose, radians. */
 thighSwing:.42,
 /** Extra knee bend while a foot swings forward, radians (0 in stance). */
 kneeLift:.55,
 /** Hip roll either side of the standing pose, radians. */
 hipRoll:.07,
 /** Rig bob amplitude, metres: 0.02·sin(2·phase), twice per gait cycle. */
 bob:.02,
 /** Stride credited per radian of body yaw, metres, so turning in place still steps. */
 turnStride:.32,
 /** Ground covered by one full gait cycle, metres. Matches the stance sweep of the
  *  legs above (two 0.26 m segments, ±0.42 rad), so planted feet barely skate. */
 cycle:.76,
 /** Pace at which the trot reaches full amplitude, m/s. */
 fullPace:.45,
 /** Blend rate towards the walking or standing pose, 1/s; idle legs settle inside a second. */
 blendRate:6,
 /** A displacement larger than this in one tick (reset, relocation) is never walked, metres. */
 maxStep:.5,
 /** Phase of the FL/RR pair against the bob, so the body rides highest at mid-stance. */
 phaseOffset:Math.PI*.75,
 /** Speed smoothing for the acceleration lean, 1/s. */
 speedRate:8,
 /** Lean per m/s² of acceleration, radians, nose down when speeding up. */
 pitchPerAccel:.03,
 maxPitch:.05,
 /** Head dip while searching near the last-seen point, radians, and the radius that counts as near. */
 searchPitch:-.12,
 searchRadius:2.5,
 /** "Notice" brace at the start of a chase: beacon double-pulse and a short head lift. */
 notice:.5,
 noticePitch:.1,
 headRate:8,
 /** Fleet spacing: a neighbour inside this radius and inside the forward cone biases the heading. */
 neighbourRadius:1.2,
 /** Cosine of the forward cone half angle: 0 counts anything in front of the unit (±90°). */
 neighbourCone:0,
 /** Largest heading bias, radians. Steering only: speed and physics are unchanged. */
 neighbourBias:.5,
};

/** Bakes one part colour into a vertex-colour attribute. */
const paint=(geometry:T.BufferGeometry,color:number)=>{
 const count=geometry.getAttribute('position').count;
 const colors=new Float32Array(count*3);
 const rgb=new T.Color(color);
 for(let i=0;i<count;i++){colors[i*3]=rgb.r;colors[i*3+1]=rgb.g;colors[i*3+2]=rgb.b;}
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));
 return geometry;
};
/** Box with the part colour baked into a vertex-colour attribute. */
const coloredBox=(w:number,h:number,d:number,color:number,x:number,y:number,z:number)=>{
 const geometry=new T.BoxGeometry(w,h,d);
 if(x||y||z)geometry.translate(x,y,z);
 return paint(geometry,color);
};
/** Low-poly cylinder, upright or lying along x (hip and knee hubs). */
const coloredCylinder=(radius:number,height:number,segments:number,color:number,x:number,y:number,z:number,axis:'x'|'y'='y')=>{
 const geometry=new T.CylinderGeometry(radius,radius,height,segments);
 if(axis==='x')geometry.rotateZ(Math.PI/2);
 if(x||y||z)geometry.translate(x,y,z);
 return paint(geometry,color);
};
/** Replaces per-part meshes with one indexed buffer. Every part is an indexed three.js
 *  primitive (box, cylinder, sphere), so position/normal/colour share one layout and no
 *  exporter is needed; uv is dropped because the shell materials carry no textures. */
const mergeColored=(parts:T.BufferGeometry[]):T.BufferGeometry=>{
 const merged=new T.BufferGeometry();
 let vertices=0,indices=0;
 for(const part of parts){vertices+=part.getAttribute('position').count;indices+=part.getIndex()!.count;}
 const position=new Float32Array(vertices*3),normal=new Float32Array(vertices*3),color=new Float32Array(vertices*3);
 const index=new Uint32Array(indices);
 let v=0,ix=0;
 for(const part of parts){
  const p=part.getAttribute('position'),n=part.getAttribute('normal'),c=part.getAttribute('color'),idx=part.getIndex()!;
  position.set(p.array as Float32Array,v*3);
  normal.set(n.array as Float32Array,v*3);
  color.set(c.array as Float32Array,v*3);
  for(let i=0;i<idx.count;i++)index[ix+i]=idx.getX(i)+v;
  v+=p.count;ix+=idx.count;
  part.dispose();
 }
 merged.setAttribute('position',new T.BufferAttribute(position,3));
 merged.setAttribute('normal',new T.BufferAttribute(normal,3));
 merged.setAttribute('color',new T.BufferAttribute(color,3));
 merged.setIndex(new T.BufferAttribute(index,1));
 merged.computeBoundingBox();merged.computeBoundingSphere();
 return merged;
};

/**
 * Builds the fleet-wide geometry/material pool. Every robot draws the same shell, so the
 * eight units upload one set of static buffers instead of eight copies. The emissive eye,
 * lamp, scan wedge and the per-unit sector polygon stay per robot: their colour and shape
 * change at runtime and must not leak between units.
 */
export function createOpeningRobotAssets():OpeningRobotAssets{
 // Low-poly quadruped in the Unitree Go2 manner: white upper shell over a graphite belly,
 // dark sensor face, hip fenders and a top LiDAR puck. Generic shapes only: no logo, no text.
 const sx=RIG.legX,sz=RIG.legZ;
 const bodyGeometry=mergeColored([
  // Chassis 0.46 (x) x 0.30 (y) x 0.72 (z) centred at y 0.62: belly, shell, narrower deck.
  coloredBox(.42,.12,.66,GRAPHITE,0,.53,0),          // belly
  coloredBox(.46,.15,.72,SHELL,0,.665,0),            // upper shell
  coloredBox(.38,.03,.62,SHELL,0,.755,0),            // deck, steps in to round the top edge
  coloredBox(.465,.035,.4,GRAPHITE,0,.62,.02),       // side seam between the two tones
  // Front: short snout carrying the dark sensor face, chin sensor below it.
  coloredBox(.4,.12,.05,SHELL,0,.66,-.385),
  coloredBox(.3,.07,.012,SENSOR,0,.655,-.416),
  coloredBox(.12,.05,.06,GRAPHITE,0,.565,-.37),
  // Rear battery cap, which carries the status bar (robot-band).
  coloredBox(.4,.1,.03,GRAPHITE,0,.63,.374),
  // Shoulder plates over the four hips, and the hip housings the legs turn on.
  ...[[-1,-1],[1,-1],[-1,1],[1,1]].flatMap(([x,z])=>[
   coloredBox(.09,.05,.2,SHELL_LIGHT,x*.25,.585,z*sz),
   coloredCylinder(.05,.05,8,GRAPHITE,x*(sx-.045),RIG.hipY,z*sz,'x'),
  ]),
  // Top LiDAR puck (r 0.12) with a dark window ring.
  coloredCylinder(.12,.05,12,GRAPHITE,0,.795,.12),
  coloredCylinder(.123,.02,12,SENSOR,0,.79,.12),
 ]);
 // Sensor head, built around the turret pivot so it can yaw in place on the deck.
 const headGeometry=mergeColored([
  coloredCylinder(.06,.04,10,GRAPHITE,0,.01,0),      // neck ring
  coloredBox(.22,.07,.2,SHELL,0,.065,-.01),          // pod
  coloredBox(.18,.015,.16,SHELL_LIGHT,0,.1075,0),    // pod cap
  coloredBox(.2,.045,.012,SENSOR,0,.065,-.116),      // visor behind the eye bar
 ]);
 // Rear status bar plus a thin running strip down each flank, all in the band material.
 const bandGeometry=mergeColored([
  coloredBox(.22,.025,.012,0xffffff,0,.66,.395),
  coloredBox(.006,.02,.3,0xffffff,-.2335,.7,-.05),
  coloredBox(.006,.02,.3,0xffffff,.2335,.7,-.05),
 ]);
 bandGeometry.deleteAttribute('color');
 const eyeGeometry=coloredBox(.16,.022,.01,0xffffff,0,.068,-.124);
 eyeGeometry.deleteAttribute('color');
 const beaconGeometry=coloredBox(.04,.022,.04,0xffffff,0,.126,.03);
 beaconGeometry.deleteAttribute('color');
 // Legs: one thigh, one shank and one foot buffer drawn by all four legs of every unit.
 const legUpperGeometry=mergeColored([
  coloredCylinder(.05,.07,8,HUB,0,0,0,'x'),           // hip hub
  coloredBox(.065,.14,.1,GRAPHITE,0,-.07,0),
  coloredBox(.055,.13,.07,GRAPHITE,0,-.195,0),
  coloredCylinder(.035,.06,8,HUB,0,-RIG.segment,0,'x'), // knee hub
 ]);
 const legLowerGeometry=mergeColored([
  coloredBox(.042,.24,.046,GRAPHITE,0,-.12,0),
 ]);
 const footGeometry=mergeColored([paint(new T.SphereGeometry(RIG.footRadius,6,4),SENSOR)]);
 const bodyMaterial=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.5,metalness:.18});
 const bandMaterial=new T.MeshStandardMaterial({color:0x1c8f65,roughness:.5,metalness:.18,emissive:0x0c4f38,emissiveIntensity:.55});
 const legMaterial=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.58,metalness:.32});
 return{
  bodyGeometry,headGeometry,bandGeometry,eyeGeometry,beaconGeometry,legUpperGeometry,legLowerGeometry,footGeometry,
  bodyMaterial,bandMaterial,legMaterial,
  dispose(){
   bodyGeometry.dispose();headGeometry.dispose();bandGeometry.dispose();eyeGeometry.dispose();beaconGeometry.dispose();
   legUpperGeometry.dispose();legLowerGeometry.dispose();footGeometry.dispose();
   bodyMaterial.dispose();bandMaterial.dispose();legMaterial.dispose();
  },
 };
}

// ---------------------------------------------------------------- shared awareness (T28)

/** One real line-of-sight hit. The position is already stale when other units read it. */
export interface OpeningRobotSighting{
 /** Episode id: reports inside one episode keep their id, so support claims are not reset. */
 id:number;
 by:string;
 position:T.Vector3;
 velocity:T.Vector3;
 at:number;
}

/** Fleet blackboard. Holds a remembered point and an alert level, never a live track. */
export interface OpeningRobotBlackboard{
 readonly time:number;
 readonly alert:number;
 readonly sighting:OpeningRobotSighting|null;
 /** Advance the fleet clock once per simulated tick, decay the alert, expire stale sightings. */
 tick(dt:number):void;
 /** Publish a sighting; only call after a real line-of-sight hit. */
 report(by:string,position:T.Vector3,velocity:T.Vector3):OpeningRobotSighting;
 /** Claim the shared sighting for one search; at most `ROBOT.supportResponders` win. */
 claim(id:number,by:string):boolean;
 reset():void;
}

export function createOpeningRobotBlackboard():OpeningRobotBlackboard{
 let time=0,alert=0,episode=0,current:OpeningRobotSighting|null=null;
 const claimed=new Set<string>();
 return{
  get time(){return time;},
  get alert(){return alert;},
  get sighting(){return current;},
  tick(dt){
   if(!(dt>0))return;
   time+=dt;
   alert=Math.max(0,alert-ROBOT.alertDecay*dt);
   if(current&&time-current.at>ROBOT.sightingFresh){current=null;claimed.clear();}
  },
  report(by,position,velocity){
   if(!current||time-current.at>ROBOT.sightingGap){episode++;claimed.clear();}
   current={id:episode,by,position:position.clone(),velocity:velocity.clone(),at:time};
   alert=Math.min(1,alert+ROBOT.alertGain);
   return current;
  },
  claim(id,by){
   if(!current||current.id!==id)return false;
   if(claimed.has(by))return true;
   if(claimed.size>=ROBOT.supportResponders)return false;
   claimed.add(by);
   return true;
  },
  reset(){time=0;alert=0;episode=0;current=null;claimed.clear();},
 };
}

interface GraphNode{x:number;z:number;y:number;name:string}
export interface GraphEdge{from:number;to:number;walked:boolean;seconds:number}
interface Graph{nodes:GraphNode[];links:number[][];edges:GraphEdge[]}

/**
 * Small waypoint graph around Building 5. Every candidate edge is proven by a real
 * CharacterPhysics walk before it is allowed, so the robot never plans through a wall.
 */
const graphCache=new WeakMap<Navigation,Map<string,Graph>>();
const routeSignature=(route:readonly (readonly number[])[])=>route.map(p=>`${p[0]},${p[2]}`).join(';');
const DEFAULT_ROUTE_SIGNATURE=routeSignature(O.patrol);
function graphFor(world:Navigation,route:readonly (readonly number[])[],approach:readonly (readonly number[])[]=[]):Graph{
 let bucket=graphCache.get(world);
 if(!bucket){bucket=new Map();graphCache.set(world,bucket);}
 const signature=routeSignature(route)+(approach.length?'|approach:'+routeSignature(approach):'');
 const cached=bucket.get(signature);
 if(cached)return cached;
 const nodes:GraphNode[]=[];
 const add=(x:number,z:number,name:string)=>{
  if(nodes.some(n=>Math.abs(n.x-x)<0.01&&Math.abs(n.z-z)<0.01))return;
  nodes.push({x,z,y:world.support(x,z,C.maxStep)??0,name});
 };
 const isDefault=routeSignature(route)===DEFAULT_ROUTE_SIGNATURE;
 for(const [x,,z] of route)add(x,z,'patrol');
 // The inside/outside door nodes only belong to the authored Building 5 ring.
 if(isDefault){
  add(O.b5.door,O.b5.z1+2.3,'b5-door-out');
  add(O.b5.door,O.b5.z1-1.9,'b5-door-in');
  add(O.staff[0],O.staff[2],'b5-staff');
 }
 for(const [x,,z]of approach)add(x,z,'deployment');
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
 const ring=route.map(p=>[p[0],p[2]] as [number,number]);
 for(let i=0;i<ring.length;i++)pair(ring[i][0],ring[i][1],ring[(i+1)%ring.length][0],ring[(i+1)%ring.length][1]);
 if(isDefault){
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
 }
 for(let i=0;i<approach.length;i++){const a=approach[i],b=approach[i+1]??route[0];pair(a[0],a[2],b[0],b[2]);}
 const graph:Graph={nodes,links,edges};
 bucket.set(signature,graph);
 return graph;
}

/** Optional per-instance configuration for the Thomas patrol fleet. */
export interface OpeningRobotOptions{
 /** Patrol loop in world metres. Defaults to the authored Building 5 ring `OPENING.patrol`. */
 route?:readonly (readonly number[])[];
 /** Index in the route where this unit starts, so a fleet does not spawn stacked. */
 startIndex?:number;
 /** Physically traversed, one-time departure from the visible entrance formation. */
 approach?:readonly (readonly number[])[];
 initialYaw?:number;
 /** Opening presentation flag; does not alter the actor API or advance physics. */
 standby?:()=>boolean;
 /** Stable fleet id for diagnostics and scene metadata. */
 id?:string;
 /** Optional cap for the expensive drawn-sector rebuilds, e.g. 8 for a fleet. */
 visualHz?:number;
 /** Fleet balance multipliers; 1 keeps the single-robot acceptance values. */
 rangeScale?:number;
 angleScale?:number;
 confirmScale?:number;
 speedScale?:number;
 /** Shared fleet awareness. Standalone robots pass nothing and stay fully local. */
 blackboard?:OpeningRobotBlackboard;
 /** Shared merged shell pool. The owner disposes it; the robot never does. */
 assets?:OpeningRobotAssets;
 /** Waypoint a unit may hold when the fleet alert is high. Defaults to the B5 entrance. */
 guardPoint?:readonly [number,number,number];
}

export interface OpeningRobot{
 root:T.Group;
 /** `others`: optional live feet positions of the other fleet units, for spacing only. */
 update(dt:number,player:T.Vector3,active:boolean,paused:boolean,shadowBudget?:boolean,others?:readonly T.Vector3[]):OpeningRobotUpdate;
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
 /** Coordination: shared alert, whether this unit claimed a shared search, and guarding. */
 alert:number;
 supporting:boolean;
 guarding:boolean;
 searchSteps:[number,number][];
 searchStep:number;
 /** Budget: far update tier and whether this unit currently owns shadows/point light. */
 farTier:boolean;
 shadow:boolean;
}

/** Default guard post: the B5 entrance the player must cross after the alarm. */
const DEFAULT_GUARD:[number,number,number]=[O.b5.door,0,O.b5.z1+2.2];

export function createOpeningRobot(world:Navigation,options:OpeningRobotOptions={}):OpeningRobot{
 const patrolRoute=options.route??O.patrol;
 const startingIndex=Math.max(0,Math.min(patrolRoute.length-1,Math.round(options.startIndex??0)));
 const graph=graphFor(world,patrolRoute,options.approach);
 const body=new CharacterPhysics(world);
 const ray=new T.Raycaster();
 const eye=new T.Vector3();
 const scratch=new T.Vector3();
 const wedgeOrigin=new T.Vector3(),wedgeDirection=new T.Vector3();
 const blackboard=options.blackboard??null;
 const unitId=options.id??'opening-robot-0';
 const guardPoint=options.guardPoint??DEFAULT_GUARD;

 // ---------- model: merged shell (shared by the fleet) + per-unit emissive parts ----------
 const ownedAssets=options.assets?null:createOpeningRobotAssets();
 const assets=options.assets??ownedAssets!;
 const root=new T.Group();root.name='opening-security-robot';root.userData={...root.userData,fleetId:unitId};
 const rig=new T.Group();rig.name='opening-security-robot-rig';root.add(rig);
 const turret=new T.Group();turret.name='opening-security-robot-turret';rig.add(turret);
 const eyeMat=new T.MeshStandardMaterial({color:0x2a0b0b,roughness:.35,metalness:.1});
 eyeMat.emissive.setHex(0xff2b2b);eyeMat.emissiveIntensity=1.4;
 const lampMat=new T.MeshStandardMaterial({color:0x3a1010,roughness:.4,metalness:.1});
 lampMat.emissive.setHex(0xff4a30);lampMat.emissiveIntensity=.9;
 const beamMat=new T.MeshBasicMaterial({color:0xff3b30,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false});
 const mount=(geometry:T.BufferGeometry,material:T.Material,name:string,parent:T.Object3D,shadow:boolean)=>{
  const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=shadow;mesh.receiveShadow=shadow;parent.add(mesh);return mesh;
 };
 // Yaw first, then pitch in the body (or head) frame, so a lean never tips the heading.
 rig.rotation.order='YXZ';turret.rotation.order='YXZ';
 turret.position.set(...RIG.turret);
 const bodyMesh=mount(assets.bodyGeometry,assets.bodyMaterial,'robot-body',rig,true);
 mount(assets.bandGeometry,assets.bandMaterial,'robot-band',rig,false);
 const headMesh=mount(assets.headGeometry,assets.bodyMaterial,'robot-head',turret,true);
 mount(assets.eyeGeometry,eyeMat,'opening-robot-eye',turret,false);
 mount(assets.beaconGeometry,lampMat,'robot-beacon',turret,false);
 const shadowMeshes=[bodyMesh,headMesh];
 /** Four articulated legs: hip group (pitch + roll) -> thigh, knee pivot group -> shank and foot. */
 const LEG_SOURCE={sourceFile:'src/opening/robot.ts'};
 const legs=([['fl',-1,-1],['fr',1,-1],['rl',-1,1],['rr',1,1]] as const).map(([key,side,end])=>{
  const hip=new T.Group();hip.name='robot-leg-'+key;hip.userData={...LEG_SOURCE,authorKey:'robot-leg-'+key};
  // Roll about the body axis first, then pitch: the hip abducts, then the thigh swings.
  hip.rotation.order='ZYX';
  hip.position.set(side*RIG.legX,RIG.hipY,end*RIG.legZ);
  rig.add(hip);
  const knee=new T.Group();knee.name='robot-knee-'+key;knee.userData={...LEG_SOURCE,authorKey:'robot-knee-'+key};
  knee.position.set(0,-RIG.segment,0);
  hip.add(knee);
  const upper=mount(assets.legUpperGeometry,assets.legMaterial,'robot-leg-upper',hip,true);
  const lower=mount(assets.legLowerGeometry,assets.legMaterial,'robot-leg-lower',knee,true);
  const foot=mount(assets.footGeometry,assets.legMaterial,'robot-foot',knee,false);
  foot.position.set(0,-RIG.segment,0);
  for(const [mesh,part] of [[upper,'upper'],[lower,'lower'],[foot,'foot']] as const){
   mesh.receiveShadow=false;mesh.userData={...LEG_SOURCE,authorKey:`robot-leg-${part}-${key}`};
  }
  shadowMeshes.push(upper,lower);
  // Trot: FL with RR, FR with RL, the two diagonal pairs half a cycle apart.
  const offset=(key==='fl'||key==='rr'?0:Math.PI)+GAIT.phaseOffset;
  return{hip,knee,side,offset};
 });
 const sectorCount=Math.max(5,ROBOT.scanSamples);
 const sectorGeometry=new T.BufferGeometry();
 const sectorPositions=new Float32Array((sectorCount+1)*3);
 sectorGeometry.setAttribute('position',new T.BufferAttribute(sectorPositions,3));
 const sectorIndices:number[]=[];
 for(let i=0;i<sectorCount-1;i++)sectorIndices.push(0,i+1,i+2);
 sectorGeometry.setIndex(sectorIndices);
 const sector=new T.Mesh(sectorGeometry,beamMat);sector.name='opening-robot-scan-sector';sector.frustumCulled=false;sector.renderOrder=2;root.add(sector);
 const beaconLight=new T.PointLight(0xff2a1c,1.1,5.5,2);beaconLight.position.set(0,.95,0);root.add(beaconLight);

 // ---------- authoritative state ----------
 let standby=options.standby?.()??false;
 let state:OpeningRobotState='patrol';
 let caught=false,warning=0,seenTime=0,searchClock=0,scanClock=0;
 let patrolIndex=1,moveYaw=0,scanYaw=0,routeClock=0,progressClock=0,progressBest=Number.POSITIVE_INFINITY;
 let dwell=0,chaseClock=0,visibleNowCache=false,visualClock=0;
 let routeUsedGraph=false,legStalls=0,legAbandoned=false;
 let route:{x:number;z:number}[]=[];
 const lastSeen=new T.Vector3();
 /** Where the body was when the current stall window opened; travel since then is real progress. */
 const progressAnchor=new T.Vector3();
 let hasLastSeen=false;
 /** Coordination and budget state. */
 let supporting=false,guarding=false,shadowOn=true;
 let reportClock=0;
 const playerVelocity=new T.Vector3(),previousPlayer=new T.Vector3(),stepVelocity=new T.Vector3();
 let hasPreviousPlayer=false;
 let farTier=false,budgetClock=0;
 let searchStep=0,searchLook=0,searchElapsed=0;
 let searchSteps:{x:number;z:number;look:number}[]=[];
 /** Other units' live feet positions for this simulation tick only (fleet spacing, 3C). */
 let neighbours:readonly T.Vector3[]|null=null;
 /** Visual gait state. Advanced only from real displacement and yaw change on a simulated tick. */
 const gaitAnchor=new T.Vector3();
 let gaitYaw=0,gaitPhase=0,gaitWeight=0,gaitSpeed=0,bodyPitch=0,headPitch=0;

 /**
  * Gentle spacing: a unit within `neighbourRadius` and in front of this one turns the
  * heading away from it, more the closer it is. It only offsets the steering target, so the
  * body still moves through the same physics step at the same speed.
  */
 const neighbourBias=()=>{
  if(!neighbours||!neighbours.length)return 0;
  const fx=-Math.sin(moveYaw),fz=-Math.cos(moveYaw),rx=Math.cos(moveYaw),rz=-Math.sin(moveYaw);
  let bias=0;
  for(const other of neighbours){
   const ox=other.x-body.position.x,oz=other.z-body.position.z,distance=Math.hypot(ox,oz);
   if(distance<1e-3||distance>=GAIT.neighbourRadius||Math.abs(other.y-body.position.y)>C.maxStep*4)continue;
   const ahead=(ox*fx+oz*fz)/distance;
   if(ahead<GAIT.neighbourCone)continue;
   // Neighbour on the right (or dead ahead) -> bear left (+yaw); on the left -> bear right.
   bias+=(ox*rx+oz*rz>=0?1:-1)*GAIT.neighbourBias*(1-distance/GAIT.neighbourRadius);
  }
  return Math.max(-GAIT.neighbourBias,Math.min(GAIT.neighbourBias,bias));
 };

 /** Writes the current gait state onto the leg groups, the rig and the head. */
 const poseGait=()=>{
  const w=gaitWeight;
  for(const leg of legs){
   const phase=gaitPhase+leg.offset,swing=Math.cos(phase);
   leg.hip.rotation.x=STAND_THIGH+w*GAIT.thighSwing*Math.sin(phase);
   // Outward roll while the foot swings forward, a touch inward in stance.
   leg.hip.rotation.z=w>0?leg.side*GAIT.hipRoll*w*swing:0;
   leg.knee.rotation.x=STAND_KNEE+w*GAIT.kneeLift*Math.max(0,swing);
  }
  // The bob lives on the rig only; the scan sector hangs from the root and never moves with it.
  rig.position.y=w>0?w*GAIT.bob*Math.sin(2*gaitPhase):0;
  rig.rotation.x=bodyPitch;
  turret.rotation.x=headPitch;
 };
 /** Standing pose, used at spawn, on reset and whenever the fleet stands down. */
 const standGait=()=>{
  gaitAnchor.copy(body.position);gaitYaw=moveYaw;
  gaitPhase=0;gaitWeight=0;gaitSpeed=0;bodyPitch=0;headPitch=0;
  poseGait();
 };
 /** One simulated tick of gait: stride from real travel plus |Δyaw|·turnStride, then pose. */
 const advanceGait=(dt:number)=>{
  const moved=Math.hypot(body.position.x-gaitAnchor.x,body.position.z-gaitAnchor.z);
  const turned=Math.abs(wrap(moveYaw-gaitYaw));
  gaitAnchor.copy(body.position);gaitYaw=moveYaw;
  const travel=moved<=GAIT.maxStep?moved:0;
  const stride=travel+turned*GAIT.turnStride;
  gaitPhase=(gaitPhase+stride/GAIT.cycle*Math.PI*2)%(Math.PI*2);
  const blend=1-Math.exp(-GAIT.blendRate*dt);
  gaitWeight+=(Math.min(1,stride/dt/GAIT.fullPace)-gaitWeight)*blend;
  // Lean into acceleration from a smoothed ground speed; physics speed itself is instant.
  const previous=gaitSpeed;
  gaitSpeed+=(travel/dt-gaitSpeed)*(1-Math.exp(-GAIT.speedRate*dt));
  const lean=Math.max(-GAIT.maxPitch,Math.min(GAIT.maxPitch,-(gaitSpeed-previous)/dt*GAIT.pitchPerAccel));
  bodyPitch+=(lean-bodyPitch)*blend;
  const noticing=state==='chase'&&chaseClock<GAIT.notice;
  const nearLastSeen=state==='search'&&hasLastSeen&&Math.hypot(lastSeen.x-body.position.x,lastSeen.z-body.position.z)<GAIT.searchRadius;
  const headTarget=noticing?GAIT.noticePitch:nearLastSeen?GAIT.searchPitch:0;
  headPitch+=(headTarget-headPitch)*(1-Math.exp(-GAIT.headRate*dt));
  poseGait();
 };

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
  moveYaw=turnToward(moveYaw,headingTo(dx,dz)+neighbourBias(),ROBOT.turnRate*dt);
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
  if(horizontal>ROBOT.range*(options.rangeScale??1)||horizontal<0.001)return false;
  const cos=Math.cos(wrap(headingTo(dx,dz)-scanYaw));
  if(cos<Math.cos(ROBOT.halfAngle*(options.angleScale??1)))return false;
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

 /** Smooth, speed-capped estimate of the player's own motion, used only for bounded prediction. */
 const trackPlayer=(player:T.Vector3,dt:number)=>{
  if(hasPreviousPlayer&&dt>0){
   stepVelocity.set((player.x-previousPlayer.x)/dt,0,(player.z-previousPlayer.z)/dt);
   const speed=Math.hypot(stepVelocity.x,stepVelocity.z);
   if(speed>ROBOT.playerWalkSpeed)stepVelocity.multiplyScalar(ROBOT.playerWalkSpeed/speed);
   playerVelocity.lerp(stepVelocity,1-Math.exp(-ROBOT.velocitySmoothing*dt));
  }
  previousPlayer.copy(player);
  hasPreviousPlayer=true;
 };

 const walkablePoint=(x:number,z:number,fromY:number)=>{
  const h=world.support(x,z,fromY+C.maxStep);
  if(h===null||Math.abs(h-fromY)>C.maxStep)return false;
  return !world.blocked(x,z,h);
 };

 /**
 * Sector search around the last seen point. The remembered position is always checked
 * first; only a target that was actually moving adds a predicted point and one lateral
 * sweep point, all bounded by `predictMax` so the robot never assumes more than a short
 * extrapolation of the player's last visible velocity.
 */
 const buildSearchPlan=(velocity:T.Vector3)=>{
  searchSteps=[];searchStep=0;searchLook=0;
  if(!hasLastSeen)return;
  const lx=lastSeen.x,lz=lastSeen.z,ly=lastSeen.y;
  searchSteps.push({x:lx,z:lz,look:ROBOT.searchPointSeconds});
  const ox=velocity.x*ROBOT.predictTime,oz=velocity.z*ROBOT.predictTime;
  const lead=Math.hypot(ox,oz);
  if(lead>=ROBOT.predictMin){
   const k=lead>ROBOT.predictMax?ROBOT.predictMax/lead:1;
   const px=lx+ox*k,pz=lz+oz*k;
   if(walkablePoint(px,pz,ly))searchSteps.push({x:px,z:pz,look:ROBOT.searchPointSeconds});
   const speed=Math.hypot(velocity.x,velocity.z);
   const nx=speed>0.2?-velocity.z/speed:0,nz=speed>0.2?velocity.x/speed:1;
   for(const side of [1,-1]){
    const sx=px+nx*ROBOT.searchSpread*side,sz=pz+nz*ROBOT.searchSpread*side;
    if(walkablePoint(sx,sz,ly)){searchSteps.push({x:sx,z:sz,look:ROBOT.searchPointSeconds});break;}
   }
  }
  // Split the same look budget over the plan: one point still gets the full search window.
  const look=Math.max(ROBOT.searchPointSeconds,ROBOT.searchSeconds/searchSteps.length);
  for(const point of searchSteps)point.look=look;
 };

 /** A nearby unit may claim one search of a shared sighting; it never receives a live track. */
 const considerSupport=()=>{
  if(!blackboard||state!=='patrol'&&state!=='scanning')return;
  const sighting=blackboard.sighting;
  if(!sighting)return;
  // Own eyes beat hearsay: a unit that can see the target, or that published this same
  // sighting, must never drop back into a search of its own report.
  if(sighting.by===unitId||visibleNowCache)return;
  if(Math.hypot(sighting.position.x-body.position.x,sighting.position.z-body.position.z)>ROBOT.coordinationRadius)return;
  if(!blackboard.claim(sighting.id,unitId))return;
  lastSeen.copy(sighting.position);hasLastSeen=true;supporting=true;
  buildSearchPlan(sighting.velocity);
  state='search';searchClock=0;searchElapsed=0;searchLook=0;searchStep=0;
  route=[];routeClock=0;progressBest=Number.POSITIVE_INFINITY;progressClock=0;
 };

 const poseInitial=()=>{
  const [px,,pz]=options.approach?.[0]??patrolRoute[startingIndex];
  body.position.set(px,world.support(px,pz,C.maxStep)??0,pz);
  body.velocity.set(0,0,0);body.grounded=true;body.contacts=[];
  patrolIndex=options.approach?.length?startingIndex:(startingIndex+1)%patrolRoute.length;
  const next=patrolRoute[patrolIndex];
  moveYaw=scanYaw=options.initialYaw??headingTo(next[0]-px,next[2]-pz);
  progressAnchor.copy(body.position);
 progressBest=Number.POSITIVE_INFINITY;progressClock=0;legStalls=0;routeUsedGraph=false;
 };
 poseInitial();
 standGait();

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

 /** Only the units the fleet ranked as nearest keep shadow casting and their point light. */
 const applyShadowBudget=(on:boolean)=>{
  if(on===shadowOn)return;
  shadowOn=on;
  for(const mesh of shadowMeshes)mesh.castShadow=on;
  beaconLight.visible=on;
 };

 const publish=(dt:number)=>{
  root.position.copy(body.position);
  rig.rotation.y=moveYaw;
  turret.rotation.y=wrap(scanYaw-moveYaw);
  // Standing down always shows the standing pose; otherwise only a simulated tick moves a leg.
  if(standby)standGait();else if(dt>0)advanceGait(dt);
  beamMat.opacity=state==='patrol'?.12:state==='scanning'?.18:state==='search'?.16:.26;
  const pulse=dt>0?Math.sin(scanClock*(state==='chase'||state==='caught'?9:2.2)):0;
  eyeMat.emissiveIntensity=(state==='chase'||state==='caught'?2.2:state==='search'?1.7:1.1)+pulse*0.3;
  // Chase: a double-pulse "notice" over the first half second (movement carries on), then a solid beacon.
  const chasing=state==='chase',noticing=chasing&&chaseClock<GAIT.notice;
  const flash=noticing?Math.max(0,Math.sin(chaseClock*Math.PI*4/GAIT.notice)):0;
  beaconLight.intensity=noticing?.6+1.6*flash:chasing?1.5:(state==='patrol'?.75:.95)+.35*(0.5+0.5*Math.sin(scanClock*3.1));
  lampMat.emissiveIntensity=noticing?.5+2.6*flash:chasing?2.2:(state==='caught'?2.4:.9)+pulse*0.4;
  sector.visible=!standby;
  eyeMat.emissive.setHex(standby?0x35bf98:0xff2b2b);eyeMat.color.setHex(standby?0x163e32:0x2a0b0b);
  lampMat.emissive.setHex(standby?0x35bf98:0xff4a30);lampMat.color.setHex(standby?0x163e32:0x3a1010);
  beaconLight.color.setHex(standby?0x35bf98:0xff2a1c);
  if(standby){eyeMat.emissiveIntensity=.6;lampMat.emissiveIntensity=.45;beaconLight.intensity=.18;return;}
  // A single robot rebuilds the wedge every frame. A fleet caps the expensive sector
  // probes (opts.visualHz) while the detection rays keep running at full physics rate.
  if(!options.visualHz||dt<=0){updateSector();}
  else{
   visualClock+=dt;
   if(visualClock>=1/options.visualHz){visualClock=0;updateSector();}
  }
 };
 publish(0);

 const snapshot=():OpeningRobotUpdate=>({caught,state,warning});

 const nextPatrolIndex=()=>{
  let best=0,bestD=Number.POSITIVE_INFINITY;
  for(let i=0;i<patrolRoute.length;i++){const d=Math.hypot(patrolRoute[i][0]-body.position.x,patrolRoute[i][2]-body.position.z);if(d<bestD){bestD=d;best=i;}}
  return best;
 };

 function advance(dt:number,player:T.Vector3){
  scanClock+=dt;
  trackPlayer(player,dt);
  const seen=visibleNow(player);
  visibleNowCache=seen;
  const gap=Math.hypot(player.x-body.position.x,player.z-body.position.z);
  const rise=Math.abs(player.y-body.position.y);
  if(seen){seenTime+=dt;lastSeen.copy(player);hasLastSeen=true;}
  else seenTime=Math.max(0,seenTime-dt*2);
  // A sighting is published only from this unit's own eye ray. The blackboard is a stale
  // point plus an alert level; it never receives a live position through cover.
  if(seen&&blackboard){
   reportClock-=dt;
   if(reportClock<=0){reportClock=ROBOT.reportInterval;blackboard.report(unitId,player,playerVelocity);}
  }else if(!seen)reportClock=0;

  if(state==='patrol'||state==='scanning'){
   // A visible target only becomes a chase after the confirm window; being seen is never a failure.
   if(seen&&seenTime>=ROBOT.confirm*(options.confirmScale??1)){
    state='chase';chaseClock=0;route=[];routeClock=0;progressBest=Number.POSITIVE_INFINITY;progressClock=0;searchClock=0;routeUsedGraph=false;legStalls=0;legAbandoned=false;supporting=false;
   }else if(seen&&state==='patrol')state='scanning';
   else if(!seen&&state==='scanning')state='patrol';
   considerSupport();
  }else if(state==='chase'){
   chaseClock+=dt;
   if(!seen){
    // Lost sight: the remembered spot (plus a bounded prediction) is the only allowed goal,
    // never the live position behind cover. A nearby unit may claim the shared search once.
    state='search';searchClock=0;searchElapsed=0;route=[];routeClock=0;progressBest=Number.POSITIVE_INFINITY;progressClock=0;
    buildSearchPlan(playerVelocity);
   }
  }

  guarding=false;
  switch(state){
   case 'patrol':
   case 'scanning':{
    const holdGuard=blackboard!==null&&blackboard.alert>=ROBOT.guardAlert&&Math.hypot(guardPoint[0]-body.position.x,guardPoint[2]-body.position.z)<=ROBOT.guardRadius;
    guarding=holdGuard&&dwell>0;
    if(dwell>0){
     dwell-=dt;
     if(holdGuard){
      // Route guarding (T28): hold the choke point the objective sits behind and face it.
      dwell=Math.max(dwell,ROBOT.guardDwell);
      scanYaw=turnToward(scanYaw,headingTo(guardPoint[0]-body.position.x,guardPoint[2]-body.position.z),ROBOT.turnRate*dt);
     }else{
      scanYaw=turnToward(scanYaw,moveYaw+Math.sin(scanClock*ROBOT.sweepRate)*ROBOT.sweep,ROBOT.turnRate*dt);
     }
     body.step(dt,{forward:0,right:0,sprint:false},moveYaw,false);
    }else{
     scanYaw=turnToward(scanYaw,moveYaw+Math.sin(scanClock*ROBOT.sweepRate)*ROBOT.sweep,ROBOT.turnRate*dt);
     const [tx,,tz]=patrolRoute[patrolIndex];
     if(following(tx,tz,ROBOT.patrolReach,ROBOT.patrolSpeed,dt)){
      patrolIndex=(patrolIndex+1)%patrolRoute.length;route=[];routeClock=0;dwell=ROBOT.patrolDwell;
     }
    }
    warning=state==='scanning'?0.15+0.35*Math.min(1,seenTime/ROBOT.confirm):0;
    break;
   }
   case 'chase':{
    let goalX=seen?player.x:lastSeen.x,goalZ=seen?player.z:lastSeen.z;
    if(seen){
     // Bounded aim-ahead only: capture still checks the real player position, and the
     // predicted point must be on walkable ground before it is used.
     const ox=playerVelocity.x*ROBOT.interceptLead,oz=playerVelocity.z*ROBOT.interceptLead;
     const lead=Math.hypot(ox,oz);
     if(lead>0.02){
      const k=lead>ROBOT.interceptMax?ROBOT.interceptMax/lead:1;
      const ax=player.x+ox*k,az=player.z+oz*k;
      const h=world.support(ax,az,player.y+C.maxStep);
      if(h!==null&&Math.abs(h-player.y)<=C.maxStep&&!world.blocked(ax,az,h)){goalX=ax;goalZ=az;}
     }
    }
    following(goalX,goalZ,ROBOT.reach,ROBOT.chaseSpeed*(options.speedScale??1),dt);
    // A goal it cannot physically reach is treated as lost sight, never ground into the wall.
    if(legAbandoned){state='search';searchClock=0;searchElapsed=0;route=[];routeClock=0;buildSearchPlan(playerVelocity);}
    scanYaw=turnToward(scanYaw,headingTo(goalX-body.position.x,goalZ-body.position.z),ROBOT.turnRate*dt);
    warning=0.7+0.3*Math.max(0,1-Math.hypot(player.x-body.position.x,player.z-body.position.z)/ROBOT.range);
    if(seen&&chaseClock>=ROBOT.captureGrace&&gap<=ROBOT.capture&&rise<=ROBOT.captureRise&&canTouchPlayer(player)){
     caught=true;state='caught';warning=1;seenTime=0;supporting=false;guarding=false;
    }
    break;
   }
   case 'search':{
    if(seen&&seenTime>=ROBOT.confirm*(options.confirmScale??1)){
     state='chase';chaseClock=0;route=[];routeClock=0;supporting=false;
    }else{
     searchElapsed+=dt;
     const step=searchSteps[searchStep];
     if(step){
      // Walk the sector points in order; look around on arrival, then move to the next one.
      const arrived=following(step.x,step.z,ROBOT.patrolReach,ROBOT.searchSpeed*(options.speedScale??1),dt);
      if(arrived){searchClock+=dt;searchLook+=dt;}
      if(legAbandoned||searchLook>=step.look){
       searchLook=0;
       if(searchStep+1<searchSteps.length)searchStep++;
       else searchClock=Math.max(searchClock,ROBOT.searchSeconds);
      }
     }else searchClock+=dt;
     scanYaw=wrap(scanYaw+ROBOT.spinRate*dt);
     warning=0.4;
     if(searchClock>=ROBOT.searchSeconds||searchElapsed>ROBOT.searchSeconds+ROBOT.searchTravelCap){
      state='patrol';seenTime=0;route=[];routeClock=0;patrolIndex=nextPatrolIndex();dwell=ROBOT.patrolDwell;hasLastSeen=false;
      supporting=false;guarding=false;searchSteps=[];searchStep=0;searchLook=0;
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
  routeUsedGraph=false;legStalls=0;legAbandoned=false;visualClock=0;
  supporting=false;guarding=false;reportClock=0;farTier=false;budgetClock=0;
  searchStep=0;searchLook=0;searchElapsed=0;searchSteps=[];
  playerVelocity.set(0,0,0);hasPreviousPlayer=false;
  poseInitial();
  standGait();
  publish(0);
 }

 root.visible=true;

 return{
  root,
  /**
   * active=false -> hide the model and freeze everything.
   * paused=true or dt<=0 -> read only: same state, warning and timers, no movement, no lastSeen change.
   * shadowBudget=false -> emissive-only unit: no shadow casting, no point light (T26).
   * others -> other units' feet positions; one inside 1.2 m ahead biases the heading (3C).
   */
  update(dt:number,player:T.Vector3,active:boolean,paused:boolean,shadowBudget=true,others?:readonly T.Vector3[]):OpeningRobotUpdate{
   const quiet=options.standby?.()??false;if(quiet!==standby){standby=quiet;publish(0);}
   root.visible=active;
   applyShadowBudget(active&&shadowBudget);
   if(!active||paused||!(dt>0))return snapshot();
   // T27: far units simulate at a fixed lower rate. Movement still uses the same physics
   // step and a fixed step size, so the body never jumps; the leftover time is carried.
   let simDt=dt;
   const distance=Math.hypot(player.x-body.position.x,player.z-body.position.z);
   const far=distance>ROBOT.farDistance+(farTier?-ROBOT.farHysteresis:ROBOT.farHysteresis);
   farTier=far;
   if(far){
    budgetClock+=dt;
    if(budgetClock<1/ROBOT.farHz)return snapshot();
    simDt=1/ROBOT.farHz;
    budgetClock=Math.min(budgetClock-simDt,simDt);
   }else budgetClock=0;
   neighbours=others??null;
   advance(simDt,player);
   neighbours=null;
   publish(simDt);
   return snapshot();
  },
  reset,
  dispose(){
   root.removeFromParent();
   sectorGeometry.dispose();
   eyeMat.dispose();lampMat.dispose();beamMat.dispose();
   if(ownedAssets)ownedAssets.dispose();
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
    alert:blackboard?blackboard.alert:0,
    supporting,guarding,
    searchSteps:searchSteps.map(s=>[Math.round(s.x*100)/100,Math.round(s.z*100)/100] as [number,number]),
    searchStep,
    farTier,shadow:shadowOn,
   };
  },
 };
}
