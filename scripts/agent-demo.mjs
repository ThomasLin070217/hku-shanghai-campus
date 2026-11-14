// No model, browser automation, keyboard simulation, or coordinate writes.
const base=process.env.HKU_AGENT_URL||'http://127.0.0.1:8788';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,data){const response=await fetch(base+path,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return response.json();}
console.log('In the game pause menu, click 开启 AI 控制. Waiting up to 90 seconds…');
let state;
for(let i=0;i<180;i++){const r=await api('/observe');if(r.ok&&r.state.aiEnabled&&!r.state.owner&&!r.state.paused){state=r.state;break;}await sleep(500);}
if(!state)throw Error('AI not enabled / game not_ready. Open the game and enable AI manually.');
console.log('observe',JSON.stringify(state.player));
const grant=await api('/acquireControl',{agentId:'local-demo'});if(!grant.ok)throw Error(JSON.stringify(grant));const controlEpoch=grant.controlEpoch;console.log('acquired',controlEpoch);
let seq=0;
async function action(label,body){const commandId=`demo-${Date.now()}-${seq++}`;const r=await api('/act',{commandId,controlEpoch,durationMs:600,...body});console.log(label,JSON.stringify(r));if(!r.ok)throw Error(r.error);await sleep((body.durationMs??600)+80);let result;for(let i=0;i<40;i++){result=await api('/commands/'+commandId);if(!['accepted','running'].includes(result.command?.status))break;await sleep(50);}console.log('result',JSON.stringify(result));if(!['completed','blocked'].includes(result.command?.status))throw Error('Action not completed: '+JSON.stringify(result));}
try{
 await action('turn',{lookDelta:{yawDeg:90,pitchDeg:0},durationMs:350});
 await action('walk',{move:{forward:1,right:0}});
 await action('sprint',{move:{forward:1,right:0},sprint:true});
 await action('jump + change view',{move:{forward:1,right:0},sprint:true,jump:true,switchView:true,durationMs:850});
 console.log('stop',await api('/stop',{controlEpoch}));await sleep(250);
 console.log('final',JSON.stringify(await api('/observe')));
 if(process.argv.includes('--takeover-test')){
  console.log('TAKEOVER TEST: click 一键接管 or press W now; waiting up to 30 seconds.');
  for(let i=0;i<60;i++){await api('/act',{commandId:`takeover-${Date.now()}`,controlEpoch,durationMs:450,move:{forward:0,right:.15}});await sleep(500);const r=await api('/observe');if(r.state?.controlEpoch!==controlEpoch){const late=await api('/act',{commandId:'late-'+Date.now(),controlEpoch,durationMs:200,jump:true});if(late.error!=='stale_epoch')throw Error('Old authority was not rejected');console.log('PASS manual takeover: stale epoch rejected',late);break;}if(i===59)throw Error('Manual takeover not observed');}
 }
}finally{console.log('release',await api('/releaseControl',{controlEpoch}));}
