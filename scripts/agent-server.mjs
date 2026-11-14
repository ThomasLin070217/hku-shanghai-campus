import http from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
const port=Number(process.env.HKU_AGENT_PORT||8788),pending=new Map();let game=null,lastSeen=0;
const allowed=new Set(['http://localhost:5184','http://127.0.0.1:5184','http://localhost:5174','http://127.0.0.1:5174','http://localhost:4174','http://127.0.0.1:4174']);
const ready=()=>game?.readyState===WebSocket.OPEN&&Date.now()-lastSeen<2000;
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
function rpc(method,args){return new Promise(resolve=>{if(!ready())return resolve({ok:false,error:'not_ready'});const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);resolve({ok:false,error:'game_timeout'});},2500);pending.set(id,{resolve,timer});game.send(JSON.stringify({type:'rpc',id,method,args,expiresAt:Date.now()+2000}));});}
const server=http.createServer(async(req,res)=>{
 if(req.headers.origin&&!allowed.has(req.headers.origin))return send(res,403,{ok:false,error:'origin_rejected'});
 const host=req.headers.host?.split(':')[0];if(!['127.0.0.1','localhost'].includes(host))return send(res,403,{ok:false,error:'host_rejected'});
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&path==='/health')return send(res,200,{ok:true,ready:ready(),protocolVersion:'hku-campus/1.2',listen:'127.0.0.1'});
 let method,args={};
 if(req.method==='GET'&&path==='/observe')method='observe';
 else if(req.method==='GET'&&path.startsWith('/commands/')){method='command';args={commandId:decodeURIComponent(path.slice(10))};}
 else if(req.method==='POST'&&['/acquireControl','/act','/stop','/releaseControl','/screenshot'].includes(path)){
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{ok:false,error:'json_required'});
  let body='';try{for await(const chunk of req){body+=chunk;if(body.length>16384)return send(res,413,{ok:false,error:'body_too_large'});}args=JSON.parse(body||'{}');if(!args||typeof args!=='object'||Array.isArray(args))throw Error();}catch{return send(res,400,{ok:false,error:'invalid_json'});}method=path.slice(1);
 }else return send(res,404,{ok:false,error:'not_found'});
 const result=await rpc(method,args);send(res,result.error==='not_ready'?503:result.ok===false?409:200,result);
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
wss.on('connection',ws=>{game=ws;lastSeen=0;ws.on('message',raw=>{if(game!==ws)return;let message;try{message=JSON.parse(raw.toString());}catch{return;}if(message.type==='ready'||message.type==='heartbeat')lastSeen=Date.now();if(message.type==='result'){const p=pending.get(message.id);if(p){clearTimeout(p.timer);pending.delete(message.id);p.resolve(message.result);}}});ws.on('close',()=>{if(game!==ws)return;game=null;lastSeen=0;for(const [id,p]of pending){clearTimeout(p.timer);p.resolve({ok:false,error:'not_ready'});pending.delete(id);}});});
const pulse=setInterval(()=>{if(game?.readyState===WebSocket.OPEN){game.send(JSON.stringify({type:'heartbeat'}));if(lastSeen&&Date.now()-lastSeen>2500)game.terminate();}},400);
server.listen(port,'127.0.0.1',()=>console.log(`HKU Agent API http://127.0.0.1:${port} (waiting for game)`));
function close(){clearInterval(pulse);game?.close();wss.close();server.close(()=>process.exit());setTimeout(()=>process.exit(),500).unref();}process.on('SIGTERM',close);process.on('SIGINT',close);
