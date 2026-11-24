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
| MacBook no longer obtainable | Partly fixed | the errand gate was green (70/0/0) on the review build at `9f4339a`; it has not been re-run since the door-offer rule changed in `e3d8ede`, so this one is re-run before the tag |

**Still open after that round:** a player who walks to the B4 5F office *before* speaking to the coordinator finds nothing interactable there, because the laptop is offered only at stage `to_b6` and `to_b6` is reachable only through `accept_errand`. This is a stage-reachability defect, recorded in the ledger, not yet fixed.

## Security

Two `sk-` API keys were posted in the group chat on 2026-11-23 19:51/19:54. Treat them as compromised and rotate them; do not put them in the repo, the build or the tagged release. `scripts/pre-push-secret-scan.sh` passes on the current tree (no `sk-`, `ntn_`, `ghp_`, `Bearer ` shapes; no `.env`; `dist/` clean). Rotation is the owner's action.
