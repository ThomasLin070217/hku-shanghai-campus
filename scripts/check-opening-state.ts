import assert from 'node:assert/strict';
import {Inventory, type ItemStack} from '../src/items/inventory';
import {DEFAULT_SETTINGS, SAVE_KEY as SURVEY_SAVE_KEY, readSettings, type Settings} from '../src/gameplay/save';
import type {CampusGame} from '../src/exploration/game';
import type {OpeningEvent, OpeningSave, OpeningStage, OpeningState} from '../src/opening/contracts';
import {OPENING_WORLD_REVISION} from '../src/opening/spatialLayout';
import {OPENING_EVENT_LOG, createOpeningState, reduceOpening, validOpeningState} from '../src/opening/state';
import {OPENING_SAVE_KEY, OPENING_SEED_MACBOOK_INSTANCE, captureOpeningSave, isCurrentOpeningRevision, parseOpeningSave} from '../src/opening/persistence';

const MAC='macbook-air-13-silver';
const OPENING_MACBOOK='opening-macbook-001';
type FlagKey='invitation_read'|'laptop_acquired'|'campus_alert_triggered'|'alert_read';
/** The authored beat table of the Thomas opening: event, resulting stage, log entry, flag. */
const BEATS:readonly {event:OpeningEvent;stage:OpeningStage;log:string;flag?:FlagKey}[]=[
 {event:'read_invitation',stage:'bus',log:'invitation_read',flag:'invitation_read'},
 {event:'exit_bus',stage:'to_b5',log:'opening.bus_exited'},
 {event:'accept_errand',stage:'to_b6',log:'opening.laptop_requested'},
 {event:'take_laptop',stage:'return_b5',log:'laptop_acquired',flag:'laptop_acquired'},
 {event:'return_b5',stage:'incident',log:'campus_alert_triggered',flag:'campus_alert_triggered'},
 {event:'read_alert',stage:'to_b4',log:'opening.alert_acknowledged',flag:'alert_read'},
 {event:'reach_b4',stage:'complete',log:'opening.building4_reached'},
];
const ORDER:readonly OpeningEvent[]=BEATS.map(b=>b.event);
const FLAGS:readonly FlagKey[]=['invitation_read','laptop_acquired','campus_alert_triggered','alert_read'];

let passed=0;
const failures:string[]=[];
function group(name:string,fn:()=>void):void{
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message:String(error));}
}
function storyAfter(events:readonly OpeningEvent[]):OpeningState{
 let state=createOpeningState();
 for(const event of events)state=reduceOpening(state,event);
 return state;
}
const fullStory=():OpeningState=>storyAfter(ORDER);
function slots(...items:(ItemStack|null)[]):(ItemStack|null)[]{
 const out:(ItemStack|null)[]=Array.from({length:36},()=>null);
 items.forEach((item,index)=>{if(item)out[index]=item;});
 return out;
}
function mac(instanceId:string,count=1):ItemStack{return{itemId:MAC,instanceId,count};}
/** Raw (untyped) save payload so malformed fields can be injected on purpose. */
function rawSave(over:Record<string,unknown>={}):Record<string,unknown>{
 return{version:1,mode:'opening',worldRevision:OPENING_WORLD_REVISION,savedAt:1700000000000,
  position:[65,.54,32.7],yaw:1.2,pitch:0,view:'first',slots:slots(),selectedHotbar:0,
  story:createOpeningState(),settings:{...DEFAULT_SETTINGS},...over};
}
const postSave=(over:Record<string,unknown>={}):Record<string,unknown>=>rawSave({story:fullStory(),slots:slots(mac(OPENING_MACBOOK)),...over});
function gameStub(items:(ItemStack|null)[],over:Partial<{yaw:number;pitch:number;view:'first'|'third';hotbar:number;position:[number,number,number]}>={}):CampusGame{
 const position=over.position??[65,.54,32.7];
 const inventory=new Inventory();
 inventory.slots.splice(0,36,...items);
 inventory.selectedHotbar=over.hotbar??0;
 const body={position:{x:position[0],y:position[1],z:position[2],toArray:()=>[...position] as [number,number,number]}};
 return{inventory,body,yaw:over.yaw??1.2,pitch:over.pitch??0,view:over.view??'first'} as unknown as CampusGame;
}
/** A game whose inventory is a real, untouched Inventory (it carries the survey seed MacBook). */
function seededGame():CampusGame{
 const inventory=new Inventory();
 const body={position:{x:65,y:.54,z:32.7}};
 return{inventory,body,yaw:0,pitch:0,view:'first'} as unknown as CampusGame;
}
const snapshot=(value:unknown):string=>JSON.stringify(value);

console.log('== opening state / persistence behaviour checks ==');

group('初始状态是 bus 阶段的空状态',()=>{
 const state=createOpeningState();
 assert.equal(state.schemaVersion,1);
 assert.equal(state.stage,'bus');
 assert.deepEqual(state.events,[]);
 assert.equal(state.elapsedSeconds,0);
 for(const flag of FLAGS)assert.equal(state[flag],false,`${flag} must start false`);
 assert.ok(validOpeningState(state),'initial state must validate');
 assert.deepEqual(validOpeningState(state),state,'initial state must round-trip');
});

group('完整七拍按顺序推进并产生规范事件日志',()=>{
 assert.deepEqual([...OPENING_EVENT_LOG],BEATS.map(b=>b.log),'exported log must match the beat table');
 let state=createOpeningState();
 for(let i=0;i<BEATS.length;i++){
  const beat=BEATS[i],before=snapshot(state),previous=state;
  const next=reduceOpening(state,beat.event);
  assert.notEqual(next,previous,`${beat.event} must return a new object`);
  assert.equal(next.stage,beat.stage,`${beat.event} must move to ${beat.stage}`);
  assert.equal(next.events[next.events.length-1],beat.log,`${beat.event} must log ${beat.log}`);
  assert.equal(next.events.length,i+1,'log length must follow the beat order');
  assert.deepEqual(next.events,BEATS.slice(0,i+1).map(b=>b.log),'log must be the canonical prefix');
  assert.notEqual(next.events,previous.events,'events array must be a copy');
  if(beat.flag)assert.equal(next[beat.flag],true,`${beat.event} must set ${beat.flag}`);
  assert.equal(snapshot(previous),before,'the previous state must not be mutated');
  assert.ok(validOpeningState(next),`state after ${beat.event} must validate`);
  state=next;
 }
 assert.equal(state.stage,'complete');
 assert.deepEqual(state.events,[...OPENING_EVENT_LOG]);
 for(const flag of FLAGS)assert.equal(state[flag],true,`${flag} must be true at the end`);
});

group('不得发出后续关卡事件',()=>{
 const state=fullStory();
 for(const forbidden of ['chapter_01_completed','supercomputer_online','ai_core_power_cut','students_rescued'])assert.ok(!state.events.includes(forbidden),`${forbidden} must not be logged`);
 assert.equal(state.events.length,7,'the Thomas segment stops at opening.building4_reached');
 assert.equal(state.events[state.events.length-1],'opening.building4_reached');
});

group('乱序 / 越级事件返回原对象引用',()=>{
 for(let i=0;i<BEATS.length;i++){
  const stage=storyAfter(ORDER.slice(0,i));
  for(let j=i+1;j<BEATS.length;j++){
   const before=snapshot(stage);
   assert.equal(reduceOpening(stage,BEATS[j].event),stage,`${BEATS[j].event} must be rejected at beat ${i}`);
   assert.equal(snapshot(stage),before,'a rejected event must not mutate the state');
  }
 }
 const start=createOpeningState();
 for(const beat of BEATS.slice(1))assert.equal(reduceOpening(start,beat.event),start,`${beat.event} must be rejected on the bus`);
 assert.equal(reduceOpening(start,'chapter_01_completed' as OpeningEvent),start,'unknown events must be rejected');
 assert.equal(reduceOpening(start,'nope' as OpeningEvent),start,'unknown events must be rejected');
});

group('重复事件幂等且不改动 events / flags',()=>{
 for(const beat of BEATS){
  const once=reduceOpening(createOpeningState(),beat.event);
  const before=snapshot(once);
  assert.equal(reduceOpening(once,beat.event),once,`duplicate ${beat.event} must return the same object`);
  assert.equal(snapshot(once),before,'duplicate must not change the state');
 }
 const readTwice=reduceOpening(createOpeningState(),'read_invitation');
 assert.equal(reduceOpening(readTwice,'read_invitation'),readTwice,'reading the invitation twice must be rejected');
 assert.deepEqual(readTwice.events,['invitation_read'],'the invitation log must appear once');
});

group('每个中间前缀都是合法状态',()=>{
 for(let i=0;i<=ORDER.length;i++){
  const state=storyAfter(ORDER.slice(0,i));
  const valid=validOpeningState(state);
  assert.ok(valid,`prefix ${i} must validate`);
  assert.deepEqual(valid,state,`prefix ${i} must round-trip`);
 }
});

group('坏 flags 的状态被拒绝',()=>{
 const good=fullStory();
 for(const flag of FLAGS)assert.equal(validOpeningState({...good,[flag]:false}),null,`${flag}=false must be rejected`);
 assert.equal(validOpeningState({...good,invitation_read:'yes'}),null,'non boolean flag must be rejected');
 assert.equal(validOpeningState({...good,stage:'to_b4'}),null,'stage ahead of the log must be rejected');
 assert.equal(validOpeningState({...good,stage:'nowhere'}),null,'unknown stage must be rejected');
 assert.equal(validOpeningState({...good,stage:'to_b6'}),null,'stage behind the log must be rejected');
 assert.equal(validOpeningState({...good,schemaVersion:2}),null,'wrong schemaVersion must be rejected');
 for(const raw of [null,undefined,'state',42,[],true])assert.equal(validOpeningState(raw),null,`${String(raw)} must be rejected`);
 const extra=validOpeningState({...good,unknownField:1});
 assert.ok(extra,'unknown fields must be ignored');
 assert.ok(!('unknownField' in extra!),'unknown fields must be dropped from the result');
});

group('坏 events 的状态被拒绝（乱序 / 缺项 / 多余 / 重复）',()=>{
 const good=fullStory();
 assert.equal(validOpeningState({...good,events:[...good.events].reverse()}),null,'reversed log must be rejected');
 assert.equal(validOpeningState({...good,events:good.events.slice(0,-1)}),null,'missing entry must be rejected');
 assert.equal(validOpeningState({...good,events:[...good.events,'extra']}),null,'extra entry must be rejected');
 assert.equal(validOpeningState({...good,events:[...good.events,good.events[0]]}),null,'duplicated entry must be rejected');
 assert.equal(validOpeningState({...good,events:good.events.map((log,index)=>index===3?'invitation_read':log)}),null,'substituted entry must be rejected');
 assert.equal(validOpeningState({...good,events:'invitation_read'}),null,'non array events must be rejected');
 assert.equal(validOpeningState({...good,events:[1,2,3,4,5,6,7]}),null,'non string entries must be rejected');
 assert.equal(validOpeningState({...good,events:[]}),null,'empty log at a late stage must be rejected');
 const bus=createOpeningState();
 assert.equal(validOpeningState({...bus,events:['invitation_read']}),null,'bus stage cannot carry the invitation log without the flag');
 assert.equal(validOpeningState({...bus,invitation_read:true}),null,'bus stage with the flag must carry the log');
 assert.ok(validOpeningState({...bus,invitation_read:true,events:['invitation_read']}),'bus stage with flag and log must validate');
});

group('NaN / Infinity / 负数时间被拒绝',()=>{
 const good=fullStory();
 for(const value of [NaN,Infinity,-Infinity,-1,'3',null,undefined])assert.equal(validOpeningState({...good,elapsedSeconds:value}),null,`elapsedSeconds ${String(value)} must be rejected`);
 assert.ok(validOpeningState({...good,elapsedSeconds:0}),'zero elapsed must be valid');
 assert.ok(validOpeningState({...good,elapsedSeconds:12.5}),'fractional elapsed must be valid');
});

group('初始档（空背包）与已读请柬未下车档合法',()=>{
 const initial=parseOpeningSave(rawSave());
 assert.ok(initial,'the initial bus save must parse');
 assert.equal(initial!.story.stage,'bus');
 assert.equal(initial!.story.invitation_read,false);
 assert.equal(initial!.slots.length,36);
 assert.equal(initial!.slots.filter(Boolean).length,0);
 const read=parseOpeningSave(rawSave({story:storyAfter(['read_invitation'])}));
 assert.ok(read,'the invitation-read save must parse');
 assert.equal(read!.story.stage,'bus');
 assert.equal(read!.story.invitation_read,true);
 assert.deepEqual(read!.story.events,['invitation_read']);
});

group('电脑数量严格：恰好一台 / 缺失 / 两台 / 提前持有',()=>{
 assert.ok(parseOpeningSave(postSave()),'exactly one MacBook after the pickup must parse');
 assert.equal(parseOpeningSave(rawSave({story:fullStory(),slots:slots()})),null,'a missing MacBook after the pickup must be rejected');
 assert.equal(parseOpeningSave(rawSave({story:fullStory(),slots:slots(mac('a1'),mac('a2'))})),null,'two MacBooks with different instance ids must be rejected');
 assert.equal(parseOpeningSave(rawSave({story:createOpeningState(),slots:slots(mac('a1'))})),null,'a MacBook before the pickup must be rejected');
 const seeded=parseOpeningSave(rawSave({story:createOpeningState(),slots:slots(mac(OPENING_SEED_MACBOOK_INSTANCE))}));
 assert.ok(seeded,'the seeded survey MacBook alone must load as "no laptop yet"');
 assert.equal(seeded!.slots.filter(Boolean).length,0,'the seeded instance must not occupy an opening slot');
 const mixed=parseOpeningSave(rawSave({story:fullStory(),slots:slots(mac(OPENING_MACBOOK),mac(OPENING_SEED_MACBOOK_INSTANCE))}));
 assert.ok(mixed,'the seed next to the acquired MacBook must still yield exactly one opening MacBook');
 assert.equal(mixed!.slots.filter(Boolean).length,1);
 assert.equal(mixed!.slots.find(Boolean)!.instanceId,OPENING_MACBOOK);
});

group('重复 instanceId / 非法物品 / 越界 count 被拒绝',()=>{
 // ITEMS currently holds a single entry, so the item-shape rules and the MacBook count
 // rule overlap; every case below must be rejected and one legal stack must survive.
 assert.equal(parseOpeningSave(postSave({slots:slots(mac('same'),mac('same'))})),null,'duplicate instance ids must be rejected');
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'',count:1})})),null,'an empty instance id must be rejected');
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:'ghost-item',instanceId:'g1',count:1})})),null,'an unknown item id must be rejected');
 // Prototype-chain ids must not be mistaken for legal items via ITEMS['toString'] etc.
 // Use a pre-laptop save: post-laptop count rule would reject these incidentally (mac!==1).
 for(const proto of ['toString','constructor','__proto__','hasOwnProperty','valueOf'])
  assert.equal(parseOpeningSave(rawSave({slots:slots({itemId:proto,instanceId:'p1',count:1})})),null,`prototype-chain item id ${proto} must be rejected`);
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'m1',count:0})})),null,'count 0 must be rejected');
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'m1',count:2})})),null,'count above maxStack must be rejected');
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'m1',count:1.5})})),null,'a fractional count must be rejected');
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'m1',count:'1' as unknown as number})})),null,'a string count must be rejected');
 assert.equal(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'m1'} as unknown as ItemStack)})),null,'a missing count must be rejected');
 assert.ok(parseOpeningSave(postSave({slots:slots({itemId:MAC,instanceId:'m1',count:1})})),'a legal stack must parse');
});

group('36 格背包与 0..8 快捷栏校验',()=>{
 assert.equal(parseOpeningSave(rawSave({slots:[]})),null,'zero slots must be rejected');
 assert.equal(parseOpeningSave(rawSave({slots:Array.from({length:35},()=>null)})),null,'35 slots must be rejected');
 assert.equal(parseOpeningSave(rawSave({slots:Array.from({length:37},()=>null)})),null,'37 slots must be rejected');
 assert.equal(parseOpeningSave(rawSave({slots:'slots'})),null,'non array slots must be rejected');
 assert.equal(parseOpeningSave(rawSave({selectedHotbar:-1})),null,'hotbar -1 must be rejected');
 assert.equal(parseOpeningSave(rawSave({selectedHotbar:9})),null,'hotbar 9 must be rejected');
 assert.equal(parseOpeningSave(rawSave({selectedHotbar:1.5})),null,'a fractional hotbar must be rejected');
 assert.equal(parseOpeningSave(rawSave({selectedHotbar:'2' as unknown as number})),null,'a string hotbar must be rejected');
 for(const hotbar of [0,8])assert.ok(parseOpeningSave(rawSave({selectedHotbar:hotbar})),`hotbar ${hotbar} must be valid`);
});

group('坐标 / 朝向 / 时间的 NaN 与 Infinity 被拒绝',()=>{
 assert.equal(parseOpeningSave(rawSave({position:[65,NaN,32.7]})),null,'NaN position must be rejected');
 assert.equal(parseOpeningSave(rawSave({position:[65,.54,Infinity]})),null,'Infinity position must be rejected');
 assert.equal(parseOpeningSave(rawSave({position:[-Infinity,0,0]})),null,'-Infinity position must be rejected');
 assert.equal(parseOpeningSave(rawSave({position:[1,2]})),null,'a short position must be rejected');
 assert.equal(parseOpeningSave(rawSave({position:[1,2,3,4]})),null,'a long position must be rejected');
 assert.equal(parseOpeningSave(rawSave({position:'65,0,32'})),null,'a non array position must be rejected');
 assert.equal(parseOpeningSave(rawSave({yaw:NaN})),null,'NaN yaw must be rejected');
 assert.equal(parseOpeningSave(rawSave({yaw:Infinity})),null,'Infinity yaw must be rejected');
 assert.equal(parseOpeningSave(rawSave({pitch:-Infinity})),null,'-Infinity pitch must be rejected');
 assert.equal(parseOpeningSave(rawSave({savedAt:NaN})),null,'NaN savedAt must be rejected');
 assert.equal(parseOpeningSave(rawSave({savedAt:Infinity})),null,'Infinity savedAt must be rejected');
 assert.equal(parseOpeningSave(rawSave({savedAt:-1})),null,'a negative savedAt must be rejected');
 assert.ok(parseOpeningSave(rawSave({savedAt:0})),'a zero savedAt must be valid');
});

group('未知 version / mode 被拒绝，开档使用独立命名空间',()=>{
 assert.equal(OPENING_SAVE_KEY,'hku.opening.v1');
 assert.notEqual(OPENING_SAVE_KEY,SURVEY_SAVE_KEY,'the opening save must not share the survey key');
 assert.equal(SURVEY_SAVE_KEY,'hku.digital-survey.v1');
 assert.equal(parseOpeningSave(rawSave({version:2})),null,'an unknown version must be rejected');
 assert.equal(parseOpeningSave(rawSave({version:'1' as unknown as number})),null,'a string version must be rejected');
 assert.equal(parseOpeningSave(rawSave({mode:'survey'})),null,'the survey mode must be rejected');
 assert.equal(parseOpeningSave(rawSave({mode:'digital-survey'})),null,'an unknown mode must be rejected');
 assert.ok(parseOpeningSave(rawSave({mode:'opening'})),'the opening mode must parse');
 for(const raw of [null,undefined,'save',7,[]])assert.equal(parseOpeningSave(raw),null,`${String(raw)} must be rejected`);
});

group('坏故事、坏设置与输入不被改写',()=>{
 assert.equal(parseOpeningSave(rawSave({story:{...fullStory(),invitation_read:false}})),null,'a story with bad flags must be rejected');
 assert.equal(parseOpeningSave(rawSave({story:{...fullStory(),events:['invitation_read']}})),null,'a story with a short log must be rejected');
 assert.equal(parseOpeningSave(rawSave({story:undefined})),null,'a missing story must be rejected');
 const settingsSave=parseOpeningSave(rawSave({settings:{fov:999,sensitivity:0,music:5,bob:true,muted:'yes'}}));
 assert.ok(settingsSave,'settings must be sanitised, not rejected');
 assert.equal(settingsSave!.settings.fov,90,'fov must be clamped to the shared range');
 assert.equal(settingsSave!.settings.sensitivity,0.0004,'sensitivity must be clamped to the shared range');
 assert.equal(settingsSave!.settings.music,1,'music must be clamped to the shared range');
 assert.equal(settingsSave!.settings.bob,true,'booleans must survive');
 assert.equal(settingsSave!.settings.muted,false,'a non boolean flag falls back to the default');
 assert.deepEqual(parseOpeningSave(rawSave({settings:undefined}))!.settings,DEFAULT_SETTINGS,'missing settings fall back to the defaults');
 assert.deepEqual(readSettings({fov:72}),DEFAULT_SETTINGS,'the shared reader keeps valid values');
 const payload=postSave(),before=snapshot(payload);
 const parsed=parseOpeningSave(payload);
 assert.ok(parsed,'a valid payload must parse');
 assert.equal(snapshot(payload),before,'the parser must not mutate its input');
 assert.notEqual(parsed,payload as unknown as OpeningSave,'the parser must return a new object');
});

group('worldRevision 不匹配：保留故事与物品，由调用方安全落点恢复',()=>{
 // The revision this round supersedes: the B4 east keyboard/shutter layout changed, so a save
 // from that world must not be trusted for its pose even though it still parses.
 const stale=parseOpeningSave(postSave({worldRevision:'opening-2030-v5-b5-full-hall'}));
 assert.ok(stale,'a revision mismatch must not be rejected by the parser');
 assert.equal(stale!.worldRevision,'opening-2030-v5-b5-full-hall','the original revision must be preserved');
 assert.notEqual(stale!.worldRevision,OPENING_WORLD_REVISION,'a stale save must not be relabelled as current');
 assert.equal(isCurrentOpeningRevision(stale!),false,'the caller must see the revision mismatch');
 assert.deepEqual(stale!.story,fullStory(),'the story must survive a revision mismatch');
 assert.equal(stale!.slots.filter(Boolean).length,1,'the backpack must survive a revision mismatch');
 assert.equal(stale!.settings.fov,DEFAULT_SETTINGS.fov,'the settings must survive a revision mismatch');
 const current=parseOpeningSave(postSave());
 assert.ok(current);
 assert.equal(isCurrentOpeningRevision(current!),true,'a current save must be trusted');
 // experience.validPose() refuses a stale pose, so the caller falls back to safePose().
 const callerTrustsPose=(save:OpeningSave):boolean=>save.worldRevision===OPENING_WORLD_REVISION;
 assert.equal(callerTrustsPose(stale!),false,'the stale pose must be refused by the caller contract');
 assert.equal(parseOpeningSave(postSave({worldRevision:42})),null,'a non string revision must be rejected');
 assert.equal(parseOpeningSave(postSave({worldRevision:''})),null,'an empty revision must be rejected');
});

group('capture 不改动传入的游戏 / 故事 / 设置',()=>{
 const g=gameStub(slots(mac(OPENING_MACBOOK)),{hotbar:3,yaw:1.2,pitch:0.25,view:'third'});
 const story=fullStory(),settings:Settings={...DEFAULT_SETTINGS};
 const input:[number,number,number]=[1,2,3];
 const slotsBefore=snapshot(g.inventory.slots),storyBefore=snapshot(story),settingsBefore=snapshot(settings);
 const captured=captureOpeningSave(g,story,settings,input);
 assert.equal(snapshot(g.inventory.slots),slotsBefore,'the inventory must not be mutated');
 assert.equal(snapshot(story),storyBefore,'the story must not be mutated');
 assert.equal(snapshot(settings),settingsBefore,'the settings must not be mutated');
 assert.notEqual(captured.slots,g.inventory.slots,'the captured slots must be a copy');
 assert.notEqual(captured.story,story,'the captured story must be a copy');
 assert.notEqual(captured.story.events,story.events,'the captured log must be a copy');
 assert.notEqual(captured.settings,settings,'the captured settings must be a copy');
 captured.slots[0]!.count=99;
 assert.equal(g.inventory.slots[0]!.count,1,'mutating the captured slots must not touch the game');
 captured.story.events.push('tampered');
 assert.equal(story.events.length,7,'mutating the captured log must not touch the story');
 captured.settings.fov=1;
 assert.equal(settings.fov,DEFAULT_SETTINGS.fov,'mutating the captured settings must not touch the settings');
 captured.position[0]=999;
 assert.deepEqual(input,[1,2,3],'the caller position array must not be aliased');
});

group('capture 的内容正确且只丢弃已记录的种子电脑',()=>{
 const g=gameStub(slots(mac(OPENING_MACBOOK),null,mac('rogue-copy')),{hotbar:2});
 const captured=captureOpeningSave(g,fullStory(),DEFAULT_SETTINGS);
 assert.equal(captured.slots.length,36,'the backpack keeps 36 slots');
 assert.equal(captured.worldRevision,OPENING_WORLD_REVISION,'the capture stamps the current revision');
 assert.deepEqual(captured.position,[65,.54,32.7],'without an explicit position the body pose is used');
 assert.equal(captured.yaw,1.2);
 assert.equal(captured.pitch,0);
 assert.equal(captured.view,'first');
 assert.equal(captured.selectedHotbar,2);
 assert.ok(captured.savedAt>0,'the capture stamps a time');
 const explicit=captureOpeningSave(g,fullStory(),DEFAULT_SETTINGS,[4,5,6]);
 assert.deepEqual(explicit.position,[4,5,6],'an explicit position wins over the body pose');
 // The shared Inventory seed is not an opening item and is dropped.
 const seeded=captureOpeningSave(seededGame(),createOpeningState(),DEFAULT_SETTINGS);
 assert.equal(seeded.slots.filter(Boolean).length,0,'the survey seed must not leak into an opening save');
 assert.ok(parseOpeningSave(seeded),'a captured pre-laptop save must parse');
 const seededAfter=captureOpeningSave(seededGame(),fullStory(),DEFAULT_SETTINGS);
 assert.equal(seededAfter.slots.filter(Boolean).length,0,'the survey seed is never an opening MacBook');
 assert.equal(parseOpeningSave(seededAfter),null,'a story that claims the pickup without the laptop must be rejected');
 // A runtime duplicate is not filtered away: the capture stays illegal and the parser rejects it.
 const rogue=captureOpeningSave(gameStub(slots(mac('rogue-1'))),createOpeningState(),DEFAULT_SETTINGS);
 assert.equal(rogue.slots.filter(Boolean).length,1,'a rogue MacBook must not be silently filtered');
 assert.equal(parseOpeningSave(rogue),null,'the illegal capture must be rejected on the next load');
});

group('capture → parse 往返完整一致',()=>{
 const g=gameStub(slots(mac(OPENING_MACBOOK)),{hotbar:1,yaw:.5,pitch:-.2,view:'third'});
 const captured=captureOpeningSave(g,fullStory(),DEFAULT_SETTINGS,[7,0,-56]);
 const parsed=parseOpeningSave(captured);
 assert.ok(parsed,'a captured save must parse again');
 assert.deepEqual(parsed!.story,fullStory(),'the story must round-trip');
 assert.deepEqual(parsed!.position,[7,0,-56]);
 assert.equal(parsed!.yaw,.5);
 assert.equal(parsed!.pitch,-.2);
 assert.equal(parsed!.view,'third');
 assert.equal(parsed!.selectedHotbar,1);
 assert.equal(parsed!.worldRevision,OPENING_WORLD_REVISION);
 assert.equal(parsed!.slots.filter(Boolean).length,1);
 assert.equal(parsed!.slots.find(Boolean)!.instanceId,OPENING_MACBOOK);
});

console.log(failures.length?`FAIL ${failures.length} group(s): ${failures.join(' | ')}`:`PASS ${passed} opening state/persistence behaviour groups`);
if(failures.length)process.exitCode=1;
