# COD-style intro pass · Thomas opening

Date: 2026-11-21. Reference: Call of Duty campaign openings (playable first-person
cinematic, diegetic briefing, sound-led pacing), adapted to the existing pixel/blocky
campus. No COD asset, text or layout is copied.

## Beat sheet

| Beat | What the player sees / hears | Duration | Implementation |
| --- | --- | --- | --- |
| 1. Wake | Black + letterbox; bus engine, low vibration, soft breath; camera starts looking down and lifts; title `HKU SHANGHAI` / `2030 · STUDENT AMBASSADOR`; the HUD is hidden | ~4.4 s | `experience.ts` (`startWake`, `wakeClock`), `ui.ts` (`.opening-cinema`), `opening.css` |
| 2. Location card | `BUILDING 4 FORECOURT` / `18:12 · HIGH TABLE DINNER`; then the subtitle `The invitation is on the seat beside you.` | ~3 s | `showTitle` / `showSubtitle` |
| 3. Physical invitation | A cream paper + green ribbon + wax seal on the seat. The HUD is hidden and the player stays seated; a cinematic subtitle says `An invitation is on the seat beside you. Press F to pick it up.` If `F` is not pressed, the letter opens automatically after ~3.2 s. | until `F` / auto | `world.ts` (`opening-bus-invitation`), `spatialLayout.ts` (`OPENING.invitation`), `target()` |
| 4. Invitation card | The formal paper card opens as part of the intro, framed by the same letterbox and with the HUD hidden. Pressing Accept records `invitation_read`, ends the intro, returns control and lets the door/driver cue proceed. `Read later` keeps the intro seated and HUD-free. | user-paced | `invitationDialog`, `close()` auto-resume |
| 5. Door / driver | The door opens with `DRIVER — Building 4. Mind the step when you leave.`; a location card follows on exit | ~3.4 s | `tick()` busReady branch, `showTitle` |
| 6. Staff walk-and-talk | Entering Building 5 starts three subtitled lines while the coordinator walks toward the dinner tables; the player keeps control; after the last line the objective updates to Building 6 | ~9.6 s | `npcs.startStaffTalk`, `STAFF_LINES`, `showTitle` |
| 7. MacBook / alert / curtain / B4 | Existing round-2 systems unchanged | — | `atmosphere.ts`, `robots.ts`, `macbook.ts`, `agent.ts` |

## Why this is closer to COD

- The player is never shown a wall of modal copy before they have looked around.
- The mission title, driver and coordinator lines are **subtitles over playable space**,
  not a pause menu.
- The strongest information (where the invitation is, where the objective is) is
  diegetic or spatial: an object on the seat, a bearing arrow, a distance.
- Sound leads the transition: engine → driver line → door → anomaly drone before the
  curtain, instead of a hard visual cut.
- The camera has a small authored move (wake-up) but is never taken away from the player
  for long.

## Still to do (next pass, not in this commit)

1. Add first-person hands actually picking up the invitation and a short page-turn.
2. Give the coordinator a hand-off path that ends at a specific table (currently a short
   walk toward the tables).
3. Add a short B6 corridor beat before the laptop: flickering light, distant servo,
   laptop screen glow.
4. Add a 2–3 s "sound drops out" beat before the curtain (COD-style silence).
5. Record one unbroken human playthrough on the target laptop; the current reel is a
   beat reel assembled from live frames, not a single take.

## Replaying on an old save

The intro is guarded by `hku.opening.introVersion` (`cod-intro-v3`). If the browser
still has a legacy bus save with `invitation_read=true`, the first load resets that bus
stage to a fresh opening and replays the wake → letter sequence. `Restart opening`
clears the guard as well. A save beyond the bus is never reset; use `Restart opening`
once to see the new intro.

## Verification

`npm run typecheck`, `npm run check:opening`, `npm run check:audio-review` and
`npm run build` pass. The browser intro check reached:

- wake title/subtitle
- physical invitation pickup (`invitation_read = true`)
- staff walk-and-talk (`to_b5`)
- automatic objective update (`to_b6`, `staff_task_received = true`)
- no page exceptions.
