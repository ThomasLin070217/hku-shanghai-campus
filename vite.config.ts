import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
export default defineConfig({
 base:'./',server:{port:5174,strictPort:true,watch:{usePolling:true,interval:500}},build:{chunkSizeWarningLimit:850,rollupOptions:{input:{campus:resolve("index.html"),aiStudy:resolve("ai-study.html")},output:{manualChunks(id){if(id.includes('/node_modules/three/'))return 'three';if(id.includes('/node_modules/xstate/'))return 'quests';}}}},
 plugins:[{name:'copy-delivery-references',closeBundle(){
   mkdirSync(resolve('dist/references'),{recursive:true});
   cpSync(resolve('references'),resolve('dist/references'),{recursive:true,filter:(src)=>basename(src)!=='video'});
   cpSync(resolve('assets'),resolve('dist/assets'),{recursive:true});
 }}]
});
