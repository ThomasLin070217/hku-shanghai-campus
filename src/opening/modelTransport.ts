import {LOCAL_TOOLS} from '../agent/localTools';

/**
 * Model transport shared by the Harness assistant (岚) and the lawn skill
 * compiler (src/lionBoss/skillCompiler.ts).
 *
 * The default endpoint is the loopback bridge `scripts/llm-bridge.mjs`, which
 * holds the provider key server-side; the browser never sees a key. Overrides:
 *   localStorage['hku.opening.agent.endpoint'] / ['hku.opening.agent.model'] / ['hku.opening.agent.offline']='1'
 *   build-time VITE_CAMPUS_MODEL_ENDPOINT / VITE_CAMPUS_MODEL_NAME (public path and model name only).
 */
export const ASSISTANT_DEFAULT_ENDPOINT='http://127.0.0.1:8790/api/chat';
export const ASSISTANT_DEFAULT_MODEL='deepseek-flash';
/** A loopback endpoint only exists when the runner started the bridge; a shipped page has none. */
const LOOPBACK_ENDPOINT=/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/;

export interface ModelConfig {endpoint:string;model:string;offline:boolean}
export interface ModelTurn {role:'system'|'user'|'assistant';content:string}
export interface ModelReply {text:string;model?:string}

function setting(key:string):string|null {
  try{
    const value=globalThis.localStorage?.getItem('hku.opening.agent.'+key);
    return value===null||value===undefined?null:value.trim();
  }catch{return null;}
}

export function campusModelConfig():ModelConfig {
  const env=import.meta.env;
  const builtEndpoint=(env?.VITE_CAMPUS_MODEL_ENDPOINT??'').trim();
  // Static playtest builds stay on the built-in core unless the team baked in its own proxy.
  if(env?.MODE==='playtest'&&!builtEndpoint)return {endpoint:'',model:'built-in',offline:true};
  const endpoint=setting('endpoint')??(builtEndpoint||ASSISTANT_DEFAULT_ENDPOINT);
  const model=setting('model')??((env?.VITE_CAMPUS_MODEL_NAME??'').trim()||ASSISTANT_DEFAULT_MODEL);
  // A loopback bridge is local tooling: on a shipped page it is either absent
  // (http) or blocked as mixed content (https), so answer from the built-in
  // core instead of spending a round trip on a request that cannot succeed.
  const localEndpoint=LOOPBACK_ENDPOINT.test(endpoint)&&!LOCAL_TOOLS;
  return {endpoint,model,offline:!endpoint||!model||setting('offline')==='1'||localEndpoint};
}

/** The endpoint could not be reached (`status` unset) or answered with an HTTP error. */
export class ModelUnavailable extends Error {
  constructor(message:string,readonly status?:number){super(message);}
}
export class InvalidModelResponse extends Error {}

function readMessage(body:unknown):string | null {
  if(!body || typeof body!=='object')return null;
  const payload=body as {message?:{content?:unknown};response?:unknown;choices?:{message?:{content?:unknown};text?:unknown}[]};
  const text=payload.choices?.[0]?.message?.content??payload.message?.content??payload.response??payload.choices?.[0]?.text;
  return typeof text==='string'&&text.trim()?text.trim():null;
}

export async function requestCampusModelReply(config:ModelConfig,messages:ModelTurn[],signal:AbortSignal,schema?:Record<string,unknown>):Promise<ModelReply> {
  if(config.offline)throw new ModelUnavailable('没有启用 MacBook 模型连接');
  // Ollama's native API takes `options` / `format`. The loopback bridge also serves
  // `/api/chat` but speaks the OpenAI shape, so match Ollama by port or name only.
  const ollama=/11434|ollama/i.test(config.endpoint);
  const temperature=schema?0:.4;
  const base={model:config.model,stream:false,messages,...(ollama?{options:{temperature}}:{temperature})};
  const format=ollama?{format:schema}:{response_format:{type:'json_schema',json_schema:{name:'campus_skill',strict:true,schema}}};
  const post=async(payload:unknown)=>{
    try{return await fetch(config.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal});}
    catch(error){if(signal.aborted)throw error;throw new ModelUnavailable('模型服务连接失败');}
  };
  let response=await post(schema?{...base,...format}:base);
  // Some OpenAI-compatible adapters support text completions but do not implement response_format.
  if(schema&&[400,415,422,501].includes(response.status))response=await post(base);
  if(!response.ok)throw new ModelUnavailable('模型接口返回 HTTP '+response.status,response.status);
  let body:unknown;
  try{body=await response.json();}catch{throw new InvalidModelResponse('模型响应不是有效 JSON');}
  const reply=readMessage(body);
  if(!reply)throw new InvalidModelResponse('模型没有返回可读取的消息');
  const model=(body as {model?:unknown}).model;
  return {text:reply,model:typeof model==='string'&&model?model:undefined};
}

export async function requestCampusModel(config:ModelConfig,messages:ModelTurn[],signal:AbortSignal,schema?:Record<string,unknown>):Promise<string> {
  return (await requestCampusModelReply(config,messages,signal,schema)).text;
}
