export type ProjectId = 'stun' | 'lure' | 'ghost';

export const SKILL_SPECS = {
  stun:{name:'System Freeze',type:'SYSTEM_FREEZE',target:'LION',duration:3,cooldown:18,cost:60},
  lure:{name:'Robot Hijack',type:'ROBOT_HIJACK',target:'ROBOT',duration:8,cooldown:25,cost:50},
  ghost:{name:'Ghost Signal',type:'GHOST_SIGNAL',target:'SIGNAL',duration:6,cooldown:15,cost:35},
} as const;
export const PROJECT_IDS = Object.keys(SKILL_SPECS) as ProjectId[];
export const COMPUTE_BUDGET = 110;
export const SLOT_COUNT = 2;
export const DEFAULT_RANGE = 12;
export const MIN_RANGE = 4;
export const MAX_RANGE = 16;
export function isProjectId(id:unknown):id is ProjectId {
  return typeof id==='string' && Object.prototype.hasOwnProperty.call(SKILL_SPECS,id);
}
