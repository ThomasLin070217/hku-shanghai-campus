# 3D model comparison — HungerG vs DeepSeek Flash (2026-11-24)

Same brief, same scene, two models, each in its own folder with its own headless
Chrome. Brief: a standalone Three.js finale prototype — four equal B01–B04 towers,
B06 atrium ring at the centre, **no master core**, peer-to-peer light beams, roof
beacons, deterministic `?t=12`, InstancedMesh for repeated windows.

| | HungerG (`auto/hmodel`, Qoder free) | DeepSeek V4.1 Flash (`flash-worker`) |
|---|---|---|
| File | `.scratch/finale-mesh/hungerg/index.html` (29 KB) | `.scratch/finale-mesh/flash/index.html` (41 KB) |
| Screenshot | `hungerg/shot-t12.png` | `flash/shot-t12.png` |
| Console / READY | no errors | no errors |
| Reads as "four peers, no core" | Partly — one thin beam at t=12, ring visible, towers clearly equal | Yes — colour-coded beams between towers, handoff bar B01→B04, per-tower labels |
| Composition | Wide, flat, horizon-heavy; towers small in frame | Low three-quarter angle, towers fill the frame, atrium ring legible |
| Windows | Very bright, many hues — reads as noise at a distance | Dark with sparse lit cells — reads as glass at night |
| Determinism | `?t=12` freezes | `?t=12` freezes, HUD prints `t 12.00 s · phase 5.20 / 6.80` |
| Extra | Caption line "FINAL MESH · B01–B04 PEER LINK · NO CORE" | Phase timeline + handoff legend |

## Verdict

**Flash wins this brief on 3D presentation.** Its camera, per-tower colour coding and
beam choreography communicate the actual design idea — four peers exchanging light —
where HungerG's shot needs the caption to say it. HungerG's build is not broken: it
loads, freezes deterministically, and the geometry is correct; it simply composes the
same scene worse.

Neither is shippable as-is: both use a generic skyscraper look, while the game's campus
is a specific low-poly HKU Shanghai model. Treat these as light-show choreography
references, not assets.

## What to reuse in the real finale

1. Flash's per-tower colour identity and the B01→B02→B03→B04 handoff timeline — it
   makes "take a tower away and the machine keeps thinking" visible.
2. Flash's HUD phase clock is prototype-only; the shipped game should not show it.
3. The atrium ring should pulse on the beat *after* each handoff, not independently.
4. Keep window emissive sparse (Flash's density), not the dense mosaic HungerG used.

## Two stylisations both prototypes made — and must not ship

Flash reported both itself. They are not bugs in the prototypes; the brief said "four equal
towers, B06 at the centre". They become bugs if the finale reuses the prototypes' layout
instead of the campus the player walked through.

**1. The towers are not equal.** `src/model/campusParameters.ts:7-10` (sourced to
SM01–SM06, R01–R04, P01, T02 — measured, not invented):

| Tower | Height | Floors |
|---|---|---|
| B01 | 79.60 m | 17 |
| B02 | 79.60 m | 17 |
| B03 | 66.15 m | 14 |
| B04 | 66.15 m | 14 |

Two pairs, not four equals. **Ruling:** the measured heights stay — the parameters carry
sources and confidence and describe the real campus. The canon's "four equal towers" is
**compute parity, not literal height**: the four towers are peers in the mesh even though
two are taller. That is better drama than four identical boxes, and it removes the risk of
reading "the tall ones are the masters" — colour identity and the handoff timeline carry
peer-ness, height deliberately does not.

**2. B06 is not at the centre.** `campusParameters.ts:12`: B06 is at `x=0, z=-70` —
south, between the west pair (B01/B02) and the east pair (B03/B04), not the campus centre.
The atrium ring in the finale belongs where B06 actually is.

**Consequence for the finale build:** start from `buildCampus()`'s real transforms and add
only the emissive/beam layer. A stylised stage set would be cheaper to light and would
contradict every frame the player has already walked past.

