/** Offline plan by default. Credentials stay in Node, never in the Vite bundle. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createClient,type components} from '@worldlabsai/client';

type Schema=components['schemas'];
type Stage='pose'|'splat'|'mesh';
const stage=process.argv[2]||'plan';
const dir=resolve('references/ai-world-v7');
const manifest=JSON.parse(await readFile(resolve(dir,'inputs.json'),'utf8')) as {frames:{file:string;sha256:string}[]};
const inputs=await Promise.all(manifest.frames.map(async f=>{
  const path=resolve(dir,f.file);if(dirname(path)!==dir)throw new Error('Input path outside reference folder');
  const bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw new Error('Reference changed: '+f.file);
  return {imageAsset:{base64:'data:image/jpeg;base64,'+bytes.toString('base64')}};
}));
if(stage==='plan'){
  console.log(JSON.stringify({provider:'World Labs Atlas',sdk:'0.7.0',inputFrames:manifest.frames.map(f=>f.file),
    pipeline:['pose: photos → cameras + depth','splat: inspected poses → draft SPZ','mesh: SPZ → textured GLB'],
    output:'assets/ai-generated/b05-lounge-study.glb',targetFaces:40000,textureSize:2048,
    status:'offline plan; no upload, generation, or charge',
    execute:'Set WLT_API_KEY privately, then npm run ai:atlas -- pose; inspect poses before splat and mesh.',
    caution:'Single-video study with limited translation; hidden geometry and scale remain estimates.'},null,2));
  process.exit(0);
}
if(!['pose','splat','mesh'].includes(stage))throw new Error('Use plan | pose | splat | mesh');
const apiKey=process.env.WLT_API_KEY;if(!apiKey)throw new Error('WLT_API_KEY is missing. Configure it privately; never paste it in chat or commit it.');
const wl=createClient({apiKey});
// Local state contains asset IDs and poses, not API keys, inline inputs, or signed URLs.
const cache=resolve('.atlas-local');await mkdir(cache,{recursive:true});
const statePath=resolve(cache,stage+'.json');
type State={key:string;hash:string;operationId?:string;response?:unknown};
const scrub=(v:unknown):unknown=>Array.isArray(v)?v.map(scrub):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['url','base64','readUrl','signedQuery'].includes(k)).map(([k,x])=>[k,scrub(x)])):v;
const previous=async<T>(name:Stage):Promise<T>=>{
  const s=JSON.parse(await readFile(resolve(cache,name+'.json'),'utf8')) as State;
  if(!s.response)throw new Error('Complete '+name+' first');return s.response as T;
};
const request=stage==='pose'?{frames:inputs,targetResolution:[960,720] as [number,number],canonicalizeToFirstFrame:true}:
  stage==='splat'?{posedFrames:(await previous<Schema['Images2PosedRGBDResponse']>('pose')).frames,refine:false,enhancePrompt:false,
    prompt:'Reconstruct only the photographed university stepped lounge: timber seating tiers, narrow side stairs, white tables, striped cushions, glass balustrades. Preserve observed layout. Do not add invented corridors.'}:
  {splatAsset:(await previous<Schema['PosedImages2SplatsResponse']>('splat')).draftSplat!,targetFaces:40000,textureSize:2048,textureMode:'image_texture' as const};
if(stage==='mesh'&&!(request as Schema['Splats2MeshRequest']).splatAsset)throw new Error('No draft splat returned');
const hash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
let state:State;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;state={key:randomUUID(),hash};}
if(state.hash!==hash)throw new Error('Inputs changed. Preserve the old .atlas-local job folder before starting a new experiment.');
const save=()=>writeFile(statePath,JSON.stringify(state,null,2));await save();
if(!state.response){
  const signal=AbortSignal.timeout(25*60*1000);
  if(!state.operationId){
    const options={idempotencyKey:state.key,signal,retry:false};
    const op=stage==='pose'?await wl.tasks.images2PosedRGBD(request as Schema['Images2PosedRGBDRequest'],options):
      stage==='splat'?await wl.tasks.posedImages2Splats(request as Schema['PosedImages2SplatsRequest'],options):
      await wl.tasks.splats2Mesh(request as Schema['Splats2MeshRequest'],options);
    state.operationId=op.id;await save();
  }
  console.log('Waiting on existing operation',state.operationId,'(interrupting local polling does not cancel the remote task).');
  const result=await wl.operations.wait(await wl.operations.get(state.operationId),{signal,pollIntervalMs:5000});
  if(result.error)throw new Error(result.error.message||'Atlas task failed');
  if(!result.response)throw new Error('Atlas returned no response');
  state.response=scrub(result.response);await save();
}
if(stage==='mesh'){
  const mesh=(state.response as Schema['Splats2MeshResponse']).mesh;
  if(!mesh.assetId)throw new Error('No mesh asset ID');
  const {readUrl}=await wl.assets.createReadUrl(mesh.assetId);
  const r=await fetch(readUrl,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('Mesh download HTTP '+r.status);
  const bytes=Buffer.from(await r.arrayBuffer());if(bytes.subarray(0,4).toString()!=='glTF')throw new Error('Downloaded content is not GLB');
  const out=resolve('assets/ai-generated');await mkdir(out,{recursive:true});
  await writeFile(resolve(out,'b05-lounge-study.glb'),bytes);
  await writeFile(resolve(out,'b05-lounge-study.provenance.json'),JSON.stringify({provider:'World Labs Atlas',createdAt:new Date().toISOString(),
    inputManifest:'references/ai-world-v7/inputs.json',sha256:createHash('sha256').update(bytes).digest('hex'),
    status:'generated study; visual and collision review required before campus placement',dimensions:'not measured',targetFaces:40000},null,2));
  console.log('Saved assets/ai-generated/b05-lounge-study.glb. Validate and review before placement.');
}else console.log(stage+' complete. Inspect .atlas-local/'+stage+'.json before starting the next stage.');
