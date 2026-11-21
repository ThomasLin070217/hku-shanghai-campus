import type {CampusGame} from '../exploration/game';
import {createLocalAgent} from '../opening/agent';
import {createMacBookExperience} from '../opening/macbook';
import {createOpeningRuntime} from '../opening/runtime';
import {createOpeningState} from '../opening/state';
import {drawCampusMap} from './map';
import type {ComputerPage} from './survey';

/** The survey owns its own progress and inventory. These app views only read or submit to it. */
export function createSurveyMac(game:CampusGame, onClose:()=>void, persist:()=>void) {
  const files=document.createElement('section'), logs=document.createElement('section');
  files.className=logs.className='survey-records';
  const host=document.createElement('div');
  host.className='survey-device';host.hidden=true;host.tabIndex=-1;
  host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Campus survey MacBook');
  const objective=()=>game.survey.progress.completed?'Campus digital archive synced':'Visit three campus landmarks and sync the campus digital archive';
  function guidance(){
    const survey=game.survey.snapshot();
    const next=survey.objectives.find(item=>!item.collected);
    return next?'Collected '+survey.count+' / '+survey.total+' records. Head to '+next.name+', then press F facing the record point.':
      survey.archive?'Read the unlocked campus archive in Files.':'All records collected. Open Mission Logs and choose "Sync campus digital archive".';
  }
  const agent=createLocalAgent({
    greeting:guidance,suggestions:['Where to next?','How do I submit the campus archive?'],
    prompt:()=>objective()+'。'+guidance(),reply:()=>guidance(),
  });
  const row=(tag:'h2'|'h3'|'p'|'li',text:string)=>{
    const node=document.createElement(tag);node.textContent=text;return node;
  };
  function renderFiles(){
    const survey=game.survey.snapshot();
    files.replaceChildren(row('h2','Campus archive'));
    for(const clue of survey.collectedClues) files.append(row('h3',clue.title),row('p',clue.text));
    if(survey.archive)files.append(row('h3',survey.archive.title),row('p',survey.archive.text));
    if(!survey.collectedClues.length)files.append(row('p','Collected records are kept here. First stop: the CDS-1 entrance.'));
  }
  function renderLogs(){
    const survey=game.survey.snapshot();
    const list=document.createElement('ol');
    for(const place of survey.objectives)list.append(row('li',(place.collected?'Collected · ':'To visit · ')+place.name));
    const submit=document.createElement('button');submit.type='button';submit.id='submit-survey';
    submit.textContent=survey.archive?'Archive synced':'Sync campus digital archive';submit.disabled=!!survey.archive;
    const feedback=row('p',guidance());feedback.id='submit-feedback';feedback.setAttribute('role','status');
    submit.onclick=()=>{
      const result=game.survey.computer('submit');
      if(result.ok){persist();renderLogs();renderFiles();}
      else feedback.textContent=result.message;
    };
    const archive=document.createElement('button');archive.type='button';archive.textContent='View campus records';
    archive.onclick=()=>mac.showApp('finder');
    logs.replaceChildren(row('h2',objective()),row('p','Campus records '+survey.count+' / '+survey.total),list,submit,feedback,archive);
  }
  const deviceId=()=>game.inventory.slots.find(item=>item?.itemId==='macbook-air-13-silver')?.instanceId;
  const mac=createMacBookExperience({
    agent,onClose,drawMap:(canvas,large)=>drawCampusMap(canvas,game,large),
    files:{body:files,activate:renderFiles},logs:{body:logs,activate:renderLogs},
    sessionKey:()=> 'hku.macbook.chat.'+(deviceId()??'survey'),
  });
  // This scenario has no opening incident. Supply the neutral agent context without writing story flags.
  const story=createOpeningState(),runtime=createOpeningRuntime();
  function view(){
    story.laptop_acquired=game.inventory.slots.some(item=>item?.itemId==='macbook-air-13-silver');
    story.elapsedSeconds=game.survey.progress.elapsedSeconds;
    return {story,runtime,objective:objective(),detail:guidance(),player:game.body.position.toArray() as [number,number,number],computerPage:'tasks' as const};
  }
  host.append(mac.root);document.body.append(host);
  let previousFocus:HTMLElement|null=null;
  const events=new AbortController();
  document.addEventListener('keydown',event=>{
    if(host.hidden||event.isComposing)return;
    const editable=event.target instanceof HTMLElement && !!event.target.closest('textarea,input,select,[contenteditable="true"]');
    if(event.key==='Escape'||(event.code==='KeyC'&&!editable&&!event.metaKey&&!event.ctrlKey&&!event.altKey)){
      event.preventDefault();event.stopPropagation();
      if(!event.repeat && (event.key!=='Escape'||!mac.handleEscape()))onClose();
    } else if(event.key==='Tab'){
      const nodes=Array.from(host.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea,input,select,[tabindex="0"]')).filter(n=>n.offsetParent);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey && first===document.activeElement){event.preventDefault();last?.focus();}
      if(!event.shiftKey && last===document.activeElement){event.preventDefault();first?.focus();}
    }
  },{capture:true,signal:events.signal});
  let nextRefresh=0,activeRevision=-1;
  return {
    open(page?:ComputerPage){
      if(host.hidden)previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      host.hidden=false;mac.open(view());
      if(page)mac.showApp(page==='tasks'?'logs':page==='map'?'map':'finder');
      mac.focusFirst();
    },
    update(){
      if(host.hidden||performance.now()<nextRefresh)return;
      nextRefresh=performance.now()+200;
      mac.update(view());
      if(activeRevision!==game.survey.revision){
        activeRevision=game.survey.revision;renderFiles();renderLogs();
      }
    },
    close(){if(host.hidden)return;mac.suspend();host.hidden=true;previousFocus?.focus({preventScroll:true});previousFocus=null;},
    dispose(){events.abort();mac.dispose();host.remove();},
    get visible(){return !host.hidden;},
  };
}
