/**
 * The plaza crowd walks into the B5 hall and stays: one clear, unique standing place per student,
 * reached through the aisles and never through a dinner table.
 *
 * Owner report, 2026-11-25: "why students disappear immediately after we get the macbook mission".
 * A second cause with the same symptom: the route ended at one lobby point and every student was
 * collapsed on arrival. They now each leave the route at a place of their own in the hall.
 *
 * What this pins, and what each "clear" means:
 *  - not inside anything a player collides with: a table, the partition, an arch pier, the dais;
 *  - not inside a CHAIR. The chairs are scenery with no collision, so the first version of the
 *    placement put 16 of 52 students inside one (measured against the drawn seats). The arrivals
 *    are checked against the drawn chairs' own layout (`dinnerChairPlaces`), and a control shows
 *    the check bites: with the chairs withheld, students land in them.
 *  - no two arrivals closer than a guest's standing width;
 *  - deterministic, so a reload does not reshuffle the room;
 *  - the WAY IN is a route around the furniture, sampled every 5 cm, not a straight line. The
 *    straight line from the door crossed a dinner table for 41 of the 52 (review D2); a control
 *    below measures the old lines on the same places and requires the crossing to be real.
 *
 * Headless. `navigation` is the real collision world (the opening flag on, so it carries the
 * tables, dais, partition and piers). `world` is what the game hands the crowd, built by the same
 * `crowdWorld` the game calls.
 */
import assert from 'node:assert/strict';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {crowdArrivals,createHallRouter,dinnerTables,crowdWorld,type Occupied,type Place} from '../src/opening/crowdArrivals';
import {OPENING as O,dinnerChairPlaces} from '../src/opening/spatialLayout';

const navigation=createNavigation(BUILDINGS,SITE,true),hall=O.b5,y=hall.floor+.02;
const world=crowdWorld(()=>navigation);
const blocked=(x:number,z:number,r=.3)=>world.blocked(x,z,y,r);
const floorAt=(x:number,z:number)=>navigation.floorAt(x,z,4);

/* The hall's furniture, from the same two sources the game reads. */
const tables=dinnerTables(navigation),chairs:readonly Occupied[]=dinnerChairPlaces();
const arrivals=(count:number,withChairs=true)=>crowdArrivals(count,world,tables,withChairs?chairs:[]);
/* A student is about .38 wide. */
const BODY=.19;
const onChair=([x,z]:readonly [number,number],list:readonly Occupied[]=chairs)=>list.some(c=>Math.abs(c.x-x)<c.half+BODY&&Math.abs(c.z-z)<c.half+BODY);

/* The furniture is really there: 8 dinner tables from the collision world, 77 chairs from the
 * layout (80 less the three that are animated as standing chairs). If either list emptied, every
 * "clear of it" below would pass for free. */
assert.equal(tables.length,8,'the collision world carries the 8 dinner tables');
assert.equal(chairs.length,77,'the layout lists the 77 drawn chairs');

/* 52 is the full-quality crowd; low quality walks 28. Both must fit without sharing a place. */
for(const count of [52,28]){
 const seats=arrivals(count);
 assert.equal(seats.length,count,`${count} students need ${count} places`);
 for(const [i,place] of seats.entries()){
  const [x,z]=place;
  assert.equal(blocked(x,z),false,`arrival ${i} at ${x},${z} is inside a table, a pier or a wall`);
  const h=world.support(x,z,y+.5);
  assert.notEqual(h,null,`arrival ${i} at ${x},${z} has no floor`);
  /* Inside the hall proper, east of the partition (the lobby is x < 60). */
  assert.ok(x>O.b5.x0+2&&x<hall.x1-1&&z>hall.z0+1.5&&z<hall.z1-1.5,`arrival ${i} at ${x},${z} is outside the hall`);
  assert.ok(x>60.8,`arrival ${i} at ${x},${z} is on the lobby side of the partition`);
  assert.equal(onChair(place),false,`arrival ${i} at ${x},${z} is standing in a chair`);
 }
 /* Nobody stands inside anybody: a guest needs an arm's width, and two at one point renders as
  * one flickering figure. */
 for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
  const d=Math.hypot(seats[i]![0]-seats[j]![0],seats[i]![1]-seats[j]![1]);
  assert.ok(d>=.6,`arrivals ${i} and ${j} are ${d.toFixed(2)} m apart`);
 }
}

/* CONTROL for the chair rule. The ring around each table now stands guests in the aisle beyond the
 * chairs by construction, so for 52 the rule has little to do. It exists for the fallbacks — the
 * open-floor grid and the jitter — which know nothing about the furniture and are what a larger
 * crowd falls back on. So the control asks for a crowd the rings cannot hold (200) with the chair
 * list withheld: students must then land in chairs. If this ever fails, the chairs have gained
 * collision and the rule can be retired. */
const crowded=(withChairs:boolean)=>crowdArrivals(200,world,tables,withChairs?chairs:[]);
const inChairs=crowded(false).filter(p=>onChair(p)).length;
assert.ok(inChairs>=8,'CONTROL: with the chairs withheld, a crowd of 200 must put students in chairs (found '+inChairs+') — otherwise the chair rule is not being tested');
const inChairsGuarded=crowded(true).filter(p=>onChair(p)).length;
assert.equal(inChairsGuarded,0,'with the chair list, the same crowd of 200 puts no student in a chair');

/* 52 and 28: no student stands in a chair (asserted per arrival above, summarised here). */
for(const count of [52,28,120])assert.equal(arrivals(count).filter(p=>onChair(p)).length,0,`${count} arrivals: nobody stands in a chair`);

/* A larger crowd must still be served (the hall has room for far more than 52), chairs and all. */
const many=arrivals(120);
assert.equal(many.length,120,'the hall can seat a larger crowd');

/* Deterministic: two calls give the same places, so a reload does not reshuffle the guests. */
assert.deepEqual(arrivals(52),arrivals(52),'arrivals must be deterministic');

/* ---------------------------------------------------------------------------------------------- */
/* The way in. Not the old straight line: a route through the aisles, sampled every 5 cm.         */
/* ---------------------------------------------------------------------------------------------- */
const router=createHallRouter(world,chairs);
const lobby={x:58,z:-62};
const sample=(ax:number,az:number,bx:number,bz:number,fn:(x:number,z:number)=>void)=>{
 const d=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(d/.05));
 for(let k=0;k<=n;k++){const t=k/n;fn(ax+(bx-ax)*t,az+(bz-az)*t);}
};
const seats=arrivals(52);
let crossings=0,worst=0;
for(const [i,[px,pz]] of seats.entries()){
 const route=router(lobby.x,lobby.z,[px,pz]);
 const [doorX,doorZ]=route[0]!;
 assert.ok(doorX>59.6&&doorX<60.4&&doorZ>=-63&&doorZ<=-57.6,`student ${i}: the way in must pass through the partition opening (${doorX},${doorZ})`);
 assert.deepEqual(route[route.length-1],[px,pz],`student ${i}: the route ends at the place`);
 assert.ok(route.length>=3,`student ${i}: the way in is a route through the hall, not a straight line (${route.length} points)`);
 for(let leg=0;leg<route.length-1;leg++){
  const [ax,az]=route[leg]!,[bx,bz]=route[leg+1]!;
  sample(ax,az,bx,bz,(x,z)=>{
   assert.equal(blocked(x,z),false,`student ${i}: segment ${leg} crosses a table, a pier or a wall at ${x.toFixed(2)},${z.toFixed(2)}`);
   assert.notEqual(floorAt(x,z),null,`student ${i}: segment ${leg} leaves the floor`);
  });
 }
 /* CONTROL: the old straight line from the door to the same place. Count the students for whom
  * it crosses furniture; the review measured 41, and this requires the sample to be honest. */
 let crossed=false;
 sample(60,-62,px,pz,(x,z)=>{
  if(blocked(x,z))crossed=true;
  const h=floorAt(x,z);
  if(h!==null)worst=Math.max(worst,h);
 });
 if(crossed)crossings++;
}
assert.ok(crossings>=8,`CONTROL: the old straight lines from the door must cross furniture for a real share of the 52 (measured ${crossings}) — otherwise the route assertions above prove nothing`);

/* Already inside the hall: no door point, the place alone (and no walk back west). */
assert.deepEqual(router(60.6,-62,[70,-70]),[[70,-70]],'from inside the hall the path is the place alone');
assert.deepEqual(router(66.5,-68,[70,-70]),[[70,-70]],'from the hall floor the path is the place alone');

console.log(`PASS the plaza crowd walks into the B5 hall and stays: 52 and 28 unique arrivals, clear of the 8 tables and the 77 chairs (a crowd of 200 with the chairs withheld puts ${inChairs} students in one; with them, 0), the hall seats 120, and every way in is a 5 cm-sampled route through the aisles (the old straight lines cross furniture for ${crossings} of 52)`);
