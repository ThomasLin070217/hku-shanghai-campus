import * as T from 'three';
import {createCharacter} from '../characters/character';
import {NPC_APPEARANCES,type Appearance} from '../characters/config';
import {OPENING} from './spatialLayout';

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

export function createOpeningNPCs(){
 const root=new T.Group();root.name='Opening_people';root.userData.dynamicGameplay=true;
 const actors=OPENING_CAST.map(a=>{const model=createCharacter(a.appearance);model.root.position.fromArray([...a.position]);model.root.rotation.y=a.yaw;root.add(model.root);return model;});
 const staff=actors[0];
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
 const leaveTargets:readonly T.Vector3[]=OPENING_CAST.map((_,index)=>new T.Vector3(
  DOOR.x+((index%5)-2)*.62+((index%2)?.18:-.18),
  OPENING_CAST[index].position[1],
  DOOR.z+(index%3)*.9,
 ));
 const startStaffTalk=()=>{staffTarget=new T.Vector3(61.5,.02,-59.0);};
 const beginLeaving=()=>{leaving=true;staffTarget=null;};
 const reset=()=>{
  staffTarget=null;leaving=false;
  actors.forEach((actor,index)=>{
   actor.root.position.fromArray([...OPENING_CAST[index].position]);actor.root.rotation.y=OPENING_CAST[index].yaw;
   actor.root.visible=true;
  });
  root.visible=true;
 };
 return{root,startStaffTalk,staffPosition:()=>new T.Vector3(staff.root.position.x,staff.root.position.y+1.55,staff.root.position.z),staffRootPosition:()=>staff.root.position,reset,update(dt:number,incident:boolean,paused:boolean,player:T.Vector3){
  if(incident&&!leaving)beginLeaving();
  if(leaving&&!paused&&dt>0){
   let anyVisible=false;
   actors.forEach((actor,index)=>{
    if(!actor.root.visible)return;
    const target=leaveTargets[index];
    const dx=target.x-actor.root.position.x,dz=target.z-actor.root.position.z;
    const distance=Math.hypot(dx,dz);
    if(distance<=DOOR.reach){actor.root.visible=false;return;}
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
  for(const actor of actors){
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
