import assert from 'node:assert/strict';import fs from 'node:fs';
const base='http://127.0.0.1:8787',sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=[];
const api=(p,d)=>fetch(base+p,d===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json());
const observe=async()=>{const r=await api('/observe');assert.ok(r.ok,JSON.stringify(r));return r.state;};
const wait=async(fn)=>{for(let i=0;i<150;i++){const s=await observe();if(fn(s))return s;await sleep(20);}throw Error('live wait timed out');};
const grant=await api('/acquireControl',{agentId:'integration-check'});assert.ok(grant.ok,JSON.stringify(grant));const epoch=grant.controlEpoch;let id=0;
async function act(data){const commandId='live-'+Date.now()+'-'+id++;const r=await api('/act',{commandId,controlEpoch:epoch,durationMs:700,...data});assert.ok(r.ok,JSON.stringify(r));return commandId;}
try{
 let s=await observe();log.push({test:'initial',state:s});
 const forward=await act({move:{forward:1,right:0},durationMs:250});await wait(s=>s.lastCommand?.commandId===forward&&['completed','blocked'].includes(s.lastCommand.status));const stopped=await observe();await sleep(250);const later=await observe();assert.deepEqual(later.player.position,stopped.player.position);assert.deepEqual(later.player.velocity,[0,0,0]);log.push({test:'TTL clears input',state:later});
 const jump=await act({move:{forward:0,right:1},sprint:true,jump:true,durationMs:900});const air=await wait(s=>!s.player.grounded&&s.player.position[1]>.15);const switchedId=await act({move:{forward:0,right:1},sprint:true,switchView:true,durationMs:900});const switched=await wait(s=>s.lastCommand?.commandId===switchedId&&s.lastCommand.status==='running');assert.notEqual(switched.view,air.view);assert.equal(switched.player.grounded,false);assert.ok(switched.player.velocity[1]<=air.player.velocity[1]);assert.ok(Math.hypot(...switched.player.position.map((v,i)=>v-air.player.position[i]))<.8);log.push({test:'midair view switch preserves trajectory',before:air,after:switched});
 const dupe=await api('/act',{commandId:switchedId,controlEpoch:epoch,durationMs:900,switchView:true,jump:true,lookDelta:{yawDeg:70,pitchDeg:20}});assert.equal(dupe.duplicate,true);await sleep(35);const dupState=await observe();assert.equal(dupState.view,switched.view);assert.equal(dupState.player.yawDeg,switched.player.yawDeg);log.push({test:'duplicate no repeated event',reply:dupe,state:dupState});
 await api('/stop',{controlEpoch:epoch});const falling=await observe();assert.equal(falling.player.grounded,false);await wait(s=>s.player.grounded);log.push({test:'stop midair still lands',air:falling,land:await observe()});
 // Face CDS-1 after a small sideways jump. The doors remain closed.
 for(let k=0;k<4;k++){const cid=await act({move:{forward:1,right:0},sprint:true,durationMs:900});await wait(s=>s.lastCommand?.commandId===cid&&['completed','blocked'].includes(s.lastCommand.status));}
 s=await observe();assert.ok(s.player.position[2]>23&&s.player.position[2]<23.4);assert.equal(s.lastCommand.status,'blocked');assert.ok(s.lastCommand.collisionIds.some(id=>id.includes('closed-doors')));log.push({test:'closed door blocks external Agent',state:s});
 console.log('PASS live browser API:',log.map(x=>x.test).join('; '));
}finally{await api('/releaseControl',{controlEpoch:epoch});fs.writeFileSync('assets/voxel/live-agent-checks.json',JSON.stringify(log,null,2));}
