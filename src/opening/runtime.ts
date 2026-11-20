/**
 * Runtime survival state for the Thomas opening.
 *
 * The story beats stay in `state.ts` (a strict, ordered, canonical log). This module
 * only owns things the player can lose or unlock while playing: hearts, the curtain,
 * the active robot hunt and the local-agent unlock. It is intentionally separate so
 * later chapters can reuse the heart contract without rewriting the story reducer.
 */

export const OPENING_MAX_HEARTS=10;
export const OPENING_CAPTURE_DAMAGE=2;
export const OPENING_RESPAWN_GRACE_SECONDS=2.6;

export interface OpeningRuntime{
 schemaVersion:1;
 hearts:number;
 maxHearts:typeof OPENING_MAX_HEARTS;
 catches:number;
 curtain_deployed:boolean;
 robot_chase_started:boolean;
 agent_chat_unlocked:boolean;
 go_to_building4_objective_unlocked:boolean;
 staff_task_received:boolean;
}

export function createOpeningRuntime():OpeningRuntime{
 return{
  schemaVersion:1,
  hearts:OPENING_MAX_HEARTS,
  maxHearts:OPENING_MAX_HEARTS,
  catches:0,
  curtain_deployed:false,
  robot_chase_started:false,
  agent_chat_unlocked:false,
  go_to_building4_objective_unlocked:false,
  staff_task_received:false,
 };
}

export function validOpeningRuntime(raw:unknown):OpeningRuntime|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1)return null;
 if(r.maxHearts!==OPENING_MAX_HEARTS)return null;
 const hearts=r.hearts,catches=r.catches;
 if(typeof hearts!=='number'||!Number.isInteger(hearts)||hearts<0||hearts>OPENING_MAX_HEARTS)return null;
 if(typeof catches!=='number'||!Number.isInteger(catches)||catches<0)return null;
 for(const key of ['curtain_deployed','robot_chase_started','agent_chat_unlocked','go_to_building4_objective_unlocked','staff_task_received'] as const){
  if(typeof r[key]!=='boolean')return null;
 }
 return{
  schemaVersion:1,hearts,maxHearts:OPENING_MAX_HEARTS,catches,
  curtain_deployed:r.curtain_deployed as boolean,
  robot_chase_started:r.robot_chase_started as boolean,
  agent_chat_unlocked:r.agent_chat_unlocked as boolean,
  go_to_building4_objective_unlocked:r.go_to_building4_objective_unlocked as boolean,
  staff_task_received:r.staff_task_received as boolean,
 };
}

/** Apply capture damage without ever inventing a negative heart count. */
export function damageOpeningHearts(runtime:OpeningRuntime,amount=OPENING_CAPTURE_DAMAGE):{runtime:OpeningRuntime;lost:number;dead:boolean}{
 const lost=Math.max(0,Math.min(runtime.hearts,Math.round(amount)));
 const next={...runtime,hearts:runtime.hearts-lost,catches:runtime.catches+1};
 return{runtime:next,lost,dead:next.hearts<=0};
}

export function healOpeningHearts(runtime:OpeningRuntime,amount=OPENING_MAX_HEARTS):OpeningRuntime{
 return{...runtime,hearts:Math.min(OPENING_MAX_HEARTS,runtime.hearts+Math.max(0,Math.round(amount)))};
}

/**
 * Re-derive the flags that are mirrors of story beats after loading a save.
 * A player who already read the alert must not lose the agent unlock because an
 * older save lacked this runtime block.
 */
export function syncRuntimeWithStory(runtime:OpeningRuntime,story:{stage:string;laptop_acquired:boolean;campus_alert_triggered:boolean;alert_read:boolean}):OpeningRuntime{
 const incident=story.campus_alert_triggered||story.stage==='incident'||story.stage==='to_b4'||story.stage==='complete';
 const alert=story.alert_read||story.stage==='to_b4'||story.stage==='complete';
 return{
  ...runtime,
  staff_task_received:runtime.staff_task_received||(story.stage!=='bus'&&story.stage!=='to_b5'),
  curtain_deployed:runtime.curtain_deployed||incident,
  // Chase is an observed encounter fact, not implied by a campus incident.
  robot_chase_started:runtime.robot_chase_started,
  agent_chat_unlocked:runtime.agent_chat_unlocked||alert,
  go_to_building4_objective_unlocked:runtime.go_to_building4_objective_unlocked||alert,
 };
}
