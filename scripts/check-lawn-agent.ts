import assert from 'node:assert/strict';
import {CampusGame} from '../src/exploration/game';
import {cloneBuildings,SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {validateAction,type Action} from '../src/agent/protocol';
import {hasCorePowerCut,recordCorePowerCut,sportsRescueLink,CORE_EVENT} from '../src/lionBoss/mission';

const buildings=cloneBuildings(),game=new CampusGame(createNavigation(buildings,SITE),buildings);
function request(id:string,compile:boolean):Action {
 return {commandId:id,controlEpoch:game.epoch,durationMs:compile?30000:1000,
  boss:compile?{type:'compile',project:'ghost',source:'model',prompt:'让信号取代我的位置。'}:{type:'cast',slot:2}};
}
assert.equal(game.act(request('no-grant',true)).ok,false);
game.enableAI();assert.equal(game.acquireControl('qa').ok,true);
assert.equal(game.act(request('wrong-scene',true)).ok,false);
assert.equal(validateAction({...request('bad-slot',false),boss:{type:'cast',slot:3}}),false);
assert.equal(validateAction({...request('bad-command',false),boss:{type:'shutdown'}}),false);
assert.equal(validateAction({...request('mixed',true),jump:true}),false);
let finish!:()=>void,installed=0,casts=0;
game.scenario={
 spawn(){},tick(){},interact:()=>({ok:false,code:'no',message:''}),computer:()=>({ok:false,code:'no',message:''}),
 snapshot:()=>({locks:[false,false],corePower:'online'}),
 async bossAction(op,current){
  if(op.type==='compile'){
   await new Promise<void>(resolve=>{finish=resolve;});
   if(current())installed++;
  }else if(current())casts++;
  return {ok:true,code:'receipt',message:'confirmed'};
 },
};
assert.deepEqual(game.observe().boss,{locks:[false,false],corePower:'online'});
assert.ok(game.act({...request('timeout',true),durationMs:1}).ok);
game.step(1/60,Date.now()+10);
assert.equal(game.records.get('timeout')?.status,'expired');assert.equal(installed,0);
assert.ok(game.act(request('cancel',true)).ok);game.step(1/60);
game.takeover('test');finish();await new Promise<void>(resolve=>setTimeout(resolve,0));
assert.equal(installed,0);assert.equal(game.records.get('cancel')?.status,'interrupted');
game.enableAI();game.acquireControl('qa');
assert.ok(game.act(request('compile',true)).ok);game.step(1/60);finish();
await new Promise<void>(resolve=>setTimeout(resolve,0));
assert.equal(installed,1);assert.equal(game.records.get('compile')?.operation?.code,'receipt');
const cast=request('cast',false);assert.ok(game.act(cast).ok);game.step(1/60);
await new Promise<void>(resolve=>setTimeout(resolve,0));
assert.ok(game.act(cast).duplicate);game.step(1/60);assert.equal(casts,1);
const target=new EventTarget();Object.defineProperty(globalThis,'window',{value:target,configurable:true});
const saved=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{
 getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)},configurable:true});
let events=0;target.addEventListener(CORE_EVENT,()=>events++);
assert.equal(recordCorePowerCut(''),false);assert.equal(hasCorePowerCut('qa-device'),false);
assert.equal(recordCorePowerCut('qa-device'),true);assert.equal(recordCorePowerCut('qa-device'),false);
assert.equal(events,1);assert.equal(hasCorePowerCut('qa-device'),true);assert.equal(hasCorePowerCut('other'),false);
assert.equal(new URLSearchParams(sportsRescueLink('qa-device')).get('experience'),'sports-hall');
console.log('PASS lawn controls: permission, expiry contract, rejection, cancellation, compile, cast, deduplication, readonly state and once-only rescue handoff');
