import assert from 'node:assert/strict';
import {OPENING_CHECKPOINTS,CHECKPOINT_LABELS,applyCheckpointThreat,checkpointCampaign,checkpointForStage,checkpointPose,checkpointState,normaliseChapter1World,openingCheckpoint,type OpeningCheckpoint} from '../src/opening/checkpoint';
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

group('the b6 errand checkpoint starts on the Building 6 entrance landing',()=>{
 // Owner ruling 2026-11-27: the lift and the MacBook errand are in Building 6, the middle
 // building. The checkpoint spawns on the auditorium's grand-stair landing, before the doors.
 const [x,y,z]=checkpointPose('b6').position;
 assert.ok(Math.hypot(x-O.b6.door,z+52.1)<.6,`b6 must start at the Building 6 doors, got ${x},${y},${z}`);
 assert.ok(Math.abs(y-O.b6.floor)<.3,`the b6 start must stand on the entrance landing, got y=${y}`);
 assert.ok(z>=O.b6.z1&&z<=O.b6.z1+2.2,'b6 must start on the landing outside the doors, not inside the hall');
 assert.ok(!(x>=O.b6.x0&&x<=O.b6.x1&&z>=O.b6.z0&&z<=O.b6.z1),'b6 must start outside the hall cavity');
});

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

group('R-02: a walking leg starts where its own checkpoint boots',()=>{
 // "Return to checkpoint" on a leg must use the start pose, never the leg's destination
 // (`chapterEntry()`), which would fire the arrival event on the next frame.
 assert.equal(checkpointForStage('to_lawn'),'lawn','to_lawn begins at the lawn checkpoint pose');
 assert.equal(checkpointForStage('to_sports'),'sports','to_sports begins at the sports checkpoint pose');
 assert.deepEqual([...checkpointPose(checkpointForStage('to_lawn')!).position],[...O.handoff],'the lawn leg starts at the B04 handoff');
 for(const stage of ['b4_enter','b4_keyboard','lawn','sports','ending','done'] as const){
  assert.equal(checkpointForStage(stage),null,`${stage} is a chapter stage, not a walking leg`);
 }
});

group('R-11: the b4 checkpoint spawns facing its objective',()=>{
 // The objective is the B04 entrance (`O.handoff`); the pose sits at `b5safe`, 79 m south
 // of it inside B5, so yaw 0 faced the wrong way at the chapter start.
 const pose=checkpointPose('b4'),[px,,pz]=pose.position;
 const want=[O.handoff[0]-px,O.handoff[2]-pz],len=Math.hypot(want[0],want[1]);
 const forward=[-Math.sin(pose.yaw),-Math.cos(pose.yaw)];
 const dot=(forward[0]*want[0]+forward[1]*want[1])/len;
 assert.ok(dot>.99,`b4 must spawn facing the handoff objective, forward·target=${dot.toFixed(3)}`);
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

group('R-07: a Chapter 1 checkpoint normalises a campaign threat record to clear',()=>{
 // A sealed/purged record belongs to a different run: it started the dinner walk under a
 // night curtain, and a purged record stopped the incident's seal from ever firing.
 const sealed={schemaVersion:1,phase:'sealed',sealedAt:1,purgedAt:null,flags:{lionDefeated:true,powerCut:true,localModelCleared:false}};
 const purged={schemaVersion:1,phase:'purged',sealedAt:1,purgedAt:2,flags:{lionDefeated:true,powerCut:true,localModelCleared:true}};
 for(const id of ['b5','b6','incident','b4'] as const){
  for(const record of [sealed,purged]){
   const store=memoryStorage();
   store.setItem(WORLD_THREAT_KEY,JSON.stringify(record));
   const cleared=normaliseChapter1World(id,store);
   assert.equal(cleared?.phase,'clear',`${id} must clear a ${record.phase} record`);
   assert.equal(loadWorldThreat({storage:store,now:1}).phase,'clear',`${id} writes the clear record through the real key`);
  }
 }
 // The clear direction belongs to Chapter 1 only: the campaign checkpoints keep S-36's
 // seal, and an already-clear record is not rewritten.
 const clean=memoryStorage();
 assert.equal(normaliseChapter1World('lawn',clean),null,'a campaign checkpoint is not normalised to clear');
 assert.equal(normaliseChapter1World('sports',clean),null,'sports keeps its own threat direction');
 assert.equal(loadWorldThreat({storage:clean,now:1}).phase,'clear','no checkpoint invented a record in an empty store');
 const store=memoryStorage();
 applyCheckpointThreat('sports',store);
 assert.equal(normaliseChapter1World('sports',store),null,'sports keeps the sealed record S-36 just wrote');
 assert.equal(loadWorldThreat({storage:store,now:1}).phase,'sealed','sports still starts sealed');
});

if(failures.length){console.error(`\ncheck-chapter-select: ${failures.length} failed, ${passed} passed`);process.exit(1);}
console.log(`\ncheck-chapter-select: ${passed} passed`);
