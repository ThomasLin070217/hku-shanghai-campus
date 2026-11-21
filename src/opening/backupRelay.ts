import chapter from '../../content/story/chapter-01.json';
import {getCampusComputeSession} from '../lionBoss/deviceServices';

// Linear B4 handoff reuses the chapter author's ordered procedure. Harry can supply
// an already authorised session through the existing device registry instead.
const procedure=chapter.puzzles.find(p=>p.id==='puzzle.control-restore')!;
const labels:Record<string,string>={
  'power-on':'Start backup power','isolate-external-network':'Isolate external network','restore-local-control':'Enable local control',
};
const granted=new Set<string>();
export function relayRestored(id:string){
  if(!id)return false;
  if(granted.has(id))return true;
  try{return localStorage.getItem('hku.b4.compute.'+id)==='online';}catch{return false;}
}
export function bindBackupRelay(id:string|undefined,onReady:()=>void){
  const body=document.createElement('section');body.className='opening-backup-relay';
  if(!id)return body;
  if(relayRestored(id)||getCampusComputeSession(id)){onReady();return body;}
  const title=document.createElement('h3'),hint=document.createElement('p'),reply=document.createElement('p');
  title.textContent='B4 · Backup compute terminal';
  hint.textContent='Recovery procedure: start backup power, isolate the external network, then restore local control.';
  reply.setAttribute('role','status');reply.textContent='0 / '+procedure.correctOrder.length;
  const commands=document.createElement('div');let index=0;
  for(const key of [...procedure.options].reverse()){
    const button=document.createElement('button');button.type='button';button.className='opening-button opening-button--secondary';button.textContent=labels[key]??key;
    button.onclick=()=>{
      if(key!==procedure.correctOrder[index]){reply.textContent='Interlock active. Next step: '+labels[procedure.correctOrder[index]]+'.';return;}
      index++;button.disabled=true;reply.textContent=index+' / '+procedure.correctOrder.length+' · '+labels[key];
      if(index===procedure.correctOrder.length){
        granted.add(id);
        try{localStorage.setItem('hku.b4.compute.'+id,'online');}catch{/* Available for this open chapter. */}
        reply.textContent='Backup supercomputer online. MacBook paired.';onReady();
      }
    };
    commands.append(button);
  }
  body.append(title,hint,commands,reply);return body;
}
