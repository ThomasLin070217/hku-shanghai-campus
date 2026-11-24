import * as T from 'three';
import {compact} from './buildCampus';
import {LOUNGE_PARAMETERS as P} from './videoDetailsParameters';
/** Isolated cutaway: user confirms B05 / 4F. No assumed placement inside the tower. */
export function buildLounge(){
 const root=new T.Group();root.name='B05_4F_Stepped_Lounge';root.userData={source:'U02 00:00–00:07.62, user confirms Building 5 / 4F',locationConfirmed:true,dimensions:'estimated; not measured',parameters:{...P},note:'Independent cutaway study, omitted front wall and ceiling for inspection; not a traversable interior.'};
 const mat=(name:string,color:number)=>new T.MeshStandardMaterial({name,color,roughness:.85});
 const timber=mat('Lounge timber',0xb9976d),edge=mat('Lounge wood slats',0x876846),white=mat('Lounge ivory furniture',0xe9e6d9),grey=mat('Lounge upholstery',0x73837c),green=mat('Lounge green cushion',0x557758),orange=mat('Lounge terracotta cushion',0xb96f4e),metal=mat('Lounge ivory balustrade',0xcfd3c4),leaf=mat('Lounge leaf',0x3c6a42),wall=mat('Lounge wall',0xc4c3ad);
 const glass=new T.MeshStandardMaterial({name:'Lounge glass',color:0x9cb8b2,transparent:true,opacity:.22,roughness:.2,depthWrite:false});
 const lamp=mat('Lounge ivory lamp',0xffe6ba);lamp.emissive.setHex(0xffc777);lamp.emissiveIntensity=.5;
 const group=(name:string)=>{const g=new T.Group();g.name=name;root.add(g);return g;},structure=group('Timber_Tiers'),furniture=group('Tables_Cushions_Lamps'),rails=group('Side_Stairs_And_Balustrades'),back=group('Slatted_Wall_And_Planters');
 function box(g:T.Group,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
 const W=P.width,D=P.depth,run=P.rowRun,rise=P.rowRise,core=W-2*P.sideStairWidth-2;
 box(structure,W,.22,D,0,-.11,0,timber);
 for(let i=0;i<P.rows;i++){
  const z=D/2-2-(i+.5)*run,h=(i+1)*rise;
  box(structure,core,h,run,0,h/2,z,timber);box(structure,core,.055,.08,0,h-.025,z+run/2,edge);
  for(const s of [-1,1])for(let j=0;j<3;j++){const y=(i*3+j+1)*rise/3,sz=D/2-2-(i*3+j+.5)*run/3;box(rails,P.sideStairWidth,y,run/3,s*(core+P.sideStairWidth)/2,y/2,sz,timber);}
  for(let j=0;j<5;j++){
   const x=(j-2)*1.23,zf=z+.25;
   if(j%2===1){box(furniture,.82,.07,.72,x,h+.43,zf,white);for(const s of [-1,1])for(const v of [-1,1])box(furniture,.045,.40,.045,x+s*.35,h+.2,zf+v*.29,metal);if((j+i)%3===0){box(furniture,.12,.28,.12,x,h+.62,zf,edge);box(furniture,.29,.19,.29,x,h+.82,zf,lamp);}}
   else{const m=[grey,green,orange,white][(i+j)%4];box(furniture,1.10,.13,.82,x,h+.065,zf,m);box(furniture,.48,.37,.14,x,h+.28,zf-.33,[white,orange,green][(i+j)%3]);if((i+j)%2===0)for(let n=-3;n<=3;n++)box(furniture,.045,.008,.82,x+n*.12,h+.135,zf,white);}
  }
 }
 const top=P.rows*rise;
 box(structure,W,top,2,0,top/2,-D/2+1,timber);
 for(const s of [-1,1]){
  box(structure,.85,top,D,s*(W/2-.425),top/2,0,wall);
  box(rails,.035,.86,D-1,s*(W/2-.9),top+.48,0,glass);box(rails,.06,.06,D-1,s*(W/2-.9),top+.96,0,metal);
  for(let z=-D/2+.7;z<D/2;z+=1.5)box(rails,.055,1.02,.055,s*(W/2-.9),top+.51,z,metal);
  for(const z of [-4,3]){box(back,.52,.60,.52,s*(W/2-.46),top+.3,z,white);for(let k=0;k<3;k++)box(back,.16,.8+.2*k,.16,s*(W/2-.46)+(k-1)*.12,top+.94,z,leaf);}
 }
 box(back,W,2.4,.16,0,top+1.2,-D/2,edge);
 for(let x=-W/2+.1;x<W/2;x+=.19)box(back,.075,2.4,.12,x,top+1.2,-D/2+.12,timber);
 // The recorded crest is not reconstructed from illegible pixels; plain inset marks its location.
 box(back,.40,.48,.06,0,top+1.72,-D/2+.22,metal);
 const ceiling=group('Ceiling_Baffles_Cutaway');ceiling.userData.note='Only rear strip retained to reveal the lounge in cutaway.';
 for(let z=-D/2;z<-D/2+2;z+=.3)box(ceiling,W,.16,.05,0,P.ceilingHeight,z,timber);
 for(const x of [-3.4,3.4])box(ceiling,2.2,.04,.10,x,P.ceilingHeight-.1,-D/2+1,lamp);
 compact(root); return root; // Interior: authored finishes only — the pixel tile is for exteriors.
}
