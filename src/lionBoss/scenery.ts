import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {NOV13} from '../model/nov13Parameters';

/** From the lawn the curved courtyard is a narrow strip in the distance. Draw its
 * glass in short arcs; up close restore the individual, globally sorted panes. */
function batchDistantCourtyard(root:T.Object3D) {
  const plaza=root.getObjectByName('Sunken_Plaza_and_Ramp');
  if(!plaza) return;
  const bounds=new T.Box3().setFromObject(plaza);
  const middle=bounds.getCenter(new T.Vector3());
  const toPlaza=plaza.matrixWorld.clone().invert();
  const sectors=new Map<string,T.Mesh[]>();
  plaza.traverseVisible(object=>{
    if(!(object instanceof T.Mesh) || object.geometry.type!=='PlaneGeometry' ||
       object.geometry.index?.count!==6 || object.material.userData?.surfaceRole!=='glass') return;
    const position=new T.Vector3().setFromMatrixPosition(object.matrixWorld);
    const angle=Math.atan2(position.z-middle.z,position.x-middle.x);
    const key=object.material.id+':'+Math.floor(angle/(Math.PI/4));
    const list=sectors.get(key);
    if(list) list.push(object);
    else sectors.set(key,[object]);
  });
  const arcs:Array<{
    mesh:T.Mesh;panes:T.Mesh[];order:Array<{offset:number;position:T.Vector3}>;
    index:T.BufferAttribute;original:T.TypedArray;
  }>=[];
  for(const panes of sectors.values()) {
    if(panes.length<2) continue;
    const parts=panes.map(pane=>pane.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(toPlaza,pane.matrixWorld)));
    const geometry=mergeGeometries(parts,false);
    for(const part of parts) part.dispose();
    if(!geometry?.index) continue;
    const index=geometry.index;
    const original=index.array.slice();
    index.setUsage(T.DynamicDrawUsage);
    geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,panes[0].material);
    mesh.name='Distant courtyard glass';
    mesh.visible=false;
    plaza.add(mesh);
    const order=panes.map((pane,i)=>({offset:i*6,position:new T.Vector3().setFromMatrixPosition(pane.matrixWorld)}));
    arcs.push({mesh,panes,order,index,original});
  }
  const position=new T.Vector3(),backward=new T.Vector3(),lastAxis=new T.Vector3();
  let distant=false;
  return {
    update(camera:T.Camera) {
      position.setFromMatrixPosition(camera.matrixWorld);
      const far=bounds.distanceToPoint(position)>(distant?16:20);
      if(far!==distant) {
        distant=far;
        for(const arc of arcs) {
          arc.mesh.visible=far;
          for(const pane of arc.panes) pane.visible=!far;
        }
      }
      if(!far) return;
      // Only view direction affects relative depth. Merely walking leaves the index intact.
      backward.setFromMatrixColumn(camera.matrixWorld,2).normalize();
      if(lastAxis.dot(backward)>.99999) return;
      lastAxis.copy(backward);
      for(const arc of arcs) {
        arc.order.sort((a,b)=>a.position.dot(backward)-b.position.dot(backward)||a.offset-b.offset);
        arc.order.forEach((pane,i)=>{
          for(let j=0;j<6;j++) arc.index.array[i*6+j]=arc.original[pane.offset+j];
        });
        arc.index.needsUpdate=true;
      }
    },
    dispose() {
      for(const arc of arcs) {
        arc.mesh.removeFromParent();
        arc.mesh.geometry.dispose();
        for(const pane of arc.panes) pane.visible=true;
      }
    },
  };
}

/** Draw static opaque surfaces together within each building or landscape feature.
 * Keep the authored objects in place for lookup, shared resource ownership and teardown. */
export function batchLawnScenery(root:T.Object3D) {
  root.updateMatrixWorld(true);
  const originals:T.Mesh[]=[];
  const batches:T.Mesh[]=[];
  const keys=new Map<T.Material,string>();
  const meta:T.JSONMeta={textures:{},images:{},geometries:{},materials:{},shapes:{},skeletons:{},animations:{},nodes:{}};
  function materialKey(material:T.MeshStandardMaterial) {
    let key=keys.get(material);
    if(key===undefined) {
      // Buildings have independently authored instances of the same finish.
      // Retain the complete render settings and texture IDs, across duplicate materials.
      const {name,uuid,metadata,userData,...settings}=material.toJSON(meta);
      key=JSON.stringify(settings);
      keys.set(material,key);
    }
    return key;
  }

  for(const layer of root.children) for(const region of layer.children) {
    if(!(region instanceof T.Group)) continue;
    const toRegion=region.matrixWorld.clone().invert();
    const buckets=new Map<string,T.Mesh[]>();
    function collect(object:T.Object3D) {
      if(!object.visible || object.name===NOV13.lion.id || object.userData.dynamicGameplay) return;
      if(object.type==='Mesh' && object instanceof T.Mesh) {
        const {geometry,material}=object;
        if(material.type==='MeshStandardMaterial' && material.visible && !material.transparent &&
          geometry.drawRange.start===0 && geometry.drawRange.count===Infinity && object.matrixWorld.determinant()>0) {
          const key=JSON.stringify([materialKey(material),object.castShadow,object.receiveShadow,
            object.renderOrder,object.layers.mask,Object.keys(geometry.attributes).sort()]);
          const list=buckets.get(key);
          if(list) list.push(object);
          else buckets.set(key,[object]);
        }
      }
      for(const child of object.children) collect(child);
    }
    collect(region);
    for(const meshes of buckets.values()) {
      if(meshes.length<2) continue;
      const parts=meshes.map(mesh=>{
        const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
        return geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(toRegion,mesh.matrixWorld));
      });
      const geometry=mergeGeometries(parts,false);
      for(const part of parts) part.dispose();
      if(!geometry) continue;
      const first=meshes[0];
      const batch=new T.Mesh(geometry,first.material);
      batch.name=region.name+' — static surfaces';
      batch.castShadow=first.castShadow;
      batch.receiveShadow=first.receiveShadow;
      batch.renderOrder=first.renderOrder;
      batch.layers.mask=first.layers.mask;
      geometry.computeBoundingSphere();
      region.add(batch);
      for(const source of meshes) source.visible=false;
      originals.push(...meshes);
      batches.push(batch);
    }
  }
  const courtyard=batchDistantCourtyard(root);
  return {
    update(camera:T.Camera) {courtyard?.update(camera);},
    dispose() {
      courtyard?.dispose();
      for(const mesh of originals) mesh.visible=true;
      for(const batch of batches) {
        batch.removeFromParent();
        batch.geometry.dispose();
      }
    },
  };
}
