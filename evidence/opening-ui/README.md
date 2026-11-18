# Agent D — English opening UI verification

Date: 2026-11-18 (first pass) and 2026-11-18 23:20–23:45 (review pass).
Owner files under test: `src/opening/ui.ts`, `src/opening/opening.css`, `content/opening/en.ts`.

## Review pass — what changed and what was re-verified

The development snapshot changed during the review: `src/opening/world.ts` landed, `npm run typecheck`
now passes for the whole project, and `robot.ts` changed its public state names. Two real defects were
found by re-reading the code against the live contract:

1. **Stale robot state name.** `src/opening/robot.ts` exports
   `OpeningRobotState = 'patrol' | 'scanning' | 'chase' | 'search' | 'caught'`, but the UI still tested
   for the old `'scan'`. A robot reporting `scanning` with `warning === 0` would have shown **no**
   warning at all. Fixed in `src/opening/ui.ts` (`updateWarning`) and now covered by the
   `scanning-zero` harness scenario.
2. **Decorative meter was exposed to assistive tech.** The threat bar now carries `aria-hidden="true"`;
   the state text carries the meaning.

`content/opening/en.ts` was edited by another agent at 23:08 (robot state keys `scan` → `scanning`,
`failed` → `caught`); that edit is kept.

Because the project now boots, the review added a **real-page** verification on top of the mock harness.

## Real page verification (after `world.ts` landed)

The real page was served by an isolated Vite instance on port 5185 (port 5184 was already taken by
another instance; a separate port keeps the `hku.opening.v1` localStorage writer token out of another
run's way). The page was driven with Ego Lite (Chromium), 1440×900.

| Check | Result |
| --- | --- |
| Page boot | `HKU Shanghai · High Table`, `body.exploring opening-mode`, opening HUD present, CSS applied |
| Other shell panels | no `#survey-hud`, no `#campus-panel` → no stacking with the existing shell |
| Resume | `Start opening` → pointer lock unavailable in this browser → shell's own `Drag controls` → `paused=false` |
| HUD while running | objective `Your invitation awaits`, prompt `F · Read your dinner invitation`, mini-map card is the top hit target |
| Real minimap | `drawOpeningMap` painted 59 400 pixels / 316 distinct colours into the HUD canvas (not blank) |
| Interact (the F-key path) | invitation modal opened; `game.panel='computer'`, `paused=true`, pause card hidden, focus on `Continue`, modal in `BODY`, HUD in `.stage` |
| `Continue` | story advanced to `invitation_read:true`, `events:['invitation_read']`; modal closed, `panel=null`, `paused=true`, pause card back with the button label `Continue` |
| Esc | exactly one `close`; modal removed, focus back on the canvas, game still paused (no auto-resume) |
| Settings (shell entry point) | title `Settings`; sliders read `view.settings` exactly (0.0022→1.00×, 72°, 20%, 60%, 45%); toggles mirror `muted`/`bob`; focus on the sensitivity slider; `game.panel='settings'`, pause card hidden |
| Slider drag | focus kept, readout `1.82×`, value written through to `experience.settings.sensitivity === 0.004`, no modal rebuild |
| `Done` | modal closed, `panel=null`, `paused=true`, pause card visible again |
| Console | 677 page events, **0 uncaught exceptions, 0 console errors** across load → enter → drag mode → invitation → Esc |

Screenshots: [real-page-invitation-1440x900.png](real-page-invitation-1440x900.png),
[real-page-settings-1440x900.png](real-page-settings-1440x900.png),
[real-page-after-invitation-1440x900.png](real-page-after-invitation-1440x900.png).

Real-page behaviours owned by shared modules, not by Agent D: pointer lock is unavailable in this
browser (the shell's drag-mode fallback handles it); the HUD map card routes through
`action('map')` → shared `computer()`, which opens the invitation while the player is still on the
shuttle; the `Continue` hint after closing a modal is the shell's pause card.

## Mock-view harness (still the way to reach every modal)

The harness drives the **real** `createOpeningUI(stage, actions)` and the real `opening.css` with mock
`OpeningView` data and a mock `drawMap` (the renderer under test does not draw maps itself). No WebGL
scene, NPC, robot or save logic is exercised.

The harness and its rebuilt bundle are in [harness/](harness/):

- [harness/index.html](harness/index.html) — mock 3D stage, `body.exploring`, app-like header height.
- [harness/main.ts](harness/main.ts) — mock `OpeningView` presets and logged `OpeningUIActions`.
- [harness/save-stub.ts](harness/save-stub.ts) — stand-in for `DEFAULT_SETTINGS` only.
- [harness/build.mjs](harness/build.mjs) — esbuild bundle (also bundles `opening.css`).

Rebuild and run:

```sh
node evidence/opening-ui/harness/build.mjs
python3 -m http.server 5600 --bind 127.0.0.1 --directory evidence/opening-ui/harness
# open http://127.0.0.1:5600/?scenario=alert
```

Scenario keys: `hud`, `invitation`, `staff`, `alert`, `computer`, `computer-emergency`, `map`,
`caught`, `complete`, `settings`, plus `scanning-zero` and `robot-caught-state` for the real robot
state names.
The page exposes `window.__log`, `window.__setView(partial)`, `window.__showScenario(name)`,
`window.__focusInfo()` and `window.__ui` for scripted checks.

## Commands actually run

```sh
# Pure module check (the shipped module, not the harness)
npx tsc --noEmit --strict --target ES2022 --module ESNext \
  --moduleResolution Bundler --lib ES2022,DOM --types vite/client,node \
  --skipLibCheck --esModuleInterop --resolveJsonModule \
  src/opening/ui.ts content/opening/en.ts
# exit 0

# Whole project
npm run typecheck
# exit 0 (after src/opening/world.ts landed)

node evidence/opening-ui/harness/build.mjs
```

Browser checks were run with Ego Lite (Chromium) against localhost:

- Viewports: 1440×900 and 1366×768; device scale factor 1.
- 20 screenshots (10 scenarios × 2 sizes) plus one HUD-expanded screenshot and three real-page screenshots.
- No element of `.opening-hud`, `.opening-mapcard`, `.opening-prompt`, `.opening-warning`, `.opening-dialog` left the viewport at either size; no document scrollbar.
- At 1366×768 the `computer`, `map` and `settings` dialog bodies scroll internally (`scrollHeight > clientHeight`); the dialogs themselves stay inside the viewport.

## Keyboard, focus and intent results (browser, real `KeyboardEvent`s)

| Check | Result |
| --- | --- |
| Invitation initial focus | `Continue` button (`data-autofocus`) |
| Tab from last focusable | wraps to header `Close` |
| Shift+Tab from first | wraps back to `Continue` |
| Esc on invitation | exactly one `close` intent |
| App closes the modal (`view.modal=null`) | modal root hidden, dialog removed, focus restored to stage canvas |
| Invitation `Continue` | `action read_invitation` |
| Staff `I'll collect it` | `action accept_errand` |
| Staff `Not now` / header `Close` | `close` |
| Alert `Enable emergency assistance` | `action read_alert` |
| Alert `Not now` / header `Close` | `close` |
| Computer `Map` tab | `action map` |
| Computer `Tasks` tab | `action computer` |
| Computer footer `Close` | `close` |
| Map page `Back to tasks` | `action computer` |
| Caught: Esc and `C` | ignored (no close intent) |
| Caught: Tab with one button | stays on `Retry` |
| Caught `Retry` | `action retry` |
| Complete `Close` | `close` |
| Settings slider input | `setting sensitivity 0.006`, readout `2.73×` |
| Settings mute toggle | `setting muted true` |
| Settings `Save progress` / `Safe checkpoint` | `action save` / `action safe` |
| Settings `Restart opening…` | inline confirm, focus on `Keep current progress` |
| `Keep current progress` | confirm removed, actions row restored |
| Confirm restart | `action restart` (only after the inline confirm) |
| Same-signature `update` while settings is open | no rebuild: focused element and selection kept, save line updated |
| HUD `Details` summary | opens/closes the collapsible detail paragraph |
| HUD mini-map card click | `action map` (the minimap itself is drawn by `drawMap`, not by the UI) |
| Empty prompt | prompt hidden |
| `robotState=patrol, warning=0` | warning hidden |
| `robotState=scanning, warning=0` | warning visible ("Scanning the area") — regression for the fixed state name |
| `robotState=caught, warning=1` | warning visible ("Detected", 100%) |
| `robotState=chase, warning=1` | warning visible, data-state `chase`, bar 100% |
| `dispose()` | HUD/minimap/prompt/warning/modal removed; later Esc logs nothing |

## Still unverified

- The `caught`, `alert` and `complete` modals were not opened through the real game flow (reaching
  Building 6 and the robot encounter needs a full playthrough); they are covered by the mock harness only.
- No audio check, no save-ownership check across two tabs (owned by the state/persistence modules).
- Mobile layout (<700 px) is styled but not browser-verified.
- No subjective playtest of pacing or copy beyond the screenshots above.
