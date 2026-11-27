import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {campusFont} from '../model/fonts';
import {glassMaterial} from '../model/glazing';
import {compact} from '../model/buildCampus';
import {emblemMaterial} from '../model/heraldry';
import shield from '../model/hall-crest.json';
import {OPENING as O,DINNER_LAYOUT as D,DINNER_HEAD as H,B6_HALL,B4_LIFT as L6} from './spatialLayout';

/**
 * Thomas opening scenery: the campus shuttle, the Building 5 ground-floor dinner
 * area and the Building 6 ground hall (lift left of the doors, canteen right). Route/cavity
 * bounds and both interiors share src/opening/spatialLayout.ts; decorative offsets remain
 * estimated.
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
 group.userData.noVoxelTile=true; // seen from arm's length: authored finishes, not a 25 cm tile
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
 // The wall crest uses the same clean heraldic art as the flanking banners. The
 // photo-derived 26x31 trace is illegible once it is blown up to 1.4 m: at that size
 // it read as a torn pixel smear above the head table (QA 2026-11-25).
 const shieldMaterial=emblemMaterial(shield,'Dinner shield');
 const crest=tag(new T.Mesh(new T.PlaneGeometry(1.36*36/38,1.36),shieldMaterial),'opening-b5-reference-crest','Opening_b5_reference_crest');
 crest.position.set(D.crossCenter,2.58,D.endZ+.09);
 crest.userData.source='HKU phase2-02; heraldic crest art, src/model/hall-crest.json';
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
/* Building 6 ground hall                                              */
/* ------------------------------------------------------------------ */

/**
 * The hall behind Building 6's front doors (owner ruling, 2026-11-27): enter, turn left
 * for the core lift, turn right for the canteen. The HKU flip wall hangs on the north
 * wall (`b6FlipWall.ts` mounts the observed panel and ticks it).
 *
 * The shell is drawn against the collision faces `navigation.ts` carves: walls sit in the
 * solid margin, their inner faces on the walkable plane, so no mesh pokes into the room.
 */
function buildB6Hall(root:T.Group){
 const hall=O.b6,W=B6_HALL;
 const group=tag(new T.Group(),'opening-b6-hall','Opening_b6_hall');
 group.userData.noVoxelTile=true; // a close-up room, like the shuttle and the dinner hall
 root.add(group);
 const F=hall.floor,CEIL=F+hall.clearHeight,WALL=.12,front=hall.z1-.2;
 const doorL=hall.door-hall.doorWidth/2,doorR=hall.door+hall.doorWidth/2;
 const materials={
  floor:std('Opening_b6_floor',0xc3c9c1),
  wall:std('Opening_b6_ivory_wall',0xdfd9ca),
  ceiling:std('Opening_b6_ceiling',0xe8e4d8),
  trim:std('Opening_b6_trim',0x707e73),
  steel:std('Opening_b6_steel',0x5b6668),
  shaft:std('Opening_b6_shaft_stone',0x3d4a49),
  wood:std('Opening_b6_canteen_wood',0xa8784f),
  counter:std('Opening_b6_counter_stone',0xd9d3c5),
  seat:std('Opening_b6_bench',0x8d6c46),
  lamp:std('Opening_b6_lamp',0xfff1cd,0xffe3a8,.8),
  sign:std('Opening_b6_sign_green',0x1d5c46,0x0d2f24,.35),
  ink:std('Opening_b6_sign_ink',0xf1ead6),
  mat:std('Opening_b6_door_mat',0x2d3436),
 };
 // Floor: the tile face sits at the hall floor, the body inside the slab below it.
 box(group,'opening-b6-floor',hall.x1-hall.x0,.18,hall.z1-hall.z0,(hall.x0+hall.x1)/2,F-.09,(hall.z0+hall.z1)/2,materials.floor);
 // Ceiling: four slabs around the shaft's travel opening, exactly the collision boxes.
 const s0=L6.x0-W.shaft.wall,s1=L6.x1+W.shaft.wall,t0=L6.z0-W.shaft.wall,t1=L6.z1+W.shaft.wall;
 for(const [key,x0,x1,z0,z1] of [
  ['west',hall.x0,s0,hall.z0,front],
  ['east',s1,hall.x1,hall.z0,front],
  ['north',s0,s1,hall.z0,t0],
  ['south',s0,s1,t1,front],
 ] as const)box(group,'opening-b6-ceiling-'+key,x1-x0,.16,z1-z0,(x0+x1)/2,CEIL+.08,(z0+z1)/2,materials.ceiling);
 // Walls in the solid margin; each inner face lands on the walkable plane.
 box(group,'opening-b6-wall-west',WALL,hall.clearHeight,hall.z1-hall.z0,hall.x0-WALL/2,F+hall.clearHeight/2,(hall.z0+hall.z1)/2,materials.wall);
 box(group,'opening-b6-wall-east',WALL,hall.clearHeight,hall.z1-hall.z0,hall.x1+WALL/2,F+hall.clearHeight/2,(hall.z0+hall.z1)/2,materials.wall);
 box(group,'opening-b6-wall-north',hall.x1-hall.x0,WALL,hall.z1-hall.z0,(hall.x0+hall.x1)/2,F+hall.clearHeight/2,hall.z0-WALL/2,materials.wall);
 // The front wall is split around the entrance, with the lintel above it.
 box(group,'opening-b6-wall-front-west',doorL-hall.x0,hall.clearHeight,WALL,(hall.x0+doorL)/2,F+hall.clearHeight/2,front-WALL/2,materials.wall);
 box(group,'opening-b6-wall-front-east',hall.x1-doorR,hall.clearHeight,WALL,(doorR+hall.x1)/2,F+hall.clearHeight/2,front-WALL/2,materials.wall);
 box(group,'opening-b6-wall-front-lintel',hall.doorWidth,hall.clearHeight-hall.doorHeight,WALL,hall.door,F+(hall.doorHeight+hall.clearHeight)/2,front-WALL/2,materials.wall);
 // Entrance frame and a dark mat where the plaza meets the floor.
 for(const x of [doorL-.05,doorR+.05])box(group,'opening-b6-door-post',.10,hall.doorHeight,.16,x,F+hall.doorHeight/2,front-.02,materials.trim);
 box(group,'opening-b6-door-head',hall.doorWidth+.30,.10,.16,hall.door,F+hall.doorHeight+.05,front-.02,materials.trim);
 box(group,'opening-b6-door-mat',hall.doorWidth-.30,.02,1.10,hall.door,F+.011,front-.75,materials.mat);
 // Baseboards, so the walls read as finished and not as raw cut planes.
 box(group,'opening-b6-base-north',hall.x1-hall.x0,.12,.03,(hall.x0+hall.x1)/2,F+.06,hall.z0+.015,materials.trim);
 for(const [key,x] of [['west',hall.x0+.015],['east',hall.x1-.015]] as const)
  box(group,'opening-b6-base-'+key,.03,.12,hall.z1-hall.z0,x,F+.06,(hall.z0+hall.z1)/2,materials.trim);
 // The lift shaft: the static frame the car slides in, with the doorway on its east face.
 box(group,'opening-b6-shaft-west-face',W.shaft.wall,hall.clearHeight,t1-t0,L6.x0-W.shaft.wall/2,F+hall.clearHeight/2,(t0+t1)/2,materials.shaft);
 box(group,'opening-b6-shaft-north-face',L6.x1-L6.x0,hall.clearHeight,W.shaft.wall,(L6.x0+L6.x1)/2,F+hall.clearHeight/2,L6.z0-W.shaft.wall/2,materials.shaft);
 box(group,'opening-b6-shaft-south-face',L6.x1-L6.x0,hall.clearHeight,W.shaft.wall,(L6.x0+L6.x1)/2,F+hall.clearHeight/2,L6.z1+W.shaft.wall/2,materials.shaft);
 box(group,'opening-b6-shaft-east-north',W.shaft.wall,hall.clearHeight,L6.door.z0-L6.z0,L6.x1+W.shaft.wall/2,F+hall.clearHeight/2,(L6.z0+L6.door.z0)/2,materials.shaft);
 box(group,'opening-b6-shaft-east-south',W.shaft.wall,hall.clearHeight,L6.z1-L6.door.z1,L6.x1+W.shaft.wall/2,F+hall.clearHeight/2,(L6.door.z1+L6.z1)/2,materials.shaft);
 box(group,'opening-b6-shaft-lintel-face',W.shaft.wall,hall.clearHeight-L6.door.height,L6.door.z1-L6.door.z0,L6.x1+W.shaft.wall/2,F+(L6.door.height+hall.clearHeight)/2,(L6.door.z0+L6.door.z1)/2,materials.shaft);
 for(const z of [L6.door.z0-.04,L6.door.z1+.04])
  box(group,'opening-b6-lift-post',.10,L6.door.height,.08,L6.x1+W.shaft.wall+.03,F+L6.door.height/2,z,materials.trim);
 box(group,'opening-b6-lift-head',.10,.08,L6.door.z1-L6.door.z0+.16,L6.x1+W.shaft.wall+.03,F+L6.door.height+.04,(L6.door.z0+L6.door.z1)/2,materials.trim);
 // A lit LIFT plate above the doorway, on the face the player turns toward.
 box(group,'opening-b6-lift-plate',.02,.24,.84,L6.x1+W.shaft.wall+.005,F+2.62,(L6.door.z0+L6.door.z1)/2,materials.sign);
 const liftText=new TextGeometry('LIFT',{font:campusFont,size:.13,depth:.004,curveSegments:1});
 liftText.computeBoundingBox();const lb=liftText.boundingBox!;
 liftText.translate(-(lb.min.x+lb.max.x)/2,-(lb.min.y+lb.max.y)/2,0);
 const liftLabel=new T.Mesh(liftText,materials.ink);
 liftLabel.name='opening-b6-lift-label';liftLabel.position.set(L6.x1+W.shaft.wall+.017,F+2.62,(L6.door.z0+L6.door.z1)/2);liftLabel.rotation.y=Math.PI/2;
 liftLabel.userData={sourceFile:SOURCE_FILE,source:SOURCE,confidence:CONFIDENCE,authorKey:'opening-b6-lift-label'};
 group.add(liftLabel);
 // Canteen: partition with a 3.4 m opening, two long tables, benches and the counter.
 const c=W.canteen,part=W.shaft.wall;
 box(group,'opening-b6-canteen-north',part,hall.clearHeight,c.openingZ0-hall.z0,c.partitionX+part/2,F+hall.clearHeight/2,(hall.z0+c.openingZ0)/2,materials.wall);
 box(group,'opening-b6-canteen-south',part,hall.clearHeight,front-c.openingZ1,c.partitionX+part/2,F+hall.clearHeight/2,(c.openingZ1+front)/2,materials.wall);
 box(group,'opening-b6-canteen-header',part,hall.clearHeight-2.6,c.openingZ1-c.openingZ0,c.partitionX+part/2,F+(2.6+hall.clearHeight)/2,(c.openingZ0+c.openingZ1)/2,materials.wall);
 box(group,'opening-b6-canteen-trim',.04,.10,c.openingZ1-c.openingZ0,c.partitionX-.01,F+2.60,(c.openingZ0+c.openingZ1)/2,materials.trim);
 // CANTEEN plate above the opening, facing the entry hall.
 box(group,'opening-b6-canteen-plate',.02,.24,.94,c.partitionX-.012,F+2.86,(c.openingZ0+c.openingZ1)/2,materials.sign);
 const eatText=new TextGeometry('CANTEEN',{font:campusFont,size:.105,depth:.004,curveSegments:1});
 eatText.computeBoundingBox();const eb=eatText.boundingBox!;
 eatText.translate(-(eb.min.x+eb.max.x)/2,-(eb.min.y+eb.max.y)/2,0);
 const eatLabel=new T.Mesh(eatText,materials.ink);
 eatLabel.name='opening-b6-canteen-label';eatLabel.position.set(c.partitionX-.025,F+2.86,(c.openingZ0+c.openingZ1)/2);eatLabel.rotation.y=-Math.PI/2;
 eatLabel.userData={sourceFile:SOURCE_FILE,source:SOURCE,confidence:CONFIDENCE,authorKey:'opening-b6-canteen-label'};
 group.add(eatLabel);
 for(const [i,t] of W.tables.entries()){
  box(group,'opening-b6-table-top-'+i,t.w,.06,t.d,t.x,t.top-.03,t.z,materials.wood);
  for(const dx of [-t.w/2+.08,t.w/2-.08])for(const dz of [-t.d/2+.10,t.d/2-.10])
   box(group,'opening-b6-table-leg-'+i+'-'+dx.toFixed(2)+'-'+dz.toFixed(2),.06,t.top-.06,.06,t.x+dx,F+(t.top-.06)/2,t.z+dz,materials.steel);
  for(const side of [-1,1]){
   const bx=t.x+side*(t.w/2+.34);
   box(group,'opening-b6-bench-'+i+'-'+side,.34,.05,t.d-.30,bx,F+.44,t.z,materials.seat);
   for(const dz of [-t.d/2+.32,t.d/2-.32])box(group,'opening-b6-bench-leg-'+i+'-'+side+'-'+dz.toFixed(2),.05,.42,.05,bx,F+.21,t.z+dz,materials.steel);
  }
 }
 const counter=W.counter;
 box(group,'opening-b6-counter-body',counter.x1-counter.x0,counter.h-.05,counter.z1-counter.z0,(counter.x0+counter.x1)/2,F+(counter.h-.05)/2,(counter.z0+counter.z1)/2,materials.counter);
 box(group,'opening-b6-counter-top',counter.x1-counter.x0+.06,.05,counter.z1-counter.z0+.06,(counter.x0+counter.x1)/2,counter.h-.025,(counter.z0+counter.z1)/2,materials.wood);
 box(group,'opening-b6-counter-machine',.46,.34,.34,counter.x0+.42,counter.h+.17,(counter.z0+counter.z1)/2,materials.steel);
 box(group,'opening-b6-counter-tray',.52,.03,.34,counter.x1-.40,counter.h+.015,(counter.z0+counter.z1)/2,materials.trim);
 // Pendants over the tables: the canteen reads as a room even from the door.
 for(const t of W.tables){
  box(group,'opening-b6-pendant-cord',.03,CEIL-2.55,.03,t.x,CEIL-(CEIL-2.55)/2,t.z,materials.trim);
  box(group,'opening-b6-pendant-shade',.46,.10,.46,t.x,2.50,t.z,materials.lamp);
 }
 // Recessed strips down the entry hall, plus the canteen and lift-side pools of light.
 for(const z of [-55.2,-58.8])box(group,'opening-b6-ceiling-strip',4.6,.03,.16,3.0,CEIL-.015,z,materials.lamp);
 const roomLights=[
  new T.PointLight(0xfff1d8,34,16,2),
  new T.PointLight(0xffe6c0,22,12,2),
 ];
 roomLights[0].position.set(3.2,F+CEIL-.3,-56.4);
 roomLights[1].position.set(13.0,F+CEIL-.3,-56.6);
 for(const light of roomLights)group.add(light);
 return{group,roomLights,materials};
}

/* ------------------------------------------------------------------ */
/* Public module                                                       */
/* ------------------------------------------------------------------ */

export function createOpeningWorld(){
 const root=tag(new T.Group(),'opening-world','Opening_world');
 const bus=buildBus(root,busMaterials());
 const dinner=buildDinner(root);
 const hall=buildB6Hall(root);

 let doorT=0;         // 0 closed, 1 fully open
 let incident=false;
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
  for(const [index,light] of hall.roomLights.entries()){light.color.setHex(next?0xff5a45:index===0?0xfff1d8:0xffe6c0);light.intensity=next?5:index===0?34:22;}
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
