import {LION,lionBodySize} from '../model/lionParameters';
import {EXPLORATION} from '../exploration/config';
import {evaluateSkill,type SkillKind,type SkillRule} from './rules';
import {DEFAULT_RANGE,SKILL_SPECS} from './skillCatalog';

export interface Point {x:number;z:number}
export const BOSS:Point={x:LION.x,z:LION.z};
const offset=(x:number,z:number):Point=>({x:BOSS.x+x,z:BOSS.z+z});
export const SAFE=offset(1,11);
export const NODES=[
  {...offset(-2,6),id:'defense_lock_a',name:'Defense lock A',hold:1.35},
  {...offset(5,1),id:'defense_lock_b',name:'Defense lock B',hold:1.35},
  {...offset(1,-6.5),id:'ai_core_power',name:'AI core power',hold:1.8},
] as const;
export function checkpoint(repaired:number):Point {
  return [offset(-1,7),offset(4.8,3),offset(1,-7)][repaired]??{...SAFE};
}

export const CHARGE_LENGTH=9;
const bounds=lionBodySize();
export const CHARGE_HALF_WIDTH=bounds.width/2+Math.abs(bounds.xOffset)+EXPLORATION.radius;
const frontReach=bounds.depth/2+bounds.zOffset+EXPLORATION.radius;
const backReach=bounds.depth/2-bounds.zOffset+EXPLORATION.radius;
const chargeTravel=CHARGE_LENGTH-frontReach;
export const SWIPE_RADIUS=5.2;
export const SWIPE_HALF_ANGLE=Math.PI*.31;
export const SUBMIT_RADIUS=2;
export const CHARGE_WARNING=1.35;
export const SWIPE_WARNING=1.05;
export const AWAKEN_SECONDS=2.4;
const CHARGE_TIME=.82;
const LEASH=15;
const patrolRoute=[offset(-3,2.5),offset(2.8,2),offset(2,-3.8),offset(-2.8,-2.2)];

export type Phase='safe'|'awakening'|'patrol'|'alert'|'chase'|'chargeWarn'|'charge'|'chargeRecover'|'swipeWarn'|'swipeRecover'|'stunned'|'helperRun'|'lured'|'ghosted'|'return'|'complete';
export interface CombatState {
  phase:Phase;remaining:number;repaired:number;submit:number;elapsed:number;awakened:boolean;
  lion:Point;helper:Point;helperTarget:Point;signal:Point|null;yaw:number;helperYaw:number;
  origin:Point;cooldown:Record<SkillKind,number>;target:'player'|'helper'|'signal'|null;
}
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const face=(a:Point,b:Point)=>Math.atan2(b.x-a.x,b.z-a.z);
function turn(from:number,to:number,step:number) {
  const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
  return Math.abs(delta)<=step?to:from+Math.sign(delta)*step;
}
function moveToward(p:Point,to:Point,speed:number,dt:number,stopDistance=0) {
  const d=distance(p,to),travel=Math.max(0,d-stopDistance);
  if(travel<=.005)return true;
  const step=Math.min(travel,speed*dt)/d;
  p.x+=(to.x-p.x)*step;p.z+=(to.z-p.z)*step;
  return travel<=speed*dt;
}
export function inSwipe(origin:Point,yaw:number,player:Point) {
  const dx=player.x-origin.x,dz=player.z-origin.z,d=Math.hypot(dx,dz);
  return d<=SWIPE_RADIUS && dx*Math.sin(yaw)+dz*Math.cos(yaw)>=d*Math.cos(SWIPE_HALF_ANGLE);
}
export function canSubmit(s:CombatState) {
  return s.repaired<NODES.length && (s.phase==='stunned'||s.phase==='lured'||s.phase==='ghosted');
}
export function atMaintenance(p:Point){return distance(p,SAFE)<=2.5;}
function detects(s:CombatState,p:Point){
  const d=distance(s.lion,p);
  if(atMaintenance(p)||distance(p,BOSS)>LEASH||d>10+s.repaired*1.2)return false;
  const alignment=(p.x-s.lion.x)*Math.sin(s.yaw)+(p.z-s.lion.z)*Math.cos(s.yaw);
  return d<=3.6||alignment>=d*Math.cos((65+5*s.repaired)*Math.PI/180);
}
function initial(done:number):CombatState {
  const repaired=Number.isInteger(done)?Math.max(0,Math.min(NODES.length,done)):0;
  return {phase:repaired===3?'complete':'safe',remaining:0,repaired,submit:0,elapsed:0,awakened:repaired>0,
    lion:{...BOSS},helper:offset(-3,8),helperTarget:offset(-3,8),signal:null,yaw:LION.yaw,helperYaw:Math.PI,
    origin:{...BOSS},cooldown:{stun:0,lure:0,ghost:0},target:null};
}
export function createCombat(repaired=0) {
  const state=initial(repaired);
  let patrolIndex=0;
  function transition(phase:Phase,remaining=0,target:CombatState['target']=null){
    state.phase=phase;state.remaining=remaining;state.target=target;state.submit=0;
    if(phase!=='ghosted')state.signal=null;
  }
  function reset(done:number) {
    Object.assign(state,initial(done));patrolIndex=0;
  }
  function awaken(){
    if(state.phase==='safe'&&!state.awakened){state.awakened=true;transition('awakening',AWAKEN_SECONDS,'player');}
  }
  function start(){
    if(state.phase==='safe'){state.awakened=true;transition('patrol');}
  }
  function check(rule:SkillRule,player:Point,signalPoint?:Point) {
    if(atMaintenance(player))return {ok:false,message:'Leave the maintenance area before sending skills to the lawn devices.'};
    const result=evaluateSkill(rule,{phase:state.phase,distance:distance(state.lion,player),cooldown:state.cooldown[rule.kind],
      helperReady:distance(state.helper,player)<=(rule.maxRange??DEFAULT_RANGE)&&state.target!=='helper'});
    if(result.ok&&rule.kind==='ghost'&&signalPoint&&
       (!Number.isFinite(signalPoint.x)||!Number.isFinite(signalPoint.z)||distance(signalPoint,BOSS)>LEASH||distance(signalPoint,player)>(rule.maxRange??DEFAULT_RANGE)+1e-6)){
      return {ok:false,message:'The beacon must land on the lawn within the skill range.'};
    }
    return result;
  }
  function flank(rule:SkillRule,player:Point) {
    const angle=face(state.lion,player)+(rule.side==='left'?-1:1)*Math.PI/2;
    const point={x:state.lion.x+5.5*Math.sin(angle),z:state.lion.z+5.5*Math.cos(angle)};
    // The projected flank stays on the lawn, including when the lion is near its leash.
    if(distance(point,BOSS)>LEASH)moveToward(point,BOSS,Infinity,1,LEASH);
    return point;
  }
  function cast(rule:SkillRule,player:Point,signalPoint?:Point) {
    const result=check(rule,player,signalPoint);
    if(!result.ok)return result;
    const spec=SKILL_SPECS[rule.kind];
    state.cooldown[rule.kind]=spec.cooldown;
    if(rule.kind==='stun')transition('stunned',spec.duration);
    else if(rule.kind==='lure'){
      state.helperTarget=flank(rule,player);
      state.helperYaw=face(state.helper,state.helperTarget);
      transition('helperRun',spec.duration,'helper');
    }else{
      transition('ghosted',spec.duration,'signal');
      state.signal=signalPoint?{...signalPoint}:flank(rule,player);
    }
    return result;
  }
  function pursue(point:Point,speed:number,dt:number,stopDistance=0){
    if(distance(state.lion,point)>stopDistance+.005){
      state.yaw=turn(state.yaw,face(state.lion,point),dt*3.4);
      moveToward(state.lion,point,speed,dt,stopDistance);
    }
  }
  function step(dt:number,player:Point,holding:boolean):'hit'|'repair'|null{
    if(!Number.isFinite(dt)||dt<=0||state.phase==='safe'||state.phase==='complete')return null;
    const before=state.remaining;
    state.elapsed+=dt;state.remaining=Math.max(0,before-dt);
    for(const id of ['stun','lure','ghost'] as const)state.cooldown[id]=Math.max(0,state.cooldown[id]-dt);
    if(state.phase==='awakening'){
      state.yaw=turn(state.yaw,face(state.lion,player),dt*1.6);
      if(!state.remaining)transition('safe');
      return null;
    }
    if(state.target!=='helper'){
      const follow={x:player.x-1.5,z:player.z+1.3};
      if(distance(state.helper,follow)>.6){
        state.helperYaw=face(state.helper,follow);moveToward(state.helper,follow,6,dt,.4);
      }
    }
    switch(state.phase){
      case 'patrol':{
        if(detects(state,player)){transition('alert',Math.max(.45,.9-state.repaired*.16),'player');break;}
        const waypoint=patrolRoute[patrolIndex];pursue(waypoint,1.1+state.repaired*.2,dt);
        if(distance(state.lion,waypoint)<.08)patrolIndex=(patrolIndex+1)%patrolRoute.length;
        break;
      }
      case 'alert':
        if(atMaintenance(player)||distance(player,BOSS)>LEASH){transition('return');break;}
        state.yaw=turn(state.yaw,face(state.lion,player),dt*3.4);
        if(!state.remaining)transition('chase',0,'player');
        break;
      case 'chase':{
        if(atMaintenance(player)||distance(player,BOSS)>LEASH){transition('return');break;}
        const d=distance(state.lion,player);
        if(d>7){pursue(player,2.8+state.repaired*.36,dt,6.8);break;}
        const swipe=d<=4.45;
        state.origin={...state.lion};state.yaw=face(state.lion,player);
        transition(swipe?'swipeWarn':'chargeWarn',(swipe?SWIPE_WARNING:CHARGE_WARNING)-state.repaired*.075,'player');
        break;
      }
      case 'chargeWarn':
        if(!state.remaining)transition('charge',CHARGE_TIME,'player');
        break;
      case 'charge':{
        const dx=Math.sin(state.yaw),dz=Math.cos(state.yaw),travel=chargeTravel*(1-state.remaining/CHARGE_TIME);
        state.lion.x=state.origin.x+dx*travel;state.lion.z=state.origin.z+dz*travel;
        const px=player.x-state.origin.x,pz=player.z-state.origin.z,along=px*dx+pz*dz;
        const previous=chargeTravel*(1-before/CHARGE_TIME);
        const hit=!atMaintenance(player)&&along>=Math.max(0,previous-backReach)&&along<=travel+frontReach&&Math.abs(px*dz-pz*dx)<=CHARGE_HALF_WIDTH;
        if(hit||!state.remaining)transition('chargeRecover',1.75-state.repaired*.15);
        if(hit)return 'hit';
        break;
      }
      case 'swipeWarn':
        if(!state.remaining){
          transition('swipeRecover',1.5-state.repaired*.12);
          if(!atMaintenance(player)&&inSwipe(state.lion,state.yaw,player))return 'hit';
        }
        break;
      case 'swipeRecover':case 'chargeRecover':
        if(!state.remaining)transition('return');
        break;
      case 'helperRun':
        if(!state.remaining){transition('return');break;}
        if(moveToward(state.helper,state.helperTarget,7.5,dt))transition('lured',state.remaining,'helper');
        pursue(state.helper,2.8,dt,2.55);
        break;
      case 'lured':
        pursue(state.helper,2.8,dt,2.55);
        break;
      case 'ghosted':
        if(state.signal)pursue(state.signal,3.2,dt,1.85);
        break;
      case 'return':
        pursue(BOSS,3.1,dt);if(distance(state.lion,BOSS)<.06)transition('patrol');
        break;
    }
    if(!canSubmit(state))return null;
    if(!state.remaining){transition('return');return null;}
    const node=NODES[state.repaired];
    if(!holding||distance(node,player)>SUBMIT_RADIUS){state.submit=0;return null;}
    state.submit=Math.min(1,state.submit+dt/node.hold);
    if(state.submit<1-1e-6)return null;
    state.repaired++;
    if(state.repaired===NODES.length)transition('complete');
    else state.submit=0;
    return 'repair';
  }
  return {state,awaken,start,reset,step,check,cast};
}
