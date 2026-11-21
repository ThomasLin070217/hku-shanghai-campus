import type {SkillRule, SkillKind as Kind} from './rules';

type CompileResult = {ok:true;rule:SkillRule}|{ok:false;message:string};

/** Reads version-one loadouts whose deployed rules were persisted as source text. */
export function compileBossIntent(input:string, kind:Exclude<Kind,'ghost'>):CompileResult {
  const normalized=input.normalize('NFKC').trim().toLowerCase();
  const intent=normalized.replace(/[零一二三四五六七八九](?=\s*(?:米|公尺))/g,ch=>String('零一二三四五六七八九'.indexOf(ch)));
  const fail = (message:string):CompileResult=>({ok:false,message});
  if (!intent) return fail('Write one sentence about what the lion is doing and the effect you want.');
  if (/自动|一直|永久|automatically|permanent|always/.test(intent)) return fail('The workbench supports short manual skills. Describe the attack phase and the effect you want.');

  const distances = Array.from(intent.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:米|公尺|m(?:et(?:er|re)s?)?\b)/g));
  const maxRange = Number(distances[0]?.[1] ?? 8);
  const unsupportedDistance=/[十百千半点零一二三四五六七八九]\s*(?:\d+\s*)?(?:米|公尺)|(?:超过|远于|大于)\s*\d+\s*(?:米|公尺)|\d+\s*(?:米|公尺)(?:以外|之外)|(?:more than|over|beyond|past)\s*\d+\s*(?:m|met(?:er|re)s?)\b|\d+\s*(?:m|met(?:er|re)s?)\s*(?:away|or more)/.test(intent);
  if (unsupportedDistance || distances.length>1 || maxRange<4 || maxRange>8 || !Number.isInteger(maxRange)) {
    return fail('A valid range is a whole number from 4 to 8, like "within 6 m".');
  }
  if (kind==='stun') {
    const charge = /冲(?:撞|锋|刺)|猛冲|charg(?:e|es|ing)|rush|wind.?up|ram|slam/.test(intent);
    const stop = /麻痹|停机|打断|瘫痪|定住|眩晕|定身|制动|停下|stun|stop|interrupt|immobili[sz]e|freeze|halt|shut.?down|disable/.test(intent);
    if (!charge || !stop || /挥爪|冲(?:撞|锋)(?:完|结束|之后|过后)|after (?:the |its )?charge/.test(intent)) {
      return fail('The stun module needs a charge warning and an interrupt, like "shut it down while it winds up a charge".');
    }
    return {ok:true,rule:{kind,side:'right',maxRange}};
  }
  const recovery = /(?:挥|出|拍|扫).{0,4}爪.{0,7}(?:后|完|结束|收)|(?:挥完|收回|收起|挥过|挥了).{0,2}爪|收招|after.{0,30}(?:swip|claw)|(?:swip|claw).{0,25}(?:recover|end|finish)/.test(intent);
  const lure = /牵制|吸引|引开|诱导|引走|诱敌|分散|distract|lure|draw.{0,12}(?:away|attention)|decoy|bait|pull.{0,12}(?:away|aside)/.test(intent);
  if (!recovery || !lure) return fail('The lure module needs a swipe recovery and a distraction, like "after it swipes, have the helper draw it to the right".');
  const left = /左|\bleft\b/.test(intent), right = /右|\bright\b/.test(intent);
  if (left===right) return fail('The helper needs a clear lure side. Say left or right, then generate again.');
  return {ok:true,rule:{kind,side:left?'left':'right',maxRange}};
}
