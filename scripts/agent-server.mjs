import {capabilities,protocolVersion} from './agent-tools.mjs';
import http from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
const port=Number(process.env.HKU_AGENT_PORT||8788),pending=new Map();let game=null,lastSeen=0;
const allowed=new Set(['http://localhost:5184','http://127.0.0.1:5184','http://localhost:5174','http://127.0.0.1:5174','http://localhost:4174','http://127.0.0.1:4174']);
const ready=()=>game?.readyState===WebSocket.OPEN&&Date.now()-lastSeen<2000;
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
function rpc(method,args){return new Promise(resolve=>{if(!ready())return resolve({ok:false,error:'not_ready'});const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);resolve({ok:false,error:'game_timeout'});},2500);pending.set(id,{resolve,timer});game.send(JSON.stringify({type:'rpc',id,method,args,expiresAt:Date.now()+2000}));});}
// v2 event stream: browser pushes {type:'events',events:[GameEvent[]]} over the game socket; ring buffer + SSE fan-out. Read-only, never accepts writes.
const EVENT_BUFFER_LIMIT=2048,EVENT_PUSH_LIMIT=64,SSE_HEARTBEAT_MS=10000;
const events=[],eventSeqs=new Set(),subscribers=new Set();let eventSeq=0;
const sseFrame=event=>`event: campus\nid: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`;
function pushEvent(event){if(eventSeqs.has(event.seq))return false;events.push(event);eventSeqs.add(event.seq);if(event.seq>eventSeq)eventSeq=event.seq;while(events.length>EVENT_BUFFER_LIMIT)eventSeqs.delete(events.shift().seq);return true;}
function broadcast(event){const frame=sseFrame(event);for(const res of subscribers){try{res.write(frame);}catch{subscribers.delete(res);}}}
function validEvent(value){return!!value&&typeof value==='object'&&!Array.isArray(value)&&Number.isSafeInteger(value.seq)&&value.seq>=0&&Number.isSafeInteger(value.frame)&&value.frame>=0&&Number.isFinite(value.timeMs)&&typeof value.kind==='string'&&value.kind.length>0;}
function ingest(list){
 if(!Array.isArray(list)||list.length>EVENT_PUSH_LIMIT)return 0;
 let accepted=0;
 for(const raw of list){if(!validEvent(raw))continue;const event={...raw,message:typeof raw.message==='string'?raw.message:''};if(pushEvent(event)){broadcast(event);accepted++;}}
 return accepted;
}
const parseSeq=(raw,{min=0,fallback=null}={})=>{if(raw===null||raw===undefined||raw==='')return fallback;const value=Number(raw);return Number.isSafeInteger(value)&&value>=min?value:NaN;};
const parseVec=raw=>{try{const value=JSON.parse(raw);return Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?value:null;}catch{return null;}};
const statusFor=result=>result?.error==='not_ready'||result?.error==='game_timeout'?503:result?.ok===false&&typeof result?.error==='string'?409:200;
const server=http.createServer(async(req,res)=>{
 if(req.headers.origin&&!allowed.has(req.headers.origin))return send(res,403,{ok:false,error:'origin_rejected'});
 const host=req.headers.host?.split(':')[0];if(!['127.0.0.1','localhost'].includes(host))return send(res,403,{ok:false,error:'host_rejected'});
 let url;try{url=new URL(req.url,'http://localhost');}catch{return send(res,400,{ok:false,error:'invalid_url'});}const path=url.pathname;
 if(req.method==='GET'&&path==='/health')return send(res,200,{ok:true,ready:ready(),protocolVersion,listen:'127.0.0.1',events:{buffered:events.length,lastSeq:eventSeq,sseClients:subscribers.size}});
 if(req.method==='GET'&&path==='/capabilities')return send(res,200,capabilities(ready()));
 // Snapshot endpoint: always a valid snapshot, empty while no game is connected. never 503.
 if(req.method==='GET'&&path==='/events'){
  let afterSeq=0,limit=100;
  if(url.searchParams.has('afterSeq')){const value=parseSeq(url.searchParams.get('afterSeq'));if(Number.isNaN(value))return send(res,400,{ok:false,error:'invalid_query'});afterSeq=value;}
  if(url.searchParams.has('limit')){const value=parseSeq(url.searchParams.get('limit'),{min:1});if(Number.isNaN(value))return send(res,400,{ok:false,error:'invalid_query'});limit=Math.min(100,value);}
  const connected=ready(),list=connected?events.filter(event=>event.seq>afterSeq).slice(0,limit):[];
  return send(res,200,{ok:true,ready:connected,afterSeq,eventSeq:connected?eventSeq:0,limit,count:list.length,events:list});
 }
 // SSE: replay buffered events with seq > afterSeq, then live broadcast; 10 s comment heartbeat; cleanup on disconnect.
 if(req.method==='GET'&&path==='/events/stream'){
  let afterSeq=parseSeq(url.searchParams.get('afterSeq'),{fallback:parseSeq(req.headers['last-event-id'],{fallback:0})});
  if(Number.isNaN(afterSeq))return send(res,400,{ok:false,error:'invalid_query'});
  res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','connection':'keep-alive','x-accel-buffering':'no','x-content-type-options':'nosniff'});
  for(const event of events)if(event.seq>afterSeq)res.write(sseFrame(event));
  subscribers.add(res);
  let closed=false;const cleanup=()=>{if(closed)return;closed=true;subscribers.delete(res);try{res.end();}catch{}};
  req.on('close',cleanup);req.on('error',cleanup);res.on('close',cleanup);res.on('error',cleanup);
  return;
 }
 if(req.method==='GET'&&path==='/path'){
  const from=parseVec(url.searchParams.get('from')),to=parseVec(url.searchParams.get('to'));
  if(!from)return send(res,400,{ok:false,error:'invalid_from'});
  if(!to)return send(res,400,{ok:false,error:'invalid_to'});
  const args={from,to};
  if(url.searchParams.has('clearance')){const value=Number(url.searchParams.get('clearance'));if(!Number.isFinite(value)||value<0||value>5)return send(res,400,{ok:false,error:'invalid_clearance'});args.clearance=value;}
  if(url.searchParams.has('maxNodes')){const value=parseSeq(url.searchParams.get('maxNodes'),{min:1});if(Number.isNaN(value)||value>1000000)return send(res,400,{ok:false,error:'invalid_maxNodes'});args.maxNodes=value;}
  const result=await rpc('path',args);return send(res,statusFor(result),result);
 }
 if(req.method==='GET'&&path==='/world'){const result=await rpc('world',{});return send(res,statusFor(result),result);}
 let method,args={};
 if(req.method==='GET'&&path==='/observe'){
  if(url.searchParams.has('afterSeq')){const value=parseSeq(url.searchParams.get('afterSeq'));if(Number.isNaN(value))return send(res,400,{ok:false,error:'invalid_query'});args.afterSeq=value;}
  method='observe';
 }
 else if(req.method==='GET'&&path==='/entities'){method='entities';try{for(const [key,value] of url.searchParams){if(['offset','limit','radius'].includes(key))args[key]=Number(value);else if(key==='near')args[key]=JSON.parse(value);else args[key]=value;}}catch{return send(res,400,{ok:false,error:'invalid_query'});}}
 else if(req.method==='GET'&&path.startsWith('/entities/')){method='entity';try{args={id:decodeURIComponent(path.slice(10))};}catch{return send(res,400,{ok:false,error:'invalid_entity_id'});}}
 else if(req.method==='GET'&&path.startsWith('/commands/')){method='command';try{args={commandId:decodeURIComponent(path.slice(10))};}catch{return send(res,400,{ok:false,error:'invalid_command_id'});}}
 else if(req.method==='POST'&&['/acquireControl','/act','/stop','/releaseControl','/screenshot','/scene/select'].includes(path)){
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{ok:false,error:'json_required'});
  let body='';try{for await(const chunk of req){body+=chunk;if(body.length>16384)return send(res,413,{ok:false,error:'body_too_large'});}args=JSON.parse(body||'{}');if(!args||typeof args!=='object'||Array.isArray(args))throw Error();}catch{return send(res,400,{ok:false,error:'invalid_json'});}method=path==='/scene/select'?'selectEntity':path.slice(1);
 }else return send(res,404,{ok:false,error:'not_found'});
 const result=await rpc(method,args);send(res,statusFor(result),result);
});
const wss=new WebSocketServer({noServer:true,maxPayload:12*1024*1024});
server.on('upgrade',(req,socket,head)=>{
 let url;try{url=new URL(req.url,'http://localhost');}catch{socket.destroy();return;}
 if(url.pathname!=='/game'||!allowed.has(req.headers.origin)||!['127.0.0.1','localhost'].includes(req.headers.host?.split(':')[0])){socket.destroy();return;}
 if(game?.readyState===WebSocket.OPEN){
  if(url.searchParams.get('claim')!=='1'){socket.write('HTTP/1.1 409 Conflict\r\n\r\n');socket.destroy();return;}
  const previous=game;game=null;lastSeen=0;
  for(const [id,p] of pending){clearTimeout(p.timer);p.resolve({ok:false,error:'game_replaced'});pending.delete(id);}
  previous.close(4001,'user_selected_another_game');
 }
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
wss.on('connection',ws=>{game=ws;lastSeen=0;
 // A fresh game connection is a fresh simulation session: event seq restarts at 1, so old dedupe state must go.
 events.length=0;eventSeqs.clear();eventSeq=0;ws.on('message',raw=>{if(game!==ws)return;let message;try{message=JSON.parse(raw.toString());}catch{return;}if(message.type==='ready'||message.type==='heartbeat')lastSeen=Date.now();if(message.type==='events'){lastSeen=Date.now();ingest(message.events);}if(message.type==='result'){const p=pending.get(message.id);if(p){clearTimeout(p.timer);pending.delete(message.id);p.resolve(message.result);}}});ws.on('close',()=>{if(game!==ws)return;game=null;lastSeen=0;for(const [id,p]of pending){clearTimeout(p.timer);p.resolve({ok:false,error:'not_ready'});pending.delete(id);}});});
const pulse=setInterval(()=>{if(game?.readyState===WebSocket.OPEN){game.send(JSON.stringify({type:'heartbeat'}));if(lastSeen&&Date.now()-lastSeen>2500)game.terminate();}},400);
const ssePulse=setInterval(()=>{for(const res of subscribers){try{res.write(': ping\n\n');}catch{subscribers.delete(res);}}},SSE_HEARTBEAT_MS);
server.listen(port,'127.0.0.1',()=>console.log(`HKU Agent API http://127.0.0.1:${port} (waiting for game)`));
function close(){clearInterval(pulse);clearInterval(ssePulse);for(const res of subscribers){try{res.end();}catch{}}subscribers.clear();game?.close();wss.close();server.close(()=>process.exit());setTimeout(()=>process.exit(),500).unref();}process.on('SIGTERM',close);process.on('SIGINT',close);
