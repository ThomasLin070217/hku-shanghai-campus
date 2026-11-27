import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import WebSocket from 'ws';
import {createServer} from 'vite';
import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {B4_LIFT as L, OPENING as O, B6_HALL, OPENING_WORLD_REVISION} from '../src/opening/spatialLayout';
import {
 LIFT, LIFT_LANDING, LIFT_TRAVEL_DISTANCE, callLift, createLift, liftLandingBoxes, liftObstacleBoxes, liftObstacles,
 liftSupport, resetLift, stepLift, syncLiftObstacles,
} from '../src/opening/lift';
/** Only the ground call point and the guards' install hook: the gate must wire the office
 *  the way `opening/navigation.ts` does, or the ground guard stays at its built-solid pose. */
import {B4_OFFICE, installOffice} from '../src/opening/b4Office';

/**
 * B06 core lift + 5F landing gate (retargeted 2026-11-27: the owner ruled the lift
 * is in the middle building, 「入门左转是电梯」).
 *
 *   1. the car, doorway, ground floor and landing match the source constants, read from
 *      `spatialLayout.ts` rather than restated here, and the sliding leaves stay inside the
 *      car's own east wall when open;
 *   2. `liftSupport` answers the car floor inside the car and `null` outside it, at every
 *      height the car can occupy;
 *   3. the state machine, stepped at a fixed 1/120 s, starts parked at the **landing** (E.5):
 *      a landing call brings the empty car down in 6.0 s, a passenger then rides it back up in
 *      6.0 s, and the doors never open while the car is moving;
 *   4. the built navigation agrees: the shaft is hollow, the doorway is open once the car's
 *      doors are, the car is not buried, the 5F plate is a floor and its walls are solid;
 *   5. the 5F plate sits above the room's clear height and no obstacle other than the lift's
 *      own car reaches it;
 *   6. a headless browser walks the player in through B06's south doors and left to
 *      the lift, is blocked by the guarded doorway, calls the car and waits out the descent,
 *      then rides up and walks the 5F corridor without the URL changing. The wait is measured
 *      in fixed steps, never skipped.
 *
 * The browser leg needs a review/dev build. When `CAMPUS_URL` is set the check uses that
 * server; otherwise it starts a Vite dev server itself. `CHROME_PATH` overrides the browser.
 */

const failures: string[] = [];
const check = (ok: boolean, name: string, message: string): void => {
 if (!ok) failures.push(`${name}: ${message}`);
};
const r4 = (v: number) => +v.toFixed(4);
const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* 1. The brief's constants                                            */
/* ------------------------------------------------------------------ */

/** The hall the lift stands in (owner ruling 2026-11-27: B06, the middle one). */
const HALL = O.b6;

function constantReport() {
 const car = {
  x0: r4(L.x0), x1: r4(L.x1), width: r4(L.x1 - L.x0), z0: L.z0, z1: L.z1, depth: r4(L.z1 - L.z0),
  clearHeight: L.clearHeight, eastFace: r4(L.x1),
 };
 const door = {
  z0: L.door.z0, z1: L.door.z1, width: r4(L.door.z1 - L.door.z0), height: L.door.height,
  centre: r4((L.door.z0 + L.door.z1) / 2), plane: r4(L.x1),
  jambNorth: r4(L.door.z0 - L.z0), jambSouth: r4(L.z1 - L.door.z1),
 };
 /** Each leaf is half the doorway and slides half its width outward; the open leaves must
  *  stay inside the car's east wall or one of them hangs out into the hall. */
 const half = (door.z1 - door.z0) / 2;
 const leaves = {
  north: r4(door.z0 - half), south: r4(door.z1 + half),
  insideCar: door.z0 - half >= L.z0 - EPS && door.z1 + half <= L.z1 + EPS,
 };
 const floors = {
  ground: L.ground, landing: L.landing, floorToFloor: L.floorToFloor,
  storeys: 4, expectedLanding: r4(HALL.floor + 4 * L.floorToFloor),
  travelDistance: r4(LIFT_TRAVEL_DISTANCE),
 };
 /** The approach the owner described: in through the south doors, then left — the lift is
  *  west of the entry axis and a few metres in. */
 const approach = {
  entry: [HALL.door, r4(HALL.z1)] as [number, number],
  threshold: [r4(L.x1), door.centre] as [number, number],
  distance: r4(Math.hypot(HALL.door - L.x1, HALL.z1 - (door.z0 + door.z1) / 2)),
  leftOfEntry: L.x1 < HALL.door,
  /** The shaft's hall-facing plane: the car's east wall plus the hall's shaft wall. */
  shaftFace: r4(L.x1 + B6_HALL.shaft.wall),
 };
 return { revision: OPENING_WORLD_REVISION, car, door, leaves, floors, approach };
}

function assertConstants(constants: ReturnType<typeof constantReport>) {
 const { car, door, leaves, floors, approach } = constants;
 check(Math.abs(car.width - 2.20) < EPS, 'car:width', `car interior width ${car.width} m must be 2.20 m`);
 check(Math.abs(car.depth - 2.60) < EPS, 'car:depth', `car interior depth ${car.depth} m must be 2.60 m`);
 check(Math.abs(car.clearHeight - 2.60) < EPS, 'car:clear-height', `car clear height ${car.clearHeight} m must be 2.60 m`);
 check(door.z0 > L.z0 && door.z1 < L.z1, 'door:span',
  `the doorway must sit inside the car's east wall ${L.z0}…${L.z1}, read ${door.z0}…${door.z1}`);
 check(Math.abs(door.width - 1.20) < EPS, 'door:width', `the doorway width ${door.width} m must be 1.20 m`);
 check(Math.abs(door.height - 2.30) < EPS, 'door:height', `the doorway height ${door.height} m must be 2.30 m`);
 check(Math.abs(door.jambNorth - door.jambSouth) < EPS, 'door:centred',
  `the doorway must sit centred in the car: jambs ${door.jambNorth} / ${door.jambSouth}`);
 check(leaves.insideCar, 'door:leaves-inside-car',
  `the open leaves must stay inside the car's east wall ${L.z0}…${L.z1}, read ${leaves.north}…${leaves.south}; narrow the doorway instead of letting a leaf hang into the hall`);
 check(approach.leftOfEntry, 'approach:left-of-entry',
  `the lift must stand west of the entry axis x ${HALL.door}, read its east face ${L.x1}`);
 check(approach.distance >= 3 && approach.distance <= 8, 'approach:distance',
  `the lift doorway must be 3–8 m from the south doors (enter, turn left), measured ${approach.distance} m`);
 check(Math.abs(floors.ground - HALL.floor) < EPS, 'floor:ground',
  `the car floor at ground must be B06's hall floor ${HALL.floor}, read ${floors.ground}`);
 check(Math.abs(floors.landing - 21.06) < EPS, 'floor:landing', `the 5F landing must be 21.06 m, read ${floors.landing}`);
 check(Math.abs(floors.landing - floors.expectedLanding) < EPS, 'floor:storeys',
  `the landing must be four ${L.floorToFloor} m storeys above the hall: ${floors.expectedLanding}, read ${floors.landing}`);
 check(/v9/.test(constants.revision) && /lift/.test(constants.revision) && /b6/.test(constants.revision), 'revision:bumped',
  `OPENING_WORLD_REVISION must name the lift and the B6 move, read ${constants.revision}`);
}

/* ------------------------------------------------------------------ */
/* 2 + 3. liftSupport and the state machine                            */
/* ------------------------------------------------------------------ */

interface ProfileSample { t: number; phase: string; y: number; doors: number }

/**
 * The machine on a private car, in the order the world now presents it (E.5): the car is
 * parked at the landing, so the first thing that happens is an **empty descent** answering a
 * landing call, and only then does a passenger ride it back up. `callLift` targets the one
 * world car, so this private state has the call written straight onto `call`, exactly what
 * `callLift` writes on the world's car.
 */
function machineReport() {
 const s = createLift();
 const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
 const home = { phase: s.phase, y: s.y, doors: s.doors, call: s.call };
 const supportAtHome: Record<string, number | null> = {
  inside: liftSupport(s, cx, cz),
  west: liftSupport(s, L.x0 - .01, cz),
  east: liftSupport(s, L.x1 + .01, cz),
  north: liftSupport(s, L.z0 - .01, cz),
  south: liftSupport(s, L.z1 + .01, cz),
 };
 const dt = 1 / 120;
 const timeline: { t: number; phase: string }[] = [];
 let t = 0, previous = s.phase;
 const mark = () => { if (s.phase !== previous) { timeline.push({ t: +t.toFixed(6), phase: s.phase }); previous = s.phase; } };

 // Leg 1 — the landing call, nobody aboard. The descent answer is still 6.000 s.
 s.call = 'ground';
 let descendStart = -1, groundAt = -1, descentDoorsAt = -1, maxDrop = 0, dropFrom = s.y;
 for (let i = 1; i <= 16 * 120 && groundAt < 0; i++) {
  stepLift(s, dt, false);
  t = i * dt;
  if (s.phase === 'descending' && descendStart < 0) descendStart = (i - 1) * dt;
  maxDrop = Math.max(maxDrop, Math.abs(s.y - dropFrom));
  dropFrom = s.y;
  if (s.phase === 'descending' && s.doors !== 0) check(false, 'machine:descent-doors', `the doors were ${s.doors} at t=${r4(t)} while the car was descending`);
  if (s.phase === 'arrived' && s.y === L.ground) groundAt = t;
  mark();
 }
 const groundSupport = liftSupport(s, cx, cz);
 for (let i = 0; i < 2 * 120 && descentDoorsAt < 0; i++) {
  stepLift(s, dt, false);
  t += dt;
  if (s.doors >= 1) descentDoorsAt = t;
  mark();
 }

 // Leg 2 — a passenger boards at the ground and rides back to the landing.
 let riseStart = -1, arrivedAt = -1, doorsOpenAt = -1, maxRise = 0;
 let midSupport: number | null = null, midY = NaN;
 const samples: ProfileSample[] = [];
 for (let i = 1; i <= 16 * 120 && arrivedAt < 0; i++) {
  const yBefore = s.y;
  stepLift(s, dt, true);
  t += dt;
  if (s.phase === 'rising' && riseStart < 0) riseStart = t - dt;
  maxRise = Math.max(maxRise, Math.abs(s.y - yBefore));
  if (s.phase === 'rising' && s.doors !== 0) check(false, 'machine:doors-while-rising', `the doors were ${s.doors} at t=${r4(t)} while the car was rising`);
  if (s.phase === 'rising' && midSupport === null && s.y > 6) { midSupport = liftSupport(s, cx, cz); midY = s.y; }
  // The y-profile below is the ascent, on its own clock so it reads as one 6 s curve.
  if (s.phase === 'rising' && i % 30 === 0) samples.push({ t: r4(t - riseStart), phase: s.phase, y: r4(s.y), doors: r4(s.doors) });
  if (s.phase === 'arrived' && s.y === L.landing) arrivedAt = t;
  mark();
 }
 for (let i = 0; i < 2 * 120 && doorsOpenAt < 0; i++) {
  stepLift(s, dt, true);
  t += dt;
  if (s.doors >= 1) doorsOpenAt = t;
  mark();
 }
 samples.push({ t: r4(arrivedAt - riseStart), phase: s.phase, y: r4(s.y), doors: r4(s.doors) });
 const final = { phase: s.phase, y: s.y, doors: s.doors };
 /** The accel–cruise–decel profile's peak speed and peak acceleration, for the report. */
 const peakSpeed = LIFT_TRAVEL_DISTANCE / (L.travelSeconds * (1 - .25));
 return {
  home, supportAtHome, groundSupport, midSupport, midY: r4(midY), final, timeline, samples,
  measured: {
   descentSeconds: +((groundAt - descendStart)).toFixed(4),
   descentArrivedAt: +groundAt.toFixed(4),
   descentDistance: r4(L.ground - L.landing),
   descentDoorsOpenedAt: +descentDoorsAt.toFixed(4),
   maxDropPerStep: +maxDrop.toFixed(5),
   travelSeconds: +(arrivedAt - riseStart).toFixed(4), travelled: r4(final.y - L.ground),
   doorsOpenedAt: +doorsOpenAt.toFixed(4), arrivedAt: +arrivedAt.toFixed(4),
   maxRisePerStep: +maxRise.toFixed(5), peakSpeed: +peakSpeed.toFixed(4),
   peakAcceleration: +(peakSpeed / (.25 * L.travelSeconds)).toFixed(4),
  },
 };
}

function assertMachine(report: ReturnType<typeof machineReport>) {
 const s = createLift(), cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
 // E.5: the home floor is the landing, so a reset world starts with the car upstairs.
 check(report.home.y === L.landing, 'machine:home-landing', `a new lift must park at the landing ${L.landing}, read ${report.home.y}`);
 check(report.home.doors === 0 && report.home.call === null && report.home.phase === 'idle', 'machine:home-parked',
  `a new lift must be idle, doors closed, no call, read ${JSON.stringify(report.home)}`);
 check(report.supportAtHome.inside === L.landing, 'support:inside', `liftSupport inside the car at rest must be ${L.landing}, read ${report.supportAtHome.inside}`);
 for (const side of ['west', 'east', 'north', 'south'] as const) {
  check(report.supportAtHome[side] === null, `support:${side}`, `liftSupport ${side} of the car must be null, read ${report.supportAtHome[side]}`);
 }
 check(report.groundSupport === L.ground, 'support:follows-ground',
  `liftSupport must return the ground ${L.ground} once the car is down, read ${report.groundSupport}`);
 check(report.groundSupport !== L.landing, 'support:left-landing',
  `liftSupport still reports the landing ${L.landing} after the car has left it`);
 check(report.midSupport !== null && Math.abs(report.midSupport - report.midY) < 1e-3 && report.midY > 6, 'support:follows-mid-rise',
  `liftSupport must return the car's own height mid-rise, read ${report.midSupport} against ${report.midY}`);
 check(report.final.phase === 'arrived', 'machine:arrived', `the ride must end in 'arrived', read '${report.final.phase}'`);
 check(report.final.y === L.landing, 'machine:landing', `the car must stop exactly on the landing ${L.landing}, read ${report.final.y}`);
 check(report.final.doors === 1, 'machine:doors-open', `the doors must be open on arrival, read ${report.final.doors}`);
 check(Math.abs(report.measured.descentSeconds - L.travelSeconds) <= 1 / 120 + 1e-9,
  'machine:descent-time', `the empty descent must take ${L.travelSeconds} s, measured ${report.measured.descentSeconds} s`);
 check(Math.abs(report.measured.descentDistance + LIFT_TRAVEL_DISTANCE) < 1e-6, 'machine:descent-distance',
  `the descent covered ${report.measured.descentDistance} m, expected ${-LIFT_TRAVEL_DISTANCE}`);
 check(report.measured.descentDoorsOpenedAt >= report.measured.descentArrivedAt, 'machine:descent-doors-after-stop',
  `the doors opened at ${report.measured.descentDoorsOpenedAt} s but the car only stopped at ${report.measured.descentArrivedAt} s`);
 check(Math.abs(report.measured.travelSeconds - L.travelSeconds) <= 1 / 120 + 1e-9, 'machine:travel-time',
  `the ride must take ${L.travelSeconds} s, measured ${report.measured.travelSeconds} s`);
 check(report.measured.doorsOpenedAt >= report.measured.arrivedAt - EPS, 'machine:doors-after-stop',
  `the doors opened at ${report.measured.doorsOpenedAt} s but the car only stopped at ${report.measured.arrivedAt} s`);
 check(report.measured.maxRisePerStep <= .24, 'machine:step-rise',
  `one fixed step lifted the car ${report.measured.maxRisePerStep} m, more than the physics' 0.24 m step`);
 check(report.measured.maxDropPerStep <= .24, 'machine:step-drop',
  `one fixed step dropped the car ${report.measured.maxDropPerStep} m, more than the physics' 0.24 m step`);
 check(Math.abs(report.measured.travelled - LIFT_TRAVEL_DISTANCE) < 1e-6, 'machine:distance',
  `the ride covered ${report.measured.travelled} m, expected ${LIFT_TRAVEL_DISTANCE}`);
 // The support plumbing itself, on a fresh car: one long step only opens the doors, so the
 // floor must still be the car's own y wherever it stands.
 stepLift(s, 6, true);
 check(Math.abs(liftSupport(s, cx, cz)! - s.y) < EPS, 'support:follows', 'liftSupport must follow the car floor');
 check(s.y === L.landing, 'machine:long-step-parks', `a 6 s step must not move the car off its floor, read ${s.y}`);
}

/* ------------------------------------------------------------------ */
/* 4 + 5. The built world                                              */
/* ------------------------------------------------------------------ */

function worldReport() {
 resetLift();
 const nav = createNavigation(BUILDINGS, SITE, true);
 // `opening/navigation.ts` mounts the office's guards into the same array; without this the
 // ground guard would sit at its built-solid pose for the whole gate.
 installOffice(nav.obstacles);
 const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, doorX = L.x1 - L.wall / 2;
 const at = (name: string, x: number, z: number, y: number) => ({ name, x: r4(x), z: r4(z), y: r4(y), blocked: nav.blocked(x, z, y) });
 // E.5 parks the car at the landing, so a fresh world has a *closed car up there* and an
 // empty shaft at the ground. Probe the closed car where it actually is, then call it down.
 const closed = {
  carInterior: at('car interior at the landing', cx, cz, L.landing),
  threshold: at('closed threshold at the landing', doorX, cz, L.landing),
  groundDoorway: at('ground doorway with the car up', doorX, cz, L.ground),
  entrance: at('hall entrance', HALL.door, HALL.z1 - 1.0, L.ground + .5),
  shaftMid: at('shaft at 10 m', cx, cz, 10),
  massWest: at('mass west of the shaft', L.x0 - .45, cz, 10),
  massAbove: at('mass above the shaft', cx, cz, LIFT_LANDING.ceilBottom + L.wall + .02),
  groundUnderPlate: at('hall floor under the 5F plate', L.x1 + 1.5, cz, L.ground),
  plate: at('5F plate', LIFT_LANDING.lobbyX1 - 1.5, cz, L.landing),
  plateNorthWall: at('5F north wall', LIFT_LANDING.lobbyX1 - 1.5, L.z0 - .06, L.landing),
  corridor: at('5F corridor', LIFT_LANDING.corridorX1 - 1.0, cz, L.landing),
  officeDoor: at('office door', LIFT_LANDING.corridorX1 + .06, cz, L.landing),
 };
 const plateSupport = nav.support(LIFT_LANDING.lobbyX1 - 1.5, cz, L.landing);
 // Every obstacle that can reach the plate, and every one that intersects the landing
 // footprint at any height, so the report carries the evidence for the D.3 assertion. Taken
 // with the car at its home landing, the pose the plate claim is about.
 const landingRects = [
  { x0: L.x1, x1: LIFT_LANDING.lobbyX1, z0: L.z0, z1: L.z1 },
  { x0: LIFT_LANDING.lobbyX1, x1: LIFT_LANDING.corridorX1, z0: LIFT_LANDING.corridorZ0, z1: LIFT_LANDING.corridorZ1 },
 ];
 const overlaps = (o: { x: number; z: number; w: number; d: number }, r: { x0: number; x1: number; z0: number; z1: number }) =>
  o.x - o.w / 2 < r.x1 - EPS && o.x + o.w / 2 > r.x0 + EPS && o.z - o.d / 2 < r.z1 - EPS && o.z + o.d / 2 > r.z0 + EPS;
 // Anything that reaches into the plate's *standable* slice: taller than the floor and not
 // starting above the ceiling. Solid tower above the plate's own ceiling is legitimate.
 const reaching = nav.obstacles
  .filter(o => o.top > LIFT_LANDING.floorTop + EPS && o.bottom <= LIFT_LANDING.ceilBottom + EPS)
  .map(o => ({ name: o.name, top: r4(o.top), overPlate: landingRects.some(r => overlaps(o, r)) }));
 const underPlate = nav.obstacles.filter(o => landingRects.some(r => overlaps(o, r))).map(o => ({ name: o.name, bottom: r4(o.bottom), top: r4(o.top) }));
 const shaftColumn = nav.obstacles
  .filter(o => overlaps(o, { x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1 }) && o.top > 1 && o.bottom < L.landing + L.clearHeight)
  .map(o => ({ name: o.name, bottom: r4(o.bottom), top: r4(o.top) }));
 const carBoxes = liftObstacleBoxes(L.ground, 0).map(b => b.name);
 const landingBoxes = liftLandingBoxes().map(b => b.name);
 const missing = [...carBoxes, ...landingBoxes].filter(name => !nav.obstacles.some(o => o.name === name));
 const duplicated = [...carBoxes, ...landingBoxes].filter(name => nav.obstacles.filter(o => o.name === name).length > 1);
 const obstacleCount = nav.obstacles.length;

 // E.5 in the built world: the errand's first lift event is a landing call and a real wait.
 // `callLift` + `stepLift` + `syncLiftObstacles` is what `tickOffice`/`tickLift` do on a
 // player's query, with the wall clock replaced by a fixed 1/120 s step.
 callLift('ground');
 const called = LIFT.call;
 let descendAt = -1, arriveAt = -1, doorsAt = -1;
 const dt = 1 / 120;
 for (let i = 1; i <= 16 * 120 && doorsAt < 0; i++) {
  stepLift(LIFT, dt, false);
  if (LIFT.phase === 'descending' && descendAt < 0) descendAt = (i - 1) * dt;
  if (LIFT.phase === 'arrived' && arriveAt < 0) arriveAt = i * dt;
  if (arriveAt > 0 && LIFT.doors >= 1) doorsAt = i * dt;
 }
 syncLiftObstacles();
 // The office's guards are rewritten by its own sync, which `tickOffice` calls every query.
 installOffice(nav.obstacles);
 const open = { threshold: at('open threshold at the ground', doorX, cz, L.ground) };
 const call = {
  called, callAfterArrival: LIFT.call,
  descendAt: +descendAt.toFixed(4), arriveAt: +arriveAt.toFixed(4), doorsAt: +doorsAt.toFixed(4),
  descentSeconds: +(arriveAt - descendAt).toFixed(4), waitSeconds: +doorsAt.toFixed(4),
  y: r4(LIFT.y), doors: r4(LIFT.doors), phase: LIFT.phase,
 };
 /**
  * What the mounted car costs per query, against the cost of rebuilding the obstacle list.
  * `syncLiftObstacles` returns immediately when nothing is mounted, so this has to run after
  * `createNavigation` has mounted the car: measuring it any earlier measures a no-op.
  * `carBoxStillMounted` and `carFloorFollows` below prove the loop ran on the live objects.
  */
 const carFloor = nav.obstacles.find(o => o.name === 'opening-lift-car-floor');
 const mountedLiftBoxes = nav.obstacles.filter(o => o.name.startsWith('opening-lift-')).length;
 const perf = (globalThis as { performance?: { now(): number } }).performance;
 const nowMs = () => (perf ? perf.now() : Date.now());
 const iterations = 2000, trials = 9, warmUp = 2000;
 const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
 const paths = {
  sync: () => { syncLiftObstacles(); },
  rebuild: () => { liftObstacles(LIFT); },
 };
 // Warm every path, then interleave the trials round-robin: measuring one path to completion
 // and then the next lets JIT and GC state decide the ranking (the first run pays for all).
 resetLift();
 for (let i = 0; i < warmUp; i++) for (const fn of Object.values(paths)) fn();
 const runs: Record<keyof typeof paths, number[]> = { sync: [], rebuild: [] };
 for (let t = 0; t < trials; t++) {
  for (const name of ['sync', 'rebuild'] as const) {
   const t0 = nowMs();
   for (let i = 0; i < iterations; i++) paths[name]();
   runs[name].push((nowMs() - t0) / iterations * 1000);
  }
 }
 const syncMicroseconds = +median(runs.sync).toFixed(3);
 const rebuildMicroseconds = +median(runs.rebuild).toFixed(3);
 // The timing above runs with the car parked, where a sync that did nothing would still look
 // right. Send it down and sync once: the mounted box starts at the landing 21.06 and can
 // only reach the ground by being rewritten in place, so this is the proof that the loop
 // above measured the live objects.
 resetLift();
 LIFT.call = 'ground';
 for (let i = 0; i < 16 * 120 && !(LIFT.phase === 'arrived' && LIFT.y === L.ground); i++) stepLift(LIFT, 1 / 120, false);
 syncLiftObstacles();
 const carBoxStillMounted = !!carFloor && nav.obstacles.includes(carFloor);
 const carFloorFollows = !!carFloor && LIFT.y === L.ground && Math.abs(carFloor.top - LIFT.y) < 1e-12;
 const carFloorTop = carFloor ? r4(carFloor.top) : NaN;
 const liftBoxesAfter = nav.obstacles.filter(o => o.name.startsWith('opening-lift-')).length;
 const cost = {
  iterations, trials, warmUp,
  syncMicroseconds, rebuildMicroseconds,
  mountedLiftBoxes, liftBoxesAfter, carBoxStillMounted, carFloorFollows, carFloorTop,
 };
 resetLift();
 syncLiftObstacles();
 nav.dispose();
 return { closed, open, call, plateSupport: r4(plateSupport ?? NaN), reaching, underPlate, shaftColumn, carBoxes, landingBoxes, missing, duplicated, obstacleCount, cost };
}

function assertWorld(report: ReturnType<typeof worldReport>) {
 const b = (name: string) => report.closed[name as keyof typeof report.closed] as { blocked: boolean; x: number; y: number; z: number };
 check(!b('carInterior').blocked, 'world:car-interior', `the car interior at (${b('carInterior').x}, ${b('carInterior').z}) is solid at the car floor`);
 check(b('threshold').blocked, 'world:closed-door', 'the closed car doors must block the threshold');
 check(b('groundDoorway').blocked, 'world:ground-guarded',
  'with the car at the landing the ground doorway must be solid — behind it is a 15.96 m shaft');
 check(!report.open.threshold.blocked, 'world:open-door', 'the open car doors must clear the threshold');
 // E.5 in the built world: a landing call is answered, it takes a real ride, and the doors
 // that were shut upstairs open only at the ground.
 check(report.call.called === 'ground', 'world:call-registered', `the ground call must be recorded, read ${JSON.stringify(report.call.called)}`);
 check(Math.abs(report.call.descentSeconds - L.travelSeconds) <= 1 / 120 + 1e-9,
  'world:descent-time', `the built world's descent must take ${L.travelSeconds} s, measured ${report.call.descentSeconds} s`);
 check(report.call.y === L.ground && report.call.doors === 1 && report.call.phase === 'arrived', 'world:descent-arrived',
  `the called car must stand at the ground with its doors open, read ${JSON.stringify(report.call)}`);
 check(report.call.callAfterArrival === null, 'world:call-cleared', `arrival must clear the landing call, read ${JSON.stringify(report.call.callAfterArrival)}`);
 check(report.call.waitSeconds >= L.dwellSeconds + L.doorSeconds + L.travelSeconds, 'world:wait-is-real',
  `the call-to-open-doors wait must include the dwell, the close, the ride and the open, read ${report.call.waitSeconds} s`);
 check(!b('entrance').blocked, 'world:entrance', `the hall's south doors must stay open`);
 check(!b('shaftMid').blocked, 'world:shaft', 'the shaft must stay hollow above the hall ceiling');
 check(b('massWest').blocked, 'world:shaft-west', 'the mass west of the shaft must stay solid');
 check(b('massAbove').blocked, 'world:shaft-top', 'the mass above the 5F car must stay solid');
 check(!b('groundUnderPlate').blocked, 'world:hall-under-plate', 'the hall floor must stay walkable under the 5F plate');
 check(Math.abs(report.plateSupport - LIFT_LANDING.floorTop) < 1e-6, 'world:plate-support',
  `the 5F plate must support at ${LIFT_LANDING.floorTop} m, read ${report.plateSupport}`);
 check(!b('plate').blocked, 'world:plate', 'the player must be able to stand on the 5F plate');
 check(b('plateNorthWall').blocked, 'world:plate-wall', 'the 5F north wall must be solid');
 check(!b('corridor').blocked, 'world:corridor', 'the 5F corridor must be walkable');
 check(b('officeDoor').blocked, 'world:office-door', "the principal's office door must be closed");
 check(report.carBoxes.length === 10, 'world:car-boxes', `the car must carry 10 collision boxes, read ${report.carBoxes.length}`);
 check(report.landingBoxes.length === 14, 'world:landing-boxes', `the landing must carry 14 collision boxes, read ${report.landingBoxes.length}`);
 for (const name of report.missing) check(false, `world:mounted:${name}`, `${name} is not in the built navigation`);
 for (const name of report.duplicated) check(false, `world:duplicated:${name}`, `${name} is mounted more than once`);
 // D.3: the plate is above the room, and nothing but the lift's own car reaches it.
 check(LIFT_LANDING.floorTop > HALL.floor + HALL.clearHeight, 'plate:above-room',
  `the plate ${LIFT_LANDING.floorTop} must clear the hall's ${HALL.floor + HALL.clearHeight} m clear height`);
 // Only the plate's own two ceilings may span the plate footprint; every other obstacle that
 // reaches the plate's height must stay off it.
 const spanning = ['opening-lift-5f-ceiling-lobby', 'opening-lift-5f-ceiling-corridor'];
 for (const name of spanning) {
  const o = report.reaching.find(r => r.name === name);
  check(!!o && o.overPlate, `plate:ceiling:${name}`,
   `${name} must be present and span the plate, read ${o ? `top ${o.top} overPlate ${o.overPlate}` : 'absent'}`);
 }
 for (const o of report.reaching) {
  if (spanning.includes(o.name)) continue;
  check(!o.overPlate, `plate:reached:${o.name}`, `${o.name} (top ${o.top}) reaches the 5F plate's footprint`);
 }
 // The cost benchmark above is only meaningful on the mounted objects.
 check(report.cost.carBoxStillMounted, 'cost:mounted-identity',
  'the in-place sync replaced the mounted car-floor obstacle instead of rewriting it');
 check(report.cost.carFloorFollows, 'cost:mounted-pose',
  `the mounted car floor must follow the car, read ${report.cost.carFloorTop} against the car's last height`);
 check(report.cost.liftBoxesAfter === report.cost.mountedLiftBoxes, 'cost:mounted-count',
  `the world mounted ${report.cost.mountedLiftBoxes} lift boxes but ${report.cost.liftBoxesAfter} are present after the sync`);
}

/* ------------------------------------------------------------------ */
/* 6. The browser walk                                                 */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** `LIFT_DEBUG=1` traces the browser leg; a silent headless run is otherwise hard to read. */
const debug = (message: string) => { if (process.env.LIFT_DEBUG === '1') console.error('[lift]', message); };

async function browserWalk(baseUrl: string, chromePath: string) {
 const port = 9331;
 const child = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/hku-lift-${Date.now()}`,
  '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,800', '--hide-scrollbars', 'about:blank',
 ], { stdio: 'ignore' });
 const trace: Record<string, unknown>[] = [];
 try {
  debug(`spawned ${chromePath} on ${port}`);
  let page: { webSocketDebuggerUrl: string } | undefined;
  for (let attempt = 0; attempt < 120 && !page; attempt++) {
   try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (res.ok) page = (await res.json() as { type: string; webSocketDebuggerUrl: string }[]).find(t => t.type === 'page');
   } catch { /* the browser is still starting */ }
   if (!page) await sleep(250);
  }
  if (!page) throw new Error(`headless Chrome did not expose a page on ${port}`);
  debug('page target found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((ok, no) => { ws.once('open', () => ok()); ws.once('error', (e: Error) => no(e)); });
  let id = 0;
  const pending = new Map<number, (m: { result?: { result?: { value?: unknown } } }) => void>();
  const pageErrors: string[] = [];
  ws.on('message', (raw: string) => {
   const m = JSON.parse(raw) as { id?: number; method?: string; params?: { exceptionDetails?: { exception?: { description?: string }; text?: string } } };
   if (m.id && pending.has(m.id)) { pending.get(m.id)!(m as never); pending.delete(m.id); }
   else if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params?.exceptionDetails?.exception?.description ?? m.params?.exceptionDetails?.text ?? 'page error');
  });
  const send = (method: string, params: Record<string, unknown> = {}) => new Promise<{ result?: { result?: { value?: unknown } } }>(ok => {
   const i = ++id; pending.set(i, ok as never); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async <V>(expression: string): Promise<V> => {
   const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
   if (r.result && (r.result as { exceptionDetails?: unknown }).exceptionDetails) throw new Error(JSON.stringify((r.result as { exceptionDetails?: unknown }).exceptionDetails));
   return r.result?.result?.value as V;
  };
  const position = () => ev<[number, number, number]>('__CAMPUS.explorer.game.body.position.toArray()');
  const key = (type: string, code: string) => ev<boolean>(`window.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)},{code:${JSON.stringify(code)},bubbles:true,cancelable:true}));true`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const href = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}intro=0`;
  await send('Page.navigate', { url: href });
  for (let attempt = 0; attempt < 240; attempt++) {
   await sleep(250);
   const ready = await ev<boolean>('!!(window.__CAMPUS&&window.__CAMPUS.ready)').catch(() => false);
   if (ready) break;
   if (attempt % 20 === 0) debug(`waiting for __CAMPUS (${attempt * .25}s)`);
   if (attempt === 239) throw new Error('window.__CAMPUS never became ready');
  }
  debug('__CAMPUS ready');
  await sleep(500);
  const startUrl = await ev<string>('location.href');
  // The opening's invitation modal pauses the game once the player has moved; clearing the
  // story beat first is the same debug hook the other opening checks use.
  await ev('(()=>{try{__CAMPUS.openingDebug.readInvitation()}catch(e){}return true})()');
  await sleep(300);
  const begin = await ev<string>('(()=>{__CAMPUS.explorer.enterCompat();return __CAMPUS.explorer.game.pauseReason||""})()');
  const start = await position();
  trace.push({ mark: 'start', position: start, pauseReason: begin });

  /**
   * Walking. SwiftShader renders this campus at a few frames a second, so holding a key
   * would take minutes per metre. These legs drive the game's own fixed-step integrator
   * with the same `human` intent a held W produces (`check-opening-integration.ts` walks the
   * whole chapter this way); nothing is teleported and no position is written.
   */
  const walk = (label: string, x: number, z: number, tolerance = .14, maxSteps = 8000) =>
   ev<{ ok: boolean; steps: number; position: number[]; contacts?: unknown }>(`(()=>{
    const g=__CAMPUS.explorer.game; g.paused=false;
    for(let i=0;i<${maxSteps};i++){
     const dx=${x}-g.body.position.x, dz=${z}-g.body.position.z;
     if(Math.hypot(dx,dz)<=${tolerance}){g.human={forward:0,right:0,sprint:false};return {ok:true,steps:i,position:g.body.position.toArray()};}
     g.yaw=Math.atan2(-dx,-dz);
     g.human={forward:1,right:0,sprint:false};
     g.step(1/120);
    }
    g.human={forward:0,right:0,sprint:false};
    return {ok:false,steps:${maxSteps},position:g.body.position.toArray(),contacts:g.body.contacts};
   })()`).then(result => { trace.push({ mark: label, target: [x, z], ...result }); debug(`${label} ${result.ok ? 'reached' : 'BLOCKED'} ${JSON.stringify(result.position)} in ${result.steps} steps`); return result; });

  /**
   * A tight fixed-step burst. The lift's clock only runs while the world is queried, so
   * this is also how real time passes for it; a burst holds the main thread, which keeps
   * SwiftShader's multi-second frames from slicing the ride into 50 ms clock steps.
   */
  const stepLoop = (seconds: number, until = '') => ev<{ ok: boolean; y: number; x: number; z: number; steps: number; ms: number }>(`(()=>{
   const g=__CAMPUS.explorer.game; g.paused=false; g.human={forward:0,right:0,sprint:false};
   const t0=performance.now(), limit=${Math.round(seconds * 1000)}; let steps=0;
   while(performance.now()-t0<limit){
    g.step(1/120); steps++;
    ${until ? `if(${until}) break;` : ''}
   }
   return {ok:${until ? `(${until})` : 'true'},y:g.body.position.y,x:g.body.position.x,z:g.body.position.z,steps,ms:performance.now()-t0};
  })()`);

  // The keyboard path is real: a W down reaches the controller, which is what fills
  // `game.human`. Only the sustained walking uses the fixed-step loop above.
  await key('keydown', 'KeyW');
  const held = await ev<string[]>('__CAMPUS.explorer.state.keys');
  await key('keyup', 'KeyW');
  check(held.includes('KeyW'), 'browser:input', `a KeyW keydown did not reach the controller: ${JSON.stringify(held)}`);

  // The car opens its doors on the first query after load; give it its 0.8 s. At world start
  // that happens up at the landing (E.5), which is also what boots the lift's clock.
  const warm = await stepLoop(2);
  debug(`warm-up ${warm.steps} steps in ${Math.round(warm.ms)} ms`);
  const CZ_ = (L.z0 + L.z1) / 2;
  // Start the local leg at the errand's own Building 6 checkpoint — the pose a restored save
  // puts the player on. The campus approach from the B5 handoff is walked end to end, waypoint
  // by waypoint, by `check-opening-integration`; this gate measures the lift, not the plaza.
  const b6Start = O.checkpoints.b6;
  await ev(`(()=>{const g=__CAMPUS.explorer.game;g.body.position.fromArray(${JSON.stringify(b6Start)});g.body.velocity.set(0,0,0);g.body.grounded=true;g.paused=false;return true})()`);
  const porch = await walk('porch', HALL.door, HALL.z1 + .35);
  const inside = await walk('south-doors', HALL.door, HALL.z1 - 1.1);
  check(Math.abs(inside.position[2] - (HALL.z1 - 1.1)) < .9 && Math.abs(inside.position[1] - L.ground) < .05, 'browser:south-doors',
   `the player did not get through the hall's south doors: ${JSON.stringify(inside)}`);

  // E.5 in the browser. The car is parked at the landing, so the doorway must be blocked
  // *before* anyone calls it: walk up to it from outside the call point's radius and try.
  const approach = await walk('doorway-approach', L.x1 + .85, CZ_);
  check(approach.ok, 'browser:doorway-approach', `the player could not stand in front of the lift: ${JSON.stringify(approach)}`);
  const beforeCall = await walk('doorway-before-call', (L.x0 + L.x1) / 2, CZ_, .14, 600);
  check(!beforeCall.ok, 'browser:doorway-guarded',
   `the doorway let the player in with the car parked at the landing: ${JSON.stringify(beforeCall.position)}`);
  debug(`guarded doorway stopped the player at ${JSON.stringify(beforeCall.position)}`);

  // Call it the way a player does — by standing at the ground call point — then wait the
  // real descent out. Nothing here writes the car's position; the wait is measured.
  const atCall = await walk('call-point', B4_OFFICE.callGround.x + .45, B4_OFFICE.callGround.z, .18);
  check(atCall.ok, 'browser:call-point', `the player could not reach the ground call point: ${JSON.stringify(atCall)}`);
  const wait = await stepLoop(20, `__CAMPUS.openingDebug.office().lift.doors>0.99&&Math.abs(__CAMPUS.openingDebug.office().lift.y-${L.ground})<0.005`);
  debug(`called car ${wait.ok ? 'arrived' : 'TIMED OUT'} y=${wait.y} in ${wait.steps} steps / ${Math.round(wait.ms)} ms`);
  trace.push({ mark: 'car-called', ms: Math.round(wait.ms), position: [wait.x, wait.y, wait.z] });
  check(wait.ok, 'browser:call-answered', `the called car never reached the ground with its doors open: ${JSON.stringify(wait)}`);
  // The wait is checked in fixed steps, not wall-clock: the burst's step count times 1/120 is
  // exactly the game time the lift consumed, while its ms depend on how fast the machine steps.
  const minSteps = Math.round((L.dwellSeconds + 2 * L.doorSeconds + L.travelSeconds) * 120 * .9);
  check(wait.steps >= minSteps, 'browser:call-wait',
   `the descent was answered in ${wait.steps} steps; the ${L.dwellSeconds} s dwell + 2 × ${L.doorSeconds} s doors + ${L.travelSeconds} s ride needs at least ${minSteps}`);

  const aboard = await walk('car', (L.x0 + L.x1) / 2, CZ_);
  check(aboard.ok && aboard.position[0] < L.x1 - .12, 'browser:aboard', `the player never reached the car: ${JSON.stringify(aboard)}`);

  // The ride: 0.8 doors + 1.4 dwell + 0.8 doors + 6.0 travel + 0.8 doors. The car leaves on
  // its own once a passenger has stood in it for the dwell.
  // The brief's passenger rule: while the car is moving the player cannot walk out of it.
  const rising = await stepLoop(30, `g.body.position.y>${L.ground + .9}`);
  debug(`rising y=${rising.y}`);
  const escape = await walk('car-escape', L.x1 + 1.0, CZ_, .14, 300);
  check(!escape.ok, 'browser:sealed-car', `the player left the moving car: ${JSON.stringify(escape.position)}`);

  const ride = await stepLoop(30, `Math.abs(g.body.position.y-${L.landing})<=0.005`);
  // The doors take 0.8 s after the car stops; step through them before walking out.
  const doors = await stepLoop(2);
  debug(`doors settled y=${doors.y}`);
  const rideMs = ride.ms;
  debug(`ride ${ride.ok ? 'arrived' : 'TIMED OUT'} y=${ride.y} in ${ride.steps} steps / ${Math.round(ride.ms)} ms`);
  trace.push({ mark: 'arrived', position: [ride.x, ride.y, ride.z], ms: Math.round(rideMs), steps: ride.steps });
  check(Math.abs(ride.y - L.landing) <= .05, 'browser:landing',
   `the player's y ended at ${ride.y} m; the landing is ${L.landing} m`);

  const lobby = await walk('5f-lobby', LIFT_LANDING.lobbyX1 - .8, CZ_);
  const corridor = await walk('5f-corridor', LIFT_LANDING.corridorX1 - 1.0, CZ_, .20);
  check(Math.abs(corridor.position[1] - L.landing) <= .05, 'browser:corridor-floor',
   `the player left the 5F floor in the corridor: y ${corridor.position[1]}`);
  check(corridor.ok && corridor.position[0] > LIFT_LANDING.lobbyX1 + .5, 'browser:corridor', `the player did not reach the corridor: ${JSON.stringify(corridor)}`);
  check(lobby.ok, 'browser:lobby', `the player could not step out into the 5F lobby: ${JSON.stringify(lobby)}`);
  void porch;
  const endUrl = await ev<string>('location.href');
  check(endUrl === startUrl, 'browser:href', `location.href changed from ${startUrl} to ${endUrl}`);
  check(pageErrors.length === 0, 'browser:errors', `page errors: ${JSON.stringify(pageErrors.slice(0, 3))}`);
  await ev('(()=>{__CAMPUS.explorer.takeover();return true})()').catch(() => undefined);
  ws.close();
  return { trace, start, rideMs, endUrl, pageErrors };
 } finally {
  child.kill('SIGTERM');
 }
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
 const constants = constantReport();
 assertConstants(constants);
 const machine = machineReport();
 assertMachine(machine);
 const world = worldReport();
 assertWorld(world);

 console.log('== check-lift: B06 core lift and the 5F landing ==');
 console.log('constants:', JSON.stringify(constants, null, 1));
 console.log('machine:', JSON.stringify({ home: machine.home, supportAtHome: machine.supportAtHome, groundSupport: machine.groundSupport, midSupport: machine.midSupport, midY: machine.midY, final: machine.final, timeline: machine.timeline, measured: machine.measured }, null, 1));
 console.log('y-profile JSON:');
 console.log(JSON.stringify({ travelSeconds: L.travelSeconds, distance: LIFT_TRAVEL_DISTANCE, samples: machine.samples }, null, 1));
 console.log('world:', JSON.stringify(world, null, 1));

 const skipBrowser = process.env.LIFT_SKIP_BROWSER === '1';
 let browser: Awaited<ReturnType<typeof browserWalk>> | null = null;
 if (!skipBrowser) {
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(chrome)) {
   failures.push(`browser:chrome: no browser at ${chrome}; set CHROME_PATH`);
  } else {
   let server: Awaited<ReturnType<typeof createServer>> | null = null;
   let base = process.env.CAMPUS_URL;
   if (!base) {
    server = await createServer({ root: process.cwd(), logLevel: 'error', server: { host: '127.0.0.1', port: 5199, strictPort: true } });
    await server.listen();
    base = `http://127.0.0.1:5199/`;
   }
   try {
    browser = await browserWalk(base, chrome);
    console.log('browser:', JSON.stringify(browser, null, 1));
   } finally {
    if (server) await server.close();
   }
  }
 }

 if (failures.length) {
  console.error(`\ncheck-lift: FAIL — the lift does not fit the world (${failures.length} named case(s)):`);
  for (const failure of failures) console.error('  FAIL', failure);
  console.error('\nA red case here means the geometry or the machine is wrong, not the gate.');
  process.exitCode = 1;
 } else {
  const browserNote = browser ? 'browser walk reached the 5F corridor' : 'browser leg skipped (CAMPUS_URL unset or LIFT_SKIP_BROWSER=1)';
  console.log(`\ncheck-lift: PASS — 2.20 × 2.60 m car, 1.20 × 2.30 m door, ${L.travelSeconds} s ride to ${L.landing} m, ${browserNote}.`);
 }
}

const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
 // Exit deliberately instead of waiting for the event loop to drain. On 2026-11-25 a taken
 // port made this gate print FAIL and then sit alive for half an hour with the port still
 // held: a gate that never exits is indistinguishable from one that is still working, and
 // every orchestrator reads it as "running". The short delay lets the queued stderr land.
 const finish = (code: number) => setTimeout(() => process.exit(code), 50);
 main().then(
  () => finish(typeof process.exitCode === 'number' ? process.exitCode : 0),
  error => { console.error('check-lift: FAIL —', error); finish(1); });
}
