# Selection and veto list — 2026-11-24

Owner ruling: I choose the takes, the owner vetoes by name. No per-item questions.

**How to veto:** reply with the cue or line ids you want changed (e.g. “swap mus_dinner to take-b”, “narrator: use meditative”). Anything not named ships as listed.

Audition pages (local files, open in a browser):

- Music: `.scratch/music-2026-11-23/audition.html` — 18 cues × 2 takes
- Voice: `.scratch/voice-2026-11-23/audition.html` — 12 lines, every generated take

---

## Voice cast

| Role | Selected take | Voice | Status |
|---|---|---|---|
| Prologue narrator | `george-expressive` | George — expressive storyteller | Generated; integration pending |
| B5 staff coordinator | `Alice` | Alice — clear educator | **Shipped** in all five Staff lines |
| Player reply | `harry-fierce` | Harry — fierce warrior | **Shipped** (`player-accept-harry.wav`) |
| Local AI on the MacBook | `river-neutral` | River — neutral, calm | **Shipped** (`assets/audio/npc/ai/local-ai.wav`) |
| Invader / external AI | `steadfast-cold` | Steadfast — cold broadcaster | **Shipped** (`assets/audio/npc/ai/external-ai.wav`) |

Rejected by default: `meditative-narrator`, `steadfast-broadcaster` (prologue); `matilda-warm` (Staff); `sarah-reassuring` (local AI); `adam-firm` (invader).

**Why George for the narrator:** the owner's note was that the old read was monotone. George carries the highest style setting in the cast (0.68) and is the only take written as a storyteller rather than a news reader.

**Why River for the local AI:** the local AI must sound separate from both the invader and the human staff. River is neutral and quiet, with no broadcast colour; Steadfast is the only cold, formal voice, used for the invader.

All five shipped Staff lines and the player line were regenerated from the B4 5F script, not the old Building 6 copy. `npm run check:voice` checks every WAV hash, duration, sample rate and the shared dialogue text.

---

## Music

All 18 cues now have two rendered takes. Families A2 and B2 were re-dispatched after the first A/B families stalled; they delivered the full set.

| Cue | Pick | File | Why | Alternative if vetoed |
|---|---|---|---|---|
| `mus_title` | take-a | `family-d/mus_title/take-a/symphony_processional.wav` | Symphony processional matches the 2/5 ceremonial title card; 117.8 s loop. | take-b strings-harp |
| `mus_prologue` | take-a | `family-a2/mus_prologue/take-a/prologue_symphony.wav` | Cue map asks for warm symphony, 6/8; this is the fuller of the two. | take-b strings-harp |
| `mus_invitation` | take-a | `family-a2/mus_invitation/take-a/invitation_music_box.wav` | Phone notification reads as a music box, not a piano cue; 16 s one-shot. | take-b solo piano |
| `mus_dinner` | take-a | `family-a2/mus_dinner/take-a/dinner_waltz.wav` | Dinner is a seated waltz scene; the processional is kept for the entrance if wanted. | take-b processional |
| `mus_dinner_toast` | take-a | `family-a2/mus_dinner_toast/take-a/toast_brass.wav` | 7.5 s brass sting lands the toast without overstaying. | take-b strings+brass |
| `mus_office` | take-a | `family-a2/mus_office/take-a/office_piano_sparse.wav` | Cue map says sparse; this leaves room for servo/shout SFX. | take-b rolling piano |
| `mus_abduction` | take-b | `family-b2/mus_abduction/take-b/inv_abduction_b.wav` | The full 16-bar arc: CCTV → feed cut → 5F servos → shout/door. Take-a (4.5 s) is kept as the feed-cut stinger. | take-a as the whole cue (too short) |
| `mus_alert` | take-a | `family-b2/mus_alert/take-a/inv_alert_a.wav` | Tighter cold pulse; loops under the alert modal without crowding the new voice lines. | take-b |
| `mus_patrol` | take-a | `family-b2/mus_patrol/take-a/inv_patrol_a.wav` | Quiet march, 80 s loop; take-b is longer and slightly busier. | take-b |
| `mus_chase` | take-a | `family-b2/mus_chase/take-a/inv_chase_a.wav` | 25.6 s at the top of the 140–160 BPM band; the shorter loop restarts less noticeably. | take-b |
| `mus_march_alt` | take-a | `family-b2/mus_march_alt/take-a/inv_march_a.wav` | Full-band Soviet-march texture for the teaser/menu alternate; tighter 66 s read. | take-b |
| `mus_puzzle` | take-a | `family-c/mus_puzzle/take-a/puzzle_clockwork.wav` | Clockwork waltz; 64 s loop, the mechanical pulse fits the flip wall. | take-b |
| `mus_lawn` | take-a | `family-c/mus_lawn/take-a/lawn_drone.wav` | Ambient unease, 128 s; leaves the lion approach audible. | take-b |
| `mus_lion_boss` | take-a | `family-c/mus_lion_boss/take-a/boss_symphonic.wav` | Symphonic boss take; 54.9 s loop. | take-b |
| `mus_lion_victory` | take-a | `family-c/mus_lion_victory/take-a/victory_brass.wav` | Brass + strings one-shot, 32 s. | take-b |
| `mus_sports` | take-a | `family-d/mus_sports/take-a/strings_piano_hope.wav` | Hope cue with strings leading; matches the student-rescue beat. | take-b intimate piano |
| `mus_finale` | take-a | `family-d/mus_finale/take-a/symphony_mesh.wav` | Symphony over the four-tower mesh light show; no single central impact. | take-b strings+organ |
| `mus_credits` | take-a | `family-a2/mus_credits/take-a/credits_strings_harp.wav` | Warm strings-harp processional after the finale; the organ take is grander but colder. | take-b organ |

**Default:** take-a for every cue except `mus_abduction`, where take-b is the full arc.

---

## Rights and provenance

- Greensleeves melody: public domain; all arrangements are original.
- No Decca/UMG 1981 recording is sampled or reproduced.
- No official HKU anthem is used.
- Soundfont: `MuseScore_General.sf3` (MIT); licence note ships in `LICENSES.md`.
- Each cue folder carries `NOTES.md` / `style.json` provenance.

## Checks run

- `npm run check:voice` — PASS (5 Staff clips, 2 AI alert clips, hashes, durations, derived intro timing).
- `node_modules/.bin/tsc --noEmit` — PASS.
- `npm run check:opening` — PASS (all opening state/world/NPC/integration checks).
