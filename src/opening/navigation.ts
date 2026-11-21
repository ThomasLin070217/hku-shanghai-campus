import * as T from 'three';
import {OPENING as O,DINNER_LAYOUT as D,DINNER_HEAD as H,dinnerHallPoint} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';

/** Door clearance is shared by the scenery, collision and the step transition. */
export function openingBusDoorSpan(){
 const b=O.bus;
 return{x0:b.x-b.length/2,x1:b.x+b.length/2,z0:b.z-b.width/2,z1:b.z+b.width/2,lo:b.doorX-b.doorWidth/2,hi:b.doorX+b.doorWidth/2};
}

/**
 * Shared lift state. The car floor is a moving support, so both the renderer and
 * the fixed-step physics read the same value; the landing doors are real collision
 * slabs that disappear only while the car is present and open.
 */
export interface OpeningLiftState{carY:number;doorGround:number;doorUpper:number}
const lift:OpeningLiftState={carY:O.b6Lift.ground,doorGround:0,doorUpper:0};
export function openingLift():OpeningLiftState{return{...lift};}

function setLiftDoor(world:{obstacles:Obstacle[]},name:string,closed:boolean,spec:Omit<Obstacle,'name'>){
 const index=world.obstacles.findIndex(o=>o.name===name);
 if(closed&&index<0)world.obstacles.push({name,...spec});
 if(!closed&&index>=0)world.obstacles.splice(index,1);
}
/** Update the car position and both landing doors; safe to call every tick. */
export function setOpeningLift(world:{obstacles:Obstacle[]},next:Partial<OpeningLiftState>){
 if(next.carY!==undefined)lift.carY=next.carY;
 if(next.doorGround!==undefined)lift.doorGround=next.doorGround;
 if(next.doorUpper!==undefined)lift.doorUpper=next.doorUpper;
 const L=O.b6Lift,z=(L.doorZ0+L.doorZ1)/2,width=L.doorZ1-L.doorZ0;
 setLiftDoor(world,'opening-b6-lift-door-ground',lift.doorGround<.9,{x:L.x1,z,w:.12,d:width,bottom:L.ground,top:L.ground+2.6,angle:0});
 setLiftDoor(world,'opening-b6-lift-door-upper',lift.doorUpper<.9,{x:L.x0,z,w:.12,d:width,bottom:L.upper,top:L.upper+2.3,angle:0});
}

export function openingObstacles(obstacles:Obstacle[]){
 const box=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number):Obstacle=>({name,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,bottom,top,angle:0});
 for(const r of [O.b5,O.b6]){
  const index=obstacles.findIndex(o=>o.name===r.id+'/closed-exterior');if(index<0)continue;
  const old=obstacles[index],x0=old.x-old.w/2,x1=old.x+old.w/2,z0=old.z-old.d/2,z1=old.z+old.d/2,l=r.door-r.doorWidth/2,h=r.door+r.doorWidth/2;
  if(r.id==='B06'){
   /* The former footprint slab is replaced by the actual room walls, the ground
    * glazed base and the east lift lobby. The room no longer has a south doorway. */
   obstacles.splice(index,1);
   const L=O.b6Lift,LO=O.b6Lobby,SD=O.b6SideDoor;
   obstacles.push(
    box('opening-b6-wall-left',r.x0-.12,r.x0,r.z0,r.z1,0,old.top),
    box('opening-b6-wall-right-north',r.x1,r.x1+.12,r.z0,L.z0,0,old.top),
    box('opening-b6-wall-right-south',r.x1,r.x1+.12,L.z1,r.z1,0,old.top),
    box('opening-b6-wall-back',r.x0,r.x1,r.z0-.12,r.z0,0,old.top),
    box('opening-b6-wall-front',r.x0,r.x1,r.z1,r.z1+.12,0,old.top),
    // Ground-floor shell: the base glazing is solid except at the side door.
    box('opening-b6-base-east-north',LO.x1,LO.x1+.12,-85.03,SD.z-SD.width/2,0,8),
    box('opening-b6-base-east-south',LO.x1,LO.x1+.12,SD.z+SD.width/2,-54.97,0,8),
    box('opening-b6-base-east-lintel',LO.x1,LO.x1+.12,SD.z-SD.width/2,SD.z+SD.width/2,SD.height,8),
    box('opening-b6-base-south',-LO.x1,LO.x1,-55.09,-54.97,0,8),
    box('opening-b6-base-west',-LO.x1-.12,-LO.x1,-85.03,-54.97,0,8),
    box('opening-b6-base-north',-LO.x1,LO.x1,-85.15,-85.03,0,8),
    // East lobby: solid north/west walls; the base glazing closes the other sides.
    box('opening-b6-lobby-north',LO.x0,LO.x1,LO.z0-.12,LO.z0,0,LO.clearHeight),
    box('opening-b6-lobby-west',LO.x0-.12,LO.x0,L.z1,LO.z1,0,LO.clearHeight),
    // Shaft walls. East opens to the lobby at ground; west opens to the office at 5F.
    box('opening-b6-lift-east-north',L.x1-.12,L.x1,L.z0,L.doorZ0,0,L.top),
    box('opening-b6-lift-east-south',L.x1-.12,L.x1,L.doorZ1,L.z1,0,L.top),
    box('opening-b6-lift-east-lintel',L.x1-.12,L.x1,L.doorZ0,L.doorZ1,L.ground+2.6,L.top),
    box('opening-b6-lift-west-north',L.x0-.12,L.x0,L.z0,L.doorZ0,0,L.top),
    box('opening-b6-lift-west-south',L.x0-.12,L.x0,L.doorZ1,L.z1,0,L.top),
    box('opening-b6-lift-west-below',L.x0-.12,L.x0,L.doorZ0,L.doorZ1,0,L.upper),
    box('opening-b6-lift-west-above',L.x0-.12,L.x0,L.doorZ0,L.doorZ1,L.upper+2.3,L.top),
    box('opening-b6-lift-shaft-north',L.x0,L.x1,L.z0-.12,L.z0,0,L.top),
    box('opening-b6-lift-shaft-south',L.x0,L.x1,L.z1,L.z1+.12,0,L.top),
    // Solid mass under the office, split around the car so it can travel to ground.
    box('opening-b6-floor-west',r.x0,L.x0,r.z0,r.z1,0,r.floor),
    box('opening-b6-floor-north',L.x0,L.x1,r.z0,L.z0,0,r.floor),
    box('opening-b6-floor-south',L.x0,L.x1,L.z1,r.z1,0,r.floor),
   );
   setOpeningLift({obstacles},{carY:lift.carY,doorGround:lift.doorGround,doorUpper:lift.doorUpper});
   continue;
  }
  obstacles.splice(index,1,box(r.id+'/opening-left',x0,r.x0,z0,z1,0,old.top),box(r.id+'/opening-right',r.x1,x1,z0,z1,0,old.top),box(r.id+'/opening-back',r.x0,r.x1,z0,r.z0,0,old.top),box(r.id+'/opening-front-left',r.x0,l,z1-.2,z1,0,old.top),box(r.id+'/opening-front-right',h,r.x1,z1-.2,z1,0,old.top),box(r.id+'/opening-lintel',l,h,z1-.2,z1,r.floor+r.doorHeight,old.top));
  if(r.floor>0)obstacles.push(box(r.id+'/opening-floor',r.x0,r.x1,r.z0,z1,0,r.floor));
 }
 // The east lift lobby is walkable even though it sits outside the office walls.
 const LO=O.b6Lobby,L=O.b6Lift;
 obstacles.push(
  box('opening-b6-lobby-floor',LO.x0,LO.x1,LO.z0,LO.z1,0,LO.floor),
  box('opening-b6-lobby-ceiling',LO.x0,LO.x1,LO.z0,LO.z1,LO.clearHeight,LO.clearHeight+.12),
  box('opening-b6-lift-car-ceiling',L.x0,L.x1,L.z0,L.z1,O.b6Lift.top-.12,O.b6Lift.top),
 );
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
 // Office furniture is solid so the player cannot walk through the desk.
 obstacles.push(
  box('opening-b6-desk',O.laptop[0]-.95,O.laptop[0]+.95,O.laptop[2]-.42,O.laptop[2]+.42,O.b6.floor,O.b6.floor+.85),
  box('opening-b6-credenza',2,7,-61.72,-61.18,O.b6.floor,O.b6.floor+.9),
 );
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
 // B06: the lift car is a moving support, the lobby is at ground and the office
 // floor is solid everywhere outside the shaft.
 const L=O.b6Lift,LO=O.b6Lobby,r=O.b6;
 const inShaft=x>=L.x0&&x<=L.x1&&z>=L.z0&&z<=L.z1;
 if(inShaft&&lift.carY<=y+.242)h=Math.max(h??-Infinity,lift.carY);
 if(x>=LO.x0&&x<=LO.x1&&z>=LO.z0&&z<=LO.z1&&LO.floor<=y+.242)h=Math.max(h??-Infinity,LO.floor);
 if(!inShaft&&x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1&&r.floor<=y+.242)h=Math.max(h??-Infinity,r.floor);
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
