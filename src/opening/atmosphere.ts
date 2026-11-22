import * as T from 'three';

/**
 * Thomas opening atmosphere: a warm campus afternoon that is replaced by a cold,
 * sealed night when the AI takes over.
 *
 * Three layers:
 *  1. scene lighting / sky / fog / tone mapping (animated, not a hard cut);
 *  2. a dark hemispherical dome that descends over the whole campus and closes the sky;
 *  3. red emergency beacons around the Thomas route.
 *
 * The dome is deliberately NOT a flat box ceiling: the campus towers reach ~80 m,
 * so a low slab slices their tops. The hemisphere radius is larger than every
 * building corner's distance from the dome centre, which keeps every roof inside.
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
 /** True while an explicit purge plays the dome back up into the sky. */
 releasing:boolean;
 background:string;
 fogDensity:number;
 hemiIntensity:number;
 sunIntensity:number;
 fillIntensity:number;
 redLights:number;
 /** Radius of the sealing hemisphere, metres. */
 domeRadius:number;
 /** World height of the dome apex when fully deployed, metres. */
 domeTop:number;
}

/**
 * Exported so the geometry check can prove the dome clears every authored roof.
 * Centre follows the site centre (x=0, z=-14); the rim is sunk 3 m so the mesh
 * meets uneven ground without floating.
 */
export const OPENING_DOME={
 radius:170,
 centerX:0,
 centerZ:-14,
 sink:3,
 top:167,
 seconds:5.2,
} as const;

const DOME_RADIUS=OPENING_DOME.radius;
const DOME_SINK=OPENING_DOME.sink;
const DOME_SECONDS=OPENING_DOME.seconds;
const DOME_DROP=DOME_RADIUS*1.18;
const NIGHT_FOG=.0075;
const DAY_BG=new T.Color(0xb5d7e4);
const NIGHT_BG=new T.Color(0x05080c);

const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
const dropFor=(p:number)=>(1-p)*DOME_DROP-DOME_SINK;

/** Dark energy skin of the sealing dome. */
function domeMaterial(){
 return new T.ShaderMaterial({
  name:'Opening_AI_dome_skin',
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
   varying vec3 vLocal;
   varying vec2 vUv;
   void main(){vLocal=position;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,
  fragmentShader:`
   uniform float uTime;uniform float uProgress;uniform vec3 uColor;uniform vec3 uEdge;
   varying vec3 vLocal;varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){
    vec3 n=normalize(vLocal);
    float h=clamp(n.y,0.0,1.0);
    float grain=hash(floor(vUv*vec2(150.0,220.0)))*0.030;
    float bands=0.5+0.5*sin(vUv.y*180.0+uTime*0.5);
    float scan=exp(-pow((fract(vUv.y*3.0-uTime*0.04)-0.5)*14.0,2.0));
    float horizon=exp(-pow((h-0.018)*26.0,2.0));
    // Spherical cage lattice: 24 meridians and 8 parallels, soft enough not to alias.
    float lon=atan(n.z,n.x);
    float lat=asin(clamp(n.y,0.0,1.0));
    float lonLine=smoothstep(0.988,1.0,abs(cos(lon*24.0)));
    float latLine=smoothstep(0.982,1.0,abs(cos(lat*32.0)));
    float lattice=max(lonLine,latLine);
    vec3 col=uColor*(0.62+0.70*h)+grain;
    col+=uEdge*horizon*0.85;
    col+=uEdge*scan*0.09*(0.4+0.6*uProgress);
    col+=uEdge*bands*0.015;
    col+=uEdge*lattice*(0.16+0.14*uProgress);
    float alpha=(0.56+0.24*uProgress)*(0.35+0.65*smoothstep(0.0,0.22,h));
    alpha*=smoothstep(0.0,0.035,h);
    gl_FragColor=vec4(col,alpha);
   }
  `,
 });
}

/** Segmented cage lines: crisp meridians/parallels that read as a machine boundary. */
function cageGeometry(radius:number,meridians:number,meridianSteps:number,parallels:number,parallelSteps:number,includeRim=false){
 const positions:number[]=[];
 const point=(theta:number,phi:number):[number,number,number]=>[radius*Math.sin(theta)*Math.cos(phi),radius*Math.cos(theta),radius*Math.sin(theta)*Math.sin(phi)];
 for(let m=0;m<meridians;m++){
  const phi=m/meridians*Math.PI*2;
  for(let s=0;s<meridianSteps;s++){
   positions.push(...point(s/meridianSteps*Math.PI/2,phi),...point((s+1)/meridianSteps*Math.PI/2,phi));
  }
 }
 for(let ring=1;ring<=parallels;ring++){
  const theta=ring/(parallels+1)*Math.PI/2;
  for(let s=0;s<parallelSteps;s++){
   positions.push(...point(theta,s/parallelSteps*Math.PI*2),...point(theta,(s+1)/parallelSteps*Math.PI*2));
  }
 }
 if(includeRim){
  for(let s=0;s<parallelSteps;s++){
   const t0=s/parallelSteps*Math.PI*2,t1=(s+1)/parallelSteps*Math.PI*2;
   positions.push(radius*Math.cos(t0),0,radius*Math.sin(t0),radius*Math.cos(t1),0,radius*Math.sin(t1));
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 return geometry;
}

export function createOpeningAtmosphere(scene:T.Scene,renderer:T.WebGLRenderer,lights:Lights){
 const root=new T.Group();root.name='Opening_AI_curtain_boundary';root.visible=false;scene.add(root);

 const baseBackground=(scene.background as T.Color|null)?.clone?.()??DAY_BG.clone();
 const baseHemi=lights.hemi.intensity,baseSun=lights.sun.intensity,baseFill=lights.fill.intensity;
 const baseExposure=renderer.toneMappingExposure;
 const baseEnvironment=scene.environmentIntensity;
 const baseFog=scene.fog??null;

 // The whole sealing volume moves as one group so the descent animates the dome,
 // the cage and the ground rim together.
 const curtainRoot=new T.Group();curtainRoot.name='Opening_curtain_dome';curtainRoot.position.set(OPENING_DOME.centerX,dropFor(0),OPENING_DOME.centerZ);root.add(curtainRoot);

 const domeMaterialInstance=domeMaterial();
 const dome=new T.Mesh(new T.SphereGeometry(DOME_RADIUS,96,40,0,Math.PI*2,0,Math.PI/2),domeMaterialInstance);
 dome.name='Opening_AI_curtain_dome';dome.renderOrder=3;curtainRoot.add(dome);

 // Dim cage + brighter ribs + horizon ring.
 const cageMaterial=new T.LineBasicMaterial({name:'Opening_AI_dome_cage',color:0x8f1d16,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
 const cage=new T.LineSegments(cageGeometry(DOME_RADIUS,36,40,9,96),cageMaterial);
 cage.name='Opening_AI_dome_cage';cage.renderOrder=4;curtainRoot.add(cage);

 const ribMaterial=new T.LineBasicMaterial({name:'Opening_AI_dome_ribs',color:0xff3b2f,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
 const ribs=new T.LineSegments(cageGeometry(DOME_RADIUS,8,48,3,128),ribMaterial);
 ribs.name='Opening_AI_dome_ribs';ribs.renderOrder=4;curtainRoot.add(ribs);

 const rimMaterial=new T.LineBasicMaterial({name:'Opening_AI_dome_rim',color:0xff4a35,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
 const rim=new T.LineSegments(cageGeometry(DOME_RADIUS,0,0,0,192,true),rimMaterial);
 rim.name='Opening_AI_dome_rim';rim.renderOrder=4;curtainRoot.add(rim);

 root.traverse(o=>{o.frustumCulled=false;});

 // Red emergency beacons on the Thomas route, plus one over the shuttle stop.
 const beaconPoints:[number,number,number][]=[
  // The B04 entrance beacon stands beside the doorway (x 58 ± 1.3), not on its axis:
  // its stem drew a black line through the crosshair at the Chapter 1 handoff (FU1).
  [58,5.4,-52],[4,6.8,-54],[61.2,6.6,22],[24,5.6,-48],[63.4,4.6,30],[20,5.4,10],
 ];
 const beaconLights:T.PointLight[]=[];
 const beaconMaterials:T.MeshStandardMaterial[]=[];
 for(const [x,y,z] of beaconPoints){
  const light=new T.PointLight(0xff2a1c,0,20,2);light.position.set(x,y+.2,z);root.add(light);beaconLights.push(light);
  const material=new T.MeshStandardMaterial({color:0x2a0605,emissive:0xff2a1c,emissiveIntensity:0,roughness:.4,metalness:.2,name:'Opening_beacon_red'});
  beaconMaterials.push(material);
  const housing=new T.Mesh(new T.BoxGeometry(.34,.2,.34),material);housing.name='Opening_beacon_housing';
  housing.position.set(x,y,z);root.add(housing);
  const stem=new T.Mesh(new T.BoxGeometry(.06,y,.06),new T.MeshStandardMaterial({color:0x1d2328,roughness:.8}));stem.name='Opening_beacon_stem';
  stem.position.set(x,y/2,z);root.add(stem);
 }

 let phase:OpeningAtmospherePhase='day';
 let progress=0;
 let target=0;
 let curtain=false;
 let releasing=false;
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
  domeMaterialInstance.uniforms.uTime.value=clock;
  domeMaterialInstance.uniforms.uProgress.value=p;
  curtainRoot.position.y=dropFor(p);
  root.visible=p>.001;
  const lit=smooth(p);
  const breathe=.72+.28*Math.sin(clock*2.1);
  cageMaterial.opacity=.20*lit*breathe;
  ribMaterial.opacity=.34*lit*(.70+.30*Math.sin(clock*2.7));
  rimMaterial.opacity=.42*lit*(.75+.25*Math.sin(clock*1.9));
  pulse+=dt;
  const flash=0.65+0.35*Math.sin(pulse*3.1);
  for(let i=0;i<beaconLights.length;i++){
   beaconLights[i].intensity=dark*(22+11*Math.sin(pulse*2.4+i*1.7));
   beaconMaterials[i].emissiveIntensity=dark*(1.4+1.0*flash);
  }
 }

 /** Called by the experience when the laptop pickup starts the takeover. */
 function startIncident(){
  target=1;curtain=true;releasing=false;
  root.visible=true;
  if(phase==='day')phase='disturbance';
 }

 /**
  * Restore an already-sealed campus without replaying the descent.
  * Used on page load and when the lion-boss route opens after a sealed opening.
  */
 function restoreSealed(){
  progress=1;target=1;curtain=true;releasing=false;phase='night';
  root.visible=true;curtainRoot.position.y=dropFor(1);
  apply(1,0);
 }

 /**
  * Purge the campus: play the dome back up into the sky and return the scene to
  * daylight. Only an explicit endgame transition may call this; an ordinary
  * false/no-seal frame no longer resets the atmosphere by itself.
  */
 function release(){
  if(progress<=0&&phase==='day'){releasing=false;return;}
  target=0;curtain=false;releasing=true;
  if(progress<1&&phase!=='disturbance')phase='disturbance';
 }

 function update(dt:number,state:OpeningAtmosphereState){
  const wantsSeal=state.incident||state.curtain;
  if(wantsSeal){
   // A new seal cancels an in-flight purge.
   releasing=false;
   startIncident();
  }else if(progress>0&&!releasing){
   release();
  }
  if(releasing){
   if(dt>0&&!state.paused&&progress>0)progress=Math.max(0,progress-dt/DOME_SECONDS);
   if(progress>0&&progress<1&&phase!=='disturbance')phase='disturbance';
   if(progress<=0){
    progress=0;target=0;curtain=false;releasing=false;phase='day';
    root.visible=false;curtainRoot.position.y=dropFor(0);
    apply(0,0);return;
   }
  }else{
   if(dt>0&&!state.paused&&progress<target)progress=Math.min(target,progress+dt/DOME_SECONDS);
   if(progress>=1&&phase!=='night')phase='night';
   if(progress>0&&progress<1&&phase!=='disturbance')phase='disturbance';
  }
  apply(progress,state.paused?0:dt);
 }

 function reset(){
  progress=0;target=0;curtain=false;releasing=false;phase='day';clock=0;pulse=0;
  root.visible=false;curtainRoot.position.y=dropFor(0);
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
   phase,curtainProgress:Math.round(progress*1000)/1000,curtainVisible:root.visible,releasing,
   background:'#'+new T.Color(scene.background instanceof T.Color?scene.background:DAY_BG).getHexString(),
   fogDensity:scene.fog instanceof T.FogExp2?scene.fog.density:0,
   hemiIntensity:Math.round(lights.hemi.intensity*100)/100,
   sunIntensity:Math.round(lights.sun.intensity*100)/100,
   fillIntensity:Math.round(lights.fill.intensity*100)/100,
   redLights:beaconLights.filter(l=>l.intensity>.1).length,
   domeRadius:DOME_RADIUS,domeTop:OPENING_DOME.top,
  };
  lastSnapshot=s;return s;
 }

 // Prime the day state without hiding any authored scenery.
 apply(0,0);
 return{
  root,
  update,
  startIncident,
  restoreSealed,
  release,
  reset,
  snapshot,
  get phase(){return phase;},
  get curtainProgress(){return progress;},
  get releasing(){return releasing;},
  dispose(){
   root.traverse(o=>{
    const renderable=o as T.Mesh;
    if(!renderable.isMesh&&!(renderable as unknown as T.LineSegments).isLineSegments)return;
    renderable.geometry?.dispose();
    for(const mat of Array.isArray(renderable.material)?renderable.material:[renderable.material])mat.dispose();
   });
   root.removeFromParent();
   scene.background=baseBackground.clone();
   scene.fog=baseFog;
   lights.hemi.intensity=baseHemi;lights.sun.intensity=baseSun;lights.fill.intensity=baseFill;
   renderer.toneMappingExposure=baseExposure;
  },
 };
}

export type OpeningAtmosphere=ReturnType<typeof createOpeningAtmosphere>;
