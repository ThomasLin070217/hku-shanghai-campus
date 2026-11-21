import {COOLDOWN, STUN_WINDOW, LURE_WINDOW, evaluateSkill, type SkillContext, type SkillRule} from './rules';
import {CHARGE_WARNING, SWIPE_WARNING} from './combat';
import './workbench.css';

type Kind = SkillRule['kind'];
type Slot = {draft:string; deployed:SkillRule|null; source:string};
type Options = {
  host:HTMLElement;
  onClose:()=>void;
  onDeploy?:(rule:SkillRule)=>void;
  storageKey?:string;
  keys?:Record<Kind,string>;
};

const kinds:Kind[] = ['stun','lure'];
const labels:Record<Kind,string> = {stun:'短时麻痹',lure:'助手牵制'};
const examples:Record<Kind,string> = {
  stun:'如果 8 米内的狮子正在蓄力冲撞，我按下技能时就让它短暂停机，打断冲撞。',
  lure:'等狮子挥完爪，我按下技能时，让阿树从左侧牵制它。',
};
const emptySlot = ():Slot=>({draft:'',deployed:null,source:''});
const newSlots = ():Record<Kind,Slot>=>({stun:emptySlot(),lure:emptySlot()});

type CompileResult = {ok:true;rule:SkillRule}|{ok:false;message:string};

export function compileBossIntent(input:string, kind:Kind):CompileResult {
  const normalized=input.normalize('NFKC').trim().toLowerCase();
  const intent=normalized.replace(/[零一二三四五六七八九](?=\s*(?:米|公尺))/g,ch=>String('零一二三四五六七八九'.indexOf(ch)));
  const fail = (message:string):CompileResult=>({ok:false,message});
  if (!intent) return fail('先写一句话，描述狮子在做什么，以及你想释放的效果。');
  if (/自动|一直|永久|automatically|permanent/.test(intent)) return fail('工作台支持手动释放的短时技能。请写出招式阶段和想要的效果。');

  const distances = Array.from(intent.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:米|公尺|m(?:et(?:er|re)s?)?\b)/g));
  const maxRange = Number(distances[0]?.[1] ?? 8);
  const unsupportedDistance=/[十百千半点零一二三四五六七八九]\s*(?:\d+\s*)?(?:米|公尺)|(?:超过|远于|大于)\s*\d+\s*(?:米|公尺)|\d+\s*(?:米|公尺)(?:以外|之外)/.test(intent);
  if (unsupportedDistance || distances.length>1 || maxRange<4 || maxRange>8 || !Number.isInteger(maxRange)) {
    return fail('有效距离可写成 4 至 8 米之间的一个整数，例如「6 米内」。');
  }
  if (kind==='stun') {
    const charge = /冲(?:撞|锋|刺)|猛冲|charg(?:e|es|ing)|rush|wind.?up/.test(intent);
    const stop = /麻痹|停机|打断|瘫痪|定住|眩晕|定身|制动|停下|stun|stop|interrupt|immobili[sz]e/.test(intent);
    if (!charge || !stop || /挥爪|冲(?:撞|锋)(?:完|结束|之后|过后)|after (?:the |its )?charge/.test(intent)) {
      return fail('麻痹模块需要「冲撞预警」和「打断」两项信息，例如「狮子蓄力冲撞时让它停机」。');
    }
    return {ok:true,rule:{kind,side:'right',maxRange}};
  }
  const recovery = /(?:挥|出|拍|扫).{0,4}爪.{0,7}(?:后|完|结束|收)|(?:挥完|收回|收起|挥过|挥了).{0,2}爪|收招|after.{0,30}(?:swip|claw)|(?:swip|claw).{0,25}(?:recover|end|finish)/.test(intent);
  const lure = /牵制|吸引|引开|诱导|引走|诱敌|分散|distract|lure|draw.{0,12}(?:away|attention)|decoy/.test(intent);
  if (!recovery || !lure) return fail('牵制模块需要「挥爪收招」和「牵制」两项信息，例如「挥爪后让阿树从右边引开它」。');
  const left = /左|\bleft\b/.test(intent), right = /右|\bright\b/.test(intent);
  if (left===right) return fail('阿树需要明确的牵制点。请在意图里选「左侧」或「右侧」，然后重新生成。');
  return {ok:true,rule:{kind,side:left?'left':'right',maxRange}};
}

function restoreSlots(key:string) {
  const slots = newSlots();
  try {
    const save = JSON.parse(localStorage.getItem(key) || 'null');
    if (save?.version!==1) return slots;
    for (const kind of kinds) {
      const data = save.slots?.[kind];
      if (typeof data?.draft==='string') slots[kind].draft=data.draft.slice(0,400);
      if (typeof data?.source!=='string' || !data.source) continue;
      // Recompile the deployed source; drafts can be newer than what is in the slot.
      const source=data.source.slice(0,400);
      const compiled = compileBossIntent(source,kind);
      if (compiled.ok) Object.assign(slots[kind],{deployed:compiled.rule,source});
    }
  } catch { /* Local storage can be disabled. The current session still works. */ }
  return slots;
}

export function createBossWorkbench(options:Options) {
  const storageKey = options.storageKey ?? 'hku.lion-boss.workbench.v1';
  const keys = options.keys ?? {stun:'Q',lure:'R'};
  let slots = restoreSlots(storageKey);
  let kind:Kind = 'stun';
  let candidate:SkillRule|null = null;
  let tested = false;
  const root = document.createElement('div');
  root.className='lion-workbench';
  root.hidden=true;
  root.setAttribute('role','region');
  root.setAttribute('aria-label','MacBook 技能工作台');
  root.innerHTML = `
    <section class="lwb-case">
      <div class="lwb-screen">
        <header class="lwb-title"><h2>技能工作台</h2><span data-wb="count"></span><button type="button" data-wb="close">返回桌面</button></header>
        <nav class="lwb-slots" aria-label="选择技能槽">
          <button type="button" data-slot="stun"><kbd></kbd><span><b>短时麻痹</b><small>打断冲撞</small></span><em></em></button>
          <button type="button" data-slot="lure"><kbd></kbd><span><b>助手牵制</b><small>引开 L001</small></span><em></em></button>
        </nav>
        <div class="lwb-edit">
          <div class="lwb-heading"><label for="lwb-intent">技能意图</label><button type="button" data-wb="sample">使用示例 ↙</button></div>
          <textarea id="lwb-intent" maxlength="400" rows="3" spellcheck="false"></textarea>
          <button type="button" data-wb="generate" class="lwb-generate">生成规则 →</button>
        </div>
        <section class="lwb-review" aria-label="规则与模拟">
          <div class="lwb-rules"><h3>规则预览</h3><p data-wb="empty">生成后可在这里检查施放条件与效果。</p>
          <dl data-wb="spec" hidden><dt>触发</dt><dd data-wb="trigger"></dd><dt>条件</dt><dd data-wb="condition"></dd><dt>效果</dt><dd data-wb="effect"></dd><dt>冷却</dt><dd>${COOLDOWN} 秒</dd></dl></div>
          <div class="lwb-sandbox"><div class="lwb-heading"><h3>模拟回放</h3><button type="button" data-wb="test">▶ 测试技能</button></div>
          <div class="lwb-map" aria-hidden="true"><span class="lwb-actor">你</span><i class="lwb-line"></i><span class="lwb-lion">L001</span><span class="lwb-helper">阿树</span></div>
          <div class="lwb-log" data-wb="log">测试会分别模拟有效和无效时机。</div></div>
        </section>
      </div>
      <footer class="lwb-footer"><p role="status" data-wb="status"></p><button type="button" class="lwb-deploy" data-wb="deploy">部署到技能槽</button></footer>
    </section>`;
  options.host.append(root);
  const el=<T extends HTMLElement=HTMLElement>(name:string)=>root.querySelector<T>('[data-wb="'+name+'"]')!;
  const textarea=root.querySelector('textarea')!;
  const testButton=el<HTMLButtonElement>('test');
  const deployButton=el<HTMLButtonElement>('deploy');
  const map=root.querySelector<HTMLElement>('.lwb-map')!;
  const log=el('log');
  let animation:Animation|undefined;

  function save() {
    try {localStorage.setItem(storageKey,JSON.stringify({version:1,slots}));} catch { /* In-memory state remains playable. */ }
  }
  function status(message:string,error=false) {
    el('status').textContent=message;
    el('status').classList.toggle('is-error',error);
  }
  function updateSlots() {
    const count=kinds.filter(k=>slots[k].deployed).length;
    el('count').textContent='已部署 '+count+' / 2';
    for (const k of kinds) {
      const button=root.querySelector<HTMLButtonElement>('[data-slot="'+k+'"]')!;
      button.setAttribute('aria-pressed',String(k===kind));
      button.querySelector('kbd')!.textContent=keys[k];
      button.querySelector('em')!.textContent=slots[k].deployed?'已部署':'空槽';
    }
  }
  function review() {
    el('empty').hidden=Boolean(candidate);
    el('spec').hidden=!candidate;
    testButton.disabled=!candidate;
    deployButton.disabled=!tested || !candidate || slots[kind].source===slots[kind].draft;
    deployButton.textContent='部署到 '+keys[kind]+' 槽';
    if (!candidate) return;
    const stun=candidate.kind==='stun';
    el('trigger').textContent='玩家按 '+keys[kind];
    el('condition').textContent='L001 在 '+(candidate.maxRange??8)+' 米内，'+(stun?'正在蓄力冲撞':'刚挥完爪，阿树就绪');
    el('effect').textContent=stun?'打断冲撞，停机 '+STUN_WINDOW+' 秒':'阿树移到'+(candidate.side==='left'?'左':'右')+'侧，到点后牵制 '+LURE_WINDOW+' 秒';
  }
  function clearTest() {
    animation?.cancel();
    tested=false;
    map.dataset.state='idle';
    log.textContent='测试会分别模拟有效和无效时机。';
  }
  function edit() {
    slots[kind].draft=textarea.value;
    candidate=null;
    clearTest();
    review();
    status(slots[kind].deployed?'编辑中的草稿。原技能仍可在草坪使用。':'描述技能后，点击「生成规则」。');
    save();
  }
  function selectKind(k:Kind) {
    kind=k;
    const slot=slots[kind];
    textarea.value=slot.draft;
    textarea.placeholder=examples[kind];
    clearTest();
    candidate=slot.deployed && slot.source===slot.draft ? slot.deployed:null;
    tested=Boolean(candidate);
    review();
    updateSlots();
    status(candidate?'当前版本已部署。可改写距离或重新测试。':'描述你想在什么时机施放技能，或从示例开始改写。');
  }
  function runTest() {
    if (!candidate) return;
    const stun=kind==='stun';
    const distance=candidate.maxRange??8;
    const validPhase=stun?'chargeWarn':'swipeRecover';
    const good:SkillContext={phase:validPhase,distance,cooldown:0,helperReady:true};
    const correct=evaluateSkill(candidate,good);
    const wrong=evaluateSkill(candidate,{...good,phase:stun?'charge':'swipeWarn'});
    const far=evaluateSkill(candidate,{...good,distance:distance+1});
    tested=correct.ok && !wrong.ok && !far.ok;
    log.replaceChildren();
    const cases=[
      {label:stun?'蓄力':'收招',time:stun?CHARGE_WARNING/2:SWIPE_WARNING+.25,result:correct},
      {label:stun?'冲出':'挥爪中',time:stun?CHARGE_WARNING+.1:SWIPE_WARNING/2,result:wrong},
      {label:'超出射程',time:stun?CHARGE_WARNING/2:SWIPE_WARNING+.25,result:far},
    ];
    const trace=document.createElement('p');
    const selectors=document.createElement('div');
    selectors.className='lwb-cases';
    const rule=candidate;
    for (const sample of cases) {
      const button=document.createElement('button');
      button.type='button';button.textContent=sample.label;
      selectors.append(button);
      button.addEventListener('click',()=>{
        for (const b of Array.from(selectors.children)) b.setAttribute('aria-pressed',String(b===button));
        map.dataset.state=sample.result.ok?kind:'blocked';
        trace.textContent='预警开始 → '+sample.time.toFixed(2)+' 秒按 '+keys[kind]+'（'+(sample===cases[2]?distance+1:distance)+' m）→ '+sample.result.message;
        if (sample.result.ok) trace.textContent+=stun?'。停机后立即可提交。':'。阿树到达侧翼后可提交。';
        animation?.cancel();
        if (sample.result.ok && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const node=map.querySelector(stun?'.lwb-lion':'.lwb-helper')!;
          const travel=stun?[{transform:'translateX(8px)'},{transform:'translateX(-6px)'},{transform:'none'}]:
            [{transform:'translateX(0)'},{transform:'translateX('+(rule.side==='left'?-36:36)+'px)'}];
          animation=node.animate(travel,{duration:650,fill:'forwards',easing:'ease-out'});
        }
      });
    }
    log.append(selectors,trace);
    selectors.querySelector('button')!.click();
    const deployed=slots[kind].source===slots[kind].draft;
    const success=deployed?'复测通过，当前版本已部署。':'测试通过，可以部署此版本。';
    status(tested?success:'规则与预期不符，请检查后重新生成。',!tested);
    review();
  }
  for (const k of kinds) root.querySelector('[data-slot="'+k+'"]')!.addEventListener('click',()=>selectKind(k));
  textarea.addEventListener('input',edit);
  el('sample').addEventListener('click',()=>{
    textarea.value=examples[kind]; edit(); textarea.focus();
  });
  el('generate').addEventListener('click',()=>{
    clearTest();
    const result=compileBossIntent(textarea.value,kind);
    candidate=result.ok?result.rule:null;
    review();
    status(result.ok?'规则已生成。核对条件后点击「测试技能」。':result.message,!result.ok);
  });
  testButton.addEventListener('click',runTest);
  deployButton.addEventListener('click',()=>{
    if (!candidate || !tested) return;
    slots[kind]={draft:textarea.value,source:textarea.value,deployed:{...candidate}};
    save(); review(); updateSlots();
    options.onDeploy?.({...candidate});
    const next=kinds.find(k=>!slots[k].deployed);
    status(next?'已装入 '+keys[kind]+' 槽。选择「'+labels[next]+'」准备第二项技能。':'两项技能已部署。合上电脑，到草坪选择时机施放。');
  });
  function close() {root.hidden=true;animation?.cancel();}
  function exit() {close();options.onClose();}
  el('close').addEventListener('click',exit);
  return {
    open() {root.hidden=false;selectKind(kinds.find(k=>!slots[k].deployed)??kind);textarea.focus();},
    close,
    getSkill(k:Kind) {const rule=slots[k].deployed;return rule?{...rule}:null;},
    reset() {slots=newSlots();save();selectKind('stun');},
    dispose() {animation?.cancel();root.remove();},
  };
}
