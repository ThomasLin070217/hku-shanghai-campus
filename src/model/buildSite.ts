import {addVideoDetails} from './videoDetails';
import {voxelizeMaterials} from '../voxel/materials';
import * as T from 'three';
import {LANDSCAPE as L} from '../exploration/config';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json';
import {buildCampus,compact,disposeAsset} from './buildCampus';
import {DEFAULT_PARAMETERS} from './parameters';
import {BUILDINGS,SITE,validateCampus,type BuildingSpec,type SiteParameters} from './campusParameters';
const font=new FontLoader().parse(fontData);
const material=(name:string,color:number,roughness=.6,metalness=.15)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
function materials(){return {glass:material('Campus blue-grey glass',0x355465,.26,.42),dark:material('Recessed glass',0x203946,.3,.35),silver:material('Silver facade fins',0xd6dedb,.4,.38),frame:material('Mullion aluminium',0x93aeb2),roof:material('Roof membrane',0x8b9998),concrete:material('Limestone paving',0xc3c7be,.94),white:material('Ivory signage',0xeeeadd),road:material('Asphalt',0x6c7976,.95),grass:material('Lawn',0x8d9f69,1),leaf:material('Tree foliage',0x70885f,1),bark:material('Tree bark',0x796f5b,1),court:material('Sports turf',0x678c72,.95),blue:material('Jogging surface',0x648e97,.9),mesh:material('Fence steel',0x849b9b),equipment:material('Rooftop plant provisional',0xa8b3b0),yellow:material('Road marking',0xcbbb75)};}
type M=ReturnType<typeof materials>;
function group(parent:T.Object3D,name:string,source:string,confidence:string){const g=new T.Group();g.name=name;g.userData={source,confidence};parent.add(g);return g;}
function box(g:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function mesh(g:T.Object3D,name:string,geometry:T.BufferGeometry,m:T.Material){const o=new T.Mesh(geometry,m);o.name=name;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function beam(g:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,m:T.Material,name='Rail'){const v=b.clone().sub(a);const o=mesh(g,name,new T.BoxGeometry(r*2,v.length(),r*2),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
function text(g:T.Object3D,label:string,size:number,x:number,y:number,z:number,m:T.Material){const geo=new TextGeometry(label,{font,size,depth:.06,curveSegments:1});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);const o=mesh(g,label,geo,m);o.position.set(x,y,z);return o;}
function roof(g:T.Object3D,W:number,D:number,H:number,m:M){box(g,'Roof',W,.2,D,0,H-.65,0,m.roof);for(const s of [-1,1]){box(g,'Parapet',W,.65,.22,0,H-.325,s*D/2,m.silver);box(g,'Parapet',.22,.65,D,s*W/2,H-.325,0,m.silver);}
 for(let i=0;i<4;i++){const x=-W*.3+i*W*.2;box(g,'Plant_PROVISIONAL',W*.13,2.2,D*.21,x,H+.4,(i%2-.5)*D*.25,m.equipment);}}
function glazedFace(g:T.Object3D,w:number,h:number,x:number,y:number,z:number,bays:number,floors:number,m:M,turn=false){
 const f=new T.Group();f.name='Glazing_and_grid';g.add(f);f.position.set(x,y,z);if(turn)f.rotation.y=Math.PI/2;
 box(f,'Glass',w,h,.16,0,h/2,0,m.glass);
 for(let i=0;i<=bays;i++)box(f,'Mullion',.13,h,.22,-w/2+i*w/bays,h/2,.15,m.frame);
 for(let i=1;i<floors;i++)box(f,'Floor_separator',w,.18,.3,0,i*h/floors,.2,m.silver);
}
function frameTower(s:BuildingSpec,m:M){const root=new T.Group();const mass=group(root,'01_MainBody',s.source,'visible-form_estimated-dimensions');const glazing=group(root,'02_Glass',s.source,'inferred-hidden-facades');const fins=group(root,'03_Columns_and_Frames',s.source,'visible-form');const ent=group(root,'05_Entrance',s.source,'conservative-placeholder');const rt=group(root,'07_Roof',s.source,'provisional-layout');const W=s.width,D=s.depth,H=s.height;
 box(mass,'Tower_core',W,H-.9,D,0,(H-.9)/2,0,m.dark);
 for(const z of [-D/2,D/2]){glazedFace(glazing,W,H,0,0,z+(z>0?.08:-.08),s.bays,s.floors,m);for(let i=0;i<=s.bays;i++)box(fins,'Full_height_fin',.24,H,.55,-W/2+i*W/s.bays,H/2,z+(z>0?.35:-.35),m.silver);
 // Large staggered inset window with a white projecting frame, visible on both tower types.
 const cx=s.id==='B01'?-W*.23:W*.23,fh=H*.56,fy=s.id==='B01'?H*.65:H*.40,fw=W*.38;
 box(glazing,'Feature_dark_glass',fw,fh,.30,cx,fy,z+(z>0?2.22:-2.22),m.dark);
 for(const a of [-1,1]){box(fins,'Feature_frame_vertical',.9,fh+1.4,3.6,cx+a*fw/2,fy,z+(z>0?1.0:-1.0),m.silver);box(fins,'Feature_frame_horizontal',fw+.9,.85,3.6,cx,fy+a*fh/2,z+(z>0?1.0:-1.0),m.silver);}
 for(let i=1;i<8;i++)box(fins,'Inset_vertical_grid',.10,fh,.20,cx-fw/2+i*fw/8,fy,z+(z>0?2.43:-2.43),m.frame);
 for(let i=1;i<9;i++)box(fins,'Feature_floor',fw,.21,.35,cx,fy-fh/2+i*fh/9,z+(z>0?2.43:-2.43),m.frame);
 }
 for(const x of [-W/2,W/2]){glazedFace(glazing,D,H,x,0,0,Math.round(D/2.4),s.floors,m,true);for(let i=0;i<=Math.round(D/2.4);i++)box(fins,'Side_fin',.5,H,.20,x+(x>0?.25:-.25),H/2,-D/2+i*D/Math.round(D/2.4),m.silver);}
 box(ent,'Entrance_glazing',9,5,.3,0,2.5,D/2+.8,m.dark);box(ent,'Entrance_canopy',12,.25,3,0,4.2,D/2+1.5,m.silver);roof(rt,W,D,H,m);return root;
}
function amenities(s:BuildingSpec,m:M){const root=new T.Group();const mass=group(root,'01_MainBody',s.source,'confirmed-form_estimated');const gl=group(root,'02_Glass',s.source,'confirmed-grid_estimated-count');const fins=group(root,'03_Fins_and_Floating_Frame',s.source,'confirmed-form');const rt=group(root,'07_Roof',s.source,'inferred-green-roof');const W=s.width,D=s.depth,H=s.height;
 box(mass,'Low_rise_core',W,H-.9,D,0,(H-.9)/2,0,m.dark);
 for(const side of [-1,1]){glazedFace(gl,W,H,0,0,side*D/2,s.bays,s.floors,m);for(let i=0;i<=s.bays;i++)for(const tier of [0,1])box(fins,'Low_rise_fins',tier===0?.4:.7,H*.46,.4,-W/2+i*W/s.bays,H*(tier===0?.24:.75),side*(D/2+.25),m.silver);}
 for(const side of [-1,1])glazedFace(gl,D,H,side*W/2,0,0,12,s.floors,m,true);
 // North-facing broad floating rectangular window visible from sports area.
 const fw=W*.72,fh=H*.40,fy=H*.53;
 box(gl,'Floating_glazed_bay',fw,fh,.4,0,fy,-D/2-.5,m.dark);
 for(const k of [-1,1]){box(fins,'Floating_frame',fw+1.2,.9,2.5,0,fy+k*fh/2,-D/2-1.2,m.silver);box(fins,'Floating_frame',.9,fh,2.5,k*fw/2,fy,-D/2-1.2,m.silver);}
 roof(rt,W,D,H,m);box(rt,'Roof_garden',W*.72,.12,D*.55,0,H-.45,0,m.grass);return root;
}
function auditorium(s:BuildingSpec,m:M){const root=new T.Group();const mass=group(root,'01_MainBody',s.source,'confirmed-rectangular-hall');const glass=group(root,'02_Glass',s.source,'confirmed-front');const framing=group(root,'03_Columns',s.source,'confirmed-wide-frame');const ent=group(root,'05_Entrance',s.source,'confirmed-form_estimated-dimensions');const rt=group(root,'07_Roof',s.source,'provisional');const W=s.width,D=s.depth,H=s.height;
 box(mass,'Lower_glazed_base',W*.83,8,D*.88,0,4,0,m.dark);box(mass,'Elevated_hall_rear',W,H-8.9,D-4,0,8+(H-8.9)/2,-2,m.dark);box(mass,'Hall_east_volume',W*.48,H-8.9,4,W*.26,8+(H-8.9)/2,D/2-2,m.dark);
 for(const side of [-1,1]){if(side<0)glazedFace(glass,W-2.4,H-10,0,9,side*(D/2+.1),14,3,m);else{glazedFace(glass,W*.47,H-10,W*.24,9,D/2+.1,7,5,m);glazedFace(glass,W*.46,H-10,-W*.25,9,D/2-3.8,7,3,m);box(ent,'Recessed_exterior_terrace',W*.48,.25,4,-W*.25,8.8,D/2-1.8,m.silver);}for(const a of [-1,1]){box(framing,'Wide_frame',1.3,H-8,1.5,a*(W/2-.5),8+(H-8)/2,side*(D/2+.4),m.silver);box(framing,'Wide_frame',W,1.3,1.5,0,a===1?H-.6:8.6,side*(D/2+.4),m.silver);}}
 for(const x of [-W*.4,W*.4])box(framing,'Pilotis',1.1,8,1.1,x,4,D*.4,m.silver);
 box(ent,'Hall_doors',8,3,.3,0,6.5,D/2+.3,m.glass);box(ent,'Hall_door_canopy',11,.22,2.4,0,8.1,D/2+1.3,m.silver);
 text(framing,'THE UNIVERSITY OF HONG KONG',.48,-W*.23,19,D/2-2.9,m.white);text(framing,'HKU',1.1,-W*.35,20.2,D/2-2.9,m.white);
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
function landscape(root:T.Group,circulation:T.Group,s:SiteParameters,m:M){
 const ground=group(root,'Ground','M01,P01','estimated-boundary');const paths=group(root,'Roads_and_Paving','A03,A04,M01','inferred-layout');const green=group(root,'Landscape','C02,R05','simplified-current-state');
 // True hole in paving: coordinate transform maps Shape XY to world XZ.
 const sh=new T.Shape();const z0=s.centerZ-s.depth/2,z1=s.centerZ+s.depth/2;sh.moveTo(-s.width/2,-z0);sh.lineTo(s.width/2,-z0);sh.lineTo(s.width/2,-z1);sh.lineTo(-s.width/2,-z1);sh.closePath();const hole=new T.Path();hole.absellipse(s.plazaX,-s.plazaZ,s.plazaRadiusX,s.plazaRadiusZ,0,Math.PI*2,true,0);sh.holes.push(hole);
 const geo=new T.ExtrudeGeometry(sh,{depth:.6,bevelEnabled:false,curveSegments:48});geo.rotateX(-Math.PI/2);geo.translate(0,-.6,0);mesh(ground,'Perforated_site_paving',geo,m.concrete);
 for(const x of [-94,94])box(paths,'Perimeter_drive',7,.04,193,x,.03,0,m.road);
 for(const z of [-44,98])box(paths,'Cross_drive',188,.04,7,0,.03,z,m.road);
 for(let z=-88;z<94;z+=10)for(const x of [-94,94])box(paths,'Lane_dash',.12,.02,3.5,x,.06,z,m.yellow);
 for(let x=-85;x<90;x+=10)box(paths,'Lane_dash',3.5,.02,.12,x,.06,98,m.yellow);
 // Lawn now occupies south central forecourt; no obsolete planned fountain is invented.
 box(green,'South_lawn',28,.16,40,0,.05,73,m.grass);
 text(green,'HKU',3.2,0,.2,91,m.white);
 for(const x of [-16.8,16.8])box(paths,'Central_walk',3,.06,70,x,.04,65,m.concrete);
 for(const z of [-94,-27,92])for(const x of [-52,52])box(green,'Planting_bed',55,.14,3.5,x,.1,z,m.grass);
 function tree(x:number,z:number,h=s.treeHeight){box(green,'Block_tree_trunk',.44,h*.70,.44,x,h*.35,z,m.bark);for(const [dx,dy,dz,w,ht] of [[0,.77,0,.65,.35],[-.18,.66,.10,.42,.28],[.19,.69,-.09,.38,.28],[0,1.00,0,.42,.22]])box(green,'Block_leaf_cluster',h*w,h*ht,h*w,x+dx*h,h*dy,z+dz*h,m.leaf);}
 for(let z=-94;z<=94;z+=13)for(const x of [-101,101])tree(x,z);
 for(let z=53;z<=89;z+=12)for(const x of [-20,20])tree(x,z,5.3);
 for(let x=-82;x<=84;x+=14){tree(x,-92.5,5);tree(x,108,5);}
 for(const x of [-18])for(const z of [-25,-12])tree(x,z,5);
 const plaza=group(circulation,'Sunken_Plaza_and_Ramp','R02,R06,A03,M01','confirmed-feature_estimated-curve');
 const floor=mesh(plaza,'Lower_plaza_floor',new T.CylinderGeometry(1,1,.3,64),m.concrete);floor.scale.set(s.plazaRadiusX,1,s.plazaRadiusZ);floor.position.set(s.plazaX,-s.plazaDepth-.15,s.plazaZ);
 ribbon(plaza,'Retaining_wall',s.plazaRadiusX,s.plazaRadiusZ,.35,s.plazaX,s.plazaZ,.13,Math.PI*2-.13,.05,.05,m.silver,s.plazaDepth+.1);
 ribbon(plaza,'Sloping_pedestrian_ramp',s.plazaRadiusX-2,s.plazaRadiusZ-2,L.rampWidth,s.plazaX,s.plazaZ,L.rampStart,L.rampEnd,-s.plazaDepth,0,m.concrete);
 box(plaza,'Ramp_upper_landing',5,.18,1.8,s.plazaX+s.plazaRadiusX-.5,-.09,s.plazaZ,m.concrete);
 for(let i=1;i<55;i++){const a=i/56*Math.PI*2;const x=s.plazaX+s.plazaRadiusX*Math.cos(a),z=s.plazaZ+s.plazaRadiusZ*Math.sin(a);beam(plaza,new T.Vector3(x,.1,z),new T.Vector3(x,1.1,z),.045,m.frame);}
 ribbon(plaza,'Top_railing',s.plazaRadiusX,s.plazaRadiusZ,.10,s.plazaX,s.plazaZ,.13,Math.PI*2-.13,1.1,1.1,m.frame,.10);
 const steps=group(circulation,'Auditorium_Grand_Stair','R06','confirmed-feature_estimated-dimensions');
 for(let i=0;i<L.stairCount;i++){const y=(L.stairCount-i)*L.stairRise;box(steps,'Walking_stair_tread',L.stairWalkWidth,y,L.stairRun,0,y/2,L.stairStartZ+i*L.stairRun,m.concrete);if(i%3===0)for(const k of [-1,1])box(steps,'Broad_seating_step',7.5,y,2.4,k*11.25,y/2,-50.2+i*.8,m.concrete);}
 box(steps,'Upper_exterior_landing',30,5.1,1.3,0,2.55,-52.05,m.concrete);
 for(const x of [-15.4,15.4,0])beam(steps,new T.Vector3(x,6.2,-51),new T.Vector3(x,1.15,-27),.07,m.frame);
}
export interface SiteAsset {root:T.Group;buildings:T.Group;environment:T.Group;circulation:T.Group;sports:T.Group;byId:Map<string,T.Group>;parameters:BuildingSpec[];site:SiteParameters;}
export function buildSite(specs:BuildingSpec[]=BUILDINGS.map(b=>({...b})),site:SiteParameters={...SITE}):SiteAsset{
 validateCampus(specs,site);const m=materials();const root=new T.Group();root.name='HKU_Shanghai_Zhangjiang_Campus';root.userData={version:'5.0.0',units:'metres',up:'Y',coordinates:'local +X approx east, -Z approx north; not georeferenced',buildingParameters:specs,siteParameters:site,evidence:'references/CAMPUS_BASIS.md',status:'Visual reconstruction, not survey/as-built'};
 const buildings=group(root,'Buildings','C01,P01,M01','mixed-per-building');const environment=group(root,'Environment','M01,C02','inferred-layout');const circulation=group(root,'Circulation','A02,A03,A08,R06','visible-features_inferred-connections');const sports=group(root,'Sports','C03,R02','confirmed-types_provisional-layout');const byId=new Map<string,T.Group>();
 for(const s of specs){let b:T.Group;
 if(s.kind==='bandTower'){
  const a=buildCampus({...DEFAULT_PARAMETERS,width:s.width,depth:s.depth,height:s.height,floors:s.floors,frontBays:s.bays});b=a.building;a.root.remove(b);disposeAsset(a.root);
  // The detailed CDS-1 sign belongs only to B04. Do not duplicate its identity or entrance on B03.
  if(s.id!=='B04'){for(const name of ['08_Signage','05_Entrance','06_Canopy']){const c=b.getObjectByName(name);if(c){c.removeFromParent();disposeAsset(c);}}
   const entry=group(b,'05_Entrance','A01','simplified-placeholder');box(entry,'Generic_portal',9,5,.25,0,2.5,s.depth/2+.3,m.dark);box(entry,'Generic_canopy',12,.22,2.8,0,4.5,s.depth/2+1.4,m.silver);
  }
 }else b=s.kind==='frameTower'?frameTower(s,m):s.kind==='amenities'?amenities(s,m):auditorium(s,m);
 b.name=s.id;b.userData={...b.userData,...s,parameters:{...s},dimensionsStatus:'estimated'};b.position.set(s.x,0,s.z);b.rotation.y=s.rotation*Math.PI/180;buildings.add(b);byId.set(s.id,b);
 }
 landscape(environment,circulation,site,m);
 // Raised inner walks, tower-to-tower spans and a circular oculus opening.
 for(const x of [-20,20]){if(x<0){box(circulation,'Inner_walk_north',4.4,.4,85,x,site.bridgeHeight,-15,m.silver);box(circulation,'Inner_walk_south',4.4,.4,15,x,site.bridgeHeight,50,m.silver);}else box(circulation,'Inner_colonnade_deck',4.4,.4,115,x,site.bridgeHeight,0,m.silver);for(let z=-52;z<=55;z+=12)box(circulation,'Column',.6,site.bridgeHeight,.6,x,site.bridgeHeight/2,z,m.silver);for(const side of [-1,1])box(circulation,'Walkway_guard',.1,1,115,x+side*2.2,site.bridgeHeight+.7,0,m.frame);}
 // R01 shows no bridge over the CDS-1 entrance: remove unsupported tower-pair spans.

 for(const x of [-23,23])box(circulation,'Auditorium_link',12,.45,5,x,9,-70,m.silver);
 const oculus=group(circulation,'Oculus_Pavilion','A08,N08,N09','confirmed-feature_position-estimated');oculus.position.set(-20,0,35);
 ribbon(oculus,'Open_oculus_canopy',6,6,3,0,0,0,Math.PI*2,site.bridgeHeight+.2,site.bridgeHeight+.2,m.silver,.4);
 for(const [x,z]of [[-5,-5],[5,-5],[-5,5],[5,5]])box(oculus,'Oculus_column',.6,site.bridgeHeight,.6,x,site.bridgeHeight/2,z,m.silver);
 buildEntranceExterior(environment,specs.find(b=>b.id==='B04')!,m);
 const edge=group(environment,'Exploration_boundary','prototype','provisional-limit_not-campus-fence-survey');for(const k of [-1,1]){box(edge,'Boundary_kerb',.3,.3,site.depth,k*(site.width/2-.5),.15,site.centerZ,m.silver);box(edge,'Boundary_kerb',site.width,.3,.3,0,.15,site.centerZ+k*(site.depth/2-.5),m.silver);}for(let x=-site.width/2+2;x<site.width/2;x+=8)for(const k of [-1,1])box(edge,'Boundary_post',.14,1.1,.14,x,.55,site.centerZ+k*(site.depth/2-.5),m.frame);
 buildSports(sports,site,m);addVideoDetails(environment,circulation,sports,byId,specs);compact(root);voxelizeMaterials(root);return{root,buildings,environment,circulation,sports,byId,parameters:specs.map(b=>({...b})),site:{...site}};
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
 box(hall,'Hall_base',39,.2,26,0,.2,0,m.concrete);for(const side of [-1,1])box(hall,'Hall_wall',.18,7,26,side*19.5,3.5,0,m.white);
 for(const side of [-1,1]){const roof=box(hall,'Pitched_membrane_roof',20.5,.18,26,side*9.75,8.75,0,m.white);roof.rotation.z=-side*Math.atan2(3.5,19.5);}
 for(const side of [-1,1]){box(hall,'Hall_end',39,7,.18,0,3.5,side*13,m.white);box(hall,'Hall_doors',5,3,.2,0,1.5,side*13.15,m.glass);}
 for(let zz=-12;zz<=12;zz+=6){beam(hall,new T.Vector3(-19.5,7,zz),new T.Vector3(0,10.5,zz),.10,m.frame);beam(hall,new T.Vector3(0,10.5,zz),new T.Vector3(19.5,7,zz),.10,m.frame);}
}

/** R01: thin entrance canopy retained; low planted beds, level forecourt and road markings. */
function buildEntranceExterior(parent:T.Group,b:BuildingSpec,m:M){
 const g=group(parent,'CDS1_Entrance_Forecourt','R01 official CDS-1 entrance','observed-components_estimated-layout');g.position.set(b.x,0,b.z);g.rotation.y=b.rotation*Math.PI/180;const f=b.depth/2;
 box(g,'Entrance_paving',b.width,.08,9.6,0,.04,f+4.9,m.concrete);
 box(g,'Front_arrival_lane',b.width+4,.04,6.5,0,.025,f+13,m.road);
 for(const dz of [10.3,15.8])box(g,'Yellow_kerb_line',b.width+4,.012,.10,0,.052,f+dz,m.yellow);
 for(let x=-b.width/2;x<b.width/2;x+=1.2)box(g,'Long_paving_joint',.018,.01,9.4,x,.085,f+4.9,m.roof);
 for(let z=f+.3;z<f+9.7;z+=.65)box(g,'Paving_joint',b.width,.01,.018,0,.085,z,m.roof);
 for(const sign of [-1,1]){
  const x=sign*L.entranceBedOffset,z=f+L.entranceBedZ;
  box(g,'Stone_planter_edge',L.entranceBedWidth,L.entranceBedHeight,L.entranceBedDepth,x,L.entranceBedHeight/2,z,m.silver);
  box(g,'Low_planting',L.entranceBedWidth-.3,.12,L.entranceBedDepth-.3,x,L.entranceBedHeight,z,m.grass);
  for(let i=0;i<7;i++){const shrub=mesh(g,'Entrance_shrub',new T.BoxGeometry(1.7,.9,1.5),m.leaf);shrub.position.set(x-6.5+i*2.1,.64,z-.4+(i%2)*.8);shrub.scale.set(1.2,.58,.85);}
  const px=sign*9.25,pz=f+4.83;box(g,'Security_pole',.09,5.1,.09,px,2.55,pz,m.frame);box(g,'Security_camera',.19,.14,.38,px,5.05,pz+.1,m.silver);
 }
}
