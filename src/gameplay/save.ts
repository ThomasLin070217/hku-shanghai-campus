import type {CampusGame} from '../exploration/game';
import {Inventory,type ItemStack} from '../items/inventory';
import {ITEMS} from '../items/definitions';
import {CLUE_IDS} from './landmarks';
import type {SurveyProgress} from './survey';
import {NOV13} from '../model/nov13Parameters';
export const SAVE_KEY='hku.digital-survey.v1';
export const DEFAULT_SETTINGS={sensitivity:.0022,fov:72,bob:false,muted:false,ambient:.20,steps:.60,ui:.45,music:0,sfx:.6};
export type Settings=typeof DEFAULT_SETTINGS;
export interface SaveData {version:1;worldRevision:string;savedAt:number;position:number[];yaw:number;pitch:number;view:'first'|'third';slots:(ItemStack|null)[];selectedHotbar:number;survey:SurveyProgress;settings:Settings;doors?:Record<string,boolean>}
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
function readDoors(raw:unknown):Record<string,boolean>{if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};const out:Record<string,boolean>={};for(const [k,v] of Object.entries(raw as Record<string,unknown>))if(k.length>0&&k.length<80&&typeof v==='boolean')out[k]=v;return out;}
export function readSettings(raw:unknown):Settings{const r=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};const s={...DEFAULT_SETTINGS};for(const [k,lo,hi]of [['sensitivity',.0004,.006],['fov',60,90],['ambient',0,1],['steps',0,1],['ui',0,1],['music',0,1],['sfx',0,1]]as const)if(finite(r[k]))s[k]=Math.min(hi,Math.max(lo,r[k] as number));for(const k of ['bob','muted']as const)if(typeof r[k]==='boolean')s[k]=r[k] as boolean;return s;}
export function parseSave(raw:unknown):SaveData|null{
 if(!raw||typeof raw!=='object')return null;const r=raw as SaveData;
 if(r.version!==1||!Array.isArray(r.slots)||r.slots.length!==36||!r.survey||!Array.isArray(r.survey.collected)||!Array.isArray(r.survey.discovered))return null;
 const ids=new Set<string>(),slots:(ItemStack|null)[]=[];
 for(const item of r.slots){if(item===null){slots.push(null);continue;}const def=item&&ITEMS[item.itemId];if(!def||typeof item.instanceId!=='string'||!item.instanceId||ids.has(item.instanceId)||!Number.isInteger(item.count)||item.count<1||item.count>def.maxStack)return null;ids.add(item.instanceId);slots.push({...item});}
 // A required, non-droppable terminal must survive malformed or old saves.
 if(!slots.some(s=>s?.itemId==='macbook-air-13-silver'))return null;
 const collected=[...new Set(r.survey.collected.filter(id=>(CLUE_IDS as readonly string[]).includes(id)))];
 const doors=readDoors(r.doors);
 return{version:1,worldRevision:typeof r.worldRevision==='string'?r.worldRevision:'unknown',savedAt:finite(r.savedAt)?r.savedAt:0,position:Array.isArray(r.position)&&r.position.length===3&&r.position.every(finite)?r.position:[Infinity,Infinity,Infinity],yaw:finite(r.yaw)?r.yaw:0,pitch:finite(r.pitch)?Math.max(-1.4,Math.min(1.4,r.pitch)):0,view:r.view==='third'?'third':'first',slots,selectedHotbar:Number.isInteger(r.selectedHotbar)&&r.selectedHotbar>=0&&r.selectedHotbar<9?r.selectedHotbar:0,survey:{collected,discovered:[...new Set(r.survey.discovered.filter(id=>typeof id==='string'&&id.length<100))],completed:r.survey.completed===true&&collected.length===CLUE_IDS.length,elapsedSeconds:finite(r.survey.elapsedSeconds)?Math.max(0,r.survey.elapsedSeconds):0},settings:readSettings(r.settings),doors};
}
export function captureSave(g:CampusGame,settings:Settings):SaveData{return{version:1,worldRevision:NOV13.revision,savedAt:Date.now(),position:g.body.position.toArray(),yaw:g.yaw,pitch:g.pitch,view:g.view,slots:g.inventory.slots.map(s=>s?{...s}:null),selectedHotbar:g.inventory.selectedHotbar,survey:structuredClone(g.survey.progress),settings:{...settings},doors:{...g.doors}};}
export function restoreSave(g:CampusGame,s:SaveData){g.pause('load_save');g.inventoryOpen=false;g.panel=null;const inv=new Inventory();inv.slots.splice(0,36,...s.slots.map(i=>i?{...i}:null));inv.selectedHotbar=s.selectedHotbar;inv.revision++;g.inventory=inv;g.survey.progress=structuredClone(s.survey);g.survey.revision++;g.doors={...(s.doors??{})};
 const [x,y,z]=s.position,w=g.body.world,h=s.position.every(finite)?w.support(x,z,y+.24):null;
 const safe=s.worldRevision===NOV13.revision&&h!==null&&Math.abs(h-y)<.35&&!w.blocked(x,z,h+.005)&&[[.2,0],[-.2,0],[0,.2],[0,-.2]].every(([dx,dz])=>{const nh=w.support(x+dx,z+dz,h);return nh!==null&&Math.abs(nh-h)<.3;});
 if(safe)g.body.position.set(x,h!,z);else g.spawn();g.yaw=safe?s.yaw:g.yaw;g.pitch=safe?s.pitch:0;g.view=s.view;g.body.velocity.set(0,0,0);g.body.grounded=true;g.records.clear();g.last=null;return{recoveredPosition:!safe};
}
