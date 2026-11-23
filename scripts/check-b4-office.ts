import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {B4_LAYOUT} from '../src/opening/b4Layout';
import {B4_LIFT as L, OPENING} from '../src/opening/spatialLayout';
import {B4_OFFICE, officeDebug, openOfficeDoor, resetOffice, tickOffice} from '../src/opening/b4Office';
import {
 LIFT, LIFT_LANDING, LIFT_TRAVEL_DISTANCE, liftLandingContains, resetLift, stepLift, syncLiftObstacles, tickLift,
} from '../src/opening/lift';

/**
 * The 5F principal's office, the three abduction beats, and the lift back down (Task E).
 *
 *   1. the office, the monitor, the call points and the corridor read from Task D's geometry
 *      (`LIFT_LANDING`, `B4_LIFT`) rather than restating a number;
 *   2. the errand route — side door, monitor, ground call, car, 5F call, corridor, office
 *      door, desk — is walkable at every 5 cm sample once the doors it needs are open, and
 *      the closed office door really blocks the room;
 *   3. the three beats fire in route order from `tickOffice` alone, all of them before the
 *      door opens, and latch (a second pass changes nothing);
 *   4. the lift descends in the same 6.000 s shape it rises, never opens its doors while
 *      moving, carries the player's floor, and `resetLift` after an arrival at 5F returns
 *      the car to the ground with the clock bootstrapped.
 *
 * Node only: the visuals and the browser walk are `check-b4-errand.py`'s half.
 */

const failures: string[] = [];
const check = (ok: boolean, name: string, message: string): void => {
 if (!ok) failures.push(`${name}: ${message}`);
};
const r4 = (v: number) => +v.toFixed(4);
const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

type P = {x: number; z: number};
type Rect = {x0: number; x1: number; z0: number; z1: number};
const SAMPLE = .05;
const CZ = (L.z0 + L.z1) / 2;                 // 12.40, the car's and the doorway's centre line
const CX = (L.x0 + L.x1) / 2;                 // 45.03, the car's centre
const FLOOR = LIFT_LANDING.floorTop;          // 18.90
const GROUND = L.ground;                      // 0.02

/* ------------------------------------------------------------------ */
/* 1. Geometry, read from its source                                   */
/* ------------------------------------------------------------------ */

const R = B4_LAYOUT.room;
const SD = B4_LAYOUT.sideDoor;
const sdMid = (SD.x0 + SD.x1) / 2;
const cctvMid = {
 x: (B4_OFFICE.cctvTrigger.x0 + B4_OFFICE.cctvTrigger.x1) / 2,
 z: (B4_OFFICE.cctvTrigger.z0 + B4_OFFICE.cctvTrigger.z1) / 2,
};
const corridorMid = {
 x: (B4_OFFICE.corridorTrigger.x0 + B4_OFFICE.corridorTrigger.x1) / 2,
 z: (B4_OFFICE.corridorTrigger.z0 + B4_OFFICE.corridorTrigger.z1) / 2,
};

const geometry = {
 room: {x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1, floor: r4(R.floor)},
 sideDoor: {x0: SD.x0, x1: SD.x1, z: r4(SD.z)},
 car: {x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1, ground: r4(GROUND), landing: r4(L.landing)},
 doorway: {...L.door},
 landing: {...LIFT_LANDING},
 office: {
  door: B4_OFFICE.door, interior: B4_OFFICE.interior, desk: B4_OFFICE.desk,
  laptop: B4_OFFICE.laptop, laptopStand: B4_OFFICE.laptopStand, shelf: B4_OFFICE.shelf,
 },
};

const inside = (x: number, z: number, r: Rect) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const span = (v: number, r: {z0: number; z1: number}) => v >= r.z0 && v <= r.z1;

check(R.floor === OPENING.b4.floor, 'geometry:room-floor', `the room's floor ${R.floor} must be the opening's B4 floor ${OPENING.b4.floor}`);
check(near(L.landing - L.ground, LIFT_TRAVEL_DISTANCE, 1e-9), 'geometry:travel',
 `the landing stands ${r4(L.landing - L.ground)} m above the ground, ${r4(LIFT_TRAVEL_DISTANCE)} m of travel`);

// The monitor hangs on the west wall between the side door and the lift doorway, facing the
// player walking in — that is what makes beat 1 a first *look* rather than a proximity ping.
check(near(B4_OFFICE.cctv.x, L.x1 + .015, 1e-9), 'geometry:cctv-wall',
 `the monitor must sit on the lobby's west wall at x ${L.x1}, read ${B4_OFFICE.cctv.x}`);
check(B4_OFFICE.cctv.z > L.door.z1 && B4_OFFICE.cctv.z < SD.z, 'geometry:cctv-between',
 `the monitor at z ${B4_OFFICE.cctv.z} must lie between the lift doorway (z ≤ ${L.door.z1}) and the side door (z ${r4(SD.z)})`);
check(B4_OFFICE.cctvTrigger.x0 <= B4_OFFICE.cctv.x + .10, 'geometry:cctv-trigger-mouth',
 `the trigger must start at the screen's wall, read x0 ${B4_OFFICE.cctvTrigger.x0}`);
check(span(B4_OFFICE.cctv.z, B4_OFFICE.cctvTrigger), 'geometry:cctv-trigger-span',
 `the monitor at z ${B4_OFFICE.cctv.z} must stand inside its own trigger z ${B4_OFFICE.cctvTrigger.z0}…${B4_OFFICE.cctvTrigger.z1}`);
check(inside(cctvMid.x, cctvMid.z, R), 'geometry:cctv-inside-room',
 `the trigger centre (${r4(cctvMid.x)}, ${r4(cctvMid.z)}) must be inside the B4 room`);

// The ground call plate: on the wall, just south of the doorway, within a step of it.
check(near(B4_OFFICE.callGround.x, L.x1 + .02, 1e-9), 'geometry:call-ground-wall',
 `the ground call plate must hang on the lift wall at x ${L.x1}, read ${B4_OFFICE.callGround.x}`);
check(B4_OFFICE.callGround.z > L.door.z1 && B4_OFFICE.callGround.z < L.door.z1 + .60, 'geometry:call-ground-place',
 `the ground call plate at z ${B4_OFFICE.callGround.z} must be within 0.60 m of the doorway's south jamb ${L.door.z1}`);
check(inside(B4_OFFICE.callGround.x, B4_OFFICE.callGround.z, R), 'geometry:call-ground-inside-room',
 'the ground call plate must be inside the B4 room');
check(inside(B4_OFFICE.callGround.x + .35, B4_OFFICE.callGround.z, R), 'geometry:call-ground-stand',
 'the spot 0.35 m in front of the ground call plate must be inside the B4 room');

// The 5F call point: in the corridor, reachable from the lobby and from the office.
check(liftLandingContains(B4_OFFICE.call5f.x, B4_OFFICE.call5f.z), 'geometry:call-5f-inside',
 `the 5F call point (${B4_OFFICE.call5f.x}, ${B4_OFFICE.call5f.z}) must be inside the built 5F plate`);
check(B4_OFFICE.call5f.x > LIFT_LANDING.lobbyX1, 'geometry:call-5f-corridor',
 `the 5F call point at x ${B4_OFFICE.call5f.x} must be in the corridor past the lobby's east wall ${LIFT_LANDING.lobbyX1}`);
check(near(B4_OFFICE.call5f.y, FLOOR + 1.15, 1e-9), 'geometry:call-5f-height',
 `the 5F call point must be 1.15 m above the landing, read ${B4_OFFICE.call5f.y}`);

// The corridor beat volume: inside the corridor, before the office door.
check(inside(corridorMid.x, corridorMid.z, {
 x0: LIFT_LANDING.lobbyX1, x1: LIFT_LANDING.corridorX1, z0: LIFT_LANDING.corridorZ0, z1: LIFT_LANDING.corridorZ1,
}), 'geometry:corridor-beat-inside', `the corridor trigger centre (${r4(corridorMid.x)}, ${r4(corridorMid.z)}) must be inside the corridor`);
check(B4_OFFICE.corridorTrigger.x1 < B4_OFFICE.door.x0, 'geometry:corridor-beat-before-door',
 `the corridor trigger must end before the office door at x ${B4_OFFICE.door.x0}, read ${B4_OFFICE.corridorTrigger.x1}`);

// The office: the desk and the MacBook inside the room, the MacBook on the desk, the stand
// spot clear of the desk and the chair so the player can actually reach the laptop.
check(inside(B4_OFFICE.laptop.x, B4_OFFICE.laptop.z, B4_OFFICE.interior), 'geometry:laptop-inside',
 'the MacBook must stand inside the office');
check(near(B4_OFFICE.laptop.y, FLOOR + B4_OFFICE.desk.h + .02, 1e-9), 'geometry:laptop-on-desk',
 `the MacBook must sit 2 cm above the desk top, read y ${B4_OFFICE.laptop.y}`);
check(inside(B4_OFFICE.laptopStand.x, B4_OFFICE.laptopStand.z, B4_OFFICE.interior), 'geometry:stand-inside',
 'the MacBook stand spot must be inside the office');
check(B4_OFFICE.laptopStand.z > B4_OFFICE.desk.z1, 'geometry:stand-south-of-desk',
 `the stand spot must be south of the desk (z > ${B4_OFFICE.desk.z1}), read ${B4_OFFICE.laptopStand.z}`);
check(!inside(B4_OFFICE.laptopStand.x, B4_OFFICE.laptopStand.z, B4_OFFICE.desk), 'geometry:stand-off-desk',
 'the stand spot must not be inside the desk');
check(!inside(B4_OFFICE.laptopStand.x, B4_OFFICE.laptopStand.z,
 {x0: B4_OFFICE.chair.x - B4_OFFICE.chair.size / 2, x1: B4_OFFICE.chair.x + B4_OFFICE.chair.size / 2,
  z0: B4_OFFICE.chair.z - B4_OFFICE.chair.size / 2, z1: B4_OFFICE.chair.z + B4_OFFICE.chair.size / 2}),
 'geometry:stand-off-chair', 'the stand spot must not be inside the chair either');
check(Math.hypot(B4_OFFICE.laptopStand.x - B4_OFFICE.laptop.x, B4_OFFICE.laptopStand.z - B4_OFFICE.laptop.z) <= 2.4,
 'geometry:stand-reach', 'the MacBook must be within arm-plus-a-step of the stand spot');

/* ------------------------------------------------------------------ */
/* 2. The route                                                        */
/* ------------------------------------------------------------------ */

const groundRoute: P[] = [
 {x: sdMid, z: SD.z - .35},                                      // through the side door
 {x: sdMid, z: 18.0},                                            // into the lobby
 {x: 47.35, z: B4_OFFICE.cctv.z},                                // the first clear look at the monitor
 {x: 46.9, z: 14.9},                                             // turn west, toward the lift
 {x: B4_OFFICE.callGround.x + .35, z: B4_OFFICE.callGround.z},   // the call button
 {x: 46.50, z: 12.90},                                           // step north, into the doorway line
 {x: 45.60, z: CZ},                                              // through it
 {x: CX, z: CZ},                                                 // inside the car
];
const fifthRoute: P[] = [
 {x: CX, z: CZ},                                                 // out of the car
 {x: 47.6, z: 12.6},                                             // the 5F lobby
 {x: B4_OFFICE.call5f.x, z: B4_OFFICE.call5f.z},                 // the 5F call point
 {x: 49.8, z: CZ},                                               // into the corridor
 {x: corridorMid.x, z: CZ},                                      // the corridor beat
 {x: 54.7, z: CZ},                                               // the office door
 {x: 55.6, z: CZ},                                               // through it
 {x: 56.8, z: CZ},                                               // inside the office
 {x: 57.1, z: 14.0},                                             // around the chair
 {x: B4_OFFICE.laptopStand.x, z: B4_OFFICE.laptopStand.z},       // at the desk
];
/** The leg that crosses the office doorway: blocked while the leaf is shut. */
const doorLeg: P[] = [{x: 54.7, z: CZ}, {x: 56.8, z: CZ}];

/** Every 5 cm point along a waypoint list. */
function samples(route: P[]): P[] {
 const out: P[] = [];
 for (let i = 0; i < route.length - 1; i++) {
  const a = route[i], b = route[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / SAMPLE));
  for (let k = i === 0 ? 0 : 1; k <= n; k++) out.push({x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n});
 }
 return out;
}

/** Closest point on the route to `p`: the distance along it, and how far off the line `p` is. */
function project(route: P[], p: P) {
 let best = {s: 0, off: Infinity}, run = 0;
 for (let i = 0; i < route.length - 1; i++) {
  const a = route[i], b = route[i + 1], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  const t = len < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (len * len)));
  const off = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
  if (off < best.off) best = {s: run + len * t, off};
  run += len;
 }
 return best;
}

const groundWalk = project(groundRoute, groundRoute[groundRoute.length - 1]).s;
const fifthWalk = project(fifthRoute, fifthRoute[fifthRoute.length - 1]).s;
/** Where the 5F walk starts along the whole errand: the ground walk, the ride, then the corridor. */
const RIDE_OFFSET = groundWalk + LIFT_TRAVEL_DISTANCE;
const groundSamples = samples(groundRoute);
const fifthSamples = samples(fifthRoute);

const nav = createNavigation(BUILDINGS, SITE, true);
const blockedAt = (pts: P[], y: number) => pts.filter(p => nav.blocked(p.x, p.z, y)).map(p => ({x: r4(p.x), z: r4(p.z)}));

/**
 * E.1: the sign says "5F by lift" because B04 has no stair of its own. Measure rather than
 * assert that: the highest surface the world supports inside the B04 footprint, and the
 * highest riser anywhere on the walkable campus. Four storeys is 4 × `floorToFloor`.
 */
const stairReport = (() => {
 type Rise = {top: number; at: {x: number; z: number} | null};
 let b4: Rise = {top: GROUND, at: null}, campus: Rise = {top: GROUND, at: null};
 for (let x = R.x0 + .5; x <= R.x1 - .5; x += .5) {
  for (let z = R.z0 + .5; z <= R.z1 - .5; z += .5) {
   const h = nav.support(x, z, 4.0);
   if (h !== null && h > b4.top) b4 = {top: r4(h), at: {x: r4(x), z: r4(z)}};
  }
 }
 // The campus's own stair: the auditorium run north of the courtyard, sampled end to end.
 for (let x = -14; x <= 14; x += 1) {
  for (let z = -52; z <= -26; z += .25) {
   const h = nav.support(x, z, 6.0);
   if (h !== null && h > campus.top) campus = {top: r4(h), at: {x: r4(x), z: r4(z)}};
  }
 }
 return {b4HighestSurface: b4, campusHighestRiser: campus, fourFloors: r4(4 * L.floorToFloor)};
})();
check(stairReport.b4HighestSurface.top < 1.0, 'stairs:b4-has-none',
 `B04 must have no built stair: queried 4 m up over its whole footprint, the only surface is the ${stairReport.b4HighestSurface.top} m floor (a riser would report ${JSON.stringify(stairReport.b4HighestSurface.at)})`);
check(stairReport.campusHighestRiser.top < stairReport.fourFloors, 'stairs:below-4f',
 `the campus's highest riser ${stairReport.campusHighestRiser.top} m must stay below 4F (${stairReport.fourFloors} m)`);

// The unattended car waits at the ground with its doors open; open them the way the game does.
resetLift();
resetOffice();
for (let i = 0; i < 192; i++) stepLift(LIFT, 1 / 120, false);
syncLiftObstacles();
check(LIFT.doors === 1, 'route:ground-doors', `the ground car's doors must open unattended, read ${r4(LIFT.doors)}`);

const groundBlocked = blockedAt(groundSamples, GROUND);
check(groundBlocked.length === 0, 'route:ground-walkable',
 `the side door → monitor → call → car route must be walkable, blocked at ${JSON.stringify(groundBlocked.slice(0, 6))}`);

// The office door is shut until someone opens it: the room behind it must be solid, and the
// block must be the leaf itself, not a wall the doorway never had.
check(!officeDebug().doorOpen, 'route:door-starts-closed', 'the office door must start closed');
const doorClosedBlocked = blockedAt(samples(doorLeg), FLOOR);
check(doorClosedBlocked.length > 0, 'route:closed-door-blocks', 'a closed office door must block the way into the office');
check(nav.blocked(B4_OFFICE.door.x0, CZ, FLOOR), 'route:closed-leaf-solid', 'the closed leaf must be the thing blocking the doorway');
check(openOfficeDoor(), 'route:door-opens', 'the office door must open on interaction');
const doorOpenBlocked = blockedAt(samples(doorLeg), FLOOR);
check(doorOpenBlocked.length === 0, 'route:open-door-passes',
 `an open office door must let the player through, blocked at ${JSON.stringify(doorOpenBlocked.slice(0, 4))}`);
check(!nav.blocked(B4_OFFICE.door.x0, CZ, FLOOR), 'route:open-door-leaf', 'the open leaf must clear its own doorway');

/* ------------------------------------------------------------------ */
/* 3. The beats, driven by the world query alone                       */
/* ------------------------------------------------------------------ */

resetOffice();
check(!officeDebug().doorOpen, 'beats:reset-closed', 'a reset must close the office door again');
check(blockedAt(samples(doorLeg), FLOOR).length > 0, 'beats:reset-collision',
 'a reset must restore the door\'s collision, not only its visual');
check(Object.values(officeDebug().beats).every(t => t === null), 'beats:reset-clear', 'a reset must clear every beat');

// Walk in: beat 1 fires on the way to the monitor, and nothing else has fired yet.
const lookAt = groundSamples.findIndex(q => Math.hypot(q.x - 47.35, q.z - B4_OFFICE.cctv.z) < .06);
for (const p of (lookAt >= 0 ? groundSamples.slice(0, lookAt + 1) : groundSamples)) tickOffice(p.x, p.z, GROUND);
const afterLook = officeDebug();
check(afterLook.beats.lobby_feed !== null, 'beats:one-fires', 'walking up to the monitor must start the feed');
check(afterLook.beats.feed_dies === null, 'beats:one-alone', 'the feed must not die before the lift moves');
check(afterLook.beatOrder.join(',') === 'lobby_feed', 'beats:one-order', `one beat expected, read ${afterLook.beatOrder.join(',')}`);

// Board the car and ride: the feed dies when the doors start closing, on the way up.
let rideSteps = 0;
while (LIFT.phase !== 'arrived' && rideSteps++ < 4000) {
 stepLift(LIFT, 1 / 120, true);
 tickOffice(CX, CZ, LIFT.y);
}
check(LIFT.phase === 'arrived', 'beats:ride-arrives', `the car must reach the landing, phase ${LIFT.phase} after ${rideSteps} steps`);
check(near(LIFT.y, FLOOR, 1e-9), 'beats:ride-height', `the car must stop on the landing ${FLOOR}, read ${LIFT.y}`);
check(officeDebug().beats.feed_dies !== null, 'beats:two-fires', 'the feed must die when the car\'s doors close');
check(officeDebug().doorOpen === false, 'beats:door-still-shut', 'nothing before the corridor may open the office door');

// Open the 5F car doors, then walk the corridor: beat 3 fires before the door is touched.
for (let i = 0; i < 100 && LIFT.doors < 1; i++) stepLift(LIFT, 1 / 120, true);
syncLiftObstacles();
check(LIFT.doors === 1, 'beats:5f-doors', `the car's doors must open at the landing, read ${r4(LIFT.doors)}`);
for (const p of samples(fifthRoute.slice(0, 5))) tickOffice(p.x, p.z, FLOOR);
const afterCorridor = officeDebug();
check(afterCorridor.beats.corridor_sound !== null, 'beats:three-fires', 'the 5F corridor must carry the abduction by sound');
check(afterCorridor.doorOpen === false, 'beats:three-before-door', 'beat 3 must play before the office door opens');
check(afterCorridor.beatOrder.join(',') === 'lobby_feed,feed_dies,corridor_sound', 'beats:three-order',
 `the beats must latch in route order, read ${afterCorridor.beatOrder.join(',')}`);
check(afterCorridor.feed === 'dead', 'beats:feed-dead', 'the monitor must be showing static after beat 2');

// They latch: a second pass through every volume changes nothing.
const timesBefore = {...afterCorridor.beats};
for (const p of groundSamples) tickOffice(p.x, p.z, GROUND);
for (const p of samples(fifthRoute.slice(0, 5))) tickOffice(p.x, p.z, FLOOR);
const latched = JSON.stringify({...officeDebug().beats}) === JSON.stringify(timesBefore);
check(latched, 'beats:latched',
 `the beats must fire once, before ${JSON.stringify(timesBefore)}, after ${JSON.stringify(officeDebug().beats)}`);

/* ------------------------------------------------------------------ */
/* 4. The 5F walk, with the car at the landing and the door open       */
/* ------------------------------------------------------------------ */

check(openOfficeDoor(), 'route:fifth-door-opens', 'the office door must open for the 5F walk');
const fifthBlocked = blockedAt(fifthSamples, FLOOR);
check(fifthBlocked.length === 0, 'route:fifth-walkable',
 `the car → 5F call → corridor → office → desk route must be walkable, blocked at ${JSON.stringify(fifthBlocked.slice(0, 6))}`);
check(nav.support(B4_OFFICE.laptopStand.x, B4_OFFICE.laptopStand.z, FLOOR + .1) === FLOOR, 'route:office-floor',
 'the office floor must support the player at the stand spot');

/* ------------------------------------------------------------------ */
/* 5. E.0 — the ride down, and the reset                               */
/* ------------------------------------------------------------------ */

// Step out of the car (which releases the arrival hold), then step back in and let it go.
stepLift(LIFT, 1 / 120, false);
let descendAt = -1, arriveAt = -1, doorsWhileMoving = 0;
let midRide: {y: number; doors: number; doorBlocked: boolean; carFloor: number | null; interiorBlocked: boolean} | null = null;
for (let i = 1; i <= 1600; i++) {
 stepLift(LIFT, 1 / 120, true);
 tickOffice(CX, CZ, LIFT.y);
 const t = i / 120;
 if (LIFT.phase === 'descending' || LIFT.phase === 'rising') {
  if (LIFT.doors !== 0) doorsWhileMoving++;
  if (midRide === null && LIFT.phase === 'descending' && LIFT.y < L.landing - LIFT_TRAVEL_DISTANCE / 2) {
   syncLiftObstacles();
   const carFloor = nav.obstacles.find(o => o.name === 'opening-lift-car-floor');
   midRide = {
    y: r4(LIFT.y), doors: LIFT.doors,
    doorBlocked: nav.blocked(L.x1 - L.wall / 2, CZ, LIFT.y),
    carFloor: carFloor ? r4(carFloor.top) : null,
    interiorBlocked: nav.blocked(CX, CZ, LIFT.y),
   };
  }
 }
 if (LIFT.phase === 'descending' && descendAt < 0) descendAt = t;
 if (descendAt >= 0 && LIFT.phase === 'arrived') { arriveAt = t; break; }
}
syncLiftObstacles();
const descentSeconds = arriveAt - descendAt;
check(descendAt > 0 && arriveAt > 0, 'descent:runs',
 `the car must actually descend, descending at ${r4(descendAt)} s, arrived at ${r4(arriveAt)} s`);
check(near(descentSeconds, L.travelSeconds, 1 / 120 + 1e-9), 'descent:duration',
 `the descent must take ${L.travelSeconds} s, measured ${r4(descentSeconds)} s`);
check(near(LIFT.y, GROUND, .05), 'descent:floor', `the car must come back within 0.05 m of ${GROUND}, read ${LIFT.y}`);
check(doorsWhileMoving === 0, 'descent:doors-shut', `the doors opened ${doorsWhileMoving} times while the car was moving`);
check(midRide !== null && midRide.doorBlocked, 'descent:no-exit',
 `the player must not be able to step out mid-ride, read ${JSON.stringify(midRide)}`);
check(midRide !== null && midRide.carFloor === midRide.y, 'descent:carries-player',
 `the car floor must carry the player mid-ride, read ${JSON.stringify(midRide)}`);
check(midRide !== null && !midRide.interiorBlocked, 'descent:interior-clear',
 `nothing may block the rider inside the car mid-ride, read ${JSON.stringify(midRide)}`);

// The doors must open only after the car has stopped.
check(LIFT.phase === 'arrived', 'descent:stops', `the car must finish in a stopped phase, read ${LIFT.phase}`);
let doorOpenedAtY: number | null = null;
for (let i = 0; i < 100 && LIFT.doors < 1; i++) {
 const before = LIFT.doors;
 stepLift(LIFT, 1 / 120, false);
 if (LIFT.doors > before && doorOpenedAtY === null) doorOpenedAtY = r4(LIFT.y);
}
check(LIFT.doors === 1, 'descent:doors-open-at-ground', `the doors must open at the ground, read ${r4(LIFT.doors)}`);
check(doorOpenedAtY === GROUND, 'descent:doors-after-stop',
 `the doors began opening at y ${doorOpenedAtY}, not at the stopped car's ${GROUND}`);

// Ride back up, arrive, then reset: the car must be parked at the ground with a fresh clock.
let upSteps = 0;
while (LIFT.phase === 'arrived' && upSteps++ < 400) stepLift(LIFT, 1 / 120, true);
while (LIFT.phase !== 'arrived' && upSteps++ < 4000) stepLift(LIFT, 1 / 120, true);
check(near(LIFT.y, FLOOR, 1e-9), 'reset:arrived-at-5f', `the car must be at the landing before the reset, read ${LIFT.y}`);
resetLift();
check(LIFT.y === GROUND, 'reset:ground', `resetLift must park the car at ${GROUND}, read ${LIFT.y}`);
check(LIFT.doors === 0, 'reset:doors', `resetLift must close the doors, read ${LIFT.doors}`);
check(LIFT.call === null, 'reset:call', `resetLift must clear the landing call, read ${JSON.stringify(LIFT.call)}`);
check(LIFT.phase === 'idle', 'reset:phase', `resetLift must return the machine to idle, read ${LIFT.phase}`);
syncLiftObstacles();
check(nav.blocked(L.x1 - L.wall / 2, CZ, GROUND), 'reset:threshold', 'a reset car must be closed against the lobby');
// The clock: one query after a reset bootstraps and moves nothing. A stale `lastAdvance`
// would hand the first query a full 50 ms step and the doors would start opening.
tickLift(CX, CZ, GROUND);
check(LIFT.phase === 'idle' && LIFT.doors === 0, 'reset:clock',
 `the first query after resetLift must only bootstrap the clock, read phase ${LIFT.phase} doors ${LIFT.doors}`);
resetOffice();
check(blockedAt(samples(doorLeg), FLOOR).length > 0, 'reset:office-door', 'resetOffice must leave the office door solid again');

/* ------------------------------------------------------------------ */
/* 6. The triggers on the route                                        */
/* ------------------------------------------------------------------ */

/**
 * A trigger's place along the errand. `reach` is how far off the walked line the player may
 * pass and still fire it: the volumes are entered on foot, the call plates are pressed from
 * arm's length, so their reach is their own activation radius.
 */
function trigger(name: string, what: string, x: number, z: number, floor: 'ground' | 'lift' | 'fifth', reach: number) {
 const pr = floor === 'fifth' ? project(fifthRoute, {x, z}) : floor === 'ground' ? project(groundRoute, {x, z}) : {s: groundWalk + LIFT_TRAVEL_DISTANCE / 2, off: 0};
 const routeS = pr.s + (floor === 'fifth' ? RIDE_OFFSET : 0);
 check(pr.off <= reach, `triggers:${name}-on-route`,
  `${what} must lie within ${reach} m of the walked route, ${r4(pr.off)} m off it`);
 return {name, what, floor, x: r4(x), z: r4(z), reach, offRoute: r4(pr.off), routeS: r4(routeS)};
}

const triggers = [
 trigger('lobby_feed', 'CCTV monitor', cctvMid.x, cctvMid.z, 'ground', .26),
 trigger('ground_call', 'lift call plate', B4_OFFICE.callGround.x, B4_OFFICE.callGround.z, 'ground', B4_OFFICE.callGround.radius),
 trigger('feed_dies', 'car doors closing', CX, CZ, 'lift', 0),
 trigger('call_5f', '5F call plate', B4_OFFICE.call5f.x, B4_OFFICE.call5f.z, 'fifth', .26),
 trigger('corridor_sound', 'corridor beat', corridorMid.x, corridorMid.z, 'fifth', .26),
 trigger('office_door', 'office door', B4_OFFICE.door.x0, B4_OFFICE.door.centre, 'fifth', .26),
];
const sOf = (name: string) => triggers.find(t => t.name === name)!.routeS;
check(sOf('lobby_feed') < sOf('ground_call'), 'triggers:monitor-before-call',
 `the monitor (${sOf('lobby_feed')} m) must come before the ground call (${sOf('ground_call')} m)`);
check(sOf('ground_call') < sOf('corridor_sound'), 'triggers:call-before-corridor',
 `the ground call (${sOf('ground_call')} m) must come before the corridor beat (${sOf('corridor_sound')} m)`);
check(sOf('corridor_sound') < sOf('office_door'), 'triggers:corridor-before-door',
 `the corridor beat (${sOf('corridor_sound')} m) must come before the office door (${sOf('office_door')} m)`);

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const report = {
 ok: failures.length === 0,
 revision: B4_OFFICE.revision,
 geometry,
 route: {
  groundWalk: r4(groundWalk), ride: r4(LIFT_TRAVEL_DISTANCE), fifthWalk: r4(fifthWalk),
  total: r4(groundWalk + LIFT_TRAVEL_DISTANCE + fifthWalk),
  groundSamples: groundSamples.length, fifthSamples: fifthSamples.length,
 },
 stairs: stairReport,
 reachability: {
  groundBlocked,
  fifthBlocked,
  officeDoor: {closedBlocked: doorClosedBlocked.length, openBlocked: doorOpenBlocked.length},
 },
 triggers,
 beats: {
  order: afterCorridor.beatOrder,
  times: {...afterCorridor.beats},
  feed: afterCorridor.feed,
  latched,
 },
 descent: {
  seconds: r4(descentSeconds), travelSeconds: L.travelSeconds,
  stopsAt: r4(LIFT.y), doorsWhileMoving, midRide, doorOpenedAtY,
  reset: {y: LIFT.y, doors: LIFT.doors, call: LIFT.call, phase: LIFT.phase},
 },
 failures,
};
console.log(JSON.stringify(report, null, 1));
if (failures.length) {
 console.error(`\ncheck-b4-office: ${failures.length} failure(s)`);
 for (const f of failures) console.error(`  - ${f}`);
 process.exit(1);
}
console.log('\ncheck-b4-office: all checks passed');
