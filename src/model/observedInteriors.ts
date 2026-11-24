import {campusFont as font} from './fonts';
import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {glassMaterial,pane} from './glazing';import {compact}from './buildCampus';

export const INTERIORS={lobby:{width:18,depth:14,height:7.6},floor13:{width:18,depth:15,height:3.2},source:'User IMG_4347.MOV 03:14–04:05 / U06 0210.0s / P05 / P06',scale:'All dimensions approximate; only photographed areas represented'};
export function buildObservedInterior(kind:'lobby'|'floor13'){
 const root=new T.Group();root.name=kind==='lobby'?'CDS1_Observed_Lobby':'CDS1_13F_Public_Area';root.userData={source:INTERIORS.source,kind,parameters:INTERIORS[kind],confidence:INTERIORS.scale,...(kind==='lobby'?{photos:['20261116-P04','20261116-P05','20261116-P06','U06-0210.0s']}:{}),scope:'Independent cutaway; not a full floor plan or functional elevator'};
 const group=(n:string)=>{const g=new T.Group();g.name=n;root.add(g);return g;},shell=group('Structure'),furniture=group('Observed_furniture'),lights=group('Ceiling_and_lights'),doors=group('Doors_and_elevators'),signs=group('Signage');
 const mat=(name:string,color:number,roughness=.82,metalness=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
 // The Night_ prefix opts these observed finishes out of the inherited voxel texture pass.
 // nightIntensity 0 keeps their photographed base colour unchanged after a day/night toggle.
 const cream=mat('Night_polished_cream_limestone',0xe9e4da,.16,.04),white=mat('Interior ivory wall',0xe1ded0,.76),timber=mat('Night_warm_timber_flank',0xb89a78,.68),stone=mat('Interior grey stone',0x898b84),metal=mat('Interior aluminium',0x9baba8),dark=mat('Interior dark mat',0x313b39),black=mat('Interior appliance',0x303b3b),green=mat('Interior foliage',0x59774e),glass=glassMaterial('clear');
 const satin=mat('Night_satin_portal_metal',0xe8e2d6,.26,.28),gate=mat('Night_brushed_stainless_gate',0xb8bcc0,.28,.78),gateDark=mat('Night_gate_reader_graphite',0x303a41,.42,.35),runner=mat('Night_long_grey_runner',0x4a4742,.96),paleRib=mat('Night_pale_flute_rib',0xdcd6ca,.7),timberRib=mat('Night_timber_flute_rib',0xa98964,.72);
 const gateCap=mat('Night_bright_stainless_cap',0xe6e9e8,.16,.92),portalReveal=mat('Night_dark_portal_reveal',0x494a42,.74),portalFloor=mat('Night_portal_reflective_floor',0x77786d,.22,.12),perforatedBacking=mat('Night_perforated_metal_backing',0x55574f,.58,.45);
 const limeWall=mat('Sign_lime_lit_rear_wall',0x9eaf3f,.55);limeWall.emissive.setHex(0xb7cf4a);limeWall.emissiveIntensity=.45;
 const lettering=new T.MeshBasicMaterial({name:'Sign_interior_lettering',color:0x3b3833});
 const readerScreen=new T.MeshBasicMaterial({name:'Sign_reader_bright_screen',color:0xcfe8e8});
 const lamp=mat('Sign_warm_white_cove',0xfff3d8,.24);lamp.emissive.setHex(0xffe8bb);lamp.emissiveIntensity=.62;
 const portalCove=mat('Sign_warm_white_portal_cove',0xffedc7,.26);portalCove.emissive.setHex(0xffe2ad);portalCove.emissiveIntensity=.68;
 [cream,timber,paleRib,timberRib,gate,gateDark,runner,satin,gateCap,portalReveal,portalFloor,perforatedBacking].forEach(m=>m.userData.nightIntensity=0);
 function box(g:T.Object3D,n:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=n;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
 function text(label:string,size:number,x:number,y:number,z:number,m:T.Material){return textMesh(signs,'Observed_label_'+label,label,size,x,y,z,m);}
 const elevator=(x:number,z:number,label:string)=>{box(doors,'Elevator_frame',2.7,2.8,.16,x,1.4,z,metal);for(const side of [-1,1])box(doors,'Closed_elevator_leaf',1.16,2.52,.05,x+side*.585,1.26,z+.10,stone);box(doors,'Elevator_call_panel',.18,.45,.035,x+1.55,1.15,z+.13,black);box(doors,'Elevator_call_button',.06,.06,.02,x+1.55,1.15,z+.155,lamp);text(label,.30,x-1.2,2.95,z+.12,lettering);};
 if(kind==='lobby'){
  const p=INTERIORS.lobby;
  box(shell,'Lobby_floor',p.width,.18,p.depth,0,-.09,0,cream);
  // Leave a real opening in the rear wall: the photographed portal is a corridor, not a panel.
  const openingW=5.4,openingH=4.1,sideW=(p.width-openingW)/2;
  box(shell,'Lobby_back_wall',sideW,p.height,.18,-(openingW/2+sideW/2),p.height/2,-7,white);
  box(shell,'Lobby_back_wall',sideW,p.height,.18,openingW/2+sideW/2,p.height/2,-7,white);
  box(shell,'Lobby_back_wall',openingW,p.height-openingH,.18,0,openingH+(p.height-openingH)/2,-7,white);
  box(shell,'Lobby_left_wall',.18,p.height,14,-9,p.height/2,0,white);
  box(shell,'Lobby_right_wall',.18,p.height,14,9,p.height/2,0,timber);
  // Perforated metal occupies the upper rear right wall, with the two photographed cameras.
  box(shell,'Right_wall_perforated_metal_screen',.06,4.80,6.20,8.84,3.85,-3.25,perforatedBacking);
  const dotGeometries:T.BufferGeometry[]=[];
  for(let y=1.55;y<=6.15;y+=.16)for(let z=-6.15;z<=-.35;z+=.16){const dot=new T.CircleGeometry(.018,6);dot.rotateY(-Math.PI/2);dot.translate(8.795,y,z);dotGeometries.push(dot);}
  const dotGeometry=mergeGeometries(dotGeometries,false)!;dotGeometries.forEach(dot=>dot.dispose());
  const dots=new T.Mesh(dotGeometry,new T.MeshBasicMaterial({name:'Sign_perforation_dots',color:0xa5a79a}));dots.name='Right_wall_perforated_screen_dots';shell.add(dots);
  for(const z of [-4.9,-2.6]){
   box(shell,'Right_wall_security_camera',.20,.14,.26,8.70,5.48,z,gateDark);
   const lens=new T.Mesh(new T.CylinderGeometry(.055,.055,.09,12),gateDark);lens.name='Right_wall_security_camera_lens';lens.rotation.z=Math.PI/2;lens.position.set(8.57,5.48,z);shell.add(lens);
  }
  // Pale vertical fluting is confined to the left flank; the opposite flank is warm timber.
  const fluteGeo=new T.CylinderGeometry(.038,.038,7.35,6);
  for(let z=-6.75;z<=6.75;z+=.12){const rib=new T.Mesh(fluteGeo,paleRib);rib.name='Lobby_pale_vertical_flute';rib.position.set(-8.875,3.7,z);rib.castShadow=rib.receiveShadow=true;shell.add(rib);}
  for(let z=-6.65;z<=6.65;z+=.22)box(shell,'Lobby_timber_vertical_joint',.10,7.25,.035,8.875,3.7,z,timberRib);
  // The narrow runner continues from the entrance door through the complete gate bank.
  box(furniture,'Entrance_black_mat',1.20,.025,11.60,0,.016,1.15,runner);
  const sheen=new T.Mesh(new T.PlaneGeometry(18,14),new T.MeshBasicMaterial({name:'Sign_polished_floor_sheen',color:0xfff7e5,transparent:true,opacity:.045,depthWrite:false}));
  sheen.name='Lobby_polished_floor_sheen';sheen.rotation.x=-Math.PI/2;sheen.position.set(0,.011,0);shell.add(sheen);
  // Four slim stainless pedestals with top-mounted wedges and tall, bottom-railed glass wings.
  const gateX=[-3.3,-1.1,1.1,3.3];
  for(const x of gateX){
   box(doors,'Turnstile_body',.28,1.15,1.30,x,.595,-2.16,gate);
   box(doors,'Turnstile_steel_cap',.30,.045,1.32,x,1.192,-2.16,gateCap);
   readerWedge(doors,x-.065,1.215,-1.43,gateDark,readerScreen);
  }
  for(const x of [-4.2,-2.2,0,2.2,4.2]){
   pane(doors,'Turnstile_glass_flap',.55,.95,x,.51,-1.38,glass);
   box(doors,'Turnstile_glass_bottom_rail',.57,.025,.025,x,.035,-1.38,gate);
  }
  for(const side of [-1,1]){
   pane(doors,'Turnstile_fixed_rail',1.30,2.35,side*4.34,1.20,-2.16,glass,Math.PI/2);
   box(doors,'Turnstile_side_glass_post',.045,2.38,.045,side*4.40,1.20,-2.80,gate);
  }
  // The portal's four inner edges carry warm-white coves; nested returns make the depth legible.
  box(shell,'Stone_portal_left',3.6,5.1,.28,-4.6,2.55,-4.5,white);
  box(shell,'Stone_portal_right',3.6,5.1,.28,4.6,2.55,-4.5,white);
  box(shell,'Stone_portal_header',12.8,1.5,.28,0,4.35,-4.5,white);
  // Bring the two photographed flank finishes into the front camera without tinting the portal.
  const portalFluteGeo=new T.CylinderGeometry(.027,.027,4.94,6);
  for(let x=-6.22;x<=-3.02;x+=.12){const rib=new T.Mesh(portalFluteGeo,paleRib);rib.name='Portal_pale_vertical_flute';rib.position.set(x,2.55,-4.325);rib.castShadow=rib.receiveShadow=true;shell.add(rib);}
  box(shell,'Portal_timber_flank_inset',2.82,4.94,.055,4.64,2.55,-4.325,timber);
  for(let x=3.35;x<=5.95;x+=.18)box(shell,'Portal_timber_vertical_joint',.035,4.86,.035,x,2.55,-4.287,timberRib);
  box(shell,'Portal_satin_soffit',5.34,.14,2.72,0,3.37,-5.58,portalReveal);
  for(const side of [-1,1])box(shell,'Portal_satin_lining',.16,3.4,2.72,side*2.68,1.7,-5.58,portalReveal);
  box(shell,'Portal_corridor_floor',5.24,.035,2.72,0,.012,-5.58,portalFloor);
  for(let i=0;i<4;i++){
   const z=-4.48-i*.73,w=5.22-i*.20,h=3.36-i*.10,y=h/2+.03;
   for(const side of [-1,1])box(lights,'Portal_LED_return',.028,h,.028,side*(w/2-.07),y,z,portalCove);
   box(lights,'Portal_LED_header',w-.14,.028,.028,0,h+.01,z,portalCove);
  }
  box(lights,'Portal_LED_sill',5.08,.028,.028,0,.034,-4.47,portalCove);
  box(lights,'Portal_LED_far_sill',4.62,.028,.028,0,.034,-6.78,portalCove);
  const leftWordmark=new T.Group();leftWordmark.name='Observed_left_flank_wordmark';leftWordmark.position.set(-8.88,0,-3.2);leftWordmark.rotation.y=Math.PI/2;signs.add(leftWordmark);
  addWordmark(leftWordmark,0,2.2,0,.72,lettering);
  // The bright lime wall and tall narrow screen sit at the far end of the dark reveal.
  box(shell,'Portal_lime_rear_wall',5.05,3.38,.06,0,1.73,-6.94,limeWall);
  const limeLight=new T.PointLight(0xd7ec78,1.2,5,2);limeLight.name='Portal_lime_wall_light';limeLight.position.set(0,2,-6.25);lights.add(limeLight);
  addPortalDisplay(furniture,0,-6.84,.90,2.40);
  for(const side of [-1,1]){
   box(shell,'Portal_louvre_backing',.46,2.52,.055,side*3.18,2.17,-4.325,side<0?white:timber);
   pane(shell,'Portal_vertical_louvre_glazing',.30,2.34,side*3.18,2.12,-4.286,glass);
   for(let i=0;i<12;i++)box(shell,'Portal_vertical_louvre_slat',.36,.027,.04,side*3.18,1.02+i*.20,-4.245,gateDark);
  }
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
  addCautionCone(furniture,-2.85,3.65);
  canvasLabel(signs,'Lobby_green_exit_sign',.86,.42,3.85,4.83,-4.30,['EXIT','安全出口'],'#18734c','#f4fff7');
  // The wall shown around 03:40 can receive a puzzle later; no invented puzzle content now.
  const panel=box(furniture,'Future_puzzle_wall_observed_position',2.1,2.3,.08,-7.5,1.7,-1.3,timber);panel.userData={source:'U06 03:36–03:43',note:'User suggests a future puzzle; plain reference panel only'};
 }else{
  const p=INTERIORS.floor13;box(shell,'13F_floor',18,.16,15,0,-.08,0,white);box(shell,'13F_rear_wall',18,3.2,.16,0,1.6,-7.5,white);box(shell,'13F_side_wall',.16,3.2,15,-9,1.6,0,white);
  box(shell,'Elevator_lobby_grey_tile',7,.022,7,-5.3,.012,-3.9,stone);elevator(-5.2,-7.37,'13');text('13',.7,-8.3,2.1,-7.34,lettering);
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
 compact(root); // Interior: authored finishes only — the 25 cm pixel tile is for exteriors (see voxelizeMaterials).
 return root;
}

function textMesh(parent:T.Object3D,name:string,label:string,size:number,x:number,y:number,z:number,m:T.Material){
 const geo=new TextGeometry(label,{font,size,depth:.012,curveSegments:1});geo.computeBoundingBox();const bounds=geo.boundingBox!;geo.translate(-(bounds.max.x-bounds.min.x)/2,0,0);
 const o=new T.Mesh(geo,m);o.name=name;o.position.set(x,y,z);parent.add(o);return o;
}

/** Flat reader wedge: high at the cabinet, sloping down toward the approaching person. */
function readerWedge(parent:T.Object3D,x:number,y:number,z:number,m:T.Material,screen:T.Material){
 const w=.22,d=.16,back=.10,front=.028,vertices=new Float32Array([
  -w/2,0,-d/2, w/2,0,-d/2, w/2,0,d/2, -w/2,0,d/2,
  -w/2,back,-d/2, w/2,back,-d/2, w/2,front,d/2, -w/2,front,d/2,
 ]);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(16),2));geometry.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,3,7,6,3,6,2,0,1,5,0,5,4,0,4,7,0,7,3,1,2,6,1,6,5]);geometry.computeVertexNormals();
 const wedge=new T.Mesh(geometry,m);wedge.name='Turnstile_reader';wedge.position.set(x,y,z);wedge.castShadow=true;parent.add(wedge);
 const display=new T.Mesh(new T.PlaneGeometry(.13,.055),screen);display.name='Turnstile_reader_screen';display.rotation.x=-Math.atan2(back-front,d);display.position.set(x,y+(back+front)/2+.004,z+.004);parent.add(display);
}

/** Small photograph-derived lockup: a geometric crest followed by three short centred lines. */
function addWordmark(parent:T.Object3D,x:number,y:number,z:number,scale:number,m:T.Material){
 const crest=new T.Group();crest.name='HKU_crest_lockup';crest.position.set(x-1.55*scale,y+.18*scale,z);crest.scale.setScalar(scale);parent.add(crest);
 const shape=new T.Shape();shape.moveTo(-.17,.20);shape.lineTo(.17,.20);shape.lineTo(.15,-.07);shape.quadraticCurveTo(.11,-.19,0,-.24);shape.quadraticCurveTo(-.11,-.19,-.15,-.07);shape.closePath();
 const shield=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false,curveSegments:2}),m);shield.name='HKU_crest_shield';crest.add(shield);
 for(const side of [-1,1]){const page=new T.Mesh(new T.BoxGeometry(.12,.018,.012),m);page.name='HKU_crest_book_page';page.position.set(side*.065,-.015,.025);page.rotation.z=side*.18;crest.add(page);}
 const tx=x-1.18*scale;
 textMesh(parent,'Observed_label_SCHOOL OF','SCHOOL OF',.155*scale,tx,y+.30*scale,z,m);
 textMesh(parent,'Observed_label_COMPUTING & DATA SCIENCE','COMPUTING & DATA SCIENCE',.155*scale,tx,y+.12*scale,z,m);
 textMesh(parent,'Observed_label_The University of Hong Kong','The University of Hong Kong',.102*scale,tx,y-.055*scale,z+.002,m);
}

/** The observed blue display is now a small, distant hall seen through the portal recess. */
function addPortalDisplay(parent:T.Object3D,x:number,z:number,width:number,height:number){
 const display=new T.Group();display.name='Observed_blue_vertical_display';display.position.set(x,0,z);
 display.userData.source='P05 / P06 / U06 0210.0s';parent.add(display);
 const panel=(name:string,w:number,h:number,y:number,depth:number,color:number,intensity:number)=>{
  const mat=new T.MeshStandardMaterial({name:'Sign_'+name,color,roughness:.72,emissive:color,emissiveIntensity:intensity});
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,.045),mat);mesh.name=name;mesh.position.set(0,y,depth);display.add(mesh);
 };
 panel('Display_blue_field',width,height,height/2+.12,0,0x355b7f,.18);
 panel('Display_cool_upper_band',width*.78,height*.07,height*.91,.033,0x78abc5,.14);
 panel('Display_cool_lower_band',width*.58,height*.045,height*.22,.033,0x5c91b5,.12);
 const crowd=new T.MeshStandardMaterial({name:'Sign_distant_hall_silhouettes',color:0x46535d,roughness:1});
 for(let i=0;i<2;i++){
  const px=(i===0?-1:1)*width*.20,ph=height*.48,py=.12+ph/2;
  const body=new T.Mesh(new T.BoxGeometry(width*.20,ph,width*.055),crowd);body.name='Distant_hall_visitor_body';body.position.set(px,py,.072);display.add(body);
  const head=new T.Mesh(new T.SphereGeometry(width*.115,8,6),crowd);head.name='Distant_hall_visitor_head';head.position.set(px,py+ph/2+width*.115,.073);display.add(head);
 }
 const hazard=new T.Mesh(new T.BoxGeometry(width*.92,.055,.04),new T.MeshStandardMaterial({name:'Sign_distant_hall_hazard',color:0xc4ad54,roughness:.8}));hazard.name='Distant_hall_overhead_bar';hazard.position.set(0,height*.97,.075);display.add(hazard);
}

function canvasLabel(parent:T.Object3D,name:string,w:number,h:number,x:number,y:number,z:number,lines:string[],background:string,foreground:string){
 // check-scene runs in Node; browser screenshots and GLB export get the full lettering texture.
 const material=new T.MeshBasicMaterial({name:'Sign_'+name,color:background,side:T.DoubleSide});
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=foreground;ctx.lineWidth=8;ctx.strokeRect(9,9,canvas.width-18,canvas.height-18);
  ctx.fillStyle=foreground;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${lines.length>2?42:58}px "PingFang SC", "Noto Sans CJK SC", sans-serif`;
  lines.forEach((line,i)=>ctx.fillText(line,256,256*(i+1)/(lines.length+1)));
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;material.map=texture;material.color.setHex(0xffffff);material.needsUpdate=true;
 }
 const mesh=new T.Mesh(new T.PlaneGeometry(w,h),material);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}

function addCautionCone(parent:T.Object3D,x:number,z:number){
 const yellow=new T.MeshStandardMaterial({name:'Sign_caution_yellow',color:0xf2c230,roughness:.64});
 const cone=new T.Mesh(new T.CylinderGeometry(.065,.31,.60,4),yellow);cone.name='Caution_wet_floor_cone';cone.rotation.y=Math.PI/4;cone.position.set(x,.36,z);cone.castShadow=true;parent.add(cone);
 const base=new T.Mesh(new T.BoxGeometry(.63,.055,.63),yellow);base.name='Caution_wet_floor_base';base.position.set(x,.03,z);base.castShadow=true;parent.add(base);
 canvasLabel(parent,'Caution_wet_floor_sign',.34,.30,x,.40,z+.205,['CAUTION','WET FLOOR','小心地滑'],'#f2c230','#292820');
}

/** A shallow, closed scenic version behind the campus portal; full room stays a separate editable asset. */
export function decorateCampusLobby(building:T.Group){
 const g=building.getObjectByName('Lobby_visual_recess_PROVISIONAL');if(!g)return;const existing=new Set(g.children);
 const pale=new T.MeshStandardMaterial({name:'Sign_U06_pale_foyer',color:0xe4ded2,roughness:.76});pale.userData.nightIntensity=0;
 const m=new T.MeshStandardMaterial({name:'Sign_U06_foyer_warm_detail',color:0xc8aa83,roughness:.72});m.userData.nightIntensity=0;
 const dark=new T.MeshStandardMaterial({name:'Sign_U06_entry_runner',color:0x4a4742,roughness:.96});
 const gateMat=new T.MeshStandardMaterial({name:'Sign_U06_brushed_gate',color:0xb8bcc0,roughness:.28,metalness:.78});
 const gateCap=new T.MeshStandardMaterial({name:'Sign_U06_bright_gate_cap',color:0xe6e9e8,roughness:.16,metalness:.92});
 const readerMat=new T.MeshStandardMaterial({name:'Sign_U06_gate_reader',color:0x303a41,roughness:.42,metalness:.35});
 const readerScreen=new T.MeshBasicMaterial({name:'Sign_U06_reader_screen',color:0xcfe8e8});
 const make=(n:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.name=n;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 // Keep the existing rear object name, but split its finish into the two photographed flanks.
 make('Observed_foyer_warm_rear',15,7.7,.08,0,3.85,-2.30,pale);
 make('Observed_foyer_timber_flank',3.7,7.35,.08,5.55,3.85,-2.24,m);
 for(let x=-6.8;x<-3.5;x+=.12)make('Observed_foyer_pale_flute',.065,7.2,.075,x,3.85,-2.23,pale);
 make('Observed_foyer_black_mat',1.20,.02,3.80,0,.12,-.70,dark);
 for(const x of [-3,-1,1,3]){
  make('Observed_gate_body',.28,1.15,1.30,x,.595,-1.58,gateMat);
  make('Observed_gate_steel_cap',.30,.045,1.32,x,1.192,-1.58,gateCap);
  readerWedge(g,x-.065,1.215,-.86,readerMat,readerScreen);
 }
 for(const x of [-4,-2,0,2,4]){
  pane(g,'Observed_gate_glass',.55,.95,x,.51,-.80,glassMaterial('clear'));
  make('Observed_gate_glass_bottom_rail',.57,.025,.025,x,.035,-.80,gateMat);
 }
 for(const side of [-1,1])pane(g,'Turnstile_fixed_rail',1.30,2.35,side*4.34,1.20,-1.58,glassMaterial('clear'),Math.PI/2);
 const portal=new T.Group();portal.name='CDS_entrance_night_photo_detail';portal.userData.source='P05 / P06 / U06 0210.0s';g.add(portal);
 const satin=new T.MeshStandardMaterial({name:'Sign_U06_portal_satin',color:0xe8e2d6,roughness:.26,metalness:.28});
 make('Observed_portal_side_lining',.13,3.28,.42,-1.68,1.68,-2.05,satin);make('Observed_portal_side_lining',.13,3.28,.42,1.68,1.68,-2.05,satin);
 make('Observed_portal_soffit',3.48,.13,.42,0,3.31,-2.05,satin);
 const warm=new T.MeshStandardMaterial({name:'Sign_CDS_portal_warm_outline',color:0xfff0cf,emissive:0xffe3ad,emissiveIntensity:.30,roughness:.32});
 // Retain the original front-frame names and add three progressively smaller returns behind them.
 for(const side of [-1,1])make('Observed_warm_portal_upright',.065,3.65,.055,side*1.88,1.91,-1.83,warm);
 make('Observed_warm_portal_header',3.83,.065,.055,0,3.73,-1.83,warm);
 for(let i=1;i<4;i++){const z=-1.83-i*.15,w=3.83-i*.20,h=3.65-i*.17;for(const side of [-1,1])make('Observed_warm_portal_return',.045,h,.045,side*w/2,h/2+.085,z,warm);make('Observed_warm_portal_return',w,.045,.045,0,h+.08,z,warm);}
 make('Observed_warm_portal_sill',3.68,.035,.04,0,.085,-1.83,warm);
 addPortalDisplay(portal,0,-2.22,.88,1.46);
 addWordmark(portal,0,4.18,-1.66,.68,new T.MeshBasicMaterial({name:'Sign_U06_wordmark',color:0x3b3833}));
 for(const side of [-1,1]){
  make('Observed_portal_louvre_backing',.40,2.24,.045,side*2.48,2.05,-1.755,pale);
  pane(g,'Observed_portal_louvre_glazing',.25,2.1,side*2.48,1.95,-1.725,glassMaterial('clear'));
  for(let i=0;i<10;i++)make('Observed_portal_louvre_slat',.30,.024,.035,side*2.48,1.00+i*.21,-1.695,readerMat);
 }
 canvasLabel(g,'Observed_green_exit_sign',.72,.34,2.75,4.78,-1.76,['EXIT','安全出口'],'#18734c','#f4fff7');
 addCautionCone(g,-2.45,-.18);
 for(const child of g.children)if(!existing.has(child))child.userData.sourceFile='src/model/observedInteriors.ts';
}
