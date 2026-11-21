import assert from 'node:assert/strict';
import {
 CAMPAIGN_SAVE_KEY,CAMPAIGN_STAGES,CAMPAIGN_TRANSITIONS,campaignChapterOf,createCampaignState,
 fleetStandsDown,parseCampaignState,reduceCampaign,stageIndex,type CampaignEvent,type CampaignStage,
} from '../src/campaign/state';

let passed=0;
const failures:string[]=[];
function group(name:string,fn:()=>void):void{
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message:String(error));}
}

const EVENTS:CampaignEvent[]=['enter_b4','keyboard_solved','flip_solved','breaker_pulled','macbook_connected','reach_lawn','guardian_shutdown','reach_sports','door_opened','ending_finished'];

group('a new campaign starts at b4_enter for the device',()=>{
 const s=createCampaignState('mac-1',100);
 assert.deepEqual(s,{schemaVersion:1,stage:'b4_enter',deviceId:'mac-1',updatedAt:100});
});

group('the ten events walk the stages in order to done',()=>{
 let s=createCampaignState('mac-1',1);
 const seen:CampaignStage[]=[s.stage];
 EVENTS.forEach((event,i)=>{
  const r=reduceCampaign(s,event,10+i);
  assert.equal(r.changed,true,event);
  assert.equal(r.state.stage,CAMPAIGN_STAGES[i+1]);
  assert.equal(r.state.updatedAt,10+i);
  assert.equal(r.state.deviceId,'mac-1');
  assert.notEqual(r.state,s,'a change returns a new object');
  s=r.state;seen.push(s.stage);
 });
 assert.deepEqual(seen,[...CAMPAIGN_STAGES]);
 assert.equal(s.stage,'done');
});

group('every out-of-order event is rejected with the same object',()=>{
 for(const stage of CAMPAIGN_STAGES){
  const s={...createCampaignState('mac-1',1),stage};
  for(const event of EVENTS){
   if(CAMPAIGN_TRANSITIONS[event].from===stage)continue;
   const r=reduceCampaign(s,event,99);
   assert.equal(r.changed,false,`${event} at ${stage}`);
   assert.equal(r.state,s,`${event} at ${stage} keeps the object`);
  }
 }
});

group('parseCampaignState is strict',()=>{
 const good=createCampaignState('mac-1',5);
 assert.deepEqual(parseCampaignState(good),good);
 assert.equal(parseCampaignState({...good,schemaVersion:2}),null);
 assert.equal(parseCampaignState({...good,stage:'b4_lobby'}),null);
 assert.equal(parseCampaignState({...good,deviceId:''}),null);
 assert.equal(parseCampaignState({...good,deviceId:7}),null);
 assert.equal(parseCampaignState({...good,updatedAt:Number.NaN}),null);
 for(const raw of [null,undefined,'b4_enter',42,[],true])assert.equal(parseCampaignState(raw),null,String(raw));
});

group('a saved state round-trips through JSON',()=>{
 let s=createCampaignState('mac-1',1);
 for(const event of EVENTS.slice(0,6))s=reduceCampaign(s,event,2).state;
 assert.deepEqual(parseCampaignState(JSON.parse(JSON.stringify(s))),s);
});

group('stageIndex follows CAMPAIGN_STAGES',()=>{
 CAMPAIGN_STAGES.forEach((stage,i)=>assert.equal(stageIndex(stage),i));
});

group('campaignChapterOf maps stages to chapters and walking legs to null',()=>{
 const expected:Record<CampaignStage,'b4'|'lawn'|'sports'|'ending'|null>={
  b4_enter:'b4',b4_keyboard:'b4',b4_flip:'b4',b4_breaker:'b4',b4_connect:'b4',
  to_lawn:null,lawn:'lawn',to_sports:null,sports:'sports',ending:'ending',done:'ending',
 };
 for(const stage of CAMPAIGN_STAGES)assert.equal(campaignChapterOf(stage),expected[stage],stage);
});

group('the opening fleet stands down from to_lawn on',()=>{
 for(const stage of CAMPAIGN_STAGES)assert.equal(fleetStandsDown(stage),stageIndex(stage)>=stageIndex('to_lawn'),stage);
 assert.equal(fleetStandsDown(null),false,'no campaign: Chapter 1 rules apply');
});

group('the save key sits under hku. so Reset progress clears it',()=>{
 assert.ok(CAMPAIGN_SAVE_KEY.startsWith('hku.'));
});

if(failures.length){console.error(`\ncheck-campaign-state: ${failures.length} failed, ${passed} passed`);process.exit(1);}
console.log(`\ncheck-campaign-state: ${passed} passed`);
