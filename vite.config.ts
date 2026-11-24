import { defineConfig, type Plugin } from 'vite';
import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, basename, dirname } from 'node:path';
import { compressAudioFile } from './scripts/compress-audio.mjs';

function audioCompressionPlugin():Plugin{
 const skipped=/^(1|true|yes)$/i.test(process.env.SKIP_AUDIO_COMPRESS??'');
 const strict=/^(1|true|yes)$/i.test(process.env.AUDIO_COMPRESS_STRICT??'')||process.argv.includes('--strict');
 const records:{wav:string;mp3:string;originalBytes:number;compressedBytes:number}[]=[];
 let outputDirectory='';
 return {name:'compress-build-audio',apply:'build' as const,
  configResolved(config){outputDirectory=resolve(config.build.outDir);},
  generateBundle:{order:'post',async handler(_options,bundle){
   if(skipped){this.warn('Audio compression skipped (SKIP_AUDIO_COMPRESS).');return;}
   const cache=resolve('.scratch/audio-compress-cache');
   for(const [fileName,asset]of Object.entries(bundle)){
    if(asset.type!=='asset'||!fileName.endsWith('.wav'))continue;
    const source=resolve(cache,'input',fileName);mkdirSync(dirname(source),{recursive:true});writeFileSync(source,Buffer.from(asset.source));
    try{
     const result=await compressAudioFile(source);
     const mp3Name=`${fileName.slice(0,-4)}-${result.key.slice(0,16)}.mp3`,compressed=readFileSync(result.output);
     this.emitFile({type:'asset',fileName:mp3Name,source:compressed});
     for(const chunk of Object.values(bundle))if(chunk.type==='chunk'){chunk.code=chunk.code.replaceAll(fileName,mp3Name).replaceAll(basename(fileName),basename(mp3Name));}
     records.push({wav:fileName,mp3:mp3Name,originalBytes:Buffer.byteLength(asset.source),compressedBytes:compressed.byteLength});
     delete bundle[fileName];
    }catch(error){
     const message=`Cannot compress ${fileName}: ${error instanceof Error?error.message:String(error)}`;
     if(strict)this.error(message);else this.warn(`${message} Shipping the original WAV; set AUDIO_COMPRESS_STRICT=1 to fail the build.`);
    }
   }
  }},
  closeBundle(){
   const cache=resolve('.scratch/audio-compress-cache'),manifests=resolve(cache,'manifests');mkdirSync(manifests,{recursive:true});
   const key=createHash('sha256').update(outputDirectory).digest('hex');
   writeFileSync(resolve(manifests,`${key}.json`),`${JSON.stringify({outDir:outputDirectory,skipped,records},null,2)}\n`);
  }
 };
}

export default defineConfig(({mode})=>{
 const review=mode==='review';
 const out=review?'dist-review':mode==='playtest'?'dist-playtest':'dist';
 const input:Record<string,string>={main:resolve('index.html'),interiors:resolve('interiors.html'),characters:resolve('characters.html')};if(review){input.assessment=resolve('assessment.html');input.aiStudy=resolve('ai-study.html');}
 return {
  base:'./',
  server:{port:5184,strictPort:true,watch:{usePolling:true,interval:500}},
  build:{outDir:out,assetsInlineLimit:(path)=>/\.(wav|mp3)$/i.test(path)?false:undefined,chunkSizeWarningLimit:850,rollupOptions:{
   input,
   output:{manualChunks(id){if(id.includes('/node_modules/three/'))return 'three';}}
  }},
  plugins:[audioCompressionPlugin(),{name:'copy-delivery-references',closeBundle(){
   mkdirSync(resolve(out),{recursive:true});
   cpSync(resolve('THIRD-PARTY-NOTICES.md'),resolve(out,'THIRD-PARTY-NOTICES.md'));
   for(const file of ['assets/audio/SOURCES.md','assets/audio/LICENSE.txt','assets/audio/kenney/License.txt','assets/audio/story/SOURCES.md','assets/audio/story/IMPORT.json','assets/audio/story/audio-triggers.json','assets/characters/kenney/LICENSE.txt','docs/ASSET-LICENSES-V8.md']){mkdirSync(resolve(out,file,'..'),{recursive:true});cpSync(resolve(file),resolve(out,file));}
   mkdirSync(resolve(out,'licenses'),{recursive:true});cpSync(resolve('node_modules/three/LICENSE'),resolve(out,'licenses/three.txt'));
   if(mode==='playtest'){
    mkdirSync(resolve(out,'media'),{recursive:true});
    cpSync(resolve('evidence/lawn-battle/full-demo.mp4'),resolve(out,'media/l001-battle.mp4'));
   }
   if(!review)return; // Runtime dependencies are emitted by Vite; evidence is opt-in.
   for(const directory of ['references','assets','evidence','docs'])
    cpSync(resolve(directory),resolve(out,directory),{recursive:true,filter:src=>basename(src)!=='video'});
   cpSync(resolve('AI-INTERFACE.md'),resolve(out,'AI-INTERFACE.md'));
  }}]
 };
});
