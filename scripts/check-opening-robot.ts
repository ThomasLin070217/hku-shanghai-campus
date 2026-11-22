/**
 * Agent C acceptance check: the opening red-eye security robot.
 *
 * Drives src/opening/robot.ts against the real opening Navigation (split doorways, B05/B06 cavities)
 * and the real CharacterPhysics integrator. Nothing is stubbed: every assertion is about behaviour the
 * module produced while stepping, and every position it reached was produced by physics.
 * Offline only: no browser, no AI control, no player act()/acquireControl path.
 *
 *   ./node_modules/.bin/tsx scripts/check-opening-robot.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {EXPLORATION as C} from '../src/exploration/config';
import {OPENING as O} from '../src/opening/spatialLayout';
import {createOpeningRobot, createOpeningRobotAssets, createOpeningRobotBlackboard, openingRobotLineClear, ROBOT, type OpeningRobot} from '../src/opening/robot';

const world=createNavigation(BUILDINGS,SITE,true);
const DT=1/60;
const wallZ=O.b5.z1-0.1, doorLo=O.b5.door-O.b5.doorWidth/2, doorHi=O.b5.door+O.b5.doorWidth/2;
const results:{name:string;passed:true;detail?:unknown}[]=[];
const pass=(name:string,detail?:unknown)=>{results.push({name,passed:true,detail});console.log(`PASS  ${name}${detail===undefined?'':'  '+JSON.stringify(detail)}`);};
/** Feet position on the real navigation floor, so no test ever floats a target. */
const ground=(x:number,z:number,lift=0)=>new T.Vector3(x,(world.support(x,z,C.maxStep)??0)+lift,z);
const headingOf=(dx:number,dz:number)=>Math.atan2(-dx,-dz);
const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const round=(v:number)=>Math.round(v*100)/100;

interface Stats {
 seconds:number;
 transitions:string[];
 states:Record<string,number>;
 crossings:{x:number;at:string}[];
 caughtAtSecond:number|null;
 grindWithoutProgress:number;
 maxTickMove:number;
 minGapTo:number|null;
 patrolPoints:number[];
 lastWarning:number;
 maxWarning:number;
}

/**
 * Steps the robot and enforces the shared invariants every tick: never inside a solid, always on real
 * ground, no teleport-like jump, warning normalised, caught only inside the caught state, wall contact
 * never turns into grinding, and any crossing of the Building 5 wall plane happens in the door opening.
 */
function drive(robot:OpeningRobot,options:{
 seconds:number;
 player:T.Vector3|((t:number)=>T.Vector3);
 active?:boolean;
 paused?:boolean;
 watch?:T.Vector3;
 visit?:readonly (readonly number[])[];
 stop?:(t:number,robot:OpeningRobot)=>boolean;
}):Stats{
 const stats:Stats={seconds:0,transitions:[],states:{},crossings:[],caughtAtSecond:null,grindWithoutProgress:0,maxTickMove:0,minGapTo:null,patrolPoints:[],lastWarning:0,maxWarning:0};
 const visited=new Set<number>();
 let previous=robot.state,grindStart:T.Vector3|null=null,grindSeconds=0;
 const ticks=Math.ceil(options.seconds/DT);
 for(let i=0;i<ticks;i++){
  const t=(i+1)*DT;
  const player=typeof options.player==='function'?options.player(t):options.player;
  const before=robot.position.clone();
  const result=robot.update(DT,player,options.active??true,options.paused??false);
  const position=robot.position,d=robot.diagnostics;
  stats.seconds=t;
  stats.states[d.state]=(stats.states[d.state]??0)+1;
  if(d.state!==previous){stats.transitions.push(`${t.toFixed(2)}s ${previous}->${d.state}`);previous=d.state;}
  stats.lastWarning=result.warning;
  stats.maxWarning=Math.max(stats.maxWarning,result.warning);
  assert.ok(result.warning>=0&&result.warning<=1,`warning left 0..1 at ${t.toFixed(2)}s: ${result.warning}`);
  assert.equal(result.state,d.state,'update result disagreed with diagnostics');
  assert.equal(result.caught,d.caught,'update result caught disagreed with diagnostics');
  assert.equal(result.caught,d.state==='caught',`caught reported outside the caught state at ${t.toFixed(2)}s`);
  assert.equal(world.blocked(position.x,position.z,position.y),false,`robot overlapped a solid at [${position.toArray().map(round)}] (${t.toFixed(2)}s, ${d.state})`);
  const floor=world.support(position.x,position.z,position.y+C.maxStep);
  assert.notEqual(floor,null,`robot left the walkable site at [${position.toArray().map(round)}]`);
  assert.ok(floor===null||Math.abs(position.y-floor)<C.maxStep+.02,`robot floated above its support at [${position.toArray().map(round)}]`);
  const step=Math.hypot(position.x-before.x,position.z-before.z);
  stats.maxTickMove=Math.max(stats.maxTickMove,step);
  assert.ok(step<=ROBOT.chaseSpeed*DT*2+.02,`teleport-like step ${step.toFixed(3)}m at ${t.toFixed(2)}s`);
  if((before.z-wallZ)*(position.z-wallZ)<0){
   const f=(wallZ-before.z)/(position.z-before.z),x=before.x+(position.x-before.x)*f;
   stats.crossings.push({x:round(x),at:`${t.toFixed(2)}s ${d.state}`});
   assert.ok(x>=doorLo&&x<=doorHi,`crossed the Building 5 wall plane at x=${x.toFixed(2)}, outside the published door ${doorLo}..${doorHi} (${t.toFixed(2)}s, ${d.state})`);
  }
  // Wall contact is only meaningful when it also stops progress; that combination must never persist.
  if(d.contacts.includes('wall')){
   if(!grindStart){grindStart=before.clone();grindSeconds=0;}
   grindSeconds+=DT;
   if(grindSeconds>stats.grindWithoutProgress&&grindStart.distanceTo(position)<=0.25)stats.grindWithoutProgress=grindSeconds;
   assert.ok(grindSeconds<=ROBOT.stall*2||grindStart.distanceTo(position)>0.25,`ground against a wall for ${grindSeconds.toFixed(2)}s at [${position.toArray().map(round)}] (${d.state})`);
  }else{grindStart=null;grindSeconds=0;}
  if(d.caught&&stats.caughtAtSecond===null)stats.caughtAtSecond=t;
  if(options.watch)stats.minGapTo=Math.min(stats.minGapTo??Number.POSITIVE_INFINITY,Math.hypot(options.watch.x-position.x,options.watch.z-position.z));
  (options.visit??O.patrol).forEach((p,index)=>{if(Math.hypot(p[0]-position.x,p[2]-position.z)<1.2)visited.add(index);});
  if(options.stop?.(t,robot))break;
 }
 stats.patrolPoints=[...visited].sort();
 return stats;
}

const fresh=()=>{const robot=createOpeningRobot(world);robot.reset();return robot;};
/** Sector + range test without cover, so a negative result can be proven meaningful. */
function inSectorAndRange(robot:OpeningRobot,player:T.Vector3){
 const d=robot.diagnostics,scan=d.heading+d.headOffset;
 const dx=player.x-d.position[0],dz=player.z-d.position[2];
 if(Math.hypot(dx,dz)>ROBOT.range)return false;
 return Math.abs(wrapAngle(headingOf(dx,dz)-scan))<=ROBOT.halfAngle;
}

/** Gait values from .superpowers/sdd/2026-11-22-fidelity-round/task-3-brief.md (3B), restated here on purpose. */
const BRIEF_GAIT={thighSwing:0.42,kneeLift:0.55,hipRoll:0.07,bob:0.02,searchPitch:-0.12};
const LEGS=['fl','fr','rl','rr'] as const;
interface LegPose{thigh:number;roll:number;knee:number}
/** Joint angles as rendered: the hip group pitches and rolls, the knee pivot holding the shank bends. */
function legPose(robot:OpeningRobot):LegPose[]{
 return LEGS.map(key=>{
  const leg=robot.root.getObjectByName('robot-leg-'+key)!;
  const knee=leg.getObjectByName('robot-leg-lower')!.parent!;
  return{thigh:leg.rotation.x,roll:leg.rotation.z,knee:knee.rotation.x};
 });
}

// ---------------------------------------------------------------- 1. eye ray matches the wall geometry
{
 const throughDoor=openingRobotLineClear(world,new T.Vector3(O.b5.door,1.05,O.b5.z1+2.5),new T.Vector3(O.b5.door,1.15,O.b5.z1-2.5));
 const throughFrontWall=openingRobotLineClear(world,new T.Vector3(O.b5.door,1.05,O.b5.z1+2.5),new T.Vector3(O.b5.door+4,1.15,O.b5.z1-1));
 const throughSideWall=openingRobotLineClear(world,new T.Vector3(O.b5.x1-2,1.05,-60),new T.Vector3(O.b5.x0-4,1.15,-60));
 assert.equal(throughDoor,true,'the door gap must stay a legal sight line');
 assert.equal(throughFrontWall,false,'a closed exterior wall must block the eye ray');
 assert.equal(throughSideWall,false,'the Building 5 side wall must block the eye ray');
 pass('eye-to-chest line matches the door opening and the closed walls',{throughDoor,throughFrontWall,throughSideWall});
}

// ---------------------------------------------------------------- 2. detection confirms into chase, never failure
{
 const robot=fresh();
 const player=ground(O.patrol[1][0],O.patrol[1][2]);
 assert.ok(player.distanceTo(robot.position)<ROBOT.range,'scenario: the target starts inside the range window and dead ahead');
 const scanning=drive(robot,{seconds:0.45,player});
 assert.ok(scanning.states.scanning!==undefined,'a visible target enters the scanning state');
 assert.equal(scanning.caughtAtSecond,null,'being seen must never be a failure');
 assert.ok(scanning.maxWarning>0,'scanning raises the warning meter');
 const chasing=drive(robot,{seconds:0.6,player,stop:(_t,r)=>r.state==='chase'});
 assert.equal(robot.state,'chase','sustained visibility confirms into chase');
 assert.equal(robot.diagnostics.caught,false,'entering chase is not capture');
 assert.ok(Math.hypot(player.x-robot.position.x,player.z-robot.position.z)>1,'the robot has not reached the player yet');
 assert.ok(chasing.lastWarning>scanning.lastWarning,`chase warns louder than scanning (${scanning.lastWarning} -> ${chasing.lastWarning})`);
 pass('confirmed detection enters chase with a louder warning and no instant failure',{transitions:[...scanning.transitions,...chasing.transitions],gapToPlayer:round(Math.hypot(player.x-robot.position.x,player.z-robot.position.z))});
 robot.dispose();
}

// ---------------------------------------------------------------- 3. astern / out of range / behind cover stays invisible
{
 const behind=fresh();
 const astern=ground(66,-48);
 assert.ok(Math.hypot(astern.x-behind.position.x,astern.z-behind.position.z)<ROBOT.range,'scenario: the astern target is inside range');
 const asternStats=drive(behind,{seconds:3,player:astern});
 assert.equal(asternStats.states.scanning,undefined,'a target outside the eye sector is never seen');
 assert.equal(asternStats.states.chase,undefined);
 assert.equal(behind.diagnostics.lastSeen,null,'nothing remembered when nothing was seen');
 pass('target astern but inside range stays undetected',{states:asternStats.states});
 behind.dispose();

 const distant=fresh();
 const farPlayer=ground(O.patrol[1][0]-8,O.patrol[1][2]);
 const farStats=drive(distant,{seconds:1.2,player:farPlayer});
 assert.equal(farStats.states.scanning,undefined,'beyond the range window nothing is detected');
 assert.equal(distant.diagnostics.lastSeen,null);
 pass('target beyond the detection range stays undetected',{startDistance:round(Math.hypot(farPlayer.x-O.patrol[0][0],farPlayer.z-O.patrol[0][2]))});
 distant.dispose();

 // Inside the sector and inside range, but the closed front wall is in between: no detection at all.
 const covered=fresh();
 const coveredPlayer=ground(62,-55.4);
 let seenThroughWall=false,provenInSectorAndRange=false,wallBetween=false,ticks=0;
 while(covered.position.z>O.b5.z1+0.3&&ticks++<1500){
  const before=covered.position.clone();
  covered.update(DT,coveredPlayer,true,false);
  const d=covered.diagnostics;
  assert.equal(world.blocked(d.position[0],d.position[2],d.position[1]),false,'the covered-target run never entered a solid');
  if(d.state==='chase'||d.state==='caught')seenThroughWall=true;
  if(inSectorAndRange(covered,coveredPlayer)){
   provenInSectorAndRange=true;
   if(!d.visible)wallBetween=true;
  }
 }
 assert.equal(seenThroughWall,false,'the robot may not detect or chase through a closed wall');
 assert.equal(covered.diagnostics.caught,false,'a wall-blocked player cannot be captured');
 assert.ok(provenInSectorAndRange,'the test must actually place the target inside sector and range');
 assert.ok(wallBetween,'and prove the wall, not the geometry of the scenario, blocked the eye ray');
 pass('target in sector and range but behind the Building 5 wall is neither tracked nor caught',{ticksOfOutsideApproach:ticks,sectorAndRange:provenInSectorAndRange,occluded:wallBetween});
 covered.dispose();
}

// ---------------------------------------------------------------- 4. losing sight freezes lastSeen, then search, then patrol
{
 const robot=fresh();
 const remembered=ground(O.patrol[1][0],O.patrol[1][2]);
 drive(robot,{seconds:1.1,player:remembered,stop:(_t,r)=>r.state==='chase'});
 assert.equal(robot.state,'chase','scenario: chase established');
 const lastSeen=robot.diagnostics.lastSeen;
 assert.notEqual(lastSeen,null,'a confirmed target is remembered');
 // The player breaks line of sight deep inside Building 5, off the door axis.
 const hidden=ground(64,-61);
 const lost=drive(robot,{seconds:2,player:hidden});
 assert.deepEqual(robot.diagnostics.lastSeen,lastSeen,'lastSeen must not follow the hidden live position');
 assert.equal(robot.state,'search','losing sight turns the chase into a search of the remembered position');
 assert.equal(robot.diagnostics.caught,false,'an escaped player is not caught');
 // The head dips to look at the ground around the remembered spot while searching near it.
 const turret=robot.root.getObjectByName('opening-security-robot-turret')!;
 let searchPitch=0;
 const recovered=drive(robot,{seconds:45,player:hidden,stop:(_t,r)=>{
  const d=r.diagnostics;
  if(d.state==='search'&&d.lastSeen&&Math.hypot(d.lastSeen[0]-d.position[0],d.lastSeen[2]-d.position[2])<1)searchPitch=Math.min(searchPitch,turret.rotation.x);
  assert.ok(turret.rotation.x>=BRIEF_GAIT.searchPitch-1e-6,`the head never dips below ${BRIEF_GAIT.searchPitch} rad (${turret.rotation.x.toFixed(3)})`);
  return r.state==='patrol';
 }});
 assert.ok(searchPitch<=BRIEF_GAIT.searchPitch+0.01,`searching near the remembered spot dips the head to ${BRIEF_GAIT.searchPitch} rad (${searchPitch.toFixed(3)})`);
 assert.equal(robot.state,'patrol','after searching the remembered spot the robot returns to patrol');
 assert.equal(recovered.caughtAtSecond,null,'no capture while the player stayed behind cover');
 assert.ok(robot.diagnostics.searchClock>=ROBOT.searchSeconds-.6,`the search lasted about ${ROBOT.searchSeconds}s (${robot.diagnostics.searchClock.toFixed(2)}s)`);
 assert.ok(Math.hypot(lastSeen![0]-robot.position.x,lastSeen![2]-robot.position.z)<2.5,'the search ended at the remembered position');
 const gapToHidden=Math.hypot(hidden.x-robot.position.x,hidden.z-robot.position.z);
 assert.ok(gapToHidden>3,'the robot never walked to the hidden live position');
 drive(robot,{seconds:1.5,player:hidden});
 assert.ok(Math.abs(turret.rotation.x)<0.01,`back on patrol the head levels out again (${turret.rotation.x.toFixed(3)})`);
 pass('hidden player freezes lastSeen; the robot searches that point then resumes patrol',
  {transitions:[...lost.transitions,...recovered.transitions],lastSeen:lastSeen?.map(round),searchSeconds:round(robot.diagnostics.searchClock),distanceToHiddenLiveTarget:round(gapToHidden),searchHeadPitch:round(searchPitch)});
 robot.dispose();
}

// ---------------------------------------------------------------- 5. capture needs reach + height; reset repeats the encounter
{
 const robot=fresh();
 const player=ground(O.patrol[1][0],O.patrol[1][2]);
 const caught=drive(robot,{seconds:25,player,stop:(_t,r)=>r.state==='caught'});
 assert.equal(caught.caughtAtSecond!==null,true,'a stationary player in the open is eventually reached');
 assert.equal(robot.state,'caught');
 assert.equal(robot.warning,1,'capture sets the warning meter to 1');
 const d=robot.diagnostics;
 const reach=Math.hypot(player.x-d.position[0],player.z-d.position[2]);
 assert.ok(reach<=ROBOT.capture+.12,`capture only at physical reach (gap ${reach.toFixed(2)}m)`);
 const frozen=d.position.join(',');
 const held=drive(robot,{seconds:2,player:ground(player.x,player.z,3)});
 assert.equal(robot.diagnostics.position.join(','),frozen,'after capture the robot holds position');
 assert.equal(held.states.chase,undefined,'the caught state does not resume hunting');
 pass('capture requires physical reach and the encounter holds afterwards',{caughtAtSecond:caught.caughtAtSecond,gapAtCapture:round(reach)});

 // Same footprint, wrong height difference: it must still chase but never capture.
 const raised=fresh();
 const raisedPlayer=ground(O.patrol[1][0],O.patrol[1][2],ROBOT.captureRise+.6);
 const raisedStats=drive(raised,{seconds:25,player:raisedPlayer,watch:raisedPlayer});
 assert.equal(raisedStats.caughtAtSecond,null,'a rise beyond captureRise never counts as capture');
 assert.ok((raisedStats.minGapTo??Number.POSITIVE_INFINITY)<=ROBOT.capture+.12,`it did close the horizontal gap (${raisedStats.minGapTo?.toFixed(2)}m)`);
 assert.ok(raisedStats.states.chase!==undefined,'and stayed in chase while doing so');
 pass('height rule blocks capture even while standing on the target',{minHorizontalGap:round(raisedStats.minGapTo??-1),states:raisedStats.states});

 raised.reset();
 assert.equal(raised.state,'patrol','reset restores patrol');
 assert.equal(raised.diagnostics.caught,false,'reset clears the capture');
 assert.equal(raised.diagnostics.lastSeen,null,'reset forgets the remembered position');
 assert.ok(Math.hypot(O.patrol[0][0]-raised.position.x,O.patrol[0][2]-raised.position.z)<.01,'reset returns the robot to the first patrol point');
 const again=drive(raised,{seconds:30,player:ground(O.patrol[1][0],O.patrol[1][2]),stop:(_t,r)=>r.state==='caught'});
 assert.equal(again.caughtAtSecond!==null,true,'the encounter is repeatable after reset');
 pass('reset restores the initial patrol and the encounter can happen again',{firstCaughtAt:caught.caughtAtSecond,secondCaughtAt:again.caughtAtSecond});
 robot.dispose();raised.dispose();
}

// ---------------------------------------------------------------- 6. patrol polyline reaches every point through the door
{
 const robot=fresh();
 const away=ground(24,-25);
 const stats=drive(robot,{seconds:220,player:away});
 assert.equal(stats.caughtAtSecond,null,'patrolling without a sighting never captures');
 assert.deepEqual(stats.patrolPoints,[0,1,2,3],`the cycle visited all ${O.patrol.length} patrol points, reached ${stats.patrolPoints}`);
 assert.ok(stats.crossings.length>=2,'the cycle crossed the Building 5 wall plane at least twice (in and out)');
 assert.ok(stats.grindWithoutProgress<=ROBOT.stall*2,`longest no-progress wall contact ${stats.grindWithoutProgress.toFixed(2)}s stayed inside the stall budget`);
 assert.equal(graphConnected(robot),true,'every patrol point is reachable through verified edges only');
 const rejected=robot.diagnostics.graph.filter(e=>!e.walked);
 assert.ok(rejected.length>=1,'the physics walk must reject at least one wall-crossing candidate edge');
 pass('patrol cycle routes through the Building 5 door, never through a wall, never grinding the wall',
  {doorCrossings:stats.crossings,longestNoProgressContactSeconds:round(stats.grindWithoutProgress),states:stats.states,rejectedEdges:rejected.map(e=>({from:robot.diagnostics.graphNodes[e.from],to:robot.diagnostics.graphNodes[e.to],seconds:e.seconds})),verifiedEdges:robot.diagnostics.graph.filter(e=>e.walked).map(e=>({from:robot.diagnostics.graphNodes[e.from][2],to:robot.diagnostics.graphNodes[e.to][2],seconds:e.seconds}))});
 robot.dispose();
}

// ---------------------------------------------------------------- 7. paused, dt=0 and inactive are strictly read only
{
 const robot=fresh();
 const player=ground(O.patrol[1][0],O.patrol[1][2]);
 drive(robot,{seconds:1.1,player,stop:(_t,r)=>r.state==='chase'});
 assert.equal(robot.state,'chase','scenario: chase established before the freeze tests');
 const beforeState=JSON.stringify(robot.diagnostics);
 const beforeResult=robot.update(0,player,true,false);
 const beforePosition=robot.position.toArray().map(n=>round(n)).join(',');
 const seenBefore=robot.diagnostics.seenTime;
 for(let i=0;i<180;i++){
  assert.deepEqual(robot.update(0,player,true,false),beforeResult,'dt=0 read must return the current result');
  assert.deepEqual(robot.update(DT,player,true,true),beforeResult,'a paused tick must return the current result');
  assert.deepEqual(robot.update(1,player,true,true),beforeResult,'a paused large dt may not skip time');
 }
 assert.equal(JSON.stringify(robot.diagnostics),beforeState,'paused/dt=0 changed nothing: state, timers, lastSeen');
 assert.equal(robot.position.toArray().map(n=>round(n)).join(','),beforePosition,'paused/dt=0 never moved the robot');
 assert.equal(robot.diagnostics.seenTime,seenBefore,'the confirm timer does not advance while paused');
 // active=false hides the model and freezes it, even with the player standing inside it.
 const inside=robot.position.clone();
 for(let i=0;i<120;i++)assert.deepEqual(robot.update(DT,inside,false,false),beforeResult,'inactive ticks return the frozen result');
 assert.equal(robot.root.visible,false,'inactive hides the model');
 assert.equal(robot.diagnostics.caught,false,'inactive cannot capture, even with the player inside it');
 assert.equal(round(robot.position.distanceTo(inside)),0,'inactive does not move the robot');
 const resumed=robot.update(DT,player,true,false);
 assert.equal(resumed.state,'chase','the encounter resumes instead of restarting after a pause');
 assert.equal(robot.root.visible,true,'active shows the model again');
 drive(robot,{seconds:1,player});
 assert.ok(robot.diagnostics.seenTime>seenBefore,'the confirm timer resumes where it stopped');
 assert.ok(robot.position.distanceTo(inside)>0.01,'and the robot moves again');
 // A modal that pauses with the player adjacent must not fire the failure.
 for(let i=0;i<120;i++)assert.equal(robot.update(DT,robot.position.clone(),true,true).caught,false,'paused cannot capture');
 pass('paused, dt=0 and inactive calls are read-only and never reset the chase',{frozenResult:beforeResult,state:beforeState.slice(0,0)+JSON.parse(beforeState).state,resumedState:resumed.state});
 robot.dispose();
}

// ---------------------------------------------------------------- 8. quadruped model, polygon wedge, clean disposal
{
 const meshesBefore=world.meshes.length;
 const scene=new T.Scene();
 const robot=createOpeningRobot(world);
 scene.add(robot.root);
 // Standing pose straight after creation: the rig origin is the ground, so the feet touch y 0.
 const rig=robot.root.getObjectByName('opening-security-robot-rig') as T.Group;
 assert.ok(rig&&!(rig as unknown as T.Mesh).isMesh,'the body rig is a group');
 robot.root.updateMatrixWorld(true);
 // Vertex-precise bounds: a rotated part's loose bounding box would dip below its real lowest point.
 const standing=new T.Box3().setFromObject(rig,true);
 const feetLift=standing.min.y-robot.position.y;
 assert.ok(Math.abs(feetLift)<0.01,`the standing feet rest on the ground (lowest point ${feetLift.toFixed(3)}m above the body origin)`);
 drive(robot,{seconds:2,player:ground(O.patrol[1][0],O.patrol[1][2])});
 robot.root.updateMatrixWorld(true);
 assert.equal(world.meshes.length,meshesBefore,'the robot never joins the shared collision mesh list');
 const meshes:T.Mesh[]=[];
 robot.root.traverse(object=>{if((object as T.Mesh).isMesh)meshes.push(object as T.Mesh);});
 const shadowCasters=meshes.filter(m=>m.castShadow).length;   // in the shadow budget, before the inactive call below
 // T25 merged the shell boxes into two vertex-coloured meshes (body and head), plus the
 // always-separate band, eye, beacon and the animated scan sector. The quadruped adds four
 // articulated legs, each three small meshes on shared buffers, so the gait can bend them.
 assert.ok(meshes.length>=5,`a quadruped model built from merged parts, got ${meshes.length} meshes`);
 assert.equal(meshes.filter(m=>m.name==='robot-body').length,1,'the static chassis is batched into one robot-body mesh');
 assert.equal(meshes.filter(m=>m.name==='robot-head').length,1,'the sensor head is batched into one robot-head mesh');
 assert.ok(meshes.some(m=>m.name==='opening-robot-eye'),'red eye present');
 assert.ok(meshes.some(m=>m.name==='opening-robot-scan-sector'),'visible scan sector present');
 assert.equal(meshes.filter(m=>/health|hp|bar|weapon|drop|ammo|icon|glow_billboard/i.test(m.name)).length,0,'no health bar, weapon, drop or icon-like part');
 // Four legs: FL/FR at the front (-z), RL/RR at the rear; left is -x while the rig faces -z.
 const legLayout:Record<string,[number,number]>={fl:[-1,-1],fr:[1,-1],rl:[-1,1],rr:[1,1]};
 const legDetail:Record<string,unknown>={};
 for(const [key,[sx,sz]] of Object.entries(legLayout)){
  const leg=rig.getObjectByName('robot-leg-'+key);
  assert.ok(leg,`leg robot-leg-${key} present`);
  assert.ok(!(leg as T.Mesh).isMesh,`robot-leg-${key} is an articulated group, not a merged mesh`);
  assert.ok(Math.sign(leg!.position.x)===sx&&Math.abs(Math.abs(leg!.position.x)-0.26)<0.02,`robot-leg-${key} hip sits at x ${sx>0?'+':'-'}0.26 (${leg!.position.x})`);
  assert.ok(Math.sign(leg!.position.z)===sz&&Math.abs(Math.abs(leg!.position.z)-0.26)<0.02,`robot-leg-${key} hip sits at z ${sz>0?'+':'-'}0.26 (${leg!.position.z})`);
  const parts:Record<string,T.Mesh[]>={'robot-leg-upper':[],'robot-leg-lower':[],'robot-foot':[]};
  leg!.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh&&parts[mesh.name])parts[mesh.name].push(mesh);});
  for(const [name,list] of Object.entries(parts))assert.equal(list.length,1,`robot-leg-${key} holds exactly one ${name} mesh`);
  const upper=parts['robot-leg-upper'][0],lower=parts['robot-leg-lower'][0],foot=parts['robot-foot'][0];
  assert.equal(upper.parent,leg,`robot-leg-${key}: the thigh hangs straight from the hip group`);
  const knee=lower.parent!;
  assert.ok(knee!==leg&&knee.parent===leg&&!(knee as T.Mesh).isMesh,`robot-leg-${key}: the shank hangs from a knee pivot group inside the leg`);
  assert.ok(foot.parent===knee||foot.parent?.parent===knee,`robot-leg-${key}: the foot moves with the shank`);
  legDetail[key]={hip:[leg!.position.x,leg!.position.y,leg!.position.z].map(round),knee:knee.name};
 }
 assert.equal(meshes.filter(m=>m.name.startsWith('robot-leg-')||m.name==='robot-foot').length,12,'four legs, three meshes each');
 // The drawn scan wedge is a child of the root and reaches metres ahead, so the body
 // footprint is measured on the rig itself rather than on the whole group.
 const body=rig;
 const size=new T.Box3().setFromObject(body).getSize(new T.Vector3());
 assert.ok(size.y>0.6&&size.y<2.2,`plausible quadruped height, got ${size.y.toFixed(2)}m`);
 assert.ok(size.x>0.3&&size.x<1.6&&size.z>0.3&&size.z<1.6,`quadruped footprint, got ${size.x.toFixed(2)}x${size.z.toFixed(2)}m`);
 // The sensor head sits at the front of the chassis (-z in rig space) and carries the eye.
 const head=meshes.find(m=>m.name==='robot-head')!;
 const headCentre=rig.worldToLocal(new T.Box3().setFromObject(head).getCenter(new T.Vector3()));
 assert.ok(headCentre.z<-0.08,`the sensor head sits at the front of the chassis (rig z ${headCentre.z.toFixed(2)})`);
 const turret=robot.root.getObjectByName('opening-security-robot-turret')!;
 assert.ok(head.parent===turret&&meshes.find(m=>m.name==='opening-robot-eye')!.parent===turret&&meshes.find(m=>m.name==='robot-beacon')!.parent===turret,'head, eye and beacon turn together on the turret');
 const wedge=meshes.find(m=>m.name==='opening-robot-scan-sector')!;
 const positions=wedge.geometry.getAttribute('position');
 assert.ok(positions.count>=6,`the wedge is a real polygon (${positions.count} vertices)`);
 const eye=meshes.find(m=>m.name==='opening-robot-eye')!;
 const eyeMaterial=(Array.isArray(eye.material)?eye.material[0]:eye.material) as T.MeshStandardMaterial;
 assert.ok(eyeMaterial.emissive.r>0.6&&eyeMaterial.emissive.g<0.3&&eyeMaterial.emissive.b<0.3,`the eye glows red (${eyeMaterial.emissive.getHexString()})`);
 // The drawn wedge must never paint through a wall: sample the polygon while it patrols inside Building 5.
 robot.root.updateMatrixWorld(true);
 const tip=new T.Vector3();
 let shortestWedgeInsideRoom=Number.POSITIVE_INFINITY,longestTip=0,occlusionSamples=0;
 let tipBeyondWall=0;
 const tipBeyondWallDetail:{seconds:string;robot:[number,number];head:number;tip:[number,number];reach:number}[]=[];
 const patrolInside=fresh();
 for(let i=0;i<60*90;i++){
  patrolInside.update(DT,ground(24,-25),true,false);
  const d=patrolInside.diagnostics;
  if(d.state!=='patrol'&&d.state!=='scanning')continue;
  if(d.position[2]>O.b5.z1-0.5)continue;             // only while it is physically inside the room
  if(i%5)continue;
  occlusionSamples++;
  patrolInside.root.updateMatrixWorld(true);
  const sector=patrolInside.root.getObjectByName('opening-robot-scan-sector') as T.Mesh;
  const attribute=sector.geometry.getAttribute('position');
  const origin=new T.Vector3(d.position[0],d.position[1]+ROBOT.scanProbeHeight,d.position[2]);
  for(let v=1;v<attribute.count;v++){
   tip.fromBufferAttribute(attribute,v).applyMatrix4(sector.matrixWorld);
   const reach=Math.hypot(tip.x-d.position[0],tip.z-d.position[2]);
   longestTip=Math.max(longestTip,reach);
   shortestWedgeInsideRoom=Math.min(shortestWedgeInsideRoom,reach);
   if(reach>1&&!openingRobotLineClear(world,origin,tip)){
    tipBeyondWall++;
    tipBeyondWallDetail.push({seconds:`${(i/60).toFixed(2)}s`,robot:[d.position[0],d.position[2]],head:d.headOffset,tip:[tip.x,tip.z],reach});
   }
  }
 }
 patrolInside.dispose();
 assert.ok(occlusionSamples>50,`sampled ${occlusionSamples} wedge frames inside Building 5`);
 assert.ok(longestTip<=ROBOT.scanVisualRange+0.05,`the wedge never exceeds its range (${longestTip.toFixed(2)}m)`);
 assert.ok(shortestWedgeInsideRoom<ROBOT.scanVisualRange-2,`the wedge visibly shortens against nearby walls (${shortestWedgeInsideRoom.toFixed(2)}m)`);
 assert.equal(tipBeyondWall,0,'no drawn wedge tip is ever behind a wall');
 // The public surface stays exactly the caller contract: no combat, coordinate-write or DOM capability.
 const surface=Object.keys(robot).sort();
 assert.deepEqual(surface,['diagnostics','dispose','position','reset','root','state','update','warning'],'robot API surface is the documented one');
 assert.deepEqual(Object.keys(robot.update(0,ground(58,-48),false,true)).sort(),['caught','state','warning'],'the update result carries only caught/state/warning');
 // Shorten to the blocker: with the eye facing the wall the drawn sector must stop inside the room.
 const geometryDispose=new Map<T.BufferGeometry,number>();
 const materialDispose=new Map<T.Material,number>();
 for(const geometry of new Set(meshes.map(m=>m.geometry))){
  const original=geometry.dispose.bind(geometry);
  geometryDispose.set(geometry,0);
  geometry.dispose=()=>{geometryDispose.set(geometry,(geometryDispose.get(geometry)??0)+1);original();};
 }
 for(const material of new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]))){
  const original=material.dispose.bind(material);
  materialDispose.set(material,0);
  material.dispose=()=>{materialDispose.set(material,(materialDispose.get(material)??0)+1);original();};
 }
 robot.dispose();
 assert.equal(robot.root.parent,null,'dispose detaches the model from the scene');
 assert.ok(geometryDispose.size>0&&[...geometryDispose.values()].every(n=>n>0),`every geometry disposed (${geometryDispose.size})`);
 assert.ok(materialDispose.size>0&&[...materialDispose.values()].every(n=>n>0),`every material disposed (${materialDispose.size})`);
 assert.doesNotThrow(()=>robot.dispose(),'dispose is safe to repeat');
 assert.equal(world.meshes.length,meshesBefore,'shared navigation meshes untouched by create/update/dispose');
 const triangles=meshes.reduce((sum,m)=>sum+(m.geometry.index?m.geometry.index.count:m.geometry.getAttribute('position').count)/3,0);
 pass('quadruped red-eye model with four articulated legs and a polygon scan wedge; dispose releases geometry and material',
  {meshes:meshes.length,drawCalls:meshes.length,triangles,shadowCasters,heightMeters:round(size.y),footprint:[round(size.x),round(size.z)],standingFeetLift:round(feetLift),legs:legDetail,headRigZ:round(headCentre.z),wedgeVertices:positions.count,disposedGeometries:geometryDispose.size,disposedMaterials:materialDispose.size});
}

// ---------------------------------------------------------------- 9. published tuning stays inside the task book
{
 assert.ok(ROBOT.patrolSpeed<2.6&&ROBOT.chaseSpeed<2.6&&ROBOT.searchSpeed<2.6,`the robot stays slower than the 2.6 m/s player walk (${ROBOT.patrolSpeed}/${ROBOT.chaseSpeed}/${ROBOT.searchSpeed})`);
 assert.equal(ROBOT.range,9,'first version detection range');
 assert.equal(Math.round(ROBOT.halfAngle*180/Math.PI),35,'first version half angle');
 assert.equal(ROBOT.confirm,0.7,'first version confirm time');
 assert.equal(ROBOT.capture,0.65,'capture radius');
 assert.equal(ROBOT.searchSeconds,3,'search lasts about three seconds');
 const patrol=O.patrol.map(p=>[p[0],p[2]]);
 assert.ok(patrol.length===4,'patrol points come from spatialLayout, not invented here');
 pass('tuning stays inside the task book window and positions come from the shared layout',
  {...ROBOT,patrolPoints:patrol,slowerThanPlayerWalk:true});
}

// ---------------------------------------------------------------- 10. the shell pool is shared; emissive parts are not
{
 const assets=createOpeningRobotAssets();
 const a=createOpeningRobot(world,{assets,id:'pool-a'});
 const b=createOpeningRobot(world,{assets,id:'pool-b',startIndex:2});
 const geometriesOf=(robot:OpeningRobot)=>{
  const set=new Set<T.BufferGeometry>();
  robot.root.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh)set.add(mesh.geometry);});
  return set;
 };
 const materialsOf=(robot:OpeningRobot)=>{
  const set=new Set<T.Material>();
  robot.root.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])set.add(m);});
  return set;
 };
 const gA=geometriesOf(a),gB=geometriesOf(b);
 assert.equal([...gA].filter(g=>gB.has(g)).length,8,'body, head, band, eye, beacon and the three leg buffers are shared by both units');
 assert.equal(gA.size,9,'a unit adds only its own animated scan-sector polygon');
 // All four legs of a unit draw the same thigh, shank and foot buffers.
 for(const name of ['robot-leg-upper','robot-leg-lower','robot-foot']){
  const used=new Set<T.BufferGeometry>();
  a.root.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh&&mesh.name===name)used.add(mesh.geometry);});
  assert.equal(used.size,1,`every ${name} mesh shares one buffer`);
  assert.ok(used.has(assets.legUpperGeometry)||used.has(assets.legLowerGeometry)||used.has(assets.footGeometry),`${name} draws a pooled leg buffer`);
 }
 const mA=materialsOf(a),mB=materialsOf(b);
 assert.equal([...mA].filter(m=>mB.has(m)).length,3,'the painted shell, band and leg materials are shared');
 assert.ok(mA.has(assets.legMaterial),'the legs draw the pooled graphite leg material');
 assert.equal(mA.size,6,'six materials per unit: three shared plus eye, lamp and beam');
 const eyeMaterialOf=(robot:OpeningRobot)=>{
  const mesh=robot.root.getObjectByName('opening-robot-eye') as T.Mesh;
  return (Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshStandardMaterial;
 };
 assert.notEqual(eyeMaterialOf(a),eyeMaterialOf(b),'the eye material stays per unit so red/green state cannot leak');
 assert.ok(eyeMaterialOf(a).emissive.r>0.6&&eyeMaterialOf(a).emissive.g<0.3,'both eyes glow red in the alert state');
 a.dispose();b.dispose();
 assert.doesNotThrow(()=>assets.dispose(),'the fleet owner releases the shared pool after the units');
 pass('the shell pool is shared across units while eye, lamp, beam and scan sector stay per unit',
  {geometriesPerUnit:gA.size,sharedGeometries:8,sharedMaterials:3,materialsPerUnit:mA.size});
}

// ---------------------------------------------------------------- 11. shared awareness shares a stale point, never a live track
{
 const board=createOpeningRobotBlackboard();
 const watcher=createOpeningRobot(world,{id:'coord-a',blackboard:board});
 const inside=createOpeningRobot(world,{id:'coord-b',startIndex:3,blackboard:board});
 const distant=createOpeningRobot(world,{id:'coord-c',route:O.robotRoutes[4],startIndex:0,blackboard:board});
 const open=ground(56,-48),hidden=ground(24,-25);
 assert.ok(openingRobotLineClear(world,new T.Vector3(63,1.05,-48),new T.Vector3(56,1.15,-48)),'scenario: the watcher has a clean line to the target');
 assert.equal(openingRobotLineClear(world,new T.Vector3(63,1.05,-59),new T.Vector3(56,1.15,-48)),false,'scenario: the Building 5 wall blocks the inside unit');
 assert.ok(inside.position.distanceTo(open)>ROBOT.range&&inside.position.distanceTo(open)<ROBOT.coordinationRadius,'the inside unit can hear the sighting but cannot see the target');
 assert.ok(distant.position.distanceTo(open)>ROBOT.coordinationRadius,'the third unit is outside the coordination radius');
 const responders=new Set<OpeningRobot>();
 let alertAfterReport=0,sightingFrozen:number[]|null=null;
 for(let i=0;i<120;i++){
  const t=(i+1)/60;
  const player=t<1?open:hidden;    // the target breaks line of sight after one second
  board.tick(DT);
  for(const robot of [watcher,inside,distant]){
   robot.update(DT,player,true,false);
   const d=robot.diagnostics;
   assert.equal(d.state==='chase'&&!d.visible,false,`${robot.root.userData.fleetId} chased without its own line of sight at ${t.toFixed(2)}s`);
   assert.equal(d.caught,false,`${robot.root.userData.fleetId} captured the target without a chase`);
   if(d.supporting)responders.add(robot);
  }
  if(board.alert>alertAfterReport)alertAfterReport=board.alert;
  if(t>1.2&&board.sighting)sightingFrozen=[board.sighting.position.x,board.sighting.position.z];
 }
 assert.ok(alertAfterReport>0.5,`a real sighting raises the fleet alert (${alertAfterReport})`);
 assert.equal(responders.size,1,'exactly one nearby unit claims the shared search, not the whole fleet');
 assert.ok(responders.has(inside),'the unit that cannot see the target is the one that searches the remembered point');
 assert.equal(watcher.state,'search','the seeing unit searches too once the target breaks line of sight');
 assert.equal(inside.diagnostics.caught,false);
 assert.equal(distant.state,'patrol','a unit outside the coordination radius ignores the sighting');
 assert.equal(distant.diagnostics.lastSeen,null,'no shared point is pushed onto a distant unit');
 const sharedPoint=inside.diagnostics.lastSeen;
 assert.notEqual(sharedPoint,null,'the responder walks to the shared remembered point');
 assert.ok(Math.hypot(sharedPoint![0]-open.x,sharedPoint![2]-open.z)<1,`the shared point is the last real sighting (${sharedPoint?.map(round)})`);
 assert.ok(Math.hypot(sharedPoint![0]-hidden.x,sharedPoint![2]-hidden.z)>10,'and never the hidden live position');
 assert.deepEqual(sightingFrozen,[round(open.x),round(open.z)],'the blackboard keeps the stale point after the target disappears');
 pass('one unit publishes a sighting, one nearby unit searches the remembered point, the rest stay put',
  {alert:round(alertAfterReport),responders:responders.size,sharedPoint:sharedPoint?.map(round),watcher:watcher.state,inside:inside.state,distant:distant.state});
 watcher.dispose();inside.dispose();distant.dispose();
}

// ---------------------------------------------------------------- 12. a wall-blocked target is never published
{
 const board=createOpeningRobotBlackboard();
 const guarded=createOpeningRobot(world,{id:'wall-guard',blackboard:board});
 const covered=ground(62,-55.4);
 let alert=0,ticks=0;
 for(;ticks<240;ticks++){
  board.tick(DT);
  guarded.update(DT,covered,true,false);
  alert=Math.max(alert,board.alert);
  assert.equal(board.sighting,null,'a target behind the closed wall is never published to the blackboard');
  assert.notEqual(guarded.diagnostics.state,'chase','and never chased through it');
 }
 assert.equal(alert,0,'no report means no fleet alert');
 pass('nothing reaches the blackboard while the Building 5 wall blocks every eye ray',{ticks,alert,state:guarded.diagnostics.state});
 guarded.dispose();
}

// ---------------------------------------------------------------- 13. the fleet alert decays and the sighting expires
{
 const board=createOpeningRobotBlackboard();
 board.report('test',ground(70,-48),new T.Vector3(2.6,0,0));
 const start=board.alert;
 assert.ok(start>0,'a report raises the alert');
 assert.notEqual(board.sighting,null);
 for(let i=0;i<120;i++)board.tick(DT);
 const mid=board.alert;
 assert.ok(mid>0&&mid<start,`the alert decays over two seconds (${start} -> ${mid})`);
 assert.notEqual(board.sighting,null,'the sighting is still actionable inside its window');
 for(let i=0;i<600;i++)board.tick(DT);
 assert.equal(board.alert,0,'the alert reaches zero after the reports stop');
 assert.equal(board.sighting,null,`the sighting expires after ${ROBOT.sightingFresh}s`);
 pass('alert rises on a report, decays on tick, and the sighting expires',{afterReport:round(start),afterTwoSeconds:round(mid),freshSeconds:ROBOT.sightingFresh});
}

// ---------------------------------------------------------------- 14. search prediction is bounded by the last visible velocity
{
 const robot=createOpeningRobot(world,{id:'predict'});
 // The default first patrol leg runs west from (63,-48), so the body keeps facing the
 // walking target and the confirm window can elapse before it breaks sight.
 const walking=(t:number)=>ground(58-2.6*Math.min(t,1),-48);
 for(let i=0;i<60;i++)robot.update(DT,walking((i+1)*DT),true,false);
 assert.equal(robot.state,'chase','scenario: the walking target is confirmed before it breaks sight');
 const lastSeen=robot.diagnostics.lastSeen!;
 // The target vanishes far away, which also puts this unit on the far update tier, so
 // give it a few ticks to take its next simulation step and enter the search.
 // `assert.equal` above narrows `state` to 'chase' for the rest of this block, so widen
 // it again for the poll below.
 const hidden=ground(24,-25);
 for(let i=0;i<8&&(robot.state as string)!=='search';i++)robot.update(DT,hidden,true,false);
 assert.equal(robot.state,'search','losing sight turns into a search of the plan');
 const steps=robot.diagnostics.searchSteps;
 assert.ok(steps.length>=2,`the search plan adds a predicted point (${JSON.stringify(steps)})`);
 assert.ok(Math.hypot(steps[0][0]-lastSeen[0],steps[0][1]-lastSeen[2])<0.01,'the first search point is the remembered position');
 const ahead=lastSeen[0]-steps[1][0];
 const offset=Math.hypot(steps[1][0]-lastSeen[0],steps[1][1]-lastSeen[2]);
 assert.ok(ahead>0.3,`the predicted point is ahead along the observed motion (${ahead.toFixed(2)}m)`);
 assert.ok(offset<=ROBOT.predictMax+1e-6,`and capped at predictMax (${offset.toFixed(2)}m <= ${ROBOT.predictMax})`);
 pass('the search plan keeps the remembered point first and adds a capped prediction along the last visible motion',
  {lastSeen:lastSeen.map(round),plan:steps,predictionMeters:round(offset)});
 robot.dispose();
}

// ---------------------------------------------------------------- 15. far units update less often but cover the same ground
{
 const near=createOpeningRobot(world,{id:'tier-near'});
 const far=createOpeningRobot(world,{id:'tier-far'});
 const nearPlayer=ground(70,-48),farPlayer=ground(24,-25);
 let nearSteps=0,farSteps=0,nearDistance=0,farDistance=0,farMaxStep=0;
 for(let i=0;i<240;i++){          // four seconds at 60 Hz
  const a=near.position.clone(),b=far.position.clone();
  near.update(DT,nearPlayer,true,false);
  far.update(DT,farPlayer,true,false);
  const nearMove=near.position.distanceTo(a);
  const farMove=far.position.distanceTo(b);
  if(nearMove>1e-4)nearSteps++;
  if(farMove>1e-4)farSteps++;
  nearDistance+=nearMove;farDistance+=farMove;
  farMaxStep=Math.max(farMaxStep,farMove);
 }
 assert.equal(near.diagnostics.farTier,false,'a unit near the player keeps the full update rate');
 assert.equal(far.diagnostics.farTier,true,'a unit far from the player drops to the far tier');
 assert.ok(farSteps<nearSteps*0.6,`the far unit simulates less often (${farSteps} vs ${nearSteps} moving ticks)`);
 assert.ok(farSteps>nearSteps*0.25,`but it still simulates (${farSteps} ticks)`);
 assert.ok(Math.abs(nearDistance-farDistance)<0.5,`both units cover the same ground (${nearDistance.toFixed(2)}m vs ${farDistance.toFixed(2)}m)`);
 assert.ok(farMaxStep<=ROBOT.chaseSpeed/ROBOT.farHz+1e-6,`a far step stays bounded (${farMaxStep.toFixed(3)}m)`);
 pass('distance tiering cuts the far unit update rate without changing its physical path',
  {nearSteps,farSteps,nearDistance:round(nearDistance),farDistance:round(farDistance),farMaxStep:round(farMaxStep)});
 near.dispose();far.dispose();
}

// ---------------------------------------------------------------- 16. an alerted unit holds the guard waypoint
{
 const board=createOpeningRobotBlackboard();
 const guard=createOpeningRobot(world,{id:'guard',blackboard:board,guardPoint:[58,0,-50]});
 const away=ground(24,-46);
 let guarded=0,maxHeadOffset=0;
 for(let i=0;i<60*12;i++){
  const t=(i+1)*DT;
  if(t<6)board.report('seed',away,new T.Vector3());   // a distant unit keeps the alert up
  board.tick(DT);
  guard.update(DT,away,true,false);
  const d=guard.diagnostics;
  if(d.guarding){guarded+=DT;maxHeadOffset=Math.max(maxHeadOffset,Math.abs(d.headOffset));}
  assert.notEqual(d.state,'chase','the seeded sighting is nowhere near this unit');
 }
 assert.ok(guarded>1,`the unit holds the alerted guard waypoint for ${guarded.toFixed(2)}s`);
 assert.ok(guard.diagnostics.alert<ROBOT.guardAlert,'the alert has decayed below the guard threshold by the end');
 assert.ok(maxHeadOffset>1.2,`it turns its head onto the guard point instead of sweeping (${maxHeadOffset.toFixed(2)} rad)`);
 pass('an alerted unit holds the guard waypoint and faces it, then resumes the normal sweep',
  {guardedSeconds:round(guarded),maxHeadOffset:round(maxHeadOffset),alertAtEnd:round(guard.diagnostics.alert)});
 guard.dispose();
}

// ---------------------------------------------------------------- 17. a trot that follows real displacement; reads never move a leg
{
 const robot=fresh();
 const rig=robot.root.getObjectByName('opening-security-robot-rig')!;
 const turret=robot.root.getObjectByName('opening-security-robot-turret')!;
 const sector=robot.root.getObjectByName('opening-robot-scan-sector')!;
 const stand=legPose(robot);
 for(const p of stand)assert.ok(Math.abs(p.thigh-stand[0].thigh)+Math.abs(p.roll-stand[0].roll)+Math.abs(p.knee-stand[0].knee)<1e-9,'all four legs share one standing pose');
 const start=robot.position.clone(),startHeading=robot.diagnostics.heading;
 const astern=ground(66,-48);   // behind the first patrol leg, so the unit just walks
 const swing=LEGS.map(()=>0);
 let spread=0,pairSame=0,pairOpposite=0,maxBob=0,maxRoll=0,maxKneeLift=0,minKneeLift=Number.POSITIVE_INFINITY,maxThigh=0,turretPitch=0,maxTurn=0;
 const stats=drive(robot,{seconds:3,player:astern,stop:(_t,r)=>{
  const pose=legPose(r);
  const offsets=pose.map((p,i)=>p.thigh-stand[i].thigh);
  offsets.forEach((d,i)=>{swing[i]=Math.max(swing[i],Math.abs(d));maxThigh=Math.max(maxThigh,Math.abs(d));});
  pose.forEach((p,i)=>{
   maxRoll=Math.max(maxRoll,Math.abs(p.roll-stand[i].roll));
   const lift=p.knee-stand[i].knee;maxKneeLift=Math.max(maxKneeLift,lift);minKneeLift=Math.min(minKneeLift,lift);
  });
  spread=Math.max(spread,Math.max(...pose.map(p=>p.thigh))-Math.min(...pose.map(p=>p.thigh)));
  pairSame+=offsets[0]*offsets[3]+offsets[1]*offsets[2];        // FL with RR, FR with RL
  pairOpposite+=offsets[0]*offsets[1]+offsets[2]*offsets[3];    // FL against FR, RL against RR
  maxBob=Math.max(maxBob,Math.abs(rig.position.y));
  turretPitch=Math.max(turretPitch,Math.abs(turret.rotation.x));
  maxTurn=Math.max(maxTurn,Math.abs(wrapAngle(r.diagnostics.heading-startHeading)));
  assert.equal(sector.parent,r.root,'the scan sector hangs from the root, never from the bobbing rig');
  assert.equal(sector.position.y,0,'the scan sector never bobs');
  return false;
 }});
 const travelled=Math.hypot(robot.position.x-start.x,robot.position.z-start.z);
 assert.deepEqual(Object.keys(stats.states),['patrol'],'scenario: the unit only patrols, nothing is detected');
 assert.ok(travelled>3&&maxTurn<0.05&&Math.abs(robot.position.z-start.z)<0.05,`scenario: a straight 3 s walk (${travelled.toFixed(2)}m, turned ${maxTurn.toFixed(3)} rad)`);
 swing.forEach((s,i)=>assert.ok(s>0.05,`robot-leg-${LEGS[i]} swings while walking (${s.toFixed(3)} rad)`));
 assert.ok(spread>0.1,`the four legs are not in the same phase (spread ${spread.toFixed(3)} rad)`);
 assert.ok(pairSame>0&&pairOpposite<0,`trot: FL moves with RR and FR with RL, the pairs in antiphase (${pairSame.toFixed(2)} / ${pairOpposite.toFixed(2)})`);
 assert.ok(maxThigh<=BRIEF_GAIT.thighSwing+1e-6,`thigh pitch stays inside +/-${BRIEF_GAIT.thighSwing} rad (${maxThigh.toFixed(3)})`);
 assert.ok(minKneeLift>=-1e-6&&maxKneeLift<=BRIEF_GAIT.kneeLift+1e-6&&maxKneeLift>0.2,`knee lift stays inside 0..${BRIEF_GAIT.kneeLift} rad and is used (${minKneeLift.toFixed(3)}..${maxKneeLift.toFixed(3)})`);
 assert.ok(maxRoll>0.01&&maxRoll<=BRIEF_GAIT.hipRoll+1e-6,`hip roll stays inside +/-${BRIEF_GAIT.hipRoll} rad (${maxRoll.toFixed(3)})`);
 assert.ok(maxBob>0.005&&maxBob<=BRIEF_GAIT.bob+1e-6,`the rig bobs by at most ${BRIEF_GAIT.bob} m (${maxBob.toFixed(4)})`);
 assert.ok(turretPitch<1e-6,`the head stays level on patrol (${turretPitch})`);
 // Render reads, paused ticks and inactive ticks must leave the pose exactly where it is.
 const snapshot=()=>JSON.stringify({legs:legPose(robot),bob:rig.position.y,pitch:rig.rotation.x,head:turret.rotation.x});
 const frozen=snapshot();
 for(let i=0;i<120;i++){robot.update(0,astern,true,false);robot.update(DT,astern,true,true);robot.update(1,astern,true,true);}
 assert.equal(snapshot(),frozen,'dt=0 reads and paused ticks never move a leg, the bob or the head');
 for(let i=0;i<60;i++)robot.update(DT,astern,false,false);
 assert.equal(snapshot(),frozen,'inactive ticks never move a leg either');
 pass('a trot driven by real displacement: diagonal pairs in antiphase, bounded joints, bob on the rig only, frozen on reads',
  {travelled:round(travelled),thighSwing:swing.map(round),phaseSpread:round(spread),maxKneeLift:round(maxKneeLift),maxHipRoll:round(maxRoll),maxBob:round(maxBob*1000)/1000});
 robot.dispose();
}

// ---------------------------------------------------------------- 18. chase notice, solid beacon, and the legs settle once still
{
 const robot=fresh();
 const player=ground(O.patrol[1][0],O.patrol[1][2]);
 const lamp=(robot.root.getObjectByName('robot-beacon') as T.Mesh).material as T.MeshStandardMaterial;
 const stand=legPose(robot);
 let chaseAt:number|null=null,caughtAt:number|null=null,noticePulses=0,wasBright=false,noticeTravel=0,chaseSwing=0;
 let noticeStart:T.Vector3|null=null,stillAt:T.Vector3|null=null;
 const solid=new Set<number>();
 const lastSecond:LegPose[][]=[];
 for(let i=0;i<60*12;i++){
  const t=(i+1)*DT;
  robot.update(DT,player,true,false);
  const state=robot.state;
  if(state==='chase'&&chaseAt===null){chaseAt=t;noticeStart=robot.position.clone();}
  if(chaseAt!==null&&state==='chase'){
   const since=t-chaseAt;
   const bright=lamp.emissiveIntensity>1.5;
   if(since<0.5){if(bright&&!wasBright)noticePulses++;wasBright=bright;noticeTravel=robot.position.distanceTo(noticeStart!);}
   else if(since>0.55)solid.add(Math.round(lamp.emissiveIntensity*1e6));
   chaseSwing=Math.max(chaseSwing,...legPose(robot).map((p,k)=>Math.abs(p.thigh-stand[k].thigh)));
  }
  if(state==='caught'&&caughtAt===null){caughtAt=t;stillAt=robot.position.clone();}
  if(caughtAt!==null&&t>caughtAt+1)lastSecond.push(legPose(robot));
  if(caughtAt!==null&&t>=caughtAt+2)break;
 }
 assert.notEqual(chaseAt,null,'scenario: the unit confirms the target and chases');
 assert.notEqual(caughtAt,null,'scenario: the chase ends in a capture, after which the unit stands still');
 assert.ok(caughtAt!-chaseAt!>1,'scenario: the chase lasts past the notice window');
 assert.equal(noticePulses,2,`the beacon double-pulses in the first 0.5 s of a chase (${noticePulses} pulses)`);
 assert.ok(noticeTravel>0.3,`the notice does not pause the chase (${noticeTravel.toFixed(2)}m covered in 0.5 s)`);
 assert.equal(solid.size,1,`after the notice the beacon burns solid while chasing (${[...solid].map(v=>v/1e6)})`);
 assert.ok(chaseSwing>0.05,`the legs trot during the chase (${chaseSwing.toFixed(3)} rad)`);
 assert.ok(robot.position.distanceTo(stillAt!)<1e-9,'scenario: the caught unit holds still for 2 s');
 assert.ok(lastSecond.length>=55,'scenario: a full second of still poses was sampled');
 let settleDelta=0,standDelta=0;
 for(let leg=0;leg<LEGS.length;leg++)for(const joint of ['thigh','roll','knee'] as const){
  const values=lastSecond.map(pose=>pose[leg][joint]);
  settleDelta=Math.max(settleDelta,Math.max(...values)-Math.min(...values));
  standDelta=Math.max(standDelta,Math.abs(values[values.length-1]-stand[leg][joint]));
 }
 assert.ok(settleDelta<0.02,`still legs settle: max joint change over the last second ${settleDelta.toFixed(4)} rad`);
 assert.ok(standDelta<0.02,`and settle into the standing pose (${standDelta.toFixed(4)} rad off)`);
 pass('a chase opens with a double-pulse notice without pausing, then a solid beacon; still legs settle into the standing pose',
  {chaseAt:round(chaseAt!),caughtAt:round(caughtAt!),noticePulses,noticeTravel:round(noticeTravel),solidIntensity:[...solid][0]/1e6,chaseSwing:round(chaseSwing),settleDelta:round(settleDelta*1000)/1000,standDelta:round(standDelta*1000)/1000});
 robot.dispose();
}

// ---------------------------------------------------------------- 19. a neighbour ahead adds a gentle lateral bias, nothing else
{
 const control=createOpeningRobot(world,{id:'bias-control'});
 const ahead=createOpeningRobot(world,{id:'bias-ahead'});
 const behind=createOpeningRobot(world,{id:'bias-behind'});
 const astern=ground(66,-48);
 // A parked unit 2.5 m down the first leg, and one just behind the start of that leg.
 const parkedAhead=[new T.Vector3(60.5,0,-48)];
 const parkedBehind=[new T.Vector3(63.8,0,-48)];
 let maxLateral=0,controlLateral=0,maxStep=0,closest=Number.POSITIVE_INFINITY,identical=true;
 for(let i=0;i<60*6;i++){
  const before=ahead.position.clone();
  control.update(DT,astern,true,false);
  ahead.update(DT,astern,true,false,true,parkedAhead);
  behind.update(DT,astern,true,false,true,parkedBehind);
  const p=ahead.position;
  assert.equal(world.blocked(p.x,p.z,p.y),false,'the biased unit never enters a solid');
  maxStep=Math.max(maxStep,Math.hypot(p.x-before.x,p.z-before.z));
  if(ahead.diagnostics.patrolIndex===1){maxLateral=Math.max(maxLateral,Math.abs(p.z-O.patrol[0][2]));closest=Math.min(closest,Math.hypot(p.x-parkedAhead[0].x,p.z-parkedAhead[0].z));}
  if(control.diagnostics.patrolIndex===1)controlLateral=Math.max(controlLateral,Math.abs(control.position.z-O.patrol[0][2]));
  if(behind.position.distanceTo(control.position)>1e-9)identical=false;
 }
 assert.ok(controlLateral<0.02,`scenario: the control walks the leg straight (${controlLateral.toFixed(3)}m)`);
 assert.ok(maxLateral>0.1&&maxLateral<1,`a unit parked ahead pushes the walker sideways, gently (${maxLateral.toFixed(2)}m)`);
 // Gentle by design (brief 3C): a spacing hint that opens a gap, not collision avoidance.
 assert.ok(closest>0.15,`and it passes beside the parked unit instead of through its spot (${closest.toFixed(2)}m)`);
 assert.ok(maxStep<=ROBOT.patrolSpeed*DT*1.02,`steering only: no extra speed and no jump (${maxStep.toFixed(4)}m per tick)`);
 assert.ok(identical,'a neighbour behind the unit changes nothing: same path as the call without neighbours');
 assert.ok(ahead.diagnostics.patrolIndex>=2&&control.diagnostics.patrolIndex>=2,'both units still reach the waypoint');
 pass('a neighbour within reach ahead adds a gentle steering bias; behind it, or with no neighbours, the path is unchanged',
  {maxLateral:round(maxLateral),closestToParked:round(closest),maxStep:round(maxStep*1000)/1000,controlLateral:round(controlLateral)});
 control.dispose();ahead.dispose();behind.dispose();
}

function graphConnected(robot:OpeningRobot){
 const d=robot.diagnostics;
 const patrolIndexes=O.patrol.map(p=>d.graphNodes.findIndex(n=>Math.abs(n[0]-p[0])<.01&&Math.abs(n[1]-p[2])<.01));
 const adjacency=new Map<number,number[]>();
 const link=(a:number,b:number)=>{if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a)!.push(b);};
 for(const edge of d.graph)if(edge.walked){link(edge.from,edge.to);link(edge.to,edge.from);}
 const start=patrolIndexes[0];
 if(start<0)return false;
 const seen=new Set([start]),stack=[start];
 while(stack.length)for(const next of adjacency.get(stack.pop()!)??[])if(!seen.has(next)){seen.add(next);stack.push(next);}
 return patrolIndexes.every(i=>seen.has(i));
}

world.dispose();
fs.mkdirSync('evidence/opening-implementation',{recursive:true});
fs.writeFileSync('evidence/opening-implementation/robot-checks.json',JSON.stringify({
 scope:'Offline Agent C acceptance for src/opening/robot.ts against the real opening Navigation and CharacterPhysics',
 date:'2026-11-18',
 harness:'scripts/check-opening-robot.ts',
 dependencies:'Navigation created with opening=true; the robot is driven only through update(dt, player, active, paused)',
 parameters:ROBOT,
 patrolPoints:O.patrol,
 doorOpening:[doorLo,doorHi],
 checks:results,
 notCovered:[
  'browser visual quality of the model and the drawn scan wedge',
  'difficulty and pacing against a human player',
  'interaction with other members\u2019 levels, UI copy and audio',
 ],
},null,2));
console.log(`\nPASS  ${results.length} opening robot checks (evidence/opening-implementation/robot-checks.json)`);
