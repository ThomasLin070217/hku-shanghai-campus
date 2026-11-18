import * as T from 'three';
import type {createExplorer} from '../exploration/controller';
import {CampusAudio} from '../gameplay/audio';
import {DEFAULT_SETTINGS,type Settings} from '../gameplay/save';
import type {Outcome,ComputerPage} from '../gameplay/survey';
import type {OpeningModal,OpeningSave,OpeningState,OpeningEvent,OpeningView} from './contracts';
import {createOpeningState,reduceOpening} from './state';
import {OPENING_SAVE_KEY,captureOpeningSave,parseOpeningSave} from './persistence';
import {OPENING as O,OPENING_WORLD_REVISION} from './spatialLayout';
import {setBusDoor} from './navigation';
import {createOpeningRobot} from './robot';
import {createOpeningNPCs} from './npcs';
import {createOpeningUI} from './ui';
import {drawOpeningMap} from './map';
import type {createOpeningWorld} from './world';
const objectives:Record<OpeningState['stage'],[string,string]>={
 bus:['Your invitation awaits','Read your High Table Dinner invitation, then leave the shuttle.'],
 to_b5:['Attend High Table Dinner','Building 5 · Ground floor. Turn right after entering.'],
 to_b6:['Collect the presentation MacBook','Building 6 · Pick up the laptop from the office table.'],
 return_b5:['Return the MacBook','Bring the presentation laptop back to the coordinator in Building 5.'],
 incident:['Something is wrong','Stay out of the robot’s scan. Press C to inspect the MacBook.'],
 to_b4:['Reach emergency control','Go to the main entrance of Building 4. Avoid the security robot.'],
 complete:['Building 4 reached','Opening complete. Keep the MacBook for the next section.'],
};
export function createOpeningExperience(scene:T.Scene,explorer:ReturnType<typeof createExplorer>,notify:(message:string)=>void,getWorld:()=>ReturnType<typeof createOpeningWorld>|undefined){
 const g=explorer.game,stage=document.querySelector<HTMLElement>('.stage')!;
 let story=createOpeningState(),settings:Settings={...DEFAULT_SETTINGS},modal:OpeningModal=null,computerPage:'map'|'tasks'='tasks',busClock=0,busReady=false,saveMessage='Progress saves on this device.',protectedSave=false,ownsSave=false,storageOkay=true,lastSave=0,stamp='',disposed=false,failed=false,scanClock=0,wasPaused=true;
 let robot=createOpeningRobot(explorer.world);scene.add(robot.root);const npcs=createOpeningNPCs();scene.add(npcs.root);const audio=new CampusAudio(settings);
 const writerToken=crypto.randomUUID(),writerKey=OPENING_SAVE_KEY+'.writer',events=new AbortController();
 function applySettings(){explorer.setSensitivity(settings.sensitivity);explorer.setComfort(settings.fov,settings.bob);audio.apply(settings);}
 function pose(position:readonly number[],yaw=0){g.body.position.fromArray([...position]);g.body.velocity.set(0,0,0);g.body.grounded=true;g.yaw=yaw;g.pitch=0;}
 function safePose(){if(story.stage==='bus')pose(O.spawn,O.spawnYaw);else if(story.stage==='to_b5')pose(O.busExit,Math.PI/2);else if(story.stage==='to_b6')pose([58,0,-58],Math.PI/2);else if(story.stage==='return_b5')pose([4,5.1,-56],Math.PI);else if(story.stage==='complete')pose(O.handoff,0);else pose(O.encounterSafe,0);}
 function validPose(s:OpeningSave){const [x,y,z]=s.position,w=explorer.world,h=w.support(x,z,y+.24);return s.worldRevision===OPENING_WORLD_REVISION&&h!==null&&Math.abs(h-y)<.3&&!w.blocked(x,z,h+.003)&&[[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([dx,dz])=>{const n=w.support(x+dx,z+dz,h);return n!==null&&Math.abs(n-h)<.3;});}
 function restore(s:OpeningSave){explorer.pause('opening_load');story=structuredClone(s.story);settings={...s.settings};g.inventory.slots.splice(0,36,...s.slots.map(i=>i?{...i}:null));g.inventory.selectedHotbar=s.selectedHotbar;g.inventory.revision++;g.view=s.view;modal=null;g.closePanel();failed=false;robot.reset();if(validPose(s)&&story.stage!=='incident'&&story.stage!=='to_b4')pose(s.position,s.yaw);else safePose();g.pitch=s.pitch;busClock=8;busReady=story.invitation_read;setBusDoor(explorer.world,story.stage==='bus'&&!busReady);applySettings();}
 function persist(force=false){if(disposed||protectedSave||!ownsSave||!force&&performance.now()-lastSave<5000)return;try{if(localStorage.getItem(writerKey)!==writerToken){ownsSave=false;return;}const safe=story.stage==='incident'||story.stage==='to_b4'?([...O.encounterSafe] as [number,number,number]):undefined;localStorage.setItem(OPENING_SAVE_KEY,JSON.stringify(captureOpeningSave(g,story,settings,safe)));lastSave=performance.now();storageOkay=true;saveMessage='Saved on this device.';}catch{storageOkay=false;saveMessage='Storage unavailable. Progress remains in this session.';}}
 function claimSave(){if(protectedSave)return;try{if(localStorage.getItem(writerKey)!==writerToken){const latestRaw=localStorage.getItem(OPENING_SAVE_KEY);if(latestRaw){let saved:OpeningSave|null=null;try{saved=parseOpeningSave(JSON.parse(latestRaw));}catch{}if(!saved){protectedSave=true;saveMessage='Unrecognized save protected. Start a new opening to back it up.';return;}if(lastSave>0||saved.savedAt>loadedAt){restore(saved);saveMessage='Latest checkpoint continued from another window.';}}localStorage.setItem(writerKey,writerToken);}ownsSave=true;}catch{ownsSave=true;storageOkay=false;}}
 function transition(event:OpeningEvent){const next=reduceOpening(story,event);if(next===story)return false;story=next;persist(true);return true;}
 function open(next:OpeningModal){modal=next;explorer.openPanel(next==='settings'?'settings':'computer');audio.stopOpeningCues();}
 function close(){if(modal==='caught')return;modal=null;explorer.closePanel();persist(true);}
 function outcome(ok:boolean,code:string,message:string):Outcome{return{ok,code,message};}
 function target(){if(story.stage==='bus')return{id:'opening-invitation',position:O.spawn,label:story.invitation_read?'Read invitation again':'Read your dinner invitation'};
  const item=story.stage==='to_b5'?{id:'opening-staff',position:O.staff,label:'Speak to the coordinator'}:story.stage==='to_b6'?{id:'opening-laptop',position:O.laptop,label:'Pick up MacBook Air'}:null;if(!item)return null;
  const origin=g.body.position.clone().add(new T.Vector3(0,1.64,0)),point=new T.Vector3(...item.position).add(new T.Vector3(0,item.id==='opening-staff'?1.3:.1,0)),offset=point.clone().sub(origin),distance=offset.length();if(distance>2.7)return null;
  const facing=new T.Vector3(-Math.sin(g.yaw)*Math.cos(g.pitch),-Math.sin(g.pitch),-Math.cos(g.yaw)*Math.cos(g.pitch));if(distance>.02&&facing.dot(offset.clone().normalize())<.80)return null;
  const ray=new T.Raycaster(origin,offset.normalize(),.03,Math.max(.03,distance-.15));if(ray.intersectObjects(explorer.world.meshes,false).length)return null;return item;
 }
 function interact(id?:string):Outcome{if(g.paused||g.panel||g.inventoryOpen)return outcome(false,'paused','Continue exploring first.');const t=target();if(!t||id&&id!==t.id)return outcome(false,'no_target','Move closer and face the interaction.');
  if(t.id==='opening-invitation'){open('invitation');return outcome(true,'invitation_opened','High Table Dinner invitation.');}
  if(t.id==='opening-staff'){open('staff');return outcome(true,'dialogue_opened','Dinner coordinator.');}
  if(t.id==='opening-laptop'){
   if(story.laptop_acquired||g.inventory.slots.some(s=>s?.itemId==='macbook-air-13-silver'))return outcome(false,'already_acquired','The laptop is already in your backpack.');
   const free=g.inventory.slots.findIndex(s=>s===null);if(free<0)return outcome(false,'inventory_full','Make room in your backpack first.');
   g.inventory.slots[free]={itemId:'macbook-air-13-silver',instanceId:'opening-macbook-001',count:1};g.inventory.revision++;if(free<9)g.inventory.select(free);else{g.inventory.move(free,0);g.inventory.select(0);}transition('take_laptop');notify('MacBook Air collected · C to open · E for backpack');audio.play('collect');persist(true);return outcome(true,'laptop_acquired','MacBook Air collected.');
  }return outcome(false,'invalid_target','No interaction available.');
 }
 function computer(page:ComputerPage|'submit'='tasks'):Outcome{if(story.stage==='bus'){open('invitation');return outcome(true,'invitation_opened','Dinner invitation.');}if(!story.laptop_acquired)return outcome(false,'laptop_required','Collect the presentation MacBook from Building 6 first.');
  const slot=g.inventory.slots.findIndex(s=>s?.itemId==='macbook-air-13-silver');if(slot<0)return outcome(false,'laptop_missing','Required laptop is missing. Reload a valid checkpoint.');if(slot<9)g.inventory.select(slot);else g.inventory.move(slot,g.inventory.selectedHotbar);
  computerPage=page==='map'?'map':'tasks';open(story.campus_alert_triggered&&!story.alert_read?'alert':'computer');return outcome(true,'page_ready',story.campus_alert_triggered?'Emergency assistant ready.':'Presentation device ready.');
 }
 function retry(){if(modal!=='caught')return;failed=false;robot.reset();audio.stopOpeningCues();pose(O.encounterSafe,0);modal=null;explorer.closePanel();persist(true);notify('Checkpoint restored. Click Continue when ready.');}
 function restart(){try{const raw=localStorage.getItem(OPENING_SAVE_KEY);if(raw)localStorage.setItem(OPENING_SAVE_KEY+'.backup.'+Date.now(),raw);localStorage.setItem(writerKey,writerToken);protectedSave=false;ownsSave=true;}catch{notify('Could not back up the save. Restart cancelled.');return;}story=createOpeningState();g.inventory.slots.fill(null);g.inventory.selectedHotbar=0;g.inventory.revision++;g.records.clear();g.last=null;failed=false;busClock=0;busReady=false;robot.reset();modal=null;explorer.closePanel();safePose();setBusDoor(explorer.world,true);persist(true);}
 function action(action:string){if(action==='read_invitation'&&modal==='invitation'){transition('read_invitation');close();}else if(action==='accept_errand'&&modal==='staff'){transition('accept_errand');close();}else if(action==='read_alert'&&modal==='alert'){transition('read_alert');modal='computer';computerPage='tasks';persist(true);}else if(action==='retry')retry();else if(action==='restart')restart();else if(action==='save'){claimSave();persist(true);}else if(action==='safe'){explorer.pause('opening_safe_checkpoint');safePose();robot.reset();failed=false;modal=null;g.closePanel();persist(true);}else if(action==='settings')open('settings');else if(action==='map'||action==='computer'){const r=computer(action==='map'?'map':'tasks');if(!r.ok)notify(r.message);}}
 const ui=createOpeningUI(stage,{action,close,setting(key,value){if(key==='muted'||key==='bob')settings[key]=Boolean(value);else settings[key]=Number(value);applySettings();persist(true);},drawMap:(canvas,large)=>drawOpeningMap(canvas,g,story,large)});
 function tick(dt:number){story.elapsedSeconds+=dt;if(story.stage==='bus'){busClock+=dt;const ready=story.invitation_read&&busClock>=4;if(ready!==busReady){busReady=ready;setBusDoor(explorer.world,!ready);audio.openingCue('door');}if(busReady&&g.body.position.x<61.7&&Math.abs(g.body.position.z-O.bus.doorZ)<3)transition('exit_bus');}
  if(story.stage==='return_b5'&&g.body.position.distanceTo(new T.Vector3(...O.returnPoint))<3.3){transition('return_b5');robot.reset();audio.openingCue('disturbance');notify('The dinner hall is empty. Chairs are overturned. Open the MacBook with C.');}
  const active=story.campus_alert_triggered&&story.stage!=='complete';const r=robot.update(dt,g.body.position,active,false);if(active){scanClock+=dt;if(scanClock>2.5){scanClock=0;audio.openingCue('scan');}}if(r.caught&&!failed){failed=true;open('caught');}
  if(story.stage==='to_b4'&&g.body.position.distanceTo(new T.Vector3(...O.handoff))<2.2){transition('reach_b4');open('complete');window.dispatchEvent(new CustomEvent('campus-opening-handoff',{detail:{event:'opening.building4_reached',flags:{invitation_read:story.invitation_read,laptop_acquired:story.laptop_acquired,campus_alert_triggered:story.campus_alert_triggered},laptopInstanceId:g.inventory.slots.find(s=>s?.itemId==='macbook-air-13-silver')?.instanceId,anchor:'opening-building4-entrance'}}));persist(true);}
 }
 g.scenario={interact,computer,tick,snapshot:()=>({story:structuredClone(story),modal,busReady,robot:robotState,goal:objectives[story.stage][0],handoff:story.stage==='complete'?'opening.building4_reached':null,target:target()?.id??null}),spawn:()=>{safePose();robot.reset();}};
 let loadedAt=0;let raw:string|null=null;try{raw=localStorage.getItem(OPENING_SAVE_KEY);const saved=raw?parseOpeningSave(JSON.parse(raw)):null;if(saved){restore(saved);loadedAt=saved.savedAt;saveMessage='Opening checkpoint restored.';}else{g.inventory.slots.fill(null);g.inventory.revision++;safePose();if(raw){protectedSave=true;saveMessage='Unrecognized save protected. Restart to back it up.';}}}catch{g.inventory.slots.fill(null);g.inventory.revision++;safePose();protectedSave=!!raw;storageOkay=false;saveMessage='Save unavailable. A new session is ready.';}applySettings();setBusDoor(explorer.world,story.stage==='bus'&&!busReady);
 const humanInteract=()=>{const r=g.interact();if(!r.ok)notify(r.message);},humanComputer=()=>{const r=g.computer('tasks');if(!r.ok)notify(r.message);};explorer.interactions.add(humanInteract);explorer.computers.add(humanComputer);
 document.addEventListener('pointerdown',e=>{if(e.isTrusted)claimSave();},{capture:true,signal:events.signal});document.addEventListener('keydown',e=>{if(e.isTrusted)claimSave();},{capture:true,signal:events.signal});
 window.addEventListener('storage',e=>{if(e.key===writerKey&&e.newValue!==writerToken&&ownsSave){ownsSave=false;explorer.pause('save_owner_changed');saveMessage='Another window owns this save. Click to continue here.';}},{signal:events.signal});
 window.addEventListener('pagehide',()=>persist(true),{signal:events.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist(true);audio.stopOpeningCues();}},{signal:events.signal});
 for(const id of ['enter-game','enter-compat','enable-ai'])document.getElementById(id)?.addEventListener('click',()=>{void audio.start().then(()=>{if(story.stage==='bus')audio.openingCue('bus');});},{signal:events.signal});
 document.getElementById('experience-settings')?.addEventListener('click',()=>open('settings'),{signal:events.signal});document.getElementById('new-game')?.addEventListener('click',()=>open('settings'),{signal:events.signal});
 let robotState='patrol',robotWarning=0;
 function update(dt:number){if(disposed)return;const active=explorer.enabled;robot.root.visible=active&&story.campus_alert_triggered&&story.stage!=='complete';npcs.root.visible=active&&!story.campus_alert_triggered;npcs.update(dt,story.campus_alert_triggered,g.paused,g.body.position);if(!active)npcs.root.visible=false;
  // Actor simulation runs only through CampusGame's fixed-step tick. This read does not advance it.
  const r=robot.update(0,g.body.position,active&&story.campus_alert_triggered&&story.stage!=='complete',true);robotState=r.state;robotWarning=r.warning;
  getWorld()?.update({incident:story.campus_alert_triggered,laptopAcquired:story.laptop_acquired,doorOpen:busReady},g.paused?0:dt);
  if(g.paused&&!wasPaused)audio.stopOpeningCues();wasPaused=g.paused;const surface=explorer.world.surface(g.body.position.x,g.body.position.z,g.body.position.y);audio.update(explorer.student.gait,g.paused||!active,surface,g.body.position,explorer.camera.position,g.yaw);
  const item=target(),[objective,detail]=objectives[story.stage],goal=story.stage==='to_b6'?O.laptop:story.stage==='to_b4'||story.stage==='complete'?O.handoff:story.stage==='bus'?O.busExit:O.staff;
  const view:OpeningView={story,modal:active?modal:null,objective,detail,prompt:active&&!g.paused&&item?'F · '+item.label:'',saveStatus:saveMessage,busReady,computerPage,robotState,robotWarning,settings,handoffEvent:'opening.building4_reached',player:g.body.position.toArray() as [number,number,number],yaw:g.yaw,target:[...goal] as [number,number,number]};ui.update(view);
  const next=[story.stage,story.events.length,story.invitation_read,g.inventory.revision,g.view].join(':');if(stamp!==next){stamp=next;persist(true);}else if(!g.paused)persist();
  const enter=document.getElementById('enter-game');if(enter)enter.textContent=story.elapsedSeconds>0?'Continue':'Start opening';const status=document.getElementById('session-save');if(status)status.textContent=saveMessage;
 }
 return{update,relocate(){robot.dispose();robot=createOpeningRobot(explorer.world);scene.add(robot.root);setBusDoor(explorer.world,story.stage==='bus'&&!busReady);safePose();},openComputer(page:ComputerPage='tasks'){const r=computer(page);if(!r.ok)notify(r.message);},openSettings(){open('settings');},persist,audio,get settings(){return settings;},get saveStatus(){return{message:saveMessage,storageOkay,ownsSave};},get story(){return story;},dispose(){persist(true);disposed=true;events.abort();explorer.interactions.delete(humanInteract);explorer.computers.delete(humanComputer);g.scenario=null;robot.dispose();npcs.dispose();ui.dispose();audio.dispose();}};
}
