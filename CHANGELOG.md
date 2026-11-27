# Changelog

All notable changes to HKU: Barrier 2030 (“A CDS campus story”). The app version lives in `VERSION` and `package.json`; the save-schema version is separate.

## [9.2.3] — 2026-11-27

The owner's layout corrections, and the rest of the 2026-11-26 bug hunt: with
9.2.2's two hotfixes and the three findings the verification replay added,
**50 distinct defects have been found and fixed**.

### Fixed — owner review
- **CDS-1 is the presentation room again.** The B04 interior was rebuilt from
  the observed keyboard lounge: curved timber plinth, seven sofa modules,
  armchairs, keycap stools and ceiling cutaway, with the Keyboard Wall square-on
  to the entrance as in the presentation build. The bespoke lobby is gone; the
  stations, entry, collision and both walk gates follow the room. A backing slab
  in the surround's own material hides the keycap pedestals from the service
  aisle. Played in a real browser from `b4-inside` to `to_lawn`, no page errors.
- **The lift and the HKU flip wall stand in Building 6, not B04.** The
  ground hall is the middle building; entering it, the lift is left and the
  canteen right. The tower is now hollow above the hall for the lift shaft and
  the 5F landing/office, so the car does not ride inside solid geometry.
- **The robot's scan locks on contact and escapes like a wanted level.** A
  confirmed sighting keeps the robot on the player while the radius grows to
  break the lock, instead of demanding the player step back into the cone.
- **The dining cast no longer pops out of existence**: guests that leave the
  hall cross a doorway fade.

### Fixed — touch and phone
- T-03 prompt/hint collision; T-04 the rotate hint no longer swallows look
  drags; T-05 Chapters chip and fullscreen toggle meet 44 px; T-06 scrollable
  44 px hotbar; T-07 44 px bag close plus “Tap × to close”; T-08 44 px sliders;
  T-09 44 px Restart summary; T-10/D-05 the pause card says it scrolls; T-11
  the boot notice clears Continue; T-12 the idle dock stays readable on touch;
  T-13 44 px settings controls.

### Fixed — desktop, checkpoints and copy
- D-02 Esc closes the pause menu in the mode it was opened from; D-03/D-04 the
  card traps and returns focus; D-06 no authoring toast on a player boot; D-07
  the landmark is labelled as the game; D-08 both Shift keys sprint; D-09 game
  keys are inert behind the card; D-10 slider values are announced; D-11 the
  drag-controls offer withdraws after a lock; D-12 the Chapters chip is not a
  dead click under pointer lock.
- R-01/R-02 a checkpoint reset returns to the leg's own start pose instead of
  its destination; R-09 the epilogue offers no checkpoint; R-10 a new run says
  “No checkpoint yet”; R-12 old `?checkpoint=bus` bookmarks start the plaza run.
- Start, pause, chapter and caught copy says plaza, not shuttle.

### Fixed — audio, map, save and static surfaces
- S-31 the supercomputer hum, sports cheer and keypad beep ride the page's one
  mixer, so mute, effects volume and pause apply; S-33 the ending clears the
  chapter bed before the finale cue; S-07 the incident map/HUD has no bogus
  coordinator target; S-35 the backup-relay answers follow the printed order;
  S-08 Skip marks the prologue seen; S-10 two dead runtime save fields removed
  (old saves still validate); S-11 the dead tasks page removed; D-01/R-08 Play
  again keeps the caller's boot parameters and asks for a fresh run.
- **W-01** the MacBook Maps legend names the dark map's green objective and gold
  player; **W-02** Skip/end of the prologue pauses the story bus under the start
  card; **W-03** phone assistant replies say “Tap MAC”, never “Press C”.

### Verified
`tsc --noEmit`; the full `check:opening` chain and the campaign, chapter-select,
prologue, lift, B4-office, sports-door, flip-wall and mobile gates; and real
browser replays of the B4 route, the phone assistant and the prologue skip.

## [9.2.2] — 2026-11-26

Hotfix for the two phone defects that stop a run: the MacBook could not be
opened, and the backpack could not be opened.

### Fixed
- **A phone could not open the MacBook, so the story stopped at "Open the
  MacBook".** No on-screen control sent `C`; the prompt named a key a phone
  does not have. The touch pad now has a `MAC` button (the grid's free cell,
  row 3 column 1) that sends `KeyC`, and the prompt rewrites `C · …` to
  `MAC · …` (`src/opening/touchControls.ts`, `src/opening/touch.css`).
  Verified A/B on 390×844: old build has no button, new build opens the
  presentation device.
- **BAG threw on every tap.** `controller.ts` tested `.matches` on the event
  target, and the touch layer dispatches its key events on `window`, whose
  target has no `matches`; the TypeError aborted the handler, so the bag never
  opened. The guard is now `instanceof HTMLElement` first. Verified A/B: old
  build `TypeError: H.target?.matches is not a function`, bag closed; new
  build bag opens, zero page errors.

## [9.2.1] — 2026-11-26

Two mobile defects the owner reported after playing 9.2.0 on a phone.

### Fixed
- **JUMP could go dead after dragging a slider.** The four action buttons and RUN were bound only to the synthesized `click`; while a drag on an `<input type="range">` is being arbitrated the browser withholds synthesized clicks, so a click-bound button stays dead until the gesture settles. A tap is now handled on `pointerdown` (delivered per touch, never withheld); `click` stays bound for keyboard and assistive activation, which arrive with `detail === 0` (`src/opening/touchControls.ts`). The sliders themselves also take `touch-action: none` now.
- **Entering the game did not always go fullscreen by itself.** `autoEnter()` was reached but `requestFullscreen` was never called: the "the player left fullscreen, do not re-enter" opt-out was armed inside `changed()`, which also serves `orientationchange` and `visualViewport` resize, so a viewport resize before the first entry armed it silently — intermittently. Only a real in-fullscreen → out transition arms it now, and any entry clears it (`src/opening/fullscreen.ts`). The Start, Continue and Takeover taps ask for fullscreen inside the gesture; the player's own exit is respected on the next Continue; a device without the API still gets the Add to Home Screen hint and no dead button.

### Changed
- The pause card's phone copy reads “Touch · left stick walks · drag to look · buttons act, MENU pauses” instead of the keyboard line.
- **The phone UI is clear of the status bar and no longer opens mid-scroll** (owner report, 2026-11-26: 「现在这个 UI 有问题了，会溢出」). VITALS, the objective card and CHAPTERS take `env(safe-area-inset-top/left)`, so an installed PWA with `viewport-fit=cover` stops drawing them under the clock. The rotate pill's Dismiss label was 58 px of text in a 48 px button and painted outside its own pill; the button no longer shrinks (`flex: none`, `white-space: nowrap`, measured 72 px / 70 px now). The pause card reopens at its top — reaching a slider used to leave `scrollTop:166` behind, so the next MENU opened with the heading and Continue above the screen edge — and its `max-height` is `100dvh` minus the safe-area insets instead of `100vh`.

## [9.2.0] — 2026-11-26

The three scenes the 9.1 line left as architecture are performed, and the two defects that hid the finale are fixed.

### Added
- **B5 High Table Dinner.** Guests within arm's reach of a chair take it, face the nearest table and sit; the forecourt pair stays standing by design. The coordinator's toast plays `mus_dinner_toast` once when the staff intro starts (`81d6364`).
- **Four-tower finale.** One instanced window family (3456 quads) across all four towers, six tower-to-tower beams and one flat atrium ring, all additive, no lights and no shadows, 5.6 s long; `mus_finale` fires once on the release beat; a reload after the credits restores the lit campus (`c3d64f7`).
- **CDS-1 gate bank** at the B4 plaza entrance: four brushed pedestals with top readers and three glass wings with metal edges, scenery only, no collision rect (`f251db8`).

### Fixed
- Finale windows were seated on the authored façade planes, but the built towers stand 2.8–5.8 m proud of them, so every quad sat inside the wall where the depth test hides it. The show now measures the built shells and seats the glass 0.22 m outside (`c3d64f7`).
- The ending played off-screen behind the three 25.5 m sports halls; a scripted 58 m camera crane lifts the view over their roofs before the Mac overlay clears, then releases to eye level (`c3d64f7`).
- The presentation MacBook was built from the office-door timber material and read as brown wood; it is aluminium now, with a near-black display, so the errand's object reads as the object it is named after.
- The epilogue advanced on frame time. The viewer caps frame dt at 0.1 s, so a software-rasterised browser running the 58 m crane view at 0.25–0.37 fps stretched the 17 s sequence to nearly eight minutes (measured: clock 15.2 of 17 s after 422 s, no credits). The cutscene now takes the wall-clock delta whenever the game is running (`85b0ee7`); the same 0.37 fps run finishes in 28 s.
- The dome release had the same defect and could not catch up with the ending: its 5.2 s transition advanced 0.1 s per frame, so the credits arrived with the curtain still 88.5% down (`end: dome released` failed). The atmosphere now takes the same wall-clock step (`f1d293c`); on the same 0.34 fps build the dome reads `day / 0 / false` two seconds before the credits.
- "Return to checkpoint" during Chapter 3 put the player back at the B4 handoff, 176 m from the sports hall, with the objective unchanged. The campaign host now names the checkpoint of the chapter you are in (`chapterEntry()`), the button places the body there, and the epilogue — which has no walking leg — refuses the move instead of teleporting to the origin under the finale's camera crane (`9c48dfe`).
- Pausing during the epilogue left a card no mouse could click: `#ending-overlay` (`z-index:60`) stays in the hit-test tree after its visuals fade, over a `#pause-panel` at `z-index:12`. The card is now 70 and the toast 71, above every story overlay and below the MacBook and boss surfaces. A late `pointerlockerror` could also re-pause a game already resumed by drag controls; a failed lock request no longer revokes compat mode (`02680f0`).

### Changed
- 19 music cues are reachable: `mus_dinner_toast` and `mus_finale` are both requested at their beats.

## [9.1.1] — 2026-11-26

### Fixed
- A shipped build retried `ws://127.0.0.1:8788` and probed `127.0.0.1:8790/health` forever where no local service exists. Both sit behind the `LOCAL_TOOLS` gate now (loopback **and** dev/review mode, or `?agent=1`), and the bridge backoff is 2 s → 4 s → 8 s → 15 s (`f02b70c`, `0b14a35`). Same probe, same build: 8 WebSocket errors and 2 assistant errors → 0 and 0.

## [9.1.0] — 2026-11-23

Submission build for the Vibe Coding Lab. **Not final until the annotated `v9.1.0` tag is cut.** There is no frozen archive, no checksum file and no upload from this repo; the owner pushes the tag and deploys.

### Added
- New title **HKU Shanghai at War**, with “BARRIER 2030” as the subtitle — title card, menu, credits, README and video intro; in-game story copy unchanged.
- Version number and build metadata (`VERSION`, `package.json`, `__APP_VERSION__`, `__GIT_SHA__`, `__BUILD_TIME__`) — Task 12.1.
- Visible version label in the pause card/credits and `window.__CAMPUS.version` — Task 12.1.
- Full score: 18-cue map, four composer families, two takes per cue, audition/veto page — Workstream 13.
- Expressive ElevenLabs voice cast (narrator, staff, player, local AI, invader); main-story lines first; audition/veto page.
- Tag-based release: annotated git tag per playable version and `scripts/pre-push-secret-scan.sh` — Task 12.2.
- Realism/perf pass: Draco/WebP asset compression, optional FogExp2/Bloom behind a quality flag, canvas-capture video recording — Tasks 7.6, 8.9, 11.5.

### Changed
- Release model: tag instead of frozen archive; owner pushes/deploys; no upload from this repo.
- Reconcile the eight humanoid robots from the teammate’s update — Task 6.4.
- Lion encounter story, quest and lawn arena pass — Task 9.4.

### Fixed
- Group-reported UI/details and bug triage from the 2026-11-23 chat — Task 12.5.

## [9.0.0] — before 2026-11-23

Pre-release prototype line. No tagged release; the package version was `9.0.0`.
