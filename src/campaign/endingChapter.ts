import type {Chapter,ChapterContext} from './types';

/** The ending has no walking leg: radius 0, the host never emits its entry event. */
export const ENDING_ENTRY:Chapter['entry']={point:[0,0,0],radius:0,event:'door_opened'};

/** Stub (Task 1). A later task replaces the body with the dome lifting. */
export function createEndingChapter():Chapter{
 let ctx:ChapterContext|null=null;
 return{
  id:'ending',entry:ENDING_ENTRY,approach:[],
  attach(c){ctx=c;},
  update(){},
  interact(){return false;},
  objective(stage){return{text:stage==='done'?'The barrier is down':'Watch the barrier lift',target:null};},
  detach(){ctx=null;},
  debug:{complete(){ctx?.emit('ending_finished');return ctx?.stage();}},
 };
}
