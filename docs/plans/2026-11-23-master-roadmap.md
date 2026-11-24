# Master roadmap — every open issue, one plan (2026-11-23)

> **Plan version:** 1.2 · 2026-11-24 (owner rulings applied: new title, tag-based release, score/voice, realism review).
> **Status:** executing. Teaser v1 is built; `VERSION` / `CHANGELOG.md`, the tag release model, the title rename and the audition pipeline are in place; nothing is pushed or uploaded.
> **Worktree:** `/Users/onezion12344/Projects/hku-shanghai-campus-wt/one-world`
> **Branch:** `feat/one-world` · **HEAD:** `d6e17f8` · **Base:** `4c91f06`
> **Rule:** a passing check is not owner acceptance. Merge/push waits for explicit OK.

## Read this first — the recommended order

| # | Workstream | What it fixes | Status |
|---|---|---|---|
| 1 | **Input + UI correctness** | pause cannot select a chapter; drag look is broken | NEW · P0 |
| 2 | **Canon + B4 route** | flip wall is in B5, should be B4 side entrance; MacBook errand goes to B6, should be B4 5F; B4 stairs/hollow pipe are rough | NEW · P0 |
| 3 | **Opening** | Magic Hour, crowd, phone invitation, one continuous take, dusk, light beam | IN FLIGHT (`opening-mvp`) |
| 4 | **Dinner + music** | B5 dinner modelling, lamps, toasts, atmosphere, a dinner cue | NEW + `music.md` |
| 5 | **Finale light show** | the whole campus lights up; the ending needs its show | NEW |
| 6 | **Characters + robots** | hover “who is this”, lore, voice, chat; real cohort names; author credit; robot speed, humanoid robots, vision, coordination | NEW |
| 7 | **Route effects + power** | B4 keyboard effect, exterior lit building, beam, flip-wall puzzle, breaker, MacBook | `route-effects.md`, needs the B4 rewrite |
| 8 | **World scope + memory** | sports hall, B01–B03 lobbies, tennis, streaming, memory; B5 4F+ later | `world-scope-perf.md` + NEW memory pass |
| 9 | **Lion + rescue** | skill composition, student rescue, lion feet evidence | `lion-skill-system.md`, `student-rescue.md`; feet code approved |
| 10 | **Visitor experience + demo + teaser** | first-time visitor route, campus records, 15-minute demo, 35–45 s spoiler-free teaser | NEW |
| 11 | **Verification** | Ego lite full playtest, every gate, owner acceptance | NEW |
| 12 | **Release + submission** | version number, git tag, playable link, slides, demo video | NEW · P0 (tonight) |

**The spine stays exploration.** The competition brief is a playable campus exploration game for first-time visitors — “Your campus. Your game.” The story, dinner and finale are the frame; the player must still walk the campus, find landmarks and discover records.

**Submission tonight (group chat, 2026-11-23):** the lab asked for a playable link, a fixed source version, the demo video and slides. The owner ruled **tag-based delivery**: no frozen archive, no checksums, no upload from this repo; the owner pushes the tag, deploys and shares the link.

**Today’s group requirements (source: WeChat group “Vibe Coding Hackathon CDS SH”, `46098846930@chatroom`):**
- 15:46 — share the slide, source code and demo video via the SharePoint link.
- 18:55 — “今晚弄一下交上去” (submit tonight).
- 19:05–19:07 — give a playable link plus a **frozen version** of the source code.
- 19:45 — the eight humanoid robots were added but are not in the current update.
- 19:57 — the lion fight needs its story, quest and environment pass.
- 19:56 / 20:01 — a demo video is expected.

**Decisions needed before Phase 1:** confirm the B4 exterior face after the Task 2.1 pre-flight, the B4 5F MacBook errand, B6 as the architectural core, and the opening’s interior beats/closing line. Phase 0 can start without a new decision. **Release:** version label decided (`v9.1.0`); the owner hosts and deploys.

## Pre-flight corrections (after three read-only reviews)

These were caught before implementation. They override the older numbers in the task text below.

| # | Correction | Why |
|---|---|---|
| 1 | **The B4 side-door coordinates are provisional.** `(50, .02, 7)` is the inner shell wall, not the building's exterior face; the flip-room ORIGIN overhangs the z=7 line by ~0.9 m, puts the closet outside x=46, and swallows racks 1–3. Task 2.1 must first derive the real exterior face from the B04 footprint (x 28.15–87.85, z −24.5…20.5), then cut the door, then fit the room with a 0.2 m margin. Move or remove racks 1–3; add `src/opening/b4Layout.ts` (`B4_OBSTACLES`) and split the north wall into two leaves + lintel. Do not cut until the bounding-box gate passes. | Canon/feasibility review; the owner's “side door, turn right” direction is unchanged. |
| 2 | **The finale must prove a mesh, not a star.** No “central core beam.” Four towers light in a mesh with tower-to-tower links; B06 + the atrium ring are an architectural gathering ring, not a compute master core. The ending must show “take a tower away, the machine keeps thinking.” | Owner's decentralised-computer ruling; the earlier wording contradicted it. |
| 3 | **At review time the working tree was red on `story.stage === 'bus'`.** `contracts.ts` no longer has `'bus'`, `experience.ts` still uses it, and `check-opening-state.ts` still asserts it. **Task 3.0** re-checks and reconciles this before Tasks 1.1/1.2 run typecheck. | Feasibility review; the opening MVP is mid-flight. |
| 4 | **`npm run typecheck` / `npm run build` may fail in this checkout** (symlinked `node_modules`). Use `node_modules/.bin/tsc --noEmit` and `node_modules/.bin/vite build`, as `docs/PERFORMANCE.md` already says. | Feasibility review; every gate line uses these. |
| 5 | **Order:** pull the flip-wall puzzle (7.4) into Phase 1; Task 5.1 **creates** `src/opening/exteriorLighting.ts`, Task 7.3 reuses it; Task 8.8 (`check:perf`) runs before 8.2; the B6 core dressing is Task 2.5; the one-page/no-reload gates (`check-campaign-browser.py`, `check-campaign-walk.ts`) are in the acceptance list. | Canon/feasibility review; the route demos as scenery otherwise. |
| 6 | **SFX is a task, not a footnote.** Task 6.8 audits and fills UI, door, footstep, ambience, robot, lift and flip-wall sounds. | Owner's “SFX” deliverable had no owner. |
| 7 | **Source paths:** the WeChat note lives in the main hackathon repo `research/wechat-sources-2026-11-23.md`, not the game worktree's `research/`. The exact owner quote for the B4 flip wall is recorded in `.scratch/master-roadmap-inventory.md`. | Fidelity review; the “saved” check was at the wrong path. |
| 8 | **Memory target is provisional.** The 80 MB heap target is not reachable from geometry ≤14 MB + textures ≤4 MB (≈93 MB). Measure with a new heap hook, then set ≤85–90 MB after streaming; `__CAMPUS.memory()` has no heap today and exists only in DEV/review builds. | Feasibility review; the old target was aspirational. |
| 9 | **B3's laser partner is not named in the source.** The WeChat note says B3 and “two buildings echo”; B5 is named only as the dinner venue. Do not assert B5 as the laser partner without the video/site confirmation. | Fidelity review; inference vs source. |
| 10 | **One-page/no-reload proof is back in acceptance.** The live demo and the game must keep `location.href` unchanged, `__doc === 1`, and one first-person run; the finale's “wide shot” becomes a first-person atrium/balcony view, not a detached camera. | Binding spec; the earlier checklist dropped it. |
| 11 | **Keyboard phrase is an open decision:** current `I LOVE CDS`, observed wall `I S L O V E J C D S`, design-state `I LOVE JCDS`. Owner chooses; keep save compatibility. | Canon conflict left unflagged. |
| 12 | **Lion review verdict** is quoted from the `lion-feet-review` transcript; no local artifact yet. Task 9.3 records it in `evidence/lion-feet-b1a2fdb/`. | Fidelity review; attribution. |

Reviews: `fidelity-critic`, `canon-critic`, `feasibility-critic` (read-only; reports in the session transcripts). No code was changed by the reviews; the plan was corrected instead.

## Goal

Make the current one-world build the definitive BARRIER 2030 demo: a continuous first-person campus game that opens with HKU Magic Hour and the Student Ambassador invitation, runs the High Table Dinner → B4 → lawn → sports hall → campus-light-show route, and gives every place a reason to be explored.

## Architecture

One Vite + TypeScript + Three.js page, `?experience=opening`, one campus model, one explorer/physics, one HUD. No reloads in the player path. The opening is a cinematic plus a playable crowd beat; the campaign is a chapter host over the same world. New places are zones, not a bigger always-on scene.

## Tech stack

Vite, TypeScript, Three.js, the existing `CampusGame` / `Navigation` / `CharacterPhysics` stack, `CampusAudio` + `StoryAudio`, Node `tsx` check scripts, Python Playwright browser gates, and the existing authoring/`authorKey` pipeline.

## Spec sources

- `.scratch/master-roadmap-inventory.md` — the issue inventory and exact owner quotes (this worktree).
- `research/wechat-sources-2026-11-23.md` — the three WeChat Channels references (**main hackathon repo, not this worktree’s `research/`**).
- WeChat group “Vibe Coding Hackathon CDS SH” (`46098846930@chatroom`), 2026-11-23 messages — release/submission requirements; read via the local chatlog at `localhost:5030`.
- `doc/11-barrier-2030-design.md`, `doc/12-design-state-2026-11-21.md`, `doc/competition/2026-11-21-requirements.md`.
- `docs/plans/2026-11-21-one-world-campaign.md` — binding one-page/no-reload spec.
- `docs/plans/2026-11-23-prologue-story.md`, `2026-11-23-route-effects.md`, `2026-11-23-music.md`, `2026-11-23-lion-skill-system.md`, `2026-11-23-student-rescue.md`, `2026-11-23-world-scope-perf.md`, `2026-11-23-asset-packs.md`, `2026-11-23-lion-feet.md`.

## Global constraints (binding on every task)

- Repo stays private; no collaboration-permission changes; no automatic messages.
- Secrets only in local `.env`; `.env.example` only variable names and descriptions, never real values.
- Scene geometry goes **source parameters → regenerate → visual/collision check**. Never run arbitrary JS at runtime to edit a model.
- Preserve `authorParts` / `sceneId` / existing `authorKey`. Any changed ID gets an old → new migration row.
- A passing check is **not** human acceptance.
- No WebSearch/WebFetch. Any external fact goes through AnySearch via `mcporter`.
- After any skill change: `~/.claude/bin/skill-lint --watch` and `--lock`.
- Subagents: HKU liteLLM first, then the GLM 5.3 Flash group (`flash-worker` / `flash-reviewer`), then the session model (owner ruling 2026-11-24, superseding the earlier GLM ban). One implementer at a time.
- Ports: do not start a duplicate on 18789/8790, 5233/5260, or 5251–5259; use the port in the dispatch, stop it when done.
- Merge/push/publish only with explicit owner OK. A teammate message is not owner approval.
- Old saves stay readable: map old stages/checkpoints, never wipe.
- Gates extend, never weaken.
- In this checkout, `npm run typecheck` / `npm run build` may fail on the symlinked `node_modules`; use `node_modules/.bin/tsc --noEmit` and `node_modules/.bin/vite build` (as `docs/PERFORMANCE.md` says).

---

## The canon ruling (what the plan assumes)

These are recommendations, marked **owner confirmation recommended** where a later owner message did not repeat an older note.

| Question | Ruling | Why |
|---|---|---|
| Dinner building | **B5** | Current opening, the owner’s messages, and `Azz1aaOut0` all say Building 5. B6 is the auditorium. |
| Flip wall | **B4**, campus-facing side entrance | Owner direction, 2026-11-23 (paraphrase; exact session text in the inventory): the flip wall is currently in B5 but belongs at B4’s campus-side side door; enter and turn right. |
| B4 side door | **Provisional: the campus-facing exterior face of B04.** The earlier candidate `(50.0, .02, 7.0)` is the **interior shell wall**, not the building façade; B04’s real footprint is x 28.15–87.85, z −24.5…20.5. Task 2.1 must derive the exterior face, cut the door there, and fit the room with a 0.2 m margin. The owner’s “side door, turn right” is unchanged. | Mapper’s z=7 is the inner room edge; the door must be on the exterior mass. **Owner confirmation recommended** after the site pre-flight. |
| Flip-wall mount | **Provisional**, to be re-derived after the door. The old ORIGIN `[48.05, .02, 11.80]` yaw `π/2` puts the room at X 45.95–51.15, Z 6.10–17.50: 0.90 m past the z=7 shell, the closet outside x=46, and racks 1–3 inside the room. Task 2.1 must shift/fit the room, move or remove racks 1–3, and gate the bounding box before mounting. | Room fit fails against B4 X 46–70, Z 7–20.5. |
| MacBook errand | **B4 5F principal’s office**, in through the side door and the lift; stairs only reach 4F | Owner’s Notion “hackathon day” note; `doc/12` §5.2 already recommended B4 high floor. Supersedes the current `to_b6` / B6 office. **Owner confirmation recommended** because the note predates the latest opening messages. |
| B6 | **Auditorium / architectural core**, not the office or flip corridor, and **not a compute master core**. B06 + the atrium ring are the gathering centre; the finale must show a mesh (four equal towers, tower-to-tower links), not a star around B06. The existing B6 presentation room is re-dressed as the auditorium/back-of-house (Task 2.5). | `doc/12` §5 plus the owner’s no-master-core direction; the earlier “central core beam” wording is withdrawn. |
| Keyboard Wall | B4 main (south) entrance, CDS-1 ground-floor room | Current build and the original prototype. |
| Route | B5 dinner → B4 5F office → return B5 incident → B4 main entrance Keyboard Wall → exterior B4 lit + a mesh beam (tower-to-tower, not to a core) → walk around to B4 side entrance → turn right → flip wall → breaker → MacBook → lawn → sports hall → ending light show | Owner’s corrections, `doc/12` §6–7, and the binding one-page spec. |
| Campus | Four equal PU towers B01–B04, **no master compute core**. B06 + the atrium ring are an **architectural** centre (auditorium/gathering), not a CPU. The prologue and finale overlays must show tower-to-tower links, never a star. | Owner’s decentralised-computer direction. |
| AIs | The **external AI** is the invader/antagonist. The MacBook’s **local AI** (emergency assistance) is uninfected and separate. The security alert is the external AI speaking through the campus system; the final line names it in the third person: “the only thing on campus the invader does not own.” Never write the local assistant as the invader, and never let the invader claim the MacBook as its own. | Owner correction, 2026-11-23. |

**Save/checkpoint migration table** (must be implemented before the route change ships):

| Old ID | New ID | Kind | Behaviour |
|---|---|---|---|
| `story.stage 'to_b6'` | `'to_b4_office'` | opening stage | old save loads at the B4 side door, errand not yet done |
| checkpoint `'b6'` | `'b4-office'` | chapter-select checkpoint | label “B4 · 5F principal’s office”; same event prefix |
| URL `?checkpoint=b6` | `?checkpoint=b4-office` | link alias | old bookmarks and the old levels page keep working |
| `'return_b5'` | unchanged | opening stage | no change |
| campaign `b4_flip`/`b4_breaker`/`b4_connect` | unchanged IDs | campaign stages | geometry moves to the B4 side corridor; saves still resume |
| authorKey `B5_flip_wall` / `B5_flip_wall_mount` | `B4_flip_wall` / `B4_flip_wall_mount` | scene IDs | record the old→new row in the scene-migration evidence |
| authorKey `B5_flip_wall_plaque`, `B5_flip_wall_plaque_line`, `B5_flip_tiles_dark`, `B5_flip_tiles_light` | same parts in the B4 side-corridor scene | scene IDs | add every key to the old→new table; do not rename silently |
| checkpoint parser `'b6'` | alias `'b4-office'` | parser | `openingCheckpoint()` uses `.includes()`; add an explicit alias map; gate old `?checkpoint=b6` |
| B6 return path: `O.checkpoints.b6`, `O.returnPoint`, `O.laptop`, `O.routeB6`, `safePose('return_b5')`, incident trigger `z > O.b6.z1+1.5`, `map.ts`, `agent.ts` | B4 side-door corridor / B4 5F office | geometry + poses | migrate every consumer in Task 2.2; the return path must not walk back to B6 |
| `b4_flip` / `b4_breaker` / `b4_connect` saved poses | same IDs, relocated to the B4 side corridor | save relocation | on load, if the stage is `b4_flip`+ and the saved position is in the old CDS-1 room, relocate to the side-corridor entrance; keep the stage and flags |
| checkpoint `'b4'` | unchanged | checkpoint | pose becomes the B4 main entrance (already is) |

---

## Issue coverage matrix

Every owner-written issue maps to a task or an explicit “later”.

| # | Issue (source) | Workstream / task |
|---|---|---|
| 1 | Save the WeChat light-show sources; the third is the High Table Dinner (More refinements 1,3) | 0.1 / 0.2 |
| 2 | Light show when the whole campus lights up (2) | 2.5 / 5.1 / 5.2 |
| 3 | Save the sources (repeat; documentation deliverable) (3) | 0.1 / 0.2 |
| 4 | High Table Dinner scene: modelling, atmosphere, lighting (4) | 4.1 |
| 5 | Dinner music (5) | 4.2 |
| 6 | Pause page cannot select a chapter (6) | 1.1 |
| 7 | Ego lite full gameplay/UI playtest (7) | 11.1 / 11.2 |
| 8 | NPC/robot dialogue; hover “who is this” (8) | 6.2 |
| 9 | Background stories, voice, chat (9) | 6.2 |
| 10 | Real cohort names, virtualised; author credit; protagonist unnamed (10) | 6.1 |
| 11 | Opening rewrite: Magic Hour, crowd, phone, only Yes (11) | 3.1 / 3.2 |
| 12 | Drag control still broken (12) | 1.2 |
| 13 | Flip wall should be B4 side entrance, turn right (13) | 2.1 / 7.4 |
| 14 | Robot dog too slow (14) | 6.3 |
| 15 | Humanoid robots; find/annotate their photos (15) | 6.4 |
| 16 | Robots cannot coordinate and have no vision; study CoD stealth (16) | 6.5 |
| 17 | Late work list: game name; music, SFX, interaction feel, decorations, UI; opening/ending narrative; memory (17) | 10.4 / 13.1–13.6 / 6.8 / 10.3 / 3.1–3.2 / 8.7 |
| 18 | B5 or the parts further up, later (hackathon day) | 8.4 / 10.5 (both P2/later; B5 4F is not on the demo-critical path) |
| 19 | Principal’s office is 5F; stairs only to 4F; B4 side-door lift (hackathon day) | 2.2 |
| 20 | B4 model rough: stairs and hollow pipe (hackathon day) | 2.2 |
| 21 | Game name candidates: “CDS at War” / “HKU at War” (hackathon day) | 10.4 |
| — | Campus is a decentralised computer, no master core (owner, prologue direction) | 2.5 / 3.1 / 5.1 |
| — | Visitor/demo brief: playable campus exploration (competition requirements) | 10.1 / 10.2 |
| — | Demo teaser: gameplay highlights, music, NPC snippets, hints of boss/puzzle/aftermath, thriller tone, sudden blackout, no spoilers (owner, 2026-11-23) | 10.6 |
| — | Abduction beat: students/staff taken by robots need servo/struggle/door noises (owner, 2026-11-23) | 6.7 |
| — | The walk to the president’s office must convey the abduction, not run a fixed duration; use a TV/CCTV or noises (owner, 2026-11-23) | 2.2 / 6.7 |
| — | MacBook pickup: camera looks left at a security camera/monitor before the alert (owner, 2026-11-23) | 2.4 |
| — | Full soundtrack for every part; original HKU/Greensleeves variations incl. Soviet march; Greensleeves in some scenes (owner, 2026-11-23) | 13.1–13.4 / 4.2 / 5.2 |
| — | Voice is too monotone; use more expressive ElevenLabs/voice-actor voices (owner, 2026-11-23) | 13.5–13.6 |
| — | External AI vs local AI: the MacBook’s assistant is clean (owner correction, 2026-11-23) | canon ruling + 3.1 / 3.2 |
| — | Version number + git tag + playable link + slides + demo video (group chat, 2026-11-23) | 12.1–12.7 / 10.7 |
| — | Eight humanoid robots added by the teammate but not updated (group chat, 2026-11-23 19:45) | 6.4 |
| — | Lion fight / story / quest / environment pass (group chat, 2026-11-23 19:57) | 9.4 |
| — | Group bug/details reports and UI feedback (group chat, 2026-11-23 19:33–20:02) | 12.5 / 11.1 |

Conflicts resolved in the canon ruling above: flip wall B5/B6/B4; MacBook B6/B4 5F; dinner B5/B6; prologue’s walk to B6; route-effects’ B6 flip corridor; game name. The route-effects plan’s Task 2 is **obsolete** and must be rewritten; the prologue-story plan’s staff/MacBook errand line still walks to B6 and is **superseded**.

---

# Workstream 0 — Sources and record-keeping (P0, small)

### Task 0.1 — Save the three WeChat sources

**Files:** `research/wechat-sources-2026-11-23.md` (created in the **main hackathon repo**, not this worktree’s `research/`)

- [x] The three URLs and extracted descriptions are saved, with a “reference only, do not ship” caveat.
- [ ] Add the file to the **main repo’s** `research/README.md` index and to the master-plan source list. Do not look for it under the game worktree.
- [ ] `git diff --check`; commit only when the owner asks.

### Task 0.2 — Record the canon rulings

**Files:** `docs/plans/2026-11-23-master-roadmap.md`, `docs/plans/2026-11-23-route-effects.md` (header correction), `docs/plans/2026-11-23-prologue-story.md` (errand correction)

- [ ] Add a one-paragraph “superseded” note at the top of `route-effects.md` pointing at the B4 side-corridor ruling.
- [ ] Add a one-paragraph “errand target is B4 5F, not B6” note to `prologue-story.md`.
- [ ] No code; no gate. Owner reads the master plan.

---

# Workstream 1 — Input + UI correctness (P0)

### Task 1.1 — Chapter select on the pause page

**Files:**
- Modify: `src/main.ts` (pause card markup and click handlers)
- Modify: `src/opening/experience.ts` (expose `startAtCheckpoint`; close modal; reset fleet)
- Modify: `src/opening/checkpoint.ts` (export a display list; add `b4-office`)
- Modify: `src/opening/opening.css` or `src/style.css` (pause chapter grid)
- Test: `scripts/check-chapter-select.ts` (labels/IDs), new `scripts/check-pause-chapters.py` (browser)

**Interfaces:**
- Consumes: `OPENING_CHECKPOINTS`, `CHECKPOINT_LABELS`, `experience.startAtCheckpoint(id)`, `explorer.enterCompat()`.
- Produces: a pause-card chapter grid; `startAtCheckpoint` public on the experience object.
- **Prerequisite:** Task 3.0 (`bus` → `crowd`) must land before this task’s typecheck gate; otherwise the tree is red for an unrelated reason.

- [ ] **Step 1: Write the failing browser check.** In `scripts/check-pause-chapters.py`, boot `?experience=opening&intro=0&quality=low`, enter compat, press `Escape`, assert `#pause-panel` is visible and `#pause-chapters button` count equals `OPENING_CHECKPOINTS.length`.
- [ ] **Step 2: Run it and see it fail** for the missing grid.
- [ ] **Step 3: Add the grid.** In the pause card, insert `<div id="pause-chapters" role="group" aria-label="Jump to chapter"></div>` before the existing buttons. Render one button per checkpoint from `CHECKPOINT_LABELS`. On click: `experience.startAtCheckpoint(id)`, `explorer.enterCompat()`, hide the pause panel, update the objective.
- [ ] **Step 4: Expose the API.** Change the local `startAtCheckpoint` in `experience.ts` to a returned method. It must: call `explorer.pause()`, `closePanel()`, `explorer.clear()` **before** `enterCompat()`; set the opening story state and pose; set the **campaign stage and flags** through the campaign’s own `startAtCheckpoint` (not only the opening story), including `recordCorePowerCut` where the checkpoint is past the breaker; reset the robot fleet; close any panel; persist.
- [ ] **Step 5: Release pointer lock.** `explorer.pause()` already exits pointer lock; clicking a chapter button must not require pointer lock. Assert `document.pointerLockElement === null` before the click. Also jump to every checkpoint in a gate and assert the host’s stage/objective matches — a story-only jump that leaves the campaign at the old stage fails.
- [ ] **Step 6: Run the check.** `python3.13 scripts/check-pause-chapters.py` → PASS; `npm run check:chapter-select` → PASS; `node_modules/.bin/tsc --noEmit`.
- [ ] **Step 7: Commit** `feat(ui): chapter select on the pause page`.

### Task 1.2 — Drag control

**Files:**
- Modify: `src/exploration/controller.ts`
- Test: new `scripts/check-drag-control.py` (browser)

- [ ] **Step 1: Reproduce and record.** In compat mode, pointer-down on the canvas, move 120 px, release outside the canvas; press `Escape`; click a pause button. Record the actual failure (yaw jump, stuck drag, or ignored drag) in the task report.
- [ ] **Step 2: Write the failing gate.** The gate enters compat, drags 120 px right, asserts yaw changed by the expected sign; presses `Escape`; asserts `dragging === false`; clicks a pause button; asserts yaw did not change; resumes and drags again.
- [ ] **Step 3: Fix.** `clear()` is already called in `pause()`/`openPanel()` and canvas `pointerup`/`pointercancel` are handled, so the actual repro may be elsewhere. First reproduce. Then: add **window-level** `pointerup`/`pointercancel` listeners (a release outside the canvas currently leaves `dragging` true); call `clear()` from `startAtCheckpoint`; ignore `pointerdown` when `game.paused` or a panel is open; release `setPointerCapture` on `pointerup`/`cancel`. Record the actual failing path in the report.
- [ ] **Step 4: Run the gate.** `python3.13 scripts/check-drag-control.py` → PASS; `npm run check:exploration`; `node_modules/.bin/tsc --noEmit`.
- [ ] **Step 5: Commit** `fix(input): release drag look on pause and UI clicks`.

---

# Workstream 2 — Canon + B4 route (P0)

### Task 2.1 — Move the flip wall to the B4 side entrance

**Files:**
- Modify: `src/opening/spatialLayout.ts` (B4 side door and flip mount constants; bump `OPENING_WORLD_REVISION`)
- Create: `src/opening/b4Layout.ts` (`B4_OBSTACLES`, split wall leaves + lintel)
- Modify: `src/opening/geometry.ts` (door cut on the **exterior** face)
- Modify: `src/opening/navigation.ts` (side-door collision/floor)
- Modify: `src/opening/b4Shell.ts` (side lobby shell if needed)
- Create: `src/opening/b4FlipRoom.ts` (mount the observed room, own the ripple)
- Modify: `src/opening/experience.ts` (remove `createB5FlipWall`; add the B4 room; dispose)
- Delete/retire: `src/opening/b5FlipWall.ts` (or re-home it as `b4FlipWall.ts`)
- Test: `scripts/check-opening-integration.ts`, `scripts/check-campaign-b4.ts`, new `scripts/check-b4-flip-room.ts`

**Interfaces:**
- Produces: `B4_SIDE_DOOR`, `B4_FLIP_ORIGIN`, `B4_FLIP_YAW`, `createB4FlipRoom()`, `B4_FLIP_WALL_NAME`. **All coordinates are outputs of Step 2, not inputs.**
- Consumes: `buildObservedFeatureRoom('flipWall', {parts:['shell','wall']})` (no closet yet), `flipWallTiles()`.

- [ ] **Step 1: Write the failing gate.** Assert no scene object named `B5_flip_wall`; the B4 room exists; the side door is walkable; and the room’s world bounding box is inside B4 (X 46–70, Z 7–20.5) with a **0.2 m margin**. Do not assert a panel centre yet — it is computed from the mount.
- [ ] **Step 2: Site pre-flight — do not cut yet.** From `buildSite`/`spatialLayout`, list B04’s **exterior** faces: footprint X 28.15–87.85, Z −24.5…20.5; the interior shell is X 46–70, Z 7–20.5. The owner’s “campus side door” is on a **building exterior** face, not the interior shell. Pick the campus-facing face, record its door centre, heading and approach path in a small table, and screenshot the blockout. **The old `(50, .02, 7)` is withdrawn unless this step proves it is exterior.** Owner confirms the face before the cut.
- [ ] **Step 3: Cut the door.** Cut a 2.4 × 3.2 m opening on the face from Step 2; split the wall into two leaves + a lintel in `b4Layout.ts`; add floor/collision in `navigation.ts`; add the frame in `b4Shell.ts`. The side lobby connects the exterior door to the interior shell; the flip room itself stays inside the shell. Add `B4_OBSTACLES` so the cut is not re-sealed by the old collision.
- [ ] **Step 4: Fit and mount the room.** Fit the observed room inside B4 with a 0.2 m margin. The old ORIGIN `[48.05, .02, 11.80]` yaw `π/2` gives X 45.95–51.15, Z 6.10–17.50 — 0.90 m past the shell, the closet outside x=46, and racks 1–3 swallowed. Shift the origin/rotation until the gate passes; move or remove racks 1–3 and record which. Keep the observed 561 tiles; do not rebuild them. Mount **shell + wall only**; Task 7.4 owns the closet, breaker and port.
- [ ] **Step 5: Remove the B5 mount.** Delete the `createB5FlipWall` import/call/update/dispose in `experience.ts`; re-home the plaque/author keys (`B5_flip_wall`, `B5_flip_wall_mount`, `B5_flip_wall_plaque`, `B5_flip_wall_plaque_line`, `B5_flip_tiles_dark`, `B5_flip_tiles_light`); update `check-campaign-b4.ts` so it no longer imports B5 constants.
- [ ] **Step 6: Bump the world revision** and run the migration check; record every old→new key in the scene-migration evidence.
- [ ] **Step 7: Run gates.** `npm run check:opening`, `check:campaign-b4`, `check:opening-integration`, `check:geometry`, `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/vite build`.
- [ ] **Step 8: Commit** `feat(b4): mount the HKU flip wall at the B4 side entrance`.

### Task 2.2 — Move the MacBook errand to B4 5F; fix B4 stairs and pipe

**Files:**
- Modify: `src/opening/spatialLayout.ts` (B4 side lobby, lift, 5F office bounds)
- Create: `src/opening/b4Office.ts` (lift cab, 5F office interior, MacBook table)
- Modify: `src/opening/experience.ts` (story stages, objectives, lift transition)
- Modify: `src/opening/contracts.ts`, `src/opening/state.ts` (stage rename + migration)
- Modify: `src/opening/checkpoint.ts`, `src/levels/menu.ts` (`b6` → `b4-office`, alias parser)
- Modify: `src/opening/map.ts`, `src/opening/agent.ts` (B6 return path → B4 side corridor)
- Modify: `src/model/buildSite.ts` / `buildCampus.ts` (B4 stairs, hollow pipe)
- Test: `scripts/check-opening-state.ts`, `scripts/check-chapter-select.ts`, `scripts/check-opening-integration.ts`, new `scripts/check-b4-office.ts`, browser `check-campaign-playthrough.py`

**Interfaces:**
- Produces: `B4_OFFICE` bounds/floor; `createB4Office()`; `story.stage 'to_b4_office'`; `b4-office` checkpoint.
- Consumes: the existing `take_laptop` event, `markRelayRestored`, `START` pose machinery.

- [ ] **Step 1: Write the failing state check.** Assert `'to_b6'` is no longer produced, `'to_b4_office'` is, and an old save with `to_b6` parses to `to_b4_office`.
- [ ] **Step 2: Build the lift + 5F office.** A small side lobby at the B4 side door: lift doors, call button, 2.5 s ride with doors closing/opening (first-person, no cut, no reload), 5F office with desk, chair, bookshelf, window, warm practicals, MacBook on the desk. Stairs run only to 4F with a “5F by lift” sign. Put a wall-mounted **CCTV monitor/TV** in the side lobby (visible on the way in or out) showing a live feed of students and staff being led away by robots; the lift car has a small screen that repeats the feed between floors.
- [ ] **Step 2b: Pace the approach by the information beat, not a stopwatch.** From the B4 side door to the MacBook should take **~30–45 s** of first-person traversal: side lobby, lift call, 2.5 s ride, 5F corridor, locked office door, office. That is enough time for the abduction to land, and no more. No instant arrival. Tell the abduction through the environment in three beats: (1) the lobby TV/CCTV shows a corridor feed of humanoid robots escorting students and staff out of frame; (2) the feed cuts or glitches as the lift doors close; (3) on 5F the sound carries it — a distant servo, a muffled shout, a door closing. Add evacuation signage, an abandoned trolley and a flickering panel as secondary dressing. Do not gate the beat on a fixed duration: the playtest records the measured time and confirms all three beats are seen/heard before the office door.
- [ ] **Step 3: Re-target the errand.** Objective: “Collect the presentation MacBook · Building 4 · 5F principal’s office.” The staff hand-off points to the B4 side door. The return still goes to B5 for the incident.
- [ ] **Step 3b: Re-target the staff voice.** `STAFF_DIALOGUE.intro[1]` and `intro[2]` (and the `original` strings) still say “Building 6” and “office table”; change them to “CDS-1” and “the 5F principal’s office”, regenerate `staff-line2.wav` / `staff-line3.wav` with the existing voice, update `content/voice/profiles.json`, and gate text/duration. Subtitle and audio must agree. `src/opening/voice.ts` and `scripts/check-opening-voice.ts` are the files.
- [ ] **Step 4: Migrate saves/checkpoints and the B6 return path.** Add the migration table above; keep the old `b6` label readable but map it to `b4-office`; update the levels page. Add an explicit alias map to `openingCheckpoint()` (`b6` → `b4-office`) because it uses `.includes()`. Retarget every B6 consumer: `O.checkpoints.b6`, `O.returnPoint`, `O.laptop`, `O.routeB6`, `safePose('return_b5')`, the incident trigger `z > O.b6.z1+1.5`, `map.ts`, `agent.ts`. Gate a full return B5 → B4 side → 5F → B5. Relocate `b4_flip`+ saves from the old CDS-1 room to the side-corridor entrance; keep the stage and flags. Gate old `?checkpoint=b6`.
- [ ] **Step 5: Fix the B4 model.** Audit the stairs and the hollow pipe against the reference photos; rebuild via source parameters; add collision; visual check from the side door and the campus walk.
- [ ] **Step 6: Run gates.** `check:opening`, `check:opening-state`, `check:chapter-select`, `check:campaign`, browser playthrough B5 → B4 side → 5F → B5 → B4 main; `node_modules/.bin/tsc --noEmit`. Record the measured side-door → MacBook time in the task report (target ~30–45 s) and confirm the three abduction beats (lobby CCTV → feed cut → 5F servo/shout/door) all play before the office door.
- [ ] **Step 7: Commit** `feat(b4): move the MacBook errand to the 5F office`.

### Task 2.3 — Reconcile the old B6 assumption

**Files:** `src/opening/world.ts` (B6 office stays scenery), `src/opening/spatialLayout.ts`, `src/campaign/endingChapter.ts` (B6 = core/auditorium), `docs/plans/2026-11-23-route-effects.md`, `docs/plans/2026-11-23-prologue-story.md`

- [ ] Remove the B6 errand objective and the `to_b6` route; leave the room built as back-of-house scenery.
- [ ] Add a comment/source note: “B6 is the auditorium/architectural core, not a compute master core; the office fit-out is legacy scenery.”
- [ ] Update every gate that hardcodes `to_b6` or the B6 checkpoint: `rg -n 'to_b6|checkpoints\.b6|B6 · Fetch' src scripts docs` (literal `·`, not `·`).
- [ ] Run `check:opening`, `check:chapter-select`, `check:campaign`; commit `refactor(b6): B6 is the auditorium/core, not the errand`.

### Task 2.4 — MacBook pickup: look-left camera beat

**Files:** `src/opening/b4Office.ts`, `src/opening/experience.ts`, `src/opening/opening.css`, `scripts/check-b4-office.ts`, new `scripts/check-macbook-pickup.py`.

- [ ] **Step 1: Write the failing browser check.** Trigger `takeLaptop()` at the office desk; assert input locks for ~3.5 s, the camera yaw eases left to the security camera on the wall, the camera LED turns on, the monitor shows campus feeds going dark one by one, then the alert opens and control returns.
- [ ] **Step 2: Build the beat.** On pickup, hold the MacBook in view, ease the look target left ~35° over 1.2 s to a wall security camera; its red LED wakes; the adjacent monitor shows the B5/B4/lawn feeds collapsing; the last feed shows a robot turning toward the lens. Cut back to first person. Then open the alert.
- [ ] **Step 3: Keep the AIs distinct.** The camera feed is the external AI; the MacBook’s local assistant is clean. Do not imply the local AI authored the takeover. The alert’s final line stays third-person (“the only thing on campus the invader does not own”).
- [ ] **Step 4: Reduced motion.** Same beat at 1.2 s, no shake; input restored. Skip path: a single click ends the beat.
- [ ] **Step 5: Gate.** `python3.13 scripts/check-macbook-pickup.py` → PASS; `check:b4-office`; `node_modules/.bin/tsc --noEmit`. Screenshot the look-left frame.
- [ ] **Step 6: Commit** `feat(b4): look-left security-camera beat on MacBook pickup`.

### Task 2.5 — B6 architectural core dressing

**Files:** `src/opening/world.ts`, `src/opening/spatialLayout.ts`, new `src/opening/b6Auditorium.ts`, `src/campaign/endingChapter.ts`, `scripts/check-opening-integration.ts`.

The canon says B6 is the auditorium/architectural core, but no task builds or dresses it; 5.1’s atrium ring otherwise has no source geometry.

- [ ] Audit the existing B6 room; dress it as the auditorium/back-of-house (seating, stage, atrium opening) using the existing geometry. Do not build a new exterior or a master-CPU prop.
- [ ] Add the atrium ring, four tower-link anchors and a player balcony; expose their names/positions for Tasks 5.1/7.3. Beams link towers and the ring, never a B6 “core”.
- [ ] Gate: `check:opening-integration` asserts the anchors exist, the room is walkable, and no label implies a central compute core; screenshot.
- [ ] Commit `feat(b6): dress the auditorium/atrium core`.

### Task 2.6 — First-visit wayfinding minimum

**Files:** `src/opening/map.ts`, `src/opening/ui.ts`, `src/opening/landmarks.ts`, `src/opening/opening.css`, `scripts/check-survey.ts`.

- [ ] Spawn orientation: a 3 s fade-in with the campus name and the first objective; no text wall.
- [ ] Map markers for the B5 dinner, B4 main entrance, B4 side door, lawn and sports hall; an objective arrow; landmark labels within ~35 m.
- [ ] The route is legible without a guide; the player can always see the next objective.
- [ ] Gate: browser walk from spawn to the dinner; screenshots at 1280×800 and 390×844; `check:survey`.
- [ ] Commit `feat(opening): minimum wayfinding for the first visit`.

---

# Workstream 3 — Opening (P0/P1; in flight)

The `opening-mvp` agent is already editing `src/opening/prologue.ts`, `prologueTimeline.ts`, `prologueVisuals.ts`, `atmosphere.ts`, `prologueVoice.ts`, the narration assets, and `state.ts`/`contracts.ts`. Do not duplicate that work.

### Task 3.0 — Reconcile the in-flight `bus` → `crowd` stage names

**Files:** `src/opening/experience.ts`, `src/opening/state.ts`, `src/opening/contracts.ts`, `scripts/check-opening-state.ts`, `scripts/check-opening-flow.mjs`.

This task exists because the MVP is mid-flight and, at review time, the tree was red: `OpeningStage` no longer has `'bus'`, `experience.ts` still branched on it, and `check-opening-state.ts` still asserted it. **Tasks 1.1/1.2 must not be dispatched until this lands.** Wait for the `opening-mvp` report before editing its files; do not interrupt it. The first action is to re-run the typecheck and record the current state; the fix starts after the agent lands.

- [ ] **Step 1: Record the red state.** Run `node_modules/.bin/tsc --noEmit`; write the exact errors in the report.
- [ ] **Step 2: Reconcile.** Replace every `story.stage === 'bus'` / `'bus'` branch in `experience.ts` with the stage the MVP actually produces (`'crowd'`); make `check-opening-state.ts` assert the value `createOpeningState()` returns, not a stale literal. Do not edit the MVP’s authored prologue files in this task.
- [ ] **Step 3: Old saves.** Map a saved `bus` to `crowd`/`to_b5` on load; no wipe.
- [ ] **Step 4: Gate.** `node_modules/.bin/tsc --noEmit` green; `npm run check:opening-state`; `npm run check:opening`.
- [ ] **Step 5: Commit** `fix(opening): reconcile the in-flight crowd stage name`.

### Task 3.1 — Review and land the MVP

**Files:** the MVP's changed files; `scripts/check-prologue.ts`, `scripts/check-prologue.py`.

- [ ] Review the MVP diff for: four approved lines (owner approved the script with “你那个我认可” on 2026-11-23; the prologue-story plan’s open decisions are stale), one continuous spline, no cuts, B4/B5 interior fly-through, mesh die-shot (four equal nodes, tower-to-tower links, no star), light traces, volumetric shaft, dusk sky, crowd, phone overlay, single Yes.
- [ ] Assert the final waypoint is `OPENING.handoff`, not the bus; the MVP’s spawn pose and the `to_b5` stage must match Task 3.2.
- [ ] Add `scripts/check-opening-copy.ts`: the alert says “the only thing on campus the invader does not own”, never “I put it there”; the MacBook assistant is described as local and uninfected; the external AI is the speaker of the first two lines. Wire it into `check:opening`.
- [ ] Run `check:prologue`, `check:prologue-browser`, `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/vite build`, `check:opening`, `check:campaign`.
- [ ] Capture evidence at 1280×800 and 390×844: aerial mesh, one interior frame, dinner-hall frame, phone overlay, final spawn.
- [ ] Open it for owner acceptance. Do not merge until the owner has looked.

### Task 3.2 — Playable opening + errand reconcile

**Files:** `src/opening/experience.ts`, `src/opening/state.ts`, `src/opening/opening.css`, `src/opening/npcs.ts`, `src/gameplay/studentCrowd.ts`, `src/opening/spatialLayout.ts`, `scripts/check-opening-flow.mjs` / new browser gate.

- [ ] **Depends on Task 3.0.** Remove `story.stage === 'bus'` from the opening flow; after the Magic Hour light show, spawn in the crowd on the plaza facing B5 at `OPENING.handoff [58,.08,25]`; keep the bus as scenery.
- [ ] Phone overlay: vibration cue, invitation card, only **Yes**, “Welcome, Ambassador.”, objective “Walk to the High Table Dinner · Building 5”. Movement paused while open.
- [ ] Crowd walks toward B5; the player is one of them; no blocking.
- [ ] **Task 2.2 owns the staff errand target and voice.** This task only stops pointing at B6 and reads the target from the story state; do not hardcode B4 coordinates or a second copy of the dialogue. Keep `return_b5` and the incident.
- [ ] Old saves: `bus` → `crowd`/`to_b5`; `to_b6` → `to_b4_office`; no wipe.
- [ ] Gate: browser boots, waits for the phone overlay, asserts exactly one enabled button, clicks Yes, asserts the objective and movement; then a second gate walks the crowd to B5.
- [ ] Commit `feat(opening): crowd, phone invitation, B4 errand`.

### Task 3.3 — Audio + light grammar

**Files:** `src/opening/prologue.ts` (`playVoice` ducking), `src/gameplay/storyAudio.ts`, `src/opening/atmosphere.ts`, `src/opening/prologueVisuals.ts`.

- [ ] Duck the music on each narration line; restore after. Use the existing `setDialogueDuck`.
- [ ] Dusk bed from the new score; no `mus_safe` default.
- [ ] Use the chip-ad light grammar recovered from the reference brief: open-ended cylinder (48 segments), silhouette alpha falloff `pow(abs(dot(N,V)),1.8)`, two independent fades, dust sampled inside the beam, off-axis spline crossing at ~0.75 m radius for ~1 s, `0x35e0d0` core / `0xffcf96` rim, travelling pulse + 6% flicker, 1/255 dither, alpha ~0.30 × 3 layers.
- [ ] Prologue-only group disposed on stop/skip/replay; no leak into gameplay.
- [ ] Gate: `check:prologue`, `check:prologue-browser`; screenshot of the beam; no page errors.

---

# Workstream 4 — Dinner + music (P1)

### Task 4.1 — Dress the B5 High Table Dinner

**Files:** `src/opening/world.ts` (dinner hall), `src/opening/spatialLayout.ts` (`DINNER_LAYOUT`, `DINNER_HEAD`), new `src/opening/dinnerDressing.ts`, `src/opening/npcs.ts`, `src/opening/atmosphere.ts`, `scripts/check-opening-world.ts`, new `scripts/check-dinner.ts`.

- [ ] Long tables with green cloth, place settings (plate, glass, cutlery, folded napkin), table lamps with warm emissive shades, low centrepieces; chairs; dais transverse table, lectern, crest backdrop (use `assets/opening/dinner-crest.jpg`).
- [ ] Seated guests from the existing character rig; a few standing; idle animation; ambient chatter loop; a toast beat.
- [ ] Lighting: warm practicals, lamp glow, dusk-blue window fill, soft haze; no red emergency wash.
- [ ] Instance/merge repeated settings; cap draw calls; screenshot inside the hall at 1280×800 and 390×844.
- [ ] Gate: `check:opening-world`, `check:dinner`; visual evidence.

### Task 4.2 — Dinner music

**Files:** `src/gameplay/storyAudioAssets.ts`, `src/gameplay/storyAudio.ts`, `assets/audio/story/score/`, `scripts/check-story-audio.ts`, `docs/plans/2026-11-23-music.md`.

- [ ] Use the `dinner` / `processional` cues from Workstream 13 (Task 13.2); do not compose a second competing dinner cue here. Warm strings, piano, restrained brass, a ceremonial lift; same BPM/key/bar grid where possible so it crossfades on the beat.
- [ ] Wire it to the B5 dinner stage and the toast beat; duck under staff dialogue.
- [ ] Gate: stem present, duration/loudness/seam checks; A/B for the owner.
- [ ] Owner listens before the cue is final.

### Task 4.3 — The dinner beat

- [ ] **Task 2.2 owns the staff errand target and the voice take.** This task only stages the seated crowd, the hand-off timing and the toast, and reads the target from the story state; no second copy of the dialogue.
- [ ] Staff hand-off, seated crowd, a short toast, then the errand; no new dialogue system dependency (reuse the WS-6 dialogue panel if it has landed).
- [ ] Gate: browser walk from spawn to the table, staff talk, objective update, music state; screenshot.

---

# Workstream 5 — Finale light show (P1)

### Task 5.1 — Campus-wide finale

**Files:** new `src/campaign/finaleLightShow.ts`, `src/campaign/endingChapter.ts`, **new `src/opening/exteriorLighting.ts` (created here, reused by Task 7.3)**, `src/model/buildCampus.ts`/`buildSite.ts` (emissive window grid), `src/main.ts`, new `scripts/check-finale.py`.

- [ ] Deterministic cue timeline: keep the binding spec’s ~12 s MacBook overlay (`CPU 01–04 OFFLINE → ONLINE`) in the ending (order to be fixed with the owner); tower 1 window rows bottom-up, repeat 02–04; **tower-to-tower links** light in a mesh; the atrium ring expands (architectural, not a CPU); the B3 laser show answers with its second building — **do not name B5 as the laser partner unless the video/site confirms**; the dome/air wall dissolves; students run out; **the player stays first-person on the atrium balcony** (no detached wide shot).
- [ ] Use instanced emissive quads for window rows and additive cylinders for beams **between towers / along the atrium ring**; no beam converging on a central core; no shadows on the effects; one material per family; no runtime model edits.
- [ ] Keep the ending’s MacBook overlay, atmosphere release and credits/Play again; the light show is the middle beat, not a replacement for the overlay.
- [ ] Derive state from the ending stage so a reload restores the lit campus; no new save field.
- [ ] Gate: `check:campaign-dome`, `check:finale.py` (seek each beat via a debug hook, screenshot, assert the stage→light mapping); perf counters; no page errors; one-page/no-reload assertion.
- [ ] Evidence: one screenshot per beat + a 15 s capture for the owner.

### Task 5.2 — Finale audio

- [ ] `building_online`, `beam_strike`, `hope` stingers via `StoryAudio.cue()`; low-frequency hum rising with each PU; one impact on the mesh link / atrium ring, not on a central core.
- [ ] Gate: `check-story-audio`; no click; A/B for owner.

---

# Workstream 6 — Characters + robots (P1)

### Task 6.1 — Names, credit, protagonist

**Files:** `content/names/cohort.json` (new), `content/names/cohort-source.txt` (owner-supplied, git-ignored if private), `src/opening/npcs.ts`, `src/characters/config.ts`, `src/levels/menu.ts`, new `src/opening/credits.ts`, `scripts/check-opening-npcs.ts`.

- [ ] **Owner decision gate:** the owner supplies the cohort roster at `content/names/cohort-source.txt` (one name per line) or approves a public list. Until it exists, `check:names` fails with “roster missing”.
- [ ] Transform each name deterministically: change one or two characters (e.g., a homophone or a different final character), keep the same length/feel; store `{sourceHash, displayName, npcId}` in `cohort.json`. Do not send the roster to any remote service.
- [ ] Use the display names for the opening cast and the rescue representative; keep stable `npcId`s; no real names in the repo if the owner marks the roster private.
- [ ] Credits: author `Huang Ziyang` (Harry OneZion); protagonist unnamed in UI, subtitles and voice.
- [ ] Gate: `check:names` (roster present, every display name differs from source, no protagonist name), `check:opening-npcs`.

### Task 6.2 — Hover, lore, voice, chat

**Files:** new `src/opening/characterDialogue.ts`, new `src/opening/npcLore.ts`, `src/opening/ui.ts`, `src/opening/opening.css`, `src/gameplay/storyAudioAssets.ts`, `src/opening/npcs.ts`, `scripts/check-opening-npcs.ts`, new `scripts/check-dialogue.py`.

- [ ] Raycast the cursor at NPCs/robots within 4 m; show a tooltip “Who is this?” with the display name and role.
- [ ] On interact: a lore card (2–3 sentences) + 2–3 barks; voice via the existing voice pipeline (or a clear “voice pending” state); optional chat panel with 3 canned questions.
- [ ] Data schema: `{id, name, role, lore, barks[], questions[{q,a}]}`; keep it local; no remote LLM in this round.
- [ ] Gate: browser hover, open, advance, close; assert no pointer-lock requirement and no movement block.

### Task 6.3 — Robot dog speed

**Files:** `src/opening/robot.ts` (`ROBOT`), `src/opening/robots.ts`, `scripts/check-opening-robot.ts`, new `scripts/check-robot-chase.py`.

- [ ] Current: patrol 1.25, chase 1.35 vs player walk 2.6 — the dog cannot catch a walking player. Set patrol ~1.6 m/s, search ~1.8, chase ~2.7 (slightly above walk, below run); keep `captureGrace` and the catch/reset rules.
- [ ] Measure: a straight 20 m chase must close the gap; a sprinting player must still escape. Gate prints the measured speeds.
- [ ] Screenshot/video for the owner; commit `feat(robots): make the dog a credible chase`.

### Task 6.4 — Humanoid robots + asset annotation

**Files:** `research/robot-assets-index.md` (new), `assets/` or `src/model/` (new meshes/rig), `src/opening/robot.ts`, `src/opening/robots.ts`, `src/opening/spatialLayout.ts`, `scripts/check-opening-robot.ts`.

- [ ] Dispatch a read-only subagent to audit `materials/`, `research/campus-album-2026-08-30/`, `references/`, `assets/` for robot photos; produce `robot-assets-index.md` with filename, what it shows, and a suggested use.
- [ ] **Reconcile the eight humanoid robots.** The group says a teammate added eight humanoid robots but the update is not visible (group chat, 2026-11-23 19:45). Check this branch and the teammate’s branch/worktree; if the update is missing, re-apply it; if it exists, verify the count, variant IDs and placement. Do not silently drop them.
- [ ] Add the humanoid variant(s) to patrol routes with LOD/instancing; no new per-frame allocation; keep the fleet cap.
- [ ] Gate: `check:opening-robot` (fleet count, variant IDs, speed, vision), screenshot of all eight in the scene or a contact sheet.

### Task 6.5 — Robot vision + squad coordination (CoD-style stealth)

**Files:** `src/opening/robot.ts`, `src/opening/robots.ts`, new `src/opening/robotVision.ts`, `src/opening/navigation.ts` (cover/occlusion helpers if needed), `scripts/check-opening-robot.ts`, new `scripts/check-robot-stealth.py`.

- [ ] Audit the current blackboard: it already has range 9 m, half-angle 35°, shared sightings, one support responder, prediction. The owner’s exact complaint is that the robots “cannot coordinate and have no vision — this is too dumb”; study Call of Duty stealth. Legibility is an additional finding, not the whole complaint.
- [ ] Add: a visible vision cone (debug/review only), last-known-point markers, radio callout subtitles, squad roles (scout/flanker/blocker), search sectors, and a flanking responder that does not walk through walls.
- [ ] Stealth grammar: patrol routes with cover, vision cones, a “suspicion” meter, a search that sweeps the last-known point, and a catch/reset. No damage, no health; the lion remains the combat set-piece.
- [ ] Gate: `check:robot-stealth.py` — hide behind cover, break LOS, watch the search; make noise, watch the support responder flank; assert no wall clipping and no teleport; screenshot the cone/callout.
- [ ] Performance: vision rays capped per frame; far units update at `farHz`; no new shadows beyond `shadowUnits`.

### Task 6.6 — Character/robot budget

- [ ] Add a shared cap: NPCs ≤ 16 visible, robots ≤ 8, dialogue UI ≤ 1 panel, voice ≤ 2 concurrent; measure `perf()` in the dinner hall and the B4 corridor.
- [ ] Gate: `check:opening-npcs`, `check:opening-robot`, `check:perf` (when it lands).

### Task 6.7 — Abduction beat SFX

**Files:** `src/opening/experience.ts` (the staff/student removal beat), `src/gameplay/storyAudio.ts`, `assets/audio/opening-foley/`, new `scripts/check-abduction-sfx.ts`.

- [ ] Locate the existing beat where robots take students/staff. If it is only implied, stage a 6–8 s background event during the incident (B5 lobby/corridor): a robot seizes a staff member, a student is pulled out of frame, a door closes.
- [ ] Layer the sound: servo whine, cloth drag, a muffled shout, a door, a radio chirp, then silence. No gore, no pain screams; keep it PG-13. Duck the music; the silence after is the point.
- [ ] Gate: assets present, cue fires once, no clipping; a browser capture of the beat.
- [ ] Commit `feat(opening): give the abduction beat its noises`.

### Task 6.8 — SFX pass (owner’s “music, SFX” deliverable)

**Files:** `src/gameplay/storyAudio.ts`, `src/gameplay/storyAudioAssets.ts`, `assets/audio/opening-foley/`, `assets/audio/ui/`, new `scripts/check-sfx.ts`.

- [ ] Inventory every interactive surface: UI hover/click, doors, footsteps, the lift, keyboard keys, flip tiles, the breaker, MacBook pickup, robot servo/vision ping, crowd/dinner ambience, the alert glitch. Map each to an existing asset or a gap; write the map in the task report.
- [ ] Fill the gaps from project-owned recordings or CC0 packs; no copyrighted sound; record the licence in `docs/plans/2026-11-23-asset-packs.md`.
- [ ] Wire every cue through the existing audio bus; duck music under dialogue; cap concurrent SFX; no per-frame allocation.
- [ ] Gate: `check:sfx` asserts every cue exists, has a duration, and fires once; no clipping; a browser capture of the dinner, the lift and the flip wall.
- [ ] Commit `feat(audio): complete the SFX pass`.

---

# Workstream 7 — Route effects + power sequence (P1)

This workstream rewrites `docs/plans/2026-11-23-route-effects.md`.

### Task 7.1 — Rewrite the route-effects plan

- [ ] Replace Task 2 (“B6 flip corridor”) with “B4 side corridor, turn right”; move the observed room + closet + breaker + port there; keep the campaign stage IDs; update the B6 reference to the architectural core (not a compute core).
- [ ] Update Task 3 (campaign route) and Task 4 (reveal effects): B4 keyboard → exterior B4 lit + a mesh beam (tower-to-tower, not to a central core) → walk around to the B4 side entrance → flip wall → breaker → MacBook.
- [ ] Update the gates named in the plan (`check-campaign-b4`, playthrough, style, door coordinates).
- [ ] Owner reads the rewritten plan before implementation.

### Task 7.2 — In-building keyboard effect

**Files:** `src/campaign/b4Chapter.ts`, `src/opening/b4Shell.ts`, `scripts/check-campaign-b4.ts`.

- [ ] On solve: per-key row/column flash, keyboard point light, window/panel rows 01–02, CPU 01 online. Keep the existing keyboard rules (54 caps; save-compatible `FlipState`). **Keyboard phrase is an open decision:** current build `I LOVE CDS`, observed wall `I S L O V E J C D S`, design-state `I LOVE JCDS`. Do not change it until the owner rules.
- [ ] Gate: headless stage→light assertions + browser screenshot.

### Task 7.3 — Exterior lighting + beam

**Files:** **reuse `src/opening/exteriorLighting.ts` (created in Task 5.1; do not duplicate it)**, `src/campaign/b4Chapter.ts`, `src/main.ts`, `scripts/check-campaign-b4.ts`.

- [ ] One instanced emissive-quad layer per building (B04, B05, B06, towers) over the facade window grid; `setRows(building,count)` and `setAll`; no shadows; one material per building.
- [ ] B4 solve: B04 rows light over 1.8 s; a **mesh beam from B04 to its nearest tower** (or along the atrium ring) grows over 0.6 s — never a beam to a central core.
- [ ] All state derived from the campaign stage; reloads restore lit buildings; no new save field.
- [ ] Gate: stage→light mapping via the debug API; screenshots inside/outside.

### Task 7.4 — Flip-wall puzzle + breaker + MacBook (**Phase 1, not Phase 3**)

**Files:** new `src/campaign/b4FlipChapter.ts`, `src/campaign/b4Puzzle.ts` (**build the tile station; the old `FlipState`/`flipTiles`/`flipSolved` helpers are save-compat only — do not claim reuse**), `src/opening/b4FlipRoom.ts`, `src/opening/b4Layout.ts` (add the closet/breaker/port), `scripts/check-campaign-b4.ts`.

- [ ] Build the `b4_flip` station, its focus view and the interaction. The current build only has the 1.2 s automatic service-shutter beat; the tile puzzle is a feature build, not a rewiring. Remove the automatic beat.
- [ ] At the wall: tile flip/sweep, the wall hinges open, `flip_solved`; then the breaker, then the MacBook port.
- [ ] **Task 2.1 mounts the shell + wall only.** This task owns the aux closet, breaker and port and places them in the side corridor; the CDS-1 room keeps the Keyboard Wall only.
- [ ] Keep the campaign stage IDs (`b4_flip`, `b4_breaker`, `b4_connect`) and old saves readable; relocate old poses to the side corridor.
- [ ] Gate: tile puzzle rules, wall opening, breaker/port order, save resume at each stage; browser screenshots.

### Task 7.6 — Realism pass (owner-forwarded suggestion, reviewed)

**Verdict:** keep the cheap wins, gate the expensive ones, and do not add a postprocessing dependency to the critical path.

- [ ] **ACES:** already in `src/main.js` (`ACESFilmicToneMapping`, exposure 1.05). Verify the setting survives every render path; no work beyond that.
- [ ] **Window emissive:** already owned by Task 7.3 (one instanced emissive-quad layer per building). Do not duplicate it here.
- [ ] **FogExp2:** add behind a quality flag (`?quality=high` or the settings toggle), with a per-zone density table. A/B screenshots at the lawn, B4 exterior and sports hall. Do not ship it by default if it flattens the campus or costs more than ~5% frame time at 390×844.
- [ ] **Bloom:** optional `EffectComposer` + `UnrealBloomPass` behind the same flag. Measure at 390×844; if it costs more than ~10% frame time, leave it off by default and keep it for the video capture only. Not P0.
- [ ] **InstancedMesh:** already used (561 flip tiles). Task 8.2 owns extending it to repeated props; measure draw calls before/after.
- [ ] Gate: A/B screenshots and a frame-time table at 390×844; owner picks the default from the table.



# Workstream 8 — World scope + memory (P1)

Use `docs/plans/2026-11-23-world-scope-perf.md` Tasks 1–6 as written, with the following additions.

### Task 8.1 — Zone registry + streaming (plan Task 1)

- [ ] `src/world/zones.ts`, `src/world/zoneManager.ts`; migrate the sports hall and B4 5F office first; keep the debug hooks. B5 4F is P2 (Task 8.4), not part of this first migration.
- [ ] Gate: load/unload at 25/45 m, memory returns to baseline, no duplicate IDs.

### Task 8.2 — Exterior performance pass (plan Task 2)

- [ ] Measure the baseline (1,947 calls, 374,513 triangles, 95 MB heap); merge/instance glass and repeated furniture; cut casters; target ≤1,200 calls, ≤300k triangles, ≤14 MB geometry, ≤4 MB textures, ≤350 shadow casters.
- [ ] Gate: raw counters via the debug hook; `check:perf` once Task 8.8 lands; before/after screenshots. **Task 8.8 runs before this task in the recommended order.**

### Task 8.3 — Sports hall fit-out (plan Task 3)

- [ ] Court, hoops, bleachers, scorer’s table, banners, lights; ≤120 extra calls, ≤25k triangles; collision; walk-through.

### Task 8.4 — B5 4F lounge (plan Task 4) — **P2/later**

- [ ] Convert the cutaway into a room; stair, rails, tier collision; ≤80 calls, ≤20k triangles. This is the first step of the owner’s “B5 or the parts further up, later” scope; it is not on the demo-critical path.

### Task 8.5 — B01–B03 lobbies, link corridor, tennis courts (plan Task 5)

- [ ] Each is its own zone; no interior resident with another; collision aligned with the exterior.

### Task 8.6 — B4 5F office + side lobby (new; part of Task 2.2)

- [ ] The B4 5F office is a zone; the lift cab is a short transition; budget ≤60 calls, ≤15k triangles.

### Task 8.7 — Memory pass

**Files:** `src/main.ts` (debug hooks), `src/model/*`, `src/world/*`, `docs/PERFORMANCE.md`, new `scripts/check-memory.ts`.

- [ ] Measure at spawn, B4 interior, dinner hall, lawn, sports hall, ending: `__CAMPUS.memory()`, `resources()`, deferred textures, and **heap**. `__CAMPUS.memory()` returns geometries/textures/programs only — it has no heap and exists only in DEV/review builds. Add a `__CAMPUS.heap()` debug hook or use `performance.memory`/a DevTools allocation snapshot, and record which one the gate uses.
- [ ] Find and fix leaks: disposed materials/geometries/textures, overlays not disposed, duplicate scene objects, per-frame allocations, shadow map size, texture sizes.
- [ ] **Target is provisional.** Baseline is 95.4 MB heap. Geometry ≤14 MB + textures ≤4 MB yields ≈93 MB, so 80 MB is not reachable from those sub-budgets. Measure after the zone/streaming pass and set ≤85–90 MB; if the owner wants ≤80 MB, add a real reduction item (texture compression, zone unload, shadow-map cut) before claiming it.
- [ ] Gate: `check:memory`; a table in `docs/PERFORMANCE.md` with before/after and the chosen heap instrument.

### Task 8.8 — `check:perf` wiring (**runs before Task 8.2**)

- [ ] Build the review bundle, fixed camera path in the exterior and each zone, assert the ceilings, write JSON + screenshot sidecars; wire into `check:all` after the visual checks.

### Task 8.9 — Asset compression: Draco + WebP (direct fix for “模型太慢”)

**Why:** the group’s strongest performance complaint is model load time. Compression is the one change that attacks it directly; the rest of Workstream 8 is scene-side.

**Files:** new `scripts/compress-assets.mjs`, `src/loading/gltf.ts` (or the existing loader), `public/draco/*` (copied from `node_modules/three/examples/jsm/libs/draco/`), `docs/PERFORMANCE.md`.

- [ ] Add `@gltf-transform/cli` as a dev dependency. For each shipped GLB: `gltf-transform optimize <in>.glb <out>.glb --compress draco --texture-compress webp`. **WebP first** — it needs no runtime transcoder. Use KTX2 only if memory is the bottleneck and the KTX-Software toolchain is installed; do not make KTX2 a blocker.
- [ ] Wire `DRACOLoader` into the GLTF loader with a **local** decoder path (`public/draco/`), never a CDN — the demo-day fallback must work offline.
- [ ] Keep source GLBs out of `dist/`; only the compressed copies ship.
- [ ] Gate: same-route load time and heap before/after, a visual diff at the B4 facade and lawn, and no missing textures. Record the numbers in `docs/PERFORMANCE.md`. If compression does not improve load time, keep the originals and say so.

---

# Workstream 9 — Lion + rescue (P1)

### Task 9.1 — Lion skill composition

Use `docs/plans/2026-11-23-lion-skill-system.md` Tasks 1–6 as written: primitive catalog, composition schema, combat channels, Vibe Console, local model relay, gates. Add one integration task:

- [ ] `ROBOT_HIJACK` / `TARGET_LURE` connect to the WS-6 robot fleet through a narrow interface; no live player position passed to the model; keys stay server-side.
- [ ] Gate: `check:lion-boss`, `check:skill-compiler`, browser compose/test/install/cast.

### Task 9.2 — Student rescue

Use `docs/plans/2026-11-23-student-rescue.md` Tasks 1–5 as written. Add:

- [ ] Dialogue style matches WS-6 (same panel, same voice pipeline); the representative uses a virtualised cohort name.
- [ ] Gate: `check:sports-students`, `check:door`, browser rescue.

### Task 9.3 — Lion feet evidence re-capture

The code review says SPEC PASS WITH DEVIATIONS, QUALITY APPROVED WITH MINOR ISSUES, no MAJOR code findings. One Important evidence issue remains. This verdict is quoted from the `lion-feet-review` transcript; there is no local artifact yet.

- [ ] Record the verdict in `evidence/lion-feet-b1a2fdb/` (a short `REVIEW.md`) so the claim is not transcript-only.
- [ ] Re-capture the seated after images from the fixed portrait camera after `enterCompat()`; record the hide count (expect 6) in `DIFF.txt`; commit `seated-diff-amplified.png`; correct `NOTE.md` and the report.
- [ ] Fix the comment at `src/lionBoss/lionRig.ts:657-659` that contradicts the measured 383 px story; correct the report’s `chargeWarn` hips cell (`.437` → `.4431`).
- [ ] Owner visual sign-off on the walk gait (the review says walk/run have no stance phase; pre-existing style).
- [ ] Gate: `check:lion-rig`, `check:lion-boss`; evidence folder re-committed.

### Task 9.4 — Lion encounter story / quest / arena pass

The group asked whether the lion fight had changed and named the missing pieces: “剧情，任务，环境” — story, quest, environment (group chat, 2026-11-23 19:57).

**Files:** `src/lionBoss/*`, `src/gameplay/*` (objective/quest plumbing), `src/opening/spatialLayout.ts`, `src/opening/world.ts`, `docs/plans/2026-11-23-lion-skill-system.md`, new `scripts/check-lion-encounter.ts` / browser gate.

- [ ] **Story:** the lion is the campus system’s physical defence robot; the infected system misidentifies the player as an intruder, so the player fights it with software skills, not weapons. Put this in the mission brief and one radio/NPC line; keep the external AI distinct from the MacBook’s local assistant.
- [ ] **Quest:** objective chain — reach the lawn, scan the lion, compile/equip skills, disable the two defence locks, cut the core power, survive/escape. Fail/retry with a clear reason; save at each step.
- [ ] **Environment:** dress the lawn arena around the lion — barriers, cover, campus signage, lighting, a safe zone and a camera framing that reads at 1280×800 and 390×844; collision; no new always-on world.
- [ ] Gate: a browser playthrough of the full encounter, including one fail/retry, no soft-lock; screenshots; owner visual sign-off.

---

# Workstream 10 — Visitor experience + demo + polish (P1/P2)

### Task 10.1 — First-visit route and discovery loop

**Files:** `src/gameplay/landmarks.ts`, `src/gameplay/survey.ts`, `src/opening/map.ts`, `src/opening/ui.ts`, `src/opening/world.ts`, `src/levels/menu.ts`, `scripts/check-survey.ts`.

- [ ] **Minimum wayfinding ships in Phase 1 as Task 2.6** (spawn orientation, map markers, objective arrow, landmark labels). This task adds the full discovery loop on top; the route is not demo-ready without the minimum.
- [ ] Keep the Campus Survey (three records + archive sync) as the exploration spine; add a first-visit route from the spawn to the B5 dinner, B4 entrance, lawn and sports hall.
- [ ] Add clear wayfinding: map markers, signage, landmark labels; the player can always see where the next objective is.
- [ ] Add a “discover the campus” card that explains the four PU towers and the decentralised-computer idea in one screen (not a wall of text).
- [ ] Gate: `check:survey`, browser walk of the route; screenshot.

### Task 10.2 — 15-minute demo script

**Files:** new `docs/DEMO-SCRIPT.md`.

- [ ] Who it is for (first-time visitors), the live main interaction, one team decision (the decentralised-campus choice), strengths, limitations, and the offline/LLM fallback.
- [ ] Time-box: 2 min intro, 9 min demo, 2 min strengths/limits, 2 min questions.
- [ ] **Route timing table.** Measure each leg (B5 → B4 main → B4 5F → B5 incident → B4 Keyboard Wall → exterior walk-around → side door → flip wall → MacBook → lawn → sports hall → finale) and record the total. The route crosses B4↔B5 three times; if the live demo exceeds ~9 minutes, use checkpoint jumps for the demo and keep the full route for the game. Say why the flip wall is on the second B4 visit (the exterior lit + beam beat comes first).
- [ ] Rehearse the demo twice; record a backup video; keep a local static snapshot of the stable build. No network dependency.
- [ ] No code; owner reviews.

### Task 10.3 — UI style, interaction feel, decorations

**Files:** `src/opening/opening.css`, `src/opening/game-shell.css`, `src/style.css`, `src/levels/menu.ts`.

- [ ] One dark-HUD vocabulary; consistent ink/paper/green/gold tokens; hover/focus/pressed states; no new colours; readable at 390 px.
- [ ] Interaction feel: interaction prompt distance/aim, door/lift feedback, subtitle timing, camera comfort (FOV/shake), pause transitions.
- [ ] Decorations: signage, posters, plants, campus records; all from CC0 asset packs or original geometry; no Minecraft/Mojang assets.
- [ ] Gate: visual screenshots; `check:mobile`; no new console errors.

### Task 10.4 — Game name (owner decision)

- [ ] Owner chooses **BARRIER 2030** (working title), **CDS at War**, or **HKU at War**.
- [ ] If renamed: update `document.title`, `src/levels/menu.ts`, the pause card eyebrow, credits, `README`, evidence filenames; add a redirect/alias if a URL carries the old name. No code until the decision.

### Task 10.5 — B5 upward extension (later)

- [ ] Only after the P0/P1 route and performance work: the B5 4F lounge (plan Task 4) is the first step; further floors are out of scope for this plan.

### Task 10.6 — Spoiler-free teaser trailer

- [x] **v1 first cut built:** `demo/teaser/barrier-2030-teaser-v1.mp4` (35.5 s, 1080p, −14.3 LUFS, poster + README). It has the title, the B5 dinner with the Coordinator line, the Keyboard Wall/Flip Wall hints, the Lawn Guardian, the campus, the alert and a hard blackout — no boss fight, no puzzle solution, no ending. The steps below are the v2 cut.

**Files:** new `demo/teaser/` (storyboard, shot list, edit project), `assets/audio/teaser/` (music + mix), output `demo/teaser/barrier-2030-teaser-v1.mp4`; `scripts/check-teaser.sh` or a README with the ffprobe checks.

- [x] **Step 1: Write the 35–45 s beat sheet.** v1 beat sheet is in `demo/teaser/README.md`.
- [x] **Step 2: Capture.** v1 uses the current stable build and existing evidence (`demo/pitch/media/`, `demo/pitch/img/`). 16:9, 1080p, 30 fps.
- [x] **Step 3: Music.** The v1 cue is 31.47 s, D minor, 96 BPM, rendered from a score + the `symphony` style card; stems and licence note in the README.
- [x] **Step 4: Edit.** Hard cuts on the beat; no montage longer than 3 s in the middle; the last beat is a hard blackout.
- [x] **Step 5: Check.** v1 is 35.5 s, 1920×1080, 30 fps, −14.3 LUFS, −1.5 dBTP; poster and README exist.
- [ ] **Step 6: v2 capture.** Re-capture the opening MVP and the new alert copy; replace the middle stills.
- [ ] **Step 7: v2 sound.** Add a second NPC exchange and the abduction SFX (Task 6.7); final 40–45 s mix with one bigger impact on the blackout.
- [ ] **Step 8: Owner review.** Show v1 (`demo/teaser/index.html`) and decide 35 s vs 45 s, narrator vs music/SFX only (Open decision 17).

### Task 10.7 — 60–90 s lab demo (submission video)

The lab asked for a demo video, not only the spoiler-light teaser (group chat, 2026-11-23 15:46 / 19:56).

**Files:** new `demo/submission/` (beat sheet, edit project), `assets/audio/demo/`, output `demo/submission/barrier-2030-demo-v1.mp4`, `scripts/check-demo.sh`.

- [ ] Beat sheet: version slate → opening/Magic Hour → dinner + NPC line → B4 Keyboard Wall → flip wall → lion skills (show one skill, not the full solution) → ending hint → credits. 60–90 s.
- [ ] Use the current stable captures; re-capture after the opening MVP. 1920×1080, 30 fps, original music, −14 LUFS / −1.5 dBTP.
- [ ] No full boss fight solution, no full puzzle solution, no full ending; the lab demo may explain the loop more than the teaser, but keep the ending as a hint.
- [ ] Gate: `ffprobe` duration 60–90 s, 1080p, loudness; no unintended black frames; owner reviews.

---

# Workstream 11 — Verification (P1)

### Task 11.1 — Ego lite full playtest

- [ ] Dispatch a read-only subagent with ego-browser: fresh boot → opening → phone Yes → B5 dinner → B4 5F office → incident → B4 Keyboard Wall → exterior B4 lit → B4 side flip wall → breaker → MacBook → lawn → sports hall → ending light show.
- [ ] Also test: pause chapter select, drag control, hover/lore/dialogue, robot chase/coordination, dinner music, mobile 390×844.
- [ ] Produce a structured report: severity, repro, expected/actual, screenshot path. Do not fix in the playtest agent.

### Task 11.2 — Fix P0/P1 findings

- [ ] One implementer at a time; each fix gets a scoped re-review; no gate weakening.

### Task 11.3 — Full gate suite

- [ ] `npm run check:all`, `npm run check:prologue-browser`, `npm run check:campaign-playthrough`, `npm run check:mobile`, `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/vite build`, `npm run build:review`.
- [ ] **One page, no reload:** run `check-campaign-browser.py` (`location.href` unchanged, `__doc === 1`) and `check-campaign-walk.ts` across the full route, including the new exterior leg. The earlier SPEC’s interior-only station chain is invalidated by the walk-around; extend it, do not drop it.
- [ ] Browser gates on the review build with the known Chrome/SwiftShader flags; no page errors; the only allowed console errors are the known `ws://127.0.0.1:8788` bridge-refused lines when the bridge is absent.

### Task 11.4 — Evidence + owner acceptance

- [ ] Per workstream: screenshots/video, sidecars with the commit sha, before/after where relevant.
- [ ] Owner sees the opening, the dinner, the B4 side-door flip wall, the finale light show, the pause chapter select, the drag fix, and the robot/dialogue pass.
- [ ] Merge/push only after explicit OK.

### Task 11.5 — Final playtest, then record the video (owner-ordered finish line)

**Owner instruction, 2026-11-23:** “计划的最后就是，完成之后，你要试玩，然后录视频。”

This is the **last thing that happens**, after the release tag is cut and every other gate is green. The order is fixed:

1. **Play it yourself, end to end, on the tagged build.** Not a chapter jump, not a debug seek: fresh boot → opening → phone Yes → B5 dinner → B4 5F office → incident → B4 Keyboard Wall → exterior B4 → B4 side flip wall → breaker → MacBook → lawn → lion → sports hall → ending light show → credits. Record the run (screen + inputs + console) and note every bug, dead moment and soft-lock.
2. **Fix only P0/P1** found in that run; if a fix changes the build, cut a new patch tag.
3. **Re-play the fixed build** on the same route; the second run is the one that gets recorded.
4. **Record the video from that run** — real gameplay, same tag, with the final score and voice in the mix. Capture the WebGL canvas directly (`canvas.captureStream(60)` + `MediaRecorder`, or Playwright video) and merge game audio through a `MediaStreamAudioDestinationNode`; transcode to H.264 MP4 with ffmpeg. Canvas capture gives clean 1080p with no browser chrome. The 35–45 s teaser (`10.6`) and the 60–90 s lab demo (`10.7`) are cut from this footage plus the trailer captures; the lab demo is not a slideshow of old screenshots.
5. **Deliver to the owner:** the full playtest report, the raw run capture, the cut video, and the tag/commit label. The owner pushes and deploys.

- [ ] No “video done” claim from a build that was not played end to end first.
- [ ] No cut that hides a known P0/P1; known issues go in `KNOWN-ISSUES.md` and, if visible, in the video description.
- [ ] Gate: the playtest report exists; the video’s version label matches `VERSION`; the run has no console errors other than the allowed bridge lines.

---

# Workstream 12 — Versioning + tag-based release (P0, tonight)

> **Owner ruling, 2026-11-23 (evening):** no frozen archive. The freeze scripts, SHA256 manifest and `check-submission-package` are **cancelled**. Instead, every playable build gets a git tag starting at `v9.1.0`; the final video is recorded from the tagged build. The owner pushes to the private GitHub repo, deploys it and shares the link **themselves**; this repo uploads nothing. Before any push: rotate the two exposed `sk-` keys, and run the secret scan as a **pre-push gate**.

The lab group asked for a playable link, a fixed source version, the demo video and slides; the messages are in the WeChat group “Vibe Coding Hackathon CDS SH” on 2026-11-23 (15:46, 18:55, 19:05–19:07, 19:56). The release must be labeled, reproducible and secret-free. **No upload from this repo.** Every playable version gets a tag; later work gets a new tag.

Coordinate with `opening-mvp`: it is still editing `src/main.ts` and the opening files. The version files (`VERSION`, `CHANGELOG.md`, `submission/`) can land now; the UI/build-label edit waits for the agent to report.

### Task 12.0 — Rename to HKU Shanghai at War (owner ruling)

**Files:** `index.html`, `src/levels/menu.ts`, `src/campaign/endingChapter.ts`, `src/gameplay/sportsDoorCore.ts`, `src/opening/prologue.ts`, `src/main.ts`, `content/opening/en.ts`, `README.md`, `submission/README.md`, `CHANGELOG.md`.

- [x] Menu, document title, credits, ending line, `content/opening/en.ts`, README and submission README read **HKU Shanghai at War**; “BARRIER 2030” is the subtitle.
- [ ] Title card (`src/opening/prologue.ts`) and pause card (`src/main.ts`) — held until `opening-mvp` stops editing those files, then switched in one small commit.
- [ ] Video intro slate uses the new title; the end card keeps the subtitle.
- [ ] In-game story copy is **not** rewritten beyond the title/credits lines.
- [ ] Gate: a grep for the old name returns only legitimate story/prose uses; screenshots of menu, title card, credits and pause card.

### Task 12.1 — Version number + visible build label

**Files:** `package.json`, `VERSION` (new), `CHANGELOG.md` (new), `vite.config.ts`, new `src/buildInfo.ts`, `src/main.ts` (pause card/credits), `src/opening/opening.css`, `scripts/check-version.ts` (new).

- [x] Choose the lab release version: **`9.1.0`** (keeps the existing `9.0.0` line; if the owner wants a fresh line, change it here), build metadata `+2026-11-23.<sha>`.
- [x] `VERSION`, `package.json` and `package-lock.json` agree on `9.1.0`; `CHANGELOG.md` opens with `## [9.1.0] — 2026-11-23`.
- [ ] Vite defines `__APP_VERSION__`, `__GIT_SHA__`, `__BUILD_TIME__` from `VERSION` + `git rev-parse --short HEAD` + ISO date; fallback when git is absent.
- [ ] UI: the pause card footer and credits show `HKU SHANGHAI AT WAR · BARRIER 2030 · v9.1.0 · <sha> · 2026-11-23`; expose `window.__CAMPUS.version`.
- [ ] Keep the save-schema version separate from the app version; do not reuse the app version as the save version.
- [ ] Gate: `check:version` asserts `VERSION`, `package.json`, the built bundle, the UI text and `__CAMPUS.version` agree; screenshot.
- [ ] Commit `feat(release): version the build and show it in the UI`.

### Task 12.2 — Tag the playable build (replaces the freeze/archive task; cancelled per owner ruling)

**Files:** `VERSION`, `CHANGELOG.md`, new `scripts/pre-push-secret-scan.sh`.

- [ ] **Tag rule:** at release time, take the last green commit, build it, verify it boots, then create the annotated tag `v<version>` (first one: `v9.1.0`). The tagged build is the release artifact; the final video is recorded from this build. No source zip, no build zip, no SHA256SUMS, no freeze script.
- [ ] **Secret scan before push:** `scripts/pre-push-secret-scan.sh` greps the tracked tree (excluding `.env`, `node_modules`, `content/names/cohort-source.txt`, `*.key`, `*.pem`) for `sk-`, `ntn_`, `ghp_`, `Bearer ` and fails on a hit. Run it before every push; the owner does the push themselves.
- [ ] **Key rotation first:** the two `sk-` keys posted in the group chat on 2026-11-23 19:51/19:54 are compromised; the owner rotates them before the first push.
- [ ] Gate: `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/vite build`, the P0 gates, the secret scan; then tag.
- [ ] Commit `chore(release): tag the playable build`.

### Task 12.3 — Playable link (owner-deployed)

- [ ] The owner deploys the tagged build themselves (private GitHub repo → their own host) and shares the link; this repo **does not upload anything**.
- [ ] Keep a **local fallback for demo day**: a static server serving the tagged `dist/` on a known port, rehearsed once, so the demo never depends on venue network.
- [ ] Gate: the owner’s link loads with no console errors; the version label matches `VERSION`.

### Task 12.4 — Slide deck (updated per owner ruling)

- [ ] 8–10 slides: title (**HKU Shanghai at War**, subtitle “BARRIER 2030”, version + tag); who it is for (the lab/competition audience and the visitor experience); the campus as a decentralised computer; the story (Magic Hour, dinner, external AI vs local AI); the loop (explore → errand → puzzle → lion → finale); **new features this round: full score + expressive voice cast + first-person 3D errand pacing**; the tech (Three.js, one page, mesh, zone streaming); **strengths & limitations** (honest: perf budget, canned dialogue, content scope); **one team decision in depth: first-person 3D + the 30–45 s errand pacing** (why the approach is paced by information beats, not a stopwatch); the demo; what’s next; credits.
- [ ] Slides 口径 must match the demo video: same name, same tag/version, same claims, no spoilers beyond the video.
- [ ] Export PDF/PPTX under `submission/slides/`; owner reviews.
- [ ] Gate: slide count, name/tag consistency with the video, no spoiler creep.

### Task 12.5 — Group bug triage

- [ ] Pull today’s group chat (WeChat “Vibe Coding Hackathon CDS SH”, 2026-11-23 19:33–20:02 and any later messages); list every report: UI changed?, robot dog, eight humanoid robots missing, “很多小细节”, lion fight.
- [ ] Severity P0/P1/P2; repro; owner. Fix P0/P1 before the tag; park P2 in `KNOWN-ISSUES.md`.
- [ ] Do not fix in the triage agent; route to WS-6/9/11.
- [ ] Gate: `submission/<version>/KNOWN-ISSUES.md` lists every report and its status.

### Task 12.6 — Submission folder (simplified; no checksums per owner ruling)

- [ ] `submission/README.md`: version, git tag, how to run, controls, credits, licences, known issues.
- [ ] `LICENSES.md`: assets, music (Greensleeves PD + original arrangements + MIT soundfont), voice (ElevenLabs takes, provider/licence note), fonts.
- [ ] No SHA256SUMS, no manifest checker — the git tag is the release identity.
- [ ] Gate: README/licences exist and match the tagged build; no secrets.

### Task 12.7 — Push + deploy (owner does it)

- [ ] The owner pushes the tagged commit to the private GitHub repo, deploys, and sends the link to the lab. This repo runs the **pre-push secret scan** (Task 12.2) before the owner pushes; nothing here uploads.
- [ ] Before the first push: the two exposed `sk-` keys are rotated (owner action; the scan also guards the tree).
- [ ] Gate: secret scan green; tag exists; the owner confirms push/deploy; record the link in `submission/README.md`.

---

# Workstream 13 — Full score + voice (P1, owner-requested 2026-11-23)

The game currently has a small cue set and one staff voice that reads as flat. This workstream builds a cue for **every part of the game**, a family of original HKU/Greensleeves variations, and a more expressive voice cast. It is deliberately parallel to the code workstreams: composers write files, they do not edit gameplay code.

**Music rights ruling (binding):**
- The **Greensleeves melody and the 16th-century-style arrangement** are public domain in Hong Kong and the mainland. The **1981 Decca/UMG recording** that was used earlier is **not** — it stays protected until at least 2031-12-31. We never sample, rip or re-use any commercial recording; we write our own score and render it with `MuseScore_General.sf3` (MIT).
- “Different versions of HKU” means **original HKU-2030 themes and original variations on the Greensleeves tune** — stately processional, Soviet-style march, stealth/tension, waltz, chase, boss, hope. It does **not** mean the official HKU anthem or any copyrighted recording. Do not use the anthem unless the owner confirms rights in writing.
- Borrow **technique and style**, not another composer’s notes. Every melody is original or public domain; every arrangement is ours. Record the provenance in `assets/audio/story/score/LICENSES.md`.

### Task 13.1 — Score blueprint + cue map

**Files:** new `docs/plans/2026-11-23-score-cue-map.md`, `docs/plans/2026-11-23-music.md`, `.scratch/music-2026-11-23/` (working), `assets/audio/story/score/` (final).

- [ ] Write one cue map covering every place the player hears music: **title/menu, prologue Magic Hour, crowd walk, B5 dinner, B4 side lobby / lift, 5F corridor, MacBook alert, lawn/lion approach, lion boss, stealth/chase, flip-wall puzzle, sports hall, finale mesh light show, credits.** For each: cue name, stage/trigger, length in bars, intensity, loop/one-shot, crossfade target, and whether it uses the HKU theme, the Greensleeves theme or neither.
- [ ] Define the **HKU theme** as a short original motif (4–8 bars) that can be stated in the styles above. Define the variation matrix: `processional`, `soviet-march`, `stealth`, `waltz`, `chase`, `boss`, `hope`. Same motif, different orchestration, tempo and rhythm.
- [ ] Use the existing grid (72 BPM, A minor, 32-bar loop) where it helps crossfades; a cue may change tempo/key when it is a one-shot stinger.
- [ ] Licensing note: public-domain melody/own arrangement; no commercial masters; no anthem without written confirmation.
- [ ] Gate: the map has a row for every stage in the story state and every non-story musical moment; owner reads it before mass rendering.

### Task 13.2 — Compose the cue family (parallel subagents)

**Files:** `.scratch/music-2026-11-23/<cue>/score.json`, `style.json`, `*.wav`, `NOTES.md`; then the selected cues under `assets/audio/story/score/`.

- [ ] Dispatch **3–5 composer subagents in parallel**, one cue family each (e.g. ceremonial/dinner; stealth/chase; boss/lion; finale/hope; menu/credits). Each reads `vibe-compose-onezion` and works only in its own `.scratch/music-2026-11-23/<family>/` folder.
- [ ] Each composer delivers: `score.json`, `style.json`, a rendered WAV, a short `NOTES.md` (what it is, where it plays, licence/provenance, known weaknesses) and **two alternative takes** for the owner’s A/B.
- [ ] Rules for every subagent: no samples from commercial recordings; no copying a named composer’s melody; original or public-domain melody only; use the skill’s `compose.py` and `MuseScore_General.sf3`; do not edit game code; do not push or merge.
- [ ] Gate: every file renders without a Python exception; each WAV is loudness-normalised to −14 LUFS / −1.5 dBTP for the audition folder; a contact sheet lists all takes.

### Task 13.3 — Audition and select

- [ ] Build `.scratch/music-2026-11-23/audition.html` (local, no server dependency) with one row per cue and A/B buttons for the takes; the owner listens and marks a choice per cue.
- [ ] Keep every take; do not delete the rejected ones — they are alternates for later.
- [ ] Gate: the owner has marked a take for every cue (or “none of these, redo”) before integration.

### Task 13.4 — Integrate the score

**Files:** `src/gameplay/storyAudioAssets.ts`, `src/gameplay/storyAudio.ts`, `src/opening/atmosphere.ts`, `src/opening/experience.ts`, `scripts/check-story-audio.ts`, `docs/plans/2026-11-23-music.md`.

- [ ] Wire the selected cues to the cue map; one active music bus; crossfade on the bar where possible; duck music under dialogue; restore after.
- [ ] Add the **lobby TV/CCTV audio** and the 5F abduction layer here if Task 6.7 has not landed: feed static, a cut to silence, then the servo/shout/door.
- [ ] Gate: every stage transition has a defined cue; no silence where the map says music; `check:story-audio` green; a browser run records the active cue per stage.

### Task 13.5 — Voice cast + regenerated lines

**Files:** `content/voice/profiles.json`, `src/opening/voice.ts`, `scripts/check-opening-voice.ts`, `assets/audio/npc/staff/`, `assets/audio/voice/` (new), `submission/<version>/LICENSES.md`.

- [ ] Replace the flat single-voice read with a **cast**: Coordinator (calm, urgent), staff member (warm, flustered), local MacBook AI (quiet, precise), external AI (processed, cold, never gloating in the same timbre as the local AI). Each profile records voice id, provider, model, speed, stability/style settings and a licence note.
- [ ] Prefer **ElevenLabs** if a key is available locally; otherwise audition the best local TTS/voice-actor options and record which provider was used. Never put the key in the repo, the build or the archive; read it from `.env`/Keychain at generation time only.
- [ ] Re-record every existing line, including the B4 5F retarget from Task 2.2 (`staff-line2.wav`, `staff-line3.wav`) and the alert copy; write subtitles from the same text; gate duration and intelligibility.
- [ ] Produce **two or three takes per line** in the audition page so the owner can pick energy, not just wording; keep the chosen take per line.
- [ ] Gate: `check:voice`, `check-opening-voice`; every line has a matching subtitle and file; no provider key or raw credential in any committed file; the owner has heard the samples.

### Task 13.6 — Voice integration + A/B

- [ ] Bind the chosen takes to `profiles.json`; sub/dub sync; no clipped first/last syllable; consistent loudness across speakers.
- [ ] Build an A/B page with old vs new for the four principal lines; the owner marks approval.
- [ ] Gate: browser run of the prologue and the alert; no console errors; owner approval recorded in the ledger.

---

## Recommended order and dependencies

```
Release track (tag-based, per owner ruling 2026-11-23; the owner pushes/deploys, nothing here uploads)
  12.1 version + build label
  12.5 group bug triage (start now)
  12.2 tag the playable build + pre-push secret scan (rotate the two sk- keys first)
  12.4 slides (new name, who-for, strengths & limitations, the pacing decision)
  12.3 playable link (owner deploys; keep a local demo-day fallback)
  12.6 submission folder (README + licences, no checksums)
  10.7 60–90 s lab demo (recorded from the tagged build)
  12.7 owner push/deploy

Phase 0 (independent files; still one implementer at a time)
  0.1/0.2 sources + canon notes
  3.0 bus → crowd reconcile (unblocks typecheck)
  1.1 pause chapter select
  1.2 drag control
  3.1 opening MVP review/land
  9.3 lion feet evidence re-capture

Phase 1 (route; sequential because they share B4 files)
  2.1 flip wall → B4 side entrance (site pre-flight first)
  2.2 MacBook errand → B4 5F + B6 return path + stairs/pipe
  2.3 retire the B6 errand assumption
  2.4 look-left MacBook pickup beat
  2.5 B6 architectural core dressing
  2.6 first-visit wayfinding minimum
  3.2 playable opening + errand reconcile
  7.4 flip-wall puzzle (pulled forward from Phase 3)
  7.1 rewrite route-effects plan

Phase 2 (experience; can be sequenced one implementer at a time)
  13.1 score map (start immediately; no code conflict)
  13.2 composers (3–5 parallel subagents, scratch folders only)
  13.3 owner audition
  4.1/4.2/4.3 dinner + the selected dinner cue
  13.4 score integration (code; one implementer)
  13.5 voice cast + re-record (mostly assets)
  13.6 voice integration + owner A/B (code; one implementer)
  5.1/5.2 finale light show (5.1 creates exteriorLighting.ts, after 2.5)
  6.1/6.2 names, lore, voice, chat
  6.3/6.4/6.5/6.6 robots
  6.7 abduction SFX
  6.8 SFX pass

Phase 3 (systems + scope)
  7.2 keyboard, 7.3 exterior lighting (reuses 5.1’s module), 7.5 music
  9.1/9.2/9.4 lion skills + rescue + encounter pass
  8.8 check:perf wiring, then 8.1–8.7 zones, exterior perf, interiors, memory

Phase 4 (polish + proof)
  10.1/10.2/10.3 visitor route, demo, UI polish
  10.6 teaser trailer
  11.1–11.4 Ego lite playtest, fixes, gates, owner acceptance
  11.5 final end-to-end playtest on the tagged build → fix P0/P1 → re-play → record the video
```

File-conflict notes:
- 2.1, 2.2, 2.3, 2.5, 3.2, 7.1, 7.4 all touch `src/opening/experience.ts`, `spatialLayout.ts`, `checkpoint.ts` and the B4 files → run sequentially.
- 4.x touches `world.ts`, `npcs.ts`, `spatialLayout.ts`; do not run it during 2.x.
- 13.1/13.2/13.3 write only `docs/` and `.scratch/music-2026-11-23/` → they can run alongside anything. 13.4/13.6 touch `storyAudioAssets.ts`, `storyAudio.ts`, `experience.ts`, `voice.ts` → sequence them as single implementers, never alongside 4.x/5.x/6.x.
- 5.1 creates `exteriorLighting.ts`; 7.3 reuses it. 5.1 must precede 7.3; do not create the module twice.
- 6.x touches `npcs.ts`, `robot.ts`, `robots.ts`, `ui.ts`; sequence with 4.x.
- 8.x touches `main.ts`, `world/*`, `model/*`; measure before and after the scope additions. 8.8 before 8.2.

## Acceptance checklist

- [ ] Pause page can jump to every chapter/checkpoint with no pointer lock.
- [ ] Drag look works, pauses cleanly, and does not fight UI clicks.
- [ ] The flip wall is in B4 at the campus-facing side entrance; enter, turn right; the B5 mount is gone. The door is on the **building’s exterior face**, and the room passes the 0.2 m bounding-box pre-flight (racks 1–3 resolved).
- [ ] The MacBook errand is the B4 5F office via the side-door lift; the stairs stop at 4F; B4’s stairs/hollow pipe are fixed.
- [ ] B6 is the auditorium/**architectural** core, not a compute master core; the atrium ring and tower-link anchors exist; the old `b6` checkpoint and `to_b6` save map forward.
- [ ] The opening: Magic Hour just ended → crowd → phone invitation → only Yes → B5 dinner; one continuous take; sunset; interior light beam; no bus stage.
- [ ] The B5 dinner has long tables, green cloth, lamps, place settings, a dais, seated guests, ambient chatter and a dinner cue.
- [ ] The security alert is the external AI speaking; the MacBook’s local AI is uninfected, and no line implies the invader owns or authored the local assistant.
- [ ] The walk to the president’s office takes as long as the abduction beat needs (~30–45 s); the lift is a real ride, not a teleport; the lobby CCTV, the feed cut and the 5F servo/shout/door all play before the office door.
- [ ] On MacBook pickup, the camera looks left at the security camera/monitor before the alert.
- [ ] The abduction beat has servo/struggle/door SFX and a silence beat; the general SFX pass covers UI, doors, footsteps, the lift, the keyboard, the flip tiles and the MacBook.
- [ ] A 35–45 s teaser exists with music, NPC snippets, hints of boss/puzzle/aftermath, and a sudden blackout; it does not show the full fight, puzzle solution or ending.
- [ ] The score has a cue for every stage in `docs/plans/2026-11-23-score-cue-map.md`; the HKU theme appears in at least the menu, prologue and finale, and Greensleeves appears in at least two scenes as original arrangements; no commercial recording or unlicensed anthem is used.
- [ ] The voice cast is distinct and expressive: separate Coordinator/staff/local-AI/external-AI profiles, 2–3 takes auditioned per line, owner-approved; no provider key in the repo, build or archive.
- [ ] The ending lights the four PU towers in a **mesh** (tower-to-tower links + atrium ring), never a star around a central core; the B3 laser show answers a second building, named only if the source confirms it; the player stays first-person on the balcony.
- [ ] NPCs/robots have hover “who is this”, lore, barks and voice; the cohort names are virtualised; the author credit is correct; the protagonist is unnamed.
- [ ] The robot dog is a credible chase; the **eight humanoid robots** are reconciled and visible; robots see, share sightings and coordinate; the stealth loop is legible.
- [ ] The lion encounter has its story beat, quest chain, fail/retry and lawn arena dressing.
- [ ] Lion skill composition and student rescue are playable.
- [ ] The title card, credits and README read **HKU Shanghai at War** with subtitle “BARRIER 2030”; in-story copy unchanged.
- [ ] A version number is visible and consistent: `VERSION`, `package.json`, the built bundle, the UI footer/credits and `__CAMPUS.version` agree; the save-schema version is separate.
- [ ] The release is a **git tag** (`v9.1.0`+) whose build boots and whose version label matches; no frozen zip/checksum artifacts. The two `sk-` keys are rotated and the pre-push secret scan is green before the owner pushes.
- [ ] The owner-deployed link boots the tagged build with the matching version label; a local static fallback for demo day has been rehearsed.
- [ ] The final sequence happened in order: a full end-to-end playtest on the tagged build, P0/P1 fixes only, a second full playtest, and **then** the video recorded from that run; the video label matches `VERSION` and the tag.
- [ ] The new zones are streamed; the draw-call/triangle/memory budgets pass; `check:perf` and `check:memory` are green; the heap result is measured (≤85–90 MB, or an owner-approved ≤80 MB with the extra reductions listed in Task 8.7).
- [ ] One page, one first-person run: `location.href` unchanged, `__doc === 1`, no reload through the full route; `check-campaign-browser.py` and `check-campaign-walk.ts` are green.
- [ ] The route timing is measured; the 15-minute demo has been rehearsed twice with a recorded backup and a local static build snapshot.
- [ ] The keyboard phrase decision is recorded and the build matches it.
- [ ] The Ego lite playtest found no open P0/P1 issues.
- [ ] `check:all`, the browser gates, `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/vite build`, `build:review` are green.
- [ ] The owner has seen the evidence and said OK; nothing is merged or pushed before that.

## Open decisions for the owner

1. **Game name (DECIDED 2026-11-23, SUPERSEDED 2026-11-24):** the name is now **HKU: Barrier 2030** — one name, no separate subtitle. Owner’s words: 「然后游戏名就叫HKU:Barrier 2030吧」. Everywhere the earlier ruling wrote “HKU Shanghai at War” with “BARRIER 2030” as a subtitle, read the single new name; the former subtitle slot now carries “A CDS campus story”. Title card, credits, README, menu, pause card, ending line, `content/opening/en.ts`, submission and video title card switch; in-story copy stays.
2. **B4 side façade:** the plan no longer assumes `(50, 7)`. The pre-flight (Task 2.1 Step 2) lists B04’s real exterior faces; confirm the campus-facing face and the racks 1–3 decision (move or remove) before the cut.
3. **MacBook errand:** confirm B4 5F via the side-door lift (owner’s Notion note) rather than the current B6 office.
4. **B6 role:** confirm B6 is the auditorium/**architectural** core (gathering ring, not a compute master core), not the office/flip corridor.
5. **Dinner:** confirm B5 (current opening + WeChat), not B6.
6. **NPC dialogue scope:** canned lore cards + barks + voice (safe), or an LLM chat panel (needs the local relay and a content budget)?
7. **Humanoid robots:** reuse the existing robot rig with a humanoid mesh, or import a CC0 mesh?
8. **Cohort roster:** owner supplies the list (private, git-ignored) or approves a public list; the plan virtualises either.
9. **Opening optional AI-society line:** include the ~9 s line (prologue ~54 s) or keep the four-line ~45 s version?
10. **Finale length:** a 20 s cue suite or a longer 45–60 s show? The longer version needs more asset time.
11. **Teaser:** keep the 35.5 s v1 as the working cut, or wait for the opening MVP capture / go to 45 s; narrator voice or music/SFX only?
12. **B3 laser partner:** the WeChat source says B3 and “two buildings echo” but names B5 only as the dinner venue. Which building answers B3? Confirm from the video/site; do not assert B5 by inference.
13. **Keyboard phrase:** current `I LOVE CDS`, observed wall `I S L O V E J C D S`, design-state `I LOVE JCDS`. Which is canonical? Keep save compatibility.
14. **Opening interior beats + closing line:** the owner approved the script, but the prologue-story plan still lists these two open decisions. Confirm or close them before Task 3.1.
15. **B6 build vs dress:** dress the existing B6 room as the auditorium/atrium (recommended, cheap) or build a minimal new auditorium shell?
16. **Memory target:** set the measured target at ≤85–90 MB, or hold ≤80 MB and add the extra reductions (texture compression, zone unload, shadow-map cut)?
17. **Teaser v1 acceptance:** is the current 35.5 s cut approved as the working teaser, with v2 after the opening MVP?
18. **Version label (DECIDED 2026-11-23):** git tags start at `v9.1.0` and continue; the video is recorded from the tagged build.
19. ~~Playable link host~~ — decided: the owner deploys the tagged build to a private GitHub repo and their own host.
20. ~~Submission source visibility~~ — decided: private GitHub repo; the owner shares the link and whatever source access the lab needs.
21. **Submission video:** the 35.5 s teaser, the 60–90 s lab demo, or both? The lab asked for a demo video; the teaser is the ad.
22. **Upload (DECIDED 2026-11-23):** no frozen package; git tags from `v9.1.0`; the owner pushes to the private GitHub repo, deploys and shares the link; the two `sk-` keys rotate before the first push and the secret scan runs pre-push.
23. **Music theme direction:** is the game’s “HKU theme” an **original motif** (recommended; avoids any anthem issue), or do you want **Greensleeves itself** as the main HKU theme with the original motif as secondary? Either way the arrangements are ours; no commercial recording is used.
24. **Voice provider (DECIDED 2026-11-23):** ElevenLabs, quota approved (“配音额度随便用”); priority is main-line dialogue first. The key stays in `.env`/Keychain and never enters the repo or archive.
25. **Auditions (DECIDED 2026-11-23):** the machine (team lead) picks every cue take and voice take to keep the main line moving; the owner gets a **veto list** (chosen take + alternates per cue/line) instead of pre-approving each one. Voice quota is approved.

## What not to build

- No Minecraft/Mojang assets.
- No new always-on world; everything new is a zone.
- No runtime JS model editing; source parameters → regenerate → check.
- No keys or provider secrets in the browser or the build.
- No merge/push without explicit owner OK; the owner runs the push/deploy themselves after the pre-push secret scan.
- No deletion of owner-written Notion content, saves, or evidence.
- No “fix” that weakens a gate; extend the gate instead.
- No spoiler-heavy trailer: no full boss fight, no puzzle solution, no final result.
- No central-core beam or star-shaped finale; the campus is a mesh of four equal towers.
- No “80 MB heap” claim without the heap instrument and the reductions listed in Task 8.7.
- No B4 side-door cut before the exterior-face pre-flight and the 0.2 m room-fit gate.
- No second AI: the MacBook assistant is local and clean; the invader is a separate external AI.
- No upload/deploy by this repo — the owner pushes to the private GitHub repo and deploys; local fallback server only for demo day.
- No `.env`, keys, private cohort roster or personal data in the tagged tree or the build.
- No new features after the tag; only P0 fixes get a new patch tag.

## Self-review

- **Spec coverage:** every issue in the inventory §1–§2 maps to a task; the visitor/demo brief is covered by 10.1/10.2; the three WeChat sources are covered by 0.1, 3.1/3.2, 4.1/4.2 and 5.1.
- **Coverage numbering:** rows 1–21 match inventory §1–§2; the non-numbered rows are separate owner directions and today’s group requirements. The earlier shifted table is corrected.
- **Release:** version + git tag + owner-deployed link + slides + demo are covered by 12.1–12.7 and 10.7 (freeze/SHA256 cancelled per owner ruling); the group’s eight humanoids and lion encounter are 6.4/9.4.
- **Score + voice:** every story stage has a cue row in 13.1, the cue family is 13.2–13.4, and the voice cast is 13.5–13.6; the dinner cue comes from 13.2, not a second composition.
- **Conflicts:** the flip wall, MacBook errand, dinner building, B6 role and game name are resolved in the canon ruling; the old route-effects B6 corridor and the prologue-story errand line (which still walks to B6) are explicitly marked superseded.
- **Placeholders:** the only “owner-supplied” input is the cohort roster, which is a real decision gate with a failing check, not a TBD.
- **Type consistency:** the new names (`to_b4_office`, `b4-office`, `B4_flip_wall`, `B4_OFFICE`, `B4_SIDE_DOOR`, `B4_FLIP_ORIGIN`) are used consistently; the old IDs are kept in the migration table. The B4 side-door and flip-mount values are provisional and must be re-derived by Task 2.1.
