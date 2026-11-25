/**
 * The four-tower finale (master roadmap Workstream 5, gate `check-finale`).
 *
 * Structural: one instanced window family, additive beams between the four
 * courtyard corners, one atrium ring, no lights, no shadows, and no beam that
 * converges on the courtyard centre.
 *
 * Timeline: towers light in B01→B04 order, each bottom-up; the mesh links and the
 * ring follow; the show is complete before the credits.
 *
 * Wiring: the ending starts the show and `mus_finale` exactly once on the release
 * beat, and a reload after the credits restores the lit campus from the stage.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import {FINALE_TIMELINE,createFinaleLightShow} from '../src/campaign/finaleLightShow';

const scene=new T.Scene();
const show=createFinaleLightShow(scene);
const root=scene.getObjectByName('Finale_lightshow')!;
assert.equal(root,show.root,'the show roots itself in the scene');
const windows=scene.getObjectByName('Finale_windows') as T.InstancedMesh;
assert.ok(windows instanceof T.InstancedMesh&&windows.count>1400,`one instanced window family, got ${windows.count}`);
const ring=scene.getObjectByName('Finale_atrium_ring') as T.Mesh;
assert.ok(ring,'the atrium ring exists');
const links=[...Array(6)].map((_,i)=>scene.getObjectByName('Finale_link-'+i) as T.Mesh);
assert.ok(links.every(Boolean),'all six tower-to-tower links exist');

// No lights, no shadows: the show must not change the level's lighting budget.
assert.equal(scene.children.filter(child=>child instanceof T.Light).length,0,'the show adds no lights');
scene.traverse(object=>{
 if(object instanceof T.Mesh)assert.equal(object.castShadow,false,`${object.name} must not cast a shadow`);
});
const materials=new Set<T.Material>();
scene.traverse(object=>{
 if(object instanceof T.Mesh)materials.add(object.material as T.Material);
});
for(const material of materials)assert.equal((material as T.MeshBasicMaterial).blending,T.AdditiveBlending,'every finale material is additive');

// No vertical beam and no central node: each link is horizontal-ish and the only
// object at the courtyard centre is the flat ring.
const up=new T.Vector3(0,1,0),direction=new T.Vector3();
for(const link of links){
 direction.set(0,1,0).applyQuaternion(link.quaternion);
 assert.ok(Math.abs(direction.y)<.35,`${link.name} must not be a central vertical beam (y component ${direction.y.toFixed(2)})`);
 assert.ok(link.position.y>66.15+2,`${link.name} clears the roofs of the towers it joins`);
}
assert.ok(Math.abs(links[4].position.y-links[5].position.y)>4,'the two diagonals sit at different heights, so they never meet at one point');
ring.updateMatrixWorld(true);
// A torus lies in its local XY plane, so its local +Z axis is the ring's normal;
// for the ring to be flat that normal must point at the sky.
const ringNormal=new T.Vector3(0,0,1).applyQuaternion(ring.quaternion);
assert.ok(Math.abs(ringNormal.y)>.99,'the atrium ring lies flat, not as a pillar');
assert.ok(Math.hypot(ring.position.x,ring.position.z-36)<1,'the ring sits on the courtyard centre');

// Read what is actually lit from the instance colours, not from the reported state.
const matrix=new T.Matrix4(),colour=new T.Color(),position=new T.Vector3();
function lit(){
 const out:{x:number;y:number;z:number}[]=[];
 for(let i=0;i<windows.count;i++){
  windows.getMatrixAt(i,matrix);windows.getColorAt(i,colour);
  if(colour.r+colour.g+colour.b<=1e-4)continue;
  position.setFromMatrixPosition(matrix);out.push({x:position.x,y:position.y,z:position.z});
 }
 return out;
}
const firstTowerHeight=79.6;
show.start();
show.seek(.6);
let state=show.state();
assert.equal(state.towersActive,1,'only B01 has started at 0.6 s');
assert.ok(state.towers[0].lit>0,'B01 has lit windows');
assert.deepEqual(state.towers.slice(1).map(t=>t.lit),[0,0,0],'B02–B04 are still dark');
assert.equal(state.linksLit,0,'no link before the mesh beat');
const early=lit();
assert.equal(early.length,state.windowsLit,'the instance colours agree with the state');
const earlyMaxY=Math.max(...early.map(w=>w.y));
assert.ok(earlyMaxY<(7+(firstTowerHeight-5.2))/2,`B01 lights bottom-up: the lit rows stop at y=${earlyMaxY.toFixed(1)}`);
assert.ok(early.every(w=>w.x>=-88.2&&w.x<=-27.6&&w.z>=-25&&w.z<=21.2),'the lit quads sit on B01\'s façades');
// Every face of every tower lights, because the ending plays outside the courtyard.
assert.ok(early.some(w=>Math.abs(w.x+87.87)<.2),'B01 west face is lit');
assert.ok(early.some(w=>Math.abs(w.x+28.13)<.2),'B01 east face is lit');
assert.ok(early.some(w=>Math.abs(w.z+24.62)<.2),'B01 north face is lit');
assert.ok(early.some(w=>Math.abs(w.z-20.62)<.2),'B01 south face is lit');

show.seek(1);
state=show.state();
assert.ok(state.towers[0].lit>state.towers[1].lit&&state.towers[1].lit>0,'the tower order is B01 then B02');
assert.equal(state.towers[2].lit+state.towers[3].lit,0,'B03 and B04 still wait their turn');

show.seek(3.2);
state=show.state();
assert.equal(state.towersActive,4,'all four towers are lit by 3.2 s');
assert.ok(state.windowsLit>state.windowsTotal*.8,`the last rows are still fading in (${state.windowsLit}/${state.windowsTotal})`);

show.seek(4.2);
state=show.state();
assert.equal(state.windowsLit,state.windowsTotal,'every window is on at 4.2 s');
assert.ok(state.linksLit>=3&&state.linksLit<6,`the mesh is mid-way at 4.2 s (${state.linksLit} links)`);
assert.ok(state.ringScale>0,'the atrium ring has started to expand');

show.seek(FINALE_TIMELINE.total);
state=show.state();
assert.equal(state.complete,true,'the show completes');
assert.equal(state.windowsLit,state.windowsTotal,'the whole campus is lit');
assert.equal(state.linksLit,6,'the mesh is complete');
assert.ok(Math.abs(state.ringScale-1)<1e-9,'the ring has reached the far courtyard wall');

show.dispose();
assert.equal(root.parent,null,'dispose detaches the show');

// Regression, 2026-11-26: the rendered towers stand proud of the authored
// envelopes (B01 is 2.8 m deeper, B04 5.8 m wider), and a window quad placed on
// the authored plane is buried inside the façade, where the depth test hides it.
// Given a shell that big, every B01 quad must still sit outside it.
const shellScene=new T.Scene();
const shell=new T.Group();shell.name='B01';
const shellMesh=new T.Mesh(new T.BoxGeometry(80,90,70),new T.MeshBasicMaterial());
shellMesh.position.set(-58,45,-2);shell.add(shellMesh);shellScene.add(shell);
const shellShow=createFinaleLightShow(shellScene);
const shellWindows=shellScene.getObjectByName('Finale_windows') as T.InstancedMesh;
const b01Windows=shellShow.state().towers[0].total;
const sm=new T.Matrix4(),sv=new T.Vector3();
let buried=0;
for(let i=0;i<b01Windows;i++){
 shellWindows.getMatrixAt(i,sm);sv.setFromMatrixPosition(sm);
 const clear=sv.x<-98.1||sv.x>-17.9||sv.z<-37.1||sv.z>33.1;
 if(!clear)buried++;
}
assert.equal(buried,0,`no B01 window may sit inside the built shell (${buried} buried)`);
shellShow.dispose();

// The ending wires the show and its cue to the release beat, once.
const data=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,String(v));},removeItem:(k:string)=>{data.delete(k);},get length(){return data.size;},key:(i:number)=>[...data.keys()][i]??null,clear:()=>data.clear()},configurable:true,writable:true});
const {createEndingChapter}=await import('../src/campaign/endingChapter');
const {loadWorldThreat,markLionDefeated,markPowerCut,sealWorld}=await import('../src/gameplay/worldThreat');
type CampaignStage=import('../src/campaign/state').CampaignStage;
const dt=1/60;

function ending(stage:CampaignStage){
 let current=stage,time=0;
 const lightScene=new T.Scene(),music:string[]=[];
 const settled={then(ok?:()=>void){ok?.();return settled;},catch(){return settled;}} as unknown as Promise<void>;
 const atmosphere={release(){},restoreSealed(){},reset(){},startIncident(){},update(){},
  snapshot(){return{phase:'day',curtainVisible:false,releasing:false};}};
 const explorer={pause(){},game:{body:{position:{x:-45.9,z:-117}},yaw:0,cameraLift:0}};
 const ctx={stage:()=>current,emit:(event:string)=>{if(event==='ending_finished')current='done';return true;},deviceId:()=>'mac',
  notify(){},atmosphere:()=>atmosphere,cardSettled:()=>settled,explorer,
  music:(name:string,options?:{loop?:boolean})=>{music.push(options?.loop?name+':loop':name);},stopMusic(){},
  scene:lightScene,root:()=>null,openPanel(){},closePanel(){},resume(){},card:()=>settled} as unknown as import('../src/campaign/types').ChapterContext;
 const chapter=createEndingChapter();chapter.attach(ctx);
 return{chapter,scene:lightScene,music,explorer,advance(seconds:number){for(let i=0;i<Math.round(seconds/dt);i++){time+=dt;chapter.update(dt);}},get stage(){return current;}};
}

data.clear();sealWorld();markLionDefeated();markPowerCut();
const fresh=ending('ending');
const yaw=fresh.explorer.game.yaw,forward={x:-Math.sin(yaw),z:-Math.cos(yaw)};
const toCampus={x:0-(-45.9),z:36-(-117)},length=Math.hypot(toCampus.x,toCampus.z);
assert.ok((forward.x*toCampus.x+forward.z*toCampus.z)/length>.99,'the ending turns the first-person view toward the four towers');
fresh.advance(3.2+dt);
assert.deepEqual(fresh.music,[],'nothing before the Mac sequence');
assert.equal(fresh.explorer.game.cameraLift,0,'the view is still at eye level before the crane');
fresh.advance(8.05);
assert.deepEqual(fresh.music,['mus_finale'],'the release beat starts the finale cue once, as a one-shot');
// The run ends behind the three 25.5 m sports halls; at eye level not one window of
// the show is on screen, so the ending lifts the view over their roofs before the
// Mac fades and the towers light. Without this the whole finale plays off-screen.
const hallRoof=25.51;
assert.ok(fresh.explorer.game.cameraLift>hallRoof+4,`the view clears the sports hall roofs before the release (${fresh.explorer.game.cameraLift.toFixed(1)} m)`);
assert.equal(loadWorldThreat().phase,'purged','the same beat purges the record before the barrier lifts');
const afterRelease=(fresh.chapter.debug as Record<string,(...args:never[])=>unknown>).finale() as ReturnType<typeof show.state>;
assert.ok(afterRelease&&afterRelease.running,'the show is running at the release beat');
fresh.advance(5.6);
const done=(fresh.chapter.debug as Record<string,(...args:never[])=>unknown>).finale() as ReturnType<typeof show.state>;
assert.equal(done.complete,true,'the show finishes before the credits');
assert.equal(fresh.music.filter(name=>name==='mus_finale').length,1,'the finale cue is never restarted');
const sceneRoot=fresh.scene.getObjectByName('Finale_lightshow');
assert.ok(sceneRoot,'the ending added the show to the live scene');

const reloaded=ending('done');
const restored=(reloaded.chapter.debug as Record<string,(...args:never[])=>unknown>).finale() as ReturnType<typeof show.state>;
assert.equal(restored.complete,true,'a reload after the credits restores the lit campus from the ending stage');
assert.equal(restored.windowsLit,restored.windowsTotal,'every window is lit after the reload');

console.log(`PASS finale light show: ${windows.count} instanced windows, 6 tower links, atrium ring, no lights/shadows, B01→B04 bottom-up, tests done before the credits, and ${FINALE_TIMELINE.total} s long`);
