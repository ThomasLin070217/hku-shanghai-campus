import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSite} from '../src/model/buildSite';
import {sceneRegistry} from '../src/scene/registry';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {LAWN_SIGN,LAWN_SIZE,OCULUS,perimeterBeds} from '../src/model/videoFollowup';
import {createNightLighting} from '../src/viewer/nightLighting';
import {disposeAsset} from '../src/model/buildCampus';
const a=buildSite(),r=sceneRegistry(a.root),nav=createNavigation(BUILDINGS,SITE);
const word=r.entities.find(e=>e.name==='HKU'&&e.parentId==='A003')!;assert.ok(word);assert.ok(word.size[0]<2&&word.size[1]<1);assert.ok(Math.abs(word.size[0]-LAWN_SIZE.x)<.001);
const collider=nav.obstacles.find(o=>o.name==='HKU-lawn-letters')!;assert.ok(Math.abs(collider.w-word.size[0])<.001);assert.ok(Math.abs(collider.top-word.bounds.max[1])<.001);assert.ok(nav.blocked(0,LAWN_SIGN.z,0));assert.ok(!nav.blocked(2,LAWN_SIGN.z,0));
assert.equal(r.get('A006')!.center[0],OCULUS.x);assert.ok(nav.obstacles.some(o=>o.name==='oculus-column'&&o.x===OCULUS.x-5));assert.ok(!nav.obstacles.some(o=>o.name==='oculus-column'&&o.x===-31));
const scene=new T.Scene(),lights={hemi:new T.HemisphereLight(),sun:new T.DirectionalLight(),fill:new T.DirectionalLight()},night=createNightLighting(scene,undefined,lights);const strips=new Set<T.MeshStandardMaterial>();a.root.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name==='Night_observed lavender facade strips')strips.add(m as T.MeshStandardMaterial);}});assert.ok(strips.size>0);night.set(false,a.root);for(const m of strips){assert.equal(m.emissiveIntensity,0);assert.equal(m.color.getHex(),0x8b9491);}night.set(true,a.root);a.root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.name.startsWith('Night_'))assert.ok(Number.isFinite(m.emissiveIntensity));});for(const m of strips){assert.equal(m.emissiveIntensity,1.1);assert.equal(m.color.getHex(),0xa99aff);}night.set(false,a.root);for(const m of strips)assert.equal(m.emissiveIntensity,0);
for(const b of perimeterBeds(SITE)){assert.ok(Math.abs(b.x)+b.w/2<SITE.width/2);assert.ok(Math.abs(b.z-SITE.centerZ)+b.d/2<SITE.depth/2);}
for(const [x,z]of [[-94,-44],[94,-44],[0,110],[24,96],[24,-43]])assert.equal(nav.blocked(x,z,nav.support(x,z,0)!),false,`route ${x},${z}`);
console.log('PASS H estimate yields compact word / collision matches / side passage reopened; oculus render + collision moved together; daytime neutral LEDs, night colour and repeat toggle; perimeter within bounds / routes clear', {wordSize:word.size,entities:r.entities.length});night.dispose();nav.dispose();disposeAsset(a.root);
