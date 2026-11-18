import assert from 'node:assert/strict';
import * as T from 'three';
import {writeFileSync} from 'node:fs';
import {createCharacter} from '../../../src/characters/character.ts';
import {NPC_APPEARANCES} from '../../../src/characters/config.ts';
import {CampusAudio} from '../../../src/gameplay/audio.ts';
import {DEFAULT_SETTINGS} from '../../../src/gameplay/save.ts';
const characters=[];
for(const input of NPC_APPEARANCES){
  const c=createCharacter(input);
  c.animate(.02,0,true,0,0);c.root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(c.root);
  for(let i=0;i<120;i++)c.animate(1/60,.035,true,0,2.1);
  c.root.updateMatrixWorld(true);
  let finite=true;c.root.traverse(o=>{for(const v of [...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()])if(!Number.isFinite(v))finite=false;});
  characters.push({id:input.id,configuredHeight:input.height,idleBounds:box.getSize(new T.Vector3()).toArray(),motion:c.motion,finite,sockets:Object.keys(c.sockets)});
  c.dispose();
}
Object.assign(globalThis,{document:{hidden:false,addEventListener(){},removeEventListener(){}}});
const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},cancelScheduledValues(){}});
const gain=()=>({gain:param(),connect(){},disconnect(){}});
const audio=new CampusAudio(DEFAULT_SETTINGS);
audio.context={state:'running',currentTime:0,createBufferSource:()=>({buffer:null,playbackRate:param(),connect(){},disconnect(){},start(){},stop(){}}),createGain:gain,close:async()=>{}} as any;
audio.master=gain() as any;
for(const key of ['ambient','steps','ui','music'])audio.groups[key]=gain() as any;
Object.assign(audio,{stepGate:gain(),ambientGate:gain()});
audio.buffers.set('cue',{} as any);
audio.setActive(false);audio.play('cue','ambient');
const cue={pausedAmbientCueStillStarts:audio.diagnostics.activeShots===1,activeShots:audio.diagnostics.activeShots};
audio.dispose();
assert.equal(characters.length,2);
for(const c of characters){assert.equal(c.finite,true);assert.ok(Math.abs(c.idleBounds[1]-c.configuredHeight)<.03);assert.deepEqual(c.sockets,['leftHand','rightHand','back']);}
assert.equal(cue.pausedAmbientCueStillStarts,true);
const result={scope:'Node character construction/animation and mocked audio graph; no WebGL rendering, browser focus or listening verification',characters,audio:cue};
writeFileSync(new URL('../ui-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify(result,null,2)+'\n');
