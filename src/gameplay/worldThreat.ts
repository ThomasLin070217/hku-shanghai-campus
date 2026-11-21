/**
 * Persistent campus-threat state shared by every story route.
 *
 * The AI barrier ("天幕") is not an opening-chapter flag: once sealed, it must
 * survive a page reload and a level switch until the campus is actually cleared.
 * A sealed run can only become purged when all three endgame facts are true:
 * the lion is shut down, the power is cut, and the local model is cleared.
 *
 * The module is deliberately storage-injectable so the headless checks can run
 * without a browser. There is exactly one writer of `hku.world.v1`; every route
 * goes through the functions below instead of touching localStorage itself.
 */

import {OPENING_SAVE_KEY} from '../opening/persistence';

export const WORLD_THREAT_KEY='hku.world.v1';

export type WorldThreatPhase='clear'|'sealed'|'purged';

export interface WorldThreatFlags {
 /** The lawn guardian L001 completed its safe shutdown. */
 lionDefeated:boolean;
 /** The emergency power step has been performed. */
 powerCut:boolean;
 /** The local model that was steering the campus AI has been cleared. */
 localModelCleared:boolean;
}

export interface WorldThreat {
 schemaVersion:1;
 phase:WorldThreatPhase;
 sealedAt:number|null;
 purgedAt:number|null;
 flags:WorldThreatFlags;
}

/** The slice of Storage used here, so Node checks can pass a small stub. */
export interface WorldThreatStorage {
 getItem(key:string):string|null;
 setItem(key:string,value:string):void;
 removeItem(key:string):void;
}

const CLEAR_FLAGS:WorldThreatFlags={lionDefeated:false,powerCut:false,localModelCleared:false};

const isFiniteTime=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;

export function createClearWorldThreat():WorldThreat{
 return{schemaVersion:1,phase:'clear',sealedAt:null,purgedAt:null,flags:{...CLEAR_FLAGS}};
}

export function cloneWorldThreat(threat:WorldThreat):WorldThreat{
 return{schemaVersion:1,phase:threat.phase,sealedAt:threat.sealedAt,purgedAt:threat.purgedAt,flags:{...threat.flags}};
}

/** Strict parse for the persisted record; unknown versions are rejected, not guessed. */
export function parseWorldThreat(raw:unknown):WorldThreat|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const record=raw as Record<string,unknown>;
 if(record.schemaVersion!==1)return null;
 const phase=record.phase;
 if(phase!=='clear'&&phase!=='sealed'&&phase!=='purged')return null;
 const sealedAt=record.sealedAt??null,purgedAt=record.purgedAt??null;
 if(sealedAt!==null&&!isFiniteTime(sealedAt))return null;
 if(purgedAt!==null&&!isFiniteTime(purgedAt))return null;
 const rawFlags=record.flags;
 if(!rawFlags||typeof rawFlags!=='object'||Array.isArray(rawFlags))return null;
 const flags=rawFlags as Record<string,unknown>;
 if(typeof flags.lionDefeated!=='boolean'||typeof flags.powerCut!=='boolean'||typeof flags.localModelCleared!=='boolean')return null;
 // A sealed/purged record without its timestamp would make "how long has the campus been dark" unknowable.
 if(phase==='sealed'&&sealedAt===null)return null;
 if(phase==='purged'&&purgedAt===null)return null;
 return{
  schemaVersion:1,phase,sealedAt,purgedAt,
  flags:{lionDefeated:flags.lionDefeated,powerCut:flags.powerCut,localModelCleared:flags.localModelCleared},
 };
}

function defaultStorage():WorldThreatStorage|null{
 try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}
}

export function allEndgameConditionsMet(threat:WorldThreat):boolean{
 return threat.flags.lionDefeated&&threat.flags.powerCut&&threat.flags.localModelCleared;
}

export function isSealed(threat:WorldThreat):boolean{
 return threat.phase==='sealed';
}

/**
 * Read the world state as-is. Returns null when the record is absent, corrupt or
 * from an unknown schema; callers should use loadWorldThreat() for migration.
 */
export function readWorldThreat(storage:WorldThreatStorage|null=defaultStorage()):WorldThreat|null{
 if(!storage)return null;
 try{
  const raw=storage.getItem(WORLD_THREAT_KEY);
  if(!raw)return null;
  return parseWorldThreat(JSON.parse(raw));
 }catch{return null;}
}

/**
 * One-time migration: a legacy opening save with curtain_deployed=true means the
 * campus was already sealed. The opening save is only a fallback; an explicit
 * hku.world.v1 record always wins.
 */
function migrateOpeningSave(raw:string|null):WorldThreat|null{
 if(!raw)return null;
 try{
  const save=JSON.parse(raw) as Record<string,unknown>;
  if(save?.version!==1||save?.mode!=='opening')return null;
  const runtime=save.runtime as Record<string,unknown>|undefined;
  if(runtime?.curtain_deployed!==true)return null;
  const savedAt=isFiniteTime(save.savedAt)?save.savedAt:Date.now();
  return{schemaVersion:1,phase:'sealed',sealedAt:savedAt,purgedAt:null,flags:{...CLEAR_FLAGS}};
 }catch{return null;}
}

export interface LoadWorldThreatOptions {
 storage?:WorldThreatStorage|null;
 /** Override the opening-save fallback, mainly for tests. */
 openingSaveRaw?:string|null;
 now?:number;
}

/**
 * Load the authoritative world state, migrating a legacy opening save once.
 * A corrupt hku.world.v1 value is preserved under a timestamped key instead of
 * being silently reset (the old seal must never be lost without a trace).
 */
export function loadWorldThreat(options:LoadWorldThreatOptions={}):WorldThreat{
 const storage='storage' in options?options.storage??null:defaultStorage();
 const now=options.now??Date.now();
 const raw=storage?.getItem(WORLD_THREAT_KEY)??null;
 if(raw){
  let parsed:unknown=null;
  try{parsed=JSON.parse(raw);}catch{/* handled below */}
  const threat=parseWorldThreat(parsed);
  if(threat)return threat;
  try{storage?.setItem(WORLD_THREAT_KEY+'.unreadable.'+now,raw);}catch{/* keep going with migration */}
 }
 const openingRaw=options.openingSaveRaw!==undefined?options.openingSaveRaw:storage?.getItem(OPENING_SAVE_KEY)??null;
 const migrated=migrateOpeningSave(openingRaw)??createClearWorldThreat();
 if(storage){try{storage.setItem(WORLD_THREAT_KEY,JSON.stringify(migrated));}catch{/* session-only state */}}
 return migrated;
}

export function writeWorldThreat(threat:WorldThreat,storage:WorldThreatStorage|null=defaultStorage()):WorldThreat{
 if(storage){try{storage.setItem(WORLD_THREAT_KEY,JSON.stringify(threat));}catch{/* session-only state */}}
 return threat;
}

/**
 * Seal the campus. This is a one-way clear -> sealed transition: a sealed run
 * stays sealed, and a purged run can never be sealed again by a stale save.
 */
export function sealWorld(now=Date.now(),storage:WorldThreatStorage|null=defaultStorage()):WorldThreat{
 const current=loadWorldThreat({storage,now});
 if(current.phase!=='clear')return current;
 return writeWorldThreat({...current,phase:'sealed',sealedAt:now,purgedAt:null},storage);
}

function markFlag(key:keyof WorldThreatFlags,now:number,storage:WorldThreatStorage|null):WorldThreat{
 const current=loadWorldThreat({storage,now});
 if(current.flags[key])return current;
 return writeWorldThreat({...current,flags:{...current.flags,[key]:true}},storage);
}

export function markLionDefeated(now=Date.now(),storage:WorldThreatStorage|null=defaultStorage()):WorldThreat{
 return markFlag('lionDefeated',now,storage);
}

export function markPowerCut(now=Date.now(),storage:WorldThreatStorage|null=defaultStorage()):WorldThreat{
 return markFlag('powerCut',now,storage);
}

export function markLocalModelCleared(now=Date.now(),storage:WorldThreatStorage|null=defaultStorage()):WorldThreat{
 return markFlag('localModelCleared',now,storage);
}

/**
 * Purge only when the campus is sealed and every endgame fact is true.
 * Returns the persisted state and whether the transition actually happened.
 */
export function tryPurgeWorld(now=Date.now(),storage:WorldThreatStorage|null=defaultStorage()):{threat:WorldThreat;purged:boolean}{
 const current=loadWorldThreat({storage,now});
 if(current.phase!=='sealed'||!allEndgameConditionsMet(current))return{threat:current,purged:false};
 return{threat:writeWorldThreat({...current,phase:'purged',purgedAt:now},storage),purged:true};
}

/**
 * Explicit new-game/replay reset. Writes a clear record instead of deleting the
 * key, so the old opening save cannot re-seal the campus through migration.
 */
export function resetWorldThreat(storage:WorldThreatStorage|null=defaultStorage()):WorldThreat{
 const clear=createClearWorldThreat();
 if(storage){try{storage.setItem(WORLD_THREAT_KEY,JSON.stringify(clear));}catch{/* session-only state */}}
 return clear;
}
