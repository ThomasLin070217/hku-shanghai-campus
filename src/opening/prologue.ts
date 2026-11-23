/**
 * BARRIER 2030 prologue: the 30-second skippable in-engine cinematic that plays
 * before the player first takes control. The gate mounts on `play()`; the clock
 * starts after the BEGIN click has resumed the audio context and the audio pack
 * has loaded, and the first line starts with the clock. The camera is driven
 * from `viewer.beforeRender`, which runs after the explorer's own update.
 */
import * as T from 'three';
import type {CampusAudio} from '../gameplay/audio';
import {PROLOGUE_LINES,PROLOGUE_TOTAL,PROLOGUE_URLS} from './prologueVoice';
import './prologue.css';

export interface PrologueOptions {
  viewer: {beforeRender: Set<(dt: number) => void>};
  explorer: {camera: T.PerspectiveCamera; pause(reason: string): void; game: {paused: boolean}};
  audio: CampusAudio;
  bounds: () => T.Box3;
  clock?: () => number;
}

export interface PrologueDebug {
  seek(seconds: number): void;
  state(): {t: number; line: number; shot: number};
}

export interface Prologue {
  readonly active: boolean;
  play(): Promise<void>;
  stop(): void;
  dispose(): void;
  debug: PrologueDebug;
}

type Pose = {position: T.Vector3; look: T.Vector3};
type ShotWindow = {start: number; end: number};
type VoiceHandle = {stop(): void};
type Phase = 'idle' | 'gate' | 'starting' | 'running' | 'done';

const FOV = 52;
const VOICE_GAIN = 0.9;
const DRIFT = 0.02;
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
const MARKUP = `<div class="prologue-gate"><h1>BARRIER 2030</h1><p>A CDS campus story</p><button class="prologue-begin" type="button">BEGIN</button></div>
<div class="prologue-frame"><div class="prologue-bar top"></div><div class="prologue-bar bottom"></div><p class="prologue-subtitle" aria-live="polite"></p><button class="prologue-skip" type="button">Skip</button></div>
<div class="prologue-endcard" hidden><p>RESTORE THE TOWERS</p><p>FREE THE STUDENTS</p></div>`;

export function createPrologue(options: PrologueOptions): Prologue {
  const {viewer, explorer, audio, bounds} = options;
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
  let worldSpan = 100;
  let spawnPosition: T.Vector3 | null = null;
  let spawnLook: T.Vector3 | null = null;
  let shots: Pose[] = [];
  let windows: ShotWindow[] = [];
  const buffers = new Map<string, AudioBuffer>();
  const voices = new Set<VoiceHandle>();

  /** The player's spawn pose is captured from the explorer on the first frame,
   * never at creation, so the cinematic lands exactly where control resumes. */
  function captureSpawn(): void {
    if (spawnPosition) return;
    spawnPosition = explorer.camera.position.clone();
    spawnLook = spawnPosition.clone().add(new T.Vector3(0, 0, -1).applyQuaternion(explorer.camera.quaternion).multiplyScalar(12));
    buildShots();
  }

  /** Shot poses and windows come from the campus bounds (buildings only) and the
   * narration timeline. E is the spawn pose; its window is the last line. */
  function buildShots(): void {
    const box = bounds();
    const centre = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    worldSpan = T.MathUtils.clamp(Math.max(size.x, size.y, size.z), 70, 220);
    const at = (x: number, y: number, z: number) => centre.clone().add(new T.Vector3(x * worldSpan, y * worldSpan, z * worldSpan));
    shots = [
      {position: at(0.62, 0.42, 0.75), look: at(0, 0.05, 0)},
      {position: at(-0.55, 0.34, 0.52), look: at(0.15, 0.02, 0)},
      {position: at(0.1, 0.1, 0.42), look: at(0, 0.03, -0.1)},
      {position: at(0.16, 0.08, 0.3), look: at(0, 0.06, 0)},
      {position: spawnPosition!, look: spawnLook!},
    ];
    windows = PROLOGUE_LINES.map((line, index) => ({
      start: line.start,
      end: index + 1 < PROLOGUE_LINES.length ? PROLOGUE_LINES[index + 1].start : PROLOGUE_TOTAL,
    }));
  }

  function shotIndex(t: number): number {
    for (let index = windows.length - 1; index >= 0; index--) if (t >= windows[index].start) return index;
    return 0;
  }

  /** Smoothstep inside the current window, from the previous shot to this one,
   * plus a slow span-scaled drift so no shot is frozen. Reduced motion uses
   * linear interpolation and no drift. */
  function applyShot(t: number): void {
    if (!shots.length || !windows.length) return;
    const index = shotIndex(t);
    const window = windows[index];
    const from = shots[Math.max(0, index - 1)];
    const to = shots[index];
    const span = Math.max(1e-6, window.end - window.start);
    const u = T.MathUtils.clamp((t - window.start) / span, 0, 1);
    const eased = reduced?.matches ? u : u * u * (3 - 2 * u);
    const position = from.position.clone().lerp(to.position, eased);
    const look = from.look.clone().lerp(to.look, eased);
    if (!reduced?.matches) {
      // The last window fades its drift out so the final frame is exactly the
      // spawn pose and taking control does not jump the camera.
      const drift = DRIFT * worldSpan * (index === windows.length - 1 ? 1 - eased : 1);
      position.x += Math.sin(t * 0.21) * drift;
      position.z += Math.cos(t * 0.17) * drift;
    }
    const camera = explorer.camera;
    camera.position.copy(position);
    camera.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(position, look, UP));
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

  function playLine(index: number): void {
    if (silent) return;
    const line = PROLOGUE_LINES[index];
    const buffer = buffers.get(line.id);
    if (!buffer) return;
    let handle: VoiceHandle | null = null;
    handle = audio.playVoice(buffer, {gain: VOICE_GAIN, onended: () => { if (handle) voices.delete(handle); }});
    if (handle) voices.add(handle);
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
    worldSpan = 100;
    spawnPosition = null;
    spawnLook = null;
    shots = [];
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
    applyShot(target);
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
    debug: {seek, state},
  };
}
