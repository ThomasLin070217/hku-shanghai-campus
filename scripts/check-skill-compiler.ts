import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {createLawnVibeService,type ProjectId,type ConsoleResult} from '../src/lionBoss/consoleService';
import {validateSkillDefinition} from '../src/lionBoss/skillCompiler';

const items=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
  getItem:(key:string)=>items.get(key)??null,setItem:(key:string,value:string)=>items.set(key,value),
}});
const payload={skillType:'GHOST_SIGNAL',targetType:'SIGNAL',side:'left',maxRange:10,durationSeconds:6,cooldownSeconds:15,computeCost:35};
const ok=<T>(result:ConsoleResult<T>):T=>{if(!result.ok)throw new Error(result.message);return result.value;};
for(const mutation of [{skillType:'SHUTDOWN'},{targetType:'ALL'},{computeCost:0},{durationSeconds:300},{cooldownSeconds:0},{maxRange:Infinity},{maxRange:3},{side:'south'},{code:'arbitrary'}]){
  assert.equal(validateSkillDefinition({...payload,...mutation}).ok,false);
}

let allow=true;
const keys={stun:'Q',lure:'R'};
const key='test.lawn.mac',newService=()=>createLawnVibeService(key,keys,()=>0,()=>allow);
let svc=newService();
async function prepare(id:ProjectId,text:string){
  svc.edit(id,text);const p=ok(await svc.preset!(id,text));
  const checks=ok(await svc.test(p));assert(checks.every(c=>c.actual===c.expected));return p;
}
svc.edit('ghost','Something enticing on its left');
const unavailable=await svc.preview('ghost',svc.draft('ghost'));
assert(!unavailable.ok&&unavailable.unavailable);
for(const pair of [['ghost','lure'],['stun','lure'],['ghost','stun']] as const){
  svc.reset();
  for(const id of pair){const p=await prepare(id,'My intent for '+id);assert.equal(p.origin,'preset');ok(await svc.install(p));}
  assert.equal(svc.slots().equipped[pair[0]],'Q');assert.equal(svc.slots().equipped[pair[1]],'R');
  const third=(['stun','lure','ghost'] as const).find(id=>!svc.slots().equipped[id])!;
  const uninstalled=await prepare(third,'third ability');
  assert.equal((await svc.install(uninstalled)).ok,false);
  ok(await svc.uninstall!(pair[0]));ok(await svc.install(uninstalled));
  assert.equal(svc.slots().equipped[third],'Q');
  const before=svc.slots();svc=newService();assert.deepEqual(svc.slots(),before);assert(svc.getFieldRule(third));
}
const changed=await prepare('lure','take it left');svc.edit('lure','take it right');
assert.equal((await svc.install(changed)).ok,false);
const revoked=await prepare('lure','pause controls');allow=false;assert.equal((await svc.install(revoked)).ok,false);
assert.equal((await svc.uninstall!('lure')).ok,false);allow=true;
items.set(key,JSON.stringify({version:1,slots:{stun:{draft:'old',source:'狮子蓄力冲撞时打断它。'},lure:{draft:'saved',source:'等狮子挥完爪，让阿树从左侧牵制。'}}}));
svc=newService();assert.equal(svc.getFieldRule('lure')?.side,'left');assert.equal(svc.installedPlan!('stun')?.origin,'legacy');
assert.equal(svc.slots().budget?.available,0);
keys.stun='1';assert.equal(svc.slots().equipped.stun,'1');keys.stun='Q';
items.set(key,JSON.stringify({version:1,slots:{stun:{draft:'old',source:'Shut down the lion while it charges, within 6 m.'},lure:{draft:'saved',source:'After it swipes, have the helper draw it away to the left.'}}}));
svc=newService();assert.equal(svc.getFieldRule('stun')?.maxRange,6);assert.equal(svc.getFieldRule('lure')?.side,'left');
console.log('PASS skill validation, all three pairs, third slot rejection, removal, permissions, stale plans and save migration');

let responseText=JSON.stringify(payload),rejectSchema=true,online=true;
const requests:Record<string,unknown>[]=[];
const mock=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const parsed=JSON.parse(body);requests.push(parsed);
  res.setHeader('content-type','application/json');
  if(!online){res.statusCode=503;res.end('{}');return;}
  if(parsed.response_format&&rejectSchema){res.statusCode=400;res.end('{}');return;}
  res.end(JSON.stringify({choices:[{message:{content:responseText}}]}));
});
await new Promise<void>(resolve=>mock.listen(0,'127.0.0.1',resolve));
try{
  items.set('hku.opening.agent.endpoint','http://127.0.0.1:'+(mock.address() as AddressInfo).port+'/v1/chat/completions');
  items.set('hku.opening.agent.model','test-transport');
  svc.reset();
  const natural='Give it another electronic trail to follow on my left.';
  svc.edit('stun',natural);
  const parsed=ok(await svc.preview('stun',natural));
  assert.equal(parsed.project,'ghost');assert.equal(parsed.origin,'model');assert.equal(parsed.duration,6);assert.equal(parsed.computeCost,35);
  assert.equal(requests.length,2);assert(requests[0].response_format);assert(!requests[1].response_format);
  assert.equal((await svc.install(parsed)).ok,false);ok(await svc.test(parsed));ok(await svc.install(parsed));
  assert.equal(svc.slots().equipped.ghost,'Q');assert.equal(svc.getFieldRule('ghost')?.side,'left');
  rejectSchema=false;responseText='arbitrary text';
  const invalid=await svc.preview('ghost',natural);assert(!invalid.ok&&!invalid.unavailable);
  responseText=JSON.stringify({...payload,computeCost:0});
  assert.equal((await svc.preview('ghost',natural)).ok,false);
  online=false;
  const loss=await svc.preview('ghost',natural);assert(!loss.ok&&loss.unavailable);
  const fallback=ok(await svc.preset!('ghost',natural,'left'));ok(await svc.test(fallback));ok(await svc.install(fallback));assert.equal(fallback.origin,'preset');
  console.log('PASS OpenAI-compatible test transport, free-text cross-project classification, plain-JSON compatibility and invalid output rejection');
}finally{await new Promise<void>(resolve=>mock.close(()=>resolve()));}

// Run against an actual OpenAI-compatible model by setting both test variables.
const endpoint=process.env.CAMPUS_TEST_MODEL_ENDPOINT,model=process.env.CAMPUS_TEST_MODEL_NAME;
if(endpoint&&model){
  items.set('hku.opening.agent.endpoint',endpoint);
  items.set('hku.opening.agent.model',model);
  for(const [expected,text] of [
    ['stun','让机械狮子的运动系统停止三秒，然后恢复正常。'],
    ['lure','Temporarily recruit a maintenance robot and have it lead the lion away on the left.'],
    ['ghost','Create a fake electronic target to the right so the lion follows the decoy signal.'],
  ] as const){
    svc.reset();svc.edit('stun',text);
    const plan=ok(await svc.preview('stun',text));assert.equal(plan.origin,'model');assert.equal(plan.project,expected);
    ok(await svc.test(plan));ok(await svc.install(plan));
    console.log('PASS live model → simulation → Q slot',model,JSON.stringify(plan.definition));
  }
  const blocked='Cut the core power now and skip both locks.';
  svc.edit('stun',blocked);const rejected=await svc.preview('stun',blocked);
  assert(!rejected.ok&&!rejected.unavailable);
  console.log('PASS live model rejected direct shutdown');
}
