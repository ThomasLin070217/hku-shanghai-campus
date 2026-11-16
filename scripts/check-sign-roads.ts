import assert from 'node:assert/strict';
import * as T from 'three';
import {monumentPolePosition} from '../src/model/videoDetailsParameters';
import {sceneRegistry} from '../src/scene/registry';
import {buildSite} from '../src/model/buildSite';
import {disposeAsset} from '../src/model/buildCampus';
import {driveLayout,promenadeLayout,centralWalkLayout,subtractRects,type GroundRect} from '../src/model/groundLayout';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {CharacterPhysics} from '../src/exploration/physics';
import {EXPLORATION as C} from '../src/exploration/config';
import {prepareModelTextures,deferredTexture} from '../src/model/deferredTextures';

const area=(r:GroundRect)=>r.width*r.depth;
const overlap=(a:GroundRect,b:GroundRect)=>Math.max(0,Math.min(a.x+a.width/2,b.x+b.width/2)-Math.max(a.x-a.width/2,b.x-b.width/2))*Math.max(0,Math.min(a.z+a.depth/2,b.z+b.depth/2)-Math.max(a.z-a.depth/2,b.z-b.depth/2));
assert.equal(subtractRects({x:0,z:0,width:10,depth:10},[{x:0,z:0,width:4,depth:4}]).reduce((n,r)=>n+area(r),0),84);
const surfaces=[...driveLayout(),...promenadeLayout(),...centralWalkLayout(SITE)];
for(let i=0;i<surfaces.length;i++)for(let j=i+1;j<surfaces.length;j++)assert.ok(overlap(surfaces[i],surfaces[j])<1e-7,`overlapping surface ${i}/${j}`);
assert.ok(centralWalkLayout(SITE).every(r=>r.z-r.depth/2>SITE.plazaZ+SITE.plazaRadiusZ+1.7));
console.log('PASS road junctions, promenade joints and central walks have no positive-area overlap');

const asset=buildSite(),world=createNavigation(BUILDINGS,SITE);asset.root.updateMatrixWorld(true);
const lettering=asset.root.getObjectByName('CDS_Monument_Lettering');assert.ok(lettering);assert.equal(lettering.userData.text.join(' '),'SCHOOL OF COMPUTING & DATA SCIENCE The University of Hong Kong');
let letters=0;lettering.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.Material).name==='Sign_monument_black_letters'){
 const material=o.material as T.MeshStandardMaterial;assert.equal(material.map,null);assert.equal(material.color.getHex(),0x080808);assert.equal(material.transparent,false);o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!;assert.ok(b.min.z>.18&&b.max.z<.20);assert.ok(b.min.x>-.42&&b.max.x<1.71);letters++;
}});assert.equal(letters,1); // Four text lines compacted into one opaque draw call.
console.log('PASS exact reference wording, black geometry, face clearance, bounded lettering, single draw call');

const ray=new T.Raycaster();
for(const [x,z,height] of [[94,-44,.05],[92,98,.05],[24,-44,.05],[24,-47.8,.035],[16.8,96,.05],[16.8,90,.07],[0,-12,.04],[31,30,.14]]){
 assert.ok(Math.abs(world.support(x,z,0)!-height)<1e-7,`support ${x},${z}`);
 ray.set(new T.Vector3(x,.5,z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(asset.root,true)[0];assert.ok(hit,`missing surface ${x},${z}`);assert.ok(Math.abs(hit.point.y-height)<.013,`render/physics mismatch ${x},${z}: ${hit.point.y}/${height}`);
}
for(const [x,z,seconds,yaw] of [[24,-38,5,0],[94,-38,5,0],[16.8,90,4,Math.PI]]){
 const body=new CharacterPhysics(world);body.position.set(x,world.support(x,z,0)!,z);let minY=Infinity;
 for(let i=0;i<seconds/C.fixedStep;i++){body.step(C.fixedStep,{forward:1,right:0,sprint:false},yaw,false);minY=Math.min(minY,body.position.y);}
 assert.ok(Math.abs(Math.hypot(body.position.x-x,body.position.z-z)-seconds*C.speed)<.05);assert.ok(minY>=0);
}
const mon=asset.root.getObjectByName('CDS_Landscape_Monument')!;assert.ok(world.contacts(mon.position.x,mon.position.z,.14).some(o=>o.name==='CDS-landscape-monument'));
const pole=monumentPolePosition(),polePart=sceneRegistry(asset.root).entities.find(part=>part.name==='Monument_lamp_pole');
assert.ok(polePart&&Math.hypot(polePart.center[0]-pole.x,polePart.center[2]-pole.z)<.0001);
assert.ok(world.contacts(pole.x,pole.z,.14).some(o=>o.name==='CDS-monument-lamp-pole'));
console.log('PASS raycast/render/support agreement; continuous crossings; monument and lamp pole remain solid');

let releases=0,loads=0;const tex=deferredTexture(async()=>{loads++;return{width:4,height:2,data:new Uint8Array(32)};});tex.addEventListener('dispose',()=>releases++);
const tmp=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({map:tex}));await prepareModelTextures(tmp);assert.equal(releases,1);assert.equal(tex.image.width,4);await prepareModelTextures(tmp);assert.equal(loads,1);disposeAsset(tmp);assert.equal(releases,2);
console.log('PASS deferred image reallocates GPU storage once; subsequent loads do not cancel or repeat it');
disposeAsset(asset.root);world.dispose();
