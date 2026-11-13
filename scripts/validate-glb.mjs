import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import validator from 'gltf-validator';
const files=['assets/HKU-Shanghai-Campus.glb','assets/HKU-Shanghai-Campus-no-ground.glb','assets/Student-Green-Gown.glb','assets/B05-4F-Stepped-Lounge.glb',...readdirSync('assets/buildings').filter(f=>f.endsWith('.glb')).map(f=>'assets/buildings/'+f)],reports=[];
for(const file of files){const r=await validator.validateBytes(new Uint8Array(readFileSync(file)),{uri:file,maxIssues:100});reports.push({file,issues:r.issues,info:r.info});console.log(file,r.issues.numErrors+' errors',r.issues.numWarnings+' warnings');}
writeFileSync('assets/gltf-validation.json',JSON.stringify(reports,null,2));if(reports.some(r=>r.issues.numErrors||r.issues.numWarnings))process.exitCode=1;
