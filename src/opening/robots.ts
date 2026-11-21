import * as T from 'three';
import {createOpeningRobot,createOpeningRobotAssets,createOpeningRobotBlackboard,ROBOT,type OpeningRobot,type OpeningRobotState,type OpeningRobotBlackboard} from './robot';
import {OPENING as O} from './spatialLayout';
import type {Navigation} from '../exploration/navigation';

/**
 * Thomas opening fleet: eight visible entrance guards, then physical deployment to B5/B6/B4 patrols.
 *
 * Each unit keeps the single-robot contract from `robot.ts` (shared
 * CharacterPhysics, visibility-gated chase, verified patrol legs). The manager only
 * aggregates their state; it never teleports or directly damages the player.
 *
 * Fleet-level work lives here:
 *  - one shared shell pool (T25): eight units draw the same merged body/head buffers;
 *  - one blackboard (T28): a real sighting becomes a stale point plus an alert level;
 *  - shadow ranking (T26): only the nearest `ROBOT.shadowUnits` keep shadows and lights;
 *  - per-unit far update tiering (T27) is handled inside `robot.ts`.
 */

export interface OpeningFleetUpdate{
 caught:boolean;
 warning:number;
 state:OpeningRobotState;
 states:Record<string,OpeningRobotState>;
 chasing:boolean;
}

export interface OpeningFleet{
 root:T.Group;
 update(dt:number,player:T.Vector3,active:boolean,paused:boolean):OpeningFleetUpdate;
 reset():void;
 standby(visible:boolean):OpeningFleetUpdate;
 dispose():void;
 readonly units:readonly OpeningRobot[];
 readonly count:number;
 /** Shared awareness, exposed for the offline coordination checks. */
 readonly blackboard:OpeningRobotBlackboard;
}

const PRIORITY:Record<OpeningRobotState,number>={patrol:0,scanning:1,search:2,chase:3,caught:4};

export function createOpeningFleet(world:Navigation):OpeningFleet{
 const root=new T.Group();root.name='Opening_robot_fleet';
 const assets=createOpeningRobotAssets();
 const blackboard=createOpeningRobotBlackboard();
 let peaceful=true;
 const units=O.robotRoutes.map((route,index)=>{
  const post=O.robotFormation[index];
  const approach:[number,number,number][]=[post,[post[0],0,-46],[58,0,-46],[58,0,-48]];
  if(index===5)approach.push([24,0,-48],[18,0,-48],[18,0,-26]);
  if(index===7)approach.push([24,0,-48],[24,0,-26],[24,0,-6],[24,0,14],[24,0,33.5],[50,0,33.5]);
  const unit=createOpeningRobot(world,{route,approach,startIndex:0,initialYaw:Math.PI,standby:()=>peaceful,id:'opening-robot-'+index,visualHz:8,rangeScale:.82,angleScale:.9,confirmScale:1.2,speedScale:.95,assets,blackboard});
  root.add(unit.root);
  return unit;
 });
 let last:OpeningFleetUpdate={caught:false,warning:0,state:'patrol',states:{},chasing:false};

 /** Player position the shadow budget was last ranked against; standby reuses it. */
 const lastPlayer=new T.Vector3();
 {
  for(const post of O.robotFormation)lastPlayer.add(new T.Vector3(post[0],post[1],post[2]));
  lastPlayer.divideScalar(O.robotFormation.length);
 }
 const shadows=units.map(()=>true);
 let shadowClock=ROBOT.shadowInterval;
 const rankedAt=new T.Vector3(Number.POSITIVE_INFINITY,0,Number.POSITIVE_INFINITY);

 /**
  * Keep the nearest `ROBOT.shadowUnits` units shadowed and lit. The margin stops the
  * last slot from flapping while two units sit at almost the same distance.
  */
 const rankShadows=(player:T.Vector3)=>{
  const distances=units.map(unit=>Math.hypot(unit.position.x-player.x,unit.position.z-player.z));
  const order=distances.map((_,index)=>index).sort((a,b)=>distances[a]-distances[b]);
  const cutoff=distances[order[Math.min(order.length-1,ROBOT.shadowUnits-1)]];
  const keep=new Set<number>(order.slice(0,ROBOT.shadowUnits));
  for(let index=0;index<units.length;index++){
   if(keep.has(index))continue;
   if(shadows[index]&&distances[index]<=cutoff+ROBOT.shadowHysteresis)keep.add(index);
  }
  const chosen=new Set([...keep].sort((a,b)=>distances[a]-distances[b]).slice(0,ROBOT.shadowUnits));
  for(let index=0;index<units.length;index++)shadows[index]=chosen.has(index);
 };

 function update(dt:number,player:T.Vector3,active:boolean,paused:boolean):OpeningFleetUpdate{
  root.visible=active;
  lastPlayer.copy(player);
  // Re-rank at a low fixed rate (and after a real move) so the last shadow slot cannot flap.
  shadowClock+=Math.max(0,dt);
  if(shadowClock>=ROBOT.shadowInterval||rankedAt.distanceToSquared(player)>0.25){
   shadowClock=0;rankedAt.copy(player);rankShadows(player);
  }
  if(peaceful&&active){peaceful=false;for(const [index,unit] of units.entries())unit.update(0,player,active,true,shadows[index]);}
  for(const unit of units)unit.root.visible=active;
  // Render reads reuse the last simulation aggregate; do not rebuild eight snapshots per frame.
  if(!active||paused||!(dt>0))return last;
  blackboard.tick(dt);
  let caught=false,warning=0,best:OpeningRobotState='patrol';
  const states:Record<string,OpeningRobotState>={};
  for(const [index,unit] of units.entries()){
   const result=unit.update(dt,player,active,paused,shadows[index]);
   const id=String(unit.root.userData.fleetId??unit.root.name);
   states[id]=result.state;
   caught=caught||result.caught;
   warning=Math.max(warning,result.warning);
   if(PRIORITY[result.state]>PRIORITY[best])best=result.state;
  }
  last={caught,warning,state:best,states,chasing:Object.values(states).some(s=>s==='chase'||s==='caught')};
  return last;
 }
 return{
  root,
  update,
  standby(visible:boolean){
   root.visible=visible;
   rankShadows(lastPlayer);
   if(!peaceful){peaceful=true;for(const [index,unit] of units.entries())unit.update(0,lastPlayer,visible,true,shadows[index]);}
   for(const [index,unit] of units.entries())unit.root.visible=visible;
   return last;
  },
  reset(){
   for(const unit of units)unit.reset();
   blackboard.reset();
   last={caught:false,warning:0,state:'patrol',states:{},chasing:false};
  },
  dispose(){
   for(const unit of units)unit.dispose();
   assets.dispose();
   root.removeFromParent();
  },
  units,
  blackboard,
  get count(){return units.length;},
 };
}
