/** One metre world units; keys shared by first and third person. */
export const KEYS={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',jump:'Space',view:'KeyV',interact:'KeyF',inventory:'KeyE',computer:'KeyC',pause:'Escape',zoomIn:'BracketLeft',zoomOut:'BracketRight'} as const;
// These remappable device keys are separate from movement, interaction and inventory.
export const BOSS_SKILL_KEYS={first:'Q',second:'R',choices:['Q','R','T','G','X','Z']} as const;
export const EXPLORATION={
 speed:2.6, sprintSpeed:5.2, radius:.28, height:1.80, eyeHeight:1.64,
 maxStep:.24,maxDrop:.30,gravity:22,jumpSpeed:7.2,fixedStep:1/120,
 spawnOffset:[0,0,13] as [number,number,number],
 cameraDistance:4.8,minDistance:2.2,maxDistance:10,cameraPitch:.18,
 minPitch:-1.40,maxPitch:1.40,targetHeight:1.30,followSharpness:20,turnSharpness:18,
 mouseSensitivity:.0022,strideLength:1.45,
};
export const LANDSCAPE = {
  entranceBedWidth: 16, entranceBedDepth: 4.6, entranceBedOffset: 18,
  entranceBedZ: 3.6, entranceBedHeight: .36,
  stairCount: 30, stairRise: .17, stairRun: .8, stairStartZ: -51,
  stairWidth: 30, stairWalkWidth: 15,
  rampStart: .20, rampEnd: Math.PI*2, rampWidth: 4,
};

export const keyLabel=(code:string)=>code.startsWith('Key')?code.slice(3):({Space:'空格',ShiftLeft:'Shift',Escape:'Esc',BracketLeft:'[',BracketRight:']'}[code]??code);
export const CONTROL_GUIDE=(english=false)=>english?`WASD move · Shift run · Space jump · F interact · E backpack · C MacBook · V view · 1–9 / scroll items`:`${keyLabel(KEYS.forward)}${keyLabel(KEYS.left)}${keyLabel(KEYS.back)}${keyLabel(KEYS.right)} 行走 · ${keyLabel(KEYS.sprint)} 奔跑 · ${keyLabel(KEYS.jump)} 跳跃 · ${keyLabel(KEYS.interact)} 交互 · ${keyLabel(KEYS.inventory)} 背包 · ${keyLabel(KEYS.computer)} 电脑 · ${keyLabel(KEYS.view)} 视角 · 1–9 / 滚轮物品`;
