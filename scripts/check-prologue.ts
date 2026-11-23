/**
 * Prologue narration data: the timeline math, the recorded manifest, the voice
 * source lines and the audio files behind them.
 *
 * Task 2 extends this same check with the mount and stylesheet asserts for the
 * cinematic itself.
 */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PROLOGUE_GAP,prologueTimeline,type PrologueClip} from '../src/opening/prologueTimeline';
import {PROLOGUE_CLIPS,PROLOGUE_LINES,PROLOGUE_TOTAL,PROLOGUE_URLS} from '../src/opening/prologueVoice';

let passed=0;const failures:string[]=[];
function check(name:string,fn:()=>void){
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message.split('\n')[0]:String(error));}
}
const close=(a:number,b:number,what:string,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<=epsilon,`${what}: ${a} != ${b}`);

interface ManifestClip{id:string;speaker:string;voiceId:string;voiceName?:string;text:string;file:string;duration:number}
interface Manifest{version:number;model:string;outputFormat:string;generated:string;total:number;clips:ManifestClip[]}
interface VoiceSourceLine{id:string;speaker:string;text:string}
interface VoiceSource{version:number;voices:Record<string,{id:string;name:string;settings:Record<string,unknown>}>;lines:VoiceSourceLine[]}

// Paths resolve from the repo root through this script's own location, never
// from the process cwd, and nothing here needs ffprobe.
const clipPath=(file:string)=>fileURLToPath(new URL(`../assets/audio/prologue/${file}`,import.meta.url));
const manifest=JSON.parse(readFileSync(fileURLToPath(new URL('../assets/audio/prologue/clips.json',import.meta.url)),'utf8')) as Manifest;
const source=JSON.parse(readFileSync(fileURLToPath(new URL('../content/voice/prologue.json',import.meta.url)),'utf8')) as VoiceSource;

const fixture:PrologueClip[]=[
 {id:'a',speaker:'narrator',text:'one',duration:1.2,file:'a.mp3',voiceId:'n'},
 {id:'b',speaker:'narrator',text:'two',duration:0.8,file:'b.mp3',voiceId:'n'},
 {id:'c',speaker:'player',text:'three',duration:2,file:'c.mp3',voiceId:'p'},
];

// 1. Timeline math.
check('timeline: fixture starts and ends follow the gap',()=>{
 const {lines}=prologueTimeline(fixture);
 assert.deepEqual(lines.map((line)=>line.id),['a','b','c'],'order preserved');
 close(lines[0].start,0,'first start');
 close(lines[0].end,1.2,'first end');
 close(lines[1].start,1.55,'second start = 1.2 + 0.35');
 close(lines[1].end,2.35,'second end');
 close(lines[2].start,2.7,'third start = 2.35 + 0.35');
 close(lines[2].end,4.7,'third end');
});
check('timeline: total is the last end and audioTotal the duration sum',()=>{
 const {total,audioTotal}=prologueTimeline(fixture);
 close(total,4.7,'total');
 close(audioTotal,4,'audioTotal');
});
check('timeline: a custom gap moves every later start',()=>{
 const {lines,total}=prologueTimeline(fixture,0.1);
 close(lines[1].start,1.3,'second start');
 close(lines[2].start,2.2,'third start');
 close(total,4.2,'total');
});
check('timeline: the default gap is PROLOGUE_GAP',()=>{
 close(PROLOGUE_GAP,0.35,'PROLOGUE_GAP');
 assert.deepEqual(prologueTimeline(fixture),prologueTimeline(fixture,PROLOGUE_GAP));
});
check('timeline: a single clip starts at 0 and ends at its duration',()=>{
 const {lines,total,audioTotal}=prologueTimeline([fixture[0]]);
 assert.equal(lines.length,1);
 close(lines[0].start,0,'start');
 close(lines[0].end,1.2,'end');
 close(total,1.2,'total');
 close(audioTotal,1.2,'audioTotal');
});
check('timeline: an empty list has no lines and no time',()=>{
 assert.deepEqual(prologueTimeline([]),{lines:[],total:0,audioTotal:0});
});
check('timeline: the input clips are not mutated',()=>{
 const before=JSON.parse(JSON.stringify(fixture)) as PrologueClip[];
 prologueTimeline(fixture);
 assert.deepEqual(fixture,before);
});
check('timeline: a negative duration throws with the clip id',()=>{
 assert.throws(
  ()=>prologueTimeline([{...fixture[0],id:'bad',duration:-1}]),
  {message:'prologue clip bad has no valid duration'},
 );
});
check('timeline: a non-finite duration throws with the clip id',()=>{
 for(const duration of [NaN,Infinity,-Infinity]){
  assert.throws(
   ()=>prologueTimeline([{...fixture[0],id:'bad',duration}]),
   {message:'prologue clip bad has no valid duration'},
   `duration ${duration}`,
  );
 }
});

// 2. Every source line has a recorded clip.
check('source: prologue.json declares five lines',()=>{
 assert.equal(source.lines.length,5);
});
check('manifest: every source line has a clip with the same id',()=>{
 for(const line of source.lines){
  assert.ok(manifest.clips.some((clip)=>clip.id===line.id),`${line.id}: no clip in clips.json`);
 }
});
check('manifest: every clip text matches its source line',()=>{
 for(const line of source.lines){
  const clip=manifest.clips.find((entry)=>entry.id===line.id);
  assert.ok(clip,`${line.id}: no clip`);
  assert.equal(clip.text,line.text,`${line.id}: text differs from content/voice/prologue.json`);
  assert.equal(clip.speaker,line.speaker,`${line.id}: speaker differs from content/voice/prologue.json`);
 }
});
check('manifest: clip ids are unique',()=>{
 assert.equal(new Set(manifest.clips.map((clip)=>clip.id)).size,manifest.clips.length);
});
check('manifest: every clip has a positive finite duration',()=>{
 for(const clip of manifest.clips){
  assert.ok(Number.isFinite(clip.duration)&&clip.duration>0,`${clip.id}: duration ${clip.duration}`);
 }
});
check('manifest: every clip file exists and is over 1 KB',()=>{
 for(const clip of manifest.clips){
  const path=clipPath(clip.file);
  assert.ok(existsSync(path),`${clip.id}: missing ${path}`);
  const bytes=statSync(path).size;
  assert.ok(bytes>1024,`${clip.id}: ${bytes} bytes is not a recorded clip`);
 }
});

// 3. The manifest total.
check('manifest: total equals the duration sum within 0.01 s',()=>{
 const sum=manifest.clips.reduce((total,clip)=>total+clip.duration,0);
 close(manifest.total,sum,'manifest.total',0.01);
});
check('manifest: narration stays inside the 45 s budget',()=>{
 assert.ok(manifest.total<=45,`${manifest.total}s exceeds 45s`);
});

// 4. Voices and URLs.
check('voices: every speaker maps to a declared voice',()=>{
 for(const line of source.lines){
  assert.ok(source.voices[line.speaker],`${line.id}: no voice for speaker ${line.speaker}`);
 }
});
check('voices: every clip uses the voice declared for its speaker',()=>{
 for(const clip of manifest.clips){
  const voice=source.voices[clip.speaker];
  assert.ok(voice,`${clip.id}: no voice for speaker ${clip.speaker}`);
  assert.equal(clip.voiceId,voice.id,`${clip.id}: ${clip.voiceId} is not the ${clip.speaker} voice`);
 }
});
check('voices: the player line uses a different voice from the narrator',()=>{
 const player=source.lines.find((line)=>line.speaker==='player');
 assert.ok(player,'no player line');
 assert.notEqual(source.voices.player.id,source.voices.narrator.id);
 const clip=manifest.clips.find((entry)=>entry.id===player.id);
 assert.ok(clip);
 assert.equal(clip.voiceId,source.voices.player.id);
});

check('PROLOGUE_CLIPS is the manifest clips in order',()=>{
 assert.deepEqual(PROLOGUE_CLIPS.map((clip)=>clip.id),manifest.clips.map((clip)=>clip.id));
 for(const clip of PROLOGUE_CLIPS){
  const recorded=manifest.clips.find((entry)=>entry.id===clip.id);
  assert.ok(recorded,`${clip.id}: no recorded clip`);
  assert.equal(clip.speaker,recorded.speaker);
  assert.equal(clip.text,recorded.text);
  assert.equal(clip.file,recorded.file);
  assert.equal(clip.voiceId,recorded.voiceId);
  assert.equal(clip.duration,recorded.duration);
 }
});
check('PROLOGUE_LINES starts and ends follow the recorded durations',()=>{
 assert.equal(PROLOGUE_LINES.length,manifest.clips.length);
 let cursor=0;
 for(let index=0;index<PROLOGUE_LINES.length;index++){
  const line=PROLOGUE_LINES[index];
  const clip=manifest.clips[index];
  close(line.start,cursor,`${line.id} start`);
  close(line.end,line.start+clip.duration,`${line.id} end`);
  cursor=line.end+PROLOGUE_GAP;
 }
});
check('PROLOGUE_TOTAL is the end of the last line',()=>{
 const last=PROLOGUE_LINES[PROLOGUE_LINES.length-1];
 assert.ok(last);
 close(PROLOGUE_TOTAL,last.end,'PROLOGUE_TOTAL');
});
check('PROLOGUE_URLS covers every clip id and nothing else',()=>{
 assert.deepEqual(Object.keys(PROLOGUE_URLS).sort(),PROLOGUE_CLIPS.map((clip)=>clip.id).sort());
});
check('PROLOGUE_URLS points at the recorded mp3 files',()=>{
 for(const clip of PROLOGUE_CLIPS){
  const url=PROLOGUE_URLS[clip.id];
  assert.ok(url instanceof URL,`${clip.id}: not a URL`);
  assert.ok(url.pathname.endsWith(`/${clip.file}`),`${clip.id}: ${url.pathname} does not end in ${clip.file}`);
  const path=fileURLToPath(url);
  assert.ok(existsSync(path),`${clip.id}: missing ${path}`);
  assert.ok(statSync(path).size>1024,`${clip.id}: ${path} is not a recorded clip`);
 }
});

if(failures.length){console.log(`\ncheck-prologue: ${failures.length} failed`);process.exit(1);}
console.log(`\n${passed+failures.length} checks, 0 failed`);
