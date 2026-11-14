import * as T from 'three';
/** One local, low-resolution reflection probe of the actual scene per lighting/build change.
 * No per-frame cube render, no external HDR asset. Reflections are approximate, not planar mirrors. */
export function createGlassEnvironment(renderer:T.WebGLRenderer,scene:T.Scene){
 let lastRoot:T.Object3D|undefined,lastNight:boolean|undefined,target:T.WebGLRenderTarget|undefined;
 const pmrem=new T.PMREMGenerator(renderer);
 function refresh(root:T.Object3D,night:boolean){
  if(renderer.getContext().isContextLost()||root===lastRoot&&night===lastNight)return;
  const materials=new Set<T.MeshStandardMaterial>(),hidden:{object:T.Mesh;visible:boolean}[]=[];
  scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.some(m=>m.userData.surfaceRole==='glass')){hidden.push({object:o,visible:o.visible});o.visible=false;}});
  root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.userData.surfaceRole==='glass')materials.add(m);});
  const cube=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType}),camera=new T.CubeCamera(.2,500,cube);camera.position.set(0,8,0);
  try{camera.update(renderer,scene);const next=pmrem.fromCubemap(cube.texture);for(const m of materials){m.envMap=next.texture;m.needsUpdate=true;}target?.dispose();target=next;lastRoot=root;lastNight=night;}
  finally{hidden.forEach(({object,visible})=>object.visible=visible);cube.dispose();}
 }
 return {refresh,invalidate(){lastRoot=undefined;lastNight=undefined;},dispose(){target?.dispose();target=undefined;lastRoot=undefined;lastNight=undefined;pmrem.dispose();}};
}
