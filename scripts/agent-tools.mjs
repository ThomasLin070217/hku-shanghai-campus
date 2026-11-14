import {readFileSync} from 'node:fs';
export const protocolVersion='hku-campus/1.3';
const action=JSON.parse(readFileSync(new URL('../src/agent/action.schema.json',import.meta.url),'utf8'));
const object=properties=>({type:'object',properties,additionalProperties:false});
const epoch={type:'integer',minimum:0};
const entityQuery=object({q:{type:'string',maxLength:160},kind:{enum:['campus','building','road','area','group','part']},parentId:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100},near:{type:'array',items:{type:'number'},minItems:3,maxItems:3},radius:{type:'number',minimum:0,maximum:500}});
export const agentTools=[
 {name:'campus_observe',description:'Read player, physics, survey, inventory and control state. Read-only; no AI grant required.',inputSchema:object({}),method:'GET',path:'/observe'},
 {name:'campus_entities',description:'Find stable scene IDs by name, category, parent or nearby world position. Paginated. Building B04, road R005, school monument S001.',inputSchema:entityQuery,method:'GET',path:'/entities'},
 {name:'campus_entity',description:'Get one stable scene ID: bounds, source file, edit anchor, reference, relative position and children.',inputSchema:{...object({id:{type:'string',maxLength:100}}),required:['id']},method:'GET',path:'/entities/{id}'},
 {name:'campus_acquire_control',description:'Acquire after the human explicitly enables AI in the game. Never auto-enables AI.',inputSchema:{...object({agentId:{type:'string',pattern:'^[a-zA-Z0-9_.:-]{1,80}$'}}),required:['agentId']},method:'POST',path:'/acquireControl'},
 {name:'campus_act',description:'Camera-relative input through normal character physics. New action replaces old; TTL <=1000ms; jump/look/view are once-only. Check result separately.',inputSchema:action,method:'POST',path:'/act'},
 {name:'campus_command',description:'Query actual accepted/running/completed/blocked/interrupted/expired result.',inputSchema:{...object({commandId:{type:'string'}}),required:['commandId']},method:'GET',path:'/commands/{commandId}'},
 {name:'campus_select_entity',description:'Highlight an entity without teleporting or moving the camera. Needs current controlEpoch and scene revision. Geometry editing is done in the source file returned by campus_entity.',inputSchema:{...object({id:{type:'string'},controlEpoch:epoch,sceneRevision:{type:'string'}}),required:['id','controlEpoch','sceneRevision']},method:'POST',path:'/scene/select'},
 {name:'campus_stop',description:'Clear AI movement intent; airborne character still lands through physics.',inputSchema:{...object({controlEpoch:epoch}),required:['controlEpoch']},method:'POST',path:'/stop'},
 {name:'campus_release_control',description:'Release ownership and invalidate the epoch.',inputSchema:{...object({controlEpoch:epoch}),required:['controlEpoch']},method:'POST',path:'/releaseControl'},
 {name:'campus_screenshot',description:'Capture only when needed; separate from state queries.',inputSchema:object({}),method:'POST',path:'/screenshot'},
];
export function capabilities(ready){return{ok:true,protocolVersion,ready,sceneSchema:'hku-scene/1',limits:{actionMaxMs:1000,queryLimit:100,control:'explicit user enable; epoch revocation on human takeover',editing:'source code; entity endpoint supplies file and anchor'},tools:agentTools};}
export async function callAgent(name,args={},base=process.env.HKU_AGENT_URL||'http://127.0.0.1:8788'){
 const tool=agentTools.find(t=>t.name===name);if(!tool)throw Error('unknown_tool');
 let path=tool.path;for(const key of ['id','commandId'])if(path.includes('{'+key+'}')){if(typeof args[key]!=='string')throw Error('missing_'+key);path=path.replace('{'+key+'}',encodeURIComponent(args[key]));}
 const url=new URL(path,base);if(tool.path==='/entities')for(const [key,value]of Object.entries(args))url.searchParams.set(key,Array.isArray(value)?JSON.stringify(value):String(value));
 const response=await fetch(url,tool.method==='GET'?{signal:AbortSignal.timeout(5000)}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});return response.json();
}
