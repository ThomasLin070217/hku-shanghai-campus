import * as T from 'three';
import {Survey} from '../gameplay/survey';
import {SITE,type SiteParameters} from '../model/campusParameters';
import {SCALE_CALIBRATION} from '../model/scaleCalibration';
import {NOV13} from '../model/nov13Parameters';
import {Inventory} from '../items/inventory';
import {EXPLORATION as C} from './config';
import {CharacterPhysics,type Intent} from './physics';
import type {Navigation} from './navigation';
import {DirectiveRunner,type Directive} from './directives';
import {perceive} from '../agent/perception';
import type {BuildingSpec} from '../model/campusParameters';
import {PROTOCOL_VERSION,validateAction,type Action,type Observation,type CommandRecord,type ViewMode,type GameEvent,type GameEventKind,type DirectiveSpec,type DirectiveSnapshot} from '../agent/protocol';
import type {BossAction} from '../agent/protocol';
import type {Outcome} from '../gameplay/survey';
export interface GameplayScenario {
 interact:(id?:string)=>Outcome;computer:(page:'map'|'tasks'|'clues'|'submit')=>Outcome;
 tick:(dt:number)=>void;snapshot:()=>unknown;spawn:()=>void;
 bossAction?:(action:BossAction,stillCurrent:()=>boolean)=>Promise<Outcome>;
}
const idle=():Intent=>({forward:0,right:0,sprint:false});
/** Authoritative state + input arbiter. RPCs never advance simulation. */
export class CampusGame {
 scenario:GameplayScenario|null=null;
 inventory=new Inventory();inventoryOpen=false;panel:'computer'|'settings'|'door'|null=null;survey:Survey;
 body:CharacterPhysics;frame=0;timeMs=0;yaw=0;pitch=0;view:ViewMode='first';paused=true;pauseReason:string|null=null;
 epoch=Date.now();armed=false;owner:string|null=null;human=idle();humanJump=false;
 /** Game-play door states by stable door id; the model and navigation stay source-authored. */
 doors:Record<string,boolean>={};
 records=new Map<string,CommandRecord>();last:CommandRecord|null=null;active:{action:Action;record:CommandRecord;consumed:boolean;bossStarted?:boolean;runner?:DirectiveRunner;startDistance?:number}|null=null;
 events:GameEvent[]=[];eventSeq=0;eventSink:((events:GameEvent[])=>void)|null=null;
 /** Optional scene-registry lookup so any stable scene ID can be a directive target. */
 entityResolver:((id:string)=>[number,number,number]|null)|null=null;
 constructor(world:Navigation,public buildings:BuildingSpec[],public site:SiteParameters=SITE){this.body=new CharacterPhysics(world);this.survey=new Survey(this);this.spawn();}
 /** Keep command history/epoch/clock across geometry rebuilds; revoke authority first. */
 replaceWorld(world:Navigation,buildings:BuildingSpec[],site:SiteParameters){this.pause('world_rebuilt');this.buildings=buildings;this.site=site;this.body=new CharacterPhysics(world);this.survey.invalidateLandmarks();this.survey.revision++;this.inventoryOpen=false;this.panel=null;this.spawn();this.event('world','世界已重建',{revision:NOV13.revision});}
 spawn(){if(this.scenario){this.takeover('reset');this.scenario.spawn();this.event('spawn','角色已回到出生点',{scenario:true});return;}this.takeover('reset');const b=this.buildings.find(b=>b.id==='B04')!,a=b.rotation*Math.PI/180,x=C.spawnOffset[0],z=b.depth/2+C.spawnOffset[2];this.body.position.set(b.x+Math.cos(a)*x+Math.sin(a)*z,0,b.z-Math.sin(a)*x+Math.cos(a)*z);this.body.position.y=this.body.world.support(this.body.position.x,this.body.position.z,0)??0;this.body.velocity.set(0,0,0);this.body.grounded=true;this.yaw=a;this.pitch=0;this.pauseReason=null;this.event('spawn','角色已回到出生点',{position:this.body.position.toArray()});}
 finish(status:CommandRecord['status'],reason:string){if(this.active){Object.assign(this.active.record,{status,reason,finishedFrame:this.frame});if(this.active.record.directive)this.active.record.directive.reason=reason;this.event('command_finished',reason,{commandId:this.active.record.commandId,status,reason});this.active=null;}}
 takeover(reason='human_takeover'){const hadControl=!!this.owner,hadArmed=this.armed;this.finish('interrupted',reason);this.owner=null;this.armed=false;this.epoch++;this.human=idle();this.humanJump=false;if(hadArmed)this.event('ai_disabled','AI 控制已撤销',{reason});if(hadControl)this.event('control_revoked','控制权已收回',{reason});}
 pause(reason='paused'){this.takeover(reason);this.paused=true;this.pauseReason=reason;this.body.velocity.x=0;this.body.velocity.z=0;this.event('pause','已暂停',{reason});}
 selectHotbar(index:number){const ok=this.inventory.select(index);this.event('hotbar','快捷栏已切换',{index,ok,itemId:this.inventory.equipped?.itemId??null});return ok;}
 openInventory(){this.pause('inventory_open');this.inventoryOpen=true;this.body.velocity.set(0,0,0);this.event('inventory','背包已打开',{open:true});}
 closeInventory(){this.inventoryOpen=false;this.paused=true;this.pauseReason='inventory_closed';this.event('inventory','背包已收起',{open:false});}
 openPanel(panel:'computer'|'settings'|'door'){this.pause(panel+'_open');this.panel=panel;this.inventoryOpen=false;this.body.velocity.set(0,0,0);this.event('panel','面板已打开',{panel});}
 closePanel(){this.panel=null;this.paused=true;this.pauseReason='panel_closed';this.event('panel','面板已关闭',{panel:null});}
 enableAI(){if(this.inventoryOpen||this.panel)return;this.takeover('user_enabled_ai');this.armed=true;this.paused=false;this.pauseReason=null;this.event('ai_enabled','用户已开启 AI 控制',{});}
 acquireControl(agentId:string){if(this.paused||!this.armed)return{ok:false,error:'ai_not_enabled'};if(this.owner)return{ok:false,error:'control_busy'};this.owner=agentId;this.epoch++;this.event('control_acquired','AI 已取得控制权',{agentId,controlEpoch:this.epoch});return{ok:true,controlEpoch:this.epoch,protocolVersion:PROTOCOL_VERSION};}
 interact(id?:string){return this.scenario?this.scenario.interact(id):this.survey.interact(id);}
 computer(page:'map'|'tasks'|'clues'|'submit'){return this.scenario?this.scenario.computer(page):this.survey.computer(page);}
 look(yawDeg:number,pitchDeg:number){this.yaw+=T.MathUtils.degToRad(yawDeg);this.pitch=T.MathUtils.clamp(this.pitch+T.MathUtils.degToRad(pitchDeg),C.minPitch,C.maxPitch);}
 /** Stable observation IDs (survey records, buildings, entrance lion) → world position. */
 resolveTarget(d:DirectiveSpec):[number,number,number]|null{
  const point=(p:number[]):[number,number,number]=>[p[0],p.length>2?p[1]:this.body.position.y+1, p.length>2?p[2]:p[1]];
  if(d.position)return point(d.position);
  if(!d.entityId)return null;
  const landmark=this.survey.landmarks.find(l=>l.id===d.entityId);if(landmark){const aim=d.type==='lookAt'||d.type==='approach'?1.3:0;return [landmark.position[0],landmark.position[1]+aim,landmark.position[2]];}
  const building=this.buildings.find(b=>b.id===d.entityId);if(building)return [building.x,this.body.world.support(building.x,building.z,0)??0,building.z];
  if(d.entityId===NOV13.lion.id)return [NOV13.lion.x,this.body.world.support(NOV13.lion.x,NOV13.lion.z,0)??0,NOV13.lion.z];
  const custom=this.entityResolver?.(d.entityId);if(custom)return custom;
  return null;
 }
 private directiveGoal(spec:DirectiveSpec,position:[number,number,number]):Directive{
  if(spec.type==='followPath')return {type:'followPath',path:(spec.path??[]).map(p=>[p[0],p.length>2?p[1]:this.body.position.y,p[p.length>2?2:1]]),sprint:spec.sprint,toleranceM:spec.toleranceM} as Directive;
  if(spec.type==='lookAt')return {type:'lookAt',position,toleranceDeg:spec.toleranceDeg} as Directive;
  if(spec.type==='approach')return {type:'approach',position,stopDistanceM:spec.stopDistanceM,sprint:spec.sprint} as Directive;
  return {type:'walkTo',position,toleranceM:spec.toleranceM,sprint:spec.sprint} as Directive;
 }
 act(value:unknown,now=Date.now()){
  if(!validateAction(value))return{ok:false,error:'invalid_action'};
  if(value.controlEpoch!==this.epoch)return{ok:false,error:'stale_epoch',controlEpoch:this.epoch};
  if(!this.owner||!this.armed||this.paused)return{ok:false,error:'no_control'};
  const seen=this.records.get(value.commandId);if(seen)return{ok:true,duplicate:true,command:{...seen}};
  if(value.boss&&!this.scenario?.bossAction)return{ok:false,error:'boss_unavailable'};
  if(this.records.size>=10000)return{ok:false,error:'session_command_limit'};
  let runner:DirectiveRunner|undefined,startDistance=0;
  if(value.directive){
   // followPath carries its own geometry; other directives need a position or a stable ID.
   const last=value.directive.type==='followPath'?value.directive.path?.[value.directive.path.length-1]:undefined;
   const target=value.directive.type==='followPath'?(last?[last[0],last.length>2?last[1]:this.body.position.y,last.length>2?last[2]:last[1]] as [number,number,number]:null):this.resolveTarget(value.directive);
   if(!target)return{ok:false,error:'unknown_target',target:value.directive.entityId??null};
   startDistance=Math.hypot(target[0]-this.body.position.x,target[2]-this.body.position.z);
   runner=new DirectiveRunner(this.directiveGoal(value.directive,target),now);
  }
  this.finish('interrupted','replaced');const record:CommandRecord={commandId:value.commandId,status:'accepted',acceptedAt:now,expiresAt:now+value.durationMs,collisionIds:[]};
  if(runner&&value.directive)record.directive={commandId:value.commandId,type:value.directive.type,reached:false,distanceRemaining:startDistance,lookErrorDeg:0,waypoints:0,progress:0};
  this.records.set(value.commandId,record);this.last=record;this.active={action:structuredClone(value),record,consumed:false,...(runner?{runner,startDistance}:{})};
  this.event('command_accepted','动作已接收',{commandId:value.commandId,directive:value.directive?.type??null});
  return{ok:true,command:{...record}};
 }
 stop(epoch:number){if(epoch!==this.epoch)return{ok:false,error:'stale_epoch'};if(!this.owner)return{ok:false,error:'no_control'};this.finish('interrupted','stop');this.human=idle();this.humanJump=false;return{ok:true};}
 releaseControl(epoch:number){const r=this.stop(epoch);if(r.ok){this.takeover('released');this.event('control_released','控制权已释放',{});}return{...r,controlEpoch:this.epoch};}
 private async runBossAction(action:BossAction,record:CommandRecord,epoch:number){
  const scenario=this.scenario;
  const current=()=>this.scenario===scenario&&this.active?.record===record&&this.epoch===epoch
   &&!!this.owner&&this.armed&&!this.paused&&Date.now()<record.expiresAt;
  if(!scenario?.bossAction||!current())return;
  let result:Outcome;
  try{result=await scenario.bossAction(action,current);}
  catch{result={ok:false,code:'boss_action_failed',message:'设备未响应，请重新检查连接。'};}
  if(!current())return;
  record.operation=result;this.event('boss',result.message,{commandId:record.commandId,action:action.type,code:result.code});
  this.finish(result.ok?'completed':'blocked',result.code);
 }
 step(dt:number,now=Date.now()){
  if(this.paused)return;let intent=this.human,jump=this.humanJump;this.humanJump=false;
  if(this.owner){intent=idle();jump=false;if(this.active){
   const {action:a,record:r,runner}=this.active;
   if(now>=r.expiresAt)this.finish(runner||a.boss?'expired':!this.active.consumed?'expired':r.collisionIds.length?'blocked':'completed',runner?'directive_timeout':'duration_elapsed');
   else{
    if(!this.active.consumed){this.active.consumed=true;r.status='running';r.startedFrame=this.frame+1;this.event('command_running','动作开始执行',{commandId:r.commandId});if(a.lookDelta)this.look(a.lookDelta.yawDeg,a.lookDelta.pitchDeg);if(a.selectHotbar!==undefined)this.selectHotbar(a.selectHotbar);if(a.interact!==undefined){r.operation=this.interact(a.interact);this.event('survey',r.operation.message,{code:r.operation.code,id:r.operation.id??null});if(this.paused)return;}if(a.computer){r.operation=this.computer(a.computer);this.event('survey',r.operation.message,{code:r.operation.code,page:r.operation.page??a.computer});if(this.paused)return;}if(a.switchView)this.view=this.view==='first'?'third':'first';jump=!!a.jump;if(jump){r.jumpResult=this.body.grounded?'jumped':'airborne_ignored';this.event('jump',r.jumpResult==='jumped'?'起跳':'空中无法再次起跳',{result:r.jumpResult});}}
    else intent={forward:a.move?.forward??0,right:a.move?.right??0,sprint:a.sprint??false};
    if(a.boss&&this.active && !this.active.bossStarted){this.active.bossStarted=true;void this.runBossAction(a.boss,r,a.controlEpoch);}
    // Directives own the intent every fixed step until they finish; raw input is not consulted.
    if(runner){const s=runner.step(dt,{world:this.body.world,body:this.body,yaw:this.yaw,pitch:this.pitch});this.yaw=s.yaw;this.pitch=s.pitch;intent=s.intent;jump=s.jump;
     const snap=runner.snapshot();r.directive={commandId:r.commandId,type:snap.type,reached:snap.reached,distanceRemaining:Math.round(snap.distanceRemaining*1000)/1000,lookErrorDeg:Math.round(snap.lookErrorDeg*10)/10,waypoints:snap.waypoints,progress:this.active?.startDistance?Math.min(1,Math.max(0,1-snap.distanceRemaining/Math.max(.001,this.active.startDistance))):0,...(snap.reason?{reason:snap.reason}:{})};
     if(s.done)this.finish(s.reached?'completed':'blocked',s.reason??(s.reached?'goal_reached':'directive_failed'));
    }
   }
  }}
  this.body.step(dt,intent,this.yaw,jump);this.frame++;this.timeMs+=dt*1000;if(this.scenario)this.scenario.tick(dt);else this.survey.tick(dt);
  if(this.body.landed)this.event('landed','已落地',{});
  if(this.active)for(const c of this.body.contacts)if(c.type!=='landed'&&!this.active.record.collisionIds.includes(c.id)){this.active.record.collisionIds.push(c.id);this.event('collision','发生碰撞',{id:c.id,type:c.type});}
 }
 event(kind:GameEventKind,message:string,data?:Record<string,unknown>){const e:GameEvent={seq:++this.eventSeq,frame:this.frame,timeMs:Math.round(this.timeMs),kind,message,...(data?{data}:{})};this.events.push(e);if(this.events.length>512)this.events.shift();this.eventSink?.([e]);return e;}
 drainEvents(afterSeq:number,limit=100){return this.events.filter(e=>e.seq>afterSeq).slice(0,limit);}
 observe(now=Date.now(),afterSeq?:number):Observation{return{...(this.scenario?.bossAction?{boss:this.scenario.snapshot()}:this.scenario?{opening:this.scenario.snapshot()}:{}),protocolVersion:PROTOCOL_VERSION,frame:this.frame,timeMs:this.timeMs,wallTimeMs:now,mode:this.owner?'ai':'human',controlEpoch:this.epoch,aiEnabled:this.armed,owner:this.owner,paused:this.paused,pausedReason:this.paused?this.pauseReason:null,player:{id:'PLAYER',position:this.body.position.toArray(),velocity:this.body.velocity.toArray(),yawDeg:T.MathUtils.radToDeg(this.yaw),pitchDeg:T.MathUtils.radToDeg(this.pitch),grounded:this.body.grounded},view:this.view,survey:this.survey.snapshot(),panel:this.panel,world:{units:'metres',revision:NOV13.revision,scaleCalibration:SCALE_CALIBRATION},inventory:{...this.inventory.snapshot(),open:this.inventoryOpen},landmarks:[...this.buildings,{id:NOV13.lion.id,label:'入口草坪小狮子',x:NOV13.lion.x,z:NOV13.lion.z},...this.survey.landmarks.map(l=>({id:l.id,label:l.name,x:l.position[0],y:l.position[1],z:l.position[2]}))].map(b=>{const y='y' in b?Number(b.y):0;const r=new T.Vector3(b.x,y,b.z).sub(this.body.position);return{id:b.id,name:b.label,position:[b.x,y,b.z],relativePosition:r.toArray(),distance:r.length()};}).sort((a,b)=>a.distance-b.distance).filter(b=>b.distance<160),lastCommand:this.last?structuredClone(this.last):null,collisions:this.body.contacts.map(c=>({...c})),eventSeq:this.eventSeq,...(typeof afterSeq==='number'?{events:this.drainEvents(afterSeq)}:{}),perception:perceive(this),directive:this.active?.record.directive??this.last?.directive??null};}
}
