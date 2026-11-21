import type {AgentContext,AgentReply,ChatTurn,LocalAgent} from './agent';
import {createVoiceChat,type VoiceState} from './voiceChat';
import {ASSISTANT} from './persona';
import './assistantApp.css';

interface AssistantOptions {
  agent: LocalAgent;
  context: () => AgentContext | null;
  objective: () => string;
  detail: () => string;
  sessionKey: string | (()=>string);
}
interface Message {
  role: 'user'|'assistant';
  text: string;
  source?: AgentReply['source'];
  model?: string;
  latencyMs?: number;
  error?: string;
  voice?: boolean;
  pending?: boolean;
}
interface Session {version: 2; draft: string; messages: Message[]}

function el<K extends keyof HTMLElementTagNameMap>(tag:K, cls='', text=''):HTMLElementTagNameMap[K] {
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text)node.textContent=text;
  return node;
}
function button(text:string, cls='') {
  const node=el('button',cls,text);
  node.type='button';
  return node;
}
function svgIcon(path:string) {
  const span=el('span','ai-icon');
  span.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" aria-hidden="true">'+path+'</svg>';
  return span;
}

function readSession(key:string):Session {
  const session:Session={version:2,draft:'',messages:[]};
  try {
    const raw=localStorage.getItem(key);
    if(!raw)return session;
    const saved=JSON.parse(raw);
    if(saved?.version===2) {
      if(typeof saved.draft==='string')session.draft=saved.draft.slice(0,800);
      if(Array.isArray(saved.messages))session.messages=migrate(saved.messages);
      return session;
    }
    if(saved?.version===1&&Array.isArray(saved.exchanges)) {
      const messages:Message[]=[];
      for(const row of saved.exchanges.slice(-24)) {
        if(!row||typeof row.question!=='string'||!row.question.trim())continue;
        messages.push({role:'user',text:row.question.slice(0,800)});
        if(typeof row.answer==='string'&&(row.source==='builtin'||row.source==='local-model'))
          messages.push({role:'assistant',text:row.answer.slice(0,12000),source:row.source,model:typeof row.model==='string'?row.model.slice(0,160):undefined});
        else if(typeof row.error==='string')messages.push({role:'assistant',text:'',error:row.error.slice(0,250)});
      }
      session.messages=migrate(messages);
    }
  }catch{ /* A blocked storage area still permits an in-memory session. */ }
  return session;
}
function migrate(rows:unknown[]):Message[] {
  const messages:Message[]=[];
  for(const raw of rows.slice(-40)) {
    if(!raw||typeof raw!=='object')continue;
    const row=raw as Record<string,unknown>;
    if(row.role!=='user'&&row.role!=='assistant')continue;
    const text=typeof row.text==='string'?row.text.slice(0,12000):'';
    if(!text&&typeof row.error!=='string')continue;
    const message:Message={role:row.role,text};
    if(row.source==='builtin'||row.source==='local-model')message.source=row.source;
    if(typeof row.model==='string')message.model=row.model.slice(0,160);
    if(typeof row.error==='string')message.error=row.error.slice(0,250);
    if(row.voice===true)message.voice=true;
    messages.push(message);
  }
  return messages;
}

// Construct only known DOM nodes. HTML and unsupported Markdown stay literal.
function inline(parent:HTMLElement, input:string) {
  const token=/(\x60[^\x60\n]+\x60|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let last=0;
  for(const match of input.matchAll(token)) {
    const index=match.index!,value=match[0];
    parent.append(input.slice(last,index));
    const strong=value.startsWith('**');
    const tag=value.charCodeAt(0)===96?'code':strong?'strong':'em';
    parent.append(el(tag,'',value.slice(strong?2:1,strong?-2:-1)));
    last=index+value.length;
  }
  parent.append(input.slice(last));
}

function codeBlock(language:string, code:string) {
  const box=el('div','ai-code');
  const bar=el('div','ai-code-tools');
  const copy=button('Copy');
  const pre=el('pre'),value=el('code','',code);
  copy.setAttribute('aria-label','Copy code');
  copy.onclick=async()=>{
    try {await navigator.clipboard.writeText(code);copy.textContent='Copied';}
    catch {
      const range=document.createRange();
      range.selectNodeContents(value);
      const selection=document.getSelection();
      selection?.removeAllRanges();selection?.addRange(range);
      copy.textContent='Selected · Ctrl/Cmd+C';
    }
  };
  bar.append(el('span','',language||'Code'),copy);
  pre.tabIndex=0;pre.append(value);box.append(bar,pre);
  return box;
}

export function renderAssistantMarkdown(text:string):HTMLElement {
  const body=el('div','ai-markdown');
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    if(line.startsWith('\x60\x60\x60')) {
      const code:string[]=[];
      const language=line.slice(3).trim();
      while(++i<lines.length&&!lines[i].startsWith('\x60\x60\x60'))code.push(lines[i]);
      body.append(codeBlock(language,code.join('\n')));continue;
    }
    if(!line.trim())continue;
    const itemPattern=/^\s*(?:([-*•])|(\d+)[.)])\s+(.+)$/;
    let item=line.match(itemPattern);
    if(item) {
      const tag=item[2]?'ol':'ul';
      const list=el(tag);
      if(list instanceof HTMLOListElement)list.start=Number(item[2]);
      do {
        const li=el('li');inline(li,item[3]);list.append(li);
        item=lines[i+1]?.match(itemPattern)??null;
        if(!item||(item[2]?'ol':'ul')!==tag)break;
        i++;
      }while(item);
      body.append(list);continue;
    }
    const heading=line.match(/^#{1,6}\s+(.+)$/);
    const quoted=line.startsWith('> ');
    const node=el(heading?'h4':quoted?'blockquote':'p');
    inline(node,heading?heading[1]:quoted?line.slice(2):line);body.append(node);
  }
  return body;
}

export function createAssistantApp(options:AssistantOptions) {
  const {agent}=options;
  const getStorageKey=()=>'hku.campus.assistant.v1.'+
    (typeof options.sessionKey==='function'?options.sessionKey():options.sessionKey);
  let storageKey=getStorageKey();
  let session=readSession(storageKey);
  let autoSpeak=readAutoSpeak();
  let speakingText='';

  const root=el('section','ai-app');
  root.setAttribute('aria-label','岚 · LAN — DeepSeek Harness · local campus assistant');

  const rail=el('aside','ai-rail');
  const brand=el('div','ai-brand');
  brand.append(el('span','ai-brand-mark','◈'),el('b','','DeepSeek Harness'));
  const newChat=button('','ai-new');
  newChat.append(el('span','','＋'),el('span','','New chat'));
  newChat.setAttribute('aria-label','Start a new chat');
  const sessionLabel=el('div','ai-section-label','Sessions');
  const sessionList=el('div','ai-sessions');
  const activeSession=button('','ai-session is-active');
  const sessionTitle=el('span','ai-session-title','Campus recovery');
  const sessionMeta=el('small','','Now');
  activeSession.append(sessionTitle,sessionMeta);
  sessionList.append(activeSession);
  const railFoot=el('div','ai-rail-foot');
  const railDot=el('span','ai-dot');const railStatus=el('span','ai-rail-status','On-device');
  railFoot.append(railDot,railStatus);
  rail.append(brand,newChat,sessionLabel,sessionList,railFoot);

  const main=el('div','ai-main');
  const head=el('header','ai-head');
  const titleBox=el('div','ai-title');
  const title=el('b','','Campus recovery');
  const subtitle=el('small','','MacBook Air · 岚 LAN · local core');
  titleBox.append(title,subtitle);
  const modelChip=el('span','ai-model-chip','on-device');
  const headNew=button('','ai-head-new');
  headNew.append(svgIcon('<path d="M12 5v14M5 12h14"/>'));
  headNew.title='New chat';headNew.setAttribute('aria-label','New chat');
  head.append(titleBox,modelChip,headNew);

  const context=el('div','ai-context');
  const contextObjective=el('span','ai-context-objective');
  const contextDetail=el('span','ai-context-detail');
  context.append(el('span','ai-context-label','Objective'),contextObjective,contextDetail);

  const stream=el('div','ai-stream');
  stream.setAttribute('role','log');stream.setAttribute('aria-live','polite');
  const quick=el('div','ai-quick');

  const listening=el('div','ai-listening');listening.hidden=true;
  const bars=el('span','ai-wave');for(let i=0;i<5;i++)bars.append(el('i'));
  const listeningText=el('span','ai-listening-text','Listening…');
  const listeningStop=button('Stop','ai-listening-stop');
  listening.append(bars,listeningText,listeningStop);

  const form=el('form','ai-composer');
  const input=el('textarea','ai-input');
  input.rows=2;input.maxLength=800;
  input.placeholder='Message the local assistant…';
  input.setAttribute('aria-label','Message the assistant');input.dataset.autofocus='true';
  input.value=session.draft;
  const row=el('div','ai-composer-row');
  const tools=el('div','ai-tools');
  const mic=button('','ai-tool ai-mic');
  mic.append(svgIcon('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>'));
  mic.title='Speak to the assistant';mic.setAttribute('aria-label','Start voice input');mic.setAttribute('aria-pressed','false');
  const speaker=button('','ai-tool ai-speaker');
  speaker.append(svgIcon('<path d="M5 10v4h3l4 3V7L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'));
  speaker.title='Read replies aloud';speaker.setAttribute('aria-label','Read replies aloud');speaker.setAttribute('aria-pressed',autoSpeak?'true':'false');
  speaker.classList.toggle('is-on',autoSpeak);
  const stop=button('','ai-tool ai-stop');stop.append(svgIcon('<rect x="7" y="7" width="10" height="10" rx="1"/>'));
  stop.title='Stop';stop.setAttribute('aria-label','Stop reply');stop.hidden=true;
  tools.append(mic,speaker,stop);
  const hint=el('span','ai-hint','Enter to send · Shift + Enter for a new line');
  const send=button('','ai-send');
  send.append(svgIcon('<path d="M12 19V5M6 11l6-6 6 6"/>'));
  send.type='submit';send.setAttribute('aria-label','Send message');
  row.append(tools,hint,send);
  form.append(listening,input,row);
  const note=el('p','ai-note','Local assistant · reads the live campus state · model replies can be wrong');

  main.append(head,context,stream,quick,form,note);
  root.append(rail,main);

  const streamLimit=40;
  let generation=0,dead=false,pendingIndex=-1;
  let contextStamp='',lastGreeting='',lastStatus='';
  let listeningVisible=false;
  let suspended=false;

  const voice=createVoiceChat({
    language:()=>document.documentElement.lang||'zh-CN',
    onState:updateVoiceState,
    onTranscript:(text,final)=>{
      if(suspended)return;
      if(final){
        const clean=text.trim();
        if(clean)submit(clean,true);
        setListening(false);
      }else{
        listeningText.textContent=text;
      }
    },
  });

  function readAutoSpeak():boolean {
    try{return localStorage.getItem('hku.ai.voice.autospeak')==='1';}catch{return false;}
  }
  function persistAutoSpeak() {
    try{localStorage.setItem('hku.ai.voice.autospeak',autoSpeak?'1':'0');}catch{/* Storage is optional. */}
  }
  function persist() {
    session.draft=input.value;
    try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{/* Current session stays accessible. */}
  }
  function currentContext() {
    const ctx=options.context();
    return ctx?{...ctx,objective:options.objective(),detail:options.detail()}:null;
  }
  function controlState() {
    const hasPending=pendingIndex>=0;
    send.disabled=hasPending||!options.context()||!input.value.trim();
    stop.hidden=!hasPending;
    mic.classList.toggle('is-on',voice.listening);
    mic.setAttribute('aria-pressed',String(voice.listening));
    speaker.classList.toggle('is-on',autoSpeak);
    speaker.setAttribute('aria-pressed',String(autoSpeak));
    newChat.disabled=hasPending;
    headNew.disabled=hasPending;
  }
  function showStatus() {
    const s=agent.status();
    const state=s.mode==='local-model'?'Connected':s.mode==='ready'?'Model configured':s.mode==='checking'?'Thinking…':'On-device';
    const model=s.mode==='builtin'?'On-device rules':s.model;
    const stamp=state+'|'+model;
    if(stamp===lastStatus)return;
    lastStatus=stamp;
    modelChip.textContent=model||'on-device';
    railStatus.textContent=state;
    railDot.dataset.state=s.mode;
    modelChip.dataset.state=s.mode;
  }
  function messageRow(message:Message,index:number) {
    const rowEl=el('article','ai-message ai-message-'+(message.role==='user'?'user':'assistant'));
    if(message.role==='user') {
      const byline=el('div','ai-byline',message.voice?'You · voice':'You');
      const bubble=el('div','ai-bubble');
      bubble.append(el('p','ai-question',message.text));
      rowEl.append(bubble,byline);
      return rowEl;
    }
    const avatar=el('div','ai-avatar','◈');
    const body=el('div','ai-message-body');
    const byline=el('div','ai-byline');
    byline.append(el('b','',ASSISTANT.label));
    if(message.pending) {
      const typing=el('span','ai-typing');for(let i=0;i<3;i++)typing.append(el('i'));
      body.append(byline,typing);
      rowEl.append(avatar,body);
      return rowEl;
    }
    body.append(byline);
    if(message.text)body.append(renderAssistantMarkdown(message.text));
    if(message.error) {
      const issue=el('div','ai-error');
      issue.append(el('span','',message.error));
      if(index===session.messages.length-1) {
        const retry=button('Retry','ai-retry');
        retry.onclick=()=>retryAt(index);
        issue.append(retry);
      }
      body.append(issue);
    }
    if(message.text) {
      const meta=el('div','ai-meta');
      const source=message.source==='local-model'?(message.model||'local model'):ASSISTANT.name+' · on-device rules';
      meta.append(el('span','',source));
      if(typeof message.latencyMs==='number')meta.append(el('span','','· '+Math.max(0,message.latencyMs)+' ms'));
      if(autoSpeak) {
        const replay=button('Read aloud','ai-replay');
        replay.onclick=()=>speakReply(message.text);
        meta.append(replay);
      }
      body.append(meta);
    }
    rowEl.append(avatar,body);
    return rowEl;
  }
  function renderConversation() {
    const content=document.createDocumentFragment();
    if(!session.messages.length&&lastGreeting) {
      const welcome=messageRow({role:'assistant',text:lastGreeting},-1);
      welcome.classList.add('is-welcome');
      content.append(welcome);
    }
    for(const [index,message] of session.messages.entries())content.append(messageRow(message,index));
    stream.replaceChildren(content);
    stream.scrollTop=stream.scrollHeight;
  }
  function updateQuick(ctx:AgentContext) {
    quick.replaceChildren();
    for(const prompt of agent.suggestions(ctx).slice(0,3)) {
      const option=button(prompt,'ai-chip');
      option.onclick=()=>submit(prompt,false);
      quick.append(option);
    }
  }
  function update() {
    if(dead)return;
    suspended=false;
    showStatus();
    const ctx=currentContext();if(!ctx)return;
    const key=getStorageKey();
    if(key!==storageKey){
      suspend();
      storageKey=key;session=readSession(key);input.value=session.draft;contextStamp='';pendingIndex=-1;
      renderConversation();
    }
    const stamp=[ctx.story.stage,ctx.story.alert_read,ctx.computeStatus,ctx.runtime.curtain_deployed,ctx.runtime.hearts,ctx.objective,ctx.detail].join('|');
    if(stamp===contextStamp)return;
    contextStamp=stamp;
    contextObjective.textContent=ctx.objective||ctx.story.stage;
    contextDetail.textContent=ctx.detail||'';
    updateQuick(ctx);
    lastGreeting=agent.greeting(ctx);
    if(!session.messages.length)renderConversation();
    controlState();
  }
  function conversationHistory(upto:number):ChatTurn[] {
    const previous:ChatTurn[]=[];
    for(const entry of session.messages.slice(0,upto)) {
      if(!entry.text||entry.pending)continue;
      previous.push({role:entry.role,content:entry.text});
    }
    return previous.slice(-10);
  }
  async function ask(userIndex:number) {
    const ctx=currentContext();
    if(!ctx||dead)return;
    const question=session.messages[userIndex]?.text;
    if(!question)return;
    const token=++generation;
    const reply:Message={role:'assistant',text:'',pending:true};
    session.messages.splice(userIndex+1,session.messages.length,reply);
    pendingIndex=userIndex+1;
    renderConversation();controlState();
    try {
      const result=await agent.ask(question,ctx,conversationHistory(userIndex));
      if(token!==generation||dead)return;
      reply.pending=false;
      reply.text=result.text;
      reply.source=result.source;
      reply.model=result.source==='local-model'?agent.status().model:undefined;
      reply.latencyMs=result.latencyMs;
      if(result.source==='local-model')reply.error=agent.status().lastError??undefined;
    } catch(error) {
      if(token!==generation||dead)return;
      reply.pending=false;
      reply.error=error instanceof Error?error.message:'The assistant could not reply.';
    } finally {
      if(token===generation&&!dead){
        pendingIndex=-1;
        persist();showStatus();controlState();renderConversation();
        if(reply.text&&autoSpeak)speakReply(reply.text);
      }
    }
  }
  function submit(text?:string,byVoice=false) {
    const question=(text??input.value).trim();
    if(!question||pendingIndex>=0||!currentContext()||dead||suspended)return;
    if(byVoice&&!autoSpeak){autoSpeak=true;persistAutoSpeak();}
    session.messages.push({role:'user',text:question,voice:byVoice});
    if(session.messages.length>streamLimit)session.messages.splice(0,session.messages.length-streamLimit);
    input.value='';session.draft='';
    void ask(session.messages.length-1);
  }
  function retryAt(index:number) {
    if(pendingIndex>=0)return;
    let userIndex=index-1;
    while(userIndex>=0&&session.messages[userIndex]?.role!=='user')userIndex--;
    if(userIndex<0)return;
    void ask(userIndex);
  }
  function speakReply(text:string) {
    speakingText=text;
    const ok=voice.speak(text.slice(0,500));
    if(!ok)listeningText.textContent='Speech output is unavailable in this browser.';
  }
  function setListening(visible:boolean) {
    listeningVisible=visible&&voice.listening;
    listening.hidden=!listeningVisible;
    if(listeningVisible)listeningText.textContent='Listening…';
    controlState();
  }
  function updateVoiceState(state:VoiceState) {
    if(dead)return;
    setListening(state.listening);
    if(state.error) {
      listening.hidden=false;listeningVisible=true;
      listeningText.textContent=state.error;
      window.setTimeout(()=>{if(!voice.listening&&dead===false)setListening(false);},4200);
    }
    speaker.classList.toggle('is-speaking',state.speaking);
    controlState();
  }
  function newSession() {
    if(pendingIndex>=0)return;
    generation++;
    session={version:2,draft:'',messages:[]};
    input.value='';contextStamp='';pendingIndex=-1;
    try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{/* Keep in memory. */}
    renderConversation();update();input.focus();
  }
  function stopReply() {
    if(pendingIndex<0)return;
    generation++;agent.cancel();
    const stopped=session.messages[pendingIndex];
    if(stopped){stopped.pending=false;stopped.error='Reply stopped.';}
    pendingIndex=-1;
    persist();showStatus();controlState();renderConversation();
  }
  function suspend() {
    suspended=true;
    stopReply();
    voice.stop();voice.cancelSpeech();
    setListening(false);
  }
  form.onsubmit=event=>{event.preventDefault();submit();};
  input.oninput=()=>{persist();controlState();};
  input.onkeydown=event=>{
    if(!event.isComposing&&event.key==='Enter'&&!event.shiftKey){event.preventDefault();submit();}
  };
  mic.onclick=()=>{
    if(!voice.listeningSupported){listening.hidden=false;listeningVisible=true;listeningText.textContent='This browser has no speech recognition. Type the message instead.';return;}
    if(voice.listening)voice.stop();else voice.start();
  };
  listeningStop.onclick=()=>voice.stop();
  speaker.onclick=()=>{
    if(voice.speaking){voice.cancelSpeech();return;}
    autoSpeak=!autoSpeak;persistAutoSpeak();controlState();
    if(autoSpeak&&session.messages.at(-1)?.text)speakReply(session.messages.at(-1)!.text);
  };
  stop.onclick=stopReply;
  newChat.onclick=newSession;headNew.onclick=newSession;
  update();renderConversation();controlState();
  return {root,update,suspend,dispose(){suspend();dead=true;voice.dispose();root.remove();}};
}
