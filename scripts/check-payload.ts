import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readdir,readFile,stat} from 'node:fs/promises';
import {basename,dirname,extname,join,resolve,sep} from 'node:path';

const run=promisify(execFile);
const root=resolve(import.meta.dirname,'..');
const outDir=resolve(process.argv[2]??join(root,'dist'));
const audioExtensions=new Set(['.wav','.mp3','.ogg','.m4a','.flac','.aac']);
const mb=(bytes:number)=>(bytes/1_000_000).toFixed(2);

async function files(directory:string):Promise<string[]>{
 const entries=await readdir(directory,{withFileTypes:true});
 const result:string[]=[];
 for(const entry of entries)result.push(...entry.isDirectory()?await files(join(directory,entry.name)):[join(directory,entry.name)]);
 return result;
}
function urls(source:string,file:string){
 const resolvedFile=resolve(root,file),result:{name:string;path:string}[]=[];
 for(const match of source.matchAll(/(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*new URL\(\s*['"]([^'"]+)['"]/g)){
  result.push({name:match[1]??match[2]??match[3]!,path:resolve(dirname(resolvedFile),match[4]!)});
 }
 return result;
}
function foleyUrls(source:string,file:string){
 const resolvedFile=resolve(root,file),result:{name:string;path:string}[]=[];
 for(const match of source.matchAll(/OPENING_FOLEY\[['"]([^'"]+)['"]\]\s*=\s*new URL\(\s*['"]([^'"]+)['"]/g))result.push({name:match[1]!,path:resolve(dirname(resolvedFile),match[2]!)});
 return result;
}

const audioSource=await readFile(join(root,'src/gameplay/audio.ts'),'utf8');
const core=urls(audioSource,'src/gameplay/audio.ts');
const storySource=await readFile(join(root,'src/gameplay/storyAudioAssets.ts'),'utf8');
const story=urls(storySource,'src/gameplay/storyAudioAssets.ts');
const storyAudioSource=await readFile(join(root,'src/gameplay/storyAudio.ts'),'utf8');
const initialBlock=audioSource.match(/\bINITIAL_AUDIO_NAMES\s*=\s*\[([\s\S]*?)\]/)?.[1];
assert.ok(initialBlock,'INITIAL_AUDIO_NAMES not found');
const initialNames=[...initialBlock.matchAll(/['"]([^'"]+)['"]/g)].map(match=>match[1]!);
const openingBlock=storyAudioSource.match(/OPENING_AUDIO_NAMES\s*=\s*\[([\s\S]*?)\]/)?.[1];
assert.ok(openingBlock,'OPENING_AUDIO_NAMES not found');
const openingNames=[...openingBlock.matchAll(/['"]([^'"]+)['"]/g)].map(match=>match[1]!);
const opening=openingNames.map(name=>{const asset=story.find(item=>item.name===name);assert.ok(asset,`Opening audio has no URL: ${name}`);return asset;});
const foley=foleyUrls(await readFile(join(root,'src/opening/audioAssets.ts'),'utf8'),'src/opening/audioAssets.ts');
const initialSet=new Set(initialNames),eager=new Map<string,string>(),preLazyEager=new Map<string,string>();
for(const item of [...core,...story,...foley])if(initialSet.has(item.name))eager.set(item.name,item.path);
for(const item of [...core,...opening,...foley])preLazyEager.set(item.name,item.path);
for(const name of initialNames)assert.ok(eager.has(name),`Initial audio has no URL: ${name}`);

const allFiles=await files(outDir),assetRoot=`${join(outDir,'assets')}${sep}`,assets=allFiles.filter(file=>file.startsWith(assetRoot));
const manifestKey=createHash('sha256').update(outDir).digest('hex');
const manifestPath=join(root,'.scratch/audio-compress-cache/manifests',`${manifestKey}.json`);
const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as {outDir:string;skipped:boolean;records:{wav:string;mp3:string;originalBytes:number;compressedBytes:number}[]};
assert.equal(resolve(manifest.outDir),outDir,'Payload manifest belongs to a different build; rebuild before checking.');
const compressed=new Map(manifest.records.map(record=>[record.wav,record]));
async function measureAudioSet(group:Map<string,string>){
 let before=0,after=0;const missing:string[]=[];
 for(const [name,source]of group){
  before+=(await stat(source)).size;
  const stem=basename(source,extname(source)),extension=extname(source).toLowerCase();
  let emitted='';
  if(extension==='.wav'&&!manifest.skipped){
   const record=manifest.records.find(item=>basename(item.wav).startsWith(`${stem}-`));
   emitted=record?join(outDir,record.mp3):'';
  }else if(extension==='.wav'){
   emitted=assets.find(file=>basename(file).startsWith(`${stem}-`))??'';
  }else{
   emitted=assets.find(file=>basename(file).startsWith(`${stem}-`)&&extname(file).toLowerCase()===extension)??'';
  }
  if(!emitted||!(await stat(emitted).catch(()=>null))){missing.push(`${name} (${basename(source)})`);continue;}
  after+=(await stat(emitted)).size;
 }
 return{before,after,missing};
}
const initial=await measureAudioSet(eager),preLazy=await measureAudioSet(preLazyEager);
assert.deepEqual(initial.missing,[],`Initial audio references missing from build: ${initial.missing.join(', ')}`);
assert.deepEqual(preLazy.missing,[],`Pre-lazy audio references missing from build: ${preLazy.missing.join(', ')}`);

let totalAfter=0;for(const file of allFiles)totalAfter+=(await stat(file)).size;
const totalBefore=totalAfter+manifest.records.reduce((sum,record)=>sum+record.originalBytes-record.compressedBytes,0);
const oversizedWavs:string[]=[];
for(const file of assets.filter(file=>extname(file).toLowerCase()==='.wav')){
 const size=(await stat(file)).size;if(size>400_000)oversizedWavs.push(`${basename(file)}: ${mb(size)} MB`);
}
const audioAssets=assets.filter(file=>audioExtensions.has(extname(file).toLowerCase()));
const undecodable:string[]=[];
const ffprobe=process.env.FFPROBE_PATH??'/opt/homebrew/bin/ffprobe';
for(const file of audioAssets){
 try{
  const {stdout}=await run(ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file]);
  const duration=Number(stdout.trim());if(!Number.isFinite(duration)||duration<=0)throw Error(`duration ${stdout.trim()}`);
 }catch(error){undecodable.push(`${basename(file)}: ${error instanceof Error?error.message:String(error)}`);}
}
let largestAsset={file:'(none)',bytes:0};
for(const file of allFiles){const bytes=(await stat(file)).size;if(bytes>largestAsset.bytes)largestAsset={file:basename(file),bytes};}

console.log('Audio payload before/after (decimal MB)');
console.log('metric                       before    after    limit');
console.log(`dist total                  ${mb(totalBefore).padStart(7)}   ${mb(totalAfter).padStart(7)}   <= 31.00`);
console.log(`pre-lazy first-click (${String(preLazyEager.size).padStart(2)})   ${mb(preLazy.before).padStart(7)}   ${mb(preLazy.after).padStart(7)}   reference`);
console.log(`first-click audio (${String(eager.size).padStart(2)})      ${mb(preLazy.after).padStart(7)}   ${mb(initial.after).padStart(7)}   <=  6.00`);
console.log(`initial source audio (${String(eager.size).padStart(2)})    ${mb(initial.before).padStart(7)}   (before WAV compression)`);
console.log(`largest emitted asset       ${mb(largestAsset.bytes).padStart(7)}          ${largestAsset.file}`);
console.log(`audio decode check          ${String(audioAssets.length).padStart(7)} files, ${undecodable.length} failures`);
console.log(`WAVs over 400 kB            ${String(oversizedWavs.length).padStart(7)}`);
assert.deepEqual(oversizedWavs,[],`Oversized WAVs:\n${oversizedWavs.join('\n')}`);
assert.ok(totalAfter<=31_000_000,`dist total ${mb(totalAfter)} MB exceeds 31 MB`);
assert.ok(initial.after<=6_000_000,`First-click audio ${mb(initial.after)} MB exceeds 6 MB`);
assert.deepEqual(undecodable,[],`Undecodable audio:\n${undecodable.join('\n')}`);
console.log('PASS audio payload gates');
