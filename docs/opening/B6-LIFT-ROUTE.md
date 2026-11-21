# Building 6 side-door lift route

**Snapshot:** 2026-11-21 · branch `opt/b6-route`

All values are technical estimates for provisional 2030 gameplay scenery, not survey
measurements. No browser screenshot was produced in this worktree; see the manual
checklist at the end.

## Route

Building 5 dinner hall → forecourt → **Building 6 east side door** (ground) → ground
lift lobby → call button → car to **5F** → step west into the principal's office →
MacBook on the desk → in-car button → ground lobby → east side door → Building 5.

The grand stair no longer reaches the office. Its top landing is a sealed **4F
terrace** behind a glass balustrade, and the office south wall is solid. This is the
correction requested after the first playthrough: the office is on 5F, while the
stair only reaches 4F.

## Shared layout (`src/opening/spatialLayout.ts`)

- `b6`: x 1..10.8, z −62..−57.6, floor 5.1 m, `doorSealed`. `cuts` replaces the
  generic cavity cutter with three opening-only apertures: the office cavity, the
  ground lobby and the east side-door aperture.
- `b6SideDoor`: x 14.17, z −56.1, 1.8 × 2.62 m, set in the base glazing.
- `b6Lobby`: x 10.8..14.17, z −61.1..−54.97, floor 0.02 m, clear height 3.0 m.
- `b6Lift`: x 8.6..10.8, z −61.1..−58.9, through-car. East doors open to the lobby at
  0.02 m; west doors open to the office at 5.1 m. Door span z −60.6..−59.4.
- `liftPanelGround` [11.30, 1.25, −59.15], `liftPanelUpper` [8.20, 6.35, −59.15],
  on the wall beside each landing door so the doorway stays clear.
- `routeB6` ends at the ground call button; `routeB6Office` is the 5F leg from the car
  to the desk stand spot.
- `checkpoints` are unchanged. `checkpoints.b6` is still the office spawn used by
  `return_b5`; `safePose` therefore stays valid on both sides of the lift.
- `OPENING_WORLD_REVISION` is now `opening-2030-v6-b6-lift-route`. Older saves keep
  their story and items and restore at a legal checkpoint, as before.

## Collision and interaction

- `src/opening/navigation.ts` owns the shared lift state: `carY`, `doorGround`,
  `doorUpper`. `openingSupport` returns the car floor inside the shaft, 0.02 in the
  lobby and 5.1 in the office (outside the shaft). `setOpeningLift` adds/removes the
  closed landing-door obstacles and moves the car support.
- `src/opening/experience.ts` runs the deterministic cycle `closing → moving →
  opening → open` in the fixed 120 Hz tick, with the car easing between floors. The
  doors close before travel and open only at the car's floor, so the shaft is never
  an open hole. Call targets exist only when the car is elsewhere or shut; the in-car
  button exists only while the player stands on the car floor with the doors open.
- The `return_b5` incident now triggers when the player reaches ground level and
  steps out east of the side door (or after a 60 s fallback). The lift ride itself
  does not trigger the seal.

## Shell and geometry fixes

- **Stair / terrace:** the stair's top landing gains a glass guard, handrail, posts,
  planters and a `4F · TERRACE` sign. The former office doorway is gone.
- **Hollow pipe:** the 30 m underpass keeps its observed topology and gains
  structural ribs, ceiling light strips, skirting, two service doors, portal frames
  and directional signage. The centred walk and the reference sightline stay clear.
- **B06 shell:** the old full-footprint collision slab is replaced by the actual room
  walls, ground base glazing with the side-door gap, lobby walls, shaft walls and a
  floor mass split around the shaft. The office is lined with four walls, a ceiling,
  skirting, a rug, a picture and a ceiling light; the desk and credenza are solid.
- **Lift visuals:** ground lobby, side-door frame/leaves/canopy/signage, shaft,
  through-car with light and handrails, two landing-door pairs, call posts and floor
  indicators. `world.update` reads the shared lift state, so the car and leaves match
  the collision.
- **High Table:** only the clear structural gap was addressed. Ribs were added at the
  existing 4 m pier stations so the arcade reads as a repeated bay rather than two
  distant end arches. The hall, tables, dais and end wall were not rebuilt.

## Verification

Run from `/Users/onezion12344/Projects/hku-shanghai-campus-wt/b6-route`:

- `npm run typecheck` — pass.
- `npm run check:opening` — pass: 20 state/persistence groups, 13 robot checks, fleet,
  runtime, atmosphere, 8 world geometry groups, 14 integration routes/anchors,
  reference hall/underpass and 12 NPC checks.
- `npm run check:all` — every script before `check:agent-tools` passes.
  `check:agent-tools` cannot start its test server because `127.0.0.1:18789` is held
  by the machine's OpenClaw gateway; this is environmental, not a code failure. The
  remaining scripts (`check:ai-runtime`, `check:llm`, `check:video-followup`,
  `check:door`, `check:voice`) pass when run individually, and `npm run build` passes.
- `npm run scene:catalog` — survey catalog unchanged (18,539 entities).
- `npm run scene:opening` — opening catalog regenerated: 18,527 entities,
  revision `25b17b97136b`.
- `npm run build` — pass.

The integration check physically walks B5 → side door → lobby → car, moves the car in
40 mm steps while the character controller carries the player, walks the 5F office
leg, rides down and walks back to B5. It also asserts the closed landing doors,
the sealed office south wall, the side-door aperture, both call-button supports and
the 5F car support.

## Manual browser checklist

1. `npm run dev`, open `http://127.0.0.1:5173/` (the opening is the default
   experience), click **Start opening**.
2. Read the invitation, leave the shuttle, meet the coordinator and accept the
   MacBook errand (or use the dev-only `__CAMPUS.openingDebug` hooks:
   `readInvitation()`, `exitBus()`).
3. Walk east past Building 5 and around the south-east corner of Building 6. The
   side door has a lit canopy and a `B6 · EAST LOBBY` sign.
4. Enter, face the lift door, and press **F** at the call post. The car should
   arrive, the doors slide, and the landing door collision should clear.
5. Step in, press **F** at the in-car button. The doors close, the car rises to 5F,
   and the west doors open into the office.
6. Take the MacBook with **F** (C opens it). Press **F** at the in-car button again,
   ride down, and leave through the side door. The campus seal should trigger as you
   step outside.
7. `__CAMPUS.openingDebug.liftTo('upper')` / `liftState()` can bypass the ride for a
   quick visual inspection; they do not replace the physical integration check.

If a visual is needed for review, capture it at step 3 and step 5; this worktree did
not run a browser, so no screenshot is claimed.
