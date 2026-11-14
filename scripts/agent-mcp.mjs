/** Standard MCP stdio (newline-delimited JSON-RPC). stdout is protocol only. */
import {createInterface} from 'node:readline';
import {agentTools,callAgent} from './agent-tools.mjs';
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
const respond=value=>process.stdout.write(JSON.stringify(value)+'\n');
input.on('line',async line=>{
 let msg;try{msg=JSON.parse(line);}catch{respond({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
 if(!msg||typeof msg!=='object'||Array.isArray(msg)){respond({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});return;}
 if(msg.id===undefined)return;
 try{
  let result;
  if(msg.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'hku-campus',version:'1.0.0'},instructions:'Read campus_observe and campus_entities first. Movement requires the user to enable AI. Use returned epoch; do not teleport or bypass collisions.'};
  else if(msg.method==='ping')result={};
  else if(msg.method==='tools/list')result={tools:agentTools.map(({name,description,inputSchema})=>({name,description,inputSchema}))};
  else if(msg.method==='tools/call'){
   let value;try{value=await callAgent(msg.params?.name,msg.params?.arguments??{});}catch(error){value={ok:false,error:error.message,hint:'Start npm run play and open the campus page.'};}
   result=value.ok&&value.dataUrl?{content:[{type:'image',data:value.dataUrl.split(',')[1],mimeType:'image/png'}]}:{content:[{type:'text',text:JSON.stringify(value)}],isError:value.ok===false};
  }else{respond({jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'Method not found'}});return;}
  respond({jsonrpc:'2.0',id:msg.id,result});
 }catch(error){respond({jsonrpc:'2.0',id:msg.id,error:{code:-32603,message:error.message}});}
});
