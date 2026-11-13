import * as T from 'three';
import {EXPLORATION as C} from './config';
import type {Navigation} from './navigation';
export interface Intent {forward:number;right:number;sprint:boolean}
export interface Contact {type:'wall'|'ceiling'|'landed'|'boundary';id:string}
/** Fixed-step kinematic cylinder. Both input sources use this exact integrator. */
export class CharacterPhysics {
 position=new T.Vector3();velocity=new T.Vector3();grounded=true;contacts:Contact[]=[];landed=false;distance=0;
 constructor(public world:Navigation){}
 step(dt:number,intent:Intent,yaw:number,jump:boolean){
  this.contacts=[];this.landed=false;const p=this.position,old=p.clone();
  if(jump&&this.grounded){this.velocity.y=C.jumpSpeed;this.grounded=false;}
  const axis=new T.Vector2(intent.right,intent.forward);if(axis.length()>1)axis.normalize();const speed=intent.sprint?C.sprintSpeed:C.speed;
  const vx=(Math.cos(yaw)*axis.x-Math.sin(yaw)*axis.y)*speed,vz=(-Math.sin(yaw)*axis.x-Math.cos(yaw)*axis.y)*speed;
  const n=Math.max(1,Math.ceil(Math.hypot(vx,vz)*dt/.05));
  const tryMove=(x:number,z:number)=>{
   const h=this.world.support(x,z,p.y+C.maxStep);if(h===null){this.contacts.push({type:'boundary',id:'site-limit'});return false;}
   let y=p.y;
   if(this.grounded&&h-y<=C.maxStep+.002&&h>=y-C.maxDrop)y=h;
   if(h>y+.015){this.contacts.push({type:'wall',id:'terrain-rise'});return false;}
   const hits=this.world.contacts(x,z,y);if(hits.length){
    const top=Math.max(...hits.map(o=>o.top));
    if(this.grounded&&top-p.y<=C.maxStep+.001&&!this.world.blocked(x,z,top+.003))y=top;
    else{this.contacts.push({type:'wall',id:hits[0].name});return false;}
   }
   p.set(x,y,z);return true;
  };
  for(let i=0;i<n;i++){const x=p.x+vx*dt/n,z=p.z+vz*dt/n;if(!tryMove(x,z)){tryMove(x,p.z);tryMove(p.x,z);}}
  const oldY=p.y;this.velocity.y-=C.gravity*dt;let nextY=oldY+this.velocity.y*dt;
  const beneath=this.world.obstacles.filter(o=>this.world.overlaps(o,p.x,p.z));
  if(this.velocity.y>0){
   const ceilings=beneath.filter(o=>o.bottom>=oldY+C.height-.01&&o.bottom<=nextY+C.height);
   if(ceilings.length){const hit=ceilings.reduce((a,b)=>a.bottom<b.bottom?a:b);nextY=hit.bottom-C.height-.004;this.velocity.y=0;this.contacts.push({type:'ceiling',id:hit.name});}
  }
  let floor=this.world.support(p.x,p.z,oldY+C.maxStep)??0;
  for(const o of beneath)if(o.top<=oldY+.01)floor=Math.max(floor,o.top);
  if(this.velocity.y<=0&&nextY<=floor&&floor<=oldY+C.maxStep+.01){
   nextY=floor;this.landed=!this.grounded;this.grounded=true;this.velocity.y=0;
   if(this.landed)this.contacts.push({type:'landed',id:'ground'});
  }else this.grounded=false;
  p.y=nextY;this.velocity.x=(p.x-old.x)/dt;this.velocity.z=(p.z-old.z)/dt;this.distance=Math.hypot(p.x-old.x,p.z-old.z);
 }
}
