import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {campusFont} from '../model/fonts';
import {B4_DOOR_LEAVES,B4_LAYOUT,B4_LOBBY,B4_OBSTACLES} from './b4Layout';
import {B4_FLIP_WALL,createB4FlipWall} from './b4FlipWall';
import {B4_LIFT as L} from './spatialLayout';
import {attachLiftVisual,LIFT_LANDING,liftLandingBoxes} from './lift';
import {B4_OFFICE,FEED_CANVAS,b4OfficeBoxes,attachOfficeVisual} from './b4Office';

/**
 * Static B04 ground-floor shell, built with the opening world so B04 is never
 * hollow: floor, walls, ceiling, the timber tiers under the Keyboard Wall, the
 * supercomputer racks on a plinth, the lobby seating group and the closed
 * entrance door. Every structural box is a `B4_OBSTACLES` rect, so the scenery
 * and the collision come from one parameter object; the furniture is drawn from
 * `B4_LOBBY` and its collision rects are the same numbers. World coordinates;
 * DOM-free, and light-free: in Chapter 1 the room cannot glow by itself.
 */
export const B4_SHELL_NAME='B04_room_shell';
export const B4_RACK_LED='B4 rack status';
export const B4_RACK_BODY='B4 rack body';
export const B4_CEILING='B4 room ceiling';
export const B4_LIFT_CAR='B04_lift_car';
export const B4_LIFT_LANDING='B04_lift_landing';
const std=(name:string,color:number,emissive=0,intensity=0,roughness=.85)=>{const m=new T.MeshStandardMaterial({name,color,roughness,metalness:.05});if(emissive){m.emissive.setHex(emissive);m.emissiveIntensity=intensity;}return m;};
const SOURCE={sourceFile:'src/opening/b4Shell.ts',source:'B04 campaign rooms (src/opening/b4Layout.ts)',confidence:'provisional 2030 scenery; not a surveyed interior'};
// No authorKey here: repeated boxes (the rack status strips, the sofa modules) must get a
// unique `name#n` key from tagChildren, or compact() merges traces with duplicate keys.
function box(parent:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={...SOURCE};parent.add(mesh);return mesh;
}
function roundedBox(parent:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,radius=.05){
 const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/3,h/3,d/3)),m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={...SOURCE};parent.add(mesh);return mesh;
}
function group(parent:T.Object3D,name:string){const g=new T.Group();g.name=name;g.userData={...SOURCE};parent.add(g);return g;}
function cylinder(parent:T.Object3D,name:string,top:number,bottom:number,h:number,x:number,y:number,z:number,m:T.Material){
 const object=new T.Mesh(new T.CylinderGeometry(top,bottom,h,16),m);object.name=name;object.position.set(x,y,z);object.castShadow=object.receiveShadow=true;object.userData={...SOURCE};parent.add(object);return object;
}

/** The lift materials `buildLiftCar`/`buildLiftLanding` need, structurally typed so the
 * shell's one material table stays the only place a colour is chosen. */
interface LiftMats{
 car:T.Material;carDark:T.Material;carFloor:T.Material;lamp:T.Material;door:T.Material;doorSill:T.Material;
 landingFloor:T.Material;landingWall:T.Material;landingCeiling:T.Material;officeDoor:T.Material;
 officePlate:T.Material;officeText:T.Material;
}

/**
 * The car: a 2.20 × 2.60 m steel box with its own ceiling, two jambs, a door head and two
 * sliding leaves. Every part is positioned relative to the car floor, and the group's
 * `position.y` is the car floor, so `lift.ts` moves the whole car by writing one number
 * (plus one z per leaf). `B4_LAYOUT.sideDoor`-style parked leaves are not reused: these
 * leaves are the collision, so they must match `liftObstacleBoxes` exactly.
 */
function buildLiftCar(m:LiftMats){
 const root=new T.Group();root.name=B4_LIFT_CAR;root.userData={...SOURCE,authorKey:B4_LIFT_CAR,sceneLabel:'B04 core lift car'};root.userData.noVoxelTile=true;
 const W=L.x1-L.x0,D=L.z1-L.z0,H=L.clearHeight,TH=L.wall,cx=(L.x0+L.x1)/2,cz=(L.z0+L.z1)/2;
 const mid=(L.door.z0+L.door.z1)/2,half=(L.door.z1-L.door.z0)/2;
 box(root,'B4_lift_car_floor',W,TH,D,cx,-TH/2,cz,m.carFloor);
 box(root,'B4_lift_car_west',TH,H,D,L.x0+TH/2,H/2,cz,m.car);
 box(root,'B4_lift_car_north',W,H,TH,cx,H/2,L.z0+TH/2,m.car);
 box(root,'B4_lift_car_south',W,H,TH,cx,H/2,L.z1-TH/2,m.car);
 box(root,'B4_lift_car_ceiling',W,TH,D,cx,H+TH/2,cz,m.car);
 box(root,'B4_lift_jamb_north',TH,H,L.door.z0-L.z0,L.x1-TH/2,H/2,(L.z0+L.door.z0)/2,m.car);
 box(root,'B4_lift_jamb_south',TH,H,L.z1-L.door.z1,L.x1-TH/2,H/2,(L.door.z1+L.z1)/2,m.car);
 box(root,'B4_lift_door_head',TH,H-L.door.height,L.door.z1-L.door.z0,L.x1-TH/2,(L.door.height+H)/2,mid,m.car);
 box(root,'B4_lift_car_sill',.10,.02,L.door.z1-L.door.z0,L.x1-.05,.01,mid,m.doorSill);
 box(root,'B4_lift_car_lamp',.90,.03,.90,cx,H-.02,cz,m.lamp);
 box(root,'B4_lift_car_rail',.05,.05,1.40,L.x0+.07,1.02,cz,m.carDark);
 const leaves=[-1,1].map(direction=>{
  const leafMesh=box(root,direction<0?'B4_lift_door_north':'B4_lift_door_south',.06,L.door.height,half,L.x1-TH/2,L.door.height/2,mid+direction*half/2,m.door);
  // `lift.ts` reads these: the closed centre and which way the leaf slides clear.
  leafMesh.userData.closedZ=mid+direction*half/2;
  leafMesh.userData.slideDirection=direction;
  return leafMesh;
 });
 // The car's small screen on the west wall: it carries the lobby feed between floors, and
 // `b4Office` lifts its emissive intensity from 0 the moment the feed dies.
 const feed=feedSurface();
 const screenMat=feed
  ?new T.MeshStandardMaterial({name:'B4 lift car screen',color:0x05080a,emissive:0xffffff,emissiveMap:feed.texture,emissiveIntensity:0,roughness:.45,metalness:0})
  :std('B4 lift car screen',0x0a0f12);
 const carScreen=box(root,'B4_lift_car_screen',.012,.15,.25,L.x0+TH+.008,1.60,cz,screenMat);
 box(root,'B4_lift_car_screen_frame',.02,.19,.29,L.x0+TH+.004,1.60,cz,m.carDark);
 return{root,leaves,carScreen};
}

/** Floor, walls, ceiling, corridor and the closed principal's door — D.3's landing, built
 * from `liftLandingBoxes()` so the scenery and the collision are one set of numbers. */
function buildLiftLanding(m:LiftMats){
 const root=new T.Group();root.name=B4_LIFT_LANDING;root.userData={...SOURCE,authorKey:B4_LIFT_LANDING,sceneLabel:'B04 fifth-floor landing'};root.userData.noVoxelTile=true;
 const boxes=liftLandingBoxes();
 for(const b of boxes){
  // The office leaf is hung on a hinge by `buildOffice`, so it is skipped here.
  if(b.name==='opening-lift-5f-office-door')continue;
  const material=b.name.includes('floor')?m.landingFloor:b.name.includes('ceiling')?m.landingCeiling:m.landingWall;
  box(root,b.name,b.x1-b.x0,b.top-b.bottom,b.z1-b.z0,(b.x0+b.x1)/2,(b.top+b.bottom)/2,(b.z0+b.z1)/2,material);
 }
 const top=L.landing+L.clearHeight;
 box(root,'B4_lift_5f_lamp_lobby',1.20,.03,.24,(L.x1+LIFT_LANDING.lobbyX1)/2,top-.02,(L.z0+L.z1)/2,m.lamp);
 box(root,'B4_lift_5f_lamp_corridor',2.40,.03,.18,(LIFT_LANDING.lobbyX1+LIFT_LANDING.corridorX1)/2,top-.02,(LIFT_LANDING.corridorZ0+LIFT_LANDING.corridorZ1)/2,m.lamp);
 // The door plate names the room behind it, so the landing reads as an office door and
 // not as the end of a corridor. Scenery only: Task E owns the room.
 const door=boxes.find(b=>b.name==='opening-lift-5f-office-door')!;
 const signZ=(door.z0+door.z1)/2,signY=L.landing+1.55,signX=door.x0-.012;
 box(root,'B4_lift_office_sign_plate',.02,.22,door.z1-door.z0+.10,signX,signY,signZ,m.officePlate);
 const glyphs=new TextGeometry('PRINCIPAL',{font:campusFont,size:.115,depth:.006,curveSegments:1});
 glyphs.computeBoundingBox();
 const bb=glyphs.boundingBox!;
 glyphs.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
 const text=new T.Mesh(glyphs,m.officeText);
 text.name='B4_lift_office_sign_text';text.position.set(signX-.013,signY,signZ);text.rotation.y=-Math.PI/2;
 text.userData={...SOURCE,authorKey:'B4_lift_office_sign_text'};
 root.add(text);
 return root;
}

/** The office and lobby materials, structurally typed so `mats` stays the only colour table. */
interface OfficeMats{
 deskWood:T.Material;chairFabric:T.Material;paper:T.Material;coat:T.Material;warmLamp:T.Material;
 window:T.Material;book:T.Material;bookAlt:T.Material;screenFrame:T.Material;glass:T.Material;
 callPlate:T.Material;callLamp:T.Material;landingFloor:T.Material;landingWall:T.Material;
 landingCeiling:T.Material;officeDoor:T.Material;officePlate:T.Material;officeText:T.Material;
 /** E.8's dressing: the trolley's steel, the evacuation notice, the dying corridor panel. */
 trolleyFrame:T.Material;trolleyDeck:T.Material;trolleyLinen:T.Material;evacPlate:T.Material;evacText:T.Material;flicker:T.Material;
}

/**
 * A canvas the CCTV feed draws into, or nothing when there is no DOM (the Node gates). One
 * canvas for the whole shell: the monitor and the car's screen share the texture, so the feed
 * is drawn once per frame at most and the car carries the same dying picture between floors.
 */
let feedCache:{canvas:HTMLCanvasElement;texture:T.CanvasTexture}|null|undefined;
function feedSurface(){
 if(feedCache!==undefined)return feedCache;
 if(typeof document==='undefined')return(feedCache=null);
 const canvas=document.createElement('canvas');canvas.width=FEED_CANVAS.width;canvas.height=FEED_CANVAS.height;
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;
 return(feedCache={canvas,texture});
}

/**
 * The principal's office behind the 5F corridor door: shell from `b4OfficeBoxes()` (the same
 * boxes `navigation.ts` mounts), the hinged door, the desk with the presentation MacBook, and
 * the read-task dressing. No lights: warm panels are emissive.
 */
function buildOffice(m:OfficeMats){
 const root=new T.Group();root.name='B04_principal_office';root.userData={...SOURCE,authorKey:'B04_principal_office',sceneLabel:"5F principal's office"};root.userData.noVoxelTile=true;
 const O=B4_OFFICE,F=O.floorTop;
 for(const b of b4OfficeBoxes()){
  // Both shaft guards are collision only; the shell seals those openings with the lift's own
  // door leaves (and leaves the 5F doorway open when the car is there).
  if(b.name==='opening-office-shaft-guard'||b.name==='opening-office-ground-guard')continue;
  const material=b.name.includes('floor')?m.landingFloor:b.name.includes('ceiling')?m.landingCeiling
   :b.name.includes('desk')||b.name.includes('shelf')?m.deskWood:b.name.includes('chair')?m.chairFabric:m.landingWall;
  box(root,b.name,b.x1-b.x0,b.top-b.bottom,b.z1-b.z0,(b.x0+b.x1)/2,(b.top+b.bottom)/2,(b.z0+b.z1)/2,material);
 }
 // The door leaf hangs on a hinge at the north jamb; `b4Office` swings it.
 const hinge=group(root,'B04_office_door_hinge');
 hinge.position.set(O.door.x0+.03,F,O.door.z0);
 const leafW=O.door.z1-O.door.z0-.02;
 const leaf=box(hinge,'B4_office_door_leaf',.06,O.door.height,leafW,0,O.door.height/2,leafW/2+.01,m.officeDoor);
 leaf.userData.authorKey='B4_office_door_leaf';
 // Desk dressing: a blotter, two papers and the MacBook.
 const D=O.desk,dx=(D.x0+D.x1)/2,dz=(D.z0+D.z1)/2,top=F+D.h;
 box(root,'B4_office_blotter',.42,.006,1.10,dx,top+.004,dz,m.coat);
 box(root,'B4_office_paper',.21,.004,.30,dx-.06,top+.009,dz-.58,m.paper);
 box(root,'B4_office_paper',.21,.004,.30,dx+.04,top+.009,dz+.62,m.paper);
 const laptop=group(root,'B4_office_macbook');laptop.position.set(O.laptop.x,O.laptop.y,O.laptop.z);
 box(laptop,'B4_office_macbook_base',.32,.016,.22,0,.008,0,m.officeDoor);
 const lid=box(laptop,'B4_office_macbook_lid',.32,.21,.012,0,.105,-.104,m.officeDoor);lid.rotation.x=.18;
 // A chair turned away from the desk, and a coat over its back.
 const C=O.chair,chair=group(root,'B4_office_chair');
 chair.position.set(C.x,F,C.z);chair.rotation.y=.62;
 box(chair,'B4_office_chair_seat',C.size,.06,C.size,0,C.seat-.03,0,m.chairFabric);
 box(chair,'B4_office_chair_back',C.size,.46,.06,0,C.seat+.23,-C.size/2+.03,m.chairFabric);
 box(chair,'B4_office_coat',C.size*.8,.34,.10,0,C.seat+.30,-C.size/2-.02,m.coat);
 // Shelf rows on the room-facing side of the bookcase.
 const S=O.shelf;
 for(let i=0;i<3;i++){
  const y=F+.42+i*.55,books=7;
  for(let k=0;k<books;k++){
   const w=(S.x1-S.x0-.12)/books-.012;
   box(root,'B4_office_book',w,.30,.03,S.x0+.06+w*(k+.5)+k*.012,y,S.z1+.016,k%3?m.book:m.bookAlt);
  }
 }
 // The window: a bright pane on the east wall, and the warm practical light.
 box(root,'B4_office_window',.02,1.40,3.40,O.interior.x1-.012,F+1.62,O.door.centre,m.window);
 // A flat bright pane reads as a lightbox from eye height; two mullions and a transom
 // give it a frame and a believable glazing rhythm (interior QA, 2026-11-25).
 for(const z of [O.door.centre-.85,O.door.centre,O.door.centre+.85])box(root,'B4_office_window_mullion',.035,1.40,.05,O.interior.x1-.028,F+1.62,z,m.coat);
 box(root,'B4_office_window_transom',.035,.05,3.40,O.interior.x1-.028,F+1.62,O.door.centre,m.coat);
 box(root,'B4_office_ceiling_lamp',1.10,.03,.34,dx,O.ceilBottom-.02,dz,m.warmLamp);
 box(root,'B4_office_desk_lamp',.16,.02,.16,D.x1-.18,top+.16,D.z0+.20,m.warmLamp);
 box(root,'B4_office_desk_lamp_stem',.03,.16,.03,D.x1-.18,top+.08,D.z0+.20,m.coat);
 // The office has no light of its own on purpose (check-b4-office `dressing:no-lights`:
 // "the room cannot glow by itself in the daytime"). Its night exposure is a world-layer
 // job, tracked in KNOWN-ISSUES with the interior-QA evidence.
 return{root,hinge};
}

/**
 * The lobby CCTV monitor on the west wall between the side door and the lift, and the two
 * landing call plates. The feed is a canvas texture redrawn by `b4Office.tickOffice` — never a
 * second render pass.
 */
function buildLobbyDevices(m:OfficeMats){
 const root=new T.Group();root.name='B04_lobby_devices';root.userData={...SOURCE,authorKey:'B04_lobby_devices',sceneLabel:'B04 lobby monitor and lift calls'};root.userData.noVoxelTile=true;
 const O=B4_OFFICE,C=O.cctv;
 const monitor=group(root,'B04_lobby_cctv');
 monitor.position.set(C.x,C.y,C.z);monitor.rotation.y=C.tilt;
 box(monitor,'B4_cctv_frame',.07,C.h+.06,C.w+.06,0,0,0,m.screenFrame);
 const feed=feedSurface();
 const screenMat=feed
  ?new T.MeshBasicMaterial({name:'B4 CCTV feed',map:feed.texture,toneMapped:false})
  :m.glass;
 const screen=new T.Mesh(new T.BoxGeometry(.012,C.h-.04,C.w-.04),screenMat);
 screen.name='B4_cctv_screen';screen.position.set(.04,0,0);screen.userData={...SOURCE,authorKey:'B4_cctv_screen'};monitor.add(screen);
 // The two call plates: ground beside the lift doorway, 5F at the corridor's mouth.
 const g=O.callGround,f=O.call5f;
 box(root,'B4_call_plate_ground',.02,.16,.11,g.x-.005,g.y,g.z,m.callPlate);
 const lampGround=box(root,'B4_call_lamp_ground',.012,.055,.055,g.x+.008,g.y,g.z,std('B4 call lamp ground',0xffb347,0xffa02e,.25));
 box(root,'B4_call_plate_5f',.11,.16,.02,f.x,f.y,LIFT_LANDING.corridorZ1-.012,m.callPlate);
 const lamp5f=box(root,'B4_call_lamp_5f',.055,.055,.012,f.x,f.y,LIFT_LANDING.corridorZ1-.020,std('B4 call lamp 5f',0xffb347,0xffa02e,.25));
 // The stairs sign, placed where the lift is the only way up (B04 has no stair of its own).
 const glyphs=new TextGeometry('5F BY LIFT',{font:campusFont,size:.09,depth:.004,curveSegments:1});
 glyphs.computeBoundingBox();
 const bb=glyphs.boundingBox!;
 glyphs.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
 const sign=new T.Mesh(glyphs,m.officeText);
 sign.name='B4_lift_sign_text';sign.position.set(L.x1+.019,2.02,L.door.z1+.55);sign.rotation.y=Math.PI/2;
 sign.userData={...SOURCE,authorKey:'B4_lift_sign_text'};root.add(sign);
 box(root,'B4_lift_sign_plate',.02,.20,.78,L.x1+.006,2.02,L.door.z1+.55,m.officePlate);
 attachOfficeVisual({
  screen:feed?{canvas:feed.canvas,texture:feed.texture}:undefined,
  callGround:{material:lampGround.material as T.MeshStandardMaterial},
  call5f:{material:lamp5f.material as T.MeshStandardMaterial},
 });
 return root;
}

/**
 * E.8's 5F dressing: the building's own evacuation notice on the corridor wall, and one
 * ceiling panel that is not quite dead. Scenery only — no collision, no trigger. They exist so
 * the corridor is worth a look, which is where the errand's extra seconds come from.
 */
function buildCorridorDressing(m:OfficeMats){
 const root=new T.Group();root.name='B04_5f_dressing';root.userData={...SOURCE,authorKey:'B04_5f_dressing',sceneLabel:'B04 5F corridor dressing'};root.userData.noVoxelTile=true;
 const S=B4_OFFICE.dressing.evacSign;
 box(root,'B4_lift_5f_evac_sign',.52,.26,.02,S.x,S.y,S.z,m.evacPlate);
 const line=(text:string,size:number,dy:number,name:string)=>{
  const glyphs=new TextGeometry(text,{font:campusFont,size,depth:.004,curveSegments:1});
  glyphs.computeBoundingBox();
  const bb=glyphs.boundingBox!;
  glyphs.translate(-(bb.min.x+bb.max.x)/2,-(bb.min.y+bb.max.y)/2,0);
  const mesh=new T.Mesh(glyphs,m.evacText);
  mesh.name=name;mesh.position.set(S.x,S.y+dy,S.z+.012);
  mesh.userData={...SOURCE,authorKey:name};
  root.add(mesh);
 };
 line('EVACUATION',.058,.040,'B4_lift_5f_evac_text');
 line('ASSEMBLY POINT',.038,-.052,'B4_lift_5f_evac_subtext');
 // E.8/E.11: a trolley left mid-corridor where someone stopped pushing it — angled across
 // the walk, clear of both walls, and the one object in the beat that says people left in a
 // hurry. Scenery only: no collision, so it can never stop the player.
 const TR=B4_OFFICE.dressing.trolley;
 const trolley=group(root,'B04_5f_trolley');
 trolley.position.set(TR.x,TR.y,TR.z);trolley.rotation.y=TR.yaw;
 box(trolley,'B4_trolley_deck',.60,.04,.95,0,.26,0,m.trolleyDeck);
 for(const sx of [-1,1])for(const sz of [-1,1])box(trolley,'B4_trolley_wheel',.07,.09,.07,sx*.24,.045,sz*.38,m.trolleyFrame);
 for(const sx of [-1,1])box(trolley,'B4_trolley_upright',.03,.95,.03,sx*.27,.475,-.45,m.trolleyFrame);
 box(trolley,'B4_trolley_bar',.60,.03,.03,0,.94,-.45,m.trolleyFrame);
 box(trolley,'B4_trolley_load',.26,.22,.30,.05,.39,.12,m.coat);
 // Housekeeping, not a bare frame with a black box on it (interior QA, 2026-11-25). Every part
 // stays inside the .60 × .95 m deck footprint and below the 0.955 m bar, so the footprint the
 // corridor gates pin and the screen extent `trolley:extent` measures cannot grow.
 box(trolley,'B4_trolley_deck_upper',.51,.035,.56,0,.60,.02,m.trolleyDeck);
 for(let i=0;i<3;i++){
  const fold=box(trolley,'B4_trolley_linen',.42,.055,.30,(i%2?.016:-.012),.6175+.055*(i+.5),.02+(i===1?.016:-.010),m.trolleyLinen);
  fold.rotation.y=i===1?.09:-.04;
 }
 box(trolley,'B4_trolley_linen_folded',.20,.05,.20,-.18,.355,-.15,m.trolleyLinen);
 // The dying panel, on its own material so `b4Office.animateFlicker` owns one panel only.
 const P=B4_OFFICE.dressing.flickerPanel;
 const panel=box(root,'B4_lift_5f_flicker',1.10,.03,.20,P.x,P.y,P.z,m.flicker);
 attachOfficeVisual({flicker:{material:panel.material as T.MeshStandardMaterial}});
 return root;
}

export function buildB4Shell(){
 const root=new T.Group();root.name=B4_SHELL_NAME;root.userData={...SOURCE,authorKey:B4_SHELL_NAME,sceneLabel:'B04 ground floor (Keyboard Wall rooms)'};root.userData.noVoxelTile=true;
 const R=B4_LAYOUT.room,F=R.floor;
 const mats={
  // Distinct photographed surfaces: warm white leather, pale blue-grey weave, tan
  // timber, glossy cream stone and warm bronze. No environment-map pipeline.
  wall:std('B4 room wall',0xded8c9),ceiling:std(B4_CEILING,0xb7a78f,0,0,.58),floor:std('Ivory B4 polished stone floor',0xe9dbc5,0,0,.18),
  ceilingSlat:std('Ivory B4 warm bronze ceiling slat',0x9b8b74,0,0,.66),ceilingHousing:std('Ivory B4 dark bronze fixture channel',0x49443b,0,0,.42),
  rack:std(B4_RACK_BODY,0x161b1f),plinth:std('B4 rack plinth',0x3b3f42),led:std(B4_RACK_LED,0x2f7d52,0x47e08a,.12),frame:std('B4 door frame',0x8fabae),
  tierTop:std('B4 timber tier tread',0x9a6f45),tierRiser:std('B4 timber tier riser',0x7c5735),
  sofa:std('Ivory B4 white leather sofa',0xded8cc,0,0,.55),rug:std('Ivory B4 blue-grey rug',0x8f9fac,0,0,.94),rugRing:std('Ivory B4 rug border',0xbcc8d0),
  rugMotif:std('Ivory B4 rug woven motif',0x748896,0,0,.94),
  stone:std('Ivory B4 table stone',0xeee9df,0,0,.36),timber:std('B4 lobby stool timber',0xa9825d,0,0,.62),
  bench:std('B4 lobby tan bench timber',0xa9825d,0,0,.62),white:std('Ivory B4 white dressing',0xf2efe7,0,0,.42),
  foliage:std('Ivory B4 planter foliage',0x3f654d,0,0,.82),windowGlass:std('B4 lobby glazing',0xbcd6e4,0x9dc6dd,.12,.12),
  ceilingLed:new T.MeshBasicMaterial({name:'B4 curved white ceiling LED',color:0xfff9ec}),
  floorSheen:new T.MeshBasicMaterial({name:'B4 polished floor sheen',color:0xfff8e8,transparent:true,opacity:.07,depthWrite:false}),
  exit:new T.MeshBasicMaterial({name:'B4 green exit sign',color:0x2ca45f}),
  /* Lift: brushed steel car, a lit ceiling, a dark door and the 5F finishes. */
  car:std('B4 lift car steel',0xb9c2c4),carDark:std('B4 lift car trim',0x3c4649),
  carFloor:std('B4 lift car floor',0x2b3234),lamp:std('B4 lift car lamp',0xfff4d8,0xffe9b8,.85),
  door:std('B4 lift door',0x8f9a9d),doorSill:std('B4 lift door sill',0x6d787b),
  landingFloor:std('B4 5F floor',0xcfc6b4),landingWall:std('B4 5F wall',0xe3ddcf),
  landingCeiling:std('B4 5F ceiling',0xe9e5da),officeDoor:std('B4 5F office door',0x6b4a2f),
  officePlate:std('B4 5F office plate',0x2a2f31),officeText:std('B4 5F office lettering',0xe7c877,.45,.35),
  /* Task E: the principal's office and the lobby monitor. Emissive, never a light: the shell
     must carry zero lights (`check-campaign-b4` asserts it), so "warm practical lighting" is
     a warm-emitting shade and ceiling panel, not a lit room. */
  deskWood:std('B4 office desk timber',0x6b4a2f),chairFabric:std('B4 office chair fabric',0x2f3b44),
  paper:std('B4 office paper',0xe8e3d6),coat:std('B4 office coat',0x3a3f45),
  warmLamp:std('B4 office warm lamp',0xffe6bd,0xffca82,1.15),window:std('B4 office window light',0xbcd6e4,0x9dc6dd,.30),
  book:std('B4 office book',0x7d3b34),bookAlt:std('B4 office book spine',0x3d5a6b),
  screenFrame:std('B4 lobby monitor frame',0x1b2023),glass:std('B4 lobby monitor glass',0x0a0f12,0x33ff88,.35),
  callPlate:std('B4 lift call plate',0x2b3234),callLamp:std('B4 lift call lamp',0xffb347,0xffa02e,.25),
  /* E.8's dressing: the trolley's steel and deck, the green evacuation notice, the dying panel. */
  trolleyFrame:std('B4 lobby trolley frame',0x59646a),trolleyDeck:std('B4 lobby trolley deck',0x8a8f91),
  trolleyLinen:std('B4 trolley linen',0xece7db),
  evacPlate:std('B4 5F evacuation plate',0x1c5e35),evacText:std('B4 5F evacuation lettering',0xe8f4ec,0x6fe0a0,.8),
  flicker:std('B4 5F corridor flicker panel',0xd9e6ea,0xbfe0ee,.9),
 };
 mats.windowGlass.transparent=true;mats.windowGlass.opacity=.14;mats.windowGlass.depthWrite=false;
 mats.ceilingHousing.side=T.DoubleSide;
 const shell=group(root,'B04_room_structure');
 box(shell,'B4_floor',R.x1-R.x0,R.floor,R.z1-R.z0,(R.x0+R.x1)/2,R.floor/2,(R.z0+R.z1)/2,mats.floor).castShadow=false;
 // One restrained emissive streak suggests the stone's reflection without a render-target pass.
 const sheen=new T.Mesh(new T.PlaneGeometry(2.2,8.5),mats.floorSheen);
 sheen.name='B4_polished_floor_sheen';sheen.rotation.x=-Math.PI/2;sheen.position.set(64.4,F+.001,13.4);sheen.userData={...SOURCE};shell.add(sheen);
 // Racks on a low plinth along the north wall. The plinth is inset 1 cm on the faces the room
 // can see (its south face and its two outer x faces): the rack bodies share those planes
 // otherwise, and the coplanar faces flicker in a 12 cm band at the base of the racks. The
 // collision rects are unchanged: the plinth is scenery, the racks are the obstacles.
 const racks=group(root,'B04_supercomputer_racks'),rx=B4_LAYOUT.rackX,rz=B4_LAYOUT.rackZ,plinthInset=.01;
 const plinthX0=Math.min(...rx.map(r=>r[0]))+plinthInset,plinthX1=Math.max(...rx.map(r=>r[1]))-plinthInset,plinthZ1=rz[1]-plinthInset;
 box(racks,'B4_rack_plinth',plinthX1-plinthX0,.12,plinthZ1-rz[0],(plinthX0+plinthX1)/2,F+.06,(rz[0]+plinthZ1)/2,mats.plinth);
 for(const r of B4_OBSTACLES){
  if(!r.render)continue;
  const x=(r.x0+r.x1)/2,z=(r.z0+r.z1)/2,w=r.x1-r.x0,d=r.z1-r.z0;
  if(r.render==='rack'){
   box(racks,r.name,w,r.top-r.bottom,d,x,(r.top+r.bottom)/2,z,mats.rack);
   // Status strips on the room-facing south face, 1 mm proud: on the west faces they read
   // edge-on through the 0.20 m gaps between the cabinets.
   for(let k=0;k<7;k++)box(racks,'B4_rack_status_strip',w-.2,.04,.02,x,r.bottom+.4+k*.27,r.z1+.011,mats.led);
   continue;
  }
  // A tier is a solid step built from two stacked materials. The riser stops 5 cm below
  // the step top; the tread overlaps it by 2 mm, tops out 2 mm proud of the collision top
  // and is 2 mm wider/deeper, so no riser and tread face is coplanar (coplanar faces flicker).
  if(r.render==='tier'){
   const tread=.05,proud=.002;
   box(shell,r.name,w,r.top-tread-r.bottom,d,x,(r.bottom+r.top-tread)/2,z,mats.tierRiser);
   box(shell,r.name+'_tread',w+2*proud,tread+2*proud,d+2*proud,x,r.top-tread/2,z,mats.tierTop);
   continue;
  }
  box(shell,r.name,w,r.top-r.bottom,d,x,(r.top+r.bottom)/2,z,mats[r.render]);
 }
 // Long curved white LED lines and recessed linear fixtures under a structured bronze
 // ceiling. Emissive geometry, not lights: the shell's zero-light contract is unchanged.
 const ceilingY=F+R.clearHeight-.115,ceilingMidZ=(R.z0+R.z1)/2;
 for(const side of [-1,1])box(shell,'B4_dropped_ceiling_perimeter',.16,.16,R.z1-R.z0-.30,R.x0+.15+side*(R.x1-R.x0-.30),ceilingY-.11,ceilingMidZ,mats.ceilingSlat);
 for(const z of [R.z0+.15,R.z1-.15])box(shell,'B4_dropped_ceiling_perimeter',R.x1-R.x0,.16,.16,(R.x0+R.x1)/2,ceilingY-.11,z,mats.ceilingSlat);
 for(let x=R.x0+.45;x<R.x1-.30;x+=.78)box(shell,'B4_ceiling_slat',.060,.060,R.z1-R.z0-.55,x,ceilingY-.075,ceilingMidZ,mats.ceilingSlat);
 const ceilingRibbon=(points:T.Vector3[],width:number,name:string,yOffset:number)=>{
  const curve=new T.CatmullRomCurve3(points),positions:number[]=[],uvs:number[]=[],indices:number[]=[],segments=56;
  for(let index=0;index<=segments;index++){
   const t=index/segments,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
   const side=new T.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(width/2);
   positions.push(p.x-side.x,p.y+yOffset,p.z-side.z,p.x+side.x,p.y+yOffset,p.z+side.z);uvs.push(0,t,1,t);
   if(index<segments){const a=index*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const ribbon=new T.Mesh(geometry,mats.ceilingHousing);ribbon.name=name;ribbon.castShadow=ribbon.receiveShadow=true;ribbon.userData={...SOURCE};shell.add(ribbon);
 };
 // Two runs, not three. A middle run at x=58 crossed the three straight recessed fixtures at
 // the same x and dipped up to 9.5 cm below the ceiling plane, so it read as an exposed white
 // conduit hanging through the light bars (interior QA, 2026-11-25). The outer pair still
 // frames the room and the centre keeps its clean east–west fixture rhythm.
 for(const x of [51.5,64.5]){
  const points=[
   new T.Vector3(x,ceilingY-.025,R.z0+.55),new T.Vector3(x+.48,ceilingY-.09,11.0),
   new T.Vector3(x+.12,ceilingY-.12,16.3),new T.Vector3(x-.22,ceilingY-.025,R.z1-.55),
  ];
  ceilingRibbon(points,.18,'B4_curved_LED_fixture_channel',.038);
  const curve=new T.CatmullRomCurve3(points),led=new T.Mesh(new T.TubeGeometry(curve,48,.026,8,false),mats.ceilingLed);
  led.name='B4_curved_ceiling_LED';led.castShadow=led.receiveShadow=true;led.userData={...SOURCE};shell.add(led);
 }
 for(const z of [9.1,13.75,18.4]){
  box(shell,'B4_recessed_linear_fixture_channel',2.55,.055,.18,58,ceilingY-.030,z,mats.ceilingHousing);
  box(shell,'B4_recessed_linear_light',2.4,.018,.07,58,ceilingY-.066,z,mats.ceilingLed);
 }
 // Lobby seating group on the round rug, in front of the Keyboard Wall.
 const lobby=group(root,'B04_lobby_furniture'),L=B4_LOBBY;
 const rug=new T.Mesh(new T.CylinderGeometry(L.rug.r,L.rug.r,.012,44),mats.rug);
 rug.name='B4_lobby_rug';rug.position.set(L.rug.x,F+.006,L.rug.z);rug.receiveShadow=true;rug.userData={...SOURCE,authorKey:'B4_lobby_rug'};lobby.add(rug);
 // A ring, not a disc: a solid border disc would cover the teal rug it is meant to outline.
 // One millimetre above the rug's top face so the two surfaces do not share a plane.
 const ring=new T.Mesh(new T.RingGeometry(L.rug.r-.22,L.rug.r,48),mats.rugRing);
 ring.name='B4_lobby_rug_border';ring.rotation.x=-Math.PI/2;ring.position.set(L.rug.x,F+.013,L.rug.z);ring.receiveShadow=true;ring.userData={...SOURCE,authorKey:'B4_lobby_rug_border'};lobby.add(ring);
 for(const radius of [.70,1.30,1.88]){
  const motif=new T.Mesh(new T.RingGeometry(radius,radius+.018,48),mats.rugMotif);
  motif.name='B4_rug_woven_ring';motif.rotation.x=-Math.PI/2;motif.position.set(L.rug.x,F+.015,L.rug.z);motif.userData={...SOURCE};lobby.add(motif);
 }
 for(let i=0;i<20;i++){
  const a=i*Math.PI/10,diamond=box(lobby,'B4_rug_diamond_motif',.11,.004,.11,L.rug.x+2.12*Math.cos(a),F+.016,L.rug.z+2.12*Math.sin(a),mats.rugMotif);diamond.rotation.y=Math.PI/4;
 }
 // The curved sofa: modules on a circle, backs outward, the gap facing the room's north-west.
 // The module count comes from the layout object, the same one the collision rects use.
 const S=L.sofa,modules=S.modules,span=S.to-S.from;
 for(let i=0;i<modules;i++){
  const t=S.from+span*(i+.5)/modules,width=2*S.radius*Math.sin(span/(2*modules))+.03;
  const x=S.cx+S.radius*Math.cos(t),z=S.cz+S.radius*Math.sin(t);
  const base=roundedBox(lobby,'B4_lobby_sofa_base',width,.12,.58,x,F+.08,z,mats.sofa,.035);base.rotation.y=Math.PI/2-t;
  const seat=roundedBox(lobby,'B4_lobby_sofa_seat',width,S.seat,.72,x,F+S.seat/2,z,mats.sofa,.060);seat.rotation.y=Math.PI/2-t;
  const back=roundedBox(lobby,'B4_lobby_sofa_back',width,.36,.16,S.cx+(S.radius+.28)*Math.cos(t),F+S.seat+.18,S.cz+(S.radius+.28)*Math.sin(t),mats.sofa,.050);back.rotation.y=Math.PI/2-t;
 }
 for(const [i,c] of L.armchairs.entries()){
  const a=group(lobby,'B4_lobby_armchair_'+(i+1));a.position.set(c.x,F,c.z);a.rotation.y=i?Math.PI*.62:-Math.PI*.18;
  // A 0.44 m seat and a 0.82 m back: at the old 0.20 m / 0.52 m the pair read as backless
  // footstools (interior QA, 2026-11-25). Arms complete the silhouette; their outer faces are
  // flush with the .78 m footprint the collision rect already covers.
  const seatH=L.armchairSize*.56,backH=L.armchairSize*.50;
  box(a,'B4_lobby_armchair_seat',L.armchairSize,seatH,L.armchairSize*.82,0,seatH/2,0,mats.sofa);
  for(const side of [-1,1])box(a,'B4_lobby_armchair_arm',.09,.26,L.armchairSize*.70,side*(L.armchairSize/2-.045),.47,0,mats.sofa);
  // The back starts at the seat's top face: the old +0.3 m offset floated it 9.7 cm above the
  // seat. It then tilts -0.12 rad about its own centre, which lifts the front-bottom edge by
  // 10.8 mm; the centre sits 11 mm low so that edge meets the seat instead of leaving a wedge gap.
  const back=box(a,'B4_lobby_armchair_back',L.armchairSize,backH,.16,0,seatH+backH/2-.011,-L.armchairSize*.33,mats.sofa);back.rotation.x=-.12;
 }
 const table=new T.Mesh(new T.CylinderGeometry(L.table.r,L.table.r,.055,20),mats.stone);
 table.name='B4_lobby_table';table.position.set(L.table.x,F+L.table.h-.0275,L.table.z);table.castShadow=table.receiveShadow=true;table.userData={...SOURCE,authorKey:'B4_lobby_table'};lobby.add(table);
 const pedestal=new T.Mesh(new T.CylinderGeometry(L.table.r*.34,L.table.r*.62,L.table.h-.055,14),mats.timber);
 pedestal.name='B4_lobby_table_pedestal';pedestal.position.set(L.table.x,F+(L.table.h-.055)/2,L.table.z);pedestal.userData={...SOURCE,authorKey:'B4_lobby_table_pedestal'};lobby.add(pedestal);
 const stool=new T.Mesh(new T.CylinderGeometry(L.stool.r,L.stool.r*.72,L.stool.h*.16,16),mats.stone);
 stool.name='B4_lobby_stool_seat';stool.position.set(L.stool.x,F+L.stool.h*.92,L.stool.z);stool.castShadow=true;stool.userData={...SOURCE,authorKey:'B4_lobby_stool_seat'};lobby.add(stool);
 const stem=new T.Mesh(new T.CylinderGeometry(L.stool.r*.34,L.stool.r*.5,L.stool.h*.8,14),mats.timber);
 stem.name='B4_lobby_stool_stem';stem.position.set(L.stool.x,F+L.stool.h*.4,L.stool.z);stem.userData={...SOURCE,authorKey:'B4_lobby_stool_stem'};lobby.add(stem);
 // Low tan bench in front of the sofa. Its collision rectangle is authored from B4_LOBBY.
 const B=L.bench;
 box(lobby,'B4_lobby_bench_seat',B.w,.11,B.d,B.x,F+B.h-.055,B.z,mats.bench);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const leg=box(lobby,'B4_lobby_bench_leg',.07,B.h-.11,.07,B.x+sx*(B.w/2-.16),F+(B.h-.11)/2,B.z+sz*(B.d/2-.09),mats.bench);
  leg.rotation.z=-sx*.10;leg.rotation.x=sz*.10;
 }
 for(const [i,t] of L.sideTables.entries()){
  cylinder(lobby,'B4_lobby_side_table_top_'+(i+1),t.r,t.r,.055,t.x,F+t.h-.0275,t.z,mats.white);
  cylinder(lobby,'B4_lobby_side_table_pedestal_'+(i+1),t.r*.28,t.r*.62,t.h-.055,t.x,F+(t.h-.055)/2,t.z,mats.white);
 }
 for(const [i,s] of L.paleStools.entries()){
  cylinder(lobby,'B4_lobby_pale_stool_seat_'+(i+1),s.r,s.r,.065,s.x,F+s.h-.0325,s.z,mats.white);
  cylinder(lobby,'B4_lobby_pale_stool_stem_'+(i+1),s.r*.25,s.r*.55,s.h-.065,s.x,F+(s.h-.065)/2,s.z,mats.white);
 }
 for(const [i,p] of L.plants.entries()){
  cylinder(lobby,'B4_lobby_white_planter_'+(i+1),p.r,p.r*.84,.60,p.x,F+.30,p.z,mats.white);
  for(let spray=0;spray<7;spray++){
   const a=spray*Math.PI*2/7,leaf=new T.Mesh(new T.SphereGeometry(.19,12,8),mats.foliage);
   leaf.name='B4_lobby_planter_leaf_'+(i+1)+'_'+spray;leaf.position.set(p.x+.18*Math.cos(a),F+.78+.08*(spray%3),p.z+.18*Math.sin(a));
   leaf.scale.set(.58,1.55,.30);leaf.rotation.set(.25,a,.40);leaf.castShadow=true;leaf.userData={...SOURCE};lobby.add(leaf);
  }
 }
 // Green exit sign above the side entrance, with actual lettering rather than a blank green tile.
 box(shell,'B4_exit_sign_plate',.56,.20,.035,B4_LAYOUT.sideDoor.x0+(B4_LAYOUT.sideDoor.x1-B4_LAYOUT.sideDoor.x0)/2,F+2.82,B4_LAYOUT.sideDoor.z-.045,mats.exit);
 const exitGeometry=new TextGeometry('EXIT',{font:campusFont,size:.10,depth:.004,curveSegments:1});
 exitGeometry.computeBoundingBox();const exitBounds=exitGeometry.boundingBox!;
 exitGeometry.translate(-(exitBounds.min.x+exitBounds.max.x)/2,-(exitBounds.min.y+exitBounds.max.y)/2,0);
 const exitLettering=new T.Mesh(exitGeometry,mats.white);exitLettering.name='B4_exit_sign_lettering';
 exitLettering.position.set(B4_LAYOUT.sideDoor.x0+(B4_LAYOUT.sideDoor.x1-B4_LAYOUT.sideDoor.x0)/2,F+2.82,B4_LAYOUT.sideDoor.z-.067);exitLettering.userData={...SOURCE};shell.add(exitLettering);
 // Double-height glazed panel in the remaining south-wall bay, with tan mullions.
 const windowX=(B4_FLIP_WALL.x1+R.x1-.13)/2,windowW=R.x1-.13-B4_FLIP_WALL.x1-.16;
 box(shell,'B4_double_height_glazing',windowW,4.05,.018,windowX,F+2.025,R.z1-.15,mats.windowGlass);
 for(const dx of [-windowW/2,0,windowW/2])box(shell,'B4_tan_window_mullion',.065,4.10,.055,windowX+dx,F+2.05,R.z1-.17,mats.bench);
 for(const y of [1.65,3.35])box(shell,'B4_tan_window_transom',windowW,.06,.055,windowX,F+y,R.z1-.17,mats.bench);
 // Entrance: a slim frame and two frosted sliding leaves, closed until the campaign opens them.
 const D=B4_LAYOUT.door,door=group(root,'B04_entrance_door'),mid=(D.x0+D.x1)/2,leaf=(D.x1-D.x0)/2;
 // Opaque frosted panels: a closed door must read as closed, not as a window into the dark room.
 const panel=std('B4 door frosted panel',0xb9c9c4,0x31423d,.35);
 for(const x of [D.x0-.04,D.x1+.04])box(door,'B4_door_post',.08,D.height,.2,x,F+D.height/2,D.z,mats.frame);
 box(door,'B4_door_header',D.x1-D.x0+.16,.08,.2,mid,F+D.height+.04,D.z,mats.frame);
 for(const [i,name] of B4_DOOR_LEAVES.entries()){
  const side=i===0?-1:1,g=group(door,name);g.position.set(mid+side*leaf/2,F,D.z);g.userData.closedX=g.position.x;g.userData.slide=side*D.slide;
  box(g,'B4_door_leaf_frame',leaf,.06,D.thickness,0,.03,0,mats.frame);box(g,'B4_door_leaf_frame',leaf,.06,D.thickness,0,D.height-.03,0,mats.frame);
  // Meeting stiles overlap 2 cm so the closed pair has no gap on the centre line.
  box(g,'B4_door_leaf_stile',.08,D.height,D.thickness,side*-(leaf/2-.03),D.height/2,0,mats.frame);
  const pane=new T.Mesh(new T.BoxGeometry(leaf-.06,D.height-.12,.02),panel);pane.name='B4_door_leaf_panel';pane.position.set(0,D.height/2,0);pane.userData={...SOURCE,authorKey:'B4_door_leaf_panel'};g.add(pane);
 }
 // Side entrance in the same façade, west of the main door (Ruling G1): the same frame and
 // two-leaf construction as the entrance, parked open so the doorway reads as the way in.
 const SD=B4_LAYOUT.sideDoor,sdMid=(SD.x0+SD.x1)/2,sdLeaf=(SD.x1-SD.x0)/2;
 const sideDoorGroup=group(root,'B04_side_door');
 for(const x of [SD.x0-.04,SD.x1+.04])box(sideDoorGroup,'B4_side_door_post',.08,SD.height,.2,x,F+SD.height/2,SD.z,mats.frame);
 box(sideDoorGroup,'B4_side_door_header',SD.x1-SD.x0+.16,.08,.2,sdMid,F+SD.height+.04,SD.z,mats.frame);
 for(const [i,name] of ['B4_side_door_west','B4_side_door_east'].entries()){
  const dir=i===0?-1:1,leaf=group(sideDoorGroup,name);
  // Closed centre kept for a later animation; the leaves start slid clear of the 2.60 m
  // opening by 1.35 m each, the same relationship as the main entrance (leaf 1.30 m).
  leaf.userData.closedX=sdMid+dir*sdLeaf/2;leaf.userData.slide=dir*(sdLeaf+.05);
  leaf.position.set(leaf.userData.closedX+leaf.userData.slide,F,SD.z);
  box(leaf,'B4_side_door_leaf_frame',sdLeaf,.06,SD.thickness,0,.03,0,mats.frame);
  box(leaf,'B4_side_door_leaf_frame',sdLeaf,.06,SD.thickness,0,SD.height-.03,0,mats.frame);
  box(leaf,'B4_side_door_leaf_stile',.08,SD.height,SD.thickness,dir*-(sdLeaf/2-.03),SD.height/2,0,mats.frame);
  const pane=new T.Mesh(new T.BoxGeometry(sdLeaf-.06,SD.height-.12,.02),panel);
  pane.name='B4_side_door_leaf_panel';pane.position.set(0,SD.height/2,0);pane.userData={...SOURCE,authorKey:'B4_side_door_leaf_panel'};leaf.add(pane);
 }
 // The ruled flip wall on the façade's interior face, east of the main door.
 root.add(createB4FlipWall().root);
 // The core lift and the fifth floor it opens onto. The car is the one part of the shell
 // that moves: `lift.ts` owns the pose and rewrites these transforms from the same tick
 // that moves the car's collision.
 const lift=buildLiftCar(mats);
 root.add(lift.root);
 root.add(buildLiftLanding(mats));
 attachLiftVisual({root:lift.root,leaves:lift.leaves});
 // Task E: the principal's office behind the 5F door, and the lobby's monitor and call plates.
 // The office door hinge and the car's screen are the two visuals `b4Office` animates; the
 // monitor canvas and the two call lamps were registered by `buildLobbyDevices`.
 const office=buildOffice(mats);
 root.add(office.root);
 root.add(buildLobbyDevices(mats));
 root.add(buildCorridorDressing(mats));
 attachOfficeVisual({doorHinge:office.hinge,carScreen:{material:lift.carScreen.material as T.MeshStandardMaterial}});
 return root;
}

/** The entrance leaves in a built world; none when the opening shell is absent. */
export function findB4DoorLeaves(root:T.Object3D):T.Object3D[]{
 return B4_DOOR_LEAVES.map(n=>root.getObjectByName(n)).filter((g):g is T.Object3D=>!!g&&typeof g.userData.closedX==='number');
}
/** Slide the entrance leaves: 0 closed, 1 open. */
export function setB4DoorLeaves(leaves:readonly T.Object3D[],open:number){
 for(const g of leaves){g.position.x=g.userData.closedX+g.userData.slide*open;g.updateMatrixWorld(true);}
}
