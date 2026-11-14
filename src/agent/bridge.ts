import type {CampusGame} from '../exploration/game';
/** Real transport; actions are consumed only by the game's fixed-step loop. */
export function connectAgent(getGame:()=>CampusGame,screenshot:()=>string,status:(s:string)=>void,sceneRequest?:(method:string,args:Record<string,unknown>)=>unknown){
 let socket:WebSocket|null=null,lastHeartbeat=0,disposed=false,retry:ReturnType<typeof setTimeout>|undefined;
 const revoke=(reason:string)=>{const g=getGame();if(g.owner||g.armed)g.pause(reason);};
 function connect(claim=false){
  if(disposed)return;clearTimeout(retry);lastHeartbeat=0;
  const previous=socket,ws=new WebSocket(`ws://127.0.0.1:${import.meta.env.VITE_AGENT_PORT||8788}/game`+(claim?'?claim=1':''));socket=ws;previous?.close();
  // A closing old socket must never revoke a newer connection or its authority.
  ws.onopen=()=>{if(socket!==ws)return;lastHeartbeat=Date.now();ws.send(JSON.stringify({type:'ready'}));status('本机 AI 服务：此窗口已连接 · 127.0.0.1:'+ (import.meta.env.VITE_AGENT_PORT||8788));};
  ws.onmessage=e=>{if(socket!==ws)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(msg.type==='heartbeat'){lastHeartbeat=Date.now();ws.send(JSON.stringify({type:'heartbeat'}));return;}
   if(msg.type!=='rpc')return;const g=getGame(),args=msg.args;let result:unknown;
   try{
    if(!Number.isFinite(msg.expiresAt)||Date.now()>msg.expiresAt)result={ok:false,error:'request_expired'};
    else if(msg.method==='observe')result={ok:true,state:g.observe()};
    else if(msg.method==='acquireControl')result=typeof args.agentId==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(args.agentId)?g.acquireControl(args.agentId):{ok:false,error:'invalid_agent_id'};
    else if(msg.method==='act')result=g.act(args);
    else if(msg.method==='stop')result=g.stop(args.controlEpoch);
    else if(msg.method==='releaseControl')result=g.releaseControl(args.controlEpoch);
    else if(msg.method==='command')result=g.records.has(args.commandId)?{ok:true,command:g.records.get(args.commandId)}:{ok:false,error:'unknown_command'};
    else if(['entities','entity','selectEntity'].includes(msg.method)&&sceneRequest)result=sceneRequest(msg.method,args);
    else if(msg.method==='screenshot')result={ok:true,mimeType:'image/png',dataUrl:screenshot()};
    else result={ok:false,error:'unknown_method'};
   }catch{result={ok:false,error:'invalid_request'};}
   if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'result',id:msg.id,result}));
  };
  ws.onerror=()=>{if(socket===ws)status('本机 AI 未连接：运行 npm run agent:server；若其他窗口占用，点击开启 AI 切换。');};
  ws.onclose=e=>{if(socket!==ws)return;socket=null;lastHeartbeat=0;revoke('bridge_disconnected');
   if(e.code===4001){status('另一个校园窗口已接管服务；本窗口已停控。点击开启 AI 可切回。');return;}
   status('本机 AI 未连接：运行 npm run agent:server；若其他窗口占用，点击开启 AI 切换。');if(!disposed)retry=setTimeout(()=>connect(),2000);
  };
 }
 const watchdog=setInterval(()=>{if(lastHeartbeat&&Date.now()-lastHeartbeat>1800){revoke('bridge_timeout');socket?.close();lastHeartbeat=0;}},250);
 connect();return{
  // Only the explicit user enable-AI action calls claim. Background retries never steal control.
  claim(){if(socket?.readyState!==WebSocket.OPEN)connect(true);},
  dispose(){disposed=true;clearTimeout(retry);clearInterval(watchdog);revoke('bridge_disposed');socket?.close();},
 };
}
