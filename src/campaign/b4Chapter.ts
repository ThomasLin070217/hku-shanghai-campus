import * as T from 'three';
import {buildObservedFeatureRoom,keyboardKeycaps,flipWallTiles} from '../model/observedFeatureRooms';
import {markRelayRestored} from '../opening/backupRelay';
import {CDS1_KEYS,saveKeyboardProgress} from '../opening/keyboardProgress';
import {STORY_AUDIO_URLS} from '../gameplay/storyAudioAssets';
import {OPENING} from '../opening/spatialLayout';
import {KEYS} from '../exploration/config';
import {B4_LAYOUT,B4_OBSTACLES,B4_STATIONS,B4_REACH,B4_DOOR_OBSTACLE,setB4FlipPanel,type B4StationId} from './b4Layout';
import {B4_PHRASE,b4StepOf,connectMacBook,createFlipState,createKeyboardState,flipCount,flipSolved,flipTiles,pressKeyboard,pullBreaker,type B4Step,type FlipState,type KeyboardState} from './b4Puzzle';
import {stageIndex,type CampaignEvent,type CampaignStage} from './state';
import type {Chapter,ChapterContext,Objective} from './types';

/** Just inside the B04 entrance door, by the Chapter 1 handoff point. */
export const B4_ENTRY:Chapter['entry']={point:[58,.02,18],radius:1.6,event:'enter_b4'};
const EVENTS:CampaignEvent[]=['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected'];
const STEP_STATION:Record<'keyboard'|'flip'|'breaker'|'connect',B4StationId>={keyboard:'keyboard',flip:'flip',breaker:'breaker',connect:'port'};
const DEV=import.meta.env?.DEV||import.meta.env?.MODE==='review';
/** The game's interact key (F; E is the backpack). The host routes it to `interact()`. */
const USE=KEYS.interact.replace(/^Key/,'');
const std=(name:string,color:number,emissive=0,intensity=0)=>{const m=new T.MeshStandardMaterial({name,color,roughness:.85,metalness:.05});if(emissive){m.emissive.setHex(emissive);m.emissiveIntensity=intensity;}return m;};
const tag=(o:T.Object3D,key:string)=>{o.name=key;o.userData={...o.userData,authorKey:key,sourceFile:'src/campaign/b4Chapter.ts',source:'B4 campaign rooms (src/campaign/b4Layout.ts)',confidence:'provisional 2030 scenery; not a surveyed interior'};return o;};

interface Tile{group:T.Group;index:number;row:number;column:number;target:number}
type Focus='keyboard'|'flip'|null;

/**
 * Chapter 1 · B4: the Keyboard Wall, the HKU flip wall, the aux power closet and
 * the supercomputer, as rooms on the campus model's B04 ground floor. Rules come
 * from `b4Puzzle.ts`, render and collision from `b4Layout.ts`. The interact key (F) at a station
 * enters a first-person focus view (movement paused, mouse/keys go to the
 * puzzle; Esc or the interact key steps back).
 */
export function createB4Chapter():Chapter{
 let ctx:ChapterContext|null=null,group:T.Group|null=null;
 let keyboard:KeyboardState=createKeyboardState(),flip:FlipState=createFlipState(0);
 let tiles:Tile[]=[],caps:T.Group[]=[],phraseCaps:T.Group[]=[],enterCap:T.Group|null=null;
 let flipWall:T.Object3D|null=null,lever:T.Object3D|null=null,closet:T.Object3D|null=null;
 const emergency:T.PointLight[]=[];let work:T.PointLight|null=null,rackLight:T.PointLight|null=null;
 const rackMaterials:T.MeshStandardMaterial[]=[],capGlow=new Map<T.Group,T.MeshStandardMaterial>();
 let lightLevel=0,lift=0,leverPull=0,flash=0,seenStage:CampaignStage|null=null,hum:HTMLAudioElement|null=null;
 let focus:Focus=null,lookYaw=0,lookPitch=0,baseYaw=0,basePitch=0,sweeping=false,lastTile=-1,flipDone=false;
 const ray=new T.Raycaster(),ndc=new T.Vector2();

 /** Navigation of the explorer; absent in minimal host test doubles. */
 const world=()=>(ctx?.explorer as {world?:Parameters<typeof setB4FlipPanel>[0]&{setDoorOpen(name:string,open:boolean):void}}|undefined)?.world??null;
 const step=():B4Step|null=>ctx?b4StepOf(ctx.stage()):null;
 const reached=(stage:CampaignStage)=>ctx!==null&&stageIndex(ctx.stage())>=stageIndex(stage);

 function build(c:ChapterContext){
  const g=new T.Group();tag(g,'B04_campaign_rooms');g.userData.dynamicGameplay=true;
  const wall=std('B4 room wall',0x2a3431),ceiling=std('B4 room ceiling',0x1c2321),plinth=std('B4 keyboard plinth',0x49392c),closetMat=std('B4 closet shell',0x11161a),floor=std('B4 room floor',0x3a403c);
  const R=OPENING.b4;
  const slab=new T.Mesh(new T.BoxGeometry(R.x1-R.x0,R.floor,R.z1-R.z0),floor);slab.position.set((R.x0+R.x1)/2,R.floor/2,(R.z0+R.z1)/2);slab.receiveShadow=true;g.add(tag(slab,'B4_floor'));
  const mats={wall,ceiling,plinth,closet:closetMat};
  for(const r of B4_OBSTACLES){
   if(r.render==='rack'){
    const rack=new T.Group();tag(rack,r.name);g.add(rack);
    const body=new T.Mesh(new T.BoxGeometry(r.x1-r.x0,r.top-r.bottom,r.z1-r.z0),std('B4 rack body',0x161b1f));body.position.set((r.x0+r.x1)/2,(r.top+r.bottom)/2,(r.z0+r.z1)/2);rack.add(body);
    const led=std('B4 rack status',0x2f7d52,0x47e08a,.12);rackMaterials.push(led);
    for(let k=0;k<7;k++){const strip=new T.Mesh(new T.BoxGeometry(.02,.04,r.z1-r.z0-.2),led);strip.position.set(r.x0-.01,r.bottom+.4+k*.27,(r.z0+r.z1)/2);rack.add(strip);}
    continue;
   }
   const m=new T.Mesh(new T.BoxGeometry(r.x1-r.x0,r.top-r.bottom,r.z1-r.z0),mats[r.render??'wall']);m.position.set((r.x0+r.x1)/2,(r.top+r.bottom)/2,(r.z0+r.z1)/2);m.receiveShadow=true;g.add(tag(m,r.name));
  }
  // Keyboard Wall: the observed panel and its timber backing, from the legacy room builder.
  const kb=buildObservedFeatureRoom('keyboard'),kbRoot=new T.Group();tag(kbRoot,'B4_keyboard_wall');kbRoot.position.fromArray(B4_LAYOUT.keyboardOrigin);g.add(kbRoot);
  for(const name of ['Keyboard_timber_wall','Keyboard_wall']){const o=kb.getObjectByName(name);if(o)kbRoot.attach(o);}
  caps=keyboardKeycaps(kbRoot);
  for(const cap of caps){
   if(cap.userData.phrase)phraseCaps.push(cap);if(cap.userData.enter)enterCap=cap;
   cap.traverse(o=>{if(o instanceof T.Mesh&&o.name.startsWith('Key_')&&!capGlow.has(cap)){const m=(o.material as T.MeshStandardMaterial).clone();o.material=m;capGlow.set(cap,m);}});
  }
  // HKU flip wall in front of the aux power closet.
  const fw=buildObservedFeatureRoom('flipWall'),fwRoot=new T.Group();tag(fwRoot,'B4_flip_wall_and_closet');fwRoot.position.fromArray(B4_LAYOUT.flipOrigin);g.add(fwRoot);
  for(const name of ['HKU_flip_wall','Aux_power_closet']){const o=fw.getObjectByName(name);if(o)fwRoot.attach(o);}
  flipWall=fwRoot.getObjectByName('HKU_flip_wall')??null;lever=fwRoot.getObjectByName('Aux_breaker_lever')??null;closet=fwRoot.getObjectByName('Aux_power_closet')??null;
  tiles=flipWallTiles(fwRoot).map((group,index)=>({group,index,row:Number(group.userData.row),column:Number(group.userData.column),target:0}));
  flip=createFlipState(tiles.length);
  fwRoot.traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial&&m.name==='Aux power green'&&!rackMaterials.includes(m))rackMaterials.push(m);});
  // Room lights: red emergency until the breaker closes, then work light and green racks.
  for(const p of B4_LAYOUT.lights.emergency){const l=new T.PointLight(0xff2d1a,28,15,2);l.position.fromArray(p);g.add(l);emergency.push(l);}
  work=new T.PointLight(0xfff1dc,0,24,2);work.position.fromArray(B4_LAYOUT.lights.work);g.add(work);
  rackLight=new T.PointLight(0x4dff9a,0,10,2);rackLight.position.fromArray(B4_LAYOUT.lights.rack);g.add(rackLight);
  g.updateMatrixWorld(true);c.root().add(g);
  return g;
 }

 /* ---------------- stage-driven scenery ---------------- */
 function applyStage(stage:CampaignStage){
  if(stage===seenStage)return;seenStage=stage;
  if(reached('b4_flip')){keyboard={typed:B4_PHRASE,solved:true};paintCaps();}
  if(reached('b4_breaker')){flip=createFlipState(tiles.length,true);for(const t of tiles)t.target=Math.PI;flipDone=true;}
  const w=world();if(w)setB4FlipPanel(w,!reached('b4_breaker'));
 }
 function paintCaps(error=false){
  const lit=keyboard.typed.length;let used=0;
  const litCaps=new Set<T.Group>();
  for(const ch of keyboard.typed.slice(0,lit)){const cap=phraseCaps.find(c=>c.userData.label===ch&&!litCaps.has(c));if(cap)litCaps.add(cap);used++;}
  for(const [cap,m] of capGlow){
   if(keyboard.solved){m.emissive.setHex(cap.userData.enter?0x4aa3ff:cap.userData.phrase?0xffc24a:0x6dffb0);m.emissiveIntensity=.9;}
   else if(error&&cap.userData.phrase){m.emissive.setHex(0xff3322);m.emissiveIntensity=1.2;}
   else if(litCaps.has(cap)){m.emissive.setHex(0xffb43a);m.emissiveIntensity=1.1;}
   else if(cap===enterCap&&keyboard.typed===B4_PHRASE){m.emissive.setHex(0x4aa3ff);m.emissiveIntensity=1.0;}
   else{m.emissive.setHex(0x000000);m.emissiveIntensity=0;}
  }
  return used;
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
  if(flipSolved(flip)){flipDone=true;leaveFocus();ctx?.notify('All 561 tiles turned. The wall lifts and the aux power closet opens.');
   window.setTimeout(()=>{if(ctx&&step()==='flip'){const w=world();if(w)setB4FlipPanel(w,false);ctx.emit('flip_solved');}},1200);}
 }
 function pull(){
  const r=pullBreaker(step());if(!r.ok||!ctx){if(r.reason)ctx?.notify(r.reason);return false;}
  ctx.notify('Breaker closed. Backup power is up; the racks come online.');playHum();ctx.emit(r.event!);return true;
 }
 function connect(){
  if(!ctx)return false;
  const r=connectMacBook(step(),ctx.deviceId(),markRelayRestored);
  if(!r.ok){if(r.reason)ctx.notify(r.reason);return false;}
  ctx.notify('MacBook paired with the B4 supercomputer.');ctx.emit(r.event!);return true;
 }
 function playHum(){try{if(typeof Audio==='undefined')return;hum??=new Audio(STORY_AUDIO_URLS['supercomputer_hum'].href);hum.loop=true;hum.volume=.3;void hum.play().catch(()=>{});}catch{/* Audio is optional. */}}

 /* ---------------- first-person focus ---------------- */
 function nearest():B4StationId|null{
  const s=step();if(!ctx||!s||s==='done')return null;
  const id=STEP_STATION[s],p=ctx.explorer.game.body.position,[x,,z]=B4_STATIONS[id].point;
  return Math.hypot(p.x-x,p.z-z)<=B4_REACH?id:null;
 }
 function aim(point:readonly number[]){
  if(!ctx)return;const g=ctx.explorer.game,p=g.body.position,dx=point[0]-p.x,dz=point[2]-p.z,dy=point[1]-(p.y+1.6);
  baseYaw=Math.atan2(-dx,-dz);basePitch=-Math.atan2(dy,Math.hypot(dx,dz));lookYaw=0;lookPitch=0;
 }
 function enterFocus(id:'keyboard'|'flip'){
  if(!ctx||focus)return;focus=id;aim(B4_STATIONS[id].point);ctx.openPanel('b4-focus');
  ctx.notify(id==='keyboard'?'Type I LOVE CDS (or click the gold caps), then Enter. Arrows look around. Esc or '+USE+' steps back.'
   :'Drag across the tiles to turn them. Click flips one, Space flips the row under the cursor. Esc or '+USE+' steps back.');
 }
 function leaveFocus(){if(!ctx||!focus)return;focus=null;sweeping=false;ctx.closePanel();ctx.resume();}
 function pick(e:MouseEvent,objects:T.Object3D[]){
  if(!ctx)return null;const canvas=(e.target as Element|null)?.closest?.('canvas');if(!canvas)return null;
  const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,ctx.explorer.camera);return ray.intersectObjects(objects,true)[0]??null;
 }
 function tileOf(o:T.Object3D|null){while(o&&!(o instanceof T.Group&&o.name.startsWith('FlipTile_')))o=o.parent;return tiles.find(t=>t.group===o)??null;}
 function capOf(o:T.Object3D|null){while(o&&!(o instanceof T.Group&&o.name.startsWith('Keycap_')))o=o.parent;return caps.find(c=>c===o)??null;}
 function sweepAt(e:MouseEvent){
  const hit=pick(e,tiles.map(t=>t.group));if(!hit)return;const t=tileOf(hit.object);if(!t)return;
  const near=tiles.filter(o=>Math.abs(o.row-t.row)<=2&&Math.abs(o.column-t.column)<=2).map(o=>o.index);setTiles(near,true);lastTile=t.index;
 }
 const onKey=(e:KeyboardEvent)=>{
  if(!focus||e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
  const used=()=>{e.preventDefault();e.stopImmediatePropagation();};
  if(e.code==='Escape'||e.code===KEYS.interact){used();leaveFocus();return;}
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){used();lookYaw=T.MathUtils.clamp(lookYaw+(e.code==='ArrowLeft'?.12:-.12),-.9,.9);return;}
  if(e.code==='ArrowUp'||e.code==='ArrowDown'){used();lookPitch=T.MathUtils.clamp(lookPitch+(e.code==='ArrowUp'?-.08:.08),-.5,.5);return;}
  if(focus==='keyboard'){
   // Inside the keyboard focus every other letter is a keycap (F is not in the phrase).
   if(e.repeat)return;if(e.key==='Enter'||/^[a-zA-Z0-9]$/.test(e.key)||e.key.length===1&&e.key!==' '){used();press(e.key);}
   else if(e.code==='Space')used();
   return;
  }
  if(focus==='flip'&&e.code==='Space'&&lastTile>=0){used();const row=tiles[lastTile].row;setTiles(tiles.filter(t=>t.row===row).map(t=>t.index));}
 };
 let downAt:{x:number;y:number}|null=null;
 const onDown=(e:PointerEvent)=>{if(!focus||e.button!==0)return;downAt={x:e.clientX,y:e.clientY};if(focus==='flip'){sweeping=true;}};
 const onMove=(e:PointerEvent)=>{if(focus!=='flip')return;const hit=pick(e,tiles.map(t=>t.group));const t=hit?tileOf(hit.object):null;if(t)lastTile=t.index;
  if(sweeping&&downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)>6)sweepAt(e);};
 const onUp=(e:PointerEvent)=>{if(!focus)return;const click=downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<=6;downAt=null;sweeping=false;if(!click)return;
  if(focus==='flip'){const hit=pick(e,tiles.map(t=>t.group)),t=hit?tileOf(hit.object):null;if(t){lastTile=t.index;setTiles([t.index]);}}
  else{const hit=pick(e,caps),cap=hit?capOf(hit.object):null;if(cap)press(cap.userData.enter?'Enter':String(cap.userData.label));}
 };

 function objective(stage:CampaignStage):Objective|null{
  const s=b4StepOf(stage);if(!s||s==='done')return null;
  const st=B4_STATIONS[STEP_STATION[s]],target=[...st.point] as Objective['target'];
  const near=nearest()!==null,go=(what:string)=>near?'Press '+USE+' at the '+what:'Walk to the '+what;
  switch(s){
   case 'keyboard':{const n=keyboard.typed.length;
    if(focus==='keyboard')return{text:n===B4_PHRASE.length?'Press Enter to boot CPU 01':`Type I LOVE CDS on the Keyboard Wall (${n}/${B4_PHRASE.length})`,target};
    return{text:go('Keyboard Wall')+' and spell I LOVE CDS',target};}
   case 'flip':{const n=flipCount(flip),all=flip.flipped.length;
    if(flipDone)return{text:'The flip wall is opening',target};
    return{text:(focus==='flip'?'Turn every tile of the HKU flip wall':go('HKU flip wall')+' and turn every tile')+` (${n}/${all})`,target};}
   case 'breaker':return{text:go('open closet')+' to pull the red breaker lever',target};
   case 'connect':return{text:ctx?.deviceId()?go('supercomputer port')+' to plug in the MacBook':'Find the MacBook to pair with the supercomputer',target};
  }
 }

 return{
  id:'b4',entry:B4_ENTRY,approach:[[58,25],[58,18]],
  attach(c){
   ctx=c;group=build(c);
   // The entrance doors unlock when the campaign reaches B4.
   world()?.setDoorOpen(B4_DOOR_OBSTACLE,true);
   if(typeof window!=='undefined'){window.addEventListener('keydown',onKey,true);window.addEventListener('pointerdown',onDown);window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);}
   applyStage(c.stage());
  },
  update(dt){
   if(!ctx||!group)return;applyStage(ctx.stage());
   const k=Math.min(1,dt*6);
   for(const t of tiles){const d=t.target-t.group.rotation.y;if(Math.abs(d)>.001)t.group.rotation.y+=d*Math.min(1,dt*10);}
   if(flipWall){const want=flipDone?B4_LAYOUT.flipLift:0;lift+=(want-lift)*Math.min(1,dt*1.6);flipWall.position.y=lift;}
   const pulled=reached('b4_connect');leverPull+=((pulled?1:0)-leverPull)*k;if(lever)lever.rotation.x=-.45+.9*leverPull;
   lightLevel+=((pulled?1:0)-lightLevel)*Math.min(1,dt*2.2);
   const now=performance.now();
   for(const [i,l] of emergency.entries())l.intensity=28*(1-lightLevel)*(.85+.15*Math.sin(now*.006+i));
   if(work)work.intensity=2+58*lightLevel;if(rackLight)rackLight.intensity=24*lightLevel;
   for(const m of rackMaterials)m.emissiveIntensity=.12+1.85*lightLevel;
   if(flash>0){flash-=dt;if(flash<=0)paintCaps();}
   if(focus){const g=ctx.explorer.game;g.yaw+=(baseYaw+lookYaw-g.yaw)*k;g.pitch+=(basePitch+lookPitch-g.pitch)*k;}
  },
  interact(){
   if(!ctx||focus)return false;
   const id=nearest();
   if(!id){const s=step();if(s&&s!=='done'){ctx.notify('Walk up to the '+B4_STATIONS[STEP_STATION[s]].label+' and press '+USE+'.');return true;}return false;}
   if(id==='keyboard'||id==='flip'){enterFocus(id);return true;}
   return id==='breaker'?pull():connect();
  },
  objective,
  detach(){
   leaveFocus();
   if(typeof window!=='undefined'){window.removeEventListener('keydown',onKey,true);window.removeEventListener('pointerdown',onDown);window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);}
   const w=world();if(w){w.setDoorOpen(B4_DOOR_OBSTACLE,false);setB4FlipPanel(w,false);}
   group?.removeFromParent();group?.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();}});
   try{hum?.pause();}catch{/* optional */}
   group=null;ctx=null;tiles=[];caps=[];phraseCaps=[];enterCap=null;capGlow.clear();rackMaterials.length=0;emergency.length=0;seenStage=null;flipDone=false;keyboard=createKeyboardState();
  },
  debug:DEV?{
   complete(){for(const e of EVENTS)ctx?.emit(e);return ctx?.stage();},
   state(){return{stage:ctx?.stage(),typed:keyboard.typed,solved:keyboard.solved,flipped:flipCount(flip),tiles:tiles.length,focus,near:nearest(),light:+lightLevel.toFixed(2)};},
   /** Same paths as the focus view: type keys, flip tiles, pull, connect. */
   type(text:string){for(const ch of text)press(ch);return keyboard.typed;},
   enter(){return press('Enter');},
   flipAll(){setTiles(tiles.map(t=>t.index),true);return flipCount(flip);},
   pull,connect,
   focus(id:'keyboard'|'flip'){enterFocus(id);return focus;},
   leave(){leaveFocus();return focus;},
   stations(){return B4_STATIONS;},
  }:{complete(){for(const e of EVENTS)ctx?.emit(e);return ctx?.stage();}},
 };
}
