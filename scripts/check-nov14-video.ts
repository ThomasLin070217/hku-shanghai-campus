import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';import{createNavigation}from '../src/exploration/navigation';import{CharacterPhysics}from '../src/exploration/physics';import{BUILDINGS,SITE}from '../src/model/campusParameters';import{stairPoint,COURTYARD}from '../src/model/courtyard';import{EXPLORATION as C}from '../src/exploration/config';import{linkLayout}from '../src/model/nov14Details';
const w=createNavigation(BUILDINGS,SITE),results:any[]=[];
for(let f=0;f<2;f++){
 const b=new CharacterPhysics(w);b.position.copy(stairPoint(SITE,f,0));b.position.y=0;
 const go=(target:T.Vector3)=>{let count=0;while(Math.hypot(target.x-b.position.x,target.z-b.position.z)>.03&&count++<1000){const dx=target.x-b.position.x,dz=target.z-b.position.z,yaw=Math.atan2(-dx,-dz);b.step(C.fixedStep,{forward:Math.min(1,Math.hypot(dx,dz)/C.speed/C.fixedStep),right:0,sprint:false},yaw,false);}assert.ok(count<1000,JSON.stringify({f,target:target.toArray(),actual:b.position.toArray(),contacts:b.contacts}));};
 for(let i=1;i<=200;i++)go(stairPoint(SITE,f,i/200));const bottom=b.position.toArray();assert.ok(b.position.y< -4.1);
 for(let i=199;i>=0;i--)go(stairPoint(SITE,f,i/200));const off=new T.Vector3(0,0,SITE.plazaZ+(f===0?1:-1)*(SITE.plazaRadiusZ+1));go(off);assert.ok(Math.abs(b.position.y-(w.support(off.x,off.z,0)??0))<.02);results.push({name:`curved flight ${f} down/up`,bottom,off:off.toArray(),end:b.position.toArray()});
}
const l=linkLayout(BUILDINGS);assert.ok(!w.blocked(l.x,l.z,0));assert.ok(!w.obstacles.some(o=>o.name.startsWith('B04-B05-link-')),'removed corridor must leave no deck or support collisions');assert.ok(!w.contacts(l.x,l.z,l.bottom-1).length,'former overhead slab must be clear');results.push({name:'A012 retired / ground and overhead clear',layout:l});
const across=new CharacterPhysics(w);across.position.set(l.x-16,0,l.z+3.5);for(let i=0;i<120*7;i++)across.step(C.fixedStep,{forward:1,right:0,sprint:true},-Math.PI/2,false);assert.ok(across.position.x>l.x+16);results.push({name:'east-west passage beside observed troughs',end:across.position.toArray()});
assert.ok(!w.obstacles.some(o=>/plaza-stair-|ramp-inner/.test(o.name)));results.push({name:'obsolete straight flights and spiral removed',passed:true});
fs.writeFileSync('evidence/nov14-video/geometry-checks.json',JSON.stringify(results,null,2));console.log(results);w.dispose();

// Check the actual generated models as well as navigation, in both public views.
const {buildSite}=await import('../src/model/buildSite');
const {disposeAsset}=await import('../src/model/buildCampus');
const {sceneRegistry}=await import('../src/scene/registry');
for(const opening of [false,true]){
 const site=buildSite(undefined,undefined,opening);
 assert.equal(site.root.getObjectByName('B04_B05_Observed_Connection'),undefined,'corridor geometry must be absent');
 assert.equal(sceneRegistry(site.root).byId.has('A012'),false,'retired ID must not remain selectable');
 let planters=0;site.root.traverse(o=>{if(o.name==='Side_passage_planter')planters++;else planters+=(o.userData.authorParts??[]).filter((p:{name:string})=>p.name==='Side_passage_planter').length;});
 // Compaction can merge the pair, so the author traces must retain their names.
 assert.ok(planters>=2,'both ground planters must survive');
 disposeAsset(site.root);
}
console.log('PASS specified A012 corridor removed in ordinary and opening models; ground planting retained');
