import * as T from 'three';
import {BUILDINGS,type BuildingSpec} from '../model/campusParameters';

/**
 * The four-tower finale (master roadmap Workstream 5). On the ADMINISTRATOR beat
 * the ending starts this show beside the dome lift: the window rows of B01–B04
 * light bottom-up in tower order, additive beams join the four inner courtyard
 * corners into a mesh, and the atrium ring expands across the courtyard.
 *
 * The bay layout comes from the authored tower parameters, but the face planes
 * come from the towers as they are actually built: the rendered shells stand up
 * to 6 m proud of the authored envelopes (B04's west face, B01's courtyard
 * face), and a quad placed at the authored plane is then buried inside the
 * façade and the depth test hides the whole show. Measuring the shell keeps the
 * windows outside whatever the model does. One material per family (windows /
 * links / ring), additive blending, no lights and no shadows.
 *
 * The spec is explicit: no beam converges on a central core, and there is no
 * single central impact. The two diagonals therefore sit at different heights and
 * the ring is the only thing at the courtyard centre.
 *
 * DOM-free and clock-driven by `update(dt)` so a headless check can seek it.
 */

export const FINALE_TIMELINE={
 /** Seconds between one tower starting and the next. */
 towerStagger:.7,
 /** A tower's rows go bottom-up over this long. */
 rowSpan:1.5,
 /** Left-to-right delay inside one row, so a row is a sweep and not a hard band. */
 rowWave:.18,
 /** A window fades in over this long. */
 fade:.3,
 /** First tower-to-tower beam. */
 linkAt:3.3,
 linkStagger:.22,
 linkGrow:.45,
 /** The atrium ring starts and reaches the far courtyard wall. */
 ringAt:3.9,
 ringSeconds:1.4,
 /** The credits start 6 s after the release beat; the show is finished before them. */
 total:5.6,
} as const;

/** The four courtyard corners in world metres; the four towers surround it. */
const COURTYARD={x:0,z:36};
const TOWER_ORDER=['B01','B02','B03','B04'] as const;
const BAYS=16;
/** Beams clear every roof (the tallest tower is 79.6 m), so the mesh reads from outside the courtyard too. */
const PERIMETER_CLEARANCE=4;
/** The two diagonals sit high enough that they never meet at one point. */
const DIAGONAL_HEIGHTS=[90,96] as const;
const RING_RADIUS=36;
/** How far outside the built shell a window quad sits, so no trim can cover it. */
const SHELL_CLEARANCE=.22;

interface Shell{minX:number;maxX:number;minZ:number;maxZ:number}

/**
 * The four towers as actually rendered, in world metres. Empty in a bare test
 * scene; the caller then falls back to the authored envelopes.
 */
function measureShells(scene:T.Scene){
 const shells=new Map<string,Shell>();
 const wanted=new Set<string>(TOWER_ORDER);
 const box=new T.Box3();
 scene.traverse(object=>{
  if(!wanted.has(object.name))return;
  box.setFromObject(object);
  if(box.isEmpty())return;
  shells.set(object.name,{minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z});
 });
 return shells;
}

const ease=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
const hash=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};

interface WindowPlacement{
 x:number;y:number;z:number;yaw:number;tower:number;at:number;
 r:number;g:number;b:number;
}
interface LinkSpec{a:T.Vector3;b:T.Vector3;at:number;id:string;}
interface TowerMeta{id:string;start:number;total:number;lit:number}

export interface FinaleState{
 running:boolean;
 complete:boolean;
 seconds:number;
 towers:TowerMeta[];
 towersActive:number;
 windowsLit:number;
 windowsTotal:number;
 linksLit:number;
 linksTotal:number;
 ringScale:number;
}

export function createFinaleLightShow(scene:T.Scene){
 const shells=measureShells(scene);
 const root=new T.Group();
 root.name='Finale_lightshow';
 root.userData.dynamicGameplay=true;
 scene.add(root);

 const specs:BuildingSpec[]=TOWER_ORDER.map(id=>BUILDINGS.find(b=>b.id===id)).filter((b):b is BuildingSpec=>!!b);
 const windows:WindowPlacement[]=[];
 const towers:TowerMeta[]=specs.map((spec,index)=>{
  const start=index*FINALE_TIMELINE.towerStagger;
  const rows=Math.max(6,spec.floors-2);
  const floorHeight=spec.height/spec.floors;
  const y0=floorHeight*1.5;
  const y1=spec.height-floorHeight*1.1;
  // All four faces. The courtyard-facing pair is the show from inside; the outer
  // pair matters because the ending plays from the sports hall, where the near
  // towers present their backs to the player and the courtyard is hidden behind.
  // The face planes clear the built shell when it is in the scene; the bay grid
  // stays on the authored span so the windows keep their designed rhythm.
  const shell=shells.get(spec.id);
  const west=shell?shell.minX-SHELL_CLEARANCE:spec.x-spec.width/2-.12;
  const east=shell?shell.maxX+SHELL_CLEARANCE:spec.x+spec.width/2+.12;
  const south=shell?shell.maxZ+SHELL_CLEARANCE:spec.z+spec.depth/2+.12;
  const north=shell?shell.minZ-SHELL_CLEARANCE:spec.z-spec.depth/2-.12;
  const faces=[
   {axis:'x' as const,fixed:east,span:spec.depth,centre:spec.z,yaw:Math.PI/2},
   {axis:'x' as const,fixed:west,span:spec.depth,centre:spec.z,yaw:-Math.PI/2},
   {axis:'z' as const,fixed:south,span:spec.width,centre:spec.x,yaw:0},
   {axis:'z' as const,fixed:north,span:spec.width,centre:spec.x,yaw:Math.PI},
  ];
  const before=windows.length;
  for(let row=0;row<rows;row++){
   const y=y0+(y1-y0)*(rows===1?0:row/(rows-1));
   for(const face of faces){
    for(let bay=0;bay<BAYS;bay++){
     const f=(bay+.5)/BAYS;
     const along=face.centre+(f-.5)*face.span;
     const seed=hash(windows.length*1.73+index*11.3);
     const cool=seed>.86;
     const warm=.12*hash(windows.length*2.11);
     windows.push({
      x:face.axis==='x'?face.fixed:along,
      y,
      z:face.axis==='x'?along:face.fixed,
      yaw:face.yaw,
      tower:index,
      at:start+(row/Math.max(1,rows-1))*FINALE_TIMELINE.rowSpan+f*FINALE_TIMELINE.rowWave,
      r:cool?.62:1,
      g:cool?.92:.74+warm,
      b:cool?1:.42+warm,
     });
    }
   }
  }
  return{id:spec.id,start,total:windows.length-before,lit:0};
 });

 const windowGeometry=new T.PlaneGeometry(1,1);
 const windowMaterial=new T.MeshBasicMaterial({
  color:0xffffff,transparent:true,opacity:1,blending:T.AdditiveBlending,
  depthWrite:false,side:T.DoubleSide,toneMapped:false,
 });
 const windowMesh=new T.InstancedMesh(windowGeometry,windowMaterial,windows.length);
 windowMesh.name='Finale_windows';
 windowMesh.frustumCulled=false;
 windowMesh.castShadow=false;
 windowMesh.receiveShadow=false;
 {
  const matrix=new T.Matrix4(),position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3();
  const axis=new T.Vector3(0,1,0),black=new T.Color(0,0,0);
  windows.forEach((w,index)=>{
   position.set(w.x,w.y,w.z);
   quaternion.setFromAxisAngle(axis,w.yaw);
   // Plane units: one bay is ~3.5 m of façade, so a lit pane reads as a window.
   const tower=specs[w.tower];
   const span=Math.abs(w.yaw)===Math.PI/2?tower.depth:tower.width;
   scale.set(span/BAYS*.62,Math.min(2.5,tower.height/tower.floors*.46),1);
   matrix.compose(position,quaternion,scale);
   windowMesh.setMatrixAt(index,matrix);
   windowMesh.setColorAt(index,black);
  });
  windowMesh.instanceMatrix.needsUpdate=true;
  if(windowMesh.instanceColor)windowMesh.instanceColor.needsUpdate=true;
 }
 root.add(windowMesh);

 // The four courtyard corners, derived from the same authored specs.
 const corners:number[][]=specs.map(spec=>{
  const signX=spec.x<COURTYARD.x?1:-1,signZ=spec.z<COURTYARD.z?1:-1;
  return[spec.x+signX*spec.width/2,spec.z+signZ*spec.depth/2];
 });
 const cornerAt=(index:number,y:number)=>new T.Vector3(corners[index][0],y,corners[index][1]);
 const roofClear=(index:number)=>specs[index].height+PERIMETER_CLEARANCE;
 const perimeterY=(a:number,b:number)=>Math.max(roofClear(a),roofClear(b));
 const linkSpecs:LinkSpec[]=[
  {id:'B01-B02',a:cornerAt(0,perimeterY(0,1)),b:cornerAt(1,perimeterY(0,1)),at:FINALE_TIMELINE.linkAt},
  {id:'B02-B03',a:cornerAt(1,perimeterY(1,2)),b:cornerAt(2,perimeterY(1,2)),at:FINALE_TIMELINE.linkAt+FINALE_TIMELINE.linkStagger},
  {id:'B03-B04',a:cornerAt(2,perimeterY(2,3)),b:cornerAt(3,perimeterY(2,3)),at:FINALE_TIMELINE.linkAt+FINALE_TIMELINE.linkStagger*2},
  {id:'B04-B01',a:cornerAt(3,perimeterY(3,0)),b:cornerAt(0,perimeterY(3,0)),at:FINALE_TIMELINE.linkAt+FINALE_TIMELINE.linkStagger*3},
  // Opposite towers complete the mesh; different heights, so there is no central node.
  {id:'B01-B03',a:cornerAt(0,DIAGONAL_HEIGHTS[0]),b:cornerAt(2,DIAGONAL_HEIGHTS[0]),at:FINALE_TIMELINE.linkAt+FINALE_TIMELINE.linkStagger*4},
  {id:'B02-B04',a:cornerAt(1,DIAGONAL_HEIGHTS[1]),b:cornerAt(3,DIAGONAL_HEIGHTS[1]),at:FINALE_TIMELINE.linkAt+FINALE_TIMELINE.linkStagger*5},
 ];
 const linkGeometry=new T.CylinderGeometry(1,1,1,6,1,true);
 const linkMaterial=new T.MeshBasicMaterial({
  color:0x86f2dc,transparent:true,opacity:.72,blending:T.AdditiveBlending,
  depthWrite:false,side:T.DoubleSide,toneMapped:false,
 });
 const links=linkSpecs.map((spec,index)=>{
  const direction=spec.b.clone().sub(spec.a);
  const length=direction.length();
  const mesh=new T.Mesh(linkGeometry,linkMaterial);
  mesh.name='Finale_link-'+index;
  mesh.userData.linkId=spec.id;
  mesh.position.copy(spec.a);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());
  mesh.scale.set(.42,.0001,.42);
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.frustumCulled=false;
  root.add(mesh);
  return{mesh,a:spec.a.clone(),direction:direction.clone(),length,at:spec.at,id:spec.id};
 });

 const ringGeometry=new T.TorusGeometry(RING_RADIUS,.55,8,96);
 const ringMaterial=new T.MeshBasicMaterial({
  color:0x74e6b4,transparent:true,opacity:0,blending:T.AdditiveBlending,
  depthWrite:false,side:T.DoubleSide,toneMapped:false,
 });
 const ring=new T.Mesh(ringGeometry,ringMaterial);
 ring.name='Finale_atrium_ring';
 ring.position.set(COURTYARD.x,2.6,COURTYARD.z);
 ring.rotation.x=Math.PI/2;
 ring.scale.setScalar(.001);
 ring.castShadow=false;
 ring.receiveShadow=false;
 ring.frustumCulled=false;
 root.add(ring);

 let running=false,complete=false,colorsSettled=false;
 let elapsed=0,windowsLit=0,linksLit=0,ringScale=0;
 const color=new T.Color();

 function applyColors(){
  if(colorsSettled)return;
  let lit=0;
  for(const tower of towers)tower.lit=0;
  for(let i=0;i<windows.length;i++){
   const w=windows[i];
   const s=ease((elapsed-w.at)/FINALE_TIMELINE.fade);
   color.setRGB(w.r*s,w.g*s,w.b*s);
   windowMesh.setColorAt(i,color);
   if(s>0){lit++;towers[w.tower].lit++;}
  }
  windowsLit=lit;
  if(windowMesh.instanceColor)windowMesh.instanceColor.needsUpdate=true;
  if(elapsed>=FINALE_TIMELINE.towerStagger*(specs.length-1)+FINALE_TIMELINE.rowSpan+FINALE_TIMELINE.rowWave+FINALE_TIMELINE.fade)colorsSettled=true;
 }

 function apply(){
  applyColors();
  linksLit=0;
  for(const link of links){
   const p=ease((elapsed-link.at)/FINALE_TIMELINE.linkGrow);
   if(p>0)linksLit++;
   const length=Math.max(.0001,link.length*p);
   link.mesh.scale.set(.42,length,.42);
   link.mesh.position.copy(link.a).addScaledVector(link.direction,length/2);
  }
  ringScale=ease((elapsed-FINALE_TIMELINE.ringAt)/FINALE_TIMELINE.ringSeconds);
  ring.scale.setScalar(.001+.999*ringScale);
  ringMaterial.opacity=.9*ringScale;
 }

 function settle(){
  elapsed=FINALE_TIMELINE.total;
  complete=true;running=false;
  applyColors();apply();
 }

 return{
  root,
  start(){
   if(complete)return;
   if(!running)running=true;
  },
  /** Fast-forward to a beat; used by the headless check and a restore after the credits. */
  seek(seconds:number){
   elapsed=Math.max(0,Math.min(FINALE_TIMELINE.total,seconds));
   if(elapsed>=FINALE_TIMELINE.total){settle();return;}
   running=elapsed<FINALE_TIMELINE.total;
   apply();
  },
  update(dt:number){
   if(!running||complete)return;
   elapsed+=Math.max(0,dt);
   if(elapsed>=FINALE_TIMELINE.total){settle();return;}
   apply();
  },
  state():FinaleState{
   return{
    running,complete,seconds:elapsed,
    towers:towers.map(t=>({...t})),
    towersActive:towers.filter(t=>elapsed>=t.start).length,
    windowsLit,windowsTotal:windows.length,
    linksLit,linksTotal:links.length,
    ringScale,
   };
  },
  dispose(){
   root.removeFromParent();
   windowGeometry.dispose();windowMaterial.dispose();
   linkGeometry.dispose();linkMaterial.dispose();
   ringGeometry.dispose();ringMaterial.dispose();
  },
 };
}

export type FinaleShow=ReturnType<typeof createFinaleLightShow>;
