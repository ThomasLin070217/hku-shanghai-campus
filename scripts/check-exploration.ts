import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {EXPLORATION as C} from '../src/exploration/config';
const cds=BUILDINGS.find(b=>b.id==='B04')!,outerX=cds.x+cds.width/2,openX=outerX+1.65;
const w=createNavigation(BUILDINGS,SITE),results:{name:string;detail:unknown}[]=[];
function test(name:string,fn:()=>unknown){const detail=fn();results.push({name,detail});console.log('PASS',name,detail);}
const travel=(start:number[],vx:number,vz:number,secs:number,fps=60)=>{const p=new T.Vector3(...start as [number,number,number]);for(let i=0;i<secs*fps;i++)w.step(p,vx/fps,vz/fps);return p;};
test('30/60/144 FPS movement is equal',()=>{const ps=[30,60,144].map(f=>travel([openX,0,40],0,-C.speed,3,f));assert.ok(ps.every(p=>p.distanceTo(ps[0])<1e-7));return ps.map(p=>p.toArray());});
test('normalized diagonal matches straight distance',()=>{const a=travel([openX,0,40],0,-C.speed,2),b=travel([openX,0,40],-C.speed/Math.SQRT2,-C.speed/Math.SQRT2,2);assert.ok(Math.abs(Math.hypot(a.x-openX,a.z-40)-Math.hypot(b.x-openX,b.z-40))<1e-7);return b.toArray();});
test('CDS-1 doors stop motion; no tunnelling in one large update',()=>{const p=travel([cds.x,.045,33.5],0,-C.speed,10);assert.ok(p.z>22.5);const q=new T.Vector3(cds.x,.045,33.5);w.step(q,0,-80);assert.ok(q.z>22.5);return[p.toArray(),q.toArray()];});
test('walls block and permit sliding at a corner',()=>{const p=travel([outerX+2,0,10],-C.speed,C.speed,3);assert.ok(p.x>outerX);assert.ok(p.z>15);return p.toArray();});
test('map boundary blocks travel',()=>{const p=travel([100,0,0],C.speed,0,8);assert.ok(p.x<104&&p.x>102);return p.toArray();});
test('tree trunk and entrance bed collision',()=>{assert.ok(w.blocked(-12.7,60,.13));assert.ok(!w.blocked(-20,53,0));assert.ok(w.blocked(cds.x+18,26.1,0));assert.ok(!w.blocked(cds.x,30,0));return true;});
test('30 small steps ascend and descend without falling',()=>{const p=travel([4,0,-25],0,-C.speed,10);assert.ok(p.y>=5&&p.z< -51);const q=travel(p.toArray(),0,C.speed,11);assert.ok(Math.abs(q.y-.09)<.001);return[p.toArray(),q.toArray()];});
test('high seating risers block direct climb',()=>{const p=travel([11,0,-25],0,-C.speed,4);assert.ok(p.z> -27.5&&p.y===0);return p.toArray();});
// Curved flights use the current CharacterPhysics controller; down/up coverage is check:nov14.
test('sunken edge cannot be walked off',()=>{const p=travel([5,0,0],0,C.speed,8);assert.ok(p.z<5);assert.equal(p.y,0);return p.toArray();});
test('camera rays hit the below-ground retaining wall',()=>{const ray=new T.Raycaster(new T.Vector3(0,-2,30),new T.Vector3(1,0,0));const hit=ray.intersectObjects(w.meshes,false)[0];assert.ok(hit&&['plaza-retaining-wall','curved-stair-guard','curved-stair-tread'].includes(hit.object.name));assert.ok(ray.intersectObjects(w.meshes,false).some(h=>h.object.name==='plaza-retaining-wall')); return{obstacle:hit.object.name,distance:hit.distance};});
fs.mkdirSync('assets/exploration',{recursive:true});fs.writeFileSync('assets/exploration/navigation-checks.json',JSON.stringify({date:new Date().toISOString(),results},null,2));w.dispose();
