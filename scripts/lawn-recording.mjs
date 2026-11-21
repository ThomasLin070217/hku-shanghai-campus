// Capture the real Chrome tab over CDP. Timestamps preserve typing pauses and game speed.
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

export async function recordLawn(page,destination) {
  if(!destination)return async()=>{};
  const dir=mkdtempSync(join(tmpdir(),'lawn-footage-'));
  const cdp=await page.context().newCDPSession(page),frames=[];
  cdp.on('Page.screencastFrame',frame=>{
    void cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
    const time=frame.metadata.timestamp;
    if(frames.length&&time-frames.at(-1).time<.06)return;
    const name=String(frames.length).padStart(6,'0')+'.jpg';
    writeFileSync(join(dir,name),Buffer.from(frame.data,'base64'));frames.push({name,time});
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:82,maxWidth:1280,maxHeight:720});
  return async()=>{
    await cdp.send('Page.stopScreencast');await cdp.detach();
    if(!frames.length)throw Error('Chrome returned no video frames');
    const sequence=frames.flatMap(({name,time},index)=>[
      `file '${name}'`,`duration ${Math.max(.04,(frames[index+1]?.time??(time+1))-time).toFixed(4)}`,
    ]);
    sequence.push(`file '${frames.at(-1).name}'`);writeFileSync(join(dir,'frames.txt'),sequence.join('\n'));
    mkdirSync(dirname(resolve(destination)),{recursive:true});
    const result=spawnSync('ffmpeg',['-nostdin','-y','-loglevel','error','-f','concat','-i','frames.txt',
      '-vf','fps=18,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p','-c:v','libx264','-preset','fast','-crf','23','-movflags','+faststart',resolve(destination)],{cwd:dir,encoding:'utf8',windowsHide:true});
    if(result.status!==0)throw Error(result.error?.message||result.stderr||'FFmpeg unavailable');
    // Only release files created by this recording invocation.
    rmSync(dir,{recursive:true});console.log('Recorded',destination,frames.length,'frames');
  };
}
