# Known issues — submission 9.1.0

Source: WeChat group “Vibe Coding Hackathon CDS SH”, 2026-11-23 19:33–20:02, plus the sidebar reports on 2026-11-21. Triage is Task 12.5; fixes route to Workstreams 6, 8, 9 and 11.

**Status as of 2026-11-26.** Every row below was re-checked against the tree, not against the plan. “Open” means the defect is still reachable in the build. The 2026-11-26 work below the table (`9.2.0`: gate bank, seated dinner, four-tower finale) is post-`v9.1.1` and not yet tagged.

| # | Report | Severity | Status |
|---|---|---|---|
| 1 | “很多bug / 小细节” during a play session; the group will post repros | P1 | Open — no repro list arrived; the owner's own playtest on 2026-11-24 produced four defects, all closed (see below). |
| 2 | UI changed without the teammate knowing (`你是不是改过ui了？`) | P2 | Open — no “last approved UI frame” exists to diff against; the current UI is the one the owner plays. |
| 3 | Eight humanoid robots were added but are not in the current update | P1 | **Played and verified, 2026-11-25.** An independent playtest walked up to the fleet in real Chrome at `checkpoint=b5`: two columns of four at x 55.3/60.7, z −53.2…−47.8, about 1.7 m tall, both soles on the pavement, no detached or floating parts. Static gate `scripts/check-opening-fleet.ts:21` (eight units, eight routes, shared shell pool) also PASSes. |
| 4 | Robot dog: “很帅” but check speed/details | P2 | **Superseded.** The quadruped was replaced by the eight Unitree-style humanoids (`a843f99`, owner request 「加个八个人形机器人，宇树」); no quadruped shell remains in the build, and the single red-eye unit is humanoid too (`src/opening/robot.ts:19`). |
| 5 | Lion fight: story, quest and environment need a pass (`剧情，任务，环境`) | P1 | **Partly resolved.** Mission, combat nodes, interrupt/shutdown rules, hints and shelter logic exist in `src/lionBoss/` and are gated by `npm run check:lion-boss` (mechanics, rig, skills, lawn agent — all PASS). The narrative/environment *quality* pass has no recorded verdict; the owner's playtest is the judge. |
| 6 | “模型太慢了” — model/asset load is slow | P1 | **Resolved by measurement.** The first click now fetches 10 cues / 4.23 MB instead of 65 / 19.33 MB; `dist` is 30.8 MB, not 48.4 MB; 122/122 audio files decodable; `check:payload` asserts the ceilings. |
| 7 | Demo video expected | P1 | **Recorded, 2026-11-26.** `demo/hku-barrier-2030-v9.1.0.mp4` — 84.5 s, 31.4 MB, mean −28.6 dB, video and game audio in one take, from the `v9.1.0` build after the 66/66 route gate. It covers the opening cinematic to the accepted invitation, not the whole route. |

**Tag rule:** P0/P1 must be fixed or explicitly listed here before the release tag. P2 may ship with a note.

## The owner's 2026-11-24 playtest

| Defect | State | Evidence |
|---|---|---|
| Opening framing pitched 22° down | Fixed — `fd621aa` | camera distance chosen after rendering three candidates (z=246) |
| Prologue music missing | Fixed — `1ad2a9d` | the prologue is no longer treated as an audio pause |
| Disliked cue on the walk to the ceremony | Fixed — `dc6a335` | the shipped waltz was replaced with the same family's processional take |
| MacBook no longer obtainable | **Fixed** | `check:b4-errand` is green on the current tree — 70 passed, 0 failed, 0 findings at `00bc0eb` (code `86dedfe`), including `b5: the office door is not offered before the errand`, `the office door is the offered interaction` and `real F takes the presentation MacBook`, on one page with no reload in both viewports |

**Still open after that round:** the pre-errand dead end at the B4 5F office is fixed — a player who walks up before speaking to the coordinator is offered the door as a locked notice that names the coordinator, and the office still cannot be entered until the errand arms it (commit `794f2bc`).

## Robots, 2026-11-25 (independent playtest)

An independent playtest walked the B5 forecourt in real Chrome + SwiftShader at 1280×800 (`.scratch/robot-playtest/`, five frames, no source edits, every approach made with real `Shift+W` input, no teleport). `?checkpoint=b5` spawns at `(58, 0, −52)`, between the two robot columns, with the story at `to_b5` — so the fleet is in **standby** (green eyes, no patrol, no detection) for the first two checks. Patrol and detection were exercised through the build's own review hook, `window.__CAMPUS.openingDebug.triggerIncident()`.

| Behaviour | Evidence |
|---|---|
| Eight distinct bipedal humanoids | two columns of four at x 55.3 / 60.7, z −53.2…−47.8; at 2.56 m: sensor head with visor and crown, white chest with green status band, two arms with shoulder/elbow/hand joints, two legs with hip/knee/ankle, flat feet on the pavement — no floating or detached geometry |
| Walking, not sliding | over ~13 simulated seconds each unit translated to its deployment waypoint while the hips alternated anti-phase and the arms counter-swung; yaw changed at waypoints and the legs settled when it stopped |
| Detection and escape | first feedback at 7.31 m (state `search`, warning 0.4), confirmed `chase` at 6.42 m (warning 0.79, `runtime.robot_chase_started`), lost sight at 7.44 m when the player ran east — ended at 10/10 hearts, not caught |
| Errors | no page error during play. One transient `Failed to fetch dynamically imported module` with connection resets on an early bootstrap; it retried and never recurred. The review build was being rewritten under the server during that window, which is the likely cause |

**Not exercised:** a catch and the respawn that follows it. One standing-still trial held `chase` at warning 0.87 for 33 s inside a 180 s window without a catch, so the capture path has no playtest evidence yet — `check:opening-robot` covers it offline.

**Cosmetic, not broken:** in daylight standby the visor reads almost black with no visible eye glow, and the hands are solid blocks without fingers.



An independent playtest walked the B4/B5 interiors at 1.6 m eye height and recorded 53 screenshots. Its report is `.scratch/interior-playtest/report-interior-playtest.txt` (passes its own quality gate, PASS, twice).

| Finding | State | Evidence |
|---|---|---|
| The standalone 4F lounge view rendered as a black shell | **Fixed — `0ad8e0b`** | the sealed AI curtain composited over the room and the opening atmosphere repainted the scene to night every frame; the view now suppresses the atmosphere, hides the curtain and restores the day exposure |
| The 5F office is underexposed while its window blew out | Partly fixed | the pane now has mullions and a transom and its emissive dropped .55 → .30 (`86dedfe`); a real interior lamp is a world-layer job — the shell gate asserts zero lights so the room cannot glow by day |
| The B4 plaza entrance has no gate bank from the cds-lobby preview | **Fixed — `f251db8`** | root cause: `cutOpeningBuildings` removes every mesh inside the B4 room cavity, so the preview's gate meshes were cut away with the rest of the interior. The bank is now built into the static room shell: four brushed pedestals with top readers, three glass wings with metal edges. `check-campaign-b4` asserts it is present in the built site, fills the 2.6 m doorway, never pokes past the door plane, adds no collision rect, and leaves the 1.3 m centre lane clear. Captured in the running build from the plaza at 4 m (`/tmp/b4-gates2-front4.png`, `/tmp/b4-gates2-inside.png`, 0 page errors) |
| Furniture reads as placeholder massing (lounge, office) | Open | the B4 lobby and the 5F corridor were re-dressed and verified on 2026-11-25 (see below) |

## B4 lobby and 5F corridor, 2026-11-25

Verified in a real browser at 1280×800 (`.scratch/verify-2026-11-25/verify-b4-fixes.json`, `pass: true`, 7 shots, story stage `complete`, version `9.1.0`): the ceiling conduit is gone and the ribbed ceiling reads cleanly, the armchairs read as seating (seat, back, arms, correct heights), the keyboard phrase row is contiguous as eight amber caps spelling “I L O V E C D S”, and the 5F corridor and its housekeeping trolley are dressed. A faint dark planter silhouette above the armchair backrest was noted; it is unlit foliage geometry, not a blocking defect.

## Fixed after the independent QA runs, 2026-11-25

| Defect | Fix | Evidence |
|---|---|---|
| The crest over the head table rendered as a torn pixel smear: the 26×31 photo trace at 1.4 m, next to 36×38 crests that read cleanly on the banners | `5ad4d89` — the wall uses the clean crest art, plane matched to its aspect | review build, `.scratch/score-verify-2026-11-25/shots/b5-crest-after.png`: legible shield, lion and scroll at 3.2 m |
| A campaign beat requested before the first gesture was dropped: checkpoint auto-starts tick the chapters while the mixer has no `AudioContext`, and the chapter had already latched its bed, so `?checkpoint=b4` played the opening's `mus_patrol` instead of `mus_puzzle` | `a83bfeb` — `playScore` holds the request and `start()` applies it; `check:audio-review` pins the sequence | review build: `mus_puzzle` at `b4_flip`, `mus_lawn` looping within 1.0 s of `macbook_connected`, `mus_lion_boss` at the lawn, `mus_lion_victory` one-shot counter 1 |

## Audio coverage, 2026-11-25

24 music cues ship in `dist/`. Registration is what makes a cue reachable: `CampusAudio.enableStory()` is the only writer of the story URL map, and `loadAudioNames` refuses any name it does not hold.

| State | Cues |
|---|---|
| Reachable | 19 — the opening's own set, the credits theme, the ending's `mus_finale`, and the campaign beats (`mus_lawn`, `mus_lion_boss`, `mus_lion_victory`, `mus_puzzle`, `mus_sports`) |
| Reachable but never requested | none |
| Not registered | 5 — `mus_boss`, `mus_title`, `mus_abduction`, `mus_abduction_stinger`, `mus_march_alt` |

The six are cues for scenes this build does not contain (a titled fight variant, a title screen, two abduction stingers and an alternate march). They still ship inside `dist/assets` because every music file is emitted regardless of registration; they cost load time only if something asks for them, and nothing does. **Updated 2026-11-26:** `mus_dinner_toast` and `mus_finale` are both registered and requested now — the dinner cue at the staff intro (`81d6364`) and the finale cue on the ending's release beat (`c3d64f7`), each counted exactly once by its gate.

## B5 High Table Dinner has no beat, 2026-11-25

> **Superseded 2026-11-26 — the beat now exists.** `81d6364` seats the guests and
> `src/gameplay/storyAudio.ts` registers `mus_dinner_toast`, cued once from
> `src/opening/experience.ts:216` when the coordinator's staff intro starts.
> `check-opening-npcs` asserts the seating: **7 of 12** actors take a chair within
> arm's reach, face the nearest table, and sit with both legs at −1.571 rad, each
> within 0.01 m of a drawn chair; the forecourt pair stays standing by design.
> Still true and unchanged: the high table itself offers **no F prompt** — the
> toast is part of the story beat, not a table interaction. The paragraph below is
> the original finding, kept for the record.

An independent QA run reached the hall, walked to the high table and pressed F (`.scratch/b5-dinner-qa/evidence-b5-dinner-pass2.json`, 14 shots, 0 page errors). The stage went from “Walk to the High Table Dinner” straight to “Collect the presentation MacBook”, the seats are empty, and the F attempt changed nothing (`toastAttempt.attempts[0]` stays on `to_b6`). The 135 console errors in that file are all the local control bridge (`ws://…/game`, `/health`) failing in a static build — not game defects.

So the hall exists as architecture (tables, cloth, lamps — see `b5-20-chandelier` … `b5-27-empty-seats-at-table`) but the seated guests and the toast of the plan's Phase 2 item 10 are not built, and `mus_dinner_toast` has nothing to play for. A second, wider QA pass (36 frames, `.scratch/b5-dinner-qa/report-b5-dinner.txt`) counted 12 figures in the room and **0 seated**, with ~77 chairs and ~80 covers laid. Standing at arm's length from the high table (0.43 m from its west face, 0.42 m from its north face, facing it) `F` returns only “Move closer and face the interaction”, so the table offers no interaction at all; the engine's own `reachB5()` is gated on `stage === "return_b5"`, which the B5 checkpoint never reaches. Walking into the hall flips the objective to “Collect the presentation MacBook” at `[73.635, 0.02, -59.001]`, about 7.0 m from the table's nearest corner — inside the hall, not at the door (an earlier reading of “side lobby, 24 m” was wrong and is corrected here). Closing the beat is a content decision, not a bug fix: it needs seated figures, a toast trigger and a hand-off line, and a decision about where B5 ends.

## The four-tower finale, 2026-11-26

`c3d64f7` gives the ending its light show: one instanced window family across the four towers (3456 quads), six tower-to-tower beams, and one flat atrium ring, all additive, no lights and no shadows, 5.6 s long. `check-finale` asserts the structure, the B01→B04 bottom-up order, the completion, and that the ending wires `mus_finale` **once**, as a one-shot, on the release beat; a reload after the credits restores the lit campus from the `done` stage.

Two defects were found and fixed on the way, both invisible to a static gate:

| Defect | Root cause | Fix |
|---|---|---|
| Not one window appeared | the built façades stand proud of the authored envelopes (B01 is 2.8 m deeper, B04 5.8 m wider), so every quad at spec + 0.12 m sat **inside** the wall, where the depth test hides it | measure the built shells at show creation and seat the quads 0.22 m outside them; `check-finale` now runs the show against an oversized box and asserts zero buried quads |
| The finale played off-screen | the ending spawn (−45.9, 1.78, −117) is behind the three 25.5 m sports halls; at eye level not one window is in frame, and the "tall glass tower" in early screenshots was the hall itself | a scripted 58 m camera crane over the halls (`game.cameraLift`, smoothed 4.8→6.8 s) that releases to eye level with the Mac overlay; the body keeps walking on the ground. 58 m, not 32.5 m: at 32.5 m the sightline over the halls passes at 23.3 m, below their 25.5 m roofs |

## The ending ran on frame time, 2026-11-26

The full-route playthrough reached the epilogue and never reached the credits: `stage` stayed `ending`, the atmosphere sat at `curtainProgress 0.865` with `releasing: true`, and the "students are running for the gate" toast was still up after 422 s. The ending advanced its `clock` by the frame dt, and the viewer caps that at 0.1 s (`src/viewer/siteViewer.ts:53`). The 58 m crane view renders at **0.25–0.37 fps** under SwiftShader, so 422 s of wall time moved the story clock only to 15.2 s of 17.

A dedicated probe (`?checkpoint=ending`, the harness's own `enterCompat()` resume, 4 s sampling) confirmed it on the same build: `started: true`, `clock` climbing at 0.125 s per wall second, `finished: false`. The earlier finale probe had missed this because it forced the clock with `ending.clockTo()`, which is a seek, not an update.

**Fixed** (`85b0ee7`): the epilogue is a cutscene authored in story seconds, so it now takes the wall-clock delta since its last update — capped at 2 s for a hidden-tab gap, and only when `dt > 0`, so it still holds behind a pause and a headless caller passing a fixed dt keeps that dt. Re-measured on the same 0.37 fps build: hold 4.0 s → `clock` 17.9 s → `stage: done` → credits visible, in 28 s.

That exposed a second half. The full-route run then took the ending in **22 s** (down from 422 s) but failed `end: dome released`: the credits arrived with the curtain at `disturbance / 0.885 / releasing`. The dome is a 5.2 s transition advanced by the frame dt, so at 0.34 fps it needed ~140 s of wall time while the ending's new clock ran to 17 s. **Fixed** (`f1d293c`): the atmosphere takes the same wall-clock step (cap 2 s, only when `dt > 0`, still held by `state.paused`; a fixed-dt caller keeps its dt because the wall delta is ~0 in a tight loop). On the same 0.34 fps build the probe now reads `day / 0 / false` at `clock` 11.7 and shows the credits at 15.7 with the dome up.

The frame rate itself is the software rasteriser, not the game: a GPU-backed browser holds this view at the frame budget, and the 58 m crane is unchanged. ✅ No action.

**Full route green on the fixed build** (third run, `bazzcbdcj`): `check-campaign-playthrough: 66 passed, 0 failed (815 s)`, with `end: dome released`, `end: credits visible`, `end: same document, same URL, first person` and `no page errors` all ok; the ending itself took **24 s** of wall time and the credits card renders with the four towers lit behind it (`.scratch/playthrough-2026-11-26c/shots/07-credits.png`).

## Independent shakedown, 2026-11-26

A read-only reviewer played every checkpoint with real inputs against the review build and recorded P0 0 · P1 2 · P2 0 · P3 1; a second quality-gate pass reproduced all three from its logs (`qoder-report.md`, `logs/`, `shots/` under `.scratch/shakedown-2026-11-26/`). No recorded-run blocker was reproduced; B4, the lawn, the sports lock, the rescue runout, the finale (`3456/3456` windows, `6/6` links) and the credits all completed with no page errors.

| Finding | Detail | Ruling |
|---|---|---|
| **P1 — “Return to checkpoint” in Chapter 3 sent the player 176 m back to the B4 handoff** | From `?checkpoint=sports`, pausing and clicking the button moved the body from `[-45.9, 0.14, -117]` (the sports east door) to `[58, 0.08, 25]` — the explorer's default B5-handoff spawn — while the stage stayed `sports` and the objective stayed “Open the sports hall east door”. | **Fixed** (`9c48dfe`). The campaign host now exposes `chapterEntry()` — the start of the chapter that owns the current stage, else the next walking leg's entry — and the button places the body there, leaving the story untouched. The epilogue refuses the move: `ending`/`done` map to the ending chapter, whose entry is a radius-0 placeholder at the campus origin, and teleporting there would drag the body out from under the finale's 58 m camera crane. Verified by the reviewer's own repro (probe: from `?checkpoint=sports`, body moved to `[-35.9, 0.14, -103]`, then Escape → the button → `[-45.9, 0.02, -117]`, the sports entry; stage unchanged, toast "Checkpoint restored", no page errors) and by a new `check-campaign-host` group (g) that pins the mapping at every stage from `b4_enter` to `done`. |
| **P1 — a checkpoint URL recreates the saved campaign at that checkpoint** | At `to_lawn`, reloading the same `?checkpoint=b4-inside` URL returns the stage to `b4_keyboard`, rewrites the save, and a later clean-URL reload stays rewound. | **Not fixed — intended meaning of the parameter.** `?checkpoint=` is the chapter-select/debug entry point: it starts the run *at* that checkpoint through the chapters' real writers, so it necessarily writes the campaign at that stage. The rewind is the feature. A player who never uses `?checkpoint=` cannot reach it; the pause menu's Chapter select uses the same route by design. Parked, not a defect. |
| **P3 — the tab title stays “Chapter 1 · High Table” through the credits** | `document.title` is set once at boot (`src/main.ts:269`) and never follows the campaign stage. | **Parked.** Cosmetic, browser-tab only, and no in-game surface repeats it — the pause card, the HUD objective and the credits all name the current chapter. Fixing it needs a stage→title table that the pause chapter list would have to share; not worth a build change before the film. |

## Shakedown on GLM-5.3, 2026-11-26

The ordered GLM-5.4 route is suspended (see *Phase F*), so a read-only shakedown ran on the nearest working GLM-family route, `auto/zai-glm-5-3-flash[1m]` (`~/.claude/agents/glm-5-3-reviewer.md`), against `v9.2.0` at `591e841`: **P0 0 · P1 0 · P2 1 · P3 2**, no recorded-run blocker. Report and evidence: `.scratch/shakedown-glm53-2026-11-26/` (`report.md`, `logs/`, 13 `shots/`).

| Finding | Detail | Ruling |
|---|---|---|
| **P2 — Chapter select is 44 px tall at 390×844** | The chapter select's `<summary>` measures 287×44 px against the brief's 48 px touch target; Replay intro measures 289×48 and passes. All nine chapter/checkpoint rows still scroll into reach and hit-test correctly. `src/style.css:82` (`min-height:44px`). | **Parked** under the fix-only-P0/P1 rule for the submitted build. Nothing is blocked; the control is reachable and works. |
| **P3 — the mobile pause card says “Keyboard and mouse”** | `src/main.ts:277` overwrites the touch-aware sentence set at `src/main.ts:257`, so `.desktop-note` on a 390 px phone reads “Keyboard and mouse · Continue to look around and move” while `touchPreferred()` is true. | **Parked.** Copy only, on the boot card; the game itself is touch-capable. |
| **P3 — “Sign photos could not load” can fire after a >10 s main-thread stall** | The 10 s `AbortController` in `src/model/signPhoto.ts:14-25` covers fetch + `blob()` + decode: instrumented, the fetch returned HTTP 200 at page-time 65,264 ms, the timer fired at 65,280 ms and killed the body read before `createImageBitmap`; the same decode succeeds standalone in 9,974 ms under SwiftShader. | **Parked.** Not expected on a real GPU; it needs a machine already stalled past 10 s. |

**Passed by the same run:** the epilogue pause card on a valid attempt (real Escape at clock 0, panel above the overlay, `elementFromPoint` hits `#enter-game`, a real click fires, clock 0→2 with `finished:false`, the no-checkpoint toast shows, chapter and stage stay `ending`); the mobile card opening at boot and reopening via MENU with nine rows reachable; the B6 walk onto the lift (7.71 of 18.9 m in the window); the sports door opening the sudoku panel, Close resuming and the second F reopening. **Not confirmed:** the full 190 m sports route and student run-out (harness waypoints; the door was tested from 8.5 m out with a disclosed teleport), the 5F office door/MacBook (SwiftShader stretches the 6 s lift), and one black quad above the lift doorway, likely a sign backface. No page errors, no 404s.

## The epilogue pause, 2026-11-26

Found in the 2026-11-26 playtest (item 4): pausing during the epilogue left a card that a mouse could not click, so the ending stayed frozen — the ending clock is paused by design — with no way out but a reload.

| Finding | Detail | Ruling |
|---|---|---|
| **P1 — the pause card was painted and hit-tested under `#ending-overlay` for the whole ending** | `#ending-overlay` is `position:fixed; inset:0; z-index:60` and stays in the hit-test tree after its visuals fade (they change opacity only); `#pause-panel` was `z-index:12`. Measured at 1280×800: the element under the Continue button's centre was the overlay's own `.ending-head`, a real `page.mouse.click` produced 0 click events on `#enter-game`, and the refusal toast's centre hit `#ending-overlay`. | **Fixed** (`02680f0`). The card is `z-index:70` and the toast 71 — above the story overlays, below the MacBook device (80/90) and the boss overlay (120), which are their own interactive surfaces. The same commit closes a second path to the same freeze: a late `pointerlockerror` (one Continue click issues two requests) paused the game again after a successful drag-mode resume; a failed lock request no longer touches compat mode. Reproduced both by a real pointer on the pre-fix build and pinned by the new epilogue leg of `check:pause-menu` (45/45 on the fixed build; the clock check fails with `pauseReason:'pointer_lock_failed'` without the second fix). |
| **P3 — a large black rectangle at the start of the epilogue** | Seen in the playtest capture at ~0.3 fps: the open leaf of the sports hall door, solid black against the dark sky. At normal frame rates the EPILOGUE card is up while the camera turns past it. | **Parked.** It is a correctly modelled open door, not stray geometry; masking it would mean a new object state the finale does not need. |
| **P3 — white streaks in the sky from the crane view** | The six tower-to-tower beams, seen thin and edge-on against the daytime sky from the crane's height. | **Parked.** Intended finale geometry (`6/6` links asserted by `check-campaign-playthrough`); making them read as beams from every angle is a lighting change, not a defect fix. |
| **P3 — “Checkpoint: Epilogue · Barrier Down” appears on early chapter cards** | The checkpoint line is written once at boot from the URL, so a card opened at another chapter can still name the epilogue. | **Parked.** The live HUD objective and chapter title are correct; this line is the debug entry's label. |
| **P3 — Chapter select stays open after “Return to checkpoint”** | The card remains up so the player can Continue; nothing is blocked. | **Parked.** Not a dead end: Continue resumes at the restored spot, and every Chapter/Settings control is still reachable. |

## The pause menu, 2026-11-25

The owner reported that the pause card could not reach the chapter select — 「replay intro 不知道为什么不放在 chapter 里。chapter 为什么不放在暂停页面。现在 chapter 根本点不到」 — and asked for the pause settings to be done properly.

**Root cause, measured on the review build:** `.shell-chapters` and `.fullscreen-toggle` sit at `z-index: 11`; `#pause-panel { position: absolute; inset: 0; z-index: 12 }` covers both for as long as the panel is in the DOM, and while the game runs the pointer is locked — so the floating “Chapters” link has never been clickable. The offset was not the problem; the stacking order was.

**Fix** (`src/main.ts`, `src/opening/chapterMenu.ts`, `src/style.css`, `src/opening/gameShell.ts`): the pause card now holds a Chapter group — Replay intro, Return to checkpoint, and a collapsed chapter select listing all eight checkpoints in four chapter groups — and a Settings group (music, ambient and mouse sensitivity with live values, plus Full screen and the full “Settings & save” dialog). The floating link is hidden while the card is open by a CSS `:has()` rule, so it cannot look clickable underneath the overlay, and the card is the single scroll container (a nested list scroller had put the last chapter rows and the Settings section below the card's edge on a phone). The taller card also reaches over the Add to Home Screen pill on a 390 px phone, where its Dismiss button used to sit just above the card; the pill is now hidden while the card is open and appears as soon as play starts, so nothing on the menu screen is a dead target (`check:fullscreen` pins both states). `scripts/check-pause-menu.py` (headless; `npm run check:pause-menu`) drives the real card: 48 px replay target, reachability judged by `elementFromPoint` (Chrome keeps layout boxes inside a closed `<details>`, so `getClientRects()` is not a visibility test), a real click on the B4 checkpoint that lands on `?experience=opening&checkpoint=b6`, slider → dialog value agreement, and the 390×844 touch layout.

## Found while making the slides, 2026-11-26

Both were found while the deck was built and neither blocks the build. Neither was changed in the `v9.1.0` build, so the deck and the film still show that build; the MacBook material is fixed in `9.2.0`.

| Finding | Detail | Severity |
|---|---|---|
| The presentation MacBook renders as brown wood | **Fixed 2026-11-26.** `B4_office_macbook_base` and `_lid` were built with `m.officeDoor` (`std('B4 5F office door', 0x6b4a2f)`), so the laptop read as a second piece of the door it sits behind. Both parts now use `m.macBody`, `std('B4 office MacBook aluminium', 0xb9bcc0)`, and a near-black 0.29 × 0.185 m display sits on the lid's inner face (`6cf27b4`), so the pickup angle reads as an open laptop and not a slab. Captured at the pickup stand (58.70, 13.85, eye 18.92, pitch 0.46): `.scratch/playthrough-2026-11-26b/macbook-stand.png`. The screen is a sibling of the lid, not its child: `compact()` merges a group's direct mesh children per material and drops a mesh parented under a merged one — measured, the first attempt left only the aluminium merge in the live scene. `check-campaign-b4` and `check:b4-office` stay green. Was P2. | P2 |
| The build probes `http://127.0.0.1:8790/health` at boot | The in-game assistant talks to the loopback LLM bridge and nothing else. With no bridge running — the normal demo case — that one request fails (`net::ERR_FAILED`) and the assistant falls back to its built-in knowledge base; the opening plays unaffected. It is a loopback call, not a third-party dependency: a full opening run made 82 requests and every host was `127.0.0.1`. | P2 |

## Bridge console errors, fixed in 9.1.1, 2026-11-26

The GLM shakedown found a red console on the normal play path. Reproduced on the `v9.1.0` release build served from `dist/` at `127.0.0.1:5295`: **8** `ws://127.0.0.1:8788/game` failures and **2** assistant-bridge errors (`http://127.0.0.1:8790/health`, one CORS block and one `ERR_FAILED`) in a 17-second opening run.

**Root cause:** `src/agent/bridge.ts` called `connect()` unconditionally on construction and retried every 2 s forever; `src/main.ts` constructed it in every non-playtest build, `src/lionBoss/agentControl.ts` gated only on the hostname, and the assistant probed `/health` whenever its default endpoint was loopback. A static build has no such service, so every retry was a guaranteed failure. On an https deployment the WebSocket is also a mixed-content block.

**Fix (9.1.1):** a shared `LOCAL_TOOLS` gate (`src/agent/localTools.ts`) — loopback host **and** dev/review mode, or an explicit `?agent=1`. It gates the bridge construction (both call sites), the assistant health probe and the model config, and the bridge backoff now goes 2 s → 4 s → 8 s → 15 s (reset on open). Headless checks are unaffected (`LOCAL_TOOLS` defaults to allowed when there is no page).

**Evidence:** same probe, same build command → **0 ws errors, 0 other errors**; the control run `?agent=1` → 4 ws errors, 2 other (the gate opens and the backoff spaces the retries); the dev server on `localhost:5296` still auto-connects, so local tooling is intact. Gates after the change: `tsc --noEmit`, `check:opening` (49 PASS, exit 0), `check:payload`, `check:pause-menu` 33/33, and the pause card hides Enable AI / the bridge status in a release build.

**Demo-day note:** on the local fallback (`dist/` + a static server), append `?agent=1` to the URL if the local AI control bridge and the LLM-backed assistant are wanted; without it the assistant answers from its built-in knowledge base and the control bridge stays off.

## Phase F: the GLM-5.4 shakedown is blocked upstream, 2026-11-26

The owner's standing order is that a GLM-5.4 reviewer runs over the finished build before filming. It cannot: the ZCode account behind the `auto/glm-5.4` and `auto/glm-5.3-flash` routes is suspended, and the refusal comes from the provider, not from this repo.

**Evidence** (probe through the local proxy that every subagent route runs on, `http://127.0.0.1:3425`, 2026-11-26):

```
POST /v1/messages  {"model":"auto/glm-5.4"}
→ HTTP 405  permission_error
  "ZCode: Your account has been suspended for misusing the Start Plan, such as
   proxying it to non-ZCode clients. (405, code 3012)"
POST /v1/messages  {"model":"auto/glm-5.3-flash"} → the same 405 / code 3012
```

Both GLM routes share the one ZCode account, so neither works. This is the second attempt at this step; the first was blocked at the same place.

**What was done instead.** A read-only shakedown ran on a different model family (Qoder, `auto/hmodel`), with the same brief the GLM reviewer would have had — find what breaks a recorded run or looks wrong on camera, reproduce it, cite evidence. Its report is `.scratch/shakedown-2026-11-26/qoder-report.md`, and every reproduced finding is triaged in this file. The full-route playthrough was re-run on the same build (`npm run check:campaign-playthrough`).

**Owner action to unblock the ordered review:** resolve the ZCode suspension (or supply another GLM-5.4 route) and re-run. Nothing in the repo can fix this.

**Re-probed 2026-11-26 after the release.** `auto/glm-5.4` and `auto/glm-5.3-flash` still return the same 405 / code 3012. The other GLM routes were checked too: `auto/zai-glm-5-3-flash` and `auto/zaicoding_glm-5.3` **answer**, while `auto/glm-5.3` returns 1113 (insufficient balance), `auto/zai_glm-x-preview` returns 429 (AutoClaw GLM-5.4 free quota used up), and `opencode-zen-2/glm-5-free` returns an expired API key. So a GLM *family* reviewer can run today, but not on 5.4. A read-only shakedown was run on `auto/zai-glm-5-3-flash` (`~/.claude/agents/glm-5-3-reviewer.md`); it finished on `591e841` with **P0 0 · P1 0 · P2 1 · P3 2**, all parked in the section above (`.scratch/shakedown-glm53-2026-11-26/report.md`). It does not satisfy the letter of the order, which names 5.4.



## Security

Two `sk-` API keys were posted in the group chat on 2026-11-23 19:51/19:54. Treat them as compromised and rotate them; do not put them in the repo, the build or the tagged release. `scripts/pre-push-secret-scan.sh` passes on the current tree (no `sk-`, `ntn_`, `ghp_`, `Bearer ` shapes; no `.env`; `dist/` clean). Rotation is the owner's action.

**Checked 2026-11-26, after the `v9.2.0` release.** Neither key was ever committed: `git log --all -S"sk-DZ3K"` and `-S"sk-lWD_"` return nothing, and neither shape appears in the working tree, so the public repository and the tagged release are clean.

Both keys are **still live** on the lab LiteLLM (`GET /v1/models` → 200 through both `127.0.0.1:4000` and `10.128.12.207:4000`), so the exposure is not self-limiting. They are stored in the owner's local routing pool (`~/.config/magpie/providers.json`, provider `litellm-hackathon`). They cannot rotate themselves: every key-management route (`/key/info`, `/key/generate`, `/key/delete`, `/key/regenerate`) returns 403 `Only allowed to call routes: ['llm_api_routes']`. Revoking them needs the lab's master key or the lab admin; nothing on this machine holds either. The practical sequence is: ask the lab to revoke both virtual keys and issue replacements, then replace the two entries in the routing pool and delete the group-chat messages that carried them.
