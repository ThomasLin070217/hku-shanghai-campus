/**
 * Fullscreen: one button in the game, one tap to enter, Alt+Enter on the keyboard.
 * The device rules live in `fullscreenPlan.ts` (pure, headless-checked); this file
 * is the DOM half — the button, the hint and the state sync.
 */
import './fullscreen.css';
import {FULLSCREEN_HINT, fullscreenLabel, fullscreenPlan} from './fullscreenPlan';

export {FULLSCREEN_HINT, fullscreenLabel, fullscreenPlan} from './fullscreenPlan';
export type {FullscreenPlan} from './fullscreenPlan';

const HINT_KEY = 'fullscreen-hint.v1';

/** The expand / contract icon. Inline so the button needs no asset request. */
function icon(active: boolean): string {
  const path = active
    ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'
    : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};
type FsElement = HTMLElement & {webkitRequestFullscreen?: () => Promise<void> | void};

export interface FullscreenControl {
  /** True when the device has a usable Fullscreen API (the button toggles it). */
  readonly api: boolean;
  /** True when the Add to Home Screen hint applies (and was not dismissed). */
  readonly hint: boolean;
  /** Re-read the browser state after an external change (tests, F11, Esc). */
  sync(): void;
  /** Enter or leave fullscreen. A no-op where the API is unavailable. */
  toggle(): Promise<void>;
  dispose(): void;
}

export function createFullscreenControl(options: {
  stage: HTMLElement;
  touch: boolean;
  /** Called on fullscreenchange, rotation and visualViewport resize. */
  onViewportChange?: () => void;
}): FullscreenControl {
  const doc = document as FsDocument;
  const root = document.documentElement as FsElement;
  const standalone =
    (navigator as Navigator & {standalone?: boolean}).standalone === true ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
  const plan = fullscreenPlan({
    fullscreenEnabled: doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false,
    requestAvailable:
      typeof root.requestFullscreen === 'function' ||
      typeof root.webkitRequestFullscreen === 'function',
    standalone,
    touch: options.touch,
  });

  const events = new AbortController();
  const signal = events.signal;
  const active = () => !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem(HINT_KEY) === '1';
  } catch {
    /* Private mode: the hint simply shows again next time. */
  }

  let button: HTMLButtonElement | null = null;
  let hint: HTMLElement | null = null;

  function sync(): void {
    if (!button) return;
    const on = active();
    button.innerHTML = icon(on);
    button.setAttribute('aria-label', fullscreenLabel(on));
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('is-active', on);
    button.title = fullscreenLabel(on);
  }

  async function toggle(): Promise<void> {
    if (!plan.api) return;
    try {
      if (active()) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else {
        const request =
          root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
        await request?.();
      }
    } catch {
      /* A refused request leaves the game playable; the button keeps its state. */
    }
    sync();
  }

  // Only an API that can actually go fullscreen gets a button. Without one the
  // control is the hint: a dead expand icon on an iPhone would be worse than
  // no icon at all. `plan.button` says a control exists, not that it toggles.
  if (plan.api) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'fullscreen-toggle';
    button.innerHTML = icon(false);
    button.setAttribute('aria-label', fullscreenLabel(false));
    button.setAttribute('aria-pressed', 'false');
    button.title = fullscreenLabel(false);
    button.addEventListener('click', () => void toggle());
    options.stage.append(button);
  }

  if (plan.hint && !dismissed) {
    hint = document.createElement('div');
    hint.className = 'fullscreen-hint';
    hint.setAttribute('role', 'note');
    const text = document.createElement('span');
    text.textContent = FULLSCREEN_HINT;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.addEventListener('click', () => {
      try {
        sessionStorage.setItem(HINT_KEY, '1');
      } catch {
        /* The hint is cosmetic; losing the dismissal is acceptable. */
      }
      hint?.remove();
      hint = null;
    });
    hint.append(text, close);
    options.stage.append(hint);
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (!plan.api) return;
      if (event.defaultPrevented || event.isComposing) return;
      if (!event.altKey || event.code !== 'Enter') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input,select,textarea,[contenteditable="true"],dialog')) return;
      event.preventDefault();
      void toggle();
    },
    {signal},
  );

  const changed = () => {
    sync();
    options.onViewportChange?.();
  };
  document.addEventListener('fullscreenchange', changed, {signal});
  document.addEventListener('webkitfullscreenchange', changed, {signal});
  window.addEventListener('orientationchange', changed, {signal});
  window.visualViewport?.addEventListener('resize', changed, {signal});

  sync();

  return {
    get api() {
      return plan.api;
    },
    get hint() {
      return !!hint;
    },
    sync,
    toggle,
    dispose() {
      events.abort();
      button?.remove();
      button = null;
      hint?.remove();
      hint = null;
    },
  };
}
