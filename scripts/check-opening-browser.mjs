/**
 * Stable browser acceptance for the Thomas opening.
 *
 * The two long legs (shuttle → Building 5, Building 5 → Building 6) are walked
 * through CampusGame.step / CharacterPhysics. Dialogue, pickup, incident, MacBook and
 * capture are triggered through the game's own debug hooks so this check cannot fail
 * merely because a headless browser throttles requestAnimationFrame.
 */
import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',PORT=9250,OUT='evidence/opening-browser-check';
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--user-data-dir=/tmp/hku-check-${Date.now()}`,'--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1440,900','--hide-scrollbars','about:blank'],{stdio:'ignore'});
let finished=false;
for(let attempt=0;attempt<120&&!finished;attempt++){
 try{
  const res=await fetch(`http://127.0.0.1:${PORT}/json/list`);if(!res.ok)throw 0;
  const targets=await res.json();const page=targets.find(t=>t.type==='page');if(!page)throw 0;
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.once('open',ok);ws.once('error',no);});
  let id=0;const pending=new Map();const errors=[];
  ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown'){errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);}});
  const send=(method,params={})=>new Promise(ok=>{const i=++id;pending.set(i,ok);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description??r.result.exceptionDetails.text);return r.result?.result?.value;};
  const shot=async name=>{await sleep(250);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(OUT+'/'+name+'.png',Buffer.from(s.result.data,'base64'));};
  const state=()=>ev("(()=>{const s=__CAMPUS.explorer.game.scenario.snapshot();return{stage:s.story.stage,events:s.story.events,invitation:s.story.invitation_read,laptop:s.story.laptop_acquired,alert:s.story.campus_alert_triggered,alertRead:s.story.alert_read,hearts:s.runtime.hearts,catches:s.runtime.catches,curtain:s.runtime.curtain_deployed,chase:s.runtime.robot_chase_started,agent:s.runtime.agent_chat_unlocked,b4:s.runtime.go_to_building4_objective_unlocked,modal:s.modal,paused:__CAMPUS.explorer.game.paused,position:__CAMPUS.explorer.game.body.position.toArray()};})()");
  const click=selector=>ev(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return false;n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;})()`);
  const walk=async(x,z,max=12000)=>{const r=await ev(`(()=>{const g=__CAMPUS.explorer.game;if(g.paused&&!g.panel)g.paused=false;let n=0;while(n++<${max}){if(g.panel||g.paused)break;const dx=${x}-g.body.position.x,dz=${z}-g.body.position.z;if(Math.hypot(dx,dz)<0.34)break;g.yaw=Math.atan2(-dx,-dz);g.human={forward:1,right:0,sprint:false};g.step(1/120);}__CAMPUS.experience.update(1/60);return {n,x:g.body.position.x,y:g.body.position.y,z:g.body.position.z,paused:g.paused,panel:g.panel,modal:g.scenario.snapshot().modal};})()`);return r;};
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5184/'});await sleep(5200);
  await ev("(()=>{const s=document.createElement('style');s.textContent='#pause-panel{display:none!important}';document.head.append(s);})()");
  const trace=[];const mark=async label=>{const s=await state();trace.push({label,...s});console.log(label,s.stage,s.hearts,!!s.curtain);return s;};

  await ev("__CAMPUS.openingDebug.openInvitation()");await sleep(400);await mark('invitation-open');await shot('01-invitation');
  await click('.opening-invite-actions .opening-button--primary');await sleep(300);
  let s=await state();if(!s.invitation)throw Error('invitation_read was not recorded');
  await ev("__CAMPUS.openingDebug.setBusReady();__CAMPUS.openingDebug.exitBus();__CAMPUS.explorer.game.paused=false");await sleep(200);
  s=await mark('invitation-read-exit-bus');if(s.stage!=='to_b5')throw Error('exit_bus did not advance the stage');

  // Physical walk to Building 5.
  for(const [x,z] of [[63.4,30.0],[63.4,28.6],[63.4,27.5],[52,27.8],[52,33.5],[24,33.5],[24,-48],[58,-48],[58,-58],[64,-61]]){const r=await walk(x,z);if(r.panel||r.modal)throw Error('blocked during B5 walk at '+x+','+z+' '+JSON.stringify(r));}
  await mark('walked-to-b5');await shot('02-b5-exterior');
  await ev("__CAMPUS.openingDebug.openStaff()");await sleep(300);await shot('03-staff');
  await click('.opening-dialog--staff .opening-button--primary');await sleep(300);
  await ev("__CAMPUS.openingDebug.acceptErrand()");s=await mark('staff-task');if(s.stage!=='to_b6')throw Error('errand did not advance');

  // Physical walk to Building 6.
  for(const [x,z] of [[58,-59],[58,-48],[24,-48],[18,-48],[18,-26],[4,-26],[4,-52.2],[4,-58],[7.3,-56.9]]){const r=await walk(x,z);if(r.panel||r.modal)throw Error('blocked during B6 walk at '+x+','+z+' '+JSON.stringify(r));}
  await mark('walked-to-b6');
  await ev("__CAMPUS.openingDebug.takeLaptop()");await sleep(300);s=await mark('laptop');if(!s.laptop||s.stage!=='return_b5')throw Error('laptop pickup failed');
  await shot('04-laptop');

  // Incident: real tick clock + render-clock curtain animation.
  await ev("(()=>{const g=__CAMPUS.explorer.game;g.paused=false;for(let i=0;i<600&&!g.scenario.snapshot().runtime.curtain_deployed;i++)g.step(1/120);for(let i=0;i<340;i++)__CAMPUS.experience.update(1/60);})()");await sleep(300);
  s=await mark('curtain');if(!s.curtain)throw Error('curtain did not deploy after the pickup');await shot('05-curtain');

  await ev("__CAMPUS.openingDebug.reachB5();__CAMPUS.experience.update(1/60)");s=await mark('incident-hall');if(s.stage!=='incident')throw Error('reaching B5 did not fire the incident');await shot('06-empty-hall');

  await ev("__CAMPUS.explorer.game.paused=false;__CAMPUS.openingDebug.openComputer('tasks')");await sleep(500);await mark('mac-alert');await shot('07-mac-alert');
  await click('.opening-mac-alertprimary');await sleep(500);s=await mark('agent-unlocked');if(!s.agent||!s.b4)throw Error('agent did not unlock');
  await shot('08-mac-agent');
  await ev("(()=>{const i=document.querySelector('[data-role=agent-input]');if(!i)throw Error('no agent input');i.value='How do I reach Building 4?';document.querySelector('[data-role=agent-send]').click();})()");
  let reply='';for(let i=0;i<30&&!reply;i++){await sleep(250);reply=await ev("(()=>{const m=[...document.querySelectorAll('.opening-mac-msgbubble')];return m.length?m[m.length-1].textContent:'';})()");}
  await mark('agent-reply');await shot('09-agent-chat');
  if(!/Building 4|4 号楼|central walk|中央/i.test(reply))throw Error('agent reply did not guide to Building 4: '+reply.slice(0,80));
  await click('.opening-mac-closehint');await sleep(300);await ev("__CAMPUS.explorer.game.paused=false");

  // Capture and recovery (same logic used by the robot units).
  await ev("__CAMPUS.openingDebug.setHearts(4);__CAMPUS.openingDebug.catchNow();__CAMPUS.experience.update(1/60)");await sleep(500);s=await mark('caught');if(s.hearts!==2||s.modal!=='caught')throw Error('capture did not deduct 2 hearts');await shot('10-caught');
  await click('.opening-caught-actions .opening-button--primary');await sleep(400);s=await mark('recovered');if(s.hearts!==10||s.modal!==null)throw Error('checkpoint recovery did not restore hearts');
  await ev("__CAMPUS.openingDebug.arriveB4();__CAMPUS.experience.update(1/60)");await sleep(400);s=await mark('complete');if(s.stage!=='complete')throw Error('handoff did not complete');await shot('11-complete');
  const expected=['invitation_read','opening.bus_exited','opening.laptop_requested','laptop_acquired','campus_alert_triggered','opening.alert_acknowledged','opening.building4_reached'];
  if(JSON.stringify(s.events)!==JSON.stringify(expected))throw Error('story log mismatch: '+JSON.stringify(s.events));
  const result={generated:new Date().toISOString(),passed:true,errors,trace,final:s};
  fs.writeFileSync(OUT+'/trace.json',JSON.stringify(result,null,2));
  console.log('PASS browser opening flow',trace.length,'marks; errors',errors.length);
  ws.close();child.kill('SIGTERM');finished=true;
 }catch(e){console.log('attempt',attempt,'failed',e.message??e);}await sleep(250);
}
if(!finished)process.exitCode=1;
