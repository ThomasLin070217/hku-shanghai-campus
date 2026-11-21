import type {CampusGame} from '../exploration/game';
import {KEYS,keyLabel} from '../exploration/config';
import {ITEMS} from './definitions';
import {setHidden} from '../ui/dom';
/** DOM only: all mutations are through the game's single inventory. No detached drag stack. */
export function createInventoryUI(getGame:()=>CampusGame,open:()=>void,close:()=>void,_english=false){
 const english=true;
 const hud=document.createElement('div');hud.id='inventory-hud';
 hud.innerHTML=`<div id="held-name" aria-live="polite"></div><div class="inventory-dock"><div class="hotbar" aria-label="物品快捷栏"></div><button class="bag-open" title="打开背包 (${keyLabel(KEYS.inventory)})">背包 <kbd>${keyLabel(KEYS.inventory)}</kbd></button></div>`;
 const modal=document.createElement('div');modal.id='inventory-modal';modal.hidden=true;
 modal.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="bag-title" class="bag-panel"><div class="bag-heading"><div><small>HKU SHANGHAI / STUDENT KIT</small><h2 id="bag-title">随身背包<span>36 SLOTS</span></h2></div><button id="bag-close" aria-label="关闭背包">×</button></div><div class="bag-info"><span class="bag-emblem">HKU</span><div><b>为今天的探索做好准备。</b><p>拖拽物品，或依次点击两个格子移动 / 交换。</p></div></div><div class="bag-label">储物区 <span>27 格</span></div><div class="storage-grid" aria-label="背包储物区"></div><div class="bag-label">快捷栏 <span>1—9 · 滚轮切换</span></div><div class="bag-hotbar"></div><div class="bag-footer"><span id="bag-description">选择物品查看说明</span><span><kbd>${keyLabel(KEYS.inventory)}</kbd> / <kbd>${keyLabel(KEYS.pause)}</kbd> 关闭</span></div></section>`;
 if(english){for(const node of [hud,modal]){for(const [zh,en]of [['物品快捷栏','Item hotbar'],['打开背包','Open backpack'],['背包储物区','Backpack storage'],['关闭背包','Close backpack'],['随身背包','Backpack'],['为今天的探索做好准备。','Ready for tonight.'],['拖拽物品，或依次点击两个格子移动 / 交换。','Drag an item, or select two slots to move or swap it.'],['选择物品查看说明','Select an item for details'],['储物区','Storage'],['27 格','27 slots'],['快捷栏','Hotbar'],['滚轮切换','scroll to select'],['背包','Bag'],['关闭','Close']])node.innerHTML=node.innerHTML.replaceAll(zh,en);}}
 document.body.append(hud,modal);let heldTimer:ReturnType<typeof setTimeout>|undefined;let idleTimer:ReturnType<typeof setTimeout>|undefined;let source:number|null=null,revision=-1,priorGame:CampusGame|null=null,wasOpen=false,lastSelected=-1;
 // The compact dock fades to low opacity when the selection has not changed for
 // ~2 s; scroll, number keys and E wake it (owner review, 2026-11-22).
 const wake=()=>{hud.classList.remove('is-idle');if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(document.body.classList.contains('exploring')&&!getGame().inventoryOpen)hud.classList.add('is-idle');},2000);};
 const wakeKeys=(e:KeyboardEvent)=>{if(e.code===KEYS.inventory||/^Digit[1-9]$/.test(e.code))wake();};
 if(typeof window!=='undefined')window.addEventListener('keydown',wakeKeys);
 const hotbar=hud.querySelector('.hotbar')!,storage=modal.querySelector('.storage-grid')!,bagbar=modal.querySelector('.bag-hotbar')!;
 const make=(index:number,bag:boolean)=>{const b=document.createElement('button');b.type='button';b.className='item-slot';b.dataset.slot=String(index);b.dataset.bag=String(bag);b.innerHTML=`<span class="slot-number">${index<9?index+1:''}</span><img draggable="false" hidden><span class="slot-count"></span>`;
  b.onclick=()=>{const g=getGame();g.takeover('human_inventory_click');if(!bag){g.selectHotbar(index);return;}if(source===null){if(g.inventory.slots[index])source=index;}else{g.inventory.move(source,index);source=null;}revision=-1;refresh();};
  b.ondragstart=e=>{if(!getGame().inventoryOpen||!getGame().inventory.slots[index]){e.preventDefault();return;}getGame().takeover('human_inventory_drag');source=index;e.dataTransfer?.setData('text/plain',String(index));if(e.dataTransfer)e.dataTransfer.effectAllowed='move';};
  b.ondragover=e=>{if(source!==null){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';}};
  b.ondrop=e=>{e.preventDefault();if(source!==null){getGame().takeover('human_inventory_drop');getGame().inventory.move(source,index);}source=null;revision=-1;refresh();};
  b.ondragend=()=>{source=null;revision=-1;refresh();};
  b.onmouseenter=()=>{const s=getGame().inventory.slots[index];modal.querySelector('#bag-description')!.textContent=s?(english?'MacBook Air · 13-inch · Unique item':ITEMS[s.itemId].name+' · '+(ITEMS[s.itemId].stackable?'Stackable':'Not stackable')):'Empty slot';};return b;};
 for(let i=0;i<9;i++){hotbar.append(make(i,false));bagbar.append(make(i,true));}for(let i=9;i<36;i++)storage.append(make(i,true));
 hud.querySelector('button.bag-open')!.addEventListener('click',open);modal.querySelector('#bag-close')!.addEventListener('click',close);
 modal.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
 function refresh(){const g=getGame(),inv=g.inventory;setHidden(hud,!document.body.classList.contains('exploring'));setHidden(modal,!g.inventoryOpen);
  if(g.inventoryOpen&&!wasOpen)(modal.querySelector('#bag-close') as HTMLButtonElement).focus();if(!g.inventoryOpen&&wasOpen)source=null;wasOpen=g.inventoryOpen;
  if(priorGame===g&&revision===inv.revision)return;priorGame=g;revision=inv.revision;
  const selectionChanged=inv.selectedHotbar!==lastSelected;lastSelected=inv.selectedHotbar;if(selectionChanged)wake();
  for(const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#inventory-hud .item-slot,#inventory-modal .item-slot'))){const i=Number(b.dataset.slot),s=inv.slots[i],def=s?ITEMS[s.itemId]:null,img=b.querySelector('img')!;b.classList.toggle('empty',!s);b.draggable=b.dataset.bag==='true'&&!!s;b.classList.toggle('selected',i===inv.selectedHotbar);b.classList.toggle('picked',i===source);b.setAttribute('aria-label',`${english?(i<9?'Hotbar':'Bag'):(i<9?'Hotbar':'Bag')} ${i<9?i+1:i-8}: ${def?(english?'MacBook Air':def.name):'Empty'}${s?' × '+s.count:''}`);b.setAttribute('aria-pressed',String(i===inv.selectedHotbar));img.hidden=!def;if(def)img.src=def.icon;b.querySelector('.slot-count')!.textContent=s&&s.count>1?String(s.count):'';}
  // The held-item name is a toast: it shows when the selection changes, then fades after 2 s.
  const heldName=hud.querySelector<HTMLElement>('#held-name')!,label=inv.equipped?(english?'MacBook Air · 13-inch':ITEMS[inv.equipped.itemId].name):'Empty hands';
  if(heldName.textContent!==label){heldName.textContent=label;heldName.style.transition='opacity .4s';heldName.style.opacity='1';clearTimeout(heldTimer);heldTimer=setTimeout(()=>{heldName.style.opacity='0';},2000);}
 }
 return{refresh,dispose(){clearTimeout(heldTimer);clearTimeout(idleTimer);if(typeof window!=='undefined')window.removeEventListener('keydown',wakeKeys);hud.remove();modal.remove();}};
}
