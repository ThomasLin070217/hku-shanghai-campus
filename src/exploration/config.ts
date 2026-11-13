/** One metre world units; keys shared by first and third person. */
export const KEYS={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',jump:'Space',view:'KeyV',interact:'KeyE',pause:'Escape'} as const;
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
