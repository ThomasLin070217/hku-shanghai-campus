/**
 * Fast browser flow check for the Thomas opening.
 *
 * State beats use the game's debug hooks (the same transition/capture functions the
 * normal triggers call). The long walking legs are covered by the offline integration
 * check (scripts/check-opening-integration.ts).
 */
import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',PORT=9260,OUT='evidence/opening-flow-20261119';
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--user-data-dir=/tmp/hku-flow-${Date.now()}`,'--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1440,900','--hide-scrollbars','about:blank'],{stdio:'ignore'});
let finished=false;
for(let attempt=0;attempt<80&&!finished;attempt++){
 try{
  const res=await fetch(`http://127.0.0.1:${PORT}/json/list`);if(!res.ok)throw 0;const targets=await res.json();const page=targets.find(t=>t.type==='page');if(!page)throw 0;
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.once('open',ok);ws.once('error',no);});
  let id=0;const pending=new Map();const errors=[];
  ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown'){errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);}});
  const send=(method,params={})=>new Promise(ok=>{const i=++id;pending.set(i,ok);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description??r.result.exceptionDetails.text);return r.result?.result?.value;};
  const shot=async name=>{await sleep(300);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(OUT+'/'+name+'.png',Buffer.from(s.result.data,'base64'));};
  const state=()=>ev("(()=>{const s=__CAMPUS.explorer.game.scenario.snapshot();return{stage:s.story.stage,events:s.story.events,invitation:s.story.invitation_read,laptop:s.story.laptop_acquired,alert:s.story.campus_alert_triggered,alertRead:s.story.alert_read,hearts:s.runtime.hearts,catches:s.runtime.catches,curtain:s.runtime.curtain_deployed,chase:s.runtime.robot_chase_started,agent:s.runtime.agent_chat_unlocked,b4:s.runtime.go_to_building4_objective_unlocked,modal:s.modal,position:__CAMPUS.explorer.game.body.position.toArray()};})()");
  const click=s=>ev(`(()=>{const n=document.querySelector(${JSON.stringify(s)});if(!n)return false;n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;})()`);
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5184/'});await sleep(5200);
  await ev("(()=>{const s=document.createElement('style');s.textContent='#pause-panel{display:none!important}';document.head.append(s);})()");
  const trace=[];const mark=async label=>{const s=await state();trace.push({label,...s});console.log(label,s.stage,s.hearts,s.curtain);return s;};

  await ev("__CAMPUS.openingDebug.openInvitation()");await sleep(400);await mark('invitation-open');await shot('01-invitation');
  await click('.opening-invite-actions .opening-button--primary');await sleep(300);let s=await mark('invitation-read');if(!s.invitation)throw Error('invitation_read missing');
  await ev("__CAMPUS.openingDebug.setBusReady();__CAMPUS.openingDebug.exitBus()");s=await mark('exit-bus');if(s.stage!=='to_b5')throw Error('exit_bus missing');
  await ev("__CAMPUS.openingDebug.openStaff()");await sleep(300);await shot('02-staff');await ev("__CAMPUS.openingDebug.acceptErrand()");s=await mark('staff');if(s.stage!=='to_b6')throw Error('errand missing');
  await ev("__CAMPUS.openingDebug.takeLaptop()");s=await mark('laptop');if(!s.laptop||s.stage!=='return_b5')throw Error('laptop missing');await shot('03-laptop');
  await ev("__CAMPUS.openingDebug.triggerIncident();for(let i=0;i<340;i++)__CAMPUS.atmosphere.update(1/60,{incident:true,curtain:true,paused:false});__CAMPUS.experience.update(1/60)");await sleep(300);s=await mark('curtain');if(!s.curtain)throw Error('curtain missing');
  await ev("__CAMPUS.explorer.inspectAt(24,0,10,3.14159);__CAMPUS.explorer.update(1/60)");await shot('04-curtain-campus');
  await ev("__CAMPUS.explorer.inspectAt(58,0,-44,3.14159);__CAMPUS.explorer.update(1/60)");await shot('05-robots');
  await ev("__CAMPUS.openingDebug.reachB5();__CAMPUS.experience.update(1/60)");s=await mark('incident');if(s.stage!=='incident')throw Error('incident missing');await shot('06-empty-hall');
  await ev("__CAMPUS.openingDebug.openComputer('tasks')");await sleep(500);await mark('mac-alert');await shot('07-mac-alert');
  await click('.opening-mac-alertprimary');await sleep(500);s=await mark('agent');if(!s.agent||!s.b4||s.stage!=='to_b4')throw Error('agent unlock missing');await shot('08-mac-agent');
  await click('.opening-mac-dockitem[data-app="finder"]');await sleep(300);await shot('09-mac-finder');
  await click('.opening-mac-dockitem[data-app="map"]');await sleep(400);await shot('10-mac-map');
  await click('.opening-mac-dockitem[data-app="agent"]');await sleep(300);
  await ev("(()=>{const i=document.querySelector('[data-role=agent-input]');if(!i)throw Error('no input');i.value='How do I reach Building 4?';document.querySelector('[data-role=agent-send]').click();})()");
  let reply='';for(let i=0;i<32&&!reply;i++){await sleep(250);reply=await ev("(()=>{const m=[...document.querySelectorAll('.opening-mac-msgbubble')];return m.length?m[m.length-1].textContent:'';})()");}
  await mark('agent-reply');await shot('11-agent-chat');
  if(!/Building 4|4 号楼|central walk|中央/i.test(reply))throw Error('agent did not guide to Building 4: '+reply.slice(0,80));
  await click('.opening-mac-closehint');await sleep(300);
  await ev("__CAMPUS.openingDebug.setHearts(4);__CAMPUS.openingDebug.catchNow();__CAMPUS.experience.update(1/60)");await sleep(400);s=await mark('caught');if(s.hearts!==2||s.modal!=='caught')throw Error('capture did not deduct 2');await shot('12-caught');
  await click('.opening-caught-actions .opening-button--primary');await sleep(400);s=await mark('retry');if(s.hearts!==2||s.modal!==null)throw Error('retry must keep hearts');
  await ev("__CAMPUS.openingDebug.setHearts(2);__CAMPUS.openingDebug.catchNow();__CAMPUS.experience.update(1/60)");await sleep(400);s=await mark('zero');if(s.hearts!==0)throw Error('zero missing');await shot('13-game-over');
  await click('.opening-caught-actions .opening-button--primary');await sleep(400);s=await mark('heal');if(s.hearts!==10)throw Error('recover must restore 10');
  await ev("__CAMPUS.openingDebug.arriveB4();__CAMPUS.experience.update(1/60)");await sleep(400);s=await mark('complete');if(s.stage!=='complete')throw Error('complete missing');await shot('14-complete');
  const expected=['invitation_read','opening.bus_exited','opening.laptop_requested','laptop_acquired','campus_alert_triggered','opening.alert_acknowledged','opening.building4_reached'];
  if(JSON.stringify(s.events)!==JSON.stringify(expected))throw Error('event log mismatch '+JSON.stringify(s.events));
  if(errors.length)throw Error('page errors: '+JSON.stringify(errors));
  fs.writeFileSync(OUT+'/trace.json',JSON.stringify({generated:new Date().toISOString(),passed:true,trace,final:s},null,2));
  console.log('PASS opening flow',trace.length,'marks');ws.close();child.kill('SIGTERM');finished=true;
 }catch(e){console.log('attempt',attempt,'failed',e.message??e);}await sleep(250);
}
if(!finished)process.exitCode=1;
