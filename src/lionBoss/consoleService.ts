import {compileBossIntent as readLegacyIntent} from './intent';
import {campusModelConfig} from '../opening/modelTransport';
import {evaluateSkill,type SkillRule} from './rules';
import {compileSkillPrompt,validateSkillDefinition,type CompiledRule,type RuleOrigin} from './skillCompiler';
import {COMPUTE_BUDGET,DEFAULT_RANGE,isProjectId,PROJECT_IDS,SKILL_SPECS,SLOT_COUNT,type ProjectId} from './skillCatalog';
export type {ProjectId} from './skillCatalog';

export type ConsoleResult<T>={ok:true;value:T}|{ok:false;message:string;unavailable?:boolean};
export interface SkillProject {id:ProjectId;name:string;target:string;category:string;description:string;example:string;supported:boolean}
export interface SkillPlan {
  project:ProjectId;source:string;condition:string;effect:string;duration:number|null;cooldown:number|null;computeCost:number|null;
  origin?:RuleOrigin; model?:string;
  definition?:Readonly<{skillType:string;targetType:string;maxRange:number;side:'left'|'right';durationSeconds:number;cooldownSeconds:number;computeCost:number}>;
}
export interface ValidationCase {name:string;expected:boolean;actual:boolean;detail:string}
export interface CompileSlots {capacity:number;equipped:Partial<Record<ProjectId,string>>;budget:{available:number;total:number}|null}
export interface VibeService {
  name:string;projects:readonly SkillProject[];slots():CompileSlots;draft(id:ProjectId):string;edit(id:ProjectId,source:string):void;
  preview(id:ProjectId,source:string):Promise<ConsoleResult<SkillPlan>>;
  preset?(id:ProjectId,source:string,side?:'left'|'right'):Promise<ConsoleResult<SkillPlan>>;
  test(plan:SkillPlan):Promise<ConsoleResult<ValidationCase[]>>;install(plan:SkillPlan):Promise<ConsoleResult<void>>;
  uninstall?(id:ProjectId):Promise<ConsoleResult<void>>;
  installedPlan?(id:ProjectId):SkillPlan|null;blockedReason?(plan:SkillPlan):string|null;
  getFieldRule(kind:ProjectId):SkillRule|null;cooldown(id:ProjectId):number|null;reset():void;
}
const projects:SkillProject[]=[
  {id:'stun',name:SKILL_SPECS.stun.name,target:'L001',category:'控制',description:'暂停狮子的运动和攻击，接近防御装置。',supported:true,
    example:'我想让狮子的运动系统停止三秒，并且在技能结束后自动恢复，不能永久损坏它。'},
  {id:'lure',name:SKILL_SPECS.lure.name,target:'附近协助机器人',category:'机器人协作',description:'临时接管附近的维修机器人，令狮子转向追逐它。',supported:true,
    example:'请暂时接管附近的机器人，让它从左侧把狮子引走，给我时间接近防御锁。'},
  {id:'ghost',name:SKILL_SPECS.ghost.name,target:'草坪信标点',category:'目标转移',description:'投放电子假目标，让狮子追向指定侧翼。',supported:true,
    example:'在草坪右侧制造一个假目标信号，引开机械狮子。'},
];
const fail=(message:string)=>({ok:false as const,message});
const denied='请在安全维护区，使用已获准连接的 MacBook 编译。';
type Installed=CompiledRule&{source:string;slot:number};
type Candidate={draftProject:ProjectId;compiled:CompiledRule;passed:boolean};

function describe(compiled:CompiledRule,source:string):SkillPlan {
  const {rule,origin,model}=compiled,id=rule.kind,spec=SKILL_SPECS[id],side=rule.side==='left'?'左':'右';
  const effect=id==='stun'?'暂停运动和攻击':id==='lure'?'协助机器人移动到'+side+'侧，吸引狮子追逐':'在'+side+'侧投放电子信号并转移狮子的目标';
  const definition=Object.freeze({skillType:spec.type,targetType:spec.target,maxRange:rule.maxRange??DEFAULT_RANGE,side:rule.side,
    durationSeconds:spec.duration,cooldownSeconds:spec.cooldown,computeCost:spec.cost});
  return {project:id,source,origin,model,effect,definition,duration:spec.duration,cooldown:spec.cooldown,computeCost:spec.cost,
    condition:'目标在 '+(rule.maxRange??DEFAULT_RANGE)+' m 内；狮子处于活动状态'+(id==='lure'?'，并有可接管机器人':'')};
}
function runCases(rule:SkillRule):ValidationCase[] {
  const range=rule.maxRange??DEFAULT_RANGE;
  const base={phase:'chargeWarn',distance:range,cooldown:0,helperReady:true};
  const samples=[
    {name:'合法目标',expected:true,ctx:base},{name:'冲撞已出手',expected:false,ctx:{...base,phase:'charge'}},
    {name:'超出射程',expected:false,ctx:{...base,distance:range+1}},{name:'冷却中',expected:false,ctx:{...base,cooldown:2}},
  ];
  if(rule.kind==='lure')samples.push({name:'机器人离线',expected:false,ctx:{...base,helperReady:false}});
  return samples.map(({name,expected,ctx})=>{
    const result=evaluateSkill(rule,ctx);
    return {name,expected,actual:result.ok,detail:ctx.distance+' m · '+result.message};
  });
}

export function createLawnVibeService(storageKey:string,keys:{stun:string;lure:string},getCooldown:(id:ProjectId)=>number,
  canCompile:()=>boolean=()=>true):VibeService {
  const drafts:Record<ProjectId,string>={stun:'',lure:'',ghost:''};
  const installed=new Map<ProjectId,Installed>(),candidates=new Map<SkillPlan,Candidate>();
  const requests=new Map<ProjectId,AbortController>();
  function slots():CompileSlots{
    const equipped:CompileSlots['equipped']={};
    let available=COMPUTE_BUDGET;
    for(const [id,data] of [...installed].sort((a,b)=>a[1].slot-b[1].slot)){
      equipped[id]=data.slot===0?keys.stun:keys.lure;available-=SKILL_SPECS[id].cost;
    }
    return {capacity:SLOT_COUNT,equipped,budget:{available,total:COMPUTE_BUDGET}};
  }
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify({version:2,drafts,installed:[...installed.values()]}));}catch{/* An in-memory session remains usable. */}}
  try{
    const save=JSON.parse(localStorage.getItem(storageKey)??'null');
    if(save?.version===1){
      for(const [slot,id] of (['stun','lure'] as const).entries()){
        const old=save.slots?.[id];
        if(typeof old?.draft==='string')drafts[id]=old.draft.slice(0,400);
        if(typeof old?.source!=='string'||!old.source)continue;
        const source=old.source.slice(0,400),legacy=readLegacyIntent(source,id);
        if(legacy.ok)installed.set(id,{rule:legacy.rule,origin:'legacy',source,slot});
      }
      if(typeof save.ghostDraft==='string')drafts.ghost=save.ghostDraft.slice(0,400);
      persist();
    }else if(save?.version===2){
      for(const id of PROJECT_IDS)if(typeof save.drafts?.[id]==='string')drafts[id]=save.drafts[id].slice(0,400);
      for(const item of Array.isArray(save.installed)?save.installed.slice(0,SLOT_COUNT):[]){
        const id=item?.rule?.kind;
        if(!isProjectId(id)||installed.has(id)||typeof item.source!=='string'||![0,1].includes(item.slot)||[...installed.values()].some(s=>s.slot===item.slot))continue;
        const spec=SKILL_SPECS[id];
        const parsed=validateSkillDefinition({skillType:spec.type,targetType:spec.target,maxRange:item.rule.maxRange,side:item.rule.side});
        if(parsed.ok)installed.set(id,{...parsed.value,origin:['model','preset','legacy'].includes(item.origin)?item.origin:'legacy',
          model:typeof item.model==='string'?item.model.slice(0,120):undefined,source:item.source.slice(0,400),slot:item.slot});
      }
    }
  }catch{/* Ignore malformed or unavailable storage. */}
  function invalidate(id:ProjectId){
    requests.get(id)?.abort();requests.delete(id);
    for(const [plan,receipt] of candidates)if(receipt.draftProject===id||plan.project===id)candidates.delete(plan);
  }
  function block(id:ProjectId){
    if(!canCompile())return denied;
    if(installed.has(id))return null;
    if(installed.size>=SLOT_COUNT)return '两个技能槽已满。先从左栏卸载一个已装备技能。';
    if(slots().budget!.available<SKILL_SPECS[id].cost)return '备用超算剩余算力不足。';
    return null;
  }
  function candidate(id:ProjectId,source:string,compiled:CompiledRule):ConsoleResult<SkillPlan>{
    const plan=Object.freeze(describe(compiled,source));
    candidates.set(plan,{draftProject:id,compiled,passed:false});
    return {ok:true,value:plan};
  }
  return {
    get name(){
      const config=campusModelConfig();
      return config.offline?'B4 备用超算 · 离线预设可用':'B4 备用超算 · '+config.model;
    },
    projects,slots,draft:id=>drafts[id],
    edit(id,source){if(!isProjectId(id)||typeof source!=='string')return;invalidate(id);drafts[id]=source.slice(0,400);persist();},
    async preview(id,source){
      if(!canCompile()||!isProjectId(id))return fail(denied);
      if(drafts[id]!==source)return fail('请先保存当前草稿。');
      invalidate(id);
      const controller=new AbortController();requests.set(id,controller);
      const result=await compileSkillPrompt(source,controller.signal);
      if(requests.get(id)!==controller||!canCompile())return fail('草稿或设备权限已改变，请重新生成。');
      requests.delete(id);
      return result.ok?candidate(id,source,result.value):result;
    },
    async preset(id,source,side='right'){
      if(!canCompile()||!isProjectId(id))return fail(denied);
      if(!['left','right'].includes(side)||drafts[id]!==source)return fail('预设参数或草稿已改变，请重新检查。');
      invalidate(id);
      return candidate(id,source,{origin:'preset',rule:{kind:id,side,maxRange:DEFAULT_RANGE}});
    },
    async test(plan){
      const c=candidates.get(plan);if(!canCompile()||!c)return fail('请回到设备并重新生成当前草稿。');
      const cases=runCases(c.compiled.rule);c.passed=cases.every(s=>s.expected===s.actual);
      return {ok:true,value:cases};
    },
    async install(plan){
      const c=candidates.get(plan);
      if(!c?.passed||drafts[c.draftProject]!==plan.source)return fail('请先生成并测试当前草稿。');
      const id=c.compiled.rule.kind,reason=block(id);if(reason)return fail(reason);
      const slot=installed.get(id)?.slot??([0,1].find(i=>![...installed.values()].some(s=>s.slot===i))!);
      installed.set(id,{...c.compiled,source:plan.source,slot});
      if(c.draftProject!==id){invalidate(id);drafts[id]=plan.source;}
      candidates.delete(plan);persist();return {ok:true,value:undefined};
    },
    async uninstall(id){
      if(!canCompile())return fail(denied);
      if(!installed.delete(id))return fail('这个项目未装备。');
      invalidate(id);persist();return {ok:true,value:undefined};
    },
    installedPlan(id){const data=installed.get(id);return data?describe(data,data.source):null;},
    blockedReason:plan=>block(plan.project),
    getFieldRule(id){const rule=installed.get(id)?.rule;return rule?{...rule}:null;},
    cooldown:getCooldown,
    reset(){for(const id of PROJECT_IDS){invalidate(id);drafts[id]='';}installed.clear();persist();},
  };
}
