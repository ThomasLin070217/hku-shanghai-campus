import type {CampusGame} from '../exploration/game';
import {SPORTS_DOOR} from '../model/sportsDoor';
import {SPORTS_HALL_PUZZLE,checkCode,checkPassword} from './sudokuPuzzle';

/**
 * The rescue banner copy, pure so the headless checks can read it. The campaign
 * version frees the students and stops there: the ending chapter owns "The
 * End", and no player-path banner may link out of the one-world page.
 */
export function rescueBannerMarkup(campaign:boolean):string{
 if(campaign)return '<div role="status" aria-live="polite"><span class="eyebrow">SPORTS HALL · EAST DOOR</span><h2>The students are free.</h2><p>100 students are safe. The east hall door is open.</p><small>Click anywhere to dismiss</small></div>';
 return '<div role="status" aria-live="polite"><span class="eyebrow">SPORTS HALL · EAST DOOR</span><h2>You rescued the students.</h2><p>100 students are safe. The hall is clear.</p><p class="rescue-ending">The End. Thanks for playing BARRIER 2030.</p><p class="rescue-links"><a href="?experience=levels">Back to chapters</a></p><small>Click anywhere to dismiss</small></div>';
}

/**
 * The DOM-free half of the door: the puzzle answers from the content file, the
 * collision toggle and the single unlock path. The campaign's sports chapter
 * uses this in checks (and as the source of truth in the browser panel), so the
 * lock can never be opened by a second, weaker code path.
 */
export function createSportsDoorCore(options:{game:()=>CampusGame;notify?:(text:string)=>void;persist?:()=>void}){
 const puzzle=SPORTS_HALL_PUZZLE;
 let sudokuSolved=false,applied:boolean|null=null,appliedWorld:CampusGame['body']['world']|null=null;
 const isOpen=()=>options.game().doors[SPORTS_DOOR.id]===true;
 function syncCollision(){
  const open=isOpen(),world=options.game().body.world;
  if(world!==appliedWorld||applied!==open){world.setDoorOpen(SPORTS_DOOR.id,open);appliedWorld=world;applied=open;}
 }
 /** `silent` restores a known state (a reload past the rescue, a restart) without a notice. */
 function unlock(silent=false){
  if(isOpen())return false;
  options.game().doors[SPORTS_DOOR.id]=true;options.persist?.();
  if(!silent)options.notify?.('Both checks passed. The glass door is opening.');
  return true;
 }
 function lock(silent=false){options.game().doors[SPORTS_DOOR.id]=false;options.persist?.();if(!silent)options.notify?.('The door lock is engaged again.');}
 function submitSudoku(digits:string[]){
  if(sudokuSolved)return true;
  if(!checkCode(puzzle,digits))return false;
  sudokuSolved=true;return true;
 }
 function submitPassword(entries:string[]|string){
  if(!sudokuSolved||!checkPassword(puzzle,entries))return false;
  unlock();return true;
 }
 return{
  get open(){return isOpen();},
  get sudokuSolved(){return sudokuSolved;},
  puzzle,syncCollision,unlock,lock,submitSudoku,submitPassword,
  update(_dt=0){syncCollision();},
  interact(){return false;},
  dispose(){/* The core owns no resources. */},
  state(){return{id:SPORTS_DOOR.id,open:isOpen(),sudokuSolved};},
 };
}
export type SportsDoorCore=ReturnType<typeof createSportsDoorCore>;
