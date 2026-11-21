import './chapterCard.css';

const FADE_MS=300;
let el:HTMLElement|null=null,kickerEl:HTMLElement|null=null,titleEl:HTMLElement|null=null,run=0;

function ensure(){
 if(el?.isConnected)return el;
 el=document.createElement('div');el.className='campaign-card';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.hidden=true;
 const inner=document.createElement('div');inner.className='campaign-card-inner';
 kickerEl=document.createElement('p');kickerEl.className='campaign-card-kicker';
 titleEl=document.createElement('h2');titleEl.className='campaign-card-title';
 inner.append(kickerEl,titleEl);el.append(inner);document.body.append(el);
 return el;
}

/**
 * The one full-screen chapter card used at every chapter boundary: fades in over
 * 300 ms, holds, fades out. It never blocks input or pauses the game; a newer
 * card replaces one that is still showing.
 */
export function showChapterCard(kicker:string,title:string,ms=2400):Promise<void>{
 const card=ensure(),id=++run;
 kickerEl!.textContent=kicker;titleEl!.textContent=title;
 card.dataset.chapterCard=kicker;card.hidden=false;card.classList.remove('is-visible');
 void card.offsetWidth;card.classList.add('is-visible');
 return new Promise(resolve=>{
  window.setTimeout(()=>{
   if(id!==run){resolve();return;}
   card.classList.remove('is-visible');
   window.setTimeout(()=>{if(id===run){card.hidden=true;delete card.dataset.chapterCard;}resolve();},FADE_MS);
  },FADE_MS+Math.max(0,ms));
 });
}
