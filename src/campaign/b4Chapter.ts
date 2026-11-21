import type {CampaignEvent} from './state';
import type {Chapter,ChapterContext} from './types';

/** Just inside the B04 entrance door, by the Chapter 1 handoff point. */
export const B4_ENTRY:Chapter['entry']={point:[58,.02,18],radius:1.6,event:'enter_b4'};
const EVENTS:CampaignEvent[]=['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected'];

/** Stub (Task 1). Task 2 replaces the body with the B04 ground-floor rooms. */
export function createB4Chapter():Chapter{
 let ctx:ChapterContext|null=null;
 return{
  id:'b4',entry:B4_ENTRY,approach:[[58,25],[58,18]],
  attach(c){ctx=c;},
  update(){},
  interact(){return false;},
  objective(){return{text:'Restore the B4 supercomputer',target:null};},
  detach(){ctx=null;},
  debug:{complete(){for(const e of EVENTS)ctx?.emit(e);return ctx?.stage();}},
 };
}
