import './dataComponents.css';

/**
 * BarList — distribution bars for a handful of categories.
 *
 * Deliberately CSS, not a chart library: the data sets here are 3–8 categories
 * (scene kinds, validation severities, source files), so a hand-written bar is
 * lighter, pixel-friendly and fully accessible (each row is real text).
 */
export interface BarItem {
  label:string;
  value:number;
  /** Optional trailing text overriding the raw number (for example "12 项"). */
  display?:string;
  tone?:'green'|'sand'|'ink'|'warn';
}

export interface BarList {
  readonly el:HTMLElement;
  update(items:readonly BarItem[],options?:{total?:number;unit?:string}):void;
  dispose():void;
}

export function createBarList(options:{ariaLabel?:string;max?:number}={}):BarList{
  const el=document.createElement('ul');
  el.className='bar-list';
  el.setAttribute('aria-label',options.ariaLabel??'Distribution');
  let last='';
  function update(items:readonly BarItem[],opts:{total?:number;unit?:string}={}):void{
    const max=Math.max(1,...items.map(i=>i.value),options.max??0);
    const next=JSON.stringify([items,opts]);
    if(next===last)return;
    last=next;
    el.replaceChildren();
    for(const item of items){
      const row=document.createElement('li');
      row.className='bar-row';
      if(item.tone)row.dataset.tone=item.tone;
      const head=document.createElement('span');
      head.className='bar-head';
      const label=document.createElement('b');
      label.textContent=item.label;
      const value=document.createElement('span');
      value.className='bar-value';
      value.textContent=item.display??String(item.value)+(opts.unit??'');
      head.append(label,value);
      const track=document.createElement('i');
      track.className='bar-track';
      track.setAttribute('aria-hidden','true');
      const fill=document.createElement('u');
      fill.className='bar-fill';
      fill.style.width=(item.value<=0?0:Math.max(2,Math.round(item.value/max*100)))+'%';
      track.append(fill);
      row.append(head,track);
      el.append(row);
    }
  }
  update([]);
  return{el,update,dispose(){el.remove();last='';}};
}

/** A single progress line: "3 / 3 records". Used by the survey HUD and stepper. */
export function createProgressBar(options:{label?:string}={}):{readonly el:HTMLElement;update(done:number,total:number,text?:string):void;dispose():void}{
  const el=document.createElement('div');
  el.className='progress-line';
  const label=document.createElement('span');
  label.className='progress-label';
  if(options.label)label.textContent=options.label;
  const track=document.createElement('i');
  track.className='bar-track';
  track.setAttribute('aria-hidden','true');
  const fill=document.createElement('u');
  fill.className='bar-fill';
  track.append(fill);
  const text=document.createElement('span');
  text.className='progress-text';
  el.append(label,track,text);
  el.setAttribute('role','progressbar');
  el.setAttribute('aria-valuemin','0');
  let last='';
  return{
    el,
    update(done,total,textValue){
      const safeTotal=Math.max(0,total);
      const clamped=Math.min(safeTotal,Math.max(0,done));
      const pct=safeTotal?Math.round(clamped/safeTotal*100):0;
      const next=pct+'|'+(textValue??clamped+'/'+safeTotal);
      if(next===last)return;
      last=next;
      fill.style.width=pct+'%';
      el.setAttribute('aria-valuenow',String(clamped));
      el.setAttribute('aria-valuemax',String(safeTotal));
      text.textContent=textValue??clamped+'/'+safeTotal;
    },
    dispose(){el.remove();last='';},
  };
}
