import * as T from 'three';
import {createCanvas, ImageData, loadImage} from '@napi-rs/canvas';
import {createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildObservedFeatureRoom} from '../src/model/observedFeatureRooms';
import {exportGLB, reloadGLB} from '../src/viewer/export';

class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) { blob.arrayBuffer().then(v => { this.result = v; this.onloadend?.(); }).catch(e => this.onerror?.(e)); }
  readAsDataURL(blob: Blob) { blob.arrayBuffer().then(v => { this.result = `data:${blob.type};base64,${Buffer.from(v).toString('base64')}`; this.onloadend?.(); }); }
}
class NodeCanvas {
  canvas = createCanvas(1, 1);
  constructor(w: number, h: number) { this.canvas.width = w; this.canvas.height = h; }
  get width() { return this.canvas.width; } set width(v: number) { this.canvas.width = v; }
  get height() { return this.canvas.height; } set height(v: number) { this.canvas.height = v; }
  getContext(type: string) { return type === '2d' ? this.canvas.getContext('2d') : null; }
  async convertToBlob() { return new Blob([new Uint8Array(await this.canvas.encode('png'))], {type: 'image/png'}); }
}
Object.assign(globalThis, {FileReader: NodeFileReader, OffscreenCanvas: NodeCanvas, ImageData, self: globalThis, createImageBitmap: async (blob: Blob) => loadImage(Buffer.from(await blob.arrayBuffer()))});

function stats(root: T.Object3D) {
  let meshes = 0, triangles = 0;
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    meshes++;
    const geometry = object.geometry;
    triangles += (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3;
  });
  const box = new T.Box3().setFromObject(root);
  return {meshes, triangles, size: box.getSize(new T.Vector3()).toArray().map(v => Number(v.toFixed(3)))};
}

const out = resolve('assets/cds1');
mkdirSync(out, {recursive: true});

type FixtureSpec = {file: string; room: 'keyboard' | 'flipWall'; node: string; name: string; centerY?: number};
const specs: FixtureSpec[] = [
  {file: 'CDS1-Keyboard-Wall.glb', room: 'keyboard', node: 'Keyboard_wall', name: 'CDS1_Keyboard_Wall'},
  {file: 'CDS1-HKU-Flip-Wall.glb', room: 'flipWall', node: 'HKU_flip_wall', name: 'CDS1_HKU_Flip_Wall', centerY: -(.13 + 17 * .219 / 2)},
  {file: 'CDS1-Aux-Power-Closet.glb', room: 'flipWall', node: 'Aux_power_closet', name: 'CDS1_Aux_Power_Closet', centerY: -1.9915},
];

const manifest: Record<string, unknown> = {
  schemaVersion: 1,
  units: 'metres',
  coordinateSystem: '+X right, +Y up, +Z toward the room; panel centre at origin',
  sourceRepo: 'ThomasLin070217/hku-shanghai-campus',
  sourceBranch: 'feat/cds1-keyboard-detach',
  generatedAt: new Date().toISOString(),
  fixtures: [],
};

for (const spec of specs) {
  const room = buildObservedFeatureRoom(spec.room);
  const wall = room.getObjectByName(spec.node);
  if (!wall) throw new Error(`${spec.node} missing from ${room.name}`);
  const fixture = wall.clone(true);
  fixture.name = spec.name;
  fixture.position.set(0, spec.centerY ?? 0, 0);
  fixture.rotation.set(0, 0, 0);
  fixture.userData = {
    ...wall.userData,
    fixture: spec.file,
    sourceRoom: room.name,
    sourceRoomTransform: wall.position.toArray(),
    exportedFrom: 'scripts/export-cds1-fixtures.ts',
  };
  fixture.updateMatrixWorld(true);

  const before = stats(fixture);
  const binary = await exportGLB(fixture);
  writeFileSync(resolve(out, spec.file), Buffer.from(binary));
  const loaded = await reloadGLB(binary);
  const restored = loaded.scene.getObjectByName(spec.name);
  if (!restored) throw new Error(`${spec.name} lost in GLB round trip`);
  const after = stats(restored);
  const keycaps = spec.room === 'keyboard' ? count(restored, /^Keycap_r\d+c\d+$/) : undefined;
  const tiles = spec.room === 'flipWall' && spec.node === 'HKU_flip_wall' ? count(restored, /^FlipTile_r\d+c\d+$/) : undefined;
  if (spec.room === 'keyboard' && keycaps !== 54) throw new Error(`Expected 54 keycaps, got ${keycaps}`);
  if (tiles !== undefined && tiles !== 561) throw new Error(`Expected 561 tiles, got ${tiles}`);
  if (Math.abs(before.triangles - after.triangles) > .5) throw new Error(`${spec.name}: triangle mismatch ${before.triangles} -> ${after.triangles}`);
  (manifest.fixtures as unknown[]).push({
    id: wall.userData.id,
    file: spec.file,
    node: spec.name,
    bytes: binary.byteLength,
    sha256: createHash('sha256').update(Buffer.from(binary)).digest('hex'),
    stats: after,
    keycaps,
    tiles,
    roomTransform: wall.position.toArray(),
    capabilities: wall.userData.capabilities,
    source: wall.userData.source,
  });
  console.log(`${spec.file}: ${(binary.byteLength / 1048576).toFixed(2)} MiB, ${after.triangles} triangles, ${keycaps ?? tiles ?? 'static'} pieces, round trip passed`);
  (fixture as T.Object3D).removeFromParent();
  (restored as T.Object3D).removeFromParent();
}

writeFileSync(resolve(out, 'fixtures.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${resolve(out, 'fixtures.json')}`);

function count(root: T.Object3D, pattern: RegExp) {
  let n = 0;
  root.traverse(object => { if (pattern.test(object.name)) n++; });
  return n;
}
