import * as T from 'three';
import {tagChildren,type PrimitiveTrace} from '../scene/authoring';
import {OPENING,B4_LIFT as L6,B6_HALL} from './spatialLayout';
import {LIFT_LANDING} from './lift';
import {B4_OFFICE} from './b4Office';
import {buildB4Shell} from './b4Shell';
type V={p:T.Vector3;n:T.Vector3;uv:T.Vector2};
function split(poly:V[],axis:'x'|'y'|'z',value:number,above:boolean){
 const yes:V[]=[],no:V[]=[];if(!poly.length)return[yes,no];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-value)*(above?1:-1),db=(b.p[axis]-value)*(above?1:-1),inside=da>=-1e-8;
  (inside?yes:no).push(a);if((da>1e-8&&db< -1e-8)||(da< -1e-8&&db>1e-8)){const t=da/(da-db),v={p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t),uv:a.uv.clone().lerp(b.uv,t)};yes.push(v);no.push(v);}}
 return[yes,no];
}
function subtract(poly:V[],box:T.Box3){let inside=poly;const result:V[][]=[];
 for(const [axis,value,above]of [['x',box.min.x,true],['x',box.max.x,false],['y',box.min.y,true],['y',box.max.y,false],['z',box.min.z,true],['z',box.max.z,false]] as const){const [keep,out]=split(inside,axis,value,above);if(out.length>=3)result.push(out);inside=keep;if(inside.length<3)break;}
 return result;
}
/** Cut scenic core/backings before compact(). Existing author keys survive; removed parts are reported by scene migration check. */
export function cutOpeningBuildings(root:T.Group){
 function tag(o:T.Object3D){if(o instanceof T.Group)tagChildren(o);for(const c of o.children)tag(c);}tag(root);root.updateMatrixWorld(true);
 for(const room of [OPENING.b4,OPENING.b5,OPENING.b6]){
  const building=root.getObjectByName(room.id);if(!building)continue;
  const boxes=[new T.Box3(new T.Vector3(room.x0+.01,room.floor+.015,room.z0+.12),new T.Vector3(room.x1-.01,room.floor+room.clearHeight,room.z1-.24)),new T.Box3(new T.Vector3(room.door-room.doorWidth/2,room.floor-.02,room.z1-3.3),new T.Vector3(room.door+room.doorWidth/2,room.floor+room.doorHeight,room.z1+('doorDepth' in room?room.doorDepth:.9)))];
  // Building 6: above the ground hall the tower is hollow only for the lift shaft and
  // the 5F landing/office. Cut both, or the car and the office would sit inside solid
  // tower after the ground cavity ends at the hall ceiling.
  if(room.id===OPENING.b6.id){
   const W=B6_HALL,s0=L6.x0-W.shaft.wall,s1=L6.x1+W.shaft.wall,t0=L6.z0-W.shaft.wall,t1=L6.z1+W.shaft.wall;
   boxes.push(new T.Box3(new T.Vector3(s0,room.floor,t0),new T.Vector3(s1,L6.landing+L6.clearHeight,t1)));
   boxes.push(new T.Box3(new T.Vector3(L6.x1,room.floor,B4_OFFICE.interior.z0-B4_OFFICE.wall),new T.Vector3(room.x1,LIFT_LANDING.ceilBottom+L6.wall,B4_OFFICE.interior.z1+B4_OFFICE.wall)));
  }
  const meshes:T.Mesh[]=[];building.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
  for(const mesh of meshes){const old=mesh.geometry;old.computeBoundingBox();const bounds=old.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);if(!boxes.some(b=>b.intersectsBox(bounds)))continue;
   const g=old.index?old.toNonIndexed():old.clone(),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),positions:number[]=[],normals:number[]=[],uvs:number[]=[],inverse=mesh.matrixWorld.clone().invert();
   // Merged meshes carry many authored parts; keep each part that survives the cut (ranges follow triangle order).
   const traces=(mesh.userData.authorParts as PrimitiveTrace[]|undefined)?.slice().sort((a,b)=>a.start-b.start),starts=new Map<number,number>(),counts=new Map<number,number>();let ti=0;
   for(let i=0;i<p.count;i+=3){const before=positions.length/3;let polygons:V[][]=[Array.from({length:3},(_,k)=>({p:new T.Vector3().fromBufferAttribute(p,i+k).applyMatrix4(mesh.matrixWorld),n:n?new T.Vector3().fromBufferAttribute(n,i+k):new T.Vector3(0,1,0),uv:uv?new T.Vector2(uv.getX(i+k),uv.getY(i+k)):new T.Vector2()}))];
    for(const box of boxes)polygons=polygons.flatMap(poly=>subtract(poly,box));
    for(const poly of polygons)for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){positions.push(...v.p.clone().applyMatrix4(inverse).toArray());normals.push(...v.n.clone().normalize().toArray());uvs.push(...v.uv.toArray());}
    const added=positions.length/3-before;if(traces&&added){while(ti<traces.length&&i>=traces[ti].start+traces[ti].count)ti++;if(ti<traces.length&&i>=traces[ti].start){if(!starts.has(ti))starts.set(ti,before);counts.set(ti,(counts.get(ti)??0)+added);}}}
   g.dispose();if(!positions.length){mesh.removeFromParent();old.dispose();continue;}
   const clipped=new T.BufferGeometry();clipped.setAttribute('position',new T.Float32BufferAttribute(positions,3));clipped.setAttribute('normal',new T.Float32BufferAttribute(normals,3));clipped.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));clipped.computeBoundingBox();clipped.computeBoundingSphere();mesh.geometry=clipped;old.dispose();const kept=traces?.flatMap((t,j)=>counts.get(j)?[{...t,start:starts.get(j)!,count:counts.get(j)!}]:[]);if(kept?.length)mesh.userData.authorParts=kept;else delete mesh.userData.authorParts;mesh.userData.sourceFile='src/opening/geometry.ts';mesh.userData.openingAperture=true;
  }
 }
 // B04's cut cavity is capped by the static room shell (floor, walls, ceiling, closed
 // entrance door) in every opening build, so Chapter 1 never shows a hollow tower.
 const b04=root.getObjectByName(OPENING.b4.id);
 if(b04){const shell=buildB4Shell();b04.updateMatrixWorld(true);shell.applyMatrix4(b04.matrixWorld.clone().invert());b04.add(shell);tag(shell);}
}
