import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import {WebSocket} from 'ws';
const port=18787,base=`http://127.0.0.1:${port}`,sockets=[],results=[];
const server=spawn(process.execPath,['scripts/agent-server.mjs'],{env:{...process.env,HKU_AGENT_PORT:String(port)},stdio:['ignore','pipe','pipe']});
const api=async()=>{const r=await fetch(base+'/observe');return r.json();};
let silence=false;
async function connect(name,claim=false){const ws=new WebSocket(`ws://127.0.0.1:${port}/game${claim?'?claim=1':''}`,{origin:'http://127.0.0.1:5174'});sockets.push(ws);ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='heartbeat')ws.send(JSON.stringify({type:'heartbeat'}));if(m.type==='rpc'&&!(name==='first'&&silence))ws.send(JSON.stringify({type:'result',id:m.id,result:{ok:true,name}}));});await once(ws,'open');ws.send(JSON.stringify({type:'ready'}));return ws;}
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('test server exited');}),new Promise((_,reject)=>setTimeout(()=>reject(Error('listen timeout')),4000).unref())]);
 assert.equal((await api()).error,'not_ready');results.push('not_ready without a browser');
 const first=await connect('first');assert.equal((await api()).name,'first');
 const unwanted=new WebSocket(`ws://127.0.0.1:${port}/game`,{origin:'http://127.0.0.1:5174'});sockets.push(unwanted);const rejected=await once(unwanted,'error');assert.match(rejected[0].message,/409/);results.push('background connection cannot steal the active game');
 silence=true;const pending=api();await once(first,'message');
 const closed=once(first,'close');const second=await connect('second',true);assert.equal((await closed)[0],4001);assert.equal((await pending).error,'game_replaced');assert.equal((await api()).name,'second');results.push('explicit claim closes old game and rejects its in-flight RPC');
 await once(second,'message');assert.equal((await api()).name,'second');results.push('old close event cannot clear replacement readiness or pending requests');
 console.log('PASS',results);fs.mkdirSync('assets/open-source-v6',{recursive:true});fs.writeFileSync('assets/open-source-v6/transport-checks.json',JSON.stringify({date:new Date().toISOString(),results},null,2));
}finally{for(const ws of sockets)if(ws.readyState<2)ws.close();server.kill('SIGTERM');}
