import {deferredTexture} from './deferredTextures';
const url=new URL('../../assets/nov14/cds-monument-runtime.png',import.meta.url);
export const SIGN_PHOTO_SOURCE='U06 IMG_4347.MOV 02:55; panel-only perspective crop; no measurements';
let pixels:Promise<{data:Uint8Array;width:number;height:number}>|undefined;
async function decode(){
 if(typeof document==='undefined'){
  // Node-only CLI dependency; deliberately excluded from the browser module graph.
  const fsName='node:fs/promises',canvasName='@napi-rs/canvas';
  const fs=await import(/* @vite-ignore */ fsName),canvas=await import(/* @vite-ignore */ canvasName);
  const image=await canvas.loadImage(await fs.readFile(url)),c=canvas.createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
  return{data:new Uint8Array(ctx.getImageData(0,0,image.width,image.height).data),width:image.width,height:image.height};
 }
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
 let bitmap:ImageBitmap|undefined;
 try{
  const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('招牌贴图加载失败：HTTP '+response.status);
  bitmap=await createImageBitmap(await response.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法读取招牌贴图');ctx.drawImage(bitmap,0,0);
  return{data:new Uint8Array(ctx.getImageData(0,0,canvas.width,canvas.height).data),width:canvas.width,height:canvas.height};
 }finally{clearTimeout(timer);bitmap?.close();}
}
export function signPhotoTexture(){return deferredTexture(()=>{
 if(!pixels)pixels=decode().catch(error=>{pixels=undefined;throw error;});
 return pixels;
});}
