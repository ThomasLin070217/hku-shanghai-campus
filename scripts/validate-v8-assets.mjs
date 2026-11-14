import fs from 'node:fs';import {validateBytes}from 'gltf-validator';
const paths=['assets/characters/hku-green.glb','assets/characters/navy-student.glb','assets/characters/sand-student.glb','assets/items/macbook-air-13-silver.glb','assets/items/entrance-lion.glb'];const results=[];
for(const p of paths){const r=await validateBytes(new Uint8Array(fs.readFileSync(p)),{uri:p});results.push({path:p,bytes:fs.statSync(p).size,errors:r.issues.numErrors,warnings:r.issues.numWarnings,messages:r.issues.messages});if(r.issues.numErrors)throw Error(p+': '+JSON.stringify(r.issues));}
fs.writeFileSync('evidence/v8/gltf-validation.json',JSON.stringify(results,null,2));console.log(results.map(({messages,...r})=>r));
