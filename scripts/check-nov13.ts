import assert from 'node:assert/strict';import fs from 'node:fs';
import {createNavigation} from '../src/exploration/navigation';import {CharacterPhysics} from '../src/exploration/physics';import {BUILDINGS,SITE}from '../src/model/campusParameters';import {NOV13}from '../src/model/nov13Parameters';import {EXPLORATION as C}from '../src/exploration/config';
import {VIDEO_DETAILS as V} from '../src/model/videoDetailsParameters';
const w=createNavigation(BUILDINGS,SITE),results:object[]=[];
// Earlier straight flights superseded by U06; curved down/up checks live in check-nov14-video.ts.

const p=new CharacterPhysics(w);p.position.set(V.promenade[0].x,w.support(V.promenade[0].x,69,0)!,69);for(let i=0;i<120*47;i++)p.step(C.fixedStep,{forward:1,right:0,sprint:false},0,false);assert.ok(p.position.z< -50,JSON.stringify(p.position.toArray()));results.push({name:'video east promenade south to north',end:p.position.toArray()});
assert.equal(w.obstacles.some(o=>o.name==='walkway-deck'&&o.x>0),false);assert.ok(w.contacts(NOV13.lion.x,NOV13.lion.z,0).some(o=>o.name===NOV13.lion.id));results.push({name:'removed east deck collision; lion solid',passed:true});
fs.writeFileSync('evidence/v8/campus-route-checks.json',JSON.stringify(results,null,2));console.log(results);w.dispose();
