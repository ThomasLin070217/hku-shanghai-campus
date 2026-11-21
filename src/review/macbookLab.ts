import {createMacBookExperience} from '../opening/macbook';
import {createLocalAgent} from '../opening/agent';
import {createOpeningState} from '../opening/state';
import {createOpeningRuntime} from '../opening/runtime';
import {bindComputeApps} from '../opening/computeApps';
import {registerCampusComputeSource,type CampusComputeSession} from '../lionBoss/deviceServices';
import type {CompileSlots,ProjectId,SkillPlan,SkillProject} from '../lionBoss/consoleService';
import '../opening/opening.css';
import './macbookLab.css';

// UI contract fixture only. This entry is removed from normal/playtest bundles.
// Its acknowledgements exist only in this tab and cannot affect a player's equipment or story.
const id='macbook-interface-fixture';
const cases:Record<ProjectId,{name:string;example:string;cost:number;duration:number;cooldown:number}>={
  stun:{name:'System Freeze',example:'暂停狮子的运动系统三秒，然后恢复。',cost:60,duration:3,cooldown:18},
  lure:{name:'Robot Hijack',example:'派维修机器人去左侧吸引狮子。',cost:50,duration:8,cooldown:25},
  ghost:{name:'Ghost Signal',example:'在草坪左侧投放一个假信号，让狮子改变追踪目标。',cost:35,duration:6,cooldown:15},
};
const projects:SkillProject[]=(Object.keys(cases) as ProjectId[]).map(id=>({
  id,name:cases[id].name,example:cases[id].example,description:cases[id].example,category:'接口样本',
  target:id==='ghost'?'测试信标':id==='lure'?'TEST-ROBOT-01':'TEST-LION',supported:true,
}));
const drafts=new Map<ProjectId,string>(),equipped:CompileSlots['equipped']={};
const tested=new WeakSet<SkillPlan>();
let lastCommand='等待指令';
const capacity=2,computeBudget=100;
function slots():CompileSlots{
  const used=projects.reduce((sum,p)=>sum+(equipped[p.id]?cases[p.id].cost:0),0);
  return {capacity,equipped:{...equipped},budget:{available:computeBudget-used,total:computeBudget}};
}
const session:CampusComputeSession={
  energy:()=> 'Test node · 100 units',
  vibe:{
    name:'接口演示 · 固定方案回执',projects,slots,draft:p=>drafts.get(p)??'',edit:(p,t)=>{drafts.set(p,t);},
    async preview(project,source){
      if(!source.trim())return {ok:false,message:'请先输入指令。'};
      const c=cases[project];
      return {ok:true,value:{project,source,condition:'模拟目标在线',effect:c.example,duration:c.duration,cooldown:c.cooldown,computeCost:c.cost}};
    },
    async test(plan){
      tested.add(plan);
      return {ok:true,value:[{name:'接口样本检查',expected:true,actual:true,detail:'模拟目标已确认，正式战斗仍由游戏运行时验证。'}]};
    },
    async install(plan){
      if(!tested.has(plan)||drafts.get(plan.project)!==plan.source)return {ok:false,message:'请重新测试当前草稿。'};
      if(!equipped[plan.project]){
        const count=Object.keys(equipped).length;
        if(count>=capacity||cases[plan.project].cost>slots().budget!.available)return {ok:false,message:'测试节点的槽位或算力不足。'};
        equipped[plan.project]=count===0?'Q':'R';
      }
      return {ok:true,value:undefined};
    },
    cooldown:()=>0,getFieldRule:()=>null,reset(){drafts.clear();for(const p of projects)delete equipped[p.id];},
  },
  robotics:{
    devices:()=>[{id:'TEST-ROBOT-01',name:'维修机器人样本',status:'在线',permission:'仅允许模拟扫描',
      commands:[{id:'scan',label:'Scan',enabled:true},{id:'follow',label:'Follow',enabled:false,reason:'未授予跟随权限'}],lastResult:lastCommand}],
    async execute(device,command){
      if(device!=='TEST-ROBOT-01'||command!=='scan')return {ok:false,message:'测试节点拒绝执行。'};
      lastCommand='扫描完成 · 模拟回执';return {ok:true,value:lastCommand};
    },
  },
};
const release=registerCampusComputeSource(key=>key===id?session:null);
const apps=bindComputeApps(()=>id,()=>mac.showDesktop());
document.title='MacBook 接口演示 · HKU Shanghai';
const stage=document.createElement('main');
stage.className='device-lab';
const caption=document.createElement('p');caption.textContent='B4 接口演示 · 技能、算力和机器人回执为测试数据，仅在此页面有效。';
const story=createOpeningState(),runtime=createOpeningRuntime();
story.laptop_acquired=true;story.campus_alert_triggered=true;story.alert_read=true;
const view={story,runtime,player:[0,0,0] as [number,number,number],objective:'验证备用超算接入',
  detail:'打开 Vibe Console 编译一个样本，或在 Robotics 测试设备权限。',computerPage:'tasks' as const};
const returnButton=document.createElement('button');returnButton.textContent='打开演示 MacBook';returnButton.hidden=true;
const mac=createMacBookExperience({...apps.options,devTools:true,agent:createLocalAgent(),sessionKey:id,
  onClose(){mac.suspend();mac.root.hidden=true;returnButton.hidden=false;returnButton.focus();},
  drawMap(canvas){const g=canvas.getContext('2d');if(g){g.fillStyle='#213c42';g.fillRect(0,0,canvas.width,canvas.height);g.fillStyle='#fff';g.font='18px sans-serif';g.fillText('接口样本 · 无校园定位',28,48);}},
});
returnButton.onclick=()=>{returnButton.hidden=true;mac.root.hidden=false;mac.open(view);mac.focusFirst();};
document.addEventListener('keydown',e=>{if(!mac.root.hidden&&e.key==='Escape'&&!e.isComposing&&!e.repeat){e.preventDefault();if(!mac.handleEscape())stage.querySelector<HTMLButtonElement>('[data-mac-sleep]')?.click();}});
stage.append(caption,mac.root,returnButton);document.querySelector('#app')!.append(stage);mac.open(view);mac.showApp('mission');
window.addEventListener('pagehide',e=>{if(!e.persisted){release();apps.dispose();mac.dispose();}},{once:true});
