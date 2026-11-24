# Student rescue — interaction design delta (owner direction, 2026-11-23)

Owner, verbatim:
> 解救学生那一关，那个学生的互动，你看一下，设计得好一点。

## What exists today (evidence)

- `src/gameplay/studentCrowd.ts`: 100 students inside the sports hall as 8
  appearance variants in 16 InstancedMeshes (two draw calls per variant). Fixed
  deterministic scatter, door-zone clearance 2.8 m, the 12 nearest positions
  are long-haired women, **no collision**, no per-student state, no animation
  beyond none at all.
- `src/gameplay/sportsDoor.ts`: the only “rescue” is the east-door lock
  (9×9 sudoku → 4-digit password). On unlock, a centred banner appears for 8 s:
  “You have successfully rescued the students! 100 students are safe.”
- There is no student to talk to, no reaction, no reward beat, no state change
  in the hall after the door opens. The crowd is scenery that happens to be
  there.
- Reusable pieces: `createCharacter` rig (idle/walk/run/jump, face tracking),
  the opening NPC walk-and-talk pattern (`src/opening/npcs.ts`), subtitle hint
  line, `StoryAudio.ui()` cues, `game.doors[SPORTS_DOOR.id]` as the unlocked
  signal, campaign `notify`.

## Problem

The player does the hard part at the door, then the game tells them “100
students are safe” without ever showing a student noticing, reacting, or
speaking. The rescue is told, not played. It also wastes the strongest story
asset in the hall: 100 people who were trapped and are now free.

## Target beat (three layers, ~25–35 s, skippable)

State machine: `sealed → unlocking → freed → talked → leaving → gone`, driven
by the door state and player distance; every transition is latched so a reload
mid-beat restores at `freed` or later without replaying the whole scene.

1. **Before the unlock (sealed / unlocking)** — through the glass, the nearest
   group notices the player: the 8–10 instances nearest the door rotate to face
   the door and take a half-step forward (instance matrices only; the crowd is
   already instanced). One foreground representative stands at the door inside,
   palms near the glass; her subtitle when the player is within 3 m:
   “Please — the lock. The code is on the board behind us.” (A diegetic hint
   for the sudoku, not a new puzzle.)
2. **The unlock moment (freed)** — the banner is demoted to a small toast after
   the beat, not the beat itself. Instead:
   - the crowd turns toward the door in a ripple (nearest first, ~1.2 s), and a
     handful of foreground students take one step forward;
   - the representative walks to the player (the existing `npcs.ts`
     walk-and-talk pattern), stops at 1.6 m, and speaks one short exchange:
     thanks + “They kept us in the dark. The lion outside isn’t… itself.”;
   - two optional questions on `E`/`F` (no mouse): “Is everyone okay?” and
     “What happened here?” — one line each, then she steps aside;
   - a soft crowd murmur cue and a warm light bloom from the door.
3. **After the talk (leaving / gone)** — a group of ~12 students files out
   through the open east door over ~8 s (walk animation, door-zone path), while
   the rest turn back into the hall. The representative stays by the door.
   Re-entering later: she greets with a single line (“The hall is clear. Thank
   you.”), no full dialogue replay. `rescued` persists in the save.

The player can walk away at any point; the dialogue closes, the crowd still
leaves, nothing blocks movement (students remain passable per the current
design). The beat is presentation, not a gate.

## Implementation sketch

- New `src/gameplay/studentRescue.ts`: owns the foreground cast (representative
  + 5 students near the door, created with `createCharacter`, placed from the
  existing crowd placements so they read as part of the crowd), the dialogue
  panel (reuse the sports-door panel styles; keyboard-only), and the crowd
  instance reaction for the nearest N (read the InstancedMesh matrices, rotate
  around Y and step forward in the first second).
- Wire from `sportsDoor.ts`: on `open` transition call
  `studentRescue.free()`; `update(dt)` gets player position and door state;
  `dispose()` on pagehide. No new save field beyond the existing door state
  (the talked/left state can be session state; the door is the save).
- Dialogue is text-only, 3–4 short lines, no new audio recording; use
  `audio.ui('confirm')` per advance. The existing banner stays for the
  standalone rescue mode but only as a toast after the beat.
- Accessibility: `E`/`F` advance, `1`/`2` choose, `Esc` closes; the
  representative is reachable from the door without pointer lock.
- Performance: +6 characters (~+120 draw calls peak, only while the hall is
  loaded) and a one-time matrix pass over the nearest instances; the far crowd
  is untouched.

## Open decisions for the owner

1. Does the representative give a **story line** (the lion is infected / the
   core did this) or only thanks? The first connects Chapter 05 → 06; the
   second keeps the rescue self-contained.
2. Should the group actually **walk out of the door** (more work, strong
   payoff) or just gather at the door and turn (cheaper, still reads)?
3. Is the rescue beat skippable by walking away (recommended) or should it
   hold the player until the dialogue ends?

## Plan

### Task 1 — foreground cast

Files: new `src/gameplay/studentRescue.ts`,
`src/gameplay/studentCrowd.ts` (expose the placements used by `main.ts`),
`src/main.ts` (construct/dispose), `src/gameplay/sportsDoor.ts` (free hook).

- Pick the representative and five foreground students from the deterministic
  crowd placements nearest the east door (the 12 nearest are already women);
  reuse `createCharacter` with the same `Appearance` variants and the same
  yaw convention.
- Positions: the representative 1.6 m inside the door, the five behind/around
  her; no collision (students stay passable).
- Author keys `student_rescue_rep`, `student_rescue_<n>`, source note
  “rescue beat, fictional gameplay addition”; dispose all rigs on pagehide.
- No animation until `free()`; idle facing the door.

### Task 2 — crowd reaction and state machine

Files: `src/gameplay/studentRescue.ts`, `src/gameplay/studentCrowd.ts`,
`src/gameplay/sportsDoor.ts`.

- The crowd keeps its two InstancedMeshes; expose a `nearest(n, point)` API
  returning instance indices and rest matrices. On `free()`, rotate the
  nearest 8–10 instances toward the player/door over 1.2 s and step them
  forward 0.25 m, then back to rest; far instances untouched.
- States `sealed → unlocking → freed → talked → leaving → gone`, latched;
  `unlocking` starts when the player is within 3 m of the closed door and the
  door puzzle panel is open; `freed` on `game.doors[SPORTS_DOOR.id]`;
  `talked` after the dialogue; `leaving` 1 s later; `gone` when the group has
  walked out. Reload at `freed` or later restores that state without replaying.
- The existing rescue banner is shown only as a toast after the beat, not on
  unlock; the standalone mode keeps its banner behaviour.

### Task 3 — dialogue

Files: `src/gameplay/studentRescue.ts`, `src/style.css` (or the module CSS),
`src/gameplay/sportsDoor.ts` (panel styles), `src/gameplay/storyAudio.ts`
(UI cue).

- Keyboard-only panel: `E`/`F` advance, `1`/`2` choose an optional question,
  `Esc` close; also a click target for each line. No pointer lock required.
- Lines: unlock thanks + “The lion outside isn’t itself. The core is doing
  this.”; optional “Is everyone okay?” → “Shaken, not hurt.”; “What happened
  here?” → “The doors locked from the outside. Then the lights went red.”
- Each advance plays `audio.ui('confirm')` at low gain; no recorded voice in
  this round.
- The dialogue never blocks movement: walking out of 4 m closes it; the crowd
  still leaves.

### Task 4 — group exit and re-entry

Files: `src/gameplay/studentRescue.ts`, `sportsDoor.ts`.

- On `leaving`, 12 foreground/crowd students walk a short path through the
  east door (the existing door leaves and collision are already open), then
  fade/unload into the exterior; the representative stays in the hall.
- Re-entry after `gone`: a single subtitle line when within 3 m (“The hall is
  clear. Thank you.”), once per session; no full dialogue.
- No new save field: `game.doors[SPORTS_DOOR.id]` remains the save; the
  talked/left state is session-only, and a reload shows the greeting again.

### Task 5 — gates and evidence

- Extend `check:sports-students` with the foreground cast count/placement and
  the state machine (unit, no DOM); `check:door` unchanged; add a browser step
  to `check:campaign-sports` or a new `check:rescue-browser.py`: unlock, see
  the reaction, advance the dialogue, watch the group leave, re-enter, see the
  greeting.
- Screenshot: door before unlock, rep mid-dialogue, group leaving, re-entry.
- No new collision; no page errors; draw calls within the zone budget.

## Acceptance

- Browser: unlock the door, see the nearest students turn and the
  representative approach; advance the dialogue with the keyboard; see the
  group leave; re-enter and get the short greeting.
- The crowd remains passable; no collision is added; no page errors; the
  beat survives a reload at `freed`.
- Existing gates stay green: `check:door` (lock/unlock), `check:sports-students`
  (crowd variants/placement), `check:campaign-sports` (campaign rescue). A new
  browser step covers the dialogue advance and the greeting on re-entry.
