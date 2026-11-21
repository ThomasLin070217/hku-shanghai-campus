import {createDeviceApps} from '../lionBoss/deviceApps';
import {getCampusComputeSession} from '../lionBoss/deviceServices';
import type {MacOptions} from './macbook';

/** Resolve the device on use; equipment, saves and the B4 service can change while a window is open. */
export function bindComputeApps(instanceId:()=>string|undefined, closeWorkspace:()=>void) {
  function session(){
    const id=instanceId();
    return id?getCampusComputeSession(id):null;
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
