import {markLocalModelCleared,resetWorldThreat,tryPurgeWorld,type WorldThreatStorage} from '../gameplay/worldThreat';
import {clearProgress,type ProgressStorage} from '../levels/resetProgress';
import {BUILD_STAMP} from '../version';
import {createFinaleLightShow,type FinaleShow} from './finaleLightShow';
import type {Chapter,ChapterContext} from './types';

/** The ending has no walking leg: radius 0, the host never emits its entry event. */
export const ENDING_ENTRY:Chapter['entry']={point:[0,0,0],radius:0,event:'door_opened'};

export interface EndingBeat{
 /** Seconds after the Mac screen starts. */
 at:number;
 /** The Mac screen line, exactly as doc/12 §7 storyboards it. */
 line:string;
 /** Lifts the dome on this beat. */
 release?:boolean;
}

/**
 * doc/12 §7: the HKU supercomputer boots its four CPUs one by one, starts
 * synchronising, restores administrator access, and the barrier lifts.
 * `ENDING_SECONDS` is the Mac sequence, the dome lift included (see below).
 */
export const ENDING_BEATS:readonly EndingBeat[]=[
 {at:0,line:'HKU SUPERCOMPUTER'},
 {at:.7,line:'CPU 01–04 … OFFLINE'},
 {at:1.6,line:'CPU 01 ONLINE'},
 {at:2.4,line:'CPU 02 ONLINE'},
 {at:3.2,line:'CPU 03 ONLINE'},
 {at:4,line:'CPU 04 ONLINE'},
 {at:5.4,line:'SYNCHRONIZATION STARTED…'},
 {at:7.4,line:'ALL PROCESSING UNITS ONLINE'},
 {at:8,line:'ADMINISTRATOR ACCESS RESTORED',release:true},
 {at:10,line:'BARRIER DOWN'},
];
/**
 * The credits appear after the dome is fully back in the sky: the release beat
 * is at 8 s and `OPENING_DOME.seconds` is 5.2 s, so the lift ends at 13.2 s.
 */
export const ENDING_SECONDS=14;
/**
 * The rescue banner must be readable with nothing over it. The host's EPILOGUE
 * card (~3.0 s of fade + hold) covers it first, so the hold only starts once
 * `cardSettled()` resolves; then the banner has this long on its own.
 */
export const ENDING_HOLD_SECONDS=3.2;
/** A card promise that never settles must not strand the epilogue. */
const CARD_WAIT_CAP_SECONDS=6;
/** The Mac screen has faded out by here, before the 8 s release beat. */
export const ENDING_CLEAR_AT=7;
/**
 * The run ends on the ground north of the sports hall, where the three 25 m halls
 * (B05–B07) stand between the player and the four towers: at eye level not one
 * window of the finale is on screen. The view cranes up under the Mac overlay and
 * is over the roofs by the time the Mac fades, so the towers light on open sky.
 */
export const ENDING_CRANE_START=4.8;
export const ENDING_CRANE_END=6.8;
/**
 * Clearance so the shot is over the tallest sports hall roof (25.51 m) *and* high
 * enough to see down into the courtyard: at 32.5 m the atrium ring at 2.6 m is
 * still behind the hall roofs, at 58 m the whole courtyard is in view.
 */
export const ENDING_CRANE_METRES=58;
/** The credits wait for the atmosphere to report the dome fully up, at most this long past ENDING_SECONDS. */
export const ENDING_DOME_WAIT_SECONDS=3;

/** The credits card body. Pure, so the headless check reads the exact copy. */
export function creditsMarkup():string{
 return '<section id="ending-credits-card" role="dialog" aria-modal="true" aria-label="HKU: Barrier 2030 credits">'
  +'<p class="ending-kicker">CREDITS</p>'
  +'<h2>HKU: Barrier 2030</h2>'
  +'<p class="ending-subtitle">A CDS campus story</p>'
  +'<p class="ending-team">Thomas · Harry · Frost · WHL</p>'
  +'<p class="ending-place">HKU Shanghai · CDS</p>'
  +'<p class="ending-build">'+BUILD_STAMP+'</p>'
  +'<div class="ending-actions"><button type="button" id="ending-play-again">Play again</button><a id="ending-chapters" href="?experience=levels">Chapters</a></div>'
  +'</section>';
}

/**
 * Play again: the same key list as the menu's Reset progress, plus the world
 * threat. The caller reloads afterwards; that reload is an explicit player
 * click at the very end of the story, never part of the run itself.
 */
export function clearAllProgress(storage:ProgressStorage&WorldThreatStorage):string[]{
 const removed=clearProgress(storage);
 resetWorldThreat(storage);
 return removed;
}

/** The story's first page: no `checkpoint` parameter, so a chapter-menu entry does not loop back to itself. */
export const PLAY_AGAIN_URL='?experience=opening';
/** Play again: clear every local save, then start the game from the beginning (an explicit player click). */
export function playAgain(storage:ProgressStorage&WorldThreatStorage,nav:{assign(url:string):void}){
 try{clearAllProgress(storage);}catch(error){console.error('ending: Play again could not clear the local progress; the new run may resume it',error);}
 nav.assign(PLAY_AGAIN_URL);
}

const STYLE_ID='ending-styles';
const ENDING_CSS=`
#ending-overlay{position:fixed;inset:0;z-index:60;display:grid;grid-template:1fr/1fr;place-items:center;font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;color:#e8f4ee;opacity:0;transition:opacity .6s ease}
#ending-overlay::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(9,24,19,.86),rgba(2,7,5,.97) 70%);opacity:1;transition:opacity .9s ease}
#ending-overlay.show{opacity:1}
/* The dome lift happens on open sky: the dark layer and the Mac fade before the 8 s release. */
#ending-overlay.is-clearing::before{opacity:0}
#ending-overlay .ending-mac{grid-area:1/1;width:min(880px,92vw);filter:drop-shadow(0 40px 90px rgba(0,0,0,.7));transition:opacity .9s ease,transform .9s ease}
#ending-overlay.is-clearing .ending-mac{opacity:0;transform:translateY(-14px) scale(.985)}
#ending-overlay .ending-screen{position:relative;background:#050b09;border:14px solid #1b2420;border-radius:16px 16px 6px 6px;box-shadow:inset 0 0 60px rgba(116,230,180,.05),inset 0 0 0 1px rgba(116,230,180,.18);min-height:min(52vh,430px);padding:34px 40px;overflow:hidden}
#ending-overlay .ending-camera{position:absolute;top:-9px;left:50%;width:70px;height:5px;transform:translateX(-50%);border-radius:3px;background:#0a1210}
#ending-overlay .ending-camera::after{content:"";position:absolute;left:50%;top:1px;width:3px;height:3px;transform:translateX(-50%);border-radius:50%;background:#2a4a3e}
#ending-overlay .ending-head{display:flex;justify-content:space-between;gap:16px;margin:0 0 22px;font-size:11px;letter-spacing:.24em;color:#74e6b4}
#ending-overlay .ending-head span:last-child{color:#5f7d70}
#ending-overlay .ending-lines{margin:0;padding:0;list-style:none;font-size:clamp(14px,2vw,19px);line-height:1.9;letter-spacing:.06em}
#ending-overlay .ending-lines li{margin:0;color:#e8f4ee;opacity:0;animation:ending-line .35s ease forwards}
#ending-overlay .ending-lines li.is-offline{color:#ffb648}
#ending-overlay .ending-lines li.is-online{color:#74e6b4}
#ending-overlay .ending-lines li.is-final{color:#74e6b4;text-shadow:0 0 18px rgba(116,230,180,.45)}
#ending-overlay .ending-cursor{display:inline-block;width:.62em;height:1.05em;margin-left:4px;vertical-align:-.16em;background:#74e6b4;animation:ending-blink 1s steps(2,start) infinite}
#ending-overlay .ending-base{height:16px;margin:0 auto;width:calc(100% + 90px);max-width:calc(92vw + 90px);border-radius:0 0 20px 20px;background:linear-gradient(180deg,#2a3631,#141c18 62%,#0b110e);box-shadow:inset 0 1px 0 rgba(255,255,255,.09)}
#ending-overlay .ending-notch{width:18%;height:5px;margin:0 auto;border-radius:0 0 6px 6px;background:#060a08}
/* The last line stays on the cleared sky after the Mac fades. */
#ending-overlay .ending-barrier{grid-area:1/1;margin:0;font:400 clamp(26px,5vw,54px)/1 Georgia,"Times New Roman",serif;letter-spacing:.3em;color:#e8f4ee;text-shadow:0 0 30px rgba(116,230,180,.35);opacity:0;transition:opacity .9s ease}
#ending-overlay .ending-barrier.show{opacity:1}
#ending-credits{position:fixed;inset:0;z-index:61;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,rgba(10,26,21,.92),rgba(2,7,5,.985) 72%);font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#e8f4ee;opacity:0;transition:opacity .7s ease}
#ending-credits.show{opacity:1}
/* The credits own the screen: the paused game's card, the Mac overlay and the
   now-stale HUD all step aside until the credits go. */
body:has(#ending-credits) #pause-panel{display:none}
body:has(#ending-credits) #ending-overlay{display:none}
body:has(#ending-credits) :is(.opening-hud,.opening-hearts,.opening-mapcard,#inventory-hud,.stage-bottom,.shell-hint,.shell-chapters,.stage-top){display:none}
#ending-credits-card{text-align:center;padding:40px 46px;max-width:min(560px,90vw)}
#ending-credits-card .ending-kicker{margin:0 0 18px;font:600 11px/1.2 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.26em;color:#74e6b4}
#ending-credits-card h2{margin:0;font:400 clamp(40px,7vw,64px)/1.02 Georgia,"Times New Roman",serif;letter-spacing:.01em}
#ending-credits-card .ending-subtitle{margin:10px 0 0;font:600 12px/1.2 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.24em;color:#74e6b4;text-transform:uppercase}
#ending-credits-card .ending-team{margin:26px 0 0;font:400 clamp(17px,2.4vw,21px)/1.4 Georgia,"Times New Roman",serif;color:#e8f4ee}
#ending-credits-card .ending-place{margin:8px 0 0;font:600 11px/1.2 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.2em;color:#a4bcb1;text-transform:uppercase}
#ending-credits-card .ending-build{margin:6px 0 0;font:500 10px/1.2 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.16em;color:#5f7a6e}
#ending-credits-card .ending-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:34px 0 0}
#ending-credits-card .ending-actions button,#ending-credits-card .ending-actions a{display:inline-block;padding:11px 20px;border:1px solid rgba(116,230,180,.46);border-radius:2px;background:transparent;color:#e8f4ee;font:600 11px/1 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;cursor:pointer}
#ending-credits-card .ending-actions #ending-play-again{background:#74e6b4;border-color:#74e6b4;color:#04120c;box-shadow:0 0 30px rgba(116,230,180,.24)}
#ending-credits-card .ending-actions button:hover,#ending-credits-card .ending-actions a:hover{border-color:#74e6b4;color:#74e6b4}
#ending-credits-card .ending-actions #ending-play-again:hover{color:#04120c}
@keyframes ending-line{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes ending-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@media(max-width:640px){#ending-overlay .ending-screen{padding:24px 20px;min-height:46vh}#ending-credits-card{padding:28px 22px}}
`;

/**
 * The epilogue. The door has opened and the rescue banner is on screen; this
 * chapter holds for a readable beat (and for the host's EPILOGUE card to finish),
 * plays the doc/12 §7 Mac boot on its own clock, fades the Mac away so the dome
 * lift is visible on open sky, then shows the credits.
 *
 * `markLocalModelCleared()` runs at attach; `tryPurgeWorld()` runs on the
 * ADMINISTRATOR beat, so the purged record and the visible lift happen together.
 * The sequence is `update(dt)`-driven so the headless check can fast-forward it.
 */
export function createEndingChapter():Chapter{
 let ctx:ChapterContext|null=null;
 let hold=0,cardWait=0,clock=0,next=0;
 /** Wall-clock time of the previous update, for the cutscene step below. */
 let lastFrame=0;
 let started=false,cleared=false,finished=false,released=false;
 let cardResolved=false,cardWatched=false,creditsStarted=false;
 let overlay:HTMLElement|null=null,lines:HTMLElement|null=null,barrier:HTMLElement|null=null,credits:HTMLElement|null=null;
 let finale:FinaleShow|null=null;

 /** The scripted camera lift, written to the explorer each frame; 0 restores the eye. */
 function crane(){
  const game=(ctx?.explorer as unknown as {game?:{cameraLift?:number}}|null)?.game;
  if(!game)return;
  const span=Math.max(.001,ENDING_CRANE_END-ENDING_CRANE_START);
  const t=Math.min(1,Math.max(0,(clock-ENDING_CRANE_START)/span));
  game.cameraLift=ENDING_CRANE_METRES*t*t*(3-2*t);
 }

 function dom(){
  if(typeof document==='undefined')return;
  document.getElementById(STYLE_ID)?.remove();
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=ENDING_CSS;document.head.append(style);
  overlay=document.createElement('div');overlay.id='ending-overlay';
  overlay.innerHTML='<div class="ending-mac"><div class="ending-screen"><div class="ending-camera"></div><p class="ending-head"><span>BOOT SEQUENCE</span><span>B04 · CDS-1</span></p><ul class="ending-lines"></ul></div><div class="ending-base"></div><div class="ending-notch"></div></div><p class="ending-barrier" aria-live="polite"></p>';
  lines=overlay.querySelector('.ending-lines');
  barrier=overlay.querySelector('.ending-barrier');
  document.body.append(overlay);
  requestAnimationFrame(()=>overlay?.classList.add('show'));
 }

 function clearScreen(){
  cleared=true;
  overlay?.classList.add('is-clearing');
 }

 function fire(beat:EndingBeat){
  if(beat.release&&!released){
   released=true;
   const result=tryPurgeWorld();
   if(!result.purged&&result.threat.phase!=='purged')console.error('ending: the campus did not purge, so the barrier stays sealed; every endgame fact must be written first',result.threat);
   ctx?.atmosphere()?.release();
   // The four-tower light show is the middle beat: it starts with the dome lift and
   // finishes before the credits, while the Mac overlay is already fading away.
   finale?.start();
   try{ctx?.music?.('mus_finale',{loop:false});}catch(error){console.error('ending: could not start the finale cue',error);}
  }
  if(!lines)return;
  const line=document.createElement('li');
  line.textContent=beat.line;
  if(beat.line.includes('OFFLINE'))line.className='is-offline';
  else if(beat.line.includes('ONLINE'))line.className='is-online';
  else if(beat.release)line.className='is-final';
  lines.append(line);
  if(beat.line==='BARRIER DOWN'&&barrier){barrier.textContent=beat.line;requestAnimationFrame(()=>barrier?.classList.add('show'));}
 }

 function showCredits(){
  if(creditsStarted)return;
  creditsStarted=true;
  if(typeof document!=='undefined'&&!credits){
   credits=document.createElement('div');credits.id='ending-credits';credits.innerHTML=creditsMarkup();
   document.body.append(credits);
   requestAnimationFrame(()=>credits?.classList.add('show'));
   credits.querySelector('#ending-play-again')?.addEventListener('click',()=>playAgain(localStorage,location));
   // The story is over: pause and release pointer lock so the two buttons are clickable.
   try{ctx?.explorer.pause('ending');}catch(error){console.error('ending: could not pause the explorer for the credits',error);}
  }
  // Deliberately after the pause: the pause drops every story-bus loop, so this
  // cue goes out on the shared music bus, which the pause does not touch.
  try{ctx?.music?.('mus_credits',{loop:true});}catch(error){console.error('ending: could not start the credits music',error);}
 }

 function attach(c:ChapterContext){
  ctx=c;hold=0;cardWait=0;clock=0;next=0;lastFrame=0;
  started=cleared=finished=released=false;
  cardResolved=false;cardWatched=false;
  // The last endgame fact. The purge itself waits for the ADMINISTRATOR beat so
  // the world record and the visible dome lift agree (and so the sealed curtain
  // is not re-asserted during the Mac sequence).
  markLocalModelCleared();
  // A reload after the credits: the epilogue already played, so go straight back to them.
  if(c.stage()==='done'){started=cleared=released=finished=true;showCredits();}
  // The light show is scenery, not a save field: a run that already finished restores
  // the lit campus from the ending stage alone.
  finale?.dispose();finale=null;
  if(c.scene){
   finale=createFinaleLightShow(c.scene);
   if(c.stage()==='done')finale.seek(Number.POSITIVE_INFINITY);
  }
  // The run ends north of the campus at the sports hall, facing away from the four
  // towers. The epilogue card is about to cover the screen, so the view is turned
  // here — under the card — and the card lifts onto the campus as it lights.
  const game=(c.explorer as unknown as {game?:{body?:{position?:{x:number;z:number}};yaw?:number;cameraLift?:number}}).game;
  const at=game?.body?.position;
  if(game&&at&&typeof game.yaw==='number'&&Math.hypot(at.x,at.z-36)>80)game.yaw=Math.atan2(at.x,at.z-36);
  // A fresh ending starts on the ground; a re-attach must not inherit a raised view.
  if(game)game.cameraLift=0;
 }

 /**
  * The host shows its EPILOGUE card right after `attach` returns, so the promise
  * is only read on the first update (the next frame), never during attach.
  */
 function watchCard(){
  if(cardWatched)return;
  cardWatched=true;
  let settled:Promise<void>|undefined;
  try{settled=ctx?.cardSettled?.();}catch(error){console.error('ending: could not read the chapter-card promise',error);}
  if(settled)void settled.then(()=>{cardResolved=true;},()=>{cardResolved=true;});
 }

 function update(dt:number){
  if(finished)return;
  watchCard();
  // The epilogue is a cutscene authored in story seconds, so it follows the wall
  // clock rather than the frame clock. The viewer caps frame dt at 0.1 s, and a
  // slow renderer would otherwise stretch the sequence by the frame rate: the
  // software-rasterised playthrough measured 0.36 fps, which turned the 17 s
  // ending into ~470 s and timed the run out at 420 s with the curtain halfway
  // down. A zero dt still means paused or the explorer is off — it holds then,
  // so the cutscene never runs behind a pause. A direct caller passing a fixed
  // dt faster than real time (the headless checks) keeps that dt. The 2 s cap
  // only guards a tab-hidden or stalled gap; at the measured 0.25 fps it is
  // what lets the sequence finish in half a minute instead of eight minutes.
  const now=typeof performance!=='undefined'?performance.now():0;
  const wall=lastFrame&&now>lastFrame?Math.min(2,(now-lastFrame)/1000):0;
  lastFrame=now;
  const step=dt>0?Math.max(dt,wall):0;
  if(!started){
   // The card covers the rescue banner: the banner's own hold starts after it.
   if(!cardResolved){
    cardWait+=step;
    if(cardWait<CARD_WAIT_CAP_SECONDS)return;
   }
   hold+=step;
   if(hold<ENDING_HOLD_SECONDS)return;
   started=true;
   dom();
   return;
  }
  clock+=step;
  crane();
  finale?.update(step);
  if(!cleared&&clock>=ENDING_CLEAR_AT)clearScreen();
  while(next<ENDING_BEATS.length&&ENDING_BEATS[next].at<=clock)fire(ENDING_BEATS[next++]);
  if(clock>=ENDING_SECONDS&&(domeUp()||clock>=ENDING_SECONDS+ENDING_DOME_WAIT_SECONDS)){
   finished=true;
   showCredits();
   ctx?.emit('ending_finished');
  }
 }

 /** The atmosphere reports the dome back in the sky (an atmosphere without a snapshot, as in stubs, counts as up). */
 function domeUp(){
  const a=ctx?.atmosphere() as {snapshot?:()=>{phase:string;curtainVisible:boolean;releasing:boolean}}|undefined;
  const s=typeof a?.snapshot==='function'?a.snapshot():null;
  return !s||(s.phase==='day'&&!s.curtainVisible&&!s.releasing);
 }

 function detach(){
  overlay?.remove();credits?.remove();
  overlay=null;credits=null;lines=null;barrier=null;
  finale?.dispose();finale=null;
  ctx=null;
 }

 return{
  id:'ending',entry:ENDING_ENTRY,approach:[],
  attach,update,
  interact(){return false;},
  objective(stage){return{text:stage==='done'?'The barrier is down':'Watch the barrier lift',target:null};},
  detach,
  debug:{
   complete(){ctx?.emit('ending_finished');return ctx?.stage();},
   state(){return{hold,cardWait,cardResolved,clock,next,started,cleared,finished,released,beats:ENDING_BEATS.length,cameraLift:ctx?((ctx.explorer as unknown as {game?:{cameraLift?:number}}).game?.cameraLift??0):0};},
   finale(){return finale?.state()??null;},
   finaleSeek(seconds:number){if(!finale)return null;finale.start();finale.seek(seconds);return finale.state();},
   /** Seek the Mac clock to a beat (headless evidence); fires every beat up to it. */
   clockTo(seconds:number){
    if(!started){started=true;dom();}
    clock=Math.max(clock,Math.max(0,seconds));
    crane();
    if(!cleared&&clock>=ENDING_CLEAR_AT)clearScreen();
    while(next<ENDING_BEATS.length&&ENDING_BEATS[next].at<=clock)fire(ENDING_BEATS[next++]);
    return{hold,clock,next,started,cleared,released,finished};
   },
  },
 };
}
