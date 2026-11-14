/** Browser must be open and user must enable AI. --takeover-test additionally waits for a real human takeover. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdirSync,writeFileSync} from 'node:fs';
const child=spawn(process.execPath,['scripts/agent-mcp.mjs'],{env:process.env,stdio:['pipe','pipe','inherit']}),pending=new Map(),log=[];let next=0,epoch;
createInterface({input:child.stdout}).on('line',line=>{const r=JSON.parse(line);pending.get(r.id)?.(r);pending.delete(r.id);});
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,t=setTimeout(()=>reject(Error('MCP timeout')),7000);pending.set(id,r=>{clearTimeout(t);resolve(r);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const call=async(name,args={})=>{const r=await rpc('tools/call',{name,arguments:args});assert.ok(r.result,JSON.stringify(r));const value=JSON.parse(r.result.content[0].text);log.push({tool:name,args,result:value});return value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'hku-live-verifier',version:'1'}});assert.equal((await rpc('tools/list')).result.tools.length,10);
 const initial=await call('campus_observe');assert.equal(initial.ok,true);assert.equal(initial.state.aiEnabled,true,'Enable AI in the page first');
 const entity=await call('campus_entity',{id:'S001'});assert.equal(entity.entity.sourceFile,'src/model/videoDetails.ts');assert.equal((await call('campus_entities',{kind:'road',limit:20})).total,14);
 const grant=await call('campus_acquire_control',{agentId:'live-mcp-verifier'});assert.equal(grant.ok,true);epoch=grant.controlEpoch;
 assert.equal((await call('campus_select_entity',{id:'S001',sceneRevision:entity.revision,controlEpoch:epoch})).ok,true);
 const commandId='live-mcp-'+Date.now();assert.equal((await call('campus_act',{commandId,controlEpoch:epoch,durationMs:300,move:{forward:.3,right:0},lookDelta:{yawDeg:5,pitchDeg:0}})).ok,true);
 await sleep(500);const after=await call('campus_observe'),result=await call('campus_command',{commandId});assert.ok(['completed','blocked'].includes(result.command.status));const distance=Math.hypot(after.state.player.position[0]-initial.state.player.position[0],after.state.player.position[2]-initial.state.player.position[2]);assert.ok(distance>0,'Start in a clear outdoor position');assert.equal(after.state.player.velocity[0],0);assert.equal(after.state.player.velocity[2],0);
 await sleep(200);const expired=await call('campus_observe');assert.deepEqual(expired.state.player.position,after.state.player.position);
 console.log('PASS live MCP → HTTP → WebSocket → game movement, ID selection and TTL stop; travelled',distance);
 if(process.argv.includes('--takeover-test')){console.log('TAKEOVER_READY: click 一键接管 in the browser within 30 seconds.');let revoked=false;for(let i=0;i<60;i++){await sleep(500);const r=await call('campus_observe');if(r.state.controlEpoch!==epoch){revoked=true;break;}}assert.ok(revoked,'No human takeover observed');assert.equal((await call('campus_act',{commandId:'late-'+Date.now(),controlEpoch:epoch,durationMs:200,jump:true})).error,'stale_epoch');assert.equal((await call('campus_select_entity',{id:'R005',sceneRevision:entity.revision,controlEpoch:epoch})).error,'stale_epoch');assert.equal((await call('campus_acquire_control',{agentId:'late-agent'})).error,'ai_not_enabled');console.log('PASS manual takeover invalidates movement and scene selection; AI cannot reacquire silently');}
}finally{if(epoch!==undefined)await call('campus_release_control',{controlEpoch:epoch});child.kill('SIGTERM');mkdirSync('evidence/scene-ai',{recursive:true});writeFileSync('evidence/scene-ai/live-mcp.json',JSON.stringify(log,null,2));}
