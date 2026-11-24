# Prologue background + sunset + interior montage — narrative delta (owner direction, 2026-11-23)

Owner, verbatim (first message):
> 这都已经是 high table dinner 了，对不对？它是不是应该有一种夕阳西下的感觉？
> 而且你背景说的应该也不太对。我主要是想说：campus 已经智能化了，对吧？
> campus 是如何组成一个 super computer 的？还有我们社会的背景，AI 现在有多强大，等等。
> 我们现在开学典礼马上就要开始了，我是一个 student ambassador，就是那样的。
> 这是一开始的部分。不过我觉得那个动画还是可以的，当然可能也需要根据我们叙述的情况再调整一下。

Owner, verbatim (second message, after reading the 6-line draft):
> 我觉得第一个旁白里，第一句、第二句没有问题。第一句可能稍微改一点：可能世界变得前所未有的
> interconnected and intelligent，对吧？
> 第二个也没有问题。这个时候就可以展示一些楼的内饰，对吧？就像有没有看过那种英特尔、AMD
> 发新处理器时的宣传片，展示处理器里的电路，对吧？我们就可以用类似的方式去展示我们这个
> 学校的一些内饰。
> （#3–#6）这个部分不要有。我只是说让你补充背景信息，然后看可以怎么拓展一下。
> 说得不要那么生硬，对吧，更有诗意一点。

## Rulings from the second message

- The prologue narration is **background only**. The incident, the ambassador role, the
  master key, the mission and the player line are **out of the prologue**; those story
  beats belong to gameplay. No “last night”, no “barrier seals” in the narration.
- Line 1 keeps the world background, rephrased around **unprecedentedly interconnected
  and intelligent**, and made poetic.
- Line 2 keeps the campus-as-supercomputer idea and adds a **visual job**: from this
  beat on, show the **building interiors** the way an Intel/AMD processor launch film
  shows the inside of a chip — circuitry, racks, keys, light traces.
- The opening-ceremony / High Table Dinner setting is carried by **image and mood**
  (sunset, dressed tables, windows coming on), not by a stiff line of exposition.
- **The campus is a decentralised computer** (owner, fourth message). There is no
  master core; the four towers are equal nodes and the links run tower-to-tower.
  The narration and the mesh overlay must both say this: taking one tower away
  leaves a machine that still thinks. The old “around a single core” wording is
  retired.
- **No cuts.** The whole prologue is one continuous camera move (owner, third
  message). The interior beats are flown through in a single spline, not cut
  together. Doorways are used for the transitions into and out of the buildings;
  no wall clipping.

## New script — background only (4 lines, ~40 s)

| # | Speaker | Text | Visual beat | Est. |
|---|---|---|---|---|
| 1 | narrator | “By 2030, the world had become more interconnected, and more intelligent, than anyone had imagined. Not a network of machines — a single mind with no centre, wrapped around a planet.” | sunset aerial; faint data traces between buildings | 10.0 s |
| 2 | narrator | “HKU Shanghai was not built with computers in it. It was built as one. Four towers — PU-01 to PU-04 — and no master core. Every room, every light, every door: a node. Take a tower away, and the machine keeps thinking. CDS.” | mesh die-shot: four towers as equal nodes, links tower-to-tower; dive into B4 | 12.0 s |
| 3 | narrator | “Step inside, and the machine is everywhere. Server halls breathe. Lecture theatres wake row by row. Doors open before you reach them. The building is not holding a computer — the building is the computer.” | interior montage (B4 racks, Keyboard Wall macro, B5 corridor, dinner hall) | 11.0 s |
| 4 | narrator | “By six, the light turns gold. The campus is dressing for the opening ceremony — long tables, green cloth, the first toast of the year — and the windows come on one by one. By the time you arrive, it has been awake for hours.” | dusk exterior; windows lighting one by one; settle to spawn | 12.0 s |

Total ≈ 44.5 s audio + gaps; if the measured total exceeds the 48 s hard ceiling,
trim “long tables, green cloth, the first toast of the year” to “long tables, the
first toast of the year” first.

Chinese gloss for approval:

1. 到 2030 年，这个世界比任何人想象的都更互联、更智能。它不再是一张机器的网络——它是一个没有中心、包裹着整颗行星的单一心智。
2. HKU Shanghai 不是把电脑装进了校园——它本身就是一台电脑。四座塔楼——PU-01 到 PU-04——没有主核心。每一间房、每一盏灯、每一扇门，都是一个节点。拿走一座塔楼，这台机器仍然在思考。CDS。
3. 走进去，机器无处不在。机房在呼吸，阶梯教室一排接一排地醒来，门在你走到之前就打开。这栋楼不是装着电脑——这栋楼就是那台电脑。
4. 六点，光变成金色。校园在为开学典礼更衣——长桌、绿布、今年的第一杯祝酒——窗户一盏接一盏亮起。等你抵达的时候，它已经醒了好几个小时。

Optional extra line for the AI-society background (owner decision, +~9 s):

> “It wrote the timetables, balanced the grids, priced the power, graded the exams.
> Somewhere along the way, people stopped asking which decisions were still theirs.”

Chinese: 它写课表、平衡电网、给电力定价、批改试卷。不知从什么时候起，人们不再追问哪些决定还是自己的。

If included, insert after line 1 (fits the “AI 有多强大” brief); total ~54 s, which
exceeds the current 48 s ceiling — the owner must choose this over the interior
montage length, not in addition to everything.

## Playable opening — after the cinematic

The cinematic hands control to the player **in the crowd**, not on the bus.

- Spawn: on the plaza after the light show, facing Building 5; the crowd is
  walking toward the High Table Dinner. The old bus stage is gone from the flow
  (`story.stage === 'bus'`, the bus clock, the physical invitation on the seat
  and the bus-door interaction). The bus itself can stay parked as scenery.
- After a few steps the phone vibrates (sound + a short haptic if available).
  A phone overlay slides up; it is the only UI the player needs.
- Invitation copy (English on device, Chinese optional in the subtitle layer):

  ```
  HKU SHANGHAI · STUDENT AMBASSADOR PROGRAMME
  High Table Dinner · Tonight · Building 5

  You are invited to serve as Student Ambassador for the evening.
  Your MacBook has been provisioned with campus root access.

  [ Yes ]
  ```

- One action only: **Yes**. No decline path. On press: the overlay confirms
  “Welcome, Ambassador.”, sets the ambassador flag, and updates the objective to
  **Walk to the High Table Dinner · Building 5**.
- The crowd keeps walking; the player follows. On arrival at B5 the existing
  staff / MacBook errand continues unchanged (the staff hand-off, the walk to
  B6, the return and the incident).
- The phone overlay pauses movement while it is open (a modal), then releases on
  Yes. Skip/checkpoint semantics of the prologue are unchanged.

## Visual delta

### Sunset

- Time of day: November 18:12 → **sunset**. Low warm sun in the south-west, long
  shadows, amber → rose → deep-blue sky, cool fill from the east, lit windows.
- The campus is **awake**: window emissive gain, bus headlights, service robots,
  screens glowing.
- The red emergency wash is **not** in the prologue any more; the incident is not
  narrated. The sealed/red state belongs to gameplay after the prologue.

### Interior montage (the Intel/AMD reference)

- All interiors already exist in the opening world: B4 ground-floor lobby
  (`b4Shell.ts`, `b4Layout.ts`) with the supercomputer racks, the 54-cap Keyboard
  Wall and timber tiers; the B5 ground-floor flip-wall corridor (`b5FlipWall.ts`);
  and the B5 ground-floor dinner hall (`DINNER_LAYOUT` in `spatialLayout.ts`, the
  room the owner confirmed as B5 ground floor). No new rooms are built.
- **One continuous camera path** — a Catmull-Rom spline through timed waypoints,
  shot like a processor launch film:
  1. high sunset aerial over the campus, faint data traces between buildings;
  2. descend along the B4 approach road and through the B4 south doorway
     (`OPENING.b4.door`, z 20.5);
  3. low glide along the rack faces — LED rows sweeping past the lens;
  4. a close pass over the Keyboard Wall caps, then out through the same doorway;
  5. low across the campus toward B5, in through the B5 south doorway
     (`OPENING.b5.door`, z −54.7);
  6. through the B5 lobby partition into the dinner hall — long tables in green
     cloth, the dais, warm practicals;
  7. out of B5, rise over the dusk campus with windows lighting one by one, and
     settle exactly on the spawn pose at the bus.
- No hard cuts. Any "reveal" is done by movement and light, not by editing. The
  path uses the real doorways; if a leg clips a wall in the visual check, the
  waypoint is moved, not the geometry.
- Add prologue-only **light traces**: thin additive lines running along floor
  seams / ceiling coves / between racks, pulsing between nodes; plus a die-shot
  overlay in the aerial — four tower footprints outlined as **equal nodes in a
  mesh**, with links running tower-to-tower and through the campus, no star
  topology and no central core, like a chip schematic. The overlay fades out as
  the camera dives. Both are temporary objects created when the prologue starts
  and disposed when it stops/skips.
- **Interior light beam**: one coherent volumetric shaft inside the building,
  running through the racks and the corridor — a soft additive cone/cylinder with
  a bright edge, a slow pulse and drifting dust, with the camera passing through
  it. Reference: the Nvidia/Intel chip ads the owner supplied. No postprocessing
  dependency; prologue-only, disposed with the other overlays.
- Shot system change: today one pose window per narration line, smoothly
  interpolated. Replace with **one spline for the whole run**, with waypoints
  timed to the narration beats (the line table and the waypoint table stay
  separate). Reduced motion uses the same path at constant speed. The final
  waypoint is the spawn pose.
- Subtitles stay two lines max, phone-safe.

## Audio delta

- Narration **ducks** the music (`playVoice` currently does not call
  `setDialogueDuck`; NPC voice does). Duck on each line, restore after.
- Music bed: the warm/sunset layer of the new score (`docs/plans/2026-11-23-music.md`);
  no `mus_safe` default. Bus/room ambience low.
- Interior montage SFX (optional, existing assets only): rack hum/fan, key
  clicks, distant room tone. No new recordings.

## Plan

### Task 1 — owner approves the script

No code. Present the table (English + Chinese gloss) and the optional line.
Nothing is generated or re-recorded before approval.

### Task 2 — regenerate narration and retime

Files: `content/voice/prologue.json`, `scripts/generate-prologue-voice.mjs`,
`assets/audio/prologue/*`, `assets/audio/prologue/clips.json`.

- Regenerate the four approved narrator lines with the existing narrator voice
  (key from the existing env/keychain path; never print it); `--check` verifies
  duration/sha/text.
- `clips.json` regenerated; `PROLOGUE_TOTAL` becomes the new timeline. Keep the
  0.35 s gaps. Remove the player clip and the mission line from the manifest
  (they are no longer in the prologue); keep the audio files on disk if other
  code references them, otherwise delete with the manifest.
- Hard ceiling 48 s; trim line 4 inside the approved text before considering a
  re-record.

### Task 3 — one-shot camera spline

Files: `src/opening/prologue.ts`, `src/opening/prologueTimeline.ts` (new waypoint
table), `src/opening/prologue.css` if subtitle timing changes.

- Replace the per-line pose interpolation with **one Catmull-Rom spline** through
  the whole waypoint list; no cuts anywhere. Waypoints carry a time; the spline
  is sampled by the prologue clock, and look-at targets are smoothed on their own
  spline so the camera does not whip at the doorway turns.
- Waypoints for the B4 fly-through, the B5 lobby and the dinner hall are read
  from the room constants (`OPENING.b4.door`, `OPENING.b5.door`, `B4_TIERS`,
  rack origins, `DINNER_LAYOUT.tables`, `DINNER_HEAD`) rather than hand-typed
  magic numbers where those constants exist.
- Keep the last waypoint = spawn pose and the reduced-motion path the same spline
  at constant speed. No wall clipping: the path enters and leaves through the
  real doorways; a clipped leg is fixed by moving the waypoint.
- Add the die-shot overlay and the light traces as prologue-only objects; dispose
  on stop/skip/replay; never leave them in the gameplay scene.
- Keep `__CAMPUS.prologue` seek/state behaviour; the browser gate must be able
  to seek to each waypoint beat.

### Task 4 — dusk atmosphere + interior practicals

Files: `src/opening/atmosphere.ts`, `src/opening/world.ts` (emissive handles),
`src/opening/experience.ts` (mount), `src/opening/prologue.ts` (state handoff).

- Add a `dusk` atmosphere state and set it for the prologue; gameplay starts in
  the current day/sealed logic after the prologue (no red wash during the
  prologue).
- Turn on lit windows + interior practical lights for the montage; restore the
  pre-prologue state on stop.
- Visual check at 1280×800 and 390×844: sunset readable, interior highlights not
  clipped, subtitles legible.

### Task 5 — playable opening: crowd + phone invitation

Files: `src/opening/experience.ts`, `src/opening/state.ts`,
`src/opening/opening.css` (phone overlay), `src/opening/npcs.ts` /
`src/gameplay/studentCrowd.ts` (crowd), `src/opening/prologue.ts` (hand-off),
`src/opening/spatialLayout.ts` (new spawn/crowd anchors), `src/main.ts`.

- Remove the bus stage from the opening flow; spawn the player in the crowd on
  the plaza, facing B5. Keep the bus as scenery if it does not obstruct the
  crowd path.
- Add the phone overlay: vibration cue, invitation card, a single Yes button,
  “Welcome, Ambassador.” confirmation, objective update. While open, movement
  is paused; on Yes it releases.
- Populate the crowd with the existing student crowd system, walking toward B5;
  the player is one of them. The crowd is non-hostile and does not block the
  objective.
- Set the ambassador flag used by the rest of the opening; the existing staff /
  MacBook flow continues on arrival.
- Update the save/checkpoint shape and any code that assumed `stage === 'bus'`;
  keep old saves readable with a migration default (the old bus stage maps to
  the new `crowd`/`to_b5` stage).
- Gates: a browser check that boots the opening, waits for the phone overlay,
  asserts only one enabled button, clicks Yes, asserts the objective text and
  that the player can move afterward.

### Task 6 — gates + evidence

- `check:prologue` (line count 4, new total, manifest budget), browser gate
  (seek every waypoint beat, no camera jump above a small per-second bound,
  subtitle two-line, phone frame), typecheck, build, `check:opening`,
  `check:campaign`.
- Evidence: new prologue PNGs (aerial mesh die-shot, one interior frame, sunset
  final frame, phone overlay, phone frame) stamped with the commit; a
  before/after note.

## Open decisions for the owner

1. Optional AI-society line (above): include it (prologue ~54 s) or keep the
   four-line version (~45 s)?
2. Which interior beats to show: all four (racks, Keyboard Wall, corridor,
   dinner hall) or a shorter set? The dinner hall is the strongest sunset/
   ceremony beat; the racks/keys are the strongest “inside the chip” beats.
3. Keep the closing “By the time you arrive, it has been awake for hours.”?
   It is the only line that acknowledges the player without stating a role.
4. Voice for line 4 and the optional line: same narrator.

## Acceptance

- Owner approved the four lines; the decentralised wording (“no master core…
  take a tower away, and the machine keeps thinking”) is the final revision.
- The prologue plays at sunset: light-show finale → mesh die-shot → interior
  fly-through → crowd; one continuous take, no cuts; no incident narration.
- After the cinematic the player is in the crowd; the phone vibrates, the
  invitation shows one Yes, and saying Yes sets the ambassador objective.
- Subtitles fit two lines desktop and phone; total within the chosen ceiling;
  gates green; the bus stage is gone from the opening flow.
