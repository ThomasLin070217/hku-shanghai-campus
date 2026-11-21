import assert from 'node:assert/strict';
import * as T from 'three';
import {createCampaignHost,type CampaignStorage} from '../src/campaign/host';
import {CAMPAIGN_SAVE_KEY,createCampaignState,type CampaignEvent} from '../src/campaign/state';
import type {Chapter,ChapterContext,ChapterId,Explorer} from '../src/campaign/types';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';

/*
 * Host logic only. The chapters here are fakes passed through the host's
 * `chapters` option, so this check never loads the chapter files Tasks 2–4 own.
 * Entry and approach data are copies of the Task 1 stub values.
 */

let passed=0;
const failures:string[]=[];
function group(name:string,fn:()=>void):void{
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message:String(error));}
}

// The real campus game, so the host reads the same body the explorer moves.
const game=new CampusGame(createNavigation(BUILDINGS,SITE,true),BUILDINGS,SITE);
let enabled=true;
const explorer={game,get enabled(){return enabled;}} as unknown as Explorer;
game.paused=false;
const place=(x:number,z:number)=>{game.body.position.set(x,0,z);};

function memoryStorage(seed:Record<string,string>={}){
 const data=new Map(Object.entries(seed));let writes=0;
 const storage:CampaignStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,v);},removeItem:k=>{data.delete(k);}};
 return{storage,data,get writes(){return writes;}};
}

const ENTRIES:Record<ChapterId,{entry:Chapter['entry'];approach:[number,number][];events:CampaignEvent[]}>={
 b4:{entry:{point:[58,.02,18],radius:1.6,event:'enter_b4'},approach:[[58,25],[58,18]],events:['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected']},
 lawn:{entry:{point:[1,.13,87],radius:3,event:'reach_lawn'},approach:[[58,25],[58,33.5],[24,33.5],[24,87],[1,87]],events:['reach_lawn','guardian_shutdown']},
 sports:{entry:{point:[-45.9,0,-117],radius:2.5,event:'reach_sports'},approach:[[1,87],[24,87],[24,-117],[-45.9,-117]],events:['reach_sports','door_opened']},
 ending:{entry:{point:[0,0,0],radius:0,event:'door_opened'},approach:[],events:['ending_finished']},
};
const CHAPTER_DATA=(id:ChapterId)=>ENTRIES[id];

interface Spy{attached:number;updates:number;dts:number[];interacts:number;detached:number;consume:boolean;ctx:ChapterContext|null}
function spyChapters(){
 const spies={} as Record<ChapterId,Spy>;
 const factories={} as Record<ChapterId,()=>Chapter>;
 for(const id of Object.keys(ENTRIES) as ChapterId[]){
  const spy:Spy={attached:0,updates:0,dts:[],interacts:0,detached:0,consume:true,ctx:null};spies[id]=spy;
  factories[id]=()=>({
   id,entry:ENTRIES[id].entry,approach:ENTRIES[id].approach,
   attach(ctx){spy.attached++;spy.ctx=ctx;},
   update(dt){spy.updates++;spy.dts.push(dt);},
   interact(){spy.interacts++;return spy.consume;},
   objective:stage=>({text:`${id} objective at ${stage}`,target:[1,2,3]}),
   detach(){spy.detached++;spy.ctx=null;},
   debug:{complete(){for(const e of ENTRIES[id].events)spy.ctx?.emit(e);return spy.ctx?.stage();}},
  });
 }
 return{spies,factories};
}

function makeHost(seed:Record<string,string>={}){
 const store=memoryStorage(seed),cards:[string,string][]=[];
 const {spies,factories}=spyChapters();
 const host=createCampaignHost({
  context:{
   scene:new T.Scene(),root:()=>new T.Group(),explorer,notify:()=>{},atmosphere:()=>undefined,
   openPanel:()=>{},closePanel:()=>{},resume:()=>{},card:async(kicker,title)=>{cards.push([kicker,title]);},
  },
  storage:store.storage,chapters:factories,now:()=>1000,
 });
 return{host,store,cards,spies};
}
const saved=(store:ReturnType<typeof memoryStorage>)=>JSON.parse(store.data.get(CAMPAIGN_SAVE_KEY)??'null');

group('(f) inactive until start(deviceId) or a valid save',()=>{
 const {host,spies}=makeHost();
 assert.equal(host.active,false);assert.equal(host.stage(),null);assert.equal(host.objective(),null);
 host.update(1/60);assert.equal(spies.b4.attached,0,'nothing attaches before the campaign starts');
 assert.equal(host.interact(),false);
 host.start('');assert.equal(host.active,false,'an empty device id cannot start the campaign');
 host.start('mac-1');assert.equal(host.active,true);assert.equal(host.stage(),'b4_enter');
 for(const raw of ['not json','{"schemaVersion":2,"stage":"lawn","deviceId":"mac-1","updatedAt":1}','{"schemaVersion":1,"stage":"lawn","deviceId":"","updatedAt":1}']){
  assert.equal(makeHost({[CAMPAIGN_SAVE_KEY]:raw}).host.active,false,raw);
 }
 const restored=makeHost({[CAMPAIGN_SAVE_KEY]:JSON.stringify({...createCampaignState('mac-2',5),stage:'to_sports'})}).host;
 assert.equal(restored.active,true);assert.equal(restored.stage(),'to_sports');assert.equal(restored.state()?.deviceId,'mac-2');
});

group('(a) attaches the chapter for the current stage, once',()=>{
 const {host,spies}=makeHost();
 host.start('mac-1');
 assert.equal(host.chapter(),'b4');assert.equal(spies.b4.attached,1);
 assert.equal(spies.b4.ctx?.deviceId(),'mac-1');assert.equal(spies.b4.ctx?.stage(),'b4_enter');
 host.update(1/60);host.update(1/60);
 assert.equal(spies.b4.attached,1,'attach runs once');assert.ok(spies.b4.updates>=2,'attached chapters update every frame');
 assert.equal(spies.lawn.attached,0,'later chapters wait');
 for(const e of ['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected'] as const)assert.equal(host.emit(e),true,e);
 assert.equal(host.stage(),'to_lawn');assert.equal(host.chapter(),null,'walking leg has no active chapter');
 assert.equal(spies.lawn.attached,1,'the walking leg attaches the chapter it leads into');
 const restored=makeHost({[CAMPAIGN_SAVE_KEY]:JSON.stringify({...createCampaignState('mac-2',5),stage:'sports'})});
 restored.host.update(1/60);
 assert.equal(restored.spies.sports.attached,1,'a restored save attaches its chapter on the first frame');
 host.reset();assert.equal(host.active,false);assert.equal(spies.b4.detached,1);assert.equal(spies.lawn.detached,1);
});

group('(b) walking legs emit the entry event only inside entry.radius',()=>{
 const {host}=makeHost();
 const b4=CHAPTER_DATA('b4').entry,lawn=CHAPTER_DATA('lawn').entry,sports=CHAPTER_DATA('sports').entry;
 host.start('mac-1');
 place(b4.point[0],b4.point[2]+b4.radius+.4);host.update(1/60);
 assert.equal(host.stage(),'b4_enter','outside the B04 door: no event');
 place(b4.point[0],b4.point[2]+b4.radius-.3);host.update(1/60);
 assert.equal(host.stage(),'b4_keyboard','inside the B04 door: enter_b4');
 for(const e of ['keyboard_solved','flip_solved','breaker_pulled','macbook_connected'] as const)host.emit(e);
 place(lawn.point[0]+lawn.radius+1,lawn.point[2]);host.update(1/60);
 assert.equal(host.stage(),'to_lawn');
 place(lawn.point[0]+lawn.radius-.5,lawn.point[2]);host.update(1/60);
 assert.equal(host.stage(),'lawn');
 host.update(1/60);assert.equal(host.stage(),'lawn','chapter stages never auto-advance');
 host.emit('guardian_shutdown');
 place(sports.point[0],sports.point[2]-sports.radius-1);host.update(1/60);
 assert.equal(host.stage(),'to_sports');
 place(sports.point[0],sports.point[2]-sports.radius+.5);host.update(1/60);
 assert.equal(host.stage(),'sports');
 host.emit('door_opened');place(0,0);for(let i=0;i<5;i++)host.update(1/60);
 assert.equal(host.stage(),'ending','the ending has no walking leg');
});

group('(c) every change persists under CAMPAIGN_SAVE_KEY',()=>{
 const {host,store}=makeHost();
 host.start('mac-1');
 assert.equal(saved(store).stage,'b4_enter');assert.equal(saved(store).deviceId,'mac-1');
 const before=store.writes;
 assert.equal(host.emit('reach_lawn'),false);assert.equal(store.writes,before,'a rejected event writes nothing');
 assert.equal(host.emit('enter_b4'),true);assert.equal(saved(store).stage,'b4_keyboard');assert.equal(store.writes,before+1);
 host.reset();assert.equal(store.data.has(CAMPAIGN_SAVE_KEY),false,'reset clears the save');
});

group('(d) objective: active chapter, or Go to … on walking legs',()=>{
 const {host}=makeHost();
 const b4=CHAPTER_DATA('b4'),lawn=CHAPTER_DATA('lawn');
 host.start('mac-1');place(0,0);
 const walk=host.objective();
 assert.ok(walk?.text.startsWith('Go to '),walk?.text);assert.deepEqual(walk?.target,b4.entry.point);assert.deepEqual(walk?.route,b4.approach);
 host.emit('enter_b4');
 assert.deepEqual(host.objective(),{text:'b4 objective at b4_keyboard',target:[1,2,3]});
 for(const e of ['keyboard_solved','flip_solved','breaker_pulled','macbook_connected'] as const)host.emit(e);
 const leg=host.objective();
 assert.ok(leg?.text.startsWith('Go to '));assert.deepEqual(leg?.target,lawn.entry.point);assert.deepEqual(leg?.route,lawn.approach);
 host.emit('reach_lawn');assert.equal(host.objective()?.text,'lawn objective at lawn');
});

group('(e) interact() goes to the active chapter only',()=>{
 const {host,spies}=makeHost();
 host.start('mac-1');host.emit('enter_b4');
 assert.equal(host.interact(),true);assert.equal(spies.b4.interacts,1);
 spies.b4.consume=false;assert.equal(host.interact(),false);
 for(const e of ['keyboard_solved','flip_solved','breaker_pulled','macbook_connected'] as const)host.emit(e);
 assert.equal(host.interact(),false,'walking leg: nothing to interact with');
 assert.equal(spies.b4.interacts,2);assert.equal(spies.lawn.interacts,0);
 host.emit('reach_lawn');assert.equal(host.interact(),true);
 assert.equal(spies.lawn.interacts,1);assert.equal(spies.b4.interacts,2);
});

group('chapter cards at every chapter boundary',()=>{
 const {host,cards}=makeHost();
 host.start('mac-1');
 assert.deepEqual(cards,[['CHAPTER 1 · BUILDING 4','The Keyboard Wall']]);
 for(const e of ['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected','reach_lawn','guardian_shutdown','reach_sports','door_opened','ending_finished'] as const)host.emit(e);
 assert.deepEqual(cards.slice(1),[['CHAPTER 2','The Lawn Guardian'],['CHAPTER 3','Sports Hall Rescue'],['EPILOGUE','Barrier Down']]);
});

group('debug exposes each attached chapter\'s hooks and they can run the campaign to done',()=>{
 const {host}=makeHost();
 host.start('mac-1');place(0,0);
 for(const id of ['b4','lawn','sports','ending'] as const){
  const debug=host.debug[id];assert.ok(debug?.complete,`${id} hooks are exposed once attached`);
  (debug.complete as ()=>unknown)();
  host.update(1/60);
 }
 assert.equal(host.stage(),'done');
});

group('chapters get no frame time while the game is paused or the explorer is off',()=>{
 const {host,spies}=makeHost();
 host.start('mac-1');place(0,0);
 game.paused=true;host.update(.5);
 enabled=false;game.paused=false;host.update(.5);
 enabled=true;host.update(.25);
 assert.deepEqual(spies.b4.dts,[0,0,.25],'paused and disabled frames pass dt=0');
 const b4=CHAPTER_DATA('b4').entry;
 place(b4.point[0],b4.point[2]);game.paused=true;host.update(1/60);
 assert.equal(host.stage(),'b4_enter','no walking-leg event while paused');
 game.paused=false;host.update(1/60);
 assert.equal(host.stage(),'b4_keyboard');
});

if(failures.length){console.error(`\ncheck-campaign-host: ${failures.length} failed, ${passed} passed`);process.exit(1);}
console.log(`\ncheck-campaign-host: ${passed} passed`);
