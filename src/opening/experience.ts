import * as T from 'three';
import type {createExplorer} from '../exploration/controller';
import {createStaffVoice,STAFF_INTRO_TIMING} from './voice';
import {CampusAudio} from '../gameplay/audio';
import {DEFAULT_SETTINGS,type Settings} from '../gameplay/save';
import type {Outcome} from '../gameplay/survey';
import type {OpeningModal,OpeningSave,OpeningState,OpeningEvent,OpeningView,OpeningCinema} from './contracts';
import {createOpeningState,reduceOpening} from './state';
import {OPENING_SAVE_KEY,captureOpeningSave,parseOpeningSave} from './persistence';
import {checkpointState,checkpointPose,checkpointCampaign,openingCheckpoint,routeYaw,CHECKPOINT_LABELS,type OpeningCheckpoint} from './checkpoint';
import {LAWN_APPROACH} from '../campaign/lawnChapter';
import {createOpeningRuntime,damageOpeningHearts,healOpeningHearts,syncRuntimeWithStory,OPENING_RESPAWN_GRACE_SECONDS,OPENING_MAX_HEARTS,type OpeningRuntime} from './runtime';
import {loadWorldThreat,sealWorld,resetWorldThreat,tryPurgeWorld,markLionDefeated,markPowerCut,markLocalModelCleared,cloneWorldThreat,type WorldThreat} from '../gameplay/worldThreat';
import {createThreatRefresh} from './threatRefresh';
import {OPENING as O,OPENING_WORLD_REVISION} from './spatialLayout';
import {B4_OFFICE,officeDebug,officeDoorOffered,openOfficeDoor,resetOffice,setOfficeArmed,setOfficeCue} from './b4Office';
import {resetLift} from './lift';
import {createStudentCrowd,crowdVariants} from '../gameplay/studentCrowd';
import {getGraphicsQuality} from '../viewer/graphicsQuality';
import {createOpeningFleet} from './robots';
import {createOpeningNPCs} from './npcs';
import {createB5FlipWall} from './b5FlipWall';
import {createOpeningUI} from './ui';
import {drawOpeningMap} from './map';
import type {CampaignHost} from '../campaign/host';
import {fleetStandsDown} from '../campaign/state';
import {relayRestored} from './backupRelay';
import {createHeartsChannel} from './heartsChannel';
import {routeInteract} from './interactRoute';
import type {createOpeningWorld} from './world';
import type {OpeningAtmosphere} from './atmosphere';
import {STAFF_DIALOGUE} from '../../content/voice/staff-dialogue';

type ComputerPage='map'|'tasks'|'agent';

const objectives:Record<OpeningState['stage'],[string,string]>={
 crowd:['Join the crowd on the plaza','The light show has just ended. Walk with the students.'],
 to_b5:['Walk to the High Table Dinner · Building 5','Building 5 · Ground floor. Follow the crowd; turn right after entering.'],
 to_b6:['Collect the presentation MacBook · Building 4 · 5F principal\'s office.','Take the B4 side door; the lift is the only way up. The office is at the end of the 5F corridor.'],
 return_b5:['Return the MacBook','Bring the presentation laptop back to the coordinator in Building 5.'],
 incident:['Open the MacBook','The dining hall is empty. Press C to open the local agent.'],
 to_b4:['Reach emergency control','Go to the main entrance of Building 4. Avoid the security robots.'],
 complete:['Building 4 reached','Opening complete. Keep the MacBook for the next section.'],
};

const STAFF_LINES=STAFF_DIALOGUE.intro;
const STAFF_START_TIMEOUT=2.5;
const STAFF_FALLBACK_DONE=STAFF_INTRO_TIMING.total+0.8;
const STAFF_SKIP_DISTANCE=10;

export function createOpeningExperience(
 scene:T.Scene,
 explorer:ReturnType<typeof createExplorer>,
 notify:(message:string)=>void,
 getWorld:()=>ReturnType<typeof createOpeningWorld>|undefined,
 getAtmosphere?:()=>OpeningAtmosphere|undefined,
 /** The one-world campaign that takes over once the story reaches `complete`. */
 getCampaign?:()=>CampaignHost|undefined,
){
 const g=explorer.game,stage=document.querySelector<HTMLElement>('.stage')!;
 let story=createOpeningState(),runtime=createOpeningRuntime(),settings:Settings={...DEFAULT_SETTINGS,music:.2},modal:OpeningModal=null,computerPage:ComputerPage='tasks';
 /** Bumped when open() shows a dialog that was not already up (a reopen after a close counts): the UI keys its dialog on it. */
 let modalSerial=0;
 let worldThreat:WorldThreat=loadWorldThreat();
 const refreshThreat=createThreatRefresh(1);
 let saveMessage='Progress saves on this device.',saveTick=0,announcePending=false,protectedSave=false,ownsSave=false,storageOkay=true,lastSave=0,stamp='',disposed=false,failed=false,scanClock=0,wasPaused=true;
 let incidentClock=0,disturbancePlayed=false,incidentQueued=false,heartbeatClock=0,chaseCueClock=0,respawnGrace=0,compatBeforePanel=false;
 /** Distance walked since the last spawn; the phone buzzes after a few steps. */
 let walked=0,lastWalkX=0,lastWalkZ=0;
 /** A restored save at `complete`: the completion dialog is decided on the next frame, once the campaign host has loaded. */
 let completePending=false;
 let subtitleText='',subtitleSeconds=0,titleText='',titleSubtitle='',titleSeconds=0;
 let staffTalkStarted=false,staffTalkDone=false,staffTalkClock=0,staffTalkLine=0,staffVoiceStarted=false,acceptVoicePlayed=false,acceptVoiceBusy=false,repeatVoiceBusy=false;
 let fleet=createOpeningFleet(explorer.world);scene.add(fleet.root);
 const npcs=createOpeningNPCs();scene.add(npcs.root);
 /* ---------------------------------------------------------------- */
 /* Plaza crowd: the existing student system, walking to Building 5.  */
 /* The opening no longer starts on the shuttle; it starts inside the  */
 /* crowd that watched the Magic Hour light show. Low quality halves  */
 /* the crowd, the geometry stays the shared instanced system.         */
 /* ---------------------------------------------------------------- */
 const crowdCount=getGraphicsQuality()==='low'?28:52;
 const crowdSeats=(()=>{
  const next=(seed:number)=>{let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
  const random=next(20301123),out:{x:number;z:number;yaw:number;scale:number}[]=[];
  for(let guard=0;out.length<crowdCount&&guard<40000;guard++){
   const x=40+random()*38,z=21.7+random()*18;
   // Keep the spawn clear and keep every student off the parked shuttle.
   if(Math.hypot(x-58,z-25)<2.6)continue;
   if(x>59.2&&x<69.6&&z>28.3&&z<33.5)continue;
   if(out.some(p=>Math.hypot(p.x-x,p.z-z)<1.15))continue;
   out.push({x,z,yaw:0,scale:.93+random()*.13});
  }
  return out;
 })();
 const crowd=createStudentCrowd(crowdSeats,crowdVariants(crowdSeats.length));scene.add(crowd.root);
 /** Walk route around the west side of Building 4 to the B5 doorway, then into
  * the lobby where the students leave the stage. It follows the same walkable
  * gap as `OPENING.routeB5` (x 24), never a building. */
 const crowdPath:{x:number;z:number}[]=[{x:O.crowdStart[0],z:O.crowdStart[2]},{x:40,z:33.5},{x:24,z:33.5},{x:24,z:18},{x:24,z:-8},{x:24,z:-30},{x:24,z:-46},{x:40,z:-48},{x:53,z:-51},{x:58,z:-54.5},{x:58,z:-58},{x:58,z:-62}];
 type CrowdStudent={x:number;y:number;z:number;target:number;speed:number;phase:number;scale:number;yaw:number;done:boolean};
 const crowdY=(x:number,z:number)=>{const h=explorer.world.support(x,z,4);return h===null?.08:h;};
 const crowdStudents:CrowdStudent[]=crowdSeats.map((seat,index)=>{
  let target=0,best=Infinity;
  for(let i=0;i<9;i++){const d=Math.hypot(crowdPath[i].x-seat.x,crowdPath[i].z-seat.z);if(d<best){best=d;target=i;}}
  return{x:seat.x,y:crowdY(seat.x,seat.z),z:seat.z,target,speed:1.05+((index*37)%17)/17*.55,phase:(index*.618)%1,scale:seat.scale,yaw:seat.yaw,done:false};
 });
 const crowdMatrix=new T.Matrix4(),crowdQuat=new T.Quaternion(),crowdUp=new T.Vector3(0,1,0),crowdPos=new T.Vector3(),crowdScale=new T.Vector3();
 for(const mesh of crowd.meshes)mesh.frustumCulled=false;
 let crowdBaked=false;
 const crowdVisible=()=>story.stage==='crowd'||story.stage==='to_b5';
 function updateCrowd(dt:number){
  const visible=crowdVisible();
  crowd.root.visible=visible;
  if(!visible)return;
  if(dt>0){
   let moved=false;
   for(const s of crowdStudents){
    if(s.done)continue;
    const waypoint=crowdPath[s.target];
    if(!waypoint){s.done=true;moved=true;continue;}
    const dx=waypoint.x-s.x,dz=waypoint.z-s.z,d=Math.hypot(dx,dz);
    if(d<.22){s.target++;if(s.target>=crowdPath.length)s.done=true;moved=true;continue;}
    const step=Math.min(d,s.speed*dt);
    s.x+=dx/d*step;s.z+=dz/d*step;s.y=crowdY(s.x,s.z);s.phase+=step*.9;
    const want=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(want-s.yaw),Math.cos(want-s.yaw));
    s.yaw+=delta*Math.min(1,dt*6);
    moved=true;
   }
   if(!moved&&crowdBaked)return;
  }else if(crowdBaked)return;
  crowdBaked=true;
  for(const mesh of crowd.meshes){
   const indices=mesh.userData.studentIndices as number[]|undefined;
   if(!indices)continue;
   indices.forEach((studentIndex,instance)=>{
    const s=crowdStudents[studentIndex];
    if(!s||s.done){crowdPos.set(0,-200,0);crowdQuat.identity();crowdScale.setScalar(0);}
    else{
     crowdPos.set(s.x,s.y+Math.sin(s.phase*6.2)*.022,s.z);
     crowdQuat.setFromAxisAngle(crowdUp,s.yaw);
     crowdScale.setScalar(s.scale);
    }
    crowdMatrix.compose(crowdPos,crowdQuat,crowdScale);
    mesh.setMatrixAt(instance,crowdMatrix);
   });
   mesh.instanceMatrix.needsUpdate=true;
  }
 }
 updateCrowd(0);
 // The HKU flip wall in the Building 5 lobby: ambient scenery, no campaign state, no key.
 const flipWall=createB5FlipWall();scene.add(flipWall.root);const audio=new CampusAudio(settings);audio.enableStory();const voice=createStaffVoice(audio);
 // Task E's beats play through the game's own mixer; the office module never owns an AudioContext.
 setOfficeCue((name,position)=>audio.story?.cue(name,position?new T.Vector3(position[0],position[1],position[2]):undefined));
 const notifyBase=notify;notify=(message)=>{audio.story?.ui('notify');notifyBase(message);};
 const writerToken=crypto.randomUUID(),writerKey=OPENING_SAVE_KEY+'.writer',events=new AbortController();
 let robotState='patrol',robotWarning=0;
 const atmo=()=>getAtmosphere?.();
 function showSubtitle(text:string,seconds:number){subtitleText=text;subtitleSeconds=seconds;}
 function showTitle(title:string,subtitle:string,seconds:number){if(campaign())return;titleText=title;titleSubtitle=subtitle;titleSeconds=seconds;}

 function staffLineFor(clock:number){
  return clock>=STAFF_INTRO_TIMING.starts[2]?2:clock>=STAFF_INTRO_TIMING.starts[1]?1:0;
 }
 function staffVoicePosition(){return modal==='staff'?null:npcs.staffPosition();}
 function startStaffIntro(force=false){
  if(staffTalkStarted&&!force)return;
  staffTalkStarted=true;staffTalkDone=false;staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;
  npcs.startStaffTalk();
  void voice.playIntro({
   eligible:()=>!failed&&(modal==='staff'||(staffTalkStarted&&!staffTalkDone)),
   position:staffVoicePosition,
   onItem:(index)=>{staffTalkLine=index;},
   onStart:()=>{staffVoiceStarted=true;staffTalkClock=0;staffTalkLine=0;},
   onError:()=>{staffVoiceStarted=true;staffTalkClock=0;staffTalkLine=0;},
   onDone:()=>{if(modal==='staff')staffTalkDone=true;else completeStaffIntro();},
  });
 }
 function playAcceptanceVoices(){
  if(acceptVoicePlayed||acceptVoiceBusy)return;
  acceptVoiceBusy=true;
  void voice.playAcceptance({
   eligible:()=>!failed&&story.stage==='to_b6'&&!g.panel,
   position:(_item,index)=>index===0?null:staffVoicePosition(),
   onItem:(index,item,duration)=>showSubtitle(`${index===0?'YOU':'COORDINATOR'} — ${item.text}`,duration+.35),
   onError:()=>{showSubtitle(`YOU — ${STAFF_DIALOGUE.playerAccept}`,1.8);window.setTimeout(()=>showSubtitle(`COORDINATOR — ${STAFF_DIALOGUE.thanks}`,3.6),1900);},
  }).then(ok=>{if(ok)acceptVoicePlayed=true;}).finally(()=>{acceptVoiceBusy=false;});
 }
 /** The alert card: the invader speaks first, then the local AI answers. */
 function playAlertVoices(){
  void voice.playAlert({
   onItem:(_index,item,duration)=>showSubtitle(`${item.id==='external-ai'?'INVADER':'LOCAL AI'} — ${item.text}`,duration+.4),
   onError:()=>{},
  });
 }
 function completeStaffIntro(){
  if(staffTalkDone)return;
  staffTalkDone=true;runtime={...runtime,staff_task_received:true};
  if(!transition('accept_errand'))return;
  showTitle('OBJECTIVE UPDATED','BUILDING 6 · PRESENTATION MACBOOK',1.25);
  // Let the objective banner clear before the acceptance line so its subtitle is not covered.
  window.setTimeout(()=>{if(!disposed&&story.stage==='to_b6'&&!failed&&!g.panel)playAcceptanceVoices();},1300);
  notify('MacBook: Building 6 · office table.');
 }

 function applySettings(){explorer.setSensitivity(settings.sensitivity);explorer.setComfort(settings.fov,settings.bob);audio.apply(settings);}
 function pose(position:readonly number[],yaw=0){g.body.position.fromArray([...position]);g.body.velocity.set(0,0,0);g.body.grounded=true;g.yaw=yaw;g.pitch=0;walked=0;lastWalkX=position[0];lastWalkZ=position[2];}
 function safePose(){
  if(story.stage==='crowd'||story.stage==='to_b5')pose(O.handoff,0);
  else if(story.stage==='to_b6')pose(O.checkpoints.b5,Math.PI);
  else if(story.stage==='return_b5')pose(O.checkpoints.b6,0);
  else if(story.stage==='complete')pose(O.handoff,0);
  else pose(O.checkpoints.b5safe,0);
 }
 /** The phone's single Yes: accept the Student Ambassador role, start the walk and
  * hand control back in the same click, so pointer lock keeps its user gesture. */
 function answerPhone(){
  if(story.invitation_read){close();return;}
  transition('read_invitation');
  transition('exit_bus');
  showSubtitle('Welcome, Ambassador.',3.2);
  notify('Welcome, Ambassador.');
  close();
 }
 function validPose(s:OpeningSave){const [x,y,z]=s.position,w=explorer.world,h=w.support(x,z,y+.24);return s.worldRevision===OPENING_WORLD_REVISION&&h!==null&&Math.abs(h-y)<.3&&!w.blocked(x,z,h+.003)&&[[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([dx,dz])=>{const n=w.support(x+dx,z+dz,h);return n!==null&&Math.abs(n-h)<.3;});}
 function restore(s:OpeningSave){
  explorer.pause('opening_load');story=structuredClone(s.story);
  // A shuttle-era save that already carried the invitation is the same beat as
  // "answered the phone and started walking": advance it, never wipe it.
  if(story.stage==='crowd'&&story.invitation_read)story=reduceOpening(story,'exit_bus');
  runtime=syncRuntimeWithStory(s.runtime??createOpeningRuntime(),story);settings={...s.settings};
  // The world state is authoritative: a sealed campus stays dark even when an
  // older opening save predates the flag, and a purged campus never re-seals.
  worldThreat=loadWorldThreat();
  if(worldThreat.phase==='sealed')runtime={...runtime,curtain_deployed:true};
  else if(worldThreat.phase==='purged')runtime={...runtime,curtain_deployed:false};
  g.inventory.slots.splice(0,36,...s.slots.map(i=>i?{...i}:null));g.inventory.selectedHotbar=s.selectedHotbar;g.inventory.revision++;g.view=s.view;modal=null;g.closePanel();failed=runtime.hearts<=0;respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;staffTalkStarted=false;staffTalkDone=false;staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;acceptVoicePlayed=false;acceptVoiceBusy=false;repeatVoiceBusy=false;npcs.reset();fleet.reset();crowdBaked=false;
  if(validPose(s)&&story.stage!=='incident'&&story.stage!=='to_b4')pose(s.position,s.yaw);else safePose();
  g.pitch=s.pitch;applySettings();
  if(failed)open('caught');
  else if(story.stage==='complete')completePending=true;
  incidentQueued=story.stage==='return_b5';
  if(worldThreat.phase==='sealed'){atmo()?.restoreSealed();audio.openingAmbience('dark');}
  else if(worldThreat.phase==='purged'){audio.openingAmbience('day');}
 }
 /** Writes the opening save. Only announced saves (`announceSave`: checkpoints, chapter boundaries, the Save button) raise the toast (Ruling 33). */
 function persist(force=false,announce=false):boolean{if(disposed||protectedSave||!ownsSave||!force&&performance.now()-lastSave<5000)return false;try{if(localStorage.getItem(writerKey)!==writerToken){ownsSave=false;return false;}const safe=story.stage==='incident'||story.stage==='to_b4'?([...O.encounterSafe] as [number,number,number]):undefined;localStorage.setItem(OPENING_SAVE_KEY,JSON.stringify(captureOpeningSave(g,story,settings,safe,runtime)));lastSave=performance.now();storageOkay=true;saveMessage='Saved on this device.';if(announce)saveTick++;return true;}catch{storageOkay=false;saveMessage='Storage unavailable. Progress remains in this session.';return false;}}
 /** An announced save. Before this window owns the save (no trusted input yet) it is written and announced at the first input. */
 function announceSave(){if(!persist(true,true))announcePending=true;}
 function claimSave(){if(protectedSave)return;try{if(localStorage.getItem(writerKey)!==writerToken){const latestRaw=localStorage.getItem(OPENING_SAVE_KEY);if(latestRaw){let saved:OpeningSave|null=null;try{saved=parseOpeningSave(JSON.parse(latestRaw));}catch{}if(!saved){protectedSave=true;saveMessage='Unrecognized save protected. Start a new opening to back it up.';return;}if(lastSave>0||saved.savedAt>loadedAt){restore(saved);saveMessage='Latest checkpoint continued from another window.';}}localStorage.setItem(writerKey,writerToken);}ownsSave=true;}catch{ownsSave=true;storageOkay=false;}if(announcePending&&ownsSave){announcePending=false;persist(true,true);}}
 /** The one hearts store: campaign chapters damage and heal this runtime, so the vitals HUD and the save follow. */
 const hearts=createHeartsChannel(()=>runtime,next=>{runtime=next;persist(true);});
 /** The campaign host while it owns the run (story complete and a campaign started). */
 function campaign(){const c=getCampaign?.();return c?.active&&story.stage==='complete'?c:null;}
 /** Chapter 1 robots hunt until Building 4; in the campaign they hunt until the relay hands them over (`to_lawn`). */
 function fleetHunts(){if(story.stage!=='complete')return true;const c=campaign();return !!c&&!fleetStandsDown(c.stage());}
 /** Chapter 1 complete with the relay still offline: hand straight over to the campaign in this page. */
 /**
  * The completion dialog's hand-over. A campaign that is already running is
  * never restarted (that would rewind its save): the dialog just closes. Play
  * resumes only when the call comes from the player's click (`gesture`);
  * otherwise the pause card's Continue does it, because pointer lock needs a gesture.
  */
 function startCampaign(deviceId:string,options:{stage?:'b4_enter'|'to_lawn';gesture?:boolean}={}){
  const c=getCampaign?.();if(!c||!deviceId||story.stage!=='complete'||modal!=='complete')return false;
  if(!c.active){
   if(!c.start(deviceId,options.stage??'b4_enter'))return false;
   // Chapter 2 starts at the B04 door, where the player arrived facing the building:
   // turn them toward the lawn route so the objective is ahead (FU2). A camera cut at a dialog close.
   if(options.stage==='to_lawn'){const p=g.body.position;g.yaw=routeYaw([p.x,p.y,p.z],LAWN_APPROACH);g.pitch=0;}
  }
  voice.stop();modal=null;explorer.closePanel();persist(true);
  if(options.gesture){if(compatBeforePanel)explorer.enterCompat();else explorer.enter();}
  compatBeforePanel=false;
  return true;
 }
 /** Building 4 reached: with the relay offline the campaign takes over at once
  * (no panel, so pointer lock and play continue); otherwise show the completion dialog. */
 function handOff(){
  const c=getCampaign?.(),mac=g.inventory.slots.find(slot=>slot?.itemId==='macbook-air-13-silver')?.instanceId;
  if(c&&mac&&!relayRestored(mac)&&c.start(mac)){persist(true);return;}
  open('complete');
 }
 function transition(event:OpeningEvent){const next=reduceOpening(story,event);if(next===story)return false;story=next;persist(true);return true;}
 function open(next:OpeningModal){if(failed&&next!=='caught')return;voice.stop();compatBeforePanel=explorer.state.compat;if(modal!==next)modalSerial++;modal=next;explorer.openPanel(next==='settings'?'settings':'computer',next==='computer');audio.setActive(false);audio.stopOpeningCues();audio.stopPreviews();if(next==='computer')audio.story?.cue('macbook_open',undefined,true);else if(next==='invitation')audio.story?.cue('mus_invitation',undefined,true);else if(next==='staff'&&story.stage==='to_b5')startStaffIntro(true);}
 function close(){if(modal==='caught')return;const was=modal;voice.stop();audio.stopPreviews();if(modal==='computer')audio.story?.cue('macbook_close',undefined,true);modal=null;explorer.closePanel();persist(true);
  // A story panel should hand control straight back to the player. The same click
  // that closed it is still a user gesture, so pointer lock can be requested here.
  if(was!=='complete'){if(compatBeforePanel)explorer.enterCompat();else explorer.enter();}
  compatBeforePanel=false;
 }
 function outcome(ok:boolean,code:string,message:string):Outcome{return{ok,code,message};}
 function target(){
  const staffRoot=npcs.staffRootPosition();
  const nearStaff=story.stage==='to_b6'&&staffTalkDone&&!acceptVoiceBusy&&!story.laptop_acquired&&g.body.position.distanceTo(staffRoot)<3.2;
  const repeat=nearStaff?{id:'opening-staff-repeat',position:[staffRoot.x,staffRoot.y,staffRoot.z] as [number,number,number],label:'Ask the coordinator about the laptop'}:null;
  // Task E: the errand moved to the 5F principal's office. The door is its own interaction
  // until it is open — but only once the errand has armed it (Addendum 5 C.3): a player who
  // explores B4/B5 before the hand-off must not spend the one abduction on an empty office.
  const atFifth=g.body.position.y>B4_OFFICE.floorTop-1.5&&g.body.position.y<B4_OFFICE.floorTop+3;
  const doorItem=officeDoorOffered({stage:story.stage,atFifth,hasRepeat:repeat!==null})
   ?{id:'opening-office-door',position:[B4_OFFICE.door.x0-.35,B4_OFFICE.floorTop+1.15,B4_OFFICE.door.centre] as [number,number,number],label:"Open the principal's office"}
   :null;
  const laptopItem={id:'opening-laptop',position:[B4_OFFICE.laptop.x,B4_OFFICE.laptop.y,B4_OFFICE.laptop.z] as [number,number,number],label:'Pick up the presentation MacBook'};
  const item=story.stage==='to_b5'?{id:'opening-staff',position:O.staff,label:'Speak to the coordinator'}:repeat??doorItem??(story.stage==='to_b6'?laptopItem:null);
  if(!item)return null;
  const origin=g.body.position.clone().add(new T.Vector3(0,1.64,0)),point=new T.Vector3(...item.position).add(new T.Vector3(0,item.id.startsWith('opening-staff')?1.3:.1,0)),offset=point.clone().sub(origin),distance=offset.length();
  if(distance>2.7)return null;
  const facing=new T.Vector3(-Math.sin(g.yaw)*Math.cos(g.pitch),-Math.sin(g.pitch),-Math.cos(g.yaw)*Math.cos(g.pitch));
  if(distance>.02&&facing.dot(offset.clone().normalize())<.80)return null;
  const ray=new T.Raycaster(origin,offset.normalize(),.03,Math.max(.03,distance-.15));if(ray.intersectObjects(explorer.world.meshes,false).length)return null;return item;
 }
 function interact(id?:string):Outcome{
  if(g.paused||g.panel||g.inventoryOpen)return outcome(false,'paused','Continue exploring first.');
  const t=target();if(!t||id&&id!==t.id)return outcome(false,'no_target','Move closer and face the interaction.');
  if(t.id==='opening-staff'){
   startStaffIntro();
   return outcome(true,'dialogue_started','Dinner coordinator.');
  }
  if(t.id==='opening-staff-repeat'){
   if(repeatVoiceBusy)return outcome(true,'dialogue_repeat','Dinner coordinator.');
   repeatVoiceBusy=true;
   showSubtitle(`COORDINATOR — ${STAFF_DIALOGUE.repeat}`,2.6);
   void voice.playRepeat({eligible:()=>!failed&&story.stage==='to_b6'&&!story.laptop_acquired,position:()=>npcs.staffPosition()}).finally(()=>{repeatVoiceBusy=false;});
   return outcome(true,'dialogue_repeat','Dinner coordinator.');
  }
  if(t.id==='opening-office-door'){
   if(!openOfficeDoor())return outcome(false,'door_open','The office is already open.');
   notify("The principal's office is open.");
   return outcome(true,'door_opened',"The principal's office.");
  }
  if(t.id==='opening-laptop')return collectLaptop();
  return outcome(false,'invalid_target','No interaction available.');
 }
 function collectLaptop():Outcome{
  if(story.laptop_acquired||g.inventory.slots.some(s=>s?.itemId==='macbook-air-13-silver'))return outcome(false,'already_acquired','The laptop is already in your backpack.');
  if(story.stage!=='to_b6')return outcome(false,'wrong_stage','The presentation MacBook is not available yet.');
  const free=g.inventory.slots.findIndex(s=>s===null);if(free<0)return outcome(false,'inventory_full','Make room in your backpack first.');
  g.inventory.slots[free]={itemId:'macbook-air-13-silver',instanceId:'opening-macbook-'+crypto.randomUUID(),count:1};g.inventory.revision++;if(free<9)g.inventory.select(free);else{g.inventory.move(free,0);g.inventory.select(0);}
  transition('take_laptop');incidentQueued=true;incidentClock=0;disturbancePlayed=false;notify('MacBook Air collected · C to open · E for backpack');audio.play('collect');persist(true);return outcome(true,'laptop_acquired','MacBook Air collected.');
 }
 function computer(page:'map'|'tasks'|'clues'|'submit'|'agent'='tasks'):Outcome{
  if(failed)return outcome(false,'caught','Recover at the checkpoint first.');
  if(!story.laptop_acquired)return outcome(false,'laptop_required',"Collect the presentation MacBook from the 5F principal's office first.");
  if(!g.inventory.equipItem('macbook-air-13-silver'))return outcome(false,'laptop_missing','Required laptop is missing. Reload a valid checkpoint.');
  computerPage=page==='map'?'map':page==='agent'?'agent':'tasks';
  open('computer');
  return outcome(true,'page_ready',story.campus_alert_triggered?'Emergency assistant ready.':'Presentation device ready.');
 }
 function recoverFromCatch(heal:boolean){
  if(modal!=='caught')return;
  failed=false;respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;
  if(heal||runtime.hearts<=0)runtime=healOpeningHearts(runtime);
  fleet.reset();audio.stopOpeningCues();audio.story?.reset();audio.story?.cue('sfx_safe_restore',undefined,true);
  // Do not respawn into the same capture loop at Building 6 after the curtain is up.
  if(story.stage==='return_b5'&&runtime.curtain_deployed)pose(O.checkpoints.b5safe,0);else safePose();
  modal=null;explorer.closePanel();persist(true);
  notify(`Checkpoint restored · ${runtime.hearts}/${OPENING_MAX_HEARTS} hearts. Click Continue when ready.`);
 }
 function catchPlayer(){
  if(failed)return;
  failed=true;
  const damage=damageOpeningHearts(runtime);runtime=damage.runtime;
  if(runtime.hearts<=0){runtime={...runtime,hearts:0};}
  explorer.pause('robot_caught');
  open('caught');
  audio.story?.cue('robot_capture',undefined,true);
  persist(true);
  notify(`Caught by campus security · −${damage.lost} hearts`);
 }
 /**
  * Chapter-select start: replay the story machine to the checkpoint stage, hand
  * over the MacBook the story would already have given, and place the body at the
  * stage checkpoint with the same pose()/respawn path the game uses.
  */
 function startAtCheckpoint(id:OpeningCheckpoint){
  const next=checkpointState(id);if(!next)return;
  story=next;runtime=syncRuntimeWithStory(createOpeningRuntime(),story);
  g.inventory.slots.fill(null);g.inventory.selectedHotbar=0;g.inventory.revision++;
  if(story.laptop_acquired){g.inventory.slots[0]={itemId:'macbook-air-13-silver',instanceId:'opening-macbook-'+crypto.randomUUID(),count:1};g.inventory.select(0);}
  g.view='first';modal=null;failed=false;respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;
  staffTalkStarted=false;staffTalkDone=story.stage!=='to_b5';staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;acceptVoicePlayed=false;acceptVoiceBusy=false;
  incidentQueued=false;incidentClock=0;disturbancePlayed=false;
  npcs.reset();fleet.reset();crowdBaked=false;resetLift();resetOffice();
  // Campaign checkpoints sit on other parts of the campus: settle them on the walkable floor there.
  const at=checkpointPose(id),[px,py,pz]=at.position,floor=checkpointCampaign(id)?explorer.world.support(px,pz,py+.6):null;pose(floor===null?at.position:[px,floor,pz],at.yaw);
  saveMessage='Checkpoint: '+CHECKPOINT_LABELS[id]+'.';
  announceSave();
  if(runtime.curtain_deployed){atmo()?.startIncident();audio.openingAmbience('dark');}
 }
 function restart(){
  try{const raw=localStorage.getItem(OPENING_SAVE_KEY);if(raw)localStorage.setItem(OPENING_SAVE_KEY+'.backup.'+Date.now(),raw);localStorage.setItem(writerKey,writerToken);protectedSave=false;ownsSave=true;}catch{notify('Could not back up the save. Restart cancelled.');return;}
  getCampaign?.()?.reset();
  audio.story?.reset();audio.stopPreviews();
  worldThreat=resetWorldThreat();story=createOpeningState();runtime=createOpeningRuntime();g.inventory.slots.fill(null);g.inventory.selectedHotbar=0;g.inventory.revision++;g.records.clear();g.last=null;failed=false;incidentClock=0;disturbancePlayed=false;incidentQueued=false;respawnGrace=0;walked=0;subtitleSeconds=0;titleSeconds=0;staffTalkStarted=false;staffTalkDone=false;staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;acceptVoicePlayed=false;acceptVoiceBusy=false;repeatVoiceBusy=false;npcs.reset();fleet.reset();crowdBaked=false;resetLift();resetOffice();modal=null;explorer.closePanel();safePose();atmo()?.reset();audio.openingAmbience('day');audio.stopOpeningCues();persist(true);
 }
 function beginIncident(announce=true){
  if(runtime.curtain_deployed)return;
  worldThreat=loadWorldThreat();
  // A purged campus is terminal for this run; a stale save must not re-seal it.
  if(worldThreat.phase==='purged')return;
  worldThreat=sealWorld();
  runtime={...runtime,curtain_deployed:true};
  atmo()?.startIncident();
  audio.openingCue('curtain');
  audio.openingAmbience('dark');
  if(announce)notify('The campus perimeter seals. The sky goes dark.');
  persist(true);
 }
 function action(action:string){
  if(failed&&!'retry recover restart'.split(' ').includes(action))return;
  if(action==='read_invitation'){answerPhone();}
  else if(action==='accept_errand'&&story.stage==='to_b5'){runtime={...runtime,staff_task_received:true};if(transition('accept_errand')){close();playAcceptanceVoices();notify(`You: ${STAFF_DIALOGUE.playerAccept}`);}}
  else if(action==='read_alert'){transition('read_alert');runtime={...runtime,agent_chat_unlocked:true,go_to_building4_objective_unlocked:true};worldThreat=loadWorldThreat();if(worldThreat.phase==='clear'){worldThreat=sealWorld();runtime={...runtime,curtain_deployed:true};atmo()?.startIncident();audio.openingAmbience('dark');}modal='computer';computerPage='agent';audio.openingCue('unlock');persist(true);}
  else if(action==='retry')recoverFromCatch(false);
  else if(action==='recover')recoverFromCatch(true);
  else if(action==='restart')restart();
  else if(action==='save'){claimSave();announceSave();}
  else if(action==='safe'){explorer.pause('opening_safe_checkpoint');safePose();fleet.reset();failed=false;modal=null;g.closePanel();persist(true);}
  else if(action==='settings')open('settings');
  else if(action==='map'||action==='computer'){const r=computer(action==='map'?'map':'tasks');if(!r.ok)notify(r.message);}
  else if(action==='replay_voice'&&modal==='staff'&&story.stage==='to_b5')startStaffIntro(true);
  else if(action==='retry_audio')void audio.start(true);
  else if(action==='preview_ambient')void audio.preview('ambient');
  else if(action==='preview_steps')void audio.preview('steps');
  else if(action==='preview_sfx')void audio.preview('sfx');
  else if(action==='preview_music')void audio.preview('music');
 }
 const ui=createOpeningUI(stage,{action,close,setting(key,value){if(key==='muted'||key==='bob')settings[key]=Boolean(value);else settings[key]=Number(value);applySettings();persist(true);},drawMap:(canvas,large)=>drawOpeningMap(canvas,g,story,large,campaign()?.objective()),startCampaign,sound:(kind)=>audio.story?.ui(kind)},{
  instanceId:()=>g.inventory.slots.find(slot=>slot?.itemId==='macbook-air-13-silver')?.instanceId,
  units:()=>fleet.units.map((unit,index)=>({
    id:String(unit.root.userData.fleetId),name:'Campus guard '+(index+1),
    status:story.campus_alert_triggered?'Compromised · '+unit.state:'Standby',
  })),
 },{onAlert:playAlertVoices});

 /** One cue per story beat; the score crossfades on every stage change. */
 function openingScore(stage:string,dark:boolean,chasing:boolean){
  if(chasing)return 'mus_chase';
  if(dark)return 'mus_patrol';
  if(stage==='to_b5')return 'mus_dinner';
  if(stage==='to_b6'||stage==='return_b5')return 'mus_office';
  if(stage==='complete')return 'mus_sports';
  return 'mus_prologue';
 }
 function tick(dt:number){
  story.elapsedSeconds+=dt;
  // Task E (E-F3): the abduction is armed by the errand, never by walking in. `accept_errand`
  // is the only event that leaves `to_b5`, so every later stage means the hand-off happened; a
  // checkpoint start at `b6` lands directly on `to_b6` and is armed on its first tick.
  setOfficeArmed(story.stage!=='crowd'&&story.stage!=='to_b5');
  if(modal!=='caught'&&failed)failed=false;
  if(story.stage==='to_b5'&&!staffTalkStarted&&!staffTalkDone&&!g.panel&&!g.inventoryOpen&&!g.paused&&g.body.position.distanceTo(new T.Vector3(...O.staff))<6.5){
   startStaffIntro();
  }
  if(staffTalkStarted&&!staffTalkDone){
   staffTalkClock+=dt;
   if(!staffVoiceStarted){
    if(staffTalkClock>=STAFF_START_TIMEOUT){staffVoiceStarted=true;staffTalkClock=0;staffTalkLine=0;}
   }else{
    const line=staffLineFor(staffTalkClock);
    if(line!==staffTalkLine)staffTalkLine=line;
    if(staffTalkClock>=STAFF_FALLBACK_DONE&&modal!=='staff')completeStaffIntro();
   }
   if(g.body.position.distanceTo(npcs.staffPosition())>STAFF_SKIP_DISTANCE){
    voice.stop();
    if(modal!=='staff')completeStaffIntro();
   }
  }
  if(story.stage==='return_b5'&&story.laptop_acquired){
   incidentClock+=dt;
   if(!runtime.curtain_deployed&&!disturbancePlayed&&incidentClock>1.1){disturbancePlayed=true;audio.openingCue('disturbance');notify('A low mechanical vibration rolls across the campus.');}
   const outside=g.body.position.z>O.b6.z1+1.5||incidentClock>4.2;
   if(!runtime.curtain_deployed&&outside)beginIncident();
  }
  if(story.stage==='return_b5'&&g.body.position.distanceTo(new T.Vector3(...O.returnPoint))<3.3){
   transition('return_b5');worldThreat=sealWorld();runtime={...runtime,curtain_deployed:true};atmo()?.startIncident();audio.openingAmbience('dark');
   notify('The dinner hall is empty. Chairs are overturned. Open the MacBook with C.');
  }
  const alert=story.campus_alert_triggered||runtime.curtain_deployed;
  const active=alert&&fleetHunts();
  if(active){
   if(respawnGrace>0)respawnGrace=Math.max(0,respawnGrace-dt);
   const result=fleet.update(dt,g.body.position,true,respawnGrace>0);
   if(result.chasing&&!runtime.robot_chase_started)runtime={...runtime,robot_chase_started:true};
   if(result.caught&&!failed&&respawnGrace<=0)catchPlayer();
   if(runtime.hearts>0&&runtime.hearts<=4){heartbeatClock+=dt;if(heartbeatClock>1.15){heartbeatClock=0;audio.openingCue('heartbeat');}}
  }
  if(!failed&&story.stage==='to_b4'&&g.body.position.distanceTo(new T.Vector3(...O.handoff))<2.2){
   transition('reach_b4');runtime={...runtime,go_to_building4_objective_unlocked:true,agent_chat_unlocked:true};handOff();
   audio.story?.ending();
   window.dispatchEvent(new CustomEvent('campus-opening-handoff',{detail:{event:'opening.building4_reached',flags:{invitation_read:story.invitation_read,laptop_acquired:story.laptop_acquired,campus_alert_triggered:story.campus_alert_triggered},laptopInstanceId:g.inventory.slots.find(s=>s?.itemId==='macbook-air-13-silver')?.instanceId,anchor:'opening-building4-entrance'}}));
   persist(true);
  }
 }
 g.scenario={interact,computer,tick,snapshot:()=>({story:structuredClone(story),runtime:structuredClone(runtime),worldThreat:cloneWorldThreat(worldThreat),modal,busReady:true,respawnGraceSeconds:respawnGrace,robotState,warning:robotWarning,goal:objectiveFor(),handoff:story.stage==='complete'?'opening.building4_reached':null,target:target()?.id??null}),spawn:()=>{safePose();fleet.reset();}};
 let loadedAt=0;let raw:string|null=null;
 try{raw=localStorage.getItem(OPENING_SAVE_KEY);const saved=raw?parseOpeningSave(JSON.parse(raw)):null;if(saved){restore(saved);loadedAt=saved.savedAt;saveMessage='Opening checkpoint restored.';}else{g.inventory.slots.fill(null);g.inventory.revision++;safePose();if(raw){protectedSave=true;saveMessage='Unrecognized save protected. Restart to back it up.';}}}catch{g.inventory.slots.fill(null);g.inventory.revision++;safePose();protectedSave=!!raw;storageOkay=false;saveMessage='Save unavailable. A new session is ready.';}
 const requestedCheckpoint=openingCheckpoint(new URLSearchParams(location.search).get('checkpoint'));
 if(requestedCheckpoint)startAtCheckpoint(requestedCheckpoint);
 applySettings();worldThreat=loadWorldThreat();if(requestedCheckpoint){if(runtime.curtain_deployed){atmo()?.startIncident();audio.openingAmbience('dark');}}else if(worldThreat.phase==='sealed'){runtime={...runtime,curtain_deployed:true};atmo()?.restoreSealed();audio.openingAmbience('dark');}else if(worldThreat.phase==='purged'){runtime={...runtime,curtain_deployed:false};audio.openingAmbience('day');}
 // F: the campaign chapter first, then Chapter 1's targets, otherwise the notice (one handler, one owner).
 const humanInteract=()=>{routeInteract({campaign,reopenHandoff:()=>{if(story.stage!=='complete'||failed||modal||!getCampaign?.())return false;open('complete');return true;},opening:()=>g.interact(),notify});},humanComputer=()=>{const r=g.computer('tasks');if(!r.ok)notify(r.message);};explorer.interactions.add(humanInteract);explorer.computers.add(humanComputer);
 document.addEventListener('pointerdown',e=>{if(e.isTrusted)claimSave();},{capture:true,signal:events.signal});document.addEventListener('keydown',e=>{if(e.isTrusted)claimSave();},{capture:true,signal:events.signal});
 window.addEventListener('storage',e=>{if(e.key===writerKey&&e.newValue!==writerToken&&ownsSave){ownsSave=false;explorer.pause('save_owner_changed');saveMessage='Another window owns this save. Click to continue here.';}},{signal:events.signal});
 window.addEventListener('blur',()=>voice.stop(),{signal:events.signal});
 window.addEventListener('pagehide',()=>persist(true),{signal:events.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist(true);voice.stop();audio.stopOpeningCues();}},{signal:events.signal});
 for(const id of ['enter-game','enter-compat','enable-ai'])document.getElementById(id)?.addEventListener('click',()=>{void audio.start().then(()=>{if(runtime.curtain_deployed)audio.openingAmbience('dark');});},{signal:events.signal});
 document.getElementById('experience-settings')?.addEventListener('click',()=>open('settings'),{signal:events.signal});document.getElementById('new-game')?.addEventListener('click',()=>open('settings'),{signal:events.signal});
 function objectiveFor(){
  if(story.stage==='crowd')return story.invitation_read?'Walk to the High Table Dinner · Building 5':objectives.crowd[0];
  if(story.stage==='return_b5'&&runtime.curtain_deployed)return 'Get back to Building 5';
  if(story.stage==='incident')return 'Open the MacBook';
  const c=campaign()?.objective();if(c)return c.text;
  if(story.stage==='complete'&&!campaign())return 'Continue to Chapter 2';
  return objectives[story.stage][0];
 }
 function detailFor(){
  if(story.stage==='crowd')return 'The light show has ended and the crowd is turning toward Building 5. Walk with the students.';
  if(story.stage==='return_b5'&&runtime.curtain_deployed)return 'The campus is sealed and robots are active. Reach Building 5, then open the MacBook with C.';
  if(story.stage==='incident')return 'The dining hall is empty. Press C to open the local agent.';
  if(campaign())return '';
  if(story.stage==='complete')return 'Press F to continue the run from Building 4.';
  return objectives[story.stage][1];
 }
 function update(dt:number){
  if(disposed)return;
  if(completePending){completePending=false;if(story.stage==='complete'&&!campaign()&&!failed&&!modal)open('complete');}
  const inCampaign=!!campaign();
  if(inCampaign)titleSeconds=0;
  if(!g.paused){if(titleSeconds>0)titleSeconds=Math.max(0,titleSeconds-dt);if(subtitleSeconds>0)subtitleSeconds=Math.max(0,subtitleSeconds-dt);}

  const active=explorer.enabled;
  /* A few steps into the walk, the phone in the player's pocket buzzes. The
   * overlay is the only gate between the prologue and the dinner: movement is
   * paused by the modal, and Yes releases it from the same click. */
  if(active&&!g.paused&&!g.panel&&!g.inventoryOpen){
   const px=g.body.position.x,pz=g.body.position.z,step=Math.hypot(px-lastWalkX,pz-lastWalkZ);
   if(step<1)walked+=step;
   lastWalkX=px;lastWalkZ=pz;
   if(walked>=1.6&&story.stage==='crowd'&&!story.invitation_read&&!modal&&!document.body.classList.contains('prologue-active')){
    audio.story?.ui('notify');
    if(typeof navigator.vibrate==='function')navigator.vibrate(120);
    open('invitation');
   }
  }
  const alert=story.campus_alert_triggered||runtime.curtain_deployed;
  const hunting=fleetHunts(),fleetShown=story.stage!=='complete'||!!campaign();
  fleet.root.visible=active&&fleetShown;
  // The cast owns its own visibility now: during the incident it walks out through the B5
  // door and hides per actor as each one clears it, instead of vanishing on the alert frame.
  if(!active)npcs.root.visible=false;
  npcs.update(active?dt:0,alert,g.paused,g.body.position);
  updateCrowd(active?g.paused?0:dt:0);
  flipWall.update(g.paused?0:dt,g.body.position);
  // Fixed-step actor simulation happens in tick(); this read never advances it.
  const r=alert&&hunting?fleet.update(0,g.body.position,active,true):fleet.standby(active&&fleetShown);robotState=r.state;robotWarning=r.warning;
  // The shuttle is parked scenery now: its door stays closed and the paper
  // invitation never appears — the invitation lives on the phone.
  getWorld()?.update({incident:alert,laptopAcquired:story.laptop_acquired,doorOpen:false,invitationRead:true},g.paused?0:dt);
  // The sky is owned by the persistent world state, not by the chapter flag.
  // A sealed runtime without a world record is repaired here, and a purged
  // world record always wins over a stale curtain flag.
  // Another module (the ending) can purge the shared record mid-run. Adopt it
  // (at most once a second: a corrupt record must not be re-read per frame),
  // otherwise the sealed curtain below would re-close the sky every frame (I3).
  worldThreat=refreshThreat(worldThreat,dt,()=>loadWorldThreat());
  if(runtime.curtain_deployed&&worldThreat.phase==='clear')worldThreat=sealWorld();
  const sealed=worldThreat.phase==='sealed';
  if(sealed&&!runtime.curtain_deployed)runtime={...runtime,curtain_deployed:true};
  else if(!sealed&&worldThreat.phase==='purged'&&runtime.curtain_deployed)runtime={...runtime,curtain_deployed:false};
  atmo()?.update(dt,{incident:sealed,curtain:sealed,paused:g.paused});
  if(g.paused&&!wasPaused&&modal!=='staff')audio.stopOpeningCues();wasPaused=g.paused;
  const surface=explorer.world.surface(g.body.position.x,g.body.position.z,g.body.position.y);
  // The prologue holds the game paused while it owns the screen. Handing that pause to the
  // mixer calls story.pause(), which drops every music loop — so the cinematic ran with no
  // bed under the narration (owner, 2026-11-24: "音乐呢"). A pause by anything else still
  // silences it, and the opening cues still stop below.
  const audioPaused=(g.paused&&g.pauseReason!=='prologue')||!active;
  audio.update(explorer.student.gait,audioPaused,surface,g.body.position,explorer.camera.position,g.yaw);
  audio.story?.update({stage:story.stage,dark:alert,chasing:r.chasing,music:openingScore(story.stage,alert,r.chasing),player:g.body.position,dt,
   robots:active&&alert&&hunting?fleet.units.map((unit,index)=>({id:'opening-robot-'+index,state:unit.state,position:unit.position})):[]});
  const item=target();
  const campaignGoal=campaign()?.objective()??null;
  // The crowd stage's goal is the gathering, not the B5 staff: the students are what the
  // player can see from the spawn, and pointing the arrow and the readout at the staff put
  // an 86 m objective next to a 10 m crowd (playtest, 2026-11-24). `map.ts` reads the same
  // `O.crowdStart` anchor, so the minimap and the HUD agree.
  const goal:readonly number[]|null=campaignGoal?campaignGoal.target:story.stage==='crowd'?O.crowdStart:story.stage==='to_b6'?[B4_OFFICE.laptop.x,B4_OFFICE.laptop.y,B4_OFFICE.laptop.z]:story.stage==='return_b5'?O.returnPoint:story.stage==='to_b4'||story.stage==='complete'?O.handoff:O.staff;
  const prompt=active&&!g.paused?(item?'F · '+item.label:story.laptop_acquired&&story.stage!=='complete'?'C · Open the MacBook':''):'';
  const sound=audio.diagnostics;
  let cinema:OpeningCinema;
  if(inCampaign){
   cinema={mode:'off',title:'',subtitle:'',hint:'',opacity:0,letterbox:false};
  }else if(titleSeconds>0){
   cinema={mode:'title',title:titleText,subtitle:titleSubtitle,hint:'',opacity:0,letterbox:true};
  }else if(staffTalkStarted&&!staffTalkDone){
   cinema={mode:'subtitle',title:'',subtitle:STAFF_LINES[Math.min(STAFF_LINES.length-1,staffTalkLine)],hint:'',opacity:0,letterbox:true};
  }else if(subtitleSeconds>0){
   cinema={mode:'subtitle',title:'',subtitle:subtitleText,hint:'',opacity:0,letterbox:true};
  }else{
   cinema={mode:'off',title:'',subtitle:'',hint:'',opacity:0,letterbox:false};
  }
  const view:OpeningView={story,runtime,modal:active?modal:null,objective:objectiveFor(),detail:detailFor(),prompt,saveStatus:saveMessage,saveTick,busReady:true,computerPage,robotState,robotWarning,settings,audioStatus:sound.failed?`${sound.failedFiles.length} sounds unavailable. Retry audio to load them again.`:sound.loading.length?'Loading audio…':sound.state==='uninitialized'?'Use a preview or start the opening to enable audio.':sound.resumeError||'Audio ready.',handoffEvent:'opening.building4_reached',player:g.body.position.toArray() as [number,number,number],yaw:g.yaw,target:goal?[...goal] as [number,number,number]:null,campaign:!!campaign(),modalSerial,voiceLine:staffTalkLine,cinema};
  ui.update(view);
  const next=[story.stage,story.events.length,story.invitation_read,g.inventory.revision,g.view,runtime.curtain_deployed,runtime.robot_chase_started,runtime.agent_chat_unlocked,runtime.hearts].join(':');
  // Stamp saves (hotbar, hearts, Chapter 1 steps) and the 5 s autosave are quiet.
  if(stamp!==next){stamp=next;persist(true);}else if(!g.paused)persist();
  const enter=document.getElementById('enter-game');if(enter)enter.textContent=story.elapsedSeconds>0?'Continue':'Start opening';
  const status=document.getElementById('session-save');if(status)status.textContent=saveMessage;
 }
 return{update,hearts,announceSave,relocate(){fleet.dispose();fleet=createOpeningFleet(explorer.world);scene.add(fleet.root);crowdBaked=false;safePose();},openComputer(page:ComputerPage='tasks'){const r=computer(page);if(!r.ok)notify(r.message);},openSettings(){open('settings');},persist,audio,debug:{office(){return officeDebug();},openInvitation(){open('invitation');},readInvitation(){if(story.stage==='crowd'&&!story.invitation_read){transition('read_invitation');transition('exit_bus');if(modal==='invitation')close();}},openStaff(){open('staff');},acceptErrand(){if(story.stage==='to_b5'){runtime={...runtime,staff_task_received:true};if(transition('accept_errand')){if(modal==='staff')close();playAcceptanceVoices();}}},takeLaptop(){return collectLaptop();},setBusReady(){/* the shuttle is scenery: no door state to set */},exitBus(){if(story.stage==='crowd'&&story.invitation_read)transition('exit_bus');},triggerIncident(){beginIncident();},reachB5(){if(story.stage==='return_b5'){transition('return_b5');runtime={...runtime,curtain_deployed:true};atmo()?.startIncident();audio.openingAmbience('dark');}},readAlert(){action('read_alert');},openComputer(page:ComputerPage='tasks'){return computer(page);},arriveB4(){if(story.stage==='to_b4'){transition('reach_b4');handOff();}},catchNow(){catchPlayer();},recover(){recoverFromCatch(true);},setHearts(n:number){runtime={...runtime,hearts:Math.max(0,Math.min(OPENING_MAX_HEARTS,Math.round(n)))};},state(){return{story:structuredClone(story),runtime:structuredClone(runtime),worldThreat:cloneWorldThreat(worldThreat),modal,staffTalkStarted,staffTalkDone,staffTalkLine,staffVoiceStarted,acceptVoicePlayed,repeatVoiceBusy};},worldThreat(){return cloneWorldThreat(worldThreat);},sealWorld(){return beginIncident();},markLionDefeated(){worldThreat=markLionDefeated();return cloneWorldThreat(worldThreat);},markPowerCut(){worldThreat=markPowerCut();return cloneWorldThreat(worldThreat);},markLocalModelCleared(){worldThreat=markLocalModelCleared();return cloneWorldThreat(worldThreat);},purgeWorld(){const result=tryPurgeWorld();worldThreat=result.threat;if(result.purged){runtime={...runtime,curtain_deployed:false};atmo()?.release();audio.openingAmbience('day');}return result.purged;},resetWorld(){worldThreat=resetWorldThreat();runtime={...runtime,curtain_deployed:false};atmo()?.reset();return cloneWorldThreat(worldThreat);},tickAtmosphere(seconds:number){const sealed=worldThreat.phase==='sealed';for(let i=0;i<Math.max(0,Math.round(seconds*60));i++)atmo()?.update(1/60,{incident:sealed,curtain:sealed,paused:false});}},get settings(){return settings;},get saveStatus(){return{message:saveMessage,storageOkay,ownsSave};},get story(){return story;},get runtime(){return runtime;},dispose(){persist(true);disposed=true;events.abort();explorer.interactions.delete(humanInteract);explorer.computers.delete(humanComputer);g.scenario=null;fleet.dispose();npcs.dispose();crowd.dispose();flipWall.dispose();ui.dispose();voice.dispose();audio.dispose();}};
}
