import type {CompileSlots, ProjectId, SkillPlan, VibeService,ValidationCase} from './consoleService';
import './workbench.css';
export {compileBossIntent} from './intent';

export const skillMark:Record<ProjectId,string>={stun:'❄',lure:'⌘',ghost:'◎'};

export function createBossWorkbench(options:{host:HTMLElement;onClose:()=>void;service:VibeService;onDeploy?:()=>void}) {
  const {service}=options;
  let selected=service.projects[0].id;
  let plan:SkillPlan|null=null,tests:ValidationCase[]=[];
  let serial=0,busy=false,installed=false,disposed=false,lastRead='';
  const root=document.createElement('div');
  root.className='lion-workbench';root.hidden=true;
  root.setAttribute('aria-label','Vibe Console');
  root.innerHTML=`
    <div class="vc-workspace">
      <aside class="vc-projects"><h3>Skill workspace</h3><label class="vc-newproject"><span>＋ New skill</span><select aria-label="New skill project" data-wb="new"><option value="">Select a project</option></select></label><div data-wb="projects"></div>
        <section class="vc-slots"><h3>Compile slots</h3><ul data-wb="slots"></ul><small data-wb="count"></small></section></aside>
      <section class="vc-editor">
        <header class="vc-file"><i data-wb="symbol"></i><div><small>Skill project</small><h2 data-wb="title"></h2></div></header>
        <p class="vc-description" data-wb="description"></p>
        <div class="vc-label"><label for="lwb-intent">Natural-language instruction</label><button type="button" data-wb="sample">Use example</button></div>
        <textarea id="lwb-intent" data-wb="input" rows="4" maxlength="400" spellcheck="false"></textarea>
        <div class="vc-generate"><button class="vc-primary" type="button" data-wb="generate">Generate rule</button>
          <button type="button" data-wb="preset">Use offline preset</button><label data-wb="direction">Preset side <select data-wb="side"><option value="right">Right</option><option value="left">Left</option></select></label></div>
        <section class="vc-test"><div class="vc-label"><h3>Rule test</h3><button type="button" data-wb="test">Test skill</button></div>
          <div data-wb="log">After generating a plan, verify cast timing and target distance.</div></section>
      </section>
      <aside class="vc-inspector"><h3>Skill inspector</h3><dl data-wb="spec"></dl>
        <details data-wb="definition"><summary>View skill JSON</summary><pre></pre></details></aside>
    </div>
    <footer class="vc-footer"><div><small data-wb="provider"></small><p data-wb="status" role="status" aria-live="polite"></p></div>
    <button type="button" data-wb="uninstall">Uninstall selected skill</button><button type="button" data-wb="close">Back to desktop</button><button class="vc-primary" type="button" data-wb="deploy">Compile and deploy</button></footer>`;
  options.host.append(root);
  const el=<T extends HTMLElement=HTMLElement>(name:string)=>root.querySelector<T>('[data-wb="'+name+'"]')!;
  const input=el<HTMLTextAreaElement>('input');
  const buttons={generate:el<HTMLButtonElement>('generate'),preset:el<HTMLButtonElement>('preset'),test:el<HTMLButtonElement>('test'),deploy:el<HTMLButtonElement>('deploy')};
  const project=()=>service.projects.find(p=>p.id===selected)!;
  const projectButtons=new Map<ProjectId,HTMLButtonElement>();
  function message(value:string,error=false){el('status').textContent=value;el('status').classList.toggle('vc-error',error);}
  function resourceBlock(s:CompileSlots){
    const providerReason=plan&&service.blockedReason?.(plan);if(providerReason)return providerReason;
    const id=plan?.project??selected;
    if(!s.equipped[id]&&Object.keys(s.equipped).length>=s.capacity)return 'Skill slots are full.';
    if(!s.equipped[id]&&plan?.computeCost!=null&&s.budget&&plan.computeCost>s.budget.available)return 'Not enough compute left.';
    return '';
  }
  function render(){
    const p=project(),s=service.slots(),reason=resourceBlock(s),blocked=!!reason;
    const spec=plan??service.installedPlan?.(selected);
    const resolved=service.projects.find(item=>item.id===spec?.project)??p;
    lastRead=JSON.stringify([s,service.cooldown(selected)]);
    for(const [id,b] of projectButtons){
      b.setAttribute('aria-pressed',String(id===selected));b.disabled=busy;
      b.querySelector('small')!.textContent=s.equipped[id]?'Deployed · '+s.equipped[id]:service.projects.find(it=>it.id===id)?.supported?'Editable':'Not connected';
    }
    el('symbol').textContent=skillMark[selected];el('title').textContent=p.name;el('description').textContent=p.description;
    const slots=Object.entries(s.equipped);
    const entries=slots.map(([id,key])=>key+' · '+(service.projects.find(it=>it.id===id)?.name??id));
    while(entries.length<s.capacity)entries.push('Empty');
    el('slots').replaceChildren(...entries.map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));
    el('count').textContent=slots.length+' / '+s.capacity+' used · '+Math.max(0,s.capacity-slots.length)+' slots free';
    el('provider').textContent=service.name;
    input.disabled=busy;el<HTMLButtonElement>('sample').disabled=busy;el<HTMLSelectElement>('new').disabled=busy;
    buttons.preset.hidden=!service.preset;buttons.preset.disabled=busy||!p.supported;
    const uninstall=el<HTMLButtonElement>('uninstall');
    uninstall.hidden=!service.uninstall||!s.equipped[selected];uninstall.disabled=busy;
    el('direction').hidden=!service.preset||selected==='stun';el<HTMLSelectElement>('side').disabled=busy;
    buttons.generate.disabled=busy||!p.supported||!input.value.trim();
    buttons.test.disabled=busy||!plan;
    buttons.deploy.disabled=busy||installed||!plan||!tests.length||tests.some(t=>t.actual!==t.expected)||blocked;
    buttons.deploy.textContent=installed?'Deployed':s.equipped[resolved.id]?'Compile and update '+s.equipped[resolved.id]:'Compile and deploy';
    const fields:[string,string][]=[['Skill',resolved.name],['Version',plan&&!installed?'Current draft':s.equipped[resolved.id]?'Equipped':'Not compiled'],['Type',resolved.category],['Target',resolved.target],
      ['Duration',spec?.duration==null?'—':spec.duration+' s'],['Cooldown',spec?.cooldown==null?'—':spec.cooldown+' s'],
      ['Compute cost',spec?.computeCost==null?'Not metered':String(spec.computeCost)],
      ['Available compute',s.budget?s.budget.available+' / '+s.budget.total:'Not metered'],
      ['Cast condition',spec?.condition??'—'],['Effect',spec?.effect??'—']];
    if(spec?.origin)fields.push(['Source',spec.origin==='model'?'Model · '+spec.model:spec.origin==='legacy'?'Migrated lawn skill':'Local offline preset']);
    if(s.equipped[resolved.id]){const cooldown=service.cooldown(resolved.id);fields.push(['Current state',cooldown==null?'Unknown':cooldown>0?cooldown.toFixed(1)+' s until ready':'Ready']);}
    el('spec').replaceChildren(...fields.flatMap(([key,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;return [dt,dd];}));
    const definition=el<HTMLDetailsElement>('definition');
    definition.hidden=!spec?.definition;
    definition.querySelector('pre')!.textContent=spec?.definition?JSON.stringify(spec.definition,null,2):'';
    el('log').replaceChildren();
    if(tests.length)for(const test of tests){
      const line=document.createElement('div');line.className='vc-case';line.dataset.ok=String(test.actual===test.expected);
      const title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=(test.actual===test.expected?'✓ ':'× ')+test.name;detail.textContent=test.detail;line.append(title,detail);el('log').append(line);
    }else el('log').textContent=plan?'Rule generated. Waiting for a test.':'After generating a plan, verify cast timing and target distance.';
    if(blocked&&!busy&&plan)message(reason,true);
  }
  function resetDraft(){
    serial++;busy=false;plan=null;tests=[];installed=false;
    message(project().supported?'Describe what the lion should do on the lawn.':'Interface preview · This project can save a draft; it compiles once the combat side connects.');
  }
  function select(id:ProjectId){
    selected=id;resetDraft();input.value=service.draft(id);input.placeholder=project().example;render();
  }
  for(const p of service.projects){
    el<HTMLSelectElement>('new').add(new Option(p.name,p.id));
    const b=document.createElement('button');b.type='button';b.dataset.slot=p.id;
    const mark=document.createElement('i'),text=document.createElement('span'),name=document.createElement('b'),state=document.createElement('small');
    mark.textContent=skillMark[p.id];name.textContent=p.name;text.append(name,state);b.append(mark,text);projectButtons.set(p.id,b);
    b.addEventListener('click',()=>{if(p.id!==selected)select(p.id);});el('projects').append(b);
  }
  function edit(){service.edit(selected,input.value);resetDraft();render();}
  el<HTMLSelectElement>('new').addEventListener('change',e=>{
    const menu=e.currentTarget as HTMLSelectElement,found=service.projects.find(p=>p.id===menu.value);menu.value='';
    if(found){select(found.id);input.focus();}
  });
  el('close').addEventListener('click',options.onClose);
  input.addEventListener('input',edit);
  el('sample').addEventListener('click',()=>{input.value=project().example;edit();input.focus();});
  el('side').addEventListener('change',()=>{if(plan?.origin==='preset'){resetDraft();render();}});
  el('uninstall').addEventListener('click',async()=>{
    if(busy||!service.uninstall)return;
    const id=selected;busy=true;render();
    try{
      const result=await service.uninstall(id);if(disposed)return;
      if(result.ok){resetDraft();options.onDeploy?.();message('Skill uninstalled. Slot and compute released.');}
      else message(result.message,true);
    }catch{if(!disposed)message('Uninstall failed. Try again.',true);}
    finally{busy=false;if(!disposed)render();}
  });
  async function run(job:'generate'|'preset'|'test'|'deploy'){
    if(busy||buttons[job].disabled)return;
    if(job==='preset'&&!input.value.trim()){input.value=project().example;edit();}
    const request=++serial;busy=true;
    const stillCurrent=()=>!disposed&&serial===request;
    message(job==='generate'?'Asking the MacBook model to read the instruction…':job==='preset'?'Loading offline preset…':job==='test'?'Testing the rule…':'Waiting for the runtime to confirm the compile…');render();
    try{
      if(job==='generate'||job==='preset'){
        tests=[];installed=false;plan=null;
        const result=job==='preset'&&service.preset?await service.preset(selected,input.value,el<HTMLSelectElement>('side').value as 'left'|'right'):await service.preview(selected,input.value);
        if(!stillCurrent())return;
        if(!result.ok){message(result.message,true);return;}
        plan=result.value;
        const name=service.projects.find(p=>p.id===plan?.project)?.name??plan.project;
        message(plan.origin==='preset'?'Loaded the '+name+' offline preset. Check the parameters, then run a test.':'Generated '+name+'. Check the parameters in the inspector, then run a test.');
      }else if(job==='test'&&plan){
        tests=[];const result=await service.test(plan);
        if(!stillCurrent())return;
        if(!result.ok){message(result.message,true);return;}
        tests=result.value;
        const passed=tests.length>0&&tests.every(t=>t.actual===t.expected);
        message(passed?'Tests passed. Ready to compile and deploy.':'Tests failed. Revise the instruction.',!passed);
      }else if(plan){
        const reason=resourceBlock(service.slots());
        if(reason){message(reason,true);return;}
        const result=await service.install(plan);
        if(!stillCurrent())return;
        if(!result.ok){message(result.message,true);return;}
        const key=service.slots().equipped[plan.project];
        if(!key){message('The runtime returned no equipment slot. Check the connection again.',true);return;}
        selected=plan.project;input.value=service.draft(selected);
        installed=true;options.onDeploy?.();message('Runtime confirmed deployment to slot '+key+'.');
      }
    }catch(error){if(stillCurrent())message(error instanceof Error?error.message:'The compile interface is unavailable. Try again.',true);}
    finally{if(stillCurrent()){busy=false;render();}}
  }
  for(const job of ['generate','preset','test','deploy'] as const)buttons[job].addEventListener('click',()=>void run(job));
  select(selected);
  return {open(){root.hidden=false;render();},
    refresh(){if(JSON.stringify([service.slots(),service.cooldown(selected)])!==lastRead)render();},
    dispose(){disposed=true;serial++;root.remove();}};
}
