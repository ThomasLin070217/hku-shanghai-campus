/**
 * Headless check for the bright→dark incident atmosphere and the AI curtain.
 * Uses a real THREE.Scene and real light objects; only the WebGL renderer is a stub
 * because the module only reads toneMappingExposure from it.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOpeningAtmosphere,OPENING_DOME} from '../src/opening/atmosphere';
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

// Restart returns the whole scene to the opening afternoon.
atmosphere.reset();
const reset=atmosphere.snapshot();
assert.equal(reset.phase,'day');
assert.equal(reset.curtainVisible,false);
assert.equal(reset.redLights,0);
assert.ok(Math.abs(reset.hemiIntensity-day.hemiIntensity)<.01,'reset restores the day light');
assert.ok(Math.abs(renderer.toneMappingExposure-1)<.01,'reset restores tone mapping');
assert.doesNotThrow(()=>atmosphere.dispose(),'dispose is safe');
console.log('PASS atmosphere: animated curtain deployment, night lighting, red beacons, pause freeze and day reset');
