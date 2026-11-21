export type Provider = 'deepseek'|'gemini'|'litellm';
export function activeProvider():Provider;
export function configured(provider?:Provider):boolean;
export function proxyUrl():string;
export function models(provider?:Provider):Promise<string[]>;
export function chat(messages:{role:string;content:string}[],options?:{
  provider?:Provider; model?:string; temperature?:number; maxTokens?:number; responseFormat?:object; signal?:AbortSignal;
}):Promise<unknown>;
