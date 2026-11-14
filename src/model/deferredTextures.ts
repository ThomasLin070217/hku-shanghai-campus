import * as T from 'three';

// Keep loader state out of userData: GLB extras must remain serializable.
const pending = new WeakMap<T.Texture, () => Promise<void>>();
export function deferredTexture(load:()=>Promise<{data:Uint8Array;width:number;height:number}>) {
 const texture=new T.DataTexture(new Uint8Array([182,188,174,255]),1,1,T.RGBAFormat);
 let disposed=false,reallocating=false,ready=false,inFlight:Promise<void>|undefined;
 texture.addEventListener('dispose',()=>{if(!reallocating){disposed=true;pending.delete(texture);}});
 const ensure=()=>{
  if(disposed||ready)return Promise.resolve();
  if(!inFlight)inFlight=load().then(image=>{if(!disposed){
   // WebGL2 immutable storage cannot grow from the uploaded 1×1 placeholder.
   // Release GPU storage without cancelling this loader, then upload at its real size.
   if(texture.image.width!==image.width||texture.image.height!==image.height){reallocating=true;try{texture.dispose();}finally{reallocating=false;}}
   texture.image=image;texture.needsUpdate=true;ready=true;
  }}).finally(()=>{inFlight=undefined;});
  return inFlight;
 };
 pending.set(texture,ensure);texture.needsUpdate=true;
 return texture;
}
/** Both browser and CLI exports await all deferred images used by this asset. */
export async function prepareModelTextures(root:T.Object3D){
 const jobs=new Set<()=>Promise<void>>();
 root.traverse(o=>{const material=(o as T.Mesh).material;if(!material)return;for(const m of Array.isArray(material)?material:[material])for(const value of Object.values(m))if(value instanceof T.Texture){const ensure=pending.get(value);if(ensure)jobs.add(ensure);}});
 await Promise.all([...jobs].map(ensure=>ensure()));
}
