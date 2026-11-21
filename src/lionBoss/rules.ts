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
  if(!Object.hasOwn(SKILL_SPECS,rule.kind)||!['left','right'].includes(rule.side))return reject('技能配置无效，请重新编译。');
  const range=rule.maxRange??DEFAULT_RANGE;
  if(!Number.isInteger(range)||range<MIN_RANGE||range>MAX_RANGE)return reject('有效射程为 '+MIN_RANGE+'–'+MAX_RANGE+' 米。');
  if(!Number.isFinite(context.cooldown)||!Number.isFinite(context.distance))return reject('目标遥测不可用。');
  if(context.cooldown>0)return reject('技能冷却中 · '+context.cooldown.toFixed(1)+' 秒');
  if(!controllable.has(context.phase))return reject(context.phase==='charge'?'冲撞已经出手，横移避开，等它收招。':
    ['stunned','lured','helperRun','ghosted'].includes(context.phase)?'上一个控制效果仍在运行。':'当前没有可接管的防御单元。');
  if(context.distance>range)return reject('L001 超出 '+range+' 米施放范围。');
  if(rule.kind==='lure'&&!context.helperReady)return reject('附近没有可接管的阿树。');
  const flank=rule.side==='left'?'左侧':'右侧';
  const message=rule.kind==='stun'?'运动系统已冻结 · 本次攻击中止':
    rule.kind==='lure'?'已接管阿树 · 向'+flank+'牵制':'电子信标已上线 · L001 转向假目标';
  return {ok:true,message};
}
