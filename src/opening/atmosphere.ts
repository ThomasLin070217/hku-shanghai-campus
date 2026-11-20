import * as T from 'three';

/**
 * Thomas opening atmosphere: a warm campus afternoon that is replaced by a cold,
 * sealed night when the AI takes over.
 *
 * Three layers:
 *  1. scene lighting / sky / fog / tone mapping (animated, not a hard cut);
 *  2. a tall, shader-drawn dark curtain that descends around the campus boundary;
 *  3. red emergency beacons around the Thomas route.
 *
 * DOM-free so it can also be instantiated in a headless check. The renderer is only
 * used for tone-mapping exposure.
 */

type Lights={hemi:T.Light;sun:T.Light;fill:T.Light};

export type OpeningAtmospherePhase='day'|'disturbance'|'night';

export interface OpeningAtmosphereState{
 incident:boolean;
 curtain:boolean;
 paused:boolean;
}

export interface OpeningAtmosphereSnapshot{
 phase:OpeningAtmospherePhase;
 curtainProgress:number;
 curtainVisible:boolean;
 background:string;
 fogDensity:number;
 hemiIntensity:number;
 sunIntensity:number;
 fillIntensity:number;
 redLights:number;
}

const CURTAIN_HEIGHT=38;
const CURTAIN_RADIUS_X=96;
const CURTAIN_RADIUS_Z=92;
const CURTAIN_SECONDS=4.6;
const NIGHT_FOG=.0075;
const DAY_BG=new T.Color(0xb5d7e4);
const NIGHT_BG=new T.Color(0x05080c);

const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};

function curtainMaterial(){
 return new T.ShaderMaterial({
  name:'Opening_AI_curtain',
  transparent:true,
  depthWrite:false,
  side:T.DoubleSide,
  uniforms:{
   uTime:{value:0},
   uProgress:{value:0},
   uColor:{value:new T.Color(0x06090d)},
   uEdge:{value:new T.Color(0x8f1d16)},
  },
  vertexShader:`
   varying vec2 vUv;
   void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,
  fragmentShader:`
   uniform float uTime;uniform float uProgress;uniform vec3 uColor;uniform vec3 uEdge;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){
    float horizon=smoothstep(0.0,0.16,vUv.y);
    float topFade=1.0-smoothstep(0.72,1.0,vUv.y)*0.45;
    float grain=hash(floor(vUv*vec2(120.0,180.0)))*0.035;
    float bands=0.5+0.5*sin(vUv.y*160.0+uTime*0.6);
    float scan=exp(-pow((fract(vUv.y*2.0-uTime*0.035)-0.5)*16.0,2.0));
    float rim=exp(-pow((vUv.y-0.955)*22.0,2.0));
    vec3 col=uColor*(0.6+0.8*vUv.y)+grain;
    col+=uEdge*rim*0.9;
    col+=uEdge*scan*0.12*(0.4+0.6*uProgress);
    col+=uEdge*bands*0.02;
    float alpha=(0.82+0.12*uProgress)*horizon*topFade;
    alpha*=smoothstep(0.0,0.06,vUv.y);
    gl_FragColor=vec4(col,alpha);
   }
  `,
 });
}

export function createOpeningAtmosphere(scene:T.Scene,renderer:T.WebGLRenderer,lights:Lights){
 const root=new T.Group();root.name='Opening_AI_curtain_boundary';root.visible=false;scene.add(root);

 const baseBackground=(scene.background as T.Color|null)?.clone?.()??DAY_BG.clone();
 const baseHemi=lights.hemi.intensity,baseSun=lights.sun.intensity,baseFill=lights.fill.intensity;
 const baseExposure=renderer.toneMappingExposure;
 const baseEnvironment=scene.environmentIntensity;
 const baseFog=scene.fog??null;

 const curtainRoot=new T.Group();curtainRoot.name='Opening_curtain_planes';root.add(curtainRoot);
 const curtainMaterialInstance=curtainMaterial();
 const curtainPanels:{mesh:T.Mesh;width:number;x:number;z:number;yaw:number}[]=[];
 const panel=(width:number,x:number,z:number,yaw:number)=>{
  const mesh=new T.Mesh(new T.PlaneGeometry(width,CURTAIN_HEIGHT),curtainMaterialInstance);
  mesh.position.set(x,0,z);mesh.rotation.y=yaw;mesh.renderOrder=4;
  curtainRoot.add(mesh);curtainPanels.push({mesh,width,x,z,yaw});
 };
 panel(CURTAIN_RADIUS_X*2+30,0,-CURTAIN_RADIUS_Z,0);
 panel(CURTAIN_RADIUS_X*2+30,0,CURTAIN_RADIUS_Z,Math.PI);
 panel(CURTAIN_RADIUS_Z*2+30,-CURTAIN_RADIUS_X,0,Math.PI/2);
 panel(CURTAIN_RADIUS_Z*2+30,CURTAIN_RADIUS_X,0,-Math.PI/2);

 // Thin glowing top rails and vertical energy ribs make the boundary read as a machine.
 const railMaterial=new T.MeshBasicMaterial({color:0xff3b2f,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
 const rails:T.Mesh[]=[];
 for(const wall of curtainPanels){
  const geo=new T.PlaneGeometry(wall.width,.28);
  const rail=new T.Mesh(geo,railMaterial);
  rail.position.set(wall.x,CURTAIN_HEIGHT-1.4,wall.z);rail.rotation.y=wall.yaw;
  curtainRoot.add(rail);rails.push(rail);
 }
 const ribMaterial=new T.MeshBasicMaterial({color:0xa32a21,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
 const ribs:T.Mesh[]=[];
 for(const wall of curtainPanels){
  const count=Math.max(4,Math.round(wall.width/18));
  for(let i=0;i<count;i++){
   const t=(i+.5)/count;
   const geo=new T.PlaneGeometry(.12,CURTAIN_HEIGHT*.86);
   const rib=new T.Mesh(geo,ribMaterial);
   const along=(t-.5)*wall.width;
   rib.position.set(wall.x+Math.cos(wall.yaw)*along,CURTAIN_HEIGHT*.43,wall.z-Math.sin(wall.yaw)*along);
   rib.rotation.y=wall.yaw;curtainRoot.add(rib);ribs.push(rib);
  }
 }
 root.traverse(o=>{const m=o as T.Mesh;if(m.isMesh)m.frustumCulled=false;});

 // A dark energy ceiling completes the containment volume when the player looks up.
 const ceilingMaterial=new T.ShaderMaterial({
  name:'Opening_AI_curtain_ceiling',transparent:true,depthWrite:false,side:T.DoubleSide,
  uniforms:{uTime:{value:0},uProgress:{value:0},uColor:{value:new T.Color(0x05090d)},uEdge:{value:new T.Color(0x7d1a14)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform float uTime;uniform float uProgress;uniform vec3 uColor;uniform vec3 uEdge;varying vec2 vUv;
   void main(){float grid=step(.985,max(fract(vUv.x*34.0),fract(vUv.y*30.0)));float pulse=.5+.5*sin(uTime*.7+vUv.x*8.0);vec3 col=uColor+uEdge*grid*(.32+.25*pulse);float alpha=(.24+.20*uProgress)+grid*.18;gl_FragColor=vec4(col,alpha);}`,
 });
 const ceiling=new T.Mesh(new T.PlaneGeometry(CURTAIN_RADIUS_X*2+30,CURTAIN_RADIUS_Z*2+30),ceilingMaterial);
 ceiling.rotation.x=Math.PI/2;ceiling.position.y=CURTAIN_HEIGHT-2;ceiling.renderOrder=3;curtainRoot.add(ceiling);

 // Red emergency beacons on the Thomas route, plus one over the shuttle stop.
 const beaconPoints:[number,number,number][]=[
  [58,5.4,-52],[4,6.8,-54],[58,6.6,22],[24,5.6,-48],[63.4,4.6,30],[20,5.4,10],
 ];
 const beaconLights:T.PointLight[]=[];
 const beaconMaterials:T.MeshStandardMaterial[]=[];
 for(const [x,y,z] of beaconPoints){
  const light=new T.PointLight(0xff2a1c,0,20,2);light.position.set(x,y+.2,z);root.add(light);beaconLights.push(light);
  const material=new T.MeshStandardMaterial({color:0x2a0605,emissive:0xff2a1c,emissiveIntensity:0,roughness:.4,metalness:.2,name:'Opening_beacon_red'});
  beaconMaterials.push(material);
  const housing=new T.Mesh(new T.BoxGeometry(.34,.2,.34),material);
  housing.position.set(x,y,z);root.add(housing);
  const stem=new T.Mesh(new T.BoxGeometry(.06,y,.06),new T.MeshStandardMaterial({color:0x1d2328,roughness:.8}));
  stem.position.set(x,y/2,z);root.add(stem);
 }

 let phase:OpeningAtmospherePhase='day';
 let progress=0;
 let target=0;
 let curtain=false;
 let clock=0;
 let pulse=0;
 let lastSnapshot:OpeningAtmosphereSnapshot|null=null;

 function apply(p:number,dt:number){
  const dark=smooth(p);
  const bg=baseBackground.clone().lerp(NIGHT_BG,dark);
  scene.background=bg;
  scene.environmentIntensity=lerp(baseEnvironment,.03,dark);
  lights.hemi.intensity=lerp(baseHemi,.28,dark);
  lights.sun.intensity=lerp(baseSun,.08,dark);
  lights.fill.intensity=lerp(baseFill,.20,dark);
  (lights.sun as T.DirectionalLight).color.setHex(0xffefd6).lerp(new T.Color(0x7b93b8),dark);
  (lights.fill as T.DirectionalLight).color.setHex(0xc1d8e0).lerp(new T.Color(0x7e1b17),dark);
  renderer.toneMappingExposure=lerp(baseExposure,.84,dark);
  if(dark>.001){
   const fog=scene.fog instanceof T.FogExp2?scene.fog:new T.FogExp2(0x05080c,0);
   fog.color.copy(bg);fog.density=lerp(0,NIGHT_FOG,dark);scene.fog=fog;
  }else if(baseFog)scene.fog=baseFog;
  else scene.fog=null;

  clock+=dt;
  curtainMaterialInstance.uniforms.uTime.value=clock;
  curtainMaterialInstance.uniforms.uProgress.value=p;
  ceilingMaterial.uniforms.uTime.value=clock;ceilingMaterial.uniforms.uProgress.value=p;
  const drop=(1-p)*CURTAIN_HEIGHT*1.15;
  curtainRoot.position.y=drop;
  root.visible=p>.001;
  railMaterial.opacity=.55*smooth(p)* (0.7+0.3*Math.sin(clock*2.2));
  ribMaterial.opacity=.22*smooth(p);
  pulse+=dt;
  const flash=0.65+0.35*Math.sin(pulse*3.1);
  for(let i=0;i<beaconLights.length;i++){
   beaconLights[i].intensity=dark*(22+11*Math.sin(pulse*2.4+i*1.7));
   beaconMaterials[i].emissiveIntensity=dark*(1.4+1.0*flash);
  }
 }

 /** Called by the experience when the laptop pickup starts the takeover. */
 function startIncident(){
  target=1;curtain=true;
  root.visible=true;
  if(phase==='day')phase='disturbance';
 }

 function update(dt:number,state:OpeningAtmosphereState){
  if(state.incident||state.curtain)startIncident();
  if(!state.incident&&!state.curtain&&phase!=='day'){
   // A restart returns the whole scene to its opening afternoon.
   progress=0;target=0;curtain=false;phase='day';curtainRoot.position.y=CURTAIN_HEIGHT*1.15;root.visible=false;
   apply(0,0);return;
  }
  if(dt>0&&!state.paused&&progress<target)progress=Math.min(target,progress+dt/CURTAIN_SECONDS);
  if(progress>=1&&phase!=='night')phase='night';
  if(progress>0&&progress<1&&phase!=='disturbance')phase='disturbance';
  apply(progress,state.paused?0:dt);
 }

 function reset(){
  progress=0;target=0;curtain=false;phase='day';clock=0;pulse=0;
  root.visible=false;curtainRoot.position.y=CURTAIN_HEIGHT*1.15;
  scene.background=baseBackground.clone();
  scene.environmentIntensity=baseEnvironment;
  lights.hemi.intensity=baseHemi;lights.sun.intensity=baseSun;lights.fill.intensity=baseFill;
  (lights.sun as T.DirectionalLight).color.setHex(0xffefd6);
  (lights.fill as T.DirectionalLight).color.setHex(0xc1d8e0);
  renderer.toneMappingExposure=baseExposure;
  scene.fog=baseFog;
  for(const light of beaconLights)light.intensity=0;
  for(const material of beaconMaterials)material.emissiveIntensity=0;
  lastSnapshot=null;
 }

 function snapshot():OpeningAtmosphereSnapshot{
  const s:OpeningAtmosphereSnapshot={
   phase,curtainProgress:Math.round(progress*1000)/1000,curtainVisible:root.visible,
   background:'#'+new T.Color(scene.background instanceof T.Color?scene.background:DAY_BG).getHexString(),
   fogDensity:scene.fog instanceof T.FogExp2?scene.fog.density:0,
   hemiIntensity:Math.round(lights.hemi.intensity*100)/100,
   sunIntensity:Math.round(lights.sun.intensity*100)/100,
   fillIntensity:Math.round(lights.fill.intensity*100)/100,
   redLights:beaconLights.filter(l=>l.intensity>.1).length,
  };
  lastSnapshot=s;return s;
 }

 // Prime the day state without hiding any authored scenery.
 apply(0,0);
 return{
  root,
  update,
  startIncident,
  reset,
  snapshot,
  get phase(){return phase;},
  get curtainProgress(){return progress;},
  dispose(){
   root.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();});
   root.removeFromParent();
   scene.background=baseBackground.clone();
   scene.fog=baseFog;
   lights.hemi.intensity=baseHemi;lights.sun.intensity=baseSun;lights.fill.intensity=baseFill;
   renderer.toneMappingExposure=baseExposure;
  },
 };
}

export type OpeningAtmosphere=ReturnType<typeof createOpeningAtmosphere>;
