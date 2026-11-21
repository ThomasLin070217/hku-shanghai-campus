import * as T from 'three';
import type {Navigation} from '../exploration/navigation';
import {LION} from '../model/lionParameters';
import {NOV13} from '../model/nov13Parameters';
import {
  BOSS, canSubmit, CHARGE_HALF_WIDTH, CHARGE_LENGTH, CHARGE_WARNING, NODES, SAFE,
  SWIPE_HALF_ANGLE, SWIPE_RADIUS, type CombatState,
} from './combat';

const GROUND=LION.groundY;
const INACTIVE=0x557079;
const ACTIVE=0xffc34c;
const ONLINE=0x17f0bc;
const DANGER=0xe64132;

function floorMaterial(color:number,opacity:number) {
  return new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
}
function ring(radius:number,width:number,color:number) {
  const mesh=new T.Mesh(new T.RingGeometry(radius-width,radius,48),floorMaterial(color,.93));
  mesh.rotation.x=-Math.PI/2;
  mesh.position.y=.06;
  return mesh;
}
function box(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material) {
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}

function numberPlate(text:string) {
  const canvas=document.createElement('canvas');
  canvas.width=128; canvas.height=80;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#10272c';ctx.fillRect(0,0,128,80);
  ctx.strokeStyle='#cce9d7';ctx.lineWidth=4;ctx.strokeRect(3,3,122,74);
  ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 54px monospace';
  ctx.fillText(text,64,43);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false}));
  sprite.scale.set(1.06,.66,1);
  sprite.position.y=1.53;
  return sprite;
}

function helperModel() {
  const helper=new T.Group();
  const shell=new T.MeshStandardMaterial({color:0xe7e6cb,roughness:.6});
  const joint=new T.MeshStandardMaterial({color:0x20343a,metalness:.3});
  const indicator=new T.MeshBasicMaterial({color:ONLINE});
  box(helper,0,.64,0,.44,.28,.73,shell);
  box(helper,0,.77,.42,.41,.27,.33,joint);
  box(helper,0,.79,.60,.31,.065,.02,indicator);
  box(helper,0,.82,-.18,.26,.035,.31,joint);
  for(const x of [-.23,.23]) for(const z of [-.22,.22]) {
    box(helper,x,.43,z,.12,.32,.14,shell).rotation.x=.28;
    box(helper,x,.17,z-.01,.09,.22,.11,joint).rotation.x=-.27;
    box(helper,x,.055,z+.04,.11,.09,.17,joint);
  }
  helper.add(ring(.64,.04,ONLINE));
  return helper;
}

function telegraphs() {
  const root=new T.Group(),charge=new T.Group(),swipe=new T.Group();
  root.add(charge,swipe);
  const fill=floorMaterial(DANGER,.44);
  const edge=floorMaterial(0xffcb74,1);
  const floorRect=(parent:T.Group,x:number,z:number,w:number,d:number,m:T.Material)=>{
    const plane=new T.Mesh(new T.PlaneGeometry(w,d),m);
    plane.rotation.x=-Math.PI/2;plane.position.set(x,.015,z);parent.add(plane);
    return plane;
  };
  floorRect(charge,0,CHARGE_LENGTH/2,CHARGE_HALF_WIDTH*2,CHARGE_LENGTH,fill);
  for(const side of [-1,1]) floorRect(charge,side*(CHARGE_HALF_WIDTH-.035),CHARGE_LENGTH/2,.07,CHARGE_LENGTH,edge);
  for(const z of [0,CHARGE_LENGTH]) floorRect(charge,0,z,CHARGE_HALF_WIDTH*2,.08,edge);
  for(const z of [2,4.4,6.8]) {
    const arrow=new T.Shape();
    arrow.moveTo(-.64,0);arrow.lineTo(0,-.65);arrow.lineTo(.64,0);
    arrow.lineTo(.64,.17);arrow.lineTo(0,-.32);arrow.lineTo(-.64,.17);arrow.closePath();
    const mesh=new T.Mesh(new T.ShapeGeometry(arrow),edge);
    mesh.rotation.x=-Math.PI/2;mesh.position.set(0,.04,z);charge.add(mesh);
  }
  const angleStart=-Math.PI/2-SWIPE_HALF_ANGLE;
  const arc=new T.Mesh(new T.CircleGeometry(SWIPE_RADIUS,36,angleStart,SWIPE_HALF_ANGLE*2),fill);
  arc.rotation.x=-Math.PI/2;swipe.add(arc);
  const arcEdge=new T.Mesh(new T.RingGeometry(SWIPE_RADIUS-.11,SWIPE_RADIUS,36,1,angleStart,SWIPE_HALF_ANGLE*2),edge);
  arcEdge.rotation.x=-Math.PI/2;arcEdge.position.y=.02;swipe.add(arcEdge);
  for(const angle of [-SWIPE_HALF_ANGLE,-SWIPE_HALF_ANGLE/2,0,SWIPE_HALF_ANGLE/2,SWIPE_HALF_ANGLE]) {
    const ray=new T.Group();
    floorRect(ray,0,SWIPE_RADIUS/2,.045,SWIPE_RADIUS,edge);
    ray.rotation.y=angle;swipe.add(ray);
  }
  return {root,charge,swipe,fill};
}

/** Own only transient props. Move the authored L001 body, leaving its base in place. */
export function createBossScene(campusRoot:T.Object3D,world:Navigation,scene:T.Scene) {
  const anchor=campusRoot.getObjectByName(NOV13.lion.id);
  const body=anchor?.getObjectByName('Lion_body_uniform_scale');
  if (!anchor || !body) throw new Error('未找到草坪 L001 狮身');
  const obstacle=world.obstacles.find(o=>o.name===NOV13.lion.id);
  const collisionMesh=world.meshes.find(o=>o.name===NOV13.lion.id);
  const originalCollision=obstacle?{x:obstacle.x,z:obstacle.z,angle:obstacle.angle}:null;
  const originalMesh=collisionMesh?{p:collisionMesh.position.clone(),q:collisionMesh.quaternion.clone()}:null;
  // Body and collision shape share this local pivot; no regenerated lion or edited asset.
  const pivot=new T.Group();
  anchor.add(pivot);pivot.add(body);
  // The campus uses a baked sun shadow; the moving lion has its own contact shadow.
  body.traverse(object=>{ object.castShadow=false; });

  const props=new T.Group();
  props.name='L001_boss_gameplay';
  props.userData.dynamicGameplay=true;
  scene.add(props);
  const shadowCanvas=document.createElement('canvas');
  shadowCanvas.width=shadowCanvas.height=64;
  const shadowContext=shadowCanvas.getContext('2d')!;
  const gradient=shadowContext.createRadialGradient(32,32,6,32,32,32);
  gradient.addColorStop(0,'rgba(25,33,24,.38)'); gradient.addColorStop(1,'rgba(25,33,24,0)');
  shadowContext.fillStyle=gradient; shadowContext.fillRect(0,0,64,64);
  const contactMap=new T.CanvasTexture(shadowCanvas);
  const contact=new T.Mesh(new T.PlaneGeometry(5.6,5.6),new T.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false}));
  contact.rotation.x=-Math.PI/2; props.add(contact);
  const telegraph=telegraphs();props.add(telegraph.root);
  const dog=helperModel();props.add(dog);
  const pad=ring(2.4,.11,0x4dded0);
  pad.position.set(SAFE.x,GROUND+.045,SAFE.z);props.add(pad);
  const statusRing=ring(2.4,.12,ONLINE);props.add(statusRing);
  const dark=new T.MeshStandardMaterial({color:0x18343b,roughness:.65});
  const nodes=NODES.map((node,i)=>{
    const group=new T.Group();group.position.set(node.x,GROUND,node.z);
    const lamp=new T.MeshBasicMaterial({color:INACTIVE});
    const boundary=ring(1.96,.075,INACTIVE);
    group.add(boundary);
    box(group,0,.09,0,.65,.15,.58,dark);
    box(group,0,.53,0,.32,.79,.3,dark);
    box(group,0,.94,0,.51,.13,.44,lamp);
    group.add(numberPlate(String(i+1).padStart(2,'0')));
    props.add(group);
    return {lamp,boundary};
  });

  function syncCollision(state:CombatState) {
    const localYaw=state.yaw-LION.yaw;
    if(obstacle && originalCollision) {
      const ox=originalCollision.x-BOSS.x,oz=originalCollision.z-BOSS.z;
      obstacle.x=state.lion.x+Math.cos(localYaw)*ox+Math.sin(localYaw)*oz;
      obstacle.z=state.lion.z-Math.sin(localYaw)*ox+Math.cos(localYaw)*oz;
      obstacle.angle=originalCollision.angle+localYaw;
      if(collisionMesh) {
        collisionMesh.position.x=obstacle.x;collisionMesh.position.z=obstacle.z;
        collisionMesh.rotation.y=obstacle.angle;collisionMesh.updateMatrixWorld(true);
      }
    }
  }

  // The game freezes its physics at completion. The presentation can still finish the bow.
  let completionStarted:number|null=null;
  function render(state:CombatState) {
    const phase=state.phase;
    syncCollision(state);
    const localYaw=state.yaw-LION.yaw;
    const dx=state.lion.x-BOSS.x,dz=state.lion.z-BOSS.z;
    contact.position.set(state.lion.x,GROUND+.012,state.lion.z);
    const ca=Math.cos(LION.yaw),sa=Math.sin(LION.yaw);
    pivot.position.set(dx*ca-dz*sa,0,dx*sa+dz*ca);
    if (phase==='complete') completionStarted ??= performance.now();
    else completionStarted=null;
    const bow=completionStarted===null?0:Math.sin(Math.min((performance.now()-completionStarted)/1600,1)*Math.PI)*.22;
    const lean=phase==='chargeWarn'?.09*(1-state.remaining/CHARGE_WARNING):phase==='charge'?-.08:0;
    pivot.rotation.order='YXZ';pivot.rotation.set(bow+lean,localYaw,phase==='swipeWarn'?-.075:0);
    telegraph.charge.visible=phase==='chargeWarn'||phase==='charge';
    telegraph.swipe.visible=phase==='swipeWarn'||(phase==='lured' && state.remaining>2.5);
    telegraph.root.position.set(state.origin.x,GROUND+.045,state.origin.z);
    telegraph.root.rotation.y=state.yaw;
    telegraph.fill.opacity=.44+.09*Math.sin(state.elapsed*10);
    statusRing.visible=phase==='stunned'||phase==='lured';
    statusRing.position.set(state.lion.x,GROUND+.08,state.lion.z);
    dog.position.set(state.helper.x,GROUND+(phase==='helperRun'?.045*Math.abs(Math.sin(state.elapsed*21)):0),state.helper.z);
    dog.rotation.y=state.helperYaw;
    for(const [i,node] of nodes.entries()) {
      const color=i<state.repaired?ONLINE:i===state.repaired?(canSubmit(state)?ONLINE:ACTIVE):INACTIVE;
      node.lamp.color.setHex(color);node.boundary.material.color.setHex(color);
    }
  }
  function dispose() {
    contactMap.dispose();
    anchor!.add(body!);pivot.removeFromParent();
    if(originalCollision && obstacle) Object.assign(obstacle,originalCollision);
    if(originalMesh && collisionMesh) {
      collisionMesh.position.copy(originalMesh.p);collisionMesh.quaternion.copy(originalMesh.q);
      collisionMesh.updateMatrixWorld(true);
    }
    props.removeFromParent();
    const materials=new Set<T.Material>();
    props.traverse(obj=>{
      if(obj instanceof T.Mesh) {obj.geometry.dispose();materials.add(obj.material);}
      if(obj instanceof T.Sprite) {obj.material.map?.dispose();materials.add(obj.material);}
    });
    for(const material of materials) material.dispose();
  }
  return {render,syncCollision,dispose};
}
