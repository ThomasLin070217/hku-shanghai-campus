// Run while the browser has explicitly enabled AI. This uses only public HTTP action intents.
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8788',out='evidence/experience-fix';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(path,data)=>{const r=await fetch(base+path,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return r.json();};
const trace=[],start=Date.now();let seq=0,epoch;
const snap=async(label)=>{const r=await api('/observe');trace.push({label,t:(Date.now()-start)/1000,state:r.state});console.log(label, r.state?.player.position,r.state?.lastCommand?.status);return r.state;};
async function act(label,body={},durationMs=900){const commandId=`qa-${label}-${seq++}`;const r=await api('/act',{commandId,controlEpoch:epoch,durationMs,...body});if(!r.ok)throw Error(JSON.stringify(r));return commandId;}
async function hold(label,seconds,body={}){const end=Date.now()+seconds*1000;while(Date.now()<end){const ms=Math.min(900,end-Date.now());await act(label,body,Math.max(1,ms));await delay(ms);}await api('/stop',{controlEpoch:epoch});await snap(label);}
async function drive(label,x,z,sprint=false,limit=18000){const t=Date.now();let collisions=0;while(Date.now()-t<limit){const s=(await api('/observe')).state;if(!s||s.paused)throw Error('Paused/not ready '+label);const [px,,pz]=s.player.position,dx=x-px,dz=z-pz,d=Math.hypot(dx,dz);if(d<.18)break;const yaw=Math.atan2(-dx,-dz)*180/Math.PI,delta=((yaw-s.player.yawDeg+540)%360)-180,ms=Math.max(40,Math.min(650,d/(sprint?5.2:2.6)*1000));await act(label,{move:{forward:1,right:0},lookDelta:{yawDeg:delta,pitchDeg:0},sprint},Math.round(ms));await delay(ms);const n=(await api('/observe')).state;if(n.collisions.length)collisions++;if(collisions>4)break;}await api('/stop',{controlEpoch:epoch});await snap(label);}
try{
 const grant=await api('/acquireControl',{agentId:'experience-verification'});if(!grant.ok)throw Error(JSON.stringify(grant));epoch=grant.controlEpoch;
 await act('empty-hands',{selectHotbar:1},10);await delay(100);await hold('standing',1.5);
 await drive('paving-walk',14.6,87);await drive('grass-walk',8,87);await drive('grass-sprint',-8,87,true);await hold('stopped',1.5);
 await act('jump',{jump:true},900);await delay(1000);await snap('jump-landed');
 await drive('toward-building',27.5,87,true);await hold('against-glass-wall',2.2,{move:{forward:1,right:0}});
 await act('third-view',{switchView:true,lookDelta:{yawDeg:180,pitchDeg:0}},150);await delay(200);await act('equip-laptop',{selectHotbar:0},150);await delay(200);
 await drive('held-laptop-walk',21,87);await drive('return-lawn',8,87,true);await drive('lion-east',8,76);await drive('lion-north',8,70);await drive('lion-front',-6,70);await drive('lion-west',-6,82);await drive('lion-south',0,83);
 await act('look-at-lion',{lookDelta:{yawDeg:90,pitchDeg:0}},150);await delay(300);await hold('third-person-lion',1.5);
 await act('air-switch',{jump:true,switchView:true,move:{forward:0,right:.3},sprint:true},500);await delay(500);await act('air-switch-back',{switchView:true},300);await delay(500);await snap('switch-landing');
 await api('/stop',{controlEpoch:epoch});await snap('finished');
}finally{if(epoch)trace.push({release:await api('/releaseControl',{controlEpoch:epoch})});await fs.writeFile(out+'/route-http.json',JSON.stringify(trace,null,2));}
