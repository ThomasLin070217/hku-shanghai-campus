import type{OpeningEvent,OpeningStage,OpeningState}from'./contracts';

/**
 * Canonical beat log of the Thomas opening, in strict order.
 * The segment ends with `opening.building4_reached`; no later-chapter event
 * (chapter_01_completed, supercomputer_online, ...) is ever produced here.
 */
export const OPENING_EVENT_LOG:readonly string[]=[
 'invitation_read',
 'opening.bus_exited',
 'opening.laptop_requested',
 'laptop_acquired',
 'campus_alert_triggered',
 'opening.alert_acknowledged',
 'opening.building4_reached',
];

/** Stage order; the index decides which events may legally follow. The live flow
 * starts in the crowd on the plaza; `bus` is a legacy save stage, mapped to
 * `crowd` by the parser so old saves stay readable. */
const STAGES:readonly OpeningStage[]=['crowd','to_b5','to_b6','return_b5','incident','to_b4','complete'];
type FlagKey='invitation_read'|'laptop_acquired'|'campus_alert_triggered'|'alert_read';
const FLAGS:readonly FlagKey[]=['invitation_read','laptop_acquired','campus_alert_triggered','alert_read'];
/** Cumulative flags that must be true at each stage index (the crowd stage is handled separately). */
const STAGE_FLAGS:readonly (readonly FlagKey[])[]=[
 [],
 ['invitation_read'],
 ['invitation_read'],
 ['invitation_read','laptop_acquired'],
 ['invitation_read','laptop_acquired','campus_alert_triggered'],
 ['invitation_read','laptop_acquired','campus_alert_triggered','alert_read'],
 ['invitation_read','laptop_acquired','campus_alert_triggered','alert_read'],
];
/** Canonical log length at each stage index (crowd: 0 before the phone is answered, 1 after). */
const STAGE_LOG_LENGTH:readonly number[]=[0,2,3,4,5,6,7];
interface Rule{from:OpeningStage;to:OpeningStage;log:string;flag?:FlagKey;requires?:FlagKey}
// Order of values defines the canonical event log; reach_b4 logs the internal beat, never chapter_01_completed.
// `exit_bus` keeps its 2026 log string for save compatibility: the beat now means
// "left the crowd gathering and started the walk", not "stepped off the shuttle".
const RULES:Record<OpeningEvent,Rule>={
 read_invitation:{from:'crowd',to:'crowd',log:'invitation_read',flag:'invitation_read'},
 exit_bus:{from:'crowd',to:'to_b5',log:'opening.bus_exited',requires:'invitation_read'},
 accept_errand:{from:'to_b5',to:'to_b6',log:'opening.laptop_requested'},
 take_laptop:{from:'to_b6',to:'return_b5',log:'laptop_acquired',flag:'laptop_acquired'},
 return_b5:{from:'return_b5',to:'incident',log:'campus_alert_triggered',flag:'campus_alert_triggered'},
 read_alert:{from:'incident',to:'to_b4',log:'opening.alert_acknowledged',flag:'alert_read'},
 reach_b4:{from:'to_b4',to:'complete',log:'opening.building4_reached'},
};
export function createOpeningState():OpeningState{
 return{schemaVersion:1,stage:'crowd',invitation_read:false,ambassador:false,laptop_acquired:false,campus_alert_triggered:false,alert_read:false,events:[],elapsedSeconds:0};
}
/** Shape guard: a malformed state is never crashed on and never silently upgraded. */
function usableState(state:OpeningState):boolean{
 if(!state||typeof state!=='object')return false;
 if(!STAGES.includes(state.stage))return false;
 if(!Array.isArray(state.events))return false;
 for(const event of state.events)if(typeof event!=='string')return false;
 for(const key of FLAGS)if(typeof state[key]!=='boolean')return false;
 if(typeof state.ambassador!=='boolean')return false;
 return true;
}
/**
 * Pure beat reducer. A legal beat returns a NEW state object (new events array);
 * an illegal, out-of-order or repeated beat returns the IDENTICAL state object and
 * never mutates the incoming state, its events array or its flags.
 */
export function reduceOpening(state:OpeningState,event:OpeningEvent):OpeningState{
 if(!usableState(state))return state;
 if(typeof event!=='string'||!Object.prototype.hasOwnProperty.call(RULES,event))return state;
 const rule=RULES[event as OpeningEvent];
 if(!rule||state.stage!==rule.from)return state;
 if(rule.requires&&state[rule.requires]!==true)return state;
 if(rule.flag&&state[rule.flag]===true)return state;
 if(state.events.includes(rule.log))return state;
 const next:OpeningState={...state,stage:rule.to,events:[...state.events,rule.log]};
 if(rule.flag)next[rule.flag]=true;
 // Accepting the invitation is accepting the Student Ambassador role.
 if(rule.flag==='invitation_read')next.ambassador=true;
 return next;
}
/**
 * Strict validator: known stage, exactly the cumulative flag set of that stage,
 * finite non-negative elapsed time and the canonical log prefix for the stage
 * (whitelist + unique + ordered). Unknown extra fields are ignored.
 */
export function validOpeningState(raw:unknown):OpeningState|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1)return null;
 // Old saves that predate the crowd opening carry `bus`; it is the same beat
 // position as `crowd`, so it maps forward instead of being rejected.
 const rawStage=r.stage;
 const stage:OpeningStage|null=rawStage==='bus'?'crowd':typeof rawStage==='string'&&STAGES.includes(rawStage as OpeningStage)?rawStage as OpeningStage:null;
 if(!stage)return null;
 const flags:Record<'invitation_read'|'laptop_acquired'|'campus_alert_triggered'|'alert_read',boolean>={invitation_read:false,laptop_acquired:false,campus_alert_triggered:false,alert_read:false};
 for(const key of ['invitation_read','laptop_acquired','campus_alert_triggered','alert_read'] as const){const value=r[key];if(typeof value!=='boolean')return null;flags[key]=value;}
 // The ambassador role is accepted with the invitation: a missing field on an
 // old save defaults to the invitation flag, and the two may never disagree.
 const ambassadorRaw=r.ambassador;
 if(ambassadorRaw!==undefined&&typeof ambassadorRaw!=='boolean')return null;
 const ambassador=ambassadorRaw===undefined?flags.invitation_read:ambassadorRaw;
 if(ambassador!==flags.invitation_read)return null;
 if(!Number.isFinite(r.elapsedSeconds)||(r.elapsedSeconds as number)<0)return null;
 if(!Array.isArray(r.events))return null;
 const i=STAGES.indexOf(stage);
 // The first stage carries at most the invitation flag; every later stage needs its cumulative set.
 const expected:readonly FlagKey[]=i===0?(flags.invitation_read?['invitation_read']:[]):STAGE_FLAGS[i];
 for(const key of FLAGS)if(flags[key]!==expected.includes(key))return null;
 const events=r.events as unknown[];
 const n=i===0?(flags.invitation_read?1:0):STAGE_LOG_LENGTH[i];
 if(events.length!==n)return null;
 const log:string[]=[];
 for(let k=0;k<n;k++){if(events[k]!==OPENING_EVENT_LOG[k])return null;log.push(OPENING_EVENT_LOG[k]);}
 return{schemaVersion:1,stage,invitation_read:flags.invitation_read,ambassador,laptop_acquired:flags.laptop_acquired,campus_alert_triggered:flags.campus_alert_triggered,alert_read:flags.alert_read,events:log,elapsedSeconds:r.elapsedSeconds as number};
}
