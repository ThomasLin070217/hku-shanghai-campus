import type{CampusGame}from'../exploration/game';
import{readSettings,type Settings}from'../gameplay/save';
import{ITEMS}from'../items/definitions';
import type{ItemStack}from'../items/inventory';
import type{OpeningSave,OpeningState}from'./contracts';
import{validOpeningState}from'./state';
import{OPENING_WORLD_REVISION}from'./spatialLayout';

/** Opening saves live in their own namespace; the survey save (hku.digital-survey.v1) is untouched. */
export const OPENING_SAVE_KEY='hku.opening.v1';
/**
 * The shared Inventory constructor seeds exactly this instance id for survey mode.
 * It is not an opening item: capture drops it and the parser drops it, so a save
 * written before the opening cleared the backpack still loads as "no laptop yet".
 */
export const OPENING_SEED_MACBOOK_INSTANCE='student-macbook-001';
const MACBOOK='macbook-air-13-silver';
const BACKPACK_SLOTS=36;
const HOTBAR_SLOTS=9;
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
/**
 * True when the save was written by the current opening world build.
 * A mismatch means the stored pose belongs to another layout and must not be used:
 * the caller has to fall back to the stage safe pose (experience.validPose() checks
 * the same revision before it trusts a position).
 */
export function isCurrentOpeningRevision(save:OpeningSave):boolean{
 return save.worldRevision===OPENING_WORLD_REVISION;
}
/**
 * Parse and validate an opening save.
 *
 * Recovery strategy for a world revision mismatch: the save is NOT rejected.
 * Story, flags, backpack and settings stay verifiable and are returned unchanged;
 * the original `worldRevision` is preserved (never rewritten to the current one)
 * so the caller can detect the mismatch and restore the player to the stage safe
 * pose instead of trusting a position that belongs to another layout.
 */
export function parseOpeningSave(raw:unknown):OpeningSave|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(r.version!==1||r.mode!=='opening')return null;
 const worldRevision=r.worldRevision;
 if(typeof worldRevision!=='string'||!worldRevision)return null;
 const savedAt=r.savedAt;
 if(!finite(savedAt)||savedAt<0)return null;
 const story=validOpeningState(r.story);
 if(!story)return null;
 const rawPosition=r.position;
 if(!Array.isArray(rawPosition)||rawPosition.length!==3)return null;
 const px=rawPosition[0],py=rawPosition[1],pz=rawPosition[2];
 if(!finite(px)||!finite(py)||!finite(pz))return null;
 const yaw=r.yaw,pitch=r.pitch;
 if(!finite(yaw)||!finite(pitch))return null;
 const view=r.view;
 if(view!=='first'&&view!=='third')return null;
 const hotbar=r.selectedHotbar;
 if(typeof hotbar!=='number'||!Number.isInteger(hotbar)||hotbar<0||hotbar>=HOTBAR_SLOTS)return null;
 const rawSlots=r.slots;
 if(!Array.isArray(rawSlots)||rawSlots.length!==BACKPACK_SLOTS)return null;
 const ids=new Set<string>(),slots:(ItemStack|null)[]=[];
 let mac=0;
 for(const entry of rawSlots){
  if(entry===null){slots.push(null);continue;}
  if(!entry||typeof entry!=='object'||Array.isArray(entry))return null;
  const item=entry as Record<string,unknown>;
  const itemId=item.itemId;
  if(typeof itemId!=='string')return null;
  // ITEMS is a plain object: ITEMS['toString'] etc. resolve through Object.prototype.
  // Only own keys are legal item ids, otherwise a forged id survives validation.
  if(!Object.prototype.hasOwnProperty.call(ITEMS,itemId))return null;
  const def=ITEMS[itemId];
  if(!def)return null;
  const instanceId=item.instanceId;
  if(typeof instanceId!=='string'||!instanceId)return null;
  const count=item.count;
  if(typeof count!=='number'||!Number.isInteger(count)||count<1||count>def.maxStack)return null;
  if(ids.has(instanceId))return null;
  // Documented compatibility: the seeded survey MacBook is not an opening item.
  if(instanceId===OPENING_SEED_MACBOOK_INSTANCE){slots.push(null);continue;}
  ids.add(instanceId);
  if(itemId===MACBOOK)mac++;
  slots.push({itemId,instanceId,count});
 }
 // Exactly one MacBook iff the laptop beat fired; a fully empty backpack is a legitimate
 // pre-laptop bus save. Two MacBooks (different instance ids) are always illegal.
 if(story.laptop_acquired?mac!==1:mac!==0)return null;
 return{version:1,mode:'opening',worldRevision,savedAt,position:[px,py,pz],yaw,pitch,view,slots,selectedHotbar:hotbar,story,settings:readSettings(r.settings)};
}
/**
 * Snapshot the opening into a save. Every input is cloned, nothing is mutated and
 * no game state is changed: no localStorage write, no writer lock, no reward, no UI
 * switch and no player movement.
 *
 * Only the documented survey seed instance is dropped from the backpack. Any other
 * illegal item combination is kept as-is, so the next parse rejects the save and the
 * runtime error surfaces instead of being silently filtered away.
 */
export function captureOpeningSave(g:CampusGame,story:OpeningState,settings:Settings,position?:[number,number,number]):OpeningSave{
 const slots:(ItemStack|null)[]=g.inventory.slots.map(stack=>{
  if(!stack)return null;
  const itemId=stack.itemId,instanceId=stack.instanceId,count=stack.count;
  if(instanceId===OPENING_SEED_MACBOOK_INSTANCE)return null;
  return{itemId,instanceId,count};
 });
 const body=g.body.position;
 const pose:[number,number,number]=position?[position[0],position[1],position[2]]:[body.x,body.y,body.z];
 return{version:1,mode:'opening',worldRevision:OPENING_WORLD_REVISION,savedAt:Date.now(),position:pose,yaw:g.yaw,pitch:g.pitch,view:g.view,slots,selectedHotbar:g.inventory.selectedHotbar,story:{...story,events:[...story.events]},settings:{...settings}};
}
