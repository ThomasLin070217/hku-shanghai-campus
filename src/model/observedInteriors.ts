import {campusFont as font} from './fonts';
import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {glassMaterial,pane} from './glazing';import {compact}from './buildCampus';import {voxelizeMaterials}from '../voxel/materials';

export const INTERIORS={lobby:{width:18,depth:14,height:7.6},floor13:{width:18,depth:15,height:3.2},source:'User IMG_4347.MOV 03:14–04:05 / 04:49–05:00',scale:'All dimensions approximate; only photographed areas represented'};
export function buildObservedInterior(kind:'lobby'|'floor13'){
 const root=new T.Group();root.name=kind==='lobby'?'CDS1_Observed_Lobby':'CDS1_13F_Public_Area';root.userData={source:INTERIORS.source,kind,parameters:INTERIORS[kind],confidence:INTERIORS.scale,scope:'Independent cutaway; not a full floor plan or functional elevator'};
 const group=(n:string)=>{const g=new T.Group();g.name=n;root.add(g);return g;},shell=group('Structure'),furniture=group('Observed_furniture'),lights=group('Ceiling_and_lights'),doors=group('Doors_and_elevators'),signs=group('Signage');
 const mat=(name:string,color:number)=>new T.MeshStandardMaterial({name,color,roughness:.82});const cream=mat('Interior limestone',0xd5cdb5),white=mat('Interior ivory wall',0xe1ded0),timber=mat('Interior warm timber',0xae885c),stone=mat('Interior grey stone',0x898b84),metal=mat('Interior aluminium',0x9baba8),dark=mat('Interior dark mat',0x313b39),black=mat('Interior appliance',0x303b3b),green=mat('Interior foliage',0x59774e),glass=glassMaterial('clear');
 const lamp=mat('Night_interior_LED',0xffedc5);lamp.emissive.setHex(0xffe6b3);lamp.emissiveIntensity=.7;
 function box(g:T.Object3D,n:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=n;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
 function text(label:string,size:number,x:number,y:number,z:number,m:T.Material){const geo=new TextGeometry(label,{font,size,depth:.015,curveSegments:1});const o=new T.Mesh(geo,m);o.name='Observed_label_'+label;o.position.set(x,y,z);signs.add(o);return o;}
 const elevator=(x:number,z:number,label:string)=>{box(doors,'Elevator_frame',2.7,2.8,.16,x,1.4,z,metal);for(const side of [-1,1])box(doors,'Closed_elevator_leaf',1.16,2.52,.05,x+side*.585,1.26,z+.10,stone);box(doors,'Elevator_call_panel',.18,.45,.035,x+1.55,1.15,z+.13,black);box(doors,'Elevator_call_button',.06,.06,.02,x+1.55,1.15,z+.155,lamp);text(label,.30,x-1.2,2.95,z+.12,dark);};
 if(kind==='lobby'){
  const p=INTERIORS.lobby;box(shell,'Lobby_floor',p.width,.18,p.depth,0,-.09,0,cream);box(shell,'Lobby_back_wall',p.width,p.height,.18,0,p.height/2,-7,white);box(shell,'Lobby_left_wall',.18,p.height,14,-9,p.height/2,0,white);box(shell,'Lobby_right_wall',.18,p.height,14,9,p.height/2,0,white);
  // A black entrance mat continues to the access-control gates; each gate is a distinct object.
  box(furniture,'Entrance_black_mat',5,.025,8,0,.013,2.7,dark);
  for(const x of [-3.8,-1.9,0,1.9,3.8]){box(doors,'Turnstile_body',.25,.92,1.2,x,.46,-2.4,metal);pane(doors,'Turnstile_glass_flap',.72,.66,x+.48,.68,-2.4,glass);box(doors,'Turnstile_reader',.17,.05,.22,x,.96,-2.15,black);}
  // Stone wall and lit portal lead to the elevator corridor seen at 03:35 and 04:00.
  box(shell,'Stone_portal_left',3.6,5.1,.28,-4.6,2.55,-4.5,timber);box(shell,'Stone_portal_right',3.6,5.1,.28,4.6,2.55,-4.5,timber);box(shell,'Stone_portal_header',12.8,1.5,.28,0,4.35,-4.5,timber);text('SCHOOL OF',.25,-2.0,4.60,-4.31,dark);text('COMPUTING & DATA SCIENCE',.23,-2.05,4.18,-4.31,dark);
  for(const z of [-4.25,-5.5,-6.7]){for(const side of [-1,1])box(lights,'Portal_LED_return',.045,3.3,.045,side*2.6,1.65,z,lamp);box(lights,'Portal_LED_header',5.2,.045,.045,0,3.3,z,lamp);}
  elevator(-5.3,-6.85,'1');elevator(5.3,-6.85,'1');
  // Side reception: curved counter translated to stepped blocks, no speculative rooms behind it.
  for(let i=0;i<5;i++)box(furniture,'Reception_counter_segment',.9,.98,.65,5.0+i*.66,.49,1.0+Math.abs(i-2)*.16,timber);
  box(furniture,'Reception_countertop',3.8,.08,.85,6.4,1.02,1.25,cream);box(furniture,'Reception_monitor',.48,.32,.04,6.1,1.22,1.2,black);
  for(const x of [5.4,6.4,7.4])box(furniture,'Waiting_bench_cushion',.88,.18,.85,x,.46,3.8,stone);box(furniture,'Waiting_bench_plinth',3.1,.36,.9,6.4,.18,3.8,timber);
  // Photo shows a bright curving ceiling; segmented strips preserve its trajectory in voxel form.
  for(let i=0;i<12;i++){const z=-5.7+i*.93,x=5.7+.45*Math.sin(i/11*Math.PI);box(lights,'Curved_ceiling_LED',.10,.06,1.02,x,6.7,z,lamp);}for(const z of [-2,2,5]){box(lights,'Ceiling_strip',11,.05,.12,0,7.25,z,lamp);}
  // Explicit door types: centre revolving door plus separate side leaf doors.
  for(const x of [-5.8,5.8]){pane(doors,'Lobby_side_glass_door',3.8,3.6,x,1.8,6.9,glass);for(const side of [-1,1])box(doors,'Side_door_frame',.07,3.7,.10,x+side*1.9,1.85,6.94,metal);box(doors,'Door_pull_handle',.06,.75,.09,x+.4,1.4,7.0,metal);}
  box(doors,'Revolving_door_centre_post',.08,3.6,.08,0,1.8,6.8,metal);
  for(const y of [.04,3.65]){const o=new T.Mesh(new T.CylinderGeometry(1.45,1.45,.08,16),metal);o.name='Revolving_door_cap';o.position.set(0,y,6.8);doors.add(o);}for(let i=0;i<3;i++){const a=i*Math.PI*2/3;pane(doors,'Revolving_door_leaf',1.45,3.5,Math.sin(a)*.725,1.85,6.8+Math.cos(a)*.725,glass,a-Math.PI/2);}
  for(const x of [-6,-2,2,6])pane(doors,'Upper_lobby_glazing',3.9,3.2,x,5.65,6.9,glass);box(doors,'Lobby_upper_transom',17.8,.25,.2,0,3.95,6.9,white);
  // The wall shown around 03:40 can receive a puzzle later; no invented puzzle content now.
  const panel=box(furniture,'Future_puzzle_wall_observed_position',2.1,2.3,.08,-7.5,1.7,-1.3,timber);panel.userData={source:'U06 03:36–03:43',note:'User suggests a future puzzle; plain reference panel only'};
 }else{
  const p=INTERIORS.floor13;box(shell,'13F_floor',18,.16,15,0,-.08,0,white);box(shell,'13F_rear_wall',18,3.2,.16,0,1.6,-7.5,white);box(shell,'13F_side_wall',.16,3.2,15,-9,1.6,0,white);
  box(shell,'Elevator_lobby_grey_tile',7,.022,7,-5.3,.012,-3.9,stone);elevator(-5.2,-7.37,'13');text('13',.7,-8.3,2.1,-7.34,mat('Sign_13F_red',0x803d33));
  for(const z of [-5.5,-2.2,1.1]){box(lights,'13F_ceiling_light',6.3,.045,.07,-5.1,3.0,z,lamp);for(const side of [-1,1])box(shell,'13F_door_reveal',.12,2.7,.20,-5.1+side*3.2,1.35,z,cream);}
  // Pantry visible at 04:58: timber surround, long counter, microwaves, island and stools.
  box(shell,'Pantry_timber_floor',10,.025,7.2,3.7,.014,3.7,timber);box(shell,'Pantry_back_panel',10,2.6,.12,3.7,1.3,.2,timber);box(furniture,'Pantry_low_cabinet',9.5,.88,.7,3.7,.44,.70,timber);box(furniture,'Pantry_white_worktop',9.7,.08,.85,3.7,.92,.72,cream);
  for(const x of [.3,2.0,3.7]){box(furniture,'Microwave_body',.7,.42,.48,x,1.17,.65,white);box(furniture,'Microwave_dark_front',.50,.28,.02,x-.06,1.18,.91,black);box(furniture,'Microwave_controls',.05,.21,.02,x+.26,1.18,.92,metal);}
  box(furniture,'Pantry_sink',.9,.025,.5,6.5,.97,.7,metal);box(furniture,'Pantry_tap',.04,.4,.04,6.5,1.13,.48,metal);
  box(furniture,'Island_timber_base',5.8,1.0,1.0,3.6,.50,4.0,timber);box(furniture,'Island_white_top',7.4,.07,1.5,3.6,1.04,4.0,cream);
  for(const x of [.5,2,3.5,5,6.5]){box(furniture,'Stool_seat',.44,.09,.42,x,.72,5.1,timber);for(const side of [-1,1])box(furniture,'Stool_leg',.045,.7,.045,x+side*.17,.35,5.1,metal);}
  for(const x of [.7,3.6,6.5]){box(lights,'Pendant_cord',.025,.55,.025,x,2.73,3.8,metal);const bulb=new T.Mesh(new T.IcosahedronGeometry(.20,1),lamp);bulb.name='Pantry_round_pendant';bulb.position.set(x,2.38,3.8);lights.add(bulb);}
  for(const x of [-.5,2,4.5,7])pane(shell,'Pantry_window',2.4,2.4,x,1.7,7.45,glass);
  box(shell,'Pantry_header',10,.32,.35,3.7,2.85,.25,timber);box(lights,'Pantry_worktop_LED',9.5,.03,.06,3.7,2.62,.38,lamp);
 }
 compact(root);voxelizeMaterials(root);return root;
}
/** A shallow, closed scenic version behind the campus portal; full room stays a separate editable asset. */
export function decorateCampusLobby(building:T.Group){
 const g=building.getObjectByName('Lobby_visual_recess_PROVISIONAL');if(!g)return;const existing=new Set(g.children);const m=new T.MeshStandardMaterial({name:'Night_U06_foyer_warm_detail',color:0xe1cfaa,roughness:.8});m.emissive.setHex(0xffd6a0);m.emissiveIntensity=.12;
 const dark=new T.MeshStandardMaterial({name:'U06 interior entry mat',color:0x303a38,roughness:1});const make=(n:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.name=n;o.position.set(x,y,z);g.add(o);};
 make('Observed_foyer_warm_rear',15,7.7,.08,0,3.85,-2.30,m);make('Observed_foyer_black_mat',4.5,.02,2.2,0,.12,-1.1,dark);
 for(const x of [-3,-1,1,3]){make('Observed_gate_body',.2,.95,.45,x,.6,-1.6,m);pane(g,'Observed_gate_glass',.65,.65,x+.43,.8,-1.5,glassMaterial('clear'));}
 for(const child of g.children)if(!existing.has(child))child.userData.sourceFile='src/model/observedInteriors.ts';
}
