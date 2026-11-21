import * as T from 'three';
import {OPENING as O,DINNER_LAYOUT as D,DINNER_HEAD as H,OFFICE_LAYOUT as B6,dinnerHallPoint} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';
import {B4_OBSTACLES} from './b4Layout';

/** Door clearance is shared by the scenery, collision and the step transition. */
export function openingBusDoorSpan(){
 const b=O.bus;
 return{x0:b.x-b.length/2,x1:b.x+b.length/2,z0:b.z-b.width/2,z1:b.z+b.width/2,lo:b.doorX-b.doorWidth/2,hi:b.doorX+b.doorWidth/2};
}

export function openingObstacles(obstacles:Obstacle[]){
 const box=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number):Obstacle=>({name,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,bottom,top,angle:0});
 for(const r of [O.b4,O.b5,O.b6]){
  // B04 is a band tower: its rooms open the +z wing box instead of a closed exterior.
  const index=obstacles.findIndex(o=>o.name===r.id+'/closed-exterior'||(r.id===O.b4.id&&o.name===r.id+'/wing'&&o.z-o.d/2<r.z1&&o.z+o.d/2>r.z0));if(index<0)continue;
  const old=obstacles[index],x0=old.x-old.w/2,x1=old.x+old.w/2,z0=old.z-old.d/2,z1=old.z+old.d/2,l=r.door-r.doorWidth/2,h=r.door+r.doorWidth/2;
  const inside=r.id===O.b6.id?B6.interior:r;
  obstacles.splice(index,1,box(r.id+'/opening-left',x0,inside.x0,z0,z1,0,old.top),box(r.id+'/opening-right',inside.x1,x1,z0,z1,0,old.top),box(r.id+'/opening-back',inside.x0,inside.x1,z0,inside.z0,0,old.top),box(r.id+'/opening-front-left',r.x0,l,z1-.2,z1,0,old.top),box(r.id+'/opening-front-right',h,r.x1,z1-.2,z1,0,old.top),box(r.id+'/opening-lintel',l,h,z1-.2,z1,r.floor+r.doorHeight,old.top));
  if(r.floor>0)obstacles.push(box(r.id+'/opening-floor',r.x0,r.x1,r.z0,z1,0,r.floor));
 }
 // B04 room shell, stations and racks: the same rects the chapter renders.
 for(const b of B4_OBSTACLES)obstacles.push(box(b.name,b.x0,b.x1,b.z0,b.z1,b.bottom,b.top));
 // Keep the observed lobby/hall separation and furniture solid in the same world.
 const r=O.b5;
 for(const [a,b] of [[r.z0,D.doorZ0],[D.doorZ1,r.z1]])obstacles.push(box('opening-b5-partition',D.partitionX-.12,D.partitionX+.12,a,b,0,r.clearHeight));
 for(const [i,[a,b]] of D.tables.entries()){const [x,z]=dinnerHallPoint(a,b);obstacles.push(box('opening-b5-table-'+i,x-D.tableLength/2,x+D.tableLength/2,z-D.tableWidth/2,z+D.tableWidth/2,0,.79));}
 for(const a of D.archPiers)for(const b of D.archStations){const [x,z]=dinnerHallPoint(a,b);obstacles.push(box('opening-b5-arch-pier',x-.14,x+.14,z-.14,z+.14,0,D.archSpring));}
 // The outer end wall remains solid; the former internal side wall is retired.
 const [endX,endZ]=dinnerHallPoint(D.crossCenter,D.endZ);
 obstacles.push(box('opening-b5-hall-end',endX-.07,endX+.07,endZ-D.crossWidth/2,endZ+D.crossWidth/2,0,4.45));
 const deck=r.floor+H.stage.h;
 const furniture=(name:string,part:{x:number;z:number;w:number;d:number;h:number},bottom:number)=>{
  const [x,z]=dinnerHallPoint(part.x,part.z);
  obstacles.push(box(name,x-part.d/2,x+part.d/2,z-part.w/2,z+part.w/2,bottom,bottom+part.h));
 };
 furniture('opening-b5-dais',H.stage,r.floor);
 furniture('opening-b5-head-table',H.table,deck);
 furniture('opening-b5-lectern',H.lectern,deck);
 for(const z of H.chairRows)for(const offset of H.chairOffsets){
  furniture('opening-b5-head-chair',{...H.chair,x:H.table.x+offset,z},deck);
 }
 const officeFloor=O.b6.floor,{interior}=B6;
 obstacles.push(box('opening-b6-ceiling',interior.x0,interior.x1,interior.z0,interior.z1,officeFloor+interior.ceiling,officeFloor+O.b6.clearHeight));
 const officeFurniture=(name:string,{x,z,w,d,h}:{x:number;z:number;w:number;d:number;h:number})=>{
  obstacles.push(box('opening-b6-'+name,x-w/2,x+w/2,z-d/2,z+d/2,officeFloor,officeFloor+h));
 };
 officeFurniture('desk',B6.presentation);
 officeFurniture('credenza',B6.credenza);
 officeFurniture('planter',B6.planter);
 for(const {id,desk,chair} of B6.workstations){
  officeFurniture(id+'-desk',desk);
  officeFurniture(id+'-chair',chair);
 }
 const {x0,x1,z0,z1,lo,hi}=openingBusDoorSpan();
 obstacles.push(
  box('opening-bus-floor',x0,x1,z0,z1,0,O.bus.floor),
  box('opening-bus-roof',x0,x1,z0,z1,O.bus.floor+2.15,O.bus.floor+2.3),
  box('opening-bus-west',x0,x0+.1,z0,z1,O.bus.floor,O.bus.floor+2.2),
  box('opening-bus-east',x1-.1,x1,z0,z1,O.bus.floor,O.bus.floor+2.2),
  box('opening-bus-south',x0,x1,z1-.1,z1,O.bus.floor,O.bus.floor+2.2),
  // The north wall is split around the passenger door.
  box('opening-bus-north-west',x0,lo,z0,z0+.1,O.bus.floor,O.bus.floor+2.2),
  box('opening-bus-north-east',hi,x1,z0,z0+.1,O.bus.floor,O.bus.floor+2.2),
  // Two steps drop from the floor to the forecourt, parallel to the north face.
  box('opening-bus-step-1',lo,hi,z0-1.6,z0-.8,0,.18),
  box('opening-bus-step-2',lo,hi,z0-.8,z0,0,.36),
 );
}

export function openingSupport(x:number,z:number,y:number,base:number|null){
 let h=base;
 const hall=O.b5;if(x>=hall.x0&&x<=hall.x1&&z>=hall.z0&&z<=hall.z1&&hall.floor<=y+.242)h=Math.max(h??-Infinity,hall.floor);
 const dais=H.stage,[dx,dz]=dinnerHallPoint(dais.x,dais.z),daisTop=hall.floor+dais.h;
 if(Math.abs(x-dx)<=dais.d/2&&Math.abs(z-dz)<=dais.w/2&&daisTop<=y+.242)h=Math.max(h??-Infinity,daisTop);
 const k=O.b4;if(x>=k.x0&&x<=k.x1&&z>=k.z0&&z<=k.z1&&k.floor<=y+.242)h=Math.max(h??-Infinity,k.floor);
 const r=O.b6;if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1&&r.floor<=y+.242)h=Math.max(h??-Infinity,r.floor);
 const b=O.bus,x0=b.x-b.length/2,x1=b.x+b.length/2,z0=b.z-b.width/2,z1=b.z+b.width/2;
 if(x>=x0&&x<=x1&&z>=z0&&z<=z1&&b.floor<=y+.242)h=Math.max(h??-Infinity,b.floor);
 const lo=b.doorX-b.doorWidth/2,hi=b.doorX+b.doorWidth/2;
 for(const [za,zb,top] of [[z0-1.6,z0-.8,.18],[z0-.8,z0,.36]] as const)if(x>=lo&&x<=hi&&z>=za&&z<=zb&&top<=y+.242)h=Math.max(h??-Infinity,top);
 return h;
}

/**
 * The closed door is a real collision slab, not only a visual leaf. It sits on the
 * north face and is removed the moment the player can leave, so the exit cannot be
 * blocked by the parked shuttle.
 */
export function setBusDoor(world:{obstacles:Obstacle[];meshes:T.Mesh[]},closed:boolean){
 const name='opening-bus-closed-door',index=world.obstacles.findIndex(o=>o.name===name);
 const b=O.bus,z=b.z-b.width/2;
 if(closed&&index<0){
  const o:Obstacle={name,x:b.doorX,z,w:b.doorWidth,d:.1,bottom:.36,top:2.6,angle:0};
  world.obstacles.push(o);
  const mesh=new T.Mesh(new T.BoxGeometry(o.w,o.top-o.bottom,o.d));
  mesh.name=name;mesh.position.set(o.x,(o.top+o.bottom)/2,o.z);mesh.updateMatrixWorld();world.meshes.push(mesh);
 }
 if(!closed&&index>=0){
  world.obstacles.splice(index,1);
  const i=world.meshes.findIndex(m=>m.name===name);
  if(i>=0){const [m]=world.meshes.splice(i,1);m.geometry.dispose();(m.material as T.Material).dispose();}
 }
}
