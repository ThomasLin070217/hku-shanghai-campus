import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

export default defineConfig(({mode})=>{
 const review=mode==='review',out=review?'dist-review':'dist';
 const input:Record<string,string>={main:resolve('index.html'),interiors:resolve('interiors.html'),characters:resolve('characters.html')};if(review){input.assessment=resolve('assessment.html');input.aiStudy=resolve('ai-study.html');}
 return {
  base:'./',
  server:{port:5184,strictPort:true,watch:{usePolling:true,interval:500}},
  build:{outDir:out,assetsInlineLimit:(path)=>path.endsWith('.wav')?false:undefined,chunkSizeWarningLimit:850,rollupOptions:{
   input,
   output:{manualChunks(id){if(id.includes('/node_modules/three/'))return 'three';}}
  }},
  plugins:[{name:'copy-delivery-references',closeBundle(){
   mkdirSync(resolve(out),{recursive:true});
   cpSync(resolve('THIRD-PARTY-NOTICES.md'),resolve(out,'THIRD-PARTY-NOTICES.md'));
   for(const file of ['assets/audio/SOURCES.md','assets/audio/LICENSE.txt','assets/audio/kenney/License.txt','assets/audio/story/SOURCES.md','assets/audio/story/IMPORT.json','assets/audio/story/audio-triggers.json','assets/characters/kenney/LICENSE.txt','docs/ASSET-LICENSES-V8.md']){mkdirSync(resolve(out,file,'..'),{recursive:true});cpSync(resolve(file),resolve(out,file));}
   mkdirSync(resolve(out,'licenses'),{recursive:true});cpSync(resolve('node_modules/three/LICENSE'),resolve(out,'licenses/three.txt'));
   if(!review)return; // Runtime dependencies are emitted by Vite; evidence is opt-in.
   for(const directory of ['references','assets','evidence','docs'])
    cpSync(resolve(directory),resolve(out,directory),{recursive:true,filter:src=>basename(src)!=='video'});
   cpSync(resolve('AI-INTERFACE.md'),resolve(out,'AI-INTERFACE.md'));
  }}]
 };
});
