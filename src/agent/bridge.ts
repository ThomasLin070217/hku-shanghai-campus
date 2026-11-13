import type {CampusGame} from '../exploration/game';
/** Real transport; actions are queued in CampusGame and consumed by its fixed-step loop. */
export function connectAgent(getGame:()=>CampusGame,screenshot:()=>string,status:(s:string)=>void){
 let socket:WebSocket|null=null,lastHeartbeat=0,disposed=false;
 const revoke=(reason:string)=>{const g=getGame();if(g.owner||g.armed)g.pause(reason);};
 function connect(){if(disposed)return;socket=new WebSocket('ws://127.0.0.1:8787/game');
  socket.onopen=()=>{lastHeartbeat=Date.now();socket!.send(JSON.stringify({type:'ready'}));status('本机 AI 服务：已连接 · 127.0.0.1:8787');};
  socket.onmessage=e=>{let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(msg.type==='heartbeat'){lastHeartbeat=Date.now();socket!.send(JSON.stringify({type:'heartbeat'}));return;}
   if(msg.type!=='rpc')return;const g=getGame(),args=msg.args;let result:unknown;
   try{
    if(Date.now()>msg.expiresAt)result={ok:false,error:'request_expired'};
    else if(msg.method==='observe')result={ok:true,state:g.observe()};
    else if(msg.method==='acquireControl')result=typeof args.agentId==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(args.agentId)?g.acquireControl(args.agentId):{ok:false,error:'invalid_agent_id'};
    else if(msg.method==='act')result=g.act(args);
    else if(msg.method==='stop')result=g.stop(args.controlEpoch);
    else if(msg.method==='releaseControl')result=g.releaseControl(args.controlEpoch);
    else if(msg.method==='command')result=g.records.has(args.commandId)?{ok:true,command:g.records.get(args.commandId)}:{ok:false,error:'unknown_command'};
    else if(msg.method==='screenshot')result={ok:true,mimeType:'image/png',dataUrl:screenshot()};
    else result={ok:false,error:'unknown_method'};
   }catch{result={ok:false,error:'invalid_request'};}
   socket!.send(JSON.stringify({type:'result',id:msg.id,result}));
  };
  socket.onerror=()=>status('本机 AI 服务：未连接（npm run agent:server）');
  socket.onclose=()=>{revoke('bridge_disconnected');status('本机 AI 服务：未连接（npm run agent:server）');if(!disposed)setTimeout(connect,2000);};
 }
 const watchdog=setInterval(()=>{if(lastHeartbeat&&Date.now()-lastHeartbeat>1800){revoke('bridge_timeout');socket?.close();lastHeartbeat=0;}},250);
 connect();return()=>{disposed=true;clearInterval(watchdog);socket?.close();};
}
