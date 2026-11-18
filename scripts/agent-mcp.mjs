/** Standard MCP stdio (newline-delimited JSON-RPC). stdout is protocol only. */
import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {agentTools,callAgent} from './agent-tools.mjs';
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
const respond=value=>process.stdout.write(JSON.stringify(value)+'\n');
const rpcError=(code,message)=>{const error=new Error(message);error.rpcCode=code;throw error;};
const INSTRUCTIONS='You drive the HKU Shanghai campus game through structured state, not screenshots. Start with campus_world for context and campus_observe for live state; use campus_events (afterSeq incremental) or GET /events/stream instead of polling. Movement needs the human to enable AI control first: campus_acquire_control, then prefer campus_walk_to / campus_look_at (semantic directives) over hand-made move/lookDelta; long jobs are reported through campus_command and the event stream. Finish with campus_release_control. This server is read/control-only: no file writes, no teleport, no arbitrary code execution.';
const resources=[
 {uri:'hku://docs/ai-start',name:'AI 最短接手指南',description:'团队与 AI 的接手入口：编号、离线查询、在线 AI 工具与边界。',mimeType:'text/markdown',file:'../docs/AI-START.md'},
 {uri:'hku://docs/interface',name:'AI 接口文档',description:'本机 HTTP/WebSocket/MCP 接口、鉴权、动作与事件说明。',mimeType:'text/markdown',file:'../docs/AI-INTERFACE.md'},
 {uri:'hku://docs/native-v2',name:'AI-Native v2 说明',description:'感知、路径、语义指令、事件流与 15 个 MCP 工具的使用说明。',mimeType:'text/markdown',file:'../docs/AI-NATIVE-V2.md'},
];
function readDoc(file){
 try{return readFileSync(new URL(file,import.meta.url),'utf8');}catch{
  return `# 文档暂不可用\n\n仓库中缺少 ${file.replace('../','')}，该文件由 Lead 维护。请改用 hku://docs/ai-start，或在仓库根目录查看 docs/。接口能力可直接读取 GET /capabilities 与 MCP tools/list，不依赖本文档。`;
 }
}
const prompts=[{name:'campus-patrol',description:'一次完整校园巡检的标准调用顺序（world→observe→acquire→walk_to→look_at→act/interact→events→release）。',arguments:[{name:'agentId',description:'控制者 ID，默认 campus-patrol-agent。',required:false},{name:'targetId',description:'巡检目标场景 ID，例如 S001。',required:false}]}];
const promptText=args=>{
 const agentId=/^[a-zA-Z0-9_.:-]{1,80}$/.test(args?.agentId??'')?args.agentId:'campus-patrol-agent';
 const targetId=typeof args?.targetId==='string'&&/^[A-Za-z0-9_.:-]{1,100}$/.test(args.targetId)?args.targetId:'S001';
 return `你是 HKU 上海校园的巡检 Agent。严格按下面顺序调用 MCP 工具，不要用截图或模拟键盘：
1. campus_world：读建筑/道路/区域/地标/巡检目标/控制规则，建立上下文。
2. campus_observe：读玩家、物理、感知（perception）、指令与事件序号（eventSeq）。
3. 确认人类已在页面开启 AI 控制后，campus_acquire_control {"agentId":"${agentId}"}；若返回 ai_not_enabled，停下来请人类开启，不要重试绕过。
4. campus_walk_to {"commandId":"patrol-walk-1","controlEpoch":EPOCH,"entityId":"${targetId}","toleranceM":0.6,"sprint":false}；不要手搓 move 走长距离。
5. campus_look_at {"commandId":"patrol-look-1","controlEpoch":EPOCH,"entityId":"${targetId}","toleranceDeg":3}；到达后对准目标。
6. campus_act / campus_command：只做短程微调或交互（interact/computer/selectHotbar），并用 campus_command 查询 accepted/running/completed/blocked/expired。
7. campus_events {"afterSeq":上次 eventSeq,"limit":100} 或 GET /events/stream?afterSeq=N：事件流优先于轮询；关注 command_finished、survey、discovery、panel、inventory、control_revoked。
8. campus_release_control {"controlEpoch":EPOCH}：结束巡检释放控制权；人类接管后旧 epoch 立即失效，不要复用。
边界：不写文件、不执行任意命令、不传送、不绕过碰撞；失败就如实报告。`;
};
input.on('line',async line=>{
 let msg;try{msg=JSON.parse(line);}catch{respond({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
 if(!msg||typeof msg!=='object'||Array.isArray(msg)){respond({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});return;}
 if(msg.id===undefined)return;
 try{
  let result;
  if(msg.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{},resources:{},prompts:{}},serverInfo:{name:'hku-campus',version:'2.0.0'},instructions:INSTRUCTIONS};
  else if(msg.method==='ping')result={};
  else if(msg.method==='tools/list')result={tools:agentTools.map(({name,description,inputSchema})=>({name,description,inputSchema}))};
  else if(msg.method==='tools/call'){
   let value;try{value=await callAgent(msg.params?.name,msg.params?.arguments??{});}catch(error){value={ok:false,error:error.message,hint:'Start npm run play and open the campus page; enable AI control before movement.'};}
   result=value.ok&&value.dataUrl?{content:[{type:'image',data:value.dataUrl.split(',')[1],mimeType:'image/png'}]}:{content:[{type:'text',text:JSON.stringify(value)}],isError:value.ok===false};
  }else if(msg.method==='resources/list')result={resources:resources.map(({uri,name,description,mimeType})=>({uri,name,description,mimeType}))};
  else if(msg.method==='resources/read'){
   const uri=msg.params?.uri;const resource=resources.find(r=>r.uri===uri);
   if(!resource)rpcError(-32602,'Unknown resource: '+String(uri));
   result={contents:[{uri:resource.uri,mimeType:resource.mimeType,text:readDoc(resource.file)}]};
  }else if(msg.method==='prompts/list')result={prompts};
  else if(msg.method==='prompts/get'){
   const prompt=prompts.find(p=>p.name===msg.params?.name);
   if(!prompt)rpcError(-32602,'Unknown prompt: '+String(msg.params?.name));
   result={description:prompt.description,arguments:prompt.arguments,messages:[{role:'user',content:{type:'text',text:promptText(msg.params?.arguments)}}]};
  }else{respond({jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'Method not found'}});return;}
  respond({jsonrpc:'2.0',id:msg.id,result});
 }catch(error){respond({jsonrpc:'2.0',id:msg.id,error:{code:error.rpcCode||-32603,message:error.message}});}
});
