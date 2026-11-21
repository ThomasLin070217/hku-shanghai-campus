import {compileBossIntent} from './intent';
import {CHARGE_WARNING, SWIPE_WARNING} from './combat';
import {COOLDOWN, STUN_WINDOW, LURE_WINDOW, evaluateSkill, type SkillKind, type SkillRule} from './rules';

export type ProjectId = SkillKind | 'ghost';
export type ConsoleResult<T> = {ok:true; value:T} | {ok:false; message:string};
export interface SkillProject {
  id:ProjectId;
  name:string;
  target:string;
  category:string;
  description:string;
  example:string;
  supported:boolean;
}
export interface SkillPlan {
  project:ProjectId;
  source:string;
  condition:string;
  effect:string;
  duration:number|null;
  cooldown:number|null;
  computeCost:number|null;
}
export interface ValidationCase {name:string; expected:boolean; actual:boolean; detail:string}
export interface CompileSlots {
  capacity:number;
  equipped:Partial<Record<ProjectId,string>>;
  budget:{available:number; total:number}|null;
}
/** The provider owns installation, validation, resources and persistence. A remote
 * compiler may resolve later; the UI only reflects the acknowledged snapshot. */
export interface VibeService {
  name:string;
  projects:readonly SkillProject[];
  slots():CompileSlots;
  draft(id:ProjectId):string;
  edit(id:ProjectId,source:string):void;
  preview(id:ProjectId,source:string):Promise<ConsoleResult<SkillPlan>>;
  test(plan:SkillPlan):Promise<ConsoleResult<ValidationCase[]>>;
  install(plan:SkillPlan):Promise<ConsoleResult<void>>;
  installedPlan?(id:ProjectId):SkillPlan|null;
  blockedReason?(plan:SkillPlan):string|null;
  getFieldRule(kind:SkillKind):SkillRule|null;
  cooldown(id:ProjectId):number|null;
  reset():void;
}
const projects:SkillProject[]=[
  {id:'stun',name:'System Freeze',target:'L001',category:'控制',description:'在冲撞预警时手动打断机械狮子。',supported:true,
    example:'如果 8 米内的狮子正在蓄力冲撞，我按下技能时就让它短暂停机，打断冲撞。'},
  {id:'lure',name:'Robot Hijack',target:'阿树 → L001',category:'机器人协作',description:'在挥爪收招时，指派阿树去侧翼牵制。',supported:true,
    example:'等狮子挥完爪，我按下技能时，让阿树从左侧牵制它。'},
  {id:'ghost',name:'Ghost Signal',target:'电子信标',category:'目标转移',description:'在选定位置产生虚假信号，引开机械狮子。当前草坪运行时尚未提供此能力。',supported:false,
    example:'在草坪左侧生成一个假目标信号，把狮子引过去。'},
];
type Slot={draft:string; source:string; deployed:SkillRule|null};
const empty=():Slot=>({draft:'',source:'',deployed:null});
const fail=(message:string)=>({ok:false as const,message});
function simulate(rule:SkillRule):ValidationCase[] {
  const stun=rule.kind==='stun',distance=rule.maxRange??8;
  const phase=stun?'chargeWarn':'swipeRecover';
  return [
    {name:stun?'冲撞预警':'挥爪收招',phase,distance,expected:true,time:stun?CHARGE_WARNING/2:SWIPE_WARNING+.25},
    {name:'时机错误',phase:stun?'charge':'swipeWarn',distance,expected:false,time:stun?CHARGE_WARNING+.1:SWIPE_WARNING/2},
    {name:'超出射程',phase,distance:distance+1,expected:false,time:0},
  ].map(sample=>{
    const result=evaluateSkill(rule,{...sample,cooldown:0,helperReady:true});
    return {name:sample.name,expected:sample.expected,actual:result.ok,
      detail:sample.distance+' m · '+sample.time.toFixed(2)+' s · '+result.message};
  });
}
function describe(rule:SkillRule,source:string):SkillPlan {
  const stun=rule.kind==='stun';
  return {project:rule.kind,source,condition:'目标在 '+(rule.maxRange??8)+' m 内，'+(stun?'狮子处于冲撞预警':'狮子挥爪收招且阿树就绪'),
    effect:stun?'中止冲撞并暂停运动':'阿树前往'+(rule.side==='left'?'左':'右')+'侧分散注意',
    duration:stun?STUN_WINDOW:LURE_WINDOW,cooldown:COOLDOWN,computeCost:null};
}

/** Backwards compatible adapter for the two real rules delivered with L001.
 * The existing module has no compute meter or Ghost Signal action. */
export function createLawnVibeService(storageKey:string,keys:Record<SkillKind,string>,getCooldown:(id:SkillKind)=>number):VibeService {
  const slots={stun:empty(),lure:empty()};
  let ghostDraft='';
  try {
    const save=JSON.parse(localStorage.getItem(storageKey)??'null');
    if(save?.version===1){
      for(const id of ['stun','lure'] as const){
        const saved=save.slots?.[id];
        if(typeof saved?.draft==='string')slots[id].draft=saved.draft.slice(0,400);
        if(typeof saved?.source==='string'){
          const source=saved.source.slice(0,400),result=compileBossIntent(source,id);
          if(result.ok)Object.assign(slots[id],{source,deployed:result.rule});
        }
      }
      if(typeof save.ghostDraft==='string')ghostDraft=save.ghostDraft.slice(0,400);
    }
  } catch { /* Storage is optional during a play session. */ }
  function persist(){
    try{localStorage.setItem(storageKey,JSON.stringify({version:1,slots,ghostDraft}));}catch{/* Keep playing in memory. */}
  }
  // Preview and test receipts belong to this session. Edits revoke both.
  const candidates=new Map<SkillPlan,{rule:SkillRule;passed:boolean}>();
  return {
    name:'草坪本地规则编译器',projects,
    slots(){
      const equipped:CompileSlots['equipped']={};
      for(const id of ['stun','lure'] as const)if(slots[id].deployed)equipped[id]=keys[id];
      return {capacity:Object.keys(slots).length,equipped,budget:null};
    },
    draft:id=>id==='ghost'?ghostDraft:slots[id].draft,
    edit(id,source){
      for(const plan of candidates.keys())if(plan.project===id)candidates.delete(plan);
      if(id==='ghost')ghostDraft=source.slice(0,400);else slots[id].draft=source.slice(0,400);
      persist();
    },
    async preview(id,source){
      if(id==='ghost')return fail('当前战斗接口未注册 Ghost Signal。草稿可保留，暂时无法生成可部署的技能。');
      const result=compileBossIntent(source,id);
      if(!result.ok)return result;
      const rule=result.rule;
      const plan=describe(rule,source);
      for(const existing of candidates.keys())if(existing.project===id)candidates.delete(existing);
      candidates.set(plan,{rule,passed:false});
      return {ok:true,value:plan};
    },
    async test(plan){
      const receipt=candidates.get(plan);
      if(!receipt)return fail('请重新生成当前草稿。');
      const cases=simulate(receipt.rule);
      receipt.passed=cases.every(c=>c.actual===c.expected);
      return {ok:true,value:cases};
    },
    async install(plan){
      const receipt=candidates.get(plan);
      if(!receipt?.passed||plan.project==='ghost'||slots[plan.project].draft!==plan.source)return fail('当前草稿尚未通过规则测试。');
      slots[plan.project]={draft:plan.source,source:plan.source,deployed:{...receipt.rule}};
      persist();return {ok:true,value:undefined};
    },
    getFieldRule(kind){const rule=slots[kind].deployed;return rule?{...rule}:null;},
    installedPlan(id){if(id==='ghost')return null;const {source,deployed}=slots[id];return deployed?describe(deployed,source):null;},
    cooldown:id=>id==='ghost'?null:getCooldown(id),
    reset(){slots.stun=empty();slots.lure=empty();ghostDraft='';candidates.clear();persist();},
  };
}
