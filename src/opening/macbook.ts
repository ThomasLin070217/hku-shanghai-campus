import type {OpeningUIActions,OpeningView} from './contracts';
import type {LocalAgent} from './agent';
import {OPENING_UI} from '../../content/opening/en';
import {createAssistantApp} from './assistantApp';
import {createWindowManager,type WindowApp} from './deviceWindows';
import {action,el,glyph,setLabel} from './deviceGlyphs';
import './deviceDesktop.css';

export type MacApp='desktop'|'finder'|'map'|'agent'|'mission'|'robotics'|'terminal'|'logs'|'invitation'|'about';
type MacView=Pick<OpeningView,'objective'|'detail'|'story'|'runtime'|'player'|'computerPage'>;
export type ComputeAccess='locked'|'exercise'|'connected';
interface MountedApp {body:HTMLElement;activate:()=>void}
export interface MacOptions {
  actions?:Pick<OpeningUIActions,'action'>;
  drawMap:(canvas:HTMLCanvasElement,large:boolean)=>void;
  onClose:()=>void;
  agent:LocalAgent;
  sessionKey?:string|(()=>string);
  computeAccess?:()=>ComputeAccess;
  energy?:()=>string;
  devices?:()=>ReadonlyArray<{id:string;name:string;status:string}>;
  files?:MountedApp;
  logs?:MountedApp;
  robotics?:MountedApp;
  mission?:MountedApp&{title:string;location:string;mapLegend:string;terminal:()=>string[]};
}
const names:Record<WindowApp,string>={
  finder:'Files',map:'Campus Map',agent:'AI Assistant',mission:'Vibe Console',robotics:'Robotics',terminal:'System Monitor',logs:'Mission Logs',invitation:'High Table invitation',about:'MacBook Air',
};
const dockApps:WindowApp[]=['finder','map','agent','mission','robotics','terminal','logs'];
const eventLabels:Record<string,string>={
  invitation_read:'Dinner invitation read','opening.bus_exited':'Arrived on campus',
  'opening.laptop_requested':'Presentation MacBook requested',laptop_acquired:'MacBook collected at Building 6',
  campus_alert_triggered:'Campus security alert received','opening.alert_acknowledged':'Emergency assistance enabled',
  'opening.building4_reached':'Reached the Building 4 entrance',
};
const campusClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'});

export function createMacBookExperience(options:MacOptions){
  let view:MacView|null=null;
  let alertOpen=false,notificationOpen=false;
  let requestedPage:MacView['computerPage']|null=null;
  let lastAccess:ComputeAccess|undefined,lastClockMinute=-1,lastMap='';
  const access=():ComputeAccess=>options.computeAccess?.()??'locked';
  const emergency=()=>Boolean(view?.story.campus_alert_triggered||view?.runtime.curtain_deployed);
  const location=()=>options.mission?.location??'HKU Shanghai';
  const root=el('div','opening-mac device-os');
  root.tabIndex=-1;

  const bar=el('div','device-bar');
  const home=action('CampusOS',()=>showApp('desktop'),'device-home');
  home.prepend(glyph('brand'));home.title='Show desktop';
  const activeName=el('span','device-active-app','Desktop');
  const network=el('span','device-network'),power=el('span','device-power');
  const clock=el('time','device-clock');clock.title='Shanghai local time';
  const notifyButton=action('',()=>toggleNotifications(!notificationOpen),'device-system-button');
  notifyButton.append(glyph('bell'));notifyButton.title='Notifications';notifyButton.setAttribute('aria-label','Notifications');notifyButton.setAttribute('aria-expanded','false');
  const sleep=action('',()=>options.onClose(),'device-system-button');
  sleep.append(glyph('power'));sleep.title='Put MacBook to sleep';sleep.setAttribute('aria-label','Put MacBook to sleep');sleep.dataset.macSleep='';
  bar.append(home,activeName,network,power,clock,notifyButton,sleep);

  const screen=el('div','device-screen'),art=el('div','device-wallpaper');
  const hero=el('section','device-homepage'),phaseTag=el('span','device-phase');
  const headline=el('h2','','HKU Shanghai'),objectiveLabel=el('span','device-caption','CURRENT OBJECTIVE');
  const objective=el('p','device-objective');objective.dataset.role='objective';
  const heroLink=action('任务日志',()=>showApp('logs'),'device-link');
  hero.append(phaseTag,headline,objectiveLabel,objective,heroLink);
  const layer=el('div','device-windows');
  const notifications=el('section','device-notifications');notifications.hidden=true;
  notifications.setAttribute('aria-label','Notifications');
  const notesTitle=el('h3','','Notifications'),note=el('p'),dismiss=action('Close',()=>toggleNotifications(false),'device-link');notifications.append(notesTitle,note,dismiss);
  const alert=el('section','device-alert opening-mac-alert');alert.hidden=true;
  alert.setAttribute('role','alertdialog');alert.setAttribute('aria-modal','true');alert.setAttribute('aria-label','Campus security alert');
  const alertCard=el('div','device-alert-card');
  const accept=action('Enable emergency assistance',()=>{if(!alertOpen)return;options.actions?.action('read_alert');},'device-primary opening-mac-alertprimary');
  const alertSleep=action('Put MacBook to sleep',options.onClose,'device-link opening-mac-alertsecondary');
  alertCard.append(el('span','device-alert-label','CAMPUS SECURITY ALERT'),el('h2','','Security breach'),
    el('p','','The campus robotics network is compromised. The perimeter is sealed and external communication is blocked.'),
    el('p','','Emergency assistance is available on this MacBook.'),accept,alertSleep);
  alert.append(alertCard);

  const dock=el('nav','device-dock');dock.setAttribute('aria-label','Applications');
  const launchers=new Map<WindowApp,HTMLButtonElement>();
  for(const app of dockApps){
    const b=action('',()=>showApp(app),'device-launch opening-mac-dockitem');
    b.dataset.app=app;b.dataset.state='closed';b.title=names[app];b.setAttribute('aria-label',names[app]);
    if(app==='mission')b.dataset.launchMission='';
    b.append(glyph(app),el('span','device-dock-label',names[app]));launchers.set(app,b);dock.append(b);
  }
  screen.append(art,hero,layer);root.append(bar,screen,dock,notifications,alert);

  const manager=createWindowManager(layer,app=>{
    root.dataset.app=app;
    setLabel(activeName,app==='desktop'?'Desktop':names[app]);
    for(const [key,b] of launchers){b.dataset.state=manager.state(key);b.setAttribute('aria-current',String(app===key));}
  });
  const assistant=createAssistantApp({agent:options.agent,
    context:()=>view&&({story:view.story,runtime:view.runtime,player:view.player,computeStatus:access()==='locked'?'unavailable':access()==='exercise'?'exercise':'connected'}),
    objective:()=>view?.objective??'',detail:()=>view?.detail??'',sessionKey:options.sessionKey??(options.mission?'lawn':'opening'),
  });

  function toggleNotifications(visible:boolean){
    if(alertOpen&&visible)return;
    notificationOpen=visible;notifications.hidden=!visible;notifyButton.setAttribute('aria-expanded',String(visible));
    if(visible)dismiss.focus({preventScroll:true});
    else if(notifications.contains(document.activeElement))notifyButton.focus({preventScroll:true});
  }
  function appRow(app:WindowApp,label:string,hint:string) {
    const row=action('',()=>showApp(app),'device-file-row');
    row.append(glyph(app),el('b','',label),el('small','',hint));return row;
  }
  function filesBody(){
    const body=el('article','device-document');
    body.append(el('p','device-caption','ON MY MACBOOK'),el('h2','','Campus files'),
      appRow('invitation','High Table invitation','Invitation'),appRow('map','Campus map','Live map'),
      appRow('logs','Mission record','Activity'),appRow('about','Device information','System'));
    return body;
  }
  function invitationBody(){
    const info=OPENING_UI.invitation;
    const body=el('article','device-document device-invite');
    body.append(el('p','device-caption',info.eyebrow),el('h2','',info.title),el('p','',info.host),el('h3','',info.name),el('p','',info.venueValue),el('p','',info.dateValue+' · '+info.timeValue),el('p','',info.body));
    return body;
  }
  function aboutBody(){
    const body=el('article','device-document');
    body.append(el('p','device-caption','DEVICE INFORMATION'),el('h2','','MacBook Air'),el('p','','CampusOS · HKU Shanghai'),el('p','','Local campus workstation'));
    return body;
  }
  const mapCanvas=el('canvas','device-map-canvas');mapCanvas.width=620;mapCanvas.height=680;
  mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Campus map showing the player and objective');
  const mapStatus=el('p','device-state-line'),mapObjective=el('h2'),mapDetail=el('p'),mapCaption=el('p','device-caption','CURRENT OBJECTIVE');
  function mapBody(){
    const body=el('article','device-map'),side=el('aside','device-document');
    side.append(mapCaption,mapObjective,mapDetail,mapStatus,el('p','device-muted',options.mission?.mapLegend??'North is up. Follow the orange objective marker.'));
    body.append(mapCanvas,side);return body;
  }
  const logObjective=el('h2'),logDetail=el('p'),history=el('ol','device-history');let logSig='';
  function logsBody(){
    const body=el('article','device-document');body.append(el('p','device-caption','ACTIVE MISSION'),logObjective,logDetail,el('h3','','Activity'),history);
    return body;
  }
  const monitorRows=new Map<string,HTMLElement>();
  const terminal=el('pre','device-terminal');
  function monitorBody(){
    const body=el('article','device-document');
    body.append(el('p','device-caption','SYSTEM MONITOR'),el('h2','','Device status'));
    const rows=el('dl','device-facts');
    const fields=options.logs?['Network','Compute node','Power']:['Network','Compute node','Power','Player health'];
    for(const key of fields){
      const value=el('dd');if(key==='Player health')value.dataset.role='hearts';monitorRows.set(key,value);rows.append(el('dt','',key),value);
    }
    body.append(rows);if(options.mission)body.append(terminal);return body;
  }

  const appContent=new Map<WindowApp,{root:HTMLElement;key:string}>();
  const accessText=(value:ComputeAccess)=>value==='connected'?'Supercomputer connected':value==='exercise'?'Local lawn maintenance':'Awaiting compute node';
  function permissionBody(app:'robotics'|'mission'){
    const container=el('div','device-permission-host');appContent.set(app,{root:container,key:''});return container;
  }
  function refreshPermissions(app:'robotics'|'mission'){
    const entry=appContent.get(app);if(!entry)return;
    const value=access(),extension=app==='robotics'?options.robotics:options.mission;
    const canMount=value!=='locked'&&Boolean(extension);
    const devices=app==='robotics'&&!canMount?(options.devices?.()??[]):[];
    const key=value+'|'+(extension?'adapter':'')+'|'+JSON.stringify(devices);
    if(key===entry.key)return;
    entry.key=key;
    if(value!=='locked'&&extension){
      entry.root.replaceChildren(extension.body);
      if(manager.state(app)==='visible')extension.activate();
      return;
    }
    const body=el('article','device-document device-permission');
    body.append(glyph(value==='locked'?'lock':app),el('p','device-caption',names[app]),
      el('h2','',value==='locked'?'Backup compute required':'Service unavailable'),
      el('p','',value==='locked'?'Connect the Building 4 backup supercomputer to obtain control permissions.':'The campus node has not provided this application service.'));
    if(app==='robotics'&&devices.length){
      const list=el('dl','device-facts');
      for(const device of devices)list.append(el('dt','',device.name),el('dd','',device.id+' · '+device.status));
      body.append(el('h3','','Detected devices'),list);
    }
    entry.root.replaceChildren(body);
  }
  function buildBody(app:WindowApp){
    switch(app){
      case 'finder':return options.files?.body??filesBody();
      case 'logs':return options.logs?.body??logsBody();
      case 'map':return mapBody();
      case 'agent':return assistant.root;
      case 'mission':case 'robotics':return permissionBody(app);
      case 'terminal':return monitorBody();
      case 'invitation':return invitationBody();
      case 'about':return aboutBody();
    }
  }
  function showApp(app:MacApp){
    if(alertOpen)return;
    if(notificationOpen)toggleNotifications(false);
    if(app==='desktop'){manager.desktop();return;}
    manager.open(app,names[app],()=>buildBody(app),()=>{
      if(app==='finder')options.files?.activate();
      if(app==='logs')options.logs?.activate();
      if(app==='mission'||app==='robotics'){
        const ext=app==='mission'?options.mission:options.robotics;
        if(access()!=='locked'&&ext&&appContent.get(app)?.root.contains(ext.body))ext.activate();
      }
      if(app==='map')lastMap='';
    });
    updateChrome();
  }
  function focusFirst(){
    if(alertOpen){accept.focus({preventScroll:true});return;}
    const front=layer.querySelector<HTMLElement>('.is-front:not([hidden])');
    if(front){(front.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)')??front).focus({preventScroll:true});}
    else (launchers.get(options.mission?'mission':'finder')??home).focus({preventScroll:true});
  }
  function handleEscape(){
    if(alertOpen)return false;
    if(notificationOpen){toggleNotifications(false);return true;}
    const app=manager.active;
    if(!manager.closeFront())return false;
    if(manager.active!=='desktop')focusFirst();
    else if(app!=='desktop')(launchers.get(app)??home).focus({preventScroll:true});
    return true;
  }
  function updateChrome(){
    if(!view)return;
    const nowMinute=Math.floor(Date.now()/60000);
    if(nowMinute!==lastClockMinute){lastClockMinute=nowMinute;clock.textContent=campusClock.format(Date.now());}
    const value=access(),sealed=emergency();
    const stage=value==='exercise'?'exercise':value==='connected'?'connected':sealed?'emergency':'normal';
    if(root.dataset.stage!==stage)root.dataset.stage=stage;
    const mode=stage==='exercise'?'Lawn maintenance':stage==='connected'?'Compute node online':stage==='emergency'?'Emergency mode':'Normal mode';
    setLabel(phaseTag,mode);
    setLabel(network,sealed?'Network isolated':'Campus intranet');
    setLabel(power,options.energy?.()??'Local power');
    setLabel(objective,view.objective);
    setLabel(note,value==='connected'?'Backup power online. Vibe Console and Robotics are available.':value==='exercise'?'Local lawn maintenance is available in this encounter.':sealed?'Campus robotics network compromised. Read the alert and use AI Assistant for directions.':'Campus intranet available. Your local files and current mission are ready.');
    if(value==='connected'&&lastAccess!=='connected'&&!alertOpen&&!notificationOpen)toggleNotifications(true);
    if(value!=='connected'&&lastAccess==='connected'&&notificationOpen)toggleNotifications(false);
    lastAccess=value;

    const shouldAlert=Boolean(view.story.campus_alert_triggered&&!view.story.alert_read);
    if(shouldAlert!==alertOpen){
      alertOpen=shouldAlert;alert.hidden=!shouldAlert;
      bar.inert=screen.inert=dock.inert=shouldAlert;
      if(shouldAlert){toggleNotifications(false);queueMicrotask(()=>{if(alertOpen)accept.focus({preventScroll:true});});}
    }
    const phase=alertOpen?'alert':sealed?'night':'day';
    if(root.dataset.phase!==phase)root.dataset.phase=phase;
    if(manager.state('agent')==='visible')assistant.update();
    refreshPermissions('mission');refreshPermissions('robotics');
    if(manager.state('terminal')==='visible'){
      const values=[sealed?'External connection blocked':'Campus intranet available',accessText(value),options.energy?.()??'Local device supply',view.runtime.hearts+' / '+view.runtime.maxHearts];
      let i=0;for(const target of monitorRows.values())setLabel(target,values[i++]);
      if(options.mission)setLabel(terminal,options.mission.terminal().join('\n'));
    }
    if(manager.state('logs')==='visible'&&!options.logs){
      setLabel(logObjective,view.objective);setLabel(logDetail,view.detail);
      const sig=view.story.events.join('|');
      if(sig!==logSig){logSig=sig;history.replaceChildren(...view.story.events.map(e=>el('li','',eventLabels[e]??e)));}
    }
    if(manager.state('map')==='visible'){
      setLabel(mapObjective,view.objective);setLabel(mapDetail,view.detail);setLabel(mapStatus,sealed?'Security alert · perimeter sealed':'Campus systems online');
      const sig=[view.player[0],view.player[2],view.objective,stage].join('|');
      if(lastMap!==sig){options.drawMap(mapCanvas,true);lastMap=sig;}
    }
  }
  function update(next:MacView){
    const routeChanged=requestedPage!==next.computerPage,wasAlert=alertOpen;
    requestedPage=next.computerPage;view=next;updateChrome();
    if(!alertOpen&&(routeChanged||wasAlert)&&requestedPage!=='tasks')showApp(requestedPage);
  }
  function open(next:MacView){
    requestedPage=null;
    lastMap='';
    update(next);
  }
  function suspend(){assistant.suspend?.();if(notificationOpen)toggleNotifications(false);}
  function dispose(){manager.dispose();assistant.dispose();options.agent.dispose();root.remove();}
  return{root,open,update,focusFirst,handleEscape,showDesktop:()=>showApp('desktop'),showApp,suspend,dispose,get app(){return manager.active;},get alertOpen(){return alertOpen;}};
}
