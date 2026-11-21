import assert from 'node:assert/strict';
import {BOSS, checkpoint, createCombat, NODES, type Phase, type Point} from '../src/lionBoss/combat';
import type {SkillRule} from '../src/lionBoss/rules';
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

const frame = 1/120;
const stun:SkillRule = {kind:'stun',side:'left'};
const lure:SkillRule = {kind:'lure',side:'right'};
type Combat = ReturnType<typeof createCombat>;

function advanceUntil(combat:Combat, phase:Phase, player:Point) {
  for (let i=0; i<1200 && combat.state.phase!==phase; i++) {
    assert.equal(combat.step(frame,player,false),null);
  }
  assert.equal(combat.state.phase,phase);
}
function holdSubmit(combat:Combat, player:Point, frames:number) {
  let repairs=0;
  for (let i=0; i<frames; i++) {
    const event=combat.step(frame,player,true);
    assert.notEqual(event,'hit');
    if(event==='repair') repairs++;
  }
  return repairs;
}

const combat=createCombat();
for(let i=0;i<3;i++) {
  const player=checkpoint(i);
  const expected=i===1?lure:stun;
  combat.start();
  assert.equal(combat.cast(expected,player).ok,false);
  advanceUntil(combat,i===1?'swipeRecover':'chargeWarn',player);
  const wrong=i===1?stun:lure;
  assert.equal(combat.cast(wrong,player).ok,false);
  assert.equal(combat.state.cooldown[wrong.kind],0);
  assert.equal(combat.cast({...expected,maxRange:4},player).ok,false);
  assert.equal(combat.cast(expected,player).ok,true);
  assert.equal(combat.cast(expected,player).ok,false);
  if(i===1) advanceUntil(combat,'lured',player);
  assert.equal(holdSubmit(combat,{x:BOSS.x+12,z:BOSS.z+12},10),0);
  assert.equal(combat.state.submit,0);
  assert.equal(holdSubmit(combat,NODES[i],60),0);
  combat.step(frame,NODES[i],false);
  assert.equal(combat.state.submit,0);
  assert.equal(holdSubmit(combat,NODES[i],160),1);
  assert.equal(combat.state.repaired,i+1);
}
assert.equal(combat.state.phase,'complete');
assert.equal(holdSubmit(combat,NODES[2],240),0);
const restored=createCombat(2);
restored.start();
advanceUntil(restored,'chargeWarn',checkpoint(2));
assert.equal(restored.cast(stun,checkpoint(2)).ok,true);
advanceUntil(restored,'return',checkpoint(2));
assert.equal(restored.state.repaired,2);
advanceUntil(restored,'charge',checkpoint(2));
let hit = false;
for(let i=0;i<120 && !hit;i++) hit = restored.step(frame,checkpoint(2),false)==='hit';
assert.equal(hit,true);
restored.reset(2);
assert.equal(restored.state.repaired,2);
assert.equal(restored.state.phase,'safe');
assert.equal(restored.state.cooldown.stun,0);
assert.equal(createCombat(3).state.phase,'complete');
console.log('PASS · three manual counters and repairs, timing/range gates, interrupted holds, timeout, hit and checkpoint recovery');
