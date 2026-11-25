# Known issues — submission 9.1.0

Source: WeChat group “Vibe Coding Hackathon CDS SH”, 2026-11-23 19:33–20:02, plus the sidebar reports on 2026-11-21. Triage is Task 12.5; fixes route to Workstreams 6, 8, 9 and 11.

**Status as of 2026-11-25.** Every row below was re-checked against the tree, not against the plan. “Open” means the defect is still reachable in the build.

| # | Report | Severity | Status |
|---|---|---|---|
| 1 | “很多bug / 小细节” during a play session; the group will post repros | P1 | Open — no repro list arrived; the owner's own playtest on 2026-11-24 produced four defects, all closed (see below). |
| 2 | UI changed without the teammate knowing (`你是不是改过ui了？`) | P2 | Open — no “last approved UI frame” exists to diff against; the current UI is the one the owner plays. |
| 3 | Eight humanoid robots were added but are not in the current update | P1 | **Played and verified, 2026-11-25.** An independent playtest walked up to the fleet in real Chrome at `checkpoint=b5`: two columns of four at x 55.3/60.7, z −53.2…−47.8, about 1.7 m tall, both soles on the pavement, no detached or floating parts. Static gate `scripts/check-opening-fleet.ts:21` (eight units, eight routes, shared shell pool) also PASSes. |
| 4 | Robot dog: “很帅” but check speed/details | P2 | **Superseded.** The quadruped was replaced by the eight Unitree-style humanoids (`a843f99`, owner request 「加个八个人形机器人，宇树」); no quadruped shell remains in the build, and the single red-eye unit is humanoid too (`src/opening/robot.ts:19`). |
| 5 | Lion fight: story, quest and environment need a pass (`剧情，任务，环境`) | P1 | **Partly resolved.** Mission, combat nodes, interrupt/shutdown rules, hints and shelter logic exist in `src/lionBoss/` and are gated by `npm run check:lion-boss` (mechanics, rig, skills, lawn agent — all PASS). The narrative/environment *quality* pass has no recorded verdict; the owner's playtest is the judge. |
| 6 | “模型太慢了” — model/asset load is slow | P1 | **Resolved by measurement.** The first click now fetches 10 cues / 4.23 MB instead of 65 / 19.33 MB; `dist` is 30.8 MB, not 48.4 MB; 122/122 audio files decodable; `check:payload` asserts the ceilings. |
| 7 | Demo video expected | P1 | In progress — teaser v1 exists in `demo/teaser/`; the final video is recorded from the tagged build after the full playtest, in that order. |

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
| The B4 plaza entrance has no gate bank from the cds-lobby preview | Open | the running entrance is a broad glazed doorway; a runtime scene query found no turnstile/reader family |
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
| Reachable | 18 — the opening's own set, the credits theme, and the campaign beats (`mus_lawn`, `mus_lion_boss`, `mus_lion_victory`, `mus_puzzle`, `mus_sports`) |
| Reachable but never requested | none |
| Not registered | 6 — `mus_boss`, `mus_title`, `mus_dinner_toast`, `mus_abduction`, `mus_abduction_stinger`, `mus_march_alt` |

The six are cues for scenes this build does not contain (a titled fight variant, a title screen, the dinner toast, two abduction stingers and an alternate march). They still ship inside `dist/assets` because every music file is emitted regardless of registration; they cost load time only if something asks for them, and nothing does. The four-tower finale cue, `mus_finale`, is deliberately **not** wired: the ending has no light show yet, and playing it over the dome lift would fight the story bus's own bed. Wiring it belongs with that scene.

## B5 High Table Dinner has no beat, 2026-11-25

An independent QA run reached the hall, walked to the high table and pressed F (`.scratch/b5-dinner-qa/evidence-b5-dinner-pass2.json`, 14 shots, 0 page errors). The stage went from “Walk to the High Table Dinner” straight to “Collect the presentation MacBook”, the seats are empty, and the F attempt changed nothing (`toastAttempt.attempts[0]` stays on `to_b6`). The 135 console errors in that file are all the local control bridge (`ws://…/game`, `/health`) failing in a static build — not game defects.

So the hall exists as architecture (tables, cloth, lamps — see `b5-20-chandelier` … `b5-27-empty-seats-at-table`) but the seated guests and the toast of the plan's Phase 2 item 10 are not built, and `mus_dinner_toast` has nothing to play for. A second, wider QA pass (36 frames, `.scratch/b5-dinner-qa/report-b5-dinner.txt`) counted 12 figures in the room and **0 seated**, with ~77 chairs and ~80 covers laid. Standing at arm's length from the high table (0.43 m from its west face, 0.42 m from its north face, facing it) `F` returns only “Move closer and face the interaction”, so the table offers no interaction at all; the engine's own `reachB5()` is gated on `stage === "return_b5"`, which the B5 checkpoint never reaches. Walking into the hall flips the objective to “Collect the presentation MacBook” at `[73.635, 0.02, -59.001]`, about 7.0 m from the table's nearest corner — inside the hall, not at the door (an earlier reading of “side lobby, 24 m” was wrong and is corrected here). Closing the beat is a content decision, not a bug fix: it needs seated figures, a toast trigger and a hand-off line, and a decision about where B5 ends.

## The pause menu, 2026-11-25

The owner reported that the pause card could not reach the chapter select — 「replay intro 不知道为什么不放在 chapter 里。chapter 为什么不放在暂停页面。现在 chapter 根本点不到」 — and asked for the pause settings to be done properly.

**Root cause, measured on the review build:** `.shell-chapters` and `.fullscreen-toggle` sit at `z-index: 11`; `#pause-panel { position: absolute; inset: 0; z-index: 12 }` covers both for as long as the panel is in the DOM, and while the game runs the pointer is locked — so the floating “Chapters” link has never been clickable. The offset was not the problem; the stacking order was.

**Fix** (`src/main.ts`, `src/opening/chapterMenu.ts`, `src/style.css`, `src/opening/gameShell.ts`): the pause card now holds a Chapter group — Replay intro, Return to checkpoint, and a collapsed chapter select listing all eight checkpoints in four chapter groups — and a Settings group (music, ambient and mouse sensitivity with live values, plus Full screen and the full “Settings & save” dialog). The floating link is hidden while the card is open by a CSS `:has()` rule, so it cannot look clickable underneath the overlay, and the card is the single scroll container (a nested list scroller had put the last chapter rows and the Settings section below the card's edge on a phone). The taller card also reaches over the Add to Home Screen pill on a 390 px phone, where its Dismiss button used to sit just above the card; the pill is now hidden while the card is open and appears as soon as play starts, so nothing on the menu screen is a dead target (`check:fullscreen` pins both states). `scripts/check-pause-menu.py` (headless; `npm run check:pause-menu`) drives the real card: 48 px replay target, reachability judged by `elementFromPoint` (Chrome keeps layout boxes inside a closed `<details>`, so `getClientRects()` is not a visibility test), a real click on the B4 checkpoint that lands on `?experience=opening&checkpoint=b6`, slider → dialog value agreement, and the 390×844 touch layout.

## Security

Two `sk-` API keys were posted in the group chat on 2026-11-23 19:51/19:54. Treat them as compromised and rotate them; do not put them in the repo, the build or the tagged release. `scripts/pre-push-secret-scan.sh` passes on the current tree (no `sk-`, `ntn_`, `ghp_`, `Bearer ` shapes; no `.env`; `dist/` clean). Rotation is the owner's action.
