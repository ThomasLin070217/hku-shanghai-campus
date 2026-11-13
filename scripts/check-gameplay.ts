import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSupplyQuest,readQuestSave,SUPPLIES} from '../src/gameplay/supplyQuest';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
const results:{name:string;passed:boolean}[]=[];
function test(name:string,fn:()=>void){fn();results.push({name,passed:true});console.log('PASS',name);}
test('No collection before start; range, visibility, duplicate and early submission guards',()=>{
 const q=createSupplyQuest();assert.equal(q.interact('water',1,true),false);q.start();
 for(const [distance,visible] of [[3,true],[NaN,true],[-1,true],[1,false]] as const)assert.equal(q.interact('water',distance,visible),false);
 assert.equal(q.interact('unknown',1,true),false);assert.equal(q.interact('station',1,true),false);
 assert.equal(q.interact('water',1,true),true);assert.equal(q.interact('water',1,true),false);assert.deepEqual(q.save().collected,['water']);q.dispose();
});
test('Out of order collections, reload, submit once, reset and replay',()=>{
 const q=createSupplyQuest();q.start();q.interact('planks',1,true);q.interact('water',1,true);const saved=q.save();q.dispose();
 const restored=createSupplyQuest(saved);assert.deepEqual(restored.save(),saved);restored.interact('hammer',1,true);assert.equal(restored.actor.getSnapshot().value,'ready');
 assert.equal(restored.interact('station',4,true),false);assert.equal(restored.interact('station',1,true),true);assert.equal(restored.interact('station',1,true),false);
 const completed=createSupplyQuest(restored.save());assert.equal(completed.actor.getSnapshot().value,'completed');completed.reset();assert.deepEqual(completed.save(),{version:1,started:false,collected:[],completed:false});completed.start();assert.equal(completed.interact('water',1,true),true);restored.dispose();completed.dispose();
});
test('Reject incompatible, corrupt and inconsistent save data',()=>{
 for(const s of [null,{},[],{version:2,started:true,collected:[],completed:false},{version:1,started:true,collected:['alien'],completed:false},{version:1,started:true,collected:['water','water'],completed:false},{version:1,started:false,collected:['water'],completed:false},{version:1,started:true,collected:['water'],completed:true}])assert.equal(readQuestSave(s),null);
});
test('Default practice markers sit on reachable CDS-1 exterior ground',()=>{
 const world=createNavigation(BUILDINGS,SITE),b=BUILDINGS.find(b=>b.id==='B04')!;
 for(const e of [...SUPPLIES,{x:4,z:10}]){const x=b.x+e.x,z=b.z+b.depth/2+e.z,y=world.support(x,z,0);assert.notEqual(y,null);assert.equal(world.blocked(x,z,y!),false);}world.dispose();
});
fs.mkdirSync('assets/open-source-v6',{recursive:true});fs.writeFileSync('assets/open-source-v6/gameplay-checks.json',JSON.stringify({date:new Date().toISOString(),results},null,2));
