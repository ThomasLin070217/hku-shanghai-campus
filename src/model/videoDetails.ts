import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json';
import {VIDEO_DETAILS as V} from './videoDetailsParameters';
import type {BuildingSpec} from './campusParameters';
const font=new FontLoader().parse(fontData);
export function addVideoDetails(environment:T.Group,circulation:T.Group,sports:T.Group,buildings:Map<string,T.Group>,specs:BuildingSpec[]){
 const root=new T.Group();root.name='Video_Observed_Exterior_Details';root.userData={source:'U03 00:00–03:08 / user IMG_4333.MOV',confidence:'observed-components; estimated dimensions and route placement'};environment.add(root);
 const mat=(name:string,color:number)=>new T.MeshStandardMaterial({name,color,roughness:.85});
 const stone=mat('Video pale stone',0xbfc2b2),dark=mat('Video basalt paving bands',0x5b6666),leaf=mat('Video leaf hedge',0x4d7142),wood=mat('Video tree bark and supports',0x645841),steel=mat('Video dark fence steel',0x586b67),white=mat('Video readable signage',0xf3f0dc),blue=mat('Video running track',0x3e6887);
 const glow=(name:string,color:number,intensity:number)=>{const m=mat('Night_'+name,color);m.emissive.setHex(color);m.emissiveIntensity=0;m.userData.nightIntensity=intensity;return m;};
 const warm=glow('warm lamps',0xffde9b,2.1),ivory=glow('lobby glazing',0xffe6b8,.8),purple=glow('observed lavender facade strips',0xa99aff,1.1);
 ivory.userData.dayColor=0x355465;ivory.userData.nightColor=0xffe6b8;ivory.color.setHex(0x355465);
 function box(g:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
 function label(g:T.Object3D,name:string,text:string,size:number,x:number,y:number,z:number,m:T.Material){const geo=new TextGeometry(text,{font,size,depth:.012,curveSegments:1});geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);const o=new T.Mesh(geo,m);o.name=name;o.position.set(x,y,z);g.add(o);return o;}
 function beam(a:T.Vector3,b:T.Vector3,w:number){const o=box(root,'Young_tree_support',w,a.distanceTo(b),w,0,0,0,wood);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());}
 function uplight(x:number,z:number){box(root,'Landscape_uplight_housing',.20,.14,.24,x,.11,z,steel);box(root,'Landscape_uplight_lens',.16,.035,.16,x,.19,z,warm);}
 function sapling(x:number,z:number){box(root,'Slender_deciduous_tree',.16,3.7,.16,x,1.85,z,wood);for(const s of [-1,1]){beam(new T.Vector3(x+s*.5,.04,z+.2),new T.Vector3(x,1.7,z),.05);beam(new T.Vector3(x,2.2,z),new T.Vector3(x+s*.8,3.6,z+s*.25),.06);box(root,'Sparse_voxel_leaves',.65,.7,.55,x+s*.5,3.5,z+s*.25,leaf);}uplight(x-.45,z+.25);}
 for(const p of V.promenade){box(root,'Video_banded_promenade',p.width,V.pathHeight,p.depth,p.x,V.pathHeight/2,p.z,stone);for(let z=p.z-p.depth/2+.5;z<p.z+p.depth/2;z+=2.6)box(root,'Contrasting_cross_band',p.width,.008,.32,p.x,V.pathHeight+.004,z,dark);for(const s of [-1,1])box(root,'Walkway_drain',.07,.012,p.depth,p.x+s*p.width/2,V.pathHeight+.006,p.z,steel);}
 for(const p of V.hedgeCenters){box(root,'Trimmed_hedge_bed',1.35,.20,7,p.x,.10,p.z,stone);box(root,'Low_voxel_hedge',1.2,.48,6.85,p.x,.41,p.z,leaf);sapling(p.x,p.z+2.3);}
 // Low linear beds along the northern facades leave the observed blue running strip unobstructed.
 for(const p of V.northernBeds){const x=p.x;box(root,'Northern_raised_bed',p.width,.32,2.6,x,.16,-90.5,stone);box(root,'Northern_low_hedge',p.width-.3,.45,2.3,x,.53,-90.5,leaf);uplight(x,-91.6);}
 const t=V.track;box(sports,'Observed_blue_two_way_track',t.width,t.height,t.depth,t.x,t.height/2,t.z,blue);
 for(const s of [-1,1])box(sports,'Track_white_edge',t.width,.009,.075,t.x,t.height+.006,t.z+s*(t.depth/2-.12),white);
 for(let x=-84;x<86;x+=3.5)box(sports,'Track_dashed_centre',1.6,.009,.075,x,t.height+.006,t.z,white);
 // Drain channel separates the jogging surface from the pedestrian margin.
 box(sports,'Track_side_drain',t.width,.012,.12,0,.07,t.z+t.depth/2+.10,steel);
 for(let x=-84;x<=84;x+=28)for(const lane of [-1,1]){const z=t.z+lane*.78;box(sports,'Track_direction_arrow',.65,.01,.08,x,.074,z,white);for(const s of [-1,1]){const a=box(sports,'Arrow_head',.42,.01,.07,x+lane*.18,.075,z+s*.12,white);a.rotation.y=lane*s*.6;}}

 for(let x=-24;x<79;x+=1.25)box(sports,'Fine_vertical_court_mesh',.015,3.8,.025,x,2,-104,steel);
 // A dark windscreen is observed on a section, not asserted for every court fence.
 box(sports,'Observed_partial_court_windscreen',34,2.45,.035,15,2.5,-104,steel);
 for(const x of [-78,-40,0,40,78]){box(root,'Court_light_pole',.13,6.1,.13,x,3.05,-102.5,steel);box(root,'Court_light_head',.6,.12,.35,x,6.12,-102.5,warm);}
 const steps=V.northernSteps,b=specs.find(b=>b.id===steps.building)!;
 for(let i=0;i<steps.count;i++){const y=(i+1)*steps.rise,z=b.z-b.depth/2-steps.run*(steps.count-i-.5);box(root,'Northern_door_step',steps.width,y,steps.run,b.x,y/2,z,stone);for(const side of [-1,1])box(root,'Recessed_step_light',.12,.07,.018,b.x+side*(steps.width/2-.2),y-.08,z-steps.run/2-.01,warm);}
 const sign=new T.Group();sign.name='CDS_Landscape_Monument';sign.userData={source:'U03 00:17',dimensions:'estimated',placement:'approximate southwest of CDS-1'};sign.position.set(V.monument.x,0,V.monument.z);sign.rotation.y=V.monument.rotation;root.add(sign);
 box(sign,'Pale_stone_sign',V.monument.width,V.monument.height,V.monument.depth,0,V.monument.height/2,0,stone);
 for(const [text,y,size]of [['SCHOOL OF',1.44,.19],['COMPUTING &',1.09,.22],['DATA SCIENCE',.75,.22],['THE UNIVERSITY OF HONG KONG',.38,.08]] as const)label(sign,'CDS_monument_text',text,size,0,y,.175,white);uplight(V.monument.x,V.monument.z+.8);
 const q=V.hallSign;box(root,'Building_6_wayfinding',q.width,q.height,q.depth,q.x,q.height/2,q.z,stone);box(root,'Building_6_number_panel',q.width-.10,.80,.025,q.x,q.height-.50,q.z+.125,steel);label(root,'Observed_building_6_number','6',.53,q.x,q.height-.75,q.z+.15,white);
 // A few observed path luminaires; no guessed fixtures spread across unseen streets.
 for(const z of [-42,-19,48]){box(root,'Walk_light_pole',.10,4.8,.10,15.3,2.4,z,steel);box(root,'Walk_light_lamp',.35,.10,.42,15.3,4.82,z,warm);}
 // Warm vestibule glazing preserves the existing frame and door rhythm.
 const cds=specs.find(b=>b.id==='B04')!,bd=buildings.get('B04')!;
 const vestibule=new T.Group();vestibule.name='Observed_Entrance_Light_And_Inlay';vestibule.userData={source:'U03 00:00–00:09',confidence:'lit-vestibule observed; panes simplified'};bd.add(vestibule);
 for(let i=0;i<8;i++)box(vestibule,'Warm_vestibule_pane',2.45,3.2,.018,-10.0+i*2.85,2.1,cds.depth/2+.19,ivory);
 for(let i=0;i<7;i++)box(root,'Entrance_flush_ground_light',.10,.012,.10,cds.x-7+i*2.3,.091,cds.z+cds.depth/2+5.8,warm);
 // Visible low-level interior light bands are scenic facades, not navigable rooms.
 for(const id of ['B04','B05','B06','B07']){const b=specs.find(s=>s.id===id)!,g=buildings.get(id)!;if(id==='B04'){for(let z=-b.depth/2+2;z<b.depth/2;z+=2.6)box(g,'Night_side_glazing',.018,3.0,2.15,-b.width/2-.09,2.1,z,ivory);}else{for(let x=-b.width/2+1.8;x<b.width/2-1;x+=2.7)box(g,'Night_northern_glazing',2.25,2.7,.018,x,1.85,-b.depth/2-.10,ivory);}}
 for(const id of ['B01','B02']){const b=specs.find(s=>s.id===id)!,g=buildings.get(id)!;for(let z=-b.depth/2+.8;z<b.depth/2;z+=1.6)box(g,'Observed_vertical_LED',.035,b.height-8,.055,b.width/2+.53,(b.height+4)/2,z,purple);}
 root.userData.note='Video shows physical details. Layout and light intensity are adjustable approximations, not photometric survey.';
}
