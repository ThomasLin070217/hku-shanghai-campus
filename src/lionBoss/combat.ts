import {LION, lionBodySize} from '../model/lionParameters';
import {EXPLORATION} from '../exploration/config';
import {COOLDOWN, evaluateSkill, LURE_WINDOW, STUN_WINDOW, type SkillKind, type SkillRule} from './rules';

export interface Point {x:number; z:number}
export const BOSS:Point = {x:LION.x,z:LION.z};
const offset = (x:number,z:number):Point => ({x:BOSS.x+x,z:BOSS.z+z});
export const SAFE = offset(1,11);
export const NODES = [
  {...offset(-2,6),name:'验证维修身份',kind:'stun'},
  {...offset(5,1),name:'隔离感染指令',kind:'lure'},
  {...offset(1,-6.5),name:'恢复识别配置',kind:'stun'},
] as const;
export function checkpoint(repaired:number):Point {
  return [offset(-1,7),offset(4.8,3),offset(1,-7)][repaired] ?? {...SAFE};
}

export const CHARGE_LENGTH = 9;
const bodySize = lionBodySize();
export const CHARGE_HALF_WIDTH = bodySize.width/2 + Math.abs(bodySize.xOffset) + EXPLORATION.radius;
const frontReach = bodySize.depth/2 + bodySize.zOffset + EXPLORATION.radius;
const backReach = bodySize.depth/2 - bodySize.zOffset + EXPLORATION.radius;
const chargeTravel = CHARGE_LENGTH - frontReach;
export const SWIPE_RADIUS = 5.2;
export const SWIPE_HALF_ANGLE = Math.PI * .31;
export const SUBMIT_RADIUS = 2;
export const CHARGE_WARNING = 1.25;
export const SWIPE_WARNING = .9;
const CHARGE_TIME = .75;
const LURE_STRIKE = 2.5;

export type Phase = 'safe'|'ready'|'chargeWarn'|'charge'|'chargeRecover'|'swipeWarn'|'swipeRecover'|'stunned'|'helperRun'|'lured'|'return'|'complete';
export interface CombatState {
  phase:Phase; remaining:number; repaired:number; submit:number; elapsed:number;
  lion:Point; helper:Point; helperTarget:Point; yaw:number; helperYaw:number;
  origin:Point; cooldown:Record<SkillKind,number>;
}
const distance = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.z-b.z);
const face = (a:Point,b:Point) => Math.atan2(b.x-a.x,b.z-a.z);
function moveToward(p:Point,to:Point,speed:number,dt:number) {
  const d = distance(p,to);
  if (d < .001) return true;
  const k = Math.min(1,speed * dt / d);
  p.x += (to.x-p.x)*k;
  p.z += (to.z-p.z)*k;
  return k === 1;
}
export function inSwipe(origin:Point,yaw:number,player:Point) {
  const dx=player.x-origin.x,dz=player.z-origin.z;
  const d=Math.hypot(dx,dz);
  return d<=SWIPE_RADIUS && dx*Math.sin(yaw)+dz*Math.cos(yaw)>=d*Math.cos(SWIPE_HALF_ANGLE);
}
export function canSubmit(state:CombatState) {
  const required=NODES[state.repaired]?.kind;
  return (state.phase==='stunned' && required==='stun') || (state.phase==='lured' && required==='lure');
}

function initial(repaired:number):CombatState {
  return {
    phase:repaired===3?'complete':'safe',remaining:0,repaired,submit:0,elapsed:0,
    lion:{...BOSS},helper:offset(-3,8),helperTarget:offset(-3,8),yaw:LION.yaw,helperYaw:Math.PI,
    origin:{...BOSS},cooldown:{stun:0,lure:0},
  };
}

export function createCombat(repaired=0) {
  const state = initial(repaired);
  function setPhase(phase:Phase,duration:number) {
    state.phase=phase;
    state.remaining=duration;
    state.submit=0;
  }
  function reset(done:number) {
    Object.assign(state,initial(done));
  }
  function start() {
    if (state.phase==='safe') setPhase('ready',1.4);
  }
  function cast(rule:SkillRule,player:Point) {
    const result = evaluateSkill(rule,{
      phase:state.phase,distance:distance(state.lion,player),cooldown:state.cooldown[rule.kind],
      helperReady:state.phase!=='helperRun' && state.phase!=='lured',
    });
    if (!result.ok) return result;
    state.cooldown[rule.kind]=COOLDOWN;
    if (rule.kind==='stun') setPhase('stunned',STUN_WINDOW);
    else {
      // The side is relative to the player's view toward L001 at cast time.
      const sideYaw=face(state.lion,player)+(rule.side==='left'?-Math.PI/2:Math.PI/2);
      state.helperTarget={x:state.lion.x+4*Math.sin(sideYaw),z:state.lion.z+4*Math.cos(sideYaw)};
      state.helperYaw=face(state.helper,state.helperTarget);
      setPhase('helperRun',0);
    }
    return result;
  }

  function step(dt:number,player:Point,holdingF:boolean):'hit'|'repair'|null {
    if (!Number.isFinite(dt) || dt<=0) return null;
    state.elapsed+=dt;
    if (state.phase==='safe' || state.phase==='complete') return null;
    const before=state.remaining;
    state.remaining=Math.max(0,before-dt);
    state.cooldown.stun=Math.max(0,state.cooldown.stun-dt);
    state.cooldown.lure=Math.max(0,state.cooldown.lure-dt);
    if (state.phase!=='helperRun' && state.phase!=='lured') {
      // Follow a little to the side so the path to a maintenance node stays clear.
      const follow={x:player.x-1.4,z:player.z+1.3};
      if(distance(state.helper,follow)>.25) {
        state.helperYaw=face(state.helper,follow);
        moveToward(state.helper,follow,4,dt);
      }
    }
    switch(state.phase) {
      case 'ready': {
        const range=distance(state.lion,player);
        state.yaw=face(state.lion,player);
        if (state.remaining>0 || range>10) break;
        const swipe=range<=(state.repaired===1?6.4:4);
        state.origin={...state.lion};
        setPhase(swipe?'swipeWarn':'chargeWarn',swipe?SWIPE_WARNING:CHARGE_WARNING);
        break;
      }
      case 'chargeWarn':
        if (state.remaining===0) setPhase('charge',CHARGE_TIME);
        break;
      case 'charge': {
        const dx=Math.sin(state.yaw),dz=Math.cos(state.yaw);
        const travel=chargeTravel*(1-state.remaining/CHARGE_TIME);
        state.lion.x=state.origin.x+dx*travel;
        state.lion.z=state.origin.z+dz*travel;
        const px=player.x-state.origin.x,pz=player.z-state.origin.z;
        const along=px*dx+pz*dz;
        const previousTravel=chargeTravel*(1-before/CHARGE_TIME);
        if (along>=Math.max(0,previousTravel-backReach) && along<=travel+frontReach &&
            Math.abs(px*dz-pz*dx)<=CHARGE_HALF_WIDTH) return 'hit';
        if (state.remaining===0) setPhase('chargeRecover',1.8);
        break;
      }
      case 'swipeWarn':
        if (state.remaining===0) {
          setPhase('swipeRecover',1.5);
          if (inSwipe(state.lion,state.yaw,player)) return 'hit';
        }
        break;
      case 'chargeRecover':
      case 'swipeRecover':
        if (state.remaining===0) setPhase('return',0);
        break;
      case 'helperRun':
        if (moveToward(state.helper,state.helperTarget,7,dt)) {
          state.yaw=face(state.lion,state.helper);
          setPhase('lured',LURE_WINDOW);
        }
        break;
      case 'lured':
        if (before>LURE_STRIKE && state.remaining<=LURE_STRIKE && inSwipe(state.lion,state.yaw,player)) return 'hit';
        break;
      case 'return':
        if (distance(state.lion,BOSS)>.05) state.yaw=face(state.lion,BOSS);
        if (moveToward(state.lion,BOSS,4.5,dt)) setPhase('ready',.85);
        break;
    }
    if (state.phase==='stunned' || state.phase==='lured') {
      if (state.remaining<=0) {setPhase('return',0);return null;}
      if (holdingF && canSubmit(state) && distance(player,NODES[state.repaired])<=SUBMIT_RADIUS) {
        state.submit=Math.min(1,state.submit+dt);
        if (state.submit>=1-1e-6) {
          state.repaired++;
          setPhase(state.repaired===3?'complete':'safe',0);
          state.elapsed=0;
          state.cooldown={stun:0,lure:0};
          return 'repair';
        }
      } else state.submit=0;
    }
    return null;
  }
  return {state,start,reset,step,cast};
}
