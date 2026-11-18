import type {CharacterPhysics,Intent} from './physics';
import type {Navigation} from './navigation';
import {findPath} from './pathfind';
import {EXPLORATION as C} from './config';
export type Vec3=[number,number,number];
export type Directive =
 | {type:'walkTo';position:Vec3;toleranceM?:number;sprint?:boolean;path?:Vec3[]}
 | {type:'approach';position:Vec3;stopDistanceM?:number;sprint?:boolean}
 | {type:'lookAt';position:Vec3;toleranceDeg?:number}
 | {type:'followPath';path:Vec3[];sprint?:boolean;toleranceM?:number};
export interface DirectiveSnapshot {
 type:Directive['type'];
 reached:boolean;
 distanceRemaining:number;
 lookErrorDeg:number;
 waypoints:number;
 progress:number;
 reason?:string;
}
export interface DirectiveStep {
 intent:Intent;
 yaw:number;
 pitch:number;
 jump:boolean;
 done:boolean;
 reached:boolean;
 distanceRemaining:number;
 lookErrorDeg:number;
 reason?:string;
}
export interface DirectiveState {world:Navigation;body:CharacterPhysics;yaw:number;pitch:number}
const DEG=Math.PI/180,TURN=540*DEG,ARRIVE=.35,STOP=2.4,LOOK_TOL=2,WAYPOINT=.35,FOLLOW_PASS=.8,MAX_MS=30000;
const idle=():Intent=>({forward:0,right:0,sprint:false});
const clamp=(v:number,a:number,b:number)=>v<a?a:v>b?b:v;
const wrap=(a:number)=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
const r3=(v:number)=>Math.round(v*1000)/1000,r1=(v:number)=>Math.round(v*10)/10;
const num=(v:unknown,min=-1e6,max=1e6)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const vec3=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&num(v[0])&&num(v[1])&&num(v[2]);
const path3=(v:unknown):v is Vec3[]=>Array.isArray(v)&&v.length>=1&&v.length<=64&&v.every(vec3);
const only=(d:Record<string,unknown>,keys:string[])=>Object.keys(d).every(k=>keys.includes(k));

export function validDirective(value:unknown):value is Directive{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const d=value as Record<string,unknown>;
 if(typeof d.type!=='string')return false;
 switch(d.type){
  case 'walkTo':
   return only(d,['type','position','entityId','toleranceM','sprint','path'])&&vec3(d.position)
    &&(d.toleranceM===undefined||num(d.toleranceM,.05,10))&&(d.sprint===undefined||typeof d.sprint==='boolean')
    &&(d.path===undefined||path3(d.path));
  case 'approach':
   return only(d,['type','position','entityId','stopDistanceM','sprint'])&&vec3(d.position)
    &&(d.stopDistanceM===undefined||num(d.stopDistanceM,.3,20))&&(d.sprint===undefined||typeof d.sprint==='boolean');
  case 'lookAt':
   return only(d,['type','position','entityId','toleranceDeg'])&&vec3(d.position)
    &&(d.toleranceDeg===undefined||num(d.toleranceDeg,.5,90));
  case 'followPath':
   return only(d,['type','path','sprint','toleranceM'])&&path3(d.path)
    &&(d.sprint===undefined||typeof d.sprint==='boolean')&&(d.toleranceM===undefined||num(d.toleranceM,.05,10));
  default:return false;
 }
}

/** Executes one semantic directive over fixed steps; it only emits the same intent a keyboard would. */
export class DirectiveRunner{
 readonly directive:Directive;
 readonly startedAt:number;
 private planned=false;private path:Vec3[]=[];private index=0;private phase:'walk'|'look';
 private elapsed=0;private done=false;private reached=false;private reason?:string;private failure?:string;
 private distance=0;private distance0=0;private lookErr=0;private lookErr0=0;
 private progressPos:{x:number;z:number}|null=null;private idleTime=0;private partial=false;private waypoints=0;
 constructor(directive:Directive,now:number){
  this.directive=directive;this.startedAt=now;
  this.phase=directive.type==='lookAt'?'look':'walk';
  this.waypoints=directive.type==='followPath'?directive.path.length:0;
 }
 get elapsedMs(){return this.elapsed;}
 get finished(){return this.done;}
 step(dt:number,state:DirectiveState):DirectiveStep{
  const s=Number.isFinite(dt)&&dt>0?Math.min(dt,.25):0;
  if(this.done)return this.emit(idle(),state.yaw,state.pitch);
  this.elapsed+=s*1000;
  if(this.elapsed>MAX_MS)return this.end('timeout',false,idle(),state.yaw,state.pitch);
  return this.directive.type==='lookAt'||this.phase==='look'?this.stepLook(s,state):this.stepWalk(s,state);
 }
 snapshot():DirectiveSnapshot{
  return{type:this.directive.type,reached:this.reached,distanceRemaining:r3(this.distance),lookErrorDeg:r1(this.lookErr),waypoints:this.waypoints,progress:r3(this.progress()),...(this.reason?{reason:this.reason}:{})};
 }
 private emit(intent:Intent,yaw:number,pitch:number):DirectiveStep{
  return{intent,yaw,pitch,jump:false,done:this.done,reached:this.reached,distanceRemaining:this.distance,lookErrorDeg:this.lookErr,...(this.reason?{reason:this.reason}:{})};
 }
 private end(reason:string,reached:boolean,intent:Intent,yaw:number,pitch:number):DirectiveStep{
  this.done=true;this.reached=reached;this.reason=reason;
  return this.emit(intent,yaw,pitch);
 }
 private progress():number{
  if(this.reached)return 1;
  if(this.directive.type==='lookAt'||this.phase==='look')return this.lookErr0>0?clamp(1-this.lookErr/this.lookErr0,0,.99):0;
  return this.distance0>0?clamp(1-this.distance/this.distance0,0,.99):0;
 }
 private planWalk(world:Navigation,pos:{x:number;y:number;z:number}){
  this.planned=true;
  const d=this.directive;
  if(d.type==='walkTo'&&d.path&&d.path.length){
   this.path=d.path.map(p=>[p[0],p[1],p[2]] as Vec3);this.partial=false;this.waypoints=this.path.length;return;
  }
  const target:Vec3=d.type==='followPath'?d.path[d.path.length-1]:d.position;
  const result=findPath(world,[pos.x,pos.y,pos.z],target,{clearance:C.radius,maxStepHeight:C.maxStep,maxDrop:C.maxDrop});
  this.path=result.path.map(p=>[p[0],p[1],p[2]] as Vec3);
  this.partial=!result.ok;this.waypoints=this.path.length;
  if(!result.ok&&this.path.length<2)this.failure='unreachable';
 }
 private aimPoint():Vec3|null{
  const d=this.directive;
  if(this.path.length===0)return d.type==='followPath'?null:d.position;
  if(d.type==='followPath')return this.path[Math.min(this.index,this.path.length-1)];
  if(this.index>=this.path.length-1&&this.partial)return d.position;
  return this.path[Math.min(this.index,this.path.length-1)];
 }
 private stepWalk(dt:number,state:DirectiveState):DirectiveStep{
  const d=this.directive,pos=state.body.position;
  if(d.type==='lookAt')return this.end('goal_reached',false,idle(),state.yaw,state.pitch);
  if(d.type==='followPath'){
   if(!this.planned){this.planned=true;this.path=d.path.map(p=>[p[0],p[1],p[2]] as Vec3);this.waypoints=this.path.length;}
   if(this.path.length===0)return this.end('goal_reached',true,idle(),state.yaw,state.pitch);
  }else if(!this.planned){
   this.planWalk(state.world,pos);
   if(this.failure)return this.end(this.failure,false,idle(),state.yaw,state.pitch);
  }
  const goal:Vec3=d.type==='followPath'?(this.path[this.path.length-1]??d.path[0]):d.position;
  const tolerance=d.type==='walkTo'?(d.toleranceM??ARRIVE):d.type==='approach'?(d.stopDistanceM??STOP):(d.toleranceM??ARRIVE);
  this.distance=Math.hypot(goal[0]-pos.x,goal[2]-pos.z);
  if(this.distance0<=0)this.distance0=Math.max(this.distance,.001);
  if(this.distance<=tolerance){
   if(d.type==='approach'){this.phase='look';this.lookErr0=0;return this.emit(idle(),state.yaw,state.pitch);}
   return this.end('goal_reached',true,idle(),state.yaw,state.pitch);
  }
  const pass=d.type==='followPath'?FOLLOW_PASS:WAYPOINT;
  while(this.index<this.path.length-1){
   const p=this.path[this.index];
   if(Math.hypot(p[0]-pos.x,p[2]-pos.z)>pass)break;
   this.index++;
  }
  const aim=this.aimPoint();
  if(!aim)return this.end('unreachable',false,idle(),state.yaw,state.pitch);
  // 2 s without 0.25 m displacement means it is pushing a wall.
  if(!this.progressPos)this.progressPos={x:pos.x,z:pos.z};
  if(Math.hypot(pos.x-this.progressPos.x,pos.z-this.progressPos.z)>=.25){this.progressPos={x:pos.x,z:pos.z};this.idleTime=0;}
  else this.idleTime+=dt;
  if(this.idleTime>=2)return this.end('stuck',false,idle(),state.yaw,state.pitch);
  const dx=aim[0]-pos.x,dz=aim[2]-pos.z,len=Math.hypot(dx,dz);
  let yaw=state.yaw;
  if(len>1e-6)yaw+=clamp(wrap(Math.atan2(-dx,-dz)-yaw),-TURN*dt,TURN*dt);
  let f=0,r=0;
  if(len>1e-6){const ux=dx/len,uz=dz/len,fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
   f=ux*fx+uz*fz;r=ux*rx+uz*rz;const m=Math.hypot(f,r);if(m>1){f/=m;r/=m;}}
  return this.emit({forward:f,right:r,sprint:!!d.sprint},yaw,state.pitch);
 }
 private stepLook(dt:number,state:DirectiveState):DirectiveStep{
  const d=this.directive;
  if(d.type!=='lookAt'&&d.type!=='approach')return this.end('goal_reached',false,idle(),state.yaw,state.pitch);
  const pos=state.body.position,goal=d.position,eyeY=pos.y+C.eyeHeight;
  const dx=goal[0]-pos.x,dy=goal[1]-eyeY,dz=goal[2]-pos.z;
  this.distance=Math.hypot(dx,dz);
  if(this.lookErr0<=0)this.lookErr0=Math.max(this.lookErrorTo(state.yaw,state.pitch,dx,dy,dz),1e-3);
  const desiredYaw=Math.atan2(-dx,-dz),desiredPitch=clamp(Math.atan2(-dy,Math.hypot(dx,dz)),C.minPitch,C.maxPitch);
  const yaw=state.yaw+clamp(wrap(desiredYaw-state.yaw),-TURN*dt,TURN*dt);
  const pitch=clamp(state.pitch+clamp(desiredPitch-state.pitch,-TURN*dt,TURN*dt),C.minPitch,C.maxPitch);
  this.lookErr=this.lookErrorTo(yaw,pitch,dx,dy,dz);
  const tolerance=d.type==='lookAt'?(d.toleranceDeg??LOOK_TOL):LOOK_TOL;
  if(this.lookErr<=tolerance)return this.end('goal_reached',true,idle(),yaw,pitch);
  return this.emit(idle(),yaw,pitch);
 }
 private lookErrorTo(yaw:number,pitch:number,dx:number,dy:number,dz:number):number{
  const len=Math.hypot(dx,dy,dz);
  if(len<1e-6)return 0;
  const fx=-Math.sin(yaw)*Math.cos(pitch),fy=-Math.sin(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);
  return Math.acos(clamp((fx*dx+fy*dy+fz*dz)/len,-1,1))/DEG;
 }
}
