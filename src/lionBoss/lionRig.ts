import * as T from 'three';
import type {PrimitiveTrace} from '../scene/authoring';
import {AWAKEN_SECONDS, type CombatState, type Phase} from './combat';

/**
 * Runtime-only skeleton for the authored L001 seated statue.
 *
 * `src/model/nov13Details.ts::createLion()` stays untouched: the campus statue and
 * `assets/items/entrance-lion.glb` remain the seated sculpture. This module rebuilds
 * the already-compacted boss body as skinned meshes, adds hidden legs and authors the
 * clips that stand the lion up and walk it around the lawn.
 *
 * Coordinate space: everything here is in `Lion_body_uniform_scale` local space,
 * before `body.scale` / `body.position`. The lion faces +Z (muzzle at z~1.0), which
 * matches `atan2(dx,dz)` combat yaw.
 */

export type LionBoneName =
  | 'root' | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'thighL' | 'shinL' | 'footL' | 'thighR' | 'shinR' | 'footR'
  | 'upperArmL' | 'foreArmL' | 'upperArmR' | 'foreArmR'
  | 'tail1' | 'tail2' | 'tail3';

export type LionClipName =
  | 'seated' | 'awaken' | 'idle' | 'walk' | 'run'
  | 'chargeWarn' | 'charge' | 'swipeWarn' | 'stunned' | 'shutdown';

export const LION_BONE_NAMES: readonly LionBoneName[] = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
  'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR',
  'tail1', 'tail2', 'tail3',
];

export const LION_CLIP_NAMES: readonly LionClipName[] = [
  'seated', 'awaken', 'idle', 'walk', 'run',
  'chargeWarn', 'charge', 'swipeWarn', 'stunned', 'shutdown',
];

/** One-shot clips are clamped; everything else loops. */
export const LION_ONESHOT_CLIPS: readonly LionClipName[] = ['awaken', 'shutdown'];

type V3 = [number, number, number];

/** Absolute rest positions in body-local space (parents listed before children). */
const REST_POSITION: Record<LionBoneName, V3> = {
  root: [0, 0, 0],
  hips: [0, .84, 0],
  spine: [0, 1.30, 0],
  chest: [0, 1.86, 0],
  neck: [0, 2.42, 0],
  head: [0, 2.64, 0],
  // Rest legs hang straight; the seated clip folds them under the gown. In the standing
  // pose the hips rise 0.55 so the feet land exactly on the statue's support top.
  thighL: [-.36, .84, 0], shinL: [-.36, .10, 0], footL: [-.36, -.47, 0],
  thighR: [.36, .84, 0], shinR: [.36, .10, 0], footR: [.36, -.47, 0],
  upperArmL: [-.95, 1.98, .16], foreArmL: [-1.12, 1.30, .62],
  upperArmR: [.95, 1.98, .16], foreArmR: [1.12, 1.30, .62],
  tail1: [.18, .32, -.72], tail2: [.52, .27, -1.10], tail3: [.88, .24, -1.36],
};

const PARENT: Record<LionBoneName, LionBoneName | null> = {
  root: null, hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL',
  thighR: 'hips', shinR: 'thighR', footR: 'shinR',
  upperArmL: 'chest', foreArmL: 'upperArmL', upperArmR: 'chest', foreArmR: 'upperArmR',
  tail1: 'hips', tail2: 'tail1', tail3: 'tail2',
};

const HEAD_PARTS = new Set([
  'Golden_mane', 'Forelock', 'Face', 'Ear', 'Ear_inner', 'Muzzle', 'Eye', 'Eye_glint',
  'Nose', 'Smile', 'Tongue', 'Lower_lip', 'Whisker', 'Whisker_dot',
]);
const CHEST_PARTS = new Set([
  'Gown_badge', 'Gown_badge_field', 'Gown_badge_book',
]);
const HIPS_PARTS = new Set(['Seated_body', 'Seated_trousers', 'Trouser_leg']);
const FOREARM_PARTS = new Set([
  'Gown_cuff', 'Arm', 'Paw', 'Paw_toe', 'Paw_HKU_lettering', 'Paw_crest', 'Paw_crest_book',
]);

/** Rigid part → bone. Returns null when the trace needs per-vertex blending. */
function boneForTrace(name: string, centerX: number): LionBoneName | null {
  if (HEAD_PARTS.has(name) || name.startsWith('Mane_')) return 'head';
  if (CHEST_PARTS.has(name)) return 'chest';
  if (HIPS_PARTS.has(name)) return 'hips';
  if (name === 'Gown_sleeve') return centerX < 0 ? 'upperArmL' : 'upperArmR';
  if (FOREARM_PARTS.has(name)) return centerX < 0 ? 'foreArmL' : 'foreArmR';
  if (name === 'Tail_tip') return 'tail3';
  if (name === 'Rounded_body_mid' || name === 'Shirt_front_panel'
    || name.startsWith('Shirt_vertical_stripe') || name === 'Tail') return null;
  // Unknown authored part: keep it attached to the nearest torso segment.
  return null;
}

function torsoBlend(y: number): Array<[LionBoneName, number]> {
  if (y <= 1) return [['hips', 1]];
  if (y < 1.5) { const t = (y - 1) / .5; return [['hips', 1 - t], ['spine', t]]; }
  if (y < 1.9) return [['spine', 1]];
  if (y < 2.4) { const t = (y - 1.9) / .5; return [['spine', 1 - t], ['chest', t]]; }
  return [['chest', 1]];
}

function tailBlend(z: number): Array<[LionBoneName, number]> {
  if (z >= -.95) return [['tail1', 1]];
  if (z >= -1.10) { const t = (-.95 - z) / .15; return [['tail1', 1 - t], ['tail2', t]]; }
  if (z >= -1.22) return [['tail2', 1]];
  if (z >= -1.36) { const t = (-1.22 - z) / .14; return [['tail2', 1 - t], ['tail3', t]]; }
  return [['tail3', 1]];
}

function fallbackBlend(y: number): Array<[LionBoneName, number]> {
  if (y > 2.45) return [['head', 1]];
  return torsoBlend(y);
}

interface Pose {
  /** Offset added to the rest hips position. */
  hips?: V3;
  /** Bone-local Euler rotations (YXZ order). Missing bones stay at rest. */
  bones?: Partial<Record<LionBoneName, V3>>;
}

const ZERO: V3 = [0, 0, 0];
// A forward-hunched beast stance: a standing lion is broad and low, and the lean keeps the
// mane crown under the seated statue's height instead of towering over the lawn. The rear mane
// tufts stick out behind the skull, so any head lift above the torso line raises the crown fast.
const BASE_SPINE = .50, BASE_CHEST = .48, BASE_NECK = -.02, BASE_HEAD = -.04;
const STAND: Pose = {
  hips: [0, .55, -.02],
  bones: {
    spine: [BASE_SPINE, 0, 0], chest: [BASE_CHEST, 0, 0],
    neck: [BASE_NECK, 0, 0], head: [BASE_HEAD, 0, 0],
    upperArmL: [.5, 0, -.05], upperArmR: [.5, 0, .05],
    foreArmL: [-.14, 0, 0], foreArmR: [-.14, 0, 0],
  },
};

const SEATED: Pose = {
  hips: [0, 0, 0],
  bones: {
    thighL: [-1.62, 0, 0], shinL: [2.9, 0, 0], footL: [-.36, 0, 0],
    thighR: [-1.62, 0, 0], shinR: [2.9, 0, 0], footR: [-.36, 0, 0],
  },
};

const euler = (v: V3) => new T.Euler(v[0], v[1], v[2], 'YXZ');

function mergePose(base: Pose, extra: Pose): Pose {
  return {hips: extra.hips ?? base.hips, bones: {...base.bones, ...extra.bones}};
}

function hipsPosition(pose: Pose): V3 {
  const o = pose.hips ?? ZERO;
  return [REST_POSITION.hips[0] + o[0], REST_POSITION.hips[1] + o[1], REST_POSITION.hips[2] + o[2]];
}

function buildClip(name: LionClipName, duration: number, times: number[], poses: Pose[]): T.AnimationClip {
  const tracks: T.KeyframeTrack[] = [];
  const hips: number[] = [];
  for (const pose of poses) hips.push(...hipsPosition(pose));
  tracks.push(new T.VectorKeyframeTrack('hips.position', times, hips));
  for (const boneName of LION_BONE_NAMES) {
    const values: number[] = [];
    let previous: T.Quaternion | null = null;
    for (const pose of poses) {
      const q = new T.Quaternion().setFromEuler(euler(pose.bones?.[boneName] ?? ZERO));
      if (previous && previous.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      previous = q;
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new T.QuaternionKeyframeTrack(boneName + '.quaternion', times, values));
  }
  return new T.AnimationClip(name, duration, tracks);
}

function sampledClip(name: LionClipName, duration: number, samples: number, poseAt: (t: number) => Pose): T.AnimationClip {
  const times: number[] = [], poses: Pose[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = duration * i / samples;
    times.push(t);
    poses.push(poseAt(t));
  }
  // Periodic sample functions are loop-closed by construction; pin the seam anyway.
  poses[samples] = poses[0];
  return buildClip(name, duration, times, poses);
}

const TAU = Math.PI * 2;
const clamp = T.MathUtils.clamp;

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

const WALK_SECONDS = 1.4;
const RUN_SECONDS = .9;
/** World metres per full (two-step) cycle at timeScale 1, used to sync feet to travel. */
const WALK_CYCLE_METRES = 2.75;
const RUN_CYCLE_METRES = 3.9;

function idlePose(t: number): Pose {
  const p = t / 3.2 * TAU;
  const breath = Math.sin(p);
  return mergePose(STAND, {
    hips: [0, .55 + .012 * breath, -.02],
    bones: {
      spine: [BASE_SPINE + .018 * breath, 0, 0],
      chest: [BASE_CHEST + .022 * Math.sin(p + .3), 0, 0],
      neck: [BASE_NECK - .012 * Math.sin(p + .5), 0, 0],
      head: [BASE_HEAD - .015 * Math.sin(p + .6), .03 * Math.sin(p * .5 + .4), 0],
      upperArmL: [.42 + .02 * breath, 0, -.05],
      upperArmR: [.42 - .02 * breath, 0, .05],
      tail1: [-.04, .10 * Math.sin(p), 0],
      tail2: [0, .14 * Math.sin(p - .4), 0],
      tail3: [0, .18 * Math.sin(p - .8), 0],
    },
  });
}

function walkPose(t: number): Pose {
  const p = t / WALK_SECONDS * TAU, s = Math.sin(p), kneeL = Math.max(0, -Math.cos(p)), kneeR = Math.max(0, Math.cos(p));
  const thighL = -.46 * s, thighR = .46 * s;
  const shinL = .62 * kneeL, shinR = .62 * kneeR;
  return mergePose(STAND, {
    hips: [.015 * s, .55 + .03 * (.5 + .5 * Math.sin(2 * p)), -.02],
    bones: {
      hips: [0, .06 * s, .02 * s],
      spine: [BASE_SPINE, -.05 * s, 0],
      chest: [BASE_CHEST, -.05 * s, 0],
      neck: [BASE_NECK, .02 * s, 0],
      head: [BASE_HEAD + .02 * Math.sin(2 * p), .02 * s, 0],
      thighL: [thighL, 0, 0], shinL: [shinL, 0, 0], footL: [-.8 * (thighL + shinL), 0, 0],
      thighR: [thighR, 0, 0], shinR: [shinR, 0, 0], footR: [-.8 * (thighR + shinR), 0, 0],
      upperArmL: [.42 + .20 * s, 0, -.05], upperArmR: [.42 - .20 * s, 0, .05],
      foreArmL: [-.12 - .06 * Math.max(0, -s), 0, 0], foreArmR: [-.12 - .06 * Math.max(0, s), 0, 0],
      tail1: [-.06, .16 * Math.sin(p + .3), 0],
      tail2: [0, .20 * Math.sin(p - .2), 0],
      tail3: [0, .24 * Math.sin(p - .7), 0],
    },
  });
}

function runPose(t: number): Pose {
  const p = t / RUN_SECONDS * TAU, s = Math.sin(p), kneeL = Math.max(0, -Math.cos(p)), kneeR = Math.max(0, Math.cos(p));
  const thighL = -.66 * s, thighR = .66 * s;
  const shinL = .92 * kneeL, shinR = .92 * kneeR;
  return mergePose(STAND, {
    hips: [.025 * s, .57 + .05 * (.5 + .5 * Math.sin(2 * p)), 0],
    bones: {
      hips: [0, .1 * s, .03 * s],
      spine: [BASE_SPINE + .06, -.08 * s, 0],
      chest: [BASE_CHEST + .04, -.08 * s, 0],
      neck: [BASE_NECK - .06, .03 * s, 0],
      head: [BASE_HEAD - .06 + .025 * Math.sin(2 * p), .03 * s, 0],
      thighL: [thighL, 0, 0], shinL: [shinL, 0, 0], footL: [-.75 * (thighL + shinL), 0, 0],
      thighR: [thighR, 0, 0], shinR: [shinR, 0, 0], footR: [-.75 * (thighR + shinR), 0, 0],
      upperArmL: [.44 + .34 * s, 0, -.06], upperArmR: [.44 - .34 * s, 0, .06],
      foreArmL: [-.2 - .1 * Math.max(0, -s), 0, 0], foreArmR: [-.2 - .1 * Math.max(0, s), 0, 0],
      tail1: [-.12, .18 * Math.sin(p + .3), 0],
      tail2: [-.04, .22 * Math.sin(p - .2), 0],
      tail3: [-.02, .26 * Math.sin(p - .7), 0],
    },
  });
}

function chargeWarnPose(t: number): Pose {
  const p = t * TAU, pulse = .01 * Math.sin(p);
  return mergePose(STAND, {
    hips: [0, .40 + pulse, -.18],
    bones: {
      hips: [0, 0, 0],
      spine: [.26 + pulse, 0, 0], chest: [.24, 0, 0], neck: [-.02, 0, 0], head: [-.06, 0, 0],
      thighL: [-.55, 0, 0], shinL: [.95, 0, 0], footL: [-.40, 0, 0],
      thighR: [-.55, 0, 0], shinR: [.95, 0, 0], footR: [-.40, 0, 0],
      upperArmL: [.62, 0, -.12], upperArmR: [.62, 0, .12],
      foreArmL: [-.02, 0, 0], foreArmR: [-.02, 0, 0],
      tail1: [-.18, 0, 0], tail2: [-.08, 0, 0], tail3: [0, 0, 0],
    },
  });
}

function chargePose(t: number): Pose {
  const p = t * TAU, pulse = .008 * Math.sin(p);
  return mergePose(STAND, {
    hips: [0, .39, .36],
    bones: {
      hips: [0, 0, 0],
      spine: [.52 + pulse, 0, 0], chest: [.46, 0, 0], neck: [-.22, 0, 0], head: [-.26, 0, 0],
      thighL: [-.62, 0, 0], shinL: [.30, 0, 0], footL: [.32, 0, 0],
      thighR: [.28, 0, 0], shinR: [.42, 0, 0], footR: [-.70, 0, 0],
      upperArmL: [.12, 0, -.16], upperArmR: [.12, 0, .16],
      foreArmL: [-.42, 0, 0], foreArmR: [-.42, 0, 0],
      tail1: [-.28, 0, 0], tail2: [-.16, 0, 0], tail3: [-.06, 0, 0],
    },
  });
}

function swipeWarnPose(t: number): Pose {
  const p = t * TAU, wind = .02 * Math.sin(p);
  return mergePose(STAND, {
    hips: [0, .50, -.06],
    bones: {
      hips: [0, -.10, 0],
      spine: [.30, .18 + wind, 0], chest: [.28, .30, 0],
      neck: [-.06, -.16, 0], head: [-.10, -.24, 0],
      thighL: [-.26, 0, 0], shinL: [.56, 0, 0], footL: [-.30, 0, 0],
      thighR: [-.26, 0, 0], shinR: [.56, 0, 0], footR: [-.30, 0, 0],
      upperArmR: [-.35, 0, .85], foreArmR: [-.55, 0, .25],
      upperArmL: [.55, 0, -.16], foreArmL: [-.05, 0, 0],
      tail1: [-.10, -.12, 0], tail2: [0, -.16, 0], tail3: [0, -.2, 0],
    },
  });
}

function stunnedPose(t: number): Pose {
  const p = t * TAU, tremble = .01 * Math.sin(p * 3);
  return mergePose(STAND, {
    hips: [0, .28 + tremble, -.04],
    bones: {
      hips: [0, 0, .02],
      spine: [.52, .02, .03], chest: [.44, 0, .03], neck: [.16, 0, 0], head: [.24, 0, .04],
      thighL: [-.72, 0, 0], shinL: [1.28, 0, 0], footL: [-.56, 0, 0],
      thighR: [-.72, 0, 0], shinR: [1.28, 0, 0], footR: [-.56, 0, 0],
      upperArmL: [.18, 0, -.24], upperArmR: [.18, 0, .24],
      foreArmL: [.12, 0, 0], foreArmR: [.12, 0, 0],
      tail1: [.02, .04, 0], tail2: [0, .04, 0], tail3: [0, .04, 0],
    },
  });
}

/** Bow that matches the existing 1.6 s power-off presentation. */
const SHUTDOWN_END: Pose = {
  hips: [0, .50, -.02],
  bones: {
    spine: [.80, 0, 0], chest: [.55, 0, 0], neck: [.20, 0, 0], head: [.26, 0, 0],
    thighL: [-.32, 0, 0], shinL: [.64, 0, 0], footL: [-.32, 0, 0],
    thighR: [-.32, 0, 0], shinR: [.64, 0, 0], footR: [-.32, 0, 0],
    upperArmL: [.62, 0, -.14], upperArmR: [.62, 0, .14],
    foreArmL: [-.2, 0, 0], foreArmR: [-.2, 0, 0],
    tail1: [.06, 0, 0], tail2: [.04, 0, 0], tail3: [0, 0, 0],
  },
};

function buildClips(): Record<LionClipName, T.AnimationClip> {
  const clips = {} as Record<LionClipName, T.AnimationClip>;
  clips.seated = buildClip('seated', 1, [0, 1], [SEATED, SEATED]);
  clips.idle = sampledClip('idle', 3.2, 48, idlePose);
  clips.walk = sampledClip('walk', WALK_SECONDS, 48, walkPose);
  clips.run = sampledClip('run', RUN_SECONDS, 48, runPose);
  clips.chargeWarn = sampledClip('chargeWarn', 1, 24, chargeWarnPose);
  clips.charge = sampledClip('charge', .82, 24, chargePose);
  clips.swipeWarn = sampledClip('swipeWarn', 1.05, 24, swipeWarnPose);
  clips.stunned = sampledClip('stunned', 1.2, 24, stunnedPose);
  // The pelvis lifts while the legs are still folded, then each leg extends down onto the
  // ground in turn. Extending a leg while the pelvis is still low would push the foot through
  // the support plane, so the hips reach standing height before the first foot plants.
  const awakenTimes = [0, .5, 1.0, 1.45, 1.95, AWAKEN_SECONDS];
  const awakenPoses: Pose[] = [
    SEATED,
    mergePose(SEATED, {hips: [0, .30, -.03], bones: {spine: [.08, 0, 0], chest: [.06, 0, 0],
      neck: [-.02, 0, 0], head: [-.03, 0, 0],
      thighL: [-1.55, 0, 0], shinL: [2.80, 0, 0], footL: [-.35, 0, 0],
      thighR: [-1.55, 0, 0], shinR: [2.80, 0, 0], footR: [-.35, 0, 0]}}),
    mergePose(SEATED, {hips: [0, .55, -.02], bones: {spine: [.14, 0, 0], chest: [.10, 0, 0],
      neck: [-.03, 0, 0], head: [-.05, 0, 0],
      thighL: [-1.10, 0, 0], shinL: [2.00, 0, 0], footL: [-.30, 0, 0],
      thighR: [-1.50, 0, 0], shinR: [2.70, 0, 0], footR: [-.35, 0, 0]}}),
    mergePose(STAND, {hips: [0, .55, -.02], bones: {spine: [.24, 0, 0], chest: [.20, 0, 0],
      neck: [-.06, 0, 0], head: [-.09, 0, 0],
      thighL: [0, 0, 0], shinL: [0, 0, 0], footL: [0, 0, 0],
      thighR: [-1.20, 0, 0], shinR: [2.20, 0, 0], footR: [-.35, 0, 0]}}),
    mergePose(STAND, {hips: [0, .55, -.01], bones: {spine: [.38, 0, 0], chest: [.36, 0, 0],
      neck: [-.04, 0, 0], head: [-.06, 0, 0],
      thighL: [0, 0, 0], shinL: [0, 0, 0], footL: [0, 0, 0],
      thighR: [-.30, 0, 0], shinR: [.55, 0, 0], footR: [-.25, 0, 0]}}),
    STAND,
  ];
  clips.awaken = buildClip('awaken', AWAKEN_SECONDS, awakenTimes, awakenPoses);
  clips.shutdown = buildClip('shutdown', 1.6, [0, .45, 1.0, 1.6],
    [STAND, mergePose(STAND, {hips: [0, .54, -.02], bones: {spine: [.42, 0, 0], chest: [.4, 0, 0]}}), SHUTDOWN_END, SHUTDOWN_END]);
  return clips;
}

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

export interface LionRig {
  root: T.Bone;
  bones: Record<LionBoneName, T.Bone>;
  boneArray: T.Bone[];
  skeleton: T.Skeleton;
  meshes: T.SkinnedMesh[];
  clips: Record<LionClipName, T.AnimationClip>;
  mixer: T.AnimationMixer;
  /** Body-local accumulated matrix of a bone in the current pose. */
  poseMatrix(name: LionBoneName): T.Matrix4;
  /** Body-local accumulated matrix of a bone at bind (seated statue) rest. */
  restMatrix(name: LionBoneName): T.Matrix4;
  /** Convert a body-local point into the head bone's local space. */
  headLocalPoint(point: T.Vector3): T.Vector3;
  /** Parent an object (a glowing eye) to the head bone using body-space coordinates. */
  attachToHead(object: T.Object3D): void;
  update(dt: number, state: CombatState, speed?: number): void;
  dispose(): void;
  readonly current: LionClipName | null;
}

export function createLionRig(body: T.Object3D): LionRig {
  const identity = new T.Matrix4();

  /* ---------- source meshes and materials (before conversion) ---------- */
  const sourceMeshes: T.Mesh[] = [];
  const materialByName = new Map<string, T.Material>();
  body.traverse(object => {
    if (!(object instanceof T.Mesh) || object instanceof T.SkinnedMesh) return;
    sourceMeshes.push(object);
    if (!Array.isArray(object.material) && object.material.name) materialByName.set(object.material.name, object.material);
  });

  /* ---------- bones ---------- */
  const bones = {} as Record<LionBoneName, T.Bone>;
  const boneArray: T.Bone[] = [];
  const boneIndexByName = new Map<LionBoneName, number>();
  for (const name of LION_BONE_NAMES) {
    const bone = new T.Bone();
    bone.name = name;
    const position = REST_POSITION[name];
    const parentName = PARENT[name];
    const parentPosition = parentName ? REST_POSITION[parentName] : ZERO;
    bone.position.set(position[0] - parentPosition[0], position[1] - parentPosition[1], position[2] - parentPosition[2]);
    (parentName ? bones[parentName] : body).add(bone);
    bones[name] = bone;
    boneIndexByName.set(name, boneArray.length);
    boneArray.push(bone);
  }

  const restMatrices = new Map<LionBoneName, T.Matrix4>();
  for (const name of LION_BONE_NAMES) {
    const bone = bones[name];
    const local = new T.Matrix4().compose(bone.position, bone.quaternion, bone.scale);
    const parentName = PARENT[name];
    restMatrices.set(name, parentName
      ? new T.Matrix4().multiplyMatrices(restMatrices.get(parentName)!, local)
      : local);
  }
  // Bind inverses are computed from body-local rest matrices, so binding is independent of
  // wherever the campus/pivot happens to sit in world space at creation time.
  const boneInverses = boneArray.map(bone => new T.Matrix4().copy(restMatrices.get(bone.name as LionBoneName)!).invert());
  const skeleton = new T.Skeleton(boneArray, boneInverses);

  /* ---------- skin every compacted part ---------- */
  const meshes: T.SkinnedMesh[] = [];
  const sourcePairs: Array<{source: T.Mesh; skinned: T.SkinnedMesh}> = [];
  const addWeights = (indices: Uint16Array, weights: Float32Array, vertex: number, pairs: Array<[LionBoneName, number]>) => {
    let total = 0;
    for (const [, weight] of pairs) total += weight;
    if (!(total > 0) || !Number.isFinite(total)) { pairs = [['hips', 1]]; total = 1; }
    const base = vertex * 4;
    for (let i = 0; i < pairs.length && i < 4; i++) {
      indices[base + i] = boneIndexByName.get(pairs[i][0])!;
      weights[base + i] = pairs[i][1] / total;
    }
  };

  for (const source of sourceMeshes) {
    const geometry = source.geometry;
    const position = geometry.getAttribute('position');
    const count = position.count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    const parts = (source.userData.authorParts ?? []) as PrimitiveTrace[];
    if (parts.length) {
      for (const part of parts) {
        const bounds = part.bounds;
        const centerX = (bounds[0] + bounds[3]) / 2;
        const rigid = boneForTrace(part.name, centerX);
        const end = Math.min(count, part.start + part.count);
        if (rigid) {
          const boneIndex = boneIndexByName.get(rigid)!;
          for (let vertex = part.start; vertex < end; vertex++) {
            indices[vertex * 4] = boneIndex;
            weights[vertex * 4] = 1;
          }
          continue;
        }
        for (let vertex = part.start; vertex < end; vertex++) {
          if (part.name === 'Tail') addWeights(indices, weights, vertex, tailBlend(position.getZ(vertex)));
          else if (part.name === 'Rounded_body_mid' || part.name === 'Shirt_front_panel'
            || part.name.startsWith('Shirt_vertical_stripe')) {
            addWeights(indices, weights, vertex, torsoBlend(position.getY(vertex)));
          } else addWeights(indices, weights, vertex, fallbackBlend(position.getY(vertex)));
        }
      }
    } else {
      for (let vertex = 0; vertex < count; vertex++) {
        addWeights(indices, weights, vertex, fallbackBlend(position.getY(vertex)));
      }
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    source.updateMatrix();
    const skinned = new T.SkinnedMesh(geometry, source.material);
    skinned.name = source.name;
    skinned.userData = source.userData;
    skinned.position.copy(source.position);
    skinned.quaternion.copy(source.quaternion);
    skinned.scale.copy(source.scale);
    skinned.castShadow = false;
    skinned.receiveShadow = source.receiveShadow;
    skinned.frustumCulled = false;
    body.remove(source);
    body.add(skinned);
    skinned.bind(skeleton, source.matrix.clone());
    meshes.push(skinned);
    sourcePairs.push({source, skinned});
  }

  /* ---------- new legs, parented to the leg bones ---------- */
  const createdMaterials: T.Material[] = [];
  const materialFor = (name: string, color: number): T.Material => {
    const existing = materialByName.get(name);
    if (existing) return existing;
    const material = new T.MeshStandardMaterial({name, color, roughness: .9});
    createdMaterials.push(material);
    return material;
  };
  const trousers = materialFor('Lion dark trousers', 0x2f2934);
  const gold = materialFor('Lion golden fabric', 0xeeb262);

  const legGeometries = new Set<T.BufferGeometry>();
  const addedMeshes: T.Mesh[] = [];
  const addPart = (boneName: LionBoneName, geometry: T.BufferGeometry, material: T.Material,
    position: V3, scale?: V3, name?: string) => {
    legGeometries.add(geometry);
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name ?? 'Lion_rig_' + boneName;
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    bones[boneName].add(mesh);
    addedMeshes.push(mesh);
    return mesh;
  };
  const thighGeometry = new T.CylinderGeometry(.20, .27, .74, 8);
  const shinGeometry = new T.CylinderGeometry(.16, .20, .57, 8);
  const jointGeometry = new T.SphereGeometry(1, 10, 8);
  const footGeometry = new T.SphereGeometry(1, 10, 8);
  const toeGeometry = new T.SphereGeometry(1, 8, 6);
  for (const side of ['L', 'R'] as const) {
    const thigh = ('thigh' + side) as LionBoneName;
    const shin = ('shin' + side) as LionBoneName;
    const foot = ('foot' + side) as LionBoneName;
    addPart(thigh, jointGeometry, trousers, [0, 0, 0], [.27, .27, .27], 'Lion_rig_hip_' + side);
    addPart(thigh, thighGeometry, trousers, [0, -.37, 0], undefined, 'Lion_rig_thigh_' + side);
    addPart(shin, jointGeometry, trousers, [0, 0, 0], [.2, .2, .2], 'Lion_rig_knee_' + side);
    addPart(shin, shinGeometry, trousers, [0, -.285, 0], undefined, 'Lion_rig_shin_' + side);
    addPart(foot, footGeometry, gold, [0, -.025, .13], [.25, .075, .34], 'Lion_rig_foot_' + side);
    for (const [index, x] of [-.13, 0, .13].entries()) {
      addPart(foot, toeGeometry, gold, [x, -.05, .38], [.09, .05, .11], 'Lion_rig_toe_' + side + '_' + index);
    }
  }

  /* ---------- clips ---------- */
  const clips = buildClips();
  const mixer = new T.AnimationMixer(body);
  const actions = {} as Record<LionClipName, T.AnimationAction>;
  for (const name of LION_CLIP_NAMES) actions[name] = mixer.clipAction(clips[name]);

  let currentName: LionClipName | null = null;
  let currentAction: T.AnimationAction | null = null;
  let hasPrevious = false;
  let previousX = 0, previousZ = 0, previousYaw = 0;
  let awakenedOnce = false;

  function play(name: LionClipName, fade = .2): T.AnimationAction {
    if (currentName === name && currentAction) return currentAction;
    const action = actions[name];
    const once = LION_ONESHOT_CLIPS.includes(name);
    action.reset();
    action.setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.enabled = true;
    action.paused = false;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.play();
    if (currentAction && currentAction !== action) action.crossFadeFrom(currentAction, fade, false);
    currentAction = action;
    currentName = name;
    return action;
  }

  function pickClip(state: CombatState, speed: number, yawRate: number): LionClipName {
    switch (state.phase) {
      case 'awakening': return 'awaken';
      case 'complete': return 'shutdown';
      case 'stunned': return 'stunned';
      case 'chargeWarn': return 'chargeWarn';
      case 'charge': return 'charge';
      case 'swipeWarn': return 'swipeWarn';
      default: break;
    }
    if (!state.awakened && !awakenedOnce) return 'seated';
    if (state.phase === 'chase') return 'run';
    if (speed > 3.3) return 'run';
    const locomotion: Phase[] = ['patrol', 'alert', 'return', 'helperRun', 'lured', 'ghosted', 'chargeRecover', 'swipeRecover'];
    // Turning in place still needs the walk cycle; a static idle would skate the feet.
    if (locomotion.includes(state.phase) || yawRate > .6) return 'walk';
    return 'idle';
  }

  function update(dt: number, state: CombatState, speedHint = 0) {
    const step = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
    const lion = state.lion;
    if (!hasPrevious) {
      previousX = lion.x; previousZ = lion.z; previousYaw = state.yaw; hasPrevious = true;
    }
    let measured = 0, yawRate = 0;
    if (step > 0) {
      const distance = Math.hypot(lion.x - previousX, lion.z - previousZ);
      // A reset or an experience restart teleports the lion; that is not locomotion.
      measured = distance > 1.5 ? 0 : Math.min(14, distance / step);
      yawRate = Math.abs(Math.atan2(Math.sin(state.yaw - previousYaw), Math.cos(state.yaw - previousYaw))) / step;
      previousX = lion.x; previousZ = lion.z; previousYaw = state.yaw;
    }
    const speed = Number.isFinite(speedHint) && speedHint > 0 ? Math.max(speedHint, measured) : measured;
    if (state.awakened || state.phase === 'awakening') awakenedOnce = true;

    const name = pickClip(state, speed, yawRate);
    const action = play(name, name === 'seated' ? .01 : .2);
    if (name === 'walk') {
      const scale = speed > .18
        ? speed / WALK_CYCLE_METRES
        : Math.max(.45, yawRate / 3.4);
      action.setEffectiveTimeScale(clamp(scale, .35, 1.8));
    } else if (name === 'run') {
      action.setEffectiveTimeScale(clamp(Math.max(speed, 2) / RUN_CYCLE_METRES, .55, 1.75));
    } else if (name === 'awaken') {
      action.paused = true;
      action.time = clamp(AWAKEN_SECONDS - state.remaining, 0, clips.awaken.duration);
    } else if (name === 'seated') {
      action.paused = true;
      action.time = 0;
    } else {
      action.setEffectiveTimeScale(1);
    }
    mixer.update(step);
  }

  function poseMatrix(name: LionBoneName): T.Matrix4 {
    const bone = bones[name];
    const matrix = new T.Matrix4().compose(bone.position, bone.quaternion, bone.scale);
    let parent = bone.parent;
    while (parent && parent !== body) {
      matrix.premultiply(new T.Matrix4().compose(parent.position, parent.quaternion, parent.scale));
      parent = parent.parent;
    }
    return matrix;
  }

  function restMatrix(name: LionBoneName): T.Matrix4 {
    return new T.Matrix4().copy(skeleton.boneInverses[boneIndexByName.get(name)!]).invert();
  }

  function headLocalPoint(point: T.Vector3): T.Vector3 {
    return point.clone().applyMatrix4(new T.Matrix4().copy(restMatrix('head')).invert());
  }

  function attachToHead(object: T.Object3D) {
    object.position.copy(headLocalPoint(object.position));
    bones.head.add(object);
  }

  function dispose() {
    mixer.stopAllAction();
    mixer.uncacheRoot(body);
    for (const mesh of addedMeshes) mesh.removeFromParent();
    for (const geometry of legGeometries) geometry.dispose();
    for (const material of createdMaterials) material.dispose();
    // Restore the authored statue meshes so the campus can survive a boss-scene teardown.
    for (const {source, skinned} of sourcePairs) {
      skinned.removeFromParent();
      source.geometry.deleteAttribute('skinIndex');
      source.geometry.deleteAttribute('skinWeight');
      body.add(source);
    }
    for (const name of LION_BONE_NAMES) bones[name].removeFromParent();
    currentAction = null;
    currentName = null;
  }

  // Apply the seated pose immediately so the very first rendered frame is the statue.
  play('seated', 0);
  actions.seated.paused = true;
  mixer.update(0);

  return {
    root: bones.root,
    bones, boneArray, skeleton, meshes, clips, mixer,
    poseMatrix, restMatrix, headLocalPoint, attachToHead, update, dispose,
    get current() { return currentName; },
  };
}
