import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeAsset} from '../model/buildCampus';
import type {BuildingSpec} from '../model/campusParameters';
import type {createExplorer} from '../exploration/controller';
import {createSupplyQuest,INTERACTION_DISTANCE,QUEST_STORAGE_KEY,SUPPLIES} from './supplyQuest';

export function createSupplyScene(scene:T.Scene,explorer:ReturnType<typeof createExplorer>,specs:BuildingSpec[],notify:(text:string)=>void){
  let stored:unknown;try{stored=JSON.parse(localStorage.getItem(QUEST_STORAGE_KEY)||'null');}catch{/* Unavailable storage does not prevent play. */}
  const quest=createSupplyQuest(stored),root=new T.Group();root.name='Demo_supply_quest_NOT_surveyed_campus';scene.add(root);
  const hud=document.createElement('section');hud.id='quest-hud';hud.setAttribute('aria-label','物资检查练习');hud.innerHTML='<small>OPTIONAL / 物资检查练习</small><strong id="quest-title"></strong><div id="quest-items"></div><p id="quest-next"></p>';
  document.querySelector('.stage')!.append(hud);
  const prompt=document.createElement('div');prompt.id='interaction-prompt';prompt.setAttribute('role','status');document.querySelector('.stage')!.append(prompt);
  const title=hud.querySelector<HTMLElement>('#quest-title')!,items=hud.querySelector<HTMLElement>('#quest-items')!,next=hud.querySelector<HTMLElement>('#quest-next')!;
  const loader=new GLTFLoader(),ray=new T.Raycaster(),from=new T.Vector3(),to=new T.Vector3();
  let disposed=false,loadFailures=0,t=0,current:{id:string;name:string;distance:number}|null=null,lastPrompt='';
  const entries=[...SUPPLIES.map(s=>({...s})),{id:'station',name:'检查终端',asset:'factory-kit/screen-small.glb',height:.9,x:4,z:10}].map(s=>{
    const group=new T.Group();group.name='Practice_'+s.id;root.add(group);
    // Only shallow floor markers and soft pickups: no solid furniture across walkways.
    const pad=new T.Mesh(new T.BoxGeometry(.85,.018,.85),new T.MeshStandardMaterial({color:s.id==='station'?0xc79439:0x30765b,roughness:.9}));pad.position.y=.012;group.add(pad);
    const model=new T.Group();model.position.y=s.id==='station'?.12:.35;group.add(model);
    return {...s,group,model,loaded:false};
  });
  const ready=Promise.all(entries.map(async e=>{
    try{
      const gltf=await loader.loadAsync(import.meta.env.BASE_URL+'assets/third-party/kenney/'+e.asset);
      if(disposed){disposeAsset(gltf.scene);return;}
      let missingPalette=false;gltf.scene.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!(m as T.MeshStandardMaterial).map)missingPalette=true;});
      // GLTFLoader can resolve successfully after a texture failure. These selected
      // Kenney assets all require their accompanying palette; do not accept white placeholders.
      if(missingPalette){disposeAsset(gltf.scene);throw new Error('Kenney palette missing');}
      const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),scale=e.height/size.y;
      gltf.scene.scale.setScalar(scale);const center=bounds.getCenter(new T.Vector3());gltf.scene.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){const tex=(m as T.MeshStandardMaterial).map;if(tex){tex.magFilter=T.NearestFilter;tex.minFilter=T.NearestMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;}}}});
      e.model.add(gltf.scene);e.loaded=true;
    }catch{loadFailures++;notify('练习道具加载失败，请刷新或检查静态资产路径。校园探索仍可使用。');}
  }));
  function relocate(buildings:BuildingSpec[]){const b=buildings.find(b=>b.id==='B04')!,a=T.MathUtils.degToRad(b.rotation);for(const e of entries){const z=b.depth/2+e.z,x=b.x+Math.cos(a)*e.x+Math.sin(a)*z,wz=b.z-Math.sin(a)*e.x+Math.cos(a)*z;e.group.position.set(x,explorer.world.support(x,wz,0)??0,wz);e.group.rotation.y=a;}}
  relocate(specs);
  function refresh(){const s=quest.actor.getSnapshot(),count=s.context.collected.length;
    title.textContent=s.matches('completed')?'检查完成':s.matches('ready')?'物资齐备，返回终端':`收集门前物资 · ${count} / ${SUPPLIES.length}`;
    items.textContent=SUPPLIES.map(i=>`${s.context.collected.includes(i.id)?'✓':'□'} ${i.name}`).join('   ');
    next.textContent=s.matches('completed')?'已保存进度。可继续自由探索，Esc 中可重置练习。':s.matches('ready')?'前往金色地标，按 E 提交。':'寻找绿色地标，靠近后按 E。此为可替换练习，不是真实校园设施。';
    for(const e of entries)e.group.visible=e.id==='station'||!s.context.collected.includes(e.id as never);
    try{localStorage.setItem(QUEST_STORAGE_KEY,JSON.stringify(quest.save()));}catch{/* Session remains usable without persistence. */}
  }
  const subscription=quest.actor.subscribe(refresh);refresh();
  function update(dt:number){
    const s=quest.actor.getSnapshot(),active=explorer.enabled&&!s.matches('idle');root.visible=active;hud.hidden=!active;prompt.hidden=!active||explorer.game.paused;
    current=null;if(!active||explorer.game.paused)return;t+=dt;
    from.copy(explorer.position).y+=1.64;
    for(const e of entries){
      if(e.id!=='station'){e.model.rotation.y=t*.45;e.model.position.y=.35+Math.sin(t*2)*.045;}
      if(!e.group.visible||!e.loaded||(e.id==='station'&&!s.matches('ready')))continue;
      to.copy(e.group.position).y+=e.model.position.y+e.height*.5;
      const distance=from.distanceTo(to);if(distance>INTERACTION_DISTANCE||(current&&distance>=current.distance))continue;
      ray.set(from,to.clone().sub(from).normalize());ray.far=distance;
      if(ray.intersectObjects(explorer.world.meshes,false).length)continue;
      current={id:e.id,name:e.name,distance};
    }
    const text=current?`E  ${current.id==='station'?'提交物资':'拾取 '+current.name}`:'';
    if(text!==lastPrompt){prompt.textContent=text;lastPrompt=text;}prompt.hidden=!text;
  }
  function interact(){update(0);if(!current||explorer.game.paused||explorer.game.owner)return;
    if(quest.interact(current.id,current.distance,true)){notify(current.id==='station'?'物资检查完成 · 进度已保存':'已收集 '+current.name);update(0);}}
  explorer.interactions.add(interact);
  return {quest,root,ready,relocate,update,get status(){return{...quest.save(),loaded:entries.filter(e=>e.loaded).length,loadFailures,target:current,positions:entries.map(e=>({id:e.id,position:e.group.position.toArray()}))};},
    start(){quest.start();notify('练习已开启：寻找 CDS-1 门前的三个绿色地标。');},reset(){quest.reset();notify('练习进度已重置。');},
    dispose(){disposed=true;explorer.interactions.delete(interact);subscription.unsubscribe();quest.dispose();root.removeFromParent();disposeAsset(root);hud.remove();prompt.remove();}};
}
