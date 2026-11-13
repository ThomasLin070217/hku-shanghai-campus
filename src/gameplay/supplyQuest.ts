import {assign, createActor, setup} from 'xstate';

// Demonstration content, not part of Frost's canonical 2035 story.
export const SUPPLIES = [
  {id:'water',name:'饮用水',asset:'survival-kit/bottle.glb',height:.48,x:-5,z:12},
  {id:'hammer',name:'维修锤',asset:'survival-kit/tool-hammer.glb',height:.58,x:5,z:15},
  {id:'planks',name:'木板',asset:'survival-kit/resource-planks.glb',height:.32,x:0,z:19},
] as const;
export type SupplyId=typeof SUPPLIES[number]['id'];
export const SUPPLY_IDS:readonly string[]=SUPPLIES.map(s=>s.id);
export const QUEST_STORAGE_KEY='hku.practice-supplies.v1';
export const INTERACTION_DISTANCE=2.25;
type QuestEvent={type:'START'}|{type:'COLLECT';id:SupplyId}|{type:'SUBMIT'}|{type:'RESET'};
export const supplyMachine=setup({
  types:{context:{} as {collected:SupplyId[]},events:{} as QuestEvent},
  guards:{allCollected:({context})=>context.collected.length===SUPPLIES.length,
    newItem:({context,event})=>event.type==='COLLECT'&&SUPPLY_IDS.includes(event.id)&&!context.collected.includes(event.id)},
  actions:{collect:assign({collected:({context,event})=>event.type==='COLLECT'?[...context.collected,event.id]:context.collected}),clear:assign({collected:()=>[]})},
}).createMachine({
  id:'campus-supply-practice',initial:'idle',context:{collected:[]},
  on:{RESET:{target:'.idle',actions:'clear'}},
  states:{idle:{on:{START:'active'}},active:{on:{COLLECT:{guard:'newItem',actions:'collect'}},always:{guard:'allCollected',target:'ready'}},ready:{on:{SUBMIT:'completed'}},completed:{}},
});
export interface QuestSave {version:1;started:boolean;collected:SupplyId[];completed:boolean}
export function readQuestSave(raw:unknown):QuestSave|null{
  if(!raw||typeof raw!=='object')return null;
  const s=raw as QuestSave;
  if(s.version!==1||typeof s.started!=='boolean'||typeof s.completed!=='boolean'||!Array.isArray(s.collected)||s.collected.some(id=>!SUPPLY_IDS.includes(id))||new Set(s.collected).size!==s.collected.length)return null;
  if((!s.started&&(s.collected.length>0||s.completed))||(s.completed&&s.collected.length!==SUPPLIES.length))return null;
  return {version:1,started:s.started,collected:[...s.collected],completed:s.completed};
}
export function createSupplyQuest(saved?:unknown){
  const actor=createActor(supplyMachine).start(),save=readQuestSave(saved);
  if(save?.started){actor.send({type:'START'});for(const id of save.collected)actor.send({type:'COLLECT',id});if(save.completed)actor.send({type:'SUBMIT'});}
  return {
    actor,
    start:()=>actor.send({type:'START'}),reset:()=>actor.send({type:'RESET'}),
    interact(id:string,distance:number,visible:boolean){
      // Both UI and future Agent adapters must pass the same spatial checks.
      if(!Number.isFinite(distance)||distance<0||distance>INTERACTION_DISTANCE||!visible)return false;
      const before=actor.getSnapshot();
      if(id==='station'&&before.matches('ready'))actor.send({type:'SUBMIT'});
      else if(SUPPLY_IDS.includes(id)&&before.matches('active'))actor.send({type:'COLLECT',id:id as SupplyId});
      return actor.getSnapshot()!==before;
    },
    save():QuestSave{const s=actor.getSnapshot();return{version:1,started:!s.matches('idle'),collected:[...s.context.collected],completed:s.matches('completed')};},
    dispose:()=>actor.stop(),
  };
}
