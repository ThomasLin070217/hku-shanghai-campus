# Known issues — submission 9.1.0

Source: WeChat group “Vibe Coding Hackathon CDS SH”, 2026-11-23 19:33–20:02, plus the sidebar reports on 2026-11-21. Triage is Task 12.5; fixes route to Workstreams 6, 8, 9 and 11.

**Status as of 2026-11-25.** Every row below was re-checked against the tree, not against the plan. “Open” means the defect is still reachable in the build.

| # | Report | Severity | Status |
|---|---|---|---|
| 1 | “很多bug / 小细节” during a play session; the group will post repros | P1 | Open — no repro list arrived; the owner's own playtest on 2026-11-24 produced four defects, all closed (see below). |
| 2 | UI changed without the teammate knowing (`你是不是改过ui了？`) | P2 | Open — no “last approved UI frame” exists to diff against; the current UI is the one the owner plays. |
| 3 | Eight humanoid robots were added but are not in the current update | P1 | **Resolved in code.** `scripts/check-opening-fleet.ts:21` asserts eight deployed units with eight distinct routes and a shared shell pool; PASS inside `npm run check:opening`. |
| 4 | Robot dog: “很帅” but check speed/details | P2 | **Measured.** Quadruped: 18 meshes, 1,058 triangles, 0.87 m tall, four articulated legs and a polygon scan wedge; PASS in `check:opening-robot`. No separate frame-time benchmark — it shares the fleet's nearest-3 shadow budget. |
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

## Interior visual QA, 2026-11-25

An independent playtest walked the B4/B5 interiors at 1.6 m eye height and recorded 53 screenshots. Its report is `.scratch/interior-playtest/report-interior-playtest.txt` (passes its own quality gate, PASS, twice).

| Finding | State | Evidence |
|---|---|---|
| The standalone 4F lounge view rendered as a black shell | **Fixed — `0ad8e0b`** | the sealed AI curtain composited over the room and the opening atmosphere repainted the scene to night every frame; the view now suppresses the atmosphere, hides the curtain and restores the day exposure |
| The 5F office is underexposed while its window blew out | Partly fixed | the pane now has mullions and a transom and its emissive dropped .55 → .30 (`86dedfe`); a real interior lamp is a world-layer job — the shell gate asserts zero lights so the room cannot glow by day |
| The B4 plaza entrance has no gate bank from the cds-lobby preview | Open | the running entrance is a broad glazed doorway; a runtime scene query found no turnstile/reader family |
| Furniture reads as placeholder massing (lounge, office, corridor trolley) | Open | recorded for the pre-filming review pass |

## Security

Two `sk-` API keys were posted in the group chat on 2026-11-23 19:51/19:54. Treat them as compromised and rotate them; do not put them in the repo, the build or the tagged release. `scripts/pre-push-secret-scan.sh` passes on the current tree (no `sk-`, `ntn_`, `ghp_`, `Bearer ` shapes; no `.env`; `dist/` clean). Rotation is the owner's action.
