/**
 * Prologue narration data: the timeline math, the recorded manifest, the voice
 * source lines and the audio files behind them.
 *
 * Task 2 extends this same check with the mount and stylesheet asserts for the
 * cinematic itself.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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

interface ManifestClip{id:string;speaker:string;voiceId:string;voiceName?:string;text:string;file:string;duration:number;bytes:number;sha256:string}
interface Manifest{version:number;model:string;outputFormat:string;generated:string;budget:number;total:number;clips:ManifestClip[]}
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
check('source: prologue.json declares the four approved narrator lines',()=>{
 assert.equal(source.lines.length,4);
 assert.deepEqual(source.lines.map((line)=>line.id),['prologue-1','prologue-2','prologue-3','prologue-4']);
 for(const line of source.lines)assert.equal(line.speaker,'narrator',`${line.id} must be narrated, not spoken by the player`);
});
check('manifest: every source line has a clip with the same id',()=>{
 for(const line of source.lines){
  assert.ok(manifest.clips.some((clip)=>clip.id===line.id),`${line.id}: no clip in clips.json`);
 }
});
check('manifest: clips.json and prologue.json list the same lines',()=>{
 assert.equal(manifest.clips.length,source.lines.length,'clips.json and prologue.json must list the same lines');
});
check('manifest: clip order matches the source lines',()=>{
 assert.deepEqual(manifest.clips.map((clip)=>clip.id),source.lines.map((line)=>line.id),'clips.json order must match prologue.json');
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
check('manifest: every clip records its byte size and sha256',()=>{
 for(const clip of manifest.clips){
  assert.ok(Number.isInteger(clip.bytes)&&clip.bytes>1024,`${clip.id}: clips.json has no byte size (bytes: ${clip.bytes})`);
  assert.match(clip.sha256??'',/^[0-9a-f]{64}$/,`${clip.id}: clips.json has no sha256`);
 }
});
check('manifest: bytes and sha256 are the committed mp3 files',()=>{
 for(const clip of manifest.clips){
  const path=clipPath(clip.file);
  assert.ok(existsSync(path),`${clip.id}: missing ${path}`);
  const data=readFileSync(path);
  assert.equal(data.byteLength,clip.bytes,`${clip.id}: ${data.byteLength} bytes on disk, clips.json says ${clip.bytes}`);
  const digest=createHash('sha256').update(data).digest('hex');
  assert.equal(digest,clip.sha256,`${clip.id}: sha256 ${digest} does not match clips.json`);
 }
});

// 3. The manifest total.
check('manifest: total equals the duration sum within 0.01 s',()=>{
 const sum=manifest.clips.reduce((total,clip)=>total+clip.duration,0);
 close(manifest.total,sum,'manifest.total',0.01);
});
check('manifest: narration stays inside the declared budget',()=>{
 assert.ok(Number.isFinite(manifest.budget),'clips.json has no numeric budget');
 // The four approved lines are longer than the 48 s plan ceiling when read
 // verbatim, and the owner picked the meditative read, which is slower again:
 // 73.514 s of audio. The budget records the approved overrun; trimming the
 // script or speeding the voice up is an owner decision, never a silent edit.
 // 75 is 73.514 plus 1.5 s of headroom, not a round number chosen for comfort.
 assert.ok(manifest.budget<=75,`budget ${manifest.budget}s exceeds the 75 s approved cap`);
 assert.ok(manifest.total<=manifest.budget,`${manifest.total}s exceeds the ${manifest.budget}s budget`);
 assert.ok(manifest.total>48,'the approved verbatim script should measure past the old 48 s plan ceiling');
});

const APPROVED=[
 'By 2030, the world had become more interconnected, and more intelligent, than anyone had imagined. Not a network of machines — a single mind with no centre, wrapped around a planet.',
 'HKU Shanghai was not built with computers in it. It was built as one. Four towers — PU-01 to PU-04 — and no master core. Every room, every light, every door: a node. Take a tower away, and the machine keeps thinking. CDS.',
 'Step inside, and the machine is everywhere. Server halls breathe. Lecture theatres wake row by row. Doors open before you reach them. The building is not holding a computer — the building is the computer.',
 'At six, the light turns gold. The towers put on a show for the city — HKU Magic Hour — and the campus comes out to watch. Then the last beam fades, and the crowd turns toward the long tables. You turn with them.',
];
check('source: the four lines are the owner-approved text verbatim',()=>{
 assert.deepEqual(source.lines.map((line)=>line.text),APPROVED);
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
check('voices: every recorded line uses the narrator voice and no player line is recorded',()=>{
 assert.ok(source.voices.narrator,'content/voice/prologue.json declares no voice for speaker narrator');
 assert.ok(!source.lines.some((line)=>line.speaker==='player'),'the prologue has no player line');
 for(const clip of manifest.clips)assert.equal(clip.voiceId,source.voices.narrator.id,`${clip.id} must use the narrator voice`);
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

// 5. Task 2: the cinematic module, its overlay styles and the mount.
const readSource=(path:string)=>readFileSync(fileURLToPath(new URL(`../${path}`,import.meta.url)),'utf8');
const mainSource=readSource('src/main.ts');
const prologueSource=readSource('src/opening/prologue.ts');
const prologueStyles=readSource('src/opening/prologue.css');

check('main: mounts createPrologue and exposes prologue on __CAMPUS',()=>{
 assert.ok(mainSource.includes('createPrologue'),'main.ts does not call createPrologue');
 assert.ok(
  mainSource.split('\n').some((line)=>line.includes('__CAMPUS')&&line.includes('{prologue}')),
  'main.ts does not expose {prologue} on __CAMPUS',
 );
});
check('styles: the overlay uses safe-area insets and hides the HUD',()=>{
 assert.ok(prologueStyles.includes('env(safe-area-inset'),'prologue.css has no safe-area insets');
 assert.ok(prologueStyles.includes('body.prologue-active'),'prologue.css has no body.prologue-active rule');
 assert.match(
  prologueStyles,
  /body\.prologue-active\s+#pause-panel\s*\{[^}]*display:\s*none(?:\s*!important)?/,
  'body.prologue-active does not hide #pause-panel with display:none',
 );
 const hud=prologueStyles.match(/body\.prologue-active\s+:is\(([^)]*)\)\s*\{([^}]*)\}/);
 assert.ok(hud,'prologue.css has no body.prologue-active :is(...) { ... } HUD hide rule');
 const [,selectors,declarations]=hud;
 for(const selector of ['.opening-hud','.opening-mapcard','.opening-prompt','.opening-warning','.opening-hearts','#inventory-hud','.stage-bottom','#crosshair','#control-badge','.touch-controls','#reset'])assert.ok(selectors.includes(selector),`HUD hide list is missing ${selector}`);
 assert.match(declarations,/visibility:\s*hidden/,'the HUD hide list does not set visibility: hidden');
 const ruleFor=(selector:string)=>prologueStyles.match(new RegExp(`body\\.prologue-active\\s+${selector}\\b[^{]*\\{([^}]*)\\}`))?.[1]??'';
 assert.match(ruleFor('\\.header'),/visibility:\s*hidden/,'body.prologue-active .header does not set visibility: hidden');
 assert.match(ruleFor('\\.sidebar'),/visibility:\s*hidden/,'body.prologue-active .sidebar does not set visibility: hidden');
 assert.match(prologueStyles,/\.prologue-subtitle\s*\{[^}]*left:\s*50%[^}]*transform:\s*translateX\(-50%\)/,'subtitle is not centred with left:50% + translateX(-50%)');
});
// Comments would otherwise satisfy these pins while the live code does not run.
const stripComments=(source:string)=>source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
const prologueCode=stripComments(prologueSource);
/** Comment-stripped source lines. A quote-aware scan keeps `//` inside strings;
 * the block-comment state carries across lines, so a `/* ... *\/` disabled
 * handler reads as dead code instead of satisfying a pin (N9). Quote state is
 * line-local: single and double quoted strings cannot span a line, and the
 * multi-line templates hold HTML, never a pin. Regex literals containing quote
 * characters can desynchronise one line, which is a false red, never a pass. */
function liveLines(source:string):string[]{
 const lines:string[]=[];
 let block=false;
 for(const sourceLine of source.split('\n')){
  let live='';
  let quote:string|null=null;
  for(let index=0;index<sourceLine.length;index++){
   const char=sourceLine[index];
   if(block){
    if(char==='*'&&sourceLine[index+1]==='/'){block=false;index++;}
    continue;
   }
   if(quote){
    live+=char;
    if(char==='\\'){live+=sourceLine[++index]??'';continue;}
    if(char===quote)quote=null;
    continue;
   }
   if(char==='\''||char==='"'||char==='`'){quote=char;live+=char;continue;}
   if(char==='/'&&sourceLine[index+1]==='/')break;
   if(char==='/'&&sourceLine[index+1]==='*'){block=true;index++;continue;}
   live+=char;
  }
  lines.push(live);
 }
 return lines;
}
const mainLive=liveLines(mainSource);
const prologueLive=liveLines(prologueSource).join('\n');
check('module: registers its camera callback and pauses the explorer',()=>{
 assert.ok(
  prologueCode.includes('if (!registered) { viewer.beforeRender.add(update); registered = true; }'),
  'prologue.ts does not register the live beforeRender callback (outside comments)',
 );
 assert.ok(prologueCode.includes("explorer.pause('prologue')"),"prologue.ts does not call explorer.pause('prologue')");
});
check('module: the cinematic stops when the tab is hidden',()=>{
 assert.match(prologueLive,/addEventListener\('visibilitychange',\s*onHidden\)/,'prologue.ts does not listen for visibilitychange');
 assert.match(prologueLive,/removeEventListener\('visibilitychange',\s*onHidden\)/,'prologue.ts does not remove the visibilitychange listener in stop()');
 assert.match(prologueLive,/if \(document\.hidden\) stop\(\);/, 'the visibilitychange handler does not stop the prologue on a hidden document');
});
check('main: the pause card offers one replay button',()=>{
 const occurrences=(mainSource.match(/id="replay-intro"/g)??[]).length;
 assert.equal(occurrences,1,`main.ts has ${occurrences} id="replay-intro" elements; expected exactly 1`);
 assert.match(mainSource,/<button id="replay-intro"[^>]*type="button"[^>]*>Replay intro<\/button>/,'the pause card has no Replay intro button');
 const handlers=mainLive.filter((line)=>line.includes("el('replay-intro').onclick"));
 assert.ok(handlers.length>0,"main.ts has no live el('replay-intro').onclick handler");
 const handler=handlers[0];
 assert.ok(handler.includes("sessionStorage.removeItem('hku.campus.prologue.v1')"),'the live replay handler does not clear the seen-intro session flag');
 assert.ok(handler.includes("searchParams.set('intro', '1')"),'the live replay handler does not reload with intro=1');
});
check('main: the auto-play trigger is live, checkpoint-excluded and intro=1 forced',()=>{
 const plays=mainLive.filter((line)=>line.trimEnd().endsWith('void prologue.play();'));
 assert.equal(plays.length,1,`main.ts has ${plays.length} live lines ending in the auto-play call; expected exactly 1`);
 const trigger=plays[0];
 for(const pin of ['checkpoint===null',"intro==='1'",'atStart'])assert.ok(trigger.includes(pin),`the live auto-play line does not require ${pin}`);
 const hidden=mainLive.filter((line)=>line.includes("el('replay-intro').hidden"));
 assert.ok(
  hidden.some((line)=>line.includes('!prologue')&&line.includes('checkpoint!==null')),
  'the live replay button is not hidden when there is no prologue or a checkpoint is present',
 );
});
check('styles: the replay button is at least 48 px tall on touch',()=>{
 const buttonRule=readSource('src/style.css').match(/#replay-intro\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(buttonRule,/min-height:\s*48px/,'style.css has no #replay-intro { min-height: 48px } rule');
});

if(failures.length){console.log(`\ncheck-prologue: ${failures.length} failed`);process.exit(1);}
console.log(`\n${passed+failures.length} checks, 0 failed`);
