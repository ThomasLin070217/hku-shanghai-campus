import assert from 'node:assert/strict';
import {CampusAudio} from '../src/gameplay/audio';
import {DEFAULT_SETTINGS,readSettings} from '../src/gameplay/save';
import {OPENING_AUDIO_NAMES,type StoryAudioFrame} from '../src/gameplay/storyAudio';

// Routing/lifecycle checks; real decoding and rendered signal are verified in the browser report.
const listeners=new Map<string,()=>void>();
const doc={hidden:false,addEventListener(name:string,fn:()=>void){listeners.set(name,fn);},removeEventListener(name:string){listeners.delete(name);}};
Object.assign(globalThis,{document:doc});
const automation:{value:number;time:number}[]=[];
const param=()=>({value:1,cancelScheduledValues(){},setValueAtTime(v:number){this.value=v;},setTargetAtTime(v:number,t:number){this.value=v;automation.push({value:v,time:t});}});
const gain=()=>({gain:param(),connect(){},disconnect(){}});
let stopped=0,failScan=true;
const requests:string[]=[],sources:{offset:number;loop:boolean;stopped:boolean}[]=[];
const context={state:'running',currentTime:0,destination:{},listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,param()])),
 createGain:gain,createPanner:()=>({positionX:param(),positionY:param(),positionZ:param(),connect(){},disconnect(){}}),
 createBufferSource(){const source={buffer:null,playbackRate:param(),loop:false,offset:0,stopped:false,connect(){},disconnect(){},start(_at?:number,offset=0){this.offset=offset;},stop(){this.stopped=true;stopped++;},onended:null};sources.push(source);return source;},
 decodeAudioData:async()=>({duration:26.618,numberOfChannels:1,sampleRate:48000,length:1277664}),
 resume:async()=>{},suspend:async()=>{context.state='suspended';},close:async()=>{context.state='closed';},
};
Object.assign(globalThis,{AudioContext:class {constructor(){return context;}},fetch:async(url:URL)=>{requests.push(url.pathname);const failure=failScan&&url.pathname.endsWith('/robot_scan.wav');if(failure)failScan=false;return{ok:!failure,status:failure?503:200,arrayBuffer:async()=>new ArrayBuffer(0)};}});
const audio=new CampusAudio({...DEFAULT_SETTINGS,music:.2});audio.enableStory();
await Promise.all([audio.start(),audio.start()]);
assert.equal(requests.length,27+OPENING_AUDIO_NAMES.length);
assert.ok(requests.some(p=>p.endsWith('/invitation-open.wav')),'opening should load the paper replacement');
assert.equal(requests.filter(p=>p.includes('/run-')).length,10,'all five surface variants must load once');
assert.deepEqual(audio.failedFiles,['robot_scan']);assert.ok(!requests.some(p=>p.includes('boss')));
await audio.start(true);assert.equal(requests.length,28+OPENING_AUDIO_NAMES.length);assert.deepEqual(audio.failedFiles,[]);
audio.setActive(true);
const player={x:0,y:0,z:0};
const frame:StoryAudioFrame={stage:'bus',dark:false,chasing:false,player,dt:.1,robots:[]};
const tick=(count=1)=>{for(let i=0;i<count;i++){context.currentTime+=.1;audio.story!.update(frame);assert.ok(audio.voiceCount<=16);}};
tick(20);assert.equal(audio.story!.diagnostics.loopStarts['music:safe'],1);assert.equal(audio.story!.diagnostics.loopStarts['ambient:cc0_bus_engine_idle'],1);
frame.stage='to_b5';tick(20);assert.ok(!audio.story!.diagnostics.loops.includes('ambient:cc0_bus_engine_idle'));assert.ok(audio.story!.diagnostics.loops.includes('ambient:campus-breeze'));
frame.dark=true;frame.robots=[{id:'near',position:{x:3,y:0,z:0},state:'scanning'},{id:'far',position:{x:80,y:0,z:0},state:'chase'}];
tick(20);assert.equal(audio.counts.robot_scan,1);assert.ok(!audio.story!.diagnostics.loops.some(k=>k.includes('far')));
assert.equal(audio.counts.robot_patrol_step??0,0,'stationary scanning robots must not emit footsteps');
for(let i=0;i<4;i++){frame.robots[0].position.x+=.2;tick();}assert.equal(audio.counts.robot_patrol_step,1);
frame.chasing=true;frame.robots[0].state='chase';tick();assert.equal(audio.counts.robot_lockon,1);assert.ok(audio.story!.diagnostics.loops.includes('music:chase'));
assert.ok(automation.some(a=>Math.abs(a.value-Math.pow(10,-6/20))<1e-8));
tick(10);assert.equal(audio.counts.robot_lockon,1);assert.ok(!audio.story!.diagnostics.loops.includes('music:tension'));
frame.chasing=false;frame.robots[0].state='search';tick();tick(20);assert.ok(audio.story!.diagnostics.loops.includes('music:chase'),'release from chase keeps a four-second tail');tick(25);assert.ok(!audio.story!.diagnostics.loops.includes('music:chase'));
audio.story!.curtain();tick(20);const elapsed=audio.story!.diagnostics.timeline!.elapsed;
audio.setActive(false);tick(20);assert.equal(audio.story!.diagnostics.timeline!.elapsed,elapsed);assert.equal(audio.story!.voices,0);
audio.story!.cue('robot_capture',undefined,true);assert.equal(audio.counts.robot_capture,1,'capture feedback survives the caught modal');
audio.setActive(true);tick(30);assert.equal(audio.counts.sfx_veil_seal,1);tick(20);assert.equal(audio.counts.sfx_veil_seal,1);
assert.equal(audio.counts.sfx_veil_descend,1,'resume must not replay the curtain');
for(let i=0;i<50;i++)audio.play('collect');assert.ok(audio.voiceCount<=16);
const gait={steps:0,landings:0,grounded:true,speed:0,motion:'idle',impact:.5} as any;
audio.update(gait,false,'paving',player,player,0);gait.grounded=false;gait.motion='jump';
audio.update(gait,false,'paving',{...player,y:.1},player,0);assert.equal(audio.counts.step_jump,1);
gait.grounded=true;gait.landings++;gait.steps++;audio.update(gait,false,'paving',player,player,0);assert.equal(audio.counts.step_land,1);
audio.apply({...audio.settings,sfx:0,music:0,muted:true});assert.equal(audio.groups.sfx.gain.value,0);assert.equal(audio.master!.gain.value,0);
doc.hidden=true;listeners.get('visibilitychange')!();assert.equal(audio.story!.voices,0);assert.equal(audio.diagnostics.activeShots,0);
doc.hidden=false;audio.setActive(true);tick();audio.story!.reset();assert.equal(audio.story!.voices,0);assert.equal(audio.story!.diagnostics.timeline,null);
audio.dispose();assert.equal(audio.voiceCount,0);assert.ok(stopped>0);assert.equal(listeners.size,0);
assert.equal(readSettings({sfx:9}).sfx,1);assert.equal(readSettings({}).sfx,DEFAULT_SETTINGS.sfx);
console.log('PASS opening asset retry, synchronized singleton music, chase fades, positional robot transitions, curtain pause/resume, capture feedback, jump/landing dedup, shared 16-voice budget, mute/hidden/dispose and old settings');
