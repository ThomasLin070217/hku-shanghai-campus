/** The lawn owns the power switch. Other chapters only consume its completion event. */
export const CORE_EVENT='ai_core_power_cut';
const prefix='hku.missions.core-power.v1.';
const memory=new Set<string>();

export function hasCorePowerCut(instanceId:string){
  if(!instanceId)return false;
  if(memory.has(instanceId))return true;
  try{return localStorage.getItem(prefix+instanceId)===CORE_EVENT;}catch{return false;}
}

export function recordCorePowerCut(instanceId:string,repaired:number){
  if(repaired!==3||!instanceId||hasCorePowerCut(instanceId))return false;
  memory.add(instanceId);
  try{localStorage.setItem(prefix+instanceId,CORE_EVENT);}catch{/* The current session can still finish. */}
  window.dispatchEvent(new CustomEvent(CORE_EVENT,{detail:{event:CORE_EVENT,source:'L001',macInstanceId:instanceId,next:'sports-hall'}}));
  return true;
}

export function sportsRescueLink(instanceId:string){
  return '?'+new URLSearchParams({experience:'sports-hall',device:instanceId}).toString();
}
