import * as T from 'three';
import {OPENING} from './spatialLayout';
import type {Obstacle} from '../exploration/navigation';

/**
 * B04 (CDS-1) ground-floor lobby: one parameter object for the scenery and the
 * collision. Entering B04 at x 58 from the south, facing north, the right hand is
 * east: the Keyboard Wall stands on the **east** wall (facing west, the timber
 * tiers in front of it), and the aux power closet, the breaker, the MacBook port
 * and the supercomputer racks line the **north** wall. The HKU flip wall is not in
 * B04 at all; it stands in the Building 5 ground-floor lobby (`b5FlipWall.ts`).
 *
 * The static shell (floor, walls, ceiling, tiers, racks, lobby furniture, entrance
 * door) is built with the opening world (`b4Shell.ts`); the campaign chapter adds
 * the Keyboard Wall, the aux power closet and the service shutter from the
 * observed room builders at the origins below. Prop rects, the shutter slab and
 * the station points are derived from those origins plus the builders' local
 * extents; `scripts/check-campaign-b4.ts` compares them to the built meshes.
 * World metres; provisional 2030 scenery, not a surveyed interior.
 */
type V3=[number,number,number];
const R=OPENING.b4,F=R.floor,TOP=R.floor+R.clearHeight,WALL=.12;
export interface B4Rect{name:string;x0:number;x1:number;z0:number;z1:number;bottom:number;top:number;render?:'wall'|'ceiling'|'rack'|'tier'}
export interface B4Box{x0:number;x1:number;y0:number;y1:number;z0:number;z1:number}
const doorL=R.door-R.doorWidth/2,doorR=R.door+R.doorWidth/2;

/** Builder-local extents (src/model/observedFeatureRooms.ts), measured from the built
 * parts. Builders face +z, y=0 is their floor. */
export const B4_BUILDER={
 keyboard:{
  /** `Keyboard_timber_wall` ∪ `Keyboard_wall` (panel + 54 caps). */
  bounds:{x0:-3.87,x1:4.83,y0:.72,y1:3.74,z0:-4.24,z1:-3.66},
  /** `Keyboard_wall` (backing frame + caps): what the focus view frames. */
  panelBox:{x0:-3.425,x1:4.385,y0:1.565,y1:3.715,z0:-4.239,z1:-3.664},
 },
 flip:{
  /** `HKU_flip_wall` (frame + 561 tiles), closed. Built in Building 5 only. */
  wall:{x0:-3.387,x1:3.987,y0:.06,y1:3.923,z0:-1.989,z1:-1.759},
  /** `Aux_power_closet`; `contentsFront` is the front of the PSU modules inside the cavity. */
  closet:{x0:-3.42,x1:4.02,y0:.03,y1:3.951,z0:-2.985,z1:-1.91,contentsFront:-2.18,side:.1},
  lever:[.30,1.86,-2.26] as V3,
  breakerPanel:{x0:-.55,x1:1.15,y0:1.36,y1:2.36,z0:-2.39,z1:-2.29},
  rail:{x0:-2.65,x1:3.25,y0:1.2025,y1:1.2375,z0:-2.28,z1:-2.26},
 },
} as const;

/** The Keyboard Wall stands against the east wall: the builder's +z face looks west into the room. */
const keyboardOrigin:V3=[65.94,F,13.12],keyboardYaw=-Math.PI/2;
/** The aux power closet, breaker and port stand against the north wall, facing +z (south). */
const closetOrigin:V3=[59.70,F,10.11];
const at=(o:V3,b:{x0:number;x1:number;y0:number;y1:number;z0:number;z1:number}):B4Box=>({x0:o[0]+b.x0,x1:o[0]+b.x1,y0:o[1]+b.y0,y1:o[1]+b.y1,z0:o[2]+b.z0,z1:o[2]+b.z1});
/** A builder box → world box for a group at `o` turned by `yaw` about y. */
function atYaw(o:V3,b:{x0:number;x1:number;y0:number;y1:number;z0:number;z1:number},yaw:number):B4Box{
 const c=Math.cos(yaw),s=Math.sin(yaw),xs:number[]=[],zs:number[]=[];
 for(const x of [b.x0,b.x1])for(const z of [b.z0,b.z1]){xs.push(o[0]+x*c+z*s);zs.push(o[2]-x*s+z*c);}
 return{x0:Math.min(...xs),x1:Math.max(...xs),y0:o[1]+b.y0,y1:o[1]+b.y1,z0:Math.min(...zs),z1:Math.max(...zs)};
}
const K=B4_BUILDER.keyboard,FW=B4_BUILDER.flip;
/** Inside face of the east wall: everything past it is buried in the shell. */
const eastFace=R.x1-.01-WALL;
const keyboardBox=atYaw(keyboardOrigin,K.bounds,keyboardYaw);
const keyboardPanelWorld=atYaw(keyboardOrigin,K.panelBox,keyboardYaw);
/** The panel's world box, clipped by the east wall (its rear third sits inside the wall). */
const keyboardPanel={...keyboardPanelWorld,x1:Math.min(keyboardPanelWorld.x1,eastFace)};
const closetBox=at(closetOrigin,FW.closet);
const inner={z0:R.z0+.01+WALL};
/** The breaker lever, breaker panel and port rail are mounted inside the closet mouth: the
 * closet's solid rects already cover them, so their station boxes are the interactables. */
const leverAt:V3=[closetOrigin[0]+FW.lever[0],closetOrigin[1]+FW.lever[1],closetOrigin[2]+FW.lever[2]];
const breakerBox=at(closetOrigin,FW.breakerPanel);
const railBox=at(closetOrigin,FW.rail);

/** Three solid timber tiers under the Keyboard Wall, front (west) to back (east). */
export const B4_TIERS=[
 {name:'opening-b4-tier-1',x0:68.05,x1:68.57,top:.32},
 {name:'opening-b4-tier-2',x0:68.57,x1:69.09,top:.62},
 {name:'opening-b4-tier-3',x0:69.09,x1:69.60,top:.92},
] as const;
const tierZ:[number,number]=[9.70,17.50];

/** Lobby seating group (photo 05-cds-zj-atrium): a round rug, a curved sofa with its gap
 * toward the north-west, two armchairs, a side stool and a low table. The shell draws the
 * scenery and the collision rects come from the same numbers. */
export const B4_LOBBY={
 /** Circular rug under the seating group: decor, not collidable. */
 rug:{x:65.0,z:14.2,r:2.4},
 /** Curved sofa: seat modules on an arc, backs outward, the gap opening north-west.
  * Angles are world x/z radians (0 = +x east, π/2 = +z south). */
 sofa:{cx:66.6,cz:17.2,radius:1.35,from:-20*Math.PI/180,to:160*Math.PI/180,modules:8,seatDepth:.62,backDepth:.26,seat:.42,back:.78},
 armchairs:[{x:61.8,z:15.6},{x:64.4,z:9.9}],
 armchairSize:.78,
 /** Side stool by the wall: decor, not collidable. */
 stool:{x:66.0,z:11.4,r:.21,h:.45},
 table:{x:63.8,z:14.6,r:.45,h:.42},
} as const;
const L=B4_LOBBY;
/** One axis-aligned box per sofa module (seat footprint plus back), derived from the arc. */
export const B4_SOFA_RECTS:(readonly [number,number,number,number])[]=(()=>{
 const s=L.sofa,span=s.to-s.from,depth=s.seatDepth+s.backDepth,out:(readonly [number,number,number,number])[]=[];
 for(let i=0;i<s.modules;i++){
  const t=s.from+span*(i+.5)/s.modules,width=2*s.radius*Math.sin(span/(2*s.modules))+.03;
  const x=s.cx+s.radius*Math.cos(t),z=s.cz+s.radius*Math.sin(t);
  const hx=width/2*Math.abs(Math.sin(t))+depth/2*Math.abs(Math.cos(t)),hz=width/2*Math.abs(Math.cos(t))+depth/2*Math.abs(Math.sin(t));
  out.push([x-hx,x+hx,z-hz,z+hz]);
 }
 return out;
})();

export const B4_LAYOUT={
 room:R,
 wall:WALL,
 keyboardOrigin,keyboardYaw,
 closetOrigin,
 keyboardBox,keyboardPanel,closetBox,
 tiers:B4_TIERS,tierZ,
 lobby:B4_LOBBY,sofaRects:B4_SOFA_RECTS,
 /** Closed service shutter over the aux power closet mouth: dynamic, lifts when CPU 01 boots.
  * (The HKU flip wall used to stand in B4; the shutter keeps that slab's plumbing.) */
 shutter:{name:'opening-b4-flip-panel',x0:56.30,x1:63.70,z0:8.14,z1:8.30,bottom:0,top:closetBox.y1},
 /** The shutter lifts into the ceiling slot when it opens. */
 shutterLift:R.clearHeight+.05,
 /** Point lights stay inside the room: z + distance never reaches the entrance wall. */
 lights:{
  emergency:[{p:[51.5,3.6,10.5],d:9},{p:[63.5,3.6,10.8],d:9},{p:[58,3.6,13.5],d:6.5}] as {p:V3;d:number}[],
  work:{p:[58,3.9,12] as V3,d:8},
  rack:{p:[50.3,2.4,8.9] as V3,d:5},
  /** Ruling 39: the dim powered state after the MacBook connects. Each range stays inside the
   * room (x 46–70, z 7–20.5), so nothing lights the plaza through the facade. */
  powered:[
   {p:[58,3.9,13.75] as V3,d:6.5,color:0xdcefe6,intensity:16},
   {p:[66.4,2.4,13.25] as V3,d:3.4,color:0x4dff9a,intensity:9},
  ],
 },
 /** Supercomputer cabinets along the north wall, west of the service wall. */
 rackZ:[7.13,8.33] as [number,number],
 rackX:[[47.40,48.70],[48.90,50.20],[50.40,51.70],[51.90,53.20]] as [number,number][],
 rackTop:2.3,
 /** Entrance door leaves in the B04 doorway, rendered and solid during Chapter 1. */
 door:{x0:doorL,x1:doorR,z:R.z1+.06,height:R.doorHeight,thickness:.06,slide:R.doorWidth/2+.05},
} as const;

const rect=(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number,render?:B4Rect['render']):B4Rect=>({name,x0,x1,z0,z1,bottom,top,render});
const arm=L.armchairSize/2;
/** Every static collision box of the lobby. Rects with `render` are drawn by the shell;
 * the prop rects are drawn by the observed room builders the chapter places. */
export const B4_OBSTACLES:B4Rect[]=[
 rect('opening-b4-wall-west',R.x0+.01,R.x0+.01+WALL,R.z0,R.z1,0,TOP,'wall'),
 rect('opening-b4-wall-east',R.x1-.01-WALL,R.x1-.01,R.z0,R.z1,0,TOP,'wall'),
 rect('opening-b4-wall-back',R.x0,R.x1,R.z0+.01,inner.z0,0,TOP,'wall'),
 rect('opening-b4-wall-front-left',R.x0,doorL,R.z1-.13,R.z1-.01,0,TOP,'wall'),
 rect('opening-b4-wall-front-right',doorR,R.x1,R.z1-.13,R.z1-.01,0,TOP,'wall'),
 rect('opening-b4-wall-lintel',doorL,doorR,R.z1-.13,R.z1-.01,F+R.doorHeight,TOP,'wall'),
 rect('opening-b4-ceiling',R.x0,R.x1,R.z0,R.z1,TOP-.1,TOP+.08,'ceiling'),
 // The three timber tiers in front of the Keyboard Wall: solid steps, the east wall behind them.
 ...B4_TIERS.map(t=>rect(t.name,t.x0,t.x1,tierZ[0],tierZ[1],F,t.top,'tier')),
 // Aux power closet: the rack contents and both cavity sides; the service shutter closes its mouth.
 rect('opening-b4-closet',closetBox.x0,closetBox.x1,Math.max(inner.z0,closetBox.z0),closetOrigin[2]+FW.closet.contentsFront,0,closetBox.y1),
 rect('opening-b4-closet-west',closetBox.x0,closetBox.x0+FW.closet.side,closetOrigin[2]+FW.closet.contentsFront,closetBox.z1,0,closetBox.y1),
 rect('opening-b4-closet-east',closetBox.x1-FW.closet.side,closetBox.x1,closetOrigin[2]+FW.closet.contentsFront,closetBox.z1,0,closetBox.y1),
 ...B4_LAYOUT.rackX.map(([x0,x1],i)=>rect('opening-b4-rack-'+(i+1),x0,x1,B4_LAYOUT.rackZ[0],B4_LAYOUT.rackZ[1],F,F+B4_LAYOUT.rackTop,'rack')),
 // Lobby furniture the player walks into: the sofa modules, the two armchairs and the low table.
 ...B4_SOFA_RECTS.map(([x0,x1,z0,z1],i)=>rect('opening-b4-sofa-'+(i+1),x0,x1,z0,z1,F,F+L.sofa.back)),
 ...L.armchairs.map((c,i)=>rect('opening-b4-armchair-'+(i+1),c.x-arm,c.x+arm,c.z-arm,c.z+arm,F,F+.74)),
 rect('opening-b4-table',L.table.x-L.table.r,L.table.x+L.table.r,L.table.z-L.table.r,L.table.z+L.table.r,F,F+L.table.h),
];

export type B4StationId='keyboard'|'breaker'|'port';
/** `point` is what the focus view aims at, `box` is the interactable (reach and the gold
 * highlight use it), `stand` is where a player stops in front of it. */
export interface B4Station{id:B4StationId;label:string;point:V3;box:B4Box;stand:V3}
export const B4_STATIONS:Record<B4StationId,B4Station>={
 /** Lower third of the panel: the eye→point ray from the stand stays inside the 2.2 m reach. */
 keyboard:{id:'keyboard',label:'Keyboard Wall',point:[keyboardPanel.x0,2.10,13.60],box:{...keyboardPanel,x1:R.x1},stand:[67.55,F,13.60]},
 breaker:{id:'breaker',label:'Breaker lever',point:leverAt,box:breakerBox,stand:[59.20,F,9.50]},
 port:{id:'port',label:'Supercomputer port',point:[60.00,1.25,7.85],box:railBox,stand:[60.80,F,9.50]},
};
/** What the keyboard focus view frames, and which way it looks: the east wall, square-on. */
export const B4_FOCUS_FRAME:Record<'keyboard',{box:B4Box;facing:[number,number]}>={
 keyboard:{box:keyboardPanel,facing:[-1,0]},
};
/** Focus camera for a vertical panel: eye on the panel's centre line `d` metres out along
 * `facing` (default +z, the north-wall props), far enough back that the panel plus `margin`
 * fits a camera with vertical `fovDeg` and `aspect`. Never further than the opposite wall. */
export function focusPose(frame:B4Box,fovDeg:number,aspect:number,margin=.25,facing:[number,number]=[0,1]){
 const acrossX=facing[0]!==0,width=acrossX?frame.z1-frame.z0:frame.x1-frame.x0;
 const cx=(frame.x0+frame.x1)/2,cz=(frame.z0+frame.z1)/2,cy=(frame.y0+frame.y1)/2;
 const hw=width/2+margin,hh=(frame.y1-frame.y0)/2+margin,t=Math.tan(fovDeg*Math.PI/360);
 const surface=acrossX?(facing[0]<0?frame.x0:frame.x1):(facing[1]<0?frame.z0:frame.z1);
 const wall=acrossX?(facing[0]<0?R.x0+.01+WALL:R.x1-.01-WALL):(facing[1]<0?R.z0+.01+WALL:R.z1-.13);
 const d=Math.min(Math.max(hh/t,hw/(t*Math.max(.2,aspect))),Math.abs(wall-surface)-.6);
 const eye:V3=acrossX?[surface+facing[0]*d,cy,cz]:[cx,cy,surface+facing[1]*d];
 const target:V3=acrossX?[surface,cy,cz]:[cx,cy,surface];
 return{eye,target,distance:d};
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

/** The closed service shutter is a real collision slab (like the bus door), removed when it
 * lifts. Historically this slab was the HKU flip wall; the name and signature are unchanged
 * so every caller and check keeps working. The visible slab is the chapter's own mesh. */
export function setB4FlipPanel(world:{obstacles:Obstacle[];meshes:T.Mesh[]},closed:boolean){
 const p=B4_LAYOUT.shutter,index=world.obstacles.findIndex(o=>o.name===p.name);
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
