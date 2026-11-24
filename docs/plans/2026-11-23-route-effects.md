# Route + reveal effects — design delta (owner directions, 2026-11-23)

Owner, verbatim (mid-session):
> high table dinner 上面那个图标建模不太好。你干脆图片放上去算了
> 那个 cds1 的谜题位置也不太对。然后效果也和一开始设计的不一样
> 你看一下我们录的视频，以及我们一开始那个建模你的位置，你就知道了。那个解谜
> 效果也是对的，但我不知道为什么 integrate 上去之后就不对了。包括那个可以翻转
> 的墙，根本就不在 CDS 1里面。
> 正常来说，应该是我们解完一个谜题后，在这栋楼里有这栋楼的效果；然后我们走出
> 去，也可以看到这栋楼被点亮了，可能还有一个光柱连到其他楼，对吧？
> 然后我们再走到 6 号楼去解那个翻盖墙的谜题，而不是直接闪现过去。然后这个音乐
> 的变化，我觉得也不够好。
> 窗户和那些显示屏一排排亮起都是需要的，但是我们一开始建模做的那些场景呢？

## What the original prototype does (evidence)

`/Users/onezion12344/Projects/hku-shanghai-campus-wt/final` (served on
127.0.0.1:5233) is the reference model:

- `src/interiorsPreview.ts:1099-1104` — after the keyboard goes online the
  chapter runs `chapterFade(() => { select('flipWall'); ... })`: a fade-to-black
  **room switch** to the flip-wall corridor. That is the “直接闪现过去” the
  owner rejects.
- `revealWall()` (`:570-589`) — the flip-wall puzzle: turn every tile, the wall
  hinges open, power/work lights come up; then breaker → MacBook connect.
- The aux power closet, breaker and MacBook port are part of the same
  `flipWall` room builder (`buildObservedFeatureRoom('flipWall')`), not B4.
- `updatePuzzleCaps()` (`:351-386`) — the keyboard solve effect: per-key
  row/column flash, keyboard point light, then CPU 01 online.

## Current one-world integration (the defects)

- `src/opening/b4Layout.ts` + `src/campaign/b4Chapter.ts` put the whole power
  sequence (Keyboard Wall, aux closet, breaker, MacBook port, “service
  shutter”) inside B4. The flip step is an automatic shutter lift, not the
  flip-wall puzzle.
- The actual HKU flip wall is mounted as ambient scenery in the **B5** lobby
  (`src/opening/b5FlipWall.ts`), not B6, and has no puzzle.
- No exterior building lighting or beams exist. The B4 solve only notifies and
  opens the shutter.
- Music is a single stage-based cue; no per-solve layer or transition.

## Target experience (owner spec)

1. B4: solve the Keyboard Wall in the CDS-1 ground-floor lounge. In-building:
   key flash, row-by-row panel/window light, CPU 01 online.
2. Walk out: B04’s facade is visibly lit (window rows), with a light beam to
   the central core (B06).
3. Walk to B6 (no fade/teleport). Enter the flip-wall corridor.
4. B6: solve the flip-wall puzzle (turn the tiles, wall opens), then the
   breaker, then connect the MacBook. In-building: power lights, racks, screens
   row by row; outside: B06 lit, beams to the four PU towers.
5. Music: each PU/solve adds a layer; short transition stingers at solve,
   building power-on and beam strikes.

## Assumptions to confirm with the owner

- The breaker and MacBook connect move to B6 with the flip wall; B4 keeps only
  the Keyboard Wall. (Matches the original room builder.)
- The beam from a solved building points at the B06 core; the core then beams
  to the four towers at the endgame.
- B6’s flip-wall corridor is mounted inside the existing B6 ground-floor
  interior; the observed room is reused, not rebuilt.
- The crest image (both the dinner-wall arms and the invitation card) is a
  clean crop of `references/event-20260830/photos/dinner-crest-wall.jpg` (the
  central arms, people cropped out).

## Constraint found in the B6 layout

B6 is a single 9 × 9.4 m room (`src/opening/spatialLayout.ts:31`, floor at
y = 5.1) and its whole interior is the opening's presentation office
(`buildOffice`, `src/opening/world.ts:440`): credenza, two workstations, the
presentation desk with the MacBook. The opening uses that room before the
campaign. A flip-wall corridor therefore needs either (a) a new room zone
carved into the B6 footprint at the same level, or (b) the observed
`flipWall` room mounted as a B6 annex. Option (a) keeps the opening office
untouched; the wall + aux closet + breaker + port need roughly the footprint of
the observed room (its corridor is wider than the office). This is the first
thing the route plan must settle.

## Plan

### Task 1 — real crest images (independent, ships first)

Files: `assets/opening/dinner-crest.jpg` (already prepared: 738×792 crop of
`references/event-20260830/photos/dinner-crest-wall.jpg`, source in the crop),
new `src/opening/crestPhoto.ts`, `src/opening/world.ts`, `src/opening/ui.ts`,
`src/opening/opening.css`, `scripts/check-opening*.ts`.

- `crestPhoto.ts` exports the URL (`new URL('../../assets/opening/dinner-crest.jpg',
  import.meta.url)`) and a cached `crestPhotoTexture()` that loads once,
  `SRGBColorSpace`, anisotropy 4, and exposes a `ready` promise. On failure it
  resolves to `null`; the wall falls back to the existing `emblemMaterial`.
- `world.ts`: keep the mesh name/authorKey `opening-b5-reference-crest`; set the
  plane to the photo aspect (1.268 × 1.36 m) at the same position; use the photo
  on `MeshStandardMaterial` (roughness .9, metalness 0) until the texture is
  ready, then swap. Dispose the texture in `dispose`.
- `ui.ts`: replace the inline `HKU` SVG with an `<img class="opening-invite-crest-img">`
  pointing at the same URL, alt “HKU coat of arms from the High Table Dinner
  wall”; CSS frames it as a photo (96–120 px, 4:6-ish aspect, thin gold rule,
  rounded 4 px).
- Keep the lectern/banner `shieldMaterial` pixel art unchanged; the owner asked
  for the two crests only.
- `check-opening`: assert the invite contains the image URL and the wall mesh’s
  material map path; mutation: deleting the asset or the img fails.

Acceptance: wall and invitation show the photo; fallback path still renders;
`check:opening`, typecheck, build green; screenshots of both.

### Task 2 — B6 flip corridor

Files: `src/opening/spatialLayout.ts`, `src/model/observedFeatureRooms.ts`
(reuse only), new `src/opening/b6FlipRoom.ts`, `src/opening/experience.ts`.

- Add `B06_FLIP` bounds inside the B6 footprint (34 × 34 m at x 0, z −70):
  a 11.0 × 5.2 m corridor at the same floor as the office (y 5.1), west of it,
  with a 2.4 m door into the office and its own entrance from the campus loop.
  Exact coordinates are fixed at implementation after a massing check; the door
  must not overlap the office workstations or the MacBook desk.
- Build the observed room with `buildObservedFeatureRoom('flipWall')` (full:
  shell + wall + closet) inside the corridor; the wall faces the corridor
  entrance. Add collision walls, the doorway cut, and a walkable floor.
- Remove the ambient B5 mount: delete the `createB5FlipWall` call, update and
  dispose in `experience.ts`; the module can be deleted with the wall’s
  author keys re-homed to the B6 room (`B6_flip_wall`, `B6_flip_wall_mount`).
- Visual check from inside/outside; collision check along the corridor and the
  door; screenshots; `check:opening` gets a pin that B6 contains
  `HKU_flip_wall` and no scene object uses `B5_flip_wall`.

### Task 3 — campaign route and power sequence

Files: `src/campaign/state.ts`, `src/campaign/types.ts`,
`src/campaign/chapters.ts`, `src/campaign/host.ts` (order),
`src/campaign/b4Chapter.ts`, new `src/campaign/b6Chapter.ts`,
new `src/campaign/powerPuzzle.ts`, `scripts/check-campaign-*`.

- Stages: add `to_b6` after `b4_keyboard`; transitions
  `keyboard_solved: b4_keyboard→to_b6`, `enter_b6: to_b6→b4_flip`; keep
  `b4_flip→b4_breaker→b4_connect` (historical IDs, no save rename). Add
  `enter_b6` to `CampaignEvent`.
- `campaignChapterOf`: `b4_*` only for `b4_enter`/`b4_keyboard`; `b4_flip`/
  `b4_breaker`/`b4_connect` → `b6`; add `'b6'` to `ChapterId` and
  `CHAPTER_ORDER` between b4 and lawn.
- `b4Chapter`: keep the keyboard, racks and solve effect; remove the aux
  closet, service shutter, breaker, port and the automatic `b4_flip` beat.
  Its `interact` after the keyboard returns false; objective after the solve
  says the power sequence is in B6.
- `b6Chapter`: entry at the B6 door (`enter_b6`), approach route along the
  existing `routeB6`; builds the flip room collision/interactions. Step logic
  in `powerPuzzle.ts`: `flip` → interact at the wall runs the tile ripple
  (2.0 s), the wall hinges open, `flip_solved`; `breaker` → pull lever,
  `breaker_pulled`; `connect` → MacBook port, `macbook_connected`. Effects:
  room lights, racks, screens, wall power LED, `supercomputer_hum`.
- Save migration: existing saves at `b4_flip`/`b4_breaker`/`b4_connect` remain
  valid; on load, `b6` attaches and the objective points to B6. No stage
  removed, no storage key change. Record the mapping in the plan’s ledger.
- Update every gate that hardcodes the old room: `check-campaign-b4`,
  `check-campaign-playthrough.py` (walk B4→B6), `check-campaign-sports`,
  `check-opening-flow.mjs`, the campaign style check and any door/checkpoint
  coordinate assumptions.

### Task 4 — reveal effects

Files: new `src/opening/exteriorLighting.ts`, `src/campaign/b4Chapter.ts`
(interior rows), `src/campaign/b6Chapter.ts`, `src/main.ts` wiring.

- Exterior: one instanced emissive-quad layer per building (B04, B06) over the
  facade window grid derived from the building specs (bays × floors), one
  material per building, no shadows. `setRows(building, count)` lights rows
  bottom-up; `setAll`.
- B4 solve: keyboard flash → interior panel rows 01–02 → exterior B04 rows
  light over 1.8 s → a beam from B04 to the B06 core grows over 0.6 s.
- B6 flip: corridor power rows, wall LED, racks; breaker: racks/ceiling; connect:
  core beam from B06 to B01–B04 (four thin beams) and the exterior B06 lit.
- Beams: additive cylinders with a gradient alpha map, no depth write, fixed
  length/radius per pair; no runtime model edits. One material per beam colour.
- All effect state is derived from the campaign stage, so reloads restore lit
  buildings; no new save fields.
- Gate: `check:campaign-b4` asserts the stage→lighting mapping via the debug
  API; browser screenshots inside and outside after each solve.

### Task 5 — gates and evidence

- `check:campaign-b4`, `check-campaign-playthrough.py`, `check:opening`,
  `check:campaign` all green; browser walk with screenshots at: keyboard solve
  inside, outside with B04 lit + beam, B6 corridor, flip solved, breaker,
  connect; sidecars with commit sha.
- No new console errors; collision check for the new corridor; perf counters
  in the exterior and the corridor.

### Out of scope

Music layers/stingers are in `docs/plans/2026-11-23-music.md`; zone streaming is
in `docs/plans/2026-11-23-world-scope-perf.md`. This plan assumes the B6
corridor is built directly (not streamed); the zone manager can wrap it later.
