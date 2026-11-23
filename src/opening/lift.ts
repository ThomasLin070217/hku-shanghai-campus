import * as T from 'three';
import {B4_LIFT as L} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';

/**
 * B04 core lift — the first runtime-mutable geometry in the opening world.
 *
 * The world's collision is authored once: `openingObstacles` builds the obstacle list and
 * `openingSupport` answers every floor query from constants. A lift breaks both assumptions,
 * so the car is **modelled state**, not a moving room: `LIFT` is a single module-level state
 * object, `openingSupport` reads its floor on every query and the mounted `Obstacle` objects
 * are the *same objects* the physics walks — their fields are rewritten when the car moves.
 * Nothing is rebuilt per frame: `stepLift` mutates `y`/`doors`, `syncLiftObstacles` writes
 * ten boxes in place, and `blocked()`/`contacts()` see the new values immediately because
 * they read the array on every call.
 *
 * Ticking. No file the task may edit owns a per-frame update for the opening scenery
 * (`experience.ts`, which drives every other animation, is out of scope). The physics calls
 * `world.support()` on every fixed step, so `openingSupport` is the one hook that runs at
 * simulation rate; it forwards to `advanceLift` with the wall clock. Each query advances the
 * car by at most `MAX_RISE_PER_ADVANCE` so a rider can never be outrun by the floor under
 * low frame rates, and the car only advances while something is asking the world where the
 * floor is. That is also why the lift freezes with the game: a paused first-person player
 * queries nothing.
 *
 * A passenger is detected from the same query (standing in the car footprint at car-floor
 * height), so no interact key is needed and no other file has to push input in.
 */

export interface LiftState{phase:'idle'|'doors-opening'|'open'|'doors-closing'|'rising'|'arrived';y:number;doors:number;}
export interface LiftBox{name:string;x0:number;x1:number;z0:number;z1:number;bottom:number;top:number}

/** Accel and decel each take a quarter of the travel time; the middle half is cruise. */
const ACCEL=.25;
const TRAVEL=L.travelSeconds;
/** The car floor starts on the lobby floor, so the ride is 18.88 m, not the 18.90 m landing. */
export const LIFT_TRAVEL_DISTANCE=L.landing-L.ground;

/** Height above the ground floor after `seconds` of the accel–cruise–decel ride. */
export function liftTravelY(seconds:number):number{
 const t=Math.max(0,Math.min(TRAVEL,seconds)),a=ACCEL*TRAVEL,v=LIFT_TRAVEL_DISTANCE/(TRAVEL*(1-ACCEL));
 if(t<=0)return 0;
 if(t>=TRAVEL)return LIFT_TRAVEL_DISTANCE;
 if(t<a)return .5*(v/a)*t*t;
 if(t<=TRAVEL-a)return .5*v*a+v*(t-a);
 const r=TRAVEL-t;return LIFT_TRAVEL_DISTANCE-.5*(v/a)*r*r;
}

export function createLift():LiftState{return{phase:'idle',y:L.ground,doors:0};}

/** The declared `LiftState` carries no timers; they live beside it, not in the interface. */
interface LiftClock{open:number;rise:number;}
const clocks=new WeakMap<LiftState,LiftClock>();
function clock(s:LiftState):LiftClock{
 let c=clocks.get(s);
 if(!c){c={open:0,rise:0};clocks.set(s,c);}
 return c;
}

/**
 * One step of the lift. `called` means a passenger is standing in the car and wants the
 * fifth floor. From `idle` the doors open on the first step: an unattended lift waits at the
 * ground lobby with its doors open, so walking in needs no call button.
 */
export function stepLift(s:LiftState,dt:number,called:boolean):void{
 if(!Number.isFinite(dt)||dt<=0)return;
 const c=clock(s);
 if(s.phase==='idle'){s.phase='doors-opening';s.doors=0;}
 if(s.phase==='doors-opening'){
  s.doors=Math.min(1,s.doors+dt/L.doorSeconds);
  if(s.doors>=1){s.doors=1;s.phase='open';c.open=0;}
  return;
 }
 if(s.phase==='open'){
  // The dwell restarts whenever the car is empty, so the doors never close on someone
  // who is still stepping in.
  c.open=called?c.open+dt:0;
  if(c.open>=L.dwellSeconds)s.phase='doors-closing';
  return;
 }
 if(s.phase==='doors-closing'){
  s.doors=Math.max(0,s.doors-dt/L.doorSeconds);
  if(s.doors<=0){s.doors=0;s.phase='rising';c.rise=0;}
  return;
 }
 if(s.phase==='rising'){
  c.rise=Math.min(TRAVEL,c.rise+dt);
  s.y=L.ground+liftTravelY(c.rise);
  // The doors stay shut for the whole ride: they open only once the floor has stopped.
  if(c.rise>=TRAVEL){s.y=L.landing;s.phase='arrived';}
  return;
 }
 s.doors=Math.min(1,s.doors+dt/L.doorSeconds);
}

/** The car floor, or `null` outside the car footprint. */
export function liftSupport(s:LiftState,x:number,z:number):number|null{
 return x>=L.x0&&x<=L.x1&&z>=L.z0&&z<=L.z1?s.y:null;
}

const leafX0=L.x1-L.wall/2-.03,leafX1=L.x1-L.wall/2+.03;

/**
 * The car's collision boxes at a given floor height and door opening. Car walls, floor,
 * ceiling, the two door jambs, the door head and the two sliding leaves.
 */
export function liftObstacleBoxes(y:number,doors:number):LiftBox[]{
 const {x0,x1,z0,z1}=L,top=y+L.clearHeight,wall=L.wall;
 const mid=(L.door.z0+L.door.z1)/2,half=(L.door.z1-L.door.z0)/2;
 const slide=Math.max(0,Math.min(1,doors))*half;
 return [
  {name:'opening-lift-car-floor',x0,x1,z0,z1,bottom:y-wall,top:y},
  {name:'opening-lift-car-west',x0,x1:x0+wall,z0,z1,bottom:y,top},
  {name:'opening-lift-car-north',x0,x1,z0,z1:z0+wall,bottom:y,top},
  {name:'opening-lift-car-south',x0,x1,z0:z1-wall,z1,bottom:y,top},
  {name:'opening-lift-car-ceiling',x0,x1,z0,z1,bottom:top,top:top+wall},
  {name:'opening-lift-jamb-north',x0:x1-wall,x1,z0,z1:L.door.z0,bottom:y,top},
  {name:'opening-lift-jamb-south',x0:x1-wall,x1,z0:L.door.z1,z1,bottom:y,top},
  {name:'opening-lift-door-head',x0:x1-wall,x1,z0:L.door.z0,z1:L.door.z1,bottom:y+L.door.height,top},
  {name:'opening-lift-door-north',x0:leafX0,x1:leafX1,z0:L.door.z0-slide,z1:mid-slide,bottom:y,top:y+L.door.height},
  {name:'opening-lift-door-south',x0:leafX0,x1:leafX1,z0:mid+slide,z1:L.door.z1+slide,bottom:y,top:y+L.door.height},
 ];
}

const toObstacle=(b:LiftBox):Obstacle=>({name:b.name,x:(b.x0+b.x1)/2,z:(b.z0+b.z1)/2,w:b.x1-b.x0,d:b.z1-b.z0,bottom:b.bottom,top:b.top,angle:0});

/** A throw-away snapshot of the car's collision, for checks and for mounting. */
export function liftObstacles(s:LiftState):Obstacle[]{
 return liftObstacleBoxes(s.y,s.doors).map(toObstacle);
}

/**
 * A band-tower mass box, split so the lift shaft is hollow from the ground lobby to the
 * top of the 5F car. Four boxes, no overlap: west of the shaft, the two z flanks, and the
 * mass above it.
 */
export function liftShaftSplit(name:string,r:{x0:number;x1:number;z0:number;z1:number;bottom:number;top:number}):LiftBox[]{
 const sx0=Math.max(r.x0,L.x0),sx1=Math.min(r.x1,L.x1),sz0=Math.max(r.z0,L.z0),sz1=Math.min(r.z1,L.z1);
 if(sx0>=sx1||sz0>=sz1)return [{name,x0:r.x0,x1:r.x1,z0:r.z0,z1:r.z1,bottom:r.bottom,top:r.top}];
 const shaftTop=Math.min(r.top,L.landing+L.clearHeight),out:LiftBox[]=[];
 const push=(key:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number)=>{
  if(x1-x0>1e-6&&z1-z0>1e-6&&top-bottom>1e-6)out.push({name:key,x0,x1,z0,z1,bottom,top});
 };
 push(name+'-west',r.x0,sx0,r.z0,r.z1,r.bottom,r.top);
 push(name+'-north',sx0,sx1,r.z0,sz0,r.bottom,r.top);
 push(name+'-south',sx0,sx1,sz1,r.z1,r.bottom,r.top);
 push(name+'-above',sx0,sx1,sz0,sz1,shaftTop,r.top);
 return out;
}

/* ------------------------------------------------------------------ */
/* The 5F landing                                                      */
/* ------------------------------------------------------------------ */

const WALL=L.wall-1e-6;                     // 0.12 m minus a hair: neighbouring boxes touch, never share a plane
const lobbyX1=L.x1+L.lobbyDepth;
const corridorX1=lobbyX1+L.corridorLength;
const corridorZ0=(L.z0+L.z1)/2-L.corridorWidth/2,corridorZ1=(L.z0+L.z1)/2+L.corridorWidth/2;
const doorMid=(L.z0+L.z1)/2,doorX0=corridorX1,doorX1=corridorX1+WALL;
const officeZ0=doorMid-L.officeDoor.width/2,officeZ1=doorMid+L.officeDoor.width/2;
const floorTop=L.landing,ceilBottom=L.landing+L.clearHeight;

export const LIFT_LANDING={lobbyX1,corridorX1,corridorZ0,corridorZ1,officeZ0,officeZ1,floorTop,ceilBottom};

/** Walkable 5F plate: the car footprint's lobby, then the corridor to the office door. */
export function liftLandingContains(x:number,z:number):boolean{
 if(x>=L.x1&&x<=lobbyX1&&z>=L.z0&&z<=L.z1)return true;
 return x>=lobbyX1&&x<=corridorX1&&z>=corridorZ0&&z<=corridorZ1;
}

/**
 * The 5F landing shell: two floor slabs, the lobby and corridor walls, the ceiling and a
 * closed office door with its lintel. All of it sits inside the band-tower mass's void, so
 * it needs no carve; the shaft west of `L.x1` is carved by `liftShaftSplit`.
 */
export function liftLandingBoxes():LiftBox[]{
 const out:LiftBox[]=[
  // Floors: a 0.30 m slab whose top is the landing, so physics lands on it like any prop.
  {name:'opening-lift-5f-floor-lobby',x0:L.x1,x1:lobbyX1,z0:L.z0,z1:L.z1,bottom:floorTop-.30,top:floorTop},
  {name:'opening-lift-5f-floor-corridor',x0:lobbyX1,x1:corridorX1,z0:corridorZ0,z1:corridorZ1,bottom:floorTop-.30,top:floorTop},
  // Lobby shell.
  {name:'opening-lift-5f-wall-north',x0:L.x1,x1:lobbyX1,z0:L.z0-WALL,z1:L.z0,bottom:floorTop,top:ceilBottom},
  {name:'opening-lift-5f-wall-south',x0:L.x1,x1:lobbyX1,z0:L.z1,z1:L.z1+WALL,bottom:floorTop,top:ceilBottom},
  // The lobby's east wall is the corridor's opening; only the two returns are solid.
  {name:'opening-lift-5f-return-north',x0:lobbyX1,x1:lobbyX1+WALL,z0:L.z0,z1:corridorZ0,bottom:floorTop,top:ceilBottom},
  {name:'opening-lift-5f-return-south',x0:lobbyX1,x1:lobbyX1+WALL,z0:corridorZ1,z1:L.z1,bottom:floorTop,top:ceilBottom},
  // Corridor shell.
  {name:'opening-lift-5f-corridor-north',x0:lobbyX1,x1:corridorX1,z0:corridorZ0-WALL,z1:corridorZ0,bottom:floorTop,top:ceilBottom},
  {name:'opening-lift-5f-corridor-south',x0:lobbyX1,x1:corridorX1,z0:corridorZ1,z1:corridorZ1+WALL,bottom:floorTop,top:ceilBottom},
  // Office door wall, split around the 1.00 × 2.20 m door.
  {name:'opening-lift-5f-office-wall-north',x0:doorX0,x1:doorX1,z0:corridorZ0-WALL,z1:officeZ0,bottom:floorTop,top:ceilBottom},
  {name:'opening-lift-5f-office-wall-south',x0:doorX0,x1:doorX1,z0:officeZ1,z1:corridorZ1+WALL,bottom:floorTop,top:ceilBottom},
  {name:'opening-lift-5f-office-lintel',x0:doorX0,x1:doorX1,z0:officeZ0,z1:officeZ1,bottom:floorTop+L.officeDoor.height,top:ceilBottom},
  // The closed leaf: 6 cm thick, centred in the wall.
  {name:'opening-lift-5f-office-door',x0:doorX0+.03,x1:doorX1-.03,z0:officeZ0+.01,z1:officeZ1-.01,bottom:floorTop,top:floorTop+L.officeDoor.height},
  // Ceilings.
  {name:'opening-lift-5f-ceiling-lobby',x0:L.x1,x1:lobbyX1,z0:L.z0,z1:L.z1,bottom:ceilBottom,top:ceilBottom+WALL},
  {name:'opening-lift-5f-ceiling-corridor',x0:lobbyX1,x1:corridorX1,z0:corridorZ0-WALL,z1:corridorZ1+WALL,bottom:ceilBottom,top:ceilBottom+WALL},
 ];
 return out;
}

/* ------------------------------------------------------------------ */
/* The live world                                                      */
/* ------------------------------------------------------------------ */

/** The one lift the opening world owns. A rebuild remounts into the new obstacle array. */
export const LIFT=createLift();

let mounted:{obstacles:Obstacle[];boxes:Obstacle[]}|null=null;

/** Move the mounted collision boxes to the car's current pose. No allocation, no rebuild. */
export function syncLiftObstacles():void{
 if(!mounted)return;
 const boxes=liftObstacleBoxes(LIFT.y,LIFT.doors);
 for(let i=0;i<boxes.length;i++){
  const b=boxes[i]!,o=mounted.boxes[i]!;
  o.x=(b.x0+b.x1)/2;o.z=(b.z0+b.z1)/2;o.w=b.x1-b.x0;o.d=b.z1-b.z0;o.bottom=b.bottom;o.top=b.top;
 }
}

/** Mount the car into a navigation obstacle list, replacing any earlier mount. */
export function mountLift(obstacles:Obstacle[]):void{
 if(mounted&&mounted.obstacles===obstacles){syncLiftObstacles();return;}
 if(mounted){
  for(const o of mounted.boxes){const i=mounted.obstacles.indexOf(o);if(i>=0)mounted.obstacles.splice(i,1);}
 }
 const boxes=liftObstacles(LIFT);
 obstacles.push(...boxes);
 mounted={obstacles,boxes};
 syncLiftObstacles();
}

/** The car's scenery, registered by `b4Shell` so the same tick moves the meshes. */
export interface LiftVisual{root:T.Object3D;leaves:T.Object3D[]}
let visual:LiftVisual|null=null;

export function attachLiftVisual(next:LiftVisual):void{
 visual=next;
 syncLiftVisual();
}

export function syncLiftVisual():void{
 if(!visual)return;
 if(visual.root.position.y!==LIFT.y)visual.root.position.y=LIFT.y;
 const slide=LIFT.doors*((L.door.z1-L.door.z0)/2);
 for(const leaf of visual.leaves){
  const closed=leaf.userData.closedZ;
  if(typeof closed!=='number')continue;
  const direction=leaf.userData.slideDirection===-1?-1:1;
  const z=closed+direction*slide;
  if(leaf.position.z!==z)leaf.position.z=z;
 }
}

/** Floor clock. `performance` exists in Node and in every browser this ships to. */
function nowSeconds():number{
 return (typeof performance!=='undefined'?performance.now():Date.now())/1000;
}
let lastAdvance=-1;
/** A rider can never be outrun: one query moves the car at most 5 cm. */
const MAX_RISE_PER_ADVANCE=.05;
const SLICE=1/240;

/**
 * Advance the lift from a world query. `x,z,y` are the queried point: a passenger is a
 * point inside the car footprint at the car floor. Queries that are not the player (the
 * camera, the path finder) are far from the car floor and do not call the car.
 */
export function advanceLift(now:number,x:number,z:number,y:number):void{
 if(lastAdvance<0){lastAdvance=now;return;}
 const dt=Math.min(.05,Math.max(0,now-lastAdvance));
 if(dt<=0)return;
 lastAdvance=now;
 const called=x>=L.x0&&x<=L.x1&&z>=L.z0&&z<=L.z1&&Math.abs(y-LIFT.y)<=.30;
 let remaining=dt;
 for(let i=0;i<12&&remaining>1e-6;i++){
  const before=LIFT.y;
  const slice=Math.min(remaining,SLICE);
  stepLift(LIFT,slice,called);
  remaining-=slice;
  if(LIFT.phase==='rising'&&LIFT.y-before>=MAX_RISE_PER_ADVANCE)break;
 }
 syncLiftObstacles();
 syncLiftVisual();
}

/** Advance the lift from a world query, using the wall clock. */
export function tickLift(x:number,z:number,y:number):void{advanceLift(nowSeconds(),x,z,y);}

/** Test seam: put the one lift back at the ground lobby, doors closed. */
export function resetLift():void{
 LIFT.phase='idle';LIFT.y=L.ground;LIFT.doors=0;
 clocks.delete(LIFT);
 syncLiftObstacles();
 syncLiftVisual();
}
