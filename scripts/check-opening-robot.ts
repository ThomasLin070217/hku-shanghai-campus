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
import {createOpeningRobot, openingRobotLineClear, ROBOT, type OpeningRobot} from '../src/opening/robot';

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
 const recovered=drive(robot,{seconds:45,player:hidden,stop:(_t,r)=>r.state==='patrol'});
 assert.equal(robot.state,'patrol','after searching the remembered spot the robot returns to patrol');
 assert.equal(recovered.caughtAtSecond,null,'no capture while the player stayed behind cover');
 assert.ok(robot.diagnostics.searchClock>=ROBOT.searchSeconds-.6,`the search lasted about ${ROBOT.searchSeconds}s (${robot.diagnostics.searchClock.toFixed(2)}s)`);
 assert.ok(Math.hypot(lastSeen![0]-robot.position.x,lastSeen![2]-robot.position.z)<2.5,'the search ended at the remembered position');
 const gapToHidden=Math.hypot(hidden.x-robot.position.x,hidden.z-robot.position.z);
 assert.ok(gapToHidden>3,'the robot never walked to the hidden live position');
 pass('hidden player freezes lastSeen; the robot searches that point then resumes patrol',
  {transitions:[...lost.transitions,...recovered.transitions],lastSeen:lastSeen?.map(round),searchSeconds:round(robot.diagnostics.searchClock),distanceToHiddenLiveTarget:round(gapToHidden)});
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

// ---------------------------------------------------------------- 8. blocky model, polygon wedge, clean disposal
{
 const meshesBefore=world.meshes.length;
 const scene=new T.Scene();
 const robot=createOpeningRobot(world);
 scene.add(robot.root);
 drive(robot,{seconds:2,player:ground(O.patrol[1][0],O.patrol[1][2])});
 assert.equal(world.meshes.length,meshesBefore,'the robot never joins the shared collision mesh list');
 const meshes:T.Mesh[]=[];
 robot.root.traverse(object=>{if((object as T.Mesh).isMesh)meshes.push(object as T.Mesh);});
 assert.ok(meshes.length>=8,`a blocky model built from parts, got ${meshes.length} meshes`);
 assert.ok(meshes.some(m=>m.name==='opening-robot-eye'),'red eye present');
 assert.ok(meshes.some(m=>m.name==='opening-robot-scan-sector'),'visible scan sector present');
 assert.equal(meshes.filter(m=>/health|hp|bar|weapon|drop|ammo|icon|glow_billboard/i.test(m.name)).length,0,'no health bar, weapon, drop or icon-like part');
 // The drawn scan wedge is a child of the root and reaches metres ahead, so the body
 // footprint is measured on the rig itself rather than on the whole group.
 const body=(robot.root.getObjectByName('opening-security-robot-rig')??robot.root) as T.Group;
 const size=new T.Box3().setFromObject(body).getSize(new T.Vector3());
 assert.ok(size.y>0.9&&size.y<2.2,`plausible robot height, got ${size.y.toFixed(2)}m`);
 assert.ok(size.x>0.3&&size.x<1.6&&size.z>0.3&&size.z<1.6,`blocky footprint, got ${size.x.toFixed(2)}x${size.z.toFixed(2)}m`);
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
 pass('blocky red-eye model with a polygon scan wedge; dispose releases geometry and material',
  {meshes:meshes.length,heightMeters:round(size.y),footprint:[round(size.x),round(size.z)],wedgeVertices:positions.count,disposedGeometries:geometryDispose.size,disposedMaterials:materialDispose.size});
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
