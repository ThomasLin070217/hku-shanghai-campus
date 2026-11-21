import * as T from 'three';
import {CALIBRATED_LAYOUT as CL} from './scaleCalibration';
import {LION} from './lionParameters';
import {NOV13 as N} from './nov13Parameters';
import type {SiteParameters} from './campusParameters';
export function createLion(){
 const root = new T.Group();
 root.name = N.lion.id;
 root.userData = {source:LION.source,status:LION.uncertainty,bodyHeight:LION.bodyHeight,support:LION.support};
 const body = new T.Group();
 body.name = 'Lion_body_uniform_scale';
 root.add(body);

 const mat = (name:string,color:number) => new T.MeshStandardMaterial({name,color,roughness:.9});
 const gold = mat('Lion golden fabric',0xeeb262);
 const mane = mat('Lion orange mane',0xe9a055);
 const maneLight = mat('Lion amber mane',0xf3ad60);
 const cream = mat('Lion cream muzzle',0xf1dfc8);
 const gown = mat('Lion teal gown',0x246765);
 const shirt = mat('Lion pale shirt and cuffs',0xdbe9e9);
 const trousers = mat('Lion dark trousers',0x2f2934);
 const nose = mat('Lion plum nose and ears',0x684048);
 const dark = mat('Lion eyes and whiskers',0x251e25);
 const red = mat('Lion burgundy accent',0x9c3943);

 type Point = [number,number,number];
 const sphere = new T.SphereGeometry(1,16,12);
 function mesh(name:string,geometry:T.BufferGeometry,material:T.Material,position:Point){
  const part = new T.Mesh(geometry,material);
  part.name = name;
  part.position.set(...position);
  part.castShadow = part.receiveShadow = true;
  body.add(part);
  return part;
 }
 function oval(name:string,position:Point,radii:Point,material:T.Material){
  const part = mesh(name,sphere,material,position);
  part.scale.set(...radii);
  return part;
 }
 function lathe(profile:number[][],segments:number,start=0,sweep=2*Math.PI){
  return new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments,start,sweep);
 }
 function line(name:string,start:Point,end:Point,radius:number,material:T.Material){
  const a = new T.Vector3(...start), b = new T.Vector3(...end);
  const part = mesh(name,new T.CylinderGeometry(radius,radius,a.distanceTo(b),6),material,a.clone().lerp(b,.5).toArray());
  part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());
  return part;
 }

 const waistRadius = 1.055;
 const skirtProfile = [[0,.08],[.99,.08],[1.08,.23],[1.06,.75],[waistRadius,.84]];
 const skirt = mesh('Seated_body',lathe(skirtProfile,32,.79,2*Math.PI-1.58),gown,[0,0,-.09]);
 skirt.scale.z = .79;
 const positions = skirt.geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++){
  const y = positions.getY(i);
  const angle = Math.atan2(positions.getX(i),positions.getZ(i));
  const pleat = 1+.045*Math.cos(angle*12)*Math.max(0,1-y/.84);
  positions.setXYZ(i,positions.getX(i)*pleat,y,positions.getZ(i)*pleat);
 }
 skirt.geometry.computeVertexNormals();
 const jacket = mesh('Rounded_body_mid',lathe([[0,.84],[waistRadius,.84],[1.01,1.27],[.92,1.82],[.74,2.23],[.52,2.49],[0,2.55]],40),gown,[0,0,-.09]);
 jacket.scale.z = .79;
 oval('Seated_trousers',[0,.49,.31],[1.04,.49,.83],trousers);

 // A single pale front panel follows the jacket curve, with the original five seam IDs.
 const front = [[1.06,.85],[1.018,1.27],[.93,1.82],[.75,2.23],[.53,2.49]];
 const panel = mesh('Shirt_front_panel',lathe(front,12,-.36,.72),shirt,[0,0,-.063]);
 panel.scale.z = .79;
 for(const angle of [-.29,-.145,0,.145,.29]){
  const path = new T.CatmullRomCurve3(front.map(([r,y])=>new T.Vector3((r+.006)*Math.sin(angle),y,(r+.006)*Math.cos(angle)*.79)));
  mesh('Shirt_vertical_stripe',new T.TubeGeometry(path,12,.005,5,false),angle===0?gown:cream,[0,0,-.063]);
 }
 oval('Golden_mane',[0,3.36,-.19],[1.18,1.16,.87],mane);
 const tuftShape = lathe([[0,-1],[.6,-.87],[.94,-.52],[1,-.16],[.88,.18],[.62,.48],[.32,.75],[0,1]],10);
 function tuft(name:string,position:Point,direction:Point,radii:Point,material:T.Material){
  const part = mesh(name,tuftShape,material,position);
  part.scale.set(...radii);
  part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...direction).normalize());
 }
 // Preserve the original ring's ordering while adding separate rear layers.
 for(let i=0;i<14;i++){
  const angle = i*Math.PI/7, x = Math.sin(angle), y = Math.cos(angle);
  tuft('Mane_pixel_tuft',[x*1.02,3.39+y*1.07,-.09],[x,y,-.22],
   [.28,y>.75?.52:.37,.32],i%2?mane:maneLight);
 }
 for(let row=0;row<3;row++){
  const y = 4.04-row*.51;
  for(let i=0;i<5;i++){
   const a=(i-2)*.43+(row===1?.13:0), x=Math.sin(a);
   tuft('Mane_rear_layer',[x*(1.12+row*.07),y,-.24-Math.cos(a)*.80],
    [x*.6,-.88,-.24],[.31,.48,.28],(row+i)%2?mane:maneLight);
  }
 }
 for(let i=0;i<7;i++){
  const x=(i-3)*.25;
  tuft('Mane_chin_fringe',[x,2.48+.25*Math.abs(x),.63],[x*.48,-1,.14],[.18,.28,.18],maneLight);
 }
 tuft('Forelock',[.03,4.39,.39],[.14,1,-.14],[.29,.56,.24],maneLight);
 oval('Face',[0,3.38,.30],[1.07,.98,.77],gold);
 for(const side of [-1,1]){
  oval('Ear',[side*.81,4.08,.26],[.39,.40,.23],gold);
  oval('Ear_inner',[side*.84,4.08,.43],[.245,.26,.10],nose);
  oval('Muzzle',[side*.32,3.07,.92],[.48,.38,.32],cream);
  oval('Eye',[side*.38,3.60,1.00],[.107,.148,.045],dark);
  oval('Eye_glint',[side*.38+.026,3.65,1.036],[.030,.035,.018],shirt);
  oval('Trouser_leg',[side*.70,.48,.69],[.57,.49,.62],trousers);
  oval('Paw',[side*.76,.51,1.04],[.56,.51,.56],gold);
  const sleeve = oval('Gown_sleeve',[side*.95,1.72,.28],[.35,.74,.42],gown);
  sleeve.rotation.x=-.53;
  sleeve.rotation.z=side*.34;
  const cuff = oval('Gown_cuff',[side*1.11,1.37,.59],[.34,.30,.39],shirt);
  cuff.rotation.x=-.48;
  oval('Arm',[side*1.14,1.17,.81],[.31,.30,.29],gold);
  for(let i=0;i<3;i++){
   const x=(i-1)*.23;
   oval('Paw_toe',[side*.76+x,.57,1.43-Math.abs(x)*.33],[.18,.22,.15],maneLight);
   oval('Whisker_dot',[side*(.22+i*.14),3.05+(i%2)*.045,1.236-i*.014],[.019,.019,.013],dark);
   line('Whisker',[side*(.31+i*.069),3.03+i*.033,1.227],[side*(.75+i*.06),2.99+i*.104,1.15],.007,nose);
  }
 }
 const noseShape = new T.Shape().moveTo(0,-.23).bezierCurveTo(-.14,-.12,-.37,.04,-.32,.15)
  .bezierCurveTo(-.27,.35,.27,.35,.32,.15).bezierCurveTo(.37,.04,.14,-.12,0,-.23);
 mesh('Nose',new T.ExtrudeGeometry(noseShape,{depth:.018,bevelThickness:.112,bevelSize:.035,bevelSegments:5,curveSegments:8}),nose,[0,3.37,1.175]);
 oval('Smile',[0,2.83,1.09],[.22,.11,.10],dark);
 oval('Tongue',[0,2.79,1.174],[.13,.038,.035],red);
 oval('Lower_lip',[0,2.74,1.10],[.23,.07,.092],cream);

 const crest = new T.Shape().moveTo(-.14,.15).lineTo(.14,.15).lineTo(.12,-.05)
  .quadraticCurveTo(.10,-.13,0,-.18).quadraticCurveTo(-.10,-.13,-.12,-.05).closePath();
 const badge = mesh('Gown_badge',new T.ShapeGeometry(crest),maneLight,[.49,1.91,.55]);
 badge.rotation.y=.43;
 const badgeField = mesh('Gown_badge_field',new T.ShapeGeometry(crest),red,[.497,1.915,.566]);
 badgeField.rotation.y=.43;
 badgeField.scale.setScalar(.83);
 const book = mesh('Gown_badge_book',new T.PlaneGeometry(.13,.10),shirt,[.501,1.876,.573]);
 book.rotation.y=.43;

 const letters:Point[][] = [
  [[.64,.64,1.571],[.64,.52,1.571]],[[.71,.64,1.584],[.71,.52,1.584]],
  [[.64,.58,1.574],[.71,.58,1.587]],[[.75,.64,1.589],[.75,.52,1.589]],
  [[.82,.64,1.583],[.75,.58,1.592],[.82,.52,1.587]],
  [[.86,.64,1.574],[.86,.54,1.581],[.89,.52,1.573],[.93,.54,1.562],[.93,.64,1.556]],
 ];
 for(const stroke of letters){
  for(let i=1;i<stroke.length;i++)line('Paw_HKU_lettering',stroke[i-1],stroke[i],.006,shirt);
 }
 const pawBadge = mesh('Paw_crest',new T.ShapeGeometry(crest),red,[-.76,.59,1.593]);
 pawBadge.scale.setScalar(.34);
 mesh('Paw_crest_book',new T.PlaneGeometry(.045,.047),shirt,[-.76,.582,1.595]);

 const tailPath = new T.CatmullRomCurve3([[.22,.27,-.79],[.40,.23,-1.12],[.78,.20,-1.36],[1.08,.25,-1.42]]
  .map(([x,y,z])=>new T.Vector3(x,y,z)));
 mesh('Tail',new T.TubeGeometry(tailPath,18,.14,10,false),gold,[0,0,0]);
 tuft('Tail_tip',[1.11,.26,-1.42],[1,.32,-.16],[.19,.27,.19],mane);

 const bounds = new T.Box3().setFromObject(body);
 const scale = LION.bodyHeight/(bounds.max.y-bounds.min.y);
 body.scale.setScalar(scale);
 body.position.y = LION.support.height-bounds.min.y*scale;
 const base = new T.Mesh(new T.BoxGeometry(LION.support.width,LION.support.height,LION.support.depth),gown);
 base.name = 'Lion_low_support_PROVISIONAL';
 base.position.set(0,LION.support.height/2,.12);
 root.add(base);
 root.rotation.y = LION.yaw;
 return root;
}
export function addNov13Details(environment:T.Group,circulation:T.Group,s:SiteParameters){
 const root=new T.Group();root.name='Nov13_Observed_Corrections';root.userData={source:'IMG_4339/IMG_4342',units:'metres',revision:N.revision};environment.add(root);
 const stone=new T.MeshStandardMaterial({name:'Nov13 pale paving',color:0xc4c8c1,roughness:.95}),metal=new T.MeshStandardMaterial({name:'Nov13 rail',color:0x788b8b,metalness:.45,roughness:.55}),dark=new T.MeshStandardMaterial({name:'Nov13 dark signage',color:0x30413e});
 const box=(g:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 const beam=(g:T.Object3D,name:string,a:T.Vector3,b:T.Vector3,r=.035)=>{const o=box(g,name,r,a.distanceTo(b),r,0,0,0,metal);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());};
 const lion=createLion();lion.position.set(LION.x,LION.groundY,LION.z);root.add(lion);
 for(const b of N.benches){box(root,b.id, .55,.42,2.5,b.x,.21,b.z,stone);box(root,b.id+'-back',.12,.28,2.5,b.x+.22,.56,b.z,stone);}
 // Low pale curbs segment the observed path; gaps remain at crossing points.
 for(const x of CL.eastKerbX)for(const [z,d]of [[-16,22],[13,14],[61,16]])box(root,'Promenade_low_kerb',.22,.14,d,x,.07,z,stone);
 const ms=N.mapSign;box(root,ms.id,ms.width,ms.height,ms.depth,ms.x,ms.height/2,ms.z,dark);box(root,'Directory_pale_panel',ms.width-.12,1.35,.015,ms.x,1.3,ms.z+.10,stone);
 for(let r=0;r<3;r++)for(let c=0;c<2;c++)box(root,'Directory_building_symbol',.20,.16,.01,ms.x+(c-.5)*.3,1.65-r*.25,ms.z+.112,dark);
 // U06 replaces the earlier straight flights and spiral ramp with observed curved flights.
}
