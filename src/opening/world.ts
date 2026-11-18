import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {campusFont} from '../model/fonts';
import {glassMaterial} from '../model/glazing';
import {createMacBook} from '../items/macbook';
import {OPENING as O} from './spatialLayout';

/**
 * Thomas opening scenery: the campus shuttle, the Building 5 ground-floor dinner
 * area and the Building 6 presentation room. Every position is read from
 * src/opening/spatialLayout.ts; no coordinate is invented here.
 *
 * Sizes are technical estimates for provisional 2030 scenery, not surveyed interiors.
 * Construction must stay DOM-free so the same module builds in the browser, in the
 * Node geometry check and in the GLB exporter.
 */

const SOURCE_FILE='src/opening/world.ts';
const SOURCE='Thomas opening layout (src/opening/spatialLayout.ts) with campus pixel style';
const CONFIDENCE='technical estimate for provisional 2030 scenery; not a surveyed interior';

function std(name:string,color:number,emissive?:number,emissiveIntensity=0){
 const m=new T.MeshStandardMaterial({name,color,roughness:.85,metalness:.02});
 if(emissive!==undefined){m.emissive.setHex(emissive);m.emissiveIntensity=emissiveIntensity;}
 return m;
}
/** Stable authored identity. Never a UUID, a world coordinate or an array index. */
function tag<T extends T.Object3D>(o:T,authorKey:string,name:string):T{
 o.name=name;
 o.userData={...(o.userData??{}),authorKey,sourceFile:SOURCE_FILE,source:SOURCE,confidence:CONFIDENCE};
 return o;
}
function box(parent:T.Object3D,authorKey:string,w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material){
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);
 return tag(mesh,authorKey,authorKey);
}
function pane(parent:T.Object3D,authorKey:string,w:number,h:number,x:number,y:number,z:number,material:T.Material,yaw=0){
 const mesh=new T.Mesh(new T.PlaneGeometry(w,h),material);
 mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.castShadow=false;mesh.receiveShadow=false;
 parent.add(mesh);
 return tag(mesh,authorKey,authorKey);
}

/* ------------------------------------------------------------------ */
/* Campus shuttle                                                      */
/* ------------------------------------------------------------------ */

const BUS_WALL=.10;
const BUS_SILL_OFFSET=.70;   // window sill above the bus floor
const BUS_HEAD_OFFSET=1.62;  // window head above the bus floor
const DOOR_OPEN_ANGLE=1.75;  // radians; the leaf folds inward so the exit stays clear
const DOOR_SECONDS=.55;

function buildBus(root:T.Group,materials:ReturnType<typeof busMaterials>){
 const b=O.bus;
 const x0=b.x-b.width/2,x1=b.x+b.width/2,z0=b.z-b.length/2,z1=b.z+b.length/2;
 const floor=b.floor,roofBottom=b.floor+2.15,roofTop=b.floor+2.30;
 const sill=floor+BUS_SILL_OFFSET,head=floor+BUS_HEAD_OFFSET;
 const doorFrom=b.doorZ-.7,doorTo=b.doorZ+.7;
 const group=tag(new T.Group(),'opening-bus','Opening_bus');
 root.add(group);

 // Chassis and floor share one slab so the walkable top is exactly OPENING.bus.floor.
 box(group,'opening-bus-chassis',b.width,floor,b.length,b.x,floor/2,b.z,materials.green);
 // Roof.
 box(group,'opening-bus-roof',b.width,roofTop-roofBottom,b.length,b.x,(roofBottom+roofTop)/2,b.z,materials.ivory);

 /** Wall band along Z: inner face at x=inner, body on the +dir side. */
 const wallZ=(key:string,inner:number,dir:1|-1,from:number,to:number,bays:number)=>{
  const mid=inner+dir*BUS_WALL/2,len=to-from,cz=(from+to)/2;
  box(group,key+'-lower',BUS_WALL,sill-floor,len,mid,(sill+floor)/2,cz,materials.green);
  box(group,key+'-upper',BUS_WALL,roofBottom-head,len,mid,(roofBottom+head)/2,cz,materials.ivory);
  const bay=(to-from)/bays;
  for(let i=0;i<bays;i++){
   const z=from+bay*(i+.5);
   pane(group,key+'-glass-'+i,bay-.10,head-sill,inner-dir*.004,(sill+head)/2,z,materials.glass,dir===1?-Math.PI/2:Math.PI/2);
   box(group,key+'-mullion-'+i,.06,head-sill,.07,mid,(sill+head)/2,from+bay*i+busMullionOffset(bays,i),materials.trim);
  }
 };
 /** Wall band along X: inner face at z=inner, body on the +dir side. */
 const wallX=(key:string,inner:number,dir:1|-1,from:number,to:number,bays:number)=>{
  const mid=inner+dir*BUS_WALL/2,len=to-from,cx=(from+to)/2;
  box(group,key+'-lower',len,sill-floor,BUS_WALL,cx,(sill+floor)/2,mid,materials.green);
  box(group,key+'-upper',len,roofBottom-head,BUS_WALL,cx,(roofBottom+head)/2,mid,materials.ivory);
  const bay=(to-from)/bays;
  for(let i=0;i<bays;i++){
   const x=from+bay*(i+.5);
   pane(group,key+'-glass-'+i,bay-.10,head-sill,x,(sill+head)/2,inner-dir*.004,materials.glass,dir===1?Math.PI:0);
   box(group,key+'-mullion-'+i,.07,head-sill,.06,from+bay*i+busMullionOffset(bays,i),(sill+head)/2,mid,materials.trim);
  }
 };
 // East, front and rear walls; the west wall is split around the doorway.
 wallZ('opening-bus-wall-east',x1-BUS_WALL,-1,z0,z1,6);
 wallX('opening-bus-wall-front',z0+BUS_WALL,1,x0,x1,3);
 wallX('opening-bus-wall-rear',z1-BUS_WALL,-1,x0,x1,6);
 wallZ('opening-bus-wall-west-front',x0+BUS_WALL,1,z0,doorFrom,1);
 wallZ('opening-bus-wall-west-rear',x0+BUS_WALL,1,doorTo,z1,4);

 // Three-step transition outside the west exit; matches opening/navigation.ts.
 const step=(key:string,x1s:number,x2s:number,top:number)=>box(group,key,x2s-x1s,top,x2s-x1s,(x1s+x2s)/2,top/2,b.doorZ,materials.step);
 step('opening-bus-step-1',61.9,62.7,.18);
 step('opening-bus-step-2',62.7,63.5,.36);

 // Rear seating only; the doorway channel (z 31.9..33.3) stays clear.
 const seats=tag(new T.Group(),'opening-bus-seating','Opening_bus_seating');
 group.add(seats);
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const z=34.9+i*1.45,x=b.x+side*1.05;
  box(seats,'opening-bus-seat-'+side+'-'+i,.62,.10,.60,x,floor+.44,z,materials.seat);
  box(seats,'opening-bus-seatback-'+side+'-'+i,.62,.52,.09,x,floor+.72,z+.28,materials.seat);
  box(seats,'opening-bus-seatleg-'+side+'-'+i,.07,.40,.07,x,floor+.20,z-.20,materials.metal);
 }
 // Handrails beside the exit, clear of the doorway itself.
 box(group,'opening-bus-rail-west',.06,2.00,.06,x0+.28,floor+1.00,doorTo+.16,materials.metal);
 box(group,'opening-bus-rail-front',.06,2.00,.06,x0+.28,floor+1.00,doorFrom-.16,materials.metal);

 // Shuttle sign on the east flank.
 const sign=tag(new T.Group(),'opening-bus-sign','Opening_bus_sign');
 group.add(sign);
 box(sign,'opening-bus-sign-plate',.06,.42,2.30,x1+.02,floor+1.42,b.z+1.30,materials.green);
 const geo=new TextGeometry('HKU SHUTTLE',{font:campusFont,size:.24,depth:.012,curveSegments:1});
 geo.computeBoundingBox();
 const bb=geo.boundingBox!;
 geo.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
 const text=new T.Mesh(geo,materials.ivory);
 text.rotation.y=Math.PI/2;text.position.set(x1+.055,floor+1.42,b.z+1.30);text.castShadow=false;
 sign.add(text);
 tag(text,'opening-bus-sign-text','opening-bus-sign-text');

 // Door leaf: hinged at the north edge of the doorway, folding inward over the seats.
 const pivot=tag(new T.Group(),'opening-bus-door','Opening_bus_door');
 pivot.position.set(x0-.02,0,doorFrom+.05);
 group.add(pivot);
 const leafWidth=doorTo-doorFrom-.10;
 box(pivot,'opening-bus-door-panel',.07,2.06,leafWidth,.03,(floor+2.60)/2,leafWidth/2,materials.green);
 pane(pivot,'opening-bus-door-glass',leafWidth-.16,.86,.066,(floor+1.36),leafWidth/2,materials.glass,Math.PI/2);
 box(pivot,'opening-bus-door-edge',.09,2.06,.06,.03,(floor+2.60)/2,leafWidth-.03,materials.trim);

 return{group,pivot,doorLeaf:pivot};
}
/** Mullion spacing helper kept separate so the window band stays readable. */
function busMullionOffset(bays:number,i:number){return .035;}

function busMaterials(){
 return{
  green:std('Opening_bus_green',0x2e6b4c),
  ivory:std('Opening_bus_ivory_panel',0xf0ead9),
  trim:std('Opening_bus_trim',0x1f3b32),
  seat:std('Opening_bus_seat',0x274f42),
  metal:std('Opening_metal_rail',0x9aa39c),
  step:std('Opening_bus_step',0x8e948c),
  glass:glassMaterial('clear'),
 };
}

/* ------------------------------------------------------------------ */
/* Building 5 ground-floor dinner area                                 */
/* ------------------------------------------------------------------ */

const DINNER_TABLES:[number,number][]=[[61.5,-64.8],[65.8,-64.8],[67.2,-61.0],[61.0,-62.5]];
/** Chairs that topple when the hall empties. */
const TIPPING_CHAIRS:[number,number,number][]=[[60.0,-64.8,Math.PI],[63.0,-64.8,Math.PI],[64.6,-64.8,Math.PI/2]];

function buildDinner(root:T.Group){
 const room=O.b5;
 const group=tag(new T.Group(),'opening-b5-dinner','Opening_b5_dinner');
 root.add(group);
 const floorTop=room.floor;
 const materials={
  floor:std('Opening_b5_floor',0xd9d2bf),
  wall:std('Opening_b5_wall',0xe6e2d3),
  table:std('Opening_dinner_table_top',0xb99a68),
  cloth:std('Opening_dinner_cloth',0xf5f1e4),
  green:std('Opening_dinner_green_cloth',0x2f6b4c),
  chair:std('Opening_dinner_chair',0x4b7a63),
  frame:std('Opening_dinner_chair_frame',0x7d8a7c),
  greenery:std('Opening_dinner_greenery',0x4e7f4a),
  plate:std('Opening_dinner_plate',0xf2f0e8),
  cup:std('Opening_dinner_cup',0xe8e4d8),
  lamp:std('Opening_ceiling_lamp',0xfff1cd,0xffe3a8,.55),
  accent:std('Opening_incident_accent',0x9c3b32),
 };
 // Room floor: top surface exactly on the shared support height.
 const w=room.x1-room.x0,d=room.z1-room.z0;
 box(group,'opening-b5-floor',w,.18,d,(room.x0+room.x1)/2,floorTop-.09,(room.z0+room.z1)/2,materials.floor);
 // Low foyer partition that makes "turn right after entering" legible.
 box(group,'opening-b5-partition',.30,1.15,2.90,60.10,floorTop+.575,-56.35,materials.wall);
 // Catering counter against the north wall.
 box(group,'opening-b5-counter',6.0,1.00,.60,65.0,floorTop+.50,-65.40,materials.table);
 box(group,'opening-b5-counter-front',6.0,.16,.04,65.0,floorTop+.55,-65.11,materials.green);
 // Ceiling light strips; emissive only, so the incident state can dim them cheaply.
 const strips:T.MeshStandardMaterial[]=[];
 for(const z of [-59.2,-63.6]){
  const m=materials.lamp.clone();m.name='Opening_ceiling_lamp_'+String(z).replace('.','_');strips.push(m);
  box(group,'opening-b5-ceiling-light-'+String(z).replace('.','_'),12.0,.10,.40,61.5,2.52,z,m);
 }
 // Furniture. Everything stays visible in both states: the incident is expressed by
 // moving and tipping the props, never by hiding them, so the exported GLB keeps the
 // same geometry in either state.
 const props=tag(new T.Group(),'opening-b5-props','Opening_b5_props');
 group.add(props);
 DINNER_TABLES.forEach(([x,z],i)=>{
  box(props,'opening-b5-table-'+i,1.30,.08,1.30,x,floorTop+.74,z,materials.table);
  box(props,'opening-b5-table-leg-'+i,.16,.70,.16,x,floorTop+.35,z,materials.frame);
  box(props,'opening-b5-tablecloth-'+i,1.42,.03,1.42,x,floorTop+.795,z,materials.cloth);
  box(props,'opening-b5-runner-'+i,.34,.02,1.44,x,floorTop+.812,z,materials.green);
  box(props,'opening-b5-plate-'+i+'-a',.26,.03,.26,x-.28,floorTop+.825,z-.30,materials.plate);
  box(props,'opening-b5-plate-'+i+'-b',.26,.03,.26,x+.28,floorTop+.825,z+.30,materials.plate);
  box(props,'opening-b5-cup-'+i+'-a',.09,.12,.09,x-.28,floorTop+.88,z-.30,materials.cup);
  box(props,'opening-b5-cup-'+i+'-b',.09,.12,.09,x+.28,floorTop+.88,z+.30,materials.cup);
  box(props,'opening-b5-candle-'+i,.06,.20,.06,x,floorTop+.90,z+.18,materials.lamp);
  for(const [dx,dz] of [[-.95,0],[.95,0],[0,-.95],[0,.95]]){
   const key='opening-b5-chair-'+i+'-'+dx+'-'+dz;
   box(props,key+'-seat',.44,.07,.44,x+dx,floorTop+.45,z+dz,materials.chair);
   box(props,key+'-back',.44,.48,.07,x+dx,floorTop+.72,z+dz+(dz===0?-.20:.0),materials.chair);
   box(props,key+'-leg',.06,.42,.06,x+dx,floorTop+.21,z+dz,materials.frame);
  }
  // Keep the planter inside the room: it sits on whichever side still has wall left.
  const planterX=x+1.9>room.x1-.6?x-1.9:x+1.9;
  box(props,'opening-b5-planter-'+i,.42,.42,.42,planterX,floorTop+.21,z-.4,materials.green);
 });
 // Chairs that stand for dinner and topple once the hall is abandoned. One chair,
 // two poses: the geometry never changes, only the transform.
 const tipping:{node:T.Group;upright:T.Vector3;uprightYaw:number;fallen:T.Vector3;fallenEuler:number}[]=[];
 TIPPING_CHAIRS.forEach(([x,z,yaw],index)=>{
  const chair=tag(new T.Group(),'opening-b5-chair-'+index,'Opening_b5_tipping_chair_'+index);
  group.add(chair);
  box(chair,'opening-b5-chair-standing-seat',.44,.07,.44,0,.45,0,materials.chair);
  box(chair,'opening-b5-chair-standing-back',.44,.48,.07,0,.72,-.20,materials.chair);
  box(chair,'opening-b5-chair-standing-leg',.06,.42,.06,0,.21,0,materials.frame);
  tipping.push({node:chair,upright:new T.Vector3(x,floorTop,z),uprightYaw:yaw,fallen:new T.Vector3(x+.30,floorTop+.10,z+.22),fallenEuler:1.42});
 });
 // Left-behind items. They rest on the catering counter while the hall is in use and
 // end up on the floor afterwards.
 const dropped:{node:T.Object3D;upright:T.Vector3;fallen:T.Vector3}[]=[];
 const drop=(key:string,w:number,h:number,d:number,upright:T.Vector3,fallen:T.Vector3,material:T.Material)=>{
  const mesh=box(group,key,w,h,d,upright.x,upright.y,upright.z,material);
  dropped.push({node:mesh,upright,fallen});
 };
 drop('opening-b5-dropped-cup',.09,.12,.09,new T.Vector3(65.6,floorTop+1.06,-65.35),new T.Vector3(62.4,floorTop+.06,-60.6),materials.cup);
 drop('opening-b5-dropped-menu',.21,.02,.30,new T.Vector3(64.4,floorTop+1.01,-65.30),new T.Vector3(63.1,floorTop+.01,-59.4),materials.cloth);
 drop('opening-b5-fallen-lamp',.12,.30,.12,new T.Vector3(66.2,floorTop+1.15,-65.32),new T.Vector3(61.7,floorTop+.15,-60.9),materials.accent);

 return{group,props,tipping,dropped,strips,materials};
}

/* ------------------------------------------------------------------ */
/* Building 6 presentation room                                        */
/* ------------------------------------------------------------------ */

function buildOffice(root:T.Group){
 const room=O.b6;
 const group=tag(new T.Group(),'opening-b6-office','Opening_b6_office');
 root.add(group);
 const floorTop=room.floor;
 const materials={
  floor:std('Opening_b6_floor',0xdfe3dd),
  wall:std('Opening_b6_wall',0xe4e7e2),
  desk:std('Opening_b6_desk_top',0x9c7c52),
  leg:std('Opening_b6_desk_leg',0x8a8f86),
  case:std('Opening_b6_cabinet',0x6f7f70),
  greenery:std('Opening_b6_greenery',0x4e7f4a),
  lamp:std('Opening_b6_ceiling_lamp',0xfff1cd,0xffe3a8,.5),
  paper:std('Opening_b6_paper',0xf3f1e8),
 };
 const w=room.x1-room.x0,d=room.z1-room.z0;
 box(group,'opening-b6-floor',w,.18,d,(room.x0+room.x1)/2,floorTop-.09,(room.z0+room.z1)/2,materials.floor);
 box(group,'opening-b6-ceiling-light',5.2,.10,.34,5.5,floorTop+2.48,-57.6,materials.lamp);
 // Credenza along the north wall and a planter in the far corner.
 box(group,'opening-b6-credenza',5.0,.90,.55,4.5,floorTop+.45,-61.45,materials.case);
 box(group,'opening-b6-planter',.44,.44,.44,1.9,floorTop+.22,-60.6,materials.greenery);
 // Presentation desk; the MacBook sits on it at OPENING.laptop.
 const desk=box(group,'opening-b6-desk',1.90,.09,.84,O.laptop[0],O.laptop[1]-.045,O.laptop[2],materials.desk);
 tag(desk,'opening-b6-desk','opening-b6-desk');
 for(const dx of [-.82,.82])for(const dz of [-.32,.32])box(group,'opening-b6-desk-leg-'+dx+'-'+dz,.09,O.laptop[1]-floorTop-.09,.09,O.laptop[0]+dx,(floorTop+O.laptop[1]-.09)/2,O.laptop[2]+dz,materials.leg);
 box(group,'opening-b6-desk-sheet',.21,.012,.30,O.laptop[0]-.62,O.laptop[1]+.006,O.laptop[2]+.12,materials.paper);

 // World laptop: hidden once the player carries it. No item is granted here.
 const laptop=createMacBook();
 laptop.root.position.set(O.laptop[0],O.laptop[1],O.laptop[2]);
 laptop.root.rotation.y=Math.PI;
 group.add(laptop.root);
 tag(laptop.root,'opening-b6-macbook','Opening_b6_macbook');

 return{group,laptop,materials};
}

/* ------------------------------------------------------------------ */
/* Public module                                                       */
/* ------------------------------------------------------------------ */

export function createOpeningWorld(){
 const root=tag(new T.Group(),'opening-world','Opening_world');
 const bus=buildBus(root,busMaterials());
 const dinner=buildDinner(root);
 const office=buildOffice(root);

 let doorT=0;         // 0 closed, 1 fully open
 let incident=false;
 let laptopTaken=false;
 const incidentStrips=dinner.strips.map(m=>({material:m,normal:m.emissiveIntensity,incident:.12}));
 applyIncident(false);

 /** The incident state tips chairs, drops the left-behind items and dims the hall. */
 function applyIncident(next:boolean){
  incident=next;
  for(const chair of dinner.tipping){
   if(next){
    chair.node.position.copy(chair.fallen);
    chair.node.rotation.set(chair.fallenEuler,chair.uprightYaw+.4,.2);
   }else{
    chair.node.position.copy(chair.upright);
    chair.node.rotation.set(0,chair.uprightYaw,0);
   }
  }
  for(const item of dinner.dropped)item.node.position.copy(next?item.fallen:item.upright);
  for(const strip of incidentStrips)strip.material.emissiveIntensity=next?strip.incident:strip.normal;
 }
 function update(state:{incident:boolean;laptopAcquired:boolean;doorOpen:boolean},dt:number){
  // dt may be zero (paused frame): animation must not advance, state must not reset.
  if(dt>0){
   const goal=state.doorOpen?1:0;
   const step=dt/DOOR_SECONDS;
   doorT+=Math.max(-step,Math.min(step,goal-doorT));
  }
  bus.pivot.rotation.y=DOOR_OPEN_ANGLE*doorT;
  if(state.incident!==incident)applyIncident(state.incident);
  if(state.laptopAcquired!==laptopTaken){
   laptopTaken=state.laptopAcquired;
   office.laptop.root.visible=!laptopTaken;
  }
 }
 function dispose(){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  root.traverse(o=>{
   const mesh=o as T.Mesh;
   if(mesh.geometry)geometries.add(mesh.geometry);
   if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);
  });
  geometries.forEach(g=>g.dispose());
  materials.forEach(m=>m.dispose());
  root.removeFromParent();
 }
 return{root,update,dispose};
}
