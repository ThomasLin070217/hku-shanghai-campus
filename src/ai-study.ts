import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildLounge} from './model/buildLounge';
import {disposeAsset,modelStats} from './model/buildCampus';
import './ai-study.css';

type Manifest={status:string;source:string;representation?:string;spz?:string;glb?:string;rotationDeg:[number,number,number];displayWidth:number;note:string;camera?:{position:number[];target:number[]}};
document.querySelector('#study-app')!.innerHTML=`
<header><a href="./">← 返回校园</a><span>HKU SHANGHAI / AI STUDY 01</span><button id="capture">保存视角 PNG</button></header>
<main><aside><small>BUILDING 5 · FLOOR 4</small><h1>从实拍到<br>三维空间。</h1><p>同一处阶梯休闲区，检查照片、参数模型和 Atlas 重建之间的差异。</p>
<figure><img id="reference" src="./references/ai-world-v7/U02-00-0000.08.jpg" alt="用户拍摄的5号楼四楼阶梯休闲区"><figcaption>实拍参考 · U02 / 00:00.08</figcaption></figure>
<label>参考帧 <select id="frame"><option value="U02-00-0000.08.jpg">00:00.08 · 座席与台阶</option><option value="U02-02-0000.71.jpg">00:00.71 · 全景</option><option value="U02-05-0001.67.jpg">00:01.67 · 顶部与后墙</option><option value="U02-08-0002.62.jpg">00:02.62 · 侧面</option></select></label>
<div class="buttons"><button id="generated" class="selected">AI 重建</button><button id="baseline">参数模型</button></div>
<label class="check"><input id="compare" type="checkbox">并排对照（仅深度网格）</label>
<button id="reset">重置观察角度</button>
<details><summary>调整重建朝向</summary><p>只调整预览，不修改原始下载资产。</p><div class="buttons"><button id="rotate-y">水平转 90°</button><button id="flip-x">上下翻转</button></div></details>
<div id="downloads"></div><p class="note" id="note">正在读取生成记录…</p><p class="note">AI 会补全未拍到的内容。此视图用于参考和资产检查；尺度为预览估计，不作为测绘或行走碰撞。</p></aside>
<section><div id="viewport"></div><div id="view-title">Atlas · 三维重建</div><div id="status" role="status">正在加载…</div><div class="hint">左键旋转 · 右键平移 · 滚轮缩放</div></section></main>`;
const el=(id:string)=>document.getElementById(id)!;
const host=el('viewport'),scene=new T.Scene();scene.background=new T.Color('#d9e4dc');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;host.append(renderer.domElement);
const camera=new T.PerspectiveCamera(50,1,.03,2000);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=120;
scene.add(new T.HemisphereLight(0xffffff,0x5b705c,2));const sun=new T.DirectionalLight(0xfff1d1,2);sun.position.set(-15,30,20);scene.add(sun);
const baseline=buildLounge();baseline.visible=false;scene.add(baseline);
const generated=new T.Group();generated.name='Atlas_B05_4F_Generated_Study';scene.add(generated);
const grid=new T.GridHelper(60,60,0xa1b2a5,0xc6d1c8);grid.position.y=-.03;scene.add(grid);
let manifest:Manifest,loaded=false,mode:'generated'|'baseline'='generated',bounds:T.Box3|null=null;
let source:T.Object3D|null=null,splat:import('@sparkjsdev/spark').SplatMesh|null=null,spark:import('@sparkjsdev/spark').SparkRenderer|null=null;
const resize=()=>{const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);
function fit(){
 const both=(el('compare') as HTMLInputElement).checked&&loaded;
 if(mode==='generated'&&!both&&manifest?.camera&&source){source.updateWorldMatrix(true,false);const m=source.matrixWorld;camera.position.fromArray(manifest.camera.position).applyMatrix4(m);controls.target.fromArray(manifest.camera.target).applyMatrix4(m);camera.lookAt(controls.target);controls.update();return;}
 const box=new T.Box3().setFromObject(baseline);if(mode==='generated'&&bounds){box.copy(bounds).translate(generated.position);if(both)box.union(new T.Box3().setFromObject(baseline));}
 const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const span=Math.max(size.x/Math.min(camera.aspect,1),size.y,size.z,5);
 controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(.75,.55,1).normalize().multiplyScalar(span*1.5));camera.lookAt(center);controls.update();
}
function sync(){
 const both=(el('compare') as HTMLInputElement).checked&&loaded&&mode==='generated';
 baseline.visible=mode==='baseline'||both;baseline.position.x=both?-10:0;generated.visible=mode==='generated';generated.position.x=both?10:0;
 el('generated').classList.toggle('selected',mode==='generated');el('baseline').classList.toggle('selected',mode==='baseline');
 el('view-title').textContent=both?'左：参数模型 · 右：Atlas 重建':mode==='baseline'?'原有参数模型 · 尺寸估计':(manifest?.representation||'Atlas 实景重建 · 生成资产');
 el('status').hidden=loaded||mode==='baseline';fit();
}
function normalize(){
 if(!source)return;source.removeFromParent();source.position.set(0,0,0);source.scale.setScalar(1);source.updateMatrixWorld(true);
 const b=splat?splat.getBoundingBox().applyMatrix4(source.matrixWorld):new T.Box3().setFromObject(source);
 if(b.isEmpty()||![...b.min.toArray(),...b.max.toArray()].every(Number.isFinite))throw new Error('模型包围盒无效');
 const size=b.getSize(new T.Vector3()),scale=manifest.displayWidth/Math.max(size.x,size.z,.001),center=b.getCenter(new T.Vector3());
 source.scale.setScalar(scale);source.position.set(-center.x*scale,-b.min.y*scale,-center.z*scale);
 bounds=b.clone();bounds.min.multiplyScalar(scale).add(source.position);bounds.max.multiplyScalar(scale).add(source.position);
 generated.add(source);generated.userData={provider:'World Labs Atlas',source:manifest.source,displayScale:scale,dimensions:'estimated; visual study only'};
}
el('generated').onclick=()=>{mode='generated';sync();};el('baseline').onclick=()=>{mode='baseline';sync();};el('compare').onchange=sync;el('reset').onclick=fit;
el('rotate-y').onclick=()=>{if(source){source.rotation.y+=Math.PI/2;normalize();sync();}};
el('flip-x').onclick=()=>{if(source){source.rotation.x+=Math.PI;normalize();sync();}};
el('frame').onchange=e=>{const s=e.target as HTMLSelectElement;(el('reference') as HTMLImageElement).src='./references/ai-world-v7/'+s.value;document.querySelector('figcaption')!.textContent='实拍参考 · U02 / '+s.selectedOptions[0].text;};
el('capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='HKU-B05-Atlas-study.png';a.click();};
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});resize();fit();
try{
 const r=await fetch('./assets/ai-generated/manifest.json');if(!r.ok||!r.headers.get('content-type')?.includes('json'))throw new Error('生成资产尚未下载，请稍后刷新。');manifest=await r.json();
 el('note').textContent=manifest.note;if(new URLSearchParams(location.search).get('format')==='mesh')manifest.representation='Atlas 深度网格 · 可见面重建';
 if(manifest.glb&&(!manifest.spz||new URLSearchParams(location.search).get('format')==='mesh')){source=(await new GLTFLoader().loadAsync(manifest.glb)).scene;source.name='Atlas_generated_mesh';}
 else if(manifest.spz){const module=await import('@sparkjsdev/spark');spark=new module.SparkRenderer({renderer});scene.add(spark);splat=new module.SplatMesh({url:manifest.spz});await splat.initialized;source=splat;}
 else throw new Error('生成仍在进行；当前可查看原有参数模型。');
 source.rotation.set(...manifest.rotationDeg.map(T.MathUtils.degToRad) as [number,number,number]);normalize();generated.add(source);fit();if(spark){el('status').textContent='正在准备三维渲染…';await spark.update({scene,camera});}loaded=true;(el('compare') as HTMLInputElement).disabled=!!splat;sync();
 for(const [label,path]of [['下载深度 GLB',manifest.glb],['下载原始 SPZ',manifest.spz]] as [string,string|undefined][])if(path){const a=document.createElement('a');a.href=path;a.download='';a.textContent=label;el('downloads').append(a);}
if(manifest.spz&&manifest.glb){const a=document.createElement('a');a.href=new URLSearchParams(location.search).get('format')==='mesh'?'./ai-study.html':'./ai-study.html?format=mesh';a.textContent=new URLSearchParams(location.search).get('format')==='mesh'?'查看 SPZ 重建':'查看深度网格';el('downloads').append(a);}
}catch(e){el('status').textContent=String(e instanceof Error?e.message:e);}
Object.assign(window,{__AI_STUDY:{scene,camera,renderer,controls,generated,baseline,fit,get loaded(){return loaded;},get source(){return source;},get stats(){return source&&!splat?modelStats(source):{type:'splat',count:splat?.packedSplats?.numSplats};}}});
window.addEventListener('pagehide',e=>{if(e.persisted)return;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();splat?.dispose();spark?.dispose();disposeAsset(baseline);if(source&&!splat)disposeAsset(source);renderer.dispose();},{once:true});
