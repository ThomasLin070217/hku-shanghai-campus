import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {BUILDINGS, SITE} from '../src/model/campusParameters';
import {buildObservedFeatureRoom, type FeatureRoomPart} from '../src/model/observedFeatureRooms';
import {B4_OBSTACLES, type B4Rect} from '../src/opening/b4Layout';
import {OPENING as O} from '../src/opening/spatialLayout';

/**
 * B4 side-entrance flip-room fit gate (Task 2.1 Step 1).
 *
 * The flip wall moves from the B5 lobby to the B4 campus-facing side entrance. Before
 * a door is cut or the room is mounted, this gate measures what a naive mount does:
 * derive B04's exterior faces from the site footprint, build the observed room with
 * the real builder, place it at the withdrawn origin/yaw, and assert the world box
 * against the interior shell, the furniture/racks, and a walkable corridor.
 *
 * TODAY THIS GATE MUST FAIL. The withdrawn mount `[48.05,.02,11.80]`, yaw π/2 spills
 * past the B4 shell at x=46 and z=7 and swallows racks 1–3. A red gate with numbers is
 * the deliverable; Task 2.1 Step 4 re-derives the origin/rotation until this turns green.
 *
 * Ruling G1 (docs/plans/2026-11-24-b4-side-entrance-ruling.md) subsequently retired the
 * 11.4 × 5.2 room shell in B4 in favour of a wall-only mount on the south façade, so the
 * premise measured here is superseded: Task C rewrites this gate to the ruled door and
 * flip-wall numbers. Until that rewrite, this file records what the withdrawn room
 * measurement proves — do not satisfy it by moving racks.
 */

/** The mapper's withdrawn mount (2026-11-23). Kept here as the thing to disprove, not
 * as a placement: Task 2.1 Step 4 owns the accepted origin/yaw. */
export const WITHDRAWN_FLIP_ORIGIN: readonly [number, number, number] = [48.05, .02, 11.80];
export const WITHDRAWN_FLIP_YAW = Math.PI / 2;
/** The room as the observed builder makes it. The closet is part of the room; mounting
 * only shell+wall would hide its overflow rather than measure the room that ships. */
export const FLIP_ROOM_PARTS: readonly FeatureRoomPart[] = ['shell', 'wall', 'closet'];
/** Task 2.1 Step 4 mounts shell+wall first, so the same measurement is reported for it. */
const WALL_MOUNT_PARTS: readonly FeatureRoomPart[] = ['shell', 'wall'];
/** Clearance required between the room box and every interior-shell face. */
export const REQUIRED_CLEARANCE = .20;
/** A walking corridor is this wide and this tall, measured from the B4 floor. */
export const CORRIDOR = {width: .5, height: 2.0, sampleStep: .05} as const;
/** The plaza point stands this far outside the exterior face, on the arrival forecourt. */
const SIDE_APPROACH_DISTANCE = 4;
const EPS = 1e-6;
const r = (value: number) => +value.toFixed(4);

export interface Rect2 {
  x0: number; x1: number; z0: number; z1: number;
}
export interface Box3 {
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
}
export interface Face {
  id: 'south' | 'west' | 'north' | 'east';
  axis: 'x' | 'z';
  plane: number;
  outward: '+x' | '-x' | '+z' | '-z';
  /** The face's tangent span [min,max], for reporting where a door could sit. */
  span: [number, number];
  /** An in-source campus anchor (forecourt handoff or plaza) lies outward of this face.
   * This says which way the face looks, not that it is an exterior wall — a face is
   * buildable only when it also `coincidesWithShell` (Ruling G1: the south façade). */
  campusAnchorOutward: boolean;
  /** The face plane is the interior shell's own plane (the room's wall is the façade). */
  coincidesWithShell: boolean;
}
export interface Overlap {
  name: string;
  rect: B4Rect;
  overlap: { x: [number, number]; y: [number, number]; z: [number, number] };
}
export interface FlipRoomReport {
  mount: { origin: [number, number, number]; yaw: number; parts: FeatureRoomPart[] };
  interiorShell: Rect2;
  footprint: Rect2;
  exteriorFaces: Face[];
  box: Box3;
  margins: Record<'x0' | 'x1' | 'z0' | 'z1', number>;
  requiredClearance: number;
  intersections: Overlap[];
  racksSwallowed: string[];
  /** shell+wall only, the sub-mount Task 2.1 Step 4 fits first. */
  wallMount: { parts: FeatureRoomPart[]; box: Box3; margins: FlipRoomReport['margins'] };
  corridor: {
    width: number;
    from: [number, number, number];
    to: [number, number, number];
    samples: number;
    blockedBy: string[];
  };
}

/** B04's axis-aligned footprint, straight from the campus parameters that build the site. */
export function b04Footprint(): Rect2 {
  const spec = BUILDINGS.find(b => b.id === 'B04');
  assert.ok(spec, 'B04 must exist in the campus parameters');
  assert.equal(spec!.rotation, 0, 'the footprint derivation assumes B04 is unrotated');
  const footprint = {
    x0: r(spec!.x - spec!.width / 2), x1: r(spec!.x + spec!.width / 2),
    z0: r(spec!.z - spec!.depth / 2), z1: r(spec!.z + spec!.depth / 2),
  };
  // The canon ruling's footprint. Pin it: if the site table moves B04, this gate must
  // say the room fit was measured against a different building.
  assert.deepEqual(footprint, {x0: 28.15, x1: 87.85, z0: -24.5, z1: 20.5},
    'B04 footprint must match the canon site table (x 28.15–87.85, z −24.5…20.5)');
  return footprint;
}

/** The four exterior faces, each checked against the two campus anchors already in source:
 * the arrival forecourt handoff (south of B04) and the central plaza (west of B04). */
export function exteriorFaces(footprint: Rect2): Face[] {
  const shell = O.b4;
  const anchors: readonly [number, number][] = [[O.handoff[0], O.handoff[2]], [SITE.plazaX, SITE.plazaZ]];
  const face = (id: Face['id'], axis: Face['axis'], plane: number, outward: Face['outward'], span: [number, number], shellPlane: number): Face => ({
    id, axis, plane, outward, span,
    campusAnchorOutward: anchors.some(([x, z]) => axis === 'x'
      ? (outward === '-x' ? x < plane && z >= span[0] && z <= span[1] : x > plane && z >= span[0] && z <= span[1])
      : (outward === '-z' ? z < plane && x >= span[0] && x <= span[1] : z > plane && x >= span[0] && x <= span[1])),
    coincidesWithShell: Math.abs(plane - shellPlane) <= EPS,
  });
  return [
    face('south', 'z', footprint.z1, '+z', [footprint.x0, footprint.x1], shell.z1),
    face('west', 'x', footprint.x0, '-x', [footprint.z0, footprint.z1], shell.x0),
    face('north', 'z', footprint.z0, '-z', [footprint.x0, footprint.x1], shell.z0),
    face('east', 'x', footprint.x1, '+x', [footprint.z0, footprint.z1], shell.x1),
  ];
}

/** Build the observed room with the real builder, mount it at origin/yaw, and return its
 * world AABB. The builder is the source of truth for the box, not a hand-copied constant. */
export function roomBox(parts: readonly FeatureRoomPart[], origin: readonly [number, number, number], yaw: number): { box: Box3; dispose: () => void } {
  const room = buildObservedFeatureRoom('flipWall', {parts});
  const mount = new T.Group();
  mount.position.fromArray([...origin]);
  mount.rotation.y = yaw;
  mount.add(room);
  mount.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(mount);
  const dispose = () => {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    mount.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      geometries.add(o.geometry);
      for (const m of [o.material].flat()) materials.add(m);
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };
  return {
    box: {x0: r(bounds.min.x), x1: r(bounds.max.x), y0: r(bounds.min.y), y1: r(bounds.max.y), z0: r(bounds.min.z), z1: r(bounds.max.z)},
    dispose,
  };
}

function marginsOf(box: Box3): FlipRoomReport['margins'] {
  return {
    x0: r(box.x0 - O.b4.x0),
    x1: r(O.b4.x1 - box.x1),
    z0: r(box.z0 - O.b4.z0),
    z1: r(O.b4.z1 - box.z1),
  };
}

function intersect(box: Box3, rect: B4Rect): Overlap['overlap'] | null {
  const x: [number, number] = [Math.max(box.x0, rect.x0), Math.min(box.x1, rect.x1)];
  const y: [number, number] = [Math.max(box.y0, rect.bottom), Math.min(box.y1, rect.top)];
  const z: [number, number] = [Math.max(box.z0, rect.z0), Math.min(box.z1, rect.z1)];
  return x[0] < x[1] && y[0] < y[1] && z[0] < z[1] ? {x: [r(x[0]), r(x[1])], y: [r(y[0]), r(y[1])], z: [r(z[0]), r(z[1])]} : null;
}

function corridorBlockers(from: readonly [number, number, number], to: readonly [number, number, number], obstacles: readonly B4Rect[]): { samples: number; blockedBy: string[] } {
  const half = CORRIDOR.width / 2, dx = to[0] - from[0], dz = to[2] - from[2];
  const length = Math.hypot(dx, dz), samples = Math.max(1, Math.ceil(length / CORRIDOR.sampleStep));
  const blocked: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, x = from[0] + dx * t, z = from[2] + dz * t;
    const probe: Box3 = {x0: r(x - half), x1: r(x + half), y0: O.b4.floor, y1: r(O.b4.floor + CORRIDOR.height), z0: r(z - half), z1: r(z + half)};
    for (const rect of obstacles) if (intersect(probe, rect) && !blocked.includes(rect.name)) blocked.push(rect.name);
  }
  return {samples: samples + 1, blockedBy: blocked};
}

/** All measured numbers the gate and the task report need, as data rather than prose. */
export function measuredReport(): FlipRoomReport {
  const footprint = b04Footprint();
  const full = roomBox(FLIP_ROOM_PARTS, WITHDRAWN_FLIP_ORIGIN, WITHDRAWN_FLIP_YAW);
  const wall = roomBox(WALL_MOUNT_PARTS, WITHDRAWN_FLIP_ORIGIN, WITHDRAWN_FLIP_YAW);
  try {
    const intersections: Overlap[] = [];
    for (const rect of B4_OBSTACLES) {
      const overlap = intersect(full.box, rect);
      if (overlap) intersections.push({name: rect.name, rect, overlap});
    }
    const centreX = r((full.box.x0 + full.box.x1) / 2), centreZ = r((full.box.z0 + full.box.z1) / 2);
    const centre: [number, number, number] = [centreX, O.b4.floor, centreZ];
    // The side door is on the shell-coincident exterior face: derive it, do not assume it.
    const coincident = exteriorFaces(footprint).filter(f => f.coincidesWithShell);
    assert.equal(coincident.length, 1, 'exactly one B04 exterior face must coincide with the interior shell plane');
    const doorFace = coincident[0]!;
    const outward = doorFace.outward.startsWith('-') ? -1 : 1;
    const from: [number, number, number] = doorFace.axis === 'z'
      ? [centreX, O.b4.floor, doorFace.plane + outward * SIDE_APPROACH_DISTANCE]
      : [doorFace.plane + outward * SIDE_APPROACH_DISTANCE, O.b4.floor, centreZ];
    const corridor = corridorBlockers(from, centre, B4_OBSTACLES);
    return {
      mount: {origin: [...WITHDRAWN_FLIP_ORIGIN], yaw: WITHDRAWN_FLIP_YAW, parts: [...FLIP_ROOM_PARTS]},
      interiorShell: {x0: O.b4.x0, x1: O.b4.x1, z0: O.b4.z0, z1: O.b4.z1},
      footprint,
      exteriorFaces: exteriorFaces(footprint),
      box: full.box,
      margins: marginsOf(full.box),
      requiredClearance: REQUIRED_CLEARANCE,
      intersections,
      racksSwallowed: intersections.filter(o => o.name.startsWith('opening-b4-rack-')).map(o => o.name),
      wallMount: {parts: [...WALL_MOUNT_PARTS], box: wall.box, margins: marginsOf(wall.box)},
      corridor: {width: CORRIDOR.width, from, to: centre, samples: corridor.samples, blockedBy: corridor.blockedBy},
    };
  } finally {
    full.dispose();
    wall.dispose();
  }
}

/** Print the measured numbers, assert the fit, and return the named failures. */
export function runGate(): string[] {
  const report = measuredReport();
  console.log('== check-b4-flip-room: B4 side-entrance flip-room fit ==');
  console.log('B04 footprint (campusParameters):', JSON.stringify(report.footprint));
  console.log('B04 interior shell (spatialLayout):', JSON.stringify(report.interiorShell));
  for (const face of report.exteriorFaces) {
    console.log(`face ${face.id} ${face.outward}: plane ${face.plane.toFixed(2)}, span ${face.span.join('–')}, anchor-outward=${face.campusAnchorOutward}, shell-coincident=${face.coincidesWithShell}`);
  }
  console.log('mount:', JSON.stringify(report.mount));
  console.log('room world box:', JSON.stringify(report.box));
  console.log('margins:', JSON.stringify(report.margins), '(required', report.requiredClearance + ')');
  console.log('wall-only mount box:', JSON.stringify(report.wallMount.box), 'margins:', JSON.stringify(report.wallMount.margins));
  console.log('intersections:', report.intersections.length ? report.intersections.map(o => o.name).join(', ') : 'none');
  console.log('racks swallowed:', report.racksSwallowed.length ? report.racksSwallowed.join(', ') : 'none');
  console.log('corridor:', JSON.stringify(report.corridor));
  console.log('measuredReport JSON:');
  console.log(JSON.stringify(report, null, 1));

  const failures: string[] = [];
  function check(ok: boolean, name: string, message: string): void {
    if (!ok) failures.push(`${name}: ${message}`);
  }

  const box = report.box, shell = report.interiorShell;
  function marginFailure(key: 'x0' | 'x1' | 'z0' | 'z1', value: number, plane: number): void {
    const have = key === 'x0' || key === 'z0' ? value - plane : plane - value;
    check(have >= REQUIRED_CLEARANCE - EPS, `clearance:${key}`,
      `room ${key} ${value.toFixed(3)} m against shell plane ${plane.toFixed(3)} m leaves ${have.toFixed(3)} m clearance (need ${REQUIRED_CLEARANCE.toFixed(2)} m; short by ${Math.max(0, REQUIRED_CLEARANCE - have).toFixed(3)} m)`);
  }
  marginFailure('x0', box.x0, shell.x0);
  marginFailure('x1', box.x1, shell.x1);
  marginFailure('z0', box.z0, shell.z0);
  marginFailure('z1', box.z1, shell.z1);
  for (const hit of report.intersections) {
    check(false, `intersect:${hit.name}`,
      `room box overlaps ${hit.name} over x ${hit.overlap.x[0].toFixed(2)}–${hit.overlap.x[1].toFixed(2)}, y ${hit.overlap.y[0].toFixed(2)}–${hit.overlap.y[1].toFixed(2)}, z ${hit.overlap.z[0].toFixed(2)}–${hit.overlap.z[1].toFixed(2)}`);
  }
  check(report.racksSwallowed.length === 0, 'racks:swallowed',
    `racks 1–3 are inside the room box (${report.racksSwallowed.join(', ') || 'none'})`);
  for (const name of report.corridor.blockedBy) {
    check(false, `corridor:${name}`,
      `the ${CORRIDOR.width} m corridor from the forecourt (${report.corridor.from.map(v => v.toFixed(2)).join(',')}) to the room centre (${report.corridor.to.map(v => v.toFixed(2)).join(',')}) is blocked by ${name}`);
  }

  if (failures.length) {
    console.error(`\ncheck-b4-flip-room: FAIL — the withdrawn mount does not fit B4 (${failures.length} named case(s)):`);
    for (const failure of failures) console.error('  FAIL', failure);
    console.error('\nThe gate is red by design. Ruling G1 retires this 11.4 × 5.2 room and mounts');
    console.error('only the wall on the south façade; Task C rewrites this gate to the ruled numbers.');
    console.error('Do not move geometry or racks here.');
  } else {
    console.log('\ncheck-b4-flip-room: PASS — the room fits the B4 side entrance with margin and a clear corridor.');
  }
  return failures;
}

// Importable: measuredReport()/runGate() may be reused without exiting at import time.
const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) process.exitCode = runGate().length ? 1 : 0;
