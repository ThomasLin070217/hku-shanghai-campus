import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createNavigation} from '../src/exploration/navigation';
import {CharacterPhysics} from '../src/exploration/physics';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {EXPLORATION as C} from '../src/exploration/config';
const world=createNavigation(BUILDINGS,SITE),log:any[]=[];
function traverse(name:string,x:number,z:number,seconds:number,yaw:number){const b=new CharacterPhysics(world);b.position.set(x,world.support(x,z,0)!,z);for(let i=0;i<seconds*120;i++)b.step(C.fixedStep,{forward:1,right:0,sprint:false},yaw,false);const expected=seconds*C.speed,actual=Math.hypot(b.position.x-x,b.position.z-z);assert.ok(Math.abs(expected-actual)<.05,`${name}: travelled ${actual}/${expected}, at ${b.position.toArray()}`);log.push({name,end:b.position.toArray(),distance:actual});}
traverse('Banded promenade continuous',18,36,33,0);
traverse('Hall-side passage to track',19,-49,19,0);
traverse('Two-way track length eastbound',-85,-98,65,-Math.PI/2);
traverse('Two-way track length westbound',84,-98,65,Math.PI/2);
const b=new CharacterPhysics(world);b.position.set(-52,0,-89);for(let i=0;i<240;i++)b.step(C.fixedStep,{forward:-1,right:0,sprint:false},0,false);assert.ok(b.position.y>.50&&b.position.z< -85.5);log.push({name:'Northern steps climb and closed facade',position:b.position.toArray()});
for(const [x,z,id] of [[25,29,'CDS-landscape-monument'],[21.25,-40,'video-hedge'],[18.15,-88.8,'building-6-sign']] as const)assert.ok(world.contacts(x,z,0).some(o=>o.name===id));
fs.mkdirSync('assets/night-video',{recursive:true});fs.writeFileSync('assets/night-video/navigation-checks.json',JSON.stringify(log,null,2));console.log(log);world.dispose();
