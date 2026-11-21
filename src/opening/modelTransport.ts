/** Shared by Assistant and Vibe Console. Authenticated model endpoints belong behind a server proxy. */
export interface ModelConfig {endpoint:string;model:string;offline:boolean}
export interface ModelTurn {role:'system'|'user'|'assistant';content:string}

function setting(key:string,fallback=''):string {
  try{return (globalThis.localStorage?.getItem('hku.opening.agent.'+key)??fallback).trim();}
  catch{return fallback.trim();}
}

export function campusModelConfig():ModelConfig {
  const endpoint=setting('endpoint',import.meta.env?.VITE_CAMPUS_MODEL_ENDPOINT??'');
  const model=setting('model',import.meta.env?.VITE_CAMPUS_MODEL_NAME??'');
  return {endpoint,model,offline:!endpoint||!model||setting('offline')==='1'};
}

export class ModelUnavailable extends Error {}
export class InvalidModelResponse extends Error {}

function readMessage(body:unknown):string | null {
  if(!body || typeof body!=='object')return null;
  const payload=body as {message?:{content?:unknown};response?:unknown;choices?:{message?:{content?:unknown};text?:unknown}[]};
  const text=payload.choices?.[0]?.message?.content??payload.message?.content??payload.response??payload.choices?.[0]?.text;
  return typeof text==='string'&&text.trim()?text.trim():null;
}

export async function requestCampusModel(config:ModelConfig,messages:ModelTurn[],signal:AbortSignal,schema?:Record<string,unknown>):Promise<string> {
  if(config.offline)throw new ModelUnavailable('没有启用 MacBook 模型连接');
  const ollama=/\/api\/chat(?:[?#]|$)/.test(config.endpoint);
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
  if(!response.ok)throw new ModelUnavailable('模型接口返回 HTTP '+response.status);
  let body:unknown;
  try{body=await response.json();}catch{throw new InvalidModelResponse('模型响应不是有效 JSON');}
  const reply=readMessage(body);
  if(!reply)throw new InvalidModelResponse('模型没有返回可读取的消息');
  return reply;
}
