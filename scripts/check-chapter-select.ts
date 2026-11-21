import assert from 'node:assert/strict';
import {OPENING_CHECKPOINTS,CHECKPOINT_LABELS,checkpointPose,checkpointState,openingCheckpoint,type OpeningCheckpoint} from '../src/opening/checkpoint';
import {validOpeningState} from '../src/opening/state';
import type {OpeningStage} from '../src/opening/contracts';

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

if(failures.length){console.error(`\ncheck-chapter-select: ${failures.length} failed, ${passed} passed`);process.exit(1);}
console.log(`\ncheck-chapter-select: ${passed} passed`);
