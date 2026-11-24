import {CDS1_KEYS, readKeyboardProgress, saveKeyboardProgress} from './opening/keyboardProgress';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildObservedInterior} from './model/observedInteriors';
import {buildObservedFeatureRoom, keyboardKeycaps, flipWallTiles} from './model/observedFeatureRooms';
import {disposeAsset} from './model/buildCampus';
import {exportGLB, download} from './viewer/export';
import {markRelayRestored, relayRestored} from './opening/backupRelay';
import {STORY_AUDIO_URLS} from './gameplay/storyAudioAssets';

const rooms = {
  lobby: {
    build: () => buildObservedInterior('lobby'),
    note: 'CDS-1 lobby · gates, cool vertical screen and warm white doorframe lights refined against the 16 Nov photo.',
    overview: [20, 17, 25], front: [0, 1.60, 2.49], target: [0, 1.60, -4.9],
  },
  floor13: {
    build: () => buildObservedInterior('floor13'),
    note: 'IMG_4347 04:49–05:00 · 13th-floor grey lift lobby, wood pantry cabinet, microwave, long table and round pendant light.',
    overview: [20, 17, 25], front: [0, 1.64, 11], target: [1, 1.2, 0],
  },
  keyboard: {
    build: () => buildObservedFeatureRoom('keyboard'),
    note: 'Shot 15–16 Nov · cream backlit keyboard, pale blue-grey keys, white curved sofa, grey-blue rug and curved ceiling lights. Front view is the photographed 1.6 m eye-height sightline.',
    overview: [12.6, 10.2, 17.6], front: [-1.25, 1.60, 6.60], target: [.65, 1.45, -3.70],
  },
  flipWall: {
    build: () => buildObservedFeatureRoom('flipWall'),
    note: 'Shot 15 Nov · two-tone flip tiles spell HKU; wall frame, panel seams and curved ceiling light slot kept. Building and floor still to be confirmed.',
    overview: [7.8, 4.5, 7.8], front: [.30, 2.05, 5.5], target: [.30, 1.80, -.75],
  },
  ringDisplay: {
    build: () => buildObservedFeatureRoom('ringDisplay'),
    note: 'Shot 16 Nov · inward-tilted ring screen, red inset brick, tables and chairs, lift on the back wall. Building and floor still to be confirmed.',
    overview: [9.7, 7.4, 11.7], front: [.9, 1.67, 6.3], target: [0, 2.68, -2.3],
  },
};
type Room = keyof typeof rooms;

const host = document.querySelector<HTMLElement>('#stage')!;
const scene = new T.Scene();
scene.background = new T.Color(0xeae8de);
const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = T.ACESFilmicToneMapping;
// The preview used to be shadowless, so furniture appeared pasted onto the floor even
// though the game's site viewer has a shadow path. A tight local sun shadow gives this
// authoring view contact shadows without copying the game's campus-wide 400 m frustum.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
host.append(renderer.domElement);
let environment:T.WebGLRenderTarget;
function refreshEnvironment(){const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();try{const next=pmrem.fromScene(room,.04);scene.environment=next.texture;environment?.dispose();environment=next;}finally{room.dispose();pmrem.dispose();}}
refreshEnvironment();scene.environmentIntensity=.25;
renderer.domElement.addEventListener('webglcontextrestored',refreshEnvironment);
const hemi = new T.HemisphereLight(0xfff6e4, 0x9ca48e, 2.2);
scene.add(hemi);
const sun = new T.DirectionalLight(0xfff5df, 2.4);
sun.position.set(-10, 16, 12);
sun.target.position.set(0, 0, 1.25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 50});
sun.shadow.normalBias = .025;
sun.shadow.bias = -.00025;
scene.add(sun, sun.target);

const camera = new T.PerspectiveCamera(56, 1, .03, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 70;
controls.minDistance = 1;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .30, .50, .92);
composer.addPass(bloom);

let kind: Room = 'lobby';
const search = new URLSearchParams(location.search);
const chapterMode = search.get('chapter') === 'b4';
const initialRoom = search.get('room') as Room | null;
if (chapterMode) kind = 'keyboard';
else if (initialRoom && initialRoom in rooms) kind = initialRoom;
let asset = rooms[kind].build();
scene.add(asset);
type View = 'overview' | 'front' | 'corridor' | 'keys' | 'stool' | 'flip' | 'reveal';
let activeView: View = 'overview';
let fittedAspect = 1;

type Cap = {
  group: T.Group; rest: T.Vector3; attached: boolean; stool: boolean; phrase: boolean; marked: boolean; enter: boolean;
  glow: T.MeshStandardMaterial | null;
  halo: T.Sprite | null;
  puzzle: 'none' | 'floor' | 'flying' | 'seated';
  scatter: T.Vector3; yaw: number; flyFrom: T.Vector3; flyStart: number; seatedAt: number; lit: boolean;
};
const glowCanvas = document.createElement('canvas');
glowCanvas.width = 64;
glowCanvas.height = 64;
const glowContext = glowCanvas.getContext('2d')!;
const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
glowGradient.addColorStop(0, 'rgba(255,255,255,0)');
glowGradient.addColorStop(.48, 'rgba(255,255,255,0)');
glowGradient.addColorStop(.68, 'rgba(255,255,255,.55)');
glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
glowContext.fillStyle = glowGradient;
glowContext.fillRect(0, 0, 64, 64);
const glowTexture = new T.CanvasTexture(glowCanvas);
glowTexture.colorSpace = T.SRGBColorSpace;
let caps: Cap[] = [];
function collectCaps() {
  caps = keyboardKeycaps(asset).map(group => {
    const face = group.children.find(child => child instanceof T.Mesh && child.name.startsWith('Key_')) as T.Mesh | undefined;
    const glow = face && !Array.isArray(face.material) && face.material instanceof T.MeshStandardMaterial ? face.material : null;
    const halo = new T.Sprite(new T.SpriteMaterial({map: glowTexture, color: 0xffc24a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false}));
    halo.scale.set(.66, .66, 1);
    halo.position.set(0, 0, .12);
    halo.visible = false;
    group.add(halo);
    return {
      group,
      rest: new T.Vector3().fromArray(group.userData.rest as number[]),
      attached: true,
      stool: false,
      phrase: !!group.userData.phrase,
      marked: !!group.userData.marked,
      enter: !!group.userData.enter,
      glow,
      halo,
      puzzle: 'none' as const,
      scatter: new T.Vector3(), yaw: 0, flyFrom: new T.Vector3(), flyStart: 0, seatedAt: 0, lit: false,
    };
  });
  updateCapButtons();
}
function resetGlow(cap: Cap) {
  if (cap.glow) {
    cap.glow.emissive.setHex(0);
    cap.glow.emissiveIntensity = 0;
  }
  if (cap.halo) {
    cap.halo.visible = false;
    (cap.halo.material as T.SpriteMaterial).opacity = 0;
  }
}
function setCap(cap: Cap, attached: boolean) {
  cap.attached = attached;
  cap.stool = !attached;
  cap.puzzle = 'none';
  cap.lit = false;
  resetGlow(cap);
  updateCapButtons();
}
function setAllCaps(attached: boolean) {
  for (const cap of caps) {
    cap.attached = attached;
    cap.stool = false;
    cap.puzzle = 'none';
    cap.lit = false;
    resetGlow(cap);
  }
  updateCapButtons();
}
function togglePhrase() {
  const phrase = caps.filter(cap => cap.phrase);
  const restore = phrase.length > 0 && phrase.every(cap => !cap.attached);
  for (const cap of phrase) {
    cap.attached = restore;
    cap.stool = false;
    cap.puzzle = 'none';
    cap.lit = false;
    resetGlow(cap);
  }
  updateCapButtons();
}
function detachV() {
  setAllCaps(true);
  const v = caps.find(cap => cap.group.userData.label === 'V');
  if (v) setCap(v, false);
  view('stool');
}
const capButtons = ['#keysView', '#detachPhrase', '#detachV', '#attachAll', '#puzzleStart', '#puzzleReset'].map(id => document.querySelector<HTMLButtonElement>(id)!);
function updateCapButtons() {
  const visible = kind === 'keyboard' && caps.length > 0;
  for (const button of capButtons) button.hidden = !visible;
  const phrase = caps.filter(cap => cap.phrase);
  const out = phrase.filter(cap => !cap.attached).length;
  document.querySelector('#detachPhrase')!.textContent = phrase.length > 0 && out === phrase.length ? 'Reattach I LOVE CDS' : 'Remove I LOVE CDS';
}

let puzzleActive = false;
let puzzleState: 'idle' | 'collect' | 'ready' | 'flash' | 'online' = 'idle';
let puzzleInserted = 0;
let typed = '';
let flashStart = 0;
let beepTimer: number | null = null;
let chimeLight: T.PointLight | null = null;
let keyboardLight: T.PointLight | null = null;
let enterPressedAt = -Infinity;

function hidePuzzleHud() {
  document.querySelector<HTMLElement>('#puzzle-hud')!.hidden = true;
}
function showPuzzleHud() {
  document.querySelector<HTMLElement>('#puzzle-hud')!.hidden = false;
}
function updatePuzzleHud() {
  const hud = document.querySelector<HTMLElement>('#puzzle-hud')!;
  document.querySelector('#puzzle-input')!.textContent = typed || '—';
  document.querySelector('#puzzle-status')!.textContent = puzzleState === 'online' ? 'CDS-1 ONLINE' : puzzleInserted === CDS1_KEYS.length ? 'All keys seated · Press Enter' : `${puzzleInserted} / 8 seated`;
  document.querySelector('#cpu-status')!.textContent = puzzleState === 'online' ? 'CPU 01 · ONLINE' : 'CPU 01 · OFFLINE';
  hud.classList.toggle('online', puzzleState === 'online');
}
function stopKeyboardPuzzle() {
  puzzleActive = false;
  puzzleState = 'idle';
  puzzleInserted = 0;
  typed = '';
  flashStart = 0;
  enterPressedAt = -Infinity;
  if (beepTimer !== null) { clearTimeout(beepTimer); beepTimer = null; }
  if (chimeLight) { scene.remove(chimeLight); chimeLight = null; }
  if (keyboardLight) { scene.remove(keyboardLight); keyboardLight = null; }
  hidePuzzleHud();
  resetCpuMap();
  updateCapButtons();
  if (kind === 'keyboard') document.querySelector('#note')!.textContent = rooms.keyboard.note + ' Click Keyboard Wall to begin; you can also remove a keycap to inspect its structure. The eight gold keys spell I LOVE CDS.';
}
function resetCpuMap() {
  document.querySelector('#puzzle-hud')?.classList.remove('online');
  for (const node of Array.from(document.querySelectorAll('[data-cpu]'))) node.classList.remove('online');
}
function startPuzzle() {
  if (kind !== 'keyboard' || !caps.length) return;
  stopKeyboardPuzzle();
  setAllCaps(true);
  puzzleActive = true;
  puzzleState = 'collect';
  puzzleInserted = 0;
  typed = '';
  const progress = chapterMode ? readKeyboardProgress(deviceId) : null;
  const phrase = caps.filter(cap => cap.phrase);
  const xs = [-2.9, -2.0, -1.1, -.2, .7, 1.6, 2.5, 3.3];
  const zs = [1.55, 1.72, 1.48, 1.68, 1.52, 1.75, 1.50, 1.66];
  phrase.forEach((cap, index) => {
    cap.puzzle = progress?.seated.includes(cap.group.userData.label) ? 'seated' : 'floor';
    if (cap.puzzle === 'seated') {
      cap.seatedAt = performance.now() - 450;
      cap.group.position.copy(cap.rest);
      cap.group.rotation.set(0, 0, 0);
      puzzleInserted++;
    }
    cap.lit = false;
    cap.yaw = (index % 2 ? 1 : -1) * (.35 + index * .04);
    cap.scatter.set(xs[index] ?? 0, -1.405, zs[index] ?? 3.1);
    if (cap.puzzle === 'floor') {
      cap.group.position.copy(cap.scatter);
      cap.group.rotation.set(-Math.PI / 2, cap.yaw, 0);
    }
    resetGlow(cap);
  });
  view('keys');
  showPuzzleHud();
  updatePuzzleHud();
  keyboardLight = new T.PointLight(0x9dffd0, 0, 10, 2);
  keyboardLight.position.set(.48, 2.8, -2.4);
  scene.add(keyboardLight);
  document.querySelector('#note')!.textContent = 'Keyboard Wall: type I LOVE CDS following the Mac prompt, or click the gold keys on the floor; press Enter to boot once all are back.';
  for (const id of ['#detachPhrase', '#detachV', '#attachAll', '#puzzleStart']) document.querySelector<HTMLButtonElement>(id)!.hidden = true;
  document.querySelector<HTMLButtonElement>('#puzzleReset')!.hidden = false;
  if (progress?.online) {
    puzzleState = 'online';
    setCpuOnline();
    updatePuzzleHud();
  } else if (!chapterMode) playSfx('tick');
}
function resetPuzzle() {
  stopKeyboardPuzzle();
  setAllCaps(true);
  view('keys');
}
function insertCap(cap: Cap) {
  if (!puzzleActive || cap.puzzle !== 'floor') return;
  cap.puzzle = 'flying';
  cap.flyFrom.copy(cap.group.position);
  cap.flyStart = performance.now();
  cap.yaw = cap.group.rotation.y;
  playSfx('insert');
  if (chapterMode) saveKeyboardProgress(deviceId, [String(cap.group.userData.label)], false);
}
function typeLetter(letter: string) {
  if (!puzzleActive || (puzzleState !== 'collect' && puzzleState !== 'ready')) return;
  const key = letter.toUpperCase();
  if (!/^[A-Z]$/.test(key)) return;
  typed = (typed + key).slice(-CDS1_KEYS.length);
  const cap = caps.find(item => item.phrase && item.puzzle === 'floor' && item.group.userData.label === key);
  if (cap) insertCap(cap);
  updatePuzzleHud();
}
function setHalo(cap: Cap, color: number, opacity: number, scale: number) {
  if (!cap.halo) return;
  const material = cap.halo.material as T.SpriteMaterial;
  material.color.setHex(color);
  material.opacity = opacity;
  cap.halo.visible = opacity > .015;
  cap.halo.scale.set(scale, scale, 1);
}
function updatePuzzleCaps(now: number) {
  if (!puzzleActive) return;
  for (const cap of caps) {
    if (!cap.phrase) continue;
    if (cap.puzzle === 'floor') {
      cap.group.position.copy(cap.scatter);
      cap.group.rotation.set(-Math.PI / 2, cap.yaw, 0);
      cap.group.scale.setScalar(1);
    } else if (cap.puzzle === 'flying') {
      const progress = Math.min(1, (now - cap.flyStart) / 700);
      const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      cap.group.position.lerpVectors(cap.flyFrom, cap.rest, eased);
      cap.group.position.y += Math.sin(Math.PI * progress) * .34;
      cap.group.rotation.x = -Math.PI / 2 * (1 - eased) + Math.sin(Math.PI * progress) * .22;
      cap.group.rotation.y = cap.yaw * (1 - eased);
      cap.group.rotation.z = Math.sin(Math.PI * progress) * .20;
      cap.group.scale.setScalar(1 + Math.sin(Math.PI * progress) * .08);
      if (progress >= 1) {
        cap.group.scale.setScalar(1);
        cap.group.rotation.set(0, 0, 0);
        cap.puzzle = 'seated';
        cap.seatedAt = now;
        puzzleInserted++;
        updatePuzzleHud();
      }
    } else if (cap.puzzle === 'seated') {
      const sink = Math.min(1, (now - cap.seatedAt) / 450);
      const sinkEase = 1 - Math.pow(1 - sink, 3);
      cap.group.position.set(cap.rest.x, cap.rest.y, cap.rest.z - .012 * sinkEase);
      cap.group.rotation.set(0, 0, 0);
      cap.group.scale.setScalar(1 - .035 * Math.sin(sink * Math.PI));
      if (sink >= .8 && !cap.lit) {
        cap.lit = true;
        if (cap.glow) {
          cap.glow.emissive.setHex(0xffb43a);
          cap.glow.emissiveIntensity = 1.1;
        }
        setHalo(cap, 0xffb43a, .4, .72);
      }
      if (cap.lit && (puzzleState === 'collect' || puzzleState === 'ready')) {
        if (cap.glow) cap.glow.emissiveIntensity = .8 + .15 * Math.sin(now * .008);
        setHalo(cap, 0xffb43a, .38 + .10 * Math.sin(now * .008), .72 + .04 * Math.sin(now * .008));
      }
    }
  }
  const enter = caps.find(cap => cap.enter);
  if (puzzleInserted === CDS1_KEYS.length && enter && puzzleState !== 'flash' && puzzleState !== 'online') {
    if (enter.glow) {
      enter.glow.emissive.setHex(0x4aa3ff);
      enter.glow.emissiveIntensity = .8 + .2 * Math.sin(now * .006);
    }
    setHalo(enter, 0x4aa3ff, .45 + .10 * Math.sin(now * .006), .74);
    if (puzzleState === 'collect') { puzzleState = 'ready'; updatePuzzleHud(); }
  }
  if (puzzleState === 'flash') {
    const elapsed = (now - flashStart) / 1000;
    if (elapsed >= 3) {
      if (beepTimer !== null) { clearTimeout(beepTimer); beepTimer = null; }
      puzzleState = 'online';
      if (chapterMode) saveKeyboardProgress(deviceId, [...CDS1_KEYS], true);
      setCpuOnline();
      updatePuzzleHud();
      playSfx('chime');
      return;
    }
    const rate = 4 + elapsed * 7;
    const globalOn = Math.sin(elapsed * rate * Math.PI * 2) > 0;
    for (const cap of caps) {
      if (!cap.glow) continue;
      const row = Number(cap.group.userData.row ?? 0);
      const column = Number(cap.group.userData.col ?? 0);
      const phase = elapsed * rate * Math.PI * 2 - (row * .35 + column * .2);
      const on = Math.sin(phase) > 0;
      const color = cap.enter ? 0x4aa3ff : cap.phrase ? 0xffc24a : 0x8fffc0;
      cap.glow.emissive.setHex(color);
      cap.glow.emissiveIntensity = on ? 1.8 : 0;
      setHalo(cap, color, on ? .65 : 0, on ? .78 : .66);
    }
    if (keyboardLight) keyboardLight.intensity = globalOn ? 2.4 : 1.0;
  }
  if (puzzleState === 'online') {
    for (const cap of caps) {
      if (!cap.glow) continue;
      const color = cap.enter ? 0x4aa3ff : cap.phrase ? 0xffc24a : 0x6dffb0;
      cap.glow.emissive.setHex(color);
      cap.glow.emissiveIntensity = cap.enter ? 1.0 : cap.phrase ? .65 : .12;
      setHalo(cap, color, cap.enter ? .55 : cap.phrase ? .4 : .08, cap.enter ? .78 : cap.phrase ? .74 : .64);
    }
    if (keyboardLight) keyboardLight.intensity = 2.2;
  }
}
function flashBeeps(index: number) {
  if (puzzleState !== 'flash') return;
  playSfx('tick');
  const interval = Math.max(45, 210 - index * 16);
  beepTimer = window.setTimeout(() => flashBeeps(index + 1), interval);
}
function setCpuOnline() {
  document.querySelector('#puzzle-hud')!.classList.add('online');
  const cpu = document.querySelector('#cpu1');
  cpu?.classList.add('online');
  const nodes = Array.from(document.querySelectorAll('[data-cpu]'));
  nodes.forEach((node, index) => window.setTimeout(() => { if (puzzleState === 'online') node.classList.add('online'); }, index * 160));
  if (!chimeLight) {
    chimeLight = new T.PointLight(0x6dffb0, 0, 12, 2);
    chimeLight.position.set(0, 3.4, -1);
    scene.add(chimeLight);
  }
  chimeLight.intensity = 2.6;
  if (keyboardLight) keyboardLight.intensity = 2.2;
  const flash = document.querySelector('#puzzle-flash');
  flash?.classList.add('show');
  window.setTimeout(() => flash?.classList.remove('show'), 420);
}
function startFinale() {
  if (!puzzleActive || puzzleInserted !== CDS1_KEYS.length || puzzleState !== 'ready') return;
  puzzleState = 'flash';
  flashStart = performance.now();
  enterPressedAt = performance.now();
  updatePuzzleHud();
  playSfx('unlock');
  flashBeeps(0);
}

type Tile = {group: T.Group; row: number; column: number; current: number; from: number; target: number; start: number; duration: number; outline: T.LineSegments | null};
let tiles: Tile[] = [];
let flipOut = false;
let selectedTiles = new Set<Tile>();
let selectionAnchor: Tile | null = null;
let flipHinge: T.Group | null = null;
let powerLight: T.PointLight | null = null;
let workLight: T.PointLight | null = null;
let revealState: 'idle' | 'check' | 'opening' | 'open' | 'closing' = 'idle';
let revealStart = 0;
let revealTimer: number | null = null;
const OPEN_ANGLE = -1.45;
const selectionMaterial = new T.LineBasicMaterial({color: 0x63e08c, transparent: true, opacity: .95, depthTest: false});

function collectTiles() {
  const groups = flipWallTiles(asset);
  const firstFace = groups.map(group => group.children.find(child => child.name === 'Flip_tile_face')).find(Boolean) as T.Mesh | undefined;
  const edgeGeometry = firstFace ? new T.EdgesGeometry(firstFace.geometry) : null;
  tiles = groups.map(group => {
    const outline = edgeGeometry ? new T.LineSegments(edgeGeometry, selectionMaterial) : null;
    if (outline) {
      outline.name = 'Selection_outline';
      outline.position.z = .023;
      outline.renderOrder = 3;
      outline.visible = false;
      outline.raycast = () => {};
      group.add(outline);
    }
    return {
      group,
      row: Number(group.userData.row ?? 0),
      column: Number(group.userData.column ?? 0),
      current: 0, from: 0, target: 0, start: 0, duration: 1,
      outline,
    };
  });
  selectedTiles.clear();
  selectionAnchor = null;
  flipOut = false;
  if (revealTimer !== null) { clearTimeout(revealTimer); revealTimer = null; }
  revealState = 'idle';
  if (flipHinge) flipHinge.rotation.y = 0;
  if (powerLight) powerLight.intensity = 0;
  if (workLight) workLight.intensity = 0;
  document.querySelector('#flipDemo')!.textContent = 'Flip demo';
  document.querySelector('#flip-check')!.classList.remove('show');
  updateSelectionUI();
}
function scheduleTile(tile: Tile, target: number, delay = 0) {
  tile.from = tile.current;
  tile.target = target;
  tile.start = performance.now() + delay * 1000;
  tile.duration = 420;
}
function setAllTiles(target: number) {
  for (const tile of tiles) scheduleTile(tile, target, tile.column * .035 + tile.row * .008);
  flipOut = target > Math.PI / 2;
  clearSelection();
  document.querySelector('#flipDemo')!.textContent = flipOut ? 'Back to front' : 'Flip demo';
}
function flipAll() {
  setAllTiles(flipOut ? 0 : Math.PI);
  playSfx('tick');
}
function toggleTile(tile: Tile) {
  scheduleTile(tile, tile.target > Math.PI / 2 ? 0 : Math.PI);
}
function updateTiles(now: number) {
  for (const tile of tiles) {
    const progress = Math.min(1, Math.max(0, (now - tile.start) / tile.duration));
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    tile.current = tile.from + (tile.target - tile.from) * eased;
    tile.group.rotation.y = tile.current;
  }
}

function updateSelectionUI() {
  for (const tile of tiles) if (tile.outline) tile.outline.visible = selectedTiles.has(tile);
  const count = selectedTiles.size;
  const button = document.querySelector<HTMLButtonElement>('#flipSelected')!;
  button.textContent = `Flip selected (${count})`;
  button.disabled = count === 0;
  document.querySelector('#selection-count')!.textContent = `Selected ${count} / ${tiles.length}`;
}
function clearSelection() {
  selectedTiles.clear();
  selectionAnchor = null;
  updateSelectionUI();
}
function selectTile(tile: Tile, event: {metaKey: boolean; ctrlKey: boolean; shiftKey: boolean}) {
  const additive = event.metaKey || event.ctrlKey;
  if (event.shiftKey && selectionAnchor) {
    // Finder/Excel range: extend a rectangle from the anchor, not a flat slice of the row-major list.
    const row0 = Math.min(selectionAnchor.row, tile.row);
    const row1 = Math.max(selectionAnchor.row, tile.row);
    const column0 = Math.min(selectionAnchor.column, tile.column);
    const column1 = Math.max(selectionAnchor.column, tile.column);
    if (!additive) selectedTiles.clear();
    for (const item of tiles) {
      if (item.row >= row0 && item.row <= row1 && item.column >= column0 && item.column <= column1) selectedTiles.add(item);
    }
  } else if (additive) {
    if (selectedTiles.has(tile)) selectedTiles.delete(tile); else selectedTiles.add(tile);
    selectionAnchor = tile;
  } else {
    selectedTiles.clear();
    selectedTiles.add(tile);
    selectionAnchor = tile;
  }
  updateSelectionUI();
}
function selectAllTiles() {
  for (const tile of tiles) selectedTiles.add(tile);
  updateSelectionUI();
}
function flipSelected() {
  if (!selectedTiles.size) return;
  playSfx('tick');
  for (const tile of selectedTiles) scheduleTile(tile, tile.target > Math.PI / 2 ? 0 : Math.PI);
}
function prepareHinge() {
  const wall = asset.getObjectByName('HKU_flip_wall');
  if (!wall || !wall.parent) { flipHinge = null; return; }
  const width = Number((wall.userData.dimensions as {width?: number} | undefined)?.width ?? 7.227);
  const hinge = new T.Group();
  hinge.name = 'Flip_wall_hinge';
  hinge.position.set(wall.position.x - width / 2, wall.position.y, wall.position.z);
  wall.parent.add(hinge);
  hinge.attach(wall);
  flipHinge = hinge;
}
function preparePowerLight() {
  if (powerLight) { scene.remove(powerLight); powerLight = null; }
  if (workLight) { scene.remove(workLight); workLight = null; }
  if (!asset.getObjectByName('Aux_power_closet')) return;
  powerLight = new T.PointLight(0x4dff9a, 0, 7, 2);
  powerLight.position.set(.30, 2.1, -2.35);
  scene.add(powerLight);
  workLight = new T.PointLight(0xffe4c4, 0, 6, 2);
  workLight.position.set(.30, 3.75, -2.15);
  scene.add(workLight);
}
function showCheck() {
  const check = document.querySelector('#flip-check')!;
  check.classList.remove('show');
  void (check as HTMLElement).offsetWidth;
  check.classList.add('show');
  window.setTimeout(() => check.classList.remove('show'), 1500);
}
function revealWall() {
  if (kind !== 'flipWall' || !tiles.length || revealState !== 'idle') return;
  const allBack = tiles.every(tile => tile.target > Math.PI / 2);
  if (!allBack) {
    setAllTiles(Math.PI);
    playSfx('tick');
    revealTimer = window.setTimeout(() => { if (kind === 'flipWall') revealWall(); }, 2200);
    return;
  }
  playSfx('success');
  showCheck();
  revealState = 'check';
  revealTimer = window.setTimeout(() => {
    if (kind !== 'flipWall') return;
    view('reveal');
    playSfx('unlock');
    revealState = 'opening';
    revealStart = performance.now();
  }, 950);
}
function resetWall() {
  if (revealTimer !== null) { clearTimeout(revealTimer); revealTimer = null; }
  revealState = 'idle';
  revealStart = 0;
  if (flipHinge) flipHinge.rotation.y = 0;
  if (powerLight) powerLight.intensity = 0;
  if (workLight) workLight.intensity = 0;
  for (const tile of tiles) {
    tile.current = 0; tile.from = 0; tile.target = 0; tile.start = 0; tile.duration = 1;
    tile.group.rotation.y = 0;
  }
  flipOut = false;
  clearSelection();
  document.querySelector('#flipDemo')!.textContent = 'Flip demo';
  document.querySelector('#flip-check')!.classList.remove('show');
  view('flip');
}
function updateReveal(now: number) {
  if (!flipHinge) return;
  if (revealState === 'opening' || revealState === 'closing') {
    const progress = Math.min(1, (now - revealStart) / 1800);
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    flipHinge.rotation.y = revealState === 'opening' ? OPEN_ANGLE * eased : OPEN_ANGLE * (1 - eased);
    if (progress >= 1) {
      if (revealState === 'opening') {
        revealState = 'open';
        if (powerLight) powerLight.intensity = 3.2;
        if (workLight) workLight.intensity = 2.2;
        playSfx('power');
      } else {
        revealState = 'idle';
        if (powerLight) powerLight.intensity = 0;
        if (workLight) workLight.intensity = 0;
        view('flip');
      }
    }
  }
  if (powerLight && revealState === 'open') powerLight.intensity = 2.8 + Math.sin(now * .003) * .5;
}

let audioCtx: AudioContext | null = null;
function audio(): AudioContext {
  audioCtx ??= new AudioContext();
  return audioCtx;
}
function beep(freq: number, duration: number, type: OscillatorType = 'sine', gain = .06, delay = 0, slideTo?: number) {
  const ctx = audio(), start = ctx.currentTime + delay;
  const osc = ctx.createOscillator(), amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  amp.gain.setValueAtTime(.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + .012);
  amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + .03);
}
function noiseBurst(duration = .18, gain = .05, delay = 0) {
  const ctx = audio(), start = ctx.currentTime + delay, frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const source = ctx.createBufferSource(), amp = ctx.createGain();
  source.buffer = buffer;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
  source.connect(amp).connect(ctx.destination);
  source.start(start);
}
function playSfx(kind: 'tick' | 'success' | 'unlock' | 'power' | 'insert' | 'chime') {
  try {
    audio().resume();
    if (kind === 'tick') beep(1400, .035, 'square', .022);
    if (kind === 'insert') { beep(760, .055, 'square', .028); noiseBurst(.03, .015); }
    if (kind === 'success') { beep(660, .14, 'sine', .07); beep(990, .22, 'sine', .07, .12); }
    if (kind === 'unlock') { beep(90, .24, 'square', .09, 0, 58); noiseBurst(.18, .055, .02); }
    if (kind === 'power') { beep(55, .9, 'sawtooth', .05, 0, 110); noiseBurst(.06, .04, .35); beep(880, .08, 'square', .03, .36); }
    if (kind === 'chime') for (const [index, freq] of [369.99, 466.16, 554.37, 739.99].entries()) beep(freq, 1.7, 'sine', .045, index * .04);
  } catch {}
}

function view(mode:View='overview') {
  activeView=mode;
  // In chapter mode the camera belongs to the player, not the authoring rig.
  if(chapterMode){fittedAspect=camera.aspect;return;}
  const room=rooms[kind];
  camera.fov=kind==='keyboard'&&mode==='front'?(camera.aspect<1?80:64):56;
  camera.updateProjectionMatrix();
  if(mode==='stool'){
    camera.position.set(.55, 2.25, 1.55);
    controls.target.set(-.26, 1.18, -1.25);
  }else if(mode==='reveal'){
    camera.position.set(4.35, 2.62, 3.55);
    controls.target.set(.30, 2.15, -2.20);
  }else if(mode==='flip'){
    camera.position.set(.30, 2.22, 4.15);
    controls.target.set(.30, 1.98, -1.85);
  }else if(mode==='keys'){
    camera.position.set(.48, 2.86, 3.85);
    controls.target.set(.48, 2.54, -3.70);
  }else if(mode==='corridor'){
    camera.position.set(-3.65,1.66,11.3);
    controls.target.set(-3.34,1.73,-1);
  }else{
    controls.target.fromArray(room.target);
    if(mode==='front'&&(kind==='lobby'||kind==='floor13'))controls.target.y=kind==='lobby'?1.6:1.7;
    camera.position.fromArray(mode==='front'?room.front:room.overview);
    // Keep the photographed keyboard viewpoint at a real 1.6 m eye height in both
    // landscape and portrait; other rooms retain their aspect-fitting dolly.
    if(!(kind==='keyboard'&&mode==='front'))camera.position.sub(controls.target).multiplyScalar(Math.max(1,1.15/camera.aspect)).add(controls.target);
  }
  fittedAspect=camera.aspect;
  controls.update();
}

const roomButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-room]'));
const corridorButton=document.querySelector<HTMLButtonElement>('#corridor')!;
function select(next: Room) {
  if (puzzleActive) stopKeyboardPuzzle();
  if (powerLight) { scene.remove(powerLight); powerLight = null; }
  if (workLight) { scene.remove(workLight); workLight = null; }
  if (revealTimer !== null) { clearTimeout(revealTimer); revealTimer = null; }
  flipHinge = null;
  if (next !== kind) {
    const replacement = rooms[next].build();
    scene.remove(asset);
    disposeAsset(asset);
    kind = next;
    asset = replacement;
    scene.add(asset);
  }
  prepareHinge();
  // The keyboard lounge's pale surfaces need lower local light levels than the
  // blockout rooms; otherwise leather and stone clip before their form reads.
  renderer.toneMappingExposure=kind==='keyboard'?.82:1;
  hemi.intensity=kind==='keyboard'?1.25:2.2;
  sun.intensity=kind==='keyboard'?1.35:2.4;
  bloom.strength=kind==='keyboard'?.12:.30;
  bloom.threshold=kind==='keyboard'?1.05:.92;
  preparePowerLight();
  prepareBreaker();
  collectCaps();
  collectTiles();
  view(kind==='ringDisplay'?'front':kind==='keyboard'?'keys':kind==='flipWall'?'flip':'overview');
  corridorButton.hidden=kind!=='keyboard';
  const flipButtons = ['#flipView', '#flipDemo', '#flipSelected', '#reveal', '#resetWall'].map(id => document.querySelector<HTMLButtonElement>(id)!);
  for (const button of flipButtons) button.hidden = kind !== 'flipWall';
  document.querySelector('#note')!.textContent = rooms[kind].note + (kind==='keyboard'?' Click Keyboard Wall to begin; you can also remove a keycap to inspect its structure. The eight gold keys spell I LOVE CDS.':kind==='flipWall'?' Click a tile to select, Shift to extend, Cmd/Ctrl to add; double-click to flip one; Space flips the selection; Verify and power on runs the whole sequence.':'');
  for (const button of roomButtons) {
    const selected = button.dataset.room === kind;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

for (const button of roomButtons) button.onclick = () => select(button.dataset.room as Room);
document.querySelector<HTMLButtonElement>('#front')!.onclick = () => view('front');
corridorButton.onclick=()=>view('corridor');
document.querySelector<HTMLButtonElement>('#overview')!.onclick = () => view();
document.querySelector<HTMLButtonElement>('#keysView')!.onclick = () => view('keys');
document.querySelector<HTMLButtonElement>('#flipView')!.onclick = () => view('flip');
document.querySelector<HTMLButtonElement>('#flipDemo')!.onclick = () => flipAll();
document.querySelector<HTMLButtonElement>('#flipSelected')!.onclick = () => flipSelected();
document.querySelector<HTMLButtonElement>('#reveal')!.onclick = () => revealWall();
document.querySelector<HTMLButtonElement>('#resetWall')!.onclick = () => resetWall();
document.querySelector<HTMLButtonElement>('#detachPhrase')!.onclick = () => togglePhrase();
document.querySelector<HTMLButtonElement>('#detachV')!.onclick = () => detachV();
document.querySelector<HTMLButtonElement>('#attachAll')!.onclick = () => setAllCaps(true);
document.querySelector<HTMLButtonElement>('#puzzleStart')!.onclick = () => startPuzzle();
document.querySelector<HTMLButtonElement>('#puzzleReset')!.onclick = () => resetPuzzle();

const raycaster = new T.Raycaster();
const pointer = new T.Vector2();
let pointerDown: {x: number; y: number} | null = null;
function tileAt(event: MouseEvent): Tile | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(tiles.map(tile => tile.group), true)[0];
  if (!hit) return null;
  let node: T.Object3D | null = hit.object;
  while (node && !(node instanceof T.Group && node.name.startsWith('FlipTile_'))) node = node.parent;
  return tiles.find(tile => tile.group === node) ?? null;
}
renderer.domElement.addEventListener('contextmenu', event => { if (kind === 'flipWall') event.preventDefault(); });
renderer.domElement.addEventListener('pointerdown', event => { pointerDown = {x: event.clientX, y: event.clientY}; });
renderer.domElement.addEventListener('pointerup', event => {
  const start = pointerDown;
  pointerDown = null;
  if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
  if (chapterMode && chapterStep === 'breaker' && sceneHit(event, breakerLever)) { pullBreaker(); return; }
  if (chapterMode && chapterStep === 'connect' && sceneHit(event, asset.getObjectByName('Aux_power_closet'))) { connectMacBook(); return; }
  if (kind === 'flipWall' && tiles.length) {
    const tile = tileAt(event);
    if (tile) selectTile(tile, event); else clearSelection();
    return;
  }
  if (!caps.length) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(caps.map(cap => cap.group), true)[0];
  if (!hit) return;
  let node: T.Object3D | null = hit.object;
  while (node && !(node instanceof T.Group && node.name.startsWith('Keycap_'))) node = node.parent;
  const cap = caps.find(item => item.group === node);
  if (cap) {
    if (kind === 'keyboard' && puzzleActive) {
      if (cap.enter) startFinale();
      else if (cap.phrase && cap.puzzle === 'floor') insertCap(cap);
      return;
    }
    setCap(cap, !cap.attached);
  }
});
renderer.domElement.addEventListener('dblclick', event => {
  if (kind !== 'flipWall' || !tiles.length) return;
  const tile = tileAt(event);
  if (!tile) return;
  scheduleTile(tile, tile.target > Math.PI / 2 ? 0 : Math.PI);
  playSfx('tick');
});
window.addEventListener('keydown', event => {
  if (!chapterMode || chapterStep !== 'breaker' || breakerPulled) return;
  if (event.key.toLowerCase() === 'e') { event.preventDefault(); pullBreaker(); }
});
window.addEventListener('keydown', event => {
  if (kind !== 'flipWall' || !tiles.length) return;
  const target = event.target as HTMLElement | null;
  if (target && target.closest('input,textarea,select,button')) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); selectAllTiles(); return; }
  if (event.key === 'Escape') { clearSelection(); return; }
  if (event.code === 'Space') { event.preventDefault(); flipSelected(); return; }
  if (event.key === 'Enter') { event.preventDefault(); revealWall(); }
});
window.addEventListener('keydown', event => {
  if (kind !== 'keyboard' || !puzzleActive || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target && target.closest('input,textarea,select')) return;
  if (event.key === 'Enter') { event.preventDefault(); startFinale(); return; }
  if (/^[a-zA-Z]$/.test(event.key)) { event.preventDefault(); typeLetter(event.key); }
});
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button'))) button.addEventListener('click', () => button.blur());
function updateCaps(dt: number) {
  const ease = 1 - Math.exp(-14 * dt);
  for (const cap of caps) {
    if (puzzleActive && cap.phrase) continue;
    let x = cap.rest.x, y = cap.rest.y, z = cap.rest.z, tilt = 0;
    if (!cap.attached && cap.stool) {
      y = -1.405;
      z = 2.59;
      tilt = -Math.PI / 2;
    } else if (!cap.attached) {
      y = cap.rest.y - .95;
      z = cap.rest.z + .62;
      tilt = -.18;
    }
    if (cap.enter) z -= .018 * Math.max(0, 1 - (performance.now() - enterPressedAt) / 240);
    cap.group.position.x += (x - cap.group.position.x) * ease;
    cap.group.position.y += (y - cap.group.position.y) * ease;
    cap.group.position.z += (z - cap.group.position.z) * ease;
    cap.group.rotation.x += (tilt - cap.group.rotation.x) * ease;
  }
}

/* ---------- Chapter 1 · B4 keyboard wall, playable hand-off ---------- */
type ChapterStep = 'keyboard' | 'flip' | 'breaker' | 'connect' | 'done';
const MACBOOK_ITEM = 'macbook-air-13-silver';
const OPENING_SAVE_KEY = 'hku.opening.v1';
const CHAPTER_ORDER: ChapterStep[] = ['keyboard', 'flip', 'breaker', 'connect'];
const CHAPTER_OBJECTIVES: Record<ChapterStep, string> = {
  keyboard: 'Spell I LOVE CDS on the wall — type it or click the eight gold caps — then press Enter.',
  flip: 'Turn every one of the 561 tiles over so the wall shows its back face, then open it.',
  breaker: 'Reach into the open closet and pull the red breaker lever. Click it or press E.',
  connect: 'Plug the MacBook into the supercomputer cabinet — click the green port rail.',
  done: '',
};
const CHAPTER_ACTIONS: Partial<Record<ChapterStep, string>> = {
  flip: 'Flip all tiles and open',
  breaker: 'Pull the breaker',
  connect: 'Connect MacBook',
};
/** Chapter mode keeps the MacBook instance id from the opening save so the
 * relay key written here is the same key the lion chapter reads. */
function chapterDeviceId() {
  const fromUrl = search.get('device');
  if (fromUrl) return fromUrl;
  try {
    const save = JSON.parse(localStorage.getItem(OPENING_SAVE_KEY) ?? 'null') as {slots?: {itemId?: string; instanceId?: string}[]} | null;
    const id = save?.slots?.find(slot => slot?.itemId === MACBOOK_ITEM)?.instanceId;
    if (typeof id === 'string' && id) return id;
  } catch { /* A fresh run falls back to the demo laptop. */ }
  return 'lawn-demo-macbook';
}
const deviceId = chapterMode ? chapterDeviceId() : '';
let chapterStep: ChapterStep = 'keyboard';
let breakerPulled = false;
let breakerLever: T.Object3D | null = null;
let rackMaterials: T.MeshStandardMaterial[] = [];
let hum: HTMLAudioElement | null = null;

/* Player camera. Chapter mode is walked in first person at eye height: a fixed
 * stance per step, a short settle between stances, and a hand's width of
 * mouse-look. Preview mode keeps OrbitControls untouched. */
const EYE_HEIGHT = 1.6;
type Stance = {pos: [number, number, number]; look: [number, number, number]};
const CHAPTER_STANCES: Record<'keyboard' | 'flip' | 'breaker' | 'connect', Stance> = {
  // Keyboard wall panel sits at (0.48, 2.64, -3.79); stand back on the lounge floor.
  keyboard: {pos: [.48, EYE_HEIGHT, 2.95], look: [.48, 1.74, -3.79]},
  // Flip wall panel fills (0.30, 0.13–3.86, -1.93).
  flip: {pos: [.30, EYE_HEIGHT, 2.70], look: [.30, 1.98, -1.93]},
  // Breaker lever at (0.30, 1.86, -2.26) inside the opened closet.
  breaker: {pos: [.30, EYE_HEIGHT + .02, 1.40], look: [.30, 1.78, -2.26]},
  // Aux power rail, the supercomputer port, at (0.30, 1.22, -2.27).
  connect: {pos: [.30, EYE_HEIGHT + .02, 1.05], look: [.30, 1.60, -2.30]},
};
const camFromPos = new T.Vector3(), camFromLook = new T.Vector3();
const camToPos = new T.Vector3(), camToLook = new T.Vector3();
const chapterLook = new T.Vector3().fromArray(CHAPTER_STANCES.keyboard.look);
let camStart = 0, camDuration = 0, camMoving = false;
let lookYaw = 0, lookPitch = 0, lookYawTarget = 0, lookPitchTarget = 0;

function setChapterView(step: 'keyboard' | 'flip' | 'breaker' | 'connect', immediate = false) {
  if (!chapterMode) return;
  const stance = CHAPTER_STANCES[step];
  camFromPos.copy(camera.position);
  camFromLook.copy(chapterLook);
  camToPos.fromArray(stance.pos);
  camToLook.fromArray(stance.look);
  lookYawTarget = 0;
  lookPitchTarget = 0;
  if (immediate) {
    camera.position.copy(camToPos);
    chapterLook.copy(camToLook);
    camMoving = false;
    camera.lookAt(chapterLook);
    return;
  }
  camStart = performance.now();
  camDuration = 1250;
  camMoving = true;
}
function updateChapterCamera(dt: number) {
  if (camMoving) {
    const progress = camDuration > 0 ? Math.min(1, (performance.now() - camStart) / camDuration) : 1;
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    camera.position.lerpVectors(camFromPos, camToPos, eased);
    chapterLook.lerpVectors(camFromLook, camToLook, eased);
    if (progress >= 1) {
      camMoving = false;
      camera.position.copy(camToPos);
      chapterLook.copy(camToLook);
    }
  }
  const settle = Math.min(1, dt * 9);
  lookYaw += (lookYawTarget - lookYaw) * settle;
  lookPitch += (lookPitchTarget - lookPitch) * settle;
  camera.lookAt(chapterLook);
  camera.rotateY(lookYaw);
  camera.rotateX(lookPitch);
}
window.addEventListener('pointermove', event => {
  if (!chapterMode) return;
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const nx = (event.clientX - rect.left) / rect.width - .5;
  const ny = (event.clientY - rect.top) / rect.height - .5;
  lookYawTarget = T.MathUtils.clamp(-nx * .26, -.13, .13);
  lookPitchTarget = T.MathUtils.clamp(-ny * .18, -.09, .09);
});

/* Story lighting: the room is under lockdown — dim, red emergency wash — until
 * the breaker closes. Then the ceiling and the green racks come up. */
const LOCKDOWN_SKY = new T.Color(0x4a1512);
const LOCKDOWN_GROUND = new T.Color(0x100604);
const NORMAL_SKY = new T.Color(0xfff6e4);
const NORMAL_GROUND = new T.Color(0x9ca48e);
const emergencyLights: T.PointLight[] = [];
let chapterLightLevel = 0;
function initChapterLighting() {
  scene.background = new T.Color(0x050a08);
  hemi.color.copy(LOCKDOWN_SKY);
  hemi.groundColor.copy(LOCKDOWN_GROUND);
  hemi.intensity = .55;
  sun.intensity = .18;
  for (const x of [-2.2, .30, 2.6]) {
    const lamp = new T.PointLight(0xff2d1a, 2.6, 9.5, 2);
    lamp.position.set(x, 3.15, -1.1);
    scene.add(lamp);
    emergencyLights.push(lamp);
  }
}
function updateChapterLighting(dt: number) {
  if (!chapterMode) return;
  const now = performance.now();
  chapterLightLevel += ((breakerPulled ? 1 : 0) - chapterLightLevel) * Math.min(1, dt * 2.2);
  const level = chapterLightLevel;
  hemi.color.copy(LOCKDOWN_SKY).lerp(NORMAL_SKY, level);
  hemi.groundColor.copy(LOCKDOWN_GROUND).lerp(NORMAL_GROUND, level);
  hemi.intensity = .55 + 1.65 * level;
  sun.intensity = .18 + 1.42 * level;
  for (const [index, lamp] of emergencyLights.entries()) {
    lamp.intensity = 2.6 * (1 - level) * (.88 + .12 * Math.sin(now * .006 + index));
  }
  if (chapterLightLevel < .98) {
    if (powerLight) powerLight.intensity = 0;
    // One dim maintenance lamp keeps the open closet readable during lockdown.
    if (workLight) workLight.intensity = .55;
  }
  for (const material of rackMaterials) material.emissiveIntensity = .12 + 1.85 * level;
}
function setChapterStatus(paired: boolean) {
  const status = document.querySelector<HTMLElement>('#chapter-status');
  if (!status) return;
  status.hidden = false;
  status.textContent = paired ? 'MacBook Air · paired' : 'MacBook Air · not paired';
  status.classList.toggle('paired', paired);
}

function chapterHud() {
  return document.querySelector<HTMLElement>('#chapter-hud')!;
}
function setChapterStep(step: ChapterStep) {
  chapterStep = step;
  document.querySelector('#chapter-objective')!.textContent = CHAPTER_OBJECTIVES[step];
  const action = document.querySelector<HTMLButtonElement>('#chapter-action')!;
  const label = CHAPTER_ACTIONS[step];
  action.hidden = !label;
  if (label) action.textContent = label;
  const current = CHAPTER_ORDER.indexOf(step);
  for (const item of Array.from(document.querySelectorAll<HTMLElement>('#chapter-steps li'))) {
    const index = CHAPTER_ORDER.indexOf(item.dataset.step as ChapterStep);
    item.classList.toggle('done', step === 'done' || (current >= 0 && index < current));
    item.classList.toggle('current', index === current && step !== 'done');
  }
}
function chapterFade(run: () => void) {
  const fade = document.querySelector<HTMLElement>('#chapter-fade')!;
  fade.classList.add('show');
  window.setTimeout(() => {
    run();
    window.setTimeout(() => fade.classList.remove('show'), 80);
  }, 260);
}
function prepareBreaker() {
  breakerLever = asset.getObjectByName('Aux_breaker_lever') ?? null;
  rackMaterials = [];
  asset.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof T.MeshStandardMaterial && material.name === 'Aux power green' && !rackMaterials.includes(material)) rackMaterials.push(material);
    }
  });
}
function playHum() {
  try {
    hum ??= new Audio(STORY_AUDIO_URLS['supercomputer_hum'].href);
    hum.loop = true;
    hum.volume = .35;
    void hum.play().catch(() => {});
  } catch { /* Audio is optional. */ }
}
function pullBreaker() {
  if (!chapterMode || chapterStep !== 'breaker' || breakerPulled) return;
  breakerPulled = true;
  playSfx('power');
  playHum();
  if (powerLight) powerLight.intensity = 3.6;
  window.setTimeout(() => { if (chapterStep === 'breaker') { setChapterStep('connect'); setChapterView('connect'); } }, 1400);
}
function connectMacBook() {
  if (!chapterMode || chapterStep !== 'connect') return;
  markRelayRestored(deviceId);
  playSfx('success');
  setChapterStatus(true);
  setChapterStep('done');
  chapterHud().hidden = true;
  document.querySelector<HTMLElement>('#chapter-success')!.hidden = false;
}
function skipChapterPuzzle() {
  if (!chapterMode) return;
  breakerPulled = true;
  if (flipHinge) flipHinge.rotation.y = OPEN_ANGLE;
  revealState = 'open';
  if (powerLight) powerLight.intensity = 3.2;
  if (workLight) workLight.intensity = 2.2;
  markRelayRestored(deviceId);
  setChapterStatus(true);
  setChapterStep('done');
  chapterHud().hidden = true;
  document.querySelector<HTMLElement>('#chapter-success')!.hidden = false;
}
function initChapter() {
  document.body.classList.add('chapter-mode');
  controls.enabled = false;
  initChapterLighting();
  const hudLabel = document.querySelector('#puzzle-hud header b');
  if (hudLabel) hudLabel.textContent = 'RECOVERY LINK';
  chapterHud().hidden = false;
  document.querySelector<HTMLButtonElement>('#chapter-skip')!.onclick = () => skipChapterPuzzle();
  document.querySelector<HTMLButtonElement>('#chapter-action')!.onclick = () => {
    if (chapterStep === 'flip') revealWall();
    else if (chapterStep === 'breaker') pullBreaker();
    else if (chapterStep === 'connect') connectMacBook();
  };
  if (relayRestored(deviceId)) {
    setChapterStep('done');
    setChapterStatus(true);
    chapterHud().hidden = true;
    document.querySelector<HTMLElement>('#chapter-success')!.hidden = false;
    return;
  }
  setChapterStep('keyboard');
  startPuzzle();
  setChapterStatus(false);
  setChapterView('keyboard', true);
}
function updateChapter(now: number) {
  if (!chapterMode || chapterStep === 'done') return;
  if (chapterStep === 'keyboard' && puzzleState === 'online') {
    setChapterStep('flip');
    chapterFade(() => {
      select('flipWall');
      setChapterView('flip', true);
    });
    return;
  }
  if (chapterStep === 'flip' && revealState === 'open') {
    setChapterStep('breaker');
    setChapterView('breaker');
    return;
  }
  if (breakerLever) {
    const target = breakerPulled ? .5 : -.45;
    breakerLever.rotation.x += (target - breakerLever.rotation.x) * .12;
  }
  if (breakerPulled) {
    for (const material of rackMaterials) material.emissiveIntensity = 1.9 + Math.sin(now * .004) * .3;
  }
}
function sceneHit(event: MouseEvent, object: T.Object3D | null | undefined) {
  if (!object) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(object, true).length > 0;
}

const exportButton = document.querySelector<HTMLButtonElement>('#export')!;
exportButton.onclick = async () => {
  exportButton.disabled = true;
  for (const button of roomButtons) button.disabled = true;
  const exporting = asset;
  try {
    const bytes = await exportGLB(exporting);
    download(new Blob([bytes], {type: 'model/gltf-binary'}), exporting.name + '.glb');
  } finally {
    exportButton.disabled = false;
    for (const button of roomButtons) button.disabled = false;
  }
};

function resize() {
  renderer.setSize(host.clientWidth, host.clientHeight);
  composer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  if (Math.abs(camera.aspect - fittedAspect) > .15) view(activeView);
}
new ResizeObserver(resize).observe(host);
resize();
select(kind);
if (chapterMode) initChapter();
const clock = new T.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  const now = performance.now();
  if (chapterMode) updateChapterCamera(dt); else controls.update();
  updateCaps(dt);
  updatePuzzleCaps(now);
  updateTiles(now);
  updateReveal(now);
  updateChapter(now);
  updateChapterLighting(dt);
  composer.render();
});
Object.assign(window, {__INTERIORS: {scene, camera, renderer, controls, select, view:(front=false)=>view(front?'front':'overview'), keysView:()=>view('keys'), stoolView:()=>view('stool'), flipView:()=>view('flip'), revealView:()=>view('reveal'), flipAll, toggleTile, flipSelected, selectAllTiles, clearSelection, reveal:revealWall, resetWall, startPuzzle, resetPuzzle, typeLetter, startFinale, screenOf:(row: number, column: number) => { const tile = tiles.find(item => item.row === row && item.column === column); if (!tile) return null; const world = new T.Vector3(); tile.group.getWorldPosition(world); world.project(camera); const rect = renderer.domElement.getBoundingClientRect(); return {x: rect.left + (world.x * .5 + .5) * rect.width, y: rect.top + (-world.y * .5 + .5) * rect.height}; }, get puzzle() { return {active: puzzleActive, state: puzzleState, inserted: puzzleInserted, typed}; }, get revealState() { return revealState; }, get selection() { return [...selectedTiles].map(tile => `${tile.row}:${tile.column}`); }, get asset() { return asset; }, get caps() { return caps.map(cap => ({label: cap.group.userData.label, phrase: cap.phrase, enter: cap.enter, marked: cap.marked, attached: cap.attached, stool: cap.stool, puzzle: cap.puzzle, lit: cap.lit, position: cap.group.position.toArray(), rotation: cap.group.rotation.toArray().slice(0,3)})); }, get tiles() { return tiles.map(tile => ({row: tile.row, column: tile.column, angle: tile.current, front: tile.group.userData.front, back: tile.group.userData.back})); }, setCap, setAllCaps, togglePhrase, detachV, toggleKey:(label: string) => { const cap = caps.find(item => item.group.userData.label === label); if (cap) setCap(cap, !cap.attached); }, chapter: chapterMode ? { get step() { return chapterStep; }, get device() { return deviceId; }, get breaker() { return breakerPulled; }, get relay() { return relayRestored(deviceId); }, get paired() { return document.querySelector('#chapter-status')?.classList.contains('paired') ?? false; }, pullBreaker, connectMacBook, skip: skipChapterPuzzle, setView: setChapterView } : null}});
