import {LION} from '../model/lionParameters';
import {SAFE} from '../lionBoss/combat';
import type {CampaignEvent} from './state';
import type {Chapter,ChapterContext} from './types';

/** The lawn guardian trigger: the shelter point `src/lionBoss/play.ts` starts the fight from. */
export const LAWN_ENTRY:Chapter['entry']={point:[SAFE.x,LION.groundY,SAFE.z],radius:3,event:'reach_lawn'};
const EVENTS:CampaignEvent[]=['reach_lawn','guardian_shutdown'];

/** Stub (Task 1). Task 3 replaces the body with the rigged lion fight. */
export function createLawnChapter():Chapter{
 let ctx:ChapterContext|null=null;
 return{
  id:'lawn',entry:LAWN_ENTRY,approach:[[58,25],[58,33.5],[24,33.5],[24,SAFE.z],[SAFE.x,SAFE.z]],
  attach(c){ctx=c;},
  update(){},
  interact(){return false;},
  objective(){return{text:'Shut down the lawn guardian',target:null};},
  detach(){ctx=null;},
  debug:{complete(){for(const e of EVENTS)ctx?.emit(e);return ctx?.stage();}},
 };
}
