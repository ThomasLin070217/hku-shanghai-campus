export type SkillKind = 'stun' | 'lure';
export interface SkillRule {
  kind: SkillKind;
  side: 'left' | 'right';
  maxRange?: number;
}
export interface SkillContext {
  phase: string;
  distance: number;
  cooldown: number;
  helperReady: boolean;
}

export const COOLDOWN = 5;
export const STUN_WINDOW = 3;
export const LURE_WINDOW = 4;

/** Shared by the isolated MacBook simulation and the real encounter. */
export function evaluateSkill(rule: SkillRule, context: SkillContext): {ok: boolean; message: string} {
  const range = rule.maxRange ?? 8;
  if (!Number.isFinite(range) || range < 4 || range > 8) {
    return {ok:false,message:'射程参数无效，请回工作台重测'};
  }
  if (context.cooldown > 0) return {ok:false,message:`技能冷却中 · ${context.cooldown.toFixed(1)} 秒`};
  if (context.distance > range) return {ok:false,message:`L001 超出 ${range} 米施放范围`};
  if (rule.kind === 'stun') {
    if (context.phase !== 'chargeWarn') return {ok:false,message:'需要在箭头冲撞预警亮起时施放'};
    return {ok:true,message:'短时麻痹生效 · 本次冲撞已取消'};
  }
  if (!context.helperReady) return {ok:false,message:'阿树仍在执行上一条指令'};
  if (context.phase !== 'swipeRecover') return {ok:false,message:'等待挥爪结束，在收招期间施放'};
  return {ok:true,message:`牵制指令已接收 · 阿树前往${rule.side === 'left' ? '左' : '右'}侧`};
}
