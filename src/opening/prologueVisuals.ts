import * as T from 'three';
import {BUILDINGS} from '../model/campusParameters';
import {DINNER_LAYOUT as D,OPENING as O} from './spatialLayout';
import {PROLOGUE_LINES,PROLOGUE_TOTAL} from './prologueVoice';

/**
 * Prologue-only visual language. Everything here is temporary scenery created
 * when the cinematic starts and disposed when it stops, skips or replays:
 *
 *  - the mesh die-shot over the aerial: four tower footprints as equal nodes,
 *    links running tower to tower, no central core and no star topology;
 *  - HKU Magic Hour: laser fans sweeping the east tower facades and windows
 *    coming on one by one;
 *  - additive light traces along the B4 floor seams, rack fronts and the B5
 *    lobby/dinner-hall aisles;
 *  - one coherent volumetric shaft inside B4 that the camera passes through,
 *    with drifting dust, plus the warm practical lights that let the interiors
 *    read at dusk.
 *
 * Nothing here is added to the gameplay scene graph permanently, and none of
 * these materials are shared with the campus asset.
 */

const L=PROLOGUE_LINES;
const at=(line:number,fraction:number)=>L[line].start+(L[line].end-L[line].start)*fraction;
const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
const smooth=(x:number)=>{const t=clamp01(x);return t*t*(3-2*t);};
const windowFade=(t:number,inA:number,inB:number,outA:number,outB:number)=>smooth((t-inA)/Math.max(1e-6,inB-inA))*smooth((outB-t)/Math.max(1e-6,outB-outA));

type Tower=typeof BUILDINGS[number];
const towers:readonly Tower[]=BUILDINGS.filter(b=>['B01','B02','B03','B04'].includes(b.id));

export interface PrologueVisuals{
 root:T.Group;
 /** Advance the visuals on the prologue clock (seconds). */
 update(t:number):void;
 dispose():void;
}

export function createPrologueVisuals():PrologueVisuals{
 const root=new T.Group();
 root.name='Prologue_visuals';
 root.userData.dynamicGameplay=true;
 const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();
 const own=<M extends T.Material>(material:M):M=>{materials.add(material);return material;};
 const geo=<G extends T.BufferGeometry>(geometry:G):G=>{geometries.add(geometry);return geometry;};

 /* ---------------------------------------------------------------- */
 /* 0. Magic Hour sky dome: amber horizon → rose → deep blue          */
 /* ---------------------------------------------------------------- */
 const skyMaterial=own(new T.ShaderMaterial({
  name:'Prologue_magic_hour_sky',side:T.BackSide,depthWrite:false,fog:false,
  uniforms:{},
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec3 vDir;
   void main(){float h=clamp(vDir.y*0.5+0.5,0.0,1.0);
   vec3 horizon=vec3(1.0,0.62,0.33);vec3 rose=vec3(0.72,0.34,0.40);vec3 top=vec3(0.06,0.10,0.24);
   vec3 col=mix(horizon,rose,smoothstep(0.42,0.58,h));col=mix(col,top,smoothstep(0.55,0.92,h));
   vec3 sunDir=normalize(vec3(-0.75,0.18,0.64));
   float sun=pow(max(dot(normalize(vDir),sunDir),0.0),26.0);
   col+=vec3(1.0,0.55,0.25)*sun*0.6;
   gl_FragColor=vec4(col,1.0);}`,
 }));
 const sky=new T.Mesh(geo(new T.SphereGeometry(600,32,20)),skyMaterial);
 sky.name='Prologue_magic_hour_sky';sky.renderOrder=-1;sky.frustumCulled=false;
 root.add(sky);

 /* ---------------------------------------------------------------- */
 /* 1. Mesh die-shot: four equal nodes, tower-to-tower links, no core  */
 /* ---------------------------------------------------------------- */
 const dieShot=new T.Group();
 dieShot.name='Prologue_die_shot_mesh';
 const nodeMaterial=own(new T.LineBasicMaterial({name:'Prologue_die_shot_node',color:0x9fdcff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
 const linkMaterial=own(new T.LineBasicMaterial({name:'Prologue_die_shot_link',color:0x5fa9d8,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
 const ringMaterial=own(new T.MeshBasicMaterial({name:'Prologue_die_shot_ring',color:0x9fdcff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
 const nodeLines:number[]=[];
 const centreOf=(t:Tower):[number,number,number]=>[t.x,0.55,t.z];
 for(const tower of towers){
  const [cx,,cz]=centreOf(tower);
  const hw=tower.width/2+2.2,hd=tower.depth/2+2.2,y=0.45;
  const corners:[[number,number],[number,number]][]=[[[cx-hw,cz-hd],[cx+hw,cz-hd]],[[cx+hw,cz-hd],[cx+hw,cz+hd]],[[cx+hw,cz+hd],[cx-hw,cz+hd]],[[cx-hw,cz+hd],[cx-hw,cz-hd]]];
  for(const [[ax,az],[bx,bz]] of corners)nodeLines.push(ax,y,az,bx,y,bz);
  const ring=new T.Mesh(geo(new T.RingGeometry(5.4,6.6,40)),ringMaterial);
  ring.rotation.x=-Math.PI/2;ring.position.set(cx,0.52,cz);dieShot.add(ring);
  // A slim vertical marker at each node reads from the high aerial, never a centre.
  const pin=new T.Mesh(geo(new T.BoxGeometry(1.1,8.5,1.1)),ringMaterial);
  pin.position.set(cx,4.6,cz);dieShot.add(pin);
 }
 const nodeMesh=new T.LineSegments(geo(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(nodeLines,3))),nodeMaterial);
 dieShot.add(nodeMesh);
 // Perimeter plus both diagonals, then a spine that leaves each tower for the
 // low north campus: every link is tower-to-tower or tower-to-node, never a star.
 const links:number[]=[];
 const link=(a:[number,number,number],b:[number,number,number])=>links.push(...a,...b);
 for(let i=0;i<towers.length;i++){
  const a=centreOf(towers[i]),b=centreOf(towers[(i+1)%towers.length]);
  link(a,b);
 }
 link(centreOf(towers[0]),centreOf(towers[2]));
 link(centreOf(towers[1]),centreOf(towers[3]));
 for(const id of ['B05','B06','B07']){
  const building=BUILDINGS.find(b=>b.id===id);
  if(!building)continue;
  const anchors=towers.filter(t=>t.id==='B03'||t.id==='B04').map(centreOf);
  link(anchors[id==='B05'?1:0],[building.x,0.55,building.z]);
 }
 const linkMesh=new T.LineSegments(geo(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(links,3))),linkMaterial);
 dieShot.add(linkMesh);
 root.add(dieShot);

 /* ---------------------------------------------------------------- */
 /* 2. HKU Magic Hour: laser fans + windows coming on                 */
 /* ---------------------------------------------------------------- */
 const laserRoot=new T.Group();
 laserRoot.name='Prologue_magic_hour_lasers';
 const laserMaterials=[own(new T.MeshBasicMaterial({name:'Prologue_laser_a',color:0xbfe8ff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false})),
  own(new T.MeshBasicMaterial({name:'Prologue_laser_b',color:0xffd18f,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false})),
  own(new T.MeshBasicMaterial({name:'Prologue_laser_c',color:0x8ff0d0,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}))];
 const lasers:{pivot:T.Group;phase:number;baseX:number;baseZ:number}[]=[];
 for(const tower of towers.filter(t=>t.id==='B03'||t.id==='B04')){
  const south=tower.z+tower.depth/2+1.2;
  for(let i=0;i<7;i++){
   const material=laserMaterials[i%laserMaterials.length];
   const length=62+((i*13)%29);
   const beam=new T.Mesh(geo(new T.CylinderGeometry(0.16,0.035,length,6,1,true)),material);
   beam.position.y=length/2;
   const pivot=new T.Group();
   pivot.position.set(tower.x-tower.width/2+4+i*(tower.width-8)/6,22+(i%4)*8,south);
   pivot.add(beam);
   const glow=new T.Mesh(geo(new T.SphereGeometry(0.55,8,6)),material);
   pivot.add(glow);
   laserRoot.add(pivot);
   lasers.push({pivot,phase:i*0.9+tower.z*0.01,baseX:-0.55-(i%3)*0.16,baseZ:0.22+((i*7)%5)*0.09});
  }
 }
 root.add(laserRoot);

 // Window points on every tower facade plus the low B5 block. One shader, one
 // draw call; uReveal makes them come on one by one.
 const windows:{position:Float32Array;seed:Float32Array}=(()=>{
  const position:number[]=[],seed:number[]=[];
  const next=(n:number)=>{let s=(n*2654435761)>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
  const push=(x:number,y:number,z:number,r:()=>number)=>{position.push(x,y,z);seed.push(r());};
  for(const b of BUILDINGS.filter(b=>['B01','B02','B03','B04','B05'].includes(b.id))){
   const r=next(b.x*7+b.z*13+b.height);
   const y0=4.2,y1=b.height-3.2,stepY=3.4;
   for(let y=y0;y<=y1;y+=stepY){
    for(let x=-b.width/2+2;x<=b.width/2-2;x+=3.1){
     push(b.x+x+0.35,y,b.z+b.depth/2+0.35,r);
     push(b.x+x+0.35,y,b.z-b.depth/2-0.35,r);
    }
    for(let z=-b.depth/2+2;z<=b.depth/2-2;z+=3.1){
     push(b.x+b.width/2+0.35,y,b.z+z,r);
     push(b.x-b.width/2-0.35,y,b.z+z,r);
    }
   }
  }
  return{position:new Float32Array(position),seed:new Float32Array(seed)};
 })();
 const windowGeometry=geo(new T.BufferGeometry());
 windowGeometry.setAttribute('position',new T.BufferAttribute(windows.position,3));
 windowGeometry.setAttribute('aSeed',new T.BufferAttribute(windows.seed,1));
 const windowMaterial=own(new T.ShaderMaterial({
  name:'Prologue_window_lights',transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{uReveal:{value:0},uTime:{value:0},uSize:{value:2.6},uOpacity:{value:0},uColor:{value:new T.Color(0xffd9a0)}},
  vertexShader:`attribute float aSeed;varying float vSeed;uniform float uSize;
   void main(){vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(uSize*(220.0/max(1.0,-mv.z)),1.0,4.0);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uReveal;uniform float uTime;uniform float uOpacity;uniform vec3 uColor;varying float vSeed;
   void main(){if(vSeed>uReveal)discard;float tw=0.74+0.26*sin(vSeed*90.0+uTime*1.7);gl_FragColor=vec4(uColor,uOpacity*tw);}`,
 }));
 const windowPoints=new T.Points(windowGeometry,windowMaterial);
 windowPoints.name='Prologue_window_lights';
 windowPoints.frustumCulled=false;
 root.add(windowPoints);

 /* ---------------------------------------------------------------- */
 /* 3. Light traces along floor seams, coves and rack fronts          */
 /* ---------------------------------------------------------------- */
 const tracePositions:number[]=[];
 const trace=(a:[number,number,number],b:[number,number,number])=>tracePositions.push(...a,...b);
 const F=O.b4.floor,cH=O.b4.clearHeight;
 // B4: rack front, room seams, ceiling cove and the tier noses.
 trace([47.2,F+.05,8.45],[53.5,F+.05,8.45]);
 for(const x of [47.4,48.9,50.4,51.9,53.2])trace([x,F+.05,8.45],[x,F+.05,8.9]);
 trace([46.5,F+.05,19.9],[69.5,F+.05,19.9]);
 trace([46.5,F+.05,8.9],[46.5,F+.05,19.9]);
 trace([69.5,F+.05,8.9],[69.5,F+.05,19.9]);
 trace([46.5,F+cH-.35,8.9],[46.5,F+cH-.35,19.9]);
 trace([69.5,F+cH-.35,8.9],[69.5,F+cH-.35,19.9]);
 trace([46.5,F+cH-.35,8.9],[69.5,F+cH-.35,8.9]);
 for(const tier of [68.05,68.57,69.09])trace([tier,F+.96,9.7],[tier,F+.96,17.5]);
 // B5: lobby seams, the partition opening and the dinner-hall table aisles.
 const B=O.b5;
 trace([54.4,B.floor+.05,-55.2],[59.8,B.floor+.05,-55.2]);
 trace([54.4,B.floor+.05,-79.6],[59.8,B.floor+.05,-79.6]);
 trace([54.4,B.floor+.05,-55.2],[54.4,B.floor+.05,-79.6]);
 trace([60,B.floor+.06,D.doorZ0],[60,B.floor+.06,D.doorZ1]);
 for(const x of [69.2,71.8])trace([x,B.floor+.06,-59],[x,B.floor+.06,-76.5]);
 trace([62.5,B.floor+.06,-71.5],[79.5,B.floor+.06,-71.5]);
 trace([79.2,B.floor+.22,-67.2],[79.2,B.floor+.22,-62.0]);
 const traceGeometry=geo(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(tracePositions,3)));
 const traceMaterial=own(new T.LineBasicMaterial({name:'Prologue_light_traces',color:0x74e8cf,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
 const traces=new T.LineSegments(traceGeometry,traceMaterial);
 traces.name='Prologue_light_traces';
 root.add(traces);

 /* ---------------------------------------------------------------- */
 /* 4. One coherent volumetric shaft inside B4, with drifting dust    */
 /* ---------------------------------------------------------------- */
 const beamRoot=new T.Group();
 beamRoot.name='Prologue_volumetric_beam';
 const beamMaterial=own(new T.ShaderMaterial({
  name:'Prologue_volumetric_beam',transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
  uniforms:{uTime:{value:0},uOpacity:{value:0},uColor:{value:new T.Color(0xfff1d2)}},
  vertexShader:`varying vec3 vNormalW;varying vec3 vWorld;varying vec2 vUv;
   void main(){vUv=uv;vNormalW=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform float uTime;uniform float uOpacity;uniform vec3 uColor;varying vec3 vNormalW;varying vec3 vWorld;varying vec2 vUv;
   void main(){vec3 viewDir=normalize(cameraPosition-vWorld);float edge=pow(1.0-abs(dot(normalize(vNormalW),viewDir)),1.7);
   float ends=smoothstep(0.0,0.16,vUv.y)*smoothstep(1.0,0.7,vUv.y);float pulse=0.86+0.14*sin(uTime*0.9);
   float a=uOpacity*ends*(0.10+0.95*edge)*pulse;gl_FragColor=vec4(uColor,a);}`,
 }));
 const beamHeight=cH-.06;
 const beam=new T.Mesh(geo(new T.CylinderGeometry(1.55,1.15,beamHeight,36,1,true)),beamMaterial);
 beam.position.set(54.5,F+beamHeight/2,12.2);
 beam.frustumCulled=false;
 beamRoot.add(beam);
 const dustCount=220,dustPositions=new Float32Array(dustCount*3),dustSpeed=new Float32Array(dustCount);
 let dustSeed=97531;
 const dustRandom=()=>{dustSeed=(dustSeed*1664525+1013904223)>>>0;return dustSeed/4294967296;};
 for(let i=0;i<dustCount;i++){
  const angle=dustRandom()*Math.PI*2,radius=Math.sqrt(dustRandom())*1.35;
  dustPositions[i*3]=54.5+Math.cos(angle)*radius;
  dustPositions[i*3+1]=F+dustRandom()*beamHeight;
  dustPositions[i*3+2]=12.2+Math.sin(angle)*radius;
  dustSpeed[i]=0.05+dustRandom()*0.12;
 }
 const dustGeometry=geo(new T.BufferGeometry());
 dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));
 const dustMaterial=own(new T.PointsMaterial({name:'Prologue_beam_dust',color:0xffe8c0,size:0.045,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true}));
 const dust=new T.Points(dustGeometry,dustMaterial);
 dust.name='Prologue_beam_dust';dust.frustumCulled=false;
 beamRoot.add(dust);
 root.add(beamRoot);

 /* ---------------------------------------------------------------- */
 /* 5. Warm practicals so the interiors read at dusk                  */
 /* ---------------------------------------------------------------- */
 const practical=(x:number,y:number,z:number,intensity:number,distance:number,color=0xffdca8)=>{
  const light=new T.PointLight(color,intensity,distance,2);
  light.name='Prologue_practical';light.position.set(x,y,z);
  light.userData.baseIntensity=intensity;
  root.add(light);
  return light;
 };
 const practicalLights=[practical(58,3.9,13.2,18,9),practical(50.2,2.6,9.6,10,6),practical(66.2,2.8,13.4,12,6),practical(57,3.6,-62,12,8)];

 let lastT=0;
 function update(t:number):void{
  const dt=Math.min(0.1,Math.max(0,t-lastT));lastT=t;
  // Die-shot: on through the aerial, gone before the camera is inside B4.
  const dieFade=windowFade(t,0,at(0,0.12),at(1,0.28),at(1,0.48));
  dieShot.visible=dieFade>0.002;
  nodeMaterial.opacity=0.68*dieFade;
  linkMaterial.opacity=0.34*dieFade;
  ringMaterial.opacity=0.30*dieFade*(0.8+0.2*Math.sin(t*1.6));
  // Magic Hour lasers: the last beam fades before the crowd turns.
  const laserFade=windowFade(t,0,at(0,0.18),at(1,0.22),at(1,0.4));
  laserRoot.visible=laserFade>0.002;
  for(const material of laserMaterials)material.opacity=0.5*laserFade;
  for(const laser of lasers){
   laser.pivot.rotation.x=laser.baseX+Math.sin(t*0.55+laser.phase)*0.42;
   laser.pivot.rotation.z=laser.baseZ+Math.cos(t*0.4+laser.phase*1.3)*0.55;
  }
  // Windows one by one, then all on for the dusk return.
  const reveal=clamp01(0.22+0.78*smooth((t-L[0].start)/Math.max(1,at(3,0.5)-L[0].start)));
  windowMaterial.uniforms.uReveal.value=reveal;
  windowMaterial.uniforms.uTime.value=t;
  windowMaterial.uniforms.uOpacity.value=0.9*windowFade(t,0,at(0,0.05),at(3,1),PROLOGUE_TOTAL+4);
  // Traces and the shaft live only inside the interior beats.
  const interiorFade=windowFade(t,at(1,0.5),at(1,0.66),at(3,0.42),at(3,0.58));
  traceMaterial.opacity=0.34*interiorFade*(0.7+0.3*Math.sin(t*1.9));
  traces.visible=interiorFade>0.002;
  beamMaterial.uniforms.uTime.value=t;
  beamMaterial.uniforms.uOpacity.value=0.5*interiorFade;
  beamRoot.visible=interiorFade>0.002;
  dustMaterial.opacity=0.5*interiorFade;
  if(interiorFade>0.002&&dt>0){
   const positions=dustGeometry.getAttribute('position') as T.BufferAttribute;
   const array=positions.array as Float32Array;
   for(let i=0;i<dustCount;i++){
    const y=i*3+1;
    array[y]+=dustSpeed[i]*dt;
    if(array[y]>F+beamHeight)array[y]=F+0.05;
    array[i*3]+=Math.sin(t*0.7+i)*0.0006;
   }
   positions.needsUpdate=true;
  }
  for(const light of practicalLights){
   const base=light.userData.baseIntensity as number;
   light.intensity=base*(0.55+0.45*interiorFade);
  }
 }

 function dispose():void{
  root.removeFromParent();
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  geometries.clear();materials.clear();
 }

 return{root,update,dispose};
}
