# Score cue map — BARRIER 2030

> Owner request, 2026-11-23: “have some sub agents make music, like every part for the game … different versions of HKU … maybe use Greensleeves in some scenes … maybe the Soviet, maybe the March.”
> This map is the single source of truth for **where music plays**. Implementation is Workstream 13 in `2026-11-23-master-roadmap.md`.

## Rights ruling (binding)

| Element | Status | Rule |
|---|---|---|
| Greensleeves melody | Public domain, 16th c. | Use freely; our own arrangement. |
| Greensleeves 1981 Decca/UMG recording | Protected in HK/mainland until at least 2031-12-31 | **Never** sample, rip, re-use or upload. |
| Official HKU anthem | Not cleared | **Do not use** unless the owner confirms rights in writing. |
| “HKU variations” | Original | An original HKU-2030 motif, or original variations on Greensleeves. |
| Style references (Soviet march, symphony, waltz) | Technique only | Borrow texture, rhythm, instrumentation — never another composer’s notes. |
| Soundfont | `MuseScore_General.sf3`, MIT | Ship the licence note in `LICENSES.md`. |

Every cue folder carries `NOTES.md` with: origin of the melody, arrangement author, style card used, and the exact render command.

## Two themes

- **Campus theme (Greensleeves, PD).** The old campus: Magic Hour, dinner, the principal’s office, credits. Arrangements are ours; the tune is a memory anchor, not a national anthem.
- **HKU-2030 theme (original motif).** A 4–8 bar original motif representing the campus as a decentralised computer. It can be stated as processional, march, stealth, waltz, chase, boss or hope.
- **Invader motif (original).** Cold, mechanical, march-adjacent. It is the external AI, not the campus. It may share the Soviet-march *texture* but not its melodies.

## Cue table

| Cue id | Where it plays | Theme | Style | Length | Loop / one-shot | Intensity |
|---|---|---|---|---|---|---|
| `mus_title` | Title/menu, first load | HKU-2030 | Symphony / processional | 32 bars | Loop | 2/5 |
| `mus_prologue` | Magic Hour, crowd walks to B5 | Greensleeves | Warm symphony, 6/8 | 32 bars | Loop | 2/5 |
| `mus_invitation` | Phone invitation, only “Yes” | Greensleeves fragment | Solo piano / music box | 8 bars | One-shot | 1/5 |
| `mus_dinner` | B5 High Table Dinner | Greensleeves | Ceremonial processional / waltz | 32 bars | Loop | 2/5 |
| `mus_dinner_toast` | Toast beat | Greensleeves fragment | Brass + strings sting | 4 bars | One-shot | 3/5 |
| `mus_office` | B4 side lobby, lift, 5F corridor | Greensleeves fragment | Solo piano, sparse | 16 bars | Loop | 1/5 |
| `mus_abduction` | Lobby CCTV feed → feed cut → 5F servo/shout/door | Invader | Soviet-march texture, slow | 16 bars | One-shot / stinger | 4/5 |
| `mus_alert` | MacBook security alert | Invader | Cold pulse + drone | 8 bars | Loop under modal | 3/5 |
| `mus_patrol` | Humanoid robots / stealth | Invader | Soviet-march texture, quiet | 32 bars | Loop | 3/5 |
| `mus_chase` | Robot dog / detection | Invader | Chase, 140–160 BPM | 16 bars | Loop | 5/5 |
| `mus_puzzle` | Flip-wall / breaker puzzle | Neither | Clockwork waltz / music box | 32 bars | Loop | 2/5 |
| `mus_lawn` | Lawn, lion approach | Greensleeves fragment | Ambient unease | 32 bars | Loop | 2/5 |
| `mus_lion_boss` | Lion fight | Invader vs HKU-2030 | Boss, symphonic | 32 bars | Loop | 5/5 |
| `mus_lion_victory` | Lion defeated | HKU-2030 | Brass + strings | 8 bars | One-shot | 4/5 |
| `mus_sports` | Sports hall / student rescue | HKU-2030 | Hope, strings + piano | 32 bars | Loop | 3/5 |
| `mus_finale` | Four-tower mesh light show | HKU-2030 | Symphony / hope | 32 bars | One-shot over 20–45 s | 5/5 |
| `mus_credits` | Credits | Greensleeves | Full processional | 32 bars | Loop | 3/5 |
| `mus_march_alt` | Teaser / menu alternate / invader parade | Invader | Soviet march, full band | 32 bars | Loop | 4/5 |

**Minimum shippable set (P1):** `mus_title`, `mus_prologue`, `mus_dinner`, `mus_office`, `mus_abduction`, `mus_alert`, `mus_chase`, `mus_puzzle`, `mus_lion_boss`, `mus_sports`, `mus_finale`, `mus_credits`. The rest may land after the freeze.

## Composer families (parallel)

| Family | Cues | Theme | Suggested style cards |
|---|---|---|---|
| A — Memory / ceremony | `mus_prologue`, `mus_invitation`, `mus_dinner`, `mus_dinner_toast`, `mus_office`, `mus_credits` | Greensleeves | `symphony`, `viennese-waltz`, `piano`, `music-box`, `strings-harp` |
| B — Occupation / march | `mus_abduction`, `mus_alert`, `mus_patrol`, `mus_chase`, `mus_march_alt` | Invader | `soviet-march`, `ambient-drone`, custom chase |
| C — Boss / puzzle | `mus_lawn`, `mus_lion_boss`, `mus_lion_victory`, `mus_puzzle` | Mixed | `symphony`, `string-quartet`, `music-box`, custom boss |
| D — Hope / finale | `mus_title`, `mus_sports`, `mus_finale` | HKU-2030 | `symphony`, `strings-harp`, `organ-choir` |

Each family delivers **two takes per cue** and a `NOTES.md`. The owner auditions in `.scratch/music-2026-11-23/audition.html` (Task 13.3).

## Integration rules

- One music bus; crossfade on the bar where the tempo grid allows; duck −6 dB under dialogue; restore over 0.4 s.
- One-shots (`mus_invitation`, `mus_dinner_toast`, `mus_abduction`, `mus_lion_victory`, `mus_finale`) do not loop; the rest loop.
- The invader cues must never resolve to the campus theme’s tonic in a way that sounds triumphant — the invasion is not the player’s victory.
- The finale cue follows the **mesh** beat: four towers, tower-to-tower links, atrium ring. No single central impact.
- No cue may contain a recognisable quote from a copyrighted recording or the official anthem.

## Open creative decisions (owner)

1. Is the “HKU theme” the original HKU-2030 motif (recommended), or Greensleeves itself?
2. Which cue carries the Soviet march in the shipped game: `mus_march_alt` as a menu/teaser alternate, or also `mus_patrol` in-game?
3. Should the lion boss quote the campus theme in its final phrase (a “the campus wins” moment), or stay purely invader until the victory stinger?
