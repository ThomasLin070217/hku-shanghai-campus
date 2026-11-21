import {createBossWorkbench} from './workbench';
import type {CampusComputeSession,RobotDevice} from './deviceServices';

/** The shell can keep a body mounted while a window is minimized. Binding is
 * checked again at each operation so a former device or expired grant cannot act. */
export function createDeviceApps(resolveSession:()=>CampusComputeSession|null,onCloseWorkspace:()=>void,onDeploy?:()=>void){
  const missionBody=document.createElement('div'),roboticsBody=document.createElement('div');
  missionBody.className='boss-mac-content';roboticsBody.className='vc-robotics';roboticsBody.tabIndex=-1;
  let activeVibe:CampusComputeSession['vibe']|undefined,workbench:ReturnType<typeof createBossWorkbench>|undefined;
  let disposed=false,commandPending=false,lastReport='',lastDevices='',lastService:CampusComputeSession['robotics']|undefined;
  let timer:number|undefined;
  function hasWindow(el:HTMLElement){return el.isConnected&&!el.closest('[hidden]')&&el.clientWidth>0;}
  function monitor(){
    if(timer!==undefined)return;
    timer=window.setInterval(()=>{
      const vibeVisible=hasWindow(missionBody),robotsVisible=hasWindow(roboticsBody);
      if(!vibeVisible&&!robotsVisible){clearInterval(timer);timer=undefined;return;}
      const session=resolveSession();
      if(vibeVisible){if(session?.vibe!==activeVibe)openVibe();else workbench?.refresh();}
      if(robotsVisible&&JSON.stringify(session?.robotics.devices()??[])!==lastDevices)openRobotics();
    },450);
  }
  function openVibe(){
    monitor();
    const service=resolveSession()?.vibe;
    if(activeVibe!==service){workbench?.dispose();workbench=undefined;activeVibe=service;}
    if(!service){missionBody.textContent='等待超算连接和技能权限。';return;}
    if(!workbench){
      missionBody.replaceChildren();
      const allowed=()=>resolveSession()?.vibe===service&&!disposed;
      const denied=()=>({ok:false as const,message:'设备的编译权限已过期。'});
      async function scoped<T>(operation:()=>Promise<T>) {
        if(!allowed())return denied();
        const result=await operation();
        return allowed()?result:denied();
      }
      workbench=createBossWorkbench({host:missionBody,onClose:onCloseWorkspace,onDeploy,service:{
        name:service.name,projects:service.projects,slots:()=>service.slots(),draft:id=>service.draft(id),
        edit:(id,source)=>{if(allowed())service.edit(id,source);},
        preview:(id,source)=>scoped(()=>service.preview(id,source)),
        preset:service.preset?(id,source,side)=>scoped(()=>service.preset!(id,source,side)):undefined,
        uninstall:service.uninstall?id=>scoped(()=>service.uninstall!(id)):undefined,
        test:plan=>scoped(()=>service.test(plan)),install:plan=>scoped(()=>service.install(plan)),
        installedPlan:id=>service.installedPlan?.(id)??null,blockedReason:plan=>service.blockedReason?.(plan)??null,
        getFieldRule:kind=>service.getFieldRule(kind),cooldown:id=>service.cooldown(id),reset:()=>{if(allowed())service.reset();},
      }});
    }
    workbench.open();
  }
  function deviceRow(device:RobotDevice){
    const row=document.createElement('section'),head=document.createElement('header');
    const id=document.createElement('code'),name=document.createElement('h3'),state=document.createElement('span');
    id.textContent=device.id;name.textContent=device.name;state.textContent=device.status;head.append(id,state);
    const permission=document.createElement('p');permission.textContent=device.permission;
    row.append(head,name,permission);
    if(device.remainingSeconds!=null){const ttl=document.createElement('small');ttl.textContent='控制剩余 '+device.remainingSeconds.toFixed(1)+' s';row.append(ttl);}
    for(const command of device.commands){
      const action=document.createElement('div');action.className='vc-robot-action';
      const b=document.createElement('button');b.type='button';b.dataset.robotCommand=device.id+'/'+command.id;b.textContent=command.label;b.disabled=!command.enabled||commandPending;
      action.append(b);
      if(command.reason){const reason=document.createElement('small');reason.textContent=command.reason;action.append(reason);}
      b.addEventListener('click',async()=>{
        const provider=resolveSession()?.robotics;
        if(disposed||commandPending||provider!==lastService||!provider)return;
        const current=provider.devices().find(d=>d.id===device.id)?.commands.find(c=>c.id===command.id);
        if(!current?.enabled){lastReport='当前未获准执行此指令。';openRobotics();return;}
        const focusKey=b.dataset.robotCommand;
        commandPending=true;openRobotics();
        try{
          const result=await provider.execute(device.id,command.id);
          if(!disposed&&resolveSession()?.robotics===provider)lastReport=result.ok?result.value:result.message;
        }catch(error){if(!disposed&&resolveSession()?.robotics===provider)lastReport=error instanceof Error?error.message:'设备未响应。';}
        finally{
          commandPending=false;
          if(!disposed)openRobotics(document.activeElement===roboticsBody?focusKey:undefined);
        }
      });
      row.append(action);
    }
    if(device.lastResult){const recent=document.createElement('small');recent.textContent='最近回执 · '+device.lastResult;row.append(recent);}
    return row;
  }
  function openRobotics(preferred?:string){
    monitor();
    const service=resolveSession()?.robotics;
    if(service!==lastService){lastService=service;lastReport='';}
    const focused=preferred??(document.activeElement as HTMLElement|null)?.dataset.robotCommand;
    const devices=service?.devices()??[];lastDevices=JSON.stringify(devices);
    roboticsBody.replaceChildren();
    if(!service){roboticsBody.textContent='等待设备控制权限。';return;}
    const title=document.createElement('h2');title.textContent='机器人设备';
    const count=document.createElement('small');count.textContent='已发现 '+devices.length+' 台设备';
    roboticsBody.append(title,count,...devices.map(deviceRow));
    const status=document.createElement('p');status.setAttribute('role','status');
    status.textContent=commandPending?'等待设备回执…':lastReport;roboticsBody.append(status);
    if(focused){
      const next=Array.from(roboticsBody.querySelectorAll<HTMLButtonElement>('[data-robot-command]')).find(b=>b.dataset.robotCommand===focused&&!b.disabled);
      (next??roboticsBody).focus({preventScroll:true});
    }
  }
  return {missionBody,roboticsBody,openVibe,openRobotics,dispose(){disposed=true;clearInterval(timer);workbench?.dispose();missionBody.remove();roboticsBody.remove();}};
}
