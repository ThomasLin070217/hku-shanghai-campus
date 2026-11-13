import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
export default defineConfig({
 base:'./',server:{port:5174,strictPort:true,watch:{usePolling:true,interval:500}},build:{chunkSizeWarningLimit:850},
 plugins:[{name:'copy-delivery-references',closeBundle(){
   mkdirSync(resolve('dist/references'),{recursive:true});
   cpSync(resolve('references'),resolve('dist/references'),{recursive:true,filter:(src)=>basename(src)!=='video'});
   cpSync(resolve('assets'),resolve('dist/assets'),{recursive:true});
 }}]
});
