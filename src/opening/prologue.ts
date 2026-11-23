/**
 * BARRIER 2030 prologue: the single-take skippable in-engine cinematic that
 * plays before the player first takes control, timed to the four recorded
 * narration lines. The gate mounts on `play()`; the clock
 * starts after the BEGIN click has resumed the audio context and the audio pack
 * has loaded, and the first line starts with the clock. The camera is driven
 * from `viewer.beforeRender`, which runs after the explorer's own update.
 */
import * as T from 'three';
import type {CampusAudio} from '../gameplay/audio';
import {PROLOGUE_LINES,PROLOGUE_TOTAL,PROLOGUE_URLS} from './prologueVoice';
import {prologuePath,type PrologueWaypoint} from './prologueTimeline';
import {createPrologueVisuals,type PrologueVisuals} from './prologueVisuals';
import {findB4DoorLeaves,setB4DoorLeaves} from './b4Shell';
import './prologue.css';

export interface PrologueOptions {
  viewer: {beforeRender: Set<(dt: number) => void>};
  explorer: {camera: T.PerspectiveCamera; pause(reason: string): void; game: {paused: boolean}};
  audio: CampusAudio;
  bounds: () => T.Box3;
  /** The live scene: prologue-only visuals are added to it and removed on stop. */
  scene: T.Scene;
  /** Prologue-only Magic Hour override; restored on stop/skip. */
  atmosphere?: {enterDusk(): void; endDusk(): void};
  clock?: () => number;
}

export interface PrologueDebug {
  seek(seconds: number): void;
  state(): {t: number; line: number; shot: number};
  /** The timed waypoints of the one-shot path, for the browser continuity gate. */
  waypoints(): {t: number; position: [number, number, number]}[];}


export interface Prologue {
  readonly active: boolean;
  play(): Promise<void>;
  stop(): void;
  dispose(): void;
  debug: PrologueDebug;
}

type ShotWindow = {start: number; end: number};
type VoiceHandle = {stop(): void};
type Phase = 'idle' | 'gate' | 'starting' | 'running' | 'done';

const FOV = 52;
const VOICE_GAIN = 0.9;
const END_HOLD = 2;
const NOTICE = 'Narration unavailable';
const STORAGE_KEY = 'hku.campus.prologue.v1';
const UP = new T.Vector3(0, 1, 0);
/** Keys the exploration controller acts on. Enter is absent on purpose: it is a
 * prologue control at the gate and while running, not a game key. */
const GAME_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyV', 'KeyE', 'KeyC', 'KeyF',
  'Space', 'Escape', 'ShiftLeft', 'ShiftRight', 'BracketLeft', 'BracketRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ...Array.from({length: 9}, (_, index) => `Digit${index + 1}`),
]);
const MARKUP = `<div class="prologue-gate"><h1>HKU Shanghai at War</h1><p>BARRIER 2030 · A CDS campus story</p><button class="prologue-begin" type="button">BEGIN</button></div>
<div class="prologue-frame"><div class="prologue-bar top"></div><div class="prologue-bar bottom"></div><p class="prologue-subtitle" aria-live="polite"></p><button class="prologue-skip" type="button">Skip</button></div>
<div class="prologue-endcard" hidden><p>RESTORE THE TOWERS</p><p>FREE THE STUDENTS</p></div>`;

export function createPrologue(options: PrologueOptions): Prologue {
  const {viewer, explorer, audio, scene, atmosphere} = options;
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const externalClock = options.clock;

  let phase: Phase = 'idle';
  let promise: Promise<void> | null = null;
  let resolvePlay: (() => void) | null = null;
  let overlay: HTMLDivElement | null = null;
  let gate: HTMLDivElement | null = null;
  let frame: HTMLDivElement | null = null;
  let subtitle: HTMLParagraphElement | null = null;
  let endcard: HTMLDivElement | null = null;
  let previousFov = explorer.camera.fov;
  let fovSaved = false;
  let registered = false;
  let origin = 0;
  let seekDelta = 0;
  let lastT = 0;
  let nextLine = 0;
  let activeLine = -1;
  let silent = false;
  let noticeUntil = -1;
  // One clock base per run, captured at begin(): audio time when the context is
  // running, otherwise wall time. Never switched mid-run. A hidden tab suspends
  // the context, and mixing bases would jump the cinematic by the hidden wall
  // time and skip the one-shot intro (review M6).
  let useAudio = false;
  let audioBase = 0;
  let perfBase = 0;
  /** Bumped by reset()/stop(): a decode from an older generation must not write
   * buffers or `silent` into the run that replaced it (review N1). */
  let generation = 0;
  let decodeRun: AbortController | null = null;
  let spawnPosition: T.Vector3 | null = null;
  let spawnLook: T.Vector3 | null = null;
  let finalQuaternion: T.Quaternion | null = null;
  let waypoints: PrologueWaypoint[] = [];
  let positionCurve: T.CatmullRomCurve3 | null = null;
  let lookCurve: T.CatmullRomCurve3 | null = null;
  let windows: ShotWindow[] = [];
  let visuals: PrologueVisuals | null = null;
  let doorLeaves: T.Object3D[] = [];
  let doorsOpened = false;
  let ducked = false;
  const scratchPosition = new T.Vector3();
  const scratchLook = new T.Vector3();
  const lookMatrix = new T.Matrix4();
  const buffers = new Map<string, AudioBuffer>();
  const voices = new Set<VoiceHandle>();

  /** The player's spawn pose is captured from the explorer on the first frame,
   * never at creation, so the cinematic lands exactly where control resumes. */
  function captureSpawn(): void {
    if (spawnPosition) return;
    spawnPosition = explorer.camera.position.clone();
    finalQuaternion = explorer.camera.quaternion.clone();
    spawnLook = spawnPosition.clone().add(new T.Vector3(0, 0, -1).applyQuaternion(explorer.camera.quaternion).multiplyScalar(12));
    buildPath();
  }

  /** One Catmull-Rom spline through every timed waypoint of the whole take. The
   * waypoint table is pure data in prologueTimeline.ts; the last waypoint is the
   * captured spawn pose. Look targets ride their own spline so the camera does
   * not whip through the doorway turns. */
  function buildPath(): void {
    waypoints = prologuePath(PROLOGUE_LINES, {
      position: spawnPosition!.toArray() as [number, number, number],
      look: spawnLook!.toArray() as [number, number, number],
    });
    positionCurve = new T.CatmullRomCurve3(
      waypoints.map((waypoint) => new T.Vector3(...waypoint.position)), false, 'centripetal', 0.5);
    lookCurve = new T.CatmullRomCurve3(
      waypoints.map((waypoint) => new T.Vector3(...waypoint.look)), false, 'centripetal', 0.5);
    windows = PROLOGUE_LINES.map((line, index) => ({
      start: line.start,
      end: index + 1 < PROLOGUE_LINES.length ? PROLOGUE_LINES[index + 1].start : PROLOGUE_TOTAL,
    }));
  }

  function shotIndex(t: number): number {
    for (let index = windows.length - 1; index >= 0; index--) if (t >= windows[index].start) return index;
    return 0;
  }

  /** Index of the waypoint segment that holds `t`. */
  function segmentIndex(t: number): number {
    let index = 0;
    while (index < waypoints.length - 2 && t > waypoints[index + 1].t) index++;
    return index;
  }

  /**
   * Sample the one-shot path by the prologue clock. No cuts: the position and
   * look splines are sampled at the same parameter. Reduced motion walks the
   * same spline at constant arc-length speed. After the last narration line the
   * camera holds the captured spawn pose, so the first frame of player control
   * is identical to the last frame of the cinematic.
   */
  function applyShot(t: number): void {
    if (!waypoints.length || !positionCurve || !lookCurve || !spawnPosition || !finalQuaternion) return;
    const camera = explorer.camera;
    if (t >= PROLOGUE_TOTAL) {
      camera.position.copy(spawnPosition);
      camera.quaternion.copy(finalQuaternion);
      camera.updateMatrixWorld();
      return;
    }
    if (reduced?.matches) {
      const u = positionCurve.getUtoTmapping(T.MathUtils.clamp(t / PROLOGUE_TOTAL, 0, 1), 0);
      positionCurve.getPoint(u, scratchPosition);
      lookCurve.getPoint(u, scratchLook);
    } else {
      const index = segmentIndex(t);
      const from = waypoints[index];
      const to = waypoints[Math.min(index + 1, waypoints.length - 1)];
      const span = Math.max(1e-6, to.t - from.t);
      const local = T.MathUtils.clamp((t - from.t) / span, 0, 1);
      const u = waypoints.length > 1 ? (index + local) / (waypoints.length - 1) : 0;
      positionCurve.getPoint(u, scratchPosition);
      lookCurve.getPoint(u, scratchLook);
    }
    camera.position.copy(scratchPosition);
    camera.quaternion.setFromRotationMatrix(lookMatrix.lookAt(scratchPosition, scratchLook, UP));
    camera.updateMatrixWorld();
  }

  function updateSubtitle(t: number): void {
    if (!subtitle) return;
    if (noticeUntil >= 0 && t < noticeUntil) {
      if (subtitle.textContent !== NOTICE) subtitle.textContent = NOTICE;
      subtitle.classList.remove('is-player');
      subtitle.classList.add('is-visible');
      return;
    }
    const index = PROLOGUE_LINES.findIndex(line => t >= line.start && t <= line.end);
    if (index !== activeLine) {
      activeLine = index;
      if (index >= 0) {
        subtitle.textContent = PROLOGUE_LINES[index].text;
        subtitle.classList.toggle('is-player', PROLOGUE_LINES[index].speaker === 'player');
      }
    }
    subtitle.classList.toggle('is-visible', index >= 0);
  }

  /** Narration ducks the music bed and restores it after the last line. */
  function duck(active: boolean): void {
    if (ducked === active) return;
    ducked = active;
    audio.setDialogueDuck(active);
  }

  function playLine(index: number): void {
    if (silent) return;
    const line = PROLOGUE_LINES[index];
    const buffer = buffers.get(line.id);
    if (!buffer) return;
    duck(true);
    let handle: VoiceHandle | null = null;
    handle = audio.playVoice(buffer, {gain: VOICE_GAIN, onended: () => {
      if (handle) voices.delete(handle);
      if (!voices.size) duck(false);
    }});
    if (handle) voices.add(handle);
    else duck(false);
  }

  function updateVoices(t: number): void {
    while (nextLine < PROLOGUE_LINES.length && t >= PROLOGUE_LINES[nextLine].start) {
      const index = nextLine++;
      const line = PROLOGUE_LINES[index];
      if (t <= line.end + 0.001) playLine(index);
    }
  }

  function stopVoices(): void {
    for (const handle of voices) handle.stop();
    voices.clear();
    duck(false);
  }

  /** Prologue-only scenery (mesh die-shot, traces, shaft, window lights, sky,
   * practicals) lives in one owned group and is disposed on stop/skip/replay. */
  function mountVisuals(): void {
    if (visuals) return;
    visuals = createPrologueVisuals();
    scene.add(visuals.root);
    visuals.update(0);
  }

  function disposeVisuals(): void {
    if (!visuals) return;
    visuals.dispose();
    visuals = null;
  }

  /** The camera flies through the closed B4 entrance, so the authored leaves are
   * opened for the take and closed again when the cinematic stops. */
  function openDoors(): void {
    if (doorsOpened) return;
    doorLeaves = findB4DoorLeaves(scene);
    if (!doorLeaves.length) return;
    setB4DoorLeaves(doorLeaves, 1);
    doorsOpened = true;
  }

  function closeDoors(): void {
    if (!doorsOpened) return;
    setB4DoorLeaves(doorLeaves, 0);
    doorsOpened = false;
    doorLeaves = [];
  }

  /** Seconds since the base captured at begin(). The base never changes inside a
   * run: when the tab goes hidden the context suspends and this freezes (and
   * `onHidden` ends the run) instead of jumping by the hidden wall time. */
  function runClock(): number {
    if (externalClock) return externalClock();
    const context = audio.context;
    return useAudio && context ? context.currentTime - audioBase : performance.now() / 1000 - perfBase;
  }

  async function decodeNarration(): Promise<void> {
    const run = generation;
    const context = audio.context;
    if (!context) { if (run === generation) silent = true; return; }
    const abort = new AbortController();
    decodeRun = abort;
    await Promise.all(PROLOGUE_LINES.map(async line => {
      const url = PROLOGUE_URLS[line.id];
      if (!url) { if (run === generation) silent = true; return; }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const response = await Promise.race([
          fetch(url, {signal: abort.signal}),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { abort.abort(); reject(new Error('audio_timeout')); }, 10000);
          }),
        ]);
        // A stop()/replay bumps the generation and aborts the fetches; a decode
        // already in flight cannot be aborted, so every resume checks the run.
        if (run !== generation) return;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        if (run !== generation) return;
        const buffer = await context.decodeAudioData(data);
        if (run !== generation) return;
        buffers.set(line.id, buffer);
      } catch { if (run === generation) silent = true; }
      finally { clearTimeout(timer); }
    }));
    if (decodeRun === abort) decodeRun = null;
    if (run !== generation) return;
    // A partial decode is treated as no narration: the visuals run silently
    // rather than half a story beat behind.
    if (silent) buffers.clear();
  }

  async function begin(): Promise<void> {
    if (phase !== 'gate') return;
    const run = generation;
    phase = 'starting';
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    if (gate) gate.hidden = true;
    if (frame) frame.hidden = false;
    // `start()` creates the context synchronously, so the five narration clips
    // can decode while it finishes loading the rest of the audio pack. Both
    // settle before the clock starts; the first line then starts with the clock.
    const started = audio.start();
    const narration = decodeNarration();
    try { await started; } catch {}
    if (run !== generation || phase !== 'starting') return;
    await narration;
    if (run !== generation || phase !== 'starting') return;
    // A suspended or refused context cannot play the recording: use the same
    // NOTICE the decode failures show instead of running silently (N2).
    if (audio.context?.state !== 'running') { silent = true; buffers.clear(); }
    phase = 'running';
    useAudio = audio.context?.state === 'running';
    audioBase = audio.context?.currentTime ?? 0;
    perfBase = performance.now() / 1000;
    origin = runClock();
    lastT = seekDelta;
    if (silent) noticeUntil = lastT + 2.4;
  }

  function skip(): void {
    stop();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const enter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
    const space = event.key === ' ' || event.code === 'Space';
    const escape = event.key === 'Escape' || event.code === 'Escape';
    if (phase === 'gate' && (enter || space)) {
      event.preventDefault();
      event.stopPropagation();
      void begin();
      return;
    }
    if ((phase === 'starting' || phase === 'running') && (enter || escape)) {
      event.preventDefault();
      event.stopPropagation();
      skip();
      return;
    }
    // The controller acts on these before its paused guard (E/C/digits/F and the
    // movement keys), so the cinematic swallows their propagation while it owns
    // the screen. Outputs only: focus and button defaults still work (review M2).
    if ((phase === 'gate' || phase === 'starting' || phase === 'running') && GAME_CODES.has(event.code)) event.stopPropagation();
  }

  /** The only frame callback: it runs after the explorer's update, so the
   * cinematic camera wins the frame while control is paused. */
  function update(): void {
    if (phase !== 'starting' && phase !== 'running') return;
    captureSpawn();
    const t = phase === 'running' ? Math.max(0, runClock() - origin + seekDelta) : lastT;
    lastT = t;
    applyShot(t);
    visuals?.update(t);
    updateSubtitle(t);
    if (endcard) endcard.hidden = t < PROLOGUE_TOTAL;
    if (phase === 'running') {
      updateVoices(t);
      if (t >= PROLOGUE_TOTAL + END_HOLD) stop();
    }
  }

  function mount(): void {
    const root = document.createElement('div');
    root.id = 'prologue';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Prologue');
    root.innerHTML = MARKUP;
    document.body.append(root);
    overlay = root;
    gate = root.querySelector<HTMLDivElement>('.prologue-gate');
    frame = root.querySelector<HTMLDivElement>('.prologue-frame');
    subtitle = root.querySelector<HTMLParagraphElement>('.prologue-subtitle');
    endcard = root.querySelector<HTMLDivElement>('.prologue-endcard');
    if (frame) frame.hidden = true;
    if (endcard) endcard.hidden = true;
    root.querySelector<HTMLButtonElement>('.prologue-begin')?.addEventListener('click', () => { void begin(); });
    root.querySelector<HTMLButtonElement>('.prologue-skip')?.addEventListener('click', skip);
  }

  function enterPrologue(): void {
    document.body.classList.add('prologue-active');
    explorer.pause('prologue');
    if (!fovSaved) { previousFov = explorer.camera.fov; fovSaved = true; }
    explorer.camera.fov = FOV;
    explorer.camera.updateProjectionMatrix();
    atmosphere?.enterDusk();
    openDoors();
    mountVisuals();
    if (!registered) { viewer.beforeRender.add(update); registered = true; }
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onHidden);
  }

  /** A hidden tab suspends the audio context. End the run rather than resume a
   * cinematic whose clock froze: the player comes back to the pause card and can
   * replay it (review M6). */
  function onHidden(): void {
    if (document.hidden) stop();
  }

  function reset(): void {
    generation++;
    stopVoices();
    buffers.clear();
    disposeVisuals();
    closeDoors();
    atmosphere?.endDusk();
    phase = 'idle';
    promise = null;
    resolvePlay = null;
    origin = 0;
    seekDelta = 0;
    lastT = 0;
    nextLine = 0;
    activeLine = -1;
    silent = false;
    noticeUntil = -1;
    spawnPosition = null;
    spawnLook = null;
    finalQuaternion = null;
    waypoints = [];
    positionCurve = null;
    lookCurve = null;
    windows = [];
  }

  /** Idempotent and safe before `play()`. Removes the overlay, callback and
   * listeners, restores the FOV, stops voices and the body class. The game is
   * deliberately left paused so the player presses Continue. */
  function stop(): void {
    if (phase === 'idle' || phase === 'done') return;
    generation++;
    phase = 'done';
    decodeRun?.abort();
    decodeRun = null;
    stopVoices();
    buffers.clear();
    disposeVisuals();
    closeDoors();
    atmosphere?.endDusk();
    if (registered) { viewer.beforeRender.delete(update); registered = false; }
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('visibilitychange', onHidden);
    if (fovSaved) { explorer.camera.fov = previousFov; fovSaved = false; explorer.camera.updateProjectionMatrix(); }
    if (overlay) {
      overlay.remove();
      overlay = null;
      gate = null;
      frame = null;
      subtitle = null;
      endcard = null;
    }
    document.body.classList.remove('prologue-active');
    activeLine = -1;
    noticeUntil = -1;
    const resolve = resolvePlay;
    resolvePlay = null;
    resolve?.();
  }

  /** Final teardown: stop() plus releasing the decoded narration buffers. */
  function dispose(): void {
    stop();
    buffers.clear();
  }

  function play(): Promise<void> {
    if (phase === 'gate' || phase === 'starting' || phase === 'running') return promise ?? Promise.resolve();
    reset();
    phase = 'gate';
    mount();
    enterPrologue();
    promise = new Promise<void>(resolve => { resolvePlay = resolve; });
    return promise;
  }

  function seek(seconds: number): void {
    const target = T.MathUtils.clamp(Number.isFinite(seconds) ? seconds : 0, 0, PROLOGUE_TOTAL + END_HOLD);
    seekDelta = target;
    lastT = target;
    if (phase === 'running') origin = runClock();
    stopVoices();
    const inside = PROLOGUE_LINES.findIndex(line => target >= line.start && target <= line.end);
    nextLine = inside >= 0 ? inside + 1 : PROLOGUE_LINES.findIndex(line => line.start > target);
    if (nextLine < 0) nextLine = PROLOGUE_LINES.length;
    if (phase !== 'running') return;
    if (inside >= 0) playLine(inside);
    updateSubtitle(target);
    if (endcard) endcard.hidden = target < PROLOGUE_TOTAL;
    captureSpawn();
    applyShot(target);
    visuals?.update(target);
  }

  function state(): {t: number; line: number; shot: number} {
    const t = phase === 'running' ? Math.max(0, runClock() - origin + seekDelta) : lastT;
    return {
      t,
      line: PROLOGUE_LINES.findIndex(line => t >= line.start && t <= line.end),
      shot: windows.length ? shotIndex(t) : 0,
    };
  }

  return {
    get active() { return phase === 'gate' || phase === 'starting' || phase === 'running'; },
    play,
    stop,
    dispose,
    debug: {
      seek,
      state,
      waypoints: () => waypoints.map((waypoint) => ({t: waypoint.t, position: [...waypoint.position] as [number, number, number]})),
    },
  };
}
