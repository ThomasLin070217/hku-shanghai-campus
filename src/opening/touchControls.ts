/**
 * The on-screen gamepad for phones and tablets.
 *
 * The mobile shell plan (`docs/plans/2026-11-23-mobile-shell.md`, Task 3) designed
 * this layer; only the pure mapping and the controller hooks shipped, so until
 * 2026-11-25 a phone could look around but had no way to walk. This module is the
 * missing half: a left stick that drives `explorer.touchMove`, a RUN toggle, and
 * USE / JUMP / BAG / MENU buttons that dispatch the same synthetic key events the
 * keyboard produces, so every action keeps one code path.
 *
 * The layer only mounts when `explorer.touchPreferred()` is true; the CSS hides
 * it until `body.exploring`, and `body.touch-mode` lets the HUD move out of its
 * way. Desktop play never constructs it.
 */
import './touch.css';
import {joystickAxes} from './touchInput';

export interface TouchExplorer {
  touchPreferred(): boolean;
  touchMove(forward: number, right: number): void;
  touchRun(on: boolean): void;
  readonly state?: {touchSprint?: boolean};
}

/** The stick's travel radius in CSS pixels; the ring is twice this plus the knob. */
const STICK_RADIUS = 54;

const KEYS: Record<string, {code: string; key: string}> = {
  jump: {code: 'Space', key: ' '},
  bag: {code: 'KeyE', key: 'e'},
  interact: {code: 'KeyF', key: 'f'},
  menu: {code: 'Escape', key: 'Escape'},
  computer: {code: 'KeyC', key: 'c'},
};

/** The same keydown/keyup pair a keyboard produces, so every listener sees it. */
function press(code: string, key: string): void {
  for (const type of ['keydown', 'keyup'] as const) {
    window.dispatchEvent(new KeyboardEvent(type, {code, key, bubbles: true, cancelable: true}));
  }
}

/** The keyboard-only copy a phone should not read. Rewrites only known tokens. */
export function touchCopy(text: string): string {
  return text
    .replace(/Press F\b/g, 'Tap USE')
    .replace(/\bEsc\b/g, 'MENU')
    .replace(/Arrows look/g, 'drag to look')
    // The MacBook key is the phone's MAC button. Without these, the phone is
    // told to press C — a key it does not have — at the one beat that cannot
    // be skipped (objective: "Open the MacBook").
    .replace(/Press C\b/g, 'Tap MAC')
    .replace(/\bC · /g, 'MAC · ')
    .replace(/\bC to open\b/g, 'MAC to open');
}

export interface TouchControls {
  root: HTMLElement;
  dispose(): void;
}

export function createTouchControls(explorer: TouchExplorer): TouchControls | null {
  if (!explorer.touchPreferred()) return null;
  const events = new AbortController();
  const signal = events.signal;

  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.setAttribute('aria-label', 'Touch controls');

  const stick = document.createElement('div');
  stick.className = 'touch-stick';
  stick.setAttribute('role', 'presentation');
  const knob = document.createElement('div');
  knob.className = 'touch-knob';
  stick.append(knob);

  const actions = document.createElement('div');
  actions.className = 'touch-actions';
  const buttons: Record<string, HTMLButtonElement> = {};
  for (const [name, label] of [
    ['run', 'RUN'],
    ['jump', 'JUMP'],
    ['bag', 'BAG'],
    ['interact', 'USE'],
    ['menu', 'MENU'],
    // The grid's last free cell (row 3, column 1). On desktop `C` opens the
    // presentation MacBook; without this the phone player reaches "Open the
    // MacBook" and has no control that sends the key.
    ['computer', 'MAC'],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'touch-button';
    button.dataset.touch = name;
    button.textContent = label;
    if (name === 'run') button.setAttribute('aria-pressed', 'false');
    actions.append(button);
    buttons[name] = button;
  }

  const guide = document.createElement('p');
  guide.className = 'touch-guide';
  guide.textContent = 'Left stick walk · drag to look';

  const rotate = document.createElement('div');
  rotate.className = 'touch-rotate';
  rotate.hidden = true;
  const rotateText = document.createElement('span');
  rotateText.textContent = 'Rotate to landscape for the full view';
  const rotateClose = document.createElement('button');
  rotateClose.type = 'button';
  rotateClose.textContent = 'Dismiss';
  rotate.append(rotateText, rotateClose);

  root.append(stick, actions, guide, rotate);

  // ------------------------------------------------------------------ Stick.
  let pointer = -1;
  let centreX = 0;
  let centreY = 0;
  let forward = 0;
  let right = 0;
  let frame = 0;

  function setKnob(dx: number, dy: number): void {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function apply(clientX: number, clientY: number): void {
    let dx = clientX - centreX;
    let dy = clientY - centreY;
    const distance = Math.hypot(dx, dy);
    if (distance > STICK_RADIUS) {
      dx = (dx / distance) * STICK_RADIUS;
      dy = (dy / distance) * STICK_RADIUS;
    }
    setKnob(dx, dy);
    const axes = joystickAxes(dx, dy, STICK_RADIUS);
    forward = axes.forward;
    right = axes.right;
    explorer.touchMove(forward, right);
  }

  function hold(): void {
    cancelAnimationFrame(frame);
    const step = () => {
      if (pointer < 0) return;
      // Any `clear()` (pause, inventory, focus) zeroes the axes; a still hold must
      // keep walking, so the stick re-sends its last deflection every frame.
      explorer.touchMove(forward, right);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  function release(): void {
    pointer = -1;
    cancelAnimationFrame(frame);
    setKnob(0, 0);
    forward = 0;
    right = 0;
    stick.classList.remove('is-active');
    explorer.touchMove(0, 0);
  }

  stick.addEventListener(
    'pointerdown',
    (event) => {
      if (pointer >= 0 || event.button !== 0) return;
      pointer = event.pointerId;
      const box = stick.getBoundingClientRect();
      centreX = box.left + box.width / 2;
      centreY = box.top + box.height / 2;
      stick.setPointerCapture(pointer);
      stick.classList.add('is-active');
      apply(event.clientX, event.clientY);
      hold();
      event.preventDefault();
    },
    {signal},
  );
  stick.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== pointer) return;
      apply(event.clientX, event.clientY);
      event.preventDefault();
    },
    {signal},
  );
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    stick.addEventListener(
      type,
      (event) => {
        if (type === 'lostpointercapture' || event.pointerId === pointer) release();
      },
      {signal},
    );
  }

  // ----------------------------------------------------------------- Buttons.
  let running = false;
  function setRunning(on: boolean): void {
    running = on;
    buttons.run?.setAttribute('aria-pressed', String(on));
    buttons.run?.classList.toggle('is-on', on);
  }

  // A tap is handled on `pointerdown`, not on the synthesized `click`.
  // Owner report, 2026-11-26: on a phone, after dragging a slider, tapping JUMP
  // did nothing. Every slider in this game is an <input type="range">; while a
  // drag on one is being arbitrated, the browser withholds synthesized clicks,
  // and a click-bound button stays dead until the gesture settles. Pointer
  // events are delivered per touch and are never withheld, so the button answers
  // the instant the finger lands — including while another finger holds a slider.
  // `click` stays bound for keyboard and assistive activation: those come with
  // detail 0 and no preceding pointerdown, while a real tap carries detail >= 1.
  const onTap = (element: HTMLElement | null | undefined, act: () => void): void => {
    element?.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        act();
      },
      {signal},
    );
    element?.addEventListener(
      'click',
      (event) => {
        if (event.detail === 0) act();
      },
      {signal},
    );
  };
  onTap(buttons.run, () => {
    setRunning(!running);
    explorer.touchRun(running);
  });
  for (const name of ['jump', 'bag', 'interact', 'menu', 'computer'] as const) {
    onTap(buttons[name], () => {
      const key = KEYS[name]!;
      press(key.code, key.key);
    });
  }

  /** A pause or a focus change clears the sprint intent; the button must follow. */
  function syncRun(): void {
    const state = explorer.state;
    if (typeof state?.touchSprint === 'boolean' && state.touchSprint !== running) {
      setRunning(state.touchSprint);
    }
  }
  document.addEventListener('pointerdown', syncRun, {capture: true, signal});
  document.addEventListener('focusin', syncRun, {signal});

  // --------------------------------------------------------- Campaign focus.
  const interact = buttons.interact!;
  function syncFocus(): void {
    const focused = document.body.hasAttribute('data-campaign-focus');
    interact.textContent = focused ? 'BACK' : 'USE';
  }
  const focusObserver = new MutationObserver(syncFocus);
  focusObserver.observe(document.body, {attributes: true, attributeFilter: ['data-campaign-focus']});
  syncFocus();

  // ------------------------------------------------------- Portrait rotate.
  let rotateDismissed = false;
  const portrait = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;
  function syncRotate(): void {
    rotate.hidden = rotateDismissed || !portrait?.matches;
  }
  rotateClose.addEventListener(
    'click',
    () => {
      rotateDismissed = true;
      syncRotate();
    },
    {signal},
  );
  portrait?.addEventListener('change', syncRotate, {signal});
  syncRotate();

  // ------------------------------------------------------- Copy for touch.
  function rewriteCopy(): void {
    for (const selector of [
      '.opening-objective',
      '.opening-prompt-text',
      '.stage-bottom > span',
    ]) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) continue;
      const before = element.textContent ?? '';
      const after = touchCopy(before);
      if (after !== before) element.textContent = after;
    }
    // The assistant's replies are markdown-rendered nodes, not one text element, so the
    // selectors above cannot reach them: a phone asking the Harness where the MacBook is
    // was told "Press C to open it" while its only control says MAC (W-03). Rewrite each
    // text node in place; `touchCopy` is idempotent, so the observer's second pass is a
    // no-op and cannot loop.
    const bodies = document.querySelectorAll<HTMLElement>('.ai-message-body');
    for (let index = 0; index < bodies.length; index++) {
      const walker = document.createTreeWalker(bodies[index]!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const before = node.nodeValue ?? '';
        const after = touchCopy(before);
        if (after !== before) node.nodeValue = after;
      }
    }
  }
  const copyObserver = new MutationObserver(rewriteCopy);
  copyObserver.observe(document.body, {subtree: true, childList: true, characterData: true});
  rewriteCopy();

  return {
    root,
    dispose() {
      events.abort();
      cancelAnimationFrame(frame);
      focusObserver.disconnect();
      copyObserver.disconnect();
      root.remove();
    },
  };
}
