import {refreshedWorldThreat,type WorldThreat} from '../gameplay/worldThreat';

/**
 * Rate-limited refresh of the shared world threat record.
 *
 * The opening experience calls this every frame, but the record only changes at
 * chapter boundaries (the lawn writes lion+power, the ending purges). Reading it
 * once a second is enough, and it keeps a corrupt record from being re-read -
 * and re-logged as `.unreadable.<now>` - sixty times a second.
 */
export function createThreatRefresh(seconds=1){
 let clock=0;
 return(cached:WorldThreat,dt:number,load:()=>WorldThreat):WorldThreat=>{
  clock+=Math.max(0,dt);
  if(clock<seconds)return cached;
  clock=0;
  return refreshedWorldThreat(cached,load);
 };
}
