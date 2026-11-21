import * as T from 'three';
import type {SiteParameters} from './campusParameters';
import {LANDSCAPE as L} from '../exploration/config';

/**
 * 2026-11-21 site photos: the banded east walk leaves the stair foot on the right and
 * curves down around the sunken court instead of running straight past it (U04/U06).
 * The black loop handrails on the broad seating steps are also from that visit.
 * Radius, angles and width are authoring estimates, not a survey.
 */
export const EAST_WALK={radius:19,width:4.2,from:-62*Math.PI/180,to:78*Math.PI/180,segments:26};

export function addCurvedEastWalk(parent:T.Object3D,s:SiteParameters){
  const root=new T.Group();root.name='Curved_East_Walk';
  root.userData={source:'U04,U06,Nov 21 2026 site photos',confidence:'curved banded walk confirmed; radius/angles estimated'};
  parent.add(root);
  const mat=(name:string,color:number,metalness=0)=>{const m=new T.MeshStandardMaterial({name,color,metalness,roughness:.92});m.userData.keepColor=true;return m;};
  const stone=mat('Axis walk pale stone',0xbfc2b2),dark=mat('Axis walk dark bands',0x5b6666),steel=mat('Axis walk drain steel',0x586b67,.35);
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,yaw:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.rotation.y=yaw;o.castShadow=false;o.receiveShadow=true;root.add(o);return o;};
  const c=EAST_WALK,r=c.radius,y=.04;
  const at=(a:number,rad=r)=>({x:s.plazaX+rad*Math.cos(a),z:s.plazaZ+rad*Math.sin(a)});
  const spans=[[c.from,c.to],[Math.PI-c.to,Math.PI-c.from]];
  for(const [s0,s1] of spans)for(let i=0;i<c.segments;i++){
    const a0=s0+(s1-s0)*i/c.segments,a1=s0+(s1-s0)*(i+1)/c.segments;
    const p0=at(a0),p1=at(a1),dx=p1.x-p0.x,dz=p1.z-p0.z,len=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);
    const mx=(p0.x+p1.x)/2,mz=(p0.z+p1.z)/2;
    box('Axis_curved_walk',len+.03,.04,c.width,mx,y/2,mz,yaw,stone);
    const am=(a0+a1)/2,nx=Math.cos(am),nz=Math.sin(am);
    for(const side of [-1,1])box('Axis_walk_drain',len+.02,.012,.07,mx+side*(c.width/2-.05)*nx,y+.006,mz+side*(c.width/2-.05)*nz,yaw,steel);
    if(i%2===0){const p=at(am);box('Axis_walk_cross_band',.32,.008,c.width-.06,p.x,y+.006,p.z,yaw,dark);}
  }
  return root;
}

/** Black rectangular loop handrails seen on the broad seating steps (C08 detail). */
export function addStairHandrails(parent:T.Object3D){
  const black=new T.MeshStandardMaterial({name:'Stair black handrail',color:0x15181a,roughness:.55,metalness:.25});
  const loop=(name:string,w:number,h:number,d:number,x:number,y:number,z:number)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),black);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  for(let i=0;i<L.stairCount;i+=3){
    const z=-50.2+i*L.stairRun,y=(L.stairCount-i)*L.stairRise;
    for(const k of [-1,1]){
      const x=k*9.1;
      for(const side of [-1,1])loop('Black_stair_handrail_side',.06,.86,.06,x,y+.43,z+side*.68);
      loop('Black_stair_handrail_top',1.42,.06,.06,x,y+.86,z);
      loop('Black_stair_handrail_base',1.42,.06,.06,x,y+.06,z);
    }
  }
}
