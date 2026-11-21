# Thomas opening · Round 2 delivery (2026-11-19)

Scope: **only** Thomas's opening — shuttle → invitation → Building 5 staff → Building 6
MacBook → AI takeover / curtain → robots / hearts → Building 5 empty hall → MacBook
Local Agent → Building 4 handoff. Harry's Building 4 puzzles, WHL's lion and Frost's
sports-hall rescue are untouched.

## 1. What changed

| Area | Result | Main files |
| --- | --- | --- |
| Shuttle | Small shuttle body parallel to the R009 road, four wheels with hubs, front/rear glazing, north passenger door + two steps, road-side `HKU SHUTTLE` sign, interior seats, head/tail lamps and destination board. | `src/opening/world.ts`, `spatialLayout.ts`, `navigation.ts` |
| Invitation | Rebuilt as a formal HKU High Table card: paper texture, green/gold rules, crest, serif typography, date/time/venue/dress grid, wax seal, Accept / Read later. Auto-presents once on the shuttle and records `invitation_read`. | `src/opening/ui.ts`, `opening.css`, `content/opening/en.ts` |
| Atmosphere | Animated bright afternoon → cold lockdown: sky/background, hemisphere/sun/fill, fog, exposure, red emergency beacons, shader curtain on all four sides plus a dark energy ceiling. Low electrical drone and cue set. | `src/opening/atmosphere.ts`, `src/gameplay/audio.ts` |
| Robots | Eight units on eight authored patrol loops across the B5 / B6 / B4 opening area. Each keeps the proven single-robot contract (scan → confirm → chase → search → capture), with a capped visual sector rate for the fleet and a red beacon light for readability. | `src/opening/robot.ts`, `robots.ts`, `spatialLayout.ts` |
| Hearts | Reusable 10-heart runtime, −2 per capture, 0 = failed run, checkpoint recovery restores 10 hearts. Pixel-heart HUD, low-heart pulse, blackout capture screen, game-over screen. | `src/opening/runtime.ts`, `ui.ts`, `opening.css`, `persistence.ts` |
| MacBook | Original macOS-style desktop: menu bar, wallpaper, desktop icons, traffic-light windows, dock, Finder, Campus Map, Terminal, About, invitation preview, dark/red incident wallpaper. | `src/opening/macbook.ts`, `opening.css` |
| Red alert | Full-screen local breach screen inside the Mac with four concrete facts and “Enable emergency assistance”; it gates the Local Agent. | `macbook.ts` |
| Local Agent | Real transport layer for a locally running Ollama/OpenAI-compatible endpoint plus a deterministic in-game recovery assistant. Message stream, typing state, quick prompts, objective card, model/status chip. | `src/opening/agent.ts`, `macbook.ts` |
| Flow / state | Objective and prompt updates through invitation → B5 → B6 → return → incident → B4; auto invitation; curtain trigger during the return; agent unlock; handoff event preserved. | `src/opening/experience.ts` |
| Lighting / main | Opening mode hides the generic night toggle; the atmosphere is created after the opening day lighting is primed and disposed with the page. | `src/main.ts` |

## 2. Event / state list

### Canonical story beats (`src/opening/state.ts`)

| Stage | Event | Log entry | Flags |
| --- | --- | --- | --- |
| `bus` | `read_invitation` | `invitation_read` | `invitation_read` |
| `to_b5` | `exit_bus` | `opening.bus_exited` | — |
| `to_b6` | `accept_errand` | `opening.laptop_requested` | — |
| `return_b5` | `take_laptop` | `laptop_acquired` | `laptop_acquired` |
| `incident` | `return_b5` | `campus_alert_triggered` | `campus_alert_triggered` |
| `to_b4` | `read_alert` | `opening.alert_acknowledged` | `alert_read` |
| `complete` | `reach_b4` | `opening.building4_reached` | — |

The segment deliberately stops at `opening.building4_reached`; it never emits
`chapter_01_completed`, `supercomputer_online` or any later-chapter fact.

### Survival / runtime (`src/opening/runtime.ts`)

```ts
schemaVersion: 1
hearts: 10                // max 10; one capture = -2
maxHearts: 10
catches: number
curtain_deployed: boolean
robot_chase_started: boolean
agent_chat_unlocked: boolean
go_to_building4_objective_unlocked: boolean
staff_task_received: boolean
```

- The runtime block is saved with `hku.opening.v1`; older saves without it load at 10/10.
- After a capture the player is restored to the nearest safe checkpoint and keeps the
  MacBook, all story beats and the runtime flags. At 0 hearts the capture screen offers
  “Recover at checkpoint” (restores 10 hearts) and “Restart opening”.
- A 2.6 s post-respawn grace freezes the fleet; during `return_b5` with the curtain up
  the checkpoint is the Building 5 safe spot, so the segment cannot become a capture loop.

### Handoff

`opening.building4_reached` is still emitted as the browser event
`campus-opening-handoff` with the laptop instance id and
`opening-building4-entrance` anchor, and is available through the read-only opening
snapshot and the save.

## 3. Local Agent setup

The assistant first tries a local endpoint, then falls back to the built-in recovery
core. No remote service and no API key are required in the repository.

```js
// optional, in the browser devtools of the game page
localStorage['hku.opening.agent.endpoint'] = 'http://127.0.0.1:11434/api/chat'; // Ollama default
localStorage['hku.opening.agent.model']    = 'deepseek-r1:8b';
localStorage['hku.opening.agent.offline']  = '1';  // force the built-in core
```

The transport accepts Ollama (`message.content` or `response`) and OpenAI-style
(`choices[0].message.content`) replies. For an authenticated model, point the endpoint
setting to your same-origin model proxy and configure credentials on that server. The
browser only sends the model name and messages. Players can stop a pending request;
the client switches to labeled offline guidance after a network error or 30 s timeout.
The static public playtest uses the offline guide. The agent can read the live story, hearts and capture count, but it
cannot move the player or change game state.

## 4. Controls and test hooks

- `WASD`, `Shift`, `Space`, `F`, `E`, `C`, `V`, `Esc` behave as before.
- The MacBook is opened with `C`; while a text field is focused, `C` types normally and
  only `Esc` closes the Mac.
- QA-only hooks are exposed as `window.__CAMPUS.openingDebug` in dev builds:
  `openInvitation`, `readInvitation`, `openStaff`, `acceptErrand`, `exitBus`,
  `setBusReady`, `takeLaptop`, `triggerIncident`, `reachB5`, `openComputer`,
  `readAlert`, `arriveB4`, `catchNow`, `recover`, `setHearts`. They are not part of the
  production UI and do not expose a shell or file-write interface.

## 5. Verification

Commands run for this round:

```sh
npm run typecheck
npm run check:opening   # state/persistence + single robot + 8-unit fleet + runtime + atmosphere + world + integration
npm run build
```

Browser evidence:

- Screenshots and the 51 s captioned QA reel: `evidence/thomas-opening-round2/` (see §6).
- Live browser runs used the real `CampusGame.step` / `CharacterPhysics` for the
  bus → B5 and B5 → B6 legs, and the live DOM for the invitation, staff, MacBook,
  alert, agent and caught screens.
- The offline world/integration checks walk the bus → B5 → B6 → B4 routes with the
  shared controller; no coordinate shortcuts are used there.

### Verification status (2026-11-19)

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run check:opening` (state, single robot, 8-unit fleet, runtime, atmosphere, world, integration) | PASS |
| `npm run check:audio-review` (incl. chase fades, curtain pause/resume, capture feedback) | PASS |
| `npm run build` | PASS |
| Browser QA flow (headless SwiftShader) | invitation → B5 → B6 → laptop → curtain → incident → Mac alert → agent reply → capture/retry reached in live runs; the single-take run was stopped when the renderer stalled on repeated screenshots |
| Physical route walk (browser, `CampusGame.step`) | bus → B5 and B5 → B6 completed in the QA run; B6 → B5 → B4 is covered by the offline integration walk |

The optional browser harnesses are `scripts/check-opening-browser.mjs` (real walking)
and `scripts/check-opening-flow.mjs` (fast state/UI flow). They are not part of
`check:all` because headless SwiftShader can throttle requestAnimationFrame; run them in
a visible Chrome window for the full single-take pass.

### Current open verification items

- The playthrough environment is headless Chromium with SwiftShader; frame pacing and
  the CSS animation timeline are not the same as a desktop browser. Visual polish must
  be re-checked once on the target laptop.
- The MacBook Local Agent was verified with its built-in recovery core; a real local
  model run needs the model endpoint on the machine (`§3`).
- **A single-take, no-teleport human playthrough from the bus to the Building 4 handoff
  is still required on the target laptop.** The current browser evidence is a set of
  live beats plus an automated route/integration check, not a continuous 10-minute
  recording.
- The B5 interior and B6 office remain provisional 2030 scenery, not surveyed rooms.

## 6. Screenshot set

| File | What it shows |
| --- | --- |
| `evidence/thomas-opening-round2/opening-beat-reel.webm` | 15-beat QA reel (51 s, captioned) |
| `evidence/thomas-opening-round2/01-invitation.png` | High Table invitation card |
| `evidence/thomas-opening-round2/02-bus-interior-hearts.png` | Shuttle interior, 10/10 hearts, open door |
| `evidence/thomas-opening-round2/03-bus-exterior-south.png` | Shuttle parallel to the road, wheels/windows/sign |
| `evidence/thomas-opening-round2/04-bus-exterior-north.png` | Shuttle door and steps from the forecourt |
| `evidence/thomas-opening-round2/05-staff-dialog.png` | Building 5 dinner coordinator |
| `evidence/thomas-opening-round2/06-laptop-return.png` | MacBook collected, return objective |
| `evidence/thomas-opening-round2/07-curtain-campus.png` | Dark sealed campus and AI curtain horizon |
| `evidence/thomas-opening-round2/08-robots.png` | Security unit, red eye and scan cone after takeover |
| `evidence/thomas-opening-round2/09-empty-hall.png` | Empty / overturned Building 5 dining hall |
| `evidence/thomas-opening-round2/10-mac-alert.png` | Red MacBook breach alert |
| `evidence/thomas-opening-round2/11-mac-desktop-agent.png` | macOS desktop + Local Agent window |
| `evidence/thomas-opening-round2/12-agent-chat.png` | Local Agent conversation and suggestions |
| `evidence/thomas-opening-round2/13-caught.png` | Capture blackout, −2 hearts |
| `evidence/thomas-opening-round2/14-game-over.png` | 0-heart failure / recover or restart |
| `evidence/thomas-opening-round2/15-complete.png` | Building 4 handoff screen |

## 7. Still requested from the user (campus photo / confirmation)

These are the same evidence gaps as `THOMAS-CAPTURE.md`, now with the round-2 additions.
Priority order: T01–T06 first, then P1.

| ID | What to photograph | Why the model still needs it |
| --- | --- | --- |
| T01 | Building 4 drop-off lane: both directions, curb, door position of the shuttle | confirm the shuttle's parallel parking and the exact curb/door side |
| T02 | Continuous walk from the drop-off to Building 5, with a 3 s pause at every turn | confirm whether the central-walk detour is correct |
| T03 | Building 5 front, left/right 45°, entrance, then the ground-floor right turn into the dinner room | confirm the foyer, right-turn room, door width and ceiling height |
| T04 | Building 5 → Building 6 → Building 5 continuous video, including the grand stair/level change | confirm the 5.1 m B6 entry and the stair count |
| T05 | Building 6 entrance and public foyer; the room used for the MacBook | confirm the entrance, threshold and whether the room is plausible |
| T06 | Building 5 → Building 4 main entrance continuous video, with the final outside standing spot | confirm the handoff anchor and the approach |
| T07 | Glass fronts of B5/B6 at 45°, with columns and interior silhouettes | identify real glass vs solid wall / openings |
| T08 | Paving, kerbs, ramps, any temporary boards | ensure the bus steps and walking routes match the ground |
| T09 | Trees/planters along the route from both ends | avoid adding a planter or tree across the actual route |
| T10 | Building 5 dinner room in both the normal and emptied/turned-over state from the same camera | match the incident dressing |
| T11 | Shuttle door, steps, handrail and seats (if photography is allowed) | confirm the door side, step heights and interior layout |
| **T12 (new)** | **Same camera at the four edges of the opening route, looking out, around 18:30 and after dark** | verify the new AI curtain distance and night exposure |
| **T13 (new)** | **Wide shot of the B5/B6/B4 open space with a person for scale** | calibrate the 8-robot patrol density and scan distances |
| **T14 (new)** | **Building 4 main entrance at night, red/emergency lighting if any** | avoid inventing emergency-light hardware that does not exist |

## 8. Boundaries

- No Apple artwork, fonts or SF Symbols are copied; the Mac UI is an original CSS/SVG
  interpretation.
- No external LLM call is made by default; the fallback is local and deterministic.
- The curtain is a visual containment field, not a new collision wall; the existing
  campus boundary and navigation still own movement.
- The robot fleet is still non-combat: no weapons, no shooting, no drops. Capture only
  removes hearts and restores a checkpoint.
- The opening never emits later-chapter events or changes Harry's / WHL's / Frost's
  modules.
