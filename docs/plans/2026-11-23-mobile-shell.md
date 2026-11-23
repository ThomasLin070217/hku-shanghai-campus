# Mobile player shell — plan (2026-11-23)

## Goal

The opening and the whole campaign are playable on a phone or tablet with touch
input, readable at phone width, and bounded in GPU cost. Desktop play is
unchanged.

## Scope

In scope:

- Touch movement (analog stick), drag-to-look, jump, interact, run, backpack,
  menu.
- Compat input on touch devices instead of pointer lock.
- Responsive HUD, prompt, hotbar, pause card and safe-area handling.
- Portrait rotate hint (dismissible, non-blocking).
- Tougher default pixel-ratio cap and quality on coarse-pointer devices.
- A node check for the pure input/quality logic, and a Playwright mobile gate.

Out of scope:

- New gameplay, new chapter content, controller/gamepad support.
- Changing desktop key bindings or camera feel.
- A native app shell or offline install.

## Constraints

- Keep the desktop path byte-identical in behaviour: no pointer-lock changes on
  fine-pointer devices, no HUD resizing above the coarse-pointer breakpoint.
- No runtime model edits; scene geometry is untouched.
- Touch controls must route through the same game input owners as the keyboard:
  the campaign's interact handler, B4 keyboard focus, inventory and pause.
- The existing resolution governor stays; only the cap and default quality are
  added on coarse pointers.
- All values below are binding. New copy is English.

## Design

### Detection

`useTouchControls({coarsePointer, maxTouchPoints, hoverNone})` returns true when
the primary pointer is coarse, or the device reports touch points and no hover.
Call sites pass `(pointer: coarse)`, never `(any-pointer: coarse)`: the latter is
true on every touchscreen laptop even with a trackpad attached, which would take
pointer lock away from hybrid laptops. A touch laptop with a mouse therefore
keeps the desktop path; a phone and a tablet get the touch controls.

### Input mapping

| Control | Mechanism |
|---|---|
| Left stick | `explorer.touchMove(forward, right)` — analog, unit-clamped, 0.16 dead zone |
| Drag on the canvas | Existing compat drag-look; touch pointer deltas × 2.4 |
| USE | Synthetic `keydown` `KeyF` — the same path as the keyboard |
| JUMP | Synthetic `keydown` `Space` |
| RUN | `explorer.touchRun(on)` toggle |
| BAG | Synthetic `keydown` `KeyE` |
| MENU | Synthetic `keydown` `Escape` |

Synthetic events are dispatched on `window`, bubbling and cancelable, with the
real `code` and `key`. This keeps B4 focus (`F`/`Escape` leave), the campaign
interact route and the inventory on one code path.

### Touch entry

`explorer.enter()` checks touch detection. On touch it does what
`enterCompat()` does — takeover, `compat = true`, unpause, clear, focus the
canvas — and never requests pointer lock. Pause/resume, chapter transitions and
the pause-card Continue button all end in `enter()` or `enterCompat()`, so they
pick this up.

### Layout

- Stick: 132 px box, ring 108 px, knob 48 px, bottom-left with safe-area inset.
- Action cluster: two columns of 56 px buttons, bottom-right, safe-area inset.
- HUD: 250 px wide at 10 px from the safe-area top-left; objective 15 px.
- Minimap card and keyboard-only hints are hidden on touch.
- Prompt rises above the controls (`bottom: 168px + safe inset`), wraps.
- Hotbar sits at the bottom centre with 32 px slots; in portrait it moves above
  the controls.
- Pause card: `min(420px, 92vw)`, scrolls, 48 px buttons, key guide replaced by a
  touch guide line.
- Portrait: one dismissible pill, "Rotate to landscape for the full view".
- B4 focus (`body[data-campaign-focus]`): stick, jump, run and bag hide; USE and
  MENU remain and step back.

### Performance

- `TOUCH_MAX_PIXEL_RATIO = 1.15` caps the renderer on coarse pointers.
- Default quality on a coarse pointer with shortest screen side ≤ 900 px is
  `low` (no shadows, 720p budget) unless `?quality=auto` is explicit. A stored
  user choice still wins.
- The adaptive resolution governor is unchanged.

## Tasks

### Task 1 — pure input and quality primitives, with a check

Create `src/opening/touchInput.ts`:

```ts
export interface TouchAxes { forward: number; right: number }
export const TOUCH_DEAD_ZONE = 0.16;
export function joystickAxes(dx: number, dy: number, radius: number, deadZone = TOUCH_DEAD_ZONE): TouchAxes
export function useTouchControls(input: {coarsePointer: boolean; maxTouchPoints: number; hoverNone: boolean}): boolean
```

`joystickAxes`: screen up (negative `dy`) is forward, screen right (positive
`dx`) is right. Length is clamped to 1; inside the dead zone both axes are 0;
non-finite or non-positive radius returns zeros.

Add `defaultGraphicsQuality` to `src/viewer/graphicsQuality.ts`:

```ts
export function defaultGraphicsQuality(input: {override: string | null; stored: string | null; touch: boolean; shortestSide: number}): GraphicsQuality
```

Rules: `override` of `auto`/`low` wins; then stored `low`; then touch and
`shortestSide <= 900` → `low`; otherwise `auto`. `getGraphicsQuality()` calls it
with real values and keeps `?quality=` precedence.

Change `index.html`'s viewport meta to `width=device-width,
initial-scale=1.0, viewport-fit=cover`.

Create `scripts/check-mobile.ts` and wire `check:mobile` in `package.json`.
Assertions:

1. centre, up, right, diagonal, dead-zone and beyond-radius vectors; the dead
   zone constant itself is pinned at 0.16
2. detection: coarse primary pointer → true; touch + no hover → true; touch +
   hover (hybrid laptop) → false; fine non-touch → false
3. quality precedence: explicit auto beats touch-low; stored low wins; touch
   small → low; touch large → auto; mouse small → auto
4. `index.html` contains `viewport-fit=cover`
5. both call sites (`src/exploration/controller.ts`, `src/viewer/graphicsQuality.ts`)
   query `(pointer: coarse)` and do not contain `(any-pointer: coarse)`

Run the check first and confirm it fails for the missing module.

Task 3 extends the same check with the source and stylesheet asserts (6 and 7
below), because those files do not exist yet at Task 1.

### Task 2 — controller touch API

In `src/exploration/controller.ts`:

- import the detection helper; add `touchPreferred()`.
- `enter()`: touch path as above.
- state `touchForward`, `touchRight`, `touchSprint`; cleared in `clear()`.
- `touchMove(forward, right)`: clamp, and when non-zero take over, and if not
  controlled set `compat = true; game.paused = false`.
- `touchRun(on)`: set the sprint flag.
- `update()`: human intent is keyboard plus touch axes, sprint is
  `keys.has(ShiftLeft) || touchSprint`.
- compat `pointermove`: multiply the delta by 2.4 when
  `pointerType === 'touch'`.
- return `touchMove`, `touchRun` and `touchPreferred()` in the explorer object.

### Task 3 — touch controls and responsive shell

Create `src/opening/touchControls.ts` and `src/opening/touch.css`, imported by
the module. `createTouchControls(explorer)` mounts whenever touch detection is
true; the layer itself is hidden by CSS until `body.exploring`. It does not
require `body.game-shell`, so a phone using `?tools=1` and the review build both
keep a working gamepad. It builds:

```html
<div class="touch-controls">
  <div class="touch-stick"><div class="touch-knob"></div></div>
  <div class="touch-actions">
    <button data-touch="run">RUN</button>
    <button data-touch="jump">JUMP</button>
    <button data-touch="bag">BAG</button>
    <button data-touch="interact">USE</button>
    <button data-touch="menu">MENU</button>
  </div>
  <p class="touch-guide">Left stick walk · drag to look</p>
  <div class="touch-rotate" hidden>Rotate to landscape for the full view <button>Dismiss</button></div>
</div>
```

Behaviour: pointer capture per control; release and `pointercancel` reset the
stick; while the stick is held it re-sends `touchMove` every frame, because any
`clear()` (pause, inventory, focus) zeroes the axes and a move-less hold would
otherwise stall until the next pointermove; `touchmove` on the document releases
a captured stick; MENU is Escape; RUN toggles `aria-pressed` and calls
`explorer.touchRun`, and re-syncs `aria-pressed` from the explorer after any
`clear()`; USE/JUMP/BAG dispatch the synthetic keys; a MutationObserver on
`body.dataset.campaignFocus` swaps the USE label to `BACK` while focused; the
rotate hint follows `matchMedia('(orientation: portrait)')` and the Dismiss
button hides it for the session.

Copy parity: a MutationObserver rewrites keyboard-only HUD copy on mount and on
change — `Press F` → `Tap USE`, standalone `Esc` → `MENU`, and the B4 focus hint
`Arrows look` → `drag to look` — in `.opening-objective`,
`.opening-prompt-text` and `.stage-bottom > span`. It never rewrites an element
whose text lacks one of those tokens.

Mount from `src/main.ts` after `mode(true)`, and cap the renderer there:
`createSiteViewer(host, () => true, touch ? TOUCH_MAX_PIXEL_RATIO : undefined)`.
Add `export const TOUCH_MAX_PIXEL_RATIO = 1.15` to
`src/viewer/graphicsQuality.ts` first; nothing defines it today.
Add a review-build shell switch so the mobile gate can exercise the real player
shell while keeping `__CAMPUS`: in `src/entry.ts`, allow `?shell=1` to set
`gameShell` even when `import.meta.env.MODE === 'review'`. The viewport meta was
already changed in Task 1; do not change it again.

CSS is scoped to the touch build: safe-area padding, the 132 px stick, 56 px
buttons, HUD at 250 px, prompt above the controls, 32 px hotbar, portrait hotbar
lift, pause card scroll and 48 px targets, hidden minimap/keyboard hints, B4
focus collapsing to USE/MENU, and `body:not(.exploring)` hiding the layer.

Extend `scripts/check-mobile.ts` with:

6. source asserts: controller returns `touchMove` and `touchRun`; the touch
   module contains the five synthetic codes; the CSS contains
   `env(safe-area-inset` and an orientation media query; `TOUCH_MAX_PIXEL_RATIO`
   is 1.15 and main.ts passes it to `createSiteViewer`
7. the desktop path is untouched: the compat pointermove has the touch
   multiplier behind `pointerType === 'touch'`.

### Task 4 — mobile browser gate

Create `scripts/check-campaign-mobile.py` (Playwright, local gate, not CI) that
runs against a frozen review build:

1. iPhone-sized viewport 390×844 using a real device descriptor or
   `isMobile: true` + `hasTouch: true` (Playwright's `hasTouch` alone leaves
   `(pointer: coarse)` unmatched, and the gate would exercise pointer lock
   instead of the touch path), `?experience=opening&checkpoint=b4`.
2. Tap `#enter-game`; assert `body.exploring`, `.touch-controls` visible,
   `__CAMPUS.explorer.state.compat === true` and `game.paused === false`.
3. Drag the stick up 500 ms; assert position moves > 0.4 m.
4. Drag on the canvas horizontally; assert yaw changes > 0.1 rad.
5. Tap JUMP; assert `humanJump` or a positive vertical velocity within 300 ms.
6. Tap BAG; assert `game.inventoryOpen`; tap BAG again to close.
7. Tap MENU; assert `#pause-panel` visible and `game.paused`; tap `#enter-game`;
   assert resumed.
8. Enter B4 keyboard focus through the campaign debug API; assert the stick is
   hidden, USE reads BACK, and tapping USE leaves focus.
9. Screenshot `evidence/mobile-<sha>.png`.

### Task 5 — CI wiring

Add `npm run check:mobile` to `check:all` (before `build`) and to the Pages
workflow's check step, so a later edit that breaks the primitives fails both the
local chain and CI. The owner approved adding the new checks to CI.

## Acceptance

- `npm run check:mobile` passes; it failed before Task 1.
- `npm run typecheck`, `check:opening`, `check:campaign`, `check:prologue`
  pass, and the Pages workflow runs `check:mobile`.
- The mobile browser gate passes on a frozen build, with one screenshot each
  from portrait and landscape.
- Desktop browser smoke: touch layer absent, pointer lock path unchanged.
- Owner plays the live build on a phone.
