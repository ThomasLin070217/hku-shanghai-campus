import * as T from 'three';
import {disposeAsset} from '../model/buildCampus';
import {EXPLORATION as C,KEYS} from './config';
import {createNavigation} from './navigation';
import {createStudent} from './student';
import {createFirstPersonArms} from '../characters/character';
import {createDeviceView} from './deviceView';
import './deviceView.css';
import {createInventoryUI} from '../items/inventoryUI';
import {CampusGame} from './game';
import type {BuildingSpec,SiteParameters} from '../model/campusParameters';
export function createExplorer(canvas:HTMLCanvasElement,scene:T.Scene,specs:BuildingSpec[],site:SiteParameters,opening=false){
 let world=createNavigation(specs,site,opening),game=new CampusGame(world,specs,site),enabled=false,accumulator=0,turn=0,compat=false,dragging=false,lastX=0,lastY=0;
 const events=new AbortController(),interactions=new Set<()=>void>(),computers=new Set<()=>void>();let disposed=false;
 const listenWindow=<K extends keyof WindowEventMap>(type:K,fn:(e:WindowEventMap[K])=>void,options:AddEventListenerOptions={})=>window.addEventListener(type,fn,{...options,signal:events.signal});
 const listenDocument=<K extends keyof DocumentEventMap>(type:K,fn:(e:DocumentEventMap[K])=>void,options:AddEventListenerOptions={})=>document.addEventListener(type,fn,{...options,signal:events.signal});
 const listenCanvas=<K extends keyof HTMLElementEventMap>(type:K,fn:(e:HTMLElementEventMap[K])=>void,options:AddEventListenerOptions={})=>canvas.addEventListener(type,fn,{...options,signal:events.signal});
 const student=createStudent();scene.add(student.root);
 const camera=new T.PerspectiveCamera(72,1,.045,700);camera.name='Exploration_Camera';scene.add(camera);
 const firstPerson=createFirstPersonArms();const arms=firstPerson.root;camera.add(arms);
 const deviceView=createDeviceView(camera,arms);
 const keys=new Set<string>(),ray=new T.Raycaster();let bob=false;let distance=Number(C.cameraDistance),actualDistance=distance,sensitivity=Number(C.mouseSensitivity);
 /** Milliseconds left in which a queued jump may still fire on landing. */
 let jumpBuffer=0;
 const editable=(t:EventTarget|null)=>t instanceof HTMLElement&&!!t.closest('input,select,textarea,[contenteditable="true"],dialog');
 const locked=()=>document.pointerLockElement===canvas;
 const controlled=()=>locked()||compat;
 const clear=()=>{dragging=false;keys.clear();game.human={forward:0,right:0,sprint:false};game.humanJump=false;jumpBuffer=0;accumulator=0;};
 function openInventory(){if(!enabled||game.panel)return;clear();compat=false;game.openInventory();if(locked())document.exitPointerLock();}
 function closeInventory(){clear();game.closeInventory();}
 const inventoryUI=createInventoryUI(()=>game,openInventory,closeInventory,opening);
 function pause(reason:string){clear();compat=false;game.pause(reason);if(locked())document.exitPointerLock();}
 listenWindow('blur',()=>pause('window_blur'));
 listenDocument('visibilitychange',()=>{if(document.hidden)pause('page_hidden');});
 listenDocument('focusin',e=>{if(editable(e.target))clear();});
 listenDocument('pointerlockchange',()=>{clear();if(locked()&&!game.panel&&!game.inventoryOpen){game.takeover('human_pointer_lock');game.paused=false;}else if(locked()){document.exitPointerLock();}else if(!game.armed)game.pause('pointer_unlock');});
 listenDocument('pointerlockerror',()=>{pause('pointer_lock_failed');document.dispatchEvent(new CustomEvent('game-notice',{detail:opening?'Pointer lock unavailable. Use drag mode to continue.':'此浏览器无法锁定鼠标。请用 Chrome 打开，或选择拖动兼容模式。'}));});
 listenWindow('keydown',e=>{
  if(!enabled||e.defaultPrevented||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||game.panel)return;
  if(e.code===KEYS.inventory&&!e.repeat&&!((e.target as HTMLElement)?.matches('input,textarea,select'))){e.preventDefault();game.inventoryOpen?closeInventory():openInventory();return;}
  if(game.inventoryOpen){if(e.code===KEYS.pause){e.preventDefault();closeInventory();}return;}
  if(editable(e.target))return;
  if(e.code===KEYS.computer&&!e.repeat){e.preventDefault();for(const fn of computers)fn();return;}
  if(/^Digit[1-9]$/.test(e.code)){e.preventDefault();game.takeover('human_hotbar');game.selectHotbar(Number(e.code.slice(-1))-1);if(!controlled())game.paused=true;return;}
  if((e.code===KEYS.zoomIn||e.code===KEYS.zoomOut)&&controlled()){distance=T.MathUtils.clamp(distance+(e.code===KEYS.zoomIn?-0.5:0.5),C.minDistance,C.maxDistance);return;}
  const movement=[KEYS.forward,KEYS.back,KEYS.left,KEYS.right,KEYS.sprint,KEYS.jump].includes(e.code as never);
  if((game.owner||game.armed)&&(movement||e.code===KEYS.interact||e.code===KEYS.view)){game.takeover('human_movement');clear();if(!controlled())game.pause('human_movement');}
  if(e.code===KEYS.pause&&compat){pause('escape');return;}
  if(!controlled()||game.paused)return;
  if(e.code===KEYS.interact){e.preventDefault();if(!e.repeat)for(const fn of interactions)fn();return;}
  if(movement||e.code===KEYS.view){e.preventDefault();keys.add(e.code);if(!e.repeat&&e.code===KEYS.jump){game.humanJump=true;jumpBuffer=C.jumpBufferMs;}if(!e.repeat&&e.code===KEYS.view)game.view=game.view==='first'?'third':'first';}
 });
 listenWindow('keyup',e=>keys.delete(e.code));
 listenDocument('mousemove',e=>{if(enabled&&locked()&&!game.paused){game.yaw-=e.movementX*sensitivity;game.pitch=T.MathUtils.clamp(game.pitch+e.movementY*sensitivity,C.minPitch,C.maxPitch);}});
 listenCanvas('pointerdown',e=>{if(!enabled||!compat||game.paused||e.button!==0)return;canvas.focus();dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 listenCanvas('pointermove',e=>{if(!compat||!dragging||game.paused)return;game.yaw-=(e.clientX-lastX)*sensitivity;game.pitch=T.MathUtils.clamp(game.pitch+(e.clientY-lastY)*sensitivity,C.minPitch,C.maxPitch);lastX=e.clientX;lastY=e.clientY;});
 listenCanvas('pointerup',()=>dragging=false);listenCanvas('pointercancel',()=>dragging=false);
 listenCanvas('wheel',e=>{if(enabled&&!game.inventoryOpen&&!game.panel){e.preventDefault();game.takeover('human_hotbar_wheel');game.selectHotbar((game.inventory.selectedHotbar+(e.deltaY>0?1:8))%9);if(!controlled())game.paused=true;}},{passive:false});canvas.tabIndex=0;
 function enter(){if(!enabled||game.inventoryOpen||game.panel)return;compat=false;canvas.focus();void canvas.requestPointerLock()?.catch(()=>pause('pointer_lock_failed'));}
 function updateCamera(dt:number){const p=game.body.position;
  student.root.visible=enabled&&game.view==='third';arms.visible=enabled&&game.view==='first';
  if(game.view==='first'){
   camera.position.copy(p).y+=C.eyeHeight+(bob&&!game.paused&&game.body.grounded&&Math.hypot(game.body.velocity.x,game.body.velocity.z)>.1?Math.sin(game.timeMs*.012)*.018:0);camera.rotation.set(-game.pitch,game.yaw,0,'YXZ');actualDistance=0;
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
 function update(dt:number){inventoryUI.refresh();if(!enabled)return;const held=game.inventory.equipped?.itemId??null;student.equip(held);firstPerson.equip(held);dt=Math.min(dt,.1);const before=game.body.position.clone();
  game.human={forward:Number(keys.has(KEYS.forward))-Number(keys.has(KEYS.back)),right:Number(keys.has(KEYS.right))-Number(keys.has(KEYS.left)),sprint:keys.has(KEYS.sprint)};
  if(!game.paused){
   // A jump pressed a moment before landing is re-armed on the first grounded step.
   if(jumpBuffer>0){
    jumpBuffer=Math.max(0,jumpBuffer-dt*1000);
    if(game.body.grounded&&!game.humanJump){game.humanJump=true;jumpBuffer=0;}
   }
   accumulator+=dt;while(accumulator>=C.fixedStep){game.step(C.fixedStep);accumulator-=C.fixedStep;}
  }
  const d=game.body.position.clone().sub(before),travel=Math.hypot(d.x,d.z);
  if(travel>.00001){const desired=Math.atan2(-d.x,-d.z);turn+=Math.atan2(Math.sin(desired-turn),Math.cos(desired-turn))*(1-Math.exp(-C.turnSharpness*dt));}
  student.root.position.copy(game.body.position);student.root.rotation.y=turn;student.animate(game.paused?0:dt,travel,game.body.grounded,game.body.velocity.y,Math.hypot(game.body.velocity.x,game.body.velocity.z));updateCamera(dt);
  const first=game.view==='first';
  deviceView.update(dt,first,first?firstPerson.held:student.held);
 }
 function reset(){pause('reset');game.spawn();student.gait.reset();student.animate(.02,0,true,0);turn=game.yaw;actualDistance=distance;updateCamera(1);}
 reset();student.root.visible=false;
 return{camera,student,interactions,computers,enter,enterCompat(){if(game.inventoryOpen||game.panel)return;game.takeover('human_compat');compat=true;game.paused=false;clear();canvas.focus();},update,reset,pause,openInventory,closeInventory,firstPerson,openPanel(panel:'computer'|'settings'|'door',physicalScreen=false){deviceView.show(physicalScreen&&panel==='computer');clear();compat=false;game.openPanel(panel);if(locked())document.exitPointerLock();},closePanel(){deviceView.show(false);clear();game.closePanel();},setComfort(fov:number,shake:boolean){camera.fov=T.MathUtils.clamp(fov,60,90);camera.updateProjectionMatrix();bob=shake;}, get game(){return game;},get position(){return game.body.position;},get world(){return world;},get enabled(){return enabled;},get state(){return{...game.observe(),yaw:game.yaw,pitch:game.pitch,distance,actualDistance,locked:locked(),compat,keys:[...keys]};},
  setSensitivity(v:number){sensitivity=T.MathUtils.clamp(v,.0004,.006);},takeover(){pause('human_takeover');},enableAI(){if(locked())document.exitPointerLock();clear();game.enableAI();},
  setEnabled(v:boolean){if(!v)deviceView.show(false);game.inventoryOpen=false;enabled=v;pause('mode_change');student.root.visible=v&&game.view==='third';arms.visible=v&&game.view==='first';if(v)updateCamera(1);},
  inspectAt(x:number,y:number,z:number,heading=0){pause('qa_inspection');student.gait.reset();student.animate(.02,0,true,0);game.body.position.set(x,y,z);game.body.velocity.set(0,0,0);game.yaw=heading;game.pitch=0;turn=heading;student.root.position.copy(game.body.position);updateCamera(1);},
  resize(w:number,h:number){if(w<=0||h<=0||!Number.isFinite(w/h)||camera.aspect===w/h)return;camera.aspect=w/h;camera.updateProjectionMatrix();},
  rebuild(next:BuildingSpec[],s:SiteParameters){pause('rebuild');world.dispose();specs=next;site=s;world=createNavigation(specs,site,opening);game.replaceWorld(world,specs,site);reset();},dispose(){if(disposed)return;disposed=true;enabled=false;deviceView.show(false);events.abort();pause('dispose');interactions.clear();computers.clear();world.dispose();student.root.removeFromParent();camera.removeFromParent();student.dispose();inventoryUI.dispose();firstPerson.dispose();firstPerson.root.removeFromParent();disposeAsset(camera);}};
}
