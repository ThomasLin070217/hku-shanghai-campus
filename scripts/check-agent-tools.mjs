import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {WebSocket} from 'ws';
// Headless check: fake game WebSocket + child MCP process. No browser, no network beyond 127.0.0.1.
const port=18789,base=`http://127.0.0.1:${port}`,actBodies=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getJson=async path=>{const response=await fetch(base+path);return{status:response.status,body:await response.json()};};
const server=spawn(process.execPath,['scripts/agent-server.mjs'],{env:{...process.env,HKU_AGENT_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let socket,mcp,sseController;const mcpPending=new Map(),mcpBadLines=[];let counter=0;
const gameEvent=(seq,kind='command_accepted')=>({seq,frame:seq*10,timeMs:Date.now(),kind,message:'event '+seq,data:{seq}});
const pushEvents=list=>socket.send(JSON.stringify({type:'events',events:list}));
const waitForEvents=async(afterSeq,count)=>{for(let i=0;i<100;i++){const{body}=await getJson('/events?afterSeq='+afterSeq);if(body.events.length>=count)return body;await sleep(20);}throw Error('events not buffered: afterSeq='+afterSeq+' count='+count);};
let sseBuffer='';const sseWaiters=[];
const waitSse=(predicate,label,timeout=5000)=>new Promise((resolve,reject)=>{
 if(predicate(sseBuffer))return resolve();
 const waiter={predicate,resolve};sseWaiters.push(waiter);
 setTimeout(()=>{const index=sseWaiters.indexOf(waiter);if(index>=0)sseWaiters.splice(index,1);reject(Error('SSE timeout: '+label));},timeout).unref();
});
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('server exited');}),new Promise((_,reject)=>setTimeout(()=>reject(Error('listen timeout')),4000).unref())]);
 // --- capabilities v2 (no game needed) ---
 const caps=(await getJson('/capabilities')).body;
 assert.equal(caps.protocolVersion,'hku-campus/2.0');assert.equal(caps.ready,false);assert.equal(caps.tools.length,15);
 for(const feature of ['events-sse','perception','directives','path','world'])assert.ok(caps.features.includes(feature),'missing feature '+feature);
 assert.equal(caps.mcp.resources,3);assert.equal(caps.mcp.prompts,1);
 assert.equal(caps.endpoints.eventsStream,'GET /events/stream?afterSeq=N');assert.equal(caps.endpoints.path,'GET /path?from=[x,y,z]&to=[x,y,z]&clearance=0.34&maxNodes=20000');
 assert.equal(caps.limits.directiveMaxMs,30000);assert.equal(caps.limits.eventBuffer,2048);
 console.log('PASS capabilities protocol 2.0, 15 tools, features/endpoints/mcp resources+prompts/limits');
 // --- not_ready + empty snapshot + query validation ---
 assert.equal((await fetch(base+'/entities')).status,503);
 assert.equal((await fetch(base+'/observe')).status,503);
 assert.equal((await fetch(base+'/world')).status,503);
 assert.equal((await fetch(base+'/path?from=%5B0,0,0%5D&to=%5B1,0,1%5D')).status,503);
 const empty=await getJson('/events');assert.equal(empty.status,200);assert.equal(empty.body.ok,true);assert.deepEqual(empty.body.events,[]);assert.equal(empty.body.eventSeq,0);
 for(const bad of ['/events?afterSeq=nope','/events?limit=0','/observe?afterSeq=-2','/path?to=%5B1,0,1%5D','/path?from=%5B1,2%5D&to=%5B1,0,1%5D','/entities/%zz','/commands/%zz'])assert.equal((await fetch(base+bad)).status,400,bad);
 assert.equal((await fetch(base+'/nope')).status,404);
 assert.equal((await fetch(base+'/act',{method:'POST',body:'{}'})).status,415);
 console.log('PASS not_ready 503, empty /events snapshot, query/url/body validation unchanged');
 // --- fake game WebSocket (same transport as src/agent/bridge.ts) ---
 socket=new WebSocket(`ws://127.0.0.1:${port}/game`,{origin:'http://127.0.0.1:5184'});
 socket.on('message',raw=>{
  const msg=JSON.parse(raw.toString());
  if(msg.type==='heartbeat'){socket.send(JSON.stringify({type:'heartbeat'}));return;}
  if(msg.type!=='rpc')return;
  let result;
  if(msg.method==='path')result=msg.args?.to?.[0]===999?{ok:false,path:[[0,0,0]],length:0,reachable:false,partial:true,reason:'unreachable'}:{ok:true,path:[[0,0,0],[10,0,10]],length:14.14,reachable:true,partial:false,visited:7,args:msg.args};
  else if(msg.method==='world')result={ok:true,method:'world',schema:'hku-scene/1',revision:'test-rev',protocolVersion:'hku-campus/2.0',args:msg.args};
  else if(msg.method==='act'){actBodies.push(msg.args);result={ok:true,accepted:true,command:{commandId:msg.args?.commandId,status:'accepted'}};}
  else result={ok:true,method:msg.method,args:msg.args};
  socket.send(JSON.stringify({type:'result',id:msg.id,result}));
 });
 await once(socket,'open');socket.send(JSON.stringify({type:'ready'}));
 for(let i=0;i<100;i++){if((await(await fetch(base+'/health')).json()).ready)break;await sleep(20);}
 assert.equal((await getJson('/health')).body.ready,true);
 // --- observe afterSeq / entities / path / world passthrough ---
 const observe=await getJson('/observe');assert.equal(observe.body.method,'observe');assert.deepEqual(observe.body.args,{});
 const observeAfter=await getJson('/observe?afterSeq=7');assert.deepEqual(observeAfter.body.args,{afterSeq:7});
 const entities=await getJson('/entities?kind=road&limit=5&near=%5B1,2,3%5D');assert.equal(entities.body.method,'entities');assert.deepEqual(entities.body.args,{kind:'road',limit:5,near:[1,2,3]});
 assert.equal((await getJson('/entities/S001')).body.args.id,'S001');
 const select=await(await fetch(base+'/scene/select',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'S001',controlEpoch:1,sceneRevision:'r'})})).json();assert.equal(select.method,'selectEntity');
 const path=await getJson('/path?from=%5B0,0,0%5D&to=%5B10,0,10%5D&clearance=0.34&maxNodes=1234');
 assert.equal(path.status,200);assert.deepEqual(path.body.args,{from:[0,0,0],to:[10,0,10],clearance:0.34,maxNodes:1234});assert.equal(path.body.reachable,true);assert.equal(path.body.path.length,2);
 const partial=await getJson('/path?from=%5B0,0,0%5D&to=%5B999,0,0%5D');assert.equal(partial.status,200);assert.equal(partial.body.ok,false);assert.equal(partial.body.partial,true);assert.equal(partial.body.reason,'unreachable');
 const world=await getJson('/world');assert.equal(world.status,200);assert.equal(world.body.method,'world');assert.deepEqual(world.body.args,{});assert.equal(world.body.schema,'hku-scene/1');
 console.log('PASS /observe?afterSeq passthrough, /entities and /scene/select compat, /path params + partial 200, /world passthrough');
 // --- event ring buffer: push, incremental, dedupe, invalid/oversized rejection ---
 pushEvents([gameEvent(1),gameEvent(2,'command_finished')]);
 const buffered=await waitForEvents(0,2);assert.deepEqual(buffered.events.map(event=>event.seq),[1,2]);assert.equal(buffered.eventSeq,2);assert.equal(buffered.ready,true);
 const incremental=await getJson('/events?afterSeq=1&limit=10');assert.deepEqual(incremental.body.events.map(event=>event.seq),[2]);
 pushEvents([gameEvent(2)]);await sleep(40);
 pushEvents([{seq:50,kind:'bad'}]);await sleep(40);
 pushEvents(Array.from({length:65},(_,index)=>gameEvent(100+index)));await sleep(40);
 const deduped=await getJson('/events?afterSeq=0');assert.deepEqual(deduped.body.events.map(event=>event.seq),[1,2],'duplicate/invalid/oversized pushes must be ignored');
 console.log('PASS event push buffer, afterSeq increment, seq dedupe, invalid and >64-event batch rejection');
 // --- SSE: replay first, then live; format event: campus / id: seq / data: json ---
 sseController=new AbortController();
 const sseResponse=await fetch(base+'/events/stream?afterSeq=1',{signal:sseController.signal});
 assert.equal(sseResponse.status,200);
 assert.match(sseResponse.headers.get('content-type')||'',/text\/event-stream/);assert.equal(sseResponse.headers.get('cache-control'),'no-store');
 const reader=sseResponse.body.getReader(),decoder=new TextDecoder();
 const pump=(async()=>{try{for(;;){const{value,done}=await reader.read();if(done)return;sseBuffer+=decoder.decode(value,{stream:true});for(let i=sseWaiters.length-1;i>=0;i--){const waiter=sseWaiters[i];if(waiter.predicate(sseBuffer)){sseWaiters.splice(i,1);waiter.resolve();}}}}catch(error){if(!sseController.signal.aborted)console.error('SSE read failed:',error.message);}})();void pump;
 await waitSse(text=>text.includes('id: 2'),'replay of seq 2');
 assert.ok(sseBuffer.includes('event: campus'));assert.match(sseBuffer,/data: \{"seq":2,/);
 pushEvents([gameEvent(3)]);await waitSse(text=>text.includes('id: 3'),'live seq 3');
 pushEvents([gameEvent(4,'survey')]);await waitSse(text=>text.includes('id: 4'),'live seq 4');
 const sseData=JSON.parse(/(?:^|\n)data: (.+)/.exec(sseBuffer.slice(sseBuffer.indexOf('id: 4')))[1]);assert.equal(sseData.seq,4);assert.equal(sseData.kind,'survey');
 sseController.abort();
 for(let i=0;i<100;i++){if((await(await fetch(base+'/health')).json()).events.sseClients===0)break;await sleep(20);}
 assert.equal((await getJson('/health')).body.events.sseClients,0,'SSE subscriber must be cleaned up on disconnect');
 console.log('PASS SSE replay (id 2) + live id 3/4 with event/id/data format and disconnect cleanup');
 // --- MCP stdio: 15 tools, resources, prompts, directives translation ---
 mcp=spawn(process.execPath,['scripts/agent-mcp.mjs'],{env:{...process.env,HKU_AGENT_URL:base},stdio:['pipe','pipe','pipe']});
 createInterface({input:mcp.stdout}).on('line',line=>{let msg;try{msg=JSON.parse(line);}catch{mcpBadLines.push(line);return;}const handler=mcpPending.get(msg.id);if(handler){mcpPending.delete(msg.id);handler(msg);}});
 const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter,timer=setTimeout(()=>{mcpPending.delete(id);reject(Error('MCP timeout '+method));},8000);mcpPending.set(id,msg=>{clearTimeout(timer);resolve(msg);});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const callTool=async(name,args={})=>{const response=await rpc('tools/call',{name,arguments:args});assert.ok(response.result,JSON.stringify(response));return{value:JSON.parse(response.result.content[0].text),isError:response.result.isError};};
 const init=await rpc('initialize',{protocolVersion:'2024-11-05'});assert.equal(init.result.serverInfo.name,'hku-campus');
 for(const key of ['tools','resources','prompts'])assert.ok(init.result.capabilities[key],'initialize must declare '+key);
 for(const token of ['campus_world','campus_observe','campus_walk_to','campus_events','campus_release_control'])assert.ok(init.result.instructions.includes(token),'instructions missing '+token);
 const list=await rpc('tools/list');assert.equal(list.result.tools.length,caps.tools.length);
 assert.deepEqual(list.result.tools.map(tool=>tool.name).sort(),caps.tools.map(tool=>tool.name).sort());
 assert.equal((await rpc('resources/list')).result.resources.length,3);
 for(const uri of ['hku://docs/ai-start','hku://docs/interface','hku://docs/native-v2']){const read=await rpc('resources/read',{uri});assert.equal(read.result.contents[0].uri,uri);assert.equal(read.result.contents[0].mimeType,'text/markdown');assert.ok(typeof read.result.contents[0].text==='string'&&read.result.contents[0].text.length>0,'empty resource '+uri);}
 const unknownResource=await rpc('resources/read',{uri:'hku://nope'});assert.equal(unknownResource.error.code,-32602);
 const promptList=await rpc('prompts/list');assert.equal(promptList.result.prompts.length,1);assert.equal(promptList.result.prompts[0].name,'campus-patrol');
 const prompt=await rpc('prompts/get',{name:'campus-patrol'});assert.equal(prompt.result.messages[0].role,'user');
 for(const token of ['campus_world','campus_observe','campus_acquire_control','campus_walk_to','campus_look_at','campus_act','campus_events','campus_release_control'])assert.ok(prompt.result.messages[0].content.text.includes(token),'prompt missing '+token);
 const promptArg=await rpc('prompts/get',{name:'campus-patrol',arguments:{agentId:'verify-agent',targetId:'B04'}});assert.ok(promptArg.result.messages[0].content.text.includes('verify-agent'));assert.ok(promptArg.result.messages[0].content.text.includes('B04'));
 assert.equal((await rpc('prompts/get',{name:'nope'})).error.code,-32602);
 const worldTool=await callTool('campus_world');assert.equal(worldTool.isError,false);assert.equal(worldTool.value.method,'world');
 const pathTool=await callTool('campus_path',{from:[0,0,0],to:[10,0,10],clearance:0.34,maxNodes:1234});assert.deepEqual(pathTool.value.args,{from:[0,0,0],to:[10,0,10],clearance:0.34,maxNodes:1234});
 const eventsTool=await callTool('campus_events',{afterSeq:2,limit:10});assert.deepEqual(eventsTool.value.events.map(event=>event.seq),[3,4]);
 const observeTool=await callTool('campus_observe',{afterSeq:42});assert.equal(observeTool.value.args.afterSeq,42);
 actBodies.length=0;
 const walkDefault=await callTool('campus_walk_to',{commandId:'walk-p',controlEpoch:5,position:[1,2,3],toleranceM:0.5,sprint:true});
 assert.equal(walkDefault.isError,false,JSON.stringify(walkDefault.value));assert.equal(actBodies.length,1);
 assert.deepEqual(actBodies[0],{commandId:'walk-p',controlEpoch:5,durationMs:15000,directive:{type:'walkTo',position:[1,2,3],toleranceM:0.5,sprint:true}});
 const walkEntity=await callTool('campus_walk_to',{commandId:'walk-e',controlEpoch:5,entityId:'S001',durationMs:5000});
 assert.deepEqual(actBodies[1],{commandId:'walk-e',controlEpoch:5,durationMs:5000,directive:{type:'walkTo',entityId:'S001'}});
 assert.equal(walkEntity.isError,false);
 const both=await callTool('campus_walk_to',{commandId:'walk-x',controlEpoch:5,position:[1,2,3],entityId:'S001'});assert.equal(both.isError,true);assert.match(both.value.error,/mutually_exclusive/);
 const neither=await callTool('campus_walk_to',{commandId:'walk-y',controlEpoch:5});assert.equal(neither.isError,true);assert.match(neither.value.error,/position_or_entityId_required/);
 const tooLong=await callTool('campus_walk_to',{commandId:'walk-z',controlEpoch:5,entityId:'S001',durationMs:60000});assert.equal(tooLong.isError,true);assert.match(tooLong.value.error,/invalid_durationMs/);
 assert.equal(actBodies.length,2,'invalid walk_to must not reach /act');
 const lookDefault=await callTool('campus_look_at',{commandId:'look-p',controlEpoch:5,position:[1,2,3],toleranceDeg:2});
 assert.deepEqual(actBodies[2],{commandId:'look-p',controlEpoch:5,durationMs:3000,directive:{type:'lookAt',position:[1,2,3],toleranceDeg:2}});
 assert.equal(lookDefault.isError,false);
 await callTool('campus_look_at',{commandId:'look-e',controlEpoch:5,entityId:'S001'});
 assert.deepEqual(actBodies[3],{commandId:'look-e',controlEpoch:5,durationMs:3000,directive:{type:'lookAt',entityId:'S001'}});
 const act=await callTool('campus_act',{commandId:'act-1',controlEpoch:5,durationMs:300,lookDelta:{yawDeg:5,pitchDeg:0}});assert.equal(act.isError,false);
 assert.deepEqual(actBodies[4],{commandId:'act-1',controlEpoch:5,durationMs:300,lookDelta:{yawDeg:5,pitchDeg:0}},'campus_act body must stay raw v1.3 action');
 assert.deepEqual(mcpBadLines,[],'MCP stdout must contain only JSON-RPC lines');
 console.log('PASS MCP initialize/resources/prompts + walk_to/look_at directive translation (default 15000/3000, exclusivity, invalid args rejected before /act)');
}finally{
 try{sseController?.abort();}catch{}
 socket?.close();mcp?.kill('SIGTERM');server.kill('SIGTERM');
}
