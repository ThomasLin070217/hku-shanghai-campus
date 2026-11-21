/**
 * Task 4 check: the sports hall east door inside the one-world campaign, and the
 * ending sequence that lifts the dome.
 *
 * Headless: real opening-mode campus asset + opening navigation, the real
 * CampusGame physics for the walking leg, the real campaign host and the real
 * world-threat record (with an injected Storage).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {buildSite} from '../src/model/buildSite';
import {SPORTS_DOOR,sportsDoorWorld} from '../src/model/sportsDoor';
import {SPORTS_HALL_PUZZLE} from '../src/gameplay/sudokuPuzzle';
import {createCampaignHost} from '../src/campaign/host';
import {CAMPAIGN_CHAPTERS} from '../src/campaign/chapters';
import {CAMPAIGN_SAVE_KEY} from '../src/campaign/state';
import type {ChapterContext,Explorer} from '../src/campaign/types';
import {WORLD_THREAT_KEY,loadWorldThreat,refreshedWorldThreat} from '../src/gameplay/worldThreat';
import {OPENING_SAVE_KEY} from '../src/opening/persistence';
import {clearProgress} from '../src/levels/resetProgress';
import {SPORTS_ENTRY} from '../src/campaign/sportsChapter';
import {ENDING_BEATS,ENDING_CLEAR_AT,ENDING_HOLD_SECONDS,ENDING_SECONDS,clearAllProgress,creditsMarkup} from '../src/campaign/endingChapter';
import {rescueBannerMarkup} from '../src/gameplay/sportsDoorCore';

let passed=0;
const failures:string[]=[];
function group(name:string,fn:()=>void):void{
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.stack:String(error));}
}

/** localStorage-shaped memory storage shared by the campaign and world threat. */
function memoryStorage(seed:Record<string,string>={}){
 const data=new Map(Object.entries(seed));
 const storage={
  get length(){return data.size;},
  key:(index:number)=>[...data.keys()][index]??null,
  getItem:(key:string)=>data.get(key)??null,
  setItem:(key:string,value:string)=>{data.set(key,value);},
  removeItem:(key:string)=>{data.delete(key);},
  clear:()=>data.clear(),
 };
 return{storage,data};
}

/** The ending chapter writes the world threat through the real localStorage seam. */
function useStorage(storage:unknown){
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true,writable:true});
}

const SEALED_WITH_POWER=JSON.stringify({
 schemaVersion:1,phase:'sealed',sealedAt:1000,purgedAt:null,
 flags:{lionDefeated:true,powerCut:true,localModelCleared:false},
});

/** The opening-mode campus, the same model the campaign renders. */
const asset=buildSite(undefined,undefined,true);
const nav=createNavigation(BUILDINGS,SITE,true);
const game=new CampusGame(nav,BUILDINGS,SITE);
const centre=sportsDoorWorld(SITE.sportsZ);

type AtmosphereFrame={incident:boolean;curtain:boolean;paused:boolean};
function makeHost(seed:Record<string,string>={}){
 // No door reset between groups: `CampusGame.doors` is a real per-run fact and
 // the chapter must cope with a door that is already open (I4).
 game.body.velocity.set(0,0,0);
 const store=memoryStorage(seed),notices:string[]=[],cards:[string,string][]=[];
 const updates:AtmosphereFrame[]=[];
 let released=0;
 useStorage(store.storage);
 const explorer={game,enabled:true,pause(){},enter(){},enterCompat(){},resume(){}} as unknown as Explorer;
 const atmosphere={
  release(){released++;},restoreSealed(){},reset(){},startIncident(){},
  update(_dt:number,state:AtmosphereFrame){updates.push({...state});},
 };
 const host=createCampaignHost({
  context:{
   scene:new T.Scene(),root:()=>asset.root,explorer,notify:text=>notices.push(text),
   atmosphere:()=>atmosphere as never,openPanel:()=>{},closePanel:()=>{},resume:()=>{},
   card:async(kicker,title)=>{cards.push([kicker,title]);},
  } as Omit<ChapterContext,'stage'|'emit'|'deviceId'>,
  storage:store.storage,chapters:CAMPAIGN_CHAPTERS,
 });
 return{host,store,notices,cards,updates,atmosphere,get released(){return released;}};
}

/** Drive the real physics toward a point, exactly like the opening integration check. */
function walkTo(x:number,z:number,max=20000){
 let count=0;
 while(Math.hypot(x-game.body.position.x,z-game.body.position.z)>.12&&count<max){
  game.yaw=Math.atan2(-(x-game.body.position.x),-(z-game.body.position.z));
  game.human={forward:1,right:0,sprint:true};
  game.step(1/120);count++;
 }
 assert.ok(count<max,`blocked walking toward ${x.toFixed(1)},${z.toFixed(1)} at ${game.body.position.toArray().map(n=>n.toFixed(2))} contacts ${JSON.stringify(game.body.contacts)}`);
 return count;
}

group('(a) the opening-mode campus contains the east door and its collision',()=>{
 const door=asset.root.getObjectByName(SPORTS_DOOR.name);
 assert.ok(door,'the sports east door is built in opening mode');
 assert.ok(door!.getObjectByName('Leaf_Left')&&door!.getObjectByName('Leaf_Right'),'both hinged leaves');
 assert.ok(door!.getObjectByName('Night_door_lock_led') instanceof T.Mesh,'lock LED is present');
 assert.equal(nav.blocked(centre.x,centre.z,0),true,'the closed east door blocks the doorway');
 assert.equal(nav.blocked(centre.x+3,centre.z,0),false,'the approach east of the door is clear');
});

group('(b) the sports chapter attaches the door in opening mode with collision',()=>{
 const {host}=makeHost();
 host.start('mac-device','to_sports');
 host.update(1/120);
 assert.deepEqual(host.attached(),['sports'],'the walking leg attaches the sports chapter');
 assert.equal(host.chapter(),null,'to_sports is a walking leg');
 assert.equal(nav.doorOpen(SPORTS_DOOR.id),false,'the campaign door starts closed');
 assert.equal(nav.blocked(centre.x,centre.z,0),true,'closed door blocks the campaign body');
});

group('(c) the lawn-to-sports walking leg is walkable on foot along approach',()=>{
 const {host}=makeHost();
 host.start('mac-device','to_sports');
 game.body.position.set(1,0,87);game.body.velocity.set(0,0,0);game.body.grounded=true;game.paused=false;
 let steps=0;
 for(const [x,z] of CAMPAIGN_CHAPTERS.sports().approach){
  steps+=walkTo(x,z);
  host.update(1/120);
 }
 assert.equal(host.stage(),'sports',`the approach reaches SPORTS_ENTRY and emits reach_sports (walked ${(steps/120).toFixed(1)} s)`);
 assert.ok(Math.hypot(game.body.position.x-SPORTS_ENTRY.point[0],game.body.position.z-SPORTS_ENTRY.point[2])<=SPORTS_ENTRY.radius+.2,'the leg ends at the east door');
 assert.ok(steps<20000*6,`the leg is direct enough to be walked in one go (${steps} steps)`);
});

group('(d) the lock validates with the puzzle answers and opening emits door_opened',()=>{
 const {host,store}=makeHost({[WORLD_THREAT_KEY]:SEALED_WITH_POWER});
 host.start('mac-device','to_sports');
 game.body.position.set(...SPORTS_ENTRY.point as [number,number,number]);game.body.velocity.set(0,0,0);
 host.update(1/120);
 assert.equal(host.stage(),'sports');
 const debug=host.debug.sports as unknown as {open:()=>({sudoku:boolean;password:boolean;open:boolean})};
 const result=debug.open();
 assert.deepEqual(result,{sudoku:true,password:true,open:true},'the content file answers open the lock');
 assert.equal(game.doors[SPORTS_DOOR.id],true,'the door state is open');
 host.update(1/120);
 assert.equal(nav.doorOpen(SPORTS_DOOR.id),true,'collision opens with the door');
 assert.equal(nav.blocked(centre.x,centre.z,0),false,'the player can walk through');
 assert.equal(host.stage(),'ending','door_opened moves the campaign to the ending');
 const threat=loadWorldThreat({storage:store.storage});
 assert.deepEqual(threat.flags,{lionDefeated:true,powerCut:true,localModelCleared:true},'the ending clears the local model');
 assert.equal(threat.phase,'sealed','the purge waits for the ADMINISTRATOR beat so the dome lifts on screen');
});

group('(e) an already-open door still advances the campaign and the ending finishes',()=>{
 const harness=makeHost({[WORLD_THREAT_KEY]:SEALED_WITH_POWER}),{host,store}=harness;
 // Group (d) opened the door and left it open; a fresh host must not strand the run.
 assert.equal(game.doors[SPORTS_DOOR.id],true,'the door is already open before this host starts');
 host.start('mac-device','to_sports');
 game.body.position.set(...SPORTS_ENTRY.point as [number,number,number]);
 host.update(1/120);
 assert.equal(host.stage(),'sports','reach_sports still arrives with the door open');
 host.update(1/120);
 assert.equal(host.stage(),'ending','an open door emits door_opened once the stage is sports (I4)');
 assert.equal(loadWorldThreat({storage:store.storage}).phase,'sealed','nothing purges during the rescue hold');
 const lines=ENDING_BEATS.map(beat=>beat.line).join('\n');
 for(const line of ['HKU SUPERCOMPUTER','CPU 01–04 … OFFLINE','CPU 01 ONLINE','CPU 02 ONLINE','CPU 03 ONLINE','CPU 04 ONLINE','SYNCHRONIZATION STARTED…','ALL PROCESSING UNITS ONLINE','ADMINISTRATOR ACCESS RESTORED'])assert.ok(lines.includes(line),`ending shows ${line}`);
 assert.ok(ENDING_BEATS.every((beat,index)=>index===0||beat.at>ENDING_BEATS[index-1].at),'beats are strictly ordered');
 assert.ok(ENDING_SECONDS>=10&&ENDING_SECONDS<=14,`the sequence stays about 12 s (${ENDING_SECONDS})`);
 assert.ok(ENDING_BEATS.some(beat=>beat.release),'a beat releases the dome');
 // The hold must outlast the rescue banner and the host card before the Mac screen.
 host.update(ENDING_HOLD_SECONDS+2);
 host.update(ENDING_SECONDS+1);
 assert.ok(harness.released>=1,'the ending actually calls atmosphere.release()');
 assert.equal(host.stage(),'done','ending_finished closes the campaign');
 assert.equal(loadWorldThreat({storage:store.storage}).phase,'purged','the ending purges a sealed campus with lion+power');
});

group('(f) credits and the campaign rescue banner read correctly',()=>{
 const credits=creditsMarkup();
 for(const text of ['BARRIER 2030','Thomas · Harry · Frost · WHL','HKU Shanghai · CDS'])assert.ok(credits.includes(text),`credits show ${text}`);
 assert.ok(credits.includes('>Play again<'),'credits offer Play again');
 assert.ok(credits.includes('>Chapters<'),'credits offer Chapters');
 assert.doesNotMatch(credits,/The End/i,'the credits do not pretend the story ends at the sports hall');
 const campaignBanner=rescueBannerMarkup(true);
 assert.match(campaignBanner,/students are free/i,'the campaign banner says the students are free');
 assert.match(campaignBanner,/100 students/);
 assert.doesNotMatch(campaignBanner,/The End/i,'the campaign banner does not say The End');
 assert.doesNotMatch(campaignBanner,/experience=levels/,'the campaign banner links nowhere');
 const standaloneBanner=rescueBannerMarkup(false);
 assert.match(standaloneBanner,/The End/i,'the standalone rescue keeps its ending line');
});

group('(g) Play again clears the same keys as Reset progress plus the world threat',()=>{
 const seed:Record<string,string>={
  [OPENING_SAVE_KEY]:'opening',
  [OPENING_SAVE_KEY+'.writer']:'writer',
  [OPENING_SAVE_KEY+'.backup']:'backup',
  'hku.digital-survey.v1':'survey',
  'hku.lion-boss.v1.instance':'lion',
  [CAMPAIGN_SAVE_KEY]:'campaign',
  [WORLD_THREAT_KEY]:SEALED_WITH_POWER,
  unrelated:'keep',
 };
 const reset=memoryStorage(seed);
 const removedByReset=clearProgress(reset.storage);
 // `hku.world.v1` lives under the `hku.` namespace, so Reset progress removes it.
 assert.equal(reset.storage.getItem(WORLD_THREAT_KEY),null,'Reset progress removes the world-threat record');
 const store=memoryStorage(seed);
 const cleared=clearAllProgress(store.storage);
 // Only resetWorldThreat writes a clear record back, so its presence proves the
 // Play-again path called it (removal alone is not enough).
 const written=store.storage.getItem(WORLD_THREAT_KEY);
 assert.ok(written,'Play again writes the world threat back as a clear record');
 assert.equal((JSON.parse(written!) as {phase:string}).phase,'clear','the written record is clear');
 assert.deepEqual([...cleared].sort(),[...removedByReset].sort(),'Play again removes exactly the Reset-progress keys');
 for(const key of removedByReset){
  if(key===WORLD_THREAT_KEY)continue; // written back as a clear record, checked below
  assert.equal(store.storage.getItem(key),null,`${key} is cleared`);
 }
 assert.equal(store.storage.getItem('unrelated'),'keep','unrelated keys survive');
 assert.ok(cleared.includes(CAMPAIGN_SAVE_KEY),'the removed list reports the campaign save');
 assert.ok(cleared.includes(OPENING_SAVE_KEY),'the removed list reports the opening save');
 const threat=loadWorldThreat({storage:store.storage});
 assert.equal(threat.phase,'clear','Play again resets the world threat');
 assert.deepEqual(threat.flags,{lionDefeated:false,powerCut:false,localModelCleared:false},'Play again clears the endgame flags');
});

group('(h) the lock panel carries the opening dark tokens in campaign mode',()=>{
 const css=fs.readFileSync(new URL('../src/gameplay/sportsDoor.css',import.meta.url),'utf8');
 assert.match(css,/#door-lock-panel\.campaign-door/,'the panel has a campaign scope');
 assert.match(css,/--opening-paper:\s*rgba\(8,\s*18,\s*15/,'campaign scope uses the dark opening paper');
 assert.match(css,/--opening-green:\s*#74e6b4/,'campaign scope uses the opening green');
 assert.match(css,/#rescue-banner\.campaign-door/,'the rescue banner has a campaign scope');
});

group('(i) the epilogue holds the banner and leaves the atmosphere to the experience',()=>{
 const harness=makeHost({[WORLD_THREAT_KEY]:SEALED_WITH_POWER}),{host}=harness;
 host.start('mac-device','to_sports');
 game.body.position.set(...SPORTS_ENTRY.point as [number,number,number]);
 host.update(1/120);
 host.update(1/120);
 assert.equal(host.stage(),'ending');
 const state=()=>(host.debug.ending as unknown as {state:()=>Record<string,unknown>}).state();
 assert.ok(ENDING_HOLD_SECONDS>=3,`the rescue banner is readable for about 3 s (${ENDING_HOLD_SECONDS})`);
 assert.equal(state().started,false,'the Mac screen does not mount over the rescue banner');
 host.update(1);
 assert.equal(state().started,false,'the hold is still running after 1 s');
 host.update(ENDING_HOLD_SECONDS+2);
 assert.equal(state().started,true,'the Mac screen starts after the banner hold');
 host.update(ENDING_CLEAR_AT-0.2);
 assert.equal(state().cleared,false,'the Mac screen is still up while the CPUs come online');
 assert.ok(ENDING_CLEAR_AT<8,'the Mac screen clears before the dome release beat');
 host.update(8.2-ENDING_CLEAR_AT+0.2);
 assert.equal(state().released,true,'the release lands after the ADMINISTRATOR ACCESS RESTORED beat');
 assert.equal(loadWorldThreat({storage:harness.store.storage}).phase,'purged','the release beat purges the campus');
 // I3: the ending must not replace another module's atmosphere.update. If it did,
 // this direct call would record a forced, unsealed frame instead of the caller's.
 const fake=harness.atmosphere,original=fake.update;
 fake.update(1/60,{incident:true,curtain:true,paused:false});
 assert.equal(fake.update,original,'the ending leaves atmosphere.update alone (no monkey-patch)');
 assert.deepEqual(harness.updates.at(-1),{incident:true,curtain:true,paused:false},'the atmosphere sees exactly the frame the experience passes');
});

group('(j) the experience adopts a purge written after its cached sealed frame',()=>{
 const sealed=loadWorldThreat({storage:memoryStorage({[WORLD_THREAT_KEY]:SEALED_WITH_POWER}).storage});
 assert.equal(sealed.phase,'sealed');
 const purged={...sealed,phase:'purged' as const,purgedAt:2000};
 assert.equal(refreshedWorldThreat(sealed,()=>purged).phase,'purged','a purged record wins over the cached sealed frame');
 let reads=0;
 const final=refreshedWorldThreat(purged,()=>{reads++;return sealed;});
 assert.equal(final.phase,'purged','a purged cache is final');
 assert.equal(reads,0,'a purged cache is not re-read');
});

if(failures.length){
 console.error(`\ncheck-campaign-sports: ${failures.length} failing group(s): ${failures.join(', ')}`);
 process.exit(1);
}
console.log(`\ncheck-campaign-sports: ${passed} groups passed · ${SPORTS_HALL_PUZZLE.answer} / ${SPORTS_HALL_PUZZLE.password.answer}`);
