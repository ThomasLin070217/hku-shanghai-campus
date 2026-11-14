import type {Settings} from './save';
import type {Gait} from '../characters/gait';
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
/** One owner per experience. Gait emits events even when avatar is hidden; audio only consumes them. */
export class CampusAudio {
 context:AudioContext|null=null;buffers=new Map<string,AudioBuffer>();ambient:AudioBufferSourceNode|null=null;master:GainNode|null=null;groups:Record<string,GainNode>={};loading:Promise<void>|null=null;
 settings:Settings;counts:Record<string,number>={};failed=false;failedFiles:string[]=[];active=false;ambientStarts=0;events:{kind:string;surface:string;serial:number;time:number;position:number[]}[]=[];
 private disposed=false;private pending=new Map<string,AbortController>();private previewEpoch=0;private resumeError='';private listenerPose:number[]=[];private stepGate:GainNode|null=null;private ambientGate:GainNode|null=null;private seenSteps=0;private seenLand=0;private previousGait:Gait|null=null;private variant=0;private capture:MediaStreamAudioDestinationNode|null=null;
 private shots=new Map<AudioBufferSourceNode,{group:string;gain:GainNode;panner?:PannerNode;preview:boolean}>();
 private visibility=()=>{if(document.hidden){this.setActive(false);this.stopPreviews();this.stopShots(undefined,true);void this.context?.suspend().catch(()=>{});}};
 constructor(settings:Settings){this.settings={...settings};document.addEventListener('visibilitychange',this.visibility);}
 /** Call from a user gesture. Loading failure never blocks movement or throws an unhandled rejection. */
 async start(retryFailed=false){
  if(this.disposed)return;
  try{
   if(!this.context){
    this.context=new AudioContext({latencyHint:'interactive'});this.master=this.context.createGain();this.master.connect(this.context.destination);
    for(const n of ['ambient','steps','ui','music']){const g=this.context.createGain();g.connect(this.master);this.groups[n]=g;}
    this.stepGate=this.context.createGain();this.stepGate.gain.value=0;this.stepGate.connect(this.groups.steps);
    this.ambientGate=this.context.createGain();this.ambientGate.gain.value=0;this.ambientGate.connect(this.groups.ambient);this.apply(this.settings);
   }
   // Invoke resume synchronously within the click, before fetching/decoding.
   const resume=document.hidden?Promise.resolve():this.context.resume().then(()=>{this.resumeError='';},()=>{this.resumeError='浏览器尚未启用声音，请点击重试';});
   if(!this.loading){
    const names=Object.keys(audioUrls).filter(n=>!this.buffers.has(n)&&(retryFailed||!this.failedFiles.includes(n)));
    this.loading=Promise.all(names.map(n=>this.load(n))).then(()=>{}).finally(()=>{this.loading=null;});
   }
   await Promise.all([resume,this.loading]);
   this.setActive(this.active,true);
  }catch{this.resumeError='声音启动失败，请点击重试';}
 }
 private async load(name:string){
  const context=this.context!,abort=new AbortController();this.pending.set(name,abort);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const buffer=await Promise.race([
    (async()=>{const response=await fetch(audioUrls[name],{signal:abort.signal});if(!response.ok)throw Error('HTTP '+response.status);return context.decodeAudioData(await response.arrayBuffer());})(),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('audio_timeout'));},10000);})
   ]);
   if(this.disposed)return;
   this.buffers.set(name,buffer);this.failedFiles=this.failedFiles.filter(n=>n!==name);
   if(name==='campus-breeze'&&!this.ambient){const a=context.createBufferSource();a.buffer=buffer;a.loop=true;a.connect(this.ambientGate!);a.start();this.ambient=a;this.ambientStarts++;this.setActive(this.active,true);}
  }catch{if(!this.disposed&&!this.failedFiles.includes(name))this.failedFiles.push(name);}
  finally{clearTimeout(timer);this.pending.delete(name);this.failed=this.failedFiles.length>0;}
 }
 async preview(group:'ambient'|'steps'|'ui'){
  this.stopPreviews();const epoch=this.previewEpoch;
  await this.start();if(epoch!==this.previewEpoch||this.disposed||document.hidden)return;
  this.play(group==='ambient'?'campus-breeze':group==='steps'?'step-paving-0':'collect',group,undefined,group==='ambient'?.48:group==='steps'?.82:1,1,true);
 }
 stopPreviews(){this.previewEpoch++;for(const [source,node]of this.shots)if(node.preview)this.releaseShot(source);}
 private releaseShot(source:AudioBufferSourceNode){
  const node=this.shots.get(source);if(!node)return;
  this.shots.delete(source);source.onended=null;try{source.stop();}catch{}source.disconnect();node.gain.disconnect();node.panner?.disconnect();
 }
 apply(settings:Settings){this.settings={...settings};if(!this.context)return;const t=this.context.currentTime;
  const gain=(p:AudioParam,value:number)=>{if(this.context!.state!=='running'){p.cancelScheduledValues(t);p.setValueAtTime(value,t);}else{if(typeof p.cancelAndHoldAtTime==='function')p.cancelAndHoldAtTime(t);else{const current=p.value;p.cancelScheduledValues(t);p.setValueAtTime(current,t);}p.setTargetAtTime(value,t,.02);}};
  gain(this.master!.gain,settings.muted?0:1);for(const n of ['ambient','steps','ui','music']as const)gain(this.groups[n].gain,settings[n]);
 }
 setActive(value:boolean,force=false){value=value&&!document.hidden&&!this.disposed;if(value===this.active&&!force)return;this.active=value;if(!this.context)return;if(value&&this.context.state==='suspended')void this.context.resume().then(()=>{this.resumeError='';},()=>{this.resumeError='浏览器尚未启用声音，请点击重试';});const t=this.context.currentTime;this.ambientGate?.gain.setTargetAtTime(value?.48:0,t,.12);this.stepGate?.gain.setTargetAtTime(value?1:0,t,.006);if(!value)this.stopShots('steps');}
 private stopShots(group?:string,immediate=false){
  for(const [source,node]of this.shots)if(!group||node.group===group){
   if(immediate||this.context?.state!=='running'){this.releaseShot(source);continue;}
   const t=this.context.currentTime;node.gain.gain.cancelScheduledValues(t);node.gain.gain.setTargetAtTime(0,t,.006);
   try{source.stop(t+.03);}catch{this.releaseShot(source);}
  }
 }
 play(name:string,group='ui',position?:Point,gain=1,rate=1,preview=false){
  const c=this.context;if(!c||this.disposed||c.state!=='running'||document.hidden||!this.buffers.has(name)||!this.groups[group]||group==='steps'&&!this.active&&!preview)return;
  if(this.shots.size>=16){const oldest=this.shots.keys().next().value;if(oldest)this.releaseShot(oldest);}
  const source=c.createBufferSource(),volume=c.createGain();source.buffer=this.buffers.get(name)!;source.playbackRate.value=rate;volume.gain.value=gain;source.connect(volume);let panner:PannerNode|undefined;
  const bus=preview?this.groups[group]:group==='steps'?this.stepGate!:this.groups[group];
  if(position){panner=c.createPanner();panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=2;panner.rolloffFactor=.6;panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;volume.connect(panner);panner.connect(bus);}else volume.connect(bus);
  this.shots.set(source,{group,gain:volume,panner,preview});source.onended=()=>this.releaseShot(source);
  if(preview){const duration=Math.min(source.buffer.duration/rate,2.5),t=c.currentTime;volume.gain.value=0;volume.gain.setTargetAtTime(gain,t,.012);volume.gain.setTargetAtTime(0,t+Math.max(.02,duration-.08),.012);source.start();source.stop(t+duration);}else source.start();
  this.counts[name]=(this.counts[name]??0)+1;
 }
 update(gait:Gait,paused:boolean,surface:'grass'|'paving',position:Point,listener:Point,yaw:number){
  this.setActive(!paused);const c=this.context,pose=[listener.x,listener.y,listener.z,yaw];if(c&&pose.some((v,i)=>v!==this.listenerPose[i])){this.listenerPose=pose;const l=c.listener,t=c.currentTime;l.positionX.setValueAtTime(listener.x,t);l.positionY.setValueAtTime(listener.y,t);l.positionZ.setValueAtTime(listener.z,t);l.forwardX.setValueAtTime(-Math.sin(yaw),t);l.forwardY.setValueAtTime(0,t);l.forwardZ.setValueAtTime(-Math.cos(yaw),t);l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  if(this.previousGait!==gait){this.previousGait=gait;this.seenSteps=gait.steps;this.seenLand=gait.landings;return;}
  const step=gait.steps>this.seenSteps,land=gait.landings>this.seenLand;this.seenSteps=gait.steps;this.seenLand=gait.landings;
  if(paused||!gait.grounded)return;
  if(land||step&&gait.speed>.04){const kind=land?'landing':'footstep',serial=land?gait.landings:gait.steps;const index=[0,3,1,4,2][this.variant++%5],rate=[.98,1.02,1,.96,1.03][this.variant%5];
   this.play(`step-${surface}-${index}`,'steps',undefined,land ? .75+gait.impact*.4 : gait.motion==='run'?1.08:.82,land ? .88 : rate);
   this.events.push({kind,surface,serial,time:c?.currentTime??0,position:[position.x,position.y,position.z]});if(this.events.length>1200)this.events.shift();
  }
 }
 /** Explicit recording tap: captures the same final mix sent to the output, no mic permission. */
 recordingStream(){if(!this.context||!this.master)throw Error('Start audio from a user click first');if(!this.capture){this.capture=this.context.createMediaStreamDestination();this.master.connect(this.capture);}return this.capture.stream;}
 get diagnostics(){
  const running=this.context?.state==='running',gains=Object.fromEntries(Object.entries(this.groups).map(([k,v])=>[k,v.gain.value]));
  return{state:this.context?.state??'uninitialized',active:this.active,running,muted:this.settings.muted,resumeError:this.resumeError,
   masterGain:this.master?.gain.value??0,gates:{steps:this.stepGate?.gain.value??0,ambient:this.ambientGate?.gain.value??0},
   ambientEligible:running&&this.active&&!this.settings.muted&&this.settings.ambient>0&&!!this.ambient,
   ambientVoices:this.ambient?1:0,ambientStarts:this.ambientStarts,activeShots:this.shots.size,previewShots:[...this.shots.values()].filter(n=>n.preview).length,
   counts:{...this.counts},failed:this.failed,failedFiles:[...this.failedFiles],loading:[...this.pending.keys()],loaded:this.buffers.size,total:Object.keys(audioUrls).length,
   buffers:[...this.buffers].map(([name,b])=>({name,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate,decodedBytes:b.length*b.numberOfChannels*4})),gains};
 }
 dispose(){if(this.disposed)return;this.disposed=true;document.removeEventListener('visibilitychange',this.visibility);this.stopPreviews();this.stopShots(undefined,true);for(const abort of this.pending.values())abort.abort();try{this.ambient?.stop();}catch{}this.ambient?.disconnect();this.ambient=null;this.capture?.stream.getTracks().forEach(t=>t.stop());this.capture?.disconnect();this.master?.disconnect();this.stepGate?.disconnect();this.ambientGate?.disconnect();Object.values(this.groups).forEach(g=>g.disconnect());this.buffers.clear();void this.context?.close();}

}
