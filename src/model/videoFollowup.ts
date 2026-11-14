import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {campusFont} from './fonts';
import type {BuildingSpec,SiteParameters} from './campusParameters';
import {COLUMN_X} from './scaleCalibration';
/** U08 00:21–00:27: user estimates H width 30–40cm; NOT a survey. */
export const LAWN_SIGN={hWidth:.4,x:0,z:91,bottom:.13,depth:.08,source:'U08 IMG_4349.MOV 00:09–00:27; estimated H width 0.30–0.40m'};
const h=new TextGeometry('H',{font:campusFont,size:1,depth:.06,curveSegments:1});h.computeBoundingBox();
export const LAWN_FONT_SIZE=LAWN_SIGN.hWidth/(h.boundingBox!.max.x-h.boundingBox!.min.x);h.dispose();
export function lawnLetterGeometry(){const g=new TextGeometry('HKU',{font:campusFont,size:LAWN_FONT_SIZE,depth:LAWN_SIGN.depth,curveSegments:1});g.computeBoundingBox();const b=g.boundingBox!;g.translate(-(b.min.x+b.max.x)/2,-b.min.y,0);return g;}
const sample=lawnLetterGeometry();sample.computeBoundingBox();export const LAWN_SIZE=sample.boundingBox!.getSize(new T.Vector3());sample.dispose();
/** U07 00:57–01:12 places the oculus between the west pair, off the roadside. Position within gap remains estimated. */
export const OCULUS={x:-COLUMN_X,z:35,source:'U07 IMG_4348.MOV 00:57–01:12; between west pair, not over the roadside'};

export function oculusDeck(specs:BuildingSpec[]){const n=specs.find(b=>b.id==='B01')!,s=specs.find(b=>b.id==='B02')!;return{width:15,north:n.z+n.depth/2,south:s.z-s.depth/2,holeRadius:3.12};}
export function oculusDeckGeometry(specs:BuildingSpec[],height:number){const d=oculusDeck(specs),shape=new T.Shape();shape.moveTo(-d.width/2,-(d.north-OCULUS.z));shape.lineTo(d.width/2,-(d.north-OCULUS.z));shape.lineTo(d.width/2,-(d.south-OCULUS.z));shape.lineTo(-d.width/2,-(d.south-OCULUS.z));shape.closePath();const hole=new T.Path();hole.absarc(0,0,d.holeRadius,0,Math.PI*2,true);shape.holes.push(hole);const g=new T.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);g.translate(0,height-.2,0);return g;}

/** U08 00:28–00:34: perimeter planting. Exact widths/heights inferred; road gateways left open. */
export function perimeterBeds(s:SiteParameters){const beds:{x:number;z:number;w:number;d:number}[]=[];
 for(const side of [-1,1])for(const [a,b]of [[-95,-50],[-38,90]])beds.push({x:side*(s.width/2-1.8),z:(a+b)/2,w:1.8,d:b-a});
 for(const side of [-1,1])for(const [a,b]of [[-87,-10],[10,87]])beds.push({x:(a+b)/2,z:s.centerZ+side*(s.depth/2-1.8),w:b-a,d:1.8});
 return beds;
}
export function addVideoFollowup(env:T.Group,s:SiteParameters){
 const root=new T.Group();root.name='U08_Perimeter_and_lawn_lights';root.userData={sceneId:'A015',label:'外围绿化与 HKU 草坪地灯',sourceFile:'src/model/videoFollowup.ts',source:'U08 00:18–00:34',confidence:'observed type and continuity; placement and dimensions estimated'};env.add(root);
 const leaf=new T.MeshStandardMaterial({name:'U08 perimeter low hedge',color:0x52703b,roughness:1}),soil=new T.MeshStandardMaterial({name:'U08 perimeter soil',color:0x5f6046,roughness:1}),housing=new T.MeshStandardMaterial({name:'U08 uplight dark housing',color:0x343c33,roughness:.8});
 const lens=new T.MeshStandardMaterial({name:'Night_U08_lawn_lens',color:0x353c2c,emissive:0xefff99,emissiveIntensity:0});lens.userData={nightIntensity:1.1,dayColor:0x353c2c,nightColor:0xe8efbb};
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 for(const [i,b]of perimeterBeds(s).entries()){
  const bed=new T.Group();bed.name='Perimeter_bed_'+i;root.add(bed);
  const along=b.w>b.d,count=Math.ceil(Math.max(b.w,b.d)/2);
  const base=box('Perimeter_soil',b.w,.08,b.d,b.x,.04,b.z,soil);bed.attach(base);
  for(let n=0;n<count;n++){const offset=(n+.5)/count-.5,w=along?b.w/count:b.w,d=along?b.d:b.d/count;
   for(const [factor,height,y]of [[1,.35,.22],[.8,.23,.50]]){const o=box('Perimeter_hedge_block',w*factor,height,d*factor,b.x+(along?offset*b.w:0),y,b.z+(along?0:offset*b.d),leaf);bed.attach(o);}}
 }
 for(const x of [-.65,0,.65]){box('Lawn_uplight_housing',.12,.12,.15,x,.19,LAWN_SIGN.z+.85,housing);const o=box('Lawn_uplight_lens',.09,.025,.10,x,.26,LAWN_SIGN.z+.84,lens);o.rotation.x=-.45;}
 return root;
}
