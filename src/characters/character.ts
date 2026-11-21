import * as T from 'three';
import rig from './kenney-rig.json';
import {STUDENT,type Appearance} from './config';
import {characterTexture} from './texture';
import {ITEMS} from '../items/definitions';
import {Gait,type Motion} from './gait';
export type {Motion} from './gait';
export const ANIMATION_MAP={idle:'idle',walk:'walk',run:'sprint',jump:'authored-jump',land:'authored-land',hold:'holding-both'};
function geometry(m:typeof rig.meshes[number]){
 const base=new T.BufferGeometry();base.setAttribute('position',new T.Float32BufferAttribute(m.position,3));base.setIndex(m.index);const g=base.toNonIndexed();base.dispose();g.computeVertexNormals();g.computeBoundingBox();const b=g.boundingBox!,p=g.attributes.position,uv:number[]=[];
 for(let i=0;i<p.count;i+=3){const vs=Array.from({length:3},(_,k)=>new T.Vector3().fromBufferAttribute(p,i+k));const flat=(axis:'x'|'y'|'z')=>Math.max(...vs.map(v=>v[axis]))-Math.min(...vs.map(v=>v[axis]))<1e-5;const axis=flat('x')?'x':flat('y')?'y':'z';const sign=Math.abs(vs[0][axis]-b.max[axis])<1e-5;const f=axis==='x'?(sign?0:1):axis==='y'?(sign?2:3):(sign?4:5);
 for(const v of vs){let u=axis==='x'?(v.z-b.min.z)/(b.max.z-b.min.z):(v.x-b.min.x)/(b.max.x-b.min.x),vv=axis==='y'?(v.z-b.min.z)/(b.max.z-b.min.z):(v.y-b.min.y)/(b.max.y-b.min.y);if(f===0||f===5)u=1-u;uv.push((f+(.002+u*.996))/6,.002+vv*.996);}}
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;
}
const geometries=rig.meshes.map(m=>{const g=geometry(m);if(m.name.startsWith('arm')){const p=g.getAttribute('position');for(let i=0;i<p.count;i++)if(p.getY(i)<-.65)p.setY(i,-.65);g.computeBoundingBox();}return g;}); // Immutable shared GPU buffers; all poses and materials are per instance.
export function createCharacter(input:Appearance=STUDENT){
 const config=structuredClone(input),root=new T.Group();root.name=config.id;
 const scale=config.height/2.7,visual=new T.Group();visual.scale.set(scale*config.build,scale,scale);visual.rotation.y=Math.PI;root.add(visual);
 const nodes=rig.nodes.map(n=>{
  const o='mesh' in n?new T.Mesh(geometries[n.mesh!],new T.MeshStandardMaterial({map:characterTexture(n.name,config),roughness:.9})):new T.Group();o.name=n.name;if('translation' in n)o.position.fromArray(n.translation!);if('scale' in n)o.scale.fromArray(n.scale!);o.castShadow=o.receiveShadow=true;return o;
 });rig.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));visual.add(nodes[0]);
 const get=(name:string)=>nodes.find(n=>n.name===name)!;
 const torso=get('torso'),head=get('head'),left=get('arm-left'),right=get('arm-right');
 // A narrower face is just a head-node scale; hair blocks are children, so they follow.
 if(config.faceWidth&&config.faceWidth!==1)head.scale.x*=config.faceWidth;
 for(const [arm,sign] of [[left,1],[right,-1]] as const){const hand=new T.Mesh(new T.BoxGeometry(.20,.30,.25),new T.MeshStandardMaterial({color:config.skin,roughness:.95}));hand.name='Student_hand';hand.position.set(sign*.20,-.80,0);arm.add(hand);}
 const green=new T.MeshStandardMaterial({color:config.coat,roughness:1}),trim=new T.MeshStandardMaterial({color:config.trim,roughness:1});
 const box=(p:T.Object3D,n:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=n;o.position.set(x,y,z);p.add(o);o.castShadow=true;return o;};
 if(config.gown){box(torso,'Gown_back',.87,1.32,.065,0,.55,-.335,green);for(const s of [-1,1]){box(torso,'Open_gown_panel',.25,1.3,.055,s*.30,.55,.333,green);box(torso,'Gown_facing',.045,1.31,.015,s*.175,.55,.37,trim);box(torso,'Back_pleat',.035,1.17,.02,s*.20,.55,-.38,trim);}}
 // Continuous hair cap on all sides is painted into the six-face atlas, with a shallow solid crown.
 const hair=new T.MeshStandardMaterial({color:config.hair,roughness:1});box(head,'Short_hair_crown',8.12,.28,8.12,0,7.94,0,hair);
 // 'long' builds a layered silhouette instead of one slab: sweep fringe, two-length back
 // mass, side panels down to the shoulders and front locks that frame the face. Outer faces
 // sit just outside the head box so nothing is coplanar with it.
 if(config.hairStyle==='long'){
  box(head,'Long_hair_sweep',4.6,1.35,1.2,-.55,7.15,3.65,hair);
  box(head,'Long_hair_back_upper',8.5,4.6,1.8,0,5.4,-4.85,hair);
  box(head,'Long_hair_back_lower',7.9,2.6,1.5,0,1.9,-4.9,hair);
  for(const side of [-1,1]){
   box(head,'Long_hair_side',.62,6.8,5.4,side*4.35,3.8,-1.0,hair);
   box(head,'Long_hair_front_lock',.58,3.8,1.0,side*4.05,4.6,3.4,hair);
  }
 }
 const sockets={leftHand:new T.Group(),rightHand:new T.Group(),back:new T.Group()};
 left.add(sockets.leftHand);right.add(sockets.rightHand);torso.add(sockets.back);
 sockets.leftHand.name='slot_left_hand';sockets.rightHand.name='slot_right_hand';sockets.back.name='slot_back';
 sockets.leftHand.position.set(.2,-.92,0);sockets.rightHand.position.set(-.2,-.92,0);sockets.back.position.set(0,.75,-.4);
 for(const s of [sockets.leftHand,sockets.rightHand,sockets.back])s.scale.set(1/(scale*config.build),1/scale,1/scale);
 // The imported rig is retained. Its source head/root animation tracks are not played:
 // locomotion pose is owned once here, world transform once by CharacterPhysics/controller.
 const mixer=new T.AnimationMixer(nodes[0]),gait=new Gait();let equippedId:string|null=null,held:T.Group|null=null,hold=0;
 const legL=get('leg-left'),legR=get('leg-right'),rigRoot=get('root');
 const rest=new Map(nodes.map(n=>[n,{p:n.position.clone(),q:n.quaternion.clone()}]));
 function equip(id:string|null){if(id===equippedId)return;held?.removeFromParent();if(held)disposeOwned(held);held=null;equippedId=id;const def=id?ITEMS[id]:null;if(def){held=def.createModel();const h=def.hold;held.position.fromArray(h.position);held.rotation.fromArray(h.rotation);held.scale.setScalar(h.scale);sockets[h.socket].add(held);}}
 function animate(dt:number,distance:number,grounded=true,vertical=0,speedHint?:number){
  if(dt<=0)return;gait.update(dt,distance,grounded,vertical,speedHint);
  const phase=gait.phase,amount=gait.blend,run=gait.run,amplitude=.52+run*.30;
  // Keep the planted leg at ground level; only the swing leg receives a modest lift.
  const angle=Math.cos(phase)*amplitude*amount;
  const air=grounded?0:1,land=gait.landing;
  legL.rotation.set(grounded?angle:-.30,0,0);legR.rotation.set(grounded?-angle:.22,0,0);
  legL.position.copy(rest.get(legL)!.p);legR.position.copy(rest.get(legR)!.p);
  if(grounded){legL.position.y+=Math.max(0,Math.sin(phase))*.15*amount;legR.position.y+=Math.max(0,-Math.sin(phase))*.15*amount;}
  rigRoot.position.copy(rest.get(rigRoot)!.p);rigRoot.quaternion.identity();
  if(grounded){const minY=(leg:T.Object3D)=>{const bb=(leg as T.Mesh).geometry.boundingBox!;return leg.position.y+bb.min.y*Math.cos(leg.rotation.x)-Math.max(Math.abs(bb.min.z),Math.abs(bb.max.z))*Math.abs(Math.sin(leg.rotation.x));};rigRoot.position.y=-Math.min(minY(legL),minY(legR));}
  torso.position.copy(rest.get(torso)!.p);torso.position.y-=land*.04;torso.position.y+=(1-amount)*Math.sin(gait.time*1.7)*.004;
  torso.rotation.set(run*amount*.07+air*.03,0,0);
  // Counter a small body lean. No camera look-at, yaw scan, random head movement or raw clip track.
  head.quaternion.copy(torso.quaternion).invert();
  left.rotation.set(grounded?-angle*.65:vertical>0?-.30:.16,0,0);right.rotation.set(grounded?angle*.65:vertical>0?-.30:.16,0,0);
  hold=T.MathUtils.damp(hold,equippedId?1:0,20,dt);
  left.rotation.x=T.MathUtils.lerp(left.rotation.x,-1.1,hold);right.rotation.x=T.MathUtils.lerp(right.rotation.x,-1.1,hold);
  left.rotation.z=T.MathUtils.lerp(left.rotation.z,-.40,hold);right.rotation.z=T.MathUtils.lerp(right.rotation.z,.40,hold);
  sockets.rightHand.quaternion.copy(right.quaternion).invert();sockets.leftHand.quaternion.copy(left.quaternion).invert();
 }
 function dispose(){mixer.stopAllAction();mixer.uncacheRoot(nodes[0]);disposeOwned(root,true);}
 return{root,head,visual,config,nodes,mixer,sockets,gait,animate,equip,dispose,get motion(){return gait.motion;},get equippedId(){return equippedId;},get held(){return held;}};
}
function disposeOwned(root:T.Object3D,shared=false){const mats=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){if(!shared||!geometries.includes(o.geometry))o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);if('map'in m&&m.map)textures.add(m.map as T.Texture);}}});mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
export function createFirstPersonArms(a:Appearance=STUDENT){
 const root=new T.Group();root.name='First_person_HKU_arms';
 // The old viewmodel kept the hanging -X rotation, so both arms pointed behind the near
 // plane and only clipped green slabs reached the lens. Each forearm now rises from a
 // lower corner of the lens to a visible hand, with a thin shirt cuff at the wrist.
 const handY=.505,cuffGeometry=new T.BoxGeometry(.084,.024,.084),sleeveGeometry=new T.BoxGeometry(.078,.44,.078);
 const handGeometry=new T.BoxGeometry(.072,.09,.08);
 const skin=new T.MeshStandardMaterial({color:a.skin,roughness:.95}),coat=new T.MeshStandardMaterial({color:a.coat,roughness:1}),cuff=new T.MeshStandardMaterial({color:a.shirt,roughness:1});
 for(const side of [-1,1]){
  const arm=new T.Group(),handAt=new T.Vector3(side*.185,-.23,-.45),direction=new T.Vector3(-side*.5,.32,-.8).normalize();
  arm.name=side<0?'First_person_arm_left':'First_person_arm_right';
  arm.position.copy(handAt).addScaledVector(direction,-handY);
  arm.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),direction);
  const sleeve=new T.Mesh(sleeveGeometry,coat);sleeve.name='First_person_sleeve';sleeve.position.y=-.22;sleeve.castShadow=sleeve.receiveShadow=false;arm.add(sleeve);
  const wrist=new T.Mesh(cuffGeometry,cuff);wrist.name='First_person_cuff';wrist.position.y=-.452;wrist.castShadow=wrist.receiveShadow=false;arm.add(wrist);
  const hand=new T.Mesh(handGeometry,skin);hand.name='First_person_hand';hand.position.y=-handY;hand.castShadow=hand.receiveShadow=false;arm.add(hand);
  root.add(arm);
 }
 const socket=new T.Group();socket.name='First_person_item_socket';socket.position.set(0,-.22,-.30);socket.rotation.x=.10;root.add(socket);let id:string|null=null,held:T.Group|null=null;const holdPos=new T.Vector3(0,-.22,-.30);let holdScale=1;
 return{root,socket,equip(next:string|null){if(next===id)return;held?.removeFromParent();if(held)disposeOwned(held);held=null;id=next;if(next){const def=ITEMS[next],h=def.hold.firstPerson;held=def.createModel();socket.position.fromArray(h.position);socket.rotation.fromArray(h.rotation);socket.scale.setScalar(h.scale);holdPos.fromArray(h.position);holdScale=h.scale;socket.add(held);}},
  /** Walking carry sits lower and 30% smaller; opening the MacBook (C) restores the authored pose. */
  setCarry(open:boolean){socket.position.copy(holdPos);socket.scale.setScalar(holdScale*(open?1:.7));if(!open)socket.position.y-=.12;},
  dispose(){disposeOwned(root,true);},get held(){return held;}};
}
