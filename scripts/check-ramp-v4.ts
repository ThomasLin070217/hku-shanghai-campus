import assert from 'node:assert/strict';
import {createNavigation} from '../src/exploration/navigation';
import {CharacterPhysics} from '../src/exploration/physics';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
const w=createNavigation(BUILDINGS,SITE),b=new CharacterPhysics(w);b.position.set(14,0,25);let lowest=0,maxError=0;
// Follow small waypoints using only movement intention through the real integrator.
for(const descending of [true,false])for(let i=1;i<=500;i++){
 const a=descending?Math.PI*2-(Math.PI*2-.26)*i/500:.26+(Math.PI*2-.26)*i/500;
 const x=14*Math.cos(a),z=25+20*Math.sin(a);
 for(let k=0;k<100;k++) {const dx=x-b.position.x,dz=z-b.position.z,d=Math.hypot(dx,dz);if(d<.025)break;b.step(1/120,{forward:-dz/d,right:dx/d,sprint:false},0,false);}
 lowest=Math.min(lowest,b.position.y);maxError=Math.max(maxError,Math.hypot(x-b.position.x,z-b.position.z));
}
console.log({lowest,maxError,end:b.position.toArray()});assert.ok(lowest< -4.1&&Math.abs(b.position.y)<.05&&maxError<.06);w.dispose();
