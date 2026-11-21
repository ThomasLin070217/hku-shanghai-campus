/**
 * Runtime check for the L001 boss lion rig.
 *
 * Builds the real authored lion, runs it through the same compact() pass the campus uses at
 * runtime, then asserts skeleton/skinning, clip, phase-mapping and locomotion properties.
 * Run with `npm run check:lion-rig`.
 */
import * as T from 'three';
import {createLion} from '../src/model/nov13Details';
import {compact} from '../src/model/buildCampus';
import {AWAKEN_SECONDS, createCombat, type CombatState} from '../src/lionBoss/combat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createLionRig, LION_BONE_NAMES, LION_CLIP_NAMES,
  type LionBoneName, type LionClipName, type LionRig,
} from '../src/lionBoss/lionRig';
import {mergedTraces, tagChildren} from '../src/scene/authoring';
import type {PrimitiveTrace} from '../src/scene/authoring';

let failures = 0;
function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`ok   ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ' — ' + detail : ''}`);
  }
}

const BODY_NAME = 'Lion_body_uniform_scale';
const HEAD_PARTS = new Set([
  'Golden_mane', 'Forelock', 'Face', 'Ear', 'Ear_inner', 'Muzzle', 'Eye', 'Eye_glint',
  'Nose', 'Smile', 'Tongue', 'Lower_lip', 'Whisker', 'Whisker_dot',
]);
const isHeadPart = (name: string) => HEAD_PARTS.has(name) || name.startsWith('Mane_');

const lion = createLion();
const body = lion.getObjectByName(BODY_NAME) as T.Group;
check('Lion_body_uniform_scale exists before compact()', !!body);

// The authored statue's true vertex bounds in body space, captured before skinning.
const authoredMin = new T.Vector3(Infinity, Infinity, Infinity);
const authoredMax = new T.Vector3(-Infinity, -Infinity, -Infinity);
const authoredMeshes: T.Mesh[] = [];
body.traverse(object => { if (object instanceof T.Mesh) authoredMeshes.push(object); });
for (const mesh of authoredMeshes) {
  mesh.updateMatrix();
  const position = mesh.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const point = new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
    authoredMin.min(point);
    authoredMax.max(point);
  }
}

compact(lion as T.Group);
const compactedBody = lion.getObjectByName(BODY_NAME) as T.Group | undefined;
check('Lion_body_uniform_scale survives compact()', !!compactedBody);
if (!compactedBody) throw new Error('cannot continue without the compacted lion body');
const compactedMeshes = compactedBody.children.filter(child => child instanceof T.Mesh).length;
const rig = createLionRig(compactedBody);
const mainRig = rig;

/* ------------------------------------------------------------------ */
/* Skeleton and skinning                                               */
/* ------------------------------------------------------------------ */
const boneNames = rig.boneArray.map(bone => bone.name);
check('bone list matches the documented skeleton', LION_BONE_NAMES.every(name => boneNames.includes(name)),
  `${boneNames.length} bones: ${boneNames.join(', ')}`);
check('skeleton owns every bone', rig.skeleton.bones.length === LION_BONE_NAMES.length,
  `${rig.skeleton.bones.length}`);
check('every compacted mesh became a SkinnedMesh', rig.meshes.length === compactedMeshes,
  `${rig.meshes.length}/${compactedMeshes}`);
check('no plain Mesh left directly under the body',
  compactedBody.children.every(child => !(child instanceof T.Mesh) || child instanceof T.SkinnedMesh));

/** Test-owned trace resolution, kept independent of the rig's own helper. */
function forEachTraceVertex(geometry: T.BufferGeometry, part: PrimitiveTrace, visit: (vertex: number) => void) {
  const slots = geometry.index;
  for (let i = part.start; i < part.start + part.count; i++) visit(slots ? slots.getX(i) : i);
}

/**
 * Skin-weight and trace-mapping assertions. Trace start/count are resolved through the index
 * buffer when the merged geometry keeps one, so this runs against both compact() layouts.
 */
function checkSkinning(layout: string, rig: LionRig) {
  let skinProblems = 0, nanProblems = 0, indexProblems = 0, totalVertices = 0;
  for (const mesh of rig.meshes) {
    const position = mesh.geometry.getAttribute('position');
    const skinIndex = mesh.geometry.getAttribute('skinIndex');
    const skinWeight = mesh.geometry.getAttribute('skinWeight');
    totalVertices += position.count;
    if (!skinIndex || !skinWeight || skinIndex.count !== position.count || skinWeight.count !== position.count) {
      skinProblems += 1;
      continue;
    }
    for (let i = 0; i < position.count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const weight = skinWeight.getComponent(i, k);
        const index = skinIndex.getComponent(i, k);
        if (!Number.isFinite(weight) || !Number.isFinite(index)) nanProblems += 1;
        if (index >= rig.boneArray.length) indexProblems += 1;
        sum += weight;
      }
      if (!Number.isFinite(position.getX(i)) || !Number.isFinite(position.getY(i)) || !Number.isFinite(position.getZ(i))) nanProblems += 1;
      if (Math.abs(sum - 1) > 1e-4) skinProblems += 1;
    }
    if (mesh.skeleton !== rig.skeleton) skinProblems += 1;
  }
  check(`[${layout}] skin attributes cover every vertex and weights sum to 1`, skinProblems === 0,
    `${totalVertices} vertices, ${skinProblems} bad weights`);
  check(`[${layout}] skin data contains no NaNs and valid bone indices`, nanProblems === 0 && indexProblems === 0,
    `${nanProblems} NaN, ${indexProblems} bad indices`);
  check(`[${layout}] all skinned meshes share one skeleton`, rig.meshes.every(mesh => mesh.skeleton === rig.skeleton));

  const dominantBone = (mesh: T.SkinnedMesh, vertex: number): LionBoneName => {
    const skinIndex = mesh.geometry.getAttribute('skinIndex');
    const skinWeight = mesh.geometry.getAttribute('skinWeight');
    let best = -1, bestWeight = -1;
    for (let k = 0; k < 4; k++) {
      const weight = skinWeight.getComponent(vertex, k);
      if (weight > bestWeight) { bestWeight = weight; best = skinIndex.getComponent(vertex, k); }
    }
    return rig.boneArray[best].name as LionBoneName;
  };
  const sideOf = (part: PrimitiveTrace) => (part.bounds[0] + part.bounds[3]) / 2 < 0 ? 'L' : 'R';

  let headVertices = 0, headBad = 0;
  let pawTraces = 0, pawBad = 0, sleeveTraces = 0, sleeveBad = 0, tailTipTraces = 0, tailTipBad = 0;
  let eyeTraces = 0, eyeOutside = 0;
  for (const mesh of rig.meshes) {
    const position = mesh.geometry.getAttribute('position');
    for (const part of (mesh.userData.authorParts ?? []) as PrimitiveTrace[]) {
      if (isHeadPart(part.name)) {
        forEachTraceVertex(mesh.geometry, part, vertex => {
          headVertices += 1;
          if (dominantBone(mesh, vertex) !== 'head') headBad += 1;
        });
      }
      if (part.name === 'Paw') {
        pawTraces += 1;
        const expected = ('foreArm' + sideOf(part)) as LionBoneName;
        forEachTraceVertex(mesh.geometry, part, vertex => { if (dominantBone(mesh, vertex) !== expected) pawBad += 1; });
      }
      if (part.name === 'Gown_sleeve') {
        sleeveTraces += 1;
        const expected = ('upperArm' + sideOf(part)) as LionBoneName;
        forEachTraceVertex(mesh.geometry, part, vertex => { if (dominantBone(mesh, vertex) !== expected) sleeveBad += 1; });
      }
      if (part.name === 'Tail_tip') {
        tailTipTraces += 1;
        forEachTraceVertex(mesh.geometry, part, vertex => { if (dominantBone(mesh, vertex) !== 'tail3') tailTipBad += 1; });
      }
      if (part.name === 'Eye' || part.name === 'Eye_glint') {
        // The vertices a trace resolves to must sit inside that trace's recorded bounds;
        // reading an index-space range as vertex offsets lands on the wrong primitive.
        eyeTraces += 1;
        const centroid = new T.Vector3();
        let n = 0;
        forEachTraceVertex(mesh.geometry, part, vertex => { centroid.add(new T.Vector3().fromBufferAttribute(position, vertex)); n += 1; });
        centroid.divideScalar(Math.max(1, n));
        const [x, y, z, xx, yy, zz] = part.bounds, eps = 1e-3;
        if (!(n > 0 && centroid.x >= x - eps && centroid.x <= xx + eps && centroid.y >= y - eps
          && centroid.y <= yy + eps && centroid.z >= z - eps && centroid.z <= zz + eps)) eyeOutside += 1;
      }
    }
  }
  check(`[${layout}] head traces are rigidly weighted to the head bone`, headVertices > 0 && headBad === 0,
    `${headVertices} trace slots across mane/face parts, ${headBad} off-head`);
  check(`[${layout}] left and right paw traces follow their own forearms`, pawTraces >= 2 && pawBad === 0,
    `${pawTraces} traces, ${pawBad} wrong`);
  check(`[${layout}] left and right sleeves follow their own upper arms`, sleeveTraces >= 2 && sleeveBad === 0,
    `${sleeveTraces} traces, ${sleeveBad} wrong`);
  check(`[${layout}] tail tip follows the last tail bone`, tailTipTraces === 1 && tailTipBad === 0);
  check(`[${layout}] eye trace vertices resolve inside their recorded bounds`, eyeTraces === 4 && eyeOutside === 0,
    `${eyeTraces} eye/glint traces, ${eyeOutside} outside`);
}
checkSkinning('flattened', rig);
check('leg bones exist and carry new leg meshes',
  (['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as LionBoneName[])
    .every(name => rig.bones[name].children.some(child => child instanceof T.Mesh)));

/* ------------------------------------------------------------------ */
/* Eyes attach to the head bone                                        */
/* ------------------------------------------------------------------ */
{
  const point = new T.Vector3(.38, 3.6, 1.02);
  const back = rig.headLocalPoint(point).applyMatrix4(rig.restMatrix('head'));
  check('headLocalPoint round-trips a body-space eye position', back.distanceTo(point) < 1e-6);
}

/* ------------------------------------------------------------------ */
/* Clips                                                               */
/* ------------------------------------------------------------------ */
for (const name of LION_CLIP_NAMES) {
  const clip = rig.clips[name];
  const tracksOk = clip.tracks.every(track => {
    const target = track.name.split('.')[0] as LionBoneName;
    return boneNames.includes(target);
  });
  check(`clip ${name} exists, is non-empty and targets real bones`,
    clip.duration > 0 && clip.tracks.length > 0 && tracksOk,
    `${clip.duration.toFixed(2)} s, ${clip.tracks.length} tracks`);
}
check('awaken matches the combat awakening duration', Math.abs(rig.clips.awaken.duration - AWAKEN_SECONDS) < 1e-6);
check('shutdown matches the 1.6 s power-off presentation', Math.abs(rig.clips.shutdown.duration - 1.6) < 1e-6);

function loopClosed(name: LionClipName) {
  let worst = 0, worstTrack = '';
  for (const track of rig.clips[name].tracks) {
    const size = track.getValueSize();
    const values = track.values;
    for (let k = 0; k < size; k++) {
      const delta = Math.abs(values[k] - values[values.length - size + k]);
      if (delta > worst) { worst = delta; worstTrack = track.name; }
    }
  }
  return {worst, worstTrack};
}
for (const name of ['idle', 'walk', 'run'] as LionClipName[]) {
  const {worst, worstTrack} = loopClosed(name);
  check(`clip ${name} is loop-closed`, worst < 1e-4, `max endpoint delta ${worst.toExponential(1)} (${worstTrack})`);
}

/* ------------------------------------------------------------------ */
/* Pose evaluation                                                     */
/* ------------------------------------------------------------------ */
const GROUND = (0.025 - compactedBody.position.y) / compactedBody.scale.y;
const WORLD_SCALE = compactedBody.scale.y;

function evaluateBounds(rig: LionRig = mainRig) {
  const deltas = new Map<LionBoneName, T.Matrix4>();
  for (const bone of rig.boneArray) {
    const name = bone.name as LionBoneName;
    deltas.set(name, rig.poseMatrix(name).multiply(rig.restMatrix(name).invert()));
  }
  const min = new T.Vector3(Infinity, Infinity, Infinity);
  const max = new T.Vector3(-Infinity, -Infinity, -Infinity);
  const add = (point: T.Vector3) => { min.min(point); max.max(point); };
  const point = new T.Vector3(), skinned = new T.Vector3();
  for (const mesh of rig.meshes) {
    const position = mesh.geometry.getAttribute('position');
    const skinIndex = mesh.geometry.getAttribute('skinIndex');
    const skinWeight = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      skinned.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const weight = skinWeight.getComponent(i, k);
        if (!weight) continue;
        skinned.addScaledVector(point.clone().applyMatrix4(deltas.get(rig.boneArray[skinIndex.getComponent(i, k)].name as LionBoneName)!), weight);
      }
      add(skinned);
    }
  }
  for (const bone of rig.boneArray) {
    for (const child of bone.children) {
      if (!(child instanceof T.Mesh)) continue;
      child.updateMatrix();
      child.geometry.computeBoundingBox();
      const box = child.geometry.boundingBox!;
      const matrix = rig.poseMatrix(bone.name as LionBoneName).multiply(child.matrix);
      for (let i = 0; i < 8; i++) add(new T.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ).applyMatrix4(matrix));
    }
  }
  return {min, max, height: (max.y - GROUND) * WORLD_SCALE, clearance: (min.y - GROUND) * WORLD_SCALE};
}

const DT = 1 / 60;

// The seated clip must reproduce the authored statue.
{
  const state = createCombat().state;
  for (let i = 0; i < 6; i++) rig.update(DT, state, 0);
  check('unawakened boss holds the seated statue', rig.current === 'seated',
    `clip ${rig.current}`);
  const bounds = evaluateBounds();
  check('seated silhouette matches the authored lion',
    Math.abs(bounds.min.y - authoredMin.y) < 1e-3 && Math.abs(bounds.max.y - authoredMax.y) < 1e-3,
    `y ${bounds.min.y.toFixed(4)}..${bounds.max.y.toFixed(4)} vs authored ${authoredMin.y.toFixed(4)}..${authoredMax.y.toFixed(4)}`);
  check('support-top ground plane is below the seated statue',
    Math.abs(bounds.min.y - GROUND) * WORLD_SCALE < .05,
    `ground ${GROUND.toFixed(4)}, clearance ${bounds.clearance.toFixed(3)} m`);
}

// Awakening must visibly stand the lion and end in a sane standing height.
{
  const state = createCombat().state;
  state.phase = 'awakening'; state.remaining = AWAKEN_SECONDS; state.awakened = true;
  let awakenClearance = Infinity;
  for (let i = 0; i < Math.ceil(AWAKEN_SECONDS / DT); i++) {
    state.remaining = Math.max(0, state.remaining - DT);
    rig.update(DT, state, 0);
    if (i % 12 === 0) awakenClearance = Math.min(awakenClearance, evaluateBounds().clearance);
  }
  check('awakening plays the awaken one-shot', rig.current === 'awaken', `clip ${rig.current}`);
  check('awakening keeps geometry above the ground', awakenClearance > -.05,
    `lowest point ${awakenClearance.toFixed(3)} m relative to ground`);
  state.phase = 'safe';
  for (let i = 0; i < 30; i++) rig.update(DT, state, 0);
  check('awakened idle starts after the one-shot', rig.current === 'idle', `clip ${rig.current}`);
  const bounds = evaluateBounds();
  check('standing height is within 5.0–7.4 m', bounds.height >= 5 && bounds.height <= 7.4,
    `${bounds.height.toFixed(2)} m`);
  check('standing feet rest on the ground plane', Math.abs(bounds.clearance) < .08,
    `clearance ${bounds.clearance.toFixed(3)} m`);
  check('standing lion is taller than the seated statue', bounds.max.y > authoredMax.y,
    `${bounds.max.y.toFixed(3)} vs ${authoredMax.y.toFixed(3)} body-local`);
}

// Walk: foot swing, hip bob, planted feet.
{
  const state = createCombat().state;
  state.phase = 'patrol'; state.awakened = true;
  for (let i = 0; i < 40; i++) rig.update(DT, state, 0);
  check('patrol starts the walk cycle', rig.current === 'walk', `clip ${rig.current}`);
  const footY: number[][] = [[], []];
  const hipY: number[] = [];
  let minSole = Infinity;
  for (let i = 0; i < 120; i++) {
    state.lion.x += 1.4 * DT;
    rig.update(DT, state, 1.4);
    for (const [side, name] of (['footL', 'footR'] as LionBoneName[]).entries()) {
      const matrix = rig.poseMatrix(name);
      footY[side].push(matrix.elements[13]);
      const position = new T.Vector3().setFromMatrixPosition(matrix);
      const quaternion = new T.Quaternion().setFromRotationMatrix(matrix);
      minSole = Math.min(minSole, new T.Vector3(0, -.10, .13)
        .applyMatrix4(new T.Matrix4().compose(position, quaternion, new T.Vector3(1, 1, 1))).y);
    }
    hipY.push(rig.bones.hips.position.y);
  }
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  check('walk swings both feet vertically', span(footY[0]) > .1 && span(footY[1]) > .1,
    `L ${span(footY[0]).toFixed(3)}, R ${span(footY[1]).toFixed(3)} body units`);
  check('walk bobs the hips', span(hipY) > .01, `${span(hipY).toFixed(3)} body units`);
  check('walking feet stay on or above the ground',
    (minSole - GROUND) * WORLD_SCALE > -.05,
    `lowest sole ${((minSole - GROUND) * WORLD_SCALE).toFixed(3)} m relative to ground`);
}

// Attack and shutdown poses must not push geometry through the floor.
{
  const state = createCombat().state;
  state.awakened = true;
  for (const [phase, seconds] of [['chargeWarn', 1], ['charge', .82], ['swipeWarn', 1.05], ['stunned', 1.2], ['complete', 1.7]] as Array<[CombatState['phase'], number]>) {
    state.phase = phase;
    for (let i = 0; i < Math.ceil(seconds / DT); i++) rig.update(DT, state, 0);
    const bounds = evaluateBounds();
    check(`phase ${phase} keeps geometry above the ground`, bounds.clearance > -.05,
      `lowest point ${bounds.clearance.toFixed(3)} m relative to ground`);
  }
}

// Phase mapping.
{
  const state = createCombat().state;
  state.awakened = true;
  const cases: Array<[CombatState['phase'], LionClipName, number]> = [
    ['patrol', 'walk', 0], ['return', 'walk', 0], ['chase', 'run', 0],
    ['chargeWarn', 'chargeWarn', 0], ['charge', 'charge', 0], ['swipeWarn', 'swipeWarn', 0],
    ['stunned', 'stunned', 0], ['safe', 'idle', 0], ['complete', 'shutdown', 0],
  ];
  for (const [phase, expected, speed] of cases) {
    state.phase = phase;
    rig.update(DT, state, speed);
    check(`phase ${phase} plays ${expected}`, rig.current === expected, `clip ${rig.current}`);
  }
  state.phase = 'safe';
  state.lion.x = 0;
  for (let i = 0; i < 20; i++) { state.yaw += 1.2 * DT; rig.update(DT, state, 0); }
  check('turning in place plays the walk cycle instead of idling', rig.current === 'walk', `clip ${rig.current}`);
}

/* ------------------------------------------------------------------ */
/* Indexed layout                                                      */
/* ------------------------------------------------------------------ */
// Mirror of compact() on main after dfc7935: a material bucket keeps its index buffer when
// every member mesh is indexed, and mergedTraces() then records start/count in index space.
// This branch's compact() always flattens, so the rig is exercised against both layouts.
function compactKeepingIndex(g: T.Group) {
  tagChildren(g);
  for (const child of [...g.children]) if (child instanceof T.Group) compactKeepingIndex(child);
  const buckets = new Map<T.Material, T.Mesh[]>();
  for (const c of g.children) if (c instanceof T.Mesh && !Array.isArray(c.material)) {
    const list = buckets.get(c.material) || [];
    list.push(c);
    buckets.set(c.material, list);
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const allIndexed = meshes.every(m => !!m.geometry.index);
    const geometries = meshes.map(m => {
      m.updateMatrix();
      const geom = m.geometry.clone().applyMatrix4(m.matrix);
      if (allIndexed || !geom.index) return geom;
      const flat = geom.toNonIndexed();
      geom.dispose();
      return flat;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(x => x.dispose());
    if (!geometry) throw new Error(`Cannot merge ${g.name}`);
    const combined = new T.Mesh(geometry, material);
    combined.name = `${g.name}__${material.name}`;
    combined.userData = {...g.userData, ...meshes[0].userData, authorParts: mergedTraces(meshes)};
    meshes.forEach(m => { g.remove(m); m.geometry.dispose(); });
    g.add(combined);
  }
}
{
  const indexedLion = createLion();
  compactKeepingIndex(indexedLion as T.Group);
  const indexedBody = indexedLion.getObjectByName(BODY_NAME) as T.Group;
  const indexedMeshes = indexedBody.children.filter((child): child is T.Mesh => child instanceof T.Mesh);
  const eyes = indexedMeshes.find(mesh => mesh.name.endsWith('Lion eyes and whiskers'));
  const withIndex = indexedMeshes.filter(mesh => !!mesh.geometry.index);
  check('[indexed] compact mirror keeps index buffers like main',
    withIndex.length > 0 && !!eyes?.geometry.index,
    `${withIndex.length}/${indexedMeshes.length} indexed; eyes ${eyes?.geometry.getAttribute('position').count} verts / ${eyes?.geometry.index?.count} indices`);
  const indexedRig = createLionRig(indexedBody);
  check('[indexed] every compacted mesh became a SkinnedMesh', indexedRig.meshes.length === indexedMeshes.length,
    `${indexedRig.meshes.length}/${indexedMeshes.length}`);
  checkSkinning('indexed', indexedRig);
  const state = createCombat().state;
  for (let i = 0; i < 6; i++) indexedRig.update(DT, state, 0);
  const seated = evaluateBounds(indexedRig);
  check('[indexed] seated silhouette matches the authored lion',
    Math.abs(seated.min.y - authoredMin.y) < 1e-3 && Math.abs(seated.max.y - authoredMax.y) < 1e-3,
    `y ${seated.min.y.toFixed(4)}..${seated.max.y.toFixed(4)}`);
  state.phase = 'patrol'; state.awakened = true;
  for (let i = 0; i < 90; i++) { state.lion.x += 1.4 * DT; indexedRig.update(DT, state, 1.4); }
  const walking = evaluateBounds(indexedRig);
  check('[indexed] walking lion stays on the ground at standing height',
    walking.clearance > -.05 && walking.height >= 5 && walking.height <= 7.4,
    `height ${walking.height.toFixed(2)} m, clearance ${walking.clearance.toFixed(3)} m`);
  indexedRig.dispose();
}

// Teardown must hand the authored statue back and allow a fresh rig.
{
  rig.dispose();
  const plain = compactedBody.children.filter(child => child instanceof T.Mesh && !(child instanceof T.SkinnedMesh));
  check('dispose restores the authored meshes', plain.length === compactedMeshes,
    `${plain.length}/${compactedMeshes} plain meshes`);
  check('dispose removes every bone from the body',
    compactedBody.children.every(child => !(child instanceof T.Bone)));
  const rebuilt = createLionRig(compactedBody);
  check('rig can be rebuilt after dispose',
    rebuilt.meshes.length === compactedMeshes && rebuilt.boneArray.length === LION_BONE_NAMES.length);
  rebuilt.dispose();
}

console.log(failures === 0 ? '\nlion rig: all checks passed' : `\nlion rig: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
