import * as T from 'three';
import {createOpeningRobot,type OpeningRobot,type OpeningRobotState} from './robot';
import {OPENING as O} from './spatialLayout';
import type {Navigation} from '../exploration/navigation';

/**
 * Thomas opening fleet: eight visible entrance guards, then physical deployment to B5/B6/B4 patrols.
 *
 * Each unit keeps the single-robot contract from `robot.ts` (shared
 * CharacterPhysics, visibility-gated chase, verified patrol legs). The manager only
 * aggregates their state; it never teleports or directly damages the player.
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
}

const PRIORITY:Record<OpeningRobotState,number>={patrol:0,scanning:1,search:2,chase:3,caught:4};

export function createOpeningFleet(world:Navigation):OpeningFleet{
 const root=new T.Group();root.name='Opening_robot_fleet';
 let peaceful=true;
 const units=O.robotRoutes.map((route,index)=>{
  const post=O.robotFormation[index];
  const approach:[number,number,number][]=[post,[post[0],0,-46],[58,0,-46],[58,0,-48]];
  if(index===5)approach.push([24,0,-48],[18,0,-48],[18,0,-26]);
  if(index===7)approach.push([24,0,-48],[24,0,-26],[24,0,-6],[24,0,14],[24,0,33.5],[50,0,33.5]);
  const unit=createOpeningRobot(world,{route,approach,startIndex:0,initialYaw:Math.PI,standby:()=>peaceful,id:'opening-robot-'+index,visualHz:8,rangeScale:.82,angleScale:.9,confirmScale:1.2,speedScale:.95});
  root.add(unit.root);
  return unit;
 });
 let last:OpeningFleetUpdate={caught:false,warning:0,state:'patrol',states:{},chasing:false};

 function update(dt:number,player:T.Vector3,active:boolean,paused:boolean):OpeningFleetUpdate{
  root.visible=active;
  if(peaceful&&active){peaceful=false;for(const unit of units)unit.update(0,player,active,true);}
  for(const unit of units)unit.root.visible=active;
  // Render reads reuse the last simulation aggregate; do not rebuild eight snapshots per frame.
  if(!active||paused||!(dt>0))return last;
  let caught=false,warning=0,best:OpeningRobotState='patrol';
  const states:Record<string,OpeningRobotState>={};
  for(const unit of units){
   const result=unit.update(dt,player,active,paused);
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
  standby(visible:boolean){root.visible=visible;if(!peaceful){peaceful=true;for(const unit of units)unit.update(0,unit.position,visible,true);}for(const unit of units)unit.root.visible=visible;return last;},
  reset(){for(const unit of units)unit.reset();last={caught:false,warning:0,state:'patrol',states:{},chasing:false};},
  dispose(){for(const unit of units)unit.dispose();root.removeFromParent();},
  units,
  get count(){return units.length;},
 };
}
