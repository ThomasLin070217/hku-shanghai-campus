import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
async function main(){
const root=process.env.CAMPUS_ROOT??process.cwd();
const load=(relative:string)=>import(pathToFileURL(path.join(root,relative)).href);
const T=await load('node_modules/three/build/three.module.js');
const {createNavigation}=await load('src/exploration/navigation.ts');
const {CharacterPhysics}=await load('src/exploration/physics.ts');
const {BUILDINGS,SITE}=await load('src/model/campusParameters.ts');
const nav=createNavigation(BUILDINGS,SITE),checks:any[]=[],trace:any[]=[];
const threshold=Math.cos(35*Math.PI/180),range=12;
function visible(robot:T.Vector3,heading:T.Vector3,player:T.Vector3){const eye=robot.clone().add(new T.Vector3(0,1.5,0)),target=player.clone().add(new T.Vector3(0,1.2,0)),offset=target.clone().sub(eye),distance=offset.length();if(distance>range||distance<.001)return false;const horizontal=player.clone().sub(robot);horizontal.y=0;if(horizontal.length()>.001&&heading.dot(horizontal.normalize())<threshold)return false;const ray=new T.Raycaster(eye,offset.normalize(),.01,distance-.05);return ray.intersectObjects(nav.meshes,false).length===0;}
const forward=new T.Vector3(0,0,-1),openRobot=new T.Vector3(24,nav.support(24,-48,0)??0,-48);
assert.equal(visible(openRobot,forward,new T.Vector3(24,0,-55)),true);checks.push({name:'unoccluded player inside cone detected',passed:true});
assert.equal(visible(openRobot,forward,new T.Vector3(24,0,-40)),false);checks.push({name:'player behind robot not detected',passed:true});
assert.equal(visible(new T.Vector3(58,0,-48),forward,new T.Vector3(58,0,-60)),false);checks.push({name:'B05 closed-exterior blocks sight ray',passed:true});
class Fixture{
 body=new CharacterPhysics(nav);heading=forward.clone();state:'patrol'|'chase'|'search'|'failed'='patrol';lastSeen:T.Vector3|null=null;searchSeconds=0;clock=0;captured=false;
 constructor(){this.body.position.copy(openRobot);}
 snapshot(){return{state:this.state,position:this.body.position.toArray(),lastSeen:this.lastSeen?.toArray()??null,searchSeconds:this.searchSeconds,clock:this.clock,captured:this.captured};}
 tick(dt:number,player:T.Vector3,paused=false){if(paused||this.state==='failed')return;this.clock+=dt;const seen=visible(this.body.position,this.heading,player);
 if(seen){this.lastSeen=player.clone();this.state='chase';this.searchSeconds=0;if(this.body.position.distanceTo(player)<=.65){this.state='failed';this.captured=true;return;}}
 if(this.state==='chase'&&this.lastSeen){const delta=this.lastSeen.clone().sub(this.body.position);delta.y=0;if(delta.length()<=.12){if(!seen){this.state='search';this.searchSeconds=0;}}else{this.heading.copy(delta).normalize();this.body.step(dt,{forward:.5,right:0,sprint:false},Math.atan2(-delta.x,-delta.z),false);}}
 else if(this.state==='search'){this.searchSeconds+=dt;if(this.searchSeconds>=1){this.state='patrol';this.lastSeen=null;}}
 trace.push({...this.snapshot(),visible:seen});
 }
}
const npc=new Fixture(),player=new T.Vector3(24,0,-55);npc.tick(.1,player);assert.equal(npc.state,'chase');assert.equal(npc.captured,false);assert.ok(npc.body.position.z<openRobot.z);checks.push({name:'patrol to chase on sight, movement uses CharacterPhysics and no failure on detection',passed:true});
const frozen=npc.snapshot();npc.tick(8,player,true);assert.deepEqual(npc.snapshot(),frozen);checks.push({name:'paused tick advances neither actor nor clocks',passed:true});
const remembered=npc.lastSeen!.toArray();let reachedSearch=false,returnedPatrol=false;for(let i=0;i<150;i++){const hidden=new T.Vector3(24+(i%2)*2,0,-20-(i%3));const before=npc.lastSeen?.toArray();npc.tick(.1,hidden);if(npc.state==='chase'||npc.state==='search'){assert.deepEqual(npc.lastSeen?.toArray(),remembered);assert.deepEqual(before,remembered);}if(npc.state==='search')reachedSearch=true;if(reachedSearch&&npc.state==='patrol'){returnedPatrol=true;break;}}
assert.equal(reachedSearch,true);assert.equal(returnedPatrol,true);assert.equal(npc.captured,false);checks.push({name:'hidden player movement never updates lastSeen; reach remembered position, search then patrol',passed:true});
const caught=new Fixture();caught.tick(.1,new T.Vector3(24,0,-48.5));assert.equal(caught.state,'failed');assert.equal(caught.captured,true);checks.push({name:'close capture causes failure',passed:true});
nav.dispose();const output={scope:'Isolated offline feasibility fixture only, not production robot AI or playthrough',dependencies:'Current Navigation meshes and CharacterPhysics',parameters:{range,halfConeDegrees:35,searchSeconds:1,captureRadius:.65,intentForward:.5},checks,trace};fs.writeFileSync(process.env.CAMPUS_PROBE_OUTPUT??new URL('../robot-results.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify({checks,traceFrames:trace.length,final:npc.snapshot()},null,2));

}
main().catch(error=>{console.error(error);process.exitCode=1;});
