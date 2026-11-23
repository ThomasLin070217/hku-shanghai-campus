import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import WebSocket from 'ws';
import {createServer} from 'vite';
import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {B4_LAYOUT} from '../src/opening/b4Layout';
import {B4_LIFT as L, OPENING, OPENING_WORLD_REVISION} from '../src/opening/spatialLayout';
import {
 LIFT, LIFT_LANDING, LIFT_TRAVEL_DISTANCE, createLift, liftLandingBoxes, liftObstacleBoxes, liftObstacles, liftSupport,
 resetLift, stepLift, syncLiftObstacles,
} from '../src/opening/lift';

/**
 * B04 core lift + 5F landing gate (Task D, 2026-11-24).
 *
 *   1. the car, doorway, ground floor and landing match the brief's constants, read from
 *      `spatialLayout.ts` rather than restated here;
 *   2. `liftSupport` answers the car floor inside the car and `null` outside it, at every
 *      height the car can occupy;
 *   3. the state machine, stepped at a fixed 1/120 s, reaches `arrived` at the landing
 *      inside 12 s, never opens the doors while the car is moving, and takes 6.0 s to travel;
 *   4. the built navigation agrees: the shaft is hollow, the doorway is open once the car's
 *      doors are, the car is not buried, the 5F plate is a floor and its walls are solid;
 *   5. the 5F plate sits above the room's clear height and no obstacle other than the lift's
 *      own car reaches it;
 *   6. a headless browser walks the player in through the side door, rides, and walks the 5F
 *      corridor without the URL changing.
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

/**
 * The two solid layers the side entrance is cut through, named at their source:
 *  - `FACADE_SLAB` is the band-tower's front slab: `openingObstacles` carves it at `z1 − .2` from
 *    a mass whose front face sits `FACADE_SLAB_OUTSET` beyond the room's own front face, so its
 *    inner face is `b4.z1 + .10 − .20` = 20.40.
 *  - `B4_FRONT_WALL` is the room shell's front wall (`b4Layout.ts`, `opening-b4-wall-front-*`,
 *    authored `R.z1 − .13` … `R.z1 − .01`), whose inner face is 20.37 — the narrower reading,
 *    printed but not pinned.
 */
const FACADE_SLAB = .20, FACADE_SLAB_OUTSET = .10, B4_FRONT_WALL = .13;
const FACADE_INNER_Z = OPENING.b4.z1 + FACADE_SLAB_OUTSET - FACADE_SLAB;
const ROOM_WALL_INNER_Z = OPENING.b4.z1 - B4_FRONT_WALL;

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
 const floors = {
  ground: L.ground, landing: L.landing, floorToFloor: L.floorToFloor,
  storeys: 4, expectedLanding: r4(OPENING.b4.floor + 4 * L.floorToFloor),
  /** The car floor starts on the lobby floor, so the ride is 2 cm shorter than the landing. */
  travelDistance: r4(LIFT_TRAVEL_DISTANCE),
 };
 /** The side-door centre to the lift doorway: north along the west wall, then west. */
 const approach = {
  from: [r4((B4_LAYOUT.sideDoor.x0 + B4_LAYOUT.sideDoor.x1) / 2), B4_LAYOUT.sideDoor.z] as [number, number],
  north: r4(B4_LAYOUT.sideDoor.z - door.centre),
  west: r4((B4_LAYOUT.sideDoor.x0 + B4_LAYOUT.sideDoor.x1) / 2 - (L.x0 + L.x1) / 2),
  /**
   * The brief's "5–7 m along the west wall", under the ruled convention: the façade's inner
   * face → the lift doorway's near jamb. Both front layers are named at their source (see
   * `FACADE_INNER_Z` / `ROOM_WALL_INNER_Z`) so a change to either cannot drift silently.
   */
  facadeInner: r4(FACADE_INNER_Z),
  nearJamb: L.door.z1,
  innerFaceToNearJamb: r4(FACADE_INNER_Z - L.door.z1),
  roomWallInner: r4(ROOM_WALL_INNER_Z),
  roomWallToNearJamb: r4(ROOM_WALL_INNER_Z - L.door.z1),
 };
 return { revision: OPENING_WORLD_REVISION, car, door, floors, approach, lobbyWestFace: r4(OPENING.b4.x0 + .01 + B4_LAYOUT.wall) };
}

function assertConstants(constants: ReturnType<typeof constantReport>) {
 const { car, door, floors, approach } = constants;
 check(Math.abs(car.width - 2.20) < EPS, 'car:width', `car interior width ${car.width} m must be 2.20 m`);
 check(Math.abs(car.depth - 2.60) < EPS, 'car:depth', `car interior depth ${car.depth} m must be 2.60 m`);
 check(Math.abs(car.clearHeight - 2.60) < EPS, 'car:clear-height', `car clear height ${car.clearHeight} m must be 2.60 m`);
 check(Math.abs(door.z0 - 11.40) < EPS && Math.abs(door.z1 - 13.40) < EPS, 'door:span',
  `the doorway must be z 11.40…13.40, read ${door.z0}…${door.z1}`);
 check(Math.abs(door.width - 2.00) < EPS, 'door:width', `the doorway width ${door.width} m must be 2.00 m`);
 check(Math.abs(door.height - 2.30) < EPS, 'door:height', `the doorway height ${door.height} m must be 2.30 m`);
 check(Math.abs(car.eastFace - constants.lobbyWestFace) < EPS, 'car:east-face',
  `the car's east face ${car.eastFace} must be the lobby's west interior plane ${constants.lobbyWestFace}`);
 check(Math.abs(door.jambNorth - door.jambSouth) < EPS, 'door:centred',
  `the doorway must sit centred in the car: jambs ${door.jambNorth} / ${door.jambSouth}`);
 check(Math.abs(floors.ground - OPENING.b4.floor) < EPS, 'floor:ground',
  `the car floor at ground must be OPENING.b4.floor ${OPENING.b4.floor}, read ${floors.ground}`);
 check(Math.abs(floors.landing - 18.90) < EPS, 'floor:landing', `the 5F landing must be 18.90 m, read ${floors.landing}`);
 check(Math.abs(floors.landing - floors.expectedLanding) < EPS, 'floor:storeys',
  `the landing must be four 4.72 m storeys above the lobby: ${floors.expectedLanding}, read ${floors.landing}`);
 check(/v8/.test(constants.revision) && /lift/.test(constants.revision), 'revision:bumped',
  `OPENING_WORLD_REVISION must name the lift, read ${constants.revision}`);
 check(approach.innerFaceToNearJamb >= 5 - EPS && approach.innerFaceToNearJamb <= 7 + EPS, 'approach:distance',
  `the lift door must be 5–7 m along the west wall from the façade's inner face, measured ${approach.innerFaceToNearJamb} m`);
}

/* ------------------------------------------------------------------ */
/* 2 + 3. liftSupport and the state machine                            */
/* ------------------------------------------------------------------ */

interface ProfileSample { t: number; phase: string; y: number; doors: number }

function machineReport() {
 const s = createLift();
 const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
 const support: Record<string, unknown> = {
  inside: liftSupport(s, cx, cz),
  west: liftSupport(s, L.x0 - .01, cz),
  east: liftSupport(s, L.x1 + .01, cz),
  north: liftSupport(s, L.z0 - .01, cz),
  south: liftSupport(s, L.z1 + .01, cz),
 };
 const dt = 1 / 120, seconds = 12, samples: ProfileSample[] = [];
 const timeline: { t: number; phase: string }[] = [];
 let previous = s.phase, risingStart = -1, arrivedAt = -1, doorsOpenAt = -1, maxRise = 0;
 const beforeY = s.y;
 for (let step = 0; step * dt <= seconds + EPS; step++) {
  const t = +(step * dt).toFixed(6);
  if (s.phase !== previous) { timeline.push({ t, phase: s.phase }); previous = s.phase; }
  if (s.phase === 'rising' && risingStart < 0) risingStart = t;
  if (s.phase === 'arrived' && arrivedAt < 0) arrivedAt = t;
  if (s.phase === 'arrived' && s.doors > 0 && doorsOpenAt < 0) doorsOpenAt = t;
  // Record the rise *before* stepping: the car moves during the step, and this is the
  // distance the physics then has to carry the rider.
  const yBefore = s.y;
  stepLift(s, dt, true);
  maxRise = Math.max(maxRise, Math.abs(s.y - yBefore));
  if (step % 30 === 0) samples.push({ t, phase: s.phase, y: r4(s.y), doors: r4(s.doors) });
  if (s.phase === 'rising' && s.doors !== 0) check(false, 'machine:doors-while-rising', `the doors were ${s.doors} at t=${t} while the car was rising`);
 }
 samples.push({ t: 12, phase: s.phase, y: r4(s.y), doors: r4(s.doors) });
 const final = { phase: s.phase, y: s.y, doors: s.doors };
 /** The accel–cruise–decel profile's peak speed and peak acceleration, for the report. */
 const peakSpeed = LIFT_TRAVEL_DISTANCE / (L.travelSeconds * (1 - .25));
 return {
  support, beforeY, final, timeline, samples,
  measured: {
   travelled: r4(final.y - beforeY), travelSeconds: +(arrivedAt - risingStart).toFixed(4),
   doorsOpenedAt: +doorsOpenAt.toFixed(4), arrivedAt: +arrivedAt.toFixed(4),
   maxRisePerStep: +maxRise.toFixed(5), peakSpeed: +peakSpeed.toFixed(4),
   peakAcceleration: +(peakSpeed / (.25 * L.travelSeconds)).toFixed(4),
  },
 };
}

function assertMachine(report: ReturnType<typeof machineReport>) {
 const s = createLift(), cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
 check(report.support.inside === L.ground, 'support:inside', `liftSupport inside the car at rest must be ${L.ground}, read ${report.support.inside}`);
 for (const side of ['west', 'east', 'north', 'south'] as const) {
  check(report.support[side] === null, `support:${side}`, `liftSupport ${side} of the car must be null, read ${report.support[side]}`);
 }
 stepLift(s, 6, true);
 check(Math.abs(liftSupport(s, cx, cz)! - s.y) < EPS, 'support:follows', 'liftSupport must follow the car floor');
 // One 6 s call only opens the doors, so the line above sees the car at the ground. Drive two
 // fresh cars to prove the answer tracks the floor at height and leaves the lobby behind.
 const mid = createLift();
 for (let i = 0; i < 12 * 120 && !(mid.phase === 'rising' && mid.y > 6); i++) stepLift(mid, 1 / 120, true);
 const midSupport = liftSupport(mid, cx, cz);
 check(mid.y > 6 && midSupport === mid.y, 'support:follows-mid-rise',
  `liftSupport must return the car's own height mid-rise, read ${midSupport} against ${mid.y} in phase '${mid.phase}'`);
 const top = createLift();
 for (let i = 0; i < 12 * 120; i++) stepLift(top, 1 / 120, true);
 const topSupport = liftSupport(top, cx, cz);
 check(topSupport === L.landing, 'support:follows-landing',
  `liftSupport must return the landing ${L.landing} once the car is up, read ${topSupport}`);
 check(topSupport !== L.ground, 'support:left-ground',
  `liftSupport still reports the lobby floor ${L.ground} after the car has left it`);
 check(report.final.phase === 'arrived', 'machine:arrived', `12 s of travel must end in 'arrived', read '${report.final.phase}'`);
 check(report.final.y === L.landing, 'machine:landing', `the car must stop exactly on the landing ${L.landing}, read ${report.final.y}`);
 check(report.final.doors === 1, 'machine:doors-open', `the doors must be open on arrival, read ${report.final.doors}`);
 check(report.measured.travelSeconds >= L.travelSeconds - 1e-3 && report.measured.travelSeconds <= L.travelSeconds + 1e-3, 'machine:travel-time',
  `the ride must take ${L.travelSeconds} s, measured ${report.measured.travelSeconds} s`);
 check(report.measured.doorsOpenedAt >= report.measured.arrivedAt - EPS, 'machine:doors-after-stop',
  `the doors opened at ${report.measured.doorsOpenedAt} s but the car only stopped at ${report.measured.arrivedAt} s`);
 check(report.measured.maxRisePerStep <= .24, 'machine:step-rise',
  `one fixed step lifted the car ${report.measured.maxRisePerStep} m, more than the physics' 0.24 m step`);
 check(Math.abs(report.measured.travelled - LIFT_TRAVEL_DISTANCE) < 1e-6, 'machine:distance',
  `the ride covered ${report.measured.travelled} m, expected ${LIFT_TRAVEL_DISTANCE}`);
}

/* ------------------------------------------------------------------ */
/* 4 + 5. The built world                                              */
/* ------------------------------------------------------------------ */

function worldReport() {
 resetLift();
 const nav = createNavigation(BUILDINGS, SITE, true);
 const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, doorX = L.x1 - L.wall / 2;
 const at = (name: string, x: number, z: number, y: number) => ({ name, x: r4(x), z: r4(z), y: r4(y), blocked: nav.blocked(x, z, y) });
 const closed = {
  carInterior: at('car interior', cx, cz, L.ground),
  threshold: at('closed threshold', doorX, cz, L.ground),
  sideDoor: at('side door', 47.75, 20.5, .5),
  shaftMid: at('shaft at 10 m', cx, cz, 10),
  massWest: at('mass west of the shaft', L.x0 - .45, cz, 10),
  massAbove: at('mass above the shaft', cx, cz, L.landing + L.clearHeight + .6),
  groundUnderPlate: at('lobby floor under the plate', 47.0, cz, L.ground),
  plate: at('5F plate', 47.0, cz, L.landing),
  plateNorthWall: at('5F north wall', 47.0, L.z0 - .06, L.landing),
  corridor: at('5F corridor', 52.0, cz, L.landing),
  officeDoor: at('office door', LIFT_LANDING.corridorX1 + .06, cz, L.landing),
 };
 // Open the car's doors on the same objects the navigation holds, then re-test.
 stepLift(LIFT, 1, false);
 syncLiftObstacles();
 const open = { threshold: at('open threshold', doorX, cz, L.ground) };
 const plateSupport = nav.support(47.0, cz, L.landing);
 // Every obstacle that can reach the plate, and every one that intersects the landing
 // footprint at any height, so the report carries the evidence for the D.3 assertion.
 const landingRects = [
  { x0: L.x1, x1: LIFT_LANDING.lobbyX1, z0: L.z0, z1: L.z1 },
  { x0: LIFT_LANDING.lobbyX1, x1: LIFT_LANDING.corridorX1, z0: LIFT_LANDING.corridorZ0, z1: LIFT_LANDING.corridorZ1 },
 ];
 const overlaps = (o: { x: number; z: number; w: number; d: number }, r: { x0: number; x1: number; z0: number; z1: number }) =>
  o.x - o.w / 2 < r.x1 - EPS && o.x + o.w / 2 > r.x0 + EPS && o.z - o.d / 2 < r.z1 - EPS && o.z + o.d / 2 > r.z0 + EPS;
 const reaching = nav.obstacles
  .filter(o => o.top > LIFT_LANDING.floorTop + EPS)
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
 // right. Drive it to the landing and sync once: the mounted box can only reach 18.9 by being
 // rewritten in place, so this is the proof that the loop above measured the live objects.
 for (let i = 0; i < 12 * 120; i++) stepLift(LIFT, 1 / 120, true);
 syncLiftObstacles();
 const carBoxStillMounted = !!carFloor && nav.obstacles.includes(carFloor);
 const carFloorFollows = !!carFloor && LIFT.y === L.landing && Math.abs(carFloor.top - LIFT.y) < 1e-12;
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
 return { closed, open, plateSupport: r4(plateSupport ?? NaN), reaching, underPlate, shaftColumn, carBoxes, landingBoxes, missing, duplicated, obstacleCount, cost };
}

function assertWorld(report: ReturnType<typeof worldReport>) {
 const b = (name: string) => report.closed[name as keyof typeof report.closed] as { blocked: boolean; x: number; y: number; z: number };
 check(!b('carInterior').blocked, 'world:car-interior', `the car interior at (${b('carInterior').x}, ${b('carInterior').z}) is solid at the car floor`);
 check(b('threshold').blocked, 'world:closed-door', 'the closed car doors must block the threshold');
 check(!report.open.threshold.blocked, 'world:open-door', 'the open car doors must clear the threshold');
 check(!b('sideDoor').blocked, 'world:side-door', 'the Task C side entrance must stay open');
 check(!b('shaftMid').blocked, 'world:shaft', `the shaft is still solid at 10 m: the band-tower mass was not carved`);
 check(b('massWest').blocked, 'world:shaft-west', 'the mass west of the shaft must stay solid');
 check(b('massAbove').blocked, 'world:shaft-top', 'the mass above the 5F car must stay solid');
 check(!b('groundUnderPlate').blocked, 'world:lobby-under-plate', 'the ground lobby must stay walkable under the 5F plate');
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
 check(LIFT_LANDING.floorTop > OPENING.b4.floor + OPENING.b4.clearHeight, 'plate:above-room',
  `the plate ${LIFT_LANDING.floorTop} must clear the room's ${OPENING.b4.floor + OPENING.b4.clearHeight} m clear height`);
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

  // The car opens its doors on the first query after load; give it its 0.8 s.
  const warm = await stepLoop(2);
  debug(`warm-up ${warm.steps} steps in ${Math.round(warm.ms)} ms`);
  const porch = await walk('porch', 47.75, 21.0);
  const inside = await walk('side-door', 47.75, 12.9);
  check(Math.abs(inside.position[2] - 12.9) < .9 && Math.abs(inside.position[1] - L.ground) < .05, 'browser:side-door',
   `the player did not get through the side door: ${JSON.stringify(inside)}`);
  const aboard = await walk('car', 45.05, 12.4);
  check(aboard.ok && aboard.position[0] < L.x1 - .12, 'browser:aboard', `the player never reached the car: ${JSON.stringify(aboard)}`);

  // The ride: 0.8 doors + 1.4 dwell + 0.8 doors + 6.0 travel + 0.8 doors. The car leaves on
  // its own once a passenger has stood in it for the dwell.
  // The brief's passenger rule: while the car is moving the player cannot walk out of it.
  const rising = await stepLoop(30, `g.body.position.y>6`);
  debug(`rising y=${rising.y}`);
  const escape = await walk('car-escape', 47.6, 12.4, .14, 300);
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

  const lobby = await walk('5f-lobby', 47.6, 12.4);
  const corridor = await walk('5f-corridor', 54.4, 12.4, .20);
  check(Math.abs(corridor.position[1] - L.landing) <= .05, 'browser:corridor-floor',
   `the player left the 5F floor in the corridor: y ${corridor.position[1]}`);
  check(corridor.ok && corridor.position[0] > 52.5, 'browser:corridor', `the player did not reach the corridor: ${JSON.stringify(corridor)}`);
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

 console.log('== check-lift: B04 core lift and the 5F landing (Task D) ==');
 console.log('constants:', JSON.stringify(constants, null, 1));
 console.log('machine:', JSON.stringify({ support: machine.support, final: machine.final, timeline: machine.timeline, measured: machine.measured }, null, 1));
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
  console.log(`\ncheck-lift: PASS — 2.20 × 2.60 m car, 2.00 × 2.30 m door, ${L.travelSeconds} s ride to ${L.landing} m, ${browserNote}.`);
 }
}

const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
 main().catch(error => { console.error('check-lift: FAIL —', error); process.exitCode = 1; });
}
