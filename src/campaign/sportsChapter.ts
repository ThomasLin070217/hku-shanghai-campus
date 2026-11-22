import {SPORTS_HALL_PUZZLE} from '../gameplay/sudokuPuzzle';
import {createSportsDoorCore} from '../gameplay/sportsDoorCore';
import {createStudentCrowd} from '../gameplay/studentCrowd';
import {SPORTS_DOOR,SPORTS_HALL,sportsDoorWorld} from '../model/sportsDoor';
import {SITE} from '../model/campusParameters';
import {stageIndex,type CampaignEvent} from './state';
import {createStudentRunout,type StudentRunout,type StudentRunoutWorld} from './studentRunout';
import type {Chapter,ChapterContext} from './types';

/** Outside the sports hall east door, 2.6 m east like `createSportsRescueExperience.relocate`. */
const door=sportsDoorWorld(SITE.sportsZ);
export const SPORTS_ENTRY:Chapter['entry']={point:[door.x+2.6,0,door.z],radius:2.5,event:'reach_sports'};
/** Chapter checks attach the chapter with a stubbed explorer; the real game always has a world. */
const HEADLESS_WORLD:StudentRunoutWorld={support:(x,_z,_from)=>x<SPORTS_HALL.x+SPORTS_HALL.eastX?SPORTS_HALL.floorTop:0};
/**
 * The walking leg from the lawn shelter to the east door. It stays in the
 * corridor between the towers, enters the sports strip through the gap between
 * the two court fences (x 17–27.5), then passes north of the tennis nets along
 * z=-106 before turning to the door. Straight lines across the courts are
 * blocked by the nets, so the last bend is deliberate.
 */
export const SPORTS_APPROACH:Chapter['approach']=[
 [1,87],[24,87],[24,-106],[-40,-106],[-40,door.z],[SPORTS_ENTRY.point[0],door.z],
];

/** Both door runtimes (panel + headless core) expose the same campaign surface. */
type SportsDoorRuntime={
 update(dt:number):void;interact():boolean;unlock(silent?:boolean):boolean;lock(silent?:boolean):void;
 submitSudoku(digits:string[]):boolean;submitPassword(entries:string[]|string):boolean;
 dispose():void;readonly open:boolean;readonly state?:Record<string,unknown>|(()=>Record<string,unknown>);
};

/**
 * Chapter 3: the east door that frees the 100 students. In the browser the
 * chapter mounts the real lock panel (sudoku then password) with the campaign
 * banner; headless it uses the same core, so the checks exercise the same
 * answers and the same collision toggle.
 */
export function createSportsChapter():Chapter{
 let ctx:ChapterContext|null=null,doorRuntime:SportsDoorRuntime|null=null,opened=false;
 let crowd:ReturnType<typeof createStudentCrowd>|null=null,runout:StudentRunout|null=null;
 const isOpen=()=>doorRuntime?.open??false;
 /** The crowd cheer is optional and must never block the rescue. */
 function playCheer(){
  if(typeof Audio==='undefined'||typeof window==='undefined')return;
  void import('../gameplay/storyAudioAssets').then(({STORY_AUDIO_URLS})=>{
   const audio=new Audio(STORY_AUDIO_URLS['sfx_crowd_cheer'].href);
   audio.volume=.45;
   return audio.play().catch(()=>{});
  }).catch(()=>{/* Audio is optional. */});
 }
 function openDoor():{sudoku:boolean;password:boolean;open:boolean}{
  if(!doorRuntime)return{sudoku:false,password:false,open:false};
  const sudoku=doorRuntime.submitSudoku([...SPORTS_HALL_PUZZLE.answer]);
  const password=sudoku&&doorRuntime.submitPassword(SPORTS_HALL_PUZZLE.password.answer);
  doorRuntime.update(0);
  return{sudoku,password,open:doorRuntime.open};
 }
 /** A run restored past the rescue (reload or checkpoint at `ending`/`done`) finds the door open, silently. */
 function restore(c:ChapterContext){
  if(!doorRuntime||stageIndex(c.stage())<=stageIndex('sports'))return;
  doorRuntime.unlock(true);opened=true;
 }
 function attach(c:ChapterContext){
  ctx=c;
  // The crowd is the same in both runtimes: it waits in the hall before the
  // player reaches the door and runs out when the latch below fires.
  crowd=createStudentCrowd();
  c.root().add(crowd.root);
  runout=createStudentRunout(crowd,c.explorer.world??HEADLESS_WORLD);
  if(typeof document==='undefined'){
   doorRuntime=createSportsDoorCore({game:()=>c.explorer.game,notify:c.notify});
   restore(c);
   return;
  }
  // The panel lives in `sportsDoor.ts`, which imports its stylesheet; loading it
  // on demand keeps this module importable by the headless campaign checks.
  void import('../gameplay/sportsDoor').then(m=>{
   if(ctx!==c)return;
   doorRuntime=m.createSportsDoor({
    root:()=>c.root(),game:()=>c.explorer.game,notify:c.notify,
    openPanel:()=>c.openPanel('door'),closePanel:()=>c.closePanel(),resume:()=>c.resume(),
    standalone:false,campaign:true,
   });
   restore(c);
  }).catch(error=>{c.notify('The door lock could not load.');console.error(error);});
 }
 function update(dt:number){
  doorRuntime?.update(dt);
  // Latch only when the event is accepted: on the walking leg a door that is
  // already open must not consume its one emit before the stage reaches `sports`.
  if(!opened&&isOpen()&&ctx?.emit('door_opened')){opened=true;runout?.release();playCheer();}
  runout?.update(dt);
 }
 return{
  id:'sports',entry:SPORTS_ENTRY,approach:SPORTS_APPROACH,
  attach,
  update,
  interact(){return doorRuntime?.interact()??false;},
  objective(stage){
   const open=isOpen();
   return{
    text:open||stage!=='sports'?'The students are free':'Open the sports hall east door',
    target:open?null:[SPORTS_ENTRY.point[0],SPORTS_ENTRY.point[1],SPORTS_ENTRY.point[2]],
   };
  },
  // Restart in the same tab: the next run's Chapter 3 starts at a locked door (the state is not saved).
  detach(){runout?.dispose();runout=null;crowd?.dispose();crowd=null;doorRuntime?.lock(true);doorRuntime?.update(0);doorRuntime?.dispose();doorRuntime=null;ctx=null;opened=false;},
  debug:{
   open:openDoor,
   door(){const state=doorRuntime?.state;return{...(typeof state==='function'?state():state??{}),entry:SPORTS_ENTRY};},
   complete(){ctx?.emit('reach_sports');return openDoor();},
   /** Read-only snapshot for the checks and the owner's visual pass. */
   runout(){return crowd&&runout?{...runout.counts(),crowd:crowd.root.name}:null;},
  },
 };
}
