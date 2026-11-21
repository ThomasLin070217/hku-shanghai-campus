import assert from 'node:assert/strict';
import {BOSS, canSubmit, createCombat, NODES, SAFE, type Phase, type Point} from '../src/lionBoss/combat';
import {SKILL_SPECS} from '../src/lionBoss/skillCatalog';
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

const boot=createCombat();
assert.equal(boot.state.phase,'safe');
boot.awaken();assert.equal(boot.state.phase,'awakening');
assert.equal(boot.cast(rule('stun'),NODES[0]).ok,false);
advance(boot,NODES[0],2.5);
assert.equal(boot.state.phase,'safe');
assert.equal(boot.state.awakened,true);
boot.start();
const origin={...boot.state.lion};
advance(boot,SAFE,.5);
assert.notDeepEqual(boot.state.lion,origin);
assert.equal(boot.state.phase,'patrol');
console.log('PASS awakening, maintenance sanctuary, moving patrol');

const encounter=createCombat();
encounter.start();
const watcher={x:BOSS.x-2,z:BOSS.z+8.2};
until(encounter,watcher,()=>encounter.state.phase==='alert');
until(encounter,watcher,()=>encounter.state.phase==='chase');
until(encounter,watcher,()=>encounter.state.phase==='chargeWarn');
assert.ok(encounter.state.lion.z>BOSS.z);
assert.equal(encounter.check(rule('stun'),watcher).ok,true);
until(encounter,watcher,()=>encounter.state.phase==='charge');
assert.equal(encounter.cast(rule('stun'),watcher).ok,false);
assert.deepEqual(advance(encounter,watcher,1),['hit']);
assert.equal(encounter.state.phase,'chargeRecover');
const close=createCombat();close.start();
const front={x:BOSS.x,z:BOSS.z+3};
until(close,front,()=>close.state.phase==='swipeWarn');
assert.deepEqual(advance(close,{x:BOSS.x-6,z:BOSS.z},1.1),[]);
assert.equal(close.state.phase,'swipeRecover');
console.log('PASS detection, pursuit, directional strike telegraphs, dodge and single-hit recovery');

const denied=createCombat();denied.start();
const far={x:BOSS.x+15,z:BOSS.z};
assert.equal(denied.cast({...rule('lure'),maxRange:16},far).ok,false);
assert.equal(denied.cast(rule('stun'),far).ok,false);
assert.equal(denied.cast(rule('stun'),SAFE).ok,false);
assert.equal(denied.cast(rule('ghost'),NODES[0],{x:BOSS.x+500,z:BOSS.z}).ok,false);
assert.deepEqual(denied.state.cooldown,{stun:0,lure:0,ghost:0});
const sig={x:BOSS.x-6,z:BOSS.z+2};
assert.equal(denied.cast(rule('ghost'),NODES[0],sig).ok,true);
assert.deepEqual(denied.state.signal,sig);
assert.equal(denied.state.target,'signal');
assert.deepEqual(advance(denied,NODES[2],2,true),[]);
assert.equal(denied.state.repaired,0);
assert.ok(Math.hypot(denied.state.lion.x-sig.x,denied.state.lion.z-sig.z)<2.2);
until(denied,SAFE,()=>denied.state.phase==='return');
assert.equal(denied.state.signal,null);
assert.equal(denied.state.target,null);
console.log('PASS Ghost redirects to the requested point; targets, permissions and power interlock');

for(const kinds of [['stun','lure'],['lure','ghost'],['ghost','stun']] as const){
  let c=createCombat();c.start();
  for(let i=0;i<3;i++){
    const id=kinds[i%2],node=NODES[i];
    until(c,SAFE,()=>!canSubmit(c.state)&&c.state.phase!=='helperRun'&&c.state.cooldown[id]===0,30);
    // Start the hack from outside the panel, then move into the actual device radius.
    const beside={x:node.x+2.2,z:node.z};
    until(c,beside,()=>c.check(rule(id),beside).ok);
    assert.equal(c.cast(rule(id),beside).ok,true,id+' at '+node.name);
    assert.equal(c.state.cooldown[id],SKILL_SPECS[id].cooldown);
    assert.equal(c.cast(rule(kinds[(i+1)%2]),beside).ok,false);
    if(id==='lure'){
      assert.equal(c.state.target,'helper');
      const before={...c.state.helper};
      until(c,beside,()=>c.state.phase==='lured');
      assert.notDeepEqual(c.state.helper,before);
    }
    assert.equal(advance(c,beside,.1,true).length,0);
    assert.equal(c.state.submit,0);
    advance(c,node,.25,true);assert.ok(c.state.submit>0);
    advance(c,node,dt);assert.equal(c.state.submit,0);
    assert.deepEqual(advance(c,node,node.hold+.05,true),['repair']);
    assert.equal(c.state.repaired,i+1);
    if(i===1){
      // Death reloads the checkpoint, preserving both locks and clearing any temporary target.
      c=createCombat(c.state.repaired);
      assert.equal(c.state.phase,'safe');assert.equal(c.state.signal,null);
      assert.deepEqual(c.state.cooldown,{stun:0,lure:0,ghost:0});c.start();
    }
  }
  assert.equal(c.state.phase,'complete');
  const stopped=structuredClone(c.state);
  assert.deepEqual(advance(c,NODES[2],10,true),[]);
  assert.deepEqual(c.state,stopped);
  assert.equal(c.cast(rule(kinds[0]),NODES[0]).ok,false);
  console.log('PASS '+kinds.join(' + ')+' opens both locks and cuts power; death checkpoint, terminal shutdown');
}

for(const id of ['stun','lure','ghost'] as const){
  const c=createCombat();c.start();const node=NODES[0];
  const start={...c.state.lion};assert.equal(c.cast(rule(id),node).ok,true);
  advance(c,node,1);
  if(id==='stun')assert.deepEqual(c.state.lion,start);
  const elapsed=SKILL_SPECS[id].duration-1;
  advance(c,node,elapsed+.05);
  assert.notEqual(c.state.target,'helper');assert.notEqual(c.state.target,'signal');
  assert.equal(canSubmit(c.state),false);assert.equal(c.state.signal,null);
  assert.ok(c.state.cooldown[id]>0);
  assert.equal(c.cast(rule(id),node).ok,false);
  assert.equal(c.state.repaired,0);
}
console.log('PASS all effect timers expire, cooldowns tick independently, no passive win');
