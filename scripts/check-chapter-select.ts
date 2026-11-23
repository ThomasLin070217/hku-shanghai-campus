import assert from 'node:assert/strict';
import {OPENING_CHECKPOINTS,CHECKPOINT_LABELS,applyCheckpointThreat,checkpointCampaign,checkpointPose,checkpointState,openingCheckpoint,type OpeningCheckpoint} from '../src/opening/checkpoint';
import {B4_ENTRY} from '../src/campaign/b4Chapter';
import {LAWN_ENTRY} from '../src/campaign/lawnChapter';
import {SPORTS_ENTRY} from '../src/campaign/sportsChapter';
import {CAMPAIGN_CHAPTERS} from '../src/campaign/chapters';
import {OPENING as O} from '../src/opening/spatialLayout';
import type {CampaignStage} from '../src/campaign/state';
import {validOpeningState} from '../src/opening/state';
import type {OpeningStage} from '../src/opening/contracts';
import {WORLD_THREAT_KEY,loadWorldThreat} from '../src/gameplay/worldThreat';

const EXPECTED:Record<OpeningCheckpoint,{stage:OpeningStage;events:number;laptop:boolean}> = {
 b5:{stage:'to_b5',events:2,laptop:false},
 b6:{stage:'to_b6',events:3,laptop:false},
 incident:{stage:'incident',events:5,laptop:true},
 b4:{stage:'to_b4',events:6,laptop:true},
 'b4-inside':{stage:'complete',events:7,laptop:true},
 lawn:{stage:'complete',events:7,laptop:true},
 sports:{stage:'complete',events:7,laptop:true},
 ending:{stage:'complete',events:7,laptop:true},
};

let passed=0;
const failures:string[]=[];
function group(name:string,fn:()=>void):void{
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message:String(error));}
}

for(const id of OPENING_CHECKPOINTS){
 group(`checkpoint ${id} replays to a valid stage`,()=>{
  const state=checkpointState(id);
  assert.ok(state,'checkpoint must build a state');
  assert.equal(state.stage,EXPECTED[id].stage);
  assert.equal(state.events.length,EXPECTED[id].events);
  assert.equal(state.laptop_acquired,EXPECTED[id].laptop);
  assert.deepEqual(validOpeningState(state),state);
  assert.ok(CHECKPOINT_LABELS[id].length>0);
 });
 group(`checkpoint ${id} pose is a finite world position`,()=>{
  const pose=checkpointPose(id);
  assert.equal(pose.position.length,3);
  for(const value of pose.position)assert.ok(Number.isFinite(value));
  assert.ok(Number.isFinite(pose.yaw));
 });
}

group('openingCheckpoint only accepts the menu ids',()=>{
 assert.equal(openingCheckpoint('b5'),'b5');
 assert.equal(openingCheckpoint('b4'),'b4');
 assert.equal(openingCheckpoint('b4-inside'),'b4-inside');
 assert.equal(openingCheckpoint('lawn'),'lawn');
 assert.equal(openingCheckpoint('sports'),'sports');
 assert.equal(openingCheckpoint('ending'),'ending');
 assert.equal(openingCheckpoint('bus'),null);
 assert.equal(openingCheckpoint(''),null);
 assert.equal(openingCheckpoint(null),null);
 assert.equal(openingCheckpoint(undefined),null);
});

group('future B4-office checkpoint ids alias onto the canonical b6',()=>{
 // The canonical list still says `b6`; old and future links may name the B4 5F office.
 assert.equal(openingCheckpoint('b4-office'),'b6','the future dashed id must resolve to b6');
 assert.equal(openingCheckpoint('b4_office'),'b6','the future snake_case id must resolve to b6');
 assert.equal(openingCheckpoint('b6'),'b6','the canonical id must keep working');
 assert.equal(openingCheckpoint('b4'),'b4','the canonical b4 checkpoint must not be swallowed by the alias');
 assert.equal(openingCheckpoint('b50'),null,'an unknown future id must stay null');
 assert.equal(openingCheckpoint('toString'),null,'prototype-chain keys must not resolve to a checkpoint');
 assert.equal(openingCheckpoint('__proto__'),null,'prototype keys must not resolve to a checkpoint');
});

group('campaign checkpoints resume the campaign with the earlier chapter results',()=>{
 const expected:Partial<Record<OpeningCheckpoint,{stage:CampaignStage;relay:boolean;corePower:boolean}>>={
  'b4-inside':{stage:'b4_keyboard',relay:false,corePower:false},
  lawn:{stage:'to_lawn',relay:true,corePower:false},
  sports:{stage:'to_sports',relay:true,corePower:true},
  ending:{stage:'ending',relay:true,corePower:true},
 };
 for(const id of OPENING_CHECKPOINTS)assert.deepEqual(checkpointCampaign(id),expected[id]??null,id);
});

group('campaign checkpoint poses: inside B04, B04 entrance, lawn entry, sports door',()=>{
 assert.deepEqual([...checkpointPose('b4-inside').position],B4_ENTRY.point);
 assert.deepEqual([...checkpointPose('lawn').position],[...O.handoff]);
 assert.deepEqual([...checkpointPose('sports').position],LAWN_ENTRY.point);
 assert.deepEqual([...checkpointPose('ending').position],SPORTS_ENTRY.point);
});

group('FU2: walking-leg checkpoints face along the route to the next objective',()=>{
 const forward=(yaw:number)=>[-Math.sin(yaw),-Math.cos(yaw)];
 for(const [id,route] of [['lawn',CAMPAIGN_CHAPTERS.lawn().approach],['sports',CAMPAIGN_CHAPTERS.sports().approach]] as const){
  const pose=checkpointPose(id),[px,,pz]=pose.position;
  const next=route.find(([x,z])=>Math.hypot(x-px,z-pz)>1)!;
  const want=[next[0]-px,next[1]-pz],len=Math.hypot(want[0],want[1]),f=forward(pose.yaw);
  const angle=Math.acos((f[0]*want[0]+f[1]*want[1])/len)*180/Math.PI;
  assert.ok(angle<=45,`${id} checkpoint faces ${angle.toFixed(0)}° off the first route segment (yaw ${pose.yaw.toFixed(2)})`);
 }
});

/** localStorage-shaped memory store: the checkpoint writers take the real seam. */
function memoryStorage(){
 const data=new Map<string,string>();
 return{
  get length(){return data.size;},
  key:(index:number)=>[...data.keys()][index]??null,
  getItem:(key:string)=>data.get(key)??null,
  setItem:(key:string,value:string)=>{data.set(key,value);},
  removeItem:(key:string)=>{data.delete(key);},
  clear:()=>data.clear(),
 };
}

group('sports and ending checkpoints seal the campus with the earlier endgame facts',()=>{
 const store=memoryStorage();
 for(const id of ['sports','ending'] as const){
  store.clear();
  const threat=applyCheckpointThreat(id,store);
  assert.equal(threat?.phase,'sealed',`${id} starts from a sealed campus`);
  assert.deepEqual(threat?.flags,{lionDefeated:true,powerCut:true,localModelCleared:false},`${id} holds the lion and power results`);
  assert.ok(store.getItem(WORLD_THREAT_KEY),`${id} writes the world threat through the real key`);
  assert.equal(loadWorldThreat({storage:store,now:1}).phase,'sealed');
 }
 for(const id of ['b4-inside','lawn','b5'] as const)assert.equal(applyCheckpointThreat(id,store),null,`${id} invents no endgame facts`);
});

if(failures.length){console.error(`\ncheck-chapter-select: ${failures.length} failed, ${passed} passed`);process.exit(1);}
console.log(`\ncheck-chapter-select: ${passed} passed`);
