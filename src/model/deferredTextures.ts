import * as T from 'three';

// Keep loader state out of userData: GLB extras must remain serializable.
const pending = new WeakMap<T.Texture, () => Promise<void>>();
let inFlightLoads = 0;
export function deferredTexture(load:()=>Promise<{data:Uint8Array;width:number;height:number}>) {
 const texture=new T.DataTexture(new Uint8Array([182,188,174,255]),1,1,T.RGBAFormat);
 let disposed=false,reallocating=false,ready=false,inFlight:Promise<void>|undefined;
 texture.addEventListener('dispose',()=>{if(!reallocating){disposed=true;pending.delete(texture);}});
 const ensure=()=>{
  if(disposed||ready)return Promise.resolve();
  if(!inFlight){inFlightLoads++;inFlight=load().then(image=>{if(!disposed){
   // WebGL2 immutable storage cannot grow from the uploaded 1×1 placeholder.
   // Release GPU storage without cancelling this loader, then upload at its real size.
   if(texture.image.width!==image.width||texture.image.height!==image.height){reallocating=true;try{texture.dispose();}finally{reallocating=false;}}
   texture.image=image;texture.needsUpdate=true;ready=true;
  }}).finally(()=>{inFlightLoads--;inFlight=undefined;});}
  return inFlight;
 };
 pending.set(texture,ensure);texture.needsUpdate=true;
 return texture;
}
/** Both browser and CLI exports await all deferred images used by this asset. */
const prepared = new WeakMap<T.Object3D, Promise<void>>();
export function prepareModelTextures(root:T.Object3D){
 // Startup and the export button can request the same tree; reuse the in-flight pass
 // instead of walking every material twice.
 const running = prepared.get(root);
 if (running) return running;
 const jobs = new Set<() => Promise<void>>();
 root.traverse(o => {
  const material = (o as T.Mesh).material;
  if (!material) return;
  for (const m of Array.isArray(material) ? material : [material]) for (const value of Object.values(m)) if (value instanceof T.Texture) { const ensure = pending.get(value); if (ensure) jobs.add(ensure); }
 });
 const pass = Promise.all([...jobs].map(ensure => ensure())).then(() => { prepared.delete(root); }, error => { prepared.delete(root); throw error; });
 prepared.set(root, pass);
 return pass;
}
/** Diagnostics only: how many deferred reference images are decoding right now. */
export function deferredTextureStats(){return {inFlight:inFlightLoads};}
