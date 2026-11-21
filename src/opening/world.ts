import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {campusFont} from '../model/fonts';
import {glassMaterial} from '../model/glazing';
import {compact} from '../model/buildCampus';
import {signPhotoMaterial} from '../model/nov14Details';
import {createMacBook} from '../items/macbook';
import {OPENING as O,DINNER_LAYOUT as D} from './spatialLayout';

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
 // Reuse the approved reference crop already used on the campus monument.
 const crestGeo=new T.PlaneGeometry(.91*1.35,1.24*1.35),uv=crestGeo.getAttribute('uv');
 for(let i=0;i<uv.count;i++)uv.setXY(i,.143+uv.getX(i)*.219,.24+uv.getY(i)*.51);
 const crest=tag(new T.Mesh(crestGeo,signPhotoMaterial()),'opening-b5-reference-crest','Opening_b5_reference_crest');crest.position.set(D.crossCenter,2.5,D.endZ+.09);group.add(crest);
 crest.userData.source='existing approved U06 monument crest crop; placement follows IMG_4380, exact wall emblem detail unverified';
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
 const chairs=tag(new T.Group(),'opening-b5-static-chairs','Opening_b5_static_chairs');props.add(chairs);
 DINNER_TABLES.forEach(([x,z],i)=>{
  box(props,'opening-b5-table-'+i,D.tableWidth,.08,D.tableLength,x,floorTop+.74,z,materials.table);
  box(props,'opening-b5-table-leg-'+i,.10,.70,.10,x-.43,.35,z-2,materials.frame);
  for(const [j,[dx,dz]] of [[.43,-2],[-.43,2],[.43,2]].entries())box(props,'opening-b5-extra-leg-'+i+'-'+j,.10,.70,.10,x+dx,.35,z+dz,materials.frame);
  for(const [j,dz]of D.chairOffsets.entries())for(const side of [-1,1]){
   // The three recorded capture chairs are animated below instead of duplicated.
   if(i<3&&j===0&&side===-1)continue;
   const key='opening-b5-long-chair-'+i+'-'+j+'-'+side,cx=x+side*.95;
   box(chairs,key+'-seat',.44,.07,.44,cx,.45,z+dz,materials.chair);
   box(chairs,key+'-back',.07,.43,.44,cx+side*.18,.71,z+dz,materials.chair);
   for(const dx of [-.16,.16])for(const zz of [-.16,.16])box(chairs,key+'-leg-'+dx+'-'+zz,.045,.42,.045,cx+dx,.21,z+dz+zz,materials.frame);
  }
 });
 compact(chairs);
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
 const roomLight=new T.PointLight(0xffe9c0,20,10,2);roomLight.position.set(5.2,floorTop+2.2,-57.4);group.add(roomLight);
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

 return{group,laptop,roomLight,materials};
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
  for(const light of dinner.roomLights){light.color.setHex(next?0xff5a45:0xffe7b8);light.intensity=next?7:26;}
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
