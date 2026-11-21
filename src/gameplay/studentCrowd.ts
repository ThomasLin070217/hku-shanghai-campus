import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createStudent} from '../exploration/student';
import {SPORTS_HALL} from '../model/sportsDoor';

/** 100 green-gown students waiting inside the sports hall (client request 2026-11-21).
 * The protagonist rig is reused verbatim, so the crowd matches the player character; the
 * only difference is that every student is baked into per-material instanced meshes, which
 * keeps the whole crowd at one draw call per material instead of ~1 600 meshes. */
export const CROWD={
 count:100,
 id:'sports-hall-students',
 name:'Sports_Hall_Students',
 floor:SPORTS_HALL.floorTop,
 aisle:'centre-aisle-clear',
 yaw:-Math.PI/2, // face east, toward the door the player opens
 sourceFile:'src/gameplay/studentCrowd.ts',
};
/** Deterministic placement: identical on every reload, so review screenshots stay comparable. */
function random(seed:number){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function crowdPlacements(count=CROWD.count,seed=20401121){
 const next=random(seed),cellZ=2.15;
 const x0=SPORTS_HALL.x-SPORTS_HALL.width/2+3.0,x1=SPORTS_HALL.x+SPORTS_HALL.eastX-3.4;
 const z0=-117-SPORTS_HALL.depth/2+2.6,z1=-117+SPORTS_HALL.depth/2-2.6;
 const out:{x:number;z:number;yaw:number;scale:number}[]=[];
 for(let i=0;i<count;i++){
  const row=Math.floor(i/10),col=i%10;
  const x=x0+row*(x1-x0)/Math.max(1,Math.ceil(count/10)-1)+(next()-.5)*.7;
  // Split the file each side of the aisle so the doorway stays walkable.
  const side=col<5?-1:1,slot=col%5;
  const z=side<0?z0+slot*cellZ+((next()-.5)*.35):z1-(4-slot)*cellZ+((next()-.5)*.35);
  out.push({x,z,yaw:CROWD.yaw+(next()-.5)*.42,scale:.93+next()*.13});
 }
 return out;
}
export function createStudentCrowd(placements=crowdPlacements()){
 const prototype=createStudent(),root=new T.Group();
 root.name=CROWD.name;root.userData={sourceFile:CROWD.sourceFile,source:'2026-11-21 client request: 100 green-gown students inside the sports hall',confidence:'fictional-gameplay-addition_not-observed',label:'体育馆内的学生',count:placements.length};
 prototype.root.updateWorldMatrix(true,true);
 // Bake the rest pose once, grouped by material: identical materials stay shared with the rig.
 const buckets=new Map<T.Material,T.BufferGeometry[]>();
 prototype.root.traverse(node=>{
  if(!(node instanceof T.Mesh))return;
  const materials=Array.isArray(node.material)?node.material:[node.material];
  for(const material of materials){
   const source=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
   for(const name of Object.keys(source.attributes))if(!['position','normal','uv'].includes(name))source.deleteAttribute(name);
   if(!source.getAttribute('normal'))source.computeVertexNormals();
   if(!source.getAttribute('uv'))source.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(source.getAttribute('position').count*2),2));
   source.applyMatrix4(node.matrixWorld);
   const list=buckets.get(material)??[];list.push(source);buckets.set(material,list);
  }
 });
 const meshes:T.InstancedMesh[]=[],matrix=new T.Matrix4(),quaternion=new T.Quaternion(),up=new T.Vector3(0,1,0),position=new T.Vector3(),scale=new T.Vector3();
 let triangles=0;
 for(const [material,list] of buckets){
  const geometry=list.length===1?list[0]:mergeGeometries(list,false);
  if(!geometry)throw Error('Cannot merge the student crowd');
  if(list.length>1)list.forEach(g=>g.dispose());
  triangles+=geometry.getAttribute('position').count/3;
  const mesh=new T.InstancedMesh(geometry,material,placements.length);
  mesh.name=`${CROWD.name}__${material.name||material.uuid.slice(0,6)}`;
  mesh.castShadow=true;mesh.receiveShadow=true;
  placements.forEach((p,i)=>{quaternion.setFromAxisAngle(up,p.yaw);position.set(p.x,CROWD.floor,p.z);scale.setScalar(p.scale);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(i,matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
 }
 return{root,meshes,count:placements.length,triangles:Math.round(triangles*placements.length),dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.removeFromParent();}meshes.length=0;root.removeFromParent();}};
}
