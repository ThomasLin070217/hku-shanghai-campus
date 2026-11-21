import {CAMPAIGN_CHAPTERS,CHAPTER_ORDER} from './chapters';
import {
 CAMPAIGN_SAVE_KEY,CAMPAIGN_TRANSITIONS,campaignChapterOf,createCampaignState,parseCampaignState,reduceCampaign,
 type CampaignEvent,type CampaignStage,type CampaignState,
} from './state';
import type {Chapter,ChapterContext,ChapterId,Objective} from './types';

export type CampaignStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface CampaignHostOptions{
 /** Everything a chapter needs except what the host owns (stage, emit, deviceId). */
 context:Omit<ChapterContext,'stage'|'emit'|'deviceId'>;
 storage?:CampaignStorage|null;
 chapters?:Record<ChapterId,()=>Chapter>;
 now?:()=>number;
}

/** Full-screen card shown when the campaign enters each chapter boundary stage. */
const STAGE_CARDS:Partial<Record<CampaignStage,[string,string]>>={
 b4_enter:['CHAPTER 1 · BUILDING 4','The Keyboard Wall'],
 to_lawn:['CHAPTER 2','The Lawn Guardian'],
 to_sports:['CHAPTER 3','Sports Hall Rescue'],
 ending:['EPILOGUE','Barrier Down'],
};
const DESTINATION:Record<ChapterId,string>={
 b4:'the Building 4 entrance',lawn:'the central lawn',sports:'the sports hall east door',ending:'the campus',
};

/**
 * Runs the campaign after Chapter 1: owns the stage, the save, the chapter
 * lifecycle and the walking legs between chapters. Chapters attach once, when
 * first needed, and stay attached (their scenery is part of the one world) until
 * the campaign is reset or the page goes away.
 */
export function createCampaignHost(o:CampaignHostOptions){
 const factories=o.chapters??CAMPAIGN_CHAPTERS,now=o.now??(()=>Date.now());
 const storage:CampaignStorage|null=o.storage===undefined?safeLocalStorage():o.storage;
 const instances=new Map<ChapterId,Chapter>(),attached=new Map<ChapterId,Chapter>();
 let state:CampaignState|null=load();

 const ctx:ChapterContext={
  ...o.context,
  deviceId:()=>state?.deviceId??'',
  stage:()=>state?.stage??'b4_enter',
  emit,
 };

 function load():CampaignState|null{
  try{const raw=storage?.getItem(CAMPAIGN_SAVE_KEY);return raw?parseCampaignState(JSON.parse(raw)):null;}catch{return null;}
 }
 function persist(){if(!state)return;try{storage?.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(state));}catch{/* The run can still finish in memory. */}}
 function instance(id:ChapterId){let c=instances.get(id);if(!c){c=factories[id]();instances.set(id,c);}return c;}
 /** The chapter a walking stage leads into: its entry event leaves this stage. */
 function walkTarget(stage:CampaignStage):Chapter|null{
  for(const id of CHAPTER_ORDER){const c=instance(id);if(c.entry.radius>0&&CAMPAIGN_TRANSITIONS[c.entry.event].from===stage)return c;}
  return null;
 }
 function needed(stage:CampaignStage):ChapterId[]{
  const ids:ChapterId[]=[];const own=campaignChapterOf(stage),next=walkTarget(stage)?.id;
  if(own)ids.push(own);if(next&&next!==own)ids.push(next);
  return ids;
 }
 function sync(){
  if(!state)return;
  for(const id of needed(state.stage))if(!attached.has(id)){const c=instance(id);attached.set(id,c);c.attach(ctx);}
 }
 function detachAll(){for(const c of attached.values())c.detach();attached.clear();instances.clear();}
 function card(stage:CampaignStage){const c=STAGE_CARDS[stage];if(c)void o.context.card(c[0],c[1]).catch(()=>{});}
 function emit(event:CampaignEvent):boolean{
  if(!state)return false;
  const r=reduceCampaign(state,event,now());if(!r.changed)return false;
  state=r.state;persist();sync();card(state.stage);
  return true;
 }
 function start(deviceId:string,stage:CampaignStage='b4_enter'){
  if(!deviceId)return false;
  detachAll();state={...createCampaignState(deviceId,now()),stage};persist();sync();card(stage);
  return true;
 }
 function reset(){detachAll();state=null;try{storage?.removeItem(CAMPAIGN_SAVE_KEY);}catch{/* Nothing to clear. */}}
 function update(dt:number){
  if(!state)return;
  sync();
  for(const c of [...attached.values()])c.update(dt);
  const leg=state?walkTarget(state.stage):null;
  if(leg){
   const p=o.context.explorer.game.body.position,[x,,z]=leg.entry.point;
   if(Math.hypot(p.x-x,p.z-z)<=leg.entry.radius)emit(leg.entry.event);
  }
 }
 function active():Chapter|null{const id=state?campaignChapterOf(state.stage):null;return id?attached.get(id)??null:null;}
 function objective():Objective|null{
  if(!state)return null;
  const leg=walkTarget(state.stage);
  if(leg)return{text:'Go to '+DESTINATION[leg.id],target:[...leg.entry.point],route:leg.approach.map(([x,z])=>[x,z] as [number,number])};
  sync();return active()?.objective(state.stage)??null;
 }
 return{
  get active(){return state!==null;},
  state:()=>state?{...state}:null,
  stage:()=>state?.stage??null,
  /** Id of the chapter that owns the current stage (null on walking legs between chapters). */
  chapter:()=>state?campaignChapterOf(state.stage):null,
  attached:()=>[...attached.keys()],
  start,reset,emit,update,objective,
  interact:()=>{if(!state)return false;sync();return active()?.interact()??false;},
  /** Debug hooks of every attached chapter, by id (DEV/review only, via window.__CAMPUS.campaign). */
  get debug(){return Object.fromEntries([...attached].map(([id,c])=>[id,c.debug??{}])) as Partial<Record<ChapterId,NonNullable<Chapter['debug']>>>;},
  dispose(){detachAll();},
 };
}
export type CampaignHost=ReturnType<typeof createCampaignHost>;

function safeLocalStorage():CampaignStorage|null{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
