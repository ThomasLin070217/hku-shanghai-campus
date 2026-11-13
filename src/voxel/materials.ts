import * as T from 'three';
/** Original deterministic 16×16 pixel tiles. No remote assets or screen filter. */
export function pixelTile(kind:string){
 const n=16,data=new Uint8Array(n*n*4);let seed=17;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  let c=232+Math.floor(rand()*23);
  if(kind==='paving'&&(x===0||y===0))c=174;
  if(kind==='wall'&&((y%8===0)||(x%8===(y<8?0:4))))c=211;
  if(kind==='bark')c=170+(x%4)*20+Math.floor(rand()*15);
  if(kind==='leaf')c=195+Math.floor(rand()*60);
  if(kind==='glass')c=242+Math.floor(rand()*13);
  const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
 }
 const t=new T.DataTexture(data,n,n,T.RGBAFormat);t.name='Original_pixel_'+kind;t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;t.minFilter=T.NearestMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
export function pixelUV(geo:T.BufferGeometry,tileMeters=4){
 const p=geo.getAttribute('position'),n=geo.getAttribute('normal');if(!p||!n)return;const uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(x>y&&x>z?p.getZ(i):p.getX(i))/tileMeters;uv[i*2+1]=(y>x&&y>z?p.getZ(i):p.getY(i))/tileMeters;}geo.setAttribute('uv',new T.BufferAttribute(uv,2));
}
export function voxelizeMaterials(root:T.Object3D){
 const maps=new Map<string,T.DataTexture>(),done=new Set<T.Material>();
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;const mats=Array.isArray(o.material)?o.material:[o.material];let textured=false;
  for(const m of mats){if(!(m instanceof T.MeshStandardMaterial))continue;const name=m.name.toLowerCase();if(/^night_|sign|letter|marking|ivory/.test(name))continue;
   const kind=/glass|glaz/.test(name)?'glass':/grass|lawn|turf/.test(name)?'grass':/leaf|foliage/.test(name)?'leaf':/bark/.test(name)?'bark':/pav|concrete|limestone/.test(name)?'paving':/road|asphalt|track|jogging/.test(name)?'road':'wall';
   if(!done.has(m)){if(!maps.has(kind))maps.set(kind,pixelTile(kind));m.map=maps.get(kind)!;m.roughness=kind==='glass'?.38:.90;m.metalness=kind==='glass'?.22:.05;if(kind==='grass')m.color.setHex(0x638448);if(kind==='leaf')m.color.setHex(0x42764a);m.needsUpdate=true;done.add(m);}textured=true;
  }if(textured)pixelUV(o.geometry);
 });
}
