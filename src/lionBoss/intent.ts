import type {SkillRule, SkillKind as Kind} from './rules';

type CompileResult = {ok:true;rule:SkillRule}|{ok:false;message:string};

export function compileBossIntent(input:string, kind:Kind):CompileResult {
  const normalized=input.normalize('NFKC').trim().toLowerCase();
  const intent=normalized.replace(/[零一二三四五六七八九](?=\s*(?:米|公尺))/g,ch=>String('零一二三四五六七八九'.indexOf(ch)));
  const fail = (message:string):CompileResult=>({ok:false,message});
  if (!intent) return fail('先写一句话，描述狮子在做什么，以及你想释放的效果。');
  if (/自动|一直|永久|automatically|permanent/.test(intent)) return fail('工作台支持手动释放的短时技能。请写出招式阶段和想要的效果。');

  const distances = Array.from(intent.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:米|公尺|m(?:et(?:er|re)s?)?\b)/g));
  const maxRange = Number(distances[0]?.[1] ?? 8);
  const unsupportedDistance=/[十百千半点零一二三四五六七八九]\s*(?:\d+\s*)?(?:米|公尺)|(?:超过|远于|大于)\s*\d+\s*(?:米|公尺)|\d+\s*(?:米|公尺)(?:以外|之外)/.test(intent);
  if (unsupportedDistance || distances.length>1 || maxRange<4 || maxRange>8 || !Number.isInteger(maxRange)) {
    return fail('有效距离可写成 4 至 8 米之间的一个整数，例如「6 米内」。');
  }
  if (kind==='stun') {
    const charge = /冲(?:撞|锋|刺)|猛冲|charg(?:e|es|ing)|rush|wind.?up/.test(intent);
    const stop = /麻痹|停机|打断|瘫痪|定住|眩晕|定身|制动|停下|stun|stop|interrupt|immobili[sz]e/.test(intent);
    if (!charge || !stop || /挥爪|冲(?:撞|锋)(?:完|结束|之后|过后)|after (?:the |its )?charge/.test(intent)) {
      return fail('麻痹模块需要「冲撞预警」和「打断」两项信息，例如「狮子蓄力冲撞时让它停机」。');
    }
    return {ok:true,rule:{kind,side:'right',maxRange}};
  }
  const recovery = /(?:挥|出|拍|扫).{0,4}爪.{0,7}(?:后|完|结束|收)|(?:挥完|收回|收起|挥过|挥了).{0,2}爪|收招|after.{0,30}(?:swip|claw)|(?:swip|claw).{0,25}(?:recover|end|finish)/.test(intent);
  const lure = /牵制|吸引|引开|诱导|引走|诱敌|分散|distract|lure|draw.{0,12}(?:away|attention)|decoy/.test(intent);
  if (!recovery || !lure) return fail('牵制模块需要「挥爪收招」和「牵制」两项信息，例如「挥爪后让阿树从右边引开它」。');
  const left = /左|\bleft\b/.test(intent), right = /右|\bright\b/.test(intent);
  if (left===right) return fail('阿树需要明确的牵制点。请在意图里选「左侧」或「右侧」，然后重新生成。');
  return {ok:true,rule:{kind,side:left?'left':'right',maxRange}};
}
