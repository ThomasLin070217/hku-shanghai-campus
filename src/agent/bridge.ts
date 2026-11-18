import type {CampusGame} from '../exploration/game';
import {findPath,type PathOptions,type PathResult} from '../exploration/pathfind';
import type {GameEvent} from './protocol';
/** Real transport; actions are consumed only by the game's fixed-step loop. */
export function connectAgent(getGame:()=>CampusGame,screenshot:()=>string,status:(s:string)=>void,sceneRequest?:(method:string,args:Record<string,unknown>)=>unknown){
 let socket:WebSocket|null=null,lastHeartbeat=0,disposed=false,retry:ReturnType<typeof setTimeout>|undefined,queue:GameEvent[]=[];
 // The browser owns the simulation; state changes are pushed instead of replayed from the screen.
 const pump=(events:GameEvent[])=>{if(queue.length>256)queue=queue.slice(-256);queue.push(...events);};
 const detach=()=>{const g=getGame();if(g.eventSink===pump)g.eventSink=null;};
 const flush=setInterval(()=>{if(!socket||socket.readyState!==WebSocket.OPEN||!queue.length)return;const batch=queue.splice(0,64);socket.send(JSON.stringify({type:'events',events:batch}));},50);
 const revoke=(reason:string)=>{const g=getGame();if(g.owner||g.armed)g.pause(reason);};
 function pathResult(args:Record<string,unknown>):PathResult|{ok:false;error:string}{
  const {from,to}=args;
  if(!Array.isArray(from)||!Array.isArray(to)||from.length!==3||to.length!==3||!from.every(Number.isFinite)||!to.every(Number.isFinite))return{ok:false,error:'invalid_path_query'};
  const g=getGame(),options:PathOptions={};
  if(typeof args.clearance==='number')options.clearance=args.clearance;
  if(typeof args.maxNodes==='number')options.maxNodes=args.maxNodes;
  return findPath(g.body.world,from as number[],to as number[],options);
 }
 function connect(claim=false){
  if(disposed)return;clearTimeout(retry);lastHeartbeat=0;
  const previous=socket,ws=new WebSocket(`ws://127.0.0.1:${import.meta.env.VITE_AGENT_PORT||8788}/game`+(claim?'?claim=1':''));socket=ws;previous?.close();
  // A closing old socket must never revoke a newer connection or its authority.
  ws.onopen=()=>{if(socket!==ws)return;lastHeartbeat=Date.now();ws.send(JSON.stringify({type:'ready'}));getGame().eventSink=pump;status('本机 AI 服务：此窗口已连接 · 127.0.0.1:'+ (import.meta.env.VITE_AGENT_PORT||8788));};
  ws.onmessage=e=>{if(socket!==ws)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(msg.type==='heartbeat'){lastHeartbeat=Date.now();ws.send(JSON.stringify({type:'heartbeat'}));return;}
   if(msg.type!=='rpc')return;const g=getGame(),args=msg.args;let result:unknown;
   try{
    if(!Number.isFinite(msg.expiresAt)||Date.now()>msg.expiresAt)result={ok:false,error:'request_expired'};
    else if(msg.method==='observe')result={ok:true,state:g.observe(Date.now(),typeof args?.afterSeq==='number'?args.afterSeq:undefined)};
    else if(msg.method==='acquireControl')result=typeof args.agentId==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(args.agentId)?g.acquireControl(args.agentId):{ok:false,error:'invalid_agent_id'};
    else if(msg.method==='act')result=g.act(args);
    else if(msg.method==='stop')result=g.stop(args.controlEpoch);
    else if(msg.method==='releaseControl')result=g.releaseControl(args.controlEpoch);
    else if(msg.method==='command')result=g.records.has(args.commandId)?{ok:true,command:g.records.get(args.commandId)}:{ok:false,error:'unknown_command'};
    else if(msg.method==='path')result=pathResult(args);
    else if(['entities','entity','selectEntity','world'].includes(msg.method)&&sceneRequest)result=sceneRequest(msg.method,args);
    else if(msg.method==='screenshot')result={ok:true,mimeType:'image/png',dataUrl:screenshot()};
    else result={ok:false,error:'unknown_method'};
   }catch{result={ok:false,error:'invalid_request'};}
   if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'result',id:msg.id,result}));
  };
  ws.onerror=()=>{if(socket===ws)status('本机 AI 未连接：运行 npm run agent:server；若其他窗口占用，点击开启 AI 切换。');};
  ws.onclose=e=>{if(socket!==ws)return;socket=null;lastHeartbeat=0;detach();revoke('bridge_disconnected');
   if(e.code===4001){status('另一个校园窗口已接管服务；本窗口已停控。点击开启 AI 可切回。');return;}
   status('本机 AI 未连接：运行 npm run agent:server；若其他窗口占用，点击开启 AI 切换。');if(!disposed)retry=setTimeout(()=>connect(),2000);
  };
 }
 const watchdog=setInterval(()=>{if(lastHeartbeat&&Date.now()-lastHeartbeat>1800){revoke('bridge_timeout');socket?.close();lastHeartbeat=0;}},250);
 connect();return{
  // Only the explicit user enable-AI action calls claim. Background retries never steal control.
  claim(){if(socket?.readyState!==WebSocket.OPEN)connect(true);},
  dispose(){disposed=true;clearTimeout(retry);clearInterval(watchdog);clearInterval(flush);detach();revoke('bridge_disposed');socket?.close();},
 };
}
