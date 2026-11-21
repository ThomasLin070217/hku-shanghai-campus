import * as T from 'three';
import type {PrimitiveTrace} from './authoring';
export const SCENE_SCHEMA='hku-scene/1';
export type EntityKind='campus'|'building'|'road'|'area'|'group'|'part';
export interface SceneEntity {id:string;name:string;kind:EntityKind;parentId:string|null;buildingId:string|null;authorKey:string;bounds:{min:number[];max:number[]};center:number[];size:number[];sourceFile:string;sourceAnchor:string;reference:string;confidence:string;material?:string;editMode:'source';}
export interface EntityQuery {q?:string;kind?:EntityKind;parentId?:string;offset?:number;limit?:number;near?:number[];radius?:number}
// A012 alias is reserved for the retired B04/B05 corridor; never reuse its ID.
const aliases:Record<string,[string,string,string]>={
 U08_Perimeter_and_lawn_lights:['A015','外围绿化与 HKU 草坪地灯','src/model/videoFollowup.ts'],
 Ground:['A001','校园地面','src/model/buildSite.ts'],Roads_and_Paving:['A002','道路与铺装','src/model/buildSite.ts'],Landscape:['A003','基础绿化','src/model/buildSite.ts'],
 Sunken_Plaza_and_Ramp:['A004','下沉庭院','src/model/buildSite.ts'],Auditorium_Grand_Stair:['A005','礼堂大阶梯','src/model/buildSite.ts'],Oculus_Pavilion:['A006','圆形天窗连廊','src/model/buildSite.ts'],
 CDS1_Entrance_Forecourt:['A007','CDS-1 入口广场','src/model/buildSite.ts'],CDS_Landscape_Monument:['S001','计算与数据科学学院石牌','src/model/videoDetails.ts'],CDS_Monument_Lettering:['S001-TEXT','学院石牌黑字与校徽','src/model/monumentFace.ts'],
 'entrance-lion':['L001','入口狮子与底座','src/model/nov13Details.ts'],Reference_planting_layers:['L002','实景补充绿化','src/model/landscapeDetails.ts'],
 Video_Observed_Exterior_Details:['A008','视频确认的室外细节','src/model/videoDetails.ts'],Nov13_Observed_Corrections:['A009','11月13日实景细节','src/model/nov13Details.ts'],U06_Daylight_Details:['A010','11月14日实景细节','src/model/nov14Details.ts'],
 U06_Curved_courtyard:['A011','庭院双弧楼梯与玻璃围护','src/model/courtyard.ts'],B04_B05_Observed_Connection:['A012','4号楼—5号楼连接体','src/model/nov14Details.ts'],Exploration_boundary:['A013','探索边界','src/model/buildSite.ts'],Sports:['A014','北侧运动区','src/model/buildSite.ts'],Curved_East_Walk:['A016','东侧弧形步道','src/model/axisGarden.ts'],
};
const buildingGroups:Record<string,[string,string]>={'01_MainBody':['BODY','主体'],'02_Glass':['GLASS','玻璃'],'03_Columns_and_Fins':['FRAME','立柱与竖框'],'03_Columns_and_Frames':['FRAME','立柱与框架'],'04_FloorBands':['BANDS','楼层分隔'],'05_Entrance':['ENTRY','入口'],'06_Canopy':['CANOPY','雨棚'],'07_Roof':['ROOF','屋顶'],'08_Signage':['SIGN','标识']};
export function stableHash(value:string){let a=2166136261,b=0x9e3779b9;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b^value.charCodeAt(i),2246822519);}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0').slice(0,4);}
const round=(n:number)=>Math.round(n*10000)/10000;
const caches=new WeakMap<T.Object3D,SceneRegistry>();
export class SceneRegistry {
 readonly entities:SceneEntity[]=[];readonly byId=new Map<string,SceneEntity>();readonly nodes=new Map<string,T.Object3D>();readonly ranges=new WeakMap<T.Object3D,{id:string;start:number;count:number}[]>();readonly revision:string;
 constructor(readonly root:T.Object3D){
  root.updateWorldMatrix(true,true);
  const add=(node:T.Object3D,id:string,name:string,kind:EntityKind,parentId:string|null,buildingId:string|null,key:string,box:T.Box3,file:string,anchor:string,material?:string)=>{
   if(this.byId.has(id))throw Error('Duplicate scene ID: '+id);
   let ref='',confidence='estimated; see source';for(let p:T.Object3D|null=node;p;p=p.parent){if(!ref&&typeof p.userData.source==='string')ref=p.userData.source;if(typeof p.userData.confidence==='string'){confidence=p.userData.confidence;break;}}
   const e:SceneEntity={id,name,kind,parentId,buildingId,authorKey:key,bounds:{min:box.min.toArray().map(round),max:box.max.toArray().map(round)},center:box.getCenter(new T.Vector3()).toArray().map(round),size:box.getSize(new T.Vector3()).toArray().map(round),sourceFile:file,sourceAnchor:anchor,reference:ref||'references/CAMPUS_BASIS.md',confidence,editMode:'source',...(material?{material}: {})};this.entities.push(e);this.byId.set(id,e);this.nodes.set(id,node);return e;
  };
  const visit=(node:T.Object3D,parentId:string|null,path:string,building:string|null,file:string,scope:string)=>{
   // Animated gameplay props have their own stable interaction IDs, outside the static geometry revision.
   if(node.userData.dynamicGameplay===true)return;
   const isBuilding=/^B0[1-7]$/.test(node.name);if(isBuilding){building=node.name;scope=node.name;file=node.userData.kind==='bandTower'?'src/model/buildCampus.ts':'src/model/buildSite.ts';}
   const key=path+'/'+(isBuilding?node.name:node.userData.authorKey||node.name||node.type);
   const alias=aliases[node.name],bg=building?buildingGroups[node.name]:undefined;
   if(alias)file=alias[2];if(typeof node.userData.sourceFile==='string')file=node.userData.sourceFile;
   if(node instanceof T.Mesh){
    const traces=node.userData.authorParts as (PrimitiveTrace&{entityId?:string})[]|undefined;
    if(!traces)throw Error('Unindexed scene mesh: '+node.name);
    const ranges:{id:string;start:number;count:number}[]=[];
    for(const part of traces){const pkey=path+'/'+part.key,id=part.entityId||`${scope}-P-${stableHash(pkey)}`;part.entityId=id;
     const box=new T.Box3(new T.Vector3().fromArray(part.bounds),new T.Vector3().fromArray(part.bounds,3)).applyMatrix4(node.matrixWorld);
     add(node,id,part.name,'part',parentId,building,pkey,box,part.sourceFile||file,part.name,part.material);ranges.push({id,start:part.start,count:part.count});
    }this.ranges.set(node,ranges);return;
   }
   let id=node.userData.sceneId as string|undefined;
   if(!id)id=node===root?'CAMPUS':isBuilding?node.name:alias?alias[0]:bg?`${building}-${bg[0]}`:`${scope}-G-${stableHash(key)}`;
   node.userData.sceneId=id;
   const bounds=new T.Box3().setFromObject(node);if(bounds.isEmpty())return;
   const kind:EntityKind=node===root?'campus':isBuilding?'building':/^R\d+$/.test(id)?'road':alias?'area':'group';
   const name=node.userData.label||alias?.[1]||(bg?`${building} ${bg[1]}`:node.name);
   add(node,id,name,kind,parentId,building,key,bounds,file,node.name);
   if(kind==='road'||kind==='area')scope=id;
   for(const child of node.children)visit(child,id,key,building,file,scope);
  };
  visit(root,null,'',null,'src/model/buildSite.ts','SITE');
  this.entities.sort((a,b)=>a.id.localeCompare(b.id));this.revision=stableHash(JSON.stringify(this.entities.map(e=>[e.id,e.bounds])));root.userData.sceneSchema=SCENE_SCHEMA;root.userData.sceneRevision=this.revision;
 }
 get(id:string){return this.byId.get(id);}
 query(q:EntityQuery={}){const text=(q.q??'').toLowerCase(),offset=q.offset??0,limit=q.limit??30;
  let all=this.entities.filter(e=>(!q.kind||e.kind===q.kind)&&(!q.parentId||e.parentId===q.parentId)&&(!text||[e.id,e.name,e.sourceAnchor,e.sourceFile].some(s=>s.toLowerCase().includes(text))));
  if(q.near){const p=new T.Vector3().fromArray(q.near),distance=(e:SceneEntity)=>new T.Box3(new T.Vector3().fromArray(e.bounds.min),new T.Vector3().fromArray(e.bounds.max)).distanceToPoint(p);all=all.filter(e=>distance(e)<=(q.radius??30)).sort((a,b)=>distance(a)-distance(b));}
  return{schema:SCENE_SCHEMA,revision:this.revision,total:all.length,offset,limit,items:all.slice(offset,offset+limit)};
 }
 pick(hit:T.Intersection){const n=(hit.faceIndex??0)*3;return this.ranges.get(hit.object)?.find(r=>n>=r.start&&n<r.start+r.count)?.id;}
 json(){return{schema:SCENE_SCHEMA,revision:this.revision,units:'metres',axes:'+X east-ish, -Z north-ish, +Y up; not georeferenced',entities:this.entities};}
}
export function sceneRegistry(root:T.Object3D){let r=caches.get(root);if(!r){r=new SceneRegistry(root);caches.set(root,r);}return r;}
export function validEntityQuery(value:unknown):value is EntityQuery{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const q=value as EntityQuery;
 if(Object.keys(q).some(k=>!['q','kind','parentId','offset','limit','near','radius'].includes(k)))return false;
 if(q.q!==undefined&&(typeof q.q!=='string'||q.q.length>160)||q.parentId!==undefined&&(typeof q.parentId!=='string'||q.parentId.length>100))return false;
 if(q.kind!==undefined&&!['campus','building','road','area','group','part'].includes(q.kind))return false;
 if(q.offset!==undefined&&(!Number.isInteger(q.offset)||q.offset<0)||q.limit!==undefined&&(!Number.isInteger(q.limit)||q.limit<1||q.limit>100))return false;
 if(q.near!==undefined&&(!Array.isArray(q.near)||q.near.length!==3||!q.near.every(Number.isFinite)))return false;
 return q.radius===undefined||Number.isFinite(q.radius)&&q.radius>=0&&q.radius<=500;
}
