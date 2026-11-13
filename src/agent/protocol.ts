export const PROTOCOL_VERSION='hku-campus/1.0';
export type ViewMode='first'|'third';
export interface Action {
 commandId:string;controlEpoch:number;durationMs:number;
 move?:{forward:number;right:number};lookDelta?:{yawDeg:number;pitchDeg:number};
 sprint?:boolean;jump?:boolean;switchView?:boolean;
}
export type CommandStatus='accepted'|'running'|'completed'|'blocked'|'interrupted'|'expired';
export interface CommandRecord {commandId:string;status:CommandStatus;acceptedAt:number;expiresAt:number;startedFrame?:number;finishedFrame?:number;reason?:string;jumpResult?:'jumped'|'airborne_ignored';collisionIds:string[]}
export interface Observation {
 protocolVersion:string;frame:number;timeMs:number;wallTimeMs:number;
 mode:'human'|'ai';controlEpoch:number;aiEnabled:boolean;owner:string|null;paused:boolean;
 player:{position:number[];velocity:number[];yawDeg:number;pitchDeg:number;grounded:boolean};
 view:ViewMode;landmarks:{id:string;name:string;relativePosition:number[];distance:number}[];
 lastCommand:CommandRecord|null;collisions:{type:string;id:string}[];
}
export function validateAction(a:unknown):a is Action{
 if(!a||typeof a!=='object'||Array.isArray(a))return false;const c=a as Action;
 if(Object.keys(c).some(k=>!['commandId','controlEpoch','durationMs','move','lookDelta','sprint','jump','switchView'].includes(k)))return false;
 if(c.controlEpoch<0)return false;
 if(c.move&&Object.keys(c.move).some(k=>!['forward','right'].includes(k)))return false;
 if(c.lookDelta&&Object.keys(c.lookDelta).some(k=>!['yawDeg','pitchDeg'].includes(k)))return false;
 if(typeof c.commandId!=='string'||! /^[a-zA-Z0-9_.:-]{1,80}$/.test(c.commandId)||!Number.isSafeInteger(c.controlEpoch)||!Number.isInteger(c.durationMs)||c.durationMs<1||c.durationMs>1000)return false;
 if(c.move!==undefined&&(!c.move||!Number.isFinite(c.move.forward)||!Number.isFinite(c.move.right)||Math.abs(c.move.forward)>1||Math.abs(c.move.right)>1))return false;
 if(c.lookDelta!==undefined&&(!c.lookDelta||!Number.isFinite(c.lookDelta.yawDeg)||!Number.isFinite(c.lookDelta.pitchDeg)||Math.abs(c.lookDelta.yawDeg)>180||Math.abs(c.lookDelta.pitchDeg)>90))return false;
 return ['sprint','jump','switchView'].every(k=>(c as unknown as Record<string,unknown>)[k]===undefined||typeof(c as unknown as Record<string,unknown>)[k]==='boolean');
}
