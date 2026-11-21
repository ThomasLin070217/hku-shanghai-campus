/**
 * The L001 encounter rules both lawn routes share: the standalone page
 * (`?experience=lion-boss`, `play.ts`) and the one-world campaign chapter
 * (`src/campaign/lawnChapter.ts`). DOM-free so headless checks drive it.
 */
import type {CampusGame} from '../exploration/game';
import type {Navigation} from '../exploration/navigation';
import {markLionDefeated,markPowerCut} from '../gameplay/worldThreat';
import {BOSS,NODES,SAFE,SUBMIT_RADIUS,canSubmit,type CombatState,type Point} from './combat';
import {recordCorePowerCut} from './mission';
import type {SkillRule} from './rules';

/** Q interrupts L001 only while it winds up its charge. */
export const INTERRUPT_RULE:SkillRule={kind:'stun',side:'left'};
export const INTERRUPT_LABEL='Interrupt charge';
export const SHUTDOWN_LABEL='Hold to shut down';

export const LAWN_PHASE_HINTS:Partial<Record<CombatState['phase'],string>>={
 patrol:'Approach the shutdown device',alert:'L001 has spotted you',chase:'Get ready to press Q',
 chargeWarn:'Charge wind-up · Press Q now',charge:'Sidestep the charge',chargeRecover:'Wait for the next wind-up',
 stunned:'L001 is frozen',return:'Wait for the next charge',
};

/** The one-line instruction for the current phase; `range` is the distance to the shutdown device. */
export function lawnHint(state:CombatState,range:number){
 if(canSubmit(state))return(range>SUBMIT_RADIUS?'Step into the glowing ring':'Hold F to shut down L001')+' · '+state.remaining.toFixed(1)+' s';
 return LAWN_PHASE_HINTS[state.phase]??'Approach the shutdown device';
}

export const distanceToNode=(p:Point)=>Math.hypot(p.x-NODES[0].x,p.z-NODES[0].z);

/** Stand the player on the maintenance pad (or `at`), at rest, facing L001. */
export function placeAtShelter(world:Pick<Navigation,'support'>,game:Pick<CampusGame,'body'|'yaw'|'pitch'>,at:Point=SAFE){
 const floor=world.support(at.x,at.z,.3)??0;
 game.body.position.set(at.x,floor,at.z);
 game.body.velocity.set(0,0,0);
 game.body.grounded=true;
 game.yaw=Math.atan2(at.x-BOSS.x,at.z-BOSS.z);
 game.pitch=0;
}

/** The guardian's safe shutdown: cut core power for this MacBook and record it in the world threat. */
export function shutDownGuardian(instanceId:string){
 const coreCut=recordCorePowerCut(instanceId);
 markLionDefeated();markPowerCut();
 return coreCut;
}
