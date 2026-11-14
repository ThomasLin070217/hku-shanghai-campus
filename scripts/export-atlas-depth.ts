/** Atlas RGBD → an editable observed-surface GLB, NOT a watertight splat-to-mesh result. */
import * as T from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const dir=resolve('references/ai-world-v7/atlas-context'),out=resolve('assets/ai-generated');mkdirSync(out,{recursive:true});
const frames=JSON.parse(readFileSync(resolve(dir,'cameras.json'),'utf8')).slice(0,4);
const STEP=8,MAX_RELATIVE_EDGE=.12;
const prior:{intr:any;exr:ReturnType<EXRLoader['parse']>;position:T.Vector3;inverse:T.Quaternion}[]=[];
const chunks:Buffer[]=[],views:object[]=[],accessors:object[]=[],meshes:object[]=[],nodes:object[]=[],images:object[]=[],textures:object[]=[],materials:object[]=[];let length=0,triangles=0;
function bufferView(data:Buffer,target?:number){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const idx=views.length;views.push({buffer:0,byteOffset:length,byteLength:data.length,...(target?{target}:{})});chunks.push(data);length+=data.length;return idx;}
function accessor(data:Float32Array|Uint32Array,type:string,componentType:number,count:number,ext:object={}){const i=accessors.length;accessors.push({bufferView:bufferView(Buffer.from(data.buffer),type==='SCALAR'?34963:34962),componentType,count,type,...ext});return i;}
for(let f=0;f<frames.length;f++){
 const frame=frames[f],intr=frame.camera.intrinsics,ext=frame.camera.extrinsics;
 if(ext.coordinateSystem!=='rub')throw new Error('Expected Atlas RUB cameras');
 const bytes=readFileSync(resolve(dir,frame.depth.depthAsset.url));
 const exr=new EXRLoader().setDataType(T.FloatType).setOutputFormat(T.RedFormat).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const xs:number[]=[],ys:number[]=[];for(let x=0;x<exr.width;x+=STEP)xs.push(x);for(let y=0;y<exr.height;y+=STEP)ys.push(y);
 const positions:number[]=[],uv:number[]=[],depths:number[]=[],indices:number[]=[];const bounds=new T.Box3();
 for(const y of ys)for(const x of xs){
  // EXRLoader CPU rows are bottom-up; RGB/camera coordinates are top-down.
  const d=Number(exr.data[(exr.height-1-y)*exr.width+x]);depths.push(d);
  const px=(x+.5)*intr.width/exr.width,py=(y+.5)*intr.height/exr.height;
  const v=new T.Vector3((px-intr.cx)/intr.fx*d,-(py-intr.cy)/intr.fy*d,-d);
  if(!Number.isFinite(d)||d<=0)v.set(0,0,0);bounds.expandByPoint(v);positions.push(...v.toArray());uv.push(px/intr.width,py/intr.height);
 }
 const rotation=new T.Quaternion().fromArray(ext.quaternion),position=new T.Vector3().fromArray(ext.position);
 const add=(a:number,b:number,c:number)=>{
  const ds=[depths[a],depths[b],depths[c]];
  if(!ds.every(d=>Number.isFinite(d)&&d>0)||Math.max(...ds)-Math.min(...ds)>=MAX_RELATIVE_EDGE*Math.min(...ds))return;
  const center=new T.Vector3();for(const i of [a,b,c])center.add(new T.Vector3().fromArray(positions,i*3));center.divideScalar(3).applyQuaternion(rotation).add(position);
  // Prefer the first observed surface in overlapping camera coverage. This
  // removes competing photo shells; it does not fuse or invent hidden surfaces.
  for(const p of prior){
   const v=center.clone().sub(p.position).applyQuaternion(p.inverse),d=-v.z;if(d<=0)continue;
   const px=p.intr.fx*v.x/d+p.intr.cx,py=p.intr.cy-p.intr.fy*v.y/d;
   const x=Math.floor(px/p.intr.width*p.exr.width),y=Math.floor(py/p.intr.height*p.exr.height);
   if(x<0||x>=p.exr.width||y<0||y>=p.exr.height)continue;
   const seen=Number(p.exr.data[(p.exr.height-1-y)*p.exr.width+x]);
   if(Number.isFinite(seen)&&seen>0&&d>=seen-Math.max(.15,seen*.08))return;
  }
  indices.push(a,b,c);
 };
 for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++){const a=y*xs.length+x,b=a+1,c=a+xs.length,d=c+1;add(a,c,b);add(b,c,d);}
 if(!indices.length)throw new Error('No valid depth triangles');triangles+=indices.length/3;
 const remap=new Map<number,number>(),packedPositions:number[]=[],packedUV:number[]=[];bounds.makeEmpty();
 for(let k=0;k<indices.length;k++){const old=indices[k];let id=remap.get(old);if(id===undefined){id=remap.size;remap.set(old,id);const v=new T.Vector3().fromArray(positions,old*3);bounds.expandByPoint(v);packedPositions.push(...v.toArray());packedUV.push(uv[old*2],uv[old*2+1]);}indices[k]=id;}
 positions.splice(0,positions.length,...packedPositions);uv.splice(0,uv.length,...packedUV);
 const pa=accessor(new Float32Array(positions),'VEC3',5126,positions.length/3,{min:bounds.min.toArray(),max:bounds.max.toArray()}),ta=accessor(new Float32Array(uv),'VEC2',5126,uv.length/2),ia=accessor(new Uint32Array(indices),'SCALAR',5125,indices.length);
 const img=readFileSync(resolve(dir,frame.imageAsset.url));images.push({bufferView:bufferView(img),mimeType:img[0]===0xff&&img[1]===0xd8?'image/jpeg':'image/png'});textures.push({source:f,sampler:0});
 materials.push({name:'Atlas photo-baked appearance '+(f+1),pbrMetallicRoughness:{baseColorTexture:{index:f},metallicFactor:0,roughnessFactor:1},doubleSided:true,extensions:{KHR_materials_unlit:{}}});
 meshes.push({primitives:[{attributes:{POSITION:pa,TEXCOORD_0:ta},indices:ia,material:f}]});
 nodes.push({name:'Observed_Frame_'+(f+1),mesh:f,translation:ext.position,rotation:ext.quaternion,extras:{reference:frame.imageAsset.url,geometry:'Atlas estimated depth; partial surface, not closed',samplingPixels:STEP}});
 prior.push({intr,exr,position,inverse:rotation.clone().invert()});
}
const gltf={asset:{version:'2.0',generator:'HKU / Atlas RGBD observed-surface export'},extensionsUsed:['KHR_materials_unlit'],scene:0,scenes:[{nodes:nodes.map((_,i)=>i),extras:{source:'Atlas images2PosedRGBD, 4 user-approved frames',warning:'Not watertight. No inferred rear surfaces. Do not use directly as collision.'}}],nodes,meshes,materials,textures,images,samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],accessors,bufferViews:views,buffers:[{byteLength:length}]};
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
const header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);
const j=Buffer.alloc(8);j.writeUInt32LE(json.length);j.writeUInt32LE(0x4e4f534a,4);const b=Buffer.alloc(8);b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);
writeFileSync(resolve(out,'b05-atlas-depth-study.glb'),Buffer.concat([header,j,json,b,bin]));
writeFileSync(resolve(out,'depth-study.json'),JSON.stringify({type:'partial RGBD surface mesh',provider:'Atlas images2PosedRGBD',frames:4,triangles,samplingPixels:STEP,discontinuityRelativeThreshold:MAX_RELATIVE_EDGE,overlap:'Earlier visible surfaces preferred; hidden surfaces remain absent',closed:false,collisionReady:false,texture:'baked real photos; unlit',scale:'Atlas estimate, not surveyed'},null,2));
console.log({file:'b05-atlas-depth-study.glb',triangles,bytes:header.readUInt32LE(8)});
