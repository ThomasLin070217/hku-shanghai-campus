import * as T from 'three';
import {OPENING} from '../opening/spatialLayout';
import type {Obstacle} from '../exploration/navigation';
import type {Vec3} from './types';

/**
 * B04 (CDS-1) ground-floor campaign rooms. One parameter object for the scenery
 * the chapter renders and the collision `openingObstacles` adds: walls, the
 * Keyboard Wall, the aux power closet behind the HKU flip wall and the
 * supercomputer racks. World metres; provisional 2030 scenery, not a surveyed
 * interior. The room bounds are `OPENING.b4` (also used by the model cut).
 */
const R=OPENING.b4,F=R.floor,TOP=R.floor+R.clearHeight,WALL=.12;
export interface B4Rect{name:string;x0:number;x1:number;z0:number;z1:number;bottom:number;top:number;render?:'wall'|'ceiling'|'plinth'|'rack'|'closet'}
const doorL=R.door-R.doorWidth/2,doorR=R.door+R.doorWidth/2;

export const B4_LAYOUT={
 room:R,
 wall:WALL,
 /** Builder origins: local y=0 is the room floor; builders face +z. */
 keyboardOrigin:[51.02,F,11.15] as Vec3,
 flipOrigin:[63.2,F,10.12] as Vec3,
 /** Closed HKU flip wall in front of the closet; dynamic (opened when the flip is solved). */
 flipPanel:{name:'opening-b4-flip-panel',x0:59.78,x1:67.22,z0:8.1,z1:8.42,bottom:0,top:4.0},
 /** The flip panel lifts into the ceiling slot when it opens. */
 flipLift:R.clearHeight+.05,
 lights:{
  emergency:[[51.5,3.7,10.2],[63.5,3.7,10.8],[58,3.7,17],[48.5,3.7,16],[67.5,3.7,16.5]] as Vec3[],
  work:[58,4.0,12.5] as Vec3,
  rack:[68.4,2.4,13.25] as Vec3,
 },
 /** Supercomputer cabinets on the east wall. */
 racks:[[10.4,11.6],[11.9,13.1],[13.4,14.6],[14.9,16.1]] as [number,number][],
 rackX:[68.55,69.85] as [number,number],
 rackTop:2.3,
} as const;

const rect=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number,render?:B4Rect['render']):B4Rect=>({name,x0,x1,z0,z1,bottom,top,render});
/** Every collision box of the rooms. The chapter renders the same rects. */
export const B4_OBSTACLES:B4Rect[]=[
 rect('opening-b4-wall-west',R.x0+.01,R.x0+.01+WALL,R.z0,R.z1,0,TOP,'wall'),
 rect('opening-b4-wall-east',R.x1-.01-WALL,R.x1-.01,R.z0,R.z1,0,TOP,'wall'),
 rect('opening-b4-wall-back',R.x0,R.x1,R.z0+.01,R.z0+.01+WALL,0,TOP,'wall'),
 rect('opening-b4-wall-front-left',R.x0,doorL,R.z1-.13,R.z1-.01,0,TOP,'wall'),
 rect('opening-b4-wall-front-right',doorR,R.x1,R.z1-.13,R.z1-.01,0,TOP,'wall'),
 rect('opening-b4-wall-lintel',doorL,doorR,R.z1-.13,R.z1-.01,F+R.doorHeight,TOP,'wall'),
 rect('opening-b4-ceiling',R.x0,R.x1,R.z0,R.z1,TOP-.1,TOP+.08,'ceiling'),
 // Keyboard Wall timber backing and the plinth under it (builder wall spans y .72–3.74).
 rect('opening-b4-keyboard-wall',47.15,55.85,R.z0+.13,7.52,0,3.74,'plinth'),
 // Aux power closet: rack back and both cavity sides; the flip panel closes its mouth.
 rect('opening-b4-closet',59.78,67.22,R.z0+.13,7.75,0,3.95,'closet'),
 rect('opening-b4-closet-west',59.78,59.88,7.75,8.1,0,3.95,'closet'),
 rect('opening-b4-closet-east',67.12,67.22,7.75,8.1,0,3.95,'closet'),
 ...B4_LAYOUT.racks.map(([z0,z1],i)=>rect('opening-b4-rack-'+(i+1),B4_LAYOUT.rackX[0],B4_LAYOUT.rackX[1],z0,z1,F,F+B4_LAYOUT.rackTop,'rack')),
];

export type B4StationId='keyboard'|'flip'|'breaker'|'port';
export interface B4Station{id:B4StationId;label:string;point:Vec3;stand:Vec3;path:[number,number][]}
/** `point` is the interactable (what E focuses); `stand` is where a player stops in
 * front of it. The campaign check walks to every stand and casts the eye ray. */
export const B4_STATIONS:Record<B4StationId,B4Station>={
 keyboard:{id:'keyboard',label:'Keyboard Wall',point:[51.5,2.64,7.62],stand:[51.5,F,9.4],path:[]},
 flip:{id:'flip',label:'HKU flip wall',point:[63.5,2.0,8.48],stand:[63.5,F,10.3],path:[]},
 breaker:{id:'breaker',label:'Breaker lever',point:[63.5,1.86,8.02],stand:[62.6,F,9.7],path:[]},
 port:{id:'port',label:'Supercomputer port',point:[63.5,1.22,7.9],stand:[64.4,F,9.6],path:[]},
};
/** Horizontal reach from the body to a station's interactable for E to focus it. */
export const B4_REACH=2.4;
/** The B04 entrance doors (exploration navigation); the chapter unlocks them. */
export const B4_DOOR_OBSTACLE='B04/closed-doors';

/** The closed flip panel is a real collision slab (like the bus door), removed when it opens. */
export function setB4FlipPanel(world:{obstacles:Obstacle[];meshes:T.Mesh[]},closed:boolean){
 const p=B4_LAYOUT.flipPanel,index=world.obstacles.findIndex(o=>o.name===p.name);
 if(closed&&index<0){
  const o:Obstacle={name:p.name,x:(p.x0+p.x1)/2,z:(p.z0+p.z1)/2,w:p.x1-p.x0,d:p.z1-p.z0,bottom:p.bottom,top:p.top,angle:0};
  world.obstacles.push(o);
  const mesh=new T.Mesh(new T.BoxGeometry(o.w,o.top-o.bottom,o.d));
  mesh.name=p.name;mesh.position.set(o.x,(o.top+o.bottom)/2,o.z);mesh.updateMatrixWorld();world.meshes.push(mesh);
 }
 if(!closed&&index>=0){
  world.obstacles.splice(index,1);
  const i=world.meshes.findIndex(m=>m.name===p.name);
  if(i>=0){const [m]=world.meshes.splice(i,1);m.geometry.dispose();(m.material as T.Material).dispose();}
 }
}
