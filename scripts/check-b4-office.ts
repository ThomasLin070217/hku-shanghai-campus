import fs from 'node:fs';
import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {B4_LAYOUT, B4_OBSTACLES, B4_TIERS} from '../src/opening/b4Layout';
import {B4_LIFT as L, OPENING} from '../src/opening/spatialLayout';
import {
 B4_OFFICE, OFFICE_CUES, installOffice, officeDebug, officeDoorOffered, openOfficeDoor, resetOffice, setOfficeArmed, tickOffice,
} from '../src/opening/b4Office';
import {
 LIFT, LIFT_LANDING, LIFT_TRAVEL_DISTANCE, callLift, liftDebug, liftLandingContains, resetLift, stepLift, syncLiftObstacles, tickLift,
} from '../src/opening/lift';
import {buildB4Shell} from '../src/opening/b4Shell';
import {STORY_AUDIO_URLS} from '../src/gameplay/storyAudioAssets';

/**
 * The 5F principal's office, the three abduction beats, and the lift back down (Task E).
 *
 *   1. the office, the monitor, the call points, the guards and the dressing read from Task D's
 *      geometry (`LIFT_LANDING`, `B4_LIFT`) rather than restating a number;
 *   2. the E.8 dressing exists in the built shell and has no collision;
 *   3. both shaft openings are sealed by a guard whenever the car is on the other floor, and
 *      open when it is there (A.3.1);
 *   4. a ground call is a real 6.000 s accel–cruise–decel descent, sampled at fixed fractions
 *      (E.5, E-F4);
 *   5. the errand route — side door, monitor, ground call, car, 5F call, corridor, office door,
 *      desk — is walkable at every 5 cm sample once the doors it needs are open, and the closed
 *      office door really blocks the room until its leaf has swung clear (E.6);
 *   6. the three beats are dark until the errand arms them and then fire in route order, all of
 *      them before the door opens, and latch (E-F3);
 *   7. the call lamps report lit-while-called / dark-on-arrival (E-F10), every cue the office
 *      plays exists in the audio manifest, and the stairs claim is proved structurally (E-F7);
 *   8. the lift descends in the same 6.000 s shape it rises, never opens its doors while moving,
 *      carries the rider's floor, dispatches an empty car, and `resetLift` parks it at the
 *      landing with the clock bootstrapped (E.0, E-F5, E-F6).
 *
 * The rider's body is proved in the browser gate (`check-b4-errand.py`), which rides down after
 * `take_laptop` and measures the player's `y` against the car floor. Node only: the visuals and
 * the browser walk are the other half.
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
const DOOR_PLANE = L.x1 - L.wall / 2;         // the lobby/lift threshold's plane

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
const corridorRect: Rect = {
 x0: LIFT_LANDING.lobbyX1, x1: LIFT_LANDING.corridorX1, z0: LIFT_LANDING.corridorZ0, z1: LIFT_LANDING.corridorZ1,
};

const geometry = {
 room: {x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1, floor: r4(R.floor), clearHeight: R.clearHeight},
 sideDoor: {x0: SD.x0, x1: SD.x1, z: r4(SD.z)},
 car: {x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1, ground: r4(GROUND), landing: r4(L.landing)},
 doorway: {...L.door},
 landing: {...LIFT_LANDING},
 office: {
  door: B4_OFFICE.door, interior: B4_OFFICE.interior, desk: B4_OFFICE.desk,
  laptop: B4_OFFICE.laptop, laptopStand: B4_OFFICE.laptopStand, shelf: B4_OFFICE.shelf,
 },
 dressing: B4_OFFICE.dressing,
 doorSwingSeconds: B4_OFFICE.doorSwingSeconds,
};

const inside = (x: number, z: number, r: Rect) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const span = (v: number, r: {z0: number; z1: number}) => v >= r.z0 && v <= r.z1;

check(R.floor === OPENING.b4.floor, 'geometry:room-floor', `the room's floor ${R.floor} must be the opening's B4 floor ${OPENING.b4.floor}`);
check(near(L.landing - L.ground, LIFT_TRAVEL_DISTANCE, 1e-9), 'geometry:travel',
 `the landing stands ${r4(L.landing - L.ground)} m above the ground, ${r4(LIFT_TRAVEL_DISTANCE)} m of travel`);

// The monitor hangs on the west wall between the side door and the lift doorway, facing the
// player walking in — that is what makes beat 1 a first *look* rather than a proximity ping.
// It is angled on a bracket, so "on the wall" is a reach, not a single x: the frame's north
// edge swings `.48·sin(tilt)` off the wall and must clear it while its south edge stays on it.
const cctvReach = .035 * Math.cos(B4_OFFICE.cctv.tilt) + (B4_OFFICE.cctv.w + .06) / 2 * Math.abs(Math.sin(B4_OFFICE.cctv.tilt));
check(B4_OFFICE.cctv.x - cctvReach >= L.x1, 'geometry:cctv-clear-of-wall',
 `the monitor's north edge must stand clear of the west wall at x ${L.x1}, reach ${r4(B4_OFFICE.cctv.x - cctvReach)}`);
check(B4_OFFICE.cctv.x - cctvReach <= L.x1 + .06, 'geometry:cctv-on-wall',
 `the monitor must hang on the wall, not float off it: gap ${r4(B4_OFFICE.cctv.x - cctvReach - L.x1)} m`);
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
check(inside(corridorMid.x, corridorMid.z, corridorRect), 'geometry:corridor-beat-inside',
 `the corridor trigger centre (${r4(corridorMid.x)}, ${r4(corridorMid.z)}) must be inside the corridor`);
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

// The ground guard (A.3.1): in the doorway itself, the full width of the door, sealed to the
// **ground lobby's** ceiling, and 1 cm west of the lobby's west face so it never overlaps a
// floor plate. Not to the shaft's top: the car's own 5F doorway is at this same plane, so a
// taller guard would seal the way out of the lift whenever the car is parked upstairs.
const GROUND_CEIL = R.floor + R.clearHeight;   // 4.32, the B04 lobby's ceiling
check(near(B4_OFFICE.groundGuard.x1, L.x1, 1e-9) && near(B4_OFFICE.groundGuard.x0, L.x1 - .05, 1e-9),
 'geometry:ground-guard-plane', `the ground guard must sit in the doorway plane x ${L.x1}, read ${B4_OFFICE.groundGuard.x0}…${B4_OFFICE.groundGuard.x1}`);
check(near(B4_OFFICE.groundGuard.z0, L.door.z0, 1e-9) && near(B4_OFFICE.groundGuard.z1, L.door.z1, 1e-9),
 'geometry:ground-guard-span', `the ground guard must span the 2.00 m doorway z ${L.door.z0}…${L.door.z1}`);
check(near(B4_OFFICE.groundGuard.top, GROUND_CEIL, 1e-9),
 'geometry:ground-guard-height', `the ground guard must seal the ground lobby to its ceiling ${GROUND_CEIL}, read ${B4_OFFICE.groundGuard.top}`);
check(B4_OFFICE.groundGuard.top < LIFT_LANDING.floorTop,
 'geometry:ground-guard-below-5f', `the ground guard must stay under the 5F plate ${LIFT_LANDING.floorTop}, or it seals the car's own 5F doorway, read ${B4_OFFICE.groundGuard.top}`);

// E.8's dressing: on the corridor wall / in the corridor / in the lobby, all scenery.
const D = B4_OFFICE.dressing;
check(inside(D.evacSign.x, D.evacSign.z, corridorRect) && D.evacSign.y > FLOOR + .8 && D.evacSign.y < FLOOR + 2.2,
 'geometry:dressing-evac', `the evacuation notice must hang on a corridor wall at eye height, read ${JSON.stringify(D.evacSign)}`);
check(D.evacSign.z <= LIFT_LANDING.corridorZ0 + .05, 'geometry:dressing-evac-wall',
 `the evacuation notice must be on the corridor's north wall ${LIFT_LANDING.corridorZ0}, read z ${D.evacSign.z}`);
// E.11: the trolley stands mid-corridor, not against a wall. Its rotated footprint is the
// deck's .60 × .95 m box at its yaw, so "clear of the walls" is a computed reach, not a centre.
const trolleyHalfX = .30 * Math.abs(Math.cos(D.trolley.yaw)) + .475 * Math.abs(Math.sin(D.trolley.yaw));
const trolleyHalfZ = .30 * Math.abs(Math.sin(D.trolley.yaw)) + .475 * Math.abs(Math.cos(D.trolley.yaw));
check(inside(D.trolley.x, D.trolley.z, corridorRect) && near(D.trolley.y, FLOOR, 1e-9),
 'geometry:dressing-trolley', `the trolley must stand on the 5F corridor floor, read ${JSON.stringify(D.trolley)}`);
check(D.trolley.z - trolleyHalfZ > LIFT_LANDING.corridorZ0 + .28 && D.trolley.z + trolleyHalfZ < LIFT_LANDING.corridorZ1 - .28,
 'geometry:dressing-trolley-clear',
 `the trolley must stand clear of both corridor walls (${LIFT_LANDING.corridorZ0}…${LIFT_LANDING.corridorZ1}), reach ${r4(D.trolley.z - trolleyHalfZ)}…${r4(D.trolley.z + trolleyHalfZ)}`);
check(D.trolley.x - trolleyHalfX > corridorRect.x0 + .4 && D.trolley.x + trolleyHalfX < corridorRect.x1 - .4,
 'geometry:dressing-trolley-mid',
 `the trolley must stand mid-corridor, not in either mouth, reach ${r4(D.trolley.x - trolleyHalfX)}…${r4(D.trolley.x + trolleyHalfX)}`);
check(Math.abs(Math.sin(D.trolley.yaw)) > .5, 'geometry:dressing-trolley-angled',
 `the trolley must be angled across the walk, as if abandoned, read yaw ${D.trolley.yaw}`);
check(inside(D.flickerPanel.x, D.flickerPanel.z, corridorRect) && near(D.flickerPanel.y, LIFT_LANDING.ceilBottom - .02, 1e-9),
 'geometry:dressing-flicker', `the flickering panel must be a corridor ceiling panel, read ${JSON.stringify(D.flickerPanel)}`);
check(B4_OFFICE.doorSwingSeconds >= .6 && B4_OFFICE.doorSwingSeconds <= 1.2, 'geometry:door-swing-seconds',
 `the office door's swing must last 0.6–1.2 s, read ${B4_OFFICE.doorSwingSeconds}`);

/* ------------------------------------------------------------------ */
/* 2. The built shell carries the dressing, and none of it collides    */
/* ------------------------------------------------------------------ */

const shell = buildB4Shell();
const dressingParts = ['B04_5f_trolley', 'B4_lift_5f_evac_sign', 'B4_lift_5f_flicker'];
for (const name of dressingParts) {
 check(!!shell.getObjectByName(name), `dressing:${name}`, `${name} is not in the built B04 shell`);
}
const shellLights: unknown[] = [];
shell.traverse(o => { if ((o as {isLight?: boolean}).isLight) shellLights.push(o.name); });
check(shellLights.length === 0, 'dressing:no-lights', `the shell must carry zero lights, read ${JSON.stringify(shellLights)}`);
/** The dressing is scenery only: a gate that added collision would change the walk. */
const dressingCollision = ['trolley', 'evac', 'flicker'];

/* ------------------------------------------------------------------ */
/* 3. The built world (mounts the office boxes and the guards)          */
/* ------------------------------------------------------------------ */

const nav = createNavigation(BUILDINGS, SITE, true);
dressingCollision.forEach(word => {
 const hit = nav.obstacles.filter(o => o.name.toLowerCase().includes(word)).map(o => o.name);
 check(hit.length === 0, `dressing:no-collision:${word}`, `the ${word} must not be a collision box, read ${JSON.stringify(hit)}`);
});

const guardBox = () => {
 const o = nav.obstacles.find(b => b.name === 'opening-office-ground-guard');
 return o ? {bottom: r4(o.bottom), top: r4(o.top)} : null;
};

/** Re-sync both shaft guards after moving the car by hand (the game does this in `tickOffice`). */
function settle(): void {
 syncLiftObstacles();
 installOffice(nav.obstacles);
}

/* ------------------------------------------------------------------ */
/* 4. A.3.1 — the ground doorway while the car is at the landing       */
/* ------------------------------------------------------------------ */

setOfficeArmed(false);
resetLift();
resetOffice();
settle();
check(near(guardBox()?.top ?? -1, GROUND_CEIL, 1e-9) && near(guardBox()?.bottom ?? -1, GROUND, 1e-9),
 'guard:up-solid', `with the car at the landing the ground guard must be solid to the lobby ceiling ${GROUND_CEIL}, read ${JSON.stringify(guardBox())}`);
check(nav.blocked(DOOR_PLANE, CZ, GROUND), 'guard:up-blocks',
 'with the car at the landing the lobby doorway must be solid — behind it is an 18.9 m shaft');
check(!nav.blocked(47.0, CZ, GROUND), 'guard:up-lobby-walkable',
 'the lobby itself must stay walkable with the car up');

/* ------------------------------------------------------------------ */
/* 5. E.5 + E-F4 — a ground call is a real 6.000 s descent, sampled    */
/* ------------------------------------------------------------------ */

const descent = (() => {
 callLift('ground');
 const called = LIFT.call;
 let descendAt = -1, arriveAt = -1, doorsWhileMoving = 0, t = 0;
 const ys: number[] = [];           // the car floor after every step of the descent
 for (let i = 1; i <= 1600; i++) {
  t = i / 120;
  stepLift(LIFT, 1 / 120, false);
  if (LIFT.phase === 'descending' || (LIFT.phase === 'arrived' && arriveAt < 0)) {
   if (descendAt < 0) descendAt = (i - 1) / 120;
   ys.push(LIFT.y);
  }
  if (LIFT.phase === 'descending' && LIFT.doors !== 0) doorsWhileMoving++;
  if (LIFT.phase === 'arrived') { arriveAt = t; break; }
 }
 return {called, descendAt, arriveAt, seconds: arriveAt - descendAt, doorsWhileMoving, ys, stopsAt: LIFT.y, call: LIFT.call};
})();

check(descent.called === 'ground', 'descent:call-registered', `the ground call must be recorded, read ${JSON.stringify(descent.called)}`);
check(near(descent.seconds, L.travelSeconds, 1 / 120 + 1e-9), 'descent:duration',
 `the descent must take ${L.travelSeconds} s, measured ${r4(descent.seconds)} s`);
check(near(LIFT.y, GROUND, .05), 'descent:floor', `the car must come down within 0.05 m of ${GROUND}, read ${LIFT.y}`);
check(descent.doorsWhileMoving === 0, 'descent:doors-shut', `the doors opened ${descent.doorsWhileMoving} times while the car was moving`);
check(descent.call === null, 'descent:call-cleared', `arrival must clear the landing call, read ${JSON.stringify(descent.call)}`);
check(descent.ys.length >= 700, 'descent:samples', `the descent must be sampled step by step, read ${descent.ys.length} samples`);
check(descent.ys.every((y, i) => i === 0 || y < descent.ys[i - 1]), 'descent:monotonic',
 'every step of the descent must be strictly below the one before it — a snap to the floor would not be');
/**
 * E-F4: the accel–cruise–decel shape, not just the duration. The first and last quarter-second
 * must cover far less than a quarter-second at cruise speed; a linear descent would make all
 * three windows equal and a snapped one would make the first window the whole ride.
 */
const profile = (() => {
 const ys = descent.ys;
 const drop = (a: number, b: number) => r4(ys[a] - ys[b]);
 const start = drop(0, 30), mid = drop(345, 375), end = drop(ys.length - 31, ys.length - 1);
 return {start, mid, end, ratioStart: +(start / mid).toFixed(4), ratioEnd: +(end / mid).toFixed(4)};
})();
check(profile.start > 0 && profile.mid > 0 && profile.end > 0, 'descent:profile-moves',
 `every quarter-second window must move the car, read ${JSON.stringify(profile)}`);
check(profile.start < profile.mid * .30, 'descent:profile-start',
 `the first 0.25 s must be sub-linear: ${profile.start} m against ${profile.mid} m at cruise`);
check(profile.end < profile.mid * .30, 'descent:profile-end',
 `the last 0.25 s must be sub-linear: ${profile.end} m against ${profile.mid} m at cruise`);
check(profile.mid > LIFT_TRAVEL_DISTANCE * .05, 'descent:profile-cruise',
 `the middle 0.25 s must run near cruise speed: ${profile.mid} m, against ${r4(LIFT_TRAVEL_DISTANCE / L.travelSeconds * .25)} m for a linear descent`);

// The doors only open once the car has stopped, and then the ground guard has no height.
let doorOpenedAtY: number | null = null;
for (let i = 0; i < 200 && LIFT.doors < 1; i++) {
 const before = LIFT.doors;
 stepLift(LIFT, 1 / 120, false);
 if (LIFT.doors > before && doorOpenedAtY === null) doorOpenedAtY = r4(LIFT.y);
}
settle();
check(LIFT.doors === 1, 'descent:doors-open-at-ground', `the doors must open at the ground, read ${r4(LIFT.doors)}`);
check(doorOpenedAtY === GROUND, 'descent:doors-after-stop',
 `the doors began opening at y ${doorOpenedAtY}, not at the stopped car's ${GROUND}`);
check(guardBox() !== null && guardBox()!.top === guardBox()!.bottom, 'guard:down-open',
 `with the car at the ground the ground guard must have no height, read ${JSON.stringify(guardBox())}`);
check(!nav.blocked(DOOR_PLANE, CZ, GROUND), 'guard:down-passes',
 'with the car at the ground the lobby doorway must be open — the car is the floor there');

/* ------------------------------------------------------------------ */
/* 6. The route                                                        */
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
/** The leg that crosses the office doorway: blocked while the leaf is shut (or still moving). */
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

const blockedAt = (pts: P[], y: number) => pts.filter(p => nav.blocked(p.x, p.z, y)).map(p => ({x: r4(p.x), z: r4(p.z)}));

const groundBlocked = blockedAt(groundSamples, GROUND);
check(groundBlocked.length === 0, 'route:ground-walkable',
 `the side door → monitor → call → car route must be walkable, blocked at ${JSON.stringify(groundBlocked.slice(0, 6))}`);

// E.6: the office door has a swing, and the doorway stays solid until the leaf has cleared it.
check(!officeDebug().doorOpen, 'route:door-starts-closed', 'the office door must start closed');
const doorClosedBlocked = blockedAt(samples(doorLeg), FLOOR);
check(doorClosedBlocked.length > 0, 'route:closed-door-blocks', 'a closed office door must block the way into the office');
check(nav.blocked(B4_OFFICE.door.x0, CZ, FLOOR), 'route:closed-leaf-solid', 'the closed leaf must be the thing blocking the doorway');
check(openOfficeDoor(), 'route:door-opens', 'the office door must open on interaction');
const swingStart = Date.now();
const swingTarget = officeDebug().door.target;
// C.2: sample at ~50 % of the swing, not at t≈0. `tickOffice` drives the leaf on the wall
// clock; the doorway must still be solid when the leaf is visibly half open. Sampling before
// the first tick only catches an implementation that clears the doorway instantly.
let midSwing: {angle: number; blocked: number; swinging: boolean} | null = null;
// Advance the swing on the wall clock the way `tickOffice` does, and measure how long it takes.
let swingMs = -1;
for (let i = 0; i < 400; i++) {
 tickOffice(CX, CZ, FLOOR);
 const d = officeDebug().door;
 if (midSwing === null && d.swinging && d.angle <= swingTarget * .5) {
  midSwing = {angle: d.angle, blocked: blockedAt(samples(doorLeg), FLOOR).length, swinging: d.swinging};
 }
 if (!d.swinging && d.angle <= d.target + 1e-6) { swingMs = Date.now() - swingStart; break; }
 const until = Date.now() + 16;
 while (Date.now() < until) { /* let the wall clock reach the next frame */ }
}
check(midSwing !== null && midSwing.swinging && Math.abs(midSwing.angle) >= Math.abs(swingTarget) * .4,
 'route:swing-still-solid',
 `the doorway must be sampled mid-swing, read ${midSwing ? JSON.stringify(midSwing) : 'no mid-swing sample'}`);
check(midSwing !== null && midSwing.blocked > 0, 'route:swing-blocked-mid',
 `the doorway must stay solid while the leaf is moving, blocked at ${JSON.stringify(midSwing)}`);
check(swingMs >= 0, 'route:swing-finishes', 'the office door swing must finish');
check(swingMs >= (B4_OFFICE.doorSwingSeconds - .15) * 1000 && swingMs <= (B4_OFFICE.doorSwingSeconds + .35) * 1000,
 'route:swing-duration', `the swing must take about ${B4_OFFICE.doorSwingSeconds} s, measured ${swingMs} ms`);
const doorOpenBlocked = blockedAt(samples(doorLeg), FLOOR);
check(doorOpenBlocked.length === 0, 'route:open-door-passes',
 `an open office door must let the player through, blocked at ${JSON.stringify(doorOpenBlocked.slice(0, 4))}`);
check(!nav.blocked(B4_OFFICE.door.x0, CZ, FLOOR), 'route:open-door-leaf', 'the open leaf must clear its own doorway');

// The 5F walk happens with the car at the landing, where the errand leaves it: board, ride up,
// let the doors open. The beats are unarmed here, so none of this fires anything.
let upForWalk = 0;
while ((LIFT.phase !== 'arrived' || LIFT.y < L.landing - .01) && upForWalk++ < 8000) stepLift(LIFT, 1 / 120, true);
for (let i = 0; i < 200 && LIFT.doors < 1; i++) stepLift(LIFT, 1 / 120, true);
settle();
check(near(LIFT.y, FLOOR, 1e-9), 'route:car-at-landing', `the fifth-floor walk needs the car at the landing, read ${LIFT.y}`);

const fifthBlocked = blockedAt(fifthSamples, FLOOR);
check(fifthBlocked.length === 0, 'route:fifth-walkable',
 `the car → 5F call → corridor → office → desk route must be walkable, blocked at ${JSON.stringify(fifthBlocked.slice(0, 6))}`);
check(nav.support(B4_OFFICE.laptopStand.x, B4_OFFICE.laptopStand.z, FLOOR + .1) === FLOOR, 'route:office-floor',
 'the office floor must support the player at the stand spot');

/* ------------------------------------------------------------------ */
/* 7. The beats — dark until armed (E-F3), then in route order         */
/* ------------------------------------------------------------------ */

// A clean cold start: the car at the landing, the door shut, the beats clear and disarmed.
resetLift();
resetOffice();
settle();
check(Object.values(officeDebug().beats).every(t => t === null), 'beats:reset-clear', 'a reset must clear every beat');

// The defect path E-F3 closes: a player who walks the whole lobby and the whole 5F corridor,
// and even watches the car's doors close, must latch nothing before the errand is accepted.
for (const p of groundSamples) tickOffice(p.x, p.z, GROUND);
for (const p of fifthSamples) tickOffice(p.x, p.z, FLOOR);
let unarmedClosing = 0;
for (let i = 0; i < 1200 && LIFT.phase !== 'descending'; i++) {
 stepLift(LIFT, 1 / 120, true);
 tickOffice(CX, CZ, LIFT.y);
 if (LIFT.phase === 'doors-closing') unarmedClosing++;
}
const beforeArm = officeDebug();
check(unarmedClosing > 0, 'beats:unarmed-saw-doors-close', 'the unarmed pass must actually reach doors-closing, or it proves nothing');
check(Object.values(beforeArm.beats).every(t => t === null), 'beats:dark-before-errand',
 `no beat may fire before the errand arms them, read ${JSON.stringify(beforeArm.beats)}`);
check(beforeArm.doorOpen === false, 'beats:unarmed-door-shut', 'walking in unarmed must not open the office door');

// Arm it: the errand has been accepted.
setOfficeArmed(true);
resetLift();
resetOffice();
settle();
check(officeDebug().armed, 'beats:armed', 'setOfficeArmed must be readable through officeDebug');

/* ------------------------------------------------------------------ */
/* 7b. The door offer (Addendum 5 C.3) — each term of the rule         */
/* ------------------------------------------------------------------ */
// This rule used to live inline in `experience.ts`, where mutation-testing the `armed`
// term left every gate green: the stage ternary short-circuits before the door item is
// ever evaluated. It is now `officeDoorOffered` in b4Office.ts, and every term below has
// a state that fails if that term is dropped.
check(officeDoorOffered({stage: 'to_b6', atFifth: true, hasRepeat: false}), 'offer:armed-floor',
 'an armed errand on the fifth floor must offer the office door');
setOfficeArmed(false);
check(!officeDoorOffered({stage: 'to_b6', atFifth: true, hasRepeat: false}), 'offer:unarmed',
 'C.3: before the hand-off accepts the errand the door must not be offered, or the abduction is spent on an empty office');
setOfficeArmed(true);
check(!officeDoorOffered({stage: 'to_b5', atFifth: true, hasRepeat: false}), 'offer:handoff-stage',
 'on the walk in to dinner the coordinator owns the interaction slot, not the office door');
check(!officeDoorOffered({stage: 'to_b6', atFifth: true, hasRepeat: true}), 'offer:repeat-owns-slot',
 'while the coordinator repeats their line the door must not take the slot from them');
check(!officeDoorOffered({stage: 'to_b6', atFifth: false, hasRepeat: false}), 'offer:off-floor',
 'the door is not reachable from any other floor');
check(openOfficeDoor(), 'offer:open-door-first', 'opening the door must succeed from the closed state');
check(!officeDoorOffered({stage: 'to_b6', atFifth: true, hasRepeat: false}), 'offer:already-open',
 'a door that is already open is not an interaction target');
resetOffice();
// The rule must be the one `target()` actually calls — a parallel copy would drift.
{
 const experience = fs.readFileSync(new URL('../src/opening/experience.ts', import.meta.url), 'utf8');
 check(/officeDoorOffered\(\{stage:story\.stage,atFifth,hasRepeat:/.test(experience), 'offer:wired',
  'experience.ts must decide the door offer through officeDoorOffered, not an inline copy');
}
check(officeDebug().armed && !officeDebug().doorOpen, 'offer:state-restored',
 'the offer checks must leave the office armed, shut and beat-clear for the beats section');

// Beat 1: the first look at the monitor on the way in.
const lookAt = groundSamples.findIndex(q => Math.hypot(q.x - 47.35, q.z - B4_OFFICE.cctv.z) < .06);
for (const p of (lookAt >= 0 ? groundSamples.slice(0, lookAt + 1) : groundSamples)) tickOffice(p.x, p.z, GROUND);
const afterLook = officeDebug();
check(afterLook.beats.lobby_feed !== null, 'beats:one-fires', 'walking up to the monitor must start the feed');
check(afterLook.beats.feed_dies === null, 'beats:one-alone', 'the feed must not die before the lift moves');
check(afterLook.beatOrder.join(',') === 'lobby_feed', 'beats:one-order', `one beat expected, read ${afterLook.beatOrder.join(',')}`);

// On to the call plate: the sample at the plate sets the call, the way the game does.
for (const p of groundSamples.slice(lookAt + 1)) tickOffice(p.x, p.z, GROUND);
check(LIFT.call === 'ground', 'beats:call-from-the-plate', `walking past the plate must call the car, read ${JSON.stringify(LIFT.call)}`);

// The call's descent: the player waits at the plate and the feed dies when the doors close.
let callSteps = 0;
while (LIFT.phase !== 'arrived' && callSteps++ < 4000) {
 stepLift(LIFT, 1 / 120, false);
 tickOffice(CX, CZ, LIFT.y);
}
check(near(LIFT.y, GROUND, 1e-9), 'beats:car-comes-down', `the called car must arrive at the ground, read ${LIFT.y}`);
check(officeDebug().beats.feed_dies !== null, 'beats:two-fires', 'the feed must die when the car\'s doors close');
check(officeDebug().doorOpen === false, 'beats:door-still-shut', 'nothing before the corridor may open the office door');
for (let i = 0; i < 200 && LIFT.doors < 1; i++) stepLift(LIFT, 1 / 120, false);
settle();
check(LIFT.doors === 1, 'beats:ground-doors-open', `the car's doors must open at the ground, read ${r4(LIFT.doors)}`);

// Board and ride: nothing new fires in the car. The car stands at the ground in `arrived`
// (its doors just opened), so the loop has to leave that phase, not enter it.
let rideSteps = 0;
while ((LIFT.phase !== 'arrived' || LIFT.y < L.landing - .01) && rideSteps++ < 8000) {
 stepLift(LIFT, 1 / 120, true);
 tickOffice(CX, CZ, LIFT.y);
}
check(near(LIFT.y, FLOOR, 1e-9), 'beats:ride-height', `the car must stop on the landing ${FLOOR}, read ${LIFT.y}`);
check(officeDebug().beatOrder.join(',') === 'lobby_feed,feed_dies', 'beats:ride-quiet',
 `the ride must not add a beat, read ${officeDebug().beatOrder.join(',')}`);

// Open the 5F car doors, then walk the corridor: beat 3 fires before the door is touched.
for (let i = 0; i < 200 && LIFT.doors < 1; i++) stepLift(LIFT, 1 / 120, true);
settle();
check(LIFT.doors === 1, 'beats:5f-doors', `the car's doors must open at the landing, read ${r4(LIFT.doors)}`);
for (const p of fifthSamples.slice(0, fifthSamples.findIndex(q => q.x > B4_OFFICE.door.x0 - .5))) tickOffice(p.x, p.z, FLOOR);
const afterCorridor = officeDebug();
check(afterCorridor.beats.corridor_sound !== null, 'beats:three-fires', 'the 5F corridor must carry the abduction by sound');
check(afterCorridor.doorOpen === false, 'beats:three-before-door', 'beat 3 must play before the office door opens');
check(afterCorridor.beatOrder.join(',') === 'lobby_feed,feed_dies,corridor_sound', 'beats:three-order',
 `the beats must latch in route order, read ${afterCorridor.beatOrder.join(',')}`);
check(afterCorridor.feed === 'dead', 'beats:feed-dead', 'the monitor must be showing static after beat 2');

// They latch: a second pass through every volume changes nothing.
const timesBefore = {...afterCorridor.beats};
for (const p of groundSamples) tickOffice(p.x, p.z, GROUND);
for (const p of fifthSamples) tickOffice(p.x, p.z, FLOOR);
const latched = JSON.stringify({...officeDebug().beats}) === JSON.stringify(timesBefore);
check(latched, 'beats:latched',
 `the beats must fire once, before ${JSON.stringify(timesBefore)}, after ${JSON.stringify(officeDebug().beats)}`);

/* ------------------------------------------------------------------ */
/* 8. E.0 — the ride down, with the car at the landing                 */
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
   settle();
   const carFloor = nav.obstacles.find(o => o.name === 'opening-lift-car-floor');
   midRide = {
    y: r4(LIFT.y), doors: LIFT.doors,
    doorBlocked: nav.blocked(DOOR_PLANE, CZ, LIFT.y),
    carFloor: carFloor ? r4(carFloor.top) : null,
    interiorBlocked: nav.blocked(CX, CZ, LIFT.y),
   };
  }
 }
 if (LIFT.phase === 'descending' && descendAt < 0) descendAt = t;
 if (descendAt >= 0 && LIFT.phase === 'arrived') { arriveAt = t; break; }
}
settle();
const descentSeconds = arriveAt - descendAt;
check(descendAt > 0 && arriveAt > 0, 'ride:runs',
 `the car must actually descend, descending at ${r4(descendAt)} s, arrived at ${r4(arriveAt)} s`);
check(near(descentSeconds, L.travelSeconds, 1 / 120 + 1e-9), 'ride:duration',
 `the descent must take ${L.travelSeconds} s, measured ${r4(descentSeconds)} s`);
check(near(LIFT.y, GROUND, .05), 'ride:floor', `the car must come back within 0.05 m of ${GROUND}, read ${LIFT.y}`);
check(doorsWhileMoving === 0, 'ride:doors-shut', `the doors opened ${doorsWhileMoving} times while the car was moving`);
check(midRide !== null && midRide.doorBlocked, 'ride:no-exit',
 `the player must not be able to step out mid-ride, read ${JSON.stringify(midRide)}`);
check(midRide !== null && midRide.carFloor === midRide.y, 'ride:car-floor-follows',
 `the mounted car floor must follow the car mid-ride, read ${JSON.stringify(midRide)} — the body itself is proved in check-b4-errand`);
check(midRide !== null && !midRide.interiorBlocked, 'ride:interior-clear',
 `nothing may block the rider inside the car mid-ride, read ${JSON.stringify(midRide)}`);
check(LIFT.phase === 'arrived', 'ride:stops', `the car must finish in a stopped phase, read ${LIFT.phase}`);
for (let i = 0; i < 200 && LIFT.doors < 1; i++) stepLift(LIFT, 1 / 120, false);
settle();
check(LIFT.doors === 1, 'ride:doors-open', `the doors must open at the ground, read ${r4(LIFT.doors)}`);

/* ------------------------------------------------------------------ */
/* 9. E-F6 — the empty-car dispatch, and the reset invariant           */
/* ------------------------------------------------------------------ */

// With the car at the ground, call the top: an empty car rises, clears its call and arrives.
callLift('top');
check(LIFT.call === 'top', 'dispatch:call-set', `a call from the floor the car is not on must be recorded, read ${JSON.stringify(LIFT.call)}`);
let upAt = -1, upArrive = -1, emptySteps = 0;
for (let i = 1; i <= 2000; i++) {
 stepLift(LIFT, 1 / 120, false);
 if (LIFT.phase === 'rising' && upAt < 0) upAt = (i - 1) / 120;
 if (LIFT.phase === 'arrived' && LIFT.y > L.landing - .01) { upArrive = i / 120; break; }
 emptySteps++;
}
check(upAt >= 0 && upArrive > upAt, 'dispatch:empty-runs', `the empty car must rise on its own, rising at ${r4(upAt)} s, arrived at ${r4(upArrive)} s`);
check(near(upArrive - upAt, L.travelSeconds, 1 / 120 + 1e-9), 'dispatch:empty-time',
 `the empty ride must take ${L.travelSeconds} s, measured ${r4(upArrive - upAt)} s`);
check(near(LIFT.y, FLOOR, 1e-9), 'dispatch:empty-arrives', `the empty car must reach the landing ${FLOOR}, read ${LIFT.y}`);
check(LIFT.call === null, 'dispatch:call-cleared', `arrival must clear the call, read ${JSON.stringify(LIFT.call)} after ${emptySteps} steps`);

// A call from the other floor, then a reset: the car parks at the landing and the call is gone.
callLift('ground');
check(LIFT.call === 'ground', 'reset:call-set', `a call must be pending before the reset proves anything, read ${JSON.stringify(LIFT.call)}`);
resetLift();
settle();
check(LIFT.y === L.landing, 'reset:landing', `resetLift must park the car at its home landing ${L.landing}, read ${LIFT.y}`);
check(LIFT.doors === 0, 'reset:doors', `resetLift must close the doors, read ${LIFT.doors}`);
check(LIFT.call === null, 'reset:call', `resetLift must clear the landing call, read ${JSON.stringify(LIFT.call)}`);
check(LIFT.phase === 'idle', 'reset:phase', `resetLift must return the machine to idle, read ${LIFT.phase}`);
check(guardBox() !== null && near(guardBox()!.top, GROUND_CEIL, 1e-9), 'reset:ground-sealed',
 `a reset car parks upstairs, so the ground doorway must be sealed, read ${JSON.stringify(guardBox())}`);
check(nav.blocked(DOOR_PLANE, CZ, GROUND), 'reset:threshold', 'a reset car must leave the ground lobby sealed');
// The clock: one query after a reset bootstraps and moves nothing. A stale `lastAdvance`
// would hand the first query a full 50 ms step and the doors would start opening.
tickLift(CX, CZ, GROUND);
check(LIFT.phase === 'idle' && LIFT.doors === 0, 'reset:clock',
 `the first query after resetLift must only bootstrap the clock, read phase ${LIFT.phase} doors ${LIFT.doors}`);
resetOffice();
check(blockedAt(samples(doorLeg), FLOOR).length > 0, 'reset:office-door', 'resetOffice must leave the office door solid again');

/* ------------------------------------------------------------------ */
/* 10. Addendum 5 B — the passenger grace's three negatives            */
/* ------------------------------------------------------------------ */

/**
 * The grace keeps `called` true for .25 s after the last in-car query, so the fleet's
 * outside queries cannot starve the player's boarding dwell. These gates assert what that
 * timing rule may NOT do. Each drives the lift on its own wall clock (`tickLift`), the same
 * clock the browser uses, and reads the latch state through `liftDebug`.
 */
const waitMs = (ms: number) => { const until = Date.now() + ms; while (Date.now() < until) { /* wall clock */ } };
const IN_CAR = () => ({x: CX, z: CZ, y: LIFT.y});
const OFF_CAR = () => ({x: CX, z: CZ, y: LIFT.y + 3});   // same column, far above the car floor

/**
 * Drive the car's doors fully open on the wall clock with whatever query the test wants.
 *
 * `budgetMs` is a ceiling, not a duration: the loop stops as soon as the doors are open.
 * It used to run for a fixed 1000 ms, which silently assumed the harness could tick fast
 * enough for `doorSeconds` (0.8 s) to elapse inside it — true on an idle machine, false on
 * a loaded one, where the lift's own clock (each advance capped at 50 ms) falls behind the
 * wall clock and the next case began while the doors were still opening.
 */
function openDoorsWith(budgetMs: number, at: () => {x: number; z: number; y: number}): void {
 const deadline = Date.now() + budgetMs;
 while (Date.now() < deadline && LIFT.doors < 1) {
  const p = at();
  tickLift(p.x, p.z, p.y);
  waitMs(20);
 }
}

// B.1 — a passenger aboard, with an off-car query flood at >= 4 Hz, still closes the doors
// after the dwell. Without the grace every outside query resets the dwell and the flood
// starves the close for ever (the return-ride defect the grace fixes).
resetLift();
tickLift(IN_CAR().x, IN_CAR().z, IN_CAR().y);      // bootstrap the clock, no step
openDoorsWith(4000, IN_CAR);                       // doors open; the passenger's dwell starts
// The flood is every *other* tick off-car, not seven in eight. At the 25 ms pacing the
// one-in-eight version left only ~50 ms of margin inside the .25 s grace, so a machine busy
// enough to stretch ticks past 31 ms turned this case red without the lift changing
// (observed 2026-11-25 under three concurrent builds). One off-car tick between passenger
// queries still fails without the grace: it resets the dwell every other tick.
const b1Start = Date.now();
let b1ClosedAt = -1, b1Ticks = 0, b1PeakOpen = 0;
while (Date.now() - b1Start < 8000) {
 const i = b1Ticks++;
 const p = i % 2 === 0 ? IN_CAR() : OFF_CAR();
 tickLift(p.x, p.z, p.y);
 b1PeakOpen = Math.max(b1PeakOpen, liftDebug().open);
 if (LIFT.phase === 'doors-closing') { b1ClosedAt = Date.now() - b1Start; break; }
 waitMs(25);
}
const b1 = {closedAfterMs: b1ClosedAt, ticks: b1Ticks, peakOpenSeconds: b1PeakOpen, latchAtClose: liftDebug()};
check(b1ClosedAt >= 0, 'grace:flood-closes',
 `a passenger plus an off-car flood must still close the doors, read ${JSON.stringify(b1)}`);
// Assert the lift's own clock, not wall time: each advance is capped at 50 ms, so a loaded
// machine runs the lift clock slower than the wall and a millisecond bound measures the load
// instead of the rule. The rule is that the dwell runs to completion despite the flood —
// and no further, which is what catches a grace leaking into the dwell.
check(b1PeakOpen >= L.dwellSeconds * .9 && b1PeakOpen <= L.dwellSeconds + 1 / 240,
 'grace:flood-within-dwell',
 `the dwell must run exactly once despite the flood, peak ${b1PeakOpen.toFixed(3)} s against dwell ${L.dwellSeconds} s`);

// B.2 — an empty car's doors must not stay open because a passenger left .2 s ago. Arrive at
// the ground with a passenger (so the arrival hold is set), open the doors, order the car up,
// then step out. The hold must clear on the first outside query, not after the grace: the
// dwell starts at once and the car departs one dwell later, not one dwell + grace.
resetLift();
for (let i = 0; i < 3000; i++) {
 stepLift(LIFT, 1 / 120, true);                    // passenger aboard, car descends to the ground
 if (LIFT.phase === 'arrived' && Math.abs(LIFT.y - GROUND) <= .005) break;
}
tickLift(IN_CAR().x, IN_CAR().z, IN_CAR().y);      // bootstrap the wall clock at the arrived car
openDoorsWith(4000, IN_CAR);
const heldAfterArrival = liftDebug();
callLift('top');                                   // the car must leave; calledElsewhere is true
// The passenger steps out: one announcing outside query, then a flood. The 2 ms pause makes
// it a distinct instant: a query arriving in the same instant as the previous advance
// carries no time, and `advanceLift` ignores it by design — the frame clock never sends two
// queries in one instant, so the test must not either.
waitMs(2);
tickLift(OFF_CAR().x, OFF_CAR().z, OFF_CAR().y);
const afterLeave = liftDebug();
check(heldAfterArrival.hold === true, 'grace:arrival-hold-set',
 `the arrival hold must be set with a passenger aboard, read ${JSON.stringify(heldAfterArrival)}`);
check(afterLeave.hold === false, 'grace:hold-clears-on-leaving',
 `the arrival hold must clear on the first query outside the car, not after the grace, read ${JSON.stringify(afterLeave)}`);
check(afterLeave.open > 0, 'grace:dwell-starts-on-leaving',
 `the departure dwell must start on the leaving query, read ${JSON.stringify(afterLeave)}`);
const b2Start = Date.now();
let b2ClosedAt = -1, b2PeakOpen = 0;
while (Date.now() - b2Start < 8000) {
 const p = OFF_CAR();
 tickLift(p.x, p.z, p.y);
 b2PeakOpen = Math.max(b2PeakOpen, liftDebug().open);
 if (LIFT.phase === 'doors-closing') { b2ClosedAt = Date.now() - b2Start; break; }
 waitMs(20);
}
// Same rule as B.1, on the lift's own clock: exactly one dwell, measured on the clock that
// decides the close. A late start caused by the grace is caught by
// `grace:dwell-starts-on-leaving`, which reads the first query after the passenger leaves.
check(b2ClosedAt >= 0 && b2PeakOpen >= L.dwellSeconds * .9 && b2PeakOpen <= L.dwellSeconds + 1 / 240,
 'grace:empty-car-departs-on-dwell',
 `an empty car with a pending call must close after exactly one dwell, peak ${b2PeakOpen.toFixed(3)} s in ${b2ClosedAt} ms wall`);

// B.3 — an in-car ambient probe's effect is bounded. Even .5 s of probes is shorter than the
// dwell, so it can never dispatch an empty car; when the probes stop, the dwell resets and
// the doors stay open. (Stated in full in the report: an in-car probe is a passenger for
// .25 s; sustained probes for a whole dwell are by design indistinguishable from one.)
resetLift();
tickLift(OFF_CAR().x, OFF_CAR().z, OFF_CAR().y);
openDoorsWith(4000, OFF_CAR);                      // empty car, no call: open, dwell 0
const ambientStart = liftDebug();
const ambientBurstEnd = Date.now() + 500;
while (Date.now() < ambientBurstEnd) {             // 20 in-car probes over 0.5 s
 const p = IN_CAR();
 tickLift(p.x, p.z, p.y);
 waitMs(25);
}
const ambientPeak = liftDebug();
const ambientSettleStart = Date.now();
while (Date.now() - ambientSettleStart < 2000) {
 const p = OFF_CAR();
 tickLift(p.x, p.z, p.y);
 waitMs(25);
}
const ambientEnd = liftDebug();
check(ambientStart.phase === 'open' && ambientStart.open === 0, 'grace:ambient-starts-clear',
 `the ambient probe must start from an empty, open car, read ${JSON.stringify(ambientStart)}`);
check(ambientPeak.open < L.dwellSeconds * .9, 'grace:ambient-bounded',
 `0.5 s of in-car probes must accumulate less than a dwell, read ${JSON.stringify(ambientPeak)}`);
check((ambientEnd.phase === 'open' || ambientEnd.phase === 'arrived') && LIFT.doors === 1 && ambientEnd.open === 0,
 'grace:ambient-cannot-dispatch',
 `an empty car must not close or move on probe traffic alone, read ${JSON.stringify(ambientEnd)} doors ${LIFT.doors}`);
resetLift();
resetOffice();
settle();

/* ------------------------------------------------------------------ */
/* 11. E-F10 — the call lamps                                          */
/* ------------------------------------------------------------------ */

// A neutral sync point: inside B04, far from every trigger volume.
const NEUTRAL: P = {x: 47.0, z: R.z0 + .5};
tickOffice(NEUTRAL.x, NEUTRAL.z, GROUND);
check(officeDebug().lamps.ground === .25 && officeDebug().lamps.top === .25, 'lamps:dark-at-rest',
 `with no call pending both plates must be dark, read ${JSON.stringify(officeDebug().lamps)}`);
callLift('ground');
tickOffice(NEUTRAL.x, NEUTRAL.z, GROUND);
check(officeDebug().lamps.ground === 1.4, 'lamps:ground-lit-when-called',
 `the ground plate must be lit while its call is pending, read ${JSON.stringify(officeDebug().lamps)}`);
for (let i = 0; i < 1600 && LIFT.phase !== 'arrived'; i++) stepLift(LIFT, 1 / 120, false);
tickOffice(NEUTRAL.x, NEUTRAL.z, LIFT.y);
check(officeDebug().lamps.ground === .25, 'lamps:ground-dark-on-arrival',
 `the ground plate must go dark when the car arrives, read ${JSON.stringify(officeDebug().lamps)}`);
callLift('top');
tickOffice(NEUTRAL.x, NEUTRAL.z, LIFT.y);
check(officeDebug().lamps.top === 1.4, 'lamps:top-lit-when-called',
 `the 5F plate must be lit while its call is pending, read ${JSON.stringify(officeDebug().lamps)}`);
resetLift();
resetOffice();
settle();

/* ------------------------------------------------------------------ */
/* 12. E-F7 — the stairs, proved structurally                          */
/* ------------------------------------------------------------------ */

const stairReport = (() => {
 type Surface = {top: number; at: {x: number; z: number} | null};
 /** Every surface `support()` can see over the room, queried above the room's clear height. */
 let b4HighestSurface: Surface = {top: GROUND, at: null};
 const ceiling = R.floor + R.clearHeight + .24;                  // 4.56: above every room surface
 for (let x = R.x0 + .5; x <= R.x1 - .5; x += .5) {
  for (let z = R.z0 + .5; z <= R.z1 - .5; z += .5) {
   const h = nav.support(x, z, ceiling);
   if (h !== null && h > b4HighestSurface.top) b4HighestSurface = {top: r4(h), at: {x: r4(x), z: r4(z)}};
  }
 }
 /**
  * The auditorium run north of the courtyard: sampled end to end with the query ceiling
  * **above four storeys**, so a stair in that run that reached 4F could not hide under it.
  * This is a bounded scan of that run, not a campus-wide one — the check's name says so.
  */
 const queryCeiling = 4 * L.floorToFloor + 1;                     // 19.88
 let auditorium: Surface = {top: GROUND, at: null};
 for (let x = -14; x <= 14; x += 1) {
  for (let z = -52; z <= -26; z += .25) {
   const h = nav.support(x, z, queryCeiling);
   if (h !== null && h > auditorium.top) auditorium = {top: r4(h), at: {x: r4(x), z: r4(z)}};
  }
 }
 return {
  b4HighestSurface, auditoriumHighestSurface: auditorium, queryCeiling: r4(queryCeiling),
  fourFloors: r4(4 * L.floorToFloor),
  /** The structural facts, which are the real proof (the scan is evidence, not an assertion). */
  roomClearHeight: R.clearHeight, roomTop: r4(R.floor + R.clearHeight),
  tierTops: B4_TIERS.map(t => t.top), tallestTier: Math.max(...B4_TIERS.map(t => t.top)),
  stairNames: B4_OBSTACLES.filter(o => /stair|step|riser|tread/i.test(o.name)).map(o => o.name),
 };
})();
check(stairReport.b4HighestSurface.top < 1.0, 'stairs:b4-has-none',
 `B04 must have no built stair: queried above its clear height over the whole footprint, the highest surface is ${stairReport.b4HighestSurface.top} m at ${JSON.stringify(stairReport.b4HighestSurface.at)}`);
check(stairReport.tallestTier < 1.0, 'stairs:b4-tiers', `B04's tallest tier must stay under 1 m, read ${stairReport.tallestTier} m`);
check(stairReport.stairNames.length === 0, 'stairs:b4-no-stair-geometry',
 `B04 must carry no stair geometry, read ${JSON.stringify(stairReport.stairNames)}`);
check(stairReport.roomTop < LIFT_LANDING.floorTop, 'stairs:b4-one-storey',
 `B04's whole room tops out at ${stairReport.roomTop} m, below the 5F landing ${LIFT_LANDING.floorTop} m`);
check(stairReport.auditoriumHighestSurface.top < stairReport.fourFloors, 'stairs:auditorium-below-4f',
 `the auditorium run's highest surface under a ${stairReport.queryCeiling} m ceiling is ${stairReport.auditoriumHighestSurface.top} m, which must stay below 4F (${stairReport.fourFloors} m)`);

/* ------------------------------------------------------------------ */
/* 13. Every cue the office plays exists in the manifest               */
/* ------------------------------------------------------------------ */

const cueIds = [...new Set(Object.values(OFFICE_CUES))];
const missingCues = cueIds.filter(id => !(id in STORY_AUDIO_URLS));
check(cueIds.length >= 5, 'cues:declared', `the office must declare every cue it plays, read ${JSON.stringify(cueIds)}`);
check(missingCues.length === 0, 'cues:manifest',
 `every cue the office plays must exist in the story audio manifest, missing ${JSON.stringify(missingCues)}`);

/* ------------------------------------------------------------------ */
/* 14. The triggers on the route                                       */
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
 dressing: {
  parts: dressingParts,
  collision: dressingCollision.map(word => nav.obstacles.filter(o => o.name.toLowerCase().includes(word)).length),
 },
 guards: {ground: guardBox(), above: {floorTop: r4(FLOOR), ceilBottom: r4(LIFT_LANDING.ceilBottom)}},
 stairs: stairReport,
 reachability: {
  groundBlocked,
  fifthBlocked,
  officeDoor: {closedBlocked: doorClosedBlocked.length, swingBlocked: midSwing?.blocked ?? 0, midSwing, openBlocked: doorOpenBlocked.length, swingMs},
 },
 triggers,
 beats: {
  armed: afterCorridor.armed,
  order: afterCorridor.beatOrder,
  times: {...afterCorridor.beats},
  feed: afterCorridor.feed,
  latched,
  unarmedTimes: beforeArm.beats,
 },
 descent: {
  groundCall: {call: descent.called, seconds: r4(descent.seconds), travelSeconds: L.travelSeconds, stopsAt: r4(descent.stopsAt), doorsWhileMoving: descent.doorsWhileMoving, doorOpenedAtY, profile, callCleared: descent.call},
  ride: {seconds: r4(descentSeconds), midRide},
  reset: {y: LIFT.y, doors: LIFT.doors, call: LIFT.call, phase: LIFT.phase, groundGuard: guardBox()},
 },
 dispatch: {emptyRideSeconds: r4(upArrive - upAt), arrivedAt: r4(LIFT.y)},
 grace: {
  flood: b1, emptyCloseMs: b2ClosedAt,
  arrivalHold: heldAfterArrival, afterLeave,
  ambientStart, ambientPeak, ambientEnd,
 },
 lamps: officeDebug().lamps,
 cues: {ids: cueIds, missing: missingCues},
 failures,
};
console.log(JSON.stringify(report, null, 1));
if (failures.length) {
 console.error(`\ncheck-b4-office: ${failures.length} failure(s)`);
 for (const f of failures) console.error(`  - ${f}`);
 process.exit(1);
}
console.log('\ncheck-b4-office: all checks passed');
