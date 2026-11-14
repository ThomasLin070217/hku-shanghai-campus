import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {WebSocket} from 'ws';
const port=18789,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/agent-server.mjs'],{env:{...process.env,HKU_AGENT_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let socket,mcp;const waiting=new Map();let counter=0;
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('server exited');}),new Promise((_,reject)=>setTimeout(()=>reject(Error('listen timeout')),4000).unref())]);
 const caps=await(await fetch(base+'/capabilities')).json();assert.equal(caps.protocolVersion,'hku-campus/1.3');assert.equal(caps.ready,false);assert.equal(caps.tools.length,10);
 assert.equal((await fetch(base+'/entities')).status,503);assert.equal((await fetch(base+'/entities/%zz')).status,400);assert.equal((await fetch(base+'/commands/%zz')).status,400);
 socket=new WebSocket(`ws://127.0.0.1:${port}/game`,{origin:'http://127.0.0.1:5184'});socket.on('message',raw=>{const msg=JSON.parse(raw);if(msg.type==='heartbeat')socket.send(JSON.stringify({type:'heartbeat'}));if(msg.type==='rpc')socket.send(JSON.stringify({type:'result',id:msg.id,result:{ok:true,method:msg.method,args:msg.args}}));});await once(socket,'open');socket.send(JSON.stringify({type:'ready'}));
 const q=await(await fetch(base+'/entities?kind=road&limit=5&near=%5B1,2,3%5D')).json();assert.equal(q.method,'entities');assert.deepEqual(q.args,{kind:'road',limit:5,near:[1,2,3]});assert.equal((await(await fetch(base+'/entities/S001')).json()).args.id,'S001');
 mcp=spawn(process.execPath,['scripts/agent-mcp.mjs'],{env:{...process.env,HKU_AGENT_URL:base},stdio:['pipe','pipe','pipe']});createInterface({input:mcp.stdout}).on('line',line=>{const msg=JSON.parse(line);waiting.get(msg.id)?.(msg);waiting.delete(msg.id);});
 const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter,timer=setTimeout(()=>reject(Error('MCP timeout')),6000);waiting.set(id,v=>{clearTimeout(timer);resolve(v);});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 assert.equal((await rpc('initialize',{protocolVersion:'2024-11-05'})).result.serverInfo.name,'hku-campus');assert.equal((await rpc('tools/list')).result.tools.length,10);
 const response=await rpc('tools/call',{name:'campus_entities',arguments:{kind:'road',limit:5}});assert.equal(JSON.parse(response.result.content[0].text).method,'entities');
 const pick=await rpc('tools/call',{name:'campus_select_entity',arguments:{id:'S001',controlEpoch:123,sceneRevision:'a'}});assert.equal(JSON.parse(pick.result.content[0].text).method,'selectEntity');
 console.log('PASS HTTP discovery/not_ready/validation, entity RPC transport, MCP initialize/list/call through HTTP and WebSocket');
}finally{socket?.close();mcp?.kill('SIGTERM');server.kill('SIGTERM');}
