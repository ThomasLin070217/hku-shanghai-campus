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
      <aside class="vc-projects"><h3>Skill workspace</h3><label class="vc-newproject"><span>＋ 新建技能</span><select aria-label="新建技能项目" data-wb="new"><option value="">选择项目</option></select></label><div data-wb="projects"></div>
        <section class="vc-slots"><h3>编译槽</h3><ul data-wb="slots"></ul><small data-wb="count"></small></section></aside>
      <section class="vc-editor">
        <header class="vc-file"><i data-wb="symbol"></i><div><small>技能项目</small><h2 data-wb="title"></h2></div></header>
        <p class="vc-description" data-wb="description"></p>
        <div class="vc-label"><label for="lwb-intent">自然语言指令</label><button type="button" data-wb="sample">使用示例</button></div>
        <textarea id="lwb-intent" data-wb="input" rows="4" maxlength="400" spellcheck="false"></textarea>
        <button class="vc-primary" type="button" data-wb="generate">生成规则</button>
        <section class="vc-test"><div class="vc-label"><h3>规则测试</h3><button type="button" data-wb="test">测试技能</button></div>
          <div data-wb="log">生成方案后，验证施放时机与目标距离。</div></section>
      </section>
      <aside class="vc-inspector"><h3>Skill inspector</h3><dl data-wb="spec"></dl></aside>
    </div>
    <footer class="vc-footer"><div><small data-wb="provider"></small><p data-wb="status" role="status" aria-live="polite"></p></div>
    <button type="button" data-wb="close">返回桌面</button><button class="vc-primary" type="button" data-wb="deploy">编译并部署</button></footer>`;
  options.host.append(root);
  const el=<T extends HTMLElement=HTMLElement>(name:string)=>root.querySelector<T>('[data-wb="'+name+'"]')!;
  const input=el<HTMLTextAreaElement>('input');
  const buttons={generate:el<HTMLButtonElement>('generate'),test:el<HTMLButtonElement>('test'),deploy:el<HTMLButtonElement>('deploy')};
  const project=()=>service.projects.find(p=>p.id===selected)!;
  const projectButtons=new Map<ProjectId,HTMLButtonElement>();
  function message(value:string,error=false){el('status').textContent=value;el('status').classList.toggle('vc-error',error);}
  function resourceBlock(s:CompileSlots){
    const providerReason=plan&&service.blockedReason?.(plan);if(providerReason)return providerReason;
    if(!s.equipped[selected]&&Object.keys(s.equipped).length>=s.capacity)return '技能槽已满。';
    if(!s.equipped[selected]&&plan?.computeCost!=null&&s.budget&&plan.computeCost>s.budget.available)return '剩余计算资源不足。';
    return '';
  }
  function render(){
    const p=project(),s=service.slots(),reason=resourceBlock(s),blocked=!!reason;
    const spec=plan??service.installedPlan?.(selected);
    lastRead=JSON.stringify([s,service.cooldown(selected)]);
    for(const [id,b] of projectButtons){
      b.setAttribute('aria-pressed',String(id===selected));b.disabled=busy;
      b.querySelector('small')!.textContent=s.equipped[id]?'已部署 · '+s.equipped[id]:service.projects.find(it=>it.id===id)?.supported?'可编辑':'待接入';
    }
    el('symbol').textContent=skillMark[selected];el('title').textContent=p.name;el('description').textContent=p.description;
    const slots=Object.entries(s.equipped);
    const entries=slots.map(([id,key])=>key+' · '+(service.projects.find(it=>it.id===id)?.name??id));
    while(entries.length<s.capacity)entries.push('空闲');
    el('slots').replaceChildren(...entries.map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));
    el('count').textContent=slots.length+' / '+s.capacity+' 已用 · 剩余 '+Math.max(0,s.capacity-slots.length)+' 槽';
    el('provider').textContent=service.name;
    input.disabled=busy;el<HTMLButtonElement>('sample').disabled=busy;el<HTMLSelectElement>('new').disabled=busy;
    buttons.generate.disabled=busy||!p.supported||!input.value.trim();
    buttons.test.disabled=busy||!plan;
    buttons.deploy.disabled=busy||installed||!plan||!tests.length||tests.some(t=>t.actual!==t.expected)||blocked;
    buttons.deploy.textContent=installed?'已部署':s.equipped[selected]?'编译并更新 '+s.equipped[selected]:'编译并部署';
    const fields:[string,string][]=[['版本',plan&&!installed?'当前草案':s.equipped[selected]?'已装备':'未编译'],['类型',p.category],['目标',p.target],
      ['持续',spec?.duration==null?'—':spec.duration+' s'],['冷却',spec?.cooldown==null?'—':spec.cooldown+' s'],
      ['资源消耗',spec?.computeCost==null?'未提供计量':String(spec.computeCost)],
      ['可用算力',s.budget?s.budget.available+' / '+s.budget.total:'未提供计量'],
      ['施放条件',spec?.condition??'—'],['效果',spec?.effect??'—']];
    if(s.equipped[selected]){const cooldown=service.cooldown(selected);fields.push(['当前状态',cooldown==null?'未知':cooldown>0?cooldown.toFixed(1)+' s 后就绪':'已就绪']);}
    el('spec').replaceChildren(...fields.flatMap(([key,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;return [dt,dd];}));
    el('log').replaceChildren();
    if(tests.length)for(const test of tests){
      const line=document.createElement('div');line.className='vc-case';line.dataset.ok=String(test.actual===test.expected);
      const title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=(test.actual===test.expected?'✓ ':'× ')+test.name;detail.textContent=test.detail;line.append(title,detail);el('log').append(line);
    }else el('log').textContent=plan?'规则已生成，等待测试。':'生成方案后，验证施放时机与目标距离。';
    if(blocked&&!busy&&plan)message(reason,true);
  }
  function resetDraft(){
    serial++;busy=false;plan=null;tests=[];installed=false;
    message(project().supported?'描述希望在草坪执行的操作。':'接口预览 · 此项目可保存草稿，战斗端接入后可编译。');
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
  async function run(job:'generate'|'test'|'deploy'){
    if(busy||buttons[job].disabled)return;
    const request=++serial;busy=true;
    const stillCurrent=()=>!disposed&&serial===request;
    message(job==='generate'?'正在解析指令…':job==='test'?'正在测试规则…':'等待运行时确认编译…');render();
    try{
      if(job==='generate'){
        tests=[];installed=false;plan=null;
        const result=await service.preview(selected,input.value);
        if(!stillCurrent())return;
        if(!result.ok){message(result.message,true);return;}
        plan=result.value;message('规则已生成。检查参数后运行测试。');
      }else if(job==='test'&&plan){
        tests=[];const result=await service.test(plan);
        if(!stillCurrent())return;
        if(!result.ok){message(result.message,true);return;}
        tests=result.value;
        const passed=tests.length>0&&tests.every(t=>t.actual===t.expected);
        message(passed?'测试通过，可以编译并部署。':'测试未通过，请修改指令。',!passed);
      }else if(plan){
        const reason=resourceBlock(service.slots());
        if(reason){message(reason,true);return;}
        const result=await service.install(plan);
        if(!stillCurrent())return;
        if(!result.ok){message(result.message,true);return;}
        const key=service.slots().equipped[selected];
        if(!key){message('运行时未返回装备槽。请重新检查连接。',true);return;}
        installed=true;options.onDeploy?.();message('运行时已确认部署到 '+key+' 槽。');
      }
    }catch(error){if(stillCurrent())message(error instanceof Error?error.message:'编译接口暂时不可用，请重试。',true);}
    finally{if(stillCurrent()){busy=false;render();}}
  }
  for(const job of ['generate','test','deploy'] as const)buttons[job].addEventListener('click',()=>void run(job));
  select(selected);
  return {open(){root.hidden=false;render();},
    refresh(){if(JSON.stringify([service.slots(),service.cooldown(selected)])!==lastRead)render();},
    dispose(){disposed=true;serial++;root.remove();}};
}
