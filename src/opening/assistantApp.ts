import type {AgentContext, AgentReply, ChatTurn, LocalAgent} from './agent';
import './assistantApp.css';

interface AssistantOptions {
  agent: LocalAgent;
  context: () => AgentContext | null;
  objective: () => string;
  detail: () => string;
  sessionKey: string | (()=>string);
}
interface Exchange {
  question: string;
  answer?: string;
  source?: AgentReply['source'];
  model?: string;
  error?: string;
}
interface Session {version: 1; draft: string; exchanges: Exchange[]}

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

function readSession(key:string):Session {
  const session:Session={version:1,draft:'',exchanges:[]};
  try {
    const raw=localStorage.getItem(key);
    if(!raw)return session;
    const saved=JSON.parse(raw);
    if(saved?.version!==1)return session;
    if(typeof saved.draft==='string')session.draft=saved.draft.slice(0,800);
    if(!Array.isArray(saved.exchanges))return session;
    for(const row of saved.exchanges.slice(-32)) {
      if(!row||typeof row.question!=='string'||!row.question.trim())continue;
      const exchange:Exchange={question:row.question.slice(0,800)};
      if(typeof row.error==='string')exchange.error=row.error.slice(0,250);
      if(typeof row.answer==='string'&&(row.source==='builtin'||row.source==='local-model')) {
        exchange.answer=row.answer.slice(0,12000);
        exchange.source=row.source;
        if(typeof row.model==='string')exchange.model=row.model.slice(0,160);
      }else exchange.error||='The previous reply was interrupted.';
      session.exchanges.push(exchange);
    }
  }catch{/* A blocked storage area still permits an in-memory session. */}
  return session;
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
  const box=el('div','ca-code');
  const bar=el('div','ca-code-tools');
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
  const body=el('div','ca-markdown');
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
  const root=el('section','campus-assistant');
  root.setAttribute('aria-label','Campus AI Assistant');
  const head=el('header','ca-head');
  const identity=el('div','ca-identity');
  identity.append(el('span','ca-name','Campus Assistant'));
  const status=el('span','ca-status');
  status.dataset.role='agent-status';
  identity.append(status);
  const network=el('span','ca-network');
  head.append(identity,network);
  const contextRow=el('details','ca-context'),summary=el('summary');
  const objective=el('strong'),detail=el('p');
  summary.append(el('span','','Objective'),objective);
  contextRow.append(summary,detail);
  const stream=el('div','ca-stream');
  stream.dataset.role='chat-stream';stream.setAttribute('role','log');stream.setAttribute('aria-live','polite');
  const quick=el('div','ca-quick');quick.dataset.role='quick';
  const form=el('form','ca-form');
  const composer=el('div','ca-compose');
  const input=el('textarea');input.dataset.role='agent-input';input.rows=2;input.maxLength=800;
  input.setAttribute('aria-label','Message the assistant');input.placeholder='Ask about the campus or your next move…';input.value=session.draft;
  const send=el('button','ca-send','Send');send.type='submit';send.dataset.role='agent-send';
  const stop=button('Stop','ca-stop');stop.hidden=true;
  const actions=el('div','ca-actions');
  const keys=el('span','ca-keys','Enter to send · Shift + Enter for a new line');
  actions.append(keys,stop,send);composer.append(input,actions);form.append(quick,composer);
  root.append(head,contextRow,stream,form);
  let generation=0, pending:Exchange|null=null,dead=false;
  let contextStamp='',lastGreeting='',lastStatus='';
  function persist() {
    session.draft=input.value;
    try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{/* Current session stays accessible. */}
  }
  function currentContext() {
    const ctx=options.context();
    return ctx?{...ctx,objective:options.objective(),detail:options.detail()}:null;
  }
  function controlState() {
    send.disabled=!!pending||!options.context()||!input.value.trim();
    stop.hidden=!pending;
  }
  function showStatus() {
    const s=agent.status();
    const state=s.mode==='local-model'?'Connected':s.mode==='ready'?'Model configured':s.mode==='checking'?'Contacting model…':'Offline assistance';
    const model=s.mode==='builtin'?'On-device guidance':s.model;
    const stamp=state+'|'+model;
    if(stamp===lastStatus)return;
    lastStatus=stamp;status.textContent=state;network.textContent=model;
    status.dataset.state=s.mode;
  }
  function message(role:'player'|'assistant', name:string, text:string) {
    const row=el('article','ca-row ca-'+role);
    row.append(el('div','ca-byline',name));
    if(role==='assistant')row.append(renderAssistantMarkdown(text));
    else row.append(el('p','ca-question',text));
    return row;
  }
  function renderConversation() {
    const content=document.createDocumentFragment();
    if(!session.exchanges.length&&lastGreeting)content.append(message('assistant','Campus guide',lastGreeting));
    for(const exchange of session.exchanges) {
      content.append(message('player','You',exchange.question));
      if(exchange.answer) {
        const name=exchange.source==='local-model'?(exchange.model||'Connected model'):'Offline campus guide';
        content.append(message('assistant',name,exchange.answer));
      }
      if(exchange===pending)content.append(el('p','ca-generating','Preparing a reply…'));
      else if(exchange.error) {
        const issue=el('div','ca-error');
        issue.append(el('span','',exchange.error));
        if(exchange===session.exchanges.at(-1)){
          const retry=button('Retry');retry.onclick=()=>void request(exchange);issue.append(retry);
        }
        content.append(issue);
      }
    }
    stream.replaceChildren(content);stream.scrollTop=stream.scrollHeight;
  }
  function update() {
    if(dead)return;
    showStatus();
    const ctx=currentContext();if(!ctx)return;
    const key=getStorageKey();
    if(key!==storageKey){
      suspend();
      storageKey=key;session=readSession(key);input.value=session.draft;contextStamp='';
      renderConversation();
    }
    const stamp=[ctx.story.stage,ctx.story.alert_read,ctx.computeStatus,ctx.runtime.curtain_deployed,ctx.runtime.hearts,ctx.objective,ctx.detail].join('|');
    if(stamp===contextStamp)return;
    contextStamp=stamp;
    objective.textContent=ctx.objective||ctx.story.stage;detail.textContent=ctx.detail||'';
    quick.replaceChildren();
    for(const prompt of agent.suggestions(ctx).slice(0,3)) {
      const option=button(prompt);
      option.onclick=()=>{input.value=prompt;persist();controlState();input.focus();};
      quick.append(option);
    }
    lastGreeting=agent.greeting(ctx);controlState();
    if(!session.exchanges.length)renderConversation();
  }
  async function request(exchange:Exchange) {
    const ctx=currentContext();if(!ctx||pending||dead)return;
    pending=exchange;const token=++generation;
    delete exchange.error;
    const previous:ChatTurn[]=[];
    for(const entry of session.exchanges){
      if(entry===exchange)break;
      if(entry.answer)previous.push({role:'user',content:entry.question},{role:'assistant',content:entry.answer});
    }
    persist();renderConversation();controlState();
    try{
      const waiting=agent.ask(exchange.question,ctx,previous);
      showStatus();
      const result=await waiting;
      if(token!==generation||dead)return;
      exchange.answer=result.text;exchange.source=result.source;exchange.model=result.source==='local-model'?agent.status().model:undefined;
      const failure=agent.status().lastError;
      if(result.source==='builtin'&&failure)exchange.error='Model unavailable · '+failure;
    }catch(e){
      if(token!==generation||dead)return;
      exchange.error=e instanceof Error?e.message:'The assistant could not reply.';
    }finally{
      if(token===generation&&!dead){pending=null;persist();showStatus();controlState();renderConversation();}
    }
  }
  function submit() {
    const question=input.value.trim();
    if(!question||pending||!currentContext())return;
    const exchange:Exchange={question};
    session.exchanges.push(exchange);
    if(session.exchanges.length>32)session.exchanges.shift();
    input.value='';void request(exchange);
  }
  function suspend() {
    if(!pending)return;
    generation++;agent.cancel();pending.error='Reply stopped.';pending=null;
    persist();showStatus();controlState();renderConversation();
  }
  form.onsubmit=event=>{event.preventDefault();submit();};
  input.oninput=()=>{persist();controlState();};
  input.onkeydown=event=>{
    if(!event.isComposing&&event.key==='Enter'&&!event.shiftKey){event.preventDefault();submit();}
  };
  stop.onclick=suspend;
  update();renderConversation();controlState();
  return {root,update,suspend,dispose(){suspend();dead=true;root.remove();}};
}
