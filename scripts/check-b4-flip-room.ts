import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {B4_FLIP_WALL, createB4FlipWall} from '../src/opening/b4FlipWall';
import {B4_LAYOUT, B4_OBSTACLES, B4_SOFA_RECTS, SIDE_DOOR_HEIGHT, type B4Rect} from '../src/opening/b4Layout';
import {OPENING as O} from '../src/opening/spatialLayout';

/**
 * B04 side-entrance + flip-wall fit gate (Ruling G1, 2026-11-24).
 *
 * Ruling G1 retires the 11.4 × 5.2 preview room in B4: the lobby is a cavity inside the band
 * tower, so the south façade (`z = 20.5`) is its only exterior plane. B4 gets a side door in
 * that façade, west of the main door, and the observed flip wall mounted on the same wall's
 * interior face, east of the main door. This gate measures both against the real source
 * constants and the real builder output:
 *
 *   1. the side door sits inside the façade span, ≥ 0.20 m from each end, and its clear
 *      volume overlaps no `B4_OBSTACLES` rect at `z 19.9…20.5`;
 *   2. the flip wall sits inside the façade span, ≥ 0.20 m from the main door edge, and the
 *      built mount lands on the declared interval;
 *   3. the ruled wall box intersects no `B4_OBSTACLES` rect and no `B4_SOFA_RECTS` entry;
 *   4. a 0.60 m-wide corridor from the plaza `(47.75, 23.00)` through the side door to the
 *      wall centre `(63.69, 19.50)` is clear of every `B4_OBSTACLES` rect below 1.8 m;
 *   5. every measured number is printed as JSON (`door`, `wall`, `margins`, `corridor`,
 *      `intersections`) so the report carries evidence, not prose.
 *
 * A straight chord from the plaza point to the wall centre crosses the façade near x≈59.1,
 * i.e. through the *main* door, so the corridor is walked as a polyline through the side
 * door's centre line. The last assertion also checks the built campus navigation, because
 * the façade collision is authored twice: by `B4_OBSTACLES` (the room) and by
 * `openingObstacles` (the band-tower wing carve-out). Splitting only the first would leave
 * an invisible wall in the new door.
 */

const R = O.b4;
const WALL = B4_LAYOUT.wall;
const SD = B4_LAYOUT.sideDoor;
const F = R.floor;
const EPS = 1e-6;
/** The façade's usable span: west interior face to the main door's west edge. */
const FACADE = {x0: R.x0 + .01 + WALL, x1: R.door - R.doorWidth / 2, z0: 19.9, z1: R.z1};
/** The wall's usable span: main door's east edge to the east interior face. */
const WALL_SPAN = {x0: R.door + R.doorWidth / 2, x1: R.x1 - .01 - WALL};
const MIN_END_CLEARANCE = .20;
/** The brief's corridor: 0.60 m wide, sampled every 5 cm, obstacles below 1.8 m tall. */
const CORRIDOR = {width: .60, step: .05, obstacleTop: 1.8} as const;
const CORRIDOR_START: readonly [number, number] = [47.75, 23.00];
/** Inside the room, clear of the wall and the sofa, before turning east. */
const CORRIDOR_VIA: readonly [number, number] = [47.75, 19.50];
const CORRIDOR_WALL_END: readonly [number, number] = [63.69, 19.50];

const r4 = (value: number) => +value.toFixed(4);
const r2 = (value: number) => +value.toFixed(2);

export interface Box3 {x0: number; x1: number; y0: number; y1: number; z0: number; z1: number}
export interface Overlap {name: string; overlap: Box3}

export interface B4SideDoorReport {
  door: {
    x0: number; x1: number; width: number; centre: number; height: number; z: number;
    facade: {x0: number; x1: number};
    margins: {west: number; east: number};
    overlaps: string[];
  };
  wall: {
    declared: Box3;
    measured: Box3;
    origin: [number, number, number];
    yaw: number;
    width: number;
    span: {x0: number; x1: number};
    margins: {mainDoor: number; east: number};
  };
  margins: {sideDoorWest: number; sideDoorEast: number; flipWallMainDoor: number; flipWallEast: number};
  intersections: {obstacles: Overlap[]; sofa: Overlap[]; doorVolume: Overlap[]};
  corridor: {
    width: number;
    from: [number, number];
    via: [number, number];
    to: [number, number];
    path: [number, number][];
    samples: number;
    blockedBy: string[];
  };
  nav: {sideDoorOpen: boolean; frontWallSolid: boolean; facadeSegments: string[]};
}

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

function wallIntersections(box: Box3): {obstacles: Overlap[]; sofa: Overlap[]} {
  const obstacles: Overlap[] = [];
  for (const rect of B4_OBSTACLES) {
    const overlap = overlapOf(box, rectBox(rect));
    if (overlap) obstacles.push({name: rect.name, overlap});
  }
  const sofaTop = F + B4_LAYOUT.lobby.sofa.back;
  const sofa: Overlap[] = [];
  for (const [i, [x0, x1, z0, z1]] of B4_SOFA_RECTS.entries()) {
    const overlap = overlapOf(box, {x0, x1, y0: F, y1: sofaTop, z0, z1});
    if (overlap) sofa.push({name: 'B4_SOFA_RECTS[' + i + ']', overlap});
  }
  return {obstacles, sofa};
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

/** All measured numbers the gate and the task report need, as data rather than prose. */
export function measuredReport(): B4SideDoorReport {
  const mount = createB4FlipWall();
  try {
    const door = {
      x0: SD.x0, x1: SD.x1, width: r4(SD.x1 - SD.x0), centre: r4((SD.x0 + SD.x1) / 2),
      height: SD.height, z: SD.z,
      facade: {x0: r4(FACADE.x0), x1: r4(FACADE.x1)},
      margins: {west: r4(SD.x0 - FACADE.x0), east: r4(FACADE.x1 - SD.x1)},
      overlaps: doorVolumeOverlaps(SD.x0, SD.x1, SD.height).map(o => o.name),
    };
    const wallBox: Box3 = {x0: B4_FLIP_WALL.x0, x1: B4_FLIP_WALL.x1, y0: B4_FLIP_WALL.y0, y1: B4_FLIP_WALL.y1, z0: B4_FLIP_WALL.z1 - B4_FLIP_WALL.depth, z1: B4_FLIP_WALL.z1};
    const intersections = {...wallIntersections(wallBox), doorVolume: doorVolumeOverlaps(SD.x0, SD.x1, SD.height)};
    const path: [number, number][] = [
      [CORRIDOR_START[0], CORRIDOR_START[1]],
      [CORRIDOR_VIA[0], CORRIDOR_VIA[1]],
      [r4(CORRIDOR_WALL_END[0]), CORRIDOR_WALL_END[1]],
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
          facadeSegments.push(`${obstacle.name} x ${r2(obstacle.x - obstacle.w / 2)}…${r2(obstacle.x + obstacle.w / 2)} y ${r2(obstacle.bottom)}…${r2(obstacle.top)}`);
        }
      }
    } finally {
      nav.dispose();
    }
    return {
      door,
      wall: {
        declared: wallBox,
        measured: mount.measured,
        origin: [r4(mount.origin[0]), r4(mount.origin[1]), r4(mount.origin[2])],
        yaw: mount.yaw,
        width: r4(mount.width),
        span: {x0: r4(WALL_SPAN.x0), x1: r4(WALL_SPAN.x1)},
        margins: {mainDoor: r4(B4_FLIP_WALL.x0 - WALL_SPAN.x0), east: r4(WALL_SPAN.x1 - B4_FLIP_WALL.x1)},
      },
      margins: {
        sideDoorWest: door.margins.west,
        sideDoorEast: door.margins.east,
        flipWallMainDoor: r4(B4_FLIP_WALL.x0 - WALL_SPAN.x0),
        flipWallEast: r4(WALL_SPAN.x1 - B4_FLIP_WALL.x1),
      },
      intersections,
      corridor: {
        width: CORRIDOR.width,
        from: [CORRIDOR_START[0], CORRIDOR_START[1]],
        via: [CORRIDOR_VIA[0], CORRIDOR_VIA[1]],
        to: path[2]!,
        path,
        samples: corridor.samples,
        blockedBy: corridor.blockedBy,
      },
      nav: {sideDoorOpen, frontWallSolid, facadeSegments},
    };
  } finally {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    mount.root.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      geometries.add(o.geometry);
      for (const m of [o.material].flat()) materials.add(m);
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  }
}

/** Print the measured numbers, assert the fit, and return the named failures. */
export function runGate(): string[] {
  const report = measuredReport();
  console.log('== check-b4-flip-room: B04 side entrance + façade flip wall (Ruling G1) ==');
  console.log('side door:', JSON.stringify(report.door));
  console.log('flip wall:', JSON.stringify(report.wall));
  console.log('margins:', JSON.stringify(report.margins));
  console.log('intersections:', JSON.stringify(report.intersections));
  console.log('corridor:', JSON.stringify(report.corridor));
  console.log('nav:', JSON.stringify(report.nav));
  console.log('measuredReport JSON:');
  console.log(JSON.stringify(report, null, 1));

  const failures: string[] = [];
  function check(ok: boolean, name: string, message: string): void {
    if (!ok) failures.push(`${name}: ${message}`);
  }

  // 1. The side door inside the façade span, with the ruled end clearances, and its clear
  //    volume free of every room obstacle. The clear height comes from the layout's exported
  //    `SIDE_DOOR_HEIGHT`, so a drifting copy in `B4_LAYOUT.sideDoor` fails here.
  check(SD.height === SIDE_DOOR_HEIGHT, 'side-door:height',
    `B4_LAYOUT.sideDoor.height ${SD.height} must equal the exported SIDE_DOOR_HEIGHT ${SIDE_DOOR_HEIGHT}`);
  check(report.door.margins.west >= MIN_END_CLEARANCE - EPS, 'side-door:west-clearance',
    `door x0 ${report.door.x0.toFixed(3)} against the west interior face ${FACADE.x0.toFixed(3)} leaves ${report.door.margins.west.toFixed(3)} m (need ${MIN_END_CLEARANCE.toFixed(2)} m)`);
  check(report.door.margins.east >= MIN_END_CLEARANCE - EPS, 'side-door:east-clearance',
    `door x1 ${report.door.x1.toFixed(3)} against the main door edge ${FACADE.x1.toFixed(3)} leaves ${report.door.margins.east.toFixed(3)} m (need ${MIN_END_CLEARANCE.toFixed(2)} m)`);
  for (const hit of report.intersections.doorVolume) {
    check(false, `side-door:overlap:${hit.name}`,
      `the clear doorway (x ${report.door.x0}–${report.door.x1}, y ${F.toFixed(2)}–${(F + report.door.height).toFixed(2)}, z ${FACADE.z0}–${FACADE.z1}) overlaps ${hit.name} over x ${hit.overlap.x0}–${hit.overlap.x1}, y ${hit.overlap.y0}–${hit.overlap.y1}, z ${hit.overlap.z0}–${hit.overlap.z1}`);
  }

  // 2. The flip wall inside its span, clear of the main door, and the built mount on the
  //    declared interval.
  check(report.wall.margins.mainDoor >= MIN_END_CLEARANCE - EPS, 'flip-wall:main-door-clearance',
    `wall x0 ${B4_FLIP_WALL.x0.toFixed(3)} against the main door edge ${WALL_SPAN.x0.toFixed(3)} leaves ${report.wall.margins.mainDoor.toFixed(3)} m (need ${MIN_END_CLEARANCE.toFixed(2)} m)`);
  check(report.wall.margins.east >= MIN_END_CLEARANCE - EPS, 'flip-wall:east-clearance',
    `wall x1 ${B4_FLIP_WALL.x1.toFixed(3)} against the east interior face ${WALL_SPAN.x1.toFixed(3)} leaves ${report.wall.margins.east.toFixed(3)} m (need ${MIN_END_CLEARANCE.toFixed(2)} m)`);
  check(B4_FLIP_WALL.x0 >= WALL_SPAN.x0 - EPS && B4_FLIP_WALL.x1 <= WALL_SPAN.x1 + EPS, 'flip-wall:inside-span',
    `wall ${B4_FLIP_WALL.x0}–${B4_FLIP_WALL.x1} must sit inside ${WALL_SPAN.x0}–${WALL_SPAN.x1}`);
  check(Math.abs(report.wall.measured.x0 - B4_FLIP_WALL.x0) <= .01, 'flip-wall:mount-x0',
    `the built panel starts at x ${report.wall.measured.x0} (declared ${B4_FLIP_WALL.x0})`);
  check(Math.abs(report.wall.measured.x1 - B4_FLIP_WALL.x1) <= .01, 'flip-wall:mount-x1',
    `the built panel ends at x ${report.wall.measured.x1} (declared ${B4_FLIP_WALL.x1}; builder width ${report.wall.width})`);
  check(Math.abs(report.wall.origin[2] - B4_FLIP_WALL.z1) <= EPS, 'flip-wall:mount-z',
    `the mount origin z ${report.wall.origin[2]} must be the wall's interior plane ${B4_FLIP_WALL.z1}`);
  check(Math.abs(report.wall.yaw - Math.PI) <= EPS, 'flip-wall:mount-yaw',
    `the mount yaw ${report.wall.yaw} must be π so the builder's +Z face looks north`);

  // 3. The ruled wall box clear of every room obstacle and every sofa module.
  for (const hit of report.intersections.obstacles) {
    check(false, `flip-wall:intersect:${hit.name}`,
      `the wall box overlaps ${hit.name} over x ${hit.overlap.x0}–${hit.overlap.x1}, y ${hit.overlap.y0}–${hit.overlap.y1}, z ${hit.overlap.z0}–${hit.overlap.z1}`);
  }
  for (const hit of report.intersections.sofa) {
    check(false, `flip-wall:sofa:${hit.name}`,
      `the wall box overlaps ${hit.name} over x ${hit.overlap.x0}–${hit.overlap.x1}, z ${hit.overlap.z0}–${hit.overlap.z1}`);
  }

  // 4. The 0.60 m corridor from the plaza, through the side door, to the wall centre.
  for (const name of report.corridor.blockedBy) {
    check(false, `corridor:${name}`,
      `the ${CORRIDOR.width} m corridor from (${CORRIDOR_START.join(', ')}) through the side door to (${report.corridor.to.join(', ')}) is blocked by ${name}`);
  }

  // 6. The built campus collision agrees: the doorway is open, the façade either side is not.
  //    This is the one check the brief's B4_OBSTACLES-only corridor cannot see: the wing
  //    carve-out is a second collider in front of the room's own front wall.
  check(report.nav.sideDoorOpen, 'nav:side-door-closed',
    `the campus navigation still blocks the side doorway at x ${report.door.centre} (the band-tower wing carve-out was not split)`);
  check(report.nav.frontWallSolid, 'nav:front-wall-open',
    'the façade wall east of the side door must stay solid');

  if (failures.length) {
    console.error(`\ncheck-b4-flip-room: FAIL — the ruled side entrance / flip wall does not fit (${failures.length} named case(s)):`);
    for (const failure of failures) console.error('  FAIL', failure);
    console.error('\nA red case here means the geometry is wrong, not the gate.');
  } else {
    console.log('\ncheck-b4-flip-room: PASS — side door 46.45–49.05 in the façade, flip wall 60.00–67.37 on its interior face, corridor clear.');
  }
  return failures;
}

// Importable: measuredReport()/runGate() may be reused without exiting at import time.
const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) process.exitCode = runGate().length ? 1 : 0;
