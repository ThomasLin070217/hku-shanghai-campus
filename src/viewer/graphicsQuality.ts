import {useTouchControls} from '../opening/touchInput';

export type GraphicsQuality = 'auto' | 'low';

const storageKey = 'hku.campus.graphics-quality.v1';

/** Gameplay framebuffer cap. Screenshots/GLB exports use their own fixed resolution and
 * are never scaled by the governor below. */
export const MAX_PIXEL_RATIO = 1.5;

/** Quality for a device when the player has made no explicit choice.
 *
 * An explicit `?quality=` override wins; then a stored `low`; then a touch
 * device whose shortest screen side is at most 900 px starts low. Everything
 * else keeps the desktop default. */
export function defaultGraphicsQuality(input: {override: string | null; stored: string | null; touch: boolean; shortestSide: number}): GraphicsQuality {
  if (input.override === 'auto' || input.override === 'low') return input.override;
  if (input.stored === 'low') return 'low';
  if (input.touch && input.shortestSide <= 900) return 'low';
  return 'auto';
}

function touchDevice() {
  if (typeof matchMedia !== 'function' || typeof navigator === 'undefined') return false;
  return useTouchControls({
    anyCoarse: matchMedia('(any-pointer: coarse)').matches,
    maxTouchPoints: navigator.maxTouchPoints,
    hoverNone: matchMedia('(hover: none)').matches,
  });
}

export function getGraphicsQuality(): GraphicsQuality {
  const override = new URLSearchParams(location.search).get('quality');
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey); }
  catch { /* Storage can be unavailable; the URL override still applies. */ }
  return defaultGraphicsQuality({
    override,
    stored,
    touch: touchDevice(),
    shortestSide: Math.min(screen.width, screen.height),
  });
}

export function setGraphicsQuality(quality: GraphicsQuality) {
  try { localStorage.setItem(storageKey, quality); }
  catch { /* Menu links also carry the choice when storage is unavailable. */ }
}

export function graphicsPixelRatio(
  quality: GraphicsQuality, width: number, height: number, screenRatio: number, maxRatio: number,
) {
  const low = quality === 'low';
  const pixelBudget = low ? 1280 * 720 : 2048 * 1280;
  return Math.min(screenRatio, low ? 0.8 : maxRatio, Math.sqrt(pixelBudget / (width * height)));
}

/** Steps applied on top of the capped device pixel ratio. Each step is multiplied into
 * the ratio; geometry, lighting and physics are untouched. */
export const RESOLUTION_STEPS = [1, .85, .72, .6] as const;
const MIN_RATIO = .5;

export interface ResolutionGovernor {
  /** Multiplier for the device pixel ratio. 1 = full quality. */
  readonly scale: number;
  /** Current step index into RESOLUTION_STEPS. */
  readonly step: number;
  /** Smoothed frame time in milliseconds; 0 until enough frames were sampled. */
  readonly frameMs: number;
  /** Feed one continuously rendered frame. Returns true when the scale changed. */
  sample(frameMs: number): boolean;
  reset(): void;
}

/** Adaptive resolution for sustained slow frames.
 *
 * The threshold is relative to this device's own fast-frame floor (the display refresh
 * interval in practice), so a 60 Hz and a 120 Hz screen both behave sensibly: we only
 * step down after the smoothed frame time stays ~40% above the best frame seen, and we
 * only step back up when it returns close to that floor for several seconds. Simulation
 * timing is never touched — only the render target resolution.
 */
export function createResolutionGovernor(steps: readonly number[] = RESOLUTION_STEPS): ResolutionGovernor {
  let index = 0, ema = 0;
  // Reference cadence. Seeded at 60 Hz and only ever lowered when faster frames are
  // actually seen, so a machine that is slow from the first frame cannot raise its own
  // bar and escape adaptation.
  let floorMs = 1000 / 60;
  let warmup = 45, settle = 0, slowFor = 0, fastFor = 0, restores = 0;
  return {
    get scale() { return Math.max(MIN_RATIO, steps[index]); },
    get step() { return index; },
    get frameMs() { return ema; },
    sample(frameMs: number) {
      // Ignore tab-restore stalls, context loss and shader-compile hitches.
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return false;
      if (warmup > 0) { warmup--; if (warmup === 0) ema = frameMs; return false; }
      ema = ema ? ema * .9 + frameMs * .1 : frameMs;
      if (ema < floorMs) floorMs = ema;
      if (settle > 0) { settle -= frameMs; return false; }
      const slow = Math.max(19, floorMs * 1.4);
      const fast = Math.max(11, floorMs * 1.12);
      let next = index;
      if (ema > slow) { slowFor += frameMs; fastFor = 0; if (slowFor >= 1500) next = Math.min(steps.length - 1, index + 1); }
      else if (ema < fast) { fastFor += frameMs; slowFor = 0; if (fastFor >= 4000 * Math.min(2, 2 ** restores)) next = Math.max(0, index - 1); }
      else { slowFor = 0; fastFor = 0; }
      if (next === index) return false;
      // Every restore doubles the evidence required for the next one, so a borderline
      // machine cannot oscillate between two steps forever.
      if (next < index) restores++;
      index = next; slowFor = 0; fastFor = 0; settle = 750; ema = 0;
      return true;
    },
    reset() { index = 0; ema = 0; floorMs = 1000 / 60; warmup = 45; settle = 0; slowFor = 0; fastFor = 0; restores = 0; },
  };
}
