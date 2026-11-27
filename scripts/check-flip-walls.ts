import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import * as T from 'three';
import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {B4_LAYOUT, B4_OBSTACLES, SIDE_DOOR_HEIGHT, type B4Rect} from '../src/opening/b4Layout';
import {OPENING as O, B6_HALL} from '../src/opening/spatialLayout';
import {
 B6_FLIP_COOLDOWN, B6_FLIP_HOLD, B6_FLIP_MOUNT_NAME, B6_FLIP_STAGGER, B6_FLIP_TRIGGER, B6_FLIP_TURN,
 B6_FLIP_WALL_ORIGIN, B6_FLIP_WALL_YAW, createB6FlipWall,
} from '../src/opening/b6FlipWall';

/**
 * The two flip-wall-adjacent façades, measured against the real sources and the real builders.
 *
 *   A. CDS-1's side door (Ruling G1) still exists as a doorway in the south façade. The lift
 *      left this building on 2026-11-27, but the door is still walked-through scenery and its
 *      collision must not be an invisible wall.
 *   B. The HKU flip wall now hangs in Building 6's ground hall (owner ruling
 *      2026-11-27: 「那个翻盘的那个HQ翻盘的，明明是在6号楼」). This gate measures the mount, the
 *      tiles, the collision and the ambient ripple against `B6_HALL.flipWall`.
 *
 * The old file (`check-b4-flip-room.ts`) measured a B4 lobby wall that no longer exists; a gate
 * about a retired wall passes forever and proves nothing, so it was replaced rather than kept.
 */

const R = O.b4;
const WALL = B4_LAYOUT.wall;
const SD = B4_LAYOUT.sideDoor;
const F = R.floor;
const EPS = 1e-6;
/** The façade's usable span: west interior face to the main door's west edge. */
const FACADE = {x0: R.x0 + .01 + WALL, x1: R.door - R.doorWidth / 2, z0: 19.9, z1: R.z1};
const MIN_END_CLEARANCE = .20;
/** The brief's corridor: 0.60 m wide, sampled every 5 cm, obstacles below 1.8 m tall. */
const CORRIDOR = {width: .60, step: .05, obstacleTop: 1.8} as const;
const CORRIDOR_START: readonly [number, number] = [47.75, 23.00];
/** Inside the room, clear of the wall and the sofa, before turning east. */
const CORRIDOR_VIA: readonly [number, number] = [47.75, 19.50];

const r4 = (value: number) => +value.toFixed(4);

export interface Box3 {x0: number; x1: number; y0: number; y1: number; z0: number; z1: number}
export interface Overlap {name: string; overlap: Box3}

function overlapOf(a: Box3, b: Box3): Box3 | null {
 const x: [number, number] = [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)];
 const y: [number, number] = [Math.max(a.y0, b.y0), Math.min(a.y1, b.y1)];
 const z: [number, number] = [Math.max(a.z0, b.z0), Math.min(a.z1, b.z1)];
 return x[0] < x[1] - EPS && y[0] < y[1] - EPS && z[0] < z[1] - EPS ? {x0: r4(x[0]), x1: r4(x[1]), y0: r4(y[0]), y1: r4(y[1]), z0: r4(z[0]), z1: r4(z[1])} : null;
}

const rectBox = (rect: B4Rect): Box3 => ({x0: rect.x0, x1: rect.x1, y0: rect.bottom, y1: rect.top, z0: rect.z0, z1: rect.z1});

/** Every B4_OBSTACLES rect the door's clear volume (floor to its clear height, across the
 * doorway) hits. The lintel sits exactly on the volume's top plane, so touching is not a hit. */
function doorVolumeOverlaps(x0: number, x1: number, height: number): Overlap[] {
 const volume: Box3 = {x0, x1, y0: F, y1: F + height, z0: FACADE.z0, z1: FACADE.z1};
 const out: Overlap[] = [];
 for (const rect of B4_OBSTACLES) {
  const overlap = overlapOf(volume, rectBox(rect));
  if (overlap) out.push({name: rect.name, overlap});
 }
 return out;
}

/** Sample a 0.60 m-wide walking corridor along a polyline against the room's low obstacles. */
function corridorBlockers(path: readonly (readonly [number, number])[], obstacles: readonly B4Rect[]): {samples: number; blockedBy: string[]} {
 const half = CORRIDOR.width / 2;
 const blocked: string[] = [];
 let samples = 0;
 for (let segment = 0; segment < path.length - 1; segment++) {
  const from = path[segment]!, to = path[segment + 1]!;
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(length / CORRIDOR.step));
  for (let i = segment === 0 ? 0 : 1; i <= steps; i++) {
   const t = i / steps, x = from[0] + dx * t, z = from[1] + dz * t;
   const probe: Box3 = {x0: x - half, x1: x + half, y0: F, y1: F + CORRIDOR.obstacleTop, z0: z - half, z1: z + half};
   samples++;
   for (const rect of obstacles) {
    if (rect.bottom >= CORRIDOR.obstacleTop) continue;
    if (overlapOf(probe, rectBox(rect)) && !blocked.includes(rect.name)) blocked.push(rect.name);
   }
  }
 }
 return {samples, blockedBy: blocked};
}

/* ------------------------------------------------------------------ */
/* A. CDS-1's side door (Ruling G1; unchanged by the 2026-11-27 move)  */
/* ------------------------------------------------------------------ */

function sideDoorReport() {
 const door = {
  x0: SD.x0, x1: SD.x1, width: r4(SD.x1 - SD.x0), centre: r4((SD.x0 + SD.x1) / 2),
  height: SD.height, z: SD.z,
  facade: {x0: r4(FACADE.x0), x1: r4(FACADE.x1)},
  margins: {west: r4(SD.x0 - FACADE.x0), east: r4(FACADE.x1 - SD.x1)},
  overlaps: doorVolumeOverlaps(SD.x0, SD.x1, SD.height).map(o => o.name),
 };
 const path: [number, number][] = [
  [CORRIDOR_START[0], CORRIDOR_START[1]],
  [CORRIDOR_VIA[0], CORRIDOR_VIA[1]],
  [B4_LAYOUT.room.x0 + 2.6, CORRIDOR_VIA[1]],
 ];
 const corridor = corridorBlockers(path, B4_OBSTACLES);
 const nav = createNavigation(BUILDINGS, SITE, true);
 let sideDoorOpen: boolean, frontWallSolid: boolean;
 const facadeSegments: string[] = [];
 try {
  sideDoorOpen = !nav.blocked(door.centre, FACADE.z1 + .10, F + .5)
   && !nav.blocked(door.centre, FACADE.z1 - .10, F + .5)
   && !nav.blocked(door.centre, FACADE.z1 - .30, F + .5);
  frontWallSolid = nav.blocked(52.0, FACADE.z1 - .10, F + .5);
  for (const obstacle of nav.obstacles) {
   if (obstacle.z - obstacle.d / 2 >= FACADE.z0 - EPS && obstacle.z + obstacle.d / 2 <= R.z1 + .2 && Math.abs(obstacle.z - R.z1) < 1) {
    facadeSegments.push(`${obstacle.name} x ${r4(obstacle.x - obstacle.w / 2)}…${r4(obstacle.x + obstacle.w / 2)} y ${r4(obstacle.bottom)}…${r4(obstacle.top)}`);
   }
  }
 } finally {
  nav.dispose();
 }
 return {door, corridor: {...corridor, width: CORRIDOR.width, path, samples: corridor.samples}, nav: {sideDoorOpen, frontWallSolid, facadeSegments}};
}

/* ------------------------------------------------------------------ */
/* B. The HKU flip wall in the B6 hall                                 */
/* ------------------------------------------------------------------ */

function flipWallReport() {
 const W = B6_HALL.flipWall;
 const hall = O.b6;
 const wall = createB6FlipWall();
 try {
  // The mount as built: its world box is the panel body, because the whole group carries
  // the wall's own geometry (tiles and all).
  const mount = wall.root.getObjectByName(B6_FLIP_MOUNT_NAME);
  if (!mount) throw new Error(`createB6FlipWall has no ${B6_FLIP_MOUNT_NAME}`);
  mount.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(mount);
  // Count the wall's drawn tiles structurally: the module ships two InstancedMeshes (dark
  // and light faces), and a name string here would be a second copy of the builder's keys.
  const instanced: {name: string; count: number}[] = [];
  wall.root.traverse(o => {
   if ((o as T.InstancedMesh).isInstancedMesh) instanced.push({name: o.name, count: (o as T.InstancedMesh).count});
  });
  const tiles = {meshes: instanced.length, dark: instanced[0]?.count ?? 0, light: instanced[1]?.count ?? 0, total: instanced.reduce((n, m) => n + m.count, 0)};
  // The collision box the world mounts for the panel (navigation.ts).
  const nav = createNavigation(BUILDINGS, SITE, true);
  let collision: {bottom: number; top: number; z0: number; z1: number} | null = null;
  try {
   const o = nav.obstacles.find(b => b.name === 'opening-b6-flip-wall');
   if (o) collision = {bottom: r4(o.bottom), top: r4(o.top), z0: r4(o.z - o.d / 2), z1: r4(o.z + o.d / 2)};
  } finally {
   nav.dispose();
  }
  return {
   declared: {x: W.x, z: r4(W.z), width: W.width, depth: W.depth, yaw: W.yaw},
   origin: B6_FLIP_WALL_ORIGIN.map(v => r4(v)) as [number, number, number],
   yaw: B6_FLIP_WALL_YAW,
   built: {x0: r4(box.min.x), x1: r4(box.max.x), y0: r4(box.min.y), y1: r4(box.max.y), z0: r4(box.min.z), z1: r4(box.max.z)},
   tiles,
   collision,
   hall: {x0: hall.x0, x1: hall.x1, z0: hall.z0, z1: hall.z1, floor: r4(hall.floor), clearHeight: hall.clearHeight},
   trigger: {distance: B6_FLIP_TRIGGER, stagger: B6_FLIP_STAGGER, turn: B6_FLIP_TURN, hold: B6_FLIP_HOLD, cooldown: B6_FLIP_COOLDOWN},
   ambient: (() => {
    const sceneAt = (x: number, z: number, seconds: number) => {
     wall.update(1 / 60, new T.Vector3(x, hall.floor, z));
     for (let t = 1 / 60; t <= seconds; t += 1 / 60) wall.update(1 / 60, new T.Vector3(x, hall.floor, z));
    };
    // Far away first: nothing may move.
    sceneAt(W.x, W.z + W.depth + B6_FLIP_TRIGGER + 1.5, .4);
    const far = wall.debug.state();
    // Then a visitor in front of the wall: the ripple starts.
    sceneAt(W.x, W.z + W.depth + 1.0, B6_FLIP_TURN + .1);
    const near = wall.debug.state();
    // Hold, then settle: the ripple closes and the cooldown is running.
    sceneAt(W.x, W.z + W.depth + 1.0, B6_FLIP_HOLD + B6_FLIP_STAGGER + B6_FLIP_TURN + .2);
    const settled = wall.debug.state();
    return {far, near, settled};
   })(),
  };
 } finally {
  wall.dispose();
 }
}

/** Print the measured numbers, assert the fit, and return the named failures. */
export function runGate(): string[] {
 const side = sideDoorReport();
 const flip = flipWallReport();
 console.log('== check-flip-walls: CDS-1 side door + Building 6 flip wall ==');
 console.log('side door:', JSON.stringify(side.door));
 console.log('side-door corridor:', JSON.stringify(side.corridor));
 console.log('side-door nav:', JSON.stringify(side.nav));
 console.log('flip wall:', JSON.stringify(flip));
 console.log('measuredReport JSON:');
 console.log(JSON.stringify({sideDoor: side, flipWall: flip}, null, 1));

 const failures: string[] = [];
 function check(ok: boolean, name: string, message: string): void {
  if (!ok) failures.push(`${name}: ${message}`);
 }

 // A. The side door inside the façade span, with the ruled end clearances, and its clear
 //    volume free of every room obstacle.
 check(SD.height === SIDE_DOOR_HEIGHT, 'side-door:height',
  `B4_LAYOUT.sideDoor.height ${SD.height} must equal the exported SIDE_DOOR_HEIGHT ${SIDE_DOOR_HEIGHT}`);
 check(side.door.margins.west >= MIN_END_CLEARANCE - EPS, 'side-door:west-clearance',
  `door x0 ${side.door.x0.toFixed(3)} against the west interior face ${FACADE.x0.toFixed(3)} leaves ${side.door.margins.west.toFixed(3)} m (need ${MIN_END_CLEARANCE.toFixed(2)} m)`);
 check(side.door.margins.east >= MIN_END_CLEARANCE - EPS, 'side-door:east-clearance',
  `door x1 ${side.door.x1.toFixed(3)} against the main door edge ${FACADE.x1.toFixed(3)} leaves ${side.door.margins.east.toFixed(3)} m (need ${MIN_END_CLEARANCE.toFixed(2)} m)`);
 for (const hit of side.door.overlaps) {
  check(false, `side-door:overlap:${hit}`, `the clear doorway overlaps ${hit}`);
 }
 for (const name of side.corridor.blockedBy) {
  check(false, `side-door:corridor:${name}`,
   `the ${CORRIDOR.width} m corridor from (${CORRIDOR_START.join(', ')}) through the side door is blocked by ${name}`);
 }
 check(side.nav.sideDoorOpen, 'nav:side-door-blocked',
  `the campus navigation still blocks the side doorway at x ${side.door.centre} (the band-tower wing carve-out was not split)`);
 check(side.nav.frontWallSolid, 'nav:front-wall-open',
  'the façade wall east of the side door must stay solid');

 // B. The B6 flip wall: inside the hall's north wall, clear of both ends and of the entry
 //    axis, built where it is declared, solid to the touch, and ambient-only.
 const W = B6_HALL.flipWall;
 const hall = O.b6;
 const wallSpan = {x0: hall.x0 + WALL, x1: hall.x1 - WALL};
 const doorL = hall.door - hall.doorWidth / 2, doorR = hall.door + hall.doorWidth / 2;
 check(W.x - W.width / 2 >= wallSpan.x0 + MIN_END_CLEARANCE - EPS, 'flip-wall:west-clearance',
  `the wall starts at x ${r4(W.x - W.width / 2)}, against the hall's west corner ${r4(wallSpan.x0)} plus ${MIN_END_CLEARANCE}`);
 check(W.x + W.width / 2 <= wallSpan.x1 - MIN_END_CLEARANCE + EPS, 'flip-wall:east-clearance',
  `the wall ends at x ${r4(W.x + W.width / 2)}, against the hall's east corner ${r4(wallSpan.x1)} minus ${MIN_END_CLEARANCE}`);
 // The doors are cut in the south wall (z1); the wall hangs on the north wall. What matters
 // is that it stands well clear of the entrance plane, so it can never obstruct the doorway,
 // and that it faces the doors squarely (its span covers the entry axis).
 check(hall.z1 - (W.z + W.depth) >= 2, 'flip-wall:opposite-entrance',
  `the panel face z ${r4(W.z + W.depth)} must stand at least 2 m from the entrance wall z ${hall.z1} so it cannot obstruct the doorway x ${doorL}…${doorR}`);
 check(W.x - W.width / 2 <= hall.door && W.x + W.width / 2 >= hall.door, 'flip-wall:faces-door',
  `the panel span x ${r4(W.x - W.width / 2)}…${r4(W.x + W.width / 2)} must cover the entry axis x ${hall.door}`);
 check(Math.abs(W.z - hall.z0) <= EPS, 'flip-wall:on-north-wall',
  `the wall plane z ${W.z} must be the hall's north wall ${hall.z0}`);
 check(Math.abs(flip.built.x0 - (W.x - W.width / 2)) <= .01 && Math.abs(flip.built.x1 - (W.x + W.width / 2)) <= .01,
  'flip-wall:mount-x', `the built panel spans x ${flip.built.x0}…${flip.built.x1}, declared ${r4(W.x - W.width / 2)}…${r4(W.x + W.width / 2)}`);
 check(Math.abs(flip.built.z1 - (W.z + W.depth)) <= .01,
  'flip-wall:mount-face', `the built panel's face is z ${flip.built.z1}, declared ${r4(W.z + W.depth)} (the collision plane)`);
 check(flip.built.z0 <= W.z + .001,
  'flip-wall:mount-backing-buried', `the built panel's back is z ${flip.built.z0}; it must not float south of the wall plane ${W.z}`);
 check(Math.abs(flip.yaw - W.yaw) <= EPS && Math.abs(flip.yaw) <= EPS, 'flip-wall:mount-yaw',
  `the mount yaw ${flip.yaw} must be 0 so the builder's +Z face looks south into the hall`);
 check(flip.tiles.meshes === 2 && flip.tiles.total > 0 && flip.tiles.dark > 0 && flip.tiles.light > 0, 'flip-wall:tiles',
  `the wall must carry its observable tiles as two instanced meshes in two tones, read ${JSON.stringify(flip.tiles)}`);
 check(flip.collision !== null, 'flip-wall:collision-mounted', 'navigation.ts must mount the wall\'s own collision box');
 if (flip.collision) {
  check(nearBox(flip.collision.z0, W.z) && nearBox(flip.collision.z1, W.z + W.depth), 'flip-wall:collision-span',
   `the collision box z ${flip.collision.z0}…${flip.collision.z1} must be the panel body ${W.z}…${r4(W.z + W.depth)}`);
  check(flip.collision.bottom >= hall.floor + .1 && flip.collision.top <= hall.floor + hall.clearHeight, 'flip-wall:collision-height',
   `the collision must stand between the floor and the ceiling, read ${flip.collision.bottom}…${flip.collision.top}`);
 }
 // The visitor's feet: in front of the wall is walkable, inside it is not; the walk from the
 // entrance doors reaches the wall's viewing point without crossing the shaft or the canteen.
 {
  const nav = createNavigation(BUILDINGS, SITE, true);
  try {
   const faceZ = W.z + W.depth;
   check(!nav.blocked(W.x, faceZ + .9, hall.floor), 'flip-wall:approach-walkable',
    `the viewing spot ${r4(faceZ + .9)} m from the wall face must be walkable`);
   check(nav.blocked(W.x, faceZ + .04, hall.floor), 'flip-wall:panel-solid',
    'the panel itself must block a player standing against it');
   let blockedAt = 0;
   const steps = 200;
   for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = hall.door + (W.x - hall.door) * t, z = (hall.z1 - 1.1) + (faceZ + .9 - (hall.z1 - 1.1)) * t;
    if (nav.blocked(x, z, hall.floor)) blockedAt++;
   }
   check(blockedAt === 0, 'flip-wall:walk-from-door', `the walk from the entrance to the wall must be clear, ${blockedAt}/${steps + 1} blocked`);
   check(nav.support(W.x, faceZ + .9, hall.floor + .3) === hall.floor, 'flip-wall:floor',
    'the wall must stand on the hall floor, not on a hole');
   check(nav.floorAt(W.x, faceZ + .9, hall.floor + .3) === hall.floor, 'flip-wall:floor-pure',
    'the wall court must read the hall floor through the pure query too');
  } finally {
   nav.dispose();
  }
 }
 // Ambient only: silent beyond its trigger, ripples on approach, settles, then holds its cooldown.
 check(flip.ambient.far.turned === 0 && flip.ambient.far.phase === 'idle', 'flip-wall:silent-when-far',
  `a player beyond ${B6_FLIP_TRIGGER} m must not start the ripple, read ${JSON.stringify(flip.ambient.far)}`);
 check(flip.ambient.near.phase !== 'idle' && flip.ambient.near.turned > 0, 'flip-wall:ripples-on-approach',
  `a player in front of the wall must start the ripple, read ${JSON.stringify(flip.ambient.near)}`);
 check(flip.ambient.settled.phase === 'idle' && flip.ambient.settled.turned === 0, 'flip-wall:settles',
  `the ripple must settle back to rest, read ${JSON.stringify(flip.ambient.settled)}`);
 check(flip.ambient.settled.cooldown > 0, 'flip-wall:cooldown',
  `the wall must start its cooldown after a ripple, read ${JSON.stringify(flip.ambient.settled)}`);

 // C. The wall lives in exactly one place: the old modules and their mounts must stay retired.
 {
  const shell = readSource('../src/opening/b4Shell.ts');
  const experience = readSource('../src/opening/experience.ts');
  check(!/B4_flip_wall|b4FlipWall/.test(shell), 'retired:b4-wall-not-in-shell', 'b4Shell.ts must not carry the retired B4 flip wall');
  check(!/B5_flip_wall|b5FlipWall/.test(shell), 'retired:b5-wall-not-in-shell', 'b4Shell.ts must not carry the retired B5 flip wall');
  check(/createB6FlipWall/.test(experience), 'retired:b6-wall-mounted', 'experience.ts must mount the B6 flip wall');
 }

 if (failures.length) {
  console.error(`\ncheck-flip-walls: FAIL — a measured façade does not fit (${failures.length} named case(s)):`);
  for (const failure of failures) console.error('  FAIL', failure);
  console.error('\nA red case here means the geometry is wrong, not the gate.');
 } else {
  console.log('\ncheck-flip-walls: PASS — side door in the CDS-1 façade; flip wall on the B6 hall\'s north wall, solid, walkable, ambient.');
 }
 return failures;
}

function nearBox(a: number, b: number): boolean { return Math.abs(a - b) <= .01; }

function readSource(relative: string): string {
 return fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
}

// Importable: runGate() may be reused without exiting at import time.
const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) process.exitCode = runGate().length ? 1 : 0;
