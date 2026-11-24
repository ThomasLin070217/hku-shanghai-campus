#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access, readFile, writeFile, rename, mkdir} from 'node:fs/promises';
import {dirname, extname, basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const run=promisify(execFile);
const DEFAULT_FFMPEG='/opt/homebrew/bin/ffmpeg';
const DEFAULT_FFPROBE='/opt/homebrew/bin/ffprobe';

function toolPath(explicit,fallback,name){
 if(explicit)return explicit;
 if(fallback)return resolve(dirname(fallback),name);
 return name;
}

async function commandExists(command){
 try{await access(command);return true;}catch{return false;}
}

async function resolveTools(){
 const ffmpeg=process.env.FFMPEG_PATH||DEFAULT_FFMPEG;
 const ffprobe=process.env.FFPROBE_PATH||toolPath(undefined,ffmpeg,'ffprobe');
 if(!await commandExists(ffmpeg)){
  if(await commandExists('ffmpeg'))return {ffmpeg:'ffmpeg',ffprobe:process.env.FFPROBE_PATH||'ffprobe'};
  throw new Error(`ffmpeg not found at ${ffmpeg}. Install ffmpeg or set FFMPEG_PATH.`);
 }
 if(!await commandExists(ffprobe))throw new Error(`ffprobe not found at ${ffprobe}. Install ffprobe or set FFPROBE_PATH.`);
 return {ffmpeg,ffprobe};
}

export function encodingRole(sourcePath){
 const normalized=sourcePath.replaceAll('\\','/');
 const name=basename(normalized);
 if(normalized.includes('/music/')||name.startsWith('mus_'))return 'music';
 if(name.startsWith('campus-breeze')||name.startsWith('amb_')||name.replace(/\.wav$/i,'').endsWith('_loop'))return 'ambience';
 return 'effects';
}

async function probe(sourcePath,ffprobe){
 const {stdout}=await run(ffprobe,['-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',sourcePath],{maxBuffer:1024*1024});
 const stream=JSON.parse(stdout).streams?.[0];
 const sampleRate=Number(stream?.sample_rate),channels=Number(stream?.channels);
 if(!Number.isFinite(sampleRate)||sampleRate<=0||!Number.isFinite(channels)||channels<=0)throw new Error(`No usable audio stream in ${sourcePath}`);
 return {sampleRate,channels};
}

export async function compressionPlan(sourcePath){
 const source=resolve(sourcePath),role=encodingRole(source),tools=await resolveTools();
 const media=await probe(source,tools.ffprobe);
 const bitrate=role==='music'?160:role==='ambience'?128:96;
 const channels=role==='ambience'?1:media.channels;
 // A dual-mono stereo bed measures 3 LU louder than one channel under EBU R128.
 // Summing both channels preserves that program loudness; the default matrix loses 6 dB.
 const downmix=channels===1&&media.channels===2?'pan=mono|c0=c0+c1,alimiter=limit=0.707945:level=false:attack=5:release=50':null;
 const supportedRates=[44100,48000,32000,24000,22050,16000,12000,11025,8000];
 // Preserve every standard rate at or below 44.1 kHz. MP3 cannot encode 44 kHz;
 // use the nearest supported rate rather than silently discarding 12 kHz of bandwidth.
 const sampleRate=media.sampleRate<=44100?supportedRates.reduce((best,rate)=>Math.abs(rate-media.sampleRate)<Math.abs(best-media.sampleRate)?rate:best):44100;
 return {source,role,...media,bitrate,channels,downmix,sampleRate,...tools};
}

export async function compressionCacheKey(sourcePath){
 const plan=await compressionPlan(sourcePath);
 const bytes=await readFile(plan.source);
 const {stdout:version}=await run(plan.ffmpeg,['-version'],{maxBuffer:1024*1024});
 const hash=createHash('sha256');
 hash.update('one-world-audio-mp3-v1\0');
 hash.update(JSON.stringify({role:plan.role,bitrate:plan.bitrate,channels:plan.channels,downmix:plan.downmix,sampleRate:plan.sampleRate,ffmpeg:version.split('\n')[0]}));
 hash.update('\0');
 hash.update(bytes);
 return hash.digest('hex');
}

/**
 * Compress one source file to MP3. The default derivative name contains the
 * source/encoder cache key. With an explicit output, a sidecar key makes the
 * operation idempotent without changing the caller's chosen file name.
 */
export async function compressAudioFile(sourcePath,outputPath){
 const key=await compressionCacheKey(sourcePath);
 const source=resolve(sourcePath);
 const output=resolve(outputPath||`${source.slice(0,-extname(source).length)}-${key.slice(0,16)}.mp3`);
 const marker=`${output}.cache.json`;
 let cached=false;
 try{
  const previous=JSON.parse(await readFile(marker,'utf8'));
  cached=previous?.key===key;
  if(cached)await access(output);
 }catch{cached=false;}
 if(cached)return {output,key,cached:true};
 const plan=await compressionPlan(source);
 await mkdir(dirname(output),{recursive:true});
 const temporary=`${output}.${process.pid}.tmp.mp3`;
 const filters=plan.downmix?['-af',plan.downmix]:[];
 try{
  await run(plan.ffmpeg,[
   '-hide_banner','-loglevel','error','-y','-i',source,
   '-map','0:a:0','-map_metadata','-1','-vn',...filters,
   '-codec:a','libmp3lame','-b:a',`${plan.bitrate}k`,
   '-ac',String(plan.channels),'-ar',String(plan.sampleRate),temporary,
  ],{maxBuffer:4*1024*1024});
  await rename(temporary,output);
  await writeFile(marker,`${JSON.stringify({key,role:plan.role,bitrate:plan.bitrate,channels:plan.channels,downmix:plan.downmix,sampleRate:plan.sampleRate},null,2)}\n`);
 }catch(error){
  try{await import('node:fs/promises').then(({unlink})=>unlink(temporary));}catch{}
  throw error;
 }
 return {output,key,cached:false};
}

async function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help')||args.includes('-h')){
  console.log('Usage: node scripts/compress-audio.mjs <source-audio> [output.mp3]\nBuild-time MP3 compression with a content/encoder hash cache.');
  return;
 }
 const positional=args.filter(arg=>!arg.startsWith('--'));
 if(positional.length<1||positional.length>2)throw new Error('Expected a source audio path and optional output path.');
 const result=await compressAudioFile(positional[0],positional[1]);
 console.log(`${result.cached?'CACHED':'ENCODED'} ${result.output} (${result.key.slice(0,16)})`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error(`compress-audio: ${error.message}`);process.exitCode=1;});
}
