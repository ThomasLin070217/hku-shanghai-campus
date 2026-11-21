import {DEFAULT_RANGE,MAX_RANGE,MIN_RANGE,SKILL_SPECS,type ProjectId} from './skillCatalog';

export type SkillKind = ProjectId;
export interface SkillRule {
  kind:SkillKind;
  side:'left'|'right';
  maxRange?:number;
}
export interface SkillContext {phase:string; distance:number; cooldown:number; helperReady:boolean}
const controllable=new Set(['patrol','alert','chase','ready','chargeWarn','swipeWarn','chargeRecover','swipeRecover','return']);
/** The simulator and the encounter consult the same stage, target and cooldown rules. */
export function evaluateSkill(rule:SkillRule,context:SkillContext):{ok:boolean;message:string} {
  const reject=(message:string)=>({ok:false,message});
  if(!Object.hasOwn(SKILL_SPECS,rule.kind)||!['left','right'].includes(rule.side))return reject('Invalid skill configuration. Compile again.');
  const range=rule.maxRange??DEFAULT_RANGE;
  if(!Number.isInteger(range)||range<MIN_RANGE||range>MAX_RANGE)return reject('Valid range is '+MIN_RANGE+'–'+MAX_RANGE+' m.');
  if(!Number.isFinite(context.cooldown)||!Number.isFinite(context.distance))return reject('Target telemetry is unavailable.');
  if(context.cooldown>0)return reject('Skill cooling down · '+context.cooldown.toFixed(1)+' s');
  if(!controllable.has(context.phase))return reject(context.phase==='charge'?'The charge is already out. Sidestep and wait for it to recover.':
    ['stunned','lured','helperRun','ghosted'].includes(context.phase)?'The previous control effect is still running.':'No defense unit is available to take over right now.');
  if(context.distance>range)return reject('L001 is beyond the '+range+' m cast range.');
  if(rule.kind==='lure'&&!context.helperReady)return reject('No helper robot nearby to take over.');
  const flank=rule.side==='left'?'the left':'the right';
  const message=rule.kind==='stun'?'Movement system frozen · attack cancelled':
    rule.kind==='lure'?'Helper robot hijacked · luring to '+flank:'Electronic beacon online · L001 turns to the decoy';
  return {ok:true,message};
}
