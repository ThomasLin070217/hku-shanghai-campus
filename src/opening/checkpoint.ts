import type{OpeningEvent,OpeningState}from'./contracts';
import{createOpeningState,reduceOpening,validOpeningState}from'./state';
import{OPENING as O}from'./spatialLayout';
import type{CampaignStage}from'../campaign/state';
import{B4_ENTRY}from'../campaign/b4Chapter';
import{LAWN_APPROACH,LAWN_ENTRY}from'../campaign/lawnChapter';
import{SPORTS_APPROACH,SPORTS_ENTRY}from'../campaign/sportsChapter';
import{markLionDefeated,markPowerCut,sealWorld,type WorldThreat,type WorldThreatStorage}from'../gameplay/worldThreat';

/**
 * Chapter-select checkpoints inside Chapter 1.
 *
 * Each checkpoint replays the canonical beat log through the real reducer, so the
 * flags, log prefix and stage are always the ones the story machine would have
 * produced. Nothing here invents a flag or writes a hand-made save.
 */
export const OPENING_CHECKPOINTS=['b5','b6','incident','b4','b4-inside','lawn','sports','ending'] as const;
export type OpeningCheckpoint=typeof OPENING_CHECKPOINTS[number];

const CHAPTER_1:readonly OpeningEvent[]=['read_invitation','exit_bus','accept_errand','take_laptop','return_b5','read_alert','reach_b4'];
/** The beats a player would already have played before each checkpoint. */
const CHECKPOINT_EVENTS:Record<OpeningCheckpoint,readonly OpeningEvent[]>={
 b5:['read_invitation','exit_bus'],
 b6:['read_invitation','exit_bus','accept_errand'],
 incident:['read_invitation','exit_bus','accept_errand','take_laptop','return_b5'],
 b4:['read_invitation','exit_bus','accept_errand','take_laptop','return_b5','read_alert'],
 // Campaign checkpoints: Chapter 1 already complete, the MacBook in the backpack.
 'b4-inside':[...CHAPTER_1],
 lawn:[...CHAPTER_1],
 sports:[...CHAPTER_1],
 ending:[...CHAPTER_1],
};

/**
 * The game's own stage poses (spatialLayout `checkpoints`), not a teleport API:
 * `experience.startAtCheckpoint()` feeds them to the same `pose()` used by
 * `safePose()` and the catch/respawn path.
 */
/** Yaw that faces from `from` along a route (x/z pairs) to its first point more than 1 m away.
 * Explorer convention: forward = (-sin yaw, -cos yaw) in x/z. */
export function routeYaw(from:readonly number[],route:readonly (readonly number[])[]):number{
 const next=route.find(([x,z])=>Math.hypot(x-from[0],z-from[2])>1);
 return next?Math.atan2(-(next[0]-from[0]),-(next[1]-from[2])):0;
}
const CHECKPOINT_POSE:Record<OpeningCheckpoint,{position:readonly number[];yaw:number}>={
 b5:{position:O.checkpoints.b5,yaw:0},
 b6:{position:O.checkpoints.b6,yaw:0},
 incident:{position:O.checkpoints.b5safe,yaw:0},
 b4:{position:O.checkpoints.b5safe,yaw:0},
 // Inside the B04 door (the b4 chapter's entry point), facing into the building.
 'b4-inside':{position:B4_ENTRY.point,yaw:0},
 // Outside the B04 entrance, where Chapter 1 hands over.
 lawn:{position:O.handoff,yaw:routeYaw(O.handoff,LAWN_APPROACH)},
 // At the lawn entry, after the guardian is down.
 sports:{position:LAWN_ENTRY.point,yaw:routeYaw(LAWN_ENTRY.point,SPORTS_APPROACH)},
 // At the sports hall east door, students freed.
 ending:{position:SPORTS_ENTRY.point,yaw:Math.PI/2},
};

export const CHECKPOINT_LABELS:Record<OpeningCheckpoint,string>={
 b5:'B5 · High Table dinner',
 b6:'B6 · Fetch the MacBook',
 incident:'The incident',
 b4:'B4 · Emergency control',
 'b4-inside':'B4 · The Keyboard Wall',
 lawn:'Chapter 2 · The Lawn Guardian',
 sports:'Chapter 3 · Sports Hall Rescue',
 ending:'Epilogue · Barrier Down',
};

/**
 * Where the campaign (src/campaign) resumes for each campaign checkpoint, and
 * which earlier chapter results the run already holds: `relay` = the B4
 * supercomputer is paired with this MacBook, `corePower` = the lawn guardian
 * cut the core power. Chapter 1 checkpoints return null (no campaign yet).
 */
const CHECKPOINT_CAMPAIGN:Partial<Record<OpeningCheckpoint,{stage:CampaignStage;relay:boolean;corePower:boolean}>>={
 'b4-inside':{stage:'b4_keyboard',relay:false,corePower:false},
 lawn:{stage:'to_lawn',relay:true,corePower:false},
 sports:{stage:'to_sports',relay:true,corePower:true},
 ending:{stage:'ending',relay:true,corePower:true},
};
export function checkpointCampaign(id:OpeningCheckpoint){
 const c=CHECKPOINT_CAMPAIGN[id];return c?{...c}:null;
}

export interface CheckpointThreat{
 /** The campus was already sealed when this checkpoint begins. */
 sealed:boolean;
 /** The lawn guardian is down. */
 lionDefeated:boolean;
 /** The core power is cut. */
 powerCut:boolean;
}
/**
 * Endgame facts a campaign checkpoint already holds. Only the two checkpoints
 * after the lawn carry them; Chapter 1 checkpoints return null.
 */
const CHECKPOINT_THREAT:Partial<Record<OpeningCheckpoint,CheckpointThreat>>={
 sports:{sealed:true,lionDefeated:true,powerCut:true},
 ending:{sealed:true,lionDefeated:true,powerCut:true},
};
export function checkpointThreat(id:OpeningCheckpoint):CheckpointThreat|null{
 const t=CHECKPOINT_THREAT[id];return t?{...t}:null;
}

/**
 * Write those facts with the real world-threat writers, so the ending can purge
 * from a checkpoint instead of finding a clear record. Returns null when the
 * checkpoint carries no endgame facts.
 */
export function applyCheckpointThreat(id:OpeningCheckpoint,storage?:WorldThreatStorage|null):WorldThreat|null{
 const t=CHECKPOINT_THREAT[id];if(!t)return null;
 const now=Date.now();
 let threat=sealWorld(now,storage);
 if(t.lionDefeated)threat=markLionDefeated(now,storage);
 if(t.powerCut)threat=markPowerCut(now,storage);
 return threat;
}

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
 return validOpeningState(state?{...state,elapsedSeconds:1}:state);
}

export function checkpointPose(id:OpeningCheckpoint){
 return CHECKPOINT_POSE[id];
}
