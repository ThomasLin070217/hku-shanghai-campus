import * as T from 'three';import {createCharacter} from './character';import {GAIT} from './gait';
/** Export the same curated pose, never the raw source clips containing head scans/root motion. */
export function bakeLocomotionClips(){
 const clips:T.AnimationClip[]=[];
 for(const name of ['idle','walk','sprint','authored-jump','authored-land','holding-both']){
  const c=createCharacter(),speed=name==='walk'?2.6:name==='sprint'?5.2:0,duration=name==='walk'?GAIT.walkStep*2/speed:name==='sprint'?GAIT.runStep*2/speed:1;
  if(name==='holding-both')c.equip('macbook-air-13-silver');
  // Settle locomotion blend before sampling one periodic cycle; no equipment geometry in clip data.
  for(let i=0;i<90;i++)c.animate(1/60,speed/60);c.gait.phase=0;
  if(name==='authored-land'){c.animate(1/60,0,false,-6);c.animate(1/120,0,true,0);}
  const times:number[]=[],tracks=new Map<string,number[]>();const samples=48;
  for(let i=0;i<=samples;i++){const t=i/samples*duration,dt=duration/samples,air=name==='authored-jump'&&t<.655;
   if(i)c.animate(dt,speed*dt,!air,air?7.2-22*t:0);
   times.push(t);for(const n of c.nodes.slice(1)){for(const [prop,values]of [['position',n.position.toArray()],['quaternion',n.quaternion.toArray()]]as const){if(name==='holding-both'&&!n.name.startsWith('arm'))continue;const key=n.name+'.'+prop;if(!tracks.has(key))tracks.set(key,[]);tracks.get(key)!.push(...values);}}
  }
  const baked=[...tracks].map(([key,values])=>key.endsWith('quaternion')?new T.QuaternionKeyframeTrack(key,times,values):new T.VectorKeyframeTrack(key,times,values));clips.push(new T.AnimationClip(name,duration,baked));c.dispose();
 }
 return clips;
}
