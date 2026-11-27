import {OPENING_FOLEY} from '../opening/audioAssets';
import type {Settings} from './save';
import type {Gait} from '../characters/gait';
import {STORY_AUDIO_URLS} from './storyAudioAssets';
import {StoryAudio,OPENING_AUDIO_NAMES} from './storyAudio';
type Point={x:number;y:number;z:number};
const audioUrls:Record<string,URL>={
 'select':new URL('../../assets/audio/select.wav',import.meta.url),
 'equip':new URL('../../assets/audio/equip.wav',import.meta.url),
 'bag':new URL('../../assets/audio/bag.wav',import.meta.url),
 'collect':new URL('../../assets/audio/collect.wav',import.meta.url),
 'complete':new URL('../../assets/audio/complete.wav',import.meta.url),
 'view':new URL('../../assets/audio/view.wav',import.meta.url),
 'step-paving-0':new URL('../../assets/audio/campus/step-paving-0.wav',import.meta.url),
 'step-paving-1':new URL('../../assets/audio/campus/step-paving-1.wav',import.meta.url),
 'step-paving-2':new URL('../../assets/audio/campus/step-paving-2.wav',import.meta.url),
 'step-paving-3':new URL('../../assets/audio/campus/step-paving-3.wav',import.meta.url),
 'step-paving-4':new URL('../../assets/audio/campus/step-paving-4.wav',import.meta.url),
 'step-grass-0':new URL('../../assets/audio/campus/step-grass-0.wav',import.meta.url),
 'step-grass-1':new URL('../../assets/audio/campus/step-grass-1.wav',import.meta.url),
 'step-grass-2':new URL('../../assets/audio/campus/step-grass-2.wav',import.meta.url),
 'step-grass-3':new URL('../../assets/audio/campus/step-grass-3.wav',import.meta.url),
 'step-grass-4':new URL('../../assets/audio/campus/step-grass-4.wav',import.meta.url),
 'campus-breeze':new URL('../../assets/audio/campus/campus-breeze.wav',import.meta.url),
};
/** The only story/core cues fetched by the first click. Gameplay and chapter cues follow on demand. */
export const INITIAL_AUDIO_NAMES=[
 'select','equip','bag','collect','complete','view','campus-breeze',
 'mus_prologue','mus_invitation','mus_dinner',
] as const;
const initialAudioNames=new Set<string>(INITIAL_AUDIO_NAMES);
/** Loaded by the first active story frame, before movement can emit these cues. */
export const GAMEPLAY_AUDIO_NAMES=Array.from(new Set([
 ...Object.keys(audioUrls).filter(name=>!initialAudioNames.has(name)),
 ...OPENING_AUDIO_NAMES.filter(name=>!name.startsWith('mus_')),
 ...Object.keys(OPENING_FOLEY),
]));
/** One owner per experience. Gait emits events even when avatar is hidden; audio only consumes them. */
export class CampusAudio {
 context:AudioContext|null=null;buffers=new Map<string,AudioBuffer>();ambient:AudioBufferSourceNode|null=null;master:GainNode|null=null;groups:Record<string,GainNode>={};loading:Promise<void>|null=null;
 settings:Settings;counts:Record<string,number>={};failed=false;failedFiles:string[]=[];active=false;ambientStarts=0;events:{kind:string;surface:string;serial:number;time:number;position:number[]}[]=[];
 private disposed=false;private pending=new Map<string,{abort:AbortController;promise:Promise<void>}>();private previewEpoch=0;private resumeError='';private listenerPose:number[]=[];private stepGate:GainNode|null=null;private ambientGate:GainNode|null=null;private seenSteps=0;private seenLand=0;private previousGait:Gait|null=null;private variant=0;private capture:MediaStreamAudioDestinationNode|null=null;
 private openingAmbienceGain:GainNode|null=null;
 private openingAmbienceNodes:{osc:OscillatorNode[];noise:AudioBufferSourceNode|null;filter:BiquadFilterNode|null}|null=null;
 private openingAmbienceMode:'off'|'day'|'dark'='off';
 /** Dialogue ducking is multiplicative on the user's music/ambient settings. */
 private dialogueDuck=1;
 story:StoryAudio|null=null;
 private urls={...audioUrls};private seenGrounded=true;private seenY=0;
 private shots=new Map<AudioBufferSourceNode,{group:string;gain:GainNode;panner?:PannerNode;preview:boolean}>();
 /** The chapter's current looping score on the music bus; replaced, never stacked. */
 private score:{source:AudioBufferSourceNode;gain:GainNode}|null=null;
 /** Loops a chapter owns through this mixer (a room hum): pause, mute and the group volume apply. */
 private mixLoops=new Map<string,{source:AudioBufferSourceNode;gain:GainNode;level:number;name:string}>();
 /** The page's live mixer, so a chapter can route a cue without carrying an audio handle. */
 static live:CampusAudio|null=null;
 private visibility=()=>{if(document.hidden){this.setActive(false);this.stopPreviews();this.stopShots(undefined,true);void this.context?.suspend().catch(()=>{});}};
 constructor(settings:Settings){this.settings={...settings};CampusAudio.live=this;document.addEventListener('visibilitychange',this.visibility);}
 enableStory(){if(this.story)return;this.story=new StoryAudio(this);
  // Every story cue gets a URL, not only the opening's score list: a chapter routes its
  // own room tone and crowd through `loopCue`/`playSfx`, and those names must be fetchable
  // here or the sound silently never plays (S-31). Nothing is fetched until it is asked for.
  Object.assign(this.urls,STORY_AUDIO_URLS);Object.assign(this.urls,OPENING_FOLEY);}
 /**
  * Score on the shared music bus, so the player's music volume and mute still apply.
  * Looping cues are owned by this class (one at a time) and crossfaded into each
  * other, because a chapter cue outlives any single shot in the 16-voice budget.
  */
 playMusicCue(name:string,loop=false){
  this.loadAudioNames([name]).then(()=>{
   const c=this.context;if(!c||this.disposed||c.state!=='running'||document.hidden)return;
   const buffer=this.buffers.get(name);if(!buffer)return;
   // Only a looping bed is "the current score"; a one-shot stinger must survive stopMusic.
   if(loop)this.stopMusic(.8);
   const source=c.createBufferSource(),volume=c.createGain();
   source.buffer=buffer;source.loop=loop;
   volume.gain.value=0;volume.gain.setTargetAtTime(.5,c.currentTime,.05);
   source.connect(volume);volume.connect(this.groups.music);
   source.onended=()=>{if(loop&&this.score?.source===source)this.score=null;try{volume.disconnect();}catch{/* already torn down */}};
   source.start();
   if(loop)this.score={source,gain:volume};
   this.counts[name]=(this.counts[name]??0)+1;
  });
 }
 /**
  * The one way a chapter or the credits takes the score. A looping bed goes to the
  * story bus, which already crossfades and ducks the opening's cues; anything the
  * story bus is not running for (its pause at the credits, a headless or silent
  * start) falls through to the shared music bus, so the cue is never lost.
  */
 playScore(name:string,loop=true){
  // A checkpoint auto-start ticks the chapters before the first gesture, when there is
  // still no AudioContext. The chapter has already latched its bed, so dropping the
  // request would leave the whole run on the opening's stage mapping: remember it and
  // let `flushScore` apply it the moment the mixer starts running.
  if(!this.context||this.context.state!=='running'){if(loop)this.pendingScore=name;return;}
  if(loop&&this.story&&this.active&&!this.story.suspended){this.story.setScore(name);return;}
  this.playMusicCue(name,loop);
 }
 /** A chapter bed that arrived before the mixer had a running context. */
 private pendingScore:string|null=null;
 /** The score is the story bus's own field, so it survives that bus's pause. */
 private flushScore(){
  const name=this.pendingScore;if(!name)return;
  this.pendingScore=null;
  if(this.story)this.story.setScore(name);else this.playMusicCue(name,true);
 }
 /** Hands the bed back to the opening's stage mapping and clears any music-bus score. */
 stopScore(){this.pendingScore=null;this.story?.setScore(null);this.stopMusic();}
 /** Fade the current chapter score out; a following playMusicCue crosses into its own cue. */
 stopMusic(fade=.6){
  const current=this.score;this.score=null;
  if(!current||!this.context)return;
  const t=this.context.currentTime,gain=current.gain.gain;
  gain.cancelScheduledValues(t);gain.setTargetAtTime(0,t,Math.max(.02,fade/3));
  try{current.source.stop(t+fade);}catch{try{current.source.disconnect();}catch{/* nothing to release */}}
 }
 /**
  * A looping cue owned by this mixer, for a chapter's room tone. Call it every frame with
  * the level: the buffer is fetched on demand and the loop starts as soon as it decodes.
  * Mute, the group volume, pause and a hidden tab all apply, which the private
  * `HTMLAudioElement` hum it replaces could not do (S-31).
  */
 loopCue(key:string,name:string,group:'ambient'|'music'|'sfx',level:number){
  if(this.disposed||!this.context||this.context.state!=='running')return;
  const buffer=this.buffers.get(name);
  if(!buffer){void this.loadAudioNames([name]);return;}
  const t=this.context.currentTime,wanted=Math.max(0,level);
  let loop=this.mixLoops.get(key);
  if(loop&&loop.name!==name){this.stopLoopCue(key,.08);loop=undefined;}
  if(!loop){
   const source=this.context.createBufferSource(),gain=this.context.createGain();
   source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(this.groups[group]!);
   gain.gain.setValueAtTime(this.active?wanted:0,t);source.start();
   loop={source,gain,level:wanted,name};this.mixLoops.set(key,loop);
  }else if(loop.level!==wanted){
   loop.level=wanted;loop.gain.gain.setTargetAtTime(this.active?wanted:0,t,.08);
  }
 }
 /** Fades one chapter loop out and releases it when the fade ends. */
 stopLoopCue(key:string,fade=.2){
  const loop=this.mixLoops.get(key);if(!loop)return;
  this.mixLoops.delete(key);
  const c=this.context;
  if(!c){try{loop.source.stop();}catch{/* already ended */}try{loop.source.disconnect();loop.gain.disconnect();}catch{/* already released */}return;}
  const t=c.currentTime,gain=loop.gain.gain;
  gain.cancelScheduledValues(t);gain.setValueAtTime(gain.value,t);gain.setTargetAtTime(0,t,Math.max(.02,fade/3));
  loop.source.onended=()=>{try{loop.source.disconnect();loop.gain.disconnect();}catch{/* already released */}};
  try{loop.source.stop(t+fade);}catch{/* the node already ended */}
 }
 /** A one-shot cue by name, fetched on demand; the shared volume, mute and voice budget apply. */
 playSfx(name:string,group:'sfx'|'ui'|'music'|'ambient'='sfx',gain=1){
  if(this.disposed||!this.context||this.context.state!=='running')return;
  if(this.buffers.has(name)){this.play(name,group,undefined,gain);return;}
  void this.loadAudioNames([name]).then(()=>{if(!this.disposed)this.play(name,group,undefined,gain);});
 }
 /**
  * A short synthesized interface tone through the effects bus (the door keypad), so the
  * player's effects volume and mute apply — the private `AudioContext` it replaces played
  * straight to `destination` and ignored both (S-31).
  */
 beep(hz:number,duration=.13,gain=.05){
  const c=this.context;if(!c||this.disposed||c.state!=='running')return;
  const t=c.currentTime,osc=c.createOscillator(),level=c.createGain();
  osc.type='square';osc.frequency.value=hz;
  level.gain.setValueAtTime(.0001,t);
  level.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.012);
  level.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(level);level.connect(this.groups.sfx!);
  osc.start(t);osc.stop(t+duration+.02);
  osc.onended=()=>{try{osc.disconnect();level.disconnect();}catch{/* already released */}};
 }
 get voiceCount(){return this.shots.size+(this.story?.voices??0);}
 /** Call from a user gesture. Loading failure never blocks movement or throws an unhandled rejection. */
 async start(retryFailed=false){
  if(this.disposed)return;
  try{
   if(!this.context){
    this.context=new AudioContext({latencyHint:'interactive'});this.master=this.context.createGain();this.master.connect(this.context.destination);
    for(const n of ['ambient','steps','ui','music','sfx']){const g=this.context.createGain();g.connect(this.master);this.groups[n]=g;}
    this.groups.feedback=this.context.createGain();this.groups.feedback.connect(this.groups.sfx);
    this.stepGate=this.context.createGain();this.stepGate.gain.value=0;this.stepGate.connect(this.groups.steps);
    this.ambientGate=this.context.createGain();this.ambientGate.gain.value=0;this.ambientGate.connect(this.groups.ambient);this.apply(this.settings);
   }
   // Invoke resume synchronously within the click, before fetching/decoding.
   const resume=document.hidden?Promise.resolve():this.context.resume().then(()=>{this.resumeError='';},()=>{this.resumeError='The browser has not enabled sound yet. Click to retry.';});
   if(!this.loading){
    const names=!this.story?Object.keys(audioUrls):retryFailed?[...INITIAL_AUDIO_NAMES,...this.failedFiles]:INITIAL_AUDIO_NAMES;
    this.loading=this.loadAudioNames(names,retryFailed).finally(()=>{this.loading=null;});
   }
   await Promise.all([resume,this.loading]);
   this.setActive(this.active,true);
   this.flushScore();
   if(this.openingAmbienceMode!=='off')this.openingAmbience(this.openingAmbienceMode);
  }catch{this.resumeError='Sound failed to start. Click to retry.';}
 }
 /** Shared by startup, chapter prefetch and previews; concurrent requests decode a cue only once. */
 async loadAudioNames(names:readonly string[],retryFailed=false){
  if(!this.context||this.disposed)return;
  const missing=[...new Set(names)].filter(name=>this.urls[name]&&!this.buffers.has(name)&&(retryFailed||!this.failedFiles.includes(name)));
  await Promise.all(missing.map(name=>this.load(name)));
 }
 loadGameplayAudio(){return this.loadAudioNames(GAMEPLAY_AUDIO_NAMES);}
 private load(name:string){
  const existing=this.pending.get(name);if(existing)return existing.promise;
  const context=this.context!,abort=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const promise=(async()=>{
   try{
    const buffer=await Promise.race([
     (async()=>{const response=await fetch(this.urls[name],{signal:abort.signal});if(!response.ok)throw Error('HTTP '+response.status);return context.decodeAudioData(await response.arrayBuffer());})(),
     new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('audio_timeout'));},10000);})
    ]);
    if(this.disposed)return;
    this.buffers.set(name,buffer);this.failedFiles=this.failedFiles.filter(n=>n!==name);
    if(name==='campus-breeze'&&!this.ambient&&!this.story){const a=context.createBufferSource();a.buffer=buffer;a.loop=true;a.connect(this.ambientGate!);a.start();this.ambient=a;this.ambientStarts++;this.setActive(this.active,true);}
   }catch{if(!this.disposed&&!this.failedFiles.includes(name))this.failedFiles.push(name);}
   finally{clearTimeout(timer);this.pending.delete(name);this.failed=this.failedFiles.length>0;}
  })();
  this.pending.set(name,{abort,promise});return promise;
 }
 async preview(group:'ambient'|'steps'|'ui'|'music'|'sfx'){
  this.stopPreviews();const epoch=this.previewEpoch;
  const name=group==='ambient'?'campus-breeze':group==='steps'?'step-paving-0':group==='music'?'mus_safe':group==='sfx'?'robot_scan':'collect';
  await this.start();if(epoch!==this.previewEpoch||this.disposed||document.hidden)return;
  if(!this.buffers.has(name))await this.loadAudioNames([name],true);
  if(epoch!==this.previewEpoch||this.disposed||document.hidden)return;
  this.play(name,group,undefined,group==='ambient'?.48:group==='steps'?.82:group==='music'?.5:1,1,true);
 }
 stopPreviews(){this.previewEpoch++;for(const [source,node]of this.shots)if(node.preview)this.releaseShot(source);}
 private releaseShot(source:AudioBufferSourceNode){
  const node=this.shots.get(source);if(!node)return;
  this.shots.delete(source);source.onended=null;try{source.stop();}catch{}source.disconnect();node.gain.disconnect();node.panner?.disconnect();
 }
 apply(settings:Settings){this.settings={...settings};if(!this.context)return;const t=this.context.currentTime;
  const gain=(p:AudioParam,value:number)=>{if(this.context!.state!=='running'){p.cancelScheduledValues(t);p.value=value;}else{if(typeof p.cancelAndHoldAtTime==='function')p.cancelAndHoldAtTime(t);else{const current=p.value;p.cancelScheduledValues(t);p.setValueAtTime(current,t);}p.setTargetAtTime(value,t,.02);}};
  if(settings.muted){this.master!.gain.cancelScheduledValues(t);this.master!.gain.value=0;}else gain(this.master!.gain,1);
  for(const n of ['ambient','steps','ui','music','sfx']as const)if(this.groups[n])gain(this.groups[n].gain,settings[n]*(n==='ambient'||n==='music'?this.dialogueDuck:1));
 }
 /** Lower music/ambient under a spoken NPC line without changing the user's saved settings. */
 setDialogueDuck(active:boolean){const next=active?.42:1;if(next===this.dialogueDuck)return;this.dialogueDuck=next;if(!this.context||!this.groups.music||!this.groups.ambient)return;const t=this.context.currentTime;
  for(const n of ['ambient','music']as const){const p=this.groups[n].gain,target=this.settings.muted?0:this.settings[n]*this.dialogueDuck;if(typeof p.cancelAndHoldAtTime==='function')p.cancelAndHoldAtTime(t);else{const current=p.value;p.cancelScheduledValues(t);p.setValueAtTime(current,t);}p.setTargetAtTime(target,t,.12);}}
 setActive(value:boolean,force=false){value=value&&!document.hidden&&!this.disposed;if(value===this.active&&!force)return;this.active=value;if(!this.context)return;if(value&&this.context.state==='suspended')void this.context.resume().then(()=>{this.resumeError='';},()=>{this.resumeError='The browser has not enabled sound yet. Click to retry.';});const t=this.context.currentTime;this.ambientGate?.gain.setTargetAtTime(value&&!this.story ? .48:0,t,.12);this.stepGate?.gain.setTargetAtTime(value?1:0,t,.006);for(const loop of this.mixLoops.values())loop.gain.gain.setTargetAtTime(value?loop.level:0,t,.06);if(!value){this.setDialogueDuck(false);this.stopShots('steps');this.stopShots('sfx',true);this.story?.pause();}else this.flushScore();}
 private stopShots(group?:string,immediate=false){
  for(const [source,node]of this.shots)if(!group||node.group===group){
   if(immediate||this.context?.state!=='running'){this.releaseShot(source);continue;}
   const t=this.context.currentTime;node.gain.gain.cancelScheduledValues(t);node.gain.gain.setTargetAtTime(0,t,.006);
   try{source.stop(t+.03);}catch{this.releaseShot(source);}
  }
 }
 play(name:string,group='ui',position?:Point,gain=1,rate=1,preview=false){
  const c=this.context;if(!c||this.disposed||c.state!=='running'||document.hidden||!this.buffers.has(name)||!this.groups[group]||group==='steps'&&!this.active&&!preview)return;
  if(this.voiceCount>=16){const oldest=this.shots.keys().next().value;if(oldest)this.releaseShot(oldest);else return;}
  const source=c.createBufferSource(),volume=c.createGain();source.buffer=this.buffers.get(name)!;source.playbackRate.value=rate;volume.gain.value=gain;source.connect(volume);let panner:PannerNode|undefined;
  const bus=preview?this.groups[group]:group==='steps'?this.stepGate!:this.groups[group];
  if(position){panner=c.createPanner();panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=2;panner.rolloffFactor=.6;panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;volume.connect(panner);panner.connect(bus);}else volume.connect(bus);
  this.shots.set(source,{group,gain:volume,panner,preview});source.onended=()=>this.releaseShot(source);
  if(preview){const duration=Math.min(source.buffer.duration/rate,2.5),t=c.currentTime;volume.gain.value=0;volume.gain.setTargetAtTime(gain,t,.012);volume.gain.setTargetAtTime(0,t+Math.max(.02,duration-.08),.012);source.start();source.stop(t+duration);}else source.start();
  this.counts[name]=(this.counts[name]??0)+1;
 }
 /**
  * Play an already-decoded NPC voice buffer through the shared SFX bus.
  * Returns a stop handle so a dialogue controller can cancel one line without
  * stopping unrelated effects. `onended` fires only on natural completion.
  */
 playVoice(buffer:AudioBuffer,options:{position?:Point;gain?:number;onended?:()=>void}={}){
  const c=this.context;if(!c||this.disposed||c.state!=='running'||document.hidden)return null;
  if(this.voiceCount>=16){const oldest=this.shots.keys().next().value;if(oldest)this.releaseShot(oldest);else return null;}
  const source=c.createBufferSource(),volume=c.createGain();source.buffer=buffer;volume.gain.value=options.gain??1;source.connect(volume);
  let panner:PannerNode|undefined;
  if(options.position){panner=c.createPanner();panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=4;panner.rolloffFactor=.4;panner.maxDistance=28;panner.positionX.value=options.position.x;panner.positionY.value=options.position.y;panner.positionZ.value=options.position.z;volume.connect(panner);panner.connect(this.groups.sfx);}
  else volume.connect(this.groups.sfx);
  let done=false;
  const handle={stop:()=>{if(done)return;done=true;this.releaseShot(source);}};
  this.shots.set(source,{group:'sfx',gain:volume,panner,preview:false});
  source.onended=()=>{if(done)return;done=true;this.releaseShot(source);options.onended?.();};
  source.start();
  this.counts['npc-voice']=(this.counts['npc-voice']??0)+1;
  return handle;
 }
 /** Local opening cues share the existing context, mixer and voice budget. */
 openingCue(kind:'bus'|'door'|'disturbance'|'scan'|'alert'|'curtain'|'caught'|'heartbeat'|'unlock'|'chase'|'wake'){
  const c=this.context;if(!c||!this.active)return;
  if(this.story&&kind!=='wake'){
   if(kind==='disturbance')this.story.disturbance();
   else if(kind==='curtain')this.story.curtain();
   else if(kind==='caught')this.story.cue('robot_capture',undefined,true);
   else if(kind==='door')this.story.cue('bus_door');
   else if(kind==='unlock')this.story.cue('agent_status',undefined,true);
   else if(kind==='alert')this.story.cue('ui_error');
   if(kind!=='heartbeat')return;
  }
  if(!this.groups.opening){this.groups.opening=c.createGain();this.groups.opening.connect(this.story?this.groups.sfx:this.groups.ambient);}
  const name='opening-'+kind;if(!this.buffers.has(name)){
   const seconds=kind==='wake'?3.0:kind==='curtain'?4.6:kind==='disturbance'?2.3:kind==='bus'?1.6:kind==='caught'?.9:kind==='heartbeat'?.55:kind==='unlock'?.7:.32;
   const buffer=c.createBuffer(1,Math.round(c.sampleRate*seconds),c.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++){
    const t=i/c.sampleRate,u=i/data.length,fade=Math.sin(Math.PI*u);
    let sample=0;
    if(kind==='wake'){const engine=Math.sin(t*41*Math.PI*2)*.12+Math.sin(t*63*Math.PI*2)*.05;const noise=(Math.random()-.5)*.05;sample=(engine+noise)*Math.sin(Math.PI*Math.min(1,t/2.6));}
    else if(kind==='heartbeat'){const beat=(t%.34)<.09?Math.exp(-((t%.34)*26))*Math.sin(t*54*Math.PI*2):0;sample=beat*.55;}
    else if(kind==='caught'){sample=(Math.sin(t*44*Math.PI*2)*.32+(Math.random()-.5)*.22)*Math.exp(-t*3.4);}
    else if(kind==='unlock'){sample=Math.sin(t*(420+t*520)*Math.PI*2)*.12*fade;}
    else if(kind==='chase'){sample=(Math.sin(t*880*Math.PI*2)>0?.10:-.10)*fade;}
    else if(kind==='curtain'){const sweep=58-t*10;sample=(Math.sin(t*sweep*Math.PI*2)*.18+(Math.random()-.5)*.20)*Math.min(1,t/1.2)*(1-t/seconds);}
    else{const freq=kind==='scan'?680:kind==='alert'?210:kind==='door'?115:75;const noise=kind==='disturbance'||kind==='bus'?(Math.random()-.5)*.16:0;sample=(Math.sin(t*freq*Math.PI*2)*.10+noise)*fade*(kind==='disturbance'?(Math.sin(t*19)>0?.9:.15):1);}
    data[i]=sample;
   }
   this.buffers.set(name,buffer);
  }this.play(name,'opening');
 }
 /**
  * A low, electrical bed for the AI takeover. Day uses the existing campus breeze;
  * dark adds detuned sub oscillators and filtered noise. All voices are owned by
  * this mixer, so the global mute and ambient slider still apply.
  */
 openingAmbience(mode:'off'|'day'|'dark'){
  this.openingAmbienceMode=mode;
  if(this.story)return;
  const c=this.context;if(!c||this.disposed)return;
  if(!this.openingAmbienceGain){
   this.openingAmbienceGain=c.createGain();this.openingAmbienceGain.gain.value=0;
   this.openingAmbienceGain.connect(this.groups.ambient);
   const osc:OscillatorNode[]=[];
   for(const [freq,type,level] of [[46,'sine',.55],[69,'triangle',.22],[103,'sine',.10]] as const){
    const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.value=level;o.connect(g);g.connect(this.openingAmbienceGain);o.start();osc.push(o);
   }
   const seconds=2,buffer=c.createBuffer(1,Math.round(c.sampleRate*seconds),c.sampleRate),data=buffer.getChannelData(0);
   let last=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+.02*white)/1.02;data[i]=last*3.2;}
   const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;filter.Q.value=.7;
   noise.connect(filter);filter.connect(this.openingAmbienceGain);noise.start();
   this.openingAmbienceNodes={osc,noise,filter};
  }
  const t=c.currentTime,level=mode==='dark'?.16:0;
  this.openingAmbienceGain.gain.cancelScheduledValues(t);
  this.openingAmbienceGain.gain.setTargetAtTime(level,t,.8);
 }
 stopOpeningCues(){this.stopShots('opening',true);this.stopShots('sfx',true);}
 update(gait:Gait,paused:boolean,surface:'grass'|'paving',position:Point,listener:Point,yaw:number){
  this.setActive(!paused);const c=this.context,pose=[listener.x,listener.y,listener.z,yaw];if(c&&pose.some((v,i)=>v!==this.listenerPose[i])){this.listenerPose=pose;const l=c.listener,t=c.currentTime;l.positionX.setValueAtTime(listener.x,t);l.positionY.setValueAtTime(listener.y,t);l.positionZ.setValueAtTime(listener.z,t);l.forwardX.setValueAtTime(-Math.sin(yaw),t);l.forwardY.setValueAtTime(0,t);l.forwardZ.setValueAtTime(-Math.cos(yaw),t);l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  if(this.previousGait!==gait){this.previousGait=gait;this.seenSteps=gait.steps;this.seenLand=gait.landings;this.seenGrounded=gait.grounded;this.seenY=position.y;return;}
  const jump=this.seenGrounded&&!gait.grounded&&position.y>this.seenY+.001;this.seenGrounded=gait.grounded;this.seenY=position.y;
  const step=gait.steps>this.seenSteps,land=gait.landings>this.seenLand;this.seenSteps=gait.steps;this.seenLand=gait.landings;
  if(!paused&&jump&&this.story){this.story.cue('step_jump');this.events.push({kind:'jump',surface,serial:gait.steps,time:c?.currentTime??0,position:[position.x,position.y,position.z]});}
  if(paused||!gait.grounded)return;
  if(land||step&&gait.speed>.04){const kind=land?'landing':'footstep',serial=land?gait.landings:gait.steps;const index=[0,3,1,4,2][this.variant++%5],rate=[.98,1.02,1,.96,1.03][this.variant%5];
   this.play(land&&this.story&&this.buffers.has('step_land')?'step_land':this.story&&gait.motion==='run'&&this.buffers.has(`run-${surface}-${index}`)?`run-${surface}-${index}`:`step-${surface}-${index}`,'steps',undefined,land ? (this.story ? .6+gait.impact*.35 : .75+gait.impact*.4) : gait.motion==='run'?(this.story?.78:1.08):.82,land ? .88 : rate);
   this.events.push({kind,surface,serial,time:c?.currentTime??0,position:[position.x,position.y,position.z]});if(this.events.length>1200)this.events.shift();
  }
 }
 /** Explicit recording tap: captures the same final mix sent to the output, no mic permission. */
 recordingStream(){if(!this.context||!this.master)throw Error('Start audio from a user click first');if(!this.capture){this.capture=this.context.createMediaStreamDestination();this.master.connect(this.capture);}return this.capture.stream;}
 get diagnostics(){
  const running=this.context?.state==='running',gains=Object.fromEntries(Object.entries(this.groups).map(([k,v])=>[k,v.gain.value]));
  return{state:this.context?.state??'uninitialized',active:this.active,running,muted:this.settings.muted,resumeError:this.resumeError,
   masterGain:this.master?.gain.value??0,gates:{steps:this.stepGate?.gain.value??0,ambient:this.ambientGate?.gain.value??0},
   ambientEligible:running&&this.active&&!this.settings.muted&&this.settings.ambient>0&&(!!this.ambient||!!this.story?.diagnostics.loops.some(k=>k.startsWith('ambient:'))),
   ambientVoices:(this.ambient?1:0)+(this.story?.diagnostics.loops.filter(k=>k.startsWith('ambient:')).length??0),ambientStarts:this.ambientStarts,activeShots:this.shots.size,previewShots:[...this.shots.values()].filter(n=>n.preview).length,
   counts:{...this.counts},failed:this.failed,failedFiles:[...this.failedFiles],loading:[...this.pending.keys()],loaded:this.buffers.size,total:Object.keys(this.urls).length,voiceCount:this.voiceCount,story:this.story?.diagnostics??null,
   buffers:[...this.buffers].map(([name,b])=>({name,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate,decodedBytes:b.length*b.numberOfChannels*4})),gains};
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.dialogueDuck=1;document.removeEventListener('visibilitychange',this.visibility);this.stopPreviews();this.stopShots(undefined,true);for(const loop of this.mixLoops.values()){try{loop.source.stop();}catch{/* already ended */}try{loop.source.disconnect();loop.gain.disconnect();}catch{/* already released */}}this.mixLoops.clear();if(CampusAudio.live===this)CampusAudio.live=null;this.story?.dispose();for(const {abort}of this.pending.values())abort.abort();try{this.ambient?.stop();}catch{}this.ambient?.disconnect();this.ambient=null;if(this.openingAmbienceNodes){for(const o of this.openingAmbienceNodes.osc){try{o.stop();}catch{}o.disconnect();}try{this.openingAmbienceNodes.noise?.stop();}catch{}this.openingAmbienceNodes.noise?.disconnect();this.openingAmbienceNodes.filter?.disconnect();this.openingAmbienceNodes=null;}this.openingAmbienceGain?.disconnect();this.openingAmbienceGain=null;this.capture?.stream.getTracks().forEach(t=>t.stop());this.capture?.disconnect();this.master?.disconnect();this.stepGate?.disconnect();this.ambientGate?.disconnect();Object.values(this.groups).forEach(g=>g.disconnect());this.buffers.clear();void this.context?.close();}

}
