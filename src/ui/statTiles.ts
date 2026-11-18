import {escapeHtml} from './dom';
import './dataComponents.css';

/**
 * StatTiles — a compact row of headline numbers.
 *
 * Data in, DOM out: the caller owns the numbers (scene registry counts,
 * `modelStats()`, survey progress). Rendering is idempotent and diff-free
 * enough for per-frame use: tiles are rebuilt only when the values change.
 */
export interface StatTile {
  label:string;
  value:string|number;
  /** Optional unit, rendered smaller after the value. */
  unit?:string;
  /** Small caption under the value. */
  note?:string;
  tone?:'ink'|'green'|'sand'|'warn';
}

export interface StatTiles {
  readonly el:HTMLElement;
  update(tiles:readonly StatTile[]):void;
  dispose():void;
}

const signature=(tiles:readonly StatTile[])=>tiles.map(t=>[t.label,t.value,t.unit??'',t.note??'',t.tone??'ink'].join('\u0001')).join('\u0002');

export function createStatTiles(options:{ariaLabel?:string}={}):StatTiles{
  const el=document.createElement('section');
  el.className='stat-tiles';
  el.setAttribute('aria-label',options.ariaLabel??'Campus data summary');
  let last='';
  function update(tiles:readonly StatTile[]):void{
    const next=signature(tiles);
    if(next===last)return;
    last=next;
    const frag=document.createDocumentFragment();
    for(const tile of tiles){
      const card=document.createElement('div');
      card.className='stat-tile';
      if(tile.tone&&tile.tone!=='ink')card.dataset.tone=tile.tone;
      const label=document.createElement('span');
      label.className='stat-tile-label';
      label.textContent=tile.label;
      const value=document.createElement('strong');
      value.className='stat-tile-value';
      value.textContent=String(tile.value);
      card.append(label,value);
      if(tile.unit){
        const unit=document.createElement('span');
        unit.className='stat-tile-unit';
        unit.textContent=tile.unit;
        card.append(unit);
      }
      if(tile.note){
        const note=document.createElement('p');
        note.className='stat-tile-note';
        note.textContent=tile.note;
        card.append(note);
      }
      frag.append(card);
    }
    el.replaceChildren(frag);
  }
  update([]);
  return{el,update,dispose(){el.remove();last='';}};
}

/** Convenience: an inline list of label/value pairs (dense, one line each). */
export function createKeyValueList(options:{ariaLabel?:string}={}):{readonly el:HTMLElement;update(rows:readonly [string,string][]):void;dispose():void}{
  const el=document.createElement('dl');
  el.className='kv-list';
  el.setAttribute('aria-label',options.ariaLabel??'Details');
  let last='';
  return{
    el,
    update(rows){
      const next=rows.map(([k,v])=>escapeHtml(k)+'\u0001'+escapeHtml(v)).join('\u0002');
      if(next===last)return;
      last=next;
      el.innerHTML=rows.map(([key,value])=>`<div class="kv-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
    },
    dispose(){el.remove();last='';},
  };
}
