# Game completion plan — six phases, one goal each

**Written 2026-11-25.** This is the plan the owner asked for: every phase below is a self-contained goal prompt. Run them in order, one at a time. A phase is done only when its gate is green, its work is committed and pushed, and its live link is handed over.

- Worktree: `/Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world` — branch `feat/one-world`, HEAD `ced3e86`
- Remote: `https://github.com/ThomasLin070217/hku-shanghai-campus.git` (push `HEAD:main`)
- Live: `https://thomaslin070217.github.io/hku-shanghai-campus/`
- Main repo (reference material, not the build): `/Users/onezion12344/Projects/hku-shanghai-campus`

---

## 0. Where the build is (2026-11-25)

**The "students disappear after the MacBook mission" bug is fixed in the working tree, but not proven and not committed.** The plaza crowd now walks into the B5 hall and each student takes a unique standing place instead of collapsing to scale 0 at one lobby point.

- Verified earlier in the browser: full `check:campaign-playthrough` **66 passed / 0 failed**, and `?experience=opening&intro=0&checkpoint=b5` showed **52/52 students in the hall**, stable over 30 s.
- The last two changes (chair-aware places, tick-free ground query) are **not re-verified** yet. Phase A re-verifies everything.
- An independent adversarial review found real defects in that fix (D1–D9 below). Two are visible: students float during the `crowd` stage, and 41 of 52 walk straight through dinner tables. Phase A closes them.
- Nothing is committed on top of `ced3e86`. Nothing is pushed. `dist-review` is stale.

Uncommitted files (do not discard):

```
modified: package.json
modified: scripts/check-campaign-playthrough.py
modified: src/exploration/navigation.ts
modified: src/opening/experience.ts
modified: src/opening/navigation.ts
modified: src/opening/spatialLayout.ts
new:      scripts/check-opening-crowd-arrivals.ts
new:      scripts/check-opening-crowd-gate.ts
new:      scripts/check-opening-crowd-pure.ts
new:      src/opening/crowdArrivals.ts
new:      src/opening/crowdWalk.ts
```

---

## 1. Rules for every phase

1. **One phase per goal.** Do not start the next phase. If blocked, stop and report what is blocked and why.
2. **Commit in verified units**; never `git add -A` — name every path. Push `HEAD:main` when the gate is green, confirm the Pages deploy, reply with the link.
3. **Every change is played or gated.** A subagent must actually play the changed beat in ego lite, or an automated gate must exercise the shipped code. "It compiles" is not proof.
4. **A passing gate is not proof.** A control must print a number that would change if the thing broke. `0 vs 0` proves nothing. If a gate fails on the new build and passes on the old one, trace the mechanism on both before calling it a regression.
5. **One browser job at a time.** Do not kill processes you did not start (two Vite dev servers on ports 5266 and 5260 are the owner's and are off-limits).
6. **No WebSearch / WebFetch.** Research goes through AnySearch (`mcporter call https://api.anysearch.com/mcp ...`).
7. **Never print, log, or commit key material.** Run `scripts/pre-push-secret-scan.sh` before any push that touches docs/assets.
8. **A subagent unreachable by name is not gone.** Recover it by its on-disk `agentId`.
9. **The owner hands out the acceptance.** Hand over link + screenshots and wait for the owner's verdict where the gate is visual (C, D, E, B's iPhone step).

### Commands that recur

```bash
# typecheck
npx tsc --noEmit

# the CI gate (runs on every push; no browser needed)
npm run -s check:opening          # runs check-opening-state.ts first, then every opening gate
npm run -s check:chapter-select

# review build + local server
npm run -s build:review          # tsc --noEmit && vite build --mode review -> dist-review
python3.13 -m http.server 5293 --bind 127.0.0.1 --directory dist-review &

# full campaign playthrough (browser; expect "66 passed, 0 failed")
CAMPUS_URL=http://127.0.0.1:5293/ \
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
python3 scripts/check-campaign-playthrough.py

# phone layout (needs a preview server on 5252, not the plain static server)
npx vite preview --mode review --host 127.0.0.1 --port 5252 &
CAMPUS_URL=http://127.0.0.1:5252/ \
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
PYTHON=python3.13 python3.13 scripts/check-opening-phone.py

# push and deploy
https_proxy=http://127.0.0.1:7891 http_proxy=http://127.0.0.1:7891 \
  git -c http.version=HTTP/1.1 push origin HEAD:main
```

Debug hooks in review builds: `window.__CAMPUS` (`viewer.scene`, `viewer.renderer`, `explorer.game`, `explorer.camera`, `explorer.world`, `openingDebug.*`). Opening checkpoints: `?experience=opening&intro=0&checkpoint=b5` (and `bus`, `b6`, `b5safe`, `handoff`).

---

## Phase A — Close the crowd fix

**Goal:** the crowd fix is proven, all nine review findings are closed, and a playable build is pushed.

### A1 (D1) — the crowd must not drive the lift/office clock

The player's ground query `explorer.world.support` is `openingSupport`, which calls `tickOffice` and `tickLift` on every call (`src/exploration/navigation.ts:145`). The crowd asks for the floor ~52 times a frame. Before the fix, a crowd alone could spend the office's one-shot `lobby_feed` beat and carry a called lift the whole 18.88 m.

The fix in the tree: `ground()` split out; `support()` = ground → `openingSupport`; `floorAt()` = ground → `openingFloor` (no ticks); `crowdWorld(base)` delegates to `base().floorAt`; `experience.ts:107` is `crowdWorld(() => explorer.world)`.

Proof (`scripts/check-opening-crowd-pure.ts`, being rebuilt): **one** real world `createNavigation(BUILDINGS, SITE, true)` — the same construction `explorer/controller.ts:15` uses. No look-alike:

- office: the player's query in the CCTV trigger fires `lobby_feed` (control); 60 crowd queries at the same point fire nothing.
- lift: player queries carry a called car more than half way (control); crowd queries for at least 1.5× the ride move it **0.000 m**, change no phase, leave `LIFT.call` waiting.
- mutation check: make `crowdWorld` call `base().support` → both controls' matching assertions must fail.
- the first version of this test built its crowd side on `createNavigation(..., false)` — a world the game never builds — and passed while the shipped crowd still ticked. Never reintroduce that.

### A2 (D3) — no floating students during the `crowd` stage

`updateCrowd` (`src/opening/experience.ts:157`) returns before baking whenever `!crowdWalking`, so during the whole `crowd` stage the instances render from build-time matrices at `CROWD.floor=0.3`: every student floats 18–30 cm and snaps down when the walk starts. Bake whenever the crowd is shown or a reset changed positions; keep the walking latch.

### A3 (D2) — the walk must not cross the dinner tables

`enterHallPath` returns `[door, place]`; the straight line crosses a table for 41 of 52 students (review, longest chord 2.86 m). Replace with a real hall route:

- grid over the hall (cell ≈ .4 m), a cell open only if `blocked(x, z, floor, .3)` is false **and** it is clear of `dinnerChairPlaces()` by .3 m (chairs have no collision — this is why they must be passed in);
- 4-connected BFS from the door cell (one grid + one BFS for all places);
- string-pull each path, sampling the visibility check every 5 cm;
- assert **every segment** of every student's hall path, sampled at 5 cm; control: the old straight door→place lines cross tables for at least 8 of the 52.

### A4 (D4) — one gate runs the shipped crowd block

No gate currently executes the crowd code in `experience.ts`; mutations that never show the crowd, reintroduce the vanish, or let the stage own visibility all pass. Extract the crowd block (place derivation, stage visibility, walking latch, per-checkpoint restore, bake decision) into a pure module with the stage, world and clock injected; `experience.ts` calls it. Gate it: shown per stage, walks once, restores per checkpoint, never collapses or vanishes, feet on the floor.

### A5 — the small findings

- **D5:** replace the "same ground" comparison between `support` and `floorAt` with checks against known heights (hall floor .02, bus floor .54, 5F landing 18.90).
- **D6:** comments: the walk takes up to ~182 s (not 100–140 s); the "first nine waypoints" comment (43/52 head for waypoint 0; fix the start target so they don't U-turn); the office-beat comment.
- **D7:** guard `crowdPlaces[index]!` (the hall seats 581 ≥ 52); `crowdStartTarget` loops `i<9` over a 12-point route.
- **D8:** `enterHallPath` cut-off at `fromX > 60.6` routes x=60.6 back west.
- **D9:** per-frame `.entries()` allocation (bounded; clean it up).
- Note (not a bug): `crowdPlaces` is derived once and not re-derived after a campus rebuild (editor-only path).

### A6 — the browser proof

Add a committed browser probe, e.g. `scripts/check-opening-crowd-b5.py` (not in `check:opening`; CI has no browser), that boots `?experience=opening&intro=0&checkpoint=b5` on `dist-review` and asserts via `window.__CAMPUS`:

- 52 student instances, all inside the hall, none on the plaza;
- 0 standing inside a chair footprint (`dinnerChairPlaces()`);
- 0 floating: feet within 2 cm of the floor; stable over 30 s;
- 0 page errors.

### Gate

```
npx tsc --noEmit                                   # 0 errors
npm run -s check:opening                           # all pass (runs check-opening-state first, includes the 3 crowd checks)
npm run -s check:chapter-select
npm run -s build:review
# serve dist-review on 5293, then:
check:campaign-playthrough                         # 66 passed / 0 failed
scripts/check-opening-crowd-b5.py                  # the four facts above
```

Plus: a subagent walks the crowd into B5 in ego lite (not only gates), and the screenshots are attached to the report.

### Deliverable

One commit per verified unit, named paths; push `HEAD:main`; confirm Pages; reply with the link and the gate numbers.

### Goal prompt — Phase A (paste into /goal)

```
Working directory: /Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world (branch feat/one-world, HEAD ced3e86).
Read docs/plans/2026-11-25-game-completion-phases.md and execute ONLY Phase A ("Close the crowd fix").

The working tree already contains the crowd fix, uncommitted — do not discard it. Close the review findings D1–D9 exactly as Phase A specifies: prove the crowd never drives the lift/office clock on the real world, stop the floating during the crowd stage, route students through the hall aisles instead of through tables, add a gate that runs the shipped crowd block, and fix the small findings and stale comments. Then prove it in a browser: 52/52 in the hall at the b5 checkpoint, none in a chair, none floating, 0 page errors; full campaign playthrough 66/0.

Rules: name every path you git add (never git add -A); commit in verified units; a subagent must actually walk the crowd into B5; no WebSearch/WebFetch. When the gate is green: commit, push origin HEAD:main, confirm the Pages deploy, and reply with the live link and the gate numbers. Stop there — do not start Phase B.
```

---

## Phase B — Mobile experience + fullscreen

**Goal:** the game is comfortably playable on a phone and can go fullscreen from inside the game.

### What exists

- Touch controls: `src/opening/touchInput.ts` (joystick dead zone 0.16, axes mapping), used by `experience.ts` / `ui.ts` / `main.ts`.
- Checks: `npm run -s check:mobile` (pure joystick/touch/quality/viewport) and `scripts/check-opening-phone.py` (drives the opening at 1280×800 and 390×844).
- `index.html` already has `viewport-fit=cover` and a theme colour; **no** apple/mobile meta, **no** manifest, **no** fullscreen code anywhere.

### Work

1. **Fullscreen module** — new `src/opening/fullscreen.ts`, pure logic separated from DOM:
   - feature-detect `document.fullscreenEnabled && documentElement.requestFullscreen`;
   - request on a real tap (browsers require a gesture — never auto-request on load);
   - `F` on desktop; `Esc` exits (browser default);
   - icon/state follows `fullscreenchange` (not the click);
   - resize the canvas and HUD on `fullscreenchange`, `orientationchange`, `visualViewport.resize`.
2. **Button** — top-right, ≥44×44 px, visible in every mode (opening, campaign, prologue, sports); does not overlap the existing HUD/pause; safe-area padding.
3. **iPhone fallback** — where the Fullscreen API is unavailable (iPhone Safari generally exposes it only for video), show a dismissible one-line hint: **Add to Home Screen** to play full screen. Add `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `mobile-web-app-capable`, a `manifest.webmanifest` with `display: "standalone"`, and `env(safe-area-inset-*)` padding. In standalone mode (`navigator.standalone`) hide the hint. The game must never depend on fullscreen to be playable.
4. **Mobile pass** at 390×844 and 430×932, portrait and landscape: joystick, look, interact, panels, keyboard prompts, ≥44 px targets, no hover-only affordances, pause when the tab is backgrounded, audio unlock on first tap, auto quality, measured FPS.

### Gate

```
npm run -s check:mobile              # extended with the pure fullscreen logic
scripts/check-fullscreen.py          # new: real click -> document.fullscreenElement, exit, 390x844
npm run -s check-opening-phone       # via vite preview --mode review on 5252
npx tsc --noEmit
```

Screenshots: 390×844 portrait, 844×390 landscape, fullscreen on/off, the iPhone fallback hint.

**Owner acceptance:** hand over the link and ask the owner to open it on the iPhone and report: (a) the fullscreen button, (b) Add to Home Screen, (c) the joystick/look/interact response. This step cannot be faked by emulation.

### Goal prompt — Phase B (paste into /goal)

```
Working directory: /Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world (branch feat/one-world).
Read docs/plans/2026-11-25-game-completion-phases.md and execute ONLY Phase B ("Mobile experience + fullscreen").

Add an in-game fullscreen button (≥44 px, one tap, F on desktop), feature-detected; a working iPhone fallback (Add to Home Screen / standalone: meta + manifest + safe-area padding, dismissible hint); canvas/HUD resize on fullscreenchange and rotation; and a full mobile pass at 390×844 and 430×932 (joystick, look, interact, panels, ≥44 px targets, no hover-only actions, pause on background, audio unlock, auto quality + FPS). Extend check-mobile, add a fullscreen browser check, and extend the phone check with screenshots in portrait and landscape.

Rules: name every path you git add (never git add -A); a subagent must play it on an emulated phone; no WebSearch/WebFetch. When the gate is green: commit, push origin HEAD:main, confirm the deploy, reply with the link, and ask the owner to test on the real iPhone. Stop there — do not start Phase C.
```

---

## Phase C — CDS-1 (B4 ground lobby) layout

**Goal:** the B4 ground lobby matches the official CDS-1 atrium look closely enough that the owner stops calling it wrong.

### What exists

- Room `OPENING.b4`: x 46–70, z 7–20.5, north door at (58, 20.5); built by `src/opening/b4Layout.ts` and the B4 shell/scenery code.
- Current built values (from the layout): keyboard band panel y **1.565–3.715** (too high), three tiers only **0.52 m** deep, ceiling `0xb7a78f`, floor `0xe9dbc5`, rug `0x8f9fac` at `r 2.4`.
- Reference: `/Users/onezion12344/Projects/hku-shanghai-campus/research/photos-2026-11-10/05-cds-zj-atrium.webp` (official atrium photo).

### Work

1. Photograph the built lobby from the door, and from inside the atrium, and put the shots beside the reference before changing anything.
2. Rebuild toward the reference: low ~1.1 m keyboard band; wide shallow tiers; cool-white palette; a larger rug; a long straight cream sofa plus one large curved cream sofa; two tan lounge chairs; white drum tables; white ceiling with a curved soffit. Keep the room's footprint, door, lift and flip-wall stations where they are.
3. Verify collision matches what is drawn (no invisible walls, no walk-through furniture).

### Gate

```
npm run -s check:opening
npm run -s check:interior-surfaces
npm run -s check:b4-flip-room
npm run -s check:campaign-b4
```

Side-by-side screenshots (door + atrium vs the reference) attached; a subagent walks the lobby and reports. Owner approves the screenshots before the phase closes.

### Goal prompt — Phase C (paste into /goal)

```
Working directory: /Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world (branch feat/one-world).
Read docs/plans/2026-11-25-game-completion-phases.md and execute ONLY Phase C ("CDS-1 lobby layout").

The B4 ground lobby still reads wrong. Photograph the built room from the door and from the atrium, put the shots beside the reference photo /Users/onezion12344/Projects/hku-shanghai-campus/research/photos-2026-11-10/05-cds-zj-atrium.webp, then rebuild it toward the official atrium: low ~1.1 m keyboard band, wide shallow tiers, cool-white palette, larger rug, long straight + large curved cream sofas, two tan lounge chairs, white drum tables, white ceiling with curved soffit. Keep the room footprint, door, lift and flip wall. Collision must match what is drawn.

Gate: check:opening, check:interior-surfaces, check:b4-flip-room, check:campaign-b4; side-by-side screenshots; a subagent walks the room.

Rules: name every path you git add (never git add -A); no WebSearch/WebFetch. When green: commit, push origin HEAD:main, reply with the link and the screenshots for the owner's approval. Stop there — do not start Phase D.
```

---

## Phase D — B5 High Table Dinner beat

**Goal:** the dinner is a real beat, not scenery: seated guests, a dressed high table, a toast the player performs, and the hand-off.

### What exists

- 8 dinner tables (5.4 × 1.2 m) and **77 chairs** — the exact footprints are `dinnerChairPlaces()` in `src/opening/spatialLayout.ts`; the tables come from `dinnerTables()`.
- The high table sits at world **(80.8, −66.6)** on the dais; `DINNER_HEAD` holds the head table/lectern/head-chair boxes.
- 11 cast NPCs already stand in the hall (`OPENING_CAST` in `src/opening/npcs.ts`), including the Dinner coordinator who leads the player in.
- `mus_dinner_toast` is registered in `src/gameplay/storyAudioAssets.ts:70` and `storyAudio.ts`; the dinner hand-off owns the interaction slot on `to_b5` (`src/opening/b4Office.ts:235`).
- `createStudentCrowd` has **no seated pose** — it instances standing characters. Do not try to rig it.

### Work

1. **Seated guests:** add a small seated guest mesh (or a seated variant) placed on the 77 chairs, using the students' palette. The 52 walkers stay as the standing room crowd. Do not put a seated guest on a capture chair that is animated elsewhere.
2. **Table dressing:** green cloth, lamps, glasses on the tables; keep the aisles clear (the crowd stands there).
3. **The toast:** a real interaction target at the high table. Prompt → a short line → the player raises a glass → `mus_dinner_toast` plays **exactly once** → the seated guests' glasses rise → hand-off line. Skippable; cannot soft-lock; works on the normal route and from `?experience=opening&intro=0&checkpoint=b5`.
4. **Gate the beat:** a pure check for the interaction's one-shot state and skip path, plus a subagent that plays it in ego lite.

### Gate

```
npm run -s check:opening          # npcs, crowd, integration
npx tsc --noEmit
# new: scripts/check-dinner-toast.ts (one-shot, skip, no soft-lock)
# browser: boot checkpoint=b5, play the toast, screenshots
```

Audio acceptance: the cue is requested exactly once (log it in dev builds if the mixer exposes no counter).

### Goal prompt — Phase D (paste into /goal)

```
Working directory: /Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world (branch feat/one-world).
Read docs/plans/2026-11-25-game-completion-phases.md and execute ONLY Phase D ("B5 High Table Dinner beat").

Build the dinner beat: seated guests on the 77 chairs (a new seated guest mesh — do not rig the instanced crowd), dressed tables with green cloth, lamps and glasses, and a real interaction target at the high table (world 80.8,-66.6). On interact: prompt -> short line -> the player raises a glass -> mus_dinner_toast exactly once -> the guests raise their glasses -> hand-off line. Skippable, cannot soft-lock, works on the normal route and from ?experience=opening&intro=0&checkpoint=b5. Keep the aisles clear — the 52 arrivals stand there.

Gate: check:opening, tsc, a new one-shot/skip check, and a subagent that plays the beat end to end in ego lite with screenshots.

Rules: name every path you git add (never git add -A); no WebSearch/WebFetch. When green: commit, push origin HEAD:main, reply with the link. Stop there — do not start Phase E.
```

---

## Phase E — Four-tower finale + light show

**Goal:** the story ends with a campus-wide light show on the four towers, scored by `mus_finale`.

### What exists

- The four towers are B01–B04 in `src/model/campusParameters.ts` (`BUILDINGS`); B04 is the band tower at the atrium.
- `mus_finale` is registered in `src/gameplay/storyAudioAssets.ts:82`.
- The night/exterior look already lives in `src/opening/exteriorLighting.ts`; reuse it, do not add a second renderer.

### Work

1. A mesh light show over B01–B04: emissive window bands, tower-to-tower links, an atrium ring; **no central core** (owner's brief).
2. Trigger it at the campaign's closing beat (after the dome release, before the credits). Keep the credits reachable; make the beat skip-safe; cannot soft-lock.
3. `mus_finale` plays exactly once, with the visual phrase.
4. Measure frame time on the review build; target 60 fps at 1280×800 and no worse than the current mobile quality on 390×844.

### Gate

```
npm run -s check:opening
npx tsc --noEmit
# new: a finale state check (trigger once, skip path, credits reachable)
# browser: play the finale; screenshots; frame-time numbers
```

### Goal prompt — Phase E (paste into /goal)

```
Working directory: /Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world (branch feat/one-world).
Read docs/plans/2026-11-25-game-completion-phases.md and execute ONLY Phase E ("Four-tower finale + light show").

Build the finale: a mesh light show on the four towers B01-B04 — emissive window bands, tower-to-tower links, an atrium ring, no central core. Trigger it at the campaign's closing beat (after the dome release, before the credits), skip-safe, no soft-lock, credits still reachable, mus_finale exactly once. Reuse exteriorLighting.ts. Measure frame time on the review build and report the numbers.

Gate: check:opening, tsc, a new finale state check, a subagent that plays the finale, screenshots.

Rules: name every path you git add (never git add -A); no WebSearch/WebFetch. When green: commit, push origin HEAD:main, reply with the link and the frame-time numbers. Stop there — do not start Phase F.
```

---

## Phase F — Release, GLM-5.4 shakedown, playtest handover

**Goal:** a tagged, dated, playable build; the owner-ordered GLM-5.4 shakedown run and its fixes landed; the build handed to the owner for the full playtest that precedes the video.

### Work

1. **Version + name:** `VERSION`, `package.json`, `__CAMPUS.version` all agree; the title follows the owner's ruling — **HKU Shanghai at War**, subtitle **BARRIER 2030** (the current document title is "HKU: Barrier 2030"). `check:version` green.
2. **Tag:** `git tag -a v9.1.x` on the playable commit (first tag `v9.1.0`; every later playable version gets its own tag). The filmed build must be a tag, never a dirty tree.
3. **Known issues:** update `submission/KNOWN-ISSUES.md` with everything still open (P2s and anything the shakedown could not fix).
4. **Secret scan:** `scripts/pre-push-secret-scan.sh` over tracked files and `dist/`; clean. The two exposed `sk-` keys still need owner rotation — remind, do not do it.
5. **GLM-5.4 shakedown (owner's order: only after all game work, before the video):** dispatch `glm-reviewer` on model string `auto/glm-5.4` (dotted, not the hyphenated group id) against the tagged build. Brief it with the full route, the gates, the playtest harness in `.scratch/`, and the owner's complaints (MacBook hand-in students vanishing, 建模很糟糕, 模型太慢). It reviews **and fixes**, one commit per reproduced defect, and reports a NOT FIXED list with reasons. Triage: take reproduced fixes, reject scope/route changes; hand the NOT FIXED list to the owner.
6. **Re-gate after its fixes:** `tsc --noEmit`, `check:opening`, `check:interior-surfaces`, `check:payload`, `check:version`, full playthrough, phone check. If anything changed, cut the next patch tag.
7. **Handover:** the owner plays the tagged build end to end (fresh boot, no chapter jumps) and reports bugs; fix only P0/P1 (new tag if the build changes); the owner re-plays; **then** the video is recorded from the tagged build (canvas capture → ffmpeg). No video before the playtest.

### Gate

```
npm run -s check:version
npm run -s check:payload
scripts/pre-push-secret-scan.sh
git checkout <tag> && npm ci && npm run -s check:opening && npm run build   # the tag really builds
```

### Goal prompt — Phase F (paste into /goal)

```
Working directory: /Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world (branch feat/one-world).
Read docs/plans/2026-11-25-game-completion-phases.md and execute ONLY Phase F ("Release, GLM-5.4 shakedown, playtest handover").

Make the release: version label in VERSION/package.json/__CAMPUS.version, title per the ruling (HKU Shanghai at War; BARRIER 2030 subtitle), KNOWN-ISSUES updated, secret scan clean, tag the playable build v9.1.x, verify the tag builds. Then dispatch glm-reviewer on auto/glm-5.4 for the owner-ordered shakedown (review AND fix, one commit per reproduced defect, a NOT FIXED list with reasons); triage its report, re-run the gates, and cut a patch tag if the build changed. Then hand the tag + link + NOT FIXED list to the owner for the full playtest.

Do not record the video. The owner plays first; fixes come after; the video is recorded from the tagged build.

Rules: name every path you git add (never git add -A); no WebSearch/WebFetch; never print key material. Reply with the tag, the link, the gate numbers, and the NOT FIXED list.
```

---

## 2. Order and dependencies

```
A (crowd fix) → B (mobile + fullscreen) → C (CDS-1 lobby) → D (dinner) → E (finale) → F (release)
```

- B before C/D/E means every later phase is verified on a phone as well as a desktop.
- C, D and E are independent of each other in code; the order is the owner's call. D depends on A (the crowd arrives) and benefits from C only visually.
- F depends on all of them. The GLM shakedown is **inside** F and must not run earlier (owner's ruling: finished game first).

## 3. Open decisions (do not block)

1. **MacBook location:** today it is in Building 6 (the copy "Building 6" is correct); the older plan moves the errand to the B4 5F principal's office (the lift and office are already built). Recommendation: keep B6 for this build — moving it is a story change, not a bug fix.
2. **Dinner seating:** seated guests are new static meshes; the 52 arrivals keep standing in the aisles. Rigging all 52 to sit is out of scope.
3. **iPhone fullscreen:** the code feature-detects and falls back to Add to Home Screen; the real-device check is the owner's.

## 4. Facts worth not rediscovering

- Camera convention: forward = `(-sin yaw, 0, -cos yaw)`; yaw −π/2 → +x, yaw π → +z.
- Hall transform: `dinnerHallPoint(x,z) = [60.5 + (-60 - z), -78 + (x - 60.5)]`; tables run along world x; chairs stand on the long sides in world z at ±0.95, back .18 further out; chairs are **scenery with no collision** and are merged into one mesh per material.
- B5 hall: x 54–82, z −80…−54.7, floor .02; partition at x=60 with the opening at z −63…−57.6.
- `world.support` (player) = `openingSupport` (ticks the lift/office); `world.floorAt` (anything else) = the same floors, no ticks.
- `build:review` does not empty `dist-review`; the opening code lives in `dist-review/assets/style-<hash>.js`, not the tiny `main-*.js` entry.
- Lift timing: doors .8 s, dwell 1.4 s, travel 6.0 s; the ride needs 9.0 s of lift time; queries must come at simulation rate (<~60–80 ms gaps) or the clock under-advances.
- A body teleported to a height falls to the floor (gravity + camera follow), so "high" screenshots need a different method; the canvas is not buffer-preserved, so free-camera `toDataURL` reads black.
- `grep --include=*.ts` fails under zsh (use `rtk bypass grep -rn`); `pgrep -f headless` matches VS Code — use `pgrep -f 'Google Chrome.*--headless'`.
