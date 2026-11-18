import * as T from 'three';
import {OPENING as O} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';
export function openingObstacles(obstacles:Obstacle[]){
 const box=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number):Obstacle=>({name,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,bottom,top,angle:0});
 for(const r of [O.b5,O.b6]){
  const index=obstacles.findIndex(o=>o.name===r.id+'/closed-exterior');if(index<0)continue;
  const old=obstacles[index],x0=old.x-old.w/2,x1=old.x+old.w/2,z0=old.z-old.d/2,z1=old.z+old.d/2,l=r.door-r.doorWidth/2,h=r.door+r.doorWidth/2;
  obstacles.splice(index,1,box(r.id+'/opening-left',x0,r.x0,z0,z1,0,old.top),box(r.id+'/opening-right',r.x1,x1,z0,z1,0,old.top),box(r.id+'/opening-back',r.x0,r.x1,z0,r.z0,0,old.top),box(r.id+'/opening-front-left',r.x0,l,z1-.2,z1,0,old.top),box(r.id+'/opening-front-right',h,r.x1,z1-.2,z1,0,old.top),box(r.id+'/opening-lintel',l,h,z1-.2,z1,r.floor+2.6,old.top));
  if(r.floor>0)obstacles.push(box(r.id+'/opening-floor',r.x0,r.x1,r.z0,z1,0,r.floor));
 }
 const b=O.bus,x0=b.x-b.width/2,x1=b.x+b.width/2,z0=b.z-b.length/2,z1=b.z+b.length/2;
 obstacles.push(box('opening-bus-floor',x0,x1,z0,z1,0,b.floor),box('opening-bus-roof',x0,x1,z0,z1,b.floor+2.15,b.floor+2.3),box('opening-bus-east',x1-.1,x1,z0,z1,b.floor,b.floor+2.2),box('opening-bus-north',x0,x1,z0,z0+.1,b.floor,b.floor+2.2),box('opening-bus-south',x0,x1,z1-.1,z1,b.floor,b.floor+2.2),box('opening-bus-west-front',x0,x0+.1,z0,b.doorZ-.7,b.floor,b.floor+2.2),box('opening-bus-west-rear',x0,x0+.1,b.doorZ+.7,z1,b.floor,b.floor+2.2),box('opening-bus-step-1',61.9,62.7,b.doorZ-.7,b.doorZ+.7,0,.18),box('opening-bus-step-2',62.7,63.5,b.doorZ-.7,b.doorZ+.7,0,.36));
}
export function openingSupport(x:number,z:number,y:number,base:number|null){
 let h=base;
 const r=O.b6;if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1&&r.floor<=y+.242)h=Math.max(h??-Infinity,r.floor);
 const b=O.bus;
 if(x>=b.x-b.width/2&&x<=b.x+b.width/2&&z>=b.z-b.length/2&&z<=b.z+b.length/2&&b.floor<=y+.242)h=Math.max(h??-Infinity,b.floor);
 for(const [lo,hi,top] of [[61.9,62.7,.18],[62.7,63.5,.36]])if(x>=lo&&x<=hi&&Math.abs(z-b.doorZ)<=.7&&top<=y+.242)h=Math.max(h??-Infinity,top);
 return h;
}
export function setBusDoor(world:{obstacles:Obstacle[];meshes:T.Mesh[]},closed:boolean){
 const name='opening-bus-closed-door',index=world.obstacles.findIndex(o=>o.name===name);
 if(closed&&index<0){const o:Obstacle={name,x:63.5,z:O.bus.doorZ,w:.1,d:1.4,bottom:.36,top:2.6,angle:0};world.obstacles.push(o);const mesh=new T.Mesh(new T.BoxGeometry(o.w,o.top-o.bottom,o.d));mesh.name=name;mesh.position.set(o.x,(o.top+o.bottom)/2,o.z);mesh.updateMatrixWorld();world.meshes.push(mesh);}
 if(!closed&&index>=0){world.obstacles.splice(index,1);const i=world.meshes.findIndex(m=>m.name===name);if(i>=0){const [m]=world.meshes.splice(i,1);m.geometry.dispose();(m.material as T.Material).dispose();}}
}
