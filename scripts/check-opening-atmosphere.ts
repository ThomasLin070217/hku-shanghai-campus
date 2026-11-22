/**
 * Headless check for the bright→dark incident atmosphere and the AI curtain.
 * Uses a real THREE.Scene and real light objects; only the WebGL renderer is a stub
 * because the module only reads toneMappingExposure from it.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOpeningAtmosphere,OPENING_DOME} from '../src/opening/atmosphere';
import {OPENING as O} from '../src/opening/spatialLayout';
import {BUILDINGS} from '../src/model/campusParameters';

const scene=new T.Scene();
scene.background=new T.Color(0xb5d7e4);
scene.environmentIntensity=.25;
const hemi=new T.HemisphereLight(0xe5f3ff,0x6c8157,1.35);
scene.add(hemi);
const sun=new T.DirectionalLight(0xffefd6,2.5);
scene.add(sun);
const fill=new T.DirectionalLight(0xc1d8e0,.4);
scene.add(fill);
const renderer={toneMappingExposure:1} as unknown as T.WebGLRenderer;
const atmosphere=createOpeningAtmosphere(scene,renderer,{hemi,sun,fill});
const day=atmosphere.snapshot();
assert.equal(day.phase,'day');
assert.equal(day.curtainVisible,false);
assert.ok(day.hemiIntensity>1,'the opening starts bright');
const dayFog=day.fogDensity;

// The curtain descends over several render frames, not in one hard cut.
for(let i=0;i<60;i++)atmosphere.update(1/60,{incident:true,curtain:true,paused:false});
const mid=atmosphere.snapshot();
assert.equal(mid.phase,'disturbance');
assert.ok(mid.curtainVisible,'the boundary becomes visible during deployment');
assert.ok(mid.curtainProgress>.1&&mid.curtainProgress<1,`deployment is animated (${mid.curtainProgress})`);
for(let i=0;i<360;i++)atmosphere.update(1/60,{incident:true,curtain:true,paused:false});
const night=atmosphere.snapshot();
assert.equal(night.phase,'night');
assert.equal(night.curtainVisible,true);
assert.ok(night.curtainProgress>=1,'the curtain reaches the ground');
assert.ok(night.fogDensity>dayFog,'night fog is present');
assert.ok(night.hemiIntensity<day.hemiIntensity*.4,'ambient light drops sharply');
assert.ok(night.sunIntensity<day.sunIntensity*.2,'sunlight is nearly removed');
assert.ok(night.redLights>=4,'red emergency beacons are lit across the route');
assert.ok(atmosphere.root.getObjectByName('Opening_AI_curtain_boundary'),'the sealing boundary exists');

// The seal is a hemisphere, not the old four-wall box with a flat ceiling.
const dome=atmosphere.root.getObjectByName('Opening_AI_curtain_dome') as T.Mesh|undefined;
assert.ok(dome?.isMesh,'the AI seal is a dome mesh');
assert.ok(dome.geometry instanceof T.SphereGeometry,'the dome geometry is a hemisphere');
assert.equal(dome.geometry.parameters.thetaLength,Math.PI/2,'the dome is exactly half a sphere');
assert.equal(atmosphere.root.getObjectByName('Opening_AI_curtain_ceiling'),undefined,'no flat box ceiling remains');
assert.equal(night.domeRadius,OPENING_DOME.radius);
assert.equal(night.domeTop,OPENING_DOME.top);

// Every authored roof corner must stay under the dome surface, otherwise the
// hemisphere would slice a tower the same way the old flat ceiling did.
const ROOF_MARGIN=4;
for(const b of BUILDINGS){
 const dx=Math.abs(b.x-OPENING_DOME.centerX)+b.width/2;
 const dz=Math.abs(b.z-OPENING_DOME.centerZ)+b.depth/2;
 const corner=Math.hypot(dx,dz);
 assert.ok(corner<OPENING_DOME.radius,`${b.id} corner is inside the dome footprint`);
 const domeHeight=-OPENING_DOME.sink+Math.sqrt(OPENING_DOME.radius**2-corner**2);
 assert.ok(domeHeight>=b.height+ROOF_MARGIN,`${b.id} roof (${b.height} m) clears the dome at its corner (${domeHeight.toFixed(1)} m)`);
}

// A paused frame must not advance the curtain.
const frozen=atmosphere.snapshot();
for(let i=0;i<120;i++)atmosphere.update(1,{incident:true,curtain:true,paused:true});
assert.equal(atmosphere.snapshot().curtainProgress,frozen.curtainProgress,'pausing freezes deployment');

// Re-entering a sealed campus restores the dome fully deployed, without replaying
// the descent the player already saw in the opening.
atmosphere.restoreSealed();
const restored=atmosphere.snapshot();
assert.equal(restored.phase,'night');
assert.equal(restored.curtainProgress,1);
assert.equal(restored.curtainVisible,true);
assert.equal(restored.releasing,false);

// The explicit purge plays the dome back up and returns daylight.
atmosphere.release();
assert.equal(atmosphere.snapshot().releasing,true,'release is a deliberate transition');
for(let i=0;i<60;i++)atmosphere.update(1/60,{incident:false,curtain:false,paused:false});
const releasing=atmosphere.snapshot();
assert.ok(releasing.curtainProgress>0&&releasing.curtainProgress<1,`release is animated (${releasing.curtainProgress})`);
const frozenRelease=releasing.curtainProgress;
atmosphere.update(1,{incident:false,curtain:false,paused:true});
assert.equal(atmosphere.snapshot().curtainProgress,frozenRelease,'pausing freezes the purge');
for(let i=0;i<400;i++)atmosphere.update(1/60,{incident:false,curtain:false,paused:false});
const cleared=atmosphere.snapshot();
assert.equal(cleared.phase,'day');
assert.equal(cleared.curtainProgress,0);
assert.equal(cleared.curtainVisible,false);
assert.equal(cleared.releasing,false);
assert.ok(Math.abs(cleared.hemiIntensity-day.hemiIntensity)<.01,'the purge restores the day light');
assert.ok(Math.abs(renderer.toneMappingExposure-1)<.01,'the purge restores tone mapping');

// Restart returns the whole scene to the opening afternoon immediately.
atmosphere.reset();
const reset=atmosphere.snapshot();
assert.equal(reset.phase,'day');
assert.equal(reset.curtainVisible,false);
assert.equal(reset.redLights,0);
assert.ok(Math.abs(reset.hemiIntensity-day.hemiIntensity)<.01,'reset restores the day light');
assert.ok(Math.abs(renderer.toneMappingExposure-1)<.01,'reset restores tone mapping');
{
 // FU1: nothing of the atmosphere stands in the B04 entrance walkway (the beacon stem
 // drew a thin black line through the crosshair at the Chapter 1 handoff).
 const root=scene.getObjectByName('Opening_AI_curtain_boundary')!;root.updateMatrixWorld(true);
 const half=O.b4.doorWidth/2+.6,inWay:string[]=[];
 root.traverse(o=>{if(!(o instanceof T.Mesh)||o.name==='Opening_AI_curtain_dome')return;
  const b=new T.Box3().setFromObject(o);
  if(b.max.x>O.b4.door-half&&b.min.x<O.b4.door+half&&b.max.z>O.b4.z1&&b.min.z<O.handoff[2]+1.5&&b.min.y<3)inWay.push(`${o.name||'(unnamed)'} ${b.min.toArray().map(n=>n.toFixed(2))}..${b.max.toArray().map(n=>n.toFixed(2))}`);});
 assert.deepEqual(inWay,[],'no beacon or stem stands in the B04 entrance walkway');
 console.log('PASS FU1: the B04 entrance walkway is clear of beacon stems');
}
{
 // FU5: the B04 entrance beacon is mounted on the facade above the door: no stem, and
 // no beacon part reaches the ground within 6 m of the door.
 const root=scene.getObjectByName('Opening_AI_curtain_boundary')!;root.updateMatrixWorld(true);
 const door=[O.b4.door,O.b4.z1],near=(x:number,z:number)=>Math.hypot(x-door[0],z-door[1])<=6;
 const grounded:string[]=[];let housing:T.Box3|null=null;
 root.traverse(o=>{if(!(o instanceof T.Mesh)||!o.name.startsWith('Opening_beacon'))return;const b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3());
  if(!near(c.x,c.z))return;if(b.min.y<.5)grounded.push(o.name+' '+b.min.toArray().map(n=>n.toFixed(2)));if(o.name==='Opening_beacon_housing')housing=b;});
 assert.deepEqual(grounded,[],'no beacon part reaches the ground within 6 m of the B04 door');
 assert.ok(housing,'the B04 entrance still has a beacon');
 const h=housing as unknown as T.Box3;
 assert.ok(h.min.y>=O.b4.doorHeight&&h.max.y<=5.18,`the housing sits above the door and under the canopy (${h.min.y.toFixed(2)}..${h.max.y.toFixed(2)})`);
 assert.ok(Math.abs(h.getCenter(new T.Vector3()).x-O.b4.door)<.3&&h.max.z<=O.b4.z1+.8,'the housing is centred on the door, on the facade');
 const light=root.children.filter((o):o is T.PointLight=>o instanceof T.PointLight).sort((a,b)=>Math.hypot(a.position.x-door[0],a.position.z-door[1])-Math.hypot(b.position.x-door[0],b.position.z-door[1]))[0];
 assert.ok(Math.hypot(light.position.x-door[0],light.position.z-door[1])<1.5,'the entrance beacon light moved with its housing');
 assert.equal(light.intensity,0,'daytime: the entrance beacon is off');
 atmosphere.restoreSealed();for(let i=0;i<30;i++)atmosphere.update(1/60,{incident:true,curtain:true,paused:false});
 assert.ok(light.intensity>.1,`sealed: the entrance beacon pulses red (${light.intensity.toFixed(2)})`);
 atmosphere.reset();
 assert.equal(light.intensity,0,'after the purge reset the beacon is off again');
 console.log('PASS FU5: the B04 beacon is on the facade above the door, no ground stem, light follows the sealed state');
}
assert.doesNotThrow(()=>atmosphere.dispose(),'dispose is safe');
console.log('PASS atmosphere: hemispherical dome clears every roof, animated deployment, instant sealed restore, animated purge to daylight, red beacons and pause freeze');
