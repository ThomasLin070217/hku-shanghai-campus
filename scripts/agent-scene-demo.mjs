// Real browser RPC, no DOM automation, no coordinate writes, no paid model.
import {callAgent} from './agent-tools.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const log=[];
const call=async(name,args={})=>{const r=await callAgent(name,args);log.push({tool:name,args,result:r});if(!r.ok)throw Error(JSON.stringify(r));return r;};
let epoch;
try{
 const roads=await call('campus_entities',{kind:'road',limit:20});
 const sign=await call('campus_entity',{id:'S001'});
 console.log(`Found ${roads.total} roads; S001 → ${sign.entity.sourceFile}`);
 if(process.argv.includes('--control')){
  const state=await call('campus_observe');if(!state.state.aiEnabled)throw Error('Click 开启 AI 控制 in the game before this control demo.');
  const grant=await call('campus_acquire_control',{agentId:'scene-demo'});epoch=grant.controlEpoch;
  await call('campus_select_entity',{id:'S001',controlEpoch:epoch,sceneRevision:sign.revision});
  const commandId='scene-demo-'+Date.now();await call('campus_act',{commandId,controlEpoch:epoch,durationMs:500,lookDelta:{yawDeg:15,pitchDeg:0},move:{forward:.4,right:0}});await sleep(650);
  const result=await call('campus_command',{commandId});if(!['completed','blocked'].includes(result.command.status))throw Error('Unexpected command status: '+result.command.status);
  await call('campus_stop',{controlEpoch:epoch});await call('campus_observe');
 }
}finally{if(epoch!==undefined)log.push({tool:'campus_release_control',result:await callAgent('campus_release_control',{controlEpoch:epoch})});console.log(JSON.stringify(log,null,2));}
