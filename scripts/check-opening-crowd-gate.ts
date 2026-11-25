/**
 * The plaza crowd's walk to Building 5, headless — including the shipped state machine.
 *
 * Owner report, 2026-11-25: "why students disappear immediately after we get the macbook mission".
 * The walk is about 150 m at 1.05-1.6 m/s; measured end to end it takes about 182 s. It used to
 * be owned by the story stage (`crowd` or `to_b5` only), and accepting the errand moves the stage
 * to `to_b6`: all 52 students vanished on that one frame.
 *
 * The rule pinned here: the stage never decides whether the crowd exists. Students walk once the
 * stage has left `crowd`, they keep walking through every later stage, and each one leaves only
 * by reaching the end of its own route.
 *
 * The second half runs `createCrowdDirector` — the same code `experience.ts` calls — so a change
 * that hides the crowd, freezes it, never bakes it, or deletes arrived students fails HERE, not
 * in the browser (review D4: before this, no gate ran the shipped crowd block).
 */
import assert from 'node:assert/strict';
import {crowdWalkGate,crowdRestoredAt,CROWD_WALK_STAGES} from '../src/opening/crowdWalk';
import {createCrowdDirector,type CrowdRoute,type CrowdSeat} from '../src/opening/crowdDirector';

/* ---------------------------------------------------------------------------------------------- */
/* 1. The stage gate: a pure function of the stage, so every stage the story can hold is checked. */
/* ---------------------------------------------------------------------------------------------- */
assert.deepEqual([...CROWD_WALK_STAGES],['to_b5','to_b6','return_b5','incident','to_b4','complete'],
 'the walk runs through the errand and everything after it');

/* `crowd`: the light show has just ended and the students are still standing on the plaza. */
assert.deepEqual(crowdWalkGate('crowd'),{shown:true,walking:false},'the crowd stands at the crowd stage');

/* `to_b5`: the invitation is answered and the students walk with the player. */
assert.deepEqual(crowdWalkGate('to_b5'),{shown:true,walking:true});

/* The MacBook mission. This is the frame the owner reported: the crowd must still be there. */
const mission=crowdWalkGate('to_b6');
assert.equal(mission.shown,true,'accepting the MacBook errand must not hide the plaza crowd');
assert.equal(mission.walking,true,'the students must keep walking to Building 5 after the errand');

/* Every later stage keeps the same answer: nobody is removed by a stage change. */
for(const stage of ['return_b5','incident','to_b4','complete'])
 assert.deepEqual(crowdWalkGate(stage),{shown:true,walking:true},`${stage} must not hide or freeze the crowd`);

/* An unknown stage shows nothing rather than leaving 52 students parked forever. */
assert.deepEqual(crowdWalkGate('something-new'),{shown:false,walking:false});

/* A restored run (a save load or a chapter jump) starts at a stage, not at a time on the route. */
assert.equal(crowdRestoredAt('crowd'),'standing','a crowd-stage save finds the students on the plaza');
/* The `b5` checkpoint is `to_b5`, and it places the player at the B5 door: the end of the route.
 * The students must be there already, not restarted 150 m away on the plaza. */
assert.equal(crowdRestoredAt('to_b5'),'arrived','the b5 checkpoint must find the students already arrived');
for(const stage of ['to_b6','return_b5','incident','to_b4','complete'])
 assert.equal(crowdRestoredAt(stage),'arrived',`${stage} must find the students already arrived`);
assert.equal(crowdRestoredAt('something-new'),'arrived','an unknown stage is treated as past the walk, never as a crowd restarted on the plaza');

/* ---------------------------------------------------------------------------------------------- */
/* 2. The shipped state machine (`crowdDirector.ts`), on a stand-in plaza and a short route.       */
/* ---------------------------------------------------------------------------------------------- */
/* The stand-in is deliberately simple: flat ground at 0, a route 30 m long. What is under test is
 * the decision logic, not the survey of the real campus (the arrivals check owns that). */
const FLOOR=.42;
const seats:CrowdSeat[]=Array.from({length:52},(_,i)=>({x:40+(i%9)*2.1,z:22+Math.floor(i/9)*2.3,yaw:0,scale:.93+(i%5)*.02}));
const routes:CrowdRoute[]=seats.map((seat,i)=>[{x:seat.x,z:seat.z},{x:seat.x,z:seat.z-15},{x:52+(i%7),z:-20}]);
const director=createCrowdDirector({
 seats,routes,
 startTarget:()=>1,
 floorAt:()=>FLOOR,
});
assert.equal(director.students.length,52,'one student per seat');
assert.equal(director.walking,false,'a fresh director stands still at `crowd`');
assert.equal(director.baked,false,'nothing has been baked yet');

/* D3: the crowd stage shows the students STANDING, and the first frame must bake them. Before
 * 2026-11-25 the update returned before baking here, so the instances rendered from build-time
 * matrices at another height and every student floated until the walk began. */
const stand=director.frame('crowd',1/60);
assert.deepEqual({shown:stand.shown,walking:stand.walking,bake:stand.bake},{shown:true,walking:false,bake:true},
 'the crowd stage shows standing students AND bakes them on the first frame');
assert.ok(director.students.every(s=>s.y===FLOOR),'standing students have their feet on the floor');
assert.ok(director.students.every((s,i)=>s.x===seats[i]!.x),'standing students have not moved');
const still=director.frame('crowd',1/60);
assert.equal(still.bake,false,'once baked, a standing crowd costs no bake per frame');

/* `to_b5`: the walk starts, and the students move. */
const started=director.frame('to_b5',1/60);
assert.deepEqual({shown:started.shown,walking:started.walking,bake:started.bake},{shown:true,walking:true,bake:true});
const before=director.students.map(s=>[s.x,s.z]);
for(let i=0;i<120;i++)director.frame('to_b5',1/60);
assert.ok(director.students.some((s,i)=>s.x!==before[i]![0]||s.z!==before[i]![1]),'the students walk');

/* The owner's frame: accepting the MacBook errand changes the stage, and NOTHING is removed,
 * frozen or hidden. */
const errand=director.frame('to_b6',1/60);
assert.equal(errand.shown,true,'the MacBook errand still shows the crowd');
assert.equal(errand.walking,true,'the MacBook errand does not freeze the crowd');
assert.equal(director.students.length,52,'the MacBook errand removes nobody');

/* The latch: a later stage the gate does not know hides the crowd but must not rewind the walk.
 * The old code let a stage own the walk, so a return to a shown stage resumed students frozen
 * minutes earlier. */
const hidden=director.frame('something-new',1/60);
assert.equal(hidden.shown,false,'an unknown stage shows nothing');
assert.equal(director.walking,true,'the walk latches on and is never owned by a stage again');

/* Walk the whole route out, through every later stage, and the students stay: each one arrives
 * at its own place and stops there. */
/* ~40 m of route at 1.05-1.6 m/s: about 30 s. 1/30 s steps for up to 90 s per stage, so a
 * machine slower than the game does not change the outcome. */
for(const stage of ['return_b5','incident','to_b4','complete']){
 for(let i=0;i<2700&&!director.students.every(s=>s.done);i++)director.frame(stage,1/30);
}
assert.ok(director.students.every(s=>s.done),'every student reaches the end of its own route');
assert.equal(director.students.length,52,'arrived students are still there; nobody is removed');
for(let i=0;i<director.students.length;i++){
 const s=director.students[i]!,end=routes[i]![routes[i]!.length-1]!;
 assert.equal(s.x,end.x,'an arrived student stands at its place');
 assert.equal(s.z,end.z,'an arrived student stands at its place');
 assert.ok(s.scale>0,'an arrived student keeps its size');
 assert.equal(s.y,FLOOR,'an arrived student stands on the floor');
}
/* Arrived students do no per-frame work: the bake stops when nobody moves. */
assert.equal(director.frame('complete',1/30).bake,false,'a finished crowd costs nothing');

/* A restored run. `crowd` lands on the plaza with the walk still off; `to_b5` (the b5
 * checkpoint) is already arrived, so a chapter jump never marches 52 students for three
 * minutes toward a player who is standing at the door. */
director.reset('crowd');
assert.equal(director.walking,false,'a restore at `crowd` does not start the walk');
assert.ok(director.students.every((s,i)=>s.x===seats[i]!.x&&s.z===seats[i]!.z&&!s.done),'a restore at `crowd` puts everyone back on the plaza');
assert.equal(director.frame('crowd',0).bake,true,'the restore re-bakes the matrices');
director.reset('to_b5');
assert.equal(director.walking,true,'a restore at `to_b5` is already walking');
for(let i=0;i<director.students.length;i++){
 const s=director.students[i]!,end=routes[i]![routes[i]!.length-1]!;
 assert.ok(s.done&&s.x===end.x&&s.z===end.z,'a restore at `to_b5` finds every student at its place');
}

/* One route per seat: the director refuses a short list rather than leaving a student without
 * a destination (the old code read `crowdPlaces[index]!` unchecked). */
assert.throws(()=>createCrowdDirector({seats,routes:routes.slice(0,51),startTarget:()=>1,floorAt:()=>FLOOR}),
 /one route per seat/,'the director refuses a seat without a route');

console.log('PASS the plaza crowd is not owned by the story stage: shown and walking at every stage from to_b5 on (including the MacBook errand), baked on the first visible frame, latched through unknown stages, all 52 arrived at their own places and kept, and a restore lands on the plaza at `crowd` and arrived at `to_b5`');
