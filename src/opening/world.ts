import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {campusFont} from '../model/fonts';
import {glassMaterial} from '../model/glazing';
import {compact} from '../model/buildCampus';
import {emblemMaterial} from '../model/heraldry';
import dinnerArms from '../model/dinner-arms.json';
import shield from '../model/hall-crest.json';
import {createMacBook} from '../items/macbook';
import {OPENING as O,DINNER_LAYOUT as D,DINNER_HEAD as H} from './spatialLayout';
import {openingLift} from './navigation';
import {OPENING_STAIR_PASSAGE as SP} from '../model/groundLayout';

/**
 * Thomas opening scenery: the campus shuttle, the Building 5 ground-floor dinner
 * area and the Building 6 presentation room. Route/cavity bounds and dinner
 * layout share src/opening/spatialLayout.ts; decorative offsets remain estimated.
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
 if(emissive!==undefined&&emissive!==0){m.emissive.setHex(emissive);if(m.emissive.getHex()!==0)m.emissiveIntensity=emissiveIntensity;}
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
const BUS_SILL_OFFSET=.72;   // window sill above the bus floor
const BUS_HEAD_OFFSET=1.66;  // window head above the bus floor
const DOOR_OPEN_ANGLE=1.72;  // radians; the leaf folds inward so the exit stays clear
const DOOR_SECONDS=.55;

/**
 * Small campus shuttle, parked parallel to the R009 arrival road. The body runs
 * along X, the passenger door is on the north face and opens onto the Building 4
 * forecourt. Wheels, glazing, door, bumpers and roof equipment are separate parts
 * so the silhouette reads as a shuttle bus, not a coach or a box.
 */
function buildBus(root:T.Group,materials:ReturnType<typeof busMaterials>){
 const b=O.bus;
 const x0=b.x-b.length/2,x1=b.x+b.length/2,z0=b.z-b.width/2,z1=b.z+b.width/2;
 const floor=b.floor,roofBottom=b.floor+2.15,roofTop=b.floor+2.30;
 const sill=floor+BUS_SILL_OFFSET,head=floor+BUS_HEAD_OFFSET;
 const doorFrom=b.doorX-b.doorWidth/2,doorTo=b.doorX+b.doorWidth/2;
 const group=tag(new T.Group(),'opening-bus','Opening_bus');
 root.add(group);

 // Chassis and floor share one slab so the walkable top is exactly OPENING.bus.floor.
 box(group,'opening-bus-chassis',b.length,floor,b.width,b.x,floor/2,b.z,materials.green);
 // Roof shell with a slightly inset equipment pod.
 box(group,'opening-bus-roof',b.length,BUS_WALL,b.width,b.x,roofBottom+BUS_WALL/2,b.z,materials.ivory);
 box(group,'opening-bus-roof-cap',b.length-.16,.07,b.width-.16,b.x,roofTop,b.z,materials.trim);
 box(group,'opening-bus-roof-ac',1.35,.20,.90,b.x+1.15,roofTop+.10,b.z,materials.trim);
 box(group,'opening-bus-roof-vent',.50,.10,.50,b.x-1.55,roofTop+.05,b.z,materials.metal);

 /** Long wall band along X: inner face at z=inner, body on the +dir side. */
 const wallX=(key:string,inner:number,dir:1|-1,from:number,to:number,bays:number)=>{
  const mid=inner+dir*BUS_WALL/2,len=to-from,cx=(from+to)/2;
  box(group,key+'-lower',len,sill-floor,BUS_WALL,cx,(sill+floor)/2,mid,materials.green);
  box(group,key+'-upper',len,roofBottom-head,BUS_WALL,cx,(roofBottom+head)/2,mid,materials.ivory);
  const bay=(to-from)/bays;
  for(let i=0;i<bays;i++){
   const x=from+bay*(i+.5);
   pane(group,key+'-glass-'+i,bay-.10,head-sill,x,(sill+head)/2,inner-dir*.004,materials.glass,dir===1?Math.PI:0);
   box(group,key+'-mullion-'+i,.07,head-sill,.06,x,(sill+head)/2,mid,materials.trim);
  }
  box(group,key+'-belt',len,.05,.03,cx,head+.02,inner-dir*.02,materials.trim);
  box(group,key+'-skirt',len,.16,.035,cx,floor+.10,inner-dir*.02,materials.trim);
 };
 /** End wall band along Z. */
 const wallZ=(key:string,inner:number,dir:1|-1,from:number,to:number,bays:number)=>{
  const mid=inner+dir*BUS_WALL/2,len=to-from,cz=(from+to)/2;
  box(group,key+'-lower',BUS_WALL,sill-floor,len,mid,(sill+floor)/2,cz,materials.green);
  box(group,key+'-upper',BUS_WALL,roofBottom-head,len,mid,(roofBottom+head)/2,cz,materials.ivory);
  const bay=(to-from)/bays;
  for(let i=0;i<bays;i++){
   const z=from+bay*(i+.5);
   pane(group,key+'-glass-'+i,bay-.10,head-sill,inner-dir*.004,(sill+head)/2,z,materials.glass,dir===1?-Math.PI/2:Math.PI/2);
   box(group,key+'-mullion-'+i,.06,head-sill,.07,mid,(sill+head)/2,z,materials.trim);
  }
 };
 // South side faces the road; north side carries the passenger door.
 wallX('opening-bus-wall-south',z1-.0,-1,x0,x1,5);
 wallX('opening-bus-wall-north-front',z0+.0,1,x0,doorFrom,2);
 wallX('opening-bus-wall-north-rear',z0+.0,1,doorTo,x1,3);
 wallZ('opening-bus-wall-west',x0+.0,1,z0,z1,2);
 wallZ('opening-bus-wall-east',x1-.0,-1,z0,z1,2);

 // Two steps drop onto the forecourt, matching opening/navigation.ts.
 const lo=doorFrom,hi=doorTo;
 const step=(key:string,za:number,zb:number,top:number)=>box(group,key,hi-lo,top,zb-za,(lo+hi)/2,top/2,(za+zb)/2,materials.step);
 step('opening-bus-step-1',z0-1.6,z0-.8,.18);
 step('opening-bus-step-2',z0-.8,z0,.36);

 // Four wheels with hubs; the body sits above them on a visible chassis rail.
 const wheel=(key:string,x:number,z:number)=>{
  const tyreGeo=new T.CylinderGeometry(b.wheelRadius,b.wheelRadius,.20,16);
  tyreGeo.rotateX(Math.PI/2);
  const tyre=new T.Mesh(tyreGeo,materials.tyre);
  tyre.position.set(x,b.wheelRadius,z);tyre.castShadow=true;
  group.add(tyre);tag(tyre,key+'-tyre',key+'-tyre');
  const hubGeo=new T.CylinderGeometry(b.wheelRadius*.46,b.wheelRadius*.46,.23,10);
  hubGeo.rotateX(Math.PI/2);
  const hub=new T.Mesh(hubGeo,materials.hub);
  hub.position.set(x,b.wheelRadius,z);group.add(hub);tag(hub,key+'-hub',key+'-hub');
 };
 for(const x of [b.x-2.15,b.x+2.15])for(const z of [z0-.015,z1+.015])wheel('opening-bus-wheel-'+x+'-'+z,x,z);

 // Bumpers, front lamps and rear lamps keep the front/rear readable.
 box(group,'opening-bus-bumper-front',.16,.24,b.width+.10,x1+.02,floor-.14,b.z,materials.trim);
 box(group,'opening-bus-bumper-rear',.16,.24,b.width+.10,x0-.02,floor-.14,b.z,materials.trim);
 for(const z of [b.z-.78,b.z+.78]){
  box(group,'opening-bus-headlight-'+z,.06,.16,.30,x1+.055,floor+.30,z,materials.lamp);
  box(group,'opening-bus-taillight-'+z,.06,.14,.26,x0-.055,floor+.32,z,materials.tail);
 }
 // Door-side mirror and a small route board above the windscreen.
 box(group,'opening-bus-mirror-arm',.06,.06,.30,doorFrom+.18,floor+1.72,z0-.12,materials.trim);
 box(group,'opening-bus-mirror',.10,.24,.18,doorFrom+.18,floor+1.58,z0-.30,materials.trim);
 box(group,'opening-bus-route-board',1.55,.26,.05,b.x+.55,roofBottom-.03,z1+.045,materials.trim);

 // Rear/front seating. The doorway aisle (x doorFrom..doorTo, z < 30.8) stays clear.
 const seats=tag(new T.Group(),'opening-bus-seating','Opening_bus_seating');
 group.add(seats);
 for(const [x,z] of [[62.1,31.55],[63.8,31.55],[65.5,31.55],[66.9,31.55]]){
  box(seats,'opening-bus-seat-'+x+'-'+z,.62,.10,.54,x,floor+.44,z,materials.seat);
  box(seats,'opening-bus-seatback-'+x+'-'+z,.62,.50,.09,x,floor+.72,z+.24,materials.seat);
  box(seats,'opening-bus-seatleg-'+x+'-'+z,.07,.40,.07,x,floor+.20,z-.18,materials.metal);
 }
 // The physical invitation on the seat beside the player. It is the first
 // diegetic objective, so it gets a paper body, green ribbon and wax seal.
 const invitation=box(group,'opening-bus-invitation',.30,.012,.42,O.invitation[0],O.invitation[1],O.invitation[2],materials.paper);
 invitation.rotation.y=.16;
 const seal=new T.Mesh(new T.CylinderGeometry(.055,.055,.014,14),materials.accent);
 seal.rotation.x=Math.PI/2;seal.position.set(O.invitation[0]+.09,O.invitation[1]+.012,O.invitation[2]+.12);
 group.add(seal);tag(seal,'opening-bus-invitation-seal','opening-bus-invitation-seal');
 box(group,'opening-bus-invitation-ribbon',.035,.014,.42,O.invitation[0]-.08,O.invitation[1]+.007,O.invitation[2],materials.green);

 // Handrails beside the doorway, clear of the opening itself.
 box(group,'opening-bus-rail-west',.06,2.00,.06,doorFrom-.16,floor+1.00,z0+.36,materials.metal);
 box(group,'opening-bus-rail-east',.06,2.00,.06,doorTo+.16,floor+1.00,z0+.36,materials.metal);

 // Shuttle sign on the road-side flank.
 const sign=tag(new T.Group(),'opening-bus-sign','Opening_bus_sign');
 group.add(sign);
 box(sign,'opening-bus-sign-plate',2.30,.42,.05,b.x-.20,floor+1.40,z1+.055,materials.green);
 const geo=new TextGeometry('HKU SHUTTLE',{font:campusFont,size:.24,depth:.012,curveSegments:1});
 geo.computeBoundingBox();
 const bb=geo.boundingBox!;
 geo.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
 const text=new T.Mesh(geo,materials.gold);
 text.position.set(b.x-.20,floor+1.40,z1+.085);text.castShadow=false;
 sign.add(text);tag(text,'opening-bus-sign-text','opening-bus-sign-text');

 // Door leaf: hinged at the west edge of the doorway, folding inward over the aisle.
 const pivot=tag(new T.Group(),'opening-bus-door','Opening_bus_door');
 pivot.position.set(doorFrom+.04,0,z0+.02);
 group.add(pivot);
 const leafWidth=doorTo-doorFrom-.08;
 box(pivot,'opening-bus-door-panel',leafWidth,2.06,.07,leafWidth/2,(floor+2.60)/2,0,materials.green);
 pane(pivot,'opening-bus-door-glass',leafWidth-.18,.92,leafWidth/2,floor+1.40,-.045,materials.glass,Math.PI);
 box(pivot,'opening-bus-door-edge',.06,2.06,.08,leafWidth-.03,(floor+2.60)/2,0,materials.trim);
 box(pivot,'opening-bus-door-handle',.09,.05,.09,leafWidth-.12,floor+1.02,-.08,materials.metal);

 // Destination board on the windscreen header.
 const dest=new TextGeometry('SHUTTLE · B4',{font:campusFont,size:.14,depth:.008,curveSegments:1});
 dest.computeBoundingBox();
 const db=dest.boundingBox!;
 dest.translate(-(db.min.x+db.max.x)/2,-(db.min.y+db.max.y)/2,0);
 const destMesh=new T.Mesh(dest,materials.lamp);
 destMesh.position.set(b.x+.55,roofBottom-.03,z1+.080);destMesh.castShadow=false;
 group.add(destMesh);tag(destMesh,'opening-bus-destination','opening-bus-destination');

 return{group,pivot,doorLeaf:pivot,invitation};
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
  hub:std('Opening_bus_wheel_hub',0xb9c1bb,.4,.5),
  tyre:std('Opening_bus_tyre',0x171c1b,.96,0),
  step:std('Opening_bus_step',0x8e948c),
  lamp:std('Opening_bus_headlamp',0xfff0c2,0xffe6a8,.65),
  tail:std('Opening_bus_taillight',0x8c2c25,0xff3b2e,.55),
  gold:std('Opening_bus_gold_lettering',0xe7c877,.5,.25),
  paper:std('Opening_bus_invitation_paper',0xf3e7c8,.92,0),
  accent:std('Opening_invitation_wax',0x8a2a20,.7,.1),
  glass:(()=>{const m=glassMaterial('clear');m.side=T.DoubleSide;return m;})(),
 };
}

/* ------------------------------------------------------------------ */
/* Building 5 ground-floor dinner area                                 */
/* ------------------------------------------------------------------ */

const DINNER_TABLES=D.tables;
/** Chairs that topple when the hall empties. */
const TIPPING_CHAIRS:[number,number,number][]=[[62.15,-68,Math.PI/2],[67.15,-68,Math.PI/2],[72.15,-68,Math.PI/2]];

function buildDinner(root:T.Group){
 const room=O.b5;
 const group=tag(new T.Group(),'opening-b5-dinner','Opening_b5_dinner');
 root.add(group);
 const floorTop=room.floor;
 const hallFrame=tag(new T.Group(),'opening-b5-horizontal-frame','Opening_b5_horizontal_frame');group.add(hallFrame);
 hallFrame.matrixAutoUpdate=false;hallFrame.matrix.makeTranslation(60.5,0,-78).multiply(new T.Matrix4().makeRotationY(-Math.PI/2)).multiply(new T.Matrix4().makeTranslation(-60.5,0,60));
 const materials={
  floor:std('Opening_b5_floor',0x9b7954),
  wall:std('Opening_b5_wall',0xe6e2d3),
  table:std('Opening_dinner_table_top',0xb99a68),
  cloth:std('Opening_dinner_cloth',0xf5f1e4),
  green:std('Opening_dinner_green_cloth',0x2f6b4c),
  chair:std('Opening_dinner_chair',0x976638),
  frame:std('Opening_dinner_chair_frame',0x413e32),
  greenery:std('Opening_dinner_greenery',0x4e7f4a),
  plate:std('Opening_dinner_plate',0xf2f0e8),
  cup:std('Opening_dinner_cup',0xe8e4d8),
  lamp:std('Opening_ceiling_lamp',0xfff1cd,0xffe3a8,.55),
  accent:std('Opening_incident_accent',0x9c3b32),
 };
 // Room floor: top surface exactly on the shared support height.
 const w=room.x1-room.x0,d=room.z1-room.z0;
 box(group,'opening-b5-floor',w,.18,d,(room.x0+room.x1)/2,floorTop-.09,(room.z0+room.z1)/2,materials.floor);
 // Recorded lobby: pale floor, glass entrance, timber arched portals to the right.
 group.userData.source=D.source;group.userData.confidence='observed features; dimensions and world placement estimated';
 const timber=std('Opening_b5_arch_timber',0x644525),ivory=materials.wall;
 const strips:T.MeshStandardMaterial[]=[],roomLights:T.PointLight[]=[];
 box(group,'opening-b5-lobby-wall',.12,4.45,25,54.15,2.225,-67.35,ivory);
 box(group,'opening-b5-lobby-ceiling',5.8,.10,25,57,4.45,-67.35,ivory);
 box(group,'opening-b5-lobby-floor',5.8,.018,d-.3,57,floorTop+.009,(room.z0+room.z1)/2,ivory);
 // Stable author keys for the original partition/counter are retained.
 box(group,'opening-b5-partition',.24,room.clearHeight,D.doorZ0-room.z0,D.partitionX,room.clearHeight/2,(room.z0+D.doorZ0)/2,timber);
 box(group,'opening-b5-portal-front',.24,room.clearHeight,room.z1-D.doorZ1,D.partitionX,room.clearHeight/2,(room.z1+D.doorZ1)/2,timber);
 box(group,'opening-b5-counter',3.4,.86,.55,56.8,.43,-76,materials.table);
 box(group,'opening-b5-counter-front',3.4,.12,.04,56.8,.5,-75.7,timber);
 // Shallow plank joints keep the floor readable without adding hundreds of lights.
 const floorDetails=tag(new T.Group(),'opening-b5-plank-details','Opening_b5_plank_details');group.add(floorDetails);
 for(let row=0;row<28;row++){
  const z=-81.2+row*.76;
  box(floorDetails,'opening-b5-plank-joint-'+row,D.crossWidth,.006,.016,D.crossCenter,.003,z,timber);
  for(let k=0;k<7;k++)box(floorDetails,'opening-b5-plank-end-'+row+'-'+k,.012,.006,.74,61+(row%2)*1.6+k*3.3,.003,z+.37,timber);
 }
 compact(floorDetails);
 const beam=(key:string,a:T.Vector3,b:T.Vector3,width:number,depth:number,material:T.Material)=>{
  const mesh=box(group,key,a.distanceTo(b),width,depth,0,0,0,material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),b.clone().sub(a).normalize());return mesh;
 };
 // Twelve facets per vault preserve the blocky art style. All structure stays below
 // the shared clearHeight used by the building cavity cutter.
 for(const [bay,cx] of D.archCenters.entries()){
  for(let k=0;k<12;k++){
   const a=Math.PI*k/12,b=Math.PI*(k+1)/12;
   const p=new T.Vector3(cx-D.archHalfWidth*Math.cos(a),D.archSpring+D.archRise*Math.sin(a),0);
   const q=new T.Vector3(cx-D.archHalfWidth*Math.cos(b),D.archSpring+D.archRise*Math.sin(b),0);
   const roof=beam('opening-b5-vault-'+bay+'-'+k,p,q,.07,D.longLength,ivory);roof.position.z=D.longCenterZ;
   for(const [j,z]of D.archStations.entries()){
    const rib=beam('opening-b5-rib-'+bay+'-'+j+'-'+k,p,q,.13,.20,timber);rib.position.z=z;
   }
  }
 }
 for(const [i,x] of D.archPiers.entries())for(const [j,z]of D.archStations.entries()){
  box(group,'opening-b5-pier-'+i+'-'+j,.28,D.archSpring,.28,x,D.archSpring/2,z,timber);
  const m=materials.lamp.clone();strips.push(m);
  box(group,'opening-b5-sconce-'+i+'-'+j,.22,.17,.32,x,1.95,z+.19,m);
 }
 // Door surround is a shallow arch along the lobby wall; passage remains clear.
 for(const z of [D.doorZ0,D.doorZ1])box(group,'opening-b5-portal-jamb-'+z,.32,2.7,.24,D.partitionX,1.35,z,timber);
 for(let k=0;k<12;k++){
  const a=Math.PI*k/12,b=Math.PI*(k+1)/12,c=(D.doorZ0+D.doorZ1)/2,r=(D.doorZ1-D.doorZ0)/2;
  const p=new T.Vector3(60,2.7+1.25*Math.sin(a),c-r*Math.cos(a)),q=new T.Vector3(60,2.7+1.25*Math.sin(b),c-r*Math.cos(b));
  beam('opening-b5-portal-arch-'+k,p,q,.20,.20,timber);
 }
 // Clear glazing is separate from its frames and from the usable doorway.
 const glazing=glassMaterial('clear');glazing.side=T.DoubleSide;
 for(const [i,x] of [55.35,61.2,64.2,67.2,70.2,73.2,76.2].entries()){
  pane(group,'opening-b5-front-glazing-'+i,i===0?2.3:2.8,3,x,1.5,room.z1+.025,glazing);
  box(group,'opening-b5-front-mullion-'+i,.055,3.2,.08,x-1.45,1.6,room.z1+.04,materials.frame);
 }
 box(group,'opening-b5-entry-header',3,.10,.18,room.door,3.2,room.z1+.04,timber);
 // A pair of open access-gate pedestals leaves the 2.4 m doorway navigable.
 for(const x of [56.35,59.65])box(group,'opening-b5-access-pedestal-'+x,.24,.92,.42,x,.46,-56.1,materials.frame);
 box(group,'opening-b5-end-wall',D.crossWidth,4.45,.14,D.crossCenter,2.225,D.endZ,timber);
 // phase2-02: full armorial achievement on the timber wall; shield on the lectern.
 const armorial=emblemMaterial(dinnerArms,'Dinner wall arms');
 const shieldMaterial=emblemMaterial(shield,'Dinner shield');
 const crest=tag(new T.Mesh(new T.PlaneGeometry(1.36*26/31,1.36),armorial),'opening-b5-reference-crest','Opening_b5_reference_crest');
 crest.position.set(D.crossCenter,2.58,D.endZ+.09);
 crest.userData.source='HKU phase2-02; IMG_4380 00:24';
 group.add(crest);
 // Simplified pendant chandeliers; two real lights, the other bulbs emissive only.
 for(const [j,z] of [-65,-73].entries())for(const [i,x]of D.archCenters.entries()){
  const m=materials.lamp.clone();strips.push(m);
  const key=j===0&&i===0?'opening-b5-ceiling-light--59_2':j===1&&i===0?'opening-b5-ceiling-light--63_6':'opening-b5-chandelier-'+i+'-'+j;
  box(group,key,.08,.75,.08,x,3.72,z,timber);
  for(let arm=0;arm<8;arm++){
   const a=arm*Math.PI/4,xx=x+.43*Math.cos(a),zz=z+.43*Math.sin(a);
   beam('opening-b5-chandelier-arm-'+i+'-'+j+'-'+arm,new T.Vector3(x,3.25,z),new T.Vector3(xx,3.1,zz),.035,.035,materials.frame);
   box(group,'opening-b5-chandelier-bulb-'+i+'-'+j+'-'+arm,.10,.18,.10,xx,3.16,zz,m);
  }
  // Original ceiling key now refers to the pendant's luminous centre.
  const lamp=group.getObjectByName(key) as T.Mesh;lamp.material=m;
 }
 for(const z of [-65,-73]){const light=new T.PointLight(0xffe7b8,38,17,2);light.position.set(68.45,3.1,z);group.add(light);roomLights.push(light);}
 const edgeCeiling=box(group,'opening-b5-glass-edge-ceiling',2.1,.08,D.longLength,82.75,2.80,D.longCenterZ,ivory);
 hallFrame.add(edgeCeiling);
 // Rotate the complete hall, including the vaults, lights, crest and plank pattern.
 const hallPrefixes=['opening-b5-vault-','opening-b5-rib-','opening-b5-pier-','opening-b5-sconce-','opening-b5-end-wall','opening-b5-chandelier-','opening-b5-ceiling-light-'];
 for(const child of [...group.children])if(child===floorDetails||child===crest||child instanceof T.PointLight||hallPrefixes.some(p=>child.name.startsWith(p)))hallFrame.add(child);
 // Furniture. Everything stays visible in both states: the incident is expressed by
 // moving and tipping the props, never by hiding them, so the exported GLB keeps the
 // same geometry in either state.
 const props=tag(new T.Group(),'opening-b5-props','Opening_b5_props');
 hallFrame.add(props);
 const settings=tag(new T.Group(),'opening-b5-table-settings','Opening_b5_table_settings');
 props.add(settings);
 settings.userData.source='HKU phase2-02, 30 August 2026; arrangement estimated';
 const chairs=tag(new T.Group(),'opening-b5-static-chairs','Opening_b5_static_chairs');props.add(chairs);
 DINNER_TABLES.forEach(([x,z],i)=>{
  box(props,'opening-b5-table-'+i,D.tableWidth,.08,D.tableLength,x,floorTop+.74,z,materials.table);
  box(props,'opening-b5-table-leg-'+i,.10,.70,.10,x-.43,.35,z-2,materials.frame);
  for(const [j,[dx,dz]] of [[.43,-2],[-.43,2],[.43,2]].entries())box(props,'opening-b5-extra-leg-'+i+'-'+j,.10,.70,.10,x+dx,.35,z+dz,materials.frame);
  // Green formal linens and place settings from the opening-night photograph.
  const settingKey='opening-b5-setting-'+i;
  box(settings,settingKey+'-linen',D.tableWidth+.035,.025,D.tableLength+.045,x,floorTop+.79,z,materials.green);
  for(const [j,dz]of D.chairOffsets.entries())for(const side of [-1,1]){
   const place=settingKey+'-'+j+'-'+side;
   box(settings,place+'-plate',.22,.018,.22,x+side*.31,floorTop+.814,z+dz,materials.plate);
   box(settings,place+'-cup',.065,.095,.065,x+side*.16,floorTop+.852,z+dz+.17,materials.cup);
   // The three recorded capture chairs are animated below instead of duplicated.
   if(i<3&&j===0&&side===-1)continue;
   const key='opening-b5-long-chair-'+i+'-'+j+'-'+side,cx=x+side*.95;
   box(chairs,key+'-seat',.44,.07,.44,cx,.45,z+dz,materials.chair);
   box(chairs,key+'-back',.07,.43,.44,cx+side*.18,.71,z+dz,materials.chair);
   for(const dx of [-.16,.16])for(const zz of [-.16,.16])box(chairs,key+'-leg-'+dx+'-'+zz,.045,.42,.045,cx+dx,.21,z+dz+zz,materials.frame);
  }
 });
 compact(chairs);
 compact(settings);
 const head=tag(new T.Group(),'opening-b5-head-table-area','Opening_b5_head_table_area');
 hallFrame.add(head);
 head.userData.source='IMG_4380 00:24 and HKU phase2-02; dimensions estimated';
 const {stage,table,lectern,chair}=H;
 const deck=floorTop+stage.h;
 box(head,'opening-b5-dais',stage.w,stage.h,stage.d,stage.x,floorTop+stage.h/2,stage.z,timber);
 box(head,'opening-b5-dais-nosing',stage.w,.025,.03,stage.x,deck-.019,stage.z+stage.d/2-.015,materials.table);
 box(head,'opening-b5-head-table',table.w,.075,table.d,table.x,deck+table.h-.0555,table.z,materials.table);
 for(const side of [-1,1]){
  box(head,'opening-b5-head-cloth-long-'+side,table.w,.65,.024,table.x,deck+table.h-.325,table.z+side*(table.d/2-.015),materials.green);
  box(head,'opening-b5-head-cloth-end-'+side,.024,.65,table.d,table.x+side*(table.w/2-.015),deck+table.h-.325,table.z,materials.green);
 }
 box(head,'opening-b5-head-cloth-top',table.w,.018,table.d,table.x,deck+table.h-.009,table.z,materials.green);
 for(const [row,z] of H.chairRows.entries())for(const [i,dx] of H.chairOffsets.entries()){
  const key='opening-b5-head-chair-'+row+'-'+i,x=table.x+dx;
  box(head,key+'-seat',chair.w,.08,chair.d,x,deck+.46,z,materials.green);
  box(head,key+'-back',chair.w,.53,.065,x,deck+chair.h-.265,z+(row===0?-1:1)*(chair.d/2-.033),materials.chair);
  for(const sx of [-1,1])for(const sz of [-1,1])box(head,key+'-leg-'+sx+'-'+sz,.049,.42,.049,x+sx*.18,deck+.21,z+sz*.18,materials.frame);
  const placeZ=table.z+(row===0?-.27:.27);
  box(head,key+'-plate',.21,.016,.21,x,deck+table.h+.008,placeZ,materials.plate);
  box(head,key+'-cup',.064,.09,.064,x+.17,deck+table.h+.045,placeZ,materials.cup);
 }
 box(head,'opening-b5-lectern',lectern.w-.02,lectern.h-.06,lectern.d-.02,lectern.x,deck+(lectern.h-.06)/2,lectern.z,materials.green);
 box(head,'opening-b5-lectern-cap',lectern.w,.06,lectern.d,lectern.x,deck+lectern.h-.03,lectern.z,materials.frame);
 const lecternCrest=tag(new T.Mesh(new T.PlaneGeometry(.223,.235),shieldMaterial),'opening-b5-lectern-crest','Opening_b5_lectern_crest');
 lecternCrest.position.set(lectern.x,deck+.84,lectern.z+lectern.d/2-.008);
 head.add(lecternCrest);
 // The two ceremonial hangings flank the arms in the event photo.
 const teal=std('Dinner banner velvet',0x17595c);
 for(const side of [-1,1]){
  const x=table.x+side*2.25,z=D.endZ+.12;
  box(head,'opening-b5-banner-'+side,.77,1.57,.035,x,2.46,z,teal);
  box(head,'opening-b5-banner-rod-'+side,.96,.04,.04,x,3.27,z+.015,materials.frame);
  const badge=tag(new T.Mesh(new T.PlaneGeometry(.417,.44),shieldMaterial),'opening-b5-banner-shield-'+side,'Banner_shield_'+side);
  badge.position.set(x,2.55,z+.022);
  head.add(badge);
 }
 compact(head);

 // Chairs that stand for dinner and topple once the hall is abandoned. One chair,
 // two poses: the geometry never changes, only the transform.
 const tipping:{node:T.Group;upright:T.Vector3;uprightYaw:number;fallen:T.Vector3;fallenEuler:number}[]=[];
 TIPPING_CHAIRS.forEach(([x,z,yaw],index)=>{
  const chair=tag(new T.Group(),'opening-b5-chair-'+index,'Opening_b5_tipping_chair_'+index);
  hallFrame.add(chair);
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
 drop('opening-b5-dropped-cup',.09,.12,.09,new T.Vector3(56.6,floorTop+.92,-76),new T.Vector3(62.4,floorTop+.06,-60.6),materials.cup);
 drop('opening-b5-dropped-menu',.21,.02,.30,new T.Vector3(57.3,floorTop+.88,-76),new T.Vector3(63.1,floorTop+.01,-59.4),materials.cloth);
 drop('opening-b5-fallen-lamp',.12,.30,.12,new T.Vector3(56,floorTop+1.01,-76),new T.Vector3(61.7,floorTop+.15,-60.9),materials.accent);

 return{group,props,tipping,dropped,strips,roomLights,materials};
}

/* ------------------------------------------------------------------ */
/* Building 6 presentation room                                        */
/* ------------------------------------------------------------------ */

function signText(parent:T.Object3D,key:string,label:string,size:number,x:number,y:number,z:number,material:T.Material,yaw=0){
 const geo=new TextGeometry(label,{font:campusFont,size,depth:.02,curveSegments:1});
 geo.computeBoundingBox();
 geo.translate(-(geo.boundingBox!.max.x+geo.boundingBox!.min.x)/2,0,0);
 const mesh=new T.Mesh(geo,material);
 mesh.position.set(x,y,z);mesh.rotation.y=yaw;parent.add(mesh);
 return tag(mesh,key,key);
}

function buildOffice(root:T.Group){
 const room=O.b6,L=O.b6Lift;
 const group=tag(new T.Group(),'opening-b6-office','Opening_b6_office');
 root.add(group);
 const floorTop=room.floor,wallT=.12,wallH=room.clearHeight;
 const midX=(room.x0+room.x1)/2,midZ=(room.z0+room.z1)/2,w=room.x1-room.x0,d=room.z1-room.z0;
 const materials={
  floor:std('Opening_b6_floor',0xdfe3dd),
  wall:std('Opening_b6_wall',0xe4e7e2),
  ceiling:std('Opening_b6_ceiling',0xf0f1ec),
  trim:std('Opening_b6_trim',0x8b9189),
  desk:std('Opening_b6_desk_top',0x9c7c52),
  leg:std('Opening_b6_desk_leg',0x8a8f86),
  case:std('Opening_b6_cabinet',0x6f7f70),
  greenery:std('Opening_b6_greenery',0x4e7f4a),
  lamp:std('Opening_b6_ceiling_lamp',0xfff1cd,0xffe3a8,.5),
  paper:std('Opening_b6_paper',0xf3f1e8),
  rug:std('Opening_b6_rug',0x6d7f86),
  art:std('Opening_b6_art',0x40525a),
 };
 // The floor is split around the lift shaft; its top is exactly room.floor.
 box(group,'opening-b6-floor',L.x0-room.x0,.18,d,(room.x0+L.x0)/2,floorTop-.09,midZ,materials.floor);
 box(group,'opening-b6-floor-north',L.x1-L.x0,.18,L.z0-room.z0,(L.x0+L.x1)/2,floorTop-.09,(room.z0+L.z0)/2,materials.floor);
 box(group,'opening-b6-floor-south',L.x1-L.x0,.18,room.z1-L.z1,(L.x0+L.x1)/2,floorTop-.09,(L.z1+room.z1)/2,materials.floor);
 // A lined room: the old cavity opened straight onto the stair landing.
 box(group,'opening-b6-wall-north',w,wallH,wallT,midX,floorTop+wallH/2,room.z0+wallT/2,materials.wall);
 box(group,'opening-b6-wall-south',w,wallH,wallT,midX,floorTop+wallH/2,room.z1-wallT/2,materials.wall);
 box(group,'opening-b6-wall-west',wallT,wallH,d,room.x0+wallT/2,floorTop+wallH/2,midZ,materials.wall);
 box(group,'opening-b6-wall-east-north',wallT,wallH,L.z0-room.z0,room.x1-wallT/2,floorTop+wallH/2,(room.z0+L.z0)/2,materials.wall);
 box(group,'opening-b6-wall-east-south',wallT,wallH,room.z1-L.z1,room.x1-wallT/2,floorTop+wallH/2,(L.z1+room.z1)/2,materials.wall);
 box(group,'opening-b6-ceiling',w,.12,d,midX,floorTop+wallH-.06,midZ,materials.ceiling);
 box(group,'opening-b6-skirting',w,.10,.03,midX,floorTop+.05,room.z1-wallT-.015,materials.trim);
 // Credenza along the north wall and a planter in the far corner.
 box(group,'opening-b6-credenza',5.0,.90,.55,4.5,floorTop+.45,-61.45,materials.case);
 const roomLight=new T.PointLight(0xffe9c0,20,10,2);roomLight.position.set(5.2,floorTop+2.2,-59.6);group.add(roomLight);
 box(group,'opening-b6-planter',.44,.44,.44,1.9,floorTop+.22,-60.6,materials.greenery);
 box(group,'opening-b6-ceiling-light',4.4,.08,.30,5.4,floorTop+2.56,-59.5,materials.lamp);
 box(group,'opening-b6-rug',4.4,.018,2.5,5.6,floorTop+.009,-59.3,materials.rug);
 box(group,'opening-b6-picture',1.45,.95,.05,4.6,floorTop+1.65,room.z1-wallT-.03,materials.art);
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

 return{group,laptop,roomLight,materials};
}

/* ------------------------------------------------------------------ */
/* Building 6 ground side door, lift lobby and car                     */
/* ------------------------------------------------------------------ */

function buildLift(root:T.Group){
 const LO=O.b6Lobby,L=O.b6Lift,SD=O.b6SideDoor;
 const group=tag(new T.Group(),'opening-b6-lift','Opening_b6_lift');
 root.add(group);
 const materials={
  floor:std('Opening_b6_lobby_floor',0xd6d3c7),
  wall:std('Opening_b6_lobby_wall',0xe6e3d8),
  ceiling:std('Opening_b6_lobby_ceiling',0xf1efe8),
  steel:std('Opening_b6_lift_steel',0x98a29e,.35,.25),
  car:std('Opening_b6_lift_car',0xc7cec8),
  trim:std('Opening_b6_lift_trim',0x5f6b68),
  lamp:std('Opening_b6_lift_lamp',0xfff1cd,0xffe3a8,.55),
  glass:glassMaterial('clear'),
  indicator:std('Opening_b6_lift_indicator',0x8a9a90,0x38a35a,.8),
 };
 const lw=LO.x1-LO.x0,ld=LO.z1-LO.z0,lx=(LO.x0+LO.x1)/2,lz=(LO.z0+LO.z1)/2;
 // Ground lobby: floor top exactly LO.floor, ceiling below the base glass head.
 box(group,'opening-b6-lobby-floor',lw,.18,ld,lx,LO.floor-.09,lz,materials.floor);
 box(group,'opening-b6-lobby-ceiling',lw,.10,ld,lx,LO.clearHeight-.05,lz,materials.ceiling);
 box(group,'opening-b6-lobby-wall-north',lw,LO.clearHeight,.12,lx,LO.clearHeight/2,LO.z0+.06,materials.wall);
 box(group,'opening-b6-lobby-wall-south',lw,LO.clearHeight,.12,lx,LO.clearHeight/2,LO.z1-.06,materials.wall);
 box(group,'opening-b6-lobby-wall-west',.12,LO.clearHeight,LO.z1-L.z1,LO.x0+.06,LO.clearHeight/2,(L.z1+LO.z1)/2,materials.wall);
 box(group,'opening-b6-lobby-floor-inlay',.90,.010,ld-1.0,lx,LO.floor+.005,lz,materials.trim);
 // Side door: frame and two parked sliding leaves keep the 1.8 m opening clear.
 for(const s of [-1,1]){
  box(group,'opening-b6-side-door-jamb-'+s,.18,2.72,.16,SD.x,1.36,SD.z+s*(SD.width/2+.06),materials.steel);
 }
 box(group,'opening-b6-side-door-header',.18,.16,SD.width+.28,SD.x,2.72,SD.z,materials.steel);
 box(group,'opening-b6-side-door-threshold',.26,.032,SD.width,SD.x-.06,.016,SD.z,materials.trim);
 for(const s of [-1,1]){
  const leafZ=SD.z+s*(SD.width/2+.48);
  pane(group,'opening-b6-side-door-leaf-'+s,.86,2.46,SD.x-.10,1.25,leafZ,materials.glass,Math.PI/2);
  box(group,'opening-b6-side-door-leaf-stile-'+s,.06,2.50,.07,SD.x-.08,1.25,leafZ-s*.42,materials.steel);
 }
 box(group,'opening-b6-side-door-canopy',1.35,.12,2.35,SD.x+.66,3.22,SD.z,materials.steel);
 box(group,'opening-b6-side-door-lamp',.18,.06,1.2,SD.x-.16,2.64,SD.z,materials.lamp);
 const signMat=std('Opening_b6_sign',0xeeeadd,0x222222,.15);
 box(group,'opening-b6-side-door-sign-plate',.04,.40,2.02,SD.x+.075,2.95,SD.z,materials.trim);
 signText(group,'opening-b6-side-door-sign','B6 · EAST LOBBY',.21,SD.x+.10,2.95,SD.z,signMat,Math.PI/2);
 signText(group,'opening-b6-side-door-lift-sign','LIFT · 5F',.13,SD.x+.10,2.38,SD.z-1.03,signMat,Math.PI/2);
 // Shaft walls; the east side opens to the lobby at ground, the west side to the office at 5F.
 const shaftTop=L.top;
 box(group,'opening-b6-lift-east-north-wall',.12,shaftTop,.5,L.x1-.06,shaftTop/2,L.z0+.25,materials.wall);
 box(group,'opening-b6-lift-east-south-wall',.12,shaftTop,.5,L.x1-.06,shaftTop/2,L.z1-.25,materials.wall);
 box(group,'opening-b6-lift-east-lintel-wall',.12,shaftTop-(L.ground+2.62),L.doorZ1-L.doorZ0,L.x1-.06,(shaftTop+L.ground+2.62)/2,(L.doorZ0+L.doorZ1)/2,materials.wall);
 box(group,'opening-b6-lift-west-north-wall',.12,shaftTop,.5,L.x0+.06,shaftTop/2,L.z0+.25,materials.wall);
 box(group,'opening-b6-lift-west-south-wall',.12,shaftTop,.5,L.x0+.06,shaftTop/2,L.z1-.25,materials.wall);
 box(group,'opening-b6-lift-west-below-wall',.12,L.upper,L.doorZ1-L.doorZ0,L.x0+.06,L.upper/2,(L.doorZ0+L.doorZ1)/2,materials.wall);
 box(group,'opening-b6-lift-west-above-wall',.12,shaftTop-(L.upper+2.3),L.doorZ1-L.doorZ0,L.x0+.06,(shaftTop+L.upper+2.3)/2,(L.doorZ0+L.doorZ1)/2,materials.wall);
 box(group,'opening-b6-lift-shaft-north-wall',L.x1-L.x0,shaftTop,.12,lx,shaftTop/2,L.z0+.06,materials.wall);
 box(group,'opening-b6-lift-shaft-south-wall',L.x1-L.x0,shaftTop,.12,lx,shaftTop/2,L.z1-.06,materials.wall);
 box(group,'opening-b6-lift-shaft-ceiling',L.x1-L.x0,.10,L.z1-L.z0,lx,shaftTop-.05,lz,materials.ceiling);
 signText(group,'opening-b6-lobby-lift-sign','LIFT · 5F PRINCIPAL\'S OFFICE',.17,LO.x0+.13,2.82,(L.doorZ0+L.doorZ1)/2,signMat,Math.PI/2);
 // Landing doors: two leaves per floor, parked into the wall pockets when open.
 type Leaf={mesh:T.Mesh;base:number;shift:number;floor:'ground'|'upper'};
 const leaves:Leaf[]=[];
 const door=(floor:'ground'|'upper',x:number,y0:number,h:number,sign:number)=>{
  for(const i of [0,1]){
   const base=(L.doorZ0+L.doorZ1)/2+(i?1:-1)*(L.doorZ1-L.doorZ0)/4;
   const mesh=box(group,'opening-b6-lift-door-'+floor+'-'+i,.06,h,(L.doorZ1-L.doorZ0)/2,x,y0+h/2,base,materials.steel);
   leaves.push({mesh,base,shift:(i?1:-1)*.56,floor});
  }
 };
 door('ground',L.x1-.06,L.ground,2.58,1);
 door('upper',L.x0+.06,L.upper,2.28,-1);
 // Call panels and landing indicators.
 // Freestanding call posts beside each landing door (the interaction targets).
 box(group,'opening-b6-lift-call-post-ground',.06,1.09,.06,11.30,.565,-59.15,materials.trim);
 box(group,'opening-b6-lift-call-ground',.12,.28,.10,11.30,1.25,-59.15,materials.lamp);
 box(group,'opening-b6-lift-call-post-upper',.06,1.09,.06,8.20,L.upper+.545,-59.15,materials.trim);
 box(group,'opening-b6-lift-call-upper',.12,.28,.10,8.20,L.upper+1.25,-59.15,materials.lamp);
 const indicators:{material:T.MeshStandardMaterial;floor:'ground'|'upper'}[]=[];
 const indicator=(key:string,floor:'ground'|'upper',x:number,y:number,z:number)=>{
  const material=materials.indicator.clone();
  box(group,key,.06,.14,.24,x,y,z,material);
  indicators.push({material,floor});
 };
 indicator('opening-b6-lift-indicator-ground','ground',LO.x0+.02,2.82,(L.doorZ0+L.doorZ1)/2);
 indicator('opening-b6-lift-indicator-upper','upper',L.x0-.02,L.upper+2.44,(L.doorZ0+L.doorZ1)/2);
 // The car is a through-car: open on the east at ground and west at 5F.
 const car=tag(new T.Group(),'opening-b6-lift-car','Opening_b6_lift_car');
 car.position.set(lx,L.ground,lz);group.add(car);
 box(car,'opening-b6-lift-car-floor',2.0,.12,2.0,0,-.06,0,materials.floor);
 box(car,'opening-b6-lift-car-ceiling',2.0,.08,2.0,0,2.24,0,materials.ceiling);
 box(car,'opening-b6-lift-car-north',2.0,2.24,.08,0,1.12,-.96,materials.car);
 box(car,'opening-b6-lift-car-south',2.0,2.24,.08,0,1.12,.96,materials.car);
 box(car,'opening-b6-lift-car-light',1.15,.03,.30,0,2.19,0,materials.lamp);
 box(car,'opening-b6-lift-car-button',.12,.20,.04,0,1.25,-.90,materials.lamp);
 for(const s of [-1,1])box(car,'opening-b6-lift-car-handrail-'+s,1.9,.05,.05,0,.92,s*.90,materials.trim);
 return{group,car,leaves,indicators,materials};
}

/* ------------------------------------------------------------------ */
/* Stair underpass and the sealed 4F terrace                           */
/* ------------------------------------------------------------------ */

function buildUnderpass(root:T.Group){
 const group=tag(new T.Group(),'opening-stair-underpass','Opening_stair_underpass');
 root.add(group);
 const wall=std('Opening_underpass_wall',0xb9b6aa),dark=std('Opening_underpass_trim',0x6f746c),lamp=std('Opening_underpass_lamp',0xfff1cd,0xffdda0,.8),metal=std('Opening_underpass_metal',0x87908c);
 const half=SP.depth/2;
 for(let x=-12;x<=12;x+=4)box(group,'opening-underpass-light-'+x,.9,.04,.16,x,SP.clearHeight-.11,SP.z,lamp);
 for(const x of [-12,-8,-4,0,4,8,12]){
  for(const s of [-1,1])box(group,'opening-underpass-pier-'+x+'-'+s,.28,2.9,.22,x,1.45,SP.z+s*(half-.11),wall);
  box(group,'opening-underpass-beam-'+x,.28,.24,SP.depth-.02,x,2.95,SP.z,wall);
 }
 for(const s of [-1,1]){
  box(group,'opening-underpass-skirting-'+s,SP.width-.4,.18,.05,0,.09,SP.z+s*(half-.03),dark);
  box(group,'opening-underpass-service-'+s,1.1,2.1,.05,7*s,1.05,SP.z-half+.035,dark);
  box(group,'opening-underpass-service-frame-'+s,1.22,.08,.06,7*s,2.14,SP.z-half+.04,metal);
  const x=s*(SP.width/2-.15);
  for(const k of [-1,1])box(group,'opening-underpass-portal-jamb-'+s+'-'+k,.30,3.08,.34,x,1.54,SP.z+k*(half-.02),metal);
  box(group,'opening-underpass-portal-lintel-'+s,.30,.28,SP.depth-.02,x,3.06,SP.z,metal);
 }
 const light=new T.PointLight(0xffe3b0,12,16,2);light.position.set(0,2.7,SP.z);group.add(light);
 const signMat=std('Opening_underpass_sign',0xeeeadd,0x222222,.1);
 signText(group,'opening-underpass-sign-east','B6 · EAST LIFT →',.17,12.1,2.45,SP.z-half+.05,signMat);
 signText(group,'opening-underpass-sign-west','← CENTRAL PLAZA',.17,-12.1,2.45,SP.z-half+.05,signMat);
 return{group};
}

function buildTerrace(root:T.Group){
 const group=tag(new T.Group(),'opening-b6-terrace','Opening_b6_terrace');
 root.add(group);
 const guard=glassMaterial('guard'),steel=std('Opening_terrace_steel',0x9aa39e,.4,.3);
 const top=5.1,z=-52.72;
 pane(group,'opening-b6-terrace-guard',29.8,1.05,0,top+.55,z,guard);
 box(group,'opening-b6-terrace-handrail',29.8,.06,.08,0,top+1.12,z,steel);
 for(let x=-14.5;x<=14.5;x+=2.9)box(group,'opening-b6-terrace-post-'+x,.06,1.12,.06,x,top+.56,z,steel);
 for(const s of [-1,1])pane(group,'opening-b6-terrace-guard-side-'+s,1.24,1.05,s*14.9,top+.55,z+.62,guard,Math.PI/2);
 const signMat=std('Opening_terrace_sign',0xeeeadd,0x222222,.15);
 signText(group,'opening-b6-terrace-sign','4F · TERRACE',.30,0,top+1.40,z+.05,signMat);
 box(group,'opening-b6-terrace-planter',.60,.46,.60,-13.3,top+.23,-52.15,std('Opening_terrace_planter',0x7f8b74));
 box(group,'opening-b6-terrace-planter-top',.58,.12,.58,-13.3,top+.52,-52.15,std('Opening_terrace_green',0x4e7f4a));
 return{group};
}


/* ------------------------------------------------------------------ */
/* Public module                                                       */
/* ------------------------------------------------------------------ */

export function createOpeningWorld(){
 const root=tag(new T.Group(),'opening-world','Opening_world');
 const bus=buildBus(root,busMaterials());
 const dinner=buildDinner(root);
 const office=buildOffice(root);
 const lift=buildLift(root);
 buildUnderpass(root);
 buildTerrace(root);

 let doorT=0;         // 0 closed, 1 fully open
 let incident=false;
 let laptopTaken=false;
 let invitationTakenState=false;
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
  dinner.roomLights.forEach((light,index)=>{light.color.setHex(next?0xff5a45:index===0?0xc7b8ff:0x91beff);light.intensity=next?7:30;});
  office.roomLight.color.setHex(next?0xff5a45:0xffe9c0);office.roomLight.intensity=next?6:20;
 }
 function update(state:{incident:boolean;laptopAcquired:boolean;doorOpen:boolean;invitationRead?:boolean},dt:number){
  // dt may be zero (paused frame): animation must not advance, state must not reset.
  if(dt>0){
   const goal=state.doorOpen?1:0;
   const step=dt/DOOR_SECONDS;
   doorT+=Math.max(-step,Math.min(step,goal-doorT));
  }
  bus.pivot.rotation.y=doorT===0?0:-DOOR_OPEN_ANGLE*doorT;
  const invitationTaken=state.invitationRead===true;
  if(invitationTaken!==invitationTakenState){invitationTakenState=invitationTaken;bus.invitation.visible=!invitationTaken;}
  if(state.incident!==incident)applyIncident(state.incident);
  if(state.laptopAcquired!==laptopTaken){
   laptopTaken=state.laptopAcquired;
   office.laptop.root.visible=!laptopTaken;
  }
  // The car and both landing doors follow the shared lift state. No animation is
  // integrated here: the fixed-step controller owns the deterministic travel.
  const car=openingLift();
  lift.car.position.y=car.carY;
  for(const leaf of lift.leaves)leaf.mesh.position.z=leaf.base+leaf.shift*(leaf.floor==='ground'?car.doorGround:car.doorUpper);
  for(const indicator of lift.indicators)indicator.material.emissiveIntensity=(indicator.floor==='ground'?car.doorGround:car.doorUpper)>.5?.95:.18;
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
