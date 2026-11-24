import assert from 'node:assert/strict';
import {CampusAudio} from '../src/gameplay/audio';
import {DEFAULT_SETTINGS} from '../src/gameplay/save';
import type {Gait} from '../src/characters/gait';
// Graph-behavior test doubles; this verifies routing and lifecycle, not sound quality.
Object.assign(globalThis,{document:{hidden:false,addEventListener(){},removeEventListener(){}}});
let panners=0,resumes=0,stops=0;
const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v:number){this.value=v;},setTargetAtTime(v:number){this.value=v;}});
const gain=()=>({gain:param(),connect(){},disconnect(){}});
const context={state:'running',currentTime:1,listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,param()])),
 createBufferSource:()=>({buffer:null,playbackRate:param(),connect(){},disconnect(){},start(){},stop(){stops++;},onended:null}),createGain:gain,createPanner:()=>{panners++;throw Error('Self footsteps must not spatialize');},resume:async()=>{resumes++;context.state='running';},close:async()=>{context.state='closed';}};
const audio=new CampusAudio(DEFAULT_SETTINGS);audio.context=context as unknown as AudioContext;audio.master=gain() as unknown as GainNode;
for(const group of ['ambient','steps','ui','music'])audio.groups[group]=gain() as unknown as GainNode;
Object.assign(audio,{stepGate:gain(),ambientGate:gain()});
for(const s of ['paving','grass'])for(let i=0;i<5;i++)audio.buffers.set(`step-${s}-${i}`,{} as AudioBuffer);
audio.buffers.set('collect',{} as AudioBuffer);audio.apply(DEFAULT_SETTINGS); // fallback when cancelAndHoldAtTime is absent
const gait={steps:0,landings:0,grounded:true,speed:2.6,motion:'walk',impact:0} as Gait,point={x:0,y:0,z:0};
audio.update(gait,false,'grass',point,{x:0,y:3,z:10},0);gait.steps++;audio.update(gait,false,'grass',point,{x:0,y:3,z:10},0);
assert.equal(panners,0);assert.equal(Object.values(audio.counts).reduce((a,b)=>a+b,0),1);
gait.grounded=false;gait.steps++;audio.update(gait,false,'paving',point,point,0);assert.equal(Object.values(audio.counts).reduce((a,b)=>a+b,0),1);
gait.grounded=true;gait.landings++;gait.steps++;audio.update(gait,false,'paving',point,point,0);assert.equal(Object.values(audio.counts).reduce((a,b)=>a+b,0),2); // landing and step => one shot
for(let i=0;i<50;i++)audio.play('collect');assert.ok(audio.diagnostics.activeShots<=16);assert.ok(stops>0);
audio.setActive(false);context.state='suspended';audio.setActive(true);assert.equal(resumes,1);assert.equal(context.state,'running');audio.dispose();assert.equal(audio.diagnostics.activeShots,0);
console.log('PASS self-footstep routing, airborne silence, landing deduplication, 16-voice budget, resume and gain fallback (graph mocks; not listening)');

// Asset recovery uses the actual loader: fail one fetch, preserve decoded buffers,
// retry only missing assets, and retain one ambience owner under concurrent clicks.
let requests=0,failOnce=true,aborted=0;
const buffer={duration:.3,numberOfChannels:1,sampleRate:48000,length:14400};
const sources:any[]=[];
const makeContext=()=>({...context,state:'running',destination:{},createBufferSource(){const s={buffer:null as any,playbackRate:param(),connect(){},disconnect(){},start(){},stop(){},onended:null as null|(()=>void)};sources.push(s);return s;},decodeAudioData:async()=>buffer,resume:async()=>{}});
Object.assign(globalThis,{AudioContext:class {constructor(){return makeContext();}},fetch:async(url:URL)=>{requests++;const failed=failOnce&&url.pathname.endsWith('/collect.wav');if(failed)failOnce=false;return{ok:!failed,status:failed?503:200,arrayBuffer:async()=>new ArrayBuffer(1)};}});
const recovery=new CampusAudio(DEFAULT_SETTINGS);await Promise.all([recovery.start(),recovery.start()]);
assert.equal(requests,17,'non-story gameplay retains the complete core cue set');assert.deepEqual(recovery.diagnostics.failedFiles,['collect']);assert.equal(recovery.diagnostics.loaded,16);assert.equal(recovery.diagnostics.ambientStarts,1);
await Promise.all([recovery.start(true),recovery.start(true)]);assert.equal(requests,18);assert.equal(recovery.diagnostics.loaded,17);assert.equal(recovery.diagnostics.failed,false);assert.equal(recovery.diagnostics.ambientStarts,1);
recovery.setActive(false);await recovery.preview('steps');assert.equal(requests,18);assert.equal(recovery.diagnostics.previewShots,1);assert.equal(recovery.diagnostics.active,false);assert.equal(recovery.diagnostics.gates.steps,0);
await recovery.preview('ambient');assert.equal(requests,18);assert.equal(recovery.diagnostics.previewShots,1);assert.equal(recovery.diagnostics.ambientStarts,1);
recovery.stopPreviews();assert.equal(recovery.diagnostics.previewShots,0);
const pendingPreview=recovery.preview('ui');recovery.stopPreviews();await pendingPreview;assert.equal(recovery.diagnostics.previewShots,0,'closing settings must cancel late preview');
recovery.apply({...DEFAULT_SETTINGS,muted:true});assert.equal(recovery.diagnostics.masterGain,0);assert.equal(recovery.diagnostics.ambientEligible,false);
recovery.dispose();assert.equal(recovery.buffers.size,0);
/* A checkpoint auto-start ticks the chapters before the first gesture, when the mixer
   still has no context. The bed must be held, not dropped, or the whole run stays on the
   opening's stage mapping (observed on ?checkpoint=b4-inside, 2026-11-25). */
{
 const queued=new CampusAudio(DEFAULT_SETTINGS),scores:(string|null)[]=[];
 Object.assign(queued,{story:{setScore:(id:string|null)=>{scores.push(id);},suspended:true,voices:0,pause(){},dispose(){}}});
 queued.playScore('mus_puzzle',true);
 assert.deepEqual(scores,[],'a bed requested before the mixer runs is held, not dropped');
 await queued.start();
 assert.deepEqual(scores,['mus_puzzle'],'the first start applies the held bed to the story bus');
 queued.stopScore();
 assert.deepEqual(scores,['mus_puzzle',null],'stopScore hands the bed back and clears the held one');
 queued.playScore('mus_lawn',true);queued.stopScore();await queued.start();
 assert.deepEqual(scores,['mus_puzzle',null,null],'a bed stopped before the start is not applied later');
 queued.dispose();
}
Object.assign(globalThis,{fetch:(_url:URL,{signal}:{signal:AbortSignal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{aborted++;reject(Error('aborted'));},{once:true});})});
const unloading=new CampusAudio(DEFAULT_SETTINGS),pendingLoad=unloading.start();unloading.dispose();await pendingLoad;assert.equal(aborted,17);assert.equal(unloading.buffers.size,0);assert.equal(unloading.diagnostics.ambientStarts,0);
console.log('PASS complete non-story core startup, failed-only retry, concurrent loading, singleton ambience, paused previews, late preview cancellation, mute and in-flight abort');
