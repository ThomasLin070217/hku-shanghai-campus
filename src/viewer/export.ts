import {prepareModelTextures} from '../model/deferredTextures';
import {restoreGlassRenderState} from '../model/glazing';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Object3D } from 'three';
export async function exportGLB(root:Object3D){
  await prepareModelTextures(root);
  root.updateMatrixWorld(true);
  const result=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
  if(!(result instanceof ArrayBuffer))throw new Error('GLB export did not produce a binary buffer');return result;
}
export function reloadGLB(data:ArrayBuffer){return new GLTFLoader().parseAsync(data,'').then(g=>{restoreGlassRenderState(g.scene);return g;});}
export function download(data:Blob|string,name:string){
  const url=typeof data==='string'?data:URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;a.click();if(typeof data!=='string')setTimeout(()=>URL.revokeObjectURL(url),1000);
}
