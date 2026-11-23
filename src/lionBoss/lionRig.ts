import * as T from 'three';
import type {PrimitiveTrace} from '../scene/authoring';
import {AWAKEN_SECONDS, type CombatState, type Phase} from './combat';

/**
 * Runtime-only skeleton for the authored L001 seated statue.
 *
 * `src/model/nov13Details.ts::createLion()` stays untouched: the campus statue and
 * `assets/items/entrance-lion.glb` remain the seated sculpture. This module rebuilds
 * the already-compacted boss body as skinned meshes, binds the authored gold paws to the
 * foot bones, adds trouser legs inside the gown and authors the clips that stand the lion
 * up and walk it around the lawn.
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
  // Bind pose = the authored seated statue: the leg chain is folded inside the gown, with the
  // ankle behind the authored Paw. Identity bone rotations therefore reproduce the sculpture
  // exactly. Standing pitches the chain straight down and the hips rise .55; the foot bone
  // cancels the chain so the paw stays level and its sole lands on the authored paw plane (y 0).
  thighL: [-.66, .84, .10], shinL: [-.72, .54, .48], footL: [-.76, .52, .86],
  thighR: [.66, .84, .10], shinR: [.72, .54, .48], footR: [.76, .52, .86],
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
const HIPS_PARTS = new Set(['Seated_body', 'Seated_trousers']);
const FOREARM_PARTS = new Set(['Gown_cuff', 'Arm']);
/** The authored gold paws are the feet: paw round, three toe bumps, lettering and crest. */
const FOOT_PARTS = new Set([
  'Paw', 'Paw_toe', 'Paw_HKU_lettering', 'Paw_crest', 'Paw_crest_book',
]);
/** The round dark lower-body ovals are the trouser legs, driven by the thigh. */
const THIGH_PARTS = new Set(['Trouser_leg']);

/** Rigid part → bone. Returns null when the trace needs per-vertex blending. */
function boneForTrace(name: string, centerX: number): LionBoneName | null {
  if (HEAD_PARTS.has(name) || name.startsWith('Mane_')) return 'head';
  if (CHEST_PARTS.has(name)) return 'chest';
  if (HIPS_PARTS.has(name)) return 'hips';
  if (THIGH_PARTS.has(name)) return centerX < 0 ? 'thighL' : 'thighR';
  if (name === 'Gown_sleeve') return centerX < 0 ? 'upperArmL' : 'upperArmR';
  if (FOREARM_PARTS.has(name)) return centerX < 0 ? 'foreArmL' : 'foreArmR';
  if (FOOT_PARTS.has(name)) return centerX < 0 ? 'footL' : 'footR';
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

/* ------------------------------------------------------------------ */
/* Leg solve                                                           */
/* ------------------------------------------------------------------ */
/**
 * Standing leg baseline. The rest chain (hip → knee → ankle) points down and forward toward the
 * authored Paw; pitching the thigh by +.902 rad and the shin by +.616 rad aligns both segments
 * straight down, which puts the ankle at body-local y .522, z .08. The foot bone cancels the
 * chain (−1.518 rad) so the paw keeps the statue's level orientation, and the authored paw sole
 * (0, −.52, .18 from the foot bone) lands on the authored paw plane y 0.
 */
const STAND_THIGH = .902, STAND_SHIN = .616;
/** Paw sole relative to the foot bone at rest (paw centre [±.76, .51, 1.04] − foot rest). */
const PAW_SOLE: V3 = [0, -.52, .18];

/** Leg rotations for one side: the foot cancels the chain so the paw stays level. */
function legRotations(thigh: number, shin: number): V3 {
  return [thigh, shin, -(thigh + shin)];
}

function addLegRotations(bones: Partial<Record<LionBoneName, V3>>, side: 'L' | 'R',
  thigh: number, shin: number) {
  const [t, s, f] = legRotations(thigh, shin);
  if (side === 'L') {
    bones.thighL = [t, 0, 0]; bones.shinL = [s, 0, 0]; bones.footL = [f, 0, 0];
  } else {
    bones.thighR = [t, 0, 0]; bones.shinR = [s, 0, 0]; bones.footR = [f, 0, 0];
  }
}

/** Both legs; the right defaults to the left so symmetric poses stay symmetric. */
function legs(thighL: number, shinL: number, thighR = thighL, shinR = shinL) {
  const bones: Partial<Record<LionBoneName, V3>> = {};
  addLegRotations(bones, 'L', thighL, shinL);
  addLegRotations(bones, 'R', thighR, shinR);
  return bones;
}

const SEGMENT_D1: V3 = [
  REST_POSITION.shinL[0] - REST_POSITION.thighL[0],
  REST_POSITION.shinL[1] - REST_POSITION.thighL[1],
  REST_POSITION.shinL[2] - REST_POSITION.thighL[2],
];
const SEGMENT_D2: V3 = [
  REST_POSITION.footL[0] - REST_POSITION.shinL[0],
  REST_POSITION.footL[1] - REST_POSITION.shinL[1],
  REST_POSITION.footL[2] - REST_POSITION.shinL[2],
];

/** Body-local y of a level paw sole under `hipsOffsetY` and the given leg angles. */
function soleHeight(hipsOffsetY: number, thigh: number, shin: number): number {
  return REST_POSITION.hips[1] + hipsOffsetY
    + Math.cos(thigh) * SEGMENT_D1[1] - Math.sin(thigh) * SEGMENT_D1[2]
    + Math.cos(thigh + shin) * SEGMENT_D2[1] - Math.sin(thigh + shin) * SEGMENT_D2[2]
    + PAW_SOLE[1];
}

/** Hips offset that lowers/raises the pose so its lowest paw sole rests on the paw plane. */
function groundedHips(hipsOffsetY: number, hipsOffsetZ: number,
  thighL: number, shinL: number, thighR = thighL, shinR = shinL): V3 {
  const lowest = Math.min(soleHeight(hipsOffsetY, thighL, shinL), soleHeight(hipsOffsetY, thighR, shinR));
  return [0, hipsOffsetY - lowest, hipsOffsetZ];
}

// An upright stance: only a slight forward lean through the spine and chest, with the neck and
// head tilted back so the face looks forward rather than at the ground. The rear mane tufts
// stick out behind the skull, so any further head lift raises the crown fast.
const BASE_SPINE = .16, BASE_CHEST = .12, BASE_NECK = -.10, BASE_HEAD = -.14;
const STAND: Pose = {
  hips: [0, .55, -.02],
  bones: {
    spine: [BASE_SPINE, 0, 0], chest: [BASE_CHEST, 0, 0],
    neck: [BASE_NECK, 0, 0], head: [BASE_HEAD, 0, 0],
    ...legs(STAND_THIGH, STAND_SHIN),
    upperArmL: [.5, 0, -.05], upperArmR: [.5, 0, .05],
    foreArmL: [-.14, 0, 0], foreArmR: [-.14, 0, 0],
  },
};

/** Bind pose: the authored seated statue. Legs at identity keep the paws exactly where authored. */
const SEATED: Pose = {
  hips: [0, 0, 0],
  bones: legs(0, 0),
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
/**
 * World metres per full (two-step) cycle at timeScale 1, used to sync feet to travel. Measured
 * from the authored paw's forward travel in the new gait: 2 × .79 body units × 1.285 world scale
 * for walk, 2 × 1.04 × 1.285 for run.
 */
const WALK_CYCLE_METRES = 2.03;
const RUN_CYCLE_METRES = 2.68;

/** Gait amplitudes around the standing baseline; the stance paw keeps reaching the paw plane. */
const WALK_SWING = .44, WALK_KNEE = .60, WALK_BOB = .012;
const RUN_SWING = .60, RUN_KNEE = .90, RUN_BOB = .02;

function idlePose(t: number): Pose {
  const p = t / 3.2 * TAU;
  const breath = Math.sin(p);
  return mergePose(STAND, {
    // Breathing only lifts from the baseline so the planted paws never sink.
    hips: [0, .55 + .006 * (1 + breath), -.02],
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
  const thighL = STAND_THIGH - WALK_SWING * s, thighR = STAND_THIGH + WALK_SWING * s;
  const shinL = STAND_SHIN + WALK_KNEE * kneeL, shinR = STAND_SHIN + WALK_KNEE * kneeR;
  return mergePose(STAND, {
    // Bob peaks at mid-swing and returns to the baseline at contact, so the stance paw can plant.
    hips: [.015 * s, .55 + WALK_BOB * (.5 - .5 * Math.cos(2 * p)), -.02],
    bones: {
      hips: [0, .06 * s, .02 * s],
      spine: [BASE_SPINE, -.05 * s, 0],
      chest: [BASE_CHEST, -.05 * s, 0],
      neck: [BASE_NECK, .02 * s, 0],
      head: [BASE_HEAD + .02 * Math.sin(2 * p), .02 * s, 0],
      ...legs(thighL, shinL, thighR, shinR),
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
  const thighL = STAND_THIGH - RUN_SWING * s, thighR = STAND_THIGH + RUN_SWING * s;
  const shinL = STAND_SHIN + RUN_KNEE * kneeL, shinR = STAND_SHIN + RUN_KNEE * kneeR;
  return mergePose(STAND, {
    hips: [.025 * s, .55 + RUN_BOB * (.5 - .5 * Math.cos(2 * p)), 0],
    bones: {
      hips: [0, .1 * s, .03 * s],
      spine: [BASE_SPINE + .06, -.08 * s, 0],
      chest: [BASE_CHEST + .04, -.08 * s, 0],
      neck: [BASE_NECK - .06, .03 * s, 0],
      head: [BASE_HEAD - .06 + .025 * Math.sin(2 * p), .03 * s, 0],
      ...legs(thighL, shinL, thighR, shinR),
      upperArmL: [.44 + .34 * s, 0, -.06], upperArmR: [.44 - .34 * s, 0, .06],
      foreArmL: [-.2 - .1 * Math.max(0, -s), 0, 0], foreArmR: [-.2 - .1 * Math.max(0, s), 0, 0],
      tail1: [-.12, .18 * Math.sin(p + .3), 0],
      tail2: [-.04, .22 * Math.sin(p - .2), 0],
      tail3: [-.02, .26 * Math.sin(p - .7), 0],
    },
  });
}

function chargeWarnPose(t: number): Pose {
  const p = t * TAU, pulse = .006 * (1 + Math.sin(p));
  // Delta crouch around the standing baseline; the hips follow the legs so the paws stay planted.
  // The wind-up pulse only lifts from the grounded height, never pushes the paws through it.
  const thigh = STAND_THIGH - .55, shin = STAND_SHIN + .95;
  const hips = groundedHips(.40, -.18, thigh, shin);
  hips[1] += pulse;
  return mergePose(STAND, {
    hips,
    bones: {
      hips: [0, 0, 0],
      spine: [.18 + pulse, 0, 0], chest: [.16, 0, 0], neck: [-.06, 0, 0], head: [-.08, 0, 0],
      ...legs(thigh, shin),
      upperArmL: [.62, 0, -.12], upperArmR: [.62, 0, .12],
      foreArmL: [-.02, 0, 0], foreArmR: [-.02, 0, 0],
      tail1: [-.18, 0, 0], tail2: [-.08, 0, 0], tail3: [0, 0, 0],
    },
  });
}

function chargePose(t: number): Pose {
  const p = t * TAU, pulse = .008 * Math.sin(p);
  const thighL = STAND_THIGH - .62, shinL = STAND_SHIN + .30;
  const thighR = STAND_THIGH + .28, shinR = STAND_SHIN + .42;
  return mergePose(STAND, {
    hips: groundedHips(.39, .36, thighL, shinL, thighR, shinR),
    bones: {
      hips: [0, 0, 0],
      spine: [.26 + pulse, 0, 0], chest: [.20, 0, 0], neck: [-.08, 0, 0], head: [-.10, 0, 0],
      ...legs(thighL, shinL, thighR, shinR),
      upperArmL: [.12, 0, -.16], upperArmR: [.12, 0, .16],
      foreArmL: [-.42, 0, 0], foreArmR: [-.42, 0, 0],
      tail1: [-.28, 0, 0], tail2: [-.16, 0, 0], tail3: [-.06, 0, 0],
    },
  });
}

function swipeWarnPose(t: number): Pose {
  const p = t * TAU, wind = .02 * Math.sin(p);
  const thigh = STAND_THIGH - .26, shin = STAND_SHIN + .56;
  return mergePose(STAND, {
    hips: groundedHips(.50, -.06, thigh, shin),
    bones: {
      hips: [0, -.10, 0],
      spine: [.20, .18 + wind, 0], chest: [.18, .30, 0],
      neck: [-.06, -.16, 0], head: [-.10, -.24, 0],
      ...legs(thigh, shin),
      upperArmR: [-.35, 0, .85], foreArmR: [-.55, 0, .25],
      upperArmL: [.55, 0, -.16], foreArmL: [-.05, 0, 0],
      tail1: [-.10, -.12, 0], tail2: [0, -.16, 0], tail3: [0, -.2, 0],
    },
  });
}

function stunnedPose(t: number): Pose {
  const p = t * TAU, tremble = .005 * (1 + Math.sin(p * 3));
  const thigh = STAND_THIGH - .72, shin = STAND_SHIN + 1.28;
  const hips = groundedHips(.28, -.04, thigh, shin);
  hips[1] += tremble;
  return mergePose(STAND, {
    hips,
    bones: {
      hips: [0, 0, .02],
      spine: [.52, .02, .03], chest: [.44, 0, .03], neck: [.16, 0, 0], head: [.24, 0, .04],
      ...legs(thigh, shin),
      upperArmL: [.18, 0, -.24], upperArmR: [.18, 0, .24],
      foreArmL: [.12, 0, 0], foreArmR: [.12, 0, 0],
      tail1: [.02, .04, 0], tail2: [0, .04, 0], tail3: [0, .04, 0],
    },
  });
}

/** Bow that matches the existing 1.6 s power-off presentation. */
const SHUTDOWN_END: Pose = {
  hips: groundedHips(.50, -.02, STAND_THIGH - .32, STAND_SHIN + .64),
  bones: {
    spine: [.80, 0, 0], chest: [.55, 0, 0], neck: [.20, 0, 0], head: [.26, 0, 0],
    ...legs(STAND_THIGH - .32, STAND_SHIN + .64),
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
  // Two-stage stand. Stage 1 (.0–.35 s) lifts the hips to standing height with the legs still at
  // identity, so both paws leave the ground immediately and can never be pushed through it.
  // Stage 2 (.35–1.72 s) extends each leg from identity to the standing baseline; the paws stay
  // level via the foot cancellation and their soles descend monotonically to the paw plane.
  // The right leg lags the left by .12 s, so the second paw plants after the first. A single
  // linear mix of hips and legs would sink the paws ~.12 m at the midpoint.
  const awakenTimes = [0, .35, .5, .95, 1.45, 1.6, 1.72, 2.05, AWAKEN_SECONDS];
  const awakenPoses: Pose[] = [
    SEATED,
    {hips: [0, .55, -.02], bones: {spine: [.06, 0, 0], chest: [.04, 0, 0],
      neck: [-.02, 0, 0], head: [-.03, 0, 0], ...legs(0, 0)}},
    {hips: [0, .55, -.02], bones: {spine: [.09, 0, 0], chest: [.06, 0, 0],
      neck: [-.03, 0, 0], head: [-.04, 0, 0], ...legs(.30, .20, 0, 0)}},
    {hips: [0, .55, -.02], bones: {spine: [.12, 0, 0], chest: [.09, 0, 0],
      neck: [-.04, 0, 0], head: [-.06, 0, 0], ...legs(.62, .42, .20, .13)}},
    {hips: [0, .55, -.02], bones: {spine: [.15, 0, 0], chest: [.11, 0, 0],
      neck: [-.05, 0, 0], head: [-.08, 0, 0], ...legs(.86, .58, .45, .31)}},
    {hips: [0, .55, -.02], bones: {spine: [.17, 0, 0], chest: [.12, 0, 0],
      neck: [-.06, 0, 0], head: [-.09, 0, 0], ...legs(STAND_THIGH, STAND_SHIN, .72, .49)}},
    {hips: [0, .55, -.02], bones: {spine: [.18, 0, 0], chest: [.13, 0, 0],
      neck: [-.07, 0, 0], head: [-.10, 0, 0], ...legs(STAND_THIGH, STAND_SHIN)}},
    mergePose(STAND, {hips: [0, .55, -.02], bones: {spine: [.18, 0, 0], chest: [.14, 0, 0],
      neck: [-.07, 0, 0], head: [-.10, 0, 0],
      upperArmL: [.46, 0, -.05], upperArmR: [.46, 0, .05]}}),
    STAND,
  ];
  clips.awaken = buildClip('awaken', AWAKEN_SECONDS, awakenTimes, awakenPoses);
  clips.shutdown = buildClip('shutdown', 1.6, [0, .45, 1.0, 1.6],
    [STAND, mergePose(STAND, {hips: [0, .54, -.02], bones: {spine: [.24, 0, 0], chest: [.22, 0, 0]}}), SHUTDOWN_END, SHUTDOWN_END]);
  return clips;
}

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Visit every vertex of one authored trace. compact() records trace start/count in index
 * space when the merged geometry keeps its index buffer, and in vertex space when it is
 * flattened, so the index (when present) maps each slot to the real vertex.
 */
export function forEachTraceVertex(geometry: T.BufferGeometry, part: PrimitiveTrace, visit: (vertex: number) => void) {
  const index = geometry.index;
  const end = part.start + part.count;
  if (index) {
    for (let i = part.start, limit = Math.min(end, index.count); i < limit; i++) visit(index.getX(i));
  } else {
    for (let vertex = part.start, limit = Math.min(end, geometry.getAttribute('position').count); vertex < limit; vertex++) visit(vertex);
  }
}

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
    const assigned = new Uint8Array(count);
    for (const part of parts) {
      const bounds = part.bounds;
      const centerX = (bounds[0] + bounds[3]) / 2;
      const rigid = boneForTrace(part.name, centerX);
      const rigidIndex = rigid ? boneIndexByName.get(rigid)! : -1;
      forEachTraceVertex(geometry, part, vertex => {
        if (assigned[vertex]) return;
        assigned[vertex] = 1;
        if (rigidIndex >= 0) {
          indices[vertex * 4] = rigidIndex;
          weights[vertex * 4] = 1;
        } else if (part.name === 'Tail') {
          addWeights(indices, weights, vertex, tailBlend(position.getZ(vertex)));
        } else if (part.name === 'Rounded_body_mid' || part.name === 'Shirt_front_panel'
          || part.name.startsWith('Shirt_vertical_stripe')) {
          addWeights(indices, weights, vertex, torsoBlend(position.getY(vertex)));
        } else {
          addWeights(indices, weights, vertex, fallbackBlend(position.getY(vertex)));
        }
      });
    }
    // Vertices no trace reaches (no authorParts, or unreferenced by the index) still need a
    // valid skin so the weights sum to one everywhere.
    for (let vertex = 0; vertex < count; vertex++) {
      if (!assigned[vertex]) addWeights(indices, weights, vertex, fallbackBlend(position.getY(vertex)));
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
  // Stocky trouser legs connect hip → knee → ankle, ending in a small cuff. They follow the
  // rest segments, and in the seated bind pose every one of them is inside the gown,
  // Trouser_leg oval or authored Paw, so the statue silhouette does not change. No human foot
  // or toe meshes: the authored gold paws are the feet.
  const d1 = new T.Vector3(...SEGMENT_D1);
  const d2 = new T.Vector3(...SEGMENT_D2);
  const up = new T.Vector3(0, 1, 0);
  const thighLength = d1.length(), shinLength = d2.length();
  // Radii kept inside the authored Trouser_leg ovals and Paw: the first pass at .30/.27 and
  // .27/.23 poked two dark nubs through the paw inner edge in the seated statue (383 px in the
  // default-view diff). These still fill the ovals when standing.
  const thighGeometry = new T.CylinderGeometry(.22, .26, thighLength, 10);
  const shinGeometry = new T.CylinderGeometry(.17, .21, shinLength, 10);
  const cuffGeometry = new T.CylinderGeometry(.20, .22, .10, 10);
  const thighDirection = d1.clone().normalize();
  const shinDirection = d2.clone().normalize();
  for (const side of ['L', 'R'] as const) {
    const thigh = ('thigh' + side) as LionBoneName;
    const shin = ('shin' + side) as LionBoneName;
    const foot = ('foot' + side) as LionBoneName;
    const thighMesh = addPart(thigh, thighGeometry, trousers,
      [d1.x / 2, d1.y / 2, d1.z / 2], undefined, 'Lion_rig_thigh_' + side);
    thighMesh.quaternion.setFromUnitVectors(up, thighDirection);
    const shinMesh = addPart(shin, shinGeometry, trousers,
      [d2.x / 2, d2.y / 2, d2.z / 2], undefined, 'Lion_rig_shin_' + side);
    shinMesh.quaternion.setFromUnitVectors(up, shinDirection);
    addPart(foot, cuffGeometry, trousers, [0, 0, 0], undefined, 'Lion_rig_ankle_' + side);
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
