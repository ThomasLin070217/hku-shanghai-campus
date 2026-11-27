import * as T from 'three';
import {OPENING as O,DINNER_LAYOUT as D,DINNER_HEAD as H,B6_HALL,dinnerHallPoint,B4_LIFT as L6} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';
import {B4_LAYOUT,B4_OBSTACLES} from './b4Layout';
import {LIFT,LIFT_LANDING,liftLandingBoxes,liftLandingContains,liftSupport,mountLift,tickLift} from './lift';
import {B4_OFFICE,b4OfficeBoxes,installOffice,officeFloorContains,tickOffice} from './b4Office';

/** Door clearance is shared by the scenery, collision and the step transition. */
export function openingBusDoorSpan(){
 const b=O.bus;
 return{x0:b.x-b.length/2,x1:b.x+b.length/2,z0:b.z-b.width/2,z1:b.z+b.width/2,lo:b.doorX-b.doorWidth/2,hi:b.doorX+b.doorWidth/2};
}

export function openingObstacles(obstacles:Obstacle[]){
 const box=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number):Obstacle=>({name,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,bottom,top,angle:0});
 let b6Top=0;
 for(const r of [O.b4,O.b5,O.b6]){
  // B04 is a band tower: its rooms open the +z wing box instead of a closed exterior.
  const index=obstacles.findIndex(o=>o.name===r.id+'/closed-exterior'||(r.id===O.b4.id&&o.name===r.id+'/wing'&&o.z-o.d/2<r.z1&&o.z+o.d/2>r.z0));if(index<0)continue;
  const old=obstacles[index],x0=old.x-old.w/2,x1=old.x+old.w/2,z0=old.z-old.d/2,z1=old.z+old.d/2,l=r.door-r.doorWidth/2,h=r.door+r.doorWidth/2;
  if(r.id===O.b6.id)b6Top=old.top;
  const inside=r;
  const carved=[
   box(r.id+'/opening-left',x0,inside.x0,z0,z1,0,old.top),
   box(r.id+'/opening-right',inside.x1,x1,z0,z1,0,old.top),
   box(r.id+'/opening-back',inside.x0,inside.x1,z0,inside.z0,0,old.top),
  ];
  if(r.id===O.b4.id){
   // Ruling G1: the façade carries a side entrance west of the main door. The wing's
   // front-left slab is a second, independent collider in front of `B4_OBSTACLES`; split
   // both or the new door stays an invisible wall in the built world.
   const sd=B4_LAYOUT.sideDoor;
   carved.push(
    box(r.id+'/opening-front-west',x0,sd.x0,z1-.2,z1,0,old.top),
    box(r.id+'/opening-front-left',sd.x1,l,z1-.2,z1,0,old.top),
    box(r.id+'/opening-side-lintel',sd.x0,sd.x1,z1-.2,z1,r.floor+sd.height,old.top),
    box(r.id+'/opening-front-right',h,x1,z1-.2,z1,0,old.top),
    box(r.id+'/opening-lintel',l,h,z1-.2,z1,r.floor+r.doorHeight,old.top),
   );
  }else{
   carved.push(
    box(r.id+'/opening-front-left',r.x0,l,z1-.2,z1,0,old.top),
    box(r.id+'/opening-front-right',h,r.x1,z1-.2,z1,0,old.top),
    box(r.id+'/opening-lintel',l,h,z1-.2,z1,r.floor+r.doorHeight,old.top),
   );
  }
  obstacles.splice(index,1,...carved);
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
 // ------------------------------------------------------------------
 // Building 6 ground hall (owner ruling, 2026-11-27). The tower is hollow at ground
 // level; above the hall ceiling it is solid again except the lift shaft and the 5F
 // landing/office the lift opens onto.
 // ------------------------------------------------------------------
 if(b6Top>0){
  const hall=O.b6,W=B6_HALL,F=hall.floor;
  const s0=L6.x0-W.shaft.wall,s1=L6.x1+W.shaft.wall;
  const t0=L6.z0-W.shaft.wall,t1=L6.z1+W.shaft.wall;
  const front=hall.z1-.2;                       // interior face of the façade wall
  const ceilBottom=F+hall.clearHeight,ceilTop=ceilBottom+.16;
  const fiveTop=LIFT_LANDING.ceilBottom+L6.wall; // top of the office ceiling
  const oz0=B4_OFFICE.interior.z0-B4_OFFICE.wall,oz1=B4_OFFICE.interior.z1+B4_OFFICE.wall;
  // The shaft shell the car slides in. The car carries its own walls and leaves, so the
  // hall only needs the static frame around the doorway.
  obstacles.push(
   box('opening-b6-shaft-west',s0,L6.x0,t0,t1,F,ceilBottom),
   box('opening-b6-shaft-north',L6.x0,L6.x1,t0,L6.z0,F,ceilBottom),
   box('opening-b6-shaft-south',L6.x0,L6.x1,L6.z1,t1,F,ceilBottom),
   box('opening-b6-shaft-east-north',L6.x1,s1,L6.z0,L6.door.z0,F,ceilBottom),
   box('opening-b6-shaft-east-south',L6.x1,s1,L6.door.z1,L6.z1,F,ceilBottom),
   box('opening-b6-shaft-lintel',L6.x1,s1,L6.door.z0,L6.door.z1,F+L6.door.height,ceilBottom),
  );
  // The hall ceiling, four slabs around the shaft's travel opening.
  obstacles.push(
   box('opening-b6-ceiling-west',hall.x0,s0,hall.z0,front,ceilBottom,ceilTop),
   box('opening-b6-ceiling-east',s1,hall.x1,hall.z0,front,ceilBottom,ceilTop),
   box('opening-b6-ceiling-north',s0,s1,hall.z0,t0,ceilBottom,ceilTop),
   box('opening-b6-ceiling-south',s0,s1,t1,front,ceilBottom,ceilTop),
  );
  // Above the ceiling: solid tower, minus the shaft column and the 5F void. The two
  // openings share one z band, so three strips and a cap enclose them.
  obstacles.push(
   box('opening-b6-above-west',hall.x0,s0,hall.z0,front,ceilTop,b6Top),
   box('opening-b6-above-north',s0,hall.x1,hall.z0,oz0,ceilTop,b6Top),
   box('opening-b6-above-south',s0,hall.x1,oz1,front,ceilTop,b6Top),
   box('opening-b6-above-cap',s0,hall.x1,oz0,oz1,fiveTop,b6Top),
  );
  // Canteen: partition east of the entry axis with a 3.4 m opening, two tables and the
  // counter along the front wall.
  const c=W.canteen,part=W.shaft.wall;
  obstacles.push(
   box('opening-b6-canteen-north',c.partitionX,c.partitionX+part,hall.z0,c.openingZ0,F,ceilBottom),
   box('opening-b6-canteen-south',c.partitionX,c.partitionX+part,c.openingZ1,front,F,ceilBottom),
   box('opening-b6-canteen-header',c.partitionX,c.partitionX+part,c.openingZ0,c.openingZ1,F+2.6,ceilBottom),
  );
  for(const [i,t] of W.tables.entries())
   obstacles.push(box('opening-b6-table-'+i,t.x-t.w/2,t.x+t.w/2,t.z-t.d/2,t.z+t.d/2,F,F+t.top));
  obstacles.push(box('opening-b6-counter',W.counter.x0,W.counter.x1,W.counter.z0,W.counter.z1,F,F+W.counter.h));
  // The flip wall stands 14 cm proud of the north wall; its tiles are solid to the touch.
  const fw=W.flipWall,half=fw.width/2;
  obstacles.push(box('opening-b6-flip-wall',fw.x-half,fw.x+half,fw.z,fw.z+fw.depth,F+.13,F+3.90));
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
 // The 5F landing the lift opens onto: a plate above the lobby, a 6 m corridor and the
 // principal's closed door. Its shell is authored here and rendered by `b4Shell.ts` from
 // the same boxes; the car itself is mounted last because its collision moves.
 for(const p of liftLandingBoxes())obstacles.push(box(p.name,p.x0,p.x1,p.z0,p.z1,p.bottom,p.top));
 // The 5F principal's office behind the corridor door, and the guard that closes the 5F
 // shaft opening whenever the car is on the other floor.
 for(const p of b4OfficeBoxes())obstacles.push(box(p.name,p.x0,p.x1,p.z0,p.z1,p.bottom,p.top));
 mountLift(obstacles);
 installOffice(obstacles);
}

/**
 * The opening's floors, and nothing else. Pure: the same question always gets the same answer,
 * and asking it changes nothing. For anything that is not the player asking where the ground
 * is — the plaza crowd finding its height, a test, a placement calculation. The player's own
 * physics must go through `openingSupport`, because that is what drives the lift and the
 * office beats; a caller that only wants a number must not drive them.
 */
export function openingFloor(x:number,z:number,y:number,base:number|null){
 let h=base;
 const hall=O.b5;if(x>=hall.x0&&x<=hall.x1&&z>=hall.z0&&z<=hall.z1&&hall.floor<=y+.242)h=Math.max(h??-Infinity,hall.floor);
 const dais=H.stage,[dx,dz]=dinnerHallPoint(dais.x,dais.z),daisTop=hall.floor+dais.h;
 if(Math.abs(x-dx)<=dais.d/2&&Math.abs(z-dz)<=dais.w/2&&daisTop<=y+.242)h=Math.max(h??-Infinity,daisTop);
 const k=O.b4;if(x>=k.x0&&x<=k.x1&&z>=k.z0&&z<=k.z1&&k.floor<=y+.242)h=Math.max(h??-Infinity,k.floor);
 // The lift shaft: its floor is the lobby floor, and the car floor is added only when it
 // is reachable from the queried height — the car is at the 5F landing the rest of the time.
 const car=liftSupport(LIFT,x,z);
 if(car!==null){
  if(k.floor<=y+.242)h=Math.max(h??-Infinity,k.floor);
  if(car<=y+.242)h=Math.max(h??-Infinity,car);
 }
 // The 5F plate is a floor like any other once the player has ridden up to it. So is the
 // principal's office behind the corridor door: same plane, its own footprint.
 if(liftLandingContains(x,z)&&LIFT_LANDING.floorTop<=y+.242)h=Math.max(h??-Infinity,LIFT_LANDING.floorTop);
 if(officeFloorContains(x,z)&&LIFT_LANDING.floorTop<=y+.242)h=Math.max(h??-Infinity,LIFT_LANDING.floorTop);
 const r=O.b6;if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1&&r.floor<=y+.242)h=Math.max(h??-Infinity,r.floor);
 // The threshold: the campus landing ends 0.22 m short of the façade, so bridge the
 // doorway strip rather than leaving a 5 m hole a player falls through on the way in.
 if(Math.abs(x-r.door)<=r.doorWidth/2&&z>r.z1&&z<=r.z1+.45&&r.floor<=y+.242)h=Math.max(h??-Infinity,r.floor);
 const b=O.bus,x0=b.x-b.length/2,x1=b.x+b.length/2,z0=b.z-b.width/2,z1=b.z+b.width/2;
 if(x>=x0&&x<=x1&&z>=z0&&z<=z1&&b.floor<=y+.242)h=Math.max(h??-Infinity,b.floor);
 const lo=b.doorX-b.doorWidth/2,hi=b.doorX+b.doorWidth/2;
 for(const [za,zb,top] of [[z0-1.6,z0-.8,.18],[z0-.8,z0,.36]] as const)if(x>=lo&&x<=hi&&z>=za&&z<=zb&&top<=y+.242)h=Math.max(h??-Infinity,top);
 return h;
}

/**
 * The player's ground query. Not pure: it is also the clock the lift and the office run on.
 * The office's beats, call points and guard ride the same query as the lift: it is the one
 * hook that runs at simulation rate, and it already carries the point the player stands at.
 * The lift is the only moving floor in the world. `support()` is the one query the physics
 * makes on every fixed step, so it is also the lift's clock (see `lift.ts`).
 *
 * Only the player's own simulation may call this. Another caller would feed its own point to
 * those ticks: it could fire an office beat, summon the lift, or count as a passenger. Such a
 * caller wants `openingFloor`.
 */
export function openingSupport(x:number,z:number,y:number,base:number|null){
 tickOffice(x,z,y);
 tickLift(x,z,y);
 return openingFloor(x,z,y,base);
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
