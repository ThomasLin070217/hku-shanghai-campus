import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createCharacter} from '../characters/character';
import {STUDENT,type Appearance} from '../characters/config';
import {SPORTS_HALL} from '../model/sportsDoor';

/** Green-gown students waiting inside the sports hall (client request 2026-11-21).
 * The protagonist rig is reused verbatim; a fixed share of the crowd is female (long hair,
 * slightly smaller build) and a fixed share is international with different skin and hair
 * tones. Every variant shares one texture atlas, so the whole crowd costs two draw calls
 * per variant instead of ~1 600 meshes. Placements are a loose random scatter. */
export const CROWD={
 count:100,
 femaleShare:.5,
 internationalShare:.2,
 id:'sports-hall-students',
 name:'Sports_Hall_Students',
 floor:SPORTS_HALL.floorTop,
 yaw:-Math.PI/2, // face east, toward the door the player opens
 sourceFile:'src/gameplay/studentCrowd.ts',
};
export interface CrowdVariant {key:string;label:string;appearance:Appearance;count:number;international:boolean;female:boolean}
/** Weights are shares of the whole crowd; counts are then rounded to sum to `total`. */
const BASE:Omit<CrowdVariant,'count'>[]=[
 {key:'cn-man',label:'Local man',female:false,international:false,appearance:{...STUDENT,id:'crowd-cn-man',name:'Green gown student · local man'}},
 {key:'cn-woman',label:'Local woman',female:true,international:false,appearance:{...STUDENT,id:'crowd-cn-woman',name:'Green gown student · local woman',height:1.68,build:.94,hairStyle:'long',faceWidth:.84,coat:0x0f6b56,trim:0x05493c}},
 {key:'af-man',label:'African man',female:false,international:true,appearance:{...STUDENT,id:'crowd-af-man',name:'Green gown student · African man',skin:0x7a5138,hair:0x141010,coat:0x5e2733,trim:0x39161f,shirt:0xf2ecdd}},
 {key:'af-woman',label:'African woman',female:true,international:true,appearance:{...STUDENT,id:'crowd-af-woman',name:'Green gown student · African woman',skin:0x8a5c40,hair:0x191211,hairStyle:'long',faceWidth:.85,height:1.69,build:.95,coat:0x74303f,trim:0x451a26,shirt:0xf2ecdd}},
 {key:'sa-man',label:'South Asian man',female:false,international:true,appearance:{...STUDENT,id:'crowd-sa-man',name:'Green gown student · South Asian man',skin:0xb87a50,hair:0x241a14,coat:0x24395c,trim:0x14243b,shirt:0xf4f1e4}},
 {key:'sa-woman',label:'South Asian woman',female:true,international:true,appearance:{...STUDENT,id:'crowd-sa-woman',name:'Green gown student · South Asian woman',skin:0xc98a60,hair:0x2a1d16,hairStyle:'long',faceWidth:.85,height:1.67,build:.94,coat:0x2d4a72,trim:0x1a2e49,shirt:0xf6f2e6}},
 {key:'eu-man',label:'European and American man',female:false,international:true,appearance:{...STUDENT,id:'crowd-eu-man',name:'Green gown student · European and American man',skin:0xf0c8a8,hair:0xd9b06a,coat:0x3b4148,trim:0x23282d,shirt:0xf6f2e8}},
 {key:'eu-woman',label:'European and American woman',female:true,international:true,appearance:{...STUDENT,id:'crowd-eu-woman',name:'Green gown student · European and American woman',skin:0xf2ccae,hair:0xc79a52,hairStyle:'long',faceWidth:.84,height:1.7,build:.94,coat:0x8a7350,trim:0x574530,shirt:0xf7f3e8}},
];
const split=(total:number,parts:number)=>{const base=Math.floor(total/parts),rest=total-base*parts;return Array.from({length:parts},(_,i)=>base+(i<rest?1:0));};
/** 20% international (three regions, both genders) and a configurable female share. */
export function crowdVariants(total=CROWD.count,femaleShare=CROWD.femaleShare,internationalShare=CROWD.internationalShare):CrowdVariant[]{
 const femaleTotal=Math.round(total*femaleShare),internationalTotal=Math.round(total*internationalShare);
 const perRegion=split(internationalTotal,3),femalePerRegion=split(Math.round(internationalTotal*femaleShare),3);
 const internationalFemale=femalePerRegion.reduce((a,b)=>a+b,0);
 const counts:Record<string,number>={
  'cn-man':Math.max(0,total-internationalTotal-Math.max(0,femaleTotal-internationalFemale)),
  'cn-woman':Math.max(0,femaleTotal-internationalFemale),
  'af-man':perRegion[0]-femalePerRegion[0],'af-woman':femalePerRegion[0],
  'sa-man':perRegion[1]-femalePerRegion[1],'sa-woman':femalePerRegion[1],
  'eu-man':perRegion[2]-femalePerRegion[2],'eu-woman':femalePerRegion[2],
 };
 return BASE.map(v=>({...v,count:counts[v.key]??0})).filter(v=>v.count>0);
}
/** Deterministic scatter: identical on every reload, so review screenshots stay comparable. */
function random(seed:number){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function crowdPlacements(count=CROWD.count,seed=20401121){
 const next=random(seed),margin=1.05,doorX=SPORTS_HALL.x+SPORTS_HALL.eastX,doorZ=-117;
 const minX=SPORTS_HALL.x-SPORTS_HALL.width/2+margin,maxX=doorX-margin-0.4;
 const minZ=doorZ-SPORTS_HALL.depth/2+margin,maxZ=doorZ+SPORTS_HALL.depth/2-margin;
 const out:{x:number;z:number;yaw:number;scale:number}[]=[];
 for(let guard=0;out.length<count&&guard<60000;guard++){
  const x=minX+next()*(maxX-minX),z=minZ+next()*(maxZ-minZ);
  if(Math.hypot(x-doorX,z-doorZ)<2.8)continue;
  if(out.some(p=>Math.hypot(p.x-x,p.z-z)<1.05))continue;
  out.push({x,z,yaw:CROWD.yaw+(next()-.5)*1.6,scale:.93+next()*.13});
 }
 return out;
}
export function createStudentCrowd(placements=crowdPlacements(),variants=crowdVariants(),nearestFemale=12){
 const root=new T.Group();
 root.name=CROWD.name;root.userData={sourceFile:CROWD.sourceFile,source:'2026-11-21 client request: 100 green-gown students inside the sports hall, 20% international, mixed gender, random scatter',confidence:'fictional-gameplay-addition_not-observed',label:'Students inside the sports hall',count:placements.length,variants:variants.map(v=>({key:v.key,label:v.label,count:v.count}))};
 // Pass 1: build one standalone character per variant and collect every part texture into one atlas.
 type Prototype={variant:CrowdVariant;root:T.Group;textured:{mesh:T.Mesh;slot:number}[];plain:T.Mesh[]};
 const atlasSlots:T.DataTexture[]=[],slotOf=new Map<string,number>();
 const prototypes:Prototype[]=[];
 // The students nearest the door are the long-haired ones, so opening it shows them first;
 // everyone else keeps the same variant counts but is mixed across the remaining seats.
 const expanded=variants.flatMap(variant=>Array.from({length:variant.count},()=>({variant})));
 const doorX=SPORTS_HALL.x+SPORTS_HALL.eastX,doorZ=-117;
 const order=placements.map((p,i)=>({i,d:Math.hypot(p.x-doorX,p.z-doorZ)})).sort((a,b)=>a.d-b.d).map(o=>o.i);
 const women=expanded.filter(e=>e.variant.female),men=expanded.filter(e=>!e.variant.female),shuffle=random(77123);
 // Shuffle the women so the doorway group mixes ethnicities instead of one variant.
 for(let i=women.length-1;i>0;i--){const j=Math.floor(shuffle()*(i+1));[women[i],women[j]]=[women[j],women[i]];}
 const nearestCount=Math.min(nearestFemale,women.length);
 const rest=[...women.slice(nearestCount),...men];
 for(let i=rest.length-1;i>0;i--){const j=Math.floor(shuffle()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
 const seats=new Map<number,CrowdVariant>();
 order.forEach((index,k)=>{const seat=k<nearestCount?women[k]:rest[k-nearestCount];if(seat)seats.set(index,seat.variant);});
 const placed=new Map<CrowdVariant,{x:number;z:number;yaw:number;scale:number}[]>();
 for(const [index,variant] of seats){const list=placed.get(variant)??[];list.push(placements[index]);placed.set(variant,list);}
 for(const variant of variants){
  const character=createCharacter(variant.appearance);character.root.updateWorldMatrix(true,true);
  const textured:{mesh:T.Mesh;slot:number}[]=[],plain:T.Mesh[]=[];
  character.root.traverse(node=>{
   if(!(node instanceof T.Mesh))return;
   const material=(Array.isArray(node.material)?node.material[0]:node.material) as T.MeshStandardMaterial;
   const map=material.map;
   if(map instanceof T.DataTexture&&map.image?.data&&map.image.width===96&&map.image.height===16){
    let slot=slotOf.get(map.name);
    if(slot===undefined){slot=atlasSlots.length;slotOf.set(map.name,slot);atlasSlots.push(map);}
    textured.push({mesh:node,slot});
   }else plain.push(node);
  });
  prototypes.push({variant,root:character.root,textured,plain});
 }
 const slotCount=Math.max(1,atlasSlots.length),atlasW=96,atlasH=16*slotCount;
 const atlasData=new Uint8Array(atlasW*atlasH*4);
 atlasSlots.forEach((texture,slot)=>atlasData.set(texture.image.data as Uint8Array,slot*atlasW*16*4));
 const atlas=new T.DataTexture(atlasData,atlasW,atlasH,T.RGBAFormat);
 atlas.name='Sports_hall_crowd_atlas';atlas.colorSpace=T.SRGBColorSpace;atlas.magFilter=atlas.minFilter=T.NearestFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
 const skinMaterial=new T.MeshStandardMaterial({name:'Crowd_atlas',map:atlas,roughness:.9});
 const plainMaterial=new T.MeshStandardMaterial({name:'Crowd_flat',vertexColors:true,roughness:.95});
 // Pass 2: bake every variant once, then instance it across that variant's students.
 const meshes:T.InstancedMesh[]=[],matrix=new T.Matrix4(),quaternion=new T.Quaternion(),up=new T.Vector3(0,1,0),position=new T.Vector3(),scale=new T.Vector3(),color=new T.Color(),tint=new T.Color(),tintRandom=random(90210);
 let triangles=0;
 const bake=(mesh:T.Mesh,remapUv:boolean)=>{
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  for(const name of Object.keys(source.attributes))if(!['position','normal','uv'].includes(name))source.deleteAttribute(name);
  if(!source.getAttribute('normal'))source.computeVertexNormals();
  const uv=source.getAttribute('uv');
  if(remapUv&&uv){const slot=(mesh.userData['atlasSlot'] as number);for(let i=0;i<uv.count;i++)uv.setY(i,(uv.getY(i)+slot)/slotCount);}
  if(!uv)source.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(source.getAttribute('position').count*2),2));
  source.applyMatrix4(mesh.matrixWorld);return source;
 };
 for(const prototype of prototypes){
  const slots=placed.get(prototype.variant)??[];if(!slots.length)continue;
  const groups:[T.Material,T.BufferGeometry[]][]=[[skinMaterial,[]],[plainMaterial,[]]];
  for(const {mesh,slot} of prototype.textured){mesh.userData['atlasSlot']=slot;groups[0][1].push(bake(mesh,true));}
  for(const mesh of prototype.plain){
   const source=bake(mesh,false);
   color.copy(((Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshStandardMaterial).color);
   const count=source.getAttribute('position').count,colors=new Float32Array(count*3);
   for(let i=0;i<count;i++){colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;}
   source.setAttribute('color',new T.Float32BufferAttribute(colors,3));groups[1][1].push(source);
  }
  for(const [material,list] of groups){
   if(!list.length)continue;
   const geometry=list.length===1?list[0]:mergeGeometries(list,false);
   if(!geometry)throw Error('Cannot merge the student crowd');
   if(list.length>1)list.forEach(g=>g.dispose());
   triangles+=geometry.getAttribute('position').count/3*slots.length;
   const mesh=new T.InstancedMesh(geometry,material,slots.length);
   mesh.name=`${CROWD.name}__${prototype.variant.key}__${material===skinMaterial?'skin':'flat'}`;
   mesh.castShadow=true;mesh.receiveShadow=true;
   slots.forEach((p,i)=>{quaternion.setFromAxisAngle(up,p.yaw);position.set(p.x,CROWD.floor,p.z);scale.setScalar(p.scale);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(i,matrix);
    // A small per-student tint keeps identical variants from looking cloned.
    const d=.94+tintRandom()*.11,warm=.98+tintRandom()*.04;tint.setRGB(d*warm,d,(d*(2-warm)));mesh.setColorAt(i,tint);});
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
  }
 }
 for(const prototype of prototypes)prototype.root.removeFromParent();
 return{root,meshes,variants,seatOf:seats,count:placements.length,triangles:Math.round(triangles),atlas:slotCount,atlasInfo:{data:atlasData,width:atlasW,height:atlasH,slots:slotOf,slotCount},dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.removeFromParent();}meshes.length=0;skinMaterial.dispose();plainMaterial.dispose();atlas.dispose();root.removeFromParent();}};
}
