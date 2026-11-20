/**
 * Thomas opening survival runtime: 10 hearts, −2 per capture, reuse-safe state.
 * Pure module check; no browser, no DOM, no audio.
 */
import assert from 'node:assert/strict';
import {createOpeningRuntime,validOpeningRuntime,damageOpeningHearts,healOpeningHearts,syncRuntimeWithStory,OPENING_MAX_HEARTS,OPENING_CAPTURE_DAMAGE} from '../src/opening/runtime';
import {createOpeningState,reduceOpening} from '../src/opening/state';

const initial=createOpeningRuntime();
assert.equal(initial.hearts,10,'a new opening starts with ten hearts');
assert.equal(initial.maxHearts,10);
assert.equal(initial.catches,0);
for(const flag of ['curtain_deployed','robot_chase_started','agent_chat_unlocked','go_to_building4_objective_unlocked','staff_task_received'] as const)assert.equal(initial[flag],false,`${flag} starts false`);
assert.deepEqual(validOpeningRuntime(JSON.parse(JSON.stringify(initial))),initial,'runtime survives a JSON round-trip');
assert.equal(OPENING_CAPTURE_DAMAGE,2,'one capture costs exactly two hearts');

let runtime=initial;
const lost=[];
for(let i=0;i<5;i++){
 const hit=damageOpeningHearts(runtime);
 runtime=hit.runtime;lost.push({lost:hit.lost,hearts:runtime.hearts,dead:hit.dead});
}
assert.deepEqual(lost.map(l=>l.hearts),[8,6,4,2,0],'five captures take the run to zero');
assert.equal(lost[4].dead,true,'zero hearts is a failed run');
assert.equal(runtime.catches,5,'every capture is counted');
const over=damageOpeningHearts(runtime);
assert.equal(over.runtime.hearts,0,'hearts never go negative');
assert.equal(over.lost,0,'no hearts can be lost below zero');
const healed=healOpeningHearts(runtime);
assert.equal(healed.hearts,OPENING_MAX_HEARTS,'checkpoint recovery restores ten hearts');
assert.equal(healed.catches,runtime.catches,'healing does not erase the capture count');

const read=reduceOpening(createOpeningState(),'read_invitation');
const after=reduceOpening(reduceOpening(read,'exit_bus'),'accept_errand');
const synced=syncRuntimeWithStory(createOpeningRuntime(),after);
assert.equal(synced.staff_task_received,true,'the errand flag mirrors the story stage');
assert.equal(synced.agent_chat_unlocked,false);
assert.equal(synced.curtain_deployed,false);
const incident={...after,stage:'incident',laptop_acquired:true,campus_alert_triggered:true,alert_read:true};
const end=syncRuntimeWithStory({...createOpeningRuntime(),hearts:6,catches:2},incident);
assert.equal(end.robot_chase_started,false,'incident alone must not invent a chase on load');
assert.equal(syncRuntimeWithStory({...createOpeningRuntime(),robot_chase_started:true},incident).robot_chase_started,true,'an actual recorded chase survives load');
assert.equal(end.curtain_deployed,true,'an incident save restores the curtain');
assert.equal(end.agent_chat_unlocked,true,'a read alert restores the agent');
assert.equal(end.go_to_building4_objective_unlocked,true,'the Building 4 objective is restored');
assert.equal(end.hearts,6,'hearts survive a save sync');
assert.equal(end.catches,2,'capture count survives a save sync');

for(const bad of [
 null,undefined,'runtime',[],{...initial,hearts:-1},{...initial,hearts:11},{...initial,hearts:4.5},
 {...initial,maxHearts:9},{...initial,catches:-1},{...initial,catches:1.5},{...initial,curtain_deployed:'yes'},
 {...initial,schemaVersion:2},
])assert.equal(validOpeningRuntime(bad),null,`malformed runtime must be rejected: ${JSON.stringify(bad)}`);
for(const flag of ['curtain_deployed','robot_chase_started','agent_chat_unlocked','go_to_building4_objective_unlocked','staff_task_received'] as const){
 assert.equal(validOpeningRuntime({...initial,[flag]:'true'}),null,`${flag} must be boolean`);
 assert.ok(validOpeningRuntime({...initial,[flag]:true}),`${flag}=true is valid`);
}
console.log('PASS opening survival runtime: 10 hearts, −2 per capture, zero-heart failure, heal, story sync and strict validation');
