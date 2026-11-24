# Ruling G1 — B04 side entrance and flip-wall mounting (2026-11-24)

Owner route (binding): *exterior B4 lit + mesh beam → B4 side entrance, turn right →
flip wall → breaker → MacBook → lawn.* The route is fixed; this document fixes only
the geometry that makes it buildable. Numbers are world metres, `OPENING.b4` frame.

## The fact that decides it

`src/opening/navigation.ts:15` — **"B04 is a band tower: its rooms open the +z wing box
instead of a closed exterior."**

The playable lobby is a cavity *inside* the tower mass
(`campusParameters.ts:10`: B04 centre `x=COLUMN_X, z=-2`, 59.7 × 45 → `z -24.5…20.5`).
The lobby (`spatialLayout.ts:27`: `x 46…70, z 7…20.5`) shares its south plane with the
building façade. Its west, east and north walls are **interior partitions of the carve-out**,
not exterior walls.

So there is no "west side entrance". The only surface a new door can breach is the
**façade, `z = 20.5`**, and it must sit clear of the main door at `x 56.70…59.30`.

Consequence: the earlier pre-flight framing ("flip room inside the shell at the west
strip, 11.4 × 5.2, overflowing x=46 / z=7 and swallowing racks 1–3") describes a room
that cannot exist. The 11.4 × 5.2 shell is the *preview* corridor. B4 needs **only the
wall part** (`parts: ['wall']`) — no shell, no room fit, no rack displacement.

## Decision

| Element | Value |
|---|---|
| Side entrance plane | façade `z = 20.5` (interior face `z = 20.37`) |
| Side entrance interval | `x 46.45 … 49.05` (2.60 m wide, centre `47.75`), clear height 2.60 m |
| Flip wall | mounted on the **south wall interior face**, `x 60.00 … 67.37` (7.37 m, the builder's full width), facing north (`+z → -z`) |
| Wall depth | 0.11 m proud of the wall plane → occupies `z 20.26 … 20.37` |
| Retired | the B5 flip-wall mount (`b5FlipWall.ts`); the 11.4 × 5.2 corridor shell in B4 |

## Clearances (all measured against the real obstacles)

Side door:

| Against | Distance |
|---|---|
| west interior face `x 46.13` | **0.32 m** |
| main door west edge `x 56.70` | 7.65 m |
| nearest rack `x 47.40, z 7.13–8.33` | 11.9 m north — the doorway never meets the racks |
| wall segment it splits (`x 46…56.70`) | becomes `46…46.45` + `49.05…56.70`, both ≥ 0.32 m |

Flip wall:

| Against | Distance |
|---|---|
| main door east edge `x 59.30` | **0.70 m** |
| east interior face `x 69.87` | 2.50 m |
| lobby sofa outer edge (`z ≈ 18.99`, `x 65.0–68.2`) | **1.26 m** |
| keyboard tiers `x 68.05–69.60` | 0.68 m east of the wall's end, and they stop at `z 17.50` — 2.76 m away |
| armchairs / table (`z ≤ 16.0`) | ≥ 4.2 m |

## Why "turn right" now works

Entering the side door facing north, **right is east**. Walking east along the south part
of the lobby, the flip wall is on the player's **right-hand wall** for 7.37 m — it is
literally what you turn right into. It cannot be on the west wall (that faces you from
behind after the turn) and cannot be on the north wall without landing on racks 1–3.

After the wall: the breaker stand `(59.20, 9.50)` and the MacBook port stand
`(60.80, 9.50)` are across the room on the north wall — a diagonal crossing, no backtracking.

## What changes in the flip wall's fiction

The HKU flip wall normally covers a **service cavity**. In B4 it is mounted on the façade
wall, so there is no cavity behind it. The wall is therefore a **puzzle face only**: solving
it energises the breaker (puzzle state), and the breaker still lives in the aux closet mouth.
Do not promise a secret room behind it in any copy, subtitle or slide.

## What the gate must assert (replaces the withdrawn-origin gate)

`scripts/check-b4-flip-room.ts` should be rewritten to assert, from source constants:

1. side door inside `x 46.13…56.70`, at least 0.20 m from each end, and not overlapping any
   `B4_OBSTACLES` rect at `z 19.9…20.5`;
2. flip wall interval fully inside `x 59.30…69.87`, at least 0.20 m from the main door edge;
3. flip wall box `x 60.00–67.37, z 20.26–20.37, y 0.13–3.90` intersects no rect in
   `B4_OBSTACLES` (racks, closet, tiers, furniture) and no `B4_SOFA_RECTS` entry;
4. an unobstructed 0.60 m-wide corridor from `(44.00, 18.60)` (outside, on the plaza)
   through the side door to the flip wall's centre `(63.69, 19.50)`, checking every
   `B4_OBSTACLES` rect with `bottom < 1.8`;
5. the old withdrawn-origin numbers are gone from the gate — they described a room that
   is not being built.

Gate name stays `check:b4-flip-room`; the file name can stay too (renaming costs more than it buys).

## Cost if wrong

If the owner meant a side door actually on the building's **west flank**, that requires
cutting a 17.85 m corridor through the tower mass west of `x=46` — a new interior, a new
exterior door at `x≈28.15`, and new collision/navigation. That is a multi-day change, not a
task, and it contradicts `navigation.ts:15`. This ruling costs one door cut + one wall mount;
the alternative costs the phase.
