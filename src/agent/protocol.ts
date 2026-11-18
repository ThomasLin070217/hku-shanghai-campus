export const PROTOCOL_VERSION='hku-campus/2.0';
export type ViewMode='first'|'third';
/** Semantic goal executed over fixed steps; camera-relative input is still the only movement path. */
export type DirectiveType='walkTo'|'approach'|'lookAt'|'followPath';
export interface DirectiveSpec {type:DirectiveType;position?:number[];entityId?:string;toleranceM?:number;stopDistanceM?:number;toleranceDeg?:number;sprint?:boolean;path?:number[][]}
export interface DirectiveSnapshot {commandId:string;type:DirectiveType;reached:boolean;distanceRemaining:number;lookErrorDeg:number;waypoints:number;progress:number;reason?:string}
export interface Action {
 commandId:string;controlEpoch:number;durationMs:number;
 move?:{forward:number;right:number};lookDelta?:{yawDeg:number;pitchDeg:number};
 interact?:string;computer?:'map'|'tasks'|'clues'|'submit'; selectHotbar?:number; sprint?:boolean;jump?:boolean;switchView?:boolean;
 directive?:DirectiveSpec;
}
export type CommandStatus='accepted'|'running'|'completed'|'blocked'|'interrupted'|'expired';
export interface CommandRecord {commandId:string;status:CommandStatus;acceptedAt:number;expiresAt:number;startedFrame?:number;finishedFrame?:number;reason?:string;jumpResult?:'jumped'|'airborne_ignored';collisionIds:string[];operation?:import('../gameplay/survey').Outcome;directive?:DirectiveSnapshot}
export type GameEventKind='ai_enabled'|'ai_disabled'|'control_acquired'|'control_released'|'control_revoked'|'command_accepted'|'command_running'|'command_finished'|'jump'|'landed'|'collision'|'survey'|'discovery'|'panel'|'inventory'|'hotbar'|'spawn'|'pause'|'world';
export interface GameEvent {seq:number;frame:number;timeMs:number;kind:GameEventKind;message:string;data?:Record<string,unknown>}
export interface Observation {
 protocolVersion:string;frame:number;timeMs:number;wallTimeMs:number;
 mode:'human'|'ai';controlEpoch:number;aiEnabled:boolean;owner:string|null;paused:boolean;pausedReason:string|null;
 player:{id:'PLAYER';position:number[];velocity:number[];yawDeg:number;pitchDeg:number;grounded:boolean};
 world:{units:'metres';revision:string;scaleCalibration?:{id:string;horizontalStatus:string;verticalStatus:string;source:string}};
 inventory:import('../items/inventory').InventorySnapshot & {open:boolean};
 survey:ReturnType<import('../gameplay/survey').Survey['snapshot']>;
 panel:'computer'|'settings'|null;
 view:ViewMode;landmarks:{id:string;name:string;relativePosition:number[];position:number[];distance:number}[];
 lastCommand:CommandRecord|null;collisions:{type:string;id:string}[];
 eventSeq:number;events?:GameEvent[];
 perception:import('./perception').Perception;
 directive:DirectiveSnapshot|null;
}
const actionKeys=['commandId','controlEpoch','durationMs','move','lookDelta','sprint','jump','switchView','selectHotbar','interact','computer','directive'];
const directiveKeys=['type','position','entityId','toleranceM','stopDistanceM','toleranceDeg','sprint','path'];
export function validateDirectiveSpec(value:unknown):value is DirectiveSpec{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const d=value as DirectiveSpec;
 if(Object.keys(d).some(k=>!directiveKeys.includes(k)))return false;
 if(!['walkTo','approach','lookAt','followPath'].includes(d.type))return false;
 const pos=d.position,id=d.entityId;
 if(d.type==='followPath'){
  if(!Array.isArray(d.path)||d.path.length<2||d.path.length>64||!d.path.every(p=>Array.isArray(p)&&p.length>=2&&p.length<=3&&p.every(Number.isFinite)))return false;
 }else{
  if((pos===undefined)===(id===undefined))return false;
  if(pos!==undefined&&(!Array.isArray(pos)||pos.length<2||pos.length>3||!pos.every(Number.isFinite)))return false;
  if(id!==undefined&&(typeof id!=='string'||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(id)))return false;
 }
 if(d.toleranceM!==undefined&&!(Number.isFinite(d.toleranceM)&&d.toleranceM>=.05&&d.toleranceM<=10))return false;
 if(d.stopDistanceM!==undefined&&!(Number.isFinite(d.stopDistanceM)&&d.stopDistanceM>=.3&&d.stopDistanceM<=20))return false;
 if(d.toleranceDeg!==undefined&&!(Number.isFinite(d.toleranceDeg)&&d.toleranceDeg>=.5&&d.toleranceDeg<=90))return false;
 if(d.sprint!==undefined&&typeof d.sprint!=='boolean')return false;
 return true;
}
export function validateAction(a:unknown):a is Action{
 if(!a||typeof a!=='object'||Array.isArray(a))return false;const c=a as Action;
 if(Object.keys(c).some(k=>!actionKeys.includes(k)))return false;
 if(c.interact!==undefined&&(typeof c.interact!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(c.interact)))return false;
 if(c.computer!==undefined&&!['map','tasks','clues','submit'].includes(c.computer))return false;
 if(c.selectHotbar!==undefined&&(!Number.isInteger(c.selectHotbar)||c.selectHotbar<0||c.selectHotbar>8))return false;
 if(c.controlEpoch<0)return false;
 if(c.move&&Object.keys(c.move).some(k=>!['forward','right'].includes(k)))return false;
 if(c.lookDelta&&Object.keys(c.lookDelta).some(k=>!['yawDeg','pitchDeg'].includes(k)))return false;
 if(typeof c.commandId!=='string'||! /^[a-zA-Z0-9_.:-]{1,80}$/.test(c.commandId)||!Number.isSafeInteger(c.controlEpoch)||!Number.isInteger(c.durationMs)||c.durationMs<1)return false;
 if(c.move!==undefined&&(!c.move||!Number.isFinite(c.move.forward)||!Number.isFinite(c.move.right)||Math.abs(c.move.forward)>1||Math.abs(c.move.right)>1))return false;
 if(c.lookDelta!==undefined&&(!c.lookDelta||!Number.isFinite(c.lookDelta.yawDeg)||!Number.isFinite(c.lookDelta.pitchDeg)||Math.abs(c.lookDelta.yawDeg)>180||Math.abs(c.lookDelta.pitchDeg)>90))return false;
 if(!['sprint','jump','switchView'].every(k=>(c as unknown as Record<string,unknown>)[k]===undefined||typeof(c as unknown as Record<string,unknown>)[k]==='boolean'))return false;
 if(c.directive!==undefined){
  // A directive owns movement for its whole lifetime, so raw input channels are rejected.
  if(!validateDirectiveSpec(c.directive))return false;
  if(c.durationMs>30000)return false;
  if(c.move!==undefined||c.lookDelta!==undefined||c.interact!==undefined||c.computer!==undefined||c.selectHotbar!==undefined||c.jump!==undefined||c.switchView!==undefined)return false;
 }else if(c.durationMs>1000)return false;
 return true;
}
