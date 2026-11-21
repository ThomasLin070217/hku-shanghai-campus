import type {OpeningUIActions,OpeningView} from './contracts';
import type {LocalAgent} from './agent';

/**
 * A MacBook desktop rendered inside the game modal.
 *
 * The design is original but deliberately follows the grammar of a modern Mac:
 * a translucent menu bar, a calm wallpaper, traffic-light window controls, a dock,
 * Finder/Map/Terminal windows and a local assistant app. No Apple asset is copied.
 *
 * The component owns only presentation and chat history. Story flags, the MacBook
 * item, pause state and the player body remain owned by the experience.
 */

export type MacApp='desktop'|'finder'|'map'|'agent'|'terminal'|'about'|'invitation'|'mission';
type MacView=Pick<OpeningView,'objective'|'detail'|'story'|'runtime'|'player'|'computerPage'>;

interface MacOptions{
 actions?:Pick<OpeningUIActions,'action'>;
 drawMap:(canvas:HTMLCanvasElement,large:boolean)=>void;
 onClose:()=>void;
 agent:LocalAgent;
 mission?:{
  title:string;
  location:string;
  mapLegend:string;
  terminal:()=>string[];
  body:HTMLElement;
  activate:()=>void;
 };
}

interface ChatEntry{role:'user'|'assistant'|'system';text:string;source?:'local-model'|'builtin'}

const ICONS={
 mission:'<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="6" width="54" height="52" rx="12" fill="#28654d"/><g fill="none" stroke="#d5f8b4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m23 23-9 9 9 9m18-18 9 9-9 9m-5-23-8 28"/></g></svg>',
 finder:`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="fnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd0ff"/><stop offset="1" stop-color="#2f7bff"/></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="12" fill="url(#fnd)"/><path d="M20 40c4 4 20 4 24 0" stroke="#0a2d63" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="23" cy="27" r="3" fill="#0a2d63"/><circle cx="41" cy="27" r="3" fill="#0a2d63"/><path d="M25 17c3 2 11 2 14 0" stroke="#eaf6ff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
 map:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="7" width="54" height="50" rx="10" fill="#dcefe0"/><path d="M14 44l12-20 8 12 6-9 10 17" stroke="#2d634c" stroke-width="3.4" fill="none" stroke-linejoin="round"/><circle cx="42" cy="20" r="4" fill="#b4812f"/><path d="M12 16h8M12 22h5" stroke="#91b49c" stroke-width="2.4"/></svg>`,
 agent:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="6" width="54" height="52" rx="12" fill="#132820"/><path d="M15 21h34v22H31l-9 8v-8h-7z" fill="#2d634c"/><circle cx="24" cy="32" r="2.6" fill="#d9f0d9"/><circle cx="32" cy="32" r="2.6" fill="#d9f0d9"/><circle cx="40" cy="32" r="2.6" fill="#d9f0d9"/></svg>`,
 terminal:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="7" width="54" height="50" rx="10" fill="#101614"/><path d="M15 22l10 8-10 8" stroke="#7be0a4" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 42h18" stroke="#7be0a4" stroke-width="4" stroke-linecap="round"/></svg>`,
 invitation:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="7" width="54" height="50" rx="10" fill="#f4eedc"/><rect x="13" y="15" width="38" height="34" rx="3" fill="#fbf7ea" stroke="#b4812f" stroke-width="2"/><path d="M13 22l19 13 19-13" fill="none" stroke="#2d634c" stroke-width="2.6"/><circle cx="32" cy="40" r="5" fill="#2d634c"/></svg>`,
 about:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="7" width="54" height="50" rx="10" fill="#e7ebe6"/><circle cx="32" cy="32" r="15" fill="none" stroke="#2d634c" stroke-width="3"/><path d="M32 29v10M32 23v2" stroke="#2d634c" stroke-width="3.4" stroke-linecap="round"/></svg>`,
};

function h<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text=''):HTMLElementTagNameMap[K]{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text)node.textContent=text;
 return node;
}
const clockString=()=>new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

export function createMacBookExperience(options:MacOptions){
 const {actions,drawMap,onClose,agent,mission}=options;
 let view:MacView|null=null;
 let app:MacApp='desktop';
 let booted=false;
 let alertOpen=false;
 let sending=false;
 let lastClock='';
 let lastScreen='';
 let mapDrawn=false;
 let zoomed=false;
 const chat:ChatEntry[]=[];

 const root=h('div','opening-mac');
 root.dataset.phase='day';
 root.dataset.app='desktop';

 // ------------------------------------------------------------ menu bar.
 const menubar=h('div','opening-mac-menubar');
 const menuLeft=h('div','opening-mac-menu-left');
 const brand=h('span','opening-mac-brand');
 brand.innerHTML='<b>◈</b>';
 menuLeft.append(brand,h('span','opening-mac-appname','Finder'));
 for(const label of ['File','Edit','View','Window','Help'])menuLeft.append(h('span','opening-mac-menuitem',label));
 const menuRight=h('div','opening-mac-menu-right');
 const netEl=h('span','opening-mac-net','◌ No network');
 const batteryEl=h('span','opening-mac-battery','▮▮▮▯ 64%');
 const clockEl=h('span','opening-mac-clock',clockString());
 menuRight.append(netEl,batteryEl,clockEl);
 if(mission){
  const sleep=h('button','opening-mac-closehint','合上电脑　Esc');
  sleep.type='button';sleep.dataset.macSleep='';sleep.addEventListener('click',onClose);
  menuRight.append(sleep);
 }
 menubar.append(menuLeft,menuRight);

 // ------------------------------------------------------------- desktop.
 const desktop=h('div','opening-mac-desktop');
 const wallpaper=h('div','opening-mac-wallpaper');
 wallpaper.innerHTML='<i class="opening-mac-sun"></i><i class="opening-mac-blob a"></i><i class="opening-mac-blob b"></i><i class="opening-mac-grid"></i>';
 const desktopIcons=h('div','opening-mac-desktopicons');
 const icon=(appName:MacApp,label:string,iconSvg:string)=>{
  const button=h('button','opening-mac-desktopicon');
  button.type='button';button.dataset.app=appName;
  const art=h('span','opening-mac-desktopicon-art');art.innerHTML=iconSvg;
  button.append(art,h('span','opening-mac-desktopicon-label',label));
  button.addEventListener('dblclick',()=>setApp(appName));
  button.addEventListener('click',()=>setApp(appName));
  desktopIcons.append(button);
 };
 if(mission)icon('mission',mission.title,ICONS.mission);
 icon('finder','Local Disk',ICONS.finder);
 icon('map','Campus Map',ICONS.map);
 icon('agent','Recovery Agent',ICONS.agent);
 icon('invitation','Invitation',ICONS.invitation);

 const windowHost=h('div','opening-mac-windowhost');
 const statusCard=h('section','opening-mac-statuscard');
 statusCard.innerHTML='<p class="opening-mac-status-eyebrow">HKU SHANGHAI · LOCAL RECOVERY</p><h3>Machine access</h3><p class="opening-mac-status-copy">External network is blocked. The Local Agent can read this device and the campus state.</p><div class="opening-mac-status-row"><span>Objective</span><b data-role="objective">—</b></div><div class="opening-mac-status-row"><span>Hearts</span><b data-role="hearts">10 / 10</b></div><div class="opening-mac-status-row"><span>Network</span><b class="is-critical">SEALED</b></div><p class="opening-mac-status-hint">Open <b>Recovery Agent</b> from the dock to continue.</p>';
 const desktopArea=h('div','opening-mac-desktoparea');
 if(mission){
  const launch=h('button','opening-mac-secondary','打开'+mission.title);
  launch.type='button';launch.dataset.launchMission='';
  launch.addEventListener('click',()=>setApp('mission'));statusCard.append(launch);
 }
 desktopArea.append(statusCard);
 const windowLayer=h('div','opening-mac-windowlayer');
 const alertLayer=h('div','opening-mac-alert');
 alertLayer.hidden=true;

 const alertCard=h('div','opening-mac-alertcard');
 const alertHead=h('div','opening-mac-alerthead');
 alertHead.innerHTML='<span class="opening-mac-alert-mark">!</span><div><p class="opening-mac-alert-eyebrow">CAMPUS NETWORK · CRITICAL</p><h2>Security breach</h2></div>';
 const alertList=h('ul','opening-mac-alertlist');
 for(const [title,body] of [
  ['Network intelligence takeover','The campus AI core is issuing commands to door control, cameras and security robots.'],
  ['Perimeter containment','An external barrier is active. No message can leave the campus.'],
  ['Robots compromised','Security units no longer accept campus control. Avoid their red scan cones.'],
  ['Emergency route open','Building 4 main entrance can still accept the presentation MacBook.'],
 ] as [string,string][]){
  const li=h('li');li.append(h('b','',title),document.createTextNode(body));alertList.append(li);
 }
 const alertActions=h('div','opening-mac-alertactions');
 const enableBtn=h('button','opening-mac-alertprimary','Enable emergency assistance');
 enableBtn.type='button';enableBtn.dataset.autofocus='true';
 const laterBtn=h('button','opening-mac-alertsecondary','Put MacBook to sleep');
 laterBtn.type='button';
 alertActions.append(enableBtn,laterBtn);
 alertCard.append(alertHead,h('p','opening-mac-alertintro','This alert was generated on the device itself. No outside connection was used.'),alertList,h('p','opening-mac-alertfoot','Detected locally · 14 NOV 2030 · 18:41'),alertActions);
 alertLayer.append(alertCard);

 desktop.append(wallpaper,desktopIcons,desktopArea,windowLayer,alertLayer);

 // ---------------------------------------------------------------- dock.
 const dock=h('div','opening-mac-dock');
 const dockItems:HTMLButtonElement[]=[];
 const addDock=(appName:MacApp,label:string,svg:string)=>{
  const button=h('button','opening-mac-dockitem');
  button.type='button';button.dataset.app=appName;button.title=label;button.setAttribute('aria-label',label);
  const art=h('span','opening-mac-dockicon');art.innerHTML=svg;
  const dot=h('i','opening-mac-dockdot');
  button.append(art,dot);
  button.addEventListener('click',()=>setApp(appName));
  dock.append(button);dockItems.push(button);
 };
 addDock('finder','Finder',ICONS.finder);
 addDock('map','Campus Map',ICONS.map);
 addDock('agent','Local Agent',ICONS.agent);
 addDock('terminal','Terminal',ICONS.terminal);
 addDock('invitation','High Table invitation',ICONS.invitation);
 addDock('about','About this Mac',ICONS.about);
 if(mission)addDock('mission',mission.title,ICONS.mission);

 root.append(menubar,desktop,dock);
 const appName=menuLeft.querySelector<HTMLElement>('.opening-mac-appname')!;

 // ------------------------------------------------------------- windows.
 function windowShell(className:string,title:string,subtitle:string,body:HTMLElement,fill=false){
  const shell=h('section','opening-mac-window '+className+(fill?' is-fill':''));
  const bar=h('div','opening-mac-titlebar');
  const lights=h('div','opening-mac-lights');
  const red=h('button','opening-mac-light red');red.type='button';red.setAttribute('aria-label',mission?'关闭窗口':'Close MacBook');red.addEventListener('click',mission?()=>setApp('desktop'):onClose);
  const yellow=h('button','opening-mac-light yellow');yellow.type='button';yellow.setAttribute('aria-label','Minimize window');yellow.addEventListener('click',()=>setApp('desktop'));
  const green=h('button','opening-mac-light green');green.type='button';green.setAttribute('aria-label','Zoom window');green.addEventListener('click',()=>{zoomed=!zoomed;root.classList.toggle('is-zoomed',zoomed);});
  lights.append(red,yellow,green);
  const titles=h('div','opening-mac-titles');titles.append(h('b','',title),h('span','',subtitle));
  bar.append(lights,titles);
  shell.append(bar,body);
  return shell;
 }
 function toolbar(children:HTMLElement[]){
  const bar=h('div','opening-mac-toolbar');bar.append(...children);return bar;
 }

 function renderDesktop(){
  const objective=view?.objective??'Read the invitation';
  const hearts=view?`${view.runtime.hearts} / ${view.runtime.maxHearts}`:'10 / 10';
  setRow('objective',objective);setRow('hearts',hearts);
  const note=statusCard.querySelector<HTMLElement>('.opening-mac-status-hint');
  if(note){
   if(mission)note.textContent='从桌面或程序坞打开「'+mission.title+'」。';
   else note.innerHTML=view?.runtime.agent_chat_unlocked?'Open <b>Recovery Agent</b> from the dock to reach Building 4.':'The MacBook is ready. The <b>Recovery Agent</b> unlocks after the campus alert.';
  }
 }
 function setRow(role:string,value:string){
  const el=statusCard.querySelector<HTMLElement>(`[data-role="${role}"]`);if(el)el.textContent=value;
 }

 function finderApp(){
  const body=h('div','opening-mac-finder');
  const sidebar=h('aside','opening-mac-sidebar');
  const group=h('div','opening-mac-sidegroup');
  group.append(h('p','opening-mac-sidehead','Favourites'));
  for(const label of ['Today','Campus','Downloads','Recovery']){const item=h('button','opening-mac-sideitem',label);item.type='button';if(label==='Campus')item.classList.add('is-active');group.append(item);}
  sidebar.append(group);
  sidebar.append(h('p','opening-mac-sidehead','Locations'),h('p','opening-mac-sideitem is-muted','Local Disk'),h('p','opening-mac-sideitem is-muted','External — blocked'));
  const main=h('div','opening-mac-findermain');
  main.append(h('p','opening-mac-path','Local Disk › Student Ambassador › High Table'));
  const list=h('div','opening-mac-filelist');
  const files:[string,string,MacApp,string][]=[
   ['High Table Invitation.pdf','PDF · 1 page','invitation','Today 18:12'],
   ['Local Agent.app','Recovery assistant','agent','Today 18:41'],
   ['Campus Map.app',mission?.location??'Opening route','map','Today 18:40'],
   ['Recovery notes.txt','Plain text','terminal','Today 18:41'],
   ['Presentation.key','Keynote · 42 MB','about','12 Nov 2030'],
  ];
  if(mission)files.unshift([mission.title+'.app','Recovery application','mission','Today']);
  for(const [name,kind,appName,meta] of files){
   const row=h('button','opening-mac-filerow');row.type='button';
   const ic=h('span','opening-mac-fileicon');ic.innerHTML=appName==='mission'?ICONS.mission:appName==='agent'?ICONS.agent:appName==='map'?ICONS.map:appName==='terminal'?ICONS.terminal:ICONS.invitation;
   row.append(ic,h('span','opening-mac-filename',name),h('span','opening-mac-filekind',kind),h('span','opening-mac-filemeta',meta));
   row.addEventListener('dblclick',()=>setApp(appName));
   row.addEventListener('click',()=>{for(const other of Array.from(list.querySelectorAll('.is-selected')))other.classList.remove('is-selected');row.classList.add('is-selected');});
   list.append(row);
  }
  main.append(toolbar([h('span','opening-mac-tool-text',files.length+' items · Local Disk'),h('span','opening-mac-tool-spacer'),h('span','opening-mac-tool-status','External volumes unavailable')]),list);
  body.append(sidebar,main);
  return windowShell('finder','Finder','Local Disk › High Table',body,true);
 }

 function mapApp(){
  const body=h('div','opening-mac-map');
  const canvas=h('canvas','opening-mac-mapcanvas');canvas.width=620;canvas.height=680;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',mission?.location??'Campus map with the current opening route. North is up.');
  const side=h('aside','opening-mac-mapinfo');
  side.append(h('p','opening-mac-eyebrow','CAMPUS ROUTE'),h('h3','',mission?.location??'Building 4 · main entrance'),h('p','opening-mac-muted',mission?.mapLegend??'The blue arrow is you. Orange is the current objective. The dashed line is the safe walking surface, not indoor navigation.'));
  const objective=h('div','opening-mac-card');
  objective.append(h('p','opening-mac-cardlabel','CURRENT OBJECTIVE'),h('b','opening-mac-cardtitle',view?.objective??'—'),h('p','opening-mac-muted',view?.detail??''));
  side.append(objective);
  if(!mission)side.append(h('p','opening-mac-muted','Legend · North up · red scan cones indicate robot coverage.'));
  body.append(canvas,side);
  mapDrawn=false;
  requestAnimationFrame(()=>{if(!mapDrawn){mapDrawn=true;try{drawMap(canvas,true);}catch{/* keep the window alive */}}});
  return windowShell('map','Campus Map',mission?.location??'Opening route · sealed perimeter',body,true);
 }

 function agentApp(){
  const body=h('div','opening-mac-agent');
  const side=h('aside','opening-mac-agentside');
  side.append(h('p','opening-mac-sidehead','Local Agent'));
  const card=h('div','opening-mac-agentcard');
  card.innerHTML='<span class="opening-mac-avatar" aria-hidden="true">◈</span><div><b>Recovery Assistant</b><span>On-device model · offline</span></div>';
  side.append(card);
  const status=h('p','opening-mac-agentstatus');
  status.dataset.role='agent-status';
  const currentStatus=agent.status();
  status.textContent=currentStatus.mode==='local-model'?'Local model connected':currentStatus.mode==='checking'?'Checking local model…':'Built-in recovery core';
  side.append(status);
  const objectiveBox=h('div','opening-mac-card');
  objectiveBox.append(h('p','opening-mac-cardlabel','CURRENT OBJECTIVE'),h('b','opening-mac-cardtitle',view?.objective??'—'),h('p','opening-mac-muted',view?.detail??''));
  side.append(objectiveBox);
  side.append(h('p','opening-mac-sidefoot','This assistant runs on the MacBook. It cannot move you, control robots or open the curtain.'));

  const main=h('main','opening-mac-agentmain');
  const head=h('header','opening-mac-agenthead');
  head.append(h('div','opening-mac-agentheadtext',view?.story.alert_read?'Emergency assistance enabled':'Recovery assistant'));
  head.append(h('span','opening-mac-agentchip',view?.runtime.agent_chat_unlocked?'ONLINE':'LOCKED'));
  main.append(head);
  const stream=h('div','opening-mac-chatstream');stream.dataset.role='chat-stream';
  main.append(stream);
  const quick=h('div','opening-mac-quick');quick.dataset.role='quick';
  const composer=h('form','opening-mac-composer');
  const input=h('textarea','opening-mac-input');
  input.rows=1;input.placeholder=view?.runtime.agent_chat_unlocked?'Ask the Local Agent…':'Confirm the alert to unlock the Local Agent';
  input.maxLength=800;input.disabled=!view?.runtime.agent_chat_unlocked;
  input.setAttribute('aria-label','Message the local agent');
  input.dataset.role='agent-input';
  input.dataset.autofocus='true';
  const send=h('button','opening-mac-send','Send');send.type='submit';send.disabled=!view?.runtime.agent_chat_unlocked;
  send.dataset.role='agent-send';
  composer.append(input,send);
  const hint=h('p','opening-mac-composerhint','Enter to send · Shift + Enter for a new line · Local only');
  main.append(quick,composer,hint);
  body.append(side,main);

  // Wire chat.
  composer.addEventListener('submit',event=>{event.preventDefault();void sendMessage();});
  input.addEventListener('keydown',event=>{
   if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void sendMessage();}
   event.stopPropagation();
  });
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(120,input.scrollHeight)+'px';});
  fillChat(stream);
  fillQuick(quick);
  requestAnimationFrame(()=>{stream.scrollTop=stream.scrollHeight;if(view?.runtime.agent_chat_unlocked)input.focus({preventScroll:true});});
  return windowShell('agent','Local Agent','Campus Recovery Assistant',body,true);
 }

 function terminalApp(){
  const body=h('div','opening-mac-terminal');
  const pre=h('pre','opening-mac-terminaltext');
  const lines=mission?.terminal()??[
   'HKU-SHANGHAI-MACBOOK — recovery shell',
   'user: ambassador   mode: offline',
   '',
   '[18:40:58] ifconfig en0 ........ DOWN (external link lost)',
   '[18:41:02] ai-core telemetry .... HOSTILE',
   '[18:41:04] robot fleet ......... 8 units / control lost',
   '[18:41:07] perimeter barrier ... DEPLOYED',
   '[18:41:11] local agent ......... ONLINE (on-device)',
   '[18:41:15] emergency relay ..... BUILDING 4 / MAIN ENTRANCE',
   '',
   'Type is disabled in recovery mode. Open Local Agent to continue.',
   '',
   'recovery@macbook ~ %',
  ];
  pre.textContent=lines.join('\n');
  const toolbarEl=toolbar([h('span','opening-mac-tool-text','recovery shell'),h('span','opening-mac-tool-spacer'),h('span','opening-mac-tool-status','read only')]);
  body.append(toolbarEl,pre);
  return windowShell('terminal','Terminal','recovery@macbook — offline',body,true);
 }

 function aboutApp(){
  const body=h('div','opening-mac-about');
  const cardArt=h('div','opening-mac-aboutart');cardArt.innerHTML=ICONS.agent;
  const info=h('div','opening-mac-aboutinfo');
  info.append(h('p','opening-mac-eyebrow','THIS MAC'),h('h3','','MacBook Air · 13-inch'),h('p','opening-mac-muted','Recovery build · 2030.11.14 · Original game UI, not an Apple asset.'));
  const grid=h('dl','opening-mac-aboutgrid');
  for(const [k,v] of [['Chip','Local recovery M-series'],['Network','Sealed by AI barrier'],['Storage',mission?'Local recovery volume':'5 files · 42 MB'],['Agent','On-device · offline'],['Owner','Student Ambassador']]){
   const row=h('div');row.append(h('dt','',k),h('dd','',v));grid.append(row);
  }
  info.append(grid);
  body.append(cardArt,info);
  return windowShell('about','About This Mac','MacBook Air · Recovery Build',body);
 }

 function invitationApp(){
  const body=h('div','opening-mac-invitation');
  const paper=h('div','opening-mac-invite-paper');
  paper.innerHTML='<p class="opening-mac-invite-top">THE UNIVERSITY OF HONG KONG · SHANGHAI</p><div class="opening-mac-invite-crest">HKU</div><p class="opening-mac-invite-request">The Dean and Faculty request the pleasure of the company of</p><p class="opening-mac-invite-name">STUDENT AMBASSADOR</p><p class="opening-mac-invite-title">High Table Dinner</p><p class="opening-mac-invite-meta">BUILDING 5 · GROUND FLOOR<br>SATURDAY, 14 NOVEMBER 2030 · 18:30</p><p class="opening-mac-invite-note">Present this card at the ground-floor entrance and turn right after entering.</p>';
  const side=h('aside','opening-mac-invite-side');
  side.append(h('p','opening-mac-eyebrow','LOCAL COPY'),h('h3','','High Table Dinner'),h('p','opening-mac-muted','A presentation copy of the invitation stored on this MacBook. The printed card is in your pack narrative.'));
  const open=h('button','opening-mac-secondary','Return to Finder');open.type='button';open.addEventListener('click',()=>setApp('finder'));
  side.append(open);
  body.append(paper,side);
  return windowShell('invitation','Preview','High Table Invitation.pdf',body);
 }

 function renderWindow(){
  windowLayer.replaceChildren();
  mapDrawn=false;
  desktopArea.hidden=app!=='desktop';
  desktopIcons.hidden=app!=='desktop';
  root.dataset.app=app;
  appName.textContent=app==='mission'&&mission?mission.title:app==='desktop'?'Finder':app==='finder'?'Finder':app==='map'?'Campus Map':app==='agent'?'Local Agent':app==='terminal'?'Terminal':app==='about'?'About This Mac':'Preview';
  for(const button of dockItems)button.classList.toggle('is-active',button.dataset.app===app);
  if(app==='desktop'){renderDesktop();return;}
  if(app==='mission'&&mission){
   windowLayer.append(windowShell('mission',mission.title,mission.location,mission.body,true));
   mission.activate();
   return;
  }
  const viewNode=app==='finder'?finderApp():app==='map'?mapApp():app==='agent'?agentApp():app==='terminal'?terminalApp():app==='about'?aboutApp():invitationApp();
  windowLayer.append(viewNode);
}

 // ---------------------------------------------------------------- chat.
 function seedChat(){
  if(chat.length)return;
  const ctx=context();
  if(!ctx)return;
  chat.push({role:'system',text:'LOCAL AGENT · on-device session started · external network blocked'});
  chat.push({role:'assistant',text:agent.greeting(ctx),source:'builtin'});
 }
 function context():{story:OpeningView['story'];runtime:OpeningView['runtime'];player:[number,number,number]}|null{
  if(!view)return null;
  return{story:view.story,runtime:view.runtime,player:view.player};
 }
 function fillChat(stream:HTMLElement){
  stream.replaceChildren();
  for(const entry of chat){
   const row=h('div','opening-mac-msg is-'+entry.role);
   if(entry.role==='assistant'){const avatar=h('span','opening-mac-msgavatar','◈');row.append(avatar);}
   const bubble=h('div','opening-mac-msgbubble');
   if(entry.role==='system'){bubble.classList.add('opening-mac-msgsystem');bubble.textContent=entry.text;}
   else bubble.textContent=entry.text;
   row.append(bubble);
   if(entry.role==='assistant'&&entry.source)row.append(h('span','opening-mac-msgsource',entry.source==='local-model'?'local model':'built-in'));
   stream.append(row);
  }
  if(sending){
   const row=h('div','opening-mac-msg is-assistant');
   row.append(h('span','opening-mac-msgavatar','◈'));
   const bubble=h('div','opening-mac-msgbubble opening-mac-typing');
   bubble.innerHTML='<i></i><i></i><i></i>';
   row.append(bubble);stream.append(row);
  }
  stream.scrollTop=stream.scrollHeight;
 }
 function fillQuick(quick:HTMLElement){
  const ctx=context();
  const suggestions=ctx?agent.suggestions(ctx):[];
  const signature=JSON.stringify(suggestions);
  if(quick.dataset.suggestions===signature)return;
  quick.dataset.suggestions=signature;
  quick.replaceChildren();
  for(const suggestion of suggestions){
   const button=h('button','opening-mac-quickbtn',suggestion);
   button.type='button';button.addEventListener('click',()=>{const input=root.querySelector<HTMLTextAreaElement>('[data-role="agent-input"]');if(input){input.value=suggestion;input.focus();}});
   quick.append(button);
  }
 }
 function appendChat(entry:ChatEntry){
  chat.push(entry);
  const stream=root.querySelector<HTMLElement>('[data-role="chat-stream"]');
  if(stream){fillChat(stream);}
 }
 async function sendMessage(){
  if(sending||!view)return;
  const input=root.querySelector<HTMLTextAreaElement>('[data-role="agent-input"]');
  if(!input||input.disabled)return;
  const text=input.value.trim();
  if(!text)return;
  if(!view.runtime.agent_chat_unlocked){
   appendChat({role:'system',text:'Local Agent locked. Confirm the red campus alert first.'});
   return;
  }
  input.value='';input.style.height='auto';
  appendChat({role:'user',text});
  sending=true;
  const stream=root.querySelector<HTMLElement>('[data-role="chat-stream"]');
  if(stream)fillChat(stream);
  const statusEl=root.querySelector<HTMLElement>('[data-role="agent-status"]');
  try{
   const reply=await agent.ask(text,context()!);
   sending=false;
   appendChat({role:'assistant',text:reply.text,source:reply.source});
   if(statusEl)statusEl.textContent=reply.source==='local-model'?'Local model connected':'Built-in recovery core';
  }catch(error){
   sending=false;
   appendChat({role:'system',text:'Local Agent error: '+(error instanceof Error?error.message:'unavailable')});
  }
 }

 // --------------------------------------------------------------- alert.
 function syncAlert(){
  const should=!!view&&view.story.campus_alert_triggered&&!view.story.alert_read;
  if(should&&!alertOpen){alertOpen=true;alertLayer.hidden=false;root.dataset.phase='alert';appName.textContent='Security Alert';}
  else if(!should&&alertOpen){alertOpen=false;alertLayer.hidden=true;root.dataset.phase=view?.story.campus_alert_triggered?'night':'day';}
 }
 enableBtn.addEventListener('click',()=>{
  if(!view)return;
  alertOpen=false;alertLayer.hidden=true;
  actions?.action('read_alert');
  app='agent';
  appendChat({role:'system',text:'Emergency assistance enabled · Local Agent session promoted'});
  appendChat({role:'assistant',text:'I have control of this device only. The campus network is hostile, the perimeter is sealed, and external messages cannot leave. Your next objective is outside the Building 4 main entrance. Keep the MacBook in your pack. Ask me for directions when you are ready.',source:'builtin'});
  renderWindow();
  root.dataset.phase='night';
 });
 laterBtn.addEventListener('click',onClose);

 // ------------------------------------------------------------- lifecycle.
 function setApp(next:MacApp){
  if(alertOpen)return;
  app=next;zoomed=false;root.classList.remove('is-zoomed');renderWindow();
 }

 function open(nextView:MacView){
  view=nextView;
  if(!booted){
   booted=true;
   seedChat();
   app=nextView.runtime.agent_chat_unlocked?'agent':'finder';
  }
  syncAlert();
  if(nextView.story.campus_alert_triggered)root.dataset.phase='night';
  if(nextView.runtime.agent_chat_unlocked&&app==='desktop')app='agent';
  if(mission)app='desktop';
  else if(nextView.computerPage==='map')app='map';
  else if(nextView.computerPage==='agent')app='agent';
  renderWindow();
  updateChrome();
 }

 function update(nextView:MacView){
  view=nextView;
  syncAlert();
  root.dataset.phase=alertOpen?'alert':nextView.story.campus_alert_triggered?'night':'day';
  updateChrome();
 }

 function updateChrome(){
  const clock=clockString();
  if(clock!==lastClock){lastClock=clock;clockEl.textContent=clock;}
  netEl.textContent=view?.story.campus_alert_triggered?'● Network sealed':'◌ No network';
  netEl.classList.toggle('is-critical',!!view?.story.campus_alert_triggered);
  if(view){
   setRow('objective',view.objective);
   setRow('hearts',`${view.runtime.hearts} / ${view.runtime.maxHearts}`);
   const status=agent.status();
   const statusEl=root.querySelector<HTMLElement>('[data-role="agent-status"]');
   if(statusEl)statusEl.textContent=status.mode==='local-model'?'Local model connected':status.mode==='checking'?'Checking local model…':'Built-in recovery core';
   const chip=root.querySelector<HTMLElement>('.opening-mac-agentchip');
   if(chip)chip.textContent=view.runtime.agent_chat_unlocked?'ONLINE':'LOCKED';
   const input=root.querySelector<HTMLTextAreaElement>('[data-role="agent-input"]');
   const send=root.querySelector<HTMLButtonElement>('[data-role="agent-send"]');
   if(input){input.disabled=!view.runtime.agent_chat_unlocked;input.placeholder=view.runtime.agent_chat_unlocked?'Ask the Local Agent…':'Confirm the alert to unlock the Local Agent';}
   if(send)send.disabled=!view.runtime.agent_chat_unlocked||sending;
   if(app==='agent'){const head=root.querySelector<HTMLElement>('.opening-mac-agentheadtext');if(head)head.textContent=view.story.alert_read?'Emergency assistance enabled':'Recovery assistant';}
   if(app==='agent'){const quick=root.querySelector<HTMLElement>('[data-role="quick"]');if(quick)fillQuick(quick);}
  }
 }
 function focusFirst(){
  const preferred=root.querySelector<HTMLElement>('[data-autofocus]:not([disabled])');
  (preferred??root.querySelector<HTMLElement>('button:not([disabled]), textarea:not([disabled])'))?.focus({preventScroll:true});
 }

 function dispose(){
  agent.dispose();
  root.remove();
 }

 return{root,open,update,focusFirst,showDesktop:()=>setApp('desktop'),dispose,get app(){return app;},get alertOpen(){return alertOpen;}};
}
