import assert from 'node:assert/strict';
import {BOSS, canSubmit, createCombat, NODES, SAFE, type Phase, type Point} from '../src/lionBoss/combat';
import type {SkillKind,SkillRule} from '../src/lionBoss/rules';
import {Inventory} from '../src/items/inventory';
import {restoreKitLayout} from '../src/lionBoss/kit';

const inventory = new Inventory();
const laptop = inventory.slots[9]!;
laptop.instanceId = 'existing-opening-laptop';
inventory.select(3);
assert.ok(inventory.equipItem(laptop.itemId));
assert.equal(inventory.equipped, laptop);
const savedLayout = inventory.slots.map(s => s?.instanceId ?? null);
inventory.move(3,27);
restoreKitLayout(inventory,savedLayout,3);
assert.equal(inventory.equipped, laptop);
const duplicate = [...savedLayout];
duplicate[1] = laptop.instanceId;
restoreKitLayout(inventory,duplicate,1);
assert.equal(inventory.equipped, laptop);
assert.equal(inventory.slots.filter(Boolean).length,1);

const dt=1/120;
type Combat=ReturnType<typeof createCombat>;
const rule=(kind:SkillKind):SkillRule=>({kind,side:'left',maxRange:12});
function advance(c:Combat,p:Point,seconds:number,holding=false){
  const events:string[]=[];
  for(let f=0;f<Math.ceil(seconds/dt);f++){
    const event=c.step(dt,p,holding);if(event)events.push(event);
  }
  return events;
}
function until(c:Combat,p:Point,test:()=>boolean,timeout=12){
  for(let f=0;f<timeout/dt;f++){
    if(test())return;
    c.step(dt,p,false);
  }
  assert.fail('Timed out in '+c.state.phase+' at '+JSON.stringify(c.state.lion));
}

const node=NODES[0];
const watcher={x:node.x,z:node.z+2.2};
const stun=rule('stun');
const encounter=createCombat();
encounter.start();
assert.equal(NODES.length,1);
assert.equal(encounter.cast(stun,SAFE).ok,false);
assert.equal(encounter.cast(stun,watcher).ok,false);
until(encounter,watcher,()=>encounter.state.phase==='chargeWarn');
assert.equal(encounter.cast(stun,watcher).ok,true);
assert.equal(encounter.state.phase,'stunned');
assert.equal(encounter.cast(stun,watcher).ok,false);
assert.equal(canSubmit(encounter.state),true);
assert.deepEqual(advance(encounter,watcher,.5,true),[]);
assert.equal(encounter.state.submit,0);
advance(encounter,node,.25,true);assert.ok(encounter.state.submit>0);
advance(encounter,node,dt);assert.equal(encounter.state.submit,0);
assert.deepEqual(advance(encounter,node,node.hold+.05,true),['repair']);
assert.equal(encounter.state.repaired,1);
assert.equal(encounter.state.phase,'complete');
assert.deepEqual(advance(encounter,node,10,true),[]);
assert.equal(createCombat(1).state.phase,'complete');

const retry=createCombat();
retry.start();
until(retry,watcher,()=>retry.state.phase==='chargeWarn');
assert.equal(retry.cast(stun,watcher).ok,true);
until(retry,watcher,()=>retry.state.phase==='return');
assert.equal(canSubmit(retry.state),false);
assert.equal(retry.state.repaired,0);
until(retry,watcher,()=>retry.state.phase==='charge');
assert.equal(retry.cast(stun,watcher).ok,false);
assert.deepEqual(advance(retry,watcher,1),['hit']);
assert.equal(retry.state.phase,'chargeRecover');

const close=createCombat();close.start();
until(close,{x:BOSS.x,z:BOSS.z+3},()=>close.state.phase==='chargeWarn');
console.log('PASS one charge counter and shutdown, interrupted holds, combat retry and completion restore');
