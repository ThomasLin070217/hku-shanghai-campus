import type {CampusAudio} from '../gameplay/audio';
/** Authored synthetic dialogue uses the existing mixer, shot budget and mute. */
export function createStaffVoice(audio:CampusAudio,eligible:()=>boolean,replyEligible:()=>boolean=()=>false){
 let epoch=0,disposed=false;
 const loading=new Map<string,Promise<AudioBuffer>>(),abort=new AbortController();
 function stop(){epoch++;audio.stopOpeningCues();}
 async function line(name:string,url:URL,allowed:()=>boolean){
  stop();const ticket=epoch;
  const ready=audio.start(),context=audio.context;if(!context)return;
  if(!loading.has(name))loading.set(name,fetch(url,{signal:abort.signal})
   .then(r=>{if(!r.ok)throw Error('voice_unavailable');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).catch(error=>{loading.delete(name);throw error;}));
  try{const [buffer]=await Promise.all([loading.get(name)!,ready]);if(disposed||ticket!==epoch||!allowed()||document.hidden)return;
   audio.buffers.set(name,buffer);audio.play(name,'sfx',undefined,.95);
  }catch{/* Subtitles and deterministic task controls remain available. */}
 }
 return{
  play:()=>line('opening-staff-voice',new URL('../../assets/audio/opening-foley/staff-english.wav',import.meta.url),eligible),
  reply:()=>line('opening-player-reply',new URL('../../assets/audio/opening-foley/player-accept-english.wav',import.meta.url),replyEligible),
  stop,dispose(){disposed=true;stop();abort.abort();},
 };
}
