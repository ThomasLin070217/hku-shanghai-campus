import {ITEMS} from './definitions';
export interface ItemStack {itemId:string;instanceId:string;count:number}
export class Inventory {
 readonly slots:(ItemStack|null)[]=Array.from({length:36},()=>null);
 selectedHotbar=0;revision=0;
 constructor(){this.slots[9]={itemId:'macbook-air-13-silver',instanceId:'student-macbook-001',count:1};}
 get equipped(){return this.slots[this.selectedHotbar];}
 select(index:number){if(!Number.isInteger(index)||index<0||index>8)return false;if(this.selectedHotbar!==index){this.selectedHotbar=index;this.revision++;}return true;}
 move(from:number,to:number){
  if(![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<36)||from===to)return false;
  const a=this.slots[from],b=this.slots[to];if(!a)return false;
  if(b&&a.itemId===b.itemId&&ITEMS[a.itemId].stackable){const n=Math.min(a.count,ITEMS[a.itemId].maxStack-b.count);if(n<=0)return false;b.count+=n;a.count-=n;if(!a.count)this.slots[from]=null;}
  else [this.slots[from],this.slots[to]]=[b,a];this.revision++;return true;
 }
 snapshot(){return{slots:this.slots.map((s,index)=>({index,...(s?{...s}:{}),empty:!s})),selectedHotbar:this.selectedHotbar,equipped:this.equipped?{...this.equipped}:null,revision:this.revision};}
}

export type InventorySnapshot=ReturnType<Inventory['snapshot']>;
