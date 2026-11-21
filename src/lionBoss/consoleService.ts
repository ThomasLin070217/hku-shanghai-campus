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
  {id:'stun',name:SKILL_SPECS.stun.name,target:'L001',category:'Control',description:'Pause lion movement and attacks, then approach the defense device.',supported:true,
    example:'I want to stop the lion\'s movement system for three seconds and have it recover afterwards, without permanent damage.'},
  {id:'lure',name:SKILL_SPECS.lure.name,target:'Nearby helper robot',category:'Robot support',description:'Temporarily take over a nearby maintenance robot and make the lion chase it.',supported:true,
    example:'Take over the nearby robot for a moment and have it draw the lion away to the left, so I can reach the defense lock.'},
  {id:'ghost',name:SKILL_SPECS.ghost.name,target:'Lawn beacon point',category:'Target diversion',description:'Drop a fake electronic target so the lion chases the chosen flank.',supported:true,
    example:'Create a fake target signal on the right side of the lawn to draw the mechanical lion away.'},
];
const fail=(message:string)=>({ok:false as const,message});
const denied='Compile from the maintenance area on an approved MacBook.';
type Installed=CompiledRule&{source:string;slot:number};
type Candidate={draftProject:ProjectId;compiled:CompiledRule;passed:boolean};

function describe(compiled:CompiledRule,source:string):SkillPlan {
  const {rule,origin,model}=compiled,id=rule.kind,spec=SKILL_SPECS[id],side=rule.side==='left'?'left':'right';
  const effect=id==='stun'?'Pause movement and attacks':id==='lure'?'Helper robot moves to the '+side+' side and draws the lion\'s chase':'Drop an electronic signal on the '+side+' side and redirect the lion\'s target';
  const definition=Object.freeze({skillType:spec.type,targetType:spec.target,maxRange:rule.maxRange??DEFAULT_RANGE,side:rule.side,
    durationSeconds:spec.duration,cooldownSeconds:spec.cooldown,computeCost:spec.cost});
  return {project:id,source,origin,model,effect,definition,duration:spec.duration,cooldown:spec.cooldown,computeCost:spec.cost,
    condition:'Target within '+(rule.maxRange??DEFAULT_RANGE)+' m; the lion is active'+(id==='lure'?'; a robot is available to take over':'')};
}
function runCases(rule:SkillRule):ValidationCase[] {
  const range=rule.maxRange??DEFAULT_RANGE;
  const base={phase:'chargeWarn',distance:range,cooldown:0,helperReady:true};
  const samples=[
    {name:'Valid target',expected:true,ctx:base},{name:'Charge already launched',expected:false,ctx:{...base,phase:'charge'}},
    {name:'Out of range',expected:false,ctx:{...base,distance:range+1}},{name:'Cooling down',expected:false,ctx:{...base,cooldown:2}},
  ];
  if(rule.kind==='lure')samples.push({name:'Robot offline',expected:false,ctx:{...base,helperReady:false}});
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
    if(installed.size>=SLOT_COUNT)return 'Both skill slots are full. Uninstall an equipped skill from the left column first.';
    if(slots().budget!.available<SKILL_SPECS[id].cost)return 'The backup supercomputer has no compute left.';
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
      return config.offline?'B4 backup supercomputer · offline presets available':'B4 backup supercomputer · '+config.model;
    },
    projects,slots,draft:id=>drafts[id],
    edit(id,source){if(!isProjectId(id)||typeof source!=='string')return;invalidate(id);drafts[id]=source.slice(0,400);persist();},
    async preview(id,source){
      if(!canCompile()||!isProjectId(id))return fail(denied);
      if(drafts[id]!==source)return fail('Save the current draft first.');
      invalidate(id);
      const controller=new AbortController();requests.set(id,controller);
      const result=await compileSkillPrompt(source,controller.signal);
      if(requests.get(id)!==controller||!canCompile())return fail('The draft or device permission changed. Generate again.');
      requests.delete(id);
      return result.ok?candidate(id,source,result.value):result;
    },
    async preset(id,source,side='right'){
      if(!canCompile()||!isProjectId(id))return fail(denied);
      if(!['left','right'].includes(side)||drafts[id]!==source)return fail('The preset parameters or draft changed. Check again.');
      invalidate(id);
      return candidate(id,source,{origin:'preset',rule:{kind:id,side,maxRange:DEFAULT_RANGE}});
    },
    async test(plan){
      const c=candidates.get(plan);if(!canCompile()||!c)return fail('Return to the device and regenerate the current draft.');
      const cases=runCases(c.compiled.rule);c.passed=cases.every(s=>s.expected===s.actual);
      return {ok:true,value:cases};
    },
    async install(plan){
      const c=candidates.get(plan);
      if(!c?.passed||drafts[c.draftProject]!==plan.source)return fail('Generate and test the current draft first.');
      const id=c.compiled.rule.kind,reason=block(id);if(reason)return fail(reason);
      const slot=installed.get(id)?.slot??([0,1].find(i=>![...installed.values()].some(s=>s.slot===i))!);
      installed.set(id,{...c.compiled,source:plan.source,slot});
      if(c.draftProject!==id){invalidate(id);drafts[id]=plan.source;}
      candidates.delete(plan);persist();return {ok:true,value:undefined};
    },
    async uninstall(id){
      if(!canCompile())return fail(denied);
      if(!installed.delete(id))return fail('This project is not equipped.');
      invalidate(id);persist();return {ok:true,value:undefined};
    },
    installedPlan(id){const data=installed.get(id);return data?describe(data,data.source):null;},
    blockedReason:plan=>block(plan.project),
    getFieldRule(id){const rule=installed.get(id)?.rule;return rule?{...rule}:null;},
    cooldown:getCooldown,
    reset(){for(const id of PROJECT_IDS){invalidate(id);drafts[id]='';}installed.clear();persist();},
  };
}
