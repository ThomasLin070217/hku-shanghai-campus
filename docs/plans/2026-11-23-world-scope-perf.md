# World scope + performance — design delta (owner direction, 2026-11-23)

Owner, verbatim:
> 我希望建模的范围可以去到更多地方，但同时性能也要优化。

## Baseline (measured, `docs/PERFORMANCE.md`)

Full campus: 1 115 meshes / 200 042 triangles; GLB 19.1 MB (no-ground
14.7 MB; opening 22.2 MB). Headless-selected probe (SwiftShader, 1440×900):
1 947 calls, 374 513 triangles, 1 884 geometries, 87 textures, 16.1 MB
geometry bytes / 1.06 MB texture bytes. The adaptive resolution governor caps
pixel ratio at 1.5 and steps to 0.6 under load. These counter figures are
hardware-independent; SwiftShader frame times are not comparable.

Walkable today: the campus exterior (lawn, roads, plaza), B4 ground floor
(Keyboard Wall chapter), B5 ground floor (dinner hall + lobby), B6 office,
and the sports hall shell (floor/roof only). B5 4F lounge exists as an
inspection cutaway (`buildLounge`, hidden, not traversable). B01–B03, B07
are exterior massing only; the link corridor/skybridge is exterior.

## The problem with “just model more”

The campus is already one merged static scene plus chapter-built interiors.
Adding three more fitted interiors naively multiplies draw calls, shadow
casters and geometry bytes in the same resident set, and the opening builds
B4/B5/B6 together whether or not the player is near them. More places must be
paid for by **zoning**, not by a bigger always-on scene.

## Proposed scope (priority order)

1. **Sports hall interior fit-out** (highest value; the rescue level is
   literally empty today): court markings, two hoops with backboards, bleacher
   rows, scorer's table, equipment cart, banners; the 100-student crowd stays
   instanced. This turns the rescue into a place, not a floor plane.
2. **B5 4F stepped lounge as a traversable room**: the Atlas-observed geometry
   already exists (`buildLounge`); add a shell (front wall/ceiling), stairs
   from the B5 lobby, collision for tiers/rails, and an unload-safe group.
3. **B01–B03 ground-floor lobbies + link corridor/skybridge**: simple
   reception desks, lift cores, signage, instanced seating; a walkable route
   connecting towers (the existing skybridge becomes accessible).
4. **Tennis courts** (sports strip near B5): flat, cheap, walkable, with
   fencing and net geometry — a good “more places” win for very little cost.
5. **Optional: B6 auditorium** (resolves the office-vs-auditorium design
   conflict) only if the story needs it; the office stays.

Each place ships with: a source note (observed vs inferred), author keys,
collision, a walk-in path, and a screenshot from inside.

## Performance architecture

### Zone registry and streaming

New `src/world/zones.ts`: a zone is `{id, bounds, entry, build(), collide(),
unloadRadius, budget}`. One manager loads a zone when the player is within
`loadRadius` (hysteresis: load 25 m, unload 45 m), keeps at most the exterior
+ one interior zone resident, and disposes geometry/materials on unload
(reusing the existing owned-material discipline). The chapter builders become
zone builders; the sports hall and lounge are the first two.

### Budgets (per resident set, fixed camera path)

| Metric | Ceiling |
| --- | ---: |
| Draw calls | 1 200 |
| Triangles | 300 000 |
| Geometry bytes | 14 MB |
| Texture bytes | 4 MB |
| Shadow casters | 350 |
| Frame time (M4, 1280×800) | ≤ 16.6 ms in the exterior zone, ≤ 20 ms inside |

The current exterior baseline (1 947 calls in the headless probe) exceeds the
call ceiling, so the first performance task is to **reduce the exterior**
(merge/instance the glass panes and repeated street furniture, cut casters)
before adding interiors. Targets are per-zone measurements, not totals across
all zones.

### Techniques (in order of payoff)

1. Instancing the repetition inside new interiors: bleachers, chairs, hoops,
   bollards, court lights; one material per family.
2. Merged static geometry per material inside each zone (`compact()` already
   does this); no per-object materials.
3. Zone visibility: an unloaded zone has no objects in the render list and no
   shadow casters; loaded-but-distant interiors are `visible=false`.
4. Interior shadows off except the active zone's key lights; cap shadow map
   at 2048 and one directional light.
5. Textures: one shared atlas per zone, 512 px for props, 1 024 for signage;
   the sign photo stays the only large photographic texture.
6. Glass: keep the 414 pane transforms (sort order/IDs), but do not cast
   shadows; distant glazing can be a single merged transparent plane behind
   the near panes.
7. Distance LOD for the exterior only if the call ceiling still fails: a
   low-poly impostor beyond 80 m. Do not LOD interiors the player can enter.

### Gate

`npm run check:perf`: builds the review bundle, runs a fixed camera path in
the exterior and each new zone, reads `__CAMPUS.perf()/resources()`, asserts
the ceilings above, and writes a JSON + screenshot sidecar per zone. The gate
fails on a regression; the numbers are committed as evidence.

## Plan

### Task 1 — zone registry and streaming

Files: new `src/world/zones.ts`, `src/world/zoneManager.ts`,
`src/opening/experience.ts`, `src/main.ts`, `src/campaign/host.ts` (chapter
builders registered as zones).

- `Zone` = `{id, bounds: Box3, floor, build(ctx): ZoneRoot, collide?: ..., budget,
  loadRadius: 25, unloadRadius: 45}`. `ZoneRoot` owns its group, materials and
  geometries and returns `dispose()`.
- Manager: load when the player enters `loadRadius`, unload at `unloadRadius`
  with hysteresis; at most the exterior + one interior zone resident; a zone
  already attached by a campaign chapter is never double-built (the chapter
  registers its group with the manager).
- Migrate the sports hall (crowd + door + fit-out) and the B5 4F lounge first;
  keep the existing debug hooks and names.
- Tests: load/unload by moving the player across the thresholds; assert memory
  counters return to baseline after unload; no duplicate IDs; no disposed
  material reused.

### Task 2 — exterior performance pass

Files: `src/model/buildCampus.ts`, `src/model/buildSite.ts`,
`src/model/glazing.ts`, `src/viewer/*`, `scripts/check-perf.ts` (new).

- Measure first: fixed camera path in the exterior, record `perf()` and
  `resources()`; commit the baseline JSON.
- Cut draw calls: merge repeated street furniture and planters per material,
  instance the repeated bollards/trees if any, stop glass panes casting
  shadows, and merge distant glass behind the near panes (visual check at the
  same camera).
- Shadow budget: only the near building set casts; verify the rendered image
  against before/after screenshots.
- Target the budget table above. If the call ceiling still fails, add a
  distance impostor for the far towers (≥80 m) only.

### Task 3 — sports hall fit-out

Files: new `src/model/sportsInterior.ts`, `src/model/sportsDoor.ts` (bounds),
`src/gameplay/studentCrowd.ts` (avoid props), `src/gameplay/sportsDoor.ts`
(collision), `src/world/zones.ts` registration.

- Court, markings, two hoops/backboards, bleacher rows (instanced), scorer’s
  table, equipment cart, banners, court lights; collision for bleachers/walls
  but not the students; door-zone clearance stays 2.8 m.
- All props merged per material; target ≤120 extra calls and ≤25k triangles
  for the zone.
- Walk-through check from the east door to the far court; screenshots.

### Task 4 — B5 4F lounge

Files: `src/model/buildLounge.ts`, new `src/world/loungeZone.ts`,
`src/opening/spatialLayout.ts`, collision, `src/opening/experience.ts`.

- Convert the cutaway into a room: front wall, ceiling, a stair from the B5
  lobby, rail collision, tier collision, exit; keep the observed furniture
  layout and author keys.
- Budget: ≤80 calls, ≤20k triangles; verified from inside.

### Task 5 — B01–B03 lobbies and link corridor; tennis courts

Files: new `src/model/towerLobbies.ts`, `src/model/tennisCourts.ts`,
`src/opening/spatialLayout.ts`, collision/nav, zone registration.

- Lobbies: reception desk, lift core, signage, instanced seating; a single
  material set per lobby.
- Link corridor/skybridge: walkable floor and rails on the existing massing;
  collision aligned with the exterior.
- Tennis courts: flat court, net, fence, lines; visual + walkable.
- Each is its own zone; no interior is resident with another.

### Task 6 — check:perf and evidence

- `scripts/check-perf.ts`: review build + fixed camera path in the exterior and
  each zone; assert the ceilings; write `evidence/perf-<sha>/<zone>.json` +
  screenshot; fail on regression.
- Wire into `check:all`/CI after the visual checks; document the numbers in
  `docs/PERFORMANCE.md`.
- Manual walk-through of every new place; collision and visual sidecars.

## Constraints

- Geometry changes go through source parameters → regenerate → visual/collision
  check; no runtime JS edits of the model.
- Preserve `authorParts` / `sceneId` / existing `authorKey`; any changed ID
  keeps an old → new migration table.
- New places are labelled observed / inferred / fictional in their source
  notes; no invented measurements presented as surveyed.
- One implementer at a time; each task has its own review.
