import * as T from 'three';
import {sceneRegistry,type SceneRegistry,type SceneEntity,type EntityKind} from './registry';
import './inspector.css';
interface Options {host:HTMLElement;scene:T.Scene;camera:()=>T.Camera;root:()=>T.Object3D;ready:()=>boolean;openModel:()=>void;frame:(box:T.Box3)=>void;notify:(s:string)=>void}
export function createSceneInspector(o:Options){
 const events=new AbortController(),panel=document.createElement('aside');panel.id='scene-inspector';panel.hidden=true;panel.setAttribute('aria-label','场景编号与修改定位');
 panel.innerHTML='<div class="inspector-heading"><h2>场景编号</h2><button id="scene-close" aria-label="关闭场景编号">关闭</button></div><p class="inspector-intro">搜索编号或名称，也可直接点选模型细部。</p><label for="scene-search">编号或名称</label><input id="scene-search" type="search" placeholder="例如 S001、B04、玻璃"><label for="scene-kind">显示范围</label><select id="scene-kind"><option value="major">楼栋、道路与区域</option><option value="all">全部部件</option><option value="part">细部</option><option value="road">道路</option><option value="building">楼栋</option></select><p id="scene-count" role="status"></p><div id="scene-results" aria-label="编号搜索结果"></div><button id="scene-more" hidden>显示更多</button><section id="scene-detail" aria-label="选中部件"></section><div class="inspector-footer"><label><input id="scene-labels" type="checkbox" checked> 画面显示主要编号</label><button id="scene-download">导出完整编号表 JSON</button></div>';
 document.body.append(panel);const labels=document.createElement('div');labels.id='scene-id-labels';o.host.append(labels);
 const find=<E extends HTMLElement>(id:string)=>panel.querySelector<E>('#'+id)!;
 const search=find<HTMLInputElement>('scene-search'),kind=find<HTMLSelectElement>('scene-kind'),results=find('scene-results'),detail=find('scene-detail');
 const highlighter=new T.Box3Helper(new T.Box3(),0xe8a83e);highlighter.name='Editor_selection_only';highlighter.visible=false;(highlighter.material as T.Material).depthTest=false;highlighter.renderOrder=50;o.scene.add(highlighter);
 let registry:SceneRegistry|undefined,lastRoot:T.Object3D|undefined,selected:string|undefined,open=false,limit=30,labelNodes:{entity:SceneEntity;button:HTMLButtonElement}[]=[],lastLabels=0;
 const current=()=>{const root=o.root();if(root!==lastRoot){registry=sceneRegistry(root);lastRoot=root;makeLabels();}return registry!;};
 const box=(e:SceneEntity)=>new T.Box3(new T.Vector3().fromArray(e.bounds.min),new T.Vector3().fromArray(e.bounds.max));
 const task=(e:SceneEntity)=>`请修改校园部件 ${e.id}（${e.name}）。\n场景版本：${current().revision}\n源码：${e.sourceFile}\n搜索锚点：${e.sourceAnchor}\n作者键：${e.authorKey}\n范围（米）：${JSON.stringify(e.bounds)}\n参考：${e.reference}\n需修改：请在这里填写观察到的问题。\n完成后保持编号稳定，检查碰撞与参数来源，保存同角度截图，并运行 npm run check:all。`;
 function show(id:string,focus=false,reveal=true){const r=current(),e=r.get(id);if(!e)throw Error('unknown_entity');selected=id;highlighter.box.copy(box(e));highlighter.visible=true;detail.replaceChildren();
  const heading=document.createElement('h3');heading.textContent=e.id;const name=document.createElement('p');name.textContent=e.name;detail.append(heading,name);
  const actions=document.createElement('div');actions.className='inspector-actions';
  for(const [label,fn] of [['定位观察',()=>focusEntity(id)],['复制修改任务',async()=>{try{await navigator.clipboard.writeText(task(e));o.notify('已复制编号和修改定位信息');}catch{const text=document.createElement('textarea');text.value=task(e);detail.append(text);text.select();o.notify('请复制下方任务文字');}}],['查看所属部分',()=>{if(e.parentId)show(e.parentId,true);}],['返回搜索',()=>{panel.scrollTo({top:0});search.focus({preventScroll:true});}] ] as const){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{void fn();};actions.append(b);}detail.append(actions);
  for(const [label,value] of [['源码',e.sourceFile],['搜索锚点',e.sourceAnchor],['世界包围范围（米）',e.size.map(n=>n.toFixed(2)).join(' × ')],['依据',e.reference]]){const line=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+' ';line.append(strong,document.createTextNode(value));detail.append(line);}

  results.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));if(focus)o.frame(box(e));if(open&&reveal)panel.scrollTo({top:Math.max(0,detail.offsetTop-16)});return e;
 }
 function focusEntity(id:string){if(!o.ready())throw Error('editable_campus_required');if(!open)setOpen(true);return show(id,true);}
 function render(){const r=current(),q=search.value.trim(),k=kind.value;
  const matches=r.entities.filter(e=>(e.id.toLowerCase()===q.toLowerCase()|| (k==='major'?['building','road','area'].includes(e.kind):k==='all'||e.kind===k))&&(!q||[e.id,e.name,e.sourceAnchor].some(s=>s.toLowerCase().includes(q.toLowerCase()))));
  results.replaceChildren();for(const e of matches.slice(0,limit)){const b=document.createElement('button');b.dataset.id=e.id;b.setAttribute('aria-pressed',String(e.id===selected));const code=document.createElement('b');code.textContent=e.id;const title=document.createElement('span');title.textContent=e.name;b.append(code,title);b.onclick=()=>show(e.id,true);results.append(b);}
  find('scene-count').textContent=`${matches.length} 项匹配 · 全校 ${r.entities.length} 项`;find('scene-more').hidden=matches.length<=limit;
  if(!matches.length){const p=document.createElement('p');p.textContent='未找到。可切换到“全部部件”或缩短关键词。';results.append(p);}
 }
 function makeLabels(){labels.replaceChildren();labelNodes=[];for(const entity of registry!.entities.filter(e=>['building','road','area'].includes(e.kind)).sort((a,b)=>['building','road','area'].indexOf(a.kind)-['building','road','area'].indexOf(b.kind))){const b=document.createElement('button');b.textContent=entity.id;b.title=entity.name;b.setAttribute('aria-label',entity.id+' '+entity.name);b.onclick=()=>show(entity.id,true);labels.append(b);labelNodes.push({entity,button:b});}}
 function setOpen(value:boolean){open=value;panel.hidden=!open;document.body.classList.toggle('scene-inspecting',open);labels.hidden=!open;highlighter.visible=open&&!!selected;if(open){o.openModel();current();render();search.focus();}else o.host.querySelector('canvas')?.focus();}
 const point=new T.Vector3(),direction=new T.Vector3();
 function update(){if(!open)return;if(!o.ready()){setOpen(false);return;}if(lastRoot!==o.root()){current();render();if(selected&&registry!.get(selected))show(selected,false,false);else{selected=undefined;highlighter.visible=false;detail.replaceChildren();}}
  const now=performance.now();if(now-lastLabels<100)return;lastLabels=now;labels.hidden=!find<HTMLInputElement>('scene-labels').checked;if(labels.hidden)return;
  const camera=o.camera(),w=o.host.clientWidth,h=o.host.clientHeight,occupied:{x:number;y:number}[]=[];
  for(const {entity:e,button} of labelNodes){const world=point.fromArray(e.center);world.y=e.bounds.max[1]+1;direction.copy(world).sub(camera.position);const facing=direction.dot(camera.getWorldDirection(new T.Vector3()))>0;world.project(camera);const x=(world.x+1)*w/2,y=(1-world.y)*h/2;
   const visible=facing&&world.z>=-1&&world.z<=1&&x>30&&x<w-30&&y>60&&y<h-40&&!occupied.some(p=>Math.abs(p.x-x)<65&&Math.abs(p.y-y)<30);
   button.hidden=!visible;if(visible){button.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;occupied.push({x,y});}
  }
 }
 let down=[0,0];const ray=new T.Raycaster();
 o.host.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];},{signal:events.signal});
 o.host.addEventListener('pointerup',e=>{if(!open||!o.ready()||e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=o.host.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),o.camera());const hit=ray.intersectObject(o.root(),true).find(h=>{for(let n:T.Object3D|null=h.object;n;n=n.parent)if(!n.visible)return false;return true;});if(hit){const id=current().pick(hit);if(id)show(id);}},{signal:events.signal});
 search.oninput=()=>{limit=30;render();};kind.onchange=()=>{limit=30;render();};find('scene-more').onclick=()=>{limit+=30;render();};find('scene-close').onclick=()=>setOpen(false);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}},{signal:events.signal});
 find('scene-download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(current().json(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='HKU-scene-catalog.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const resize=new ResizeObserver(()=>{if(open&&selected){const e=current().get(selected);if(e)o.frame(box(e));}});resize.observe(o.host);
 labels.hidden=true;
 return{setOpen,focusEntity,show,update,get opened(){return open;},get selected(){return selected;},get registry(){return current();},dispose(){events.abort();resize.disconnect();panel.remove();labels.remove();highlighter.removeFromParent();highlighter.geometry.dispose();(highlighter.material as T.Material).dispose();}};
}
