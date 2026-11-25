/**
 * Whether the plaza crowd is on screen and walking.
 *
 * The students walk from the plaza to Building 5: about 150 m at 1.05-1.6 m/s; measured end
 * to end on the shipped route it takes about 182 s (the first estimate of 100-140 s was short).
 * That walk is time on a route, not a story stage. It used to follow the stage (`crowd` and
 * `to_b5` only), and accepting the errand moves the stage to `to_b6`, so all 52 students were
 * removed on that one frame, most of them still in view of the B5 door. The owner reported it
 * as "students disappear immediately after we get the macbook mission" (2026-11-25).
 *
 * The rule: `crowd` shows the students standing; from `to_b5` on they are shown and walking
 * through every later stage, and each one leaves only by reaching the end of its path
 * (`crowdDirector.ts` keeps a finished student standing at its place; nobody is removed).
 * A stage this module does not know shows nothing, so a new stage cannot strand a silent crowd.
 */
export type CrowdWalkGate={shown:boolean;walking:boolean};

/** Every stage at which the students are on the route, in story order. */
export const CROWD_WALK_STAGES:ReadonlySet<string>=new Set(['to_b5','to_b6','return_b5','incident','to_b4','complete']);

export function crowdWalkGate(stage:string):CrowdWalkGate{
 if(stage==='crowd')return{shown:true,walking:false};
 if(CROWD_WALK_STAGES.has(stage))return{shown:true,walking:true};
 return{shown:false,walking:false};
}

/**
 * A run that is being restored (a save load or a chapter jump) starts at a stage, not at a time
 * on the route. This says where the students are when such a run begins.
 *
 * `crowd`: the light show has just ended and the students are still standing on the plaza.
 *
 * Every later stage: arrived, standing at their places in the hall. The walk takes about 182 s and
 * belongs to `to_b5`, but the `b5` checkpoint is also `to_b5` and it places the player at the B5
 * door, 150 m from the plaza and at the end of the route: a crowd restarted on the plaza there
 * would walk for two minutes toward a player who has already arrived. A manual save made during
 * the walk is the one case that loses something (the students' places on the route are not in the
 * save); putting them in the hall, where the player is heading, is the least wrong answer. The
 * alternative, sending all 52 to the hall on a `crowd` save, would empty the plaza the player
 * was standing in.
 */
export function crowdRestoredAt(stage:string):'standing'|'arrived'{
 return stage==='crowd'?'standing':'arrived';
}
