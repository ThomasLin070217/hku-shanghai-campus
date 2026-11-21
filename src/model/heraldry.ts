import * as T from 'three';

/** Nearest-filtered original pixel artwork on a cutout. Row zero is the top edge. */
export function emblemMaterial(art:{palette:string[];rows:string[]},name:string){
 const width=art.rows[0].length,height=art.rows.length;
 const rgba=new Uint8Array(width*height*4);
 const colors=art.palette.map(hex=>parseInt(hex,16));
 art.rows.forEach((row,y)=>{
  for(let x=0;x<width;x++){
   if(row[x]==='.')continue;
   const color=colors[Number(row[x])],i=((height-1-y)*width+x)*4;
   rgba[i]=color>>16;rgba[i+1]=(color>>8)&255;rgba[i+2]=color&255;rgba[i+3]=255;
  }
 });
 const map=new T.DataTexture(rgba,width,height);
 map.name=name;map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;
 map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 const material=new T.MeshBasicMaterial({name,map,alphaTest:.4});
 material.addEventListener('dispose',()=>map.dispose());
 return material;
}
