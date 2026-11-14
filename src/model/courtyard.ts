import * as T from 'three';
import {glassMaterial,pane} from './glazing';
import type {SiteParameters} from './campusParameters';
/** U06 02:16–02:37: two curved flights, glass guards, lower glazing and concentric paving.
 * Angular extent/count/metric sizes are authoring estimates, not a survey. */
export const COURTYARD={steps:28,width:2.8,span:Math.PI/2,starts:[Math.PI/2,-Math.PI/2],landingDepth:2.0,railHeight:1.05};
export function stairPoint(s:SiteParameters,flight:number,t:number,edge=0){const c=COURTYARD,a=c.starts[flight]-c.span*t;return new T.Vector3(s.plazaX+(s.plazaRadiusX-c.width/2-.25+edge)*Math.cos(a),-s.plazaDepth*Math.min(1,Math.ceil(t*c.steps-1e-7)/c.steps),s.plazaZ+(s.plazaRadiusZ-c.width/2-.25+edge)*Math.sin(a));}
export function courtyardHeight(s:SiteParameters,x:number,z:number){
 const c=COURTYARD,dx=x-s.plazaX,dz=z-s.plazaZ,rx=s.plazaRadiusX-c.width/2-.25,rz=s.plazaRadiusZ-c.width/2-.25;
 const a=Math.atan2(dz/rz,dx/rx),radial=Math.hypot(dx/rx,dz/rz);
 for(let f=0;f<2;f++){let delta=(c.starts[f]-a+2*Math.PI)%(2*Math.PI);if(delta<1e-5)delta=0;
  if(delta<=c.span+1e-5&&Math.abs(radial-1)<=c.width/2/Math.max(rx,rz)+.015)return -s.plazaDepth*Math.min(c.steps,Math.floor(delta/c.span*c.steps)+1)/c.steps;
 }
 // Top landings reach beyond the lip; actual surface stays at y=0.
 if(Math.abs(dx)<c.width/2&&Math.abs(Math.abs(dz)-(s.plazaRadiusZ-.8))<1.25)return 0;
 return null;
}
export function courtyardGate(s:SiteParameters,x:number,z:number){return Math.abs(x-s.plazaX)<COURTYARD.width/2+.4&&Math.abs(z-s.plazaZ)>s.plazaRadiusZ-2.5;}
export function arcSlab(parent:T.Object3D,name:string,rx:number,rz:number,w:number,cx:number,cz:number,a:number,b:number,y:number,h:number,m:T.Material){
 const pos:number[]=[],idx:number[]=[];const n=4;
 for(let i=0;i<=n;i++){const t=a+(b-a)*i/n;for(const dy of [0,-h])for(const side of [-1,1])pos.push(cx+(rx+side*w/2)*Math.cos(t),y+dy,cz+(rz+side*w/2)*Math.sin(t));}
 for(let i=0;i<n;i++){const j=i*4,k=j+4;for(const [u,v]of [[0,1],[1,3],[3,2],[2,0]])idx.push(j+u,k+u,j+v,j+v,k+u,k+v);}idx.push(0,2,1,1,2,3,n*4,n*4+1,n*4+2,n*4+1,n*4+3,n*4+2);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));geo.setIndex(idx);geo.computeVertexNormals();const mesh=new T.Mesh(geo,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function addObservedCourtyard(parent:T.Group,s:SiteParameters){
 const root=new T.Group();root.name='U06_Curved_courtyard';root.userData={source:'U06 02:16–02:37',confidence:'curved flights/glass guards confirmed; metric geometry estimated'};parent.add(root);
 const stone=new T.MeshStandardMaterial({name:'Courtyard pale stone',color:0xb7bbb3,roughness:.9}),dark=new T.MeshStandardMaterial({name:'Courtyard dark inlay',color:0x65716e}),metal=new T.MeshStandardMaterial({name:'Courtyard handrail',color:0x88938c,metalness:.5,roughness:.3}),glass=glassMaterial('guard'),lower=glassMaterial('reflective');
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const beam=(name:string,a:T.Vector3,b:T.Vector3,w:number,m:T.Material)=>{const o=box(name,w,a.distanceTo(b),w,0,0,0,m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());};
 const c=COURTYARD,rx=s.plazaRadiusX-c.width/2-.25,rz=s.plazaRadiusZ-c.width/2-.25;
 for(let f=0;f<2;f++){
  const start=c.starts[f];for(let i=0;i<c.steps;i++){const a=start-c.span*i/c.steps,b=start-c.span*(i+1)/c.steps,y=-s.plazaDepth*(i+1)/c.steps;arcSlab(root,'Curved_stair_tread',rx,rz,c.width,s.plazaX,s.plazaZ,a,b,y,.18,stone);
   for(const side of [-1,1]){if(side===1&&i<2||side===-1&&i>=c.steps-2)continue;const edge=side*(c.width/2-.04),p=stairPoint(s,f,(i+.5)/c.steps,edge);box('Stair_guard_post',.045,1.05,.045,p.x,y+.525,p.z,metal);
    const p0=stairPoint(s,f,i/c.steps,edge),p1=stairPoint(s,f,(i+1)/c.steps,edge),mid=p0.clone().add(p1).multiplyScalar(.5),length=Math.hypot(p1.x-p0.x,p1.z-p0.z),yaw=-Math.atan2(p1.z-p0.z,p1.x-p0.x);
    const g=pane(root,'Curved_stair_glass_guard',length-.025,.86,mid.x,y+.53,mid.z,glass,yaw);g.userData.source='U06 02:22';beam('Sloped_stair_handrail',p0.add(new T.Vector3(0,1.05,0)),p1.add(new T.Vector3(0,1.05,0)),.055,metal);
   }
  }
  const sign=f===0?1:-1;box('Curved_stair_top_landing',c.width,.18,2.4,s.plazaX,-.09,s.plazaZ+sign*(s.plazaRadiusZ-.8),stone);
 }
 // Segmented glass at the top rim, open only at the two top landings.
 for(let i=0;i<96;i++){const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2,mid=(a+b)/2,x=s.plazaX+s.plazaRadiusX*Math.cos(mid),z=s.plazaZ+s.plazaRadiusZ*Math.sin(mid);if(courtyardGate(s,x,z))continue;
  const p0=new T.Vector3(s.plazaX+s.plazaRadiusX*Math.cos(a),1.08,s.plazaZ+s.plazaRadiusZ*Math.sin(a)),p1=new T.Vector3(s.plazaX+s.plazaRadiusX*Math.cos(b),1.08,s.plazaZ+s.plazaRadiusZ*Math.sin(b));pane(root,'Courtyard_top_glass',p0.distanceTo(p1)-.025,.9,x,.55,z,glass,-Math.atan2(p1.z-p0.z,p1.x-p0.x));beam('Courtyard_top_handrail',p0,p1,.05,metal);if(i%2===0)box('Courtyard_top_post',.045,1.07,.045,x,.535,z,metal);
  // Recessed lower-level glass and dark horizontal louvers, visible behind both flights.
  const inX=s.plazaX+(s.plazaRadiusX-.22)*Math.cos(mid),inZ=s.plazaZ+(s.plazaRadiusZ-.22)*Math.sin(mid);pane(root,'Lower_courtyard_glazing',p0.distanceTo(p1)-.06,2.9,inX,-s.plazaDepth+1.45,inZ,lower,-Math.atan2(p1.z-p0.z,p1.x-p0.x));
  for(let row=0;row<3;row++)arcSlab(root,'Lower_louver',s.plazaRadiusX-.30,s.plazaRadiusZ-.30,.04,s.plazaX,s.plazaZ,a,b,-1.0-row*.12,.055,dark);
 }
 // The photo shows concentric paving, not a fountain.
 for(const [rx0,rz0]of [[s.plazaRadiusX*.57,s.plazaRadiusZ*.57],[s.plazaRadiusX*.72,s.plazaRadiusZ*.72]])for(let i=0;i<64;i++)arcSlab(root,'Concentric_floor_inlay',rx0,rz0,.10,s.plazaX,s.plazaZ,i/64*Math.PI*2,(i+1)/64*Math.PI*2,-s.plazaDepth+.008,.015,dark);
 return root;
}
