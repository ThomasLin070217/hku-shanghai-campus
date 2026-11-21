import type {CampaignEvent,CampaignStage} from './state';

/**
 * B4 Keyboard Wall puzzle rules. Pure: no DOM, no three.js, no storage. The
 * chapter feeds key presses, tile flips and station actions in and turns the
 * returned events into campaign events. Same four steps as the legacy
 * `interiors.html?chapter=b4` page: keyboard → flip → breaker → connect.
 */
export const B4_PHRASE='ILOVECDS';
export type B4Step='keyboard'|'flip'|'breaker'|'connect'|'done';

export function b4StepOf(stage:CampaignStage):B4Step|null{
 switch(stage){
  case 'b4_enter':return null;
  case 'b4_keyboard':return 'keyboard';
  case 'b4_flip':return 'flip';
  case 'b4_breaker':return 'breaker';
  case 'b4_connect':return 'connect';
  default:return 'done';
 }
}

export interface KeyboardState{readonly typed:string;readonly solved:boolean}
/** accepted: next letter of the phrase; ready: the phrase is complete, Enter boots;
 * reset: a wrong cap (or an early Enter) clears the sequence; ignored: space/modifiers. */
export type KeyResult='accepted'|'ready'|'solved'|'reset'|'ignored';
export function createKeyboardState():KeyboardState{return{typed:'',solved:false};}
const IGNORED=new Set([' ','Space','Shift','Caps Lock','CapsLock','Tab','Backspace']);
export function pressKeyboard(s:KeyboardState,key:string):{state:KeyboardState;result:KeyResult}{
 if(s.solved||IGNORED.has(key))return{state:s,result:'ignored'};
 if(key==='Enter'){
  if(s.typed===B4_PHRASE)return{state:{typed:s.typed,solved:true},result:'solved'};
  return{state:{typed:'',solved:false},result:'reset'};
 }
 const cap=key.length===1?key.toUpperCase():key;
 if(s.typed.length<B4_PHRASE.length&&cap===B4_PHRASE[s.typed.length]){
  const typed=s.typed+cap;
  return{state:{typed,solved:false},result:typed===B4_PHRASE?'ready':'accepted'};
 }
 return{state:{typed:'',solved:false},result:'reset'};
}

export interface FlipState{readonly flipped:readonly boolean[]}
export function createFlipState(count:number,flipped=false):FlipState{return{flipped:Array.from({length:count},()=>flipped)};}
/** Sweep passes `value=true` (a tile you sweep over shows its back); a click toggles. */
export function flipTiles(s:FlipState,indices:readonly number[],value?:boolean):FlipState{
 const next=[...s.flipped];
 for(const i of indices)if(i>=0&&i<next.length)next[i]=value??!next[i];
 return{flipped:next};
}
export function flipCount(s:FlipState){return s.flipped.reduce((n,f)=>n+(f?1:0),0);}
export function flipSolved(s:FlipState){return s.flipped.length>0&&s.flipped.every(Boolean);}

export interface StationResult{ok:boolean;event?:CampaignEvent;reason?:string}
export function pullBreaker(step:B4Step|null):StationResult{
 if(step!=='breaker')return{ok:false,reason:step==='keyboard'||step==='flip'?'The breaker is behind the flip wall.':'The breaker is already closed.'};
 return{ok:true,event:'breaker_pulled'};
}
/** The relay key has exactly one writer (`markRelayRestored`); it is injected here. */
export function connectMacBook(step:B4Step|null,deviceId:string,writeRelay:(id:string)=>void):StationResult{
 if(step!=='connect')return{ok:false,reason:step==='done'?'The MacBook is already paired.':'The supercomputer has no power yet. Pull the breaker first.'};
 if(!deviceId)return{ok:false,reason:'You need the MacBook to pair with the supercomputer.'};
 writeRelay(deviceId);
 return{ok:true,event:'macbook_connected'};
}

export interface FlipCell{row:number;column:number}
/** A sweep paints a band this many rows/columns either side of the pointer. A 9-row
 * band lets three horizontal drags cover all 17 rows of the HKU wall with overlap,
 * even where perspective bends a straight drag across rows near the wall's ends. */
export const SWEEP_BRUSH={rows:4,columns:2};
/** Tiles (row-major indices) a drag covers between two pointer cells, with the brush. */
export function sweepTiles(grid:{rows:number;columns:number},from:FlipCell|null,to:FlipCell,brush=SWEEP_BRUSH):number[]{
 const a=from??to,steps=Math.max(1,Math.abs(to.row-a.row),Math.abs(to.column-a.column)),out=new Set<number>();
 for(let s=0;s<=steps;s++){
  const r=Math.round(a.row+(to.row-a.row)*s/steps),c=Math.round(a.column+(to.column-a.column)*s/steps);
  for(let dr=-brush.rows;dr<=brush.rows;dr++)for(let dc=-brush.columns;dc<=brush.columns;dc++){
   const rr=r+dr,cc=c+dc;if(rr>=0&&rr<grid.rows&&cc>=0&&cc<grid.columns)out.add(rr*grid.columns+cc);
  }
 }
 return[...out];
}

/** Once this share of the wall is turned, the last tiles turn over by themselves. */
export const AUTO_FINISH=.95;
/** Tiles that turn over by themselves: every unflipped tile once at least AUTO_FINISH
 * of the wall is flipped (and the wall is not yet complete), otherwise none. */
export function autoFinishTiles(s:FlipState,ratio=AUTO_FINISH):number[]{
 const total=s.flipped.length;if(!total||flipSolved(s)||flipCount(s)<Math.ceil(ratio*total))return[];
 return s.flipped.flatMap((f,i)=>f?[]:[i]);
}
