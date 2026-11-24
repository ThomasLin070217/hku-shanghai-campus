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
  if(kind==='metal')c=246+Math.floor(rand()*7);
  const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
 }
 const t=new T.DataTexture(data,n,n,T.RGBAFormat);t.name='Original_pixel_'+kind;t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;t.minFilter=T.NearestMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
export function pixelUV(geo:T.BufferGeometry,tileMeters=4){
 const p=geo.getAttribute('position'),n=geo.getAttribute('normal');if(!p||!n)return;const uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(x>y&&x>z?p.getZ(i):p.getX(i))/tileMeters;uv[i*2+1]=(y>x&&y>z?p.getZ(i):p.getY(i))/tileMeters;}geo.setAttribute('uv',new T.BufferAttribute(uv,2));
}
/** A finish-scale grain for interiors: 64 texels over 1 m (1.6 cm each) at ~2% contrast.
 * The exterior tile is 16 texels over 4 m — 25 cm of light/dark, which reads as a
 * checkerboard from a metre away. This does not add a pattern; it only gives a flat
 * Lambert-looking plane the slight unevenness that stops it reading as untextured CG.
 * `kind` biases the noise so timber has a fine grain along one axis and soft goods have
 * a faint weave, but both stay inside the same contrast budget. */
export function interiorGrain(kind:'wall'|'ceiling'|'timber'|'soft'|'stone'){
 const n=64,data=new Uint8Array(n*n*4);let seed=kind==='timber'?31:kind==='soft'?53:kind==='stone'?97:11;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  let v=248+Math.floor(rand()*7)-3;                       // 245…251: a 2.4% swing
  if(kind==='timber')v+=(x%4===0?-3:0)+(y%16===0?-2:0);   // fine grain across the width
  if(kind==='soft')v+=((x+y)%2===0?2:-1);                 // weave, one texel on / one off
  if(kind==='stone')v+=rand()<.02?-7:0;                   // sparse fleck, never a speckle field
  v=Math.max(236,Math.min(255,v));
  const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
 }
 const t=new T.DataTexture(data,n,n,T.RGBAFormat);t.name='Interior_grain_'+kind;t.colorSpace=T.SRGBColorSpace;
 t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;
 t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
/** Which grain a material wants, from its authored name. Empty string = leave it alone. */
function grainKind(name:string):'wall'|'ceiling'|'timber'|'soft'|'stone'|''{
 if(/ceiling|soffit/.test(name))return 'ceiling';
 if(/floor|paving|stone|marble|terrazzo/.test(name))return 'stone';
 if(/timber|wood|oak|walnut|bench|stool/.test(name))return 'timber';
 if(/sofa|leather|rug|weave|fabric|upholster/.test(name))return 'soft';
 if(/wall|plaster|render|paint/.test(name))return 'wall';
 return '';
}
/** Interiors opt out of the exterior tile: 25 cm light/dark on a wall a metre away is
 * masonry, not a finish. A builder tags its interior root (or any group inside it) with
 * `userData.noVoxelTile = true`; the walk then gives that subtree the finish-scale grain
 * above instead, and leaves authored colour, roughness and emissive maps alone. Meshes
 * that already carry a map keep it. Exteriors keep the exterior tile. */
export function voxelizeMaterials(root:T.Object3D){
 const maps=new Map<string,T.DataTexture>(),done=new Set<T.Material>();
 const walk=(o:T.Object3D)=>{
  if(o.userData.noVoxelTile){grainSubtree(o,done);return;}
  if(o instanceof T.Mesh)textureMesh(o,maps,done);
  for(const child of o.children)walk(child);
 };
 walk(root);
}
function grainSubtree(root:T.Object3D,done:Set<T.Material>){
 // Its own cache: the exterior pass keys the same map with a `wall` kind, and sharing one
 // cache would hand an interior wall the 25 cm exterior tile (or the reverse).
 const grains=new Map<string,T.DataTexture>();
 const walk=(o:T.Object3D)=>{
  if(o instanceof T.Mesh){
   const mats=Array.isArray(o.material)?o.material:[o.material];let grained=false;
   for(const m of mats){
    if(!(m instanceof T.MeshStandardMaterial)||m.map)continue;
    if(m.emissiveIntensity&&m.emissive&&m.emissive.getHex()!==0)continue;
    const kind=grainKind(m.name.toLowerCase());if(!kind)continue;
    if(m.userData.surfaceRole==='glass')continue;
    if(!done.has(m)){if(!grains.has(kind))grains.set(kind,interiorGrain(kind));m.map=grains.get(kind)!;m.needsUpdate=true;done.add(m);grained=true;}
   }
   // 1 m per grain tile: 64 texels → 1.6 cm, which is finish scale rather than a pattern.
   if(grained)pixelUV(o.geometry,1);
  }
  for(const child of o.children)walk(child);
 };
 walk(root);
}
function textureMesh(o:T.Mesh,maps:Map<string,T.DataTexture>,done:Set<T.Material>){
 const mats=Array.isArray(o.material)?o.material:[o.material];let textured=false,paving=false;
  for(const m of mats){if(!(m instanceof T.MeshStandardMaterial))continue;if(m.userData.surfaceRole==='glass'){o.castShadow=false;o.receiveShadow=false;continue;}const name=m.name.toLowerCase();if(/^night_|sign|letter|marking|ivory/.test(name))continue;
   const kind=/glass|glaz/.test(name)?'glass':/frame|aluminium|silver|mullion|anodised|fins|steel/.test(name)?'metal':/grass|lawn|turf/.test(name)?'grass':/leaf|foliage/.test(name)?'leaf':/bark/.test(name)?'bark':/pav|concrete|limestone/.test(name)?'paving':/road|asphalt|track|jogging/.test(name)?'road':'wall';
   if(!done.has(m)){if(!maps.has(kind))maps.set(kind,pixelTile(kind));m.map=maps.get(kind)!;m.roughness=kind==='glass'?.38:kind==='metal'?.34:.90;m.metalness=kind==='glass'?.22:kind==='metal'?.55:.05;if(kind==='grass'&&!m.userData.keepColor)m.color.setHex(0x638448);if(kind==='leaf'&&!m.userData.keepColor)m.color.setHex(0x42764a);m.needsUpdate=true;done.add(m);}textured=true;if(/pav|concrete|limestone/.test(name))paving=true;
  }if(textured){pixelUV(o.geometry,paving?.6:4);if(paving){const uv=o.geometry.getAttribute('uv'),n=o.geometry.getAttribute('normal');for(let i=0;i<uv.count;i++)if(Math.abs(n.getY(i))>.8)uv.setY(i,uv.getY(i)*2);}}
}
