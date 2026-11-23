import type {OpeningUIActions,OpeningView} from './contracts';
import type {LocalAgent} from './agent';
import {OPENING_UI} from '../../content/opening/en';
import {createAssistantApp} from './assistantApp';
import {createWindowManager,type WindowApp} from './deviceWindows';
import {action,el,glyph,setLabel,type Glyph} from './deviceGlyphs';
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
  /** Plain-text lines for the Terminal window. Falls back to the mission shell. */
  terminal?:()=>string[];
  /** Lists Vibe Console / Robotics in Finder > Applications (review fixture). The opening story Mac mounts neither app. */
  devTools?:boolean;
  /** Window to open when the shell first appears. Story Macs default to Finder. */
  startApp?:WindowApp;
}
const names:Record<WindowApp,string>={
  finder:'Finder',map:'Maps',agent:'Harness',mission:'Vibe Console',robotics:'Robotics',
  terminal:'Terminal',logs:'Mission Logs',invitation:'Preview',about:'About This Mac',
};
const menuNames:Record<WindowApp,string>={
  finder:'Finder',map:'Maps',agent:'Harness',mission:'Vibe Console',robotics:'Robotics',
  terminal:'Terminal',logs:'Mission Logs',invitation:'Preview',about:'Finder',
};
const dockApps:WindowApp[]=['finder','agent','map','logs','terminal'];
const eventLabels:Record<string,string>={
  invitation_read:'Dinner invitation read','opening.bus_exited':'Arrived on campus',
  'opening.laptop_requested':'Presentation MacBook requested',laptop_acquired:'MacBook collected at Building 6',
  campus_alert_triggered:'Campus security alert received','opening.alert_acknowledged':'Emergency assistance enabled',
  'opening.building4_reached':'Reached the Building 4 entrance',
};
const campusClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false});
// English like the clock above: "Sun 22 Nov".
const campusCalendar=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',weekday:'short',day:'numeric',month:'short'});

interface FinderEntry {
  id:string;
  name:string;
  kind:string;
  meta:string;
  icon:Glyph;
  folder?:string;
  app?:WindowApp;
  custom?:()=>void;
  open?:()=>void;
}

export function createMacBookExperience(options:MacOptions){
  let view:MacView|null=null;
  let alertOpen=false,appleOpen=false;
  let requestedPage:MacView['computerPage']|null=null;
  let lastAccess:ComputeAccess|undefined,lastClockMinute=-1,lastMap='';
  const access=():ComputeAccess=>options.computeAccess?.()??'locked';
  const emergency=()=>Boolean(view?.story.campus_alert_triggered||view?.runtime.curtain_deployed);
  const location=()=>options.mission?.location??'HKU Shanghai';
  const root=el('div','opening-mac mac-os');
  root.tabIndex=-1;

  /* ------------------------------------------------------------ menu bar. */
  const bar=el('div','mac-menubar');
  const appleButton=action('',()=>toggleAppleMenu(!appleOpen),'mac-apple');
  appleButton.append(glyph('apple'));appleButton.title='Apple menu';appleButton.setAttribute('aria-label','Apple menu');appleButton.setAttribute('aria-expanded','false');
  const appName=el('b','mac-appname','Finder');
  const menus=el('nav','mac-menus');menus.setAttribute('aria-label','Application menu');
  for(const label of ['File','Edit','View','Go','Window','Help'])menus.append(el('span','mac-menu-item',label));
  const statusRight=el('div','mac-status');
  const wifi=el('span','mac-wifi');wifi.append(glyph('wifi'));wifi.title='Wi-Fi';
  const battery=el('span','mac-battery');battery.append(el('i','mac-battery-fill'));const batteryText=el('span','mac-battery-text','100%');battery.append(batteryText);
  const clock=el('span','mac-clock');clock.title='Shanghai local time';
  const calendar=el('span','mac-calendar');
  statusRight.append(wifi,battery,calendar,clock);
  bar.append(appleButton,appName,menus,statusRight);

  const appleMenu=el('div','mac-apple-menu');appleMenu.hidden=true;
  const appleAbout=action('About This Mac',()=>{toggleAppleMenu(false);showApp('about');},'mac-apple-item');
  const appleSleep=action('Sleep',()=>{toggleAppleMenu(false);options.onClose();},'mac-apple-item');
  const appleClose=action('Close Window',()=>{toggleAppleMenu(false);manager.closeFront();},'mac-apple-item');
  appleMenu.append(appleAbout,el('div','mac-apple-sep'),appleClose,appleSleep);

  /* ------------------------------------------------------------ desktop. */
  const desktop=el('div','mac-desktop');
  const wallpaper=el('div','mac-wallpaper');
  wallpaper.append(el('span','mac-aurora a'),el('span','mac-aurora b'),el('span','mac-aurora c'),el('span','mac-skyline'));
  const iconLayer=el('div','mac-desktop-icons');
  const widget=el('section','mac-widget');
  const widgetEyebrow=el('span','mac-widget-eyebrow','CURRENT OBJECTIVE');
  const widgetObjective=el('b','mac-widget-objective');
  const widgetDetail=el('p','mac-widget-detail');
  const widgetLink=action('Open Mission Logs',()=>showApp('logs'),'mac-widget-link');
  widget.append(widgetEyebrow,widgetObjective,widgetDetail,widgetLink);
  const layer=el('div','mac-windows');
  const dock=el('nav','mac-dock');dock.setAttribute('aria-label','Applications');

  const iconButtons:Array<{button:HTMLButtonElement;app:WindowApp}>=[];
  function desktopIcon(name:string,icon:Glyph,open:()=>void){
    const button=action('',open,'mac-desktop-icon');
    button.append(glyph(icon),el('span','mac-desktop-icon-label',name));
    button.setAttribute('aria-label','Open '+name);
    iconLayer.append(button);
  }
  desktopIcon('High Table Invitation','invitation',()=>showApp('invitation'));
  desktopIcon('Campus Map','map',()=>showApp('map'));
  desktopIcon('Mission Logs','logs',()=>showApp('logs'));

  const launchers=new Map<WindowApp,HTMLButtonElement>();
  // Callers that mount Vibe Console / Robotics (the L001 lawn Mac) get Dock launchers for them.
  const mounted:WindowApp[]=[...(options.mission?['mission' as const]:[]),...(options.robotics?['robotics' as const]:[])];
  for(const app of [...dockApps,...mounted]){
    const b=action('',()=>showApp(app),'mac-dock-item');
    b.dataset.app=app;b.dataset.state='closed';b.title=names[app];b.setAttribute('aria-label',names[app]);
    const icon=glyph(app as Glyph);icon.classList.add('mac-dock-icon');
    b.append(icon,el('span','mac-dock-label',names[app]));
    launchers.set(app,b);dock.append(b);
  }
  const separator=el('span','mac-dock-sep');dock.append(separator);
  const trash=action('',()=>showApp('finder'),'mac-dock-item mac-dock-trash');
  trash.title='Trash';trash.setAttribute('aria-label','Trash');trash.append(glyph('trash'),el('span','mac-dock-label','Trash'));dock.append(trash);

  desktop.append(wallpaper,iconLayer,widget,layer,dock);
  root.append(appleMenu,bar,desktop);

  /* ------------------------------------------------------- window layer. */
  const manager=createWindowManager(layer,app=>{
    root.dataset.app=app;
    setLabel(appName,app==='desktop'?'Finder':menuNames[app]);
    for(const [key,b] of launchers){const state=manager.state(key);b.dataset.state=state;b.classList.toggle('is-running',state!=='closed');b.setAttribute('aria-current',String(app===key));}
  });

  /* ------------------------------------------------------------ Finder. */
  const finderRoot=el('div','mac-finder');
  const finderSidebar=el('aside','mac-finder-sidebar');
  const finderMain=el('div','mac-finder-main');
  const finderToolbar=el('div','mac-finder-toolbar');
  const finderBack=action('',()=>finderHistory(-1),'mac-finder-nav');finderBack.append(el('span','','‹'));finderBack.title='Back';finderBack.setAttribute('aria-label','Back');
  const finderForward=action('',()=>finderHistory(1),'mac-finder-nav');finderForward.append(el('span','','›'));finderForward.title='Forward';finderForward.setAttribute('aria-label','Forward');
  const finderTitle=el('b','mac-finder-title','Recents');
  const finderViews=el('div','mac-finder-views');
  const finderSearchWrap=el('label','mac-finder-search');finderSearchWrap.append(glyph('search'));
  const finderSearch=el('input','mac-finder-searchinput');finderSearch.type='search';finderSearch.placeholder='Search';finderSearch.setAttribute('aria-label','Search files');finderSearchWrap.append(finderSearch);
  finderToolbar.append(finderBack,finderForward,finderTitle,el('span','mac-toolbar-spacer'),finderViews,finderSearchWrap);
  const finderHead=el('div','mac-finder-head');
  finderHead.append(el('span','','Name'),el('span','','Kind'),el('span','','Date Modified'),el('span','','Size'));
  const finderList=el('div','mac-finder-list');
  const finderStatus=el('div','mac-finder-status');
  finderMain.append(finderToolbar,finderHead,finderList,finderStatus);
  finderRoot.append(finderSidebar,finderMain);

  let finderPath='recents';
  let finderSelection='';
  let finderQuery='';
  let finderCustomMode=false;
  const finderHistoryStack:string[]=[];
  let finderHistoryIndex=-1;

  function openApp(app:WindowApp){showApp(app);}
  function folderEntries(id:string):FinderEntry[]{
    const folder=(name:string,target:string,meta='Folder'):FinderEntry=>({id:'folder-'+target,name,kind:meta,meta:'Folder',icon:'folder',folder:target});
    const appEntry=(app:WindowApp,name:string,kind:string,meta:string):FinderEntry=>({id:'app-'+app,name,kind,meta,icon:app as Glyph,app});
    switch(id){
      case 'home':return [
        folder('Applications','applications'),folder('Documents','documents'),
        folder('Desktop','desktop'),folder('Downloads','downloads'),
        {id:'readme',name:'Read Me.txt',kind:'Plain Text',meta:'Today',icon:'text',open:()=>showApp('about')},
      ];
      case 'applications':{
        const rows:FinderEntry[]=[
          appEntry('agent','Harness','Application','Local AI · on-device'),
          appEntry('terminal','Terminal','Application','Utilities'),
          appEntry('map','Maps','Application','Campus map'),
          appEntry('logs','Mission Logs','Document','Story progress'),
        ];
        if(options.devTools&&options.mission)rows.push(appEntry('mission','Vibe Console','Application','Review only'));
        if(options.devTools&&options.robotics)rows.push(appEntry('robotics','Robotics','Application','Review only'));
        return rows;
      }
      case 'documents':{
        const rows:FinderEntry[]=[
          {id:'invitation',name:'High Table Invitation.pdf',kind:'PDF Document',meta:'11月21日',icon:'pdf',open:()=>showApp('invitation')},
          {id:'map',name:'Campus Map.pdf',kind:'PDF Document',meta:'Today',icon:'pdf',open:()=>showApp('map')},
          {id:'logs',name:'Mission Logs.md',kind:'Markdown',meta:'Today',icon:'text',open:()=>showApp('logs')},
          {id:'about',name:'Device Information.txt',kind:'Plain Text',meta:'Today',icon:'text',open:()=>showApp('about')},
        ];
        if(options.files)rows.push({id:'campus-records',name:'Campus Records',kind:'Folder',meta:'Survey archive',icon:'folder',open:()=>openCustomFiles()});
        return rows;
      }
      case 'desktop':return [
        {id:'invitation',name:'High Table Invitation.pdf',kind:'PDF Document',meta:'11月21日',icon:'pdf',open:()=>showApp('invitation')},
        {id:'map',name:'Campus Map.pdf',kind:'PDF Document',meta:'Today',icon:'pdf',open:()=>showApp('map')},
      ];
      case 'downloads':return [
        {id:'alert',name:'campus-alert.txt',kind:'Plain Text',meta:'Today',icon:'text',open:()=>showApp('logs')},
        {id:'readme',name:'Read Me.txt',kind:'Plain Text',meta:'Today',icon:'text',open:()=>showApp('about')},
      ];
      default:return [
        {id:'invitation',name:'High Table Invitation.pdf',kind:'PDF Document',meta:'11月21日',icon:'pdf',open:()=>showApp('invitation')},
        {id:'logs',name:'Mission Logs.md',kind:'Markdown',meta:'Today',icon:'text',open:()=>showApp('logs')},
        {id:'map',name:'Campus Map.pdf',kind:'PDF Document',meta:'Today',icon:'pdf',open:()=>showApp('map')},
        {id:'agent',name:'Harness','kind':'Application',meta:'Local AI',icon:'agent',app:'agent'},
      ];
    }
  }
  function finderSidebarGroups(){
    finderSidebar.replaceChildren();
    const groups:[string,Array<[string,string]>][]=[
      ['Favorites',[['Recents','recents'],['Applications','applications'],['Desktop','desktop'],['Documents','documents'],['Downloads','downloads']]],
      ['Locations',[['Macintosh HD','home']]],
    ];
    for(const [title,rows] of groups){
      finderSidebar.append(el('h4','mac-finder-sidehead',title));
      for(const [label,id] of rows){
        const b=action(label,()=>finderGo(id),'mac-finder-sideitem');
        b.dataset.folder=id;b.classList.toggle('is-active',finderPath===id&&!finderCustomMode);
        finderSidebar.append(b);
      }
    }
    const foot=el('p','mac-finder-sidefoot','MacBook Air · 2030');
    finderSidebar.append(foot);
  }
  function finderGo(id:string,remember=true){
    finderPath=id;finderSelection='';finderQuery='';finderCustomMode=false;finderSearch.value='';
    if(remember){finderHistoryStack.splice(finderHistoryIndex+1);finderHistoryStack.push(id);finderHistoryIndex=finderHistoryStack.length-1;}
    renderFinder();
  }
  function finderHistory(step:number){
    const next=finderHistoryIndex+step;
    if(next<0||next>=finderHistoryStack.length)return;
    finderHistoryIndex=next;finderPath=finderHistoryStack[next];finderSelection='';finderQuery='';finderCustomMode=false;
    finderSearch.value='';renderFinder();
  }
  function openCustomFiles(){
    if(!options.files)return;
    finderCustomMode=true;
    finderMain.replaceChildren(finderToolbar,el('div','mac-finder-document'));
    const doc=finderMain.querySelector<HTMLElement>('.mac-finder-document')!;
    doc.append(options.files.body);
    finderTitle.textContent='Campus Records';
    finderStatus.textContent='Survey archive · opening this file reads the collected campus records.';
    finderHead.hidden=true;
    options.files.activate();
    finderBack.disabled=finderHistoryIndex<=0;
    finderForward.disabled=true;
  }
  function renderFinder(){
    finderSidebarGroups();
    finderMain.replaceChildren(finderToolbar,finderHead,finderList,finderStatus);
    finderHead.hidden=false;
    const all=folderEntries(finderPath);
    const entries=finderQuery?all.filter(entry=>entry.name.toLowerCase().includes(finderQuery.toLowerCase())):all;
    finderTitle.textContent=finderPath==='home'?'Macintosh HD':finderPath.charAt(0).toUpperCase()+finderPath.slice(1);
    finderBack.disabled=finderHistoryIndex<=0;
    finderForward.disabled=finderHistoryIndex>=finderHistoryStack.length-1;
    finderList.replaceChildren();
    if(!entries.length){
      finderList.append(el('p','mac-finder-empty','No items'));
    }
    for(const entry of entries){
      const row=el('button','mac-finder-row');row.type='button';row.dataset.entry=entry.id;
      row.append(glyph(entry.icon),el('span','mac-finder-name',entry.name),el('span','mac-finder-kind',entry.kind),el('span','mac-finder-date',entry.meta),el('span','mac-finder-size',entry.app?'—':'—'));
      row.classList.toggle('is-selected',finderSelection===entry.id);
      const open=()=>{
        if(entry.folder)finderGo(entry.folder);
        else if(entry.app)openApp(entry.app);
        else entry.open?.();
      };
      row.addEventListener('click',()=>{finderSelection=entry.id;for(const item of Array.from(finderList.querySelectorAll('.mac-finder-row')))item.classList.toggle('is-selected',item===row);});
      row.addEventListener('dblclick',open);
      row.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();open();}});
      finderList.append(row);
    }
    finderStatus.textContent=entries.length+' items · 128.4 GB available · Macintosh HD';
    finderSearch.disabled=false;
  }
  finderSearch.addEventListener('input',()=>{finderQuery=finderSearch.value;renderFinder();});

  /* ------------------------------------------------------------- Logs. */
  const logRoot=el('article','mac-document mac-logs');
  const logObjective=el('h2');
  const logDetail=el('p');
  const history=el('ol','mac-history');
  let logSig='';
  logRoot.append(el('p','mac-eyebrow','ACTIVE MISSION'),logObjective,logDetail,el('h3','mac-document-h3','Activity'),history);
  function renderLogs(){
    if(options.logs)return;
    if(!view)return;
    setLabel(logObjective,view.objective);
    setLabel(logDetail,view.detail);
    const sig=view.story.events.join('|');
    if(sig!==logSig){logSig=sig;history.replaceChildren(...view.story.events.map(e=>el('li','',eventLabels[e]??e)));}
  }

  /* -------------------------------------------------------- Map window. */
  const mapRoot=el('div','mac-map');
  const mapCanvas=el('canvas','mac-map-canvas');mapCanvas.width=620;mapCanvas.height=680;
  mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Campus map showing the player and objective');
  const mapSide=el('aside','mac-map-info');
  const mapObjective=el('h2');
  const mapDetail=el('p');
  const mapStatus=el('p','mac-map-status');
  mapSide.append(el('p','mac-eyebrow','CURRENT OBJECTIVE'),mapObjective,mapDetail,mapStatus,el('p','mac-muted',options.mission?.mapLegend??'North is up. Follow the orange objective marker.'));
  mapRoot.append(mapCanvas,mapSide);

  /* ------------------------------------------------------- Terminal. */
  const terminalRoot=el('div','mac-terminal');
  const terminalOutput=el('pre','mac-terminal-text');
  terminalRoot.append(terminalOutput);

  /* ------------------------------------------------------ Invitation. */
  function invitationBody(){
    const info=OPENING_UI.invitation;
    const body=el('div','mac-invitation');
    const paper=el('article','mac-invite-paper');
    paper.append(
      el('p','mac-invite-top',info.eyebrow),el('div','mac-invite-crest','HKU'),
      el('h1','mac-invite-title',info.title),el('p','mac-invite-note',info.body),
      el('p','mac-invite-note',info.provisioned),
    );
    const side=el('aside','mac-invite-side');
    side.append(el('p','mac-eyebrow','PREVIEW'),el('h3','','High Table Dinner'),el('p','mac-muted','The presentation MacBook holds the invitation, the campus map and the recovery assistant.'));
    body.append(paper,side);
    return body;
  }

  /* ------------------------------------------------------------- About. */
  function aboutBody(){
    const body=el('div','mac-about');
    const art=el('div','mac-about-art');art.append(glyph('apple'));
    const info=el('div','mac-about-info');
    info.append(el('h2','','MacBook Air'),el('p','mac-muted','13-inch · CampusOS 15.1 · HKU Shanghai'));
    const grid=el('dl','mac-about-grid');
    for(const [key,value] of [['Chip','Campus M3'],['Memory','16 GB'],['Storage','512 GB SSD'],['Local AI','Harness · on-device'],['Serial','HKUSH-2030-0417'],['Network','Campus intranet']] as const){
      grid.append(el('dt','',key),el('dd','',value));
    }
    info.append(grid);
    body.append(art,info);
    return body;
  }

  /* ---------------------------------------------- Review-only apps. */
  const appContent=new Map<WindowApp,{root:HTMLElement;key:string}>();
  function permissionBody(app:'robotics'|'mission'){
    const container=el('div','mac-permission');appContent.set(app,{root:container,key:''});return container;
  }
  function refreshPermissions(app:'robotics'|'mission',reopened=false){
    const entry=appContent.get(app);if(!entry)return;
    const value=access(),extension=app==='robotics'?options.robotics:options.mission;
    const devices=app==='robotics'&&!extension?(options.devices?.()??[]):[];
    const key=value+'|'+(extension?'adapter':'')+'|'+JSON.stringify(devices);
    // A reopened window keeps its body; re-activate so the mounted app refreshes its live state.
    if(key===entry.key){if(reopened&&value!=='locked'&&extension)extension.activate();return;}
    entry.key=key;
    if(value!=='locked'&&extension){entry.root.replaceChildren(extension.body);extension.activate();return;}
    entry.root.replaceChildren();
    const body=el('article','mac-document');
    body.append(el('p','mac-eyebrow',names[app]),el('h2','',extension?'Service unavailable':'Backup compute required'),
      el('p','mac-muted',value==='locked'?'Connect the Building 4 backup supercomputer to open this app.':'The campus node has not provided this service.'));
    entry.root.append(body);
  }

  /* ------------------------------------------------------- assistant. */
  const assistant=createAssistantApp({
    agent:options.agent,
    context:()=>view&&({story:view.story,runtime:view.runtime,player:view.player,computeStatus:access()==='locked'?'unavailable':access()==='exercise'?'exercise':'connected'}),
    objective:()=>view?.objective??'',detail:()=>view?.detail??'',
    sessionKey:options.sessionKey??(options.mission?'lawn':'opening'),
  });

  function windowTitle(app:WindowApp){
    switch(app){
      case 'finder':return 'Finder';
      case 'agent':return 'Harness';
      case 'map':return 'Maps';
      case 'terminal':return 'Terminal — zsh';
      case 'logs':return 'Mission Logs';
      case 'invitation':return 'High Table Invitation.pdf';
      case 'about':return 'About This Mac';
      default:return names[app];
    }
  }
  function buildBody(app:WindowApp){
    switch(app){
      case 'finder':return finderRoot;
      case 'logs':return options.logs?.body??logRoot;
      case 'map':return mapRoot;
      case 'agent':return assistant.root;
      case 'mission':case 'robotics':return permissionBody(app);
      case 'terminal':return terminalRoot;
      case 'invitation':return invitationBody();
      case 'about':return aboutBody();
    }
  }
  function showApp(app:MacApp|'tasks'|'home'){
    if(alertOpen)return;
    if(appleOpen)toggleAppleMenu(false);
    if(app==='desktop'){manager.desktop();return;}
    const target:WindowApp=app==='tasks'||app==='home'?'logs':app;
    if(target==='mission'&&!options.mission)return;
    if(target==='robotics'&&!options.robotics)return;
    manager.open(target,windowTitle(target),()=>buildBody(target),()=>{
      if(target==='finder'&&finderHistoryIndex<0){finderGo('recents');}
      if(target==='logs')options.logs?.activate();
      if(target==='mission'||target==='robotics'){refreshPermissions(target,true);}
      if(target==='map')lastMap='';
    });
    if(target==='logs')renderLogs();
    updateChrome();
  }
  function focusFirst(){
    if(alertOpen){accept.focus({preventScroll:true});return;}
    const front=layer.querySelector<HTMLElement>('.mac-window.is-front:not([hidden])');
    if(front){(front.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)')??front).focus({preventScroll:true});}
    else (launchers.get('finder')??appleButton).focus({preventScroll:true});
  }
  function handleEscape(){
    if(alertOpen)return false;
    if(appleOpen){toggleAppleMenu(false);return true;}
    const app=manager.active;
    if(!manager.closeFront())return false;
    if(manager.active!=='desktop')focusFirst();
    else if(app!=='desktop')(launchers.get(app)??appleButton).focus({preventScroll:true});
    return true;
  }
  function toggleAppleMenu(open:boolean){
    appleOpen=open;appleMenu.hidden=!open;appleButton.setAttribute('aria-expanded',String(open));
    if(open)(appleMenu.querySelector('button')??appleMenu).focus({preventScroll:true});
    else if(appleMenu.contains(document.activeElement))appleButton.focus({preventScroll:true});
  }
  root.addEventListener('pointerdown',event=>{if(appleOpen&&!appleMenu.contains(event.target as Node)&&!appleButton.contains(event.target as Node))toggleAppleMenu(false);});

  /* --------------------------------------------------------- alert card. */
  const alert=el('section','mac-alert');alert.hidden=true;
  alert.setAttribute('role','alertdialog');alert.setAttribute('aria-modal','true');alert.setAttribute('aria-label','Campus security alert');
  const alertCard=el('div','mac-alert-card');
  const alertIcon=el('div','mac-alert-icon');alertIcon.append(glyph('lock'));
  const accept=action('Enable emergency assistance',()=>{if(!alertOpen)return;options.actions?.action('read_alert');},'mac-alert-primary');
  const alertSleep=action('Sleep',options.onClose,'mac-alert-secondary');
  const alertCopy=el('div','mac-alert-copy');
  alertCopy.append(el('p','mac-alert-eyebrow','CAMPUS SECURITY ALERT'),el('h2','','Security breach'),
    el('p','','The campus robotics network is compromised. I know. I did it.'),
    el('p','','The perimeter is sealed and external communication is blocked. You are inside the seal.'),
    el('p','','Emergency assistance is available on this MacBook. Local. Uninfected. The only thing on campus the invader does not own.'));
  alertCard.append(alertIcon,alertCopy);
  const alertActions=el('div','mac-alert-actions');alertActions.append(alertSleep,accept);alertCard.append(alertActions);
  alert.append(alertCard);root.append(alert);

  /* --------------------------------------------------------- chrome. */
  function terminalLines(){
    if(options.terminal)return options.terminal();
    if(options.mission)return options.mission.terminal();
    if(!view)return ['HKU-SHANGHAI-MACBOOK — zsh',''];
    return [
      'HKU-SHANGHAI-MACBOOK — zsh',
      'campus intranet ...... '+(emergency()?'blocked':'online'),
      'local agent .......... '+(access()==='locked'?'locked':'ready'),
      'power ................ '+(options.energy?.()??'Local device power'),
      'hearts ............... '+view.runtime.hearts+' / '+view.runtime.maxHearts,
      '', 'recovery@macbook ~ %',
    ];
  }
  function updateChrome(){
    if(!view)return;
    const nowMinute=Math.floor(Date.now()/60000);
    if(nowMinute!==lastClockMinute){
      lastClockMinute=nowMinute;
      clock.textContent=campusClock.format(Date.now());
      calendar.textContent=campusCalendar.format(Date.now());
    }
    const value=access(),sealed=emergency();
    const stage=value==='exercise'?'exercise':value==='connected'?'connected':sealed?'emergency':'normal';
    if(root.dataset.stage!==stage)root.dataset.stage=stage;
    wifi.classList.toggle('is-off',sealed);
    wifi.title=sealed?'Wi-Fi · external connection blocked':'Wi-Fi · campus intranet';
    batteryText.textContent='100%';
    battery.title=options.energy?.()??'Local device power';
    setLabel(widgetObjective,view.objective);
    setLabel(widgetDetail,view.detail);

    const shouldAlert=Boolean(view.story.campus_alert_triggered&&!view.story.alert_read);
    if(shouldAlert!==alertOpen){
      alertOpen=shouldAlert;alert.hidden=!shouldAlert;
      bar.inert=desktop.inert=shouldAlert;
      if(shouldAlert){toggleAppleMenu(false);queueMicrotask(()=>{if(alertOpen)accept.focus({preventScroll:true});});}
    }
    const phase=alertOpen?'alert':sealed?'night':'day';
    if(root.dataset.phase!==phase)root.dataset.phase=phase;
    if(manager.state('agent')==='visible')assistant.update();
    if(manager.state('terminal')==='visible')setLabel(terminalOutput,terminalLines().join('\n'));
    if(manager.state('logs')==='visible'&&!options.logs)renderLogs();
    if(manager.state('map')==='visible'){
      setLabel(mapObjective,view.objective);setLabel(mapDetail,view.detail);setLabel(mapStatus,sealed?'Security alert · perimeter sealed':'Campus systems online');
      const sig=[view.player[0],view.player[2],view.objective,stage].join('|');
      if(lastMap!==sig){options.drawMap(mapCanvas,true);lastMap=sig;}
    }
    refreshPermissions('mission');refreshPermissions('robotics');
  }
  function update(next:MacView){
    const routeChanged=requestedPage!==next.computerPage,wasAlert=alertOpen;
    requestedPage=next.computerPage;view=next;updateChrome();
    if(!alertOpen&&(routeChanged||wasAlert)&&requestedPage!=='tasks')showApp(requestedPage);
  }
  function open(next:MacView){
    requestedPage=null;lastMap='';
    if(finderHistoryIndex<0)finderGo('recents');
    update(next);
    if(!alertOpen&&manager.active==='desktop'&&next.computerPage!=='agent'&&next.computerPage!=='map')showApp(options.startApp??'finder');
  }
  function suspend(){assistant.suspend();if(appleOpen)toggleAppleMenu(false);}
  function dispose(){manager.dispose();assistant.dispose();options.agent.dispose();root.remove();}
  return{root,open,update,focusFirst,handleEscape,showDesktop:()=>showApp('desktop'),showApp,suspend,dispose,get app(){return manager.active;},get alertOpen(){return alertOpen;},get location(){return location();}};
}
