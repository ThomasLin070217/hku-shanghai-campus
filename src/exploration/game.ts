import * as T from 'three';
import {Survey} from '../gameplay/survey';
import {SITE,type SiteParameters} from '../model/campusParameters';
import {SCALE_CALIBRATION} from '../model/scaleCalibration';
import {NOV13} from '../model/nov13Parameters';
import {Inventory} from '../items/inventory';
import {EXPLORATION as C} from './config';
import {CharacterPhysics,type Intent} from './physics';
import type {Navigation} from './navigation';
import type {BuildingSpec} from '../model/campusParameters';
import {PROTOCOL_VERSION,validateAction,type Action,type Observation,type CommandRecord,type ViewMode} from '../agent/protocol';
const idle=():Intent=>({forward:0,right:0,sprint:false});
/** Authoritative state + input arbiter. RPCs never advance simulation. */
export class CampusGame {
 inventory=new Inventory();inventoryOpen=false;panel:'computer'|'settings'|'door'|null=null;survey:Survey;
 body:CharacterPhysics;frame=0;timeMs=0;yaw=0;pitch=0;view:ViewMode='first';paused=true;
 epoch=Date.now();armed=false;owner:string|null=null;human=idle();humanJump=false;
 /** Game-play door states by stable door id; the model and navigation stay source-authored. */
 doors:Record<string,boolean>={};
 records=new Map<string,CommandRecord>();last:CommandRecord|null=null;active:{action:Action;record:CommandRecord;consumed:boolean}|null=null;
 constructor(world:Navigation,public buildings:BuildingSpec[],public site:SiteParameters=SITE){this.body=new CharacterPhysics(world);this.survey=new Survey(this);this.spawn();}
 /** Keep command history/epoch/clock across geometry rebuilds; revoke authority first. */
 replaceWorld(world:Navigation,buildings:BuildingSpec[],site:SiteParameters){this.pause('world_rebuilt');this.buildings=buildings;this.site=site;this.body=new CharacterPhysics(world);this.survey.invalidateLandmarks();this.survey.revision++;this.inventoryOpen=false;this.panel=null;this.spawn();}
 spawn(){this.takeover('reset');const b=this.buildings.find(b=>b.id==='B04')!,a=b.rotation*Math.PI/180,x=C.spawnOffset[0],z=b.depth/2+C.spawnOffset[2];this.body.position.set(b.x+Math.cos(a)*x+Math.sin(a)*z,0,b.z-Math.sin(a)*x+Math.cos(a)*z);this.body.position.y=this.body.world.support(this.body.position.x,this.body.position.z,0)??0;this.body.velocity.set(0,0,0);this.body.grounded=true;this.yaw=a;this.pitch=0;}
 finish(status:CommandRecord['status'],reason:string){if(this.active){Object.assign(this.active.record,{status,reason,finishedFrame:this.frame});this.active=null;}}
 takeover(reason='human_takeover'){this.finish('interrupted',reason);this.owner=null;this.armed=false;this.epoch++;this.human=idle();this.humanJump=false;}
 pause(reason='paused'){this.takeover(reason);this.paused=true;this.body.velocity.x=0;this.body.velocity.z=0;}
 selectHotbar(index:number){return this.inventory.select(index);}
 openInventory(){this.pause('inventory_open');this.inventoryOpen=true;this.body.velocity.set(0,0,0);}
 closeInventory(){this.inventoryOpen=false;this.paused=true;}
 openPanel(panel:'computer'|'settings'|'door'){this.pause(panel+'_open');this.panel=panel;this.inventoryOpen=false;this.body.velocity.set(0,0,0);}
 closePanel(){this.panel=null;this.paused=true;}
 enableAI(){if(this.inventoryOpen||this.panel)return;this.takeover('user_enabled_ai');this.armed=true;this.paused=false;}
 acquireControl(agentId:string){if(this.paused||!this.armed)return{ok:false,error:'ai_not_enabled'};if(this.owner)return{ok:false,error:'control_busy'};this.owner=agentId;this.epoch++;return{ok:true,controlEpoch:this.epoch,protocolVersion:PROTOCOL_VERSION};}
 look(yawDeg:number,pitchDeg:number){this.yaw+=T.MathUtils.degToRad(yawDeg);this.pitch=T.MathUtils.clamp(this.pitch+T.MathUtils.degToRad(pitchDeg),C.minPitch,C.maxPitch);}
 act(value:unknown,now=Date.now()){
  if(!validateAction(value))return{ok:false,error:'invalid_action'};
  if(value.controlEpoch!==this.epoch)return{ok:false,error:'stale_epoch',controlEpoch:this.epoch};
  if(!this.owner||!this.armed||this.paused)return{ok:false,error:'no_control'};
  const seen=this.records.get(value.commandId);if(seen)return{ok:true,duplicate:true,command:{...seen}};
  if(this.records.size>=10000)return{ok:false,error:'session_command_limit'};
  this.finish('interrupted','replaced');const record:CommandRecord={commandId:value.commandId,status:'accepted',acceptedAt:now,expiresAt:now+value.durationMs,collisionIds:[]};
  this.records.set(value.commandId,record);this.last=record;this.active={action:structuredClone(value),record,consumed:false};return{ok:true,command:{...record}};
 }
 stop(epoch:number){if(epoch!==this.epoch)return{ok:false,error:'stale_epoch'};if(!this.owner)return{ok:false,error:'no_control'};this.finish('interrupted','stop');this.human=idle();this.humanJump=false;return{ok:true};}
 releaseControl(epoch:number){const r=this.stop(epoch);if(r.ok)this.takeover('released');return{...r,controlEpoch:this.epoch};}
 step(dt:number,now=Date.now()){
  if(this.paused)return;let intent=this.human,jump=this.humanJump;this.humanJump=false;
  if(this.owner){intent=idle();jump=false;if(this.active){
   const {action:a,record:r}=this.active;
   if(now>=r.expiresAt)this.finish(!this.active.consumed?'expired':r.collisionIds.length?'blocked':'completed','duration_elapsed');
   else{intent={forward:a.move?.forward??0,right:a.move?.right??0,sprint:a.sprint??false};if(!this.active.consumed){this.active.consumed=true;r.status='running';r.startedFrame=this.frame+1;if(a.lookDelta)this.look(a.lookDelta.yawDeg,a.lookDelta.pitchDeg);if(a.selectHotbar!==undefined)this.selectHotbar(a.selectHotbar);if(a.interact!==undefined)r.operation=this.survey.interact(a.interact);if(a.computer)r.operation=this.survey.computer(a.computer);if(a.switchView)this.view=this.view==='first'?'third':'first';jump=!!a.jump;if(jump)r.jumpResult=this.body.grounded?'jumped':'airborne_ignored';}}
  }}
  this.body.step(dt,intent,this.yaw,jump);this.frame++;this.timeMs+=dt*1000;this.survey.tick(dt);
  if(this.active)for(const c of this.body.contacts)if(c.type!=='landed'&&!this.active.record.collisionIds.includes(c.id))this.active.record.collisionIds.push(c.id);
 }
 observe(now=Date.now()):Observation{return{protocolVersion:PROTOCOL_VERSION,frame:this.frame,timeMs:this.timeMs,wallTimeMs:now,mode:this.owner?'ai':'human',controlEpoch:this.epoch,aiEnabled:this.armed,owner:this.owner,paused:this.paused,player:{id:'PLAYER',position:this.body.position.toArray(),velocity:this.body.velocity.toArray(),yawDeg:T.MathUtils.radToDeg(this.yaw),pitchDeg:T.MathUtils.radToDeg(this.pitch),grounded:this.body.grounded},view:this.view,survey:this.survey.snapshot(),panel:this.panel,world:{units:'metres',revision:NOV13.revision,scaleCalibration:SCALE_CALIBRATION},inventory:{...this.inventory.snapshot(),open:this.inventoryOpen},landmarks:[...this.buildings,{id:NOV13.lion.id,label:'入口草坪小狮子',x:NOV13.lion.x,z:NOV13.lion.z},...this.survey.landmarks.map(l=>({id:l.id,label:l.name,x:l.position[0],y:l.position[1],z:l.position[2]}))].map(b=>{const y='y' in b?Number(b.y):0;const r=new T.Vector3(b.x,y,b.z).sub(this.body.position);return{id:b.id,name:b.label,position:[b.x,y,b.z],relativePosition:r.toArray(),distance:r.length()};}).sort((a,b)=>a.distance-b.distance).filter(b=>b.distance<160),lastCommand:this.last?structuredClone(this.last):null,collisions:this.body.contacts.map(c=>({...c}))};}
}
