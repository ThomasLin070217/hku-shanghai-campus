import * as T from 'three';
export interface PrimitiveTrace {key:string;name:string;start:number;count:number;bounds:number[];material:string;sourceFile?:string}
/** Authored sibling names, never UUIDs, vertex order or world coordinates. Keep same-name
 * repeat order append-only; use an explicit authorKey when inserting/reordering repeats. */
export function tagChildren(group:T.Group){
 const counts=new Map<string,number>();
 for(const child of group.children){const name=child.name||child.type,n=(counts.get(name)??0)+1;counts.set(name,n);
  if(!child.userData.authorKey)child.userData.authorKey=`${name}#${n}`;
  if(child instanceof T.Mesh&&!child.userData.authorParts){child.geometry.computeBoundingBox();const b=child.geometry.boundingBox!;
   child.userData.authorParts=[{key:child.userData.authorKey,name,start:0,count:child.geometry.index?.count??child.geometry.getAttribute('position').count,bounds:[...b.min.toArray(),...b.max.toArray()],material:(Array.isArray(child.material)?child.material[0]:child.material).name,...(typeof child.userData.sourceFile==='string'?{sourceFile:child.userData.sourceFile}:{})}] satisfies PrimitiveTrace[];
  }
 }
}
export function mergedTraces(meshes:T.Mesh[]){let offset=0;const parts:PrimitiveTrace[]=[];
 for(const mesh of meshes){mesh.updateMatrix();for(const p of mesh.userData.authorParts as PrimitiveTrace[]){const b=new T.Box3(new T.Vector3().fromArray(p.bounds),new T.Vector3().fromArray(p.bounds,3)).applyMatrix4(mesh.matrix);parts.push({...p,start:p.start+offset,bounds:[...b.min.toArray(),...b.max.toArray()]});}offset+=mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count;}
 return parts;
}
