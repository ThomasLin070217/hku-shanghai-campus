import * as T from 'three';
import {OPENING} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';

/**
 * B04 (CDS-1) ground-floor rooms: one parameter object for the scenery and the
 * collision. The static shell (floor, walls, ceiling, plinth, racks, entrance
 * door) is built with the opening world (`b4Shell.ts`); the campaign chapter adds
 * the Keyboard Wall, the HKU flip wall and the aux power closet from the
 * observed room builders at the origins below. Prop rects, the flip slab and the
 * station points are derived from those origins plus the builders' local
 * extents; `scripts/check-campaign-b4.ts` compares them to the built meshes.
 * World metres; provisional 2030 scenery, not a surveyed interior.
 */
type V3=[number,number,number];
const R=OPENING.b4,F=R.floor,TOP=R.floor+R.clearHeight,WALL=.12;
export interface B4Rect{name:string;x0:number;x1:number;z0:number;z1:number;bottom:number;top:number;render?:'wall'|'ceiling'|'plinth'|'rack'}
export interface B4Box{x0:number;x1:number;y0:number;y1:number;z0:number;z1:number}
const doorL=R.door-R.doorWidth/2,doorR=R.door+R.doorWidth/2;

/** Builder-local extents (src/model/observedFeatureRooms.ts). Builders face +z, y=0 is their floor. */
export const B4_BUILDER={
 keyboard:{
  /** `Keyboard_timber_wall` ∪ `Keyboard_wall` (panel + 54 caps). */
  bounds:{x0:-3.87,x1:4.83,y0:.72,y1:3.74,z0:-4.24,z1:-3.66},
  /** `Keyboard_wall` panel centre; its front face is bounds.z1. */
  panel:[.48,2.64,-3.79] as V3,
  /** `Keyboard_wall` (backing frame + caps): what the focus view frames. */
  panelBox:{x0:-3.42,x1:4.38,y0:1.56,y1:3.72,z0:-4.24,z1:-3.66},
 },
 flip:{
  /** `HKU_flip_wall` (frame + 561 tiles), closed. */
  wall:{x0:-3.39,x1:3.99,y0:.06,y1:3.92,z0:-1.99,z1:-1.76},
  /** `Aux_power_closet`; `contentsFront` is the front of the PSU modules inside the cavity. */
  closet:{x0:-3.42,x1:4.02,y0:.03,y1:3.95,z0:-2.98,z1:-1.91,contentsFront:-2.18,side:.1},
  lever:[.30,1.86,-2.26] as V3,
  breakerPanel:{x0:-.55,x1:1.15,y0:1.36,y1:2.36,z0:-2.39,z1:-2.29},
  rail:{x0:-2.65,x1:3.25,y0:1.2025,y1:1.2375,z0:-2.28,z1:-2.26},
 },
} as const;

const keyboardOrigin:V3=[51.02,F,11.15],flipOrigin:V3=[63.2,F,10.12];
const at=(o:V3,b:{x0:number;x1:number;y0:number;y1:number;z0:number;z1:number}):B4Box=>({x0:o[0]+b.x0,x1:o[0]+b.x1,y0:o[1]+b.y0,y1:o[1]+b.y1,z0:o[2]+b.z0,z1:o[2]+b.z1});
const point=(o:V3,p:readonly number[]):V3=>[o[0]+p[0],o[1]+p[1],o[2]+p[2]];
const K=B4_BUILDER.keyboard,FW=B4_BUILDER.flip;
const keyboardBox=at(keyboardOrigin,K.bounds),flipWallBox=at(flipOrigin,FW.wall),closetBox=at(flipOrigin,FW.closet);
const inner={z0:R.z0+.01+WALL};

export const B4_LAYOUT={
 room:R,
 wall:WALL,
 keyboardOrigin,flipOrigin,
 keyboardBox,flipWallBox,closetBox,
 /** Closed HKU flip wall in front of the closet: dynamic, removed when the flip is solved. */
 flipPanel:{name:'opening-b4-flip-panel',x0:flipWallBox.x0,x1:flipWallBox.x1,z0:flipWallBox.z0,z1:flipWallBox.z1,bottom:0,top:flipWallBox.y1},
 /** The flip wall lifts into the ceiling slot when it opens. */
 flipLift:R.clearHeight+.05,
 /** Point lights stay inside the room: z + distance never reaches the entrance wall. */
 lights:{
  emergency:[{p:[51.5,3.6,10.5],d:9},{p:[63.5,3.6,10.8],d:9},{p:[58,3.6,13.5],d:6.5}] as {p:V3;d:number}[],
  work:{p:[58,3.9,12] as V3,d:8},
  rack:{p:[68.2,2.4,13.25] as V3,d:7},
 },
 /** Supercomputer cabinets on the east wall. */
 racks:[[10.4,11.6],[11.9,13.1],[13.4,14.6],[14.9,16.1]] as [number,number][],
 rackX:[68.55,69.85] as [number,number],
 rackTop:2.3,
 /** Entrance door leaves in the B04 doorway, rendered and solid during Chapter 1. */
 door:{x0:doorL,x1:doorR,z:R.z1+.06,height:R.doorHeight,thickness:.06,slide:R.doorWidth/2+.05},
} as const;

const rect=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number,render?:B4Rect['render']):B4Rect=>({name,x0,x1,z0,z1,bottom,top,render});
/** Every static collision box of the rooms. Rects with `render` are drawn by the shell;
 * the prop rects are drawn by the observed room builders the chapter places. */
export const B4_OBSTACLES:B4Rect[]=[
 rect('opening-b4-wall-west',R.x0+.01,R.x0+.01+WALL,R.z0,R.z1,0,TOP,'wall'),
 rect('opening-b4-wall-east',R.x1-.01-WALL,R.x1-.01,R.z0,R.z1,0,TOP,'wall'),
 rect('opening-b4-wall-back',R.x0,R.x1,R.z0+.01,inner.z0,0,TOP,'wall'),
 rect('opening-b4-wall-front-left',R.x0,doorL,R.z1-.13,R.z1-.01,0,TOP,'wall'),
 rect('opening-b4-wall-front-right',doorR,R.x1,R.z1-.13,R.z1-.01,0,TOP,'wall'),
 rect('opening-b4-wall-lintel',doorL,doorR,R.z1-.13,R.z1-.01,F+R.doorHeight,TOP,'wall'),
 rect('opening-b4-ceiling',R.x0,R.x1,R.z0,R.z1,TOP-.1,TOP+.08,'ceiling'),
 // Keyboard Wall and the plinth under it: builder bounds, clipped to the back wall.
 rect('opening-b4-keyboard-wall',keyboardBox.x0,keyboardBox.x1,inner.z0,keyboardBox.z1,0,keyboardBox.y1,'plinth'),
 // Aux power closet: the rack contents and both cavity sides; the flip panel closes its mouth.
 rect('opening-b4-closet',closetBox.x0,closetBox.x1,Math.max(inner.z0,closetBox.z0),flipOrigin[2]+FW.closet.contentsFront,0,closetBox.y1),
 rect('opening-b4-closet-west',closetBox.x0,closetBox.x0+FW.closet.side,flipOrigin[2]+FW.closet.contentsFront,closetBox.z1,0,closetBox.y1),
 rect('opening-b4-closet-east',closetBox.x1-FW.closet.side,closetBox.x1,flipOrigin[2]+FW.closet.contentsFront,closetBox.z1,0,closetBox.y1),
 ...B4_LAYOUT.racks.map(([z0,z1],i)=>rect('opening-b4-rack-'+(i+1),B4_LAYOUT.rackX[0],B4_LAYOUT.rackX[1],z0,z1,F,F+B4_LAYOUT.rackTop,'rack')),
];

export type B4StationId='keyboard'|'flip'|'breaker'|'port';
/** `point` is what the focus view aims at, `box` is the interactable (reach and the gold
 * highlight use it), `stand` is where a player stops in front of it. */
export interface B4Station{id:B4StationId;label:string;point:V3;box:B4Box;stand:V3}
const leverAt=point(flipOrigin,FW.lever),railBox=at(flipOrigin,FW.rail);
export const B4_STATIONS:Record<B4StationId,B4Station>={
 keyboard:{id:'keyboard',label:'Keyboard Wall',point:[keyboardOrigin[0]+K.panel[0],keyboardOrigin[1]+K.panel[1],keyboardBox.z1],box:{...keyboardBox,z0:inner.z0},stand:[51.5,F,9.4]},
 flip:{id:'flip',label:'HKU flip wall',point:[(flipWallBox.x0+flipWallBox.x1)/2,(flipWallBox.y0+flipWallBox.y1)/2,flipWallBox.z1],box:flipWallBox,stand:[63.5,F,10.3]},
 breaker:{id:'breaker',label:'Breaker lever',point:leverAt,box:at(flipOrigin,FW.breakerPanel),stand:[62.6,F,9.7]},
 port:{id:'port',label:'Supercomputer port',point:[(railBox.x0+railBox.x1)/2,(railBox.y0+railBox.y1)/2,railBox.z1],box:railBox,stand:[64.4,F,9.6]},
};
/** What each focus view frames, square-on: the whole Keyboard Wall panel, the whole flip wall. */
export const B4_FOCUS_FRAME:Record<'keyboard'|'flip',B4Box>={keyboard:at(keyboardOrigin,K.panelBox),flip:flipWallBox};
/** Focus camera for a vertical, +z-facing panel: eye on the panel's centre line, far enough
 * back that the panel plus `margin` fits a camera with vertical `fovDeg` and `aspect`. */
export function focusPose(frame:B4Box,fovDeg:number,aspect:number,margin=.25){
 const cx=(frame.x0+frame.x1)/2,cy=(frame.y0+frame.y1)/2,hw=(frame.x1-frame.x0)/2+margin,hh=(frame.y1-frame.y0)/2+margin,t=Math.tan(fovDeg*Math.PI/360);
 const d=Math.min(Math.max(hh/t,hw/(t*Math.max(.2,aspect))),R.z1-.6-frame.z1);
 return{eye:[cx,cy,frame.z1+d] as V3,target:[cx,cy,frame.z1] as V3,distance:d};
}
/** Horizontal reach from the body to the nearest point of a station's interactable. */
export const B4_REACH=2.2;
export function stationDistance(s:B4Station,x:number,z:number){
 const dx=Math.max(s.box.x0-x,0,x-s.box.x1),dz=Math.max(s.box.z0-z,0,z-s.box.z1);return Math.hypot(dx,dz);
}
/** The B04 entrance doors (exploration navigation); closed in Chapter 1, the chapter opens them. */
export const B4_DOOR_OBSTACLE='B04/closed-doors';
export const B4_DOOR_LEAVES=['B04_entrance_door_west','B04_entrance_door_east'] as const;

/** A builder part by name, or a part merged by `compact()` found through its author trace.
 * Missing parts throw: a renamed or merged builder part must fail, not vanish. */
export function partBounds(root:T.Object3D,name:string):T.Box3{
 root.updateWorldMatrix(true,true);
 const direct=root.getObjectByName(name);if(direct)return new T.Box3().setFromObject(direct);
 let found:T.Box3|null=null;
 root.traverse(o=>{if(found||!(o instanceof T.Mesh))return;for(const p of (o.userData.authorParts??[]) as {name:string;bounds:number[]}[])if(p.name===name){found=new T.Box3(new T.Vector3().fromArray(p.bounds),new T.Vector3().fromArray(p.bounds,3)).applyMatrix4(o.matrixWorld);return;}});
 if(!found)throw new Error(`B04 room part "${name}" is missing from the builder output`);
 return found;
}
export function requirePart(root:T.Object3D,name:string):T.Object3D{
 const o=root.getObjectByName(name);if(!o)throw new Error(`B04 room part "${name}" is missing from the builder output`);return o;
}

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
