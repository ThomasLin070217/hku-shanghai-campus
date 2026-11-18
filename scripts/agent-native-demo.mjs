// Native AI control demo: zero screenshots, zero DOM automation, zero model calls.
// Reads structured state + event stream and drives the game through the same physics as a human.
import {callAgent} from './agent-tools.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.HKU_AGENT_URL||'http://127.0.0.1:8788';
const control=process.argv.includes('--control');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=[],sse=[];
const call=async(name,args={})=>{const result=await callAgent(name,args);log.push({tool:name,args,ok:result.ok,result});if(!result.ok)throw Error(name+': '+JSON.stringify(result));return result;};
const safe=async(name,args={})=>{try{return await callAgent(name,args);}catch(error){return{ok:false,error:error.message};}};
function stream(afterSeq=0){
 const abort=new AbortController(),events=[];
 const task=(async()=>{
  const response=await fetch(`${base}/events/stream?afterSeq=${afterSeq}`,{signal:abort.signal});
  if(!response.ok||!response.body)throw Error('stream status '+response.status);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
   let cut;while((cut=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,cut);buffer=buffer.slice(cut+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(line)try{events.push(JSON.parse(line.slice(6)));}catch{}}}
 })().catch(()=>{});
 return{events,stop(){abort.abort();void task;}};
}
async function waitCommand(commandId,timeoutMs=26000){
 const start=Date.now();let last=null;
 while(Date.now()-start<timeoutMs){const result=await safe('campus_command',{commandId});if(result.ok&&result.command){last=result.command;if(['completed','blocked','interrupted','expired'].includes(last.status))return last;}await sleep(250);}
 return last;
}
const summary={startedAt:new Date().toISOString(),control,screenshotsTaken:0,domAutomation:false,steps:[],sseEvents:0,elapsedMs:0,result:'unknown'};
const started=Date.now();
let epoch;
try{
 const world=await call('campus_world');
 console.log(`world protocol=${world.protocolVersion} revision=${world.revision} buildings=${world.buildings.length} roads=${world.roads.length} areas=${world.areas.length} targets=${world.survey.targets.length}`);
 summary.steps.push({step:'world',protocol:world.protocolVersion,revision:world.revision,bounds:world.bounds});

 const before=await call('campus_observe');
 const s=before.state;
 console.log(`observe frame=${s.frame} eventSeq=${s.eventSeq} aiEnabled=${s.aiEnabled} paused=${s.paused} pos=[${s.player.position.map(v=>v.toFixed(2)).join(',')}]`);
 console.log('perception:',JSON.stringify({ground:s.perception.ground,hud:s.perception.hud,interactables:s.perception.interactables.slice(0,4),probes:s.perception.probes}));
 if(control&&s.paused&&!s.aiEnabled)throw Error('AI 未开启：请在游戏暂停面板点击「开启 AI 控制」，然后重跑 npm run agent:native -- --control');
 summary.steps.push({step:'observe',eventSeq:s.eventSeq,aiEnabled:s.aiEnabled,paused:s.paused,perception:{ground:s.perception.ground,hud:s.perception.hud,interactables:s.perception.interactables.length}});

 const tail=await call('campus_events',{afterSeq:Math.max(0,s.eventSeq-20),limit:20});
 console.log(`events since ${Math.max(0,s.eventSeq-20)}: ${tail.events.map(e=>e.kind).join(',')}`);
 summary.steps.push({step:'events',count:tail.events.length,kinds:[...new Set(tail.events.map(e=>e.kind))]});

 if(!control){summary.result='read_only_ok';console.log('read-only pass complete. Add --control after enabling AI in the page for movement.');}
 else{
  const live=stream(s.eventSeq);
  const grant=await call('campus_acquire_control',{agentId:'native-demo'});epoch=grant.controlEpoch;
  console.log('control epoch',epoch);
  const sign=await call('campus_entity',{id:'S001'});
  const target={position:sign.entity.center};
  const path=await call('campus_path',{from:s.player.position,to:target.position});
  console.log(`path reachable=${path.reachable} partial=${path.partial} points=${path.path.length} length=${path.length.toFixed(1)}m visited=${path.visited}`);
  summary.steps.push({step:'path',reachable:path.reachable,partial:path.partial,length:path.length,visited:path.visited});

  const walkId='native-walk-'+Date.now();
  await call('campus_walk_to',{commandId:walkId,controlEpoch:epoch,entityId:'S001',toleranceM:2.2,durationMs:20000});
  const walk=await waitCommand(walkId);
  console.log(`walkTo S001 → ${walk?.status} directive=${JSON.stringify(walk?.directive)}`);
  summary.steps.push({step:'walkTo',status:walk?.status,directive:walk?.directive});

  const lookId='native-look-'+Date.now();
  await call('campus_look_at',{commandId:lookId,controlEpoch:epoch,entityId:'S001'});
  const look=await waitCommand(lookId,8000);
  console.log(`lookAt S001 → ${look?.status} directive=${JSON.stringify(look?.directive)}`);
  summary.steps.push({step:'lookAt',status:look?.status,directive:look?.directive});

  const approachId='native-approach-'+Date.now();
  await call('campus_walk_to',{commandId:approachId,controlEpoch:epoch,entityId:'record-cds-entry',toleranceM:2.2,durationMs:15000});
  const approach=await waitCommand(approachId,16000);
  console.log(`approach record-cds-entry → ${approach?.status} directive=${JSON.stringify(approach?.directive)}`);
  summary.steps.push({step:'approach',status:approach?.status,directive:approach?.directive});

  const aimId='native-aim-'+Date.now();
  await call('campus_look_at',{commandId:aimId,controlEpoch:epoch,entityId:'record-cds-entry'});
  const aim=await waitCommand(aimId,8000);
  console.log(`lookAt record-cds-entry → ${aim?.status} lookErrorDeg=${aim?.directive?.lookErrorDeg}`);
  summary.steps.push({step:'lookAtRecord',status:aim?.status,lookErrorDeg:aim?.directive?.lookErrorDeg});

  // A throttled background tab can miss a 1 s one-shot action; retry with a fresh commandId (never reuses one).
  let interact=null;
  for(let attempt=0;attempt<3&&!interact?.operation;attempt++){
   const interactId='native-interact-'+Date.now()+'-'+attempt;
   await call('campus_act',{commandId:interactId,controlEpoch:epoch,durationMs:1000,interact:'record-cds-entry'});
   interact=await waitCommand(interactId,6000);
   if(!interact?.operation)await sleep(300);
  }
  console.log(`interact record-cds-entry → ${interact?.status} operation=${JSON.stringify(interact?.operation)}`);
  summary.steps.push({step:'interact',status:interact?.status,operation:interact?.operation});

  await call('campus_stop',{controlEpoch:epoch});
  const after=await call('campus_observe',{afterSeq:s.eventSeq});
  console.log(`after observe moved=${Math.hypot(after.state.player.position[0]-s.player.position[0],after.state.player.position[2]-s.player.position[2]).toFixed(2)}m events=${(after.state.events??[]).length}`);
  summary.steps.push({step:'observeAfter',events:(after.state.events??[]).length});
  await sleep(600);live.stop();summary.sseEvents=live.events.length;
  summary.sseKinds=[...new Set(live.events.map(e=>e.kind))];
  console.log(`SSE streamed ${live.events.length} events during control: ${summary.sseKinds.join(',')}`);
  summary.result='control_ok';
 }
}catch(error){summary.result='error';summary.error=error.message;console.error('FAIL:',error.message);process.exitCode=1;}
finally{
 if(epoch!==undefined){log.push({tool:'campus_release_control',result:await safe('campus_release_control',{controlEpoch:epoch})});console.log('released control');}
 summary.elapsedMs=Date.now()-started;
 mkdirSync('evidence/ai-native',{recursive:true});
 writeFileSync('evidence/ai-native/native-demo.json',JSON.stringify({summary,log},null,2));
 console.log(`\nresult=${summary.result} elapsed=${summary.elapsedMs}ms screenshots=0 log=evidence/ai-native/native-demo.json`);
}
