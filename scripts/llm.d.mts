export function configured():boolean;
export function chat(messages:{role:string;content:string}[],options:{
  model:string; temperature?:number; maxTokens?:number; responseFormat?:object;signal?:AbortSignal;
}):Promise<unknown>;
