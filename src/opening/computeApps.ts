import {createDeviceApps} from '../lionBoss/deviceApps';
import {getCampusComputeSession,type CampusComputeSession} from '../lionBoss/deviceServices';
import {createLawnVibeService} from '../lionBoss/consoleService';
import {relayRestored} from './backupRelay';
import type {MacOptions} from './macbook';

/** Resolve the device on use; equipment, saves and the B4 service can change while a window is open. */
export function bindComputeApps(instanceId:()=>string|undefined, closeWorkspace:()=>void) {
  let pairedId:string|undefined,local:CampusComputeSession|null=null;
  function session(){
    const id=instanceId();
    if(!id)return null;
    const upstream=getCampusComputeSession(id);if(upstream)return upstream;
    if(!relayRestored(id))return null;
    if(id!==pairedId){
      pairedId=id;
      const vibe=createLawnVibeService('hku.lion-boss.v1.'+id+'.skills',{stun:'Q',lure:'R'},()=>0,()=>instanceId()===id&&relayRestored(id));
      local={vibe,energy:()=>{const b=vibe.slots().budget;return b?'B4 · '+b.available+' / '+b.total:'B4 online';},
        robotics:{devices:()=>[],async execute(){return {ok:false,message:'进入草坪信号范围后可查询协助机器人。'};}}};
    }
    return local;
  }
  const apps=createDeviceApps(session,closeWorkspace);
  const options:Pick<MacOptions,'mission'|'robotics'|'energy'|'computeAccess'>={
    computeAccess:()=>session()?'connected':'locked',
    energy:()=>session()?.energy?.()??'Local device power',
    mission:{
      title:'Vibe Console',body:apps.missionBody,activate:apps.openVibe,location:'HKU Shanghai',
      mapLegend:'North up · campus position and current objective',
      terminal:()=>[session()?'Backup compute link established':'Backup compute link unavailable'],
    },
    robotics:{body:apps.roboticsBody,activate:apps.openRobotics},
  };
  return {options,dispose:apps.dispose};
}
