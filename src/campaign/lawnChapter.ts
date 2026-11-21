import {KEYS} from '../exploration/config';
import {LION} from '../model/lionParameters';
import {NOV13} from '../model/nov13Parameters';
import {NODES,SAFE,canSubmit,createCombat} from '../lionBoss/combat';
import {INTERRUPT_LABEL,INTERRUPT_RULE,SHUTDOWN_LABEL,distanceToNode,lawnHint,placeAtShelter,shutDownGuardian} from '../lionBoss/encounter';
import {hasCorePowerCut} from '../lionBoss/mission';
import {createBossScene} from '../lionBoss/scene';
import {OPENING_CAPTURE_DAMAGE,OPENING_MAX_HEARTS,OPENING_RESPAWN_GRACE_SECONDS} from '../opening/runtime';
import {stageIndex,type CampaignEvent} from './state';
import type {Chapter,ChapterContext} from './types';

/** The lawn guardian trigger: the shelter point `src/lionBoss/play.ts` starts the fight from. */
export const LAWN_ENTRY:Chapter['entry']={point:[SAFE.x,LION.groundY,SAFE.z],radius:3,event:'reach_lawn'};
const EVENTS:CampaignEvent[]=['reach_lawn','guardian_shutdown'];

/** Same rule as the explorer's key handler: keys typed into a HUD field or dialog are not game keys. */
const editable=(t:EventTarget|null)=>typeof HTMLElement!=='undefined'&&t instanceof HTMLElement&&!!t.closest('input,select,textarea,[contenteditable="true"],dialog');

/** Placement only: the prompt itself wears the opening `.opening-prompt` console style and tokens. */
const PROMPT_CSS=`.opening-prompt.lawn-prompt{bottom:132px;gap:18px}
.lawn-prompt .lawn-chip{display:inline-flex;align-items:center;gap:8px;opacity:.55;transition:opacity .15s}
.lawn-prompt .lawn-chip.is-ready{opacity:1}
.lawn-prompt .lawn-chip[hidden]{display:none}`;

/** The Q/F key prompts, drawn with the opening prompt markup (keycap + label). */
function createKeyPrompt(){
 if(typeof document==='undefined')return null;
 const style=document.createElement('style');style.textContent=PROMPT_CSS;document.head.append(style);
 const root=document.createElement('div');root.className='opening-prompt lawn-prompt';root.hidden=true;root.setAttribute('aria-live','polite');
 const chip=(key:string,label:string)=>{
  const el=document.createElement('span');el.className='lawn-chip';
  const cap=document.createElement('span');cap.className='opening-prompt-key';cap.textContent=key;
  const text=document.createElement('span');text.className='opening-prompt-text';text.textContent=label;
  el.append(cap,text);root.append(el);return{el,text};
 };
 const q=chip('Q',INTERRUPT_LABEL),f=chip('F',SHUTDOWN_LABEL);
 (document.querySelector('.stage')??document.body).append(root);
 return{
  update(o:{visible:boolean;qReady:boolean;fOpen:boolean;submit:number}){
   root.hidden=!o.visible;if(!o.visible)return;
   q.el.classList.toggle('is-ready',o.qReady);
   f.el.hidden=!o.fOpen;f.el.classList.toggle('is-ready',o.fOpen);
   f.text.textContent=o.submit>0?SHUTDOWN_LABEL+' · '+Math.round(o.submit*100)+'%':SHUTDOWN_LABEL;
  },
  dispose(){root.remove();style.remove();},
 };
}

/**
 * Chapter 2 in the one world: the rigged L001 on the opening campus model with
 * Thomas's gameplay (Q interrupts the charge wind-up, hold F in the lit ring).
 * Rules, hints and the shutdown writers are shared with `?experience=lion-boss`.
 */
export function createLawnChapter():Chapter{
 let ctx:ChapterContext|null=null,visuals:ReturnType<typeof createBossScene>|null=null;
 let combat:ReturnType<typeof createCombat>|null=null,prompt:ReturnType<typeof createKeyPrompt>=null;
 let localHearts=OPENING_MAX_HEARTS,holding=false,started=false,finished=false,grace=0;
 let events:AbortController|null=null;

 const game=()=>ctx!.explorer.game;
 const fighting=()=>!!ctx&&!!combat&&ctx.stage()==='lawn'&&started&&!finished;
 /** The fight clock runs whenever play does (the AI may be driving); human keys need the human in control. */
 const running=()=>fighting()&&!game().paused&&!game().panel&&!game().inventoryOpen;
 const canAct=()=>running()&&!game().armed;

 /** Hearts are the opening runtime's, through ctx.hearts (the opening vitals HUD and save follow).
  * Stub contexts without the channel (headless host checks) keep a local count and touch no DOM. */
 const hearts={
  get:()=>ctx?.hearts?.get()??localHearts,
  damage:(n:number)=>ctx?.hearts?ctx.hearts.damage(n):(localHearts=Math.max(0,localHearts-n)),
  heal:()=>ctx?.hearts?ctx.hearts.heal():(localHearts=OPENING_MAX_HEARTS),
 };
 function begin(){
  started=true;holding=false;grace=0;
  combat!.start();
  ctx!.notify('L001 is awake. Press Q when it winds up a charge, then hold F in the lit ring.');
 }
 /** Caught by L001: lose hearts, back to the shelter; at zero, heal and retry there. No game over, no reload. */
 function capture(){
  if(grace>0)return;
  const before=hearts.get(),left=hearts.damage(OPENING_CAPTURE_DAMAGE),lost=before-left,dead=left<=0;
  if(dead)hearts.heal();
  holding=false;grace=OPENING_RESPAWN_GRACE_SECONDS;
  combat!.reset(0);combat!.start();
  placeAtShelter(ctx!.explorer.world,game());visuals?.syncCollision(combat!.state);
  ctx!.notify(dead?'Signal lost · Hearts restored, try again from the shelter':`Caught by L001 · −${lost} hearts`);
 }
 function finish(){
  finished=true;holding=false;
  if(shutDownGuardian(ctx!.deviceId()))game().event('ai_core_power_cut','AI core power is off',{next:'sports-hall'});
  ctx!.emit('guardian_shutdown');
  ctx!.notify('L001 is offline · Core power is cut');
 }
 function interrupt(){
  const result=combat!.cast(INTERRUPT_RULE,game().body.position);
  if(!result.ok)ctx!.notify(result.message);
  return result;
 }
 function keydown(event:KeyboardEvent){
  if(event.code!=='KeyQ'||event.repeat||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||editable(event.target))return;
  if(!canAct())return;   // Q belongs to the lawn only while the fight runs
  event.preventDefault();interrupt();
 }
 function keyup(event:KeyboardEvent){if(event.code===KEYS.interact)holding=false;}

 return{
  id:'lawn',entry:LAWN_ENTRY,approach:[[58,25],[58,33.5],[24,33.5],[24,SAFE.z],[SAFE.x,SAFE.z]],
  attach(c){
   ctx=c;
   // A run already past the lawn (resume or checkpoint) keeps the guardian shut down.
   const done=stageIndex(c.stage())>stageIndex('lawn')||hasCorePowerCut(c.deviceId());
   combat=createCombat(done?1:0);finished=done;started=done;
   // The opening campus model always carries L001 (check:campaign-lawn); a bare root or an explorer
   // without navigation (host and sports checks) runs the rules only.
   if(c.root().getObjectByName(NOV13.lion.id)&&c.explorer.world){visuals=createBossScene(c.root(),c.explorer.world,c.scene);visuals.render(combat.state,0);}
   prompt=createKeyPrompt();
   if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
    events=new AbortController();
    window.addEventListener('keydown',keydown,{signal:events.signal});
    window.addEventListener('keyup',keyup,{signal:events.signal});
   }
  },
  update(dt){
   if(!ctx||!combat)return;
   if(ctx.stage()==='lawn'){
    if(finished&&combat.state.phase==='complete')ctx.emit('guardian_shutdown');   // core power was cut before the stage caught up
    else if(!started)begin();
   }
   if(running()){
    grace=Math.max(0,grace-dt);
    const event=combat.step(dt,game().body.position,holding);
    if(event==='hit')capture();
    else if(event==='repair')finish();
   }else holding=false;
   visuals?.render(combat.state,dt);
   const s=combat.state;
   prompt?.update({visible:fighting(),qReady:s.phase==='chargeWarn',fOpen:canSubmit(s),submit:s.submit});
  },
  /** F (the host's interact route): start the shutdown hold while L001 is frozen; the ring range is checked by the combat step. */
  interact(){
   if(!canAct()||!canSubmit(combat!.state))return false;
   holding=true;return true;
  },
  objective(stage){
   if(stage!=='lawn'||!combat)return null;
   const node=NODES[0];
   return{text:fighting()?lawnHint(combat.state,distanceToNode(game().body.position)):'Shut down the lawn guardian',target:[node.x,LION.groundY,node.z]};
  },
  detach(){
   events?.abort();events=null;
   prompt?.dispose();prompt=null;
   visuals?.dispose();visuals=null;
   ctx=null;combat=null;holding=false;started=false;finished=false;localHearts=OPENING_MAX_HEARTS;
  },
  debug:{
   /** Lawn shortcut only: from any stage other than to_lawn/lawn it changes nothing. */
   complete(){
    if(!ctx||!combat)return ctx?.stage();
    if(ctx.stage()==='to_lawn')ctx.emit(EVENTS[0]);
    if(ctx.stage()!=='lawn')return ctx.stage();
    if(!finished){combat.reset(1);finish();}
    return ctx.stage();
   },
   rig:()=>visuals?{meshes:visuals.rig.meshes,clips:visuals.rig.clips}:null,
   state:()=>combat?structuredClone(combat.state):null,
   hearts:()=>hearts.get(),
   /** Caught by L001 now (same path as a hit in the fight). */
   capture(){if(fighting())capture();return hearts.get();},
  },
 };
}
