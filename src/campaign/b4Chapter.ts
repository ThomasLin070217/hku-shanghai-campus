import * as T from 'three';
import {buildObservedFeatureRoom,keyboardKeycaps,flipWallTiles} from '../model/observedFeatureRooms';
import {markRelayRestored} from '../opening/backupRelay';
import {CDS1_KEYS,saveKeyboardProgress} from '../opening/keyboardProgress';
import {OPENING} from '../opening/spatialLayout';
import {KEYS} from '../exploration/config';
import {B4_FOCUS_FRAME,B4_LAYOUT,B4_STATIONS,B4_REACH,B4_DOOR_OBSTACLE,focusPose,requirePart,setB4FlipPanel,stationDistance,type B4StationId} from '../opening/b4Layout';
import {B4_CEILING,B4_RACK_BODY,B4_RACK_LED,findB4DoorLeaves,setB4DoorLeaves} from '../opening/b4Shell';
import {B4_PHRASE,b4StepOf,connectMacBook,createFlipState,createKeyboardState,flipCount,flipSolved,flipTiles,pressKeyboard,pullBreaker,sweepTiles,autoFinishTiles,type B4Step,type FlipCell,type FlipState,type KeyboardState} from './b4Puzzle';
import {campaignChapterOf,stageIndex,type CampaignEvent,type CampaignStage} from './state';
import type {Chapter,ChapterContext,Objective} from './types';

/** Just inside the B04 entrance door, by the Chapter 1 handoff point. */
export const B4_ENTRY:Chapter['entry']={point:[58,.02,18],radius:1.6,event:'enter_b4'};
const EVENTS:CampaignEvent[]=['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected'];
const STEP_STATION:Record<'keyboard'|'flip'|'breaker'|'connect',B4StationId>={keyboard:'keyboard',flip:'flip',breaker:'breaker',connect:'port'};
/** The game's interact key (F; E is the backpack). The host routes it to `interact()`. */
const USE=KEYS.interact.replace(/^Key/,'');
const GOLD=0xffb648;
const FOCUS_HINT={keyboard:`Type I LOVE CDS or click the gold caps · Enter boots · Arrows look · ${USE} / Esc step back`,
 flip:`Drag across the wall to turn tiles · click flips one · Space flips a row · ${USE} / Esc step back`};
const tag=(o:T.Object3D,key:string)=>{o.name=key;o.userData={...o.userData,authorKey:key,sourceFile:'src/campaign/b4Chapter.ts',source:'B4 campaign rooms (src/opening/b4Layout.ts)',confidence:'provisional 2030 scenery; not a surveyed interior'};return o;};
const inRoom=(x:number,z:number)=>{const r=OPENING.b4;return x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1;};

interface Tile{group:T.Group;index:number;row:number;column:number;target:number;delay:number}
type Focus='keyboard'|'flip'|null;
type World={obstacles:Parameters<typeof setB4FlipPanel>[0]['obstacles'];meshes:T.Mesh[];setDoorOpen(name:string,open:boolean):void};

/**
 * Chapter 1 · B4: the Keyboard Wall, the HKU flip wall, the aux power closet and
 * the supercomputer, on the campus model's B04 ground floor. The room shell and
 * entrance door are part of the opening world (`src/opening/b4Shell.ts`); this
 * chapter opens the door and adds the puzzle props, room lights and highlights.
 * Rules come from `b4Puzzle.ts`, placement and collision from `b4Layout.ts`.
 * The interact key (F) at a station enters a first-person focus view (movement
 * paused, mouse/keys go to the puzzle; Esc or F steps back). Importable headless:
 * DOM, audio and asset URLs are touched only at runtime and behind guards.
 */
export function createB4Chapter():Chapter{
 let ctx:ChapterContext|null=null,group:T.Group|null=null,lights:T.Group|null=null,powered:T.Group|null=null;
 let keyboard:KeyboardState=createKeyboardState(),flip:FlipState=createFlipState(0);
 let tiles:Tile[]=[],caps:T.Group[]=[],phraseCaps:T.Group[]=[],enterCap:T.Group|null=null,grid={rows:0,columns:0};
 let flipWall:T.Object3D|null=null,lever:T.Mesh|null=null,pickPlane:T.Mesh|null=null,tile00=new T.Vector3(),pitch=.219;
 const emergency:T.PointLight[]=[];let work:T.PointLight|null=null,rackLight:T.PointLight|null=null;
 const rackMaterials:T.MeshStandardMaterial[]=[],rackBodies:T.MeshStandardMaterial[]=[],ceilingPanels:T.MeshStandardMaterial[]=[],capGlow=new Map<T.Group,T.MeshStandardMaterial>(),owned:T.Material[]=[];
 const outlines=new Map<B4StationId,T.LineSegments>();
 let leaves:T.Object3D[]=[];
 let lightLevel=0,lift=0,leverPull=0,doorOpen=0,flash=0,seenStage:CampaignStage|null=null,hum:HTMLAudioElement|null=null,humWanted=false,humRetry:(()=>void)|null=null;
 let raf=0,focus:Focus=null,lookYaw=0,lookPitch=0,baseYaw=0,basePitch=0,sweeping=false,lastTile=-1,lastCell:FlipCell|null=null,flipDone=false;
 let savedHint:string|null=null,pulse=0;
 const focusEye=new T.Vector3(),focusTarget=new T.Vector3();
 const ray=new T.Raycaster(),ndc=new T.Vector2();

 /** Navigation and first-person socket of the explorer; absent in minimal host test doubles. */
 const world=()=>(ctx?.explorer as {world?:World}|undefined)?.world??null;
 /** The explorer owns the arms and held item; B4 only asks it to hide them (in B04, in focus). */
 const hideViewModel=(hidden:boolean)=>(ctx?.explorer as {setFirstPersonHidden?:(v:boolean)=>void}|undefined)?.setFirstPersonHidden?.(hidden);
 const body=()=>(ctx?.explorer as {game?:{body:{position:T.Vector3}}}|undefined)?.game?.body.position??null;
 const step=(stage=ctx?.stage()):B4Step|null=>stage?b4StepOf(stage):null;
 const reached=(stage:CampaignStage)=>ctx!==null&&stageIndex(ctx.stage())>=stageIndex(stage);
 const playerInRoom=()=>{const p=body();return !!p&&inRoom(p.x,p.z);};
 const own=<M extends T.Material>(m:M)=>{owned.push(m);return m;};

 function build(c:ChapterContext){
  const g=new T.Group();tag(g,'B04_campaign_rooms');g.userData.dynamicGameplay=true;
  // Keyboard Wall: the observed panel and its timber backing, from the legacy room builder.
  // add(), not attach(): the builder-local offsets place each part relative to the layout origin.
  const kb=buildObservedFeatureRoom('keyboard'),kbRoot=new T.Group();tag(kbRoot,'B4_keyboard_wall');kbRoot.position.fromArray(B4_LAYOUT.keyboardOrigin);g.add(kbRoot);
  for(const name of ['Keyboard_timber_wall','Keyboard_wall']){const o=requirePart(kb,name);o.removeFromParent();kbRoot.add(o);}
  caps=keyboardKeycaps(kbRoot);if(caps.length!==54)throw new Error(`Keyboard Wall has ${caps.length} caps, expected 54`);
  for(const cap of caps){
   if(cap.userData.phrase)phraseCaps.push(cap);if(cap.userData.enter)enterCap=cap;
   cap.traverse(o=>{if(o instanceof T.Mesh&&o.name.startsWith('Key_')&&!capGlow.has(cap)){const m=own((o.material as T.MeshStandardMaterial).clone());o.material=m;capGlow.set(cap,m);}});
  }
  // HKU flip wall in front of the aux power closet.
  const fw=buildObservedFeatureRoom('flipWall'),fwRoot=new T.Group();tag(fwRoot,'B4_flip_wall_and_closet');fwRoot.position.fromArray(B4_LAYOUT.flipOrigin);g.add(fwRoot);
  for(const name of ['HKU_flip_wall','Aux_power_closet']){const o=requirePart(fw,name);o.removeFromParent();fwRoot.add(o);}
  flipWall=requirePart(fwRoot,'HKU_flip_wall');
  lever=requirePart(fwRoot,'Aux_breaker_lever') as T.Mesh;lever.material=own((lever.material as T.MeshStandardMaterial).clone());
  tiles=flipWallTiles(fwRoot).map((group,index)=>({group,index,row:Number(group.userData.row),column:Number(group.userData.column),target:0,delay:0}));
  if(tiles.length!==561)throw new Error(`HKU flip wall has ${tiles.length} tiles, expected 561`);
  const dims=flipWall.userData.dimensions as {columns:number;rows:number;tilePitch:number;width:number;height:number};
  grid={rows:dims.rows,columns:dims.columns};pitch=dims.tilePitch;tiles.sort((a,b)=>a.row*grid.columns+a.column-(b.row*grid.columns+b.column)).forEach((t,i)=>{t.index=i;});
  // Tile positions are in the wall group's space; the pick plane maps a hit to a row and column.
  const first=tiles[0].group;first.updateMatrix();tile00.copy(first.position).applyMatrix4(first.parent!.matrix);
  // An invisible hit plane well past the wall's edges: a drag that overshoots still paints the
  // edge tiles (cells clamp). It sits beside the wall group so the wall's bounds stay the wall's.
  pickPlane=new T.Mesh(new T.PlaneGeometry(dims.width+4,dims.height+2),own(new T.MeshBasicMaterial({visible:false})));tag(pickPlane,'B4_flip_pick_plane');
  pickPlane.position.copy(flipWall.position).add(new T.Vector3(tile00.x+dims.width/2-pitch/2,tile00.y-dims.height/2+pitch/2,tile00.z+.06));flipWall.parent!.add(pickPlane);
  flip=createFlipState(tiles.length);
  // Flipped tiles show the wall's back image lit from within, so progress reads under the red light.
  const backs=new Map<T.Material,T.Material>();
  for(const t of tiles)t.group.traverse(o=>{if(!(o instanceof T.Mesh)||!Array.isArray(o.material))return;const mats=[...o.material];const back=mats[5] as T.MeshStandardMaterial;
   let lit=backs.get(back);if(!lit){const m=own(back.clone());const green=/green/i.test(back.name);m.emissive.setHex(green?0x74e6b4:GOLD);m.emissiveIntensity=green?.55:.4;m.name=back.name+' (flipped, lit)';backs.set(back,m);lit=m;}
   mats[5]=lit;o.material=mats;});
  fwRoot.traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name==='Aux power green'&&!rackMaterials.includes(m))rackMaterials.push(m);});
  c.root().traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name===B4_RACK_LED&&!rackMaterials.includes(m))rackMaterials.push(m);});
  // The rack bodies glow faint green once the supercomputer is up, so the room reads as
  // powered from the door after its lights are removed (FU3, no real lights).
  c.root().traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name===B4_RACK_BODY&&!rackBodies.includes(m)){m.emissive.setHex(0x1f8a55);m.emissiveIntensity=0;rackBodies.push(m);}});
  // Ruling 39: the ceiling panels glow faintly once the supercomputer is powered.
  c.root().traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name===B4_CEILING&&!ceilingPanels.includes(m)){m.emissive.setHex(0xbfd8cc);m.emissiveIntensity=0;ceilingPanels.push(m);}});
  // Gold outlines around each station's interactable, shown when it is in reach.
  const goldLine=own(new T.LineBasicMaterial({color:GOLD,transparent:true,opacity:.9,depthTest:true}));
  for(const s of Object.values(B4_STATIONS)){const b=s.box,pad=.04;
   const line=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(b.x1-b.x0+pad,b.y1-b.y0+pad,b.z1-b.z0+pad)),goldLine);tag(line,'B4_highlight_'+s.id);
   line.position.set((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);line.visible=false;g.add(line);outlines.set(s.id,line);}
  g.updateMatrixWorld(true);c.root().add(g);
  return g;
 }
 /** Room lights exist only while the B4 chapter runs; each sphere stays inside the room. */
 function addLights(){
  if(lights||!group)return;lights=new T.Group();tag(lights,'B4_room_lights');
  for(const {p,d} of B4_LAYOUT.lights.emergency){const l=new T.PointLight(0xff2d1a,28,d,2);l.position.fromArray(p);lights.add(l);emergency.push(l);}
  work=new T.PointLight(0xfff1dc,0,B4_LAYOUT.lights.work.d,2);work.position.fromArray(B4_LAYOUT.lights.work.p);lights.add(work);
  rackLight=new T.PointLight(0x4dff9a,0,B4_LAYOUT.lights.rack.d,2);rackLight.position.fromArray(B4_LAYOUT.lights.rack.p);lights.add(rackLight);
  group.add(lights);lights.updateMatrixWorld(true);
 }
 function removeLights(){lights?.removeFromParent();lights=null;emergency.length=0;work=null;rackLight=null;}
 /**
  * Ruling 39: once the MacBook is connected and the chapter lights are gone, the room keeps a
  * dim powered state: two low lights whose range stays inside the room (no light leaks onto
  * the plaza), plus the emissive ceiling and racks driven by lightLevel.
  */
 function syncPowered(){
  const want=!!group&&!lights&&reached('b4_connect');
  if(want&&!powered){
   powered=new T.Group();tag(powered,'B4_powered_lights');
   for(const {p,d,color,intensity} of B4_LAYOUT.lights.powered){const l=new T.PointLight(color,intensity,d,2);l.position.fromArray(p);powered.add(l);}
   group!.add(powered);powered.updateMatrixWorld(true);
  }else if(!want&&powered){powered.removeFromParent();powered=null;}
 }

 /* ---------------- stage-driven scenery ---------------- */
 function applyStage(stage:CampaignStage){
  if(stage===seenStage)return;const first=seenStage===null;seenStage=stage;
  if(reached('b4_flip')){keyboard={typed:B4_PHRASE,solved:true};paintCaps();}
  if(reached('b4_breaker')){flip=createFlipState(tiles.length,true);for(const t of tiles)t.target=Math.PI;flipDone=true;}
  const w=world();if(w)setB4FlipPanel(w,!reached('b4_breaker'));
  // After the MacBook connects the room stays lit until the player has walked out of B04.
  if(campaignChapterOf(stage)==='b4')addLights();else if(!playerInRoom())removeLights();
  // A run restored past the connect (reload, checkpoint) starts powered, without the fade-in.
  if(first&&reached('b4_connect'))lightLevel=1;
  syncPowered();
  // The supercomputer runs from the breaker on, also after a reload.
  humWanted=reached('b4_connect');if(humWanted)playHum();
 }
 function paintCaps(error=false){
  const litCaps=new Set<T.Group>();
  for(const ch of keyboard.typed){const cap=phraseCaps.find(c=>c.userData.label===ch&&!litCaps.has(c));if(cap)litCaps.add(cap);}
  for(const [cap,m] of capGlow){
   if(keyboard.solved){m.emissive.setHex(cap.userData.enter?0x4aa3ff:cap.userData.phrase?0xffb648:0x6dffb0);m.emissiveIntensity=.9;}
   else if(error&&cap.userData.phrase){m.emissive.setHex(0xff3322);m.emissiveIntensity=1.2;}
   else if(litCaps.has(cap)){m.emissive.setHex(0x74e6b4);m.emissiveIntensity=1.15;}
   else if(cap===enterCap&&keyboard.typed===B4_PHRASE){m.emissive.setHex(0xffb648);m.emissiveIntensity=1.1;}
   // The hint says "click the gold caps": the targets must read gold under the
   // red emergency light, before any key is typed. Typed caps above are mint.
   else if(cap.userData.phrase){m.emissive.setHex(0xffb648);m.emissiveIntensity=1.1;}
   else{m.emissive.setHex(0x000000);m.emissiveIntensity=0;}
  }
 }

 /* ---------------- puzzle actions (focus view and debug share them) ---------------- */
 function press(key:string){
  if(step()!=='keyboard')return 'ignored';
  const r=pressKeyboard(keyboard,key);keyboard=r.state;
  if(r.result==='reset'){paintCaps(true);flash=.45;ctx?.notify('Wrong key. The wall resets: spell I LOVE CDS.');}
  else if(r.result!=='ignored')paintCaps();
  if(r.result==='solved'&&ctx){
   const id=ctx.deviceId();if(id)saveKeyboardProgress(id,[...CDS1_KEYS],true);
   ctx.notify('CPU 01 online. Something clicks behind the HKU flip wall.');leaveFocus();ctx.emit('keyboard_solved');
  }
  return r.result;
 }
 function setTiles(indices:number[],value?:boolean){
  if(step()!=='flip'||flipDone)return;
  flip=flipTiles(flip,indices,value);
  for(const i of indices){const t=tiles[i];if(t)t.target=flip.flipped[i]?Math.PI:0;}
  // At 95% the last few tiles, which are hard to find, turn over by themselves in a 0.6 s sweep.
  const rest=autoFinishTiles(flip);
  if(rest.length){flip=flipTiles(flip,rest,true);rest.forEach((i,k)=>{const t=tiles[i];t.target=Math.PI;t.delay=.6*k/Math.max(1,rest.length-1);});}
  if(flipSolved(flip)){flipDone=true;
   const finish=()=>{if(!ctx)return;leaveFocus();ctx.notify('All 561 tiles turned. The wall lifts and the aux power closet opens.');
    globalThis.setTimeout(()=>{if(ctx&&step()==='flip'){const w=world();if(w)setB4FlipPanel(w,false);ctx.emit('flip_solved');}},1200);};
   if(rest.length){ctx?.notify('The last tiles turn over on their own.');globalThis.setTimeout(finish,700);}else finish();}
 }
 function pull(){
  const r=pullBreaker(step());if(!r.ok||!ctx){if(r.reason)ctx?.notify(r.reason);return false;}
  ctx.notify('Breaker closed. Backup power is up; the racks come online.');ctx.emit(r.event!);return true;
 }
 function connect(){
  if(!ctx)return false;
  const r=connectMacBook(step(),ctx.deviceId(),markRelayRestored);
  if(!r.ok){if(r.reason)ctx.notify(r.reason);return false;}
  ctx.notify('MacBook paired with the B4 supercomputer.');ctx.emit(r.event!);return true;
 }
 /** Asset URLs load on demand so this module stays importable headless. A reload has no user
  * activation yet, so a refused play() retries on the next key or click. */
 function playHum(){
  if(typeof Audio==='undefined'||typeof window==='undefined'||(hum&&!hum.paused))return;
  void import('../gameplay/storyAudioAssets').then(({STORY_AUDIO_URLS})=>{
   if(!ctx||!humWanted)return;hum??=new Audio(STORY_AUDIO_URLS['supercomputer_hum'].href);hum.loop=true;hum.volume=.3;
   return hum.play().catch(()=>{if(humRetry)return;humRetry=()=>{clearRetry();if(humWanted)playHum();};window.addEventListener('pointerdown',humRetry,{once:true});window.addEventListener('keydown',humRetry,{once:true});});
  }).catch(()=>{/* Audio is optional. */});
 }
 function clearRetry(){if(humRetry&&typeof window!=='undefined'){window.removeEventListener('pointerdown',humRetry);window.removeEventListener('keydown',humRetry);}humRetry=null;}

 /* ---------------- first-person focus ---------------- */
 function nearest(stage=ctx?.stage()):B4StationId|null{
  const s=step(stage),p=body();if(!ctx||!p||!s||s==='done')return null;
  const id=STEP_STATION[s];return stationDistance(B4_STATIONS[id],p.x,p.z)<=B4_REACH?id:null;
 }
 function aim(point:readonly number[]){
  const p=body();if(!p)return;const dx=point[0]-p.x,dz=point[2]-p.z,dy=point[1]-(p.y+1.6);
  baseYaw=Math.atan2(-dx,-dz);basePitch=-Math.atan2(dy,Math.hypot(dx,dz));lookYaw=0;lookPitch=0;
 }
 function hint(text:string|null){
  if(typeof document==='undefined')return;
  // The hotbar and held-item label would cover the bottom rows of the puzzle: hidden while focused.
  const inv=document.getElementById('inventory-hud');if(inv)inv.style.visibility=text===null?'':'hidden';const el=document.querySelector<HTMLElement>('.stage-bottom > span');if(!el)return;
  if(text!==null){savedHint??=el.textContent;el.textContent=text;}else if(savedHint!==null){el.textContent=savedHint;savedHint=null;}
 }
 function enterFocus(id:'keyboard'|'flip'){
  if(!ctx||focus)return;focus=id;aim(B4_STATIONS[id].point);lastCell=null;
  // Square-on to the panel's centre, far enough back that the whole panel fits the view.
  const cam=ctx.explorer.camera,pose=focusPose(B4_FOCUS_FRAME[id],cam.fov,cam.aspect);
  focusEye.fromArray(pose.eye);focusTarget.fromArray(pose.target);
  // The wall owns the frame: the HUD collapses to one line, the minimap hides
  // and the vitals become one row (see opening.css `body[data-campaign-focus]`).
  if(typeof document!=='undefined')document.body.dataset.campaignFocus=id;
  ctx.openPanel('b4-focus');hint(FOCUS_HINT[id]);applyFocus();startLoop();
 }
 /** The explorer puts the camera at the body's eye every frame; the focus view overrides it
  * afterwards (host.update runs after explorer.update) and asks the explorer to hide the view model. */
 function applyFocus(){
  if(!ctx||!focus)return;const cam=ctx.explorer.camera;
  cam.position.copy(focusEye);cam.lookAt(focusTarget);cam.rotateY(lookYaw);cam.rotateX(-lookPitch);cam.updateMatrixWorld();
  hideViewModel(true);
 }
 function leaveFocus(){
  if(!ctx||!focus)return;focus=null;sweeping=false;lastCell=null;stopLoop();hint(null);
  if(typeof document!=='undefined')delete document.body.dataset.campaignFocus;
  ctx.closePanel();ctx.resume();
 }
 /** The focus view pauses the game and the host passes dt=0 while paused, so the focus view
  * animates tiles, caps, lights and the camera from its own frame loop. */
 function startLoop(){if(raf||typeof requestAnimationFrame==='undefined')return;let last=performance.now();
  const tick=()=>{if(!focus||!ctx){raf=0;return;}const now=performance.now();animate(Math.min(.1,(now-last)/1000));last=now;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);}
 function stopLoop(){if(raf&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(raf);raf=0;}
 /** Pointer to world: only the world canvas, never a HUD control on top of it. */
 function ndcOf(e:MouseEvent):T.Vector2|null{
  if(typeof document==='undefined')return null;
  const top=document.elementFromPoint(e.clientX,e.clientY);if(top&&top.closest('button,a,input,select,textarea,[role="button"],#inventory-hud'))return null;
  const canvas=(e.target as Element|null)?.closest?.('canvas')??document.elementsFromPoint(e.clientX,e.clientY).find((el):el is HTMLCanvasElement=>el instanceof HTMLCanvasElement&&el.getBoundingClientRect().width>=innerWidth*.5);if(!canvas)return null;
  const r=canvas.getBoundingClientRect();return ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
 }
 function cellAt(v:T.Vector2):FlipCell|null{
  if(!ctx||!pickPlane||!flipWall)return null;ray.setFromCamera(v,ctx.explorer.camera);
  const hit=ray.intersectObject(pickPlane,false)[0];if(!hit)return null;
  const local=flipWall.worldToLocal(hit.point.clone());
  const column=Math.round((local.x-tile00.x)/pitch),row=Math.round((tile00.y-local.y)/pitch);
  return{row:Math.max(0,Math.min(grid.rows-1,row)),column:Math.max(0,Math.min(grid.columns-1,column))};
 }
 const indexOf=(c:FlipCell)=>c.row*grid.columns+c.column;
 function sweepTo(cell:FlipCell){setTiles(sweepTiles(grid,lastCell,cell),true);lastCell=cell;lastTile=indexOf(cell);}
 function capAt(v:T.Vector2){
  if(!ctx)return null;ray.setFromCamera(v,ctx.explorer.camera);let o:T.Object3D|null=ray.intersectObjects(caps,true)[0]?.object??null;
  while(o&&!(o instanceof T.Group&&o.name.startsWith('Keycap_')))o=o.parent;return caps.find(c=>c===o)??null;
 }
 const onKey=(e:KeyboardEvent)=>{
  if(!focus||e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
  const used=()=>{e.preventDefault();e.stopImmediatePropagation();};
  if(e.code==='Escape'||e.code===KEYS.interact){used();leaveFocus();return;}
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){used();lookYaw=T.MathUtils.clamp(lookYaw+(e.code==='ArrowLeft'?.12:-.12),-.9,.9);return;}
  if(e.code==='ArrowUp'||e.code==='ArrowDown'){used();lookPitch=T.MathUtils.clamp(lookPitch+(e.code==='ArrowUp'?-.08:.08),-.5,.5);return;}
  if(focus==='keyboard'){
   // Inside the keyboard focus every other letter is a keycap (F is not in the phrase).
   if(e.repeat)return;if(e.key==='Enter'||e.key.length===1&&e.key!==' '){used();press(e.key);}
   else if(e.code==='Space')used();
   return;
  }
  if(focus==='flip'&&e.code==='Space'&&lastTile>=0){used();const row=tiles[lastTile].row;setTiles(tiles.filter(t=>t.row===row).map(t=>t.index));}
 };
 let downAt:{x:number;y:number}|null=null;
 const onDown=(e:PointerEvent)=>{if(!focus||e.button!==0||!ndcOf(e))return;downAt={x:e.clientX,y:e.clientY};lastCell=null;if(focus==='flip')sweeping=true;};
 const onMove=(e:PointerEvent)=>{if(focus!=='flip')return;const v=ndcOf(e),cell=v&&cellAt(v);if(!cell){lastCell=null;return;}lastTile=indexOf(cell);
  if(sweeping&&downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)>6)sweepTo(cell);};
 const onUp=(e:PointerEvent)=>{if(!focus)return;const click=downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<=6;downAt=null;sweeping=false;lastCell=null;if(!click)return;
  const v=ndcOf(e);if(!v)return;
  if(focus==='flip'){const cell=cellAt(v);if(cell){lastTile=indexOf(cell);setTiles([indexOf(cell)]);}}
  else{const cap=capAt(v);if(cap)press(cap.userData.enter?'Enter':String(cap.userData.label));}
 };

 function objective(stage:CampaignStage):Objective|null{
  const s=b4StepOf(stage);if(!s||s==='done')return null;
  const st=B4_STATIONS[STEP_STATION[s]],target=[...st.point] as Objective['target'];
  const go=(what:string)=>nearest(stage)!==null?'Press '+USE+' at the '+what:'Walk to the '+what;
  switch(s){
   case 'keyboard':{const n=keyboard.typed.length;
    if(focus==='keyboard')return{text:n===B4_PHRASE.length?'Press Enter to boot CPU 01':`Type I LOVE CDS on the Keyboard Wall (${n}/${B4_PHRASE.length})`,target};
    return{text:go('Keyboard Wall')+' and spell I LOVE CDS',target};}
   case 'flip':{const n=flipCount(flip),all=flip.flipped.length;
    if(flipDone)return{text:'The flip wall is opening',target};
    return{text:(focus==='flip'?'Drag across the HKU flip wall to turn every tile':go('HKU flip wall')+' and turn every tile')+` (${n}/${all})`,target};}
   case 'breaker':return{text:go('open closet')+' to pull the red breaker lever',target};
   case 'connect':return{text:go('supercomputer port')+' to plug in the MacBook',target};
  }
 }

 function animate(dt:number){
  if(!ctx||!group)return;
  const k=Math.min(1,dt*6),now=typeof performance!=='undefined'?performance.now():0;pulse=.5+.5*Math.sin(now*.006);
  for(const t of tiles){if(t.delay>0){t.delay-=dt;continue;}const d=t.target-t.group.rotation.y;if(Math.abs(d)>.001)t.group.rotation.y+=d*Math.min(1,dt*10);}
  if(flipWall){const want=flipDone?B4_LAYOUT.flipLift:0;lift+=(want-lift)*Math.min(1,dt*1.6);flipWall.position.y=lift;}
  if(doorOpen<.999){doorOpen+=(1-doorOpen)*Math.min(1,dt*3);if(doorOpen>.999)doorOpen=1;setB4DoorLeaves(leaves,doorOpen);}
  const pulled=reached('b4_connect');leverPull+=((pulled?1:0)-leverPull)*k;if(lever)lever.rotation.x=-.45+.9*leverPull;
  lightLevel+=((pulled?1:0)-lightLevel)*Math.min(1,dt*2.2);
  for(const [i,l] of emergency.entries())l.intensity=28*(1-lightLevel)*(.85+.15*Math.sin(now*.006+i));
  if(work)work.intensity=2+58*lightLevel;if(rackLight)rackLight.intensity=24*lightLevel;
  for(const m of rackMaterials)m.emissiveIntensity=.12+1.85*lightLevel;
  for(const m of rackBodies)m.emissiveIntensity=.9*lightLevel;
  for(const m of ceilingPanels)m.emissiveIntensity=.14*lightLevel;
  if(flash>0){flash-=dt;if(flash<=0)paintCaps();}
  if(focus){const g=ctx.explorer.game;g.yaw+=(baseYaw-g.yaw)*k;g.pitch+=(basePitch-g.pitch)*k;applyFocus();}
  updatePresence();
 }
 /** Gold highlight on the in-reach station, and the held MacBook hidden inside B4 and in focus. */
 function updatePresence(){
  const near=focus?null:nearest();
  for(const [id,line] of outlines){line.visible=id===near;if(line.visible)(line.material as T.LineBasicMaterial).opacity=.55+.4*pulse;}
  if(lever){const m=lever.material as T.MeshStandardMaterial;if(near==='breaker'){m.emissive.setHex(GOLD);m.emissiveIntensity=.35+.45*pulse;}else{m.emissive.setHex(0);m.emissiveIntensity=0;}}
  const p=body();hideViewModel(!!(focus||(p&&inRoom(p.x,p.z))));
  if(hum&&p){const r=B4_LAYOUT.lights.rack.p,d=Math.hypot(p.x-r[0],p.z-r[2]);hum.volume=.3*T.MathUtils.clamp(1-d/35,0,1);}
 }
 function detach(){
  leaveFocus();clearRetry();
  if(typeof window!=='undefined'){window.removeEventListener('keydown',onKey,true);window.removeEventListener('pointerdown',onDown);window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);}
  const w=world();if(w){w.setDoorOpen(B4_DOOR_OBSTACLE,false);setB4FlipPanel(w,false);}
  setB4DoorLeaves(leaves,0);leaves=[];hideViewModel(false);
  removeLights();powered?.removeFromParent();powered=null;group?.removeFromParent();group?.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments)o.geometry.dispose();});
  for(const m of owned)m.dispose();owned.length=0;
  try{hum?.pause();}catch{/* optional */}
  group=null;ctx=null;tiles=[];caps=[];phraseCaps=[];enterCap=null;capGlow.clear();rackMaterials.length=0;for(const m of [...rackBodies,...ceilingPanels]){m.emissive.setHex(0);m.emissiveIntensity=0;}rackBodies.length=0;ceilingPanels.length=0;lightLevel=0;outlines.clear();seenStage=null;flipDone=false;doorOpen=0;humWanted=false;keyboard=createKeyboardState();
 }
 // Exposed only through window.__CAMPUS.campaign, which main.ts creates in DEV/review builds.
 const debug={
  complete(){for(const e of EVENTS)ctx?.emit(e);return ctx?.stage();},
  state(){return{stage:ctx?.stage(),typed:keyboard.typed,solved:keyboard.solved,flipped:flipCount(flip),tiles:tiles.length,focus,near:nearest(),light:+lightLevel.toFixed(2),door:+doorOpen.toFixed(2),hum:humWanted};},
  /** Read-only view of the keyboard wall glow, for the style check. */
  caps(){return [...capGlow].map(([cap,m])=>({label:cap.userData.label as string,phrase:!!cap.userData.phrase,enter:!!cap.userData.enter,emissive:m.emissive.getHex(),intensity:m.emissiveIntensity}));},
  /** Same paths as the focus view: type keys, sweep tiles, pull, connect. */
  type(text:string){for(const ch of text)press(ch);return keyboard.typed;},
  enter(){return press('Enter');},
  flipAll(){setTiles(tiles.map(t=>t.index),true);return flipCount(flip);},
  /** Flip every tile except the last `n` (row-major), through the same path as a sweep. */
  flipAllBut(n:number){setTiles(tiles.slice(0,Math.max(0,tiles.length-n)).map(t=>t.index),true);return flipCount(flip);},
  /** A drag through screen points (normalised device coordinates) with the explorer camera. */
  sweepNdc(points:[number,number][]){
   // Pointer events along the drag, every 2% of the screen, through the same path as onMove.
   lastCell=null;
   for(let k=0;k<points.length;k++){const [x0,y0]=points[Math.max(0,k-1)],[x1,y1]=points[k],n=k?50:1;
    for(let i=1;i<=n;i++){const cell=cellAt(new T.Vector2(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n));if(cell)sweepTo(cell);else lastCell=null;}}
   lastCell=null;return flipCount(flip);
  },
  pull,connect,
  focus(id:'keyboard'|'flip'){enterFocus(id);return focus;},
  leave(){leaveFocus();return focus;},
  stations(){return B4_STATIONS;},
 };

 return{
  id:'b4',entry:B4_ENTRY,approach:[[58,25],[58,18]],
  attach(c){
   ctx=c;group=build(c);leaves=findB4DoorLeaves(c.root());
   // The entrance doors unlock when the campaign reaches B4 (the leaves slide in animate()).
   world()?.setDoorOpen(B4_DOOR_OBSTACLE,true);
   if(typeof window!=='undefined'){window.addEventListener('keydown',onKey,true);window.addEventListener('pointerdown',onDown);window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);}
   applyStage(c.stage());
   paintCaps();
  },
  update(dt){
   if(!ctx||!group)return;applyStage(ctx.stage());
   if(lights&&campaignChapterOf(ctx.stage())!=='b4'&&!playerInRoom()){removeLights();syncPowered();}
   if(!raf)animate(dt);
   applyFocus();
  },
  interact(){
   if(!ctx||focus)return false;
   const id=nearest();
   if(!id){const s=step();if(s&&s!=='done'){ctx.notify('Walk up to the '+B4_STATIONS[STEP_STATION[s]].label+' and press '+USE+'.');return true;}return false;}
   if(id==='keyboard'||id==='flip'){enterFocus(id);return true;}
   return id==='breaker'?pull():connect();
  },
  objective,
  detach,
  debug,
 };
}
