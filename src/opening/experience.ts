import * as T from 'three';
import type {createExplorer} from '../exploration/controller';
import {createStaffVoice,STAFF_INTRO_TIMING} from './voice';
import {CampusAudio} from '../gameplay/audio';
import {DEFAULT_SETTINGS,type Settings} from '../gameplay/save';
import type {Outcome} from '../gameplay/survey';
import type {OpeningModal,OpeningSave,OpeningState,OpeningEvent,OpeningView,OpeningCinema} from './contracts';
import {createOpeningState,reduceOpening} from './state';
import {OPENING_SAVE_KEY,captureOpeningSave,parseOpeningSave} from './persistence';
import {checkpointState,checkpointPose,openingCheckpoint,CHECKPOINT_LABELS,type OpeningCheckpoint} from './checkpoint';
import {createOpeningRuntime,damageOpeningHearts,healOpeningHearts,syncRuntimeWithStory,OPENING_RESPAWN_GRACE_SECONDS,OPENING_MAX_HEARTS,type OpeningRuntime} from './runtime';
import {OPENING as O,OPENING_WORLD_REVISION} from './spatialLayout';
import {setBusDoor} from './navigation';
import {createOpeningFleet} from './robots';
import {createOpeningNPCs} from './npcs';
import {createOpeningUI} from './ui';
import {drawOpeningMap} from './map';
import type {createOpeningWorld} from './world';
import type {OpeningAtmosphere} from './atmosphere';
import {STAFF_DIALOGUE} from '../../content/voice/staff-dialogue';

type ComputerPage='map'|'tasks'|'agent';

const objectives:Record<OpeningState['stage'],[string,string]>={
 bus:['Read your invitation','A High Table Dinner invitation is waiting on the shuttle seat beside you.'],
 to_b5:['Attend High Table Dinner','Building 5 · Ground floor. Turn right after entering.'],
 to_b6:['Collect the presentation MacBook','Building 6 · Pick up the laptop from the office table.'],
 return_b5:['Return the MacBook','Bring the presentation laptop back to the coordinator in Building 5.'],
 incident:['Open the MacBook','The dining hall is empty. Press C to open the local agent.'],
 to_b4:['Reach emergency control','Go to the main entrance of Building 4. Avoid the security robots.'],
 complete:['Building 4 reached','Opening complete. Keep the MacBook for the next section.'],
};

const WAKE_SECONDS=4.4;
const INTRO_VERSION='cod-intro-v3';
const INTRO_KEY='hku.opening.introVersion';
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
){
 const g=explorer.game,stage=document.querySelector<HTMLElement>('.stage')!;
 let story=createOpeningState(),runtime=createOpeningRuntime(),settings:Settings={...DEFAULT_SETTINGS,music:.2},modal:OpeningModal=null,computerPage:ComputerPage='tasks';
 let busClock=0,busReady=false,saveMessage='Progress saves on this device.',protectedSave=false,ownsSave=false,storageOkay=true,lastSave=0,stamp='',disposed=false,failed=false,scanClock=0,wasPaused=true;
 let incidentClock=0,disturbancePlayed=false,incidentQueued=false,autoInvitationShown=false,heartbeatClock=0,chaseCueClock=0,respawnGrace=0,compatBeforePanel=false;
 let wakeStarted=false,wakeClock=0,wakeDone=false,subtitleText='',subtitleSeconds=0,titleText='',titleSubtitle='',titleSeconds=0,introPromptClock=0,introAutoOpened=false,introCompleted=false;
 let staffTalkStarted=false,staffTalkDone=false,staffTalkClock=0,staffTalkLine=0,staffVoiceStarted=false,acceptVoicePlayed=false,acceptVoiceBusy=false,repeatVoiceBusy=false;
 let fleet=createOpeningFleet(explorer.world);scene.add(fleet.root);
 const npcs=createOpeningNPCs();scene.add(npcs.root);const audio=new CampusAudio(settings);audio.enableStory();const voice=createStaffVoice(audio);
 const notifyBase=notify;notify=(message)=>{audio.story?.ui('notify');notifyBase(message);};
 const writerToken=crypto.randomUUID(),writerKey=OPENING_SAVE_KEY+'.writer',events=new AbortController();
 let robotState='patrol',robotWarning=0;
 const atmo=()=>getAtmosphere?.();
 function showSubtitle(text:string,seconds:number){subtitleText=text;subtitleSeconds=seconds;}
 function showTitle(title:string,subtitle:string,seconds:number){titleText=title;titleSubtitle=subtitle;titleSeconds=seconds;}
 function startWake(){wakeStarted=true;wakeDone=false;wakeClock=0;g.pitch=.52;g.yaw=2.24;audio.openingCue('wake');}

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
 function pose(position:readonly number[],yaw=0){g.body.position.fromArray([...position]);g.body.velocity.set(0,0,0);g.body.grounded=true;g.yaw=yaw;g.pitch=0;}
 function safePose(){
  if(story.stage==='bus')pose(O.checkpoints.bus,O.spawnYaw);
  else if(story.stage==='to_b5')pose(O.busExit,0);
  else if(story.stage==='to_b6')pose(O.checkpoints.b5,Math.PI);
  else if(story.stage==='return_b5')pose(O.checkpoints.b6,0);
  else if(story.stage==='complete')pose(O.handoff,0);
  else pose(O.checkpoints.b5safe,0);
 }
 function validPose(s:OpeningSave){const [x,y,z]=s.position,w=explorer.world,h=w.support(x,z,y+.24);return s.worldRevision===OPENING_WORLD_REVISION&&h!==null&&Math.abs(h-y)<.3&&!w.blocked(x,z,h+.003)&&[[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([dx,dz])=>{const n=w.support(x+dx,z+dz,h);return n!==null&&Math.abs(n-h)<.3;});}
 function restore(s:OpeningSave){
  explorer.pause('opening_load');story=structuredClone(s.story);runtime=syncRuntimeWithStory(s.runtime??createOpeningRuntime(),story);settings={...s.settings};
  g.inventory.slots.splice(0,36,...s.slots.map(i=>i?{...i}:null));g.inventory.selectedHotbar=s.selectedHotbar;g.inventory.revision++;g.view=s.view;modal=null;g.closePanel();failed=runtime.hearts<=0;respawnGrace=OPENING_RESPAWN_GRACE_SECONDS;wakeStarted=story.stage!=='bus'||story.invitation_read;wakeDone=wakeStarted;introPromptClock=0;introAutoOpened=false;staffTalkStarted=false;staffTalkDone=false;staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;acceptVoicePlayed=false;acceptVoiceBusy=false;repeatVoiceBusy=false;npcs.reset();fleet.reset();
  if(validPose(s)&&story.stage!=='incident'&&story.stage!=='to_b4')pose(s.position,s.yaw);else safePose();
  g.pitch=s.pitch;busClock=8;busReady=story.invitation_read;setBusDoor(explorer.world,story.stage==='bus'&&!busReady);applySettings();
  if(failed)open('caught');
  else if(story.stage==='complete')open('complete');
  incidentQueued=story.stage==='return_b5';
  if(runtime.curtain_deployed){atmo()?.startIncident();audio.openingAmbience('dark');}
 }
 function persist(force=false){if(disposed||protectedSave||!ownsSave||!force&&performance.now()-lastSave<5000)return;try{if(localStorage.getItem(writerKey)!==writerToken){ownsSave=false;return;}const safe=story.stage==='incident'||story.stage==='to_b4'?([...O.encounterSafe] as [number,number,number]):undefined;localStorage.setItem(OPENING_SAVE_KEY,JSON.stringify(captureOpeningSave(g,story,settings,safe,runtime)));lastSave=performance.now();storageOkay=true;saveMessage='Saved on this device.';}catch{storageOkay=false;saveMessage='Storage unavailable. Progress remains in this session.';}}
 function claimSave(){if(protectedSave)return;try{if(localStorage.getItem(writerKey)!==writerToken){const latestRaw=localStorage.getItem(OPENING_SAVE_KEY);if(latestRaw){let saved:OpeningSave|null=null;try{saved=parseOpeningSave(JSON.parse(latestRaw));}catch{}if(!saved){protectedSave=true;saveMessage='Unrecognized save protected. Start a new opening to back it up.';return;}if(lastSave>0||saved.savedAt>loadedAt){restore(saved);saveMessage='Latest checkpoint continued from another window.';}}localStorage.setItem(writerKey,writerToken);}ownsSave=true;}catch{ownsSave=true;storageOkay=false;}}
 function transition(event:OpeningEvent){const next=reduceOpening(story,event);if(next===story)return false;story=next;persist(true);return true;}
 function open(next:OpeningModal){if(failed&&next!=='caught')return;voice.stop();compatBeforePanel=explorer.state.compat;modal=next;explorer.openPanel(next==='settings'?'settings':'computer',next==='computer');audio.setActive(false);audio.stopOpeningCues();audio.stopPreviews();if(next==='computer')audio.story?.cue('macbook_open',undefined,true);else if(next==='staff'&&story.stage==='to_b5')startStaffIntro(true);}
 function close(){if(modal==='caught')return;const was=modal;voice.stop();audio.stopPreviews();if(modal==='invitation')audio.story?.cue('invitation_close',undefined,true);else if(modal==='computer')audio.story?.cue('macbook_close',undefined,true);modal=null;explorer.closePanel();persist(true);
  // A story panel should hand control straight back to the player. The same click
  // that closed it is still a user gesture, so pointer lock can be requested here.
  if(was!=='complete'){if(compatBeforePanel)explorer.enterCompat();else explorer.enter();}
  compatBeforePanel=false;
 }
 function outcome(ok:boolean,code:string,message:string):Outcome{return{ok,code,message};}
 function target(){
  if(story.stage==='bus')return story.invitation_read?null:{id:'opening-invitation',position:O.invitation,label:'Pick up your dinner invitation'};
  const staffRoot=npcs.staffRootPosition();
  const nearStaff=story.stage==='to_b6'&&staffTalkDone&&!acceptVoiceBusy&&!story.laptop_acquired&&g.body.position.distanceTo(staffRoot)<3.2;
  const repeat=nearStaff?{id:'opening-staff-repeat',position:[staffRoot.x,staffRoot.y,staffRoot.z] as [number,number,number],label:'Ask the coordinator about the laptop'}:null;
  const item=story.stage==='to_b5'?{id:'opening-staff',position:O.staff,label:'Speak to the coordinator'}:repeat??(story.stage==='to_b6'?{id:'opening-laptop',position:O.laptop,label:'Pick up MacBook Air'}:null);
  if(!item)return null;
  const origin=g.body.position.clone().add(new T.Vector3(0,1.64,0)),point=new T.Vector3(...item.position).add(new T.Vector3(0,item.id.startsWith('opening-staff')?1.3:.1,0)),offset=point.clone().sub(origin),distance=offset.length();
  if(distance>2.7)return null;
  const facing=new T.Vector3(-Math.sin(g.yaw)*Math.cos(g.pitch),-Math.sin(g.pitch),-Math.cos(g.yaw)*Math.cos(g.pitch));
  if(distance>.02&&facing.dot(offset.clone().normalize())<.80)return null;
  const ray=new T.Raycaster(origin,offset.normalize(),.03,Math.max(.03,distance-.15));if(ray.intersectObjects(explorer.world.meshes,false).length)return null;return item;
 }
 function interact(id?:string):Outcome{
  if(g.paused||g.panel||g.inventoryOpen)return outcome(false,'paused','Continue exploring first.');
  if(story.stage==='bus'&&!story.invitation_read&&wakeDone){introAutoOpened=true;open('invitation');return outcome(true,'invitation_opened','High Table Dinner invitation.');}
  const t=target();if(!t||id&&id!==t.id)return outcome(false,'no_target','Move closer and face the interaction.');
  if(t.id==='opening-invitation'){open('invitation');return outcome(true,'invitation_opened','High Table Dinner invitation.');}
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
  if(story.stage==='bus'){open('invitation');return outcome(true,'invitation_opened','Dinner invitation.');}
  if(!story.laptop_acquired)return outcome(false,'laptop_required','Collect the presentation MacBook from Building 6 first.');
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
  wakeStarted=true;wakeDone=true;wakeClock=WAKE_SECONDS;busClock=8;busReady=true;
  introCompleted=true;introPromptClock=0;introAutoOpened=false;
  staffTalkStarted=false;staffTalkDone=story.stage!=='to_b5';staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;acceptVoicePlayed=false;acceptVoiceBusy=false;
  incidentQueued=false;incidentClock=0;disturbancePlayed=false;
  npcs.reset();fleet.reset();
  const at=checkpointPose(id);pose(at.position,at.yaw);
  setBusDoor(explorer.world,false);
  saveMessage='Checkpoint: '+CHECKPOINT_LABELS[id]+'.';
  if(runtime.curtain_deployed){atmo()?.startIncident();audio.openingAmbience('dark');}
 }
 function restart(){
  try{const raw=localStorage.getItem(OPENING_SAVE_KEY);if(raw)localStorage.setItem(OPENING_SAVE_KEY+'.backup.'+Date.now(),raw);localStorage.removeItem(INTRO_KEY);localStorage.setItem(writerKey,writerToken);protectedSave=false;ownsSave=true;}catch{notify('Could not back up the save. Restart cancelled.');return;}
  audio.story?.reset();audio.stopPreviews();
  story=createOpeningState();runtime=createOpeningRuntime();g.inventory.slots.fill(null);g.inventory.selectedHotbar=0;g.inventory.revision++;g.records.clear();g.last=null;failed=false;busClock=0;busReady=false;incidentClock=0;disturbancePlayed=false;incidentQueued=false;autoInvitationShown=false;respawnGrace=0;wakeStarted=false;wakeDone=false;wakeClock=0;subtitleSeconds=0;titleSeconds=0;introPromptClock=0;introAutoOpened=false;introCompleted=false;staffTalkStarted=false;staffTalkDone=false;staffTalkClock=0;staffTalkLine=0;staffVoiceStarted=false;acceptVoicePlayed=false;acceptVoiceBusy=false;repeatVoiceBusy=false;npcs.reset();fleet.reset();modal=null;explorer.closePanel();safePose();setBusDoor(explorer.world,true);atmo()?.reset();audio.openingAmbience('day');audio.stopOpeningCues();persist(true);
 }
 function beginIncident(announce=true){
  if(runtime.curtain_deployed)return;
  runtime={...runtime,curtain_deployed:true};
  atmo()?.startIncident();
  audio.openingCue('curtain');
  audio.openingAmbience('dark');
  if(announce)notify('The campus perimeter seals. The sky goes dark.');
  persist(true);
 }
 function action(action:string){
  if(failed&&!'retry recover restart'.split(' ').includes(action))return;
  if(action==='read_invitation'){transition('read_invitation');close();}
  else if(action==='accept_errand'&&story.stage==='to_b5'){runtime={...runtime,staff_task_received:true};if(transition('accept_errand')){close();playAcceptanceVoices();notify(`You: ${STAFF_DIALOGUE.playerAccept}`);}}
  else if(action==='read_alert'){transition('read_alert');runtime={...runtime,agent_chat_unlocked:true,go_to_building4_objective_unlocked:true};modal='computer';computerPage='agent';audio.openingCue('unlock');persist(true);}
  else if(action==='retry')recoverFromCatch(false);
  else if(action==='recover')recoverFromCatch(true);
  else if(action==='restart')restart();
  else if(action==='save'){claimSave();persist(true);}
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
 const ui=createOpeningUI(stage,{action,close,setting(key,value){if(key==='muted'||key==='bob')settings[key]=Boolean(value);else settings[key]=Number(value);applySettings();persist(true);},drawMap:(canvas,large)=>drawOpeningMap(canvas,g,story,large),sound:(kind)=>audio.story?.ui(kind)},{
  instanceId:()=>g.inventory.slots.find(slot=>slot?.itemId==='macbook-air-13-silver')?.instanceId,
  units:()=>fleet.units.map((unit,index)=>({
    id:String(unit.root.userData.fleetId),name:'Campus guard '+(index+1),
    status:story.campus_alert_triggered?'Compromised · '+unit.state:'Standby',
  })),
 });

 function tick(dt:number){
  story.elapsedSeconds+=dt;
  if(modal!=='caught'&&failed)failed=false;
  if(story.stage==='bus'){
   busClock+=dt;
   const ready=story.invitation_read&&busClock>=4;
   if(ready!==busReady){busReady=ready;setBusDoor(explorer.world,!ready);audio.openingCue('door');if(ready)showSubtitle('DRIVER — Building 4. Mind the step when you leave.',3.4);}
   const z0=O.bus.z-O.bus.width/2;
   if(busReady&&g.body.position.z<z0-0.12&&Math.abs(g.body.position.x-O.bus.doorX)<1.6&&transition('exit_bus'))showTitle('BUILDING 4 FORECOURT','18:12 · HEAD TO BUILDING 5',2.8);
  }
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
   transition('return_b5');runtime={...runtime,curtain_deployed:true};atmo()?.startIncident();audio.openingAmbience('dark');
   notify('The dinner hall is empty. Chairs are overturned. Open the MacBook with C.');
  }
  const alert=story.campus_alert_triggered||runtime.curtain_deployed;
  const active=alert&&story.stage!=='complete';
  if(active){
   if(respawnGrace>0)respawnGrace=Math.max(0,respawnGrace-dt);
   const result=fleet.update(dt,g.body.position,true,respawnGrace>0);
   if(result.chasing&&!runtime.robot_chase_started)runtime={...runtime,robot_chase_started:true};
   if(result.caught&&!failed&&respawnGrace<=0)catchPlayer();
   if(runtime.hearts>0&&runtime.hearts<=4){heartbeatClock+=dt;if(heartbeatClock>1.15){heartbeatClock=0;audio.openingCue('heartbeat');}}
  }
  if(!failed&&story.stage==='to_b4'&&g.body.position.distanceTo(new T.Vector3(...O.handoff))<2.2){
   transition('reach_b4');open('complete');runtime={...runtime,go_to_building4_objective_unlocked:true,agent_chat_unlocked:true};
   audio.story?.ending();
   window.dispatchEvent(new CustomEvent('campus-opening-handoff',{detail:{event:'opening.building4_reached',flags:{invitation_read:story.invitation_read,laptop_acquired:story.laptop_acquired,campus_alert_triggered:story.campus_alert_triggered},laptopInstanceId:g.inventory.slots.find(s=>s?.itemId==='macbook-air-13-silver')?.instanceId,anchor:'opening-building4-entrance'}}));
   persist(true);
  }
 }
 g.scenario={interact,computer,tick,snapshot:()=>({story:structuredClone(story),runtime:structuredClone(runtime),modal,busReady,respawnGraceSeconds:respawnGrace,robotState,warning:robotWarning,goal:objectiveFor(),handoff:story.stage==='complete'?'opening.building4_reached':null,target:target()?.id??null}),spawn:()=>{safePose();fleet.reset();}};
 let loadedAt=0;let raw:string|null=null;
 try{raw=localStorage.getItem(OPENING_SAVE_KEY);const saved=raw?parseOpeningSave(JSON.parse(raw)):null;if(saved){restore(saved);loadedAt=saved.savedAt;saveMessage='Opening checkpoint restored.';}else{g.inventory.slots.fill(null);g.inventory.revision++;safePose();if(raw){protectedSave=true;saveMessage='Unrecognized save protected. Restart to back it up.';}}}catch{g.inventory.slots.fill(null);g.inventory.revision++;safePose();protectedSave=!!raw;storageOkay=false;saveMessage='Save unavailable. A new session is ready.';}
 // One-time replay guard for the new COD-style intro. A legacy bus save may already
 // have invitation_read=true and would otherwise skip the whole letter sequence.
 try{
  if(story.stage==='bus'&&localStorage.getItem(INTRO_KEY)!==INTRO_VERSION){
   story=createOpeningState();runtime=createOpeningRuntime();
   g.inventory.slots.fill(null);g.inventory.selectedHotbar=0;g.inventory.revision++;
   busClock=0;busReady=false;wakeStarted=false;wakeDone=false;wakeClock=0;introPromptClock=0;introAutoOpened=false;introCompleted=false;
   safePose();setBusDoor(explorer.world,true);
   saveMessage='New cinematic intro. Read the invitation to continue.';
  }
 }catch{}
 const requestedCheckpoint=openingCheckpoint(new URLSearchParams(location.search).get('checkpoint'));
 if(requestedCheckpoint)startAtCheckpoint(requestedCheckpoint);
 applySettings();setBusDoor(explorer.world,story.stage==='bus'&&!busReady);if(runtime.curtain_deployed){atmo()?.startIncident();audio.openingAmbience('dark');}
 const humanInteract=()=>{const r=g.interact();if(!r.ok)notify(r.message);},humanComputer=()=>{const r=g.computer('tasks');if(!r.ok)notify(r.message);};explorer.interactions.add(humanInteract);explorer.computers.add(humanComputer);
 document.addEventListener('pointerdown',e=>{if(e.isTrusted)claimSave();},{capture:true,signal:events.signal});document.addEventListener('keydown',e=>{if(e.isTrusted)claimSave();},{capture:true,signal:events.signal});
 window.addEventListener('storage',e=>{if(e.key===writerKey&&e.newValue!==writerToken&&ownsSave){ownsSave=false;explorer.pause('save_owner_changed');saveMessage='Another window owns this save. Click to continue here.';}},{signal:events.signal});
 window.addEventListener('blur',()=>voice.stop(),{signal:events.signal});
 window.addEventListener('pagehide',()=>persist(true),{signal:events.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist(true);voice.stop();audio.stopOpeningCues();}},{signal:events.signal});
 for(const id of ['enter-game','enter-compat','enable-ai'])document.getElementById(id)?.addEventListener('click',()=>{void audio.start().then(()=>{if(story.stage==='bus')audio.openingCue('bus');if(runtime.curtain_deployed)audio.openingAmbience('dark');});},{signal:events.signal});
 document.getElementById('experience-settings')?.addEventListener('click',()=>open('settings'),{signal:events.signal});document.getElementById('new-game')?.addEventListener('click',()=>open('settings'),{signal:events.signal});
 function objectiveFor(){
  if(story.stage==='bus')return story.invitation_read?'Leave the shuttle':'Read your invitation';
  if(story.stage==='return_b5'&&runtime.curtain_deployed)return 'Get back to Building 5';
  if(story.stage==='incident')return 'Open the MacBook';
  return objectives[story.stage][0];
 }
 function detailFor(){
  if(story.stage==='bus')return story.invitation_read?'The passenger door is open. Step down onto the Building 4 forecourt.':'The invitation is waiting on the seat beside you. Read it before leaving the shuttle.';
  if(story.stage==='return_b5'&&runtime.curtain_deployed)return 'The campus is sealed and robots are active. Reach Building 5, then open the MacBook with C.';
  if(story.stage==='incident')return 'The dining hall is empty. Press C to open the local agent.';
  return objectives[story.stage][1];
 }
 function update(dt:number){
  if(disposed)return;
  if(!wakeStarted&&!wakeDone&&story.stage==='bus'&&!story.invitation_read&&!g.paused&&!modal&&!g.inventoryOpen&&explorer.enabled)startWake();
  if(wakeStarted&&!wakeDone&&!g.paused){
   wakeClock+=dt;
   g.pitch=T.MathUtils.damp(g.pitch,.12,1.7,dt);
   g.human={forward:0,right:0,sprint:false};g.humanJump=false;
   if(wakeClock>=WAKE_SECONDS)wakeDone=true;
  }
  // Stay seated and keep the cinematic HUD-free frame until the invitation is read.
  if(!g.paused&&((wakeStarted&&!wakeDone)||(story.stage==='bus'&&!story.invitation_read&&wakeDone))){
   g.human={forward:0,right:0,sprint:false};g.humanJump=false;
  }
  // If the player does not press F, the intro hands them the letter itself after
  // a short beat. The letter is not a separate 'gameplay modal' in this phase.
  if(!g.paused&&wakeDone&&story.stage==='bus'&&!story.invitation_read&&!modal&&!introAutoOpened){
   introPromptClock+=dt;
   if(introPromptClock>3.2){introAutoOpened=true;open('invitation');}
  }
  if(!g.paused){if(titleSeconds>0)titleSeconds=Math.max(0,titleSeconds-dt);if(subtitleSeconds>0)subtitleSeconds=Math.max(0,subtitleSeconds-dt);}
  if(story.stage==='bus'&&story.invitation_read&&!introCompleted){introCompleted=true;try{localStorage.setItem(INTRO_KEY,INTRO_VERSION);}catch{}}

  const active=explorer.enabled;
  const alert=story.campus_alert_triggered||runtime.curtain_deployed;
  fleet.root.visible=active&&story.stage!=='complete';
  npcs.root.visible=active&&!alert;npcs.update(dt,alert,g.paused,g.body.position);if(!active)npcs.root.visible=false;
  // Fixed-step actor simulation happens in tick(); this read never advances it.
  const r=alert?fleet.update(0,g.body.position,active&&story.stage!=='complete',true):fleet.standby(active&&story.stage!=='complete');robotState=r.state;robotWarning=r.warning;
  getWorld()?.update({incident:alert,laptopAcquired:story.laptop_acquired,doorOpen:busReady,invitationRead:story.invitation_read},g.paused?0:dt);
  atmo()?.update(dt,{incident:alert,curtain:runtime.curtain_deployed,paused:g.paused});
  if(g.paused&&!wasPaused&&modal!=='staff')audio.stopOpeningCues();wasPaused=g.paused;
  const surface=explorer.world.surface(g.body.position.x,g.body.position.z,g.body.position.y);
  audio.update(explorer.student.gait,g.paused||!active,surface,g.body.position,explorer.camera.position,g.yaw);
  audio.story?.update({stage:story.stage,dark:alert,chasing:r.chasing,player:g.body.position,dt,
   robots:active&&alert&&story.stage!=='complete'?fleet.units.map((unit,index)=>({id:'opening-robot-'+index,state:unit.state,position:unit.position})):[]});
  const item=target();
  const goal=story.stage==='bus'?(story.invitation_read?O.busExit:O.invitation):story.stage==='to_b6'?O.laptop:story.stage==='return_b5'?O.returnPoint:story.stage==='to_b4'||story.stage==='complete'?O.handoff:O.staff;
  const prompt=active&&!g.paused&&!(wakeStarted&&!wakeDone)?(item?'F · '+item.label:story.laptop_acquired&&story.stage!=='complete'?'C · Open the MacBook':''):'';
  const sound=audio.diagnostics;
  let cinema:OpeningCinema;
  if(titleSeconds>0){
   cinema={mode:'title',title:titleText,subtitle:titleSubtitle,hint:'',opacity:0,letterbox:true};
  }else if(wakeStarted&&!wakeDone){
   const early=wakeClock<2.1;
   cinema={mode:'wake',title:early?'屏 障':'BUILDING 4 FORECOURT',subtitle:early?'BARRIER 2030 · STUDENT AMBASSADOR':'18:12 · HIGH TABLE DINNER',hint:early?'Sit up and look around':'' ,opacity:wakeClock<1.55?Math.max(.08,1-wakeClock/1.55*.92):.08,letterbox:true};
  }else if(story.stage==='bus'&&!story.invitation_read&&wakeDone){
   cinema={mode:'subtitle',title:'',subtitle:modal==='invitation'?'':'An invitation is on the seat beside you.  Press F to pick it up.',hint:'',opacity:0,letterbox:true};
  }else if(staffTalkStarted&&!staffTalkDone){
   cinema={mode:'subtitle',title:'',subtitle:STAFF_LINES[Math.min(STAFF_LINES.length-1,staffTalkLine)],hint:'',opacity:0,letterbox:true};
  }else if(subtitleSeconds>0){
   cinema={mode:'subtitle',title:'',subtitle:subtitleText,hint:'',opacity:0,letterbox:true};
  }else{
   cinema={mode:'off',title:'',subtitle:'',hint:'',opacity:0,letterbox:false};
  }
  const view:OpeningView={story,runtime,modal:active?modal:null,objective:objectiveFor(),detail:detailFor(),prompt,saveStatus:saveMessage,busReady,computerPage,robotState,robotWarning,settings,audioStatus:sound.failed?`${sound.failedFiles.length} sounds unavailable. Retry audio to load them again.`:sound.loading.length?'Loading audio…':sound.state==='uninitialized'?'Use a preview or start the opening to enable audio.':sound.resumeError||'Audio ready.',handoffEvent:'opening.building4_reached',player:g.body.position.toArray() as [number,number,number],yaw:g.yaw,target:[...goal] as [number,number,number],voiceLine:staffTalkLine,cinema};
  ui.update(view);
  const next=[story.stage,story.events.length,story.invitation_read,g.inventory.revision,g.view,runtime.curtain_deployed,runtime.robot_chase_started,runtime.agent_chat_unlocked,runtime.hearts].join(':');
  if(stamp!==next){stamp=next;persist(true);}else if(!g.paused)persist();
  const enter=document.getElementById('enter-game');if(enter)enter.textContent=story.elapsedSeconds>0?'Continue':'Start opening';
  const status=document.getElementById('session-save');if(status)status.textContent=saveMessage;
 }
 return{update,relocate(){fleet.dispose();fleet=createOpeningFleet(explorer.world);scene.add(fleet.root);setBusDoor(explorer.world,story.stage==='bus'&&!busReady);safePose();},openComputer(page:ComputerPage='tasks'){const r=computer(page);if(!r.ok)notify(r.message);},openSettings(){open('settings');},persist,audio,debug:{openInvitation(){open('invitation');},readInvitation(){if(story.stage==='bus'){transition('read_invitation');if(modal==='invitation')close();}},openStaff(){open('staff');},acceptErrand(){if(story.stage==='to_b5'){runtime={...runtime,staff_task_received:true};if(transition('accept_errand')){if(modal==='staff')close();playAcceptanceVoices();}}},takeLaptop(){return collectLaptop();},setBusReady(){busClock=8;busReady=true;setBusDoor(explorer.world,false);},exitBus(){if(story.stage==='bus'){busClock=8;busReady=true;setBusDoor(explorer.world,false);transition('exit_bus');}},triggerIncident(){beginIncident();},reachB5(){if(story.stage==='return_b5'){transition('return_b5');runtime={...runtime,curtain_deployed:true};atmo()?.startIncident();audio.openingAmbience('dark');}},readAlert(){action('read_alert');},openComputer(page:ComputerPage='tasks'){return computer(page);},arriveB4(){if(story.stage==='to_b4'){transition('reach_b4');open('complete');}},catchNow(){catchPlayer();},recover(){recoverFromCatch(true);},setHearts(n:number){runtime={...runtime,hearts:Math.max(0,Math.min(OPENING_MAX_HEARTS,Math.round(n)))};},state(){return{story:structuredClone(story),runtime:structuredClone(runtime),modal,staffTalkStarted,staffTalkDone,staffTalkLine,staffVoiceStarted,acceptVoicePlayed,repeatVoiceBusy};}},get settings(){return settings;},get saveStatus(){return{message:saveMessage,storageOkay,ownsSave};},get story(){return story;},get runtime(){return runtime;},dispose(){persist(true);disposed=true;events.abort();explorer.interactions.delete(humanInteract);explorer.computers.delete(humanComputer);g.scenario=null;fleet.dispose();npcs.dispose();ui.dispose();voice.dispose();audio.dispose();}};
}
