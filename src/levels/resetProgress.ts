import {OPENING_SAVE_KEY} from '../opening/persistence';
import {CAMPAIGN_SAVE_KEY} from '../campaign/state';

/**
 * One definition of "all local progress for BARRIER 2030", shared by the
 * chapter menu's Reset progress button and the ending credits' Play again
 * button. Both clear every chapter, checkpoint, mission and campaign save;
 * the credits additionally reset the world threat and reload.
 */
export interface ProgressStorage{
 readonly length:number;
 key(index:number):string|null;
 getItem(key:string):string|null;
 removeItem(key:string):void;
}

/** Exact keys outside the namespaced prefixes. */
const EXACT:readonly string[]=[OPENING_SAVE_KEY,OPENING_SAVE_KEY+'.writer',CAMPAIGN_SAVE_KEY];
/** Namespaces owned by this game: opening save slots, survey/level saves, lion mission. */
const PREFIXES:readonly string[]=[OPENING_SAVE_KEY+'.','hku.','hku.lion-boss.v1.'];

/** Every stored key this game owns, in storage order. Pure read, no writes. */
export function progressKeys(storage:ProgressStorage):string[]{
 const doomed:string[]=[];
 for(let index=0;index<storage.length;index++){
  const key=storage.key(index);
  if(!key)continue;
  if(EXACT.includes(key)||PREFIXES.some(prefix=>key.startsWith(prefix)))doomed.push(key);
 }
 return doomed;
}

/** Remove this game's saves and return the keys that were removed. */
export function clearProgress(storage:ProgressStorage):string[]{
 const doomed=progressKeys(storage);
 for(const key of doomed)storage.removeItem(key);
 return doomed;
}
