import * as T from 'three';
import type {BuildingSpec,SiteParameters} from './campusParameters';
import {LANDSCAPE as L} from '../exploration/config';
/** Observed planting zones, not survey coordinates. No random scattering. */
export interface PlantBed{id:string;x:number;z:number;w:number;d:number;y:number;kerb:number;shrub:number;source:string}
export interface PlantTree{id:string;x:number;z:number;y:number;height:number;crown:number;source:string}
export function landscapeLayout(specs:BuildingSpec[],site:SiteParameters){
 const beds:PlantBed[]=[],trees:PlantTree[]=[];
 // A03 + U04 01:21/02:12: planting outside the sunken courtyard; preserve east ramp gate z=22..30.
 // U06 replaces disconnected plaza beds with a continuous curved low hedge.

 // U05 00:00/00:07/00:14: open lion lawn, perimeter shrubs only.
 for(const side of [-1,1])for(const z of [60,85]){beds.push({id:`lawn-edge-${side}-${z}`,x:side*12.7,z,w:2.2,d:5.0,y:.13,kerb:0,shrub:.42,source:'U04 00:34; U05 00:07/00:14'});trees.push({id:`lawn-tree-${side}-${z}`,x:side*12.7,z,y:.13,height:z===60?5.7:5.0,crown:z===60?2.8:2.4,source:'U04 00:34 / 01:21; sparse young tree type, exact placement estimated'});}
 const b=specs.find(b=>b.id==='B04')!,angle=b.rotation*Math.PI/180;
 const local=(x:number,z:number)=>({x:b.x+Math.cos(angle)*x+Math.sin(angle)*z,z:b.z-Math.sin(angle)*x+Math.cos(angle)*z});
 for(const sign of [-1,1]){const p=local(sign*L.entranceBedOffset,b.depth/2+L.entranceBedZ);beds.push({id:`entry-layer-${sign}`, ...p,w:L.entranceBedWidth-.5,d:L.entranceBedDepth-.5,y:L.entranceBedHeight+.06,kerb:0,shrub:.75,source:'R01 official entrance: mixed low groundcover, rounded shrubs; use existing bed boundary'});}
 return{beds,trees};
}
export function addLandscapeDetails(parent:T.Group,specs:BuildingSpec[],site:SiteParameters){
 const layout=landscapeLayout(specs,site),root=new T.Group();root.name='Reference_planting_layers';root.userData={source:'references/experience-fix/REFERENCES.md',zones:layout,boundary:'visible zones; dimensions and spacing estimated'};parent.add(root);
 const mat=(name:string,color:number)=>{const m=new T.MeshStandardMaterial({name,color,roughness:1});m.userData.keepColor=true;return m;};
 const leaves=[mat('Plant foliage deep',0x365d32),mat('Plant foliage olive',0x637b3d),mat('Plant foliage fresh',0x82a34b)],bark=mat('Plant bark',0x746655),soil=mat('Plant soil',0x484b34),kerb=mat('Plant limestone kerb',0xb6b9a7),blades=mat('Plant foliage groundcover',0x9caa64);
 const block=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const shrub=(x:number,y:number,z:number,w:number,h:number,d:number,tone:number)=>{for(const [sx,sy,sz,cy]of [[1,.45,1,.225],[.83,.40,.82,.60],[.54,.25,.57,.89]])block('Layered_block_shrub',w*sx,h*sy,d*sz,x,y+h*cy,z,leaves[tone%3]);};
 for(const bed of layout.beds){const {x,z,w,d,y}=bed;
  if(bed.kerb){block('Raised_bed_soil',w,.1,d,x,y+.05,z,soil);for(const side of [-1,1]){block('Bed_edge',w,bed.kerb,.10,x,y+bed.kerb/2,z+side*d/2,kerb);block('Bed_edge',.10,bed.kerb,d,x+side*w/2,y+bed.kerb/2,z,kerb);}}
  const alongX=w>d,length=alongX?w:d,count=Math.max(3,Math.floor(length/1.3));
  const entry=bed.id.startsWith('entry-layer');
  for(let i=0;i<count;i++){
   const offset=(i+.5)/count*length-length/2;
   const sway=entry?[.15,-.62,0,.58][i%4]:(i%2?-.45:.45);
   const px=x+(alongX?offset:(i%2?-.22:.22)),pz=z+(alongX?sway:offset);
   const width=entry?[1.28,1.04,1.38,.90][i%4]:[1.25,1.04,1.16][i%3];
   const height=bed.shrub*(entry?[.88,1.02,.67,.72][i%4]:[.82,1.0,.73][i%3]);
   shrub(px,y+(bed.kerb?.1:0),pz,width,height,width*.87,i);
  }
  // Low edge groundcover, separated from the taller middle shrubs.
  for(let i=0;i<count*2;i++){const offset=(i+.5)/(count*2)*length-length/2;for(const side of [-1,1])block('Low_groundcover',alongX?.42:.38,.12,alongX?.38:.42,x+(alongX?offset:side*(w/2-.3)),y+(bed.kerb?.1:0)+.06,z+(alongX?side*(d/2-.35):offset),blades);}
 }
 for(const tree of layout.trees){const {x,z,y,height:h,crown:c}=tree;block('Young_tree_trunk',.18,h*.78,.18,x,y+h*.39,z,bark);
  for(const [dx,dz,f]of [[-.45,.15,.73],[.40,-.18,.86],[.12,.40,.97],[-.15,-.35,.9]]){const a=new T.Vector3(x,y+h*.4,z),b=new T.Vector3(x+dx*c,y+h*f,z+dz*c),v=b.clone().sub(a);const branch=block('Young_tree_branch',.08,v.length(),.08,0,0,0,bark);branch.position.copy(a).add(b).multiplyScalar(.5);branch.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());shrub(b.x,b.y-.25,b.z,c*.32,.5,c*.30,Math.round(f*10));}
 }
 return root;
}
