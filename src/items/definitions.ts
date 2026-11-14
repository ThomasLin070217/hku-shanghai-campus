import {createMacBook} from './macbook';
import type {Group} from 'three';
export interface ItemDefinition {id:string;name:string;icon:string;model:string;stackable:boolean;maxStack:number;createModel:()=>Group;hold:{socket:'rightHand'|'leftHand';position:[number,number,number];rotation:[number,number,number];scale:number;pose:'carry';firstPerson:{position:[number,number,number];rotation:[number,number,number];scale:number}}}
export const ITEMS:Record<string,ItemDefinition>={
 'macbook-air-13-silver':{id:'macbook-air-13-silver',name:'MacBook Air · 13 英寸',icon:new URL('../../assets/items/macbook.svg',import.meta.url).href,model:'MacBook_Air_13_Silver',stackable:false,maxStack:1,createModel:()=>createMacBook().root,hold:{socket:'rightHand',position:[.152,.05,.055],rotation:[0,Math.PI,0],scale:1,pose:'carry',firstPerson:{position:[0,-.30,-.56],rotation:[.10,0,0],scale:1}}},
};
