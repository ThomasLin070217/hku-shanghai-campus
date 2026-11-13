import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export type ViewName='iso'|'front'|'side'|'rear'|'top'|'entrance';
export function createViewer(host:HTMLElement){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','CDS-1 三维模型；拖动旋转，滚轮缩放，右键平移');renderer.domElement.tabIndex=0;
  const scene=new THREE.Scene();scene.name='Preview_Scene';scene.background=new THREE.Color(0xeef0e9);
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.42;room.dispose();pmrem.dispose();
  const lights=new THREE.Group();lights.name='Preview_Lights';scene.add(lights);
  lights.add(new THREE.HemisphereLight(0xe5f3ff,0xa8ad98,2.2));
  const sun=new THREE.DirectionalLight(0xfff4dd,3.8);sun.position.set(-50,100,70);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-90;sun.shadow.camera.right=90;sun.shadow.camera.top=90;sun.shadow.camera.bottom=-90;sun.shadow.camera.far=250;sun.shadow.normalBias=.08;sun.shadow.bias=-.00015;sun.shadow.radius=3;lights.add(sun);
  const fill=new THREE.DirectionalLight(0xc1d8e0,.7);fill.position.set(60,45,-70);lights.add(fill);
  const camera=new THREE.OrthographicCamera(-70,70,60,-60,.1,1000);camera.name='Preview_Camera';
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minZoom=.3;controls.maxZoom=10;controls.maxPolarAngle=Math.PI*.495;controls.screenSpacePanning=true;
  let height=110;let currentView:ViewName='iso';let currentModelHeight=66.15;
  function resize(){const {width:w,height:h}=host.getBoundingClientRect();if(w<1||h<1)return;renderer.setSize(w,h);const aspect=w/h;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();}
  function view(name:ViewName='iso',modelHeight=currentModelHeight){
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
    currentView=name;currentModelHeight=modelHeight;camera.zoom=1;controls.maxPolarAngle=name==='entrance'?Math.PI*.6:Math.PI*.495;controls.target.set(0,modelHeight*.43,0);height=Math.max(110,modelHeight*1.65);
    const target=controls.target.clone();const directions:Record<ViewName,number[]>={iso:[105,80,115],front:[0,18,155],side:[155,30,0],rear:[-100,65,-120],top:[0,180,.01],entrance:[6,4,75]};
    if(name==='front'){controls.target.y=modelHeight*.45;directions.front=[0,0,160];}
    if(name==='entrance'){controls.target.set(0,6,25);height=18;}
    if(name==='top'){controls.target.set(0,0,0);height=95;}
    target.copy(controls.target);camera.position.copy(target).add(new THREE.Vector3(...directions[name] as [number,number,number]));camera.up.set(0,1,0);camera.lookAt(target);controls.update();controls.enableDamping=damping;resize();
  }
  const ro=new ResizeObserver(resize);ro.observe(host);view();
  let raf=0;function render(){controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(render);}render();
  function capture(transparent:boolean,environment:THREE.Object3D,width=1800){
    const previousBG=scene.background,visible=environment.visible,originalSize=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
    const aspect=originalSize.x/originalSize.y;
    try{if(transparent){scene.background=null;environment.visible=false;}renderer.setPixelRatio(1);renderer.setSize(width,Math.round(width/aspect),false);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');}
    finally{scene.background=previousBG;environment.visible=visible;renderer.setPixelRatio(ratio);renderer.setSize(originalSize.x,originalSize.y,false);renderer.render(scene,camera);}
  }
  return{renderer,scene,camera,controls,view,capture,getView:()=>currentView,dispose:()=>{cancelAnimationFrame(raf);ro.disconnect();controls.dispose();env.dispose();renderer.dispose();}};
}
