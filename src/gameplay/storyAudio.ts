import delivery from '../../assets/audio/story/audio-triggers.json';
import type {CampusAudio} from './audio';

type Point={x:number;y:number;z:number};
type Music='safe'|'unease'|'tension'|'chase'|'hope';
export interface AudioRobot {id:string;state:string;position:Point}
export interface StoryAudioFrame {stage:string;dark:boolean;chasing:boolean;robots:AudioRobot[];player:Point;dt:number}
type Loop={source:AudioBufferSourceNode;gain:GainNode;panner?:PannerNode;level:number;retireAt?:number};
interface Cue {id:string;bus:string;loop:boolean;spatial:boolean;gain:number;duck?:{music:number;ambient:number;durationMs:number;recoverMs:number}}
const cues=new Map<string,Cue>(delivery.cues.map(c=>[c.id,c]));
cues.set('bus_door',{id:'bus_door',bus:'sfx',loop:false,spatial:false,gain:.65});

/** Only the implemented opening loads these. Boss/gym/ending assets remain registered for later scenes. */
export const OPENING_AUDIO_NAMES=[
 'sfx_anomaly_low','sfx_glitch_burst','sfx_ai_boot','sfx_disturbance_spread','sfx_veil_descend','sfx_veil_seal',
 'amb_dark_hum','robot_servo_loop','robot_patrol_step','robot_scan','robot_lockon','robot_chase_loop','robot_capture',
 'sfx_safe_restore','step_jump','step_land','invitation_close','macbook_open','macbook_close',
 'agent_status','ui_confirm','ui_cancel','ui_error','decrypt_success','cc0_bus_engine_idle','cc0_amb_birds_loop','bus_door',
 'mus_safe','mus_unease','mus_tension','mus_chase','mus_hope',
];

/** Uses the CampusAudio context/mixer; never owns a second AudioContext or movement clock. */
export class StoryAudio {
 private loops=new Map<string,Loop>();
 private ducks:Partial<Record<'ambient'|'music',GainNode>>={};
 private music:Music|null=null;
 private epoch:number|null=null;
 private timeline:{elapsed:number;events:{at:number;id:string}[]}|null=null;
 private robotStates=new Map<string,string>();
 private robotMotion=new Map<string,{x:number;z:number;distance:number}>();
 private paused=true;
 private duckUntil=0;
 private starts:Record<string,number>={};
 constructor(private owner:CampusAudio){}
 get voices(){return this.loops.size;}
 get diagnostics(){return{music:this.music,loops:[...this.loops.keys()],loopStarts:{...this.starts},timeline:this.timeline?{elapsed:this.timeline.elapsed,pending:this.timeline.events.map(e=>e.id)}:null,paused:this.paused,duckUntil:this.duckUntil};}
 private bus(group:'ambient'|'music'){
  if(!this.ducks[group]){const node=this.owner.context!.createGain();node.connect(this.owner.groups[group]);this.ducks[group]=node;}
  return this.ducks[group]!;
 }
 cue(id:string,position?:Point,feedback=false){
  const cue=cues.get(id);if(!cue||cue.loop||!this.owner.context||!feedback&&!this.owner.active)return;
  const before=this.owner.counts[id]??0;
  this.owner.play(id,feedback&&cue.bus==='sfx'?'feedback':cue.bus, cue.spatial?position:undefined,cue.gain*.65);
  if((this.owner.counts[id]??0)===before)return;
  if('duck' in cue&&cue.duck){
   const c=this.owner.context,t=c.currentTime,d=cue.duck;
   this.duckUntil=t+d.durationMs/1000;
   for(const group of ['ambient','music'] as const){
    const p=this.bus(group).gain;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);
    p.setTargetAtTime(Math.pow(10,d[group]/20),t,.025);
    p.setTargetAtTime(1,this.duckUntil,d.recoverMs/3000);
   }
  }
 }
 /** Compress the prelude to the existing game beats. The seal follows the 4.6 s visual curtain. */
 disturbance(){this.cue('sfx_anomaly_low');this.timeline={elapsed:0,events:[{at:.5,id:'sfx_glitch_burst'},{at:1.4,id:'sfx_ai_boot'},{at:2.4,id:'sfx_disturbance_spread'}]};}
 curtain(){this.cue('sfx_veil_descend');this.timeline={elapsed:0,events:[{at:4.6,id:'sfx_veil_seal'}]};}
 /**
  * Short interface feedback through the same mixer and 16-voice budget.
  * UI sounds must survive an open modal, so this bypasses the story `active` gate
  * (the modal sets it false) but still respects mute, volume groups and hidden tabs.
  */
 ui(kind:'hover'|'confirm'|'cancel'|'notify'|'alert'){
  const map={hover:['ui_confirm',.16,1.32],confirm:['ui_confirm',.44,1],cancel:['ui_cancel',.52,1],notify:['ui_confirm',.34,1.12],alert:['ui_error',.6,.92]} as const;
  const [id,gain,rate]=map[kind];
  if(!this.owner.context||!this.owner.buffers.has(id))return;
  this.owner.play(id,'ui',undefined,gain,rate);
 }
 /** The handoff chord: bright, final, and audible while the completion modal owns the input. */
 ending(){
  const layer=(id:string,gain:number,delay:number)=>{if(delay<=0){this.owner.play(id,'sfx',undefined,gain,1);return;}setTimeout(()=>{if(this.owner.context&&this.owner.buffers.has(id))this.owner.play(id,'sfx',undefined,gain,1);},delay);};
  if(!this.owner.context||!this.owner.buffers.has('decrypt_success'))return;
  layer('decrypt_success',.46,0);layer('sfx_safe_restore',.22,420);layer('agent_status',.3,900);
 }
 private drop(key:string){const loop=this.loops.get(key);if(!loop)return;this.loops.delete(key);loop.source.onended=null;try{loop.source.stop();}catch{}loop.source.disconnect();loop.gain.disconnect();loop.panner?.disconnect();}
 private loop(key:string,id:string,group:'ambient'|'music'|'sfx',level:number,fade:number,position?:Point){
  const c=this.owner.context!,buffer=this.owner.buffers.get(id);if(!buffer)return;
  let loop=this.loops.get(key);
  if(!loop){
   if(this.loops.size>=8){const retired=[...this.loops].find(([,l])=>l.retireAt!==undefined);if(retired)this.drop(retired[0]);else return;}
   if(this.owner.voiceCount>=16)return;
   const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;source.loop=true;source.connect(gain);gain.gain.value=0;
   let panner:PannerNode|undefined;
   if(position){panner=c.createPanner();panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=2;panner.rolloffFactor=.6;gain.connect(panner);panner.connect(this.owner.groups.sfx);}
   else gain.connect(group==='sfx'?this.owner.groups.sfx:this.bus(group));
   if(this.epoch===null)this.epoch=c.currentTime;
   // All stems share one transport, including after pause/retry. No drifting independent start times.
   source.start(0,group==='music'?Math.max(0,c.currentTime-this.epoch)%buffer.duration:0);
   loop={source,gain,panner,level:-1};this.loops.set(key,loop);this.starts[key]=(this.starts[key]??0)+1;
  }
  if(loop.level!==level||loop.retireAt!==undefined){const t=c.currentTime,p=loop.gain.gain;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.setTargetAtTime(level,t,Math.max(.01,fade/3));loop.level=level;delete loop.retireAt;}
  if(loop.panner&&position){loop.panner.positionX.value=position.x;loop.panner.positionY.value=position.y+1;loop.panner.positionZ.value=position.z;}
 }
 private retire(key:string,seconds=.4){const l=this.loops.get(key),c=this.owner.context;if(!l||!c||l.retireAt!==undefined)return;const t=c.currentTime;l.gain.gain.cancelScheduledValues(t);l.gain.gain.setValueAtTime(l.gain.gain.value,t);l.gain.gain.setTargetAtTime(0,t,seconds/4);l.retireAt=t+seconds;}
 update(frame:StoryAudioFrame){
  if(!this.owner.context||!this.owner.active){this.pause();return;}
  this.paused=false;const dt=Math.min(.1,Math.max(0,frame.dt));
  if(this.timeline){this.timeline.elapsed+=dt;while(this.timeline.events[0]?.at<=this.timeline.elapsed)this.cue(this.timeline.events.shift()!.id);if(!this.timeline.events.length)this.timeline=null;}
  const music:Music=frame.stage==='complete'?'hope':frame.chasing?'chase':frame.dark?'tension':frame.stage==='return_b5'?'unease':'safe';
  const changed=this.music!==music,previous=this.music;this.music=music;
  const fade=music==='chase'?delivery.crossfadeMs.toChase/1000:previous==='chase'?delivery.crossfadeMs.fromChase/1000:delivery.crossfadeMs.normal/1000;
  if(changed)for(const key of this.loops.keys())if(key.startsWith('music:')&&key!=='music:'+music)this.retire(key,fade);
  this.loop('music:'+music,'mus_'+music,'music',.5,fade);
  const ambient=frame.stage==='bus'?'cc0_bus_engine_idle':frame.dark?'amb_dark_hum':'cc0_amb_birds_loop';
  const ambientKeys=new Set(['ambient:'+ambient]);
  if(frame.stage!=='bus'&&!frame.dark)ambientKeys.add('ambient:campus-breeze');
  for(const key of this.loops.keys())if(key.startsWith('ambient:')&&!ambientKeys.has(key))this.retire(key,.8);
  this.loop('ambient:'+ambient,ambient,'ambient',frame.stage==='bus'?.32:frame.dark?.3:.4,.8);
  if(ambientKeys.has('ambient:campus-breeze'))this.loop('ambient:campus-breeze','campus-breeze','ambient',.32,.8);
  const near=frame.robots.map(robot=>({robot,distance:Math.hypot(robot.position.x-frame.player.x,robot.position.z-frame.player.z)})).filter(r=>r.distance<24).sort((a,b)=>a.distance-b.distance).slice(0,2);
  const wanted=new Set<string>();
  for(const {robot,distance} of near){
   const key='robot:'+robot.id;wanted.add(key);
   const chasing=robot.state==='chase'||robot.state==='caught',id=chasing?'robot_chase_loop':'robot_servo_loop',loopKey=key+':'+id;wanted.add(loopKey);
   this.loop(loopKey,id,'sfx',chasing?.24:.12,.25,robot.position);
   const old=this.robotStates.get(robot.id);
   if(old!==robot.state){
    if(chasing&&old!=='chase'&&old!=='caught')this.cue('robot_lockon',robot.position);
    else if(robot.state==='scanning')this.cue('robot_scan',robot.position);
    this.robotStates.set(robot.id,robot.state);
   }
   const motion=this.robotMotion.get(robot.id),moved=motion?Math.hypot(robot.position.x-motion.x,robot.position.z-motion.z):0;
   const traveled=(motion?.distance??0)+(moved<=Math.max(.05,dt*8)?moved:0),stride=chasing?.85:.65;
   if(traveled>=stride&&distance<16)this.cue('robot_patrol_step',robot.position);
   this.robotMotion.set(robot.id,{x:robot.position.x,z:robot.position.z,distance:traveled%stride});
  }
  for(const key of this.loops.keys())if(key.startsWith('robot:')&&!wanted.has(key))this.retire(key,.25);
  for(const id of this.robotStates.keys())if(!near.some(n=>n.robot.id===id)){this.robotStates.delete(id);this.robotMotion.delete(id);}
  for(const [key,l]of this.loops)if(l.retireAt!==undefined&&l.retireAt<=this.owner.context.currentTime)this.drop(key);
 }
 pause(){if(this.paused&&!this.loops.size)return;this.paused=true;for(const key of [...this.loops.keys()])this.drop(key);for(const node of Object.values(this.ducks)){node.gain.cancelScheduledValues(this.owner.context!.currentTime);node.gain.value=1;}this.duckUntil=0;}
 reset(){this.pause();this.timeline=null;this.music=null;this.epoch=null;this.robotStates.clear();this.robotMotion.clear();}
 dispose(){this.reset();for(const node of Object.values(this.ducks))node.disconnect();this.ducks={};}
}
