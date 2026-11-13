import * as T from 'three';
import {pixelTile,pixelUV} from '../voxel/materials';
/** Original cuboid student. Official HKU gallery 005/009 informs the open green gown. */
export function createStudent(){
 const root=new T.Group();root.name='Student_Green_Gown';root.userData={source:'https://lead.hku.hk/en/article/2026/08/green-gowns-all-smiles/',height:1.80,style:'original voxel student'};
 const cloth=pixelTile('cloth'),hairMap=pixelTile('bark');
 const material=(name:string,color:number,map?:T.Texture)=>new T.MeshStandardMaterial({name,color,map:map??null,roughness:.95});
 const green=material('Gown green pixels',0x078651,cloth),darkGreen=material('Gown facings',0x07583f,cloth),shirt=material('White shirt',0xf5f0df,cloth),skin=material('Skin',0xdba27b),hair=material('Complete black short hair',0x141b1c,hairMap),pants=material('Dark trousers',0x283840,cloth),shoe=material('Shoes',0x172427),white=material('Eyes white',0xf4f2e7),black=material('Pixel features',0x182327),mouth=material('Mouth',0x975c49);
 function box(parent:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const geo=new T.BoxGeometry(w,h,d);pixelUV(geo,.32);const o=new T.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 const body=new T.Group();body.name='Body_and_open_gown';root.add(body);
 box(body,'Shirt',.40,.55,.25,0,1.13,0,shirt);box(body,'Neck',.14,.12,.14,0,1.43,0,skin);
 const head=new T.Group();head.name='Head_with_full_hair';body.add(head);
 box(head,'Block_head',.36,.36,.34,0,1.57,0,skin);
 box(head,'Hair_top_solid_cap',.40,.09,.39,0,1.755,.005,hair);
 box(head,'Hair_back_full',.40,.29,.055,0,1.63,.1825,hair);
 for(const s of [-1,1]){box(head,'Hair_side_full',.05,.20,.35,s*.185,1.675,.01,hair);box(head,'Ear',.035,.075,.075,s*.196,1.535,0,skin);}
 for(const [x,h] of [[-.145,.095],[-.075,.07],[0,.105],[.075,.055],[.145,.08]])box(head,'Fringe_pixel',.075,h,.045,x,1.755-h/2,-.18,hair);
 for(const s of [-1,1]){box(head,'Eye_white',.075,.042,.012,s*.085,1.58,-.176,white);box(head,'Eye_pupil',.03,.042,.016,s*.073,1.58,-.181,black);box(head,'Eyebrow',.075,.016,.014,s*.085,1.63,-.177,hair);}
 box(head,'Nose',.045,.052,.04,0,1.53,-.18,skin);box(head,'Mouth_pixel',.065,.017,.013,0,1.475,-.178,mouth);
 box(body,'Gown_back',.48,.75,.08,0,1.04,.18,green);
 const hems:T.Mesh[]=[];
 for(const s of [-1,1]){
  box(body,'Gown_shoulder',.16,.12,.37,s*.18,1.40,.02,green);
  box(body,'Open_front_panel',.15,.72,.07,s*.165,1.03,-.17,green);
  box(body,'Front_facing',.035,.72,.035,s*.083,1.03,-.215,darkGreen);
  box(body,'White_collar',.075,.095,.028,s*.048,1.385,-.15,shirt);
  hems.push(box(body,'Block_hem',.20,.19,.37,s*.17,.69,.01,green));
  box(body,'Back_pleat',.03,.59,.025,s*.12,1.0,.23,darkGreen);
 }
 box(body,'Shirt_placket',.026,.44,.012,0,1.11,-.135,white);
 for(const y of [1.28,1.15,1.02])box(body,'Shirt_button',.018,.018,.014,0,y,-.144,black);
 const arms=[-1,1].map(s=>{const pivot=new T.Group();pivot.name=s<0?'Left_arm':'Right_arm';pivot.position.set(s*.30,1.38,0);body.add(pivot);box(pivot,'Wide_green_short_sleeve',.24,.30,.31,0,-.15,0,green);box(pivot,'Shirt_cuff',.14,.08,.18,0,-.32,0,shirt);box(pivot,'Forearm',.13,.18,.15,0,-.43,0,skin);box(pivot,'Hand',.14,.12,.16,0,-.57,-.012,skin);return pivot;});
 const legs=[-1,1].map(sign=>({sign,upper:box(root,'Block_thigh',.18,1,.19,0,0,0,pants),lower:box(root,'Block_shin',.17,1,.18,0,0,0,pants),shoe:box(root,'Shoe',.20,.12,.30,sign*.115,.085,-.045,shoe),sole:box(root,'Shoe_sole',.205,.03,.31,sign*.115,.015,-.045,white)}));
 const up=new T.Vector3(0,1,0);
 function segment(mesh:T.Mesh,a:T.Vector3,b:T.Vector3){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(up,d.normalize());}
 let phase=0,blend=0,landing=0,wasGrounded=true,idleTime=0;
 function animate(dt:number,distance:number,grounded=true,vertical=0){
  idleTime+=dt;const speed=dt>0?distance/dt:0,running=speed>3.6;blend=T.MathUtils.damp(blend,speed>.03?1:0,22,dt);const stride=running?1.8:1.3;phase+=distance/stride*Math.PI*2;
  if(grounded&&!wasGrounded)landing=.08;landing=T.MathUtils.damp(landing,0,16,dt);wasGrounded=grounded;
  body.position.y=-landing+Math.sin(idleTime*2)*.004*(1-blend);
  for(let i=0;i<2;i++){
   const wave=Math.sin(phase+i*Math.PI),swing=wave*(running?.65:.40)*blend;
   const leg=legs[i],u=(phase/(Math.PI*2)+i*.5)%1;
   const z=grounded?(u<.5?-stride/4+u*stride:stride/4-(u-.5)*stride)*blend:(i===0?-.16:.12);
   const lift=grounded?(u<.5?0:Math.sin((u-.5)*Math.PI*2)*(running?.22:.13))*blend:(i===0?.12:.05);
   const hip=new T.Vector3(leg.sign*.115,.85,0),ankle=new T.Vector3(leg.sign*.115,.13+lift,z),d=ankle.clone().sub(hip),mid=hip.clone().add(ankle).multiplyScalar(.5);
   mid.add(new T.Vector3(0,-d.z,d.y).normalize().multiplyScalar(Math.sqrt(Math.max(0,.36*.36-d.lengthSq()/4))));
   segment(leg.upper,hip,mid);segment(leg.lower,mid,ankle);leg.shoe.position.set(leg.sign*.115,.085+lift,z-.045);leg.sole.position.set(leg.sign*.115,.015+lift,z-.045);
   arms[i].rotation.x=grounded?-swing*.9:(vertical>0?-.65:.25);arms[i].rotation.z=(i===0?1:-1)*.035;
   hems[i].rotation.x=grounded?swing*.12:-.10;
  }
 }
 animate(0,0);return{root,head,animate};
}
