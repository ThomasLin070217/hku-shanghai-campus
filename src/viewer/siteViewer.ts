import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {getGraphicsQuality,graphicsPixelRatio,createResolutionGovernor,MAX_PIXEL_RATIO} from './graphicsQuality';
export type CampusView='iso'|'north'|'south'|'top'|'plaza'|'selected';
export interface RendererPerf{calls:number;triangles:number;lines:number;points:number;geometries:number;textures:number;programs:number;frameMs:number;fps:number;pixelRatio:number;basePixelRatio:number;resolutionScale:number;resolutionStep:number;heap:null|{used:number;total:number;limit:number}}
type HeapPerformance=Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}};
export function createSiteViewer(host:HTMLElement, renderWhen:()=>boolean=()=>true,maxRatio=MAX_PIXEL_RATIO){
 let needsFrame=true;
 const quality=getGraphicsQuality();
 const renderer=new T.WebGLRenderer({antialias:quality!=='low',alpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance',stencil:false});renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.info.autoReset=false;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','HKU 上海校园三维预览；拖动旋转、滚轮缩放、右键平移');
 const scene=new T.Scene();scene.name='Preview_Scene';scene.background=new T.Color(0xb5d7e4);let env:T.WebGLRenderTarget;
 function refreshEnvironment(){const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();try{const next=pmrem.fromScene(room,.04);scene.environment=next.texture;env?.dispose();env=next;}finally{room.dispose();pmrem.dispose();}}
 refreshEnvironment();scene.environmentIntensity=.25;
 renderer.domElement.addEventListener('webglcontextrestored',refreshEnvironment);
 const lights=new T.Group();lights.name='Preview_Lights';scene.add(lights);const hemi=new T.HemisphereLight(0xe5f3ff,0x6c8157,1.35);lights.add(hemi);const sun=new T.DirectionalLight(0xffefd6,2.5);sun.position.set(-160,240,150);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-200,right:200,top:210,bottom:-210,far:650});sun.shadow.normalBias=.12;sun.shadow.bias=-.00012;lights.add(sun);const fill=new T.DirectionalLight(0xc1d8e0,.4);fill.position.set(160,100,-130);lights.add(fill);
 const camera=new T.OrthographicCamera(-200,200,200,-200,.1,2000);camera.name='Preview_Camera';const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minZoom=.25;controls.maxZoom=14;controls.maxPolarAngle=Math.PI*.495;let activeCamera:T.Camera=camera; const beforeRender=new Set<(dt:number)=>void>(); let viewHeight=330;let current:CampusView='iso';let frameSpan=330;
 // Adaptive resolution: the ratio handed to the renderer is the capped device ratio times
 // the governor step. Exports below always use baseRatio, never the degraded value.
 const governor=createResolutionGovernor();
 let baseRatio=1;
 function applyRatio(){const ratio=Math.max(.5,baseRatio*governor.scale);if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);}
 function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;needsFrame=true;
  baseRatio=graphicsPixelRatio(quality,r.width,r.height,devicePixelRatio,maxRatio);applyRatio();
  renderer.setSize(r.width,r.height);const aspect=r.width/r.height;viewHeight=Math.max(frameSpan,frameSpan/Math.max(aspect,.1));camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();}
 function view(v:CampusView='iso',selected?:T.Object3D){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();current=v;camera.zoom=1;camera.up.set(0,1,0);const target=new T.Vector3(0,20,-12);let offset=new T.Vector3(250,400,300);frameSpan=310;
 if(v==='north')offset.set(-220,170,-310);if(v==='south')offset.set(0,130,370);if(v==='top'){offset.set(0,500,.01);target.set(0,0,-15);frameSpan=282;}
 if(v==='plaza'){target.set(0,-1,25);offset.set(0,100,65);frameSpan=70;}
 if(v==='selected'&&selected){const b=new T.Box3().setFromObject(selected),size=b.getSize(new T.Vector3());b.getCenter(target);offset.set(130,100,140);frameSpan=Math.max(size.x,size.y,size.z)*1.65;}
 controls.target.copy(target);camera.position.copy(target).add(offset);camera.lookAt(target);controls.update();controls.enableDamping=damping;resize();}
 const ro=new ResizeObserver(resize);ro.observe(host);view();let raf=0;const callbacks=new Set<()=>void>();let previous=performance.now();let previousRendered=false;
 function render(){const now=performance.now(),raw=now-previous,dt=Math.min(raw/1000,.1);previous=now;if(!renderer.getContext().isContextLost()){// One reset per frame: shadow pass, nested device-screen renders and the main pass all
  // accumulate into the same counters, so perf() reports the real cost of the frame.
  renderer.info.reset();for(const fn of beforeRender)fn(dt);if(controls.enabled)controls.update();const drawn=needsFrame||renderWhen();if(drawn){renderer.render(scene,activeCamera);needsFrame=false;
  // Only continuously rendered frames describe the frame budget; a one-off redraw after
  // an idle gap is not a slow frame.
  if(previousRendered&&!document.hidden&&governor.sample(raw)){applyRatio();needsFrame=true;}
  previousRendered=true;}else previousRendered=false;}
  for(const fn of callbacks)fn();raf=requestAnimationFrame(render);}render();
 function capture(transparent:boolean,environment:T.Object3D,width=2000){if(renderer.getContext().isContextLost())throw Error('画面连接尚未恢复，暂时不能截图');const bg=scene.background,visible=environment.visible,size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();try{if(transparent){scene.background=null;environment.visible=false;}renderer.setPixelRatio(1);renderer.setSize(width,Math.round(width*size.y/size.x),false);renderer.render(scene,activeCamera);return renderer.domElement.toDataURL('image/png');}finally{scene.background=bg;environment.visible=visible;renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);}}
 /** Renderer counters plus the governor state. Diagnostics only: it reports what the
  * renderer actually submitted, it does not claim a measured improvement. */
 function perf():RendererPerf{const info=renderer.info,memory=(performance as HeapPerformance).memory,frameMs=governor.frameMs;return{calls:info.render.calls,triangles:info.render.triangles,lines:info.render.lines,points:info.render.points,geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs?.length??0,frameMs:Math.round(frameMs*100)/100,fps:frameMs?Math.round(1000/frameMs):0,pixelRatio:Math.round(renderer.getPixelRatio()*1000)/1000,basePixelRatio:Math.round(baseRatio*1000)/1000,resolutionScale:governor.scale,resolutionStep:governor.step,heap:memory?{used:memory.usedJSHeapSize,total:memory.totalJSHeapSize,limit:memory.jsHeapSizeLimit}:null};}
 return{scene,camera,controls,renderer,lights:{hemi,sun,fill},view,capture,perf,
  screenshot(){if(renderer.getContext().isContextLost())throw Error('画面连接尚未恢复，暂时不能截图');const ratio=renderer.getPixelRatio();try{// Captures keep the full capped ratio so a degraded gameplay frame is not exported.
   if(ratio!==baseRatio)renderer.setPixelRatio(baseRatio);renderer.render(scene,activeCamera);return renderer.domElement.toDataURL('image/png');}finally{if(ratio!==baseRatio)renderer.setPixelRatio(ratio);}},
  callbacks,beforeRender,setActiveCamera(c:T.Camera){activeCamera=c;},get activeCamera(){return activeCamera;},getView:()=>current,
  dispose(){cancelAnimationFrame(raf);ro.disconnect();beforeRender.clear();callbacks.clear();renderer.domElement.removeEventListener('webglcontextrestored',refreshEnvironment);sun.shadow.dispose();scene.environment=null;env.dispose();controls.dispose();renderer.renderLists.dispose();renderer.dispose();renderer.domElement.remove();}};
}
