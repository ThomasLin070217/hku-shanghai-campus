import * as T from 'three';
import type {BuildingSpec,SiteParameters} from '../model/campusParameters';
import {EXPLORATION as C,LANDSCAPE as L} from './config';
export interface Obstacle {name:string;x:number;z:number;w:number;d:number;bottom:number;top:number;angle:number;radius?:number}
/** Stable cylinder against oriented boxes. No render-mesh ownership; works after geometry merging. */
export function createNavigation(specs:BuildingSpec[],s:SiteParameters){
 const obstacles:Obstacle[]=[];
 const box=(name:string,x:number,z:number,w:number,d:number,top:number,bottom=0,angle=0)=>obstacles.push({name,x,z,w,d,bottom,top,angle});
 const circle=(name:string,x:number,z:number,r:number,top:number)=>obstacles.push({name,x,z,w:r*2,d:r*2,bottom:0,top,angle:0,radius:r});
 for(const b of specs){
  const a=b.rotation*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
  const local=(name:string,x:number,z:number,w:number,d:number,top=b.height,bottom=0)=>box(b.id+'/'+name,b.x+co*x+si*z,b.z-si*x+co*z,w,d,top,bottom,a);
  if(b.kind==='bandTower'){
   const r=9.5,wing=(b.depth-r)/2;
   for(const k of [-1,1])local('wing',0,k*(b.depth+r)/4,b.width+.35,wing+.2);
   local('inset',0,0,b.width-6.4+.3,r);
   local('closed-doors',0,b.depth/2+.9,b.id==='B04'?8.6:9,2.9,4);
   local('canopy',0,b.depth/2+2,19.5,3.6,5.58,5.1);
  }else{local('closed-exterior',0,0,b.width+.6,b.depth+.6);if(b.kind==='frameTower')local('entrance-canopy',0,b.depth/2+1.5,12,3,4.35,4.05);}
  if(b.id==='B04'){
   for(const sign of [-1,1])local('entrance-planter',sign*L.entranceBedOffset,b.depth/2+L.entranceBedZ,L.entranceBedWidth,L.entranceBedDepth,1.0);
   local('CDS-1-sign',11.15,b.depth/2+6.13,.8,.3,2.65);
   for(const sign of [-1,1])local('security-pole',sign*9.25,b.depth/2+4.83,.15,.15,5.1);
  }
 }
 // Structural supports are solid; the space under raised walks stays accessible.
 for(const x of [-20,20]){for(let z=-52;z<=55;z+=12)box('walkway-column',x,z,.6,.6,s.bridgeHeight);box('walkway-deck',x,0,4.4,115,s.bridgeHeight+.2,s.bridgeHeight-.2);}

 for(const x of [-25,-15])for(const z of [30,40])box('oculus-column',x,z,.6,.6,s.bridgeHeight);
 for(let z=-94;z<=94;z+=13)for(const x of [-101,101])circle('tree',x,z,.23,3.8);
 for(let z=53;z<=89;z+=12)for(const x of [-20,20])circle('tree',x,z,.23,3.8);
 for(let x=-82;x<=84;x+=14){circle('tree',x,-96,.23,3.8);circle('tree',x,108,.23,3.8);}
 for(const x of [-18,18])for(const z of [-25,-12])circle('tree',x,z,.23,3.8);
 for(const z of [-94,-27,92])for(const x of [-52,52])box('planting-bed',x,z,55,3.5,.5);
 box('HKU-lawn-letters',0,91,9,.8,3.6);
 box('sports-hall-closed',-68,s.sportsZ,39,26,10.5);
 for(const [x,w]of [[-5,44],[53,51]])for(const side of [-1,1])box('court-fence',x,s.sportsZ+side*13,w,.12,4);
 for(const x of [-15.5,5.5])box('tennis-net',x,s.sportsZ,19,.1,1.3);
 // Discrete top guard segments, with a real gate at the ramp entrance (east side).
 const n=80;for(let i=1;i<n-1;i++){
  const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
  const x0=s.plazaX+s.plazaRadiusX*Math.cos(a),z0=s.plazaZ+s.plazaRadiusZ*Math.sin(a);
  const x1=s.plazaX+s.plazaRadiusX*Math.cos(b),z1=s.plazaZ+s.plazaRadiusZ*Math.sin(b);
  box('plaza-guard',(x0+x1)/2,(z0+z1)/2,Math.hypot(x1-x0,z1-z0),.12,1.12,-.08,-Math.atan2(z1-z0,x1-x0));
  box('plaza-retaining-wall',(x0+x1)/2,(z0+z1)/2,Math.hypot(x1-x0,z1-z0),.35,.05,-s.plazaDepth-.1,-Math.atan2(z1-z0,x1-x0));
 }
 // Conservative visible site boundary; no exploration beyond the referenced rectangle.
 for(const x of [-1,1])box('site-boundary',x*(s.width/2-.5),s.centerZ,.3,s.depth,1.1);
 for(const z of [-1,1])box('site-boundary',0,s.centerZ+z*(s.depth/2-.5),s.width,.3,1.1);
 const meshes=obstacles.map(o=>{const mesh=new T.Mesh(new T.BoxGeometry(o.w,o.top-o.bottom,o.d));mesh.name=o.name;mesh.position.set(o.x,(o.top+o.bottom)/2,o.z);mesh.rotation.y=o.angle;mesh.updateMatrixWorld();return mesh;});
 function support(x:number,z:number,y:number):number|null{
  if(Math.abs(x)>s.width/2-.75||Math.abs(z-s.centerZ)>s.depth/2-.75)return null;
  let h=0;
  if(Math.abs(Math.abs(x)-94)<3.5&&Math.abs(z)<96.5)h=.05;
  if(Math.abs(x)<94&&(Math.abs(z+44)<3.5||Math.abs(z-98)<3.5))h=.05;
  if(Math.abs(Math.abs(x)-16.8)<1.5&&z>30&&z<100)h=.07;
  const dx=x-s.plazaX,dz=z-s.plazaZ,q=Math.hypot(dx/s.plazaRadiusX,dz/s.plazaRadiusZ);
  if(q<1){
   h=-s.plazaDepth;
   const rx=s.plazaRadiusX-2,rz=s.plazaRadiusZ-2;
   let a=Math.atan2(dz/rz,dx/rx);if(a<0)a+=Math.PI*2;
   const radial=Math.hypot(dx/rx,dz/rz),width=L.rampWidth/2/Math.max(rx,rz);
   if(Math.abs(radial-1)<width+.012&&a>=L.rampStart){const r=-s.plazaDepth+(a-L.rampStart)/(L.rampEnd-L.rampStart)*s.plazaDepth;if(r<=y+C.maxStep+.04)h=r;}
   // Upper ramp landing: flat connector across the eastern lip.
   if(dx>rx-1.8&&Math.abs(dz)<.9&&y>-.3)h=0;
  }
  if(Math.abs(x)<L.stairWidth/2&&z>=-51.4&&z<=-27.4){
   const idx=Math.min(29,Math.max(0,Math.floor((z+51.4)/.8)));
   h=(30-idx)*.17;
   if(Math.abs(x)>L.stairWalkWidth/2)h=Math.ceil((30-idx)/3)*.51;
  }
  if(Math.abs(x)<15&&z>=-52.7&&z< -51.4)h=5.1;
  if(Math.abs(x)<14&&z>53&&z<93)h=Math.max(h,.13);
  if(Math.abs(x)<s.sportsWidth/2&&Math.abs(z-s.sportsZ)<s.sportsDepth/2)h=.14;
  if(((x>27.5&&x<78.5)||(x> -27&&x<17))&&Math.abs(z-s.sportsZ)<12.5)h=.19;
  // The entrance threshold is a small climb, not the auditorium's grand stair.
  const b=specs.find(b=>b.id==='B04')!,a=b.rotation*Math.PI/180;
  const bx=Math.cos(a)*(x-b.x)-Math.sin(a)*(z-b.z),bz=Math.sin(a)*(x-b.x)+Math.cos(a)*(z-b.z);
  if(Math.abs(bx)<b.width/2&&bz>b.depth/2+.1&&bz<b.depth/2+9.7)h=Math.max(h,.08);
  if(Math.abs(bx)<b.width/2+2&&bz>b.depth/2+9.75&&bz<b.depth/2+16.25)h=Math.max(h,.045);
  if(Math.abs(bx)<5.7&&bz>b.depth/2&&bz<b.depth/2+3.03)h=Math.max(h,.12);
  return h;
 }
 function overlaps(o:Obstacle,x:number,z:number,r=C.radius){
  const dx=x-o.x,dz=z-o.z;if(o.radius)return dx*dx+dz*dz<(o.radius+r)**2;
  const co=Math.cos(o.angle),si=Math.sin(o.angle),lx=co*dx-si*dz,lz=si*dx+co*dz;
  return Math.max(Math.abs(lx)-o.w/2,0)**2+Math.max(Math.abs(lz)-o.d/2,0)**2<r*r;
 }
 function contacts(x:number,z:number,y:number,height=C.height){return obstacles.filter(o=>y+height>o.bottom+.003&&y<o.top-.003&&overlaps(o,x,z));}
 function blocked(x:number,z:number,y:number,r=C.radius){return obstacles.some(o=>y+C.height>o.bottom+.003&&y<o.top-.003&&overlaps(o,x,z,r));}
 function step(position:T.Vector3,dx:number,dz:number){
  // Subdivide even a low-FPS update: no tunnelling through thin glass or trunks.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.07));
  const valid=(x:number,z:number)=>{const h=support(x,z,position.y);if(h===null||h-position.y>C.maxStep+.001||position.y-h>C.maxDrop+.001||blocked(x,z,h))return false;
   // Support check around the feet stops balancing on the lip of a large drop.
   for(const [ox,oz]of [[.16,0],[-.16,0],[0,.16],[0,-.16]]){const sh=support(x+ox,z+oz,h);if(sh===null||h-sh>C.maxDrop+.02)return false;}
   position.set(x,h,z);return true;};
  for(let i=0;i<n;i++){const x=position.x+dx/n,z=position.z+dz/n;if(!valid(x,z)){valid(x,position.z);valid(position.x,z);}}
 }
 return{obstacles,meshes,support,blocked,contacts,overlaps,step,dispose(){meshes.forEach(m=>{m.geometry.dispose();(m.material as T.Material).dispose();});}};
}
export type Navigation=ReturnType<typeof createNavigation>;
