import type{OpeningEvent,OpeningState}from'./contracts';
import{createOpeningState,reduceOpening,validOpeningState}from'./state';
import{OPENING as O}from'./spatialLayout';

/**
 * Chapter-select checkpoints inside Chapter 1.
 *
 * Each checkpoint replays the canonical beat log through the real reducer, so the
 * flags, log prefix and stage are always the ones the story machine would have
 * produced. Nothing here invents a flag or writes a hand-made save.
 */
export const OPENING_CHECKPOINTS=['b5','b6','incident','b4'] as const;
export type OpeningCheckpoint=typeof OPENING_CHECKPOINTS[number];

/** The beats a player would already have played before each checkpoint. */
const CHECKPOINT_EVENTS:Record<OpeningCheckpoint,readonly OpeningEvent[]>={
 b5:['read_invitation','exit_bus'],
 b6:['read_invitation','exit_bus','accept_errand'],
 incident:['read_invitation','exit_bus','accept_errand','take_laptop','return_b5'],
 b4:['read_invitation','exit_bus','accept_errand','take_laptop','return_b5','read_alert'],
};

/**
 * The game's own stage poses (spatialLayout `checkpoints`), not a teleport API:
 * `experience.startAtCheckpoint()` feeds them to the same `pose()` used by
 * `safePose()` and the catch/respawn path.
 */
const CHECKPOINT_POSE:Record<OpeningCheckpoint,{position:readonly number[];yaw:number}>={
 b5:{position:O.checkpoints.b5,yaw:0},
 b6:{position:O.checkpoints.b6,yaw:0},
 incident:{position:O.checkpoints.b5safe,yaw:0},
 b4:{position:O.checkpoints.b5safe,yaw:0},
};

export const CHECKPOINT_LABELS:Record<OpeningCheckpoint,string>={
 b5:'B5 · High Table dinner',
 b6:'B6 · Fetch the MacBook',
 incident:'The incident',
 b4:'B4 · Emergency control',
};

export function openingCheckpoint(raw:string|null|undefined):OpeningCheckpoint|null{
 return raw&&(OPENING_CHECKPOINTS as readonly string[]).includes(raw)?raw as OpeningCheckpoint:null;
}

/** Replay the reducer chain for a checkpoint, then run the strict validator. */
export function checkpointState(id:OpeningCheckpoint):OpeningState|null{
 let state=createOpeningState();
 for(const event of CHECKPOINT_EVENTS[id]){
  const next=reduceOpening(state,event);
  if(next===state)return null;
  state=next;
 }
 return validOpeningState(state);
}

export function checkpointPose(id:OpeningCheckpoint){
 return CHECKPOINT_POSE[id];
}
