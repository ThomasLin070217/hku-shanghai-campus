import {campusFont as font,campusSignFont as signFont} from './fonts';
import {tagChildren,mergedTraces} from '../scene/authoring';
import * as THREE from 'three';
import {glassMaterial,pane,shallowDepth,GLAZING_DEPTH as GD} from './glazing';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';


import { DEFAULT_PARAMETERS, validateParameters, type ModelParameters } from './parameters';



const mat=(name:string,color:number,roughness=.6,metalness=.08)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
const palette=()=>({
  core:mat('Opaque facade backing',0x43545a), glass:glassMaterial('office'),
  glassLight:glassMaterial('clear'),glassDark:glassMaterial('reflective'),
  silver:mat('Warm silver aluminium',0xd9dedb,.42,.35), frame:mat('Slender anodised mullions',0x8fabae,.38,.40),
  white:mat('Entrance lettering',0xf4f1e5),roof:mat('Roof membrane',0x7c9093),equipment:mat('Roof equipment',0xa9b6b4),
  concrete:mat('Light grey paving',0xbac0b9,.93), pavement:mat('Paving joints',0x919b97,.94),
  asphalt:mat('Road surface',0x727e7b,.95),line:mat('Road yellow',0xc6ac50,.85),
  grass:mat('Muted lawn',0x8eaa78,.98),leaf:mat('Tree foliage',0x6e8d69,1),leaf2:mat('Tree light foliage',0x8ea779,1),
  hedge:mat('Low planting',0x758b56,1),bark:mat('Tree bark',0x6e6954,1),
  context:mat('Context building',0xc6ceca,.85),contextGlass:mat('Context glazing',0x9eafb0,.7),
  black:mat('CDS-1 wayfinding',0x183135,.6),sign:mat('Wayfinding text',0xc4ded8),
});
type Palette=ReturnType<typeof palette>;
function group(name:string,parent:THREE.Object3D,confidence:string,source:string){
  const g=new THREE.Group();g.name=name;g.userData={confidence,source};parent.add(g);return g;
}
function box(g:THREE.Object3D,name:string,size:number[],pos:number[],m:THREE.Material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),m);
  mesh.name=name;mesh.position.set(...pos as [number,number,number]);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
}
function text3d(g:THREE.Object3D,label:string,size:number,x:number,y:number,z:number,m:THREE.Material){
  const geom=new TextGeometry(label,{font:/[\u3400-\u9fff]/.test(label)?signFont:font,size,depth:.025,curveSegments:2,bevelEnabled:false});geom.computeBoundingBox();
  geom.translate(-.5*(geom.boundingBox!.max.x-geom.boundingBox!.min.x),0,0);
  const mesh=new THREE.Mesh(geom,m);mesh.position.set(x,y,z);mesh.name=label;g.add(mesh);return mesh;
}
function cylinder(g:THREE.Object3D,name:string,r:number,h:number,pos:number[],m:THREE.Material,segments=12){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),m);mesh.name=name;mesh.position.set(...pos as [number,number,number]);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
}

/** Merge repeated primitives by material *within* each named semantic group.
 * The GLB retains component groups, while reducing draw calls. All faces are geometry. */
export function compact(g:THREE.Group){
  tagChildren(g);
  for(const child of [...g.children]) if(child instanceof THREE.Group) compact(child);
  const buckets=new Map<THREE.Material,THREE.Mesh[]>();
  for(const c of g.children) if(c instanceof THREE.Mesh && !Array.isArray(c.material)){
    const a=buckets.get(c.material)||[];a.push(c);buckets.set(c.material,a);
  }
  for(const [material,meshes] of buckets){
    if(meshes.length<2)continue;
    // Curved rails and revolving leaves need separate transparent sorting. Coplanar panes still merge.
    if(material.userData.surfaceRole==='glass'&&meshes.some(m=>Math.abs(m.quaternion.dot(meshes[0].quaternion))<.99999))continue;
    const geometries=meshes.map(m=>{m.updateMatrix();const geom=m.geometry.clone().applyMatrix4(m.matrix);if(!geom.index)return geom;const flat=geom.toNonIndexed();geom.dispose();return flat;});
    const geometry=mergeGeometries(geometries,false);
    geometries.forEach(x=>x.dispose());
    if(!geometry)throw new Error(`Cannot merge ${g.name}`);
    geometry.computeBoundingSphere();
    const combined=new THREE.Mesh(geometry,material);combined.name=`${g.name}__${material.name}`;
    combined.castShadow=material.userData.surfaceRole!=='glass';combined.receiveShadow=material.userData.surfaceRole!=='glass';combined.userData={...g.userData,...meshes[0].userData,primitiveCount:meshes.reduce((n,m)=>n+(m.userData.primitiveCount??1),0),authorParts:mergedTraces(meshes)};
    meshes.forEach(m=>{g.remove(m);m.geometry.dispose();});g.add(combined);
  }
}
export interface CampusAsset {root:THREE.Group;building:THREE.Group;environment:THREE.Group;ground:THREE.Group;parameters:ModelParameters}
export function buildCampus(parameters:ModelParameters={...DEFAULT_PARAMETERS}):CampusAsset{
  const p={...parameters};validateParameters(p);const M=palette();M.core.userData.surfaceRole='opaque-backing';
  const root=new THREE.Group();root.name='HKU_Shanghai_CDS1';root.userData={version:'1.0.0',units:'metres',up:'Y',entrance:'+Z (local, not surveyed north)',status:'Evidence-based visual prototype; dimensions provisional',parameters:p};
  const building=group('CDS1_Building',root,'mixed','R01,R02,R04; see references/MODELING_BASIS.md');
  building.userData={...building.userData,units:'metres',up:'Y',parameters:p,version:'1.0.0',dimensionsStatus:'provisional'};
  const mass=group('01_MainBody',building,'inferred','R02,R04');
  const glass=group('02_Glass',building,'confirmed-rhythm_estimated-count','R01,R02');
  const columns=group('03_Columns_and_Fins',building,'confirmed-rhythm_estimated-count','R01,R02');
  const bands=group('04_FloorBands',building,'inferred','R02; floors are provisional');
  const entrance=group('05_Entrance',building,'confirmed-form_estimated-dimensions','R01');
  const canopy=group('06_Canopy',building,'confirmed-form_estimated-dimensions','R01');
  const roof=group('07_Roof',building,'provisional-equipment-layout','R04 target rear tower');
  const signage=group('08_Signage',building,'confirmed-text_simplified-typography','R01');
  const environment=group('Environment',root,'provisional-layout','R01,R02,R04');
  const ground=group('Ground',environment,'provisional','R01');
  const landscape=group('Landscape',environment,'stylised','R01');
  const context=group('Neighbour_Context',environment,'schematic_only','R02 auditorium direction; no claimed accurate connection');
  const W=p.width,D=p.depth,H=p.height,y0=p.plinthHeight,R=p.sideRecessWidth,S=p.sideRecessDepth;
  const floorH=(H-p.roofScreenHeight)/p.floors;
  // H-like footprint: two broad bars joined by an inset glazed centre.
  const wingD=(D-R)/2;
  for(const s of [-1,1]) box(mass,`Wing_${s}`,[W-2*GD.facade,H,wingD-2*GD.facade],[0,y0+H/2,s*(D+R)/4],M.core);
  box(mass,'Recessed_centre',[W-2*S-2*GD.facade,H,R-2*GD.facade],[0,y0+H/2,0],M.core);
  box(mass,'Foundation',[W+.35,y0,D+.35],[0,y0/2,0],M.concrete);
  // Scale the visible broad/slender bands with floor count; top band includes screen.
  const levels=[0,2,5,7,10,12,14].map(i=>i/14*p.floors*floorH);levels[levels.length-1]=H;
  // Facade local horizontal axis U; +normal always points outward.
  function facade(name:string,length:number,origin:THREE.Vector3,u:THREE.Vector3,n:THREE.Vector3,bays:number,recess=false,front=false){
    const bay=length/bays;
    const faceGlass=group(name+'_Glass_plane',glass,'visible-glass_material-inferred',front?'R01,U03-0009':'R02,U03-0052');
    const depthGroup=group(name+'_Depth',mass,'provisional-shallow-depth','R01,U03-0052');
    depthGroup.position.copy(origin);depthGroup.position.y=y0;depthGroup.rotation.y=Math.atan2(n.x,n.z);
    if(front){const sideWidth=(length-p.entranceWidth)/2;for(const side of [-1,1]){const d=new THREE.Group();d.position.x=side*(p.entranceWidth/2+sideWidth/2);depthGroup.add(d);shallowDepth(d,sideWidth,floorH-.1,GD.facade,Math.round(sideWidth/bay),true);}}else shallowDepth(depthGroup,length,floorH-.1,GD.facade,bays,true);
    // Floor edges behind upper windows give parallax without inventing rooms.
    for(let f=1;f<p.floors;f++){if(front&&f*floorH<p.entranceHeight){const w=(length-p.entranceWidth)/2;for(const side of [-1,1])box(depthGroup,'Recess_floor_edge',[w,.16,GD.facade],[side*(p.entranceWidth/2+w/2),f*floorH,-GD.facade/2],M.core);}else box(depthGroup,'Recess_floor_edge',[length,.16,GD.facade],[0,f*floorH,-GD.facade/2],M.core);}

    const put=(target:THREE.Object3D,nm:string,uw:number,hh:number,dd:number,uc:number,y:number,offset:number,m:THREE.Material)=>{
      const pos=origin.clone().addScaledVector(u,uc).addScaledVector(n,offset);pos.y=y+y0;
      if(m.userData.surfaceRole==='glass')return pane(target,`${name}_${nm}`,uw,hh,pos.x,pos.y,pos.z,m,Math.atan2(n.x,n.z));
      return box(target,`${name}_${nm}`,n.z!==0?[uw,hh,dd]:[dd,hh,uw],[pos.x,pos.y,pos.z],m);
    };
    for(let f=0;f<p.floors;f++){
      const base=f*floorH;
      for(let b=0;b<bays;b++){
        const uc=-length/2+(b+.5)*bay;
        if(front&&f<2&&Math.abs(uc-p.entranceX)<p.entranceWidth/2)continue;
        const k=(b*7+f*3+(front?1:0))%13;
        put(faceGlass,`window_${f}_${b}`,bay-.12,floorH-.16,.10,uc,base+floorH/2,.065,f===0?M.glassLight:k===6?M.glassDark:M.glass);
        put(bands,`spandrel_${f}_${b}`,bay-.1,.48,.12,uc,base+.27,.13,M.core);
      }
      put(bands,`floor_${f}`,length,.075,.13,0,base,.16,M.frame);
    }
    // Glazed rooftop screen continues the top band; equipment sits below/behind it.
    for(let b=0;b<bays;b++)put(faceGlass,`roof_screen_${b}`,bay-.12,p.roofScreenHeight,.10,-length/2+(b+.5)*bay,H-p.roofScreenHeight/2,.065,M.glassDark);
    // Thin full-height mullions are retained behind decorative multi-storey fins.
    for(let b=0;b<=bays;b++){
      const uc=-length/2+b*bay;
      if(front&&Math.abs(uc-p.entranceX)<p.entranceWidth/2)put(columns,`mullion_${b}`,.09,H-p.entranceHeight,.15,uc,(H+p.entranceHeight)/2,.16,M.frame);
      else put(columns,`mullion_${b}`,.09,H,.15,uc,H/2,.16,M.frame);
    }
    if(recess)return;
    for(let t=0;t<levels.length-1;t++){
      const bottom=levels[t],top=levels[t+1];
      for(let b=0;b<=bays;b++){
        const uc=-length/2+b*bay;
        if(front&&t===0&&Math.abs(uc-p.entranceX)<p.entranceWidth/2)continue;
        const wide=t%2===1;
        put(columns,`fin_${t}_${b}`,wide?p.wideFin:p.narrowFin,top-bottom-.12,p.finProjection,uc,(top+bottom)/2,p.finProjection/2+.16,M.silver);
      }
      put(bands,`major_band_${t}`,length+.5,p.bandThickness,.60,0,top,.24,M.silver);
    }
  }
  facade('Entrance_elevation',W,new THREE.Vector3(0,0,D/2),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1),p.frontBays,false,true);
  facade('Rear_elevation_PROVISIONAL',W,new THREE.Vector3(0,0,-D/2),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),p.frontBays);
  for(const s of [-1,1]){
    for(const wing of [-1,1])facade(`Side_${s}_wing_${wing}`,wingD,new THREE.Vector3(s*W/2,0,wing*(D+R)/4),new THREE.Vector3(0,0,1),new THREE.Vector3(s,0,0),Math.round(p.sideBays*wingD/D));
    facade(`Side_${s}_recess`,R,new THREE.Vector3(s*(W/2-S),0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(s,0,0),4,true);
    for(const r of [-1,1])facade(`Side_${s}_return_${r}`,S,new THREE.Vector3(s*(W/2-S/2),0,r*R/2),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-r),2,true);
  }
  // Front portal: no tall stair from the separate auditorium is attached here.
  const ex=p.entranceX,front=D/2+.23;
  const lobby=new THREE.Group();lobby.name='Lobby_visual_recess_PROVISIONAL';lobby.position.set(ex,y0,front);entrance.add(lobby);
  shallowDepth(lobby,p.entranceWidth,p.entranceHeight,GD.lobby,8,true);box(lobby,'Lobby_rear_shadow_PROVISIONAL',[p.doorWidth*.82,p.doorHeight+.6,.06],[0,(p.doorHeight+.6)/2,-GD.lobby+.10],M.core);
  const flank=(p.entranceWidth-p.doorWidth)/2;
  for(const side of [-1,1])pane(entrance,'Portal_side_glass',flank,p.entranceHeight,ex+side*(p.doorWidth/2+flank/2),y0+p.entranceHeight/2,front,M.glass);
  pane(entrance,'Portal_upper_glass',p.doorWidth,p.entranceHeight-p.doorHeight,ex,y0+(p.doorHeight+p.entranceHeight)/2,front,M.glassLight);
  // Observed ceiling arches simplified to rectangular light ribs; depth is provisional.
  const light=mat('Night_lobby_arch_light',0xe6d4af);light.emissive.setHex(0xffdfac);light.userData.nightIntensity=1.8;
  for(const z of [-.6,-1.4,-2.2]){box(lobby,'Lobby_light_crossbar',[p.entranceWidth*.58,.065,.065],[0,p.entranceHeight-1.0,z],light);for(const side of [-1,1])box(lobby,'Lobby_light_return',[.065,1.2,.065],[side*p.entranceWidth*.29,p.entranceHeight-1.6,z],light);}

  for(const s of [-1,1])box(entrance,'Portal_jamb',[.55,p.entranceHeight,.85],[ex+s*p.entranceWidth/2,y0+p.entranceHeight/2,front+.12],M.silver);
  box(entrance,'Portal_header',[p.entranceWidth+.55,.4,1.0],[ex,y0+p.entranceHeight,front+.2],M.silver);
  for(let i=-4;i<=4;i++)box(entrance,'Lobby_mullion',[.09,p.entranceHeight,.12],[ex+i*p.entranceWidth/8,y0+p.entranceHeight/2,front+.13],M.frame);
  box(entrance,'Lobby_transom',[p.entranceWidth,.1,.13],[ex,y0+5.6,front+.16],M.frame);
  const doorSideWidth=(p.doorWidth-2*p.revolvingRadius)/2,doorSideCenter=p.revolvingRadius+doorSideWidth/2;
  for(const s of [-1,1]){
    pane(entrance,'Closed_side_door_glass',doorSideWidth,p.doorHeight,ex+s*doorSideCenter,y0+p.doorHeight/2,front+.20,M.glassLight);
    for(const x of [s*p.revolvingRadius,s*p.doorWidth/2])box(entrance,'Door_jamb',[.10,p.doorHeight,.19],[ex+x,y0+p.doorHeight/2,front+.25],M.silver);
    box(entrance,'Door_lintel',[doorSideWidth+.1,.10,.19],[ex+s*doorSideCenter,y0+p.doorHeight,front+.25],M.silver);
    box(entrance,'Door_handle',[.06,.85,.12],[ex+s*(p.revolvingRadius+.3),y0+1.5,front+.35],M.silver);
  }
  const rot=group('Revolving_door',entrance,'confirmed-type','R01');
  const rr=p.revolvingRadius,dh=p.doorHeight;
  cylinder(rot,'Door_cap',rr,.12,[ex,y0+dh,front+.8],M.silver,20);
  cylinder(rot,'Door_base',rr,.06,[ex,y0+.03,front+.8],M.silver,20);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;pane(rot,'Closed_revolving_leaf_glass',rr,dh-.18,ex+Math.sin(a)*rr/2,y0+dh/2,front+.8+Math.cos(a)*rr/2,M.glassLight,a-Math.PI/2);
    cylinder(rot,'Door_post',.045,dh,[ex+Math.sin(a)*rr,y0+dh/2,front+.8+Math.cos(a)*rr],M.silver,6);
  }
  cylinder(rot,'Door_axis',.06,dh,[ex,y0+dh/2,front+.8],M.silver,8);
  box(canopy,'Thin_canopy',[p.canopyWidth,.25,p.canopyDepth],[ex,y0+p.canopyHeight,front+p.canopyDepth/2],M.silver);
  for(let i=0;i<=14;i++)box(canopy,'Canopy_rib',[.08,.08,p.canopyDepth],[ex-p.canopyWidth/2+i*p.canopyWidth/14,y0+p.canopyHeight+.16,front+p.canopyDepth/2],M.frame);
  for(const s of [-1,1]){
    const px=ex+s*(p.canopyWidth/2-.5),pz=front+p.canopyDepth+1;
    cylinder(landscape,'Entrance_security_pole',.055,p.canopyHeight,[px,p.canopyHeight/2,pz],M.frame,8);
    box(landscape,'Security_camera_simplified',[.18,.13,.4],[px,p.canopyHeight,pz+.14],M.silver);
  }
  box(entrance,'Shallow_threshold',[p.doorWidth+3,.12,2.8],[ex,.06,front+1.4],M.concrete);
  text3d(signage,'香 港 大 学',1.0,ex,y0+7.4,front+.31,M.white);
  text3d(signage,'计算与数据科学学院',.9,ex,y0+6.25,front+.31,M.white);
  box(signage,'CDS1_wayfinding',[.75,2.65,.20],[ex+p.canopyWidth/2+1.4,1.325,front+5.9],M.black);
  text3d(signage,'CDS-1',.19,ex+p.canopyWidth/2+1.4,2.19,front+6.02,M.sign);
  text3d(signage,'HKU',.15,ex+p.canopyWidth/2+1.4,.4,front+6.02,M.sign);
  // Roof screen runs around the outline; compact conservative equipment volumes.
  const topY=y0+H;
  for(const z of [-1,1])box(roof,'Roof_parapet_long',[W,.62,.24],[0,topY-.31,z*(D/2-.15)],M.silver);
  for(const x of [-1,1])for(const z of [-1,1])box(roof,'Roof_parapet_side',[.24,.62,wingD],[x*(W/2-.15),topY-.31,z*(D+R)/4],M.silver);
  for(const z of [-1,1])box(roof,'Roof_surface',[W-.8,.18,wingD-.6],[0,topY-p.roofScreenHeight,z*(D+R)/4],M.roof);
  box(roof,'Roof_centre_surface',[W-2*S-.4,.18,R],[0,topY-p.roofScreenHeight,0],M.roof);
  // Close top of core sits below the screen rather than occluding rooftop machinery.
  for(const child of mass.children) if(child instanceof THREE.Mesh&&child.name!=='Foundation'){
    child.scale.y=(H-p.roofScreenHeight)/H;child.position.y=y0+(H-p.roofScreenHeight)/2;
  }
  for(const [i,x] of [-15,-5,6,16].entries()){
    const eh=i%2===0?4:2.5;
    box(roof,'Equipment_PROVISIONAL',[7,eh,6],[x,topY-p.roofScreenHeight+eh/2,-2+(i%2)*7],M.equipment);
    for(let j=0;j<5;j++)box(roof,'Vent_louvre',[6.4,.07,.12],[x,topY-p.roofScreenHeight+.4+j*.42,1.08+(i%2)*7],M.roof);
  }
  buildEnvironment(p,M,ground,landscape,context);
  compact(root);return{root,building,environment,ground,parameters:p};
}
function buildEnvironment(p:ModelParameters,M:Palette,ground:THREE.Group,landscape:THREE.Group,context:THREE.Group){
  const D=p.depth,W=p.width,edge=D/2;
  box(ground,'Site_plinth',[p.environmentSize,.8,D+48],[-10,-.45,0],M.concrete);
  box(ground,'Entrance_paving',[W+12,.10,12],[0,-.01,edge+6],M.concrete);
  box(ground,'Arrival_lane',[p.environmentSize,.06,8],[0,-.01,edge+16],M.asphalt);
  for(let x=-p.environmentSize/2+5;x<p.environmentSize/2;x+=9)box(ground,'Lane_dash',[4,.02,.12],[x,.03,edge+16],M.line);
  for(const s of [12,20])box(ground,'Kerb_line',[p.environmentSize,.13,.23],[0,.02,edge+s],M.concrete);
  for(let x=-W/2-6;x<=W/2+6;x+=3)box(ground,'Paving_joint',[.035,.01,11.8],[x,.05,edge+6],M.pavement);
  for(let z=edge+1;z<edge+12;z+=1.6)box(ground,'Paving_joint',[W+12,.01,.035],[0,.05,z],M.pavement);
  for(const s of [-1,1]){
    box(landscape,'Entrance_planting_bed',[17,.22,5.8],[s*(p.entranceWidth/2+10),.08,edge+4.1],M.grass);
    for(let i=0;i<6;i++){
      const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(1.1,0),i%2?M.hedge:M.leaf2);shrub.position.set(s*(p.entranceWidth/2+3+i*2.6),.7,edge+3.2);shrub.scale.set(1.25,.65,1);shrub.castShadow=true;landscape.add(shrub);
    }
  }
  function tree(x:number,z:number,h:number){
    cylinder(landscape,'Tree_trunk',.15,h*.68,[x,h*.34,z],M.bark,6);
    for(let j=0;j<3;j++){
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.25,1),j%2?M.leaf:M.leaf2);crown.position.set(x+(j-1)*.55,h*.68+j*.4,z+(j%2)*.5);crown.scale.set(1,1.2,1);crown.castShadow=true;landscape.add(crown);
    }
  }
  for(const x of [-39,-26,26,39])tree(x,edge+7,5.3+(Math.abs(x)%3)*.3);
  for(const z of [-19,-7,6])tree(-W/2-7,z,6.2);
  // Small schematic neighbour on the auditorium side. Detached intentionally:
  // references show an elevated auditorium nearby, but do not establish a CDS-1 bridge joint.
  const cx=-W/2-p.contextGap-12,cz=-8;
  box(context,'Adjacent_auditorium_schematic',[23,p.contextHeight,17],[cx,p.contextHeight/2,cz],M.context);
  box(context,'Adjacent_glazing',[21,p.contextHeight-3,.12],[cx,p.contextHeight/2,cz+8.55],M.contextGlass);
  for(let i=0;i<9;i++)box(context,'Context_mullions',[.14,p.contextHeight-3,.2],[cx-10+i*2.5,p.contextHeight/2,cz+8.7],M.context);
  for(let i=0;i<8;i++)box(context,'Context_steps',[20,.4*(8-i),1.8],[cx,.2*(8-i),cz+9.5+i*1.8],M.concrete);
}
/** Dispose an owned subtree, excluding resources retained by another root.
 * Reflection render targets are owned by the viewer, never by model materials. */
export function disposeAsset(asset:THREE.Object3D, retained?:THREE.Object3D){
  function resources(root:THREE.Object3D){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    root.traverse(o=>{const drawable=o as THREE.Mesh;
      if(drawable.geometry)geometries.add(drawable.geometry);
      if(drawable.material)for(const m of Array.isArray(drawable.material)?drawable.material:[drawable.material])materials.add(m);
    });
    const seen=new Set<object>();
    function collect(v:unknown){if(v instanceof THREE.Texture){if(!v.isRenderTargetTexture)textures.add(v);return;}
      if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);
      if(Array.isArray(v))v.forEach(collect);else for(const x of Object.values(v))collect(x);
    }
    materials.forEach(m=>{for(const v of Object.values(m))if(v instanceof THREE.Texture)collect(v);if(m instanceof THREE.ShaderMaterial)collect(m.uniforms);});
    return {geometries,materials,textures};
  }
  const owned=resources(asset),keep=retained?resources(retained):null;
  for(const kind of ['textures','geometries','materials'] as const)for(const value of owned[kind])if(!(keep?.[kind] as Set<unknown>|undefined)?.has(value))value.dispose();
}
export function modelStats(root:THREE.Object3D){
  let triangles=0,meshes=0;root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
  const b=new THREE.Box3().setFromObject(root);return{triangles,meshes,size:b.getSize(new THREE.Vector3()).toArray(),min:b.min.toArray(),max:b.max.toArray()};
}
