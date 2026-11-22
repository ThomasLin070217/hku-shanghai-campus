# Fidelity round · students, Unitree robots, real locations

Date 2026-11-22. Branch `feat/one-world`. Owner request, verbatim:

> 1 the rescue chapter, students are not inside, and they didnt run out after
> 2 the robots are dumb, and they are not unitree bots
> 3 the keyboard and the flip wall is actually in the wrong location, refer to our docs and photos and you will know

Spec = the owner's three sentences plus the evidence below. No merge, no push.

## Evidence used

- `doc/11-barrier-2030-design.md` ch.04: `键盘墙解密 → 柜开 → 备用电源 + 超算 → 合闸 → 连 MacBook`; §5 `B4 大堂 | 4×12 键盘墙、凳子、柜体`. No flip wall in the B4 chain.
- `doc/12-design-state-2026-11-21.md`: keys assemble `I LOVE JCDS`; Enter → **cabinet opens** → backup power + supercomputer.
- `doc/team/2026-11-16-photo-assignment.webp`: Building 4/CDS-1 `一楼入口及进入后的实际空间`, `右手边键盘座椅的整体结构与细节`.
- `research/photos-2026-11-10/05-cds-zj-atrium.webp`: official CDS-1 ground-floor atrium — keyboard wall above three timber amphitheatre tiers, circular rug, curved white sofa, armchairs, pale floor, white ceiling.
- `materials/_inbox/20261121__wechat-vibe-group.yaml:1806`: `1. HKU 可以翻的那个东西，在网球场前面的那个楼的1楼 2. cds1 的键盘。` → the flip wall is **not** in CDS-1. Inference: Building 5 (student activities, x 54–82, z −80…−54.7) is the low-rise standing between the campus core and the sports strip where the tennis courts are (`SPORTS_APPROACH` passes north of the tennis nets at z −106), so its 1F lobby is where the flip wall goes. Marked as an inference in code.
- `handoff/tasks/2026-11-21/04-unitree-g1/BRIEF.md` §3: Unitree proportions and the rule that the model is rebuilt low-poly, never imported.

## Global constraints

- Work only on `feat/one-world`. Do not merge, push, or touch `main`.
- Subagents run as DeepSeek Flash (`flash-worker`) or Opus 5.5 (`model: "opus"`) only.
- No WebSearch/WebFetch. AnySearch via mcporter if research is needed.
- Scene geometry changes go through source parameters → rebuild → visual/collision check. No runtime JS edits to the model.
- Keep every existing `authorParts` / `sceneId` / `authorKey`; new parts get stable author keys and `sourceFile`.
- UI copy stays English. Evidence comments cite the file they came from.
- Checks passing is not human acceptance; the milestone is opened to the owner at the end.
- Ports 5233/5260 belong to the owner; agents use 5251–5259.

---

## Task 1 — Put the keyboard wall and the flip wall where they belong

**Model: Opus 5.5.**

### 1A. B4 lobby layout (east wall keyboard, north service wall)

Entering B04 at x 58 from the south, facing north, the right hand is **east**. The Keyboard Wall moves to the east wall, facing west (−x), with the timber tiers in front of it; the aux closet, breaker, MacBook port and supercomputer racks move to the north (back) wall. The HKU flip wall leaves B4 entirely.

`src/opening/b4Layout.ts`:

- `keyboardOrigin = [65.94, F, 13.12]` (`F = 0.02`), new `keyboardYaw = -Math.PI/2`. The observed builder faces local +z; at this yaw its front face (local z −3.66) lands at world x = 69.60 and its width (local x −3.87…4.83) spans world z 9.25…17.95.
- Keep `B4_BUILDER.keyboard` extents. The keyboard's world panel box is x 69.60…69.87 (clipped by the east wall), y 1.58…3.74, z 9.70…17.50. No separate obstacle: the east wall plus the tiers are solid.
- Tiers (three solid steps, same z span 9.70…17.50, bottoms at F): `x 68.05…68.57 top 0.32`, `x 68.57…69.09 top 0.62`, `x 69.09…69.60 top 0.92`. Add them to `B4_OBSTACLES` as `opening-b4-tier-1..3` with a new `render:'tier'` so the shell draws them.
- `B4_STATIONS.keyboard`: `point [69.60, 2.10, 13.60]` (lower third of the panel, so the eye→point ray is 2.11 m and passes the check's 3D reach test), stand `[67.55, F, 13.60]`, box = the panel box (x0 69.60, x1 70.00, y 1.58…3.74, z 9.70…17.50). `stationDistance` from the stand = 2.05 m ≤ `B4_REACH` 2.2.
- `closetOrigin = [59.70, F, 10.11]`, yaw 0 on the north wall. Closet world box x 56.28…63.72, y 0.05…3.97, z 7.13…8.20. The `Aux_power_closet` part is built, the `HKU_flip_wall` part is **not** built in B4.
- The service shutter is our own slab covering the closet mouth: x 56.30…63.70, z 8.14…8.30, y 0…3.97. `B4_LAYOUT.flipPanel` becomes `shutter` (same shape/name plumbing; `setB4FlipPanel` keeps its exported name and signature so every caller and check keeps working, with a doc comment saying it is now the service shutter).
- Breaker lever world `[60.00, 1.88, 7.85]`; breaker box x 59.15…60.85, y 1.38…2.38, z 7.72…7.85. Stand `[59.20, F, 9.50]`.
- Port rail world x 57.05…62.95, y 1.2425…1.2575, z 7.83…7.85. `B4_STATIONS.port.point = [60.00, 1.25, 7.85]`, stand `[60.80, F, 9.50]`.
- Racks: `rackZ = [7.13, 8.33]`, x spans `[[47.40,48.70],[48.90,50.20],[50.40,51.70],[51.90,53.20]]`, top 2.3. Update `B4_OBSTACLES` rack rects and `b4Shell` accordingly.
- Lights: emergency `[51.5,3.6,10.5] d9`, `[63.5,3.6,10.8] d9`, `[58,3.6,13.5] d6.5`; work `[58,3.9,12] d8`; rack `[50.3,2.4,8.9] d5`; powered `[58,3.9,13.75] d6.5` and `[66.4,2.4,13.25] d3.4`. Every range stays inside x 46…70, z 7…20.5.
- `focusPose` gains a facing argument (default `+z`): `focusPose(frame, fovDeg, aspect, margin=.25, facing:[number,number]=[0,1])`; the eye is `centre + facing · d`, and the max distance is the distance from the panel to the opposite wall along `facing`. `B4_FOCUS_FRAME` gets `keyboard:{box, facing:[−1,0]}` and `flip` is removed. `b4Chapter` passes `kbRoot.rotation.y = B4_LAYOUT.keyboardYaw` and calls `focusPose` with the facing.

`src/opening/b4Shell.ts`:

- Lobby palette closer to the official photo while keeping the blackout story: floor `0xcfc9bd`, ceiling `0xe6e2d8`, walls `0xded8c9`; racks stay dark metal (`0x161b1f`) with the existing LED strip; plinth under the racks.
- Build the three timber tiers (`0x9a6f45` top, `0x7c5735` riser) from the layout rects, and the lobby furniture: circular rug (r 2.4, centre 65.0, 14.2, `0x2f5d52` with a cream ring), curved sofa (approx. centre 66.6, 17.2, opening north-west, `0xe8e4da`), two armchairs (61.8, 15.6) and (64.4, 9.9), one stool (66.0, 11.4), one low table (63.8, 14.6). Decor is non-collidable except the sofa/armchairs/table (add them to `B4_OBSTACLES`). Keep clear the two straight aisles the walk check uses: door (58,20.5)→keyboard stand (67.55,13.6) and keyboard stand→breaker stand (59.2,9.5).
- Keep `buildB4Shell()` light-free (checked in Chapter 1).

### 1B. The B4 flip puzzle becomes the cabinet beat

- `src/campaign/b4Chapter.ts`: stop building the flip wall/tiles/pick plane; build `Aux_power_closet` only. After `keyboard_solved`, the chapter notifies `CPU 01 online. The service wall unlocks.`, lifts the shutter over ~1.2 s and emits `flip_solved` on a timer (guarded so a restored run at `b4_breaker` does not double-emit). `b4_flip` stays in the stage machine as this short automatic beat so existing saves keep working; `flipAll()` in `debug` simply forces the same emit, and `flipAllBut`/`sweepNdc`/`focus('flip')` are removed.
- `b4StepOf('b4_flip')` still returns `'flip'`. While the stage is `b4_flip`: no station is in reach, `interact()` only shows `The service wall is lifting.`, and the objective reads `Wait for the service wall to open`.
- `src/campaign/b4Puzzle.ts`: `pullBreaker('flip')` reason becomes `The service wall is still closed.`. All flip-state unit tests stay (the B5 wall reuses `flipTiles`/`sweepTiles` semantics for its ripple).
- `FOCUS_HINT` keeps only the keyboard entry.

### 1C. The HKU flip wall goes to Building 5, 1F

New `src/opening/b5FlipWall.ts`:

- `createB5FlipWall()` → `{root, update(dt, player), dispose()}`.
- Place `HKU_flip_wall` from `buildObservedFeatureRoom('flipWall')` at origin `[56.36, 0.02, -60.70]`, `rotation.y = +Math.PI/2`, so louvred face looks east into the B5 lobby at x 54.60 and spans z −64.69…−57.31, y 0.08…3.94 (fits the 4.45 m lobby).
- Add a small warm wash (one `PointLight`, intensity 3, distance 4, inside the lobby) and a plaque mesh named `B5_flip_wall_plaque`.
- Ambient only: when the player first comes within 6 m, tiles flip over in a diagonal ripple (0.9 s, sorted by row+column), then settle back after 6 s; repeat at most once every 25 s. No key, no puzzle state, no campaign save. `userData.source` cites the WeChat line and marks the building choice as an inference.
- Mount in `src/opening/experience.ts`: `const flipWall=createB5FlipWall();scene.add(flipWall.root);` and `flipWall.update(dt,g.body.position)` in `update()` (skip when `g.paused`). Dispose on experience dispose if such a hook exists; otherwise remove from the scene there.

### 1D. Checks and scripts

- `scripts/check-campaign-b4.ts`: nav boxes still equal layout rects; walk order becomes `keyboard → breaker → port`; assert the player ends on the floor at the keyboard stand; closed shutter blocks, open shutter leaves no obstacle; sightlines for the three stations; the Chapter-1 dark-room assertions stay.
- `scripts/check-campaign-walk.ts`: after the keyboard, do not walk to a flip station — wait for the automatic `b4_breaker` stage (bounded wait), then walk to the breaker and port.
- `scripts/check-campaign-playthrough.py`: replace `B4.flipAll()` with a bounded wait for stage `b4_breaker`.
- `scripts/check-campaign-style.py`: drop any `focus('flip')` usage; `focus('keyboard')` must still frame the east wall.
- `npm run check:campaign`, `tsc --noEmit`, `check:campaign-style`, `check:campaign-playthrough`.

Acceptance for Task 1: all of the above green, plus a screenshot of the B4 lobby showing the keyboard wall on the right of the entrance with tiers/rug/sofa, and one of the B5 flip wall in its lobby.

---

## Task 2 — The students are inside, then they run out

**Model: DeepSeek Flash.**

### 2A. Crowd in campaign mode

`src/gameplay/studentCrowd.ts`:

- Return two more fields: `placements` (the exact seat array) and, per `InstancedMesh`, `userData.studentIndices` — the placement indices in instance order (the same order used when writing `setMatrixAt`). No change to appearance, counts, atlas or seat assignment.
- Keep `createStudentCrowd()` valid in survey mode (existing calls unchanged).

`src/campaign/sportsChapter.ts`:

- On `attach` in the browser path (and in the headless path with no DOM), create the crowd and add it to `ctx.root()`; store `crowd` and a `runout` handle. `detach()` disposes both.
- Create the run-out helper from `src/campaign/studentRunout.ts` and call `update(dt)` from the chapter's `update(dt)`.

### 2B. Run-out

New `src/campaign/studentRunout.ts`:

- `createStudentRunout(crowd, world)` where `world` exposes `support(x,z,maxStep)` from `explorer.world`.
- State per student: released flag, release time, speed, phase, gate/outside/stop points. Deterministic.
- On `release()`: students nearest the door leave first (0.14 s apart for the first 12, 0.05 s for the rest), each walks to the gate (−49.6, z within ±1.0 of −117), through the door (x −48.5), to an outside point (x −44…−36) and then to a stop point fanned across z −124…−110. Speed 2.4 inside, 3.4 through the door, decelerate to 0 at the stop.
- Per frame: write `matrix` (position, yaw from velocity, bob 0.04·|sin(phase)| while moving) into each `InstancedMesh` at `userData.studentIndices[i]`, set `instanceMatrix.needsUpdate`.
- `release()` is idempotent. `counts()` returns `{inside, outside, moving}` for checks and the ending.
- Call `release()` once when the chapter sees `door_opened` (the existing latch); play `sfx_crowd_cheer` once (guarded `HTMLAudioElement`, failure ignored).

### 2C. Check

- New `scripts/check-sports-students.ts` + `npm run check:sports-students`, added to the `check:campaign` aggregate (follow how the other campaign checks are wired in `package.json`).
- Assert: at attach the crowd exists with 100 instances and every placement is inside the hall bounds; opening the door through `debug.open()` emits `door_opened` and `release()`; after ≤20 s of 1/60 steps all 100 are outside (x > −47) and within the dispersal box; never inside a wall at any sampled fifth frame (use `world.blocked`); `counts().moving` reaches 0; calling `release()` twice is harmless.

Acceptance: new check green, `check:campaign` green, and a screenshot taken after opening the door showing students outside the east door.

---

## Task 3 — Unitree quadrupeds that move like animals

**Model: Opus 5.5.**

Replace the boxy tracked shell of the security fleet with a low-poly Unitree Go2/B2-style quadruped. Same FSM, same navigation, same blackboard, same capture rules. No imported STL/logo (project rule + handoff brief).

### 3A. Model

`src/opening/robot.ts` — `createOpeningRobotAssets()`:

- Keep the pooled-merge approach and the exported shape; add `legUpperGeometry`, `legLowerGeometry`, `footGeometry`, `legMaterial` (dark graphite). All legs share them.
- Body: white/graphite two-tone rounded silhouette built from boxes — chassis 0.72 × 0.30 × 0.46 at y 0.62, shoulder plates, dark front sensor face, top LiDAR puck (cylinder, 0.12 r), rear status bar.
- Head mesh keeps the name `robot-head` and sits at the front (−z), carrying the red eye bar (`opening-robot-eye`), beacon (`robot-beacon`) and the turret group.
- Four legs named `robot-leg-fl|fr|rl|rr` (groups) at x ±0.26, z ±0.26; each group holds `robot-leg-upper` (0.26), a knee pivot group, `robot-leg-lower` (0.26) and `robot-foot` (0.07). Total standing height ≈ 0.78 m; footprint ≈ 0.72 × 0.62 m. Rig origin stays at the ground (feet at y 0).
- Keep the scan-sector mesh, name and behaviour untouched.

### 3B. Gait and expressiveness (visual only; no timing changes)

- Accumulate `stride` from real displacement plus `|Δyaw|·0.32`; trot pairs FL+RR / FR+RL in antiphase; thigh pitch ±0.42 rad, knee lift 0…0.55, hip roll ±0.07; idle settles to a standing pose; turning in place steps.
- Body bob 0.02·sin(2·phase) on the `rig` only (never on the sector), slight pitch into acceleration.
- Turret pitch: −0.12 rad while searching near the last-seen point, 0 otherwise; beacon solid on chase, double-pulse on the first 0.5 s of a chase (a "notice" brace that does not pause movement).
- No changes to `ROBOT` tuning constants that the check asserts.

### 3C. Fleet

`src/opening/robots.ts`: pass the other units' positions as an optional sixth argument; `robot.ts` adds a gentle lateral bias when a neighbour is within 1.2 m ahead (no new physics, no teleport). Guarded so the single-robot API and check stay unchanged apart from the optional parameter.

### 3D. Checks

- `scripts/check-opening-robot.ts`: update the model assertions to the new silhouette — height range 0.6…2.2 m, footprint ≤ 1.6 m each axis, `robot-body`/`robot-head` still exactly one mesh each, four `robot-leg-*` groups with upper/lower/foot meshes, eye red, wedge behaviour unchanged, dispose unchanged. Comments that say "blocky" are updated to "quadruped".
- Add one gait assertion: drive the unit 3 s straight, assert every leg group's rotation.x changed by more than 0.05 rad and the four phases are not equal; when stationary for 2 s, assert the legs settle (max |Δrotation| < 0.02 rad over the last second).
- `npm run check:opening`, `npm run check:all`.

Acceptance: checks green, plus a screenshot of a robot in the B5 forecourt showing four articulated legs and the sensor head.

---

## Out of scope

- No merge or push.
- No change to the campaign stage machine, save keys, or chapter order.
- No G1 humanoid display team (separate handoff pack; owner has not asked for it here).
- No change to the rescue puzzle, the robots' patrol routes, or the ending beats.
