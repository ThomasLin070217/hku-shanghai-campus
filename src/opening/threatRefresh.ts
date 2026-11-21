import {refreshedWorldThreat,worldThreatWriteEpoch,type WorldThreat} from '../gameplay/worldThreat';

/**
 * Rate-limited refresh of the shared world threat record.
 *
 * The opening experience calls this every frame, but the record only changes at
 * chapter boundaries (the lawn writes lion+power, the ending purges). Reading it
 * once a second is enough, and it keeps a corrupt record from being re-read -
 * and re-logged as `.unreadable.<now>` - sixty times a second.
 */
export function createThreatRefresh(seconds=1){
 let clock=0,seen=worldThreatWriteEpoch();
 return(cached:WorldThreat,dt:number,load:()=>WorldThreat):WorldThreat=>{
  clock+=Math.max(0,dt);
  // A writer in this page (the ending's purge) bumps the in-memory epoch: adopt it on this
  // frame, or the stale sealed frame cancels the dome release in flight (IF1 G1). Checking the
  // epoch reads no storage, and loads only bump it on real writes, so a corrupt record is
  // still read at most once per period.
  const written=worldThreatWriteEpoch()!==seen;
  if(!written&&clock<seconds)return cached;
  clock=0;seen=worldThreatWriteEpoch();
  return refreshedWorldThreat(cached,load);
 };
}
