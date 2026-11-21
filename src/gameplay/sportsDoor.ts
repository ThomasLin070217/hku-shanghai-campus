import * as T from 'three';
import type {CampusGame} from '../exploration/game';
import {KEYS,keyLabel} from '../exploration/config';
import {SPORTS_DOOR,sportsDoorWorld} from '../model/sportsDoor';
import {SPORTS_HALL_PUZZLE,checkCode,checkPassword} from './sudokuPuzzle';
import './sportsDoor.css';

/** Runtime for the fictional sports-hall east door: prompt, two-stage lock (sudoku, then a
 * numeric password), swing animation, collision toggle and save-backed lock state. All
 * answers live in content/puzzles/sports-hall-lock.json; the model never holds them. */
export function createSportsDoor(options:{root:()=>T.Object3D;game:()=>CampusGame;notify:(text:string)=>void;openPanel:()=>void;closePanel:()=>void;resume:()=>void;persist?:()=>void}){
 const {game,notify}=options;
 const prompt=document.createElement('div');prompt.id='door-prompt';prompt.hidden=true;prompt.setAttribute('role','status');
 document.querySelector('.stage')!.append(prompt);
 const puzzle=SPORTS_HALL_PUZZLE,pass=puzzle.password;
 const panel=document.createElement('div');panel.id='door-lock-panel';panel.hidden=true;
 panel.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="door-lock-title"><header><div><span class="eyebrow">SPORTS HALL · EAST DOOR</span><h2 id="door-lock-title">${puzzle.title}</h2></div><button id="door-lock-close" aria-label="关闭门锁">关闭</button></header><div id="door-lock-sudoku-step"><p class="door-lock-lead">${puzzle.lead}</p><div id="door-lock-grid" role="group" aria-label="9 乘 9 数独，4 个空格"></div><div class="door-lock-actions"><button id="door-lock-hint">提示</button><button id="door-lock-confirm">确认</button></div><p id="door-lock-status" role="status"></p></div><div id="door-lock-password-step" hidden><p class="door-lock-lead">${pass.lead}</p><p class="door-lock-hint">提示：<b>${pass.hint}</b></p><div id="door-lock-code" role="group" aria-label="${pass.length} 位数字密码"></div><div id="door-lock-keypad" role="group" aria-label="数字键盘"></div><p id="door-lock-code-status" role="status"></p></div></section>`;
 document.body.append(panel);
 const banner=document.createElement('div');banner.id='rescue-banner';banner.hidden=true;
 banner.innerHTML=`<div role="status" aria-live="polite"><span class="eyebrow">SPORTS HALL · EAST DOOR</span><h2>You have successfully rescued the students!</h2><p>100 students are safe. The hall is clear.</p><small>Click anywhere to dismiss</small></div>`;
 document.body.append(banner);
 let bannerTimer=0;
 function hideRescue(){banner.classList.remove('show');bannerTimer=window.setTimeout(()=>{banner.hidden=true;},420);}
 function showRescue(){banner.hidden=false;requestAnimationFrame(()=>banner.classList.add('show'));clearTimeout(bannerTimer);bannerTimer=window.setTimeout(hideRescue,8000);}
 banner.addEventListener('click',()=>{clearTimeout(bannerTimer);hideRescue();});
 const card=panel.querySelector('section')!,title=panel.querySelector<HTMLElement>('#door-lock-title')!,sudokuStep=panel.querySelector<HTMLElement>('#door-lock-sudoku-step')!,passwordStep=panel.querySelector<HTMLElement>('#door-lock-password-step')!;
 const grid=panel.querySelector<HTMLElement>('#door-lock-grid')!,statusLine=panel.querySelector<HTMLElement>('#door-lock-status')!;
 const codeBox=panel.querySelector<HTMLElement>('#door-lock-code')!,keypad=panel.querySelector<HTMLElement>('#door-lock-keypad')!,codeStatus=panel.querySelector<HTMLElement>('#door-lock-code-status')!;
 const inputs:HTMLInputElement[]=[],slots:HTMLElement[]=[];
 puzzle.rows.forEach((row,r)=>[...row].forEach((digit,c)=>{
  if(digit!=='*'){const cell=document.createElement('div');cell.className='sudoku-cell';cell.textContent=digit;cell.setAttribute('aria-label',`第 ${r+1} 行第 ${c+1} 列：${digit}`);grid.append(cell);return;}
  const blank=puzzle.blanks[inputs.length],input=document.createElement('input');
  input.className='sudoku-cell';input.type='text';input.inputMode='numeric';input.autocomplete='off';input.maxLength=1;input.dataset.blank=String(blank.order);
  input.setAttribute('aria-label',`第 ${blank.order} 个空，第 ${r+1} 行第 ${c+1} 列，填入 1–9`);grid.append(input);inputs.push(input);
 }));
 for(let i=0;i<pass.length;i++){const slot=document.createElement('div');slot.className='code-slot';slot.textContent='·';slots.push(slot);codeBox.append(slot);}
 for(const key of ['1','2','3','4','5','6','7','8','9','back','0','ok']){const button=document.createElement('button');button.type='button';button.dataset.key=key;button.textContent=key==='back'?'←':key==='ok'?'确认':key;if(key==='ok')button.setAttribute('aria-label','确认密码');if(key==='back')button.setAttribute('aria-label','删除一位');keypad.append(button);}
 let rootRef:T.Object3D|null=null,left:T.Object3D|null=null,right:T.Object3D|null=null,led:T.MeshStandardMaterial|null=null;
 let swing=0,flash=0,applied:boolean|null=null,appliedWorld:CampusGame['body']['world']|null=null,opened=false,stage:'sudoku'|'password'='sudoku',sudokuSolved=false,code:string[]=[];
 const isOpen=()=>game().doors[SPORTS_DOOR.id]===true;
 const setStatus=(el:HTMLElement,text:string,tone:'ok'|'warn'|'error'|''='')=>{el.textContent=text;el.dataset.tone=tone;};
 function renderCode(){slots.forEach((slot,i)=>{slot.textContent=code[i]??'·';slot.classList.toggle('filled',!!code[i]);});codeBox.setAttribute('aria-label',`${pass.length} 位数字密码，已输入 ${code.length} 位`);}
 function showStage(next:'sudoku'|'password'){
  stage=next;const sudoku=next==='sudoku';sudokuStep.hidden=!sudoku;passwordStep.hidden=sudoku;title.textContent=sudoku?puzzle.title:'门禁密码';
  if(sudoku){inputs[0]?.focus({preventScroll:true});}else{code=[];renderCode();setStatus(codeStatus,'');keypad.querySelector<HTMLButtonElement>('[data-key="1"]')?.focus({preventScroll:true});}
 }
 function reset(){for(const input of inputs)input.value='';setStatus(statusLine,'');code=[];renderCode();setStatus(codeStatus,'');card.classList.remove('shake');}
 function openLock(){
  if(opened)return;opened=true;options.openPanel();panel.hidden=false;reset();showStage(sudokuSolved?'password':'sudoku');
 }
 function closeLock(){
  if(!opened)return;opened=false;panel.hidden=true;card.classList.remove('shake');options.closePanel();options.resume();
 }
 function tryConfirm(){
  if(!opened||stage!=='sudoku')return;
  const digits=inputs.map(input=>input.value.trim());
  const missing=digits.filter(d=>!/^[1-9]$/.test(d)).length;
  if(missing){setStatus(statusLine,`还有 ${missing} 个空格没有填。`,'warn');inputs[digits.findIndex(d=>!/^[1-9]$/.test(d))]?.focus();return;}
  if(!checkCode(puzzle,digits)){setStatus(statusLine,puzzle.failure,'error');card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');audio(false);return;}
  sudokuSolved=true;showStage('password');
 }
 function submitPassword(){
  if(!opened||stage!=='password')return;
  if(code.length<pass.length){setStatus(codeStatus,`请输入 ${pass.length} 位数字。`,'warn');return;}
  if(!checkPassword(puzzle,code)){setStatus(codeStatus,pass.failure,'error');code=[];renderCode();card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');audio(false);return;}
  unlock();closeLock();
 }
 function pressKey(key:string){
  if(stage!=='password')return;
  if(key==='ok'){submitPassword();return;}
  setStatus(codeStatus,'');
  if(key==='back'){code.pop();renderCode();return;}
  if(code.length>=pass.length){code=[];}
  code.push(key);renderCode();
 }
 // A short pair of beeps keeps the lock readable without a new asset.
 let audioCtx:AudioContext|null=null;
 function audio(ok:boolean){
  try{audioCtx??=new AudioContext();const ctx=audioCtx,now=ctx.currentTime;
   [ok?660:300].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='square';osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,now+i*.09);gain.gain.exponentialRampToValueAtTime(.05,now+i*.09+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.09+.12);osc.connect(gain).connect(ctx.destination);osc.start(now+i*.09);osc.stop(now+i*.09+.13);});
  }catch{}
 }
 grid.addEventListener('input',event=>{
  const input=event.target as HTMLInputElement;if(!(input instanceof HTMLInputElement))return;
  const digit=input.value.replace(/[^1-9]/g,'').slice(-1);input.value=digit;
  if(digit){const next=inputs[inputs.indexOf(input)+1];if(next)next.focus();}
  setStatus(statusLine,'');
 });
 grid.addEventListener('keydown',event=>{
  const input=event.target as HTMLInputElement;if(!(input instanceof HTMLInputElement))return;
  if(event.key==='Backspace'&&!input.value){event.preventDefault();const previous=inputs[inputs.indexOf(input)-1];if(previous){previous.value='';previous.focus();}}
  if(event.key==='Enter'){event.preventDefault();tryConfirm();}
 });
 grid.addEventListener('focusin',()=>card.classList.remove('shake'));
 keypad.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');if(button)pressKey(button.dataset.key!);});
 panel.querySelector('#door-lock-confirm')!.addEventListener('click',tryConfirm);
 panel.querySelector('#door-lock-hint')!.addEventListener('click',()=>setStatus(statusLine,puzzle.hint,''));
 panel.querySelector('#door-lock-close')!.addEventListener('click',()=>closeLock());
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeLock();return;}
  if(stage!=='password')return;
  if(/^[0-9]$/.test(event.key)){event.preventDefault();pressKey(event.key);}
  else if(event.key==='Backspace'){event.preventDefault();pressKey('back');}
  else if(event.key==='Enter'){event.preventDefault();submitPassword();}
 });
 function ensure(){
  const root=options.root();if(root===rootRef&&left)return;rootRef=root;
  const door=root.getObjectByName(SPORTS_DOOR.name);
  left=door?.getObjectByName('Leaf_Left')??null;right=door?.getObjectByName('Leaf_Right')??null;
  const mesh=door?.getObjectByName('Night_door_lock_led');
  led=mesh instanceof T.Mesh&&!Array.isArray(mesh.material)?mesh.material as T.MeshStandardMaterial:null;
  swing=isOpen()?1:0;applied=null;
 }
 function syncCollision(g:CampusGame){
  const open=isOpen(),world=g.body.world;
  if(world!==appliedWorld||applied!==open){world.setDoorOpen(SPORTS_DOOR.id,open);appliedWorld=world;applied=open;}
 }
 /** Nearest point on the doorway, so the lock is reachable from the jambs too. */
 function near(g:CampusGame){
  const c=sportsDoorWorld(g.site.sportsZ),p=g.body.position,dx=c.x-p.x;
  const dz=T.MathUtils.clamp(c.z-p.z,-SPORTS_DOOR.width/2,SPORTS_DOOR.width/2),d=Math.hypot(dx,dz);
  if(d>3.4)return false;if(d<.45)return true;
  const facing=new T.Vector3(-Math.sin(g.yaw),0,-Math.cos(g.yaw));
  const target=new T.Vector3(dx,0,dz);if(target.lengthSq()<1e-6)return true;
  return facing.dot(target.normalize())>.35;
 }
 function interact(){
  const g=game();if(g.paused||g.inventoryOpen||g.panel)return false;if(!near(g))return false;
  if(isOpen()){notify('玻璃门已开启，可以直接通过。');return true;}
  flash=1;openLock();return true;
 }
 function unlock(){if(isOpen())return;game().doors[SPORTS_DOOR.id]=true;options.persist?.();notify('两道校验通过，玻璃门正在打开。');audio(true);showRescue();}
 function lock(){game().doors[SPORTS_DOOR.id]=false;options.persist?.();notify('门禁锁已重新锁定。');}
 function update(dt:number){
  ensure();const g=game(),open=isOpen();
  swing=T.MathUtils.damp(swing,open?1:0,7,Math.min(dt,.1));
  if(left)left.rotation.y=-Math.PI/2+swing*SPORTS_DOOR.swing;
  if(right)right.rotation.y=Math.PI/2-swing*SPORTS_DOOR.swing;
  flash=Math.max(0,flash-dt*2.6);
  if(led){led.emissive.setHex(open?0x37e07a:0xff3b2f);led.color.setHex(open?0x0b2a16:0x2a0f0d);led.emissiveIntensity=1.15+flash*1.9;}
  syncCollision(g);
  const show=!g.paused&&!g.inventoryOpen&&!g.panel&&!open&&near(g);
  prompt.hidden=!show;
  if(show)prompt.textContent=`${keyLabel(KEYS.interact)}  检查门禁锁 · 玻璃门已锁定`;
  if(opened&&!g.panel)closeLock();
 }
 function dispose(){clearTimeout(bannerTimer);banner.remove();panel.remove();prompt.remove();}
 return{update,interact,unlock,lock,dispose,get open(){return isOpen();},get swing(){return swing;},get state(){return{id:SPORTS_DOOR.id,open:isOpen(),swing:Number(swing.toFixed(3)),panel:opened,stage,sudokuSolved};}};
}
