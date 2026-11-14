import * as T from 'three';
import {CALIBRATED_LAYOUT as CL} from './scaleCalibration';
import {LION} from './lionParameters';
import {NOV13 as N} from './nov13Parameters';
import type {SiteParameters} from './campusParameters';
export function createLion(){
 const root=new T.Group();root.name=N.lion.id;root.userData={source:LION.source,status:LION.uncertainty,originalGeometry:true};const body=new T.Group();body.name='Lion_body_uniform_scale';root.add(body);
 const mat=(color:number)=>new T.MeshStandardMaterial({color,roughness:.83});const gold=mat(0xf3c426),mane=mat(0xe9a909),light=mat(0xffdd57),green=mat(0x8f9f3b),stripe=mat(0xc8c86a),nose=mat(0x885b22),dark=mat(0x4d4026);
 function block(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);body.add(o);o.castShadow=true;return o;}
 function round(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const g=new T.CylinderGeometry(1,1,1,8);g.rotateX(Math.PI/2);const o=new T.Mesh(g,m);o.scale.set(w/2,h/2,d);o.name=name;o.position.set(x,y,z);body.add(o);o.castShadow=true;return o;}
 // Stepped silhouettes and eight-sided forms preserve a pixel sculpture rather than smooth photorealism.
 block('Seated_body',1.7,1.85,1.35,0,1.6,0,green);block('Rounded_body_mid',1.95,1.25,1.25,0,1.55,0,green);
 for(const x of [-.5,-.25,0,.25,.5])block('Shirt_vertical_stripe',.10,1.6,.015,x,1.65,.684,stripe);
 round('Golden_mane',2.7,2.7,.72,0,3.25,0,mane);
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2,o=block('Mane_pixel_tuft',.42,.63,.63,Math.sin(a)*1.28,3.25+Math.cos(a)*1.28,0,mane);o.rotation.z=-a;}
 round('Face',2.0,1.95,.9,0,3.25,.28,gold);
 for(const s of [-1,1]){round('Ear',.64,.65,.4,s*.95,4.07,.14,gold);round('Ear_inner',.34,.35,.42,s*.95,4.07,.18,mane);round('Muzzle',.83,.72,.42,s*.32,2.94,.81,light);block('Eye',.12,.18,.04,s*.42,3.51,.76,dark);block('Eye_glint',.04,.05,.02,s*.42-.02,3.55,.789,light);round('Paw',1.05,.9,.9,s*.78,.54,.6,gold);round('Arm',.66,.85,.72,s*1.0,1.52,.28,gold);for(const dx of [-.2,0,.2])block('Paw_toe',.20,.22,.08,s*.78+dx,.69,1.04,light);}
 block('Nose',.52,.3,.20,0,3.14,1.05,nose);block('Smile',.32,.10,.03,0,2.72,1.03,nose);block('Gown_badge',.22,.25,.025,.55,1.94,.70,mane);
 const bounds=new T.Box3().setFromObject(body),scale=LION.bodyHeight/(bounds.max.y-bounds.min.y);
 body.scale.setScalar(scale);body.position.y=LION.support.height-bounds.min.y*scale;
 const base=new T.Mesh(new T.BoxGeometry(LION.support.width,LION.support.height,LION.support.depth),mat(0x59664a));base.name='Lion_low_support_PROVISIONAL';base.position.set(0,LION.support.height/2,.12);base.castShadow=base.receiveShadow=true;root.add(base);root.userData.bodyHeight=LION.bodyHeight;root.userData.support=LION.support;root.rotation.y=LION.yaw;return root;
}
export function addNov13Details(environment:T.Group,circulation:T.Group,s:SiteParameters){
 const root=new T.Group();root.name='Nov13_Observed_Corrections';root.userData={source:'IMG_4339/IMG_4342',units:'metres',revision:N.revision};environment.add(root);
 const stone=new T.MeshStandardMaterial({name:'Nov13 pale paving',color:0xc4c8c1,roughness:.95}),metal=new T.MeshStandardMaterial({name:'Nov13 rail',color:0x788b8b,metalness:.45,roughness:.55}),dark=new T.MeshStandardMaterial({name:'Nov13 dark signage',color:0x30413e});
 const box=(g:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 const beam=(g:T.Object3D,name:string,a:T.Vector3,b:T.Vector3,r=.035)=>{const o=box(g,name,r,a.distanceTo(b),r,0,0,0,metal);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());};
 const lion=createLion();lion.position.set(LION.x,LION.groundY,LION.z);root.add(lion);
 for(const b of N.benches){box(root,b.id, .55,.42,2.5,b.x,.21,b.z,stone);box(root,b.id+'-back',.12,.28,2.5,b.x+.22,.56,b.z,stone);}
 // Low pale curbs segment the observed path; gaps remain at crossing points.
 for(const x of CL.eastKerbX)for(const [z,d]of [[-16,22],[13,14],[61,16]])box(root,'Promenade_low_kerb',.22,.14,d,x,.07,z,stone);
 const ms=N.mapSign;box(root,ms.id,ms.width,ms.height,ms.depth,ms.x,ms.height/2,ms.z,dark);box(root,'Directory_pale_panel',ms.width-.12,1.35,.015,ms.x,1.3,ms.z+.10,stone);
 for(let r=0;r<3;r++)for(let c=0;c<2;c++)box(root,'Directory_building_symbol',.20,.16,.01,ms.x+(c-.5)*.3,1.65-r*.25,ms.z+.112,dark);
 // U06 replaces the earlier straight flights and spiral ramp with observed curved flights.
}
