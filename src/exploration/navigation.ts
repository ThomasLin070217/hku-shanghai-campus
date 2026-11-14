import {driveLayout,centralWalkLayout,promenadeLayout,contains} from '../model/groundLayout';
import {linkLayout} from '../model/nov14Details';
import {COURTYARD,courtyardHeight,courtyardGate,stairPoint} from '../model/courtyard';
import {landscapeLayout} from '../model/landscapeDetails';
import * as T from 'three';
import {COLUMN_X,CALIBRATED_LAYOUT as CL} from '../model/scaleCalibration';

import {LION,lionBodySize} from '../model/lionParameters';
import {NOV13 as N} from '../model/nov13Parameters';
import {VIDEO_DETAILS as V} from '../model/videoDetailsParameters';
import type {BuildingSpec,SiteParameters} from '../model/campusParameters';
import {EXPLORATION as C,LANDSCAPE as L} from './config';
export interface Obstacle {name:string;x:number;z:number;w:number;d:number;bottom:number;top:number;angle:number;radius?:number}
/** Stable cylinder against oriented boxes. No render-mesh ownership; works after geometry merging. */
export function createNavigation(specs:BuildingSpec[],s:SiteParameters){
 const obstacles:Obstacle[]=[];
 const drives=driveLayout(),walks=centralWalkLayout(s),promenades=promenadeLayout();
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
 for(const x of [CL.westWalkX]){for(let z=-52;z<=55;z+=12)if(z<27.5||z>42.5)box('walkway-column',x,z,.6,.6,s.bridgeHeight);for(const [start,end] of [[-57.5,27.5],[42.5,57.5]]){box('walkway-deck',x,(start+end)/2,4.4,end-start,s.bridgeHeight+.2,s.bridgeHeight-.2);for(const side of [-1,1])box('walkway-glass-guard',x+side*2.2,(start+end)/2,.08,end-start,s.bridgeHeight+1.27,s.bridgeHeight+.2);}}

 for(const x of [CL.westWalkX-5,CL.westWalkX+5])for(const z of [30,40])box('oculus-column',x,z,.6,.6,s.bridgeHeight);
 for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2,mid=(a+b)/2;box('oculus-glass-guard',CL.westWalkX+3.12*Math.sin(mid),35+3.12*Math.cos(mid),2*3.12*Math.sin(Math.PI/32),.06,s.bridgeHeight+1.46,s.bridgeHeight+.38,mid);}
 for(let z=-94;z<=94;z+=13)for(const x of [-101,101])circle('tree',x,z,.23,3.8);

 for(let x=-82;x<=84;x+=14){circle('tree',x,-92.5,.23,3.8);circle('tree',x,108,.23,3.8);}
 for(const x of [-18])for(const z of [-25,-12])circle('tree',x,z,.23,3.8);
 for(const z of [-94,-27,92])for(const x of [-COLUMN_X,COLUMN_X])box('planting-bed',x,z,55,3.5,.5);
 box('HKU-lawn-letters',0,91,9,.8,3.6);
 box('sports-hall-closed',-68,s.sportsZ,39,26,10.5);
 for(const [x,w]of [[-5,44],[53,51]])for(const side of [-1,1])box('court-fence',x,s.sportsZ+side*13,w,.12,4);
 for(const x of [-15.5,5.5])box('tennis-net',x,s.sportsZ,19,.1,1.3);
 // Continuous top rim, with openings only at the two observed curved stair landings.
 const n=80;for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
  const x0=s.plazaX+s.plazaRadiusX*Math.cos(a),z0=s.plazaZ+s.plazaRadiusZ*Math.sin(a);
  const x1=s.plazaX+s.plazaRadiusX*Math.cos(b),z1=s.plazaZ+s.plazaRadiusZ*Math.sin(b);
  if(!courtyardGate(s,(x0+x1)/2,(z0+z1)/2))box('plaza-guard',(x0+x1)/2,(z0+z1)/2,Math.hypot(x1-x0,z1-z0),.12,1.12,-.08,-Math.atan2(z1-z0,x1-x0));
  box('plaza-retaining-wall',(x0+x1)/2,(z0+z1)/2,Math.hypot(x1-x0,z1-z0),.35,.05,-s.plazaDepth-.1,-Math.atan2(z1-z0,x1-x0));
 }
 // Conservative visible site boundary; no exploration beyond the referenced rectangle.
 for(const x of [-1,1])box('site-boundary',x*(s.width/2-.5),s.centerZ,.3,s.depth,1.1);
 for(const z of [-1,1])box('site-boundary',0,s.centerZ+z*(s.depth/2-.5),s.width,.3,1.1);
 for(const p of V.hedgeCenters){box('video-hedge',p.x,p.z,1.65,V.hedgeLength,.65);circle('video-sapling',p.x,p.z+2.3,.16,3.7);}
 for(const p of V.northernBeds)box('northern-hedge',p.x,-90.5,p.width,2.6,.76);
 const mon=V.monument;box('CDS-landscape-monument',mon.x,mon.z,mon.width,mon.depth,mon.height,0,mon.rotation);
 const hs=V.hallSign;box('building-6-sign',hs.x,hs.z,hs.width,hs.depth,hs.height);
 for(const z of [-42,-19,48])circle('walk-lamp',CL.eastLampX,z,.10,4.8);
 for(const x of [-78,-40,0,40,78])circle('court-light',x,-102.5,.10,6.1);
 box(N.lion.id,N.lion.x,N.lion.z+lionBodySize().zOffset,N.lion.width,N.lion.depth,LION.groundY+N.lion.height,LION.groundY,LION.yaw);box('lion-support',LION.x,LION.z+.12,LION.support.width,LION.support.depth,LION.groundY+LION.support.height,LION.groundY,LION.yaw);
 for(const b of N.benches)box(b.id,b.x,b.z,.55,2.5,.70);
 const ms=N.mapSign;box(ms.id,ms.x,ms.z,ms.width,ms.depth,ms.height);
 for(const x of CL.eastKerbX)for(const [z,d]of [[-16,22],[13,14],[61,16]])box('promenade-kerb',x,z,.22,d,.14);
 // Geometry and collisions share the same curved flight parameters.
 for(let f=0;f<2;f++)for(let i=0;i<COURTYARD.steps;i++){
  const a=stairPoint(s,f,i/COURTYARD.steps),b=stairPoint(s,f,(i+1)/COURTYARD.steps),mid=a.clone().add(b).multiplyScalar(.5),len=Math.hypot(b.x-a.x,b.z-a.z),angle=-Math.atan2(b.z-a.z,b.x-a.x),y=-s.plazaDepth*(i+1)/COURTYARD.steps;
  box('curved-stair-tread',mid.x,mid.z,len+.015,COURTYARD.width,y,y-.18,angle);
  for(const side of [-1,1]){if(side===1&&i<2||side===-1&&i>=COURTYARD.steps-2)continue;const p0=stairPoint(s,f,i/COURTYARD.steps,side*(COURTYARD.width/2-.04)),p1=stairPoint(s,f,(i+1)/COURTYARD.steps,side*(COURTYARD.width/2-.04));box('curved-stair-guard',(p0.x+p1.x)/2,(p0.z+p1.z)/2,Math.hypot(p1.x-p0.x,p1.z-p0.z),.055,Math.max(a.y,b.y)+1.05,Math.min(a.y,b.y),-Math.atan2(p1.z-p0.z,p1.x-p0.x));}
 }
 const planted=landscapeLayout(specs,s);for(const bed of planted.beds)if(bed.kerb)box(bed.id,bed.x,bed.z,bed.w,bed.d,bed.y+bed.kerb,bed.y);for(const tree of planted.trees)circle(tree.id,tree.x,tree.z,.13,tree.y+tree.height*.8);
 const link=linkLayout(specs);box('B04-B05-link-slab',link.x,link.z,link.width,link.length,link.bottom+.14,link.bottom-.14);
 for(const side of [-1,1]){for(const z of [-link.length*.33,link.length*.33])box('B04-B05-link-column',link.x+side*(link.width/2-.5),link.z+z,.55,.55,link.bottom);box('side-passage-planter',link.x+side*(link.width/2+1.6),link.z,1.2,3.4,.65);for(const z of [-20,-6])circle('north-green-link-tree',side*10.5,z,.12,4.2);}
 const meshes=obstacles.map(o=>{const mesh=new T.Mesh(new T.BoxGeometry(o.w,o.top-o.bottom,o.d));mesh.name=o.name;mesh.position.set(o.x,(o.top+o.bottom)/2,o.z);mesh.rotation.y=o.angle;mesh.updateMatrixWorld();return mesh;});
 function support(x:number,z:number,y:number):number|null{
  if(Math.abs(x)>s.width/2-.75||Math.abs(z-s.centerZ)>s.depth/2-.75)return null;
  let h=0;
  if(drives.some(r=>contains(r,x,z)))h=.05;
  if(walks.some(r=>contains(r,x,z)))h=.07;
  if(Math.abs(x)<2&&z> -27&&z<2)h=Math.max(h,.04);
  const dx=x-s.plazaX,dz=z-s.plazaZ,q=Math.hypot(dx/s.plazaRadiusX,dz/s.plazaRadiusZ);
  if(q<1){
   h=-s.plazaDepth;
   const stair=courtyardHeight(s,x,z);if(stair!==null&&stair<=y+C.maxStep+.04)h=stair;
  }
  if(Math.abs(x)<L.stairWidth/2&&z>=-51.4&&z<=-27.4){
   const idx=Math.min(29,Math.max(0,Math.floor((z+51.4)/.8)));
   h=(30-idx)*.17;
   if(Math.abs(x)>L.stairWalkWidth/2)h=Math.ceil((30-idx)/3)*.51;
  }
  if(Math.abs(x)<15&&z>=-52.7&&z< -51.4)h=5.1;
  if(Math.abs(x)<14&&z>53&&z<93)h=Math.max(h,.13);if(Math.abs(x)>2&&Math.abs(x)<13&&z> -24.5&&z<.5)h=Math.max(h,.09);
  if(Math.abs(x)<s.sportsWidth/2&&Math.abs(z-s.sportsZ)<s.sportsDepth/2)h=.14;
  if(((x>27.5&&x<78.5)||(x> -27&&x<17))&&Math.abs(z-s.sportsZ)<12.5)h=.19;
  if(promenades.some(r=>contains(r,x,z)))h=Math.max(h,V.pathHeight);
  const mx=Math.cos(mon.rotation)*(x-mon.x)-Math.sin(mon.rotation)*(z-mon.z),mz=Math.sin(mon.rotation)*(x-mon.x)+Math.cos(mon.rotation)*(z-mon.z);
  if(Math.abs(mx)<2.6&&Math.abs(mz-.5)<1.5)h=Math.max(h,.14);
  if(Math.abs(x-V.track.x)<V.track.width/2&&Math.abs(z-V.track.z)<V.track.depth/2)h=Math.max(h,V.track.height);
  const ns=V.northernSteps,nb=specs.find(b=>b.id===ns.building)!;
  if(Math.abs(x-nb.x)<ns.width/2){const distance=nb.z-nb.depth/2-z;if(distance>0&&distance<ns.run*ns.count)h=Math.max(h,(ns.count-Math.floor(distance/ns.run))*ns.rise);}
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
 function surface(x:number,z:number,y:number):'grass'|'paving'{return (Math.abs(x)<14&&z>53&&z<93&&Math.abs(y-.13)<.12)||(Math.abs(x)>2&&Math.abs(x)<13&&z> -24.5&&z<.5&&Math.abs(y-.09)<.1)?'grass':'paving';}
 return{surface,obstacles,meshes,support,blocked,contacts,overlaps,step,dispose(){meshes.forEach(m=>{m.geometry.dispose();(m.material as T.Material).dispose();});}};
}
export type Navigation=ReturnType<typeof createNavigation>;
