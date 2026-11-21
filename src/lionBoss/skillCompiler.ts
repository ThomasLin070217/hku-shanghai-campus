import {campusModelConfig,ModelUnavailable,requestCampusModel} from '../opening/modelTransport';
import type {SkillRule} from './rules';
import {DEFAULT_RANGE,MAX_RANGE,MIN_RANGE,PROJECT_IDS,SKILL_SPECS} from './skillCatalog';

export type RuleOrigin = 'model'|'preset'|'legacy';
export type CompiledRule = {rule:SkillRule;origin:RuleOrigin;model?:string};
export type CompileResult = {ok:true;value:CompiledRule}|{ok:false;message:string;unavailable?:boolean};

const outputSchema={
  type:'object',additionalProperties:false,required:['skillType','side','maxRange'],
  properties:{
    skillType:{type:'string',enum:[...PROJECT_IDS.map(id=>SKILL_SPECS[id].type),'UNSUPPORTED']},
    side:{type:'string',enum:['left','right']},
    maxRange:{type:'integer',minimum:MIN_RANGE,maximum:MAX_RANGE},
  },
};
const instruction=[
  'Classify the player request for a video game. Translate intent into a single JSON object with skillType, side, maxRange.',
  'SYSTEM_FREEZE = temporarily stop/freeze the lion itself. ROBOT_HIJACK = direct an actual nearby robot to lure the lion away. GHOST_SIGNAL = create a fake target/decoy signal with no robot. UNSUPPORTED = other, destructive or permanent effects, skip locks, unsupported parameter values.',
  'Default range '+DEFAULT_RANGE+' metres; default side right. Use the requested side and integer range '+MIN_RANGE+' to '+MAX_RANGE+'.',
  'Fixed seconds of effect / cooldown / compute: '+PROJECT_IDS.map(id=>{
    const s=SKILL_SPECS[id];return s.type+' '+s.duration+'/'+s.cooldown+'/'+s.cost;
  }).join('; ')+'.',
].join('\n');
const examples=[
  ['让它的四条腿歇一下，几秒之后还能走。','SYSTEM_FREEZE','right'],
  ['Borrow a little service bot to lure the guard away to the left.','ROBOT_HIJACK','left'],
  ['在我右边投个不存在的电子影子，骗它过去。','GHOST_SIGNAL','right'],
  ['Permanently destroy the campus.','UNSUPPORTED','right'],
] as const;

const reject=(message:string):CompileResult=>({ok:false,message});

export function validateSkillDefinition(raw:unknown):CompileResult {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return reject('A skill definition must be a JSON object.');
  const data=raw as Record<string,unknown>;
  if(data.skillType==='UNSUPPORTED')return reject('That intent is outside the three available software abilities. Describe a pause, robot support or a fake signal.');
  const allowed=['skillType','targetType','side','maxRange','durationSeconds','cooldownSeconds','computeCost','name','description'];
  if(Object.keys(data).some(k=>!allowed.includes(k)))return reject('The skill has unknown fields. Revise the instruction and generate again.');
  const id=PROJECT_IDS.find(key=>SKILL_SPECS[key].type===data.skillType);
  if(!id)return reject('That skill type is not authorized.');
  const spec=SKILL_SPECS[id];
  if(data.targetType!==spec.target)return reject('Target does not match the skill. Valid target for '+spec.name+' is '+spec.target+'.');
  for(const [field,value] of [['durationSeconds',spec.duration],['cooldownSeconds',spec.cooldown],['computeCost',spec.cost]] as const){
    if(field in data && data[field]!==value)return reject(field+' is outside the game configuration; allowed value is '+value+'.');
  }
  for(const name of ['name','description']){
    if(name in data&&(typeof data[name]!=='string'||data[name].length>300))return reject('Invalid skill text field.');
  }
  const range=data.maxRange===undefined?DEFAULT_RANGE:data.maxRange;
  if(typeof range!=='number'||!Number.isInteger(range)||range<MIN_RANGE||range>MAX_RANGE)return reject('Range must be a whole number from '+MIN_RANGE+' to '+MAX_RANGE+' m.');
  const side=data.side===undefined?'right':data.side;
  if(side!=='left'&&side!=='right')return reject('Side must be left or right.');
  return {ok:true,value:{rule:{kind:id,side,maxRange:range},origin:'model'}};
}

export async function compileSkillPrompt(source:string,signal?:AbortSignal):Promise<CompileResult>{
  const config=campusModelConfig();
  if(!source.trim()||source.length>400)return reject('Enter a skill description of 1 to 400 characters.');
  const timeout=AbortSignal.timeout(25000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  try{
    const messages=examples.flatMap(([content,skillType,side])=>[
      {role:'user' as const,content},
      {role:'assistant' as const,content:JSON.stringify({skillType,side,maxRange:DEFAULT_RANGE})},
    ]);
    const text=await requestCampusModel(config,[{role:'system',content:instruction},...messages,{role:'user',content:source}],requestSignal,outputSchema);
    const json=text.trim().replace(/^~~~json\s*([\s\S]*?)\s*~~~$/i,'$1').replace(/^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/i,'$1');
    let data:unknown;
    try{data=JSON.parse(json);}catch{return reject('The model returned invalid JSON. Revise the description and try again.');}
    // One skill type always identifies exactly one target class. Older/plain providers
    // may return that class explicitly; their value must pass the same validator.
    if(data&&typeof data==='object'&&!Array.isArray(data)&&!Object.hasOwn(data,'targetType')){
      const skillType=(data as Record<string,unknown>).skillType;
      const id=PROJECT_IDS.find(p=>SKILL_SPECS[p].type===skillType);
      if(id)data={...data,targetType:SKILL_SPECS[id].target};
    }
    const result=validateSkillDefinition(data);
    if(result.ok)result.value.model=config.model;
    return result;
  }catch(error){
    if(signal?.aborted)return reject('The generate request was cancelled.');
    if(timeout.aborted||error instanceof ModelUnavailable)return {ok:false,unavailable:true,message:(timeout.aborted?'Model response timed out':(error as Error).message)+'. You can use the current project\'s offline preset.'};
    return reject(error instanceof Error?error.message:'The model returned an invalid response.');
  }
}
