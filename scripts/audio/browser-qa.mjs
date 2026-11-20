/** Run from ego-browser nodejs: import this file, then await verifyAudio(page, absoluteOutputDir).
 * Exercises audio in isolation; never changes the game's player, story, control epoch or save.
 */
import {mkdir,writeFile} from 'node:fs/promises';

export async function verifyAudio(page, outputDir){
 await mkdir(outputDir,{recursive:true});
 const decoded=await page.evaluate(async()=>{
  const {STORY_AUDIO_URLS}=await import('/src/gameplay/storyAudioAssets.ts');
  const context=new OfflineAudioContext(2,48000,48000);
  const files=await Promise.all(Object.entries(STORY_AUDIO_URLS).map(async([id,url])=>{
   try{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);const b=await context.decodeAudioData(await r.arrayBuffer());return{id,ok:true,sampleRate:b.sampleRate,channels:b.numberOfChannels,duration:b.duration};}
   catch(error){return{id,ok:false,error:String(error)};}
  }));
  return{engine:navigator.userAgent,contextSampleRate:context.sampleRate,decoded:files.length,failed:files.filter(f=>!f.ok),files};
 });
 await writeFile(outputDir+'/browser-decode.json',JSON.stringify(decoded,null,2)+'\n');
 if(decoded.failed.length)throw Error('Audio decode failures: '+JSON.stringify(decoded.failed));
 const captured=await page.evaluate(async()=>{
  const {CampusAudio}=await import('/src/gameplay/audio.ts');
  const {DEFAULT_SETTINGS}=await import('/src/gameplay/save.ts');
  const audio=new CampusAudio({...DEFAULT_SETTINGS,music:.2});audio.enableStory();
  try{
   await audio.start();if(audio.failedFiles.length||audio.context.state!=='running')throw Error(JSON.stringify(audio.diagnostics));
   audio.setActive(true);
   const chunks=[],recorder=new MediaRecorder(audio.recordingStream(),{mimeType:'audio/webm;codecs=opus'});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const stopped=new Promise(resolve=>{recorder.onstop=resolve;});
   recorder.start();const start=performance.now(),fired=new Set(),states=[];let last=start;
   await new Promise((resolve,reject)=>{
    const timer=setInterval(()=>{
     try{
      const now=performance.now(),t=(now-start)/1000,dt=(now-last)/1000;last=now;
      const once=(key,fn)=>{if(!fired.has(key)){fired.add(key);fn();}};
      if(t>1)once('anomaly',()=>audio.story.disturbance());
      if(t>4.2)once('curtain',()=>audio.story.curtain());
      if(t>3.5)once('jump',()=>audio.story.cue('step_jump'));
      if(t>4.1)once('landing',()=>audio.story.cue('step_land'));
      const dark=t>4.2,chasing=t>5&&t<9.8;
      audio.story.update({stage:'to_b5',dark,chasing,dt,player:{x:0,y:0,z:0},robots:dark?[{id:'qa-robot',state:chasing?'chase':'scanning',position:{x:3+Math.sin(t),y:0,z:1}}]:[]});
      if(t>6.5)once('pause',()=>{audio.setActive(false);states.push({event:'pause',voices:audio.story.voices});});
      if(t>6.5&&t<6.8)audio.setActive(false);
      if(t>=6.8)once('resume',()=>{audio.setActive(true);states.push({event:'resume'});});
      if(t>=11){clearInterval(timer);resolve();}
     }catch(error){clearInterval(timer);reject(error);}
    },16);
   });
   recorder.stop();await stopped;
   const compressed=await new Blob(chunks,{type:'audio/webm'}).arrayBuffer();
   const rendered=await audio.context.decodeAudioData(compressed.slice(0));
   let peak=0,energy=0,clipped=0;
   for(let channel=0;channel<rendered.numberOfChannels;channel++)for(const value of rendered.getChannelData(channel)){peak=Math.max(peak,Math.abs(value));energy+=value*value;if(Math.abs(value)>=1)clipped++;}
   const channels=rendered.numberOfChannels,length=rendered.length,bytes=new ArrayBuffer(44+length*channels*2),view=new DataView(bytes);
   const ascii=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
   ascii(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rendered.sampleRate,true);view.setUint32(28,rendered.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,length*channels*2,true);
   let offset=44;for(let i=0;i<length;i++)for(let channel=0;channel<channels;channel++){const value=Math.max(-1,Math.min(1,rendered.getChannelData(channel)[i]));view.setInt16(offset,Math.round(value*(value<0?32768:32767)),true);offset+=2;}
   const data=new Uint8Array(bytes);let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
   const diagnostics=audio.diagnostics;audio.setActive(false);audio.stopOpeningCues();
   return{wav:btoa(binary),report:{scope:'Real CampusAudio mix via recordingStream, Opus capture decoded to PCM WAV. Objective signal check; not subjective listening.',duration:rendered.duration,sampleRate:rendered.sampleRate,channels,peak,rms:Math.sqrt(energy/(length*channels)),clipped,states,loaded:diagnostics.loaded,total:diagnostics.total,failed:diagnostics.failedFiles,voiceCount:diagnostics.voiceCount,counts:diagnostics.counts,story:diagnostics.story,stoppedLoops:audio.story.voices}};
  }finally{audio.dispose();}
 });
 await writeFile(outputDir+'/opening-mix-preview.wav',Buffer.from(captured.wav,'base64'));
 await writeFile(outputDir+'/browser-mix.json',JSON.stringify(captured.report,null,2)+'\n');
 if(captured.report.clipped||captured.report.rms<.0005||captured.report.stoppedLoops)throw Error('Mix signal/lifecycle check failed');
 return{decoded:decoded.decoded,failed:decoded.failed,...captured.report};
}
