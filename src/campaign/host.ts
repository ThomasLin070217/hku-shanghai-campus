import {
 CAMPAIGN_SAVE_KEY,CAMPAIGN_STAGES,CAMPAIGN_TRANSITIONS,campaignChapterOf,createCampaignState,parseCampaignState,reduceCampaign,stageIndex,
 type CampaignEvent,type CampaignStage,type CampaignState,
} from './state';
import type {Chapter,ChapterContext,ChapterId,Objective} from './types';

export type CampaignStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface CampaignHostOptions{
 /** Everything a chapter needs except what the host owns (stage, emit, deviceId). */
 context:Omit<ChapterContext,'stage'|'emit'|'deviceId'>;
 storage?:CampaignStorage|null;
 /** Chapter factories (`CAMPAIGN_CHAPTERS` in the game). Injected so headless checks can run the host with fakes. */
 chapters:Record<ChapterId,()=>Chapter>;
 now?:()=>number;
 /** Called when the run starts or crosses a chapter boundary (a stage with a chapter card): the game announces its save then. */
 onChapterBoundary?:(stage:CampaignStage)=>void;
}

/** Full-screen card shown when the campaign enters each chapter boundary stage. */
const STAGE_CARDS:Partial<Record<CampaignStage,[string,string]>>={
 b4_enter:['CHAPTER 1 · BUILDING 4','The Keyboard Wall'],
 to_lawn:['CHAPTER 2','The Lawn Guardian'],
 to_sports:['CHAPTER 3','Sports Hall Rescue'],
 ending:['EPILOGUE','Barrier Down'],
};
/** Chapters in story order, derived from the stage list. */
const CHAPTER_ORDER=[...new Set(CAMPAIGN_STAGES.map(campaignChapterOf).filter((id):id is ChapterId=>id!==null))];
const DESTINATION:Record<ChapterId,string>={
 b4:'the Building 4 entrance',lawn:'the central lawn',sports:'the sports hall east door',ending:'the campus',
};

/**
 * Runs the campaign after Chapter 1: owns the stage, the save, the chapter
 * lifecycle and the walking legs between chapters. Chapters attach once, when
 * first needed, and stay attached (their scenery is part of the one world) until
 * the campaign is reset or the page goes away.
 *
 * Frame time: chapters' `update(dt)` runs every rendered frame, but `dt` is 0
 * while the game is paused or the explorer is off (model tools), and walking-leg
 * entry events are not checked then, so chapters never advance behind a pause.
 */
export function createCampaignHost(o:CampaignHostOptions){
 const factories=o.chapters,now=o.now??(()=>Date.now());
 const storage:CampaignStorage|null=o.storage===undefined?safeLocalStorage():o.storage;
 const instances=new Map<ChapterId,Chapter>(),attached=new Map<ChapterId,Chapter>();
 let state:CampaignState|null=load();
 let lastCard:Promise<void>=Promise.resolve();
 /** Per-stage caches, so a frame allocates nothing while the stage holds (M5). */
 let syncedStage:CampaignStage|null=null,live:Chapter[]=[];
 let legStage:CampaignStage|null=null,legObjective:Objective|null=null;
 /** The objective of the current frame; undefined = not computed yet this frame. */
 let frameObjective:Objective|null|undefined;

 const ctx:ChapterContext={
  ...o.context,
  deviceId:()=>state?.deviceId??'',
  stage:()=>state?.stage??'b4_enter',
  emit,
  cardSettled:()=>lastCard,
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
 /** The last stage each chapter owns: a run beyond it has passed that chapter. */
 const LAST_STAGE=new Map<ChapterId,CampaignStage>(CAMPAIGN_STAGES.flatMap(s=>{const id=campaignChapterOf(s);return id?[[id,s] as [ChapterId,CampaignStage]]:[];}));
 function needed(stage:CampaignStage):ChapterId[]{
  // Chapters already passed stay in the world with their aftermath (B04 opened, L001
  // shut down), as in the live run where they never detach; a restored save attaches them too.
  const at=stageIndex(stage),ids=CHAPTER_ORDER.filter(id=>stageIndex(LAST_STAGE.get(id)!)<at);
  const own=campaignChapterOf(stage),next=walkTarget(stage)?.id;
  if(own)ids.push(own);if(next&&next!==own)ids.push(next);
  return ids;
 }
 function sync(){
  if(!state||syncedStage===state.stage)return;
  const stage=state.stage;
  for(const id of needed(stage))if(!attached.has(id)){const c=instance(id);attached.set(id,c);c.attach(ctx);}
  live=[...attached.values()];syncedStage=stage;
 }
 function detachAll(){for(const c of attached.values())c.detach();attached.clear();instances.clear();live=[];syncedStage=null;changed();}
 /** The stage moved (or the campaign was reset): drop the cached objectives. */
 function changed(){legStage=null;legObjective=null;frameObjective=undefined;}
 function card(stage:CampaignStage){const c=STAGE_CARDS[stage];if(!c)return;lastCard=o.context.card(c[0],c[1]).catch(()=>{});o.onChapterBoundary?.(stage);}
 function emit(event:CampaignEvent):boolean{
  if(!state)return false;
  const r=reduceCampaign(state,event,now());if(!r.changed)return false;
  state=r.state;changed();persist();sync();card(state.stage);
  return true;
 }
 /** A start inside a chapter (a checkpoint such as b4-inside) shows the card of the boundary it sits behind. */
 function startCard(stage:CampaignStage):CampaignStage{
  for(let i=stageIndex(stage);i>=0;i--){const s=CAMPAIGN_STAGES[i];if(STAGE_CARDS[s])return s;}
  return stage;
 }
 function start(deviceId:string,stage:CampaignStage='b4_enter'){
  if(!deviceId)return false;
  detachAll();state={...createCampaignState(deviceId,now()),stage};persist();sync();card(startCard(stage));
  return true;
 }
 function reset(){detachAll();state=null;try{storage?.removeItem(CAMPAIGN_SAVE_KEY);}catch{/* Nothing to clear. */}}
 function update(dt:number){
  if(!state)return;
  frameObjective=undefined;
  sync();
  const running=o.context.explorer.enabled&&!o.context.explorer.game.paused;
  for(const c of live)c.update(running?dt:0);
  const leg=running&&state?walkTarget(state.stage):null;
  if(leg){
   const p=o.context.explorer.game.body.position,[x,,z]=leg.entry.point;
   if(Math.hypot(p.x-x,p.z-z)<=leg.entry.radius)emit(leg.entry.event);
  }
 }
 function active():Chapter|null{const id=state?campaignChapterOf(state.stage):null;return id?attached.get(id)??null:null;}
 /** Computed once per frame (several HUD readers ask); a walking leg's objective is built once per stage. */
 function objective():Objective|null{
  if(!state)return null;
  if(frameObjective!==undefined)return frameObjective;
  const stage=state.stage,leg=walkTarget(stage);
  if(leg){
   if(legStage!==stage){legStage=stage;legObjective={text:'Go to '+DESTINATION[leg.id],target:[...leg.entry.point],route:leg.approach.map(([x,z])=>[x,z] as [number,number])};}
   return frameObjective=legObjective;
  }
  sync();return frameObjective=active()?.objective(stage)??null;
 }
 return{
  get active(){return state!==null;},
  state:()=>state?{...state}:null,
  stage:()=>state?.stage??null,
  /** Id of the chapter that owns the current stage (null on walking legs between chapters). */
  chapter:()=>state?campaignChapterOf(state.stage):null,
  /**
   * Where "Return to checkpoint" should put the player: the start of the chapter that owns
   * the current stage, else the next walking leg's entry. The body moves; the story does not.
   * Null before the campaign starts and in the epilogue: the ending chapter's entry is a
   * radius-0 placeholder at the campus origin (it has no walking leg), and teleporting there
   * mid-finale would yank the body out from under the scripted 58 m camera crane.
   */
  chapterEntry:()=>{
   if(!state)return null;
   sync();
   const own=active(),walk=walkTarget(state.stage);
   const point=(own&&own.entry.radius>0?own.entry.point:null)??walk?.entry.point??null;
   return point?[...point] as [number,number,number]:null;
  },
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
