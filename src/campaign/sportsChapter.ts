import {sportsDoorWorld} from '../model/sportsDoor';
import {SITE} from '../model/campusParameters';
import type {CampaignEvent} from './state';
import type {Chapter,ChapterContext} from './types';

/** Outside the sports hall east door, 2.6 m east like `createSportsRescueExperience.relocate`. */
const door=sportsDoorWorld(SITE.sportsZ);
export const SPORTS_ENTRY:Chapter['entry']={point:[door.x+2.6,0,door.z],radius:2.5,event:'reach_sports'};
const EVENTS:CampaignEvent[]=['reach_sports','door_opened'];

/** Stub (Task 1). Task 4 replaces the body with the east-door rescue. */
export function createSportsChapter():Chapter{
 let ctx:ChapterContext|null=null;
 return{
  id:'sports',entry:SPORTS_ENTRY,approach:[[1,87],[24,87],[24,door.z],[door.x+2.6,door.z]],
  attach(c){ctx=c;},
  update(){},
  interact(){return false;},
  objective(){return{text:'Open the sports hall east door',target:null};},
  detach(){ctx=null;},
  debug:{complete(){for(const e of EVENTS)ctx?.emit(e);return ctx?.stage();}},
 };
}
