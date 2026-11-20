import * as T from 'three';
import {signPhotoTexture,SIGN_PHOTO_SOURCE} from './signPhoto';
import type {BuildingSpec,SiteParameters} from './campusParameters';
export const NOV14={revision:'2026-11-14-U06',link:{width:14,bottom:5.8,height:6.8},greenLink:{centerZ:-12,depth:25,pathWidth:4,bedWidth:11},source:'references/nov14-video/REPORT.md'};
export function signPhotoMaterial(){const map=signPhotoTexture();map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;map.minFilter=T.NearestMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;map.name='U06_CDS_monument_rectified';const m=new T.MeshStandardMaterial({name:'Sign_actual_user_photo_U06_175s',map,roughness:.9});m.userData={source:SIGN_PHOTO_SOURCE};return m;}
/** Former A012 footprint; retained for ground planting and historical evidence only. */
export function linkLayout(specs:BuildingSpec[]){const a=specs.find(b=>b.id==='B04')!,b=specs.find(b=>b.id==='B05')!,north=a.z-a.depth/2,south=b.z+b.depth/2;return{x:(a.x+b.x)/2,z:(north+south)/2,length:north-south+.6,...NOV14.link};}
export function addNov14Details(env:T.Group,circulation:T.Group,specs:BuildingSpec[],site:SiteParameters){
 const root=new T.Group();root.name='U06_Daylight_Details';root.userData={source:NOV14.source,confidence:'observed components, approximate positions and dimensions'};env.add(root);
 const material=(name:string,color:number)=>{const m=new T.MeshStandardMaterial({name,color,roughness:.85});m.userData.keepColor=true;return m;};
 const ivory=material('U06 pale limestone',0xc9cabb),grass=material('U06 lawn',0x69964a),leaf=material('U06 foliage low hedge',0x7d9d3f),metal=material('U06 dark metal',0x485957),bark=material('U06 bark',0x72634f),soil=material('U06 soil',0x756649),warm=material('Night_U06_lobby_light',0xf2d7a3);warm.emissive.setHex(0xffdfb1);warm.emissiveIntensity=.5;
 const box=(g:T.Object3D,n:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=n;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 // Lawn and low plants beyond the north rim connect to the existing hall stair; leave a clear centre walk.
 const gl=NOV14.greenLink;for(const side of [-1,1]){box(root,'North_court_lawn',gl.bedWidth,.12,gl.depth,side*(gl.pathWidth/2+gl.bedWidth/2),.03,gl.centerZ,grass);box(root,'North_court_low_hedge',1.2,.42,gl.depth-1,side*13.1,.30,gl.centerZ,leaf);for(const z of [-20,-6]){box(root,'North_tree_trunk',.15,4.2,.15,side*10.5,2.1,z,bark);for(const [dx,h]of [[-.6,4.1],[.35,4.7],[.8,3.8]])box(root,'North_tree_leaf_cluster',1.1,.60,.95,side*10.5+dx,h,z+(dx*.5),leaf);}}
 const walk=new T.Group();walk.name='R011';walk.userData={sceneId:'R011',label:'庭院北侧中央步道',sourceFile:'src/model/nov14Details.ts'};root.add(walk);box(walk,'North_court_stair_link',gl.pathWidth,.04,29,0,.02,-12.5,ivory);
 // Continuous low perimeter planting follows the courtyard, rather than scattered round bushes.
 for(let i=0;i<80;i++){const a=(i+.5)/80*Math.PI*2,rx=site.plazaRadiusX+1.15,rz=site.plazaRadiusZ+1.15,x=site.plazaX+rx*Math.cos(a),z=site.plazaZ+rz*Math.sin(a);if(Math.abs(x)<3&&Math.abs(z-site.plazaZ)>site.plazaRadiusZ-2)continue;const o=box(root,'Curved_low_hedge',1.45,.43,1.05,x,.245,z,leaf);o.rotation.y=-Math.atan2(rz*Math.cos(a),-rx*Math.sin(a));}
 // User screenshot correction, 2026-11-20: A012 is retired. The guessed
 // elevated B04/B05 corridor (deck, roof, glazing, fins and supports) is removed.
 // Keep its former footprint only to locate the existing ground-level planters.
 const l=linkLayout(specs);
 // Two observed dark, movable troughs near the side passage, kept outside its clear centre.
 for(const side of [-1,1]){const x=l.x+side*(l.width/2+1.6);box(root,'Side_passage_planter',1.2,.65,3.4,x,.325,l.z,metal);box(root,'Side_passage_planter_foliage',1.1,.40,3.25,x,.82,l.z,leaf);}
 // Rectangular lighting is a low-poly simplification of the bright rings seen through lower glazing.
 return root;
}
