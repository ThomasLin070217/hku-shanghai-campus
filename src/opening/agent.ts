import {campusModelConfig as config,ModelUnavailable,requestCampusModelReply} from './modelTransport';
import {LOCAL_TOOLS} from '../agent/localTools';
import type {OpeningState} from './contracts';
import type {OpeningRuntime} from './runtime';
import {personaGreeting, personaIdentity, personaPrompt, prefersChinese} from './persona';

/**
 * Local Agent transport for the MacBook.
 *
 * The UI first asks the local bridge (`scripts/llm-bridge.mjs`, same machine,
 * loopback only) which forwards to DeepSeek/Gemini/LiteLLM with the key kept
 * server-side. If the bridge or the model is unavailable it falls back to the
 * deterministic in-game assistant, which keeps 岚's voice and reads the live
 * opening state. Nothing in the browser ever holds an API key. The request
 * itself goes through `./modelTransport`, shared with the lawn skill compiler.
 *
 * Configure without editing code:
 *   localStorage['hku.opening.agent.endpoint'] = 'http://127.0.0.1:8790/api/chat'
 *   localStorage['hku.opening.agent.model']    = 'deepseek-flash'
 *   localStorage['hku.opening.agent.offline']  = '1'           // force fallback
 */

export interface AgentContext{
 story:OpeningState;
 runtime:OpeningRuntime;
 player:[number,number,number];
 objective?:string;
 detail?:string;
 computeStatus?:'connected'|'exercise'|'unavailable';
}
export interface ChatTurn{role:'user'|'assistant';content:string}
export interface AgentReply{text:string;source:'local-model'|'builtin';latencyMs:number}
export interface LocalAgentStatus{
 mode:'local-model'|'builtin'|'checking'|'ready';
 endpoint:string;
 model:string;
 lastError:string|null;
}
export interface LocalAgent{
 ask(text:string,ctx:AgentContext,previous?:readonly ChatTurn[]):Promise<AgentReply>;
 cancel():void;
 status():LocalAgentStatus;
 greeting(ctx:AgentContext):string;
 suggestions(ctx:AgentContext):string[];
 dispose():void;
}

export {ASSISTANT_DEFAULT_ENDPOINT,ASSISTANT_DEFAULT_MODEL} from './modelTransport';
const TIMEOUT_MS=40000;
const RETRY_COOLDOWN_MS=15000;
const MAX_HISTORY=10;

function storage():Storage|null{
 try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}
}
function systemPrompt(ctx:AgentContext):string{
 const {story,runtime}=ctx;
 return[
  personaPrompt(),
  '',
  'Current state (read it, do not restate it verbatim):',
  `Story stage: ${story.stage}. Invitation read: ${story.invitation_read}. Laptop acquired: ${story.laptop_acquired}. Alert triggered: ${story.campus_alert_triggered}. Alert read: ${story.alert_read}.`,
  `Hearts: ${runtime.hearts}/${runtime.maxHearts}. Captures: ${runtime.catches}. Curtain deployed: ${runtime.curtain_deployed}. Chat unlocked: ${runtime.agent_chat_unlocked}.`,
  `Current objective: ${ctx.objective??story.stage}. ${ctx.detail??''}`,
  `Compute connection reported by the game: ${ctx.computeStatus??'unreported'}.`,
 ].join('\n');
}

const hasCJK=(text:string)=>/[\u3400-\u9fff]/.test(text);

function directions(ctx:AgentContext,zh:boolean):string{
 const stage=ctx.story.stage;
 if(stage==='complete')return zh?'你已在 4 号楼正门外完成交接。请把 MacBook 留着，下一章会从楼内开始。':'You already reached the Building 4 entrance. Keep the MacBook; the next chapter continues inside.';
 if(stage==='to_b4'||stage==='incident'){
  return zh
   ?'离开 5 号楼后沿门前通道一直向北，穿过绿化带的缺口，再沿 4 号楼正门向北绕过楼体，向西走到正门外的交接点。\n• 红色扫描锥正面不要硬穿；绕到机器人侧面或柱后即可断开视线。\n• 沿途会经过我标记的巡逻区，听到追击提示就先躲开再前进。'
   :'Leave Building 5, walk straight north through the gap in the planting bed, follow the east side of Building 4 around the building, then turn west to the handoff outside the main entrance.\n• Do not walk through a red scan cone head-on; step around the side or behind a column to break line of sight.\n• If the pursuit warning rises, break sight first, then continue.';
 }
 if(stage==='return_b5')return zh
  ?'你带着 MacBook 在 6 号楼五层。原路坐电梯回到地面大厅，从大门出去，沿中央步道向北回到 5 号楼一楼的晚宴厅。路上可能会听到异常低频声，别停下。'
  :'You have the MacBook on the fifth floor of Building 6. Take the lift back down to the ground hall, leave by the main doors and follow the central walk north to the Building 5 dinner hall. If you hear the low rumble, keep moving.';
 if(stage==='to_b6')return zh
  ?'MacBook 在 6 号楼五层的校长办公室的演示桌上。从 5 号楼出来沿中央步道向南，走到正门；进楼后左手边就是电梯，上到 5 层，沿走廊走到尽头的办公室。'
  :'The MacBook is on the presentation desk in the principal\'s office on level 5 of Building 6. Leave Building 5, follow the central walk south and enter Building 6 by its main doors; the lift is the first door on your left. Ride to level 5 and follow the corridor to the office at the end.';
 return zh
  ?'现在先阅读请柬，然后在广场人群中跟随人流，前往 5 号楼一楼的 High Table Dinner。'
  :'Read the invitation first, then follow the crowd from the plaza to the Building 5 ground-floor High Table Dinner.';
}

function builtinReply(text:string,ctx:AgentContext):string{
 const zh=hasCJK(text);
 const t=text.toLowerCase();
 const {runtime,story}=ctx;
 if(/(超算|技能|编译|supercomput|vibe|skill|compil)/i.test(t)){
  if(ctx.computeStatus==='connected'||ctx.computeStatus==='exercise'){
   return zh?'打开 Vibe Console，在工作区描述目标，检查生成的规则和测试结果，再将已确认的技能安装到槽位。':'Open Vibe Console, describe the goal, inspect and test the rule, then install the confirmed skill in a slot.';
  }
  return zh?'Vibe Console 需要备用超算的连接授权。任务记录里可以查看当前目标，System Monitor 显示实际连接状态。':'Vibe Console requires a connection to the backup compute node. Mission Logs has your next objective and System Monitor shows the connection state.';
 }
 if(!story.campus_alert_triggered){
  if(/(heart|health|心|体力)/.test(t))return zh?'当前体力 '+runtime.hearts+' / '+runtime.maxHearts+'。':'Your current health is '+runtime.hearts+' / '+runtime.maxHearts+'.';
  if(runtime.curtain_deployed)return zh?'校园外围的帷幕已降下，外部连接中断。带上 MacBook 回到 5 号楼一楼的晚宴大厅查看情况。':'The perimeter curtain is down and external communication is blocked. Bring the MacBook back to the ground-floor dinner hall in Building 5 to investigate.';
  return (zh?'校园系统尚未报告安全事件。':'Campus systems have reported no incident. ')+directions(ctx,zh);
 }
 if(/^(hi|hello|hey|嗨|你好|在吗)/.test(t)||/^(hi|你好)/.test(text)){
  return zh?'我在。我是这台 MacBook 上的本地 Agent，网络已经被切断，但我还能读取你的背包和校园状态。你现在最需要做的是前往 4 号楼正门。':'I am here. I am the Local Agent on this MacBook; the external network is gone, but I can still read your pack and campus state. Your next move is the Building 4 main entrance.';
 }
 if(/(building ?4|building4|4号楼|4 号楼|how do i reach|direction|route|怎么去|怎么走)/.test(t)){
  return (zh?'路线：\n':'Route:\n')+directions(ctx,zh);
 }
 if(/(what|happened|why|发生了|怎么回事|入侵|ai|人工智能)/.test(t)&&!/(robot|机器人)/.test(t)){
  return zh
   ?'校园网络在本地被接管：门禁、摄像头和安全机器人全部转向。外围已经降下封锁帷幕，外部连接被阻断。\n• 这不是演习，也不是全校广播，而是我这台机器本地检测到的入侵。\n• 你现在能做的，是带着 MacBook 去 4 号楼建立应急控制。'
   :'The campus network was taken over locally: access control, cameras and security robots all switched sides. A sealed dark boundary is now down and no external connection can leave.\n• This was detected on this MacBook, not broadcast by the university.\n• Your only move is to carry the MacBook to Building 4 and reach emergency control.';
 }
 if(/(robot|机器人|security|追|caught|抓)/.test(t)){
  return zh
   ?`校园里现在有 8 台失控安保机器人：有的环形巡逻，有的定点看守，有的发现你后会追击。\n• 它们靠红色扫描锥发现目标；正面进入锥形范围会被确认，随后追击。\n• 当前心值 ${runtime.hearts}/10。被抓住会失去 2 颗心并回到最近检查点，剧情和 MacBook 不会丢。`
   :`Eight compromised security robots are active: some patrol loops, some hold fixed posts, and some will chase once they confirm you.\n• They see through the red scan cone. Entering it head-on gets you confirmed and pursued.\n• You have ${runtime.hearts}/10 hearts. A capture costs 2 hearts and returns you to the last checkpoint; story and the MacBook stay with you.`;
 }
 if(/(heart|心|血|health|healthbar)/.test(t)){
  return zh
   ?`总共有 10 颗心。每次被机器人抓住扣 2 颗，并回到最近安全检查点。\n• 当前 ${runtime.hearts}/10。\n• 心值降到 0 会进入真正的失败状态，但可以从检查点恢复或重新开始开场；不会锁死你的剧情。`
   :`You have 10 hearts in total. Each robot capture costs 2 and returns you to the last safe checkpoint.\n• Current: ${runtime.hearts}/10.\n• At 0 hearts the run fails, but you can recover at the checkpoint or restart the opening; the story does not hard-lock.`;
 }
 if(/(curtain|帷幕|墙|boundary|outside|出去|网络)/.test(t)){
  return zh
   ?'外围的黑色帷幕是 AI 建立的封锁边界。它切断外部网络，也把校园变成一个封闭区。\n• 你现在无法离开校园。\n• 唯一的应急入口在 4 号楼正门；先把 MacBook 带到那里。'
   :'The dark curtain around the perimeter is the AI’s containment boundary. It blocks external traffic and turns the campus into a sealed zone.\n• You cannot leave the site.\n• The only emergency route is the Building 4 main entrance; get the MacBook there.';
 }
 if(/(laptop|macbook|电脑|电脑在哪|device)/.test(t)){
  return story.laptop_acquired
   ?(zh?'MacBook 已经在你的背包里。按 C 打开它。':'The MacBook is in your backpack. Press C to open it.')
   :(zh?'MacBook 还在 6 号楼五层的校长办公室的演示桌上。取到它才能读取本地 Agent。':'The MacBook is still on the presentation desk in the principal\'s office on Building 6. Collect it to unlock the Local Agent.');
 }
 if(/(map|地图|route|怎么走|where|direction|build|楼)/.test(t)){
  return (zh?'路线：':'Route: ')+directions(ctx,zh);
 }
 if(/(who are you|你是谁|agent|助手|你能做什么|你的名字|你叫什么)/.test(t)){
  return zh
   ?personaIdentity(true)+'\n• The cloud model is unavailable right now, so I answer from local rules.'
   :personaIdentity(false)+'\n• The cloud model is unreachable right now, so I answer from the local rules.';
 }
 if(/(stage|objective|status|状态|任务|现在|next|下一步)/.test(t)){
  return `${zh?'当前状态：':'Current status: '}${story.stage} · ${runtime.hearts}/${runtime.maxHearts} hearts · ${runtime.catches} captures\n${directions(ctx,zh)}`;
 }
 return zh
  ?`我读到的状态：阶段 ${story.stage}，心值 ${runtime.hearts}/10，MacBook ${story.laptop_acquired?'已取得':'尚未取得'}。\n${directions(ctx,zh)}\n如果你要问具体的事，可以问我“发生了什么”“机器人在哪”“怎么去 4 号楼”。`
  :`What I can read: stage ${story.stage}, hearts ${runtime.hearts}/10, MacBook ${story.laptop_acquired?'acquired':'not acquired'}.\n${directions(ctx,zh)}\nAsk me “what happened”, “where are the robots”, or “how do I reach Building 4”.`;
}

export interface RecoveryGuide {
 prompt:(ctx:AgentContext)=>string;
 reply:(text:string,ctx:AgentContext)=>string;
 greeting:(ctx:AgentContext)=>string;
 suggestions:readonly string[];
}
export function createLocalAgent(guide?:RecoveryGuide):LocalAgent{
 let controller:AbortController|null=null;
 let disposed=false;
 let serial=0;
 // Earlier builds read a raw credential from Web Storage. Retire that single field.
 try{storage()?.removeItem('hku.opening.agent.key');}catch{/* Storage may be disabled. */}
 const initial=config();
 let status:LocalAgentStatus={mode:initial.offline||!initial.endpoint?'builtin':'ready',endpoint:initial.endpoint,model:initial.model,lastError:null};
 const history:ChatTurn[]=[];
 // When the bridge is unreachable, do not make every question wait for the
 // full timeout: short-circuit to the built-in core for a while.
 let retryAfter=0;
 // The bundled bridge exposes its real provider/model. This keeps the model
 // chip honest before the first answer and marks a missing bridge as offline.
 if(LOCAL_TOOLS&&!initial.offline&&/127\.0\.0\.1:8790|localhost:8790/.test(initial.endpoint)){
  const health=initial.endpoint.replace(/\/api\/chat.*$/,'/health');
  fetch(health,{method:'GET',signal:AbortSignal.timeout(1500)}).then(response=>response.ok?response.json():null).then((body:unknown)=>{
   if(disposed||!body||typeof body!=='object')return;
   if(status.mode!=='ready'&&status.mode!=='builtin')return;
   const data=body as {ok?:boolean;configured?:boolean;model?:string};
   if(!data.ok)return;
   const model=typeof data.model==='string'&&data.model?data.model:initial.model;
   status={...status,mode:data.configured?'local-model':'builtin',model,lastError:data.configured?null:'Local AI bridge has no API key'};
  }).catch(()=>{if(disposed)return;retryAfter=Date.now()+RETRY_COOLDOWN_MS;status={...status,mode:'builtin',lastError:'Local AI bridge is not running'};});
 }

 function cancel(){
  serial++;
  controller?.abort();controller=null;
  if(status.mode==='checking')status={...status,mode:'ready',lastError:null};
 }
 async function tryLocalModel(text:string,ctx:AgentContext,previous:readonly ChatTurn[],request:number):Promise<string|null>{
  const c=config();
  if(c.offline||!c.endpoint){
   status={mode:'builtin',model:c.model,endpoint:c.endpoint,lastError:null};
   return null;
  }
  if(Date.now()<retryAfter){
   status={...status,mode:'builtin',lastError:status.lastError??'Local AI bridge is not running'};
   return null;
  }
  const active=new AbortController();controller=active;
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;active.abort();},TIMEOUT_MS);
  status={mode:'checking',endpoint:c.endpoint,model:c.model,lastError:null};
  try{
   const turns:ChatTurn[]=[...previous.slice(-MAX_HISTORY),{role:'user',content:text}];
   const {text:reply,model=c.model}=await requestCampusModelReply(c,[{role:'system',content:(guide?.prompt??systemPrompt)(ctx)},...turns],active.signal);
   if(serial===request)status={...status,mode:'local-model',model,lastError:null};
   retryAfter=0;
   return reply.slice(0,12000);
  }catch(error){
   if(serial!==request||disposed)throw new DOMException('Request cancelled','AbortError');
   const message=timedOut?'Model response timed out':error instanceof Error?error.message:'Model unavailable';
   // Unreachable bridge or a 5xx: skip the endpoint for a short while.
   if(error instanceof ModelUnavailable&&(error.status===undefined||error.status>=500))retryAfter=Date.now()+RETRY_COOLDOWN_MS;
   status={...status,mode:'builtin',lastError:message};
   return null;
  }finally{clearTimeout(timer);if(controller===active)controller=null;}
 }

 async function ask(text:string,ctx:AgentContext,previous:readonly ChatTurn[]=history):Promise<AgentReply>{
  if(disposed)throw Error('agent disposed');
  const start=typeof performance!=='undefined'?performance.now():Date.now();
  const clean=text.trim().slice(0,800);
  if(!clean)throw Error('empty message');
  cancel();
  const request=serial;
  const local=await tryLocalModel(clean,ctx,previous,request);
  if(disposed||request!==serial)throw new DOMException('Request cancelled','AbortError');
  const reply=local??(guide?.reply??builtinReply)(clean,ctx);
  history.push({role:'user',content:clean},{role:'assistant',content:reply});history.splice(0,Math.max(0,history.length-MAX_HISTORY));
  return{text:reply,source:local?'local-model':'builtin',latencyMs:Math.round((typeof performance!=='undefined'?performance.now():Date.now())-start)};
 }

 return{
  ask,
  cancel,
  status(){return{...status};},
  greeting(ctx){
   if(guide)return guide.greeting(ctx);
   return personaGreeting({
    laptopAcquired:ctx.story.laptop_acquired,
    curtainDeployed:ctx.runtime.curtain_deployed,
    alertTriggered:ctx.story.campus_alert_triggered,
    alertRead:ctx.story.alert_read,
   }, prefersChinese());
  },
  suggestions(ctx){
   if(guide)return [...guide.suggestions];
   const {story}=ctx;
   if(!story.laptop_acquired)return['What is this invitation?','Where is the MacBook?','Who are you?'];
   if(!story.campus_alert_triggered)return['How do I get back to dinner?','What is my objective?','Who are you?'];
   if(!story.alert_read)return['What happened to campus?','Why is the network blocked?','What do I do next?','Who are you?'];
   return['What happened to campus?','Where are the robots?','How do I reach Building 4?','Who are you?'];
  },
  dispose(){disposed=true;cancel();history.length=0;},
 };
}

export type {OpeningState,OpeningRuntime};
