import {markLocalModelCleared,resetWorldThreat,tryPurgeWorld,type WorldThreatStorage} from '../gameplay/worldThreat';
import {clearProgress,type ProgressStorage} from '../levels/resetProgress';
import type {Chapter,ChapterContext} from './types';

/** The ending has no walking leg: radius 0, the host never emits its entry event. */
export const ENDING_ENTRY:Chapter['entry']={point:[0,0,0],radius:0,event:'door_opened'};

export interface EndingBeat{
 /** Seconds after the ending attaches. */
 at:number;
 /** The Mac screen line, exactly as doc/12 §7 storyboards it. */
 line:string;
 /** Lifts the dome on this beat. */
 release?:boolean;
}

/**
 * doc/12 §7: the HKU supercomputer boots its four CPUs one by one, starts
 * synchronising, restores administrator access, and the barrier lifts.
 * `ENDING_SECONDS` is the whole sequence, credits included.
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
export const ENDING_SECONDS=12;

/** The credits card body. Pure, so the headless check reads the exact copy. */
export function creditsMarkup():string{
 return '<section id="ending-credits-card" role="dialog" aria-modal="true" aria-label="BARRIER 2030 credits">'
  +'<p class="ending-kicker">HKU SHANGHAI · CDS</p>'
  +'<h2>BARRIER 2030</h2>'
  +'<p class="ending-team">Thomas · Harry · Frost · WHL</p>'
  +'<p class="ending-place">HKU Shanghai · CDS</p>'
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

const STYLE_ID='ending-styles';
const ENDING_CSS=`
#ending-overlay{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 42%,rgba(9,24,19,.86),rgba(2,7,5,.97) 70%);font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;color:#e8f4ee;opacity:0;transition:opacity .6s ease}
#ending-overlay.show{opacity:1}
#ending-overlay .ending-mac{width:min(880px,92vw);filter:drop-shadow(0 40px 90px rgba(0,0,0,.7))}
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
#ending-credits{position:fixed;inset:0;z-index:61;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,rgba(10,26,21,.92),rgba(2,7,5,.985) 72%);font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#e8f4ee;opacity:0;transition:opacity .7s ease}
#ending-credits.show{opacity:1}
#ending-credits-card{text-align:center;padding:40px 46px;max-width:min(560px,90vw)}
#ending-credits-card .ending-kicker{margin:0 0 18px;font:600 11px/1.2 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.26em;color:#74e6b4}
#ending-credits-card h2{margin:0;font:400 clamp(40px,7vw,64px)/1.02 Georgia,"Times New Roman",serif;letter-spacing:.01em}
#ending-credits-card .ending-team{margin:26px 0 0;font:400 clamp(17px,2.4vw,21px)/1.4 Georgia,"Times New Roman",serif;color:#e8f4ee}
#ending-credits-card .ending-place{margin:8px 0 0;font:600 11px/1.2 ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;letter-spacing:.2em;color:#a4bcb1;text-transform:uppercase}
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
 * The epilogue. Attaching clears the local model and purges the world threat
 * (lion down + core power cut are earlier chapters' facts), plays the doc/12 §7
 * Mac boot on its own clock while the dome lifts, then shows the credits.
 * The sequence is `update(dt)`-driven so the headless check can fast-forward it.
 */
export function createEndingChapter():Chapter{
 let ctx:ChapterContext|null=null,clock=0,next=0,finished=false,released=false;
 let overlay:HTMLElement|null=null,lines:HTMLElement|null=null,credits:HTMLElement|null=null;
 let restoreAtmosphere:(()=>void)|null=null;

 function takeDome(){
  const atmo=ctx?.atmosphere();
  if(!atmo||restoreAtmosphere)return;
  const original=atmo.update;
  // Chapter 1 keeps re-asserting its cached sealed curtain every frame through
  // `atmosphere.update`. Once this ending purges the campus that flag is
  // historical: the ending owns the dome from here and lets it lift. Nothing
  // else about the chapter-1 update path is touched, and detach restores it.
  atmo.update=((dt,state)=>original(dt,released?{incident:false,curtain:false,paused:false}:state)) as typeof atmo.update;
  restoreAtmosphere=()=>{atmo.update=original;restoreAtmosphere=null;};
 }

 function dom(){
  if(typeof document==='undefined')return;
  document.getElementById(STYLE_ID)?.remove();
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=ENDING_CSS;document.head.append(style);
  overlay=document.createElement('div');overlay.id='ending-overlay';
  overlay.innerHTML='<div class="ending-mac"><div class="ending-screen"><div class="ending-camera"></div><p class="ending-head"><span>HKU SUPERCOMPUTER</span><span>B04 · CDS-1</span></p><ul class="ending-lines"></ul></div><div class="ending-base"></div><div class="ending-notch"></div></div>';
  lines=overlay.querySelector('.ending-lines');
  document.body.append(overlay);
  requestAnimationFrame(()=>overlay?.classList.add('show'));
 }

 function fire(beat:EndingBeat){
  if(beat.release&&!released){released=true;takeDome();ctx?.atmosphere()?.release();}
  if(!lines)return;
  const line=document.createElement('li');
  line.textContent=beat.line;
  if(beat.line.includes('OFFLINE'))line.className='is-offline';
  else if(beat.line.includes('ONLINE'))line.className='is-online';
  else if(beat.release)line.className='is-final';
  lines.append(line);
 }

 function showCredits(){
  if(typeof document==='undefined'||credits)return;
  credits=document.createElement('div');credits.id='ending-credits';credits.innerHTML=creditsMarkup();
  document.body.append(credits);
  requestAnimationFrame(()=>credits?.classList.add('show'));
  credits.querySelector('#ending-play-again')?.addEventListener('click',()=>{try{clearAllProgress(localStorage);}catch{/* storage blocked: the reload still clears the session */}location.reload();});
 }

 function attach(c:ChapterContext){
  ctx=c;clock=0;next=0;finished=false;released=false;
  // The last endgame fact, then the purge: lion down and power cut were the
  // earlier chapters' writes, so this is the frame the barrier can fall.
  markLocalModelCleared();
  tryPurgeWorld();
  dom();
  try{c.explorer.pause('ending');}catch{/* a paused/absent explorer must not stop the epilogue */}
 }

 function update(dt:number){
  if(finished)return;
  clock+=Math.max(0,dt);
  while(next<ENDING_BEATS.length&&ENDING_BEATS[next].at<=clock)fire(ENDING_BEATS[next++]);
  if(clock>=ENDING_SECONDS){
   finished=true;
   showCredits();
   ctx?.emit('ending_finished');
  }
 }

 function detach(){
  overlay?.remove();credits?.remove();overlay=null;credits=null;lines=null;
  restoreAtmosphere?.();
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
   state(){return{clock,next,finished,released,beats:ENDING_BEATS.length};},
  },
 };
}
