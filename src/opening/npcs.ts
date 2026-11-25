import * as T from 'three';
import {createCharacter} from '../characters/character';
import {NPC_APPEARANCES,type Appearance} from '../characters/config';
import {DINNER_LAYOUT,OPENING,dinnerChairPlaces,dinnerHallPoint} from './spatialLayout';

/** Opening-only cast. Keep the coordinator and original student IDs stable. */
export const OPENING_CAST:{position:readonly [number,number,number];appearance:Appearance;yaw:number}[]=[
 {position:OPENING.staff,appearance:{...NPC_APPEARANCES[0],id:'opening-staff',name:'Dinner coordinator',coat:0x244d3e,shirt:0xf4efd8},yaw:2.45},
 {position:[66,.02,-63.1],appearance:{...NPC_APPEARANCES[1],id:'opening-student-1'},yaw:Math.PI/2},
 {position:[57,.02,-65],appearance:{...NPC_APPEARANCES[0],id:'opening-student-2',coat:0x617d6d},yaw:Math.PI},
 ...[
  {position:[52.9,.07,-52],coat:0x304b70,hair:0x32251d,skin:0xe8ba95,yaw:-Math.PI/2},
  {position:[62.8,.07,-52],coat:0x80554b,hair:0x171c22,skin:0xb77955,yaw:Math.PI/2},
  {position:[76,.02,-63.1],coat:0x426c59,hair:0x312825,skin:0xe0ad86,yaw:Math.PI/2},
  {position:[79,.02,-68],coat:0x485d7b,hair:0x171c22,skin:0xa56d4e,yaw:Math.PI/2},
  {position:[79,.02,-74],coat:0x8b7852,hair:0x46362a,skin:0xe8ba95,yaw:Math.PI/2},
  {position:[71.1,.02,-68.8],coat:0x534f68,hair:0x1d242c,skin:0xc89370,yaw:-Math.PI/2},
  {position:[67,.02,-77.2],coat:0x375850,hair:0x171c22,skin:0xe0ad86,yaw:0},
  {position:[75.2,.02,-77.2],coat:0x925d45,hair:0x30241d,skin:0xb77955,yaw:0},
  {position:[56.5,.02,-70.5],coat:0x4d6074,hair:0x3b2c24,skin:0xe8ba95,yaw:-Math.PI/2},
 ].map((a,i)=>({position:a.position as [number,number,number],yaw:a.yaw,appearance:{...NPC_APPEARANCES[i%2],id:'opening-guest-'+(i+1),name:i===8?'Dinner staff':'Dinner guest',height:1.70+(i%4)*.045,coat:a.coat,hair:a.hair,skin:a.skin,gown:i%3===0}})),
];

/**
 * The dinner is a seated dinner. Until 2026-11-26 every guest stood between the
 * chairs and the hall read as empty despite ~80 laid covers (QA, `.scratch/b5-dinner-qa`:
 * "12 figures in the room and 0 seated"). Each guest whose authored post is within
 * arm's reach of a chair takes that chair and faces its table; the forecourt pair has
 * no chair nearby and stays standing, which is what they are there for.
 *
 * `dinnerChairPlaces()` is the same arithmetic `world.ts` draws the chairs with, so a
 * guest cannot end up inside a seat. The nearest *table centre* gives the facing, and
 * one chair is used at most once.
 */
const SEAT_HEIGHT=.45;
const SEAT_REACH=3.4;
interface Seat{actor:number;x:number;z:number;yaw:number}
function seatPlan():Seat[]{
 const chairs=dinnerChairPlaces();
 const tables=DINNER_LAYOUT.tables.map(([a,b])=>dinnerHallPoint(a,b));
 const taken=new Set<number>(),plan:Seat[]=[];
 for(let actor=1;actor<OPENING_CAST.length;actor++){
  const [x,,z]=OPENING_CAST[actor].position;
  let pick=-1,best=SEAT_REACH;
  for(let i=0;i<chairs.length;i++){
   if(taken.has(i))continue;
   const distance=Math.hypot(chairs[i].x-x,chairs[i].z-z);
   if(distance<best){best=distance;pick=i;}
  }
  if(pick<0)continue;
  taken.add(pick);
  const chair=chairs[pick];
  let table=tables[0];
  for(const t of tables)if(Math.hypot(t[0]-chair.x,t[1]-chair.z)<Math.hypot(table[0]-chair.x,table[1]-chair.z))table=t;
  // Same yaw convention as the walking code: yaw 0 faces -Z.
  plan.push({actor,x:chair.x,z:chair.z,yaw:Math.atan2(-(table[0]-chair.x),-(table[1]-chair.z))});
 }
 return plan;
}

export function createOpeningNPCs(){
 const root=new T.Group();root.name='Opening_people';root.userData.dynamicGameplay=true;
 const actors=OPENING_CAST.map(a=>{const model=createCharacter(a.appearance);model.root.position.fromArray([...a.position]);model.root.rotation.y=a.yaw;root.add(model.root);return model;});
 const staff=actors[0];
 const seats=new Map<number,Seat>(seatPlan().map(seat=>[seat.actor,seat]));
 const legs=actors.map(actor=>['leg-left','leg-right'].map(name=>actor.nodes.find(node=>node.name===name)!));
 function sit(index:number){
  const seat=seats.get(index),actor=actors[index];
  if(!seat)return;
  actor.root.position.set(seat.x,OPENING_CAST[index].position[1],seat.z);
  actor.root.rotation.y=seat.yaw;
  // The rig's hip pivots sit one rig unit above the feet, so the body drops by
  // (hip x visual scale - seat height); both legs then swing forward to the
  // horizontal, which puts the lap under the tabletop at 0.74 m.
  const hip=legs[index][0].position.y,scaleY=actor.config.height/2.7;
  actor.visual.position.y=SEAT_HEIGHT-hip*scaleY;
  for(const leg of legs[index])leg.rotation.set(-Math.PI/2,0,0);
 }
 function stand(index:number){
  actors[index].visual.position.y=0;
  for(const leg of legs[index])leg.rotation.set(0,0,0);
 }
 for(const index of seats.keys())sit(index);
 let staffTarget:T.Vector3|null=null;
 /* The incident empties the hall. The cast used to be hidden by one assignment the frame the
    alert flipped — everyone vanished where they stood, which reads as a rendering fault rather
    than as a story beat (owner, 2026-11-24: 「他让我们去拿 MacBook 之后，那个任务做完，学生就会
    突然消失」). They now walk out through the B5 door and are hidden one at a time as each one
    passes it, which is the same beat the deck describes: robots escorting people away. */
 // Targets sit outside the B5 north door (the hall is z0 -80 to z1 -54.7), staggered outward so
 // nobody is hidden while still inside the doorway or still in the hall.
 const DOOR={x:OPENING.b5.door,z:OPENING.b5.z1+2.6,speed:1.9,reach:.8};
 let leaving=false;
 // Nobody walks through a table. The first version of this walk-out sent every guest in a
 // straight line to the door, and the lines that start east of the rows cut across them. They
 // walk out down the aisles instead: sideways to the nearest free lane, north along it, west to
 // the door. The lanes are derived from the tables themselves, so moving the tables moves the
 // routes.
 // `DINNER_LAYOUT.tables` are in authored hall coordinates, and the 1.2 x 5.4 footprint swaps
 // axes when `dinnerHallPoint` rotates them into the world — the same transform and the same
 // width/length usage as the collision boxes in `navigation.ts:58`.
 const tableRects=DINNER_LAYOUT.tables.map(([a,b])=>{
  const [x,z]=dinnerHallPoint(a,b);
  return{x0:x-DINNER_LAYOUT.tableLength/2,x1:x+DINNER_LAYOUT.tableLength/2,
   z0:z-DINNER_LAYOUT.tableWidth/2,z1:z+DINNER_LAYOUT.tableWidth/2};
 });
 const spans=tableRects.map(r=>[r.x0,r.x1] as [number,number]).sort((a,b)=>a[0]-b[0]);
 const occupied:[number,number][]=[];
 for(const s of spans){const last=occupied[occupied.length-1];
  if(last&&s[0]<=last[1]+.05)last[1]=Math.max(last[1],s[1]);else occupied.push([s[0],s[1]]);}
 const NORTH_LANE_Z=Math.max(...tableRects.map(r=>r.z1))+1.5;
 const aisles:number[]=[OPENING.b5.x0+2.5];
 for(let i=0;i<occupied.length-1;i++)aisles.push((occupied[i][1]+occupied[i+1][0])/2);
 aisles.push(OPENING.b5.x1-1.5);
 const nearestAisle=(x:number)=>aisles.reduce((best,a)=>Math.abs(a-x)<Math.abs(best-x)?a:best,aisles[0]);
 const leavePaths:readonly T.Vector3[][]=OPENING_CAST.map((spec,index)=>{
  const [x,y,z]=spec.position,aisleX=nearestAisle(x);
  // `max` because z grows northward: a guest already north of the lane must not walk back in.
  const exitZ=Math.max(z,NORTH_LANE_Z),spread=DOOR.x+((index%5)-2)*.62+((index%2)?.18:-.18);
  return [new T.Vector3(aisleX,y,z),new T.Vector3(aisleX,y,exitZ),new T.Vector3(DOOR.x,y,exitZ),
   new T.Vector3(spread,y,DOOR.z+(index%3)*.9)];
 });
 const pathIndex=OPENING_CAST.map(()=>0);
 const startStaffTalk=()=>{staffTarget=new T.Vector3(61.5,.02,-59.0);};
 const beginLeaving=()=>{leaving=true;staffTarget=null;for(const index of seats.keys())stand(index);};
 const reset=()=>{
  staffTarget=null;leaving=false;pathIndex.fill(0);
  actors.forEach((actor,index)=>{
   actor.root.position.fromArray([...OPENING_CAST[index].position]);actor.root.rotation.y=OPENING_CAST[index].yaw;
   actor.root.visible=true;
  });
  for(const index of seats.keys())sit(index);
  root.visible=true;
 };
 return{root,startStaffTalk,staffPosition:()=>new T.Vector3(staff.root.position.x,staff.root.position.y+1.55,staff.root.position.z),staffRootPosition:()=>staff.root.position,reset,update(dt:number,incident:boolean,paused:boolean,player:T.Vector3){
  if(incident&&!leaving)beginLeaving();
  if(leaving&&!paused&&dt>0){
   let anyVisible=false;
   actors.forEach((actor,index)=>{
    if(!actor.root.visible)return;
    const path=leavePaths[index];
    let waypoint=path[Math.min(pathIndex[index],path.length-1)];
    let dx=waypoint.x-actor.root.position.x,dz=waypoint.z-actor.root.position.z;
    let distance=Math.hypot(dx,dz);
    while(distance<=DOOR.reach){
     if(pathIndex[index]>=path.length-1){actor.root.visible=false;return;}
     pathIndex[index]++;waypoint=path[pathIndex[index]];
     dx=waypoint.x-actor.root.position.x;dz=waypoint.z-actor.root.position.z;
     distance=Math.hypot(dx,dz);
    }
    const step=Math.min(distance,DOOR.speed*dt);
    actor.root.position.x+=dx/distance*step;actor.root.position.z+=dz/distance*step;
    actor.root.rotation.y=Math.atan2(-dx,-dz);
    actor.animate(dt,step,true,0,DOOR.speed);
    anyVisible=true;
   });
   root.visible=anyVisible;
  }
  if(leaving)return;
  root.visible=!incident;if(incident||paused||dt<=0)return;
  for(const [index,actor] of actors.entries()){
   // A seated guest is still: `animate()` would put the legs back under the body.
   if(seats.has(index))continue;
   if(actor===staff&&staffTarget){
    const dx=staffTarget.x-actor.root.position.x,dz=staffTarget.z-actor.root.position.z,distance=Math.hypot(dx,dz);
    if(distance>.12){
     // Walk-and-talk: the coordinator leads the player toward the dinner tables.
     const step=Math.min(distance,.85*dt);
     actor.root.position.x+=dx/distance*step;actor.root.position.z+=dz/distance*step;
     actor.root.rotation.y=Math.atan2(-dx,-dz);
     actor.animate(dt,step,true,0,.85);
     continue;
    }
    staffTarget=null;
   }
   actor.animate(dt,0,true,0,0);
   const dx=player.x-actor.root.position.x,dz=player.z-actor.root.position.z;
   if(Math.hypot(dx,dz)<5.5&&Math.hypot(dx,dz)>.05){
    // The shared rig's textured face points down local -Z after visual.rotation.y=PI.
    // Positive-Z look-at showed the hair/back of the head in the previous opening.
    const target=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(target-actor.root.rotation.y),Math.cos(target-actor.root.rotation.y));
    actor.root.rotation.y+=delta*(1-Math.exp(-8*dt));
   }
  }
 },dispose(){actors.forEach(a=>a.dispose());root.removeFromParent();}};
}
