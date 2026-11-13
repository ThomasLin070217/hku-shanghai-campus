import * as T from 'three';
import {EXPLORATION as C,KEYS} from './config';
import {createNavigation} from './navigation';
import {createStudent} from './student';
import {CampusGame} from './game';
import type {BuildingSpec,SiteParameters} from '../model/campusParameters';
export function createExplorer(canvas:HTMLCanvasElement,scene:T.Scene,specs:BuildingSpec[],site:SiteParameters){
 let world=createNavigation(specs,site),game=new CampusGame(world,specs),enabled=false,accumulator=0,turn=0,compat=false,dragging=false,lastX=0,lastY=0;
 const student=createStudent();scene.add(student.root);
 const camera=new T.PerspectiveCamera(72,1,.045,700);camera.name='Exploration_Camera';scene.add(camera);
 const arms=new T.Group();arms.name='First_person_sleeves';camera.add(arms);
 for(const s of [-1,1]){const sleeve=new T.Mesh(new T.BoxGeometry(.13,.17,.32),new T.MeshStandardMaterial({color:0x08714b,roughness:1}));sleeve.position.set(s*.27,-.26,-.42);arms.add(sleeve);const hand=new T.Mesh(new T.BoxGeometry(.10,.09,.12),new T.MeshStandardMaterial({color:0xcb9975}));hand.position.set(s*.27,-.25,-.61);arms.add(hand);}
 const keys=new Set<string>(),ray=new T.Raycaster();let distance=Number(C.cameraDistance),actualDistance=distance,sensitivity=Number(C.mouseSensitivity);
 const editable=(t:EventTarget|null)=>t instanceof HTMLElement&&!!t.closest('input,select,textarea,[contenteditable="true"],dialog');
 const locked=()=>document.pointerLockElement===canvas;
 const controlled=()=>locked()||compat;
 const clear=()=>{dragging=false;keys.clear();game.human={forward:0,right:0,sprint:false};game.humanJump=false;accumulator=0;};
 function pause(reason:string){clear();compat=false;game.pause(reason);if(locked())document.exitPointerLock();}
 window.addEventListener('blur',()=>pause('window_blur'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('page_hidden');});
 document.addEventListener('focusin',e=>{if(editable(e.target))clear();});
 document.addEventListener('pointerlockchange',()=>{clear();if(locked()){game.takeover('human_pointer_lock');game.paused=false;}else if(!game.armed)game.pause('pointer_unlock');});
 document.addEventListener('pointerlockerror',()=>{pause('pointer_lock_failed');document.dispatchEvent(new CustomEvent('game-notice',{detail:'此浏览器无法锁定鼠标。请用 Chrome 打开，或选择拖动兼容模式。'}));});
 window.addEventListener('keydown',e=>{
  if(!enabled||editable(e.target)||e.metaKey||e.ctrlKey||e.altKey)return;
  const movement=[KEYS.forward,KEYS.back,KEYS.left,KEYS.right,KEYS.sprint,KEYS.jump].includes(e.code as never);
  if((game.owner||game.armed)&&movement){game.takeover('human_movement');clear();if(!controlled())game.pause('human_movement');}
  if(e.code===KEYS.pause&&compat){pause('escape');return;}
  if(!controlled()||game.paused)return;
  if(movement||e.code===KEYS.view){e.preventDefault();keys.add(e.code);if(!e.repeat&&e.code===KEYS.jump)game.humanJump=true;if(!e.repeat&&e.code===KEYS.view)game.view=game.view==='first'?'third':'first';}
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 document.addEventListener('mousemove',e=>{if(enabled&&locked()&&!game.paused){game.yaw-=e.movementX*sensitivity;game.pitch=T.MathUtils.clamp(game.pitch+e.movementY*sensitivity,C.minPitch,C.maxPitch);}});
 canvas.addEventListener('pointerdown',e=>{if(!enabled||!compat||game.paused||e.button!==0)return;canvas.focus();dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!compat||!dragging||game.paused)return;game.yaw-=(e.clientX-lastX)*sensitivity;game.pitch=T.MathUtils.clamp(game.pitch+(e.clientY-lastY)*sensitivity,C.minPitch,C.maxPitch);lastX=e.clientX;lastY=e.clientY;});
 canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
 canvas.addEventListener('wheel',e=>{if(enabled&&controlled()&&game.view==='third'){e.preventDefault();distance=T.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),C.minDistance,C.maxDistance);}},{passive:false});canvas.tabIndex=0;
 function enter(){if(!enabled)return;compat=false;canvas.focus();void canvas.requestPointerLock()?.catch(()=>pause('pointer_lock_failed'));}
 function updateCamera(dt:number){const p=game.body.position;
  student.root.visible=enabled&&game.view==='third';arms.visible=enabled&&game.view==='first';
  if(game.view==='first'){
   camera.position.copy(p).y+=C.eyeHeight;camera.rotation.set(-game.pitch,game.yaw,0,'YXZ');actualDistance=0;
  }else{
   const target=p.clone().add(new T.Vector3(0,C.targetHeight,0));
   const a=T.MathUtils.clamp(game.pitch+.22,-.18,1.36),dir=new T.Vector3(Math.sin(game.yaw)*Math.cos(a),Math.sin(a),Math.cos(game.yaw)*Math.cos(a));let allowed=distance;
   for(const [x,y] of [[0,0],[.18,.15],[-.18,.15],[.18,-.15],[-.18,-.15]]){const origin=target.clone().add(new T.Vector3(Math.cos(game.yaw)*x,y,-Math.sin(game.yaw)*x));ray.set(origin,dir);ray.far=distance+.22;const hit=ray.intersectObjects(world.meshes,false)[0];if(hit)allowed=Math.min(allowed,Math.max(.10,hit.distance-.22));}
   actualDistance=allowed<actualDistance?allowed:T.MathUtils.damp(actualDistance,allowed,16,dt);
   camera.position.copy(target).addScaledVector(dir,actualDistance);const ground=world.support(camera.position.x,camera.position.z,camera.position.y);if(ground!==null)camera.position.y=Math.max(ground+.16,camera.position.y);camera.lookAt(target);
   // If fully backed into a corner, hide the avatar rather than put its face across the lens.
   student.root.visible=actualDistance>.65;
  }camera.updateMatrixWorld();
 }
 function update(dt:number){if(!enabled)return;dt=Math.min(dt,.1);const before=game.body.position.clone();
  game.human={forward:Number(keys.has(KEYS.forward))-Number(keys.has(KEYS.back)),right:Number(keys.has(KEYS.right))-Number(keys.has(KEYS.left)),sprint:keys.has(KEYS.sprint)};
  if(!game.paused){accumulator+=dt;while(accumulator>=C.fixedStep){game.step(C.fixedStep);accumulator-=C.fixedStep;}}
  const d=game.body.position.clone().sub(before),travel=Math.hypot(d.x,d.z);
  if(travel>.00001){const desired=Math.atan2(-d.x,-d.z);turn+=Math.atan2(Math.sin(desired-turn),Math.cos(desired-turn))*(1-Math.exp(-C.turnSharpness*dt));}
  student.root.position.copy(game.body.position);student.root.rotation.y=turn;student.animate(game.paused?0:dt,travel,game.body.grounded,game.body.velocity.y);updateCamera(dt);
 }
 function reset(){pause('reset');game.spawn();turn=game.yaw;actualDistance=distance;updateCamera(1);}
 reset();student.root.visible=false;
 return{camera,student,enter,enterCompat(){game.takeover('human_compat');compat=true;game.paused=false;clear();canvas.focus();},update,reset,pause, get game(){return game;},get position(){return game.body.position;},get world(){return world;},get enabled(){return enabled;},get state(){return{...game.observe(),yaw:game.yaw,pitch:game.pitch,distance,actualDistance,locked:locked(),compat,keys:[...keys]};},
  setSensitivity(v:number){sensitivity=T.MathUtils.clamp(v,.0004,.006);},takeover(){pause('human_takeover');},enableAI(){if(locked())document.exitPointerLock();clear();game.enableAI();},
  setEnabled(v:boolean){enabled=v;pause('mode_change');student.root.visible=v&&game.view==='third';arms.visible=v&&game.view==='first';if(v)updateCamera(1);},
  inspectAt(x:number,y:number,z:number,heading=0){pause('qa_inspection');game.body.position.set(x,y,z);game.body.velocity.set(0,0,0);game.yaw=heading;game.pitch=0;turn=heading;student.root.position.copy(game.body.position);updateCamera(1);},
  resize(w:number,h:number){camera.aspect=w/h;camera.updateProjectionMatrix();},
  rebuild(next:BuildingSpec[],s:SiteParameters){pause('rebuild');world.dispose();specs=next;site=s;world=createNavigation(specs,site);game=new CampusGame(world,specs);reset();},dispose(){pause('dispose');world.dispose();student.root.removeFromParent();camera.removeFromParent();}};
}
