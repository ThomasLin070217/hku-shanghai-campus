import {addHallSign} from './hallSign';
import {cutOpeningBuildings} from '../opening/geometry';
import {createOpeningWorld} from '../opening/world';
import {tagChildren} from '../scene/authoring';
import {LAWN_SIGN,lawnLetterGeometry,OCULUS,oculusDeckGeometry,addVideoFollowup} from './videoFollowup';
import {campusFont as font} from './fonts';
import {sceneRegistry} from '../scene/registry';
import {driveSections,centralWalkLayout,subtractRects,OPENING_STAIR_PASSAGE as SP,stairPassageSlabBottom} from './groundLayout';
import {decorateCampusLobby} from './observedInteriors';
import {addNov14Details} from './nov14Details';
import {addObservedCourtyard} from './courtyard';
import {addLandscapeDetails} from './landscapeDetails';
import {glassMaterial,pane,shallowDepth,clippedPane,GLAZING_DEPTH as GD,GLASS_PROFILES,type Cutout} from './glazing';
import {buildSportsDoor,SPORTS_DOOR,SPORTS_HALL} from './sportsDoor';
import {NOV13 as N} from './nov13Parameters';
import {addNov13Details} from './nov13Details';
import {addVideoDetails} from './videoDetails';
import {voxelizeMaterials} from '../voxel/materials';
import * as T from 'three';
import {COLUMN_X,CALIBRATED_LAYOUT as CL,SCALE_CALIBRATION} from './scaleCalibration';

import {LANDSCAPE as L} from '../exploration/config';

import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';

import {buildCampus,compact,disposeAsset} from './buildCampus';
import {DEFAULT_PARAMETERS} from './parameters';
import {BUILDINGS,SITE,validateCampus,type BuildingSpec,type SiteParameters} from './campusParameters';

const material=(name:string,color:number,roughness=.6,metalness=.15)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
function materials(){return {glass:glassMaterial('office'),dark:glassMaterial('reflective'),clear:glassMaterial('clear'),guard:glassMaterial('guard'),back:material('Opaque structural core',0x47575d),silver:material('Silver facade fins',0xd6dedb,.4,.38),frame:material('Mullion aluminium',0x93aeb2),roof:material('Roof membrane',0x8b9998),concrete:material('Limestone paving',0xc3c7be,.94),white:material('Ivory signage',0xeeeadd),road:material('Asphalt',0x6c7976,.95),grass:material('Lawn',0x8d9f69,1),leaf:material('Tree foliage',0x70885f,1),bark:material('Tree bark',0x796f5b,1),court:material('Sports turf',0x678c72,.95),blue:material('Jogging surface',0x648e97,.9),mesh:material('Fence steel',0x849b9b),equipment:material('Rooftop plant provisional',0xa8b3b0),yellow:material('Road marking',0xcbbb75)};}
type M=ReturnType<typeof materials>;
function group(parent:T.Object3D,name:string,source:string,confidence:string){const g=new T.Group();g.name=name;g.userData={source,confidence};parent.add(g);return g;}
function box(g:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function mesh(g:T.Object3D,name:string,geometry:T.BufferGeometry,m:T.Material){const o=new T.Mesh(geometry,m);o.name=name;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function beam(g:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,m:T.Material,name='Rail'){const v=b.clone().sub(a);const o=mesh(g,name,new T.BoxGeometry(r*2,v.length(),r*2),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
function text(g:T.Object3D,label:string,size:number,x:number,y:number,z:number,m:T.Material){const geo=new TextGeometry(label,{font,size,depth:.06,curveSegments:1});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);const o=mesh(g,label,geo,m);o.position.set(x,y,z);return o;}
function roof(g:T.Object3D,W:number,D:number,H:number,m:M){box(g,'Roof',W,.2,D,0,H-.65,0,m.roof);for(const s of [-1,1]){box(g,'Parapet',W,.65,.22,0,H-.325,s*D/2,m.silver);box(g,'Parapet',.22,.65,D,s*W/2,H-.325,0,m.silver);}
 for(let i=0;i<4;i++){const x=-W*.3+i*W*.2;box(g,'Plant_PROVISIONAL',W*.13,2.2,D*.21,x,H+.4,(i%2-.5)*D*.25,m.equipment);}}
function glazedFace(g:T.Object3D,w:number,h:number,x:number,y:number,z:number,bays:number,floors:number,m:M,turn=false,cut?:Cutout,openHall=false){
 const f=new T.Group();f.name='Glazing_and_grid';g.add(f);f.position.set(x,y,z);f.rotation.y=turn?(x<0?-Math.PI/2:Math.PI/2):(z<0?Math.PI:0);
 const glazing=new T.Group();glazing.name='Glass_plane';f.add(glazing);
 const row=h/floors;
 for(let j=0;j<floors;j++)for(let i=0;i<bays;i++)clippedPane(glazing,'Curtain_pane',-w/2+i*w/bays+.065,-w/2+(i+1)*w/bays-.065,j*row+.09,(j+1)*row-.09,0,j===0||openHall?m.clear:m.glass,cut);
 box(f,'Opaque_facade_backing',w,h,.10,0,h/2,-GD.facade-.08,m.back);const depth=new T.Group();depth.name='Scenic_facade_recess';f.add(depth);shallowDepth(depth,w,openHall?h-.12:row-.12,GD.facade,bays,true);
 for(let i=1;i<floors&&!openHall;i++){box(f,'Opaque_spandrel',w,.42,.14,0,i*row+.20,-.11,m.back);box(depth,'Interior_floor_edge_PROVISIONAL',w,.14,GD.facade,0,i*row,-GD.facade/2,m.back);}
 for(let i=0;i<=bays;i++)box(f,'Mullion',.13,h,.22,-w/2+i*w/bays,h/2,.15,m.frame);
 for(let i=1;i<floors;i++)box(f,'Floor_separator',w,.18,.3,0,i*h/floors,.2,m.silver);
 return f;
}
function featureWindow(g:T.Object3D,name:string,w:number,h:number,x:number,y:number,z:number,m:M){
 const f=new T.Group();f.name=name;f.position.set(x,y-h/2,z);f.rotation.y=z<0?Math.PI:0;g.add(f);
 pane(f,'Reflective_feature_glass',w,h,0,h/2,0,m.dark);shallowDepth(f,w,h,GD.facade,8,false);return f;
}
function frameTower(s:BuildingSpec,m:M){const root=new T.Group();const mass=group(root,'01_MainBody',s.source,'visible-form_estimated-dimensions');const glazing=group(root,'02_Glass',s.source,'inferred-hidden-facades');const fins=group(root,'03_Columns_and_Frames',s.source,'visible-form');const ent=group(root,'05_Entrance',s.source,'conservative-placeholder');const rt=group(root,'07_Roof',s.source,'provisional-layout');const W=s.width,D=s.depth,H=s.height;
 box(mass,'Tower_core',W-2*GD.facade,H-.9,D-2*GD.facade,0,(H-.9)/2,0,m.back);
 const cx=s.id==='B01'?-W*.23:W*.23,fh=H*.56,fy=s.id==='B01'?H*.65:H*.40,fw=W*.38;
 for(const z of [-D/2,D/2]){glazedFace(glazing,W,H,0,0,z+(z>0?.08:-.08),s.bays,s.floors,m,false,{x:cx,y:fy,w:fw,h:fh});for(let i=0;i<=s.bays;i++)box(fins,'Full_height_fin',.24,H,.55,-W/2+i*W/s.bays,H/2,z+(z>0?.35:-.35),m.silver);
 // Large staggered inset window with a white projecting frame, visible on both tower types.
 featureWindow(glazing,'Feature_glass_and_recess',fw,fh,cx,fy,z+(z>0?2.22:-2.22),m);
 for(const a of [-1,1]){box(fins,'Feature_frame_vertical',.9,fh+1.4,3.6,cx+a*fw/2,fy,z+(z>0?1.0:-1.0),m.silver);box(fins,'Feature_frame_horizontal',fw+.9,.85,3.6,cx,fy+a*fh/2,z+(z>0?1.0:-1.0),m.silver);}
 for(let i=1;i<8;i++)box(fins,'Inset_vertical_grid',.10,fh,.20,cx-fw/2+i*fw/8,fy,z+(z>0?2.43:-2.43),m.frame);
 for(let i=1;i<9;i++)box(fins,'Feature_floor',fw,.21,.35,cx,fy-fh/2+i*fh/9,z+(z>0?2.43:-2.43),m.frame);
 }
 for(const x of [-W/2,W/2]){glazedFace(glazing,D,H,x,0,0,Math.round(D/2.4),s.floors,m,true);for(let i=0;i<=Math.round(D/2.4);i++)box(fins,'Side_fin',.5,H,.20,x+(x>0?.25:-.25),H/2,-D/2+i*D/Math.round(D/2.4),m.silver);}
 pane(ent,'Closed_entrance_glass',9,5,0,2.5,D/2+.8,m.clear);const er=new T.Group();er.position.z=D/2+.8;ent.add(er);shallowDepth(er,9,5,GD.facade,4,true);box(ent,'Entrance_canopy',12,.25,3,0,4.2,D/2+1.5,m.silver);roof(rt,W,D,H,m);return root;
}
function amenities(s:BuildingSpec,m:M){const root=new T.Group();const mass=group(root,'01_MainBody',s.source,'confirmed-form_estimated');const gl=group(root,'02_Glass',s.source,'confirmed-grid_estimated-count');const fins=group(root,'03_Fins_and_Floating_Frame',s.source,'confirmed-form');const rt=group(root,'07_Roof',s.source,'inferred-green-roof');const W=s.width,D=s.depth,H=s.height;
 box(mass,'Low_rise_core',W-2*GD.facade,H-.9,D-2*GD.facade,0,(H-.9)/2,0,m.back);
 const fw=W*.72,fh=H*.40,fy=H*.53;
 for(const side of [-1,1]){
  glazedFace(gl,W,H,0,0,side*D/2,s.bays,s.floors,m,false,side<0?{x:0,y:fy,w:fw,h:fh}:undefined);
  for(let i=0;i<=s.bays;i++)for(const tier of [0,1]){
   const x=-W/2+i*W/s.bays,finWidth=tier===0?.4:.7;
   let bottom=H*(tier===0?.01:.52),top=H*(tier===0?.47:.98);
   // A06 shows uninterrupted glazing inside the projecting rectangle.
   // Keep both authored fins, terminating them at the outside frame edges.
   if(side<0&&Math.abs(x)<fw/2+finWidth/2){
    if(tier===0)top=fy-fh/2-.45;
    else bottom=fy+fh/2+.45;
   }
   box(fins,'Low_rise_fins',finWidth,top-bottom,.4,x,(top+bottom)/2,side*(D/2+.25),m.silver);
  }
 }
 for(const side of [-1,1])glazedFace(gl,D,H,side*W/2,0,0,12,s.floors,m,true);
 // North-facing broad floating rectangular window visible from sports area.
 featureWindow(gl,'Floating_glazed_bay',fw,fh,0,fy,-D/2-.5,m);
 for(let i=1;i<18;i++)box(fins,'Floating_window_mullion',.09,fh,.16,-fw/2+i*fw/18,fy,-D/2-.62,m.frame);for(let j=1;j<3;j++)box(fins,'Floating_window_transom',fw,.09,.16,0,fy-fh/2+j*fh/3,-D/2-.62,m.frame);
 for(const k of [-1,1]){box(fins,'Floating_frame',fw+1.2,.9,2.5,0,fy+k*fh/2,-D/2-1.2,m.silver);box(fins,'Floating_frame',.9,fh,2.5,k*fw/2,fy,-D/2-1.2,m.silver);}
 roof(rt,W,D,H,m);box(rt,'Roof_garden',W*.72,.12,D*.55,0,H-.45,0,m.grass);return root;
}
function auditorium(s:BuildingSpec,m:M){const root=new T.Group();const mass=group(root,'01_MainBody',s.source,'confirmed-rectangular-hall');const glass=group(root,'02_Glass',s.source,'confirmed-front');const framing=group(root,'03_Columns',s.source,'confirmed-wide-frame');const ent=group(root,'05_Entrance',s.source,'confirmed-form_estimated-dimensions');const rt=group(root,'07_Roof',s.source,'provisional');const W=s.width,D=s.depth,H=s.height;
 box(mass,'Opaque_hall_base_recess',W*.83-2*GD.facade,8,D*.88-2*GD.facade,0,4,0,m.back);box(mass,'Opaque_elevated_hall_core',W-2*GD.facade,H-8.9,D-10,0,8+(H-8.9)/2,-3,m.back);
 const baseGlazing={...m,clear:m.dark};
 for(const side of [-1,1]){glazedFace(glass,W*.83,8,0,0,side*D*.44,12,2,baseGlazing,false,undefined,true);glazedFace(glass,D*.88,8,side*W*.415,0,0,12,2,baseGlazing,true,undefined,true);}

 for(const side of [-1,1]){if(side<0)glazedFace(glass,W-2.4,H-10,0,9,side*(D/2+.1),14,3,m,false,undefined,true);else{const eastGlass=glazedFace(glass,W*.47,H-10,W*.24,9,D/2+.1,7,5,m,false,undefined,true);eastGlass.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.Material).userData?.surfaceRole==='glass')o.material=m.glass;});const signBay=glazedFace(glass,W*.46,H-10,-W*.25,9,D/2-3.8,7,3,m,false,undefined,true);
 signBay.traverse(node=>{
  if(node instanceof T.Mesh&&node.name==='Recess_back')node.material.color.setHex(0x283a40);
 });box(ent,'Recessed_exterior_terrace',W*.48,.25,4,-W*.25,8.8,D/2-1.8,m.silver);pane(ent,'Terrace_glass_guard',W*.46,1.05,-W*.25,9.5,D/2+.12,m.guard);box(ent,'Terrace_guard_handrail',W*.46,.06,.06,-W*.25,10.05,D/2+.13,m.frame);for(let i=0;i<=7;i++)box(ent,'Terrace_guard_post',.06,1.1,.06,-W*.48+i*W*.46/7,9.5,D/2+.13,m.frame);}for(const a of [-1,1]){box(framing,'Wide_frame',1.3,H-8,1.5,a*(W/2-.5),8+(H-8)/2,side*(D/2+.4),m.silver);box(framing,'Wide_frame',W,1.3,1.5,0,a===1?H-.6:8.6,side*(D/2+.4),m.silver);}}
 for(const x of [-W*.4,W*.4])box(framing,'Pilotis',1.1,8,1.1,x,4,D*.4,m.silver);
 // C08: the lower right service doors are opaque; the recessed upper entrance is glazed.
 box(ent,'Opaque_hall_service_doors',8,3,.18,W*.20,6.5,D/2+.3,m.silver);for(const x of [-4,0,4])box(ent,'Service_door_frame',.10,3,.22,W*.20+x,6.5,D/2+.4,m.frame);pane(ent,'Closed_upper_hall_glass_doors',6,3,-W*.25,10.5,D/2-3.6,m.clear);for(const x of [-3,0,3])box(ent,'Upper_hall_door_frame',.10,3,.18,-W*.25+x,10.5,D/2-3.5,m.frame);box(ent,'Hall_door_canopy',11,.22,2.4,0,8.1,D/2+1.3,m.silver);
 addHallSign(framing,W,D,m.white);
 box(rt,'Flat_hall_roof',W,.25,D,0,H-.4,0,m.roof);for(const k of [-1,1])box(rt,'Hall_roof_edge',W,.6,.3,0,H-.1,k*D/2,m.silver);box(rt,'Service_volume_PROVISIONAL',6,1.3,8,7,H+.4,-7,m.equipment);return root;
}
/** Watertight strip with variable level; preserves a true open sunken courtyard. */
function ribbon(g:T.Object3D,name:string,rx:number,rz:number,width:number,cx:number,cz:number,start:number,end:number,y0:number,y1:number,m:T.Material,thickness=.25){
 const n=72,vertices:number[]=[],indices:number[]=[];
 for(let i=0;i<=n;i++){const t=i/n,a=start+(end-start)*t,y=y0+(y1-y0)*t;for(const dy of [0,-thickness])for(const k of [-1,1])vertices.push(cx+(rx+k*width/2)*Math.cos(a),y+dy,cz+(rz+k*width/2)*Math.sin(a));}
 for(let i=0;i<n;i++){const a=i*4,b=a+4;for(const [u,v]of [[0,1],[1,3],[3,2],[2,0]])indices.push(a+u,b+u,a+v,a+v,b+u,b+v);}
 indices.push(0,2,1,1,2,3,n*4,n*4+1,n*4+2,n*4+1,n*4+3,n*4+2);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geo.setIndex(indices);geo.computeVertexNormals();return mesh(g,name,geo,m);
}
function landscape(root:T.Group,circulation:T.Group,s:SiteParameters,m:M,opening=false){
 const ground=group(root,'Ground','M01,P01','estimated-boundary');const paths=group(root,'Roads_and_Paving','A03,A04,M01','inferred-layout');const green=group(root,'Landscape','C02,R05','simplified-current-state');
 // True hole in paving: coordinate transform maps Shape XY to world XZ.
 const sh=new T.Shape();const z0=s.centerZ-s.depth/2,z1=s.centerZ+s.depth/2;sh.moveTo(-s.width/2,-z0);sh.lineTo(s.width/2,-z0);sh.lineTo(s.width/2,-z1);sh.lineTo(-s.width/2,-z1);sh.closePath();const hole=new T.Path();hole.absellipse(s.plazaX,-s.plazaZ,s.plazaRadiusX,s.plazaRadiusZ,0,Math.PI*2,true,0);sh.holes.push(hole);
 const geo=new T.ExtrudeGeometry(sh,{depth:.6,bevelEnabled:false,curveSegments:48});geo.rotateX(-Math.PI/2);geo.translate(0,-.6,0);mesh(ground,'Perforated_site_paving',geo,m.concrete);
 for(const road of driveSections()){const section=group(paths,road.id,'M01,A03,A04','inferred-layout');section.userData.sceneId=road.id;section.userData.label=road.name;for(const r of road.parts)box(section,'Joined_drive',r.width,.05,r.depth,r.x,.025,r.z,m.road);}
 for(let z=-88;z<94;z+=10)for(const x of [-94,94])if(z+1.75< -47.5||z-1.75> -40.5)box(paths,'Lane_dash',.12,.012,3.5,x,.056,z,m.yellow);
 for(let x=-85;x<90;x+=10)box(paths,'Lane_dash',3.5,.012,.12,x,.056,98,m.yellow);
 // Lawn now occupies south central forecourt; no obsolete planned fountain is invented.
 box(green,'South_lawn',28,.16,40,0,.05,73,m.grass);
 const letters=mesh(green,'HKU',lawnLetterGeometry(),m.white);letters.position.set(LAWN_SIGN.x,LAWN_SIGN.bottom,LAWN_SIGN.z);letters.userData={source:LAWN_SIGN.source,sourceFile:'src/model/videoFollowup.ts'};
 for(const [i,r] of centralWalkLayout(s).entries()){const section=group(paths,`R00${i+7}`,'M01,A03','inferred-layout');section.userData.sceneId=section.name;section.userData.label=i?'南草坪东侧步道':'南草坪西侧步道';box(section,'Central_walk',r.width,.07,r.depth,r.x,.035,r.z,m.concrete);}
 for(const z of [-94,-27,92])for(const x of [-COLUMN_X,COLUMN_X])box(green,'Planting_bed',55,.14,3.5,x,.1,z,m.grass);
 function tree(x:number,z:number,h=s.treeHeight){box(green,'Block_tree_trunk',.44,h*.70,.44,x,h*.35,z,m.bark);for(const [dx,dy,dz,w,ht] of [[0,.77,0,.65,.35],[-.18,.66,.10,.42,.28],[.19,.69,-.09,.38,.28],[0,1.00,0,.42,.22]])box(green,'Block_leaf_cluster',h*w,h*ht,h*w,x+dx*h,h*dy,z+dz*h,m.leaf);}
 for(let z=-94;z<=94;z+=13)for(const x of [-101,101])tree(x,z);
 // South lawn trees now follow observed planting zones in landscapeDetails.
 for(let x=-82;x<=84;x+=14){tree(x,-92.5,5);tree(x,108,5);}
 for(const x of [-18])for(const z of [-25,-12])tree(x,z,5);
 const plaza=group(circulation,'Sunken_Plaza_and_Ramp','R02,R06,A03,M01','confirmed-feature_estimated-curve');
 const floor=mesh(plaza,'Lower_plaza_floor',new T.CylinderGeometry(1,1,.3,64),m.concrete);floor.scale.set(s.plazaRadiusX,1,s.plazaRadiusZ);floor.position.set(s.plazaX,-s.plazaDepth-.15,s.plazaZ);
 ribbon(plaza,'Retaining_wall',s.plazaRadiusX,s.plazaRadiusZ,.35,s.plazaX,s.plazaZ,.13,Math.PI*2-.13,.05,.05,m.silver,s.plazaDepth+.1);
 addObservedCourtyard(plaza,s);
 const steps=group(circulation,'Auditorium_Grand_Stair','R06','confirmed-feature_estimated-dimensions');
 // Keep the original tread keys and upper silhouette. Only their underfill is cut.
 const stairBox=(name:string,w:number,top:number,depth:number,x:number,z:number,key:string)=>{
  const bottom=opening?stairPassageSlabBottom(z,depth,top):0;
  box(steps,name,w,top-bottom,depth,x,(top+bottom)/2,z,m.concrete);
  if(bottom>0){
   const lo=z-depth/2,hi=z+depth/2;
   for(const [j,[a,b]]of [[lo,Math.min(hi,SP.z-SP.depth/2)],[Math.max(lo,SP.z+SP.depth/2),hi]].entries())if(b>a)box(steps,key+'-cap-'+j,w,bottom,b-a,x,bottom/2,(a+b)/2,m.concrete);
  }
 };
 for(let i=0;i<L.stairCount;i++){
  const y=(L.stairCount-i)*L.stairRise;
  stairBox('Walking_stair_tread',L.stairWalkWidth,y,L.stairRun,0,L.stairStartZ+i*L.stairRun,'Opening_stair_'+i);
  if(i%3===0)for(const k of [-1,1])stairBox('Broad_seating_step',7.5,y,2.4,k*11.25,-50.2+i*.8,'Opening_seating_'+i+'_'+k);
 }
 if(opening){const floor=box(steps,'Opening_stair_passage_floor',SP.width,.08,SP.depth,0,-.04,SP.z,m.concrete);floor.userData.source=SP.source;}
 box(steps,'Upper_exterior_landing',30,5.1,1.3,0,2.55,-52.05,m.concrete);
 for(const x of [-15.4,15.4,0])beam(steps,new T.Vector3(x,6.2,-51),new T.Vector3(x,1.15,-27),.07,m.frame);
}
export interface SiteAsset {openingWorld?:ReturnType<typeof createOpeningWorld>;root:T.Group;buildings:T.Group;environment:T.Group;circulation:T.Group;sports:T.Group;byId:Map<string,T.Group>;parameters:BuildingSpec[];site:SiteParameters;}
export function buildSite(specs:BuildingSpec[]=BUILDINGS.map(b=>({...b})),site:SiteParameters={...SITE},opening=false):SiteAsset{
 validateCampus(specs,site);const m=materials();const root=new T.Group();root.name='HKU_Shanghai_Zhangjiang_Campus';root.userData={version:'8.0.0-scale1-glass1',glazing:{revision:'glass1',profiles:GLASS_PROFILES,depth:GD,source:'references/glass/REPORT.md'},scaleCalibration:SCALE_CALIBRATION,units:'metres',up:'Y',coordinates:'local +X approx east, -Z approx north; not georeferenced',buildingParameters:specs,siteParameters:site,evidence:'references/CAMPUS_BASIS.md',status:'Visual reconstruction, not survey/as-built'};
 const buildings=group(root,'Buildings','C01,P01,M01','mixed-per-building');const environment=group(root,'Environment','M01,C02','inferred-layout');const circulation=group(root,'Circulation','A02,A03,A08,R06','visible-features_inferred-connections');const sports=group(root,'Sports','C03,R02','confirmed-types_provisional-layout');const byId=new Map<string,T.Group>();
 for(const s of specs){let b:T.Group;
 if(s.kind==='bandTower'){
  const a=buildCampus({...DEFAULT_PARAMETERS,width:s.width,depth:s.depth,height:s.height,floors:s.floors,frontBays:s.bays});b=a.building;a.root.remove(b);disposeAsset(a.root,b);
  // The detailed CDS-1 sign belongs only to B04. Do not duplicate its identity or entrance on B03.
  if(s.id!=='B04'){for(const name of ['08_Signage','05_Entrance','06_Canopy']){const c=b.getObjectByName(name);if(c){c.removeFromParent();disposeAsset(c,b);}}
   const entry=group(b,'05_Entrance','A01','simplified-placeholder');pane(entry,'Closed_generic_glass_portal',9,5,0,2.5,s.depth/2+.3,m.clear);box(entry,'Generic_canopy',12,.22,2.8,0,4.5,s.depth/2+1.4,m.silver);
  }
 }else b=s.kind==='frameTower'?frameTower(s,m):s.kind==='amenities'?amenities(s,m):auditorium(s,m);
 if(s.id==='B04')decorateCampusLobby(b);b.name=s.id;b.userData={...b.userData,...s,parameters:{...s},dimensionsStatus:s.confidence};b.position.set(s.x,0,s.z);b.rotation.y=s.rotation*Math.PI/180;buildings.add(b);byId.set(s.id,b);
 }
 landscape(environment,circulation,site,m,opening);
 // Raised inner walks, tower-to-tower spans and a circular oculus opening.
 for(const x of [CL.westWalkX]){const raised=group(circulation,'R012','A02,A08','visible-features_inferred-connections');raised.userData={...raised.userData,sceneId:'R012',label:'西侧架空步道（高架）'};if(x<0){box(raised,'Inner_walk_north',4.4,.4,85,x,site.bridgeHeight,-15,m.silver);box(raised,'Inner_walk_south',4.4,.4,15,x,site.bridgeHeight,50,m.silver);}else box(raised,'Inner_colonnade_deck',4.4,.4,115,x,site.bridgeHeight,0,m.silver);for(let z=-52;z<=55;z+=12)if(z<27.5||z>42.5)box(raised,'Column',.6,site.bridgeHeight,.6,x,site.bridgeHeight/2,z,m.silver);for(const side of [-1,1]){const rail=new T.Group();rail.name='Walkway_glass_guard';raised.add(rail);for(const [start,end]of [[-57.5,27.5],[42.5,57.5]]){for(let z=start;z<end;z+=2.5)pane(rail,'Guard_glass',2.45,1.0,x+side*2.2,site.bridgeHeight+.7,z+1.25,m.guard,Math.PI/2);box(rail,'Opaque_top_rail',.075,.065,end-start,x+side*2.2,site.bridgeHeight+1.23,(start+end)/2,m.frame);for(let z=start;z<=end;z+=2.5)box(rail,'Guard_post',.065,1.1,.065,x+side*2.2,site.bridgeHeight+.7,z,m.frame);}}}
 // R01 shows no bridge over the CDS-1 entrance: remove unsupported tower-pair spans.

 for(const [i,x] of [-23,23].entries()){const link=group(circulation,`R01${i+3}`,'A06','inferred-connection');link.userData={...link.userData,sceneId:link.name,label:i?'礼堂东侧连接平台（高架）':'礼堂西侧连接平台（高架）'};box(link,'Auditorium_link',12,.45,5,x,9,-70,m.silver);}
 const oculus=group(circulation,'Oculus_Pavilion','A08,N08,N09','confirmed-feature_position-estimated');oculus.position.set(OCULUS.x,0,OCULUS.z);oculus.userData.source=OCULUS.source;
 mesh(oculus,'Open_oculus_canopy',oculusDeckGeometry(specs,site.bridgeHeight),m.silver).userData.sourceFile='src/model/videoFollowup.ts';
 for(const [x,z]of [[-5,-5],[5,-5],[-5,5],[5,5]])box(oculus,'Oculus_column',.6,site.bridgeHeight,.6,x,site.bridgeHeight/2,z,m.silver);
 const og=new T.Group();og.name='Oculus_glass_guard';oculus.add(og);
 for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2,mid=(a+b)/2,r=3.12,len=2*r*Math.sin(Math.PI/32);pane(og,'Oculus_guard_pane',len-.035,1.0,r*Math.sin(mid),site.bridgeHeight+.9,r*Math.cos(mid),m.guard,mid);beam(og,new T.Vector3(r*Math.sin(a),site.bridgeHeight+1.43,r*Math.cos(a)),new T.Vector3(r*Math.sin(b),site.bridgeHeight+1.43,r*Math.cos(b)),.035,m.frame);box(og,'Oculus_guard_post',.05,1.05,.05,r*Math.sin(a),site.bridgeHeight+.9,r*Math.cos(a),m.frame);}

 buildEntranceExterior(environment,specs.find(b=>b.id==='B04')!,m);
 const edge=group(environment,'Exploration_boundary','prototype','provisional-limit_not-campus-fence-survey');for(const k of [-1,1]){box(edge,'Boundary_kerb',.3,.3,site.depth,k*(site.width/2-.5),.15,site.centerZ,m.silver);box(edge,'Boundary_kerb',site.width,.3,.3,0,.15,site.centerZ+k*(site.depth/2-.5),m.silver);}for(let x=-site.width/2+2;x<site.width/2;x+=8)for(const k of [-1,1])box(edge,'Boundary_post',.14,1.1,.14,x,.55,site.centerZ+k*(site.depth/2-.5),m.frame);
 addLandscapeDetails(environment,specs,site);buildSports(sports,site,m);addVideoDetails(environment,circulation,sports,byId,specs);addNov13Details(environment,circulation,site);addNov14Details(environment,circulation,specs,site);addVideoFollowup(environment,site);if(opening)cutOpeningBuildings(root);compact(root);let openingWorld:ReturnType<typeof createOpeningWorld>|undefined;if(opening){openingWorld=createOpeningWorld();openingWorld.root.userData.dynamicGameplay=true;root.add(openingWorld.root);const tag=(o:T.Object3D)=>{if(o instanceof T.Group)tagChildren(o);for(const child of o.children)tag(child);};tag(openingWorld.root);}voxelizeMaterials(root);sceneRegistry(root);return{openingWorld,root,buildings,environment,circulation,sports,byId,parameters:specs.map(b=>({...b})),site:{...site}};
}
function buildSports(g:T.Group,s:SiteParameters,m:M){const z=s.sportsZ;g.userData={...g.userData,warning:'Court sequence, dimensions and hall location provisional; current facilities C03, planning R02'};
 box(g,'Sports_strip',s.sportsWidth,.12,s.sportsDepth,0,.08,z,m.blue);
 // Two green playing areas support the actual fenced football/tennis photos; no 400m claim.
 for(const [x,w]of [[-5,44],[53,51]]){box(g,'Playing_surface',w,.04,25,x,.17,z,x<0?m.blue:m.court);for(const side of [-1,1]){box(g,'Court_sideline',w-2,.025,.10,x,.21,z+side*11.5,m.white);box(g,'Court_baseline',.10,.025,23,x+side*(w/2-1),.21,z,m.white);}box(g,'Centre_line',.10,.025,23,x,.21,z,m.white);
 if(x<0){for(const xx of [x-10.5,x+10.5]){box(g,'Tennis_net',19,1,.07,xx,.75,z,m.mesh);for(const dz of [-6,6])box(g,'Service_line',19,.025,.10,xx,.22,z+dz,m.white);}}
 if(x>0)for(const side of [-1,1]){const gx=x+side*(w/2-1);for(const dz of [-2.5,2.5])box(g,'Goal_post',.10,2.2,.10,gx,1.3,z+dz,m.white);box(g,'Goal_crossbar',.12,.12,5,gx,2.4,z,m.white);}
 for(let xx=x-w/2;xx<=x+w/2;xx+=5)for(const side of [-1,1])box(g,'Fence_post',.10,4,.10,xx,2,z+side*13,m.mesh);
 for(const yy of [1,2,3,4])for(const side of [-1,1])box(g,'Fence_wire',w,.025,.025,x,yy,z+side*13,m.mesh);
 }
 const hall=group(g,'Sports_Hall','C03 sports-1; R02 planning','confirmed-enclosure-type_provisional-exterior');hall.position.set(-68,0,z);
 box(hall,'Hall_base',39,.2,26,0,.2,0,m.concrete);
 // West end stays solid; the east elevation is split around the game-play glazed door.
 box(hall,'Hall_wall',.18,7,26,-SPORTS_HALL.eastX,3.5,0,m.white);
 const eastSegment=(SPORTS_HALL.depth-SPORTS_DOOR.width)/2,eastOffset=(SPORTS_HALL.depth+SPORTS_DOOR.width)/4;
 for(const dz of [-eastOffset,eastOffset])box(hall,'Hall_wall',.18,SPORTS_HALL.wallHeight,eastSegment,SPORTS_HALL.eastX,SPORTS_HALL.wallHeight/2,dz,m.white);
 box(hall,'Hall_lintel',.18,SPORTS_HALL.wallHeight-SPORTS_DOOR.height,SPORTS_DOOR.width,SPORTS_HALL.eastX,(SPORTS_HALL.wallHeight+SPORTS_DOOR.height)/2,0,m.white);
 buildSportsDoor(hall,m);
 for(const side of [-1,1]){const roof=box(hall,'Pitched_membrane_roof',20.5,.18,26,side*9.75,8.75,0,m.white);roof.rotation.z=-side*Math.atan2(3.5,19.5);}
 for(const side of [-1,1]){box(hall,'Hall_end',39,7,.18,0,3.5,side*13,m.white);pane(hall,'Closed_sports_glass_door',5,3,0,1.5,side*13.15,m.clear,side<0?Math.PI:0);}
 for(let zz=-12;zz<=12;zz+=6){beam(hall,new T.Vector3(-19.5,7,zz),new T.Vector3(0,10.5,zz),.10,m.frame);beam(hall,new T.Vector3(0,10.5,zz),new T.Vector3(19.5,7,zz),.10,m.frame);}
}

/** R01: thin entrance canopy retained; low planted beds, level forecourt and road markings. */
/** R01: staggered grey setts and darker cross-lane courses, over the existing road slab. */
function addArrivalSetts(parent:T.Group,width:number,depth:number,centerZ:number){
 const positions:number[]=[],colors:number[]=[];
 const palettes=[0x787f83,0x81898d,0x8b9296,0x737a7e].map(c=>new T.Color(c));
 const dark=new T.Color(0x535e66);
 for(let row=0;row<13;row++){
  const front=centerZ-depth/2+row*.5+.009,back=front+.482;
  for(let column=-1;column<Math.ceil(width/.95);column++){
   const start=-width/2+(column+(row%2)*.5)*.95;
   const left=Math.max(-width/2+.009,start+.009),right=Math.min(width/2-.009,start+.941);
   if(right<=left)continue;
   const color=row===3||row===9?dark:palettes[(column+row*7+4)%4];
   positions.push(left,.046,front,left,.046,back,right,.046,front,right,.046,front,left,.046,back,right,.046,back);
   for(let i=0;i<6;i++)colors.push(color.r,color.g,color.b);
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 const surface=new T.MeshStandardMaterial({name:'Arrival grey stone setts',vertexColors:true,roughness:.94});
 surface.userData.keepColor=true;
 const setts=new T.Mesh(geometry,surface);
 setts.name='Arrival_staggered_stone_setts';
 setts.receiveShadow=true;
 setts.userData={source:'R01 CDS-1; pattern and contrast observed, module and band spacing estimated'};
 parent.add(setts);
}

function buildEntranceExterior(parent:T.Group,b:BuildingSpec,m:M){
 const g=group(parent,'CDS1_Entrance_Forecourt','R01 official CDS-1 entrance','observed-components_estimated-layout');g.position.set(b.x,0,b.z);g.rotation.y=b.rotation*Math.PI/180;const f=b.depth/2;
 box(g,'Entrance_paving',b.width,.08,9.6,0,.04,f+4.9,m.concrete);
 const lane=group(g,'R009','R01','observed-components_estimated-layout');lane.userData.sceneId='R009';lane.userData.label='CDS-1 门前到达车道';box(lane,'Front_arrival_lane',b.width+4,.04,6.5,0,.025,f+13,m.road);
 addArrivalSetts(lane,b.width+4,6.5,f+13);
 for(const dz of [10.3,15.8])box(g,'Yellow_kerb_line',b.width+4,.012,.10,0,.052,f+dz,m.yellow);
 for(let x=-b.width/2;x<b.width/2;x+=1.2)box(g,'Long_paving_joint',.018,.01,9.4,x,.085,f+4.9,m.roof);
 const longitudinal=[];for(let x=-b.width/2;x<b.width/2;x+=1.2)longitudinal.push({x,z:f+4.9,width:.018,depth:9.4});
 for(let z=f+.3;z<f+9.7;z+=.65)for(const r of subtractRects({x:0,z,width:b.width,depth:.018},longitudinal))box(g,'Paving_joint',r.width,.01,r.depth,r.x,.085,r.z,m.roof);
 for(const sign of [-1,1]){
  const x=sign*L.entranceBedOffset,z=f+L.entranceBedZ;
  box(g,'Stone_planter_edge',L.entranceBedWidth,L.entranceBedHeight,L.entranceBedDepth,x,L.entranceBedHeight/2,z,m.silver);
  box(g,'Low_planting',L.entranceBedWidth-.3,.12,L.entranceBedDepth-.3,x,L.entranceBedHeight,z,m.grass);

  const px=sign*9.25,pz=f+4.83;box(g,'Security_pole',.09,5.1,.09,px,2.55,pz,m.frame);box(g,'Security_camera',.19,.14,.38,px,5.05,pz+.1,m.silver);
 }
}
