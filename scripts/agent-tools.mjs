import {readFileSync} from 'node:fs';
export const protocolVersion='hku-campus/2.0';
const action=JSON.parse(readFileSync(new URL('../src/agent/action.schema.json',import.meta.url),'utf8'));
const object=properties=>({type:'object',properties,additionalProperties:false});
const epoch={type:'integer',minimum:0};
const vec3={type:'array',items:{type:'number'},minItems:3,maxItems:3};
const entityQuery=object({q:{type:'string',maxLength:160},kind:{enum:['campus','building','road','area','group','part']},parentId:{type:'string'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100},near:vec3,radius:{type:'number',minimum:0,maximum:500}});
const directiveBase={commandId:{type:'string',pattern:'^[a-zA-Z0-9_.:-]{1,80}$'},controlEpoch:epoch,position:vec3,entityId:{type:'string',maxLength:100},durationMs:{type:'integer',minimum:1,maximum:30000}};
const walkTo=object({...directiveBase,toleranceM:{type:'number',exclusiveMinimum:0,maximum:10},sprint:{type:'boolean'}});
walkTo.description='Exactly one of position or entityId is required (mutually exclusive).';
const lookAt=object({...directiveBase,toleranceDeg:{type:'number',exclusiveMinimum:0,maximum:180}});
lookAt.description='Exactly one of position or entityId is required (mutually exclusive).';
export const agentTools=[
 {name:'campus_observe',description:'Read player, physics, survey, inventory, perception and control state. An active lawn encounter adds boss FSM, installed skills, cooldowns, budget, locks and core power. Optional afterSeq returns events with seq>afterSeq (max 100). Read-only; no AI grant required.',inputSchema:object({afterSeq:{type:'integer',minimum:0}}),method:'GET',path:'/observe'},
 {name:'campus_entities',description:'Find stable scene IDs by name, category, parent or nearby world position. Paginated. Building B04, road R005, school monument S001.',inputSchema:entityQuery,method:'GET',path:'/entities'},
 {name:'campus_entity',description:'Get one stable scene ID: bounds, source file, edit anchor, reference, relative position and children.',inputSchema:{...object({id:{type:'string',maxLength:100}}),required:['id']},method:'GET',path:'/entities/{id}'},
 {name:'campus_acquire_control',description:'Acquire after the human explicitly enables AI in the game. Never auto-enables AI.',inputSchema:{...object({agentId:{type:'string',pattern:'^[a-zA-Z0-9_.:-]{1,80}$'}}),required:['agentId']},method:'POST',path:'/acquireControl'},
 {name:'campus_act',description:'Camera-relative input through normal character physics. New action replaces old; TTL <=1000ms (directive actions 1-30000ms); jump/look/view are once-only. In the lawn, standalone boss.compile accepts a 1–30000 ms action, boss.cast a 1–1000 ms action. Check the command receipt.',inputSchema:action,method:'POST',path:'/act'},
 {name:'campus_command',description:'Query actual accepted/running/completed/blocked/interrupted/expired result. directive snapshots are in command.directive.',inputSchema:{...object({commandId:{type:'string'}}),required:['commandId']},method:'GET',path:'/commands/{commandId}'},
 {name:'campus_select_entity',description:'Highlight an entity without teleporting or moving the camera. Needs current controlEpoch and scene revision. Geometry editing is done in the source file returned by campus_entity.',inputSchema:{...object({id:{type:'string'},controlEpoch:epoch,sceneRevision:{type:'string'}}),required:['id','controlEpoch','sceneRevision']},method:'POST',path:'/scene/select'},
 {name:'campus_stop',description:'Clear AI movement intent; airborne character still lands through physics.',inputSchema:{...object({controlEpoch:epoch}),required:['controlEpoch']},method:'POST',path:'/stop'},
 {name:'campus_release_control',description:'Release ownership and invalidate the epoch.',inputSchema:{...object({controlEpoch:epoch}),required:['controlEpoch']},method:'POST',path:'/releaseControl'},
 {name:'campus_screenshot',description:'Capture only when needed; separate from state queries.',inputSchema:object({}),method:'POST',path:'/screenshot'},
 {name:'campus_events',description:'Read the server-side event ring buffer (2048 events, monotonic seq). Use afterSeq for incremental reads. Works without an AI grant; empty snapshot while the game is disconnected.',inputSchema:object({afterSeq:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}}),method:'GET',path:'/events'},
 {name:'campus_path',description:'Plan a walkable route with the in-game navigation mesh (A*, 1 m grid, steps/ramps allowed). Returns path points, length, reachable/partial. Read-only.',inputSchema:{...object({from:vec3,to:vec3,clearance:{type:'number',minimum:0,maximum:5},maxNodes:{type:'integer',minimum:1,maximum:1000000}}),required:['from','to']},method:'GET',path:'/path'},
 {name:'campus_world',description:'World summary for context warm-up: buildings, roads, areas, landmarks, survey targets, walkable bounds and control rules. Read-only.',inputSchema:object({}),method:'GET',path:'/world'},
 {name:'campus_walk_to',description:'Walk to a world position or stable entity/landmark ID through normal character physics (no teleport). position and entityId are mutually exclusive. durationMs default 15000, max 30000. Acquire control first.',inputSchema:{...walkTo,required:['commandId','controlEpoch']},method:'POST',path:'/act',directive:'walkTo',directiveDurationMs:15000},
 {name:'campus_look_at',description:'Turn the camera toward a world position or stable entity/landmark ID. position and entityId are mutually exclusive. durationMs default 3000, max 30000. Acquire control first.',inputSchema:{...lookAt,required:['commandId','controlEpoch']},method:'POST',path:'/act',directive:'lookAt',directiveDurationMs:3000},
];
const directiveTools=new Map(agentTools.filter(tool=>tool.directive).map(tool=>[tool.name,tool]));
const directiveArgs=name=>{
 const tool=directiveTools.get(name),walk=name==='campus_walk_to';
 return{type:tool.directive,allowed:['commandId','controlEpoch','position','entityId','durationMs',walk?'toleranceM':'toleranceDeg',...(walk?['sprint']:[])],durationMs:tool.directiveDurationMs,tolerance:walk?'toleranceM':'toleranceDeg',toleranceMax:walk?10:180};
};
function translateDirective(name,args){
 const spec=directiveArgs(name),walk=name==='campus_walk_to';
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('invalid_arguments');
 for(const key of Object.keys(args))if(!spec.allowed.includes(key))throw Error('unknown_field_'+key);
 if(typeof args.commandId!=='string'||!/^[a-zA-Z0-9_.:-]{1,80}$/.test(args.commandId))throw Error('invalid_command_id');
 if(!Number.isSafeInteger(args.controlEpoch)||args.controlEpoch<0)throw Error('invalid_controlEpoch');
 const hasPosition=args.position!==undefined,hasEntity=args.entityId!==undefined;
 if(hasPosition&&hasEntity)throw Error('position_and_entityId_mutually_exclusive');
 if(!hasPosition&&!hasEntity)throw Error('position_or_entityId_required');
 if(hasPosition){if(!Array.isArray(args.position)||args.position.length!==3||!args.position.every(Number.isFinite))throw Error('invalid_position');}
 else if(typeof args.entityId!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(args.entityId))throw Error('invalid_entityId');
 let durationMs=args.durationMs===undefined?spec.durationMs:args.durationMs;
 if(!Number.isInteger(durationMs)||durationMs<1||durationMs>30000)throw Error('invalid_durationMs');
 const directive={type:spec.type};
 if(hasPosition)directive.position=args.position;else directive.entityId=args.entityId;
 if(args[spec.tolerance]!==undefined){const value=args[spec.tolerance];if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>spec.toleranceMax)throw Error('invalid_'+spec.tolerance);directive[spec.tolerance]=value;}
 if(walk&&args.sprint!==undefined){if(typeof args.sprint!=='boolean')throw Error('invalid_sprint');directive.sprint=args.sprint;}
 return{commandId:args.commandId,controlEpoch:args.controlEpoch,durationMs,directive};
}
export function capabilities(ready){return{ok:true,protocolVersion,ready,sceneSchema:'hku-scene/1',features:['events-sse','perception','directives','path','world','lawn-vibe'],endpoints:{health:'GET /health',capabilities:'GET /capabilities',observe:'GET /observe?afterSeq=N',events:'GET /events?afterSeq=N&limit=100',eventsStream:'GET /events/stream?afterSeq=N',path:'GET /path?from=[x,y,z]&to=[x,y,z]&clearance=0.34&maxNodes=20000',world:'GET /world',entities:'GET /entities?...',entity:'GET /entities/{id}',command:'GET /commands/{commandId}',acquireControl:'POST /acquireControl',act:'POST /act',stop:'POST /stop',releaseControl:'POST /releaseControl',selectEntity:'POST /scene/select',screenshot:'POST /screenshot'},mcp:{resources:3,prompts:1},limits:{actionMaxMs:1000,directiveMaxMs:30000,bossCompileMaxMs:30000,queryLimit:100,eventBuffer:2048,eventPushMax:64,sseHeartbeatMs:10000,control:'explicit user enable; epoch revocation on human takeover',editing:'source code; entity endpoint supplies file and anchor'},tools:agentTools};}
export async function callAgent(name,args={},base=process.env.HKU_AGENT_URL||'http://127.0.0.1:8788'){
 const tool=agentTools.find(t=>t.name===name);if(!tool)throw Error('unknown_tool');
 let path=tool.path;const consumed=new Set();
 for(const key of ['id','commandId'])if(path.includes('{'+key+'}')){if(typeof args[key]!=='string')throw Error('missing_'+key);path=path.replace('{'+key+'}',encodeURIComponent(args[key]));consumed.add(key);}
 const url=new URL(path,base);
 if(tool.method==='GET'){
  for(const [key,value]of Object.entries(args)){if(consumed.has(key)||value===undefined)continue;url.searchParams.set(key,typeof value==='object'&&value!==null?JSON.stringify(value):String(value));}
  const response=await fetch(url,{signal:AbortSignal.timeout(5000)});return response.json();
 }
 const body=directiveTools.has(name)?translateDirective(name,args):args;
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});return response.json();
}
