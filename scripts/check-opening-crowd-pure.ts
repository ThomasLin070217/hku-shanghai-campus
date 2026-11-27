/**
 * The plaza crowd must not drive the story.
 *
 * Found 2026-11-25, while fixing "students disappear after the MacBook mission". The crowd
 * reads the ground to know how high each student stands, about 52 times a frame while walking.
 * It read `explorer.world.support`, and that query is not a pure question: it is the clock the
 * lift and the Building 4 office run on, and it treats every call as "the player stands here".
 *
 * What that means concretely, and what this file pins:
 *  - a student inside the office's CCTV trigger would SPEND the one abduction beat (`lobby_feed`)
 *    from a position that is not the player's;
 *  - every student height lookup reset the lift's clock, and so kept the car moving.
 *
 * The crowd now reads through `crowdWorld`, whose `support` is the tick-free floor rule
 * (`openingFloor`) over the same obstacles. Each fact below is paired with its control: the
 * player's own query, at the same point, IS allowed to do the thing. A control that stops
 * working means the story no longer rides this query and the hazard is gone — then delete this
 * file rather than weaken it.
 *
 * Headless: no browser, no WebGL.
 */
import assert from 'node:assert/strict';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {crowdWorld,crowdArrivals,dinnerTables} from '../src/opening/crowdArrivals';
import {B4_OFFICE,setOfficeArmed,resetOffice,officeDebug} from '../src/opening/b4Office';
import {LIFT,LIFT_LANDING,resetLift,callLift,LIFT_TRAVEL_DISTANCE} from '../src/opening/lift';
import {B4_LIFT as L,OPENING as O,dinnerChairPlaces} from '../src/opening/spatialLayout';

/* ONE navigation world, built exactly as the explorer builds its own: `createNavigation(specs, site,
 * true)` (`exploration/controller.ts`). Its `support` is the ticking query the player's physics
 * uses; its `floorAt` is the same floors with the ticks left out.
 *
 * Both sides of this test read THIS object. There is no second, simpler world. The first version
 * of this file built the crowd's side on a world with the opening flag switched off — a thing
 * the game never constructs — and so passed while the shipped crowd was still calling the ticking
 * query (found by review, 2026-11-25). A look-alike cannot be allowed back in: the guard below
 * fails if `crowdWorld` is ever handed anything but the real world. */
const world=createNavigation(BUILDINGS,SITE,true);

/* THE SHIPPED WIRING, verbatim from experience.ts: `crowdWorld(() => explorer.world)`. */
const crowd=crowdWorld(()=>world);
const playerSupport=(x:number,z:number,y:number)=>world.support(x,z,y);

/* Guard: the crowd's queries are the real world's own. If `crowdWorld` is ever rebuilt on another
 * world, or wraps a ticking query again, this stops before the measurements can be believed. */
assert.equal(typeof world.floorAt,'function','the navigation world exposes a side-effect-free floor query (floorAt)');
assert.equal(crowd.support(58,25,4),world.floorAt(58,25,4),'the crowd reads the same floor as world.floorAt');
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const cctv=B4_OFFICE.cctvTrigger,cx=(cctv.x0+cctv.x1)/2,cz=(cctv.z0+cctv.z1)/2;

/* ---------------------------------------------------------------------------------------------- */
/* 1. The office beat. Control: the player's query fires it. Assertion: the crowd's does not.     */
/* ---------------------------------------------------------------------------------------------- */
resetOffice();resetLift();setOfficeArmed(true);
assert.equal(officeDebug().beats.lobby_feed,null,'the beat starts unfired');
world.support(cx,cz,L.ground);
assert.notEqual(officeDebug().beats.lobby_feed,null,'CONTROL: the player standing in the CCTV trigger fires lobby_feed');

resetOffice();resetLift();setOfficeArmed(true);
for(let i=0;i<60;i++){crowd.support(cx,cz,L.ground);await pause(1);}
assert.equal(officeDebug().beats.lobby_feed,null,'a student standing in the CCTV trigger must not spend the abduction beat');
assert.equal(officeDebug().beatOrder.length,0,'no office beat may fire from a crowd query');

/* ---------------------------------------------------------------------------------------------- */
/* 2. The lift. Control: player queries carry a called car down. Assertion: crowd queries do not. */
/* ---------------------------------------------------------------------------------------------- */
/* "The car only advances while something is asking the world where the floor is" (`lift.ts`).
 * A ground call therefore costs: doors open, a 1.4 s dwell, doors close, then the descent —
 * 9.0 s of LIFT time. The lift's clock is not wall time: a query advances it by the gap since
 * the last one, clamped to 50 ms, so a machine that stalls between queries loses lift time.
 *
 * So neither side is driven for a fixed number of seconds.
 *  - The control polls until the car has really travelled (or a ceiling says it never will).
 *    A slow machine makes the test slower, never wrong. The first version of this file ran a
 *    fixed 700 ms window — shorter than the dwell — and reported 0.000 m against 0.000 m.
 *  - The assertion then gives the crowd FAR MORE wall time than the control needed, with no
 *    queries from anyone else, and the car must not have moved at all. */
const CEILING_MS=60000;

/* Ask where the floor is, as one caller, every 2 ms, until `done` says stop or the ceiling is hit. */
const ask=(support:(x:number,z:number,y:number)=>number|null,done:()=>boolean,ceilingMs:number)=>{
 const from=LIFT.y,phaseFrom=LIFT.phase,started=performance.now();
 return(async()=>{
  while(performance.now()-started<ceilingMs&&!done()){support(O.handoff[0],O.handoff[2],O.handoff[1]);await pause(2);}
  return{moved:Math.abs(LIFT.y-from),phaseFrom,phaseTo:LIFT.phase,seconds:(performance.now()-started)/1000};
 })();
};

/* Control. The player, far from the lift, merely asking where the floor is: the called car comes
 * down. It stops the moment the car has really travelled; a slow machine makes it slower, not wrong. */
resetLift();callLift('ground');
const byPlayer=await ask(world.support,()=>Math.abs(LIFT.y-L.landing)>LIFT_TRAVEL_DISTANCE*.5,CEILING_MS);
assert.ok(byPlayer.moved>LIFT_TRAVEL_DISTANCE*.5,'CONTROL: player queries must carry a called lift more than half way down (moved '+byPlayer.moved.toFixed(3)+' m of '+LIFT_TRAVEL_DISTANCE.toFixed(2)+' in '+byPlayer.seconds.toFixed(1)+' s; phase '+byPlayer.phaseFrom+' -> '+byPlayer.phaseTo+')');

/* The same call, with only the crowd asking, for three times as long as the control needed and
 * never less than the whole ride. The only stop condition is time: if the crowd were driving the
 * lift, the car would move well inside this window, as the control just showed. */
const crowdWindowMs=Math.max((L.doorSeconds+L.dwellSeconds+L.doorSeconds+L.travelSeconds)*1000*1.5,byPlayer.seconds*3000);
resetLift();callLift('ground');
const byCrowd=await ask(crowd.support,()=>false,crowdWindowMs);
assert.ok(byCrowd.seconds>=crowdWindowMs/1000-.05,'the crowd window ran in full ('+byCrowd.seconds.toFixed(1)+' s of '+(crowdWindowMs/1000).toFixed(1)+' s)');
assert.equal(byCrowd.moved,0,'crowd queries must not advance the lift: the car moved '+byCrowd.moved.toFixed(4)+' m');
assert.equal(byCrowd.phaseTo,byCrowd.phaseFrom,'crowd queries must not change the lift phase ('+byCrowd.phaseFrom+' -> '+byCrowd.phaseTo+')');
assert.equal(LIFT.call,'ground','the call is still waiting: nothing consumed it');
resetLift();

/* ---------------------------------------------------------------------------------------------- */
/* 3. Same ground, same walls. The fix is invisible: nothing a student stands on changes.        */
/* ---------------------------------------------------------------------------------------------- */
/* Known heights, not a comparison against the ticking query: comparing `support` with `floorAt`
 * calls `support` and ticks the lift/office thousands of times (review D5), and a wrapper around
 * `support` would return the same heights, so the comparison could not see the very bug this
 * file exists for. These points are fixed silences: the hall, the parked shuttle, the 5F plate. */
assert.equal(crowd.support(62,-60,4),O.b5.floor,'the crowd stands on the B5 hall floor (.02) at 62,-60');
assert.equal(crowd.support(62,-60,4),world.floorAt(62,-60,4),'floorAt agrees at the hall floor');
assert.equal(crowd.support(O.bus.x,O.bus.z,4),O.bus.floor,'the crowd stands on the shuttle floor (.54)');
assert.equal(world.floorAt(O.bus.x,O.bus.z,4),O.bus.floor,'floorAt agrees on the shuttle floor');
const landingX=(L.x1+LIFT_LANDING.lobbyX1)/2,landingZ=(L.z0+L.z1)/2;
assert.equal(crowd.support(landingX,landingZ,LIFT_LANDING.floorTop+.3),LIFT_LANDING.floorTop,'the crowd stands on the 5F landing ('+LIFT_LANDING.floorTop+' m)');
assert.equal(world.floorAt(landingX,landingZ,LIFT_LANDING.floorTop+.3),LIFT_LANDING.floorTop,'floorAt agrees on the 5F landing');
const floorY=O.b5.floor+.02;
/* Collision is the same obstacle list: the crowd's `blocked` is the navigation's own, so the
 * dinner tables, the dais, the partition and the arch piers are all solid to it. The points come
 * from the obstacle list, not from this file, so they cannot drift away from the real tables. */
const solids=world.obstacles.filter(o=>o.name.startsWith('opening-b5-table')||o.name==='opening-b5-head-table'||o.name==='opening-b5-dais'||o.name==='opening-b5-arch-pier');
assert.ok(solids.length>=10,'the base world carries the B5 hall solids ('+solids.length+' found)');
for(const o of solids)assert.equal(crowd.blocked(o.x,o.z,floorY),world.blocked(o.x,o.z,floorY),'crowd and player collide alike at '+o.name);
/* At least the tables and the piers are solid at their centres: the arrivals test depends on it. */
const solidCount=solids.filter(o=>crowd.blocked(o.x,o.z,floorY)).length;
assert.ok(solidCount>=solids.length-9,'tables, head table and piers are solid to the crowd ('+solidCount+' of '+solids.length+': the dais is a 14 cm step, so it is not)');

/* The arrivals the game ships are found through this world. */
const arrivals=crowdArrivals(52,crowd,dinnerTables(world),dinnerChairPlaces());
assert.equal(arrivals.length,52,'52 places through the crowd world');
for(const [x,z] of arrivals)assert.equal(crowd.blocked(x,z,floorY),false,`arrival ${x},${z} is inside an obstacle`);
/* Control for the arrivals assertion: a table centre IS blocked, so "clear" means something. */
const table=world.obstacles.find(o=>o.name==='opening-b5-table-0')!;
assert.equal(crowd.blocked(table.x,table.z,floorY),true,'CONTROL: the centre of a dinner table is solid');
assert.deepEqual(arrivals,crowdArrivals(52,crowd,dinnerTables(world),dinnerChairPlaces()),'deterministic through the crowd world');

resetOffice();resetLift();
console.log('PASS the crowd does not drive the story: the player in the CCTV trigger fires lobby_feed and 60 crowd queries at the same point fire nothing; player queries move a called lift '+byPlayer.moved.toFixed(3)+' m and crowd queries move it '+byCrowd.moved.toFixed(3)+' m; the crowd reads the known floors (hall, shuttle, 5F '+(LIFT_LANDING.floorTop)+') and collides like the player, and all 52 arrivals are clear of the tables');
