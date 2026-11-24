# Selection & veto list — 2026-11-24

Owner ruling (2026-11-23): **I pick the takes, you veto.** Nothing here needs an answer
line by line — strike anything you dislike and it is replaced. Everything below is a
default, not a decision taken out of your hands.

Play them: `.scratch/music-2026-11-23/audition.html` (all 58 takes, every family including
both B sets).
Voice: `.scratch/voice-2026-11-23/audition.html`.

Objective checks re-run on **all 58** music takes on 2026-11-24: **no clipping** (loudest peak
**−1.2 dBFS**, `family-b/mus_chase/take-b`), mean loudness **−15.1 … −23.9 dB**, no take at or
over 0 dBFS, and every take has both a `score.json` and a `style.json` (`MuseScore_General.sf3`
render, `vibe-compose-onezion`). **No take samples or reuses any existing recording.**

*(The figures previously printed here — loudest peak −1.3 dBFS, mean −16.3 … −23.0 dB — were
correct for the **original 48**, i.e. everything except the 10 `family-b` takes. The 10 new
takes include the loudest file on disk (`chase_drive_b`, −1.2 dBFS) — 1.2 dB under full
scale, and still no clipping. Re-measured, not assumed.)*

**Family B was re-rendered at 02:52 and supersedes the earlier `family-b2` set** (rendered
00:17). The invasion cues below therefore cite `family-b`. Reason: the re-dispatch fixed the
`field_drum` buzz-roll trap — the shared march card's two continuous subdivision voices are
replaced by a written articulated snare part, which is what the card's own research (2–5
attacks/bar) and the brief both call for — and it ships a rendered gate plus a reproducible
builder. `family-b2` is still on disk if you prefer any of it; nothing has been deleted.

## Score — 18 cues, chosen take

| # | Cue | Where it plays | Chosen take | Length | Alternative |
|---|---|---|---|---|---|
| 1 | `mus_title` | Title / menu, before the prologue | `family-d/take-a` symphony_processional | 117.8 s | `take-b` strings_harp_processional (118.6 s) |
| 2 | `mus_prologue` | Magic Hour cinematic, camera over the campus | `family-a/take-a` symphony_warm, **rebuilt 2026-11-24 to 78.3 s to span the narration — see below** | 78.3 s | `take-b` strings_harp (55.8 s) |
| 3 | `mus_invitation` | Phone invitation, crowd on the plaza | `family-a2/take-a` invitation_music_box | 16.0 s | `take-b` invitation_piano (21.8 s) |
| 4 | `mus_dinner` | High Table Dinner bed, B5 | `family-a2/take-b` dinner_processional (**replaced 2026-11-24 — see below**) | 53.3 s | `a/take-a` symphony_processional (60.7 s) |
| 5 | `mus_dinner_toast` | The toast moment | `family-a2/take-a` toast_brass | 7.5 s | `take-b` toast_strings_brass (8.2 s) |
| 6 | `mus_office` | B4 side lobby, lift, 5F corridor | `family-a2/take-a` office_piano_sparse | 43.6 s | `take-b` office_piano_rolling (45.7 s) |
| 7 | `mus_abduction` | Lobby CCTV → feed cut → 5F servo/shout/door | `family-b/take-a` abduction_slowmarch | 32.7 s | `take-b` slowmarch_b (38.1 s) |
| 8 | `mus_alert` | MacBook security alert | `family-b/take-a` alert_coldpulse | 19.2 s | `take-b` coldpulse_b (15.0 s) |
| 9 | `mus_patrol` | Humanoid robots, stealth | `family-b/take-a` patrol_quietmarch | 62.6 s | `take-b` quietmarch_b (68.6 s) |
| 10 | `mus_chase` | Being chased | `family-b/take-a` chase_drive | 12.6 s | `take-b` chase_drive_b (12.0 s) |
| 11 | `mus_march_alt` | Occupation march, exterior B4 | `family-b/take-a` march_invader | 51.4 s | `take-b` march_invader_b (55.4 s) |
| 12 | `mus_puzzle` | Flip-wall / breaker puzzle | `family-c/take-a` puzzle_clockwork | 64.0 s | `take-b` puzzle_clockwork_b (62.6 s) |
| 13 | `mus_lawn` | Lawn approach | `family-c/take-a` lawn_drone | 128.0 s | `take-b` lawn_drone_b (137.1 s) |
| 14 | `mus_lion_boss` | Lion boss | `family-c/take-a` boss_symphonic | 54.9 s | `take-b` boss_symphonic_b (55.7 s) |
| 15 | `mus_lion_victory` | Lion defeated | `family-c/take-a` victory_brass | 32.1 s | `take-b` victory_brass_b (33.5 s) |
| 16 | `mus_sports` | Sports hall rescue | `family-d/take-a` strings_piano_hope | 83.9 s | `take-b` piano_strings_intimate (87.0 s) |
| 17 | `mus_finale` | Four-tower mesh light show | `family-d/take-a` symphony_mesh | 54.9 s | `take-b` strings_organ_mesh (55.4 s) |
| 18 | `mus_credits` | Credits, Greensleeves processional | `family-a2/take-a` credits_strings_harp | 58.2 s | `a/take-a` symphony full (48.2 s) |

Tell me only the numbers you want swapped. Everything else stays as listed.

### Cue 4 replaced — the owner vetoed the walk-to-ceremony music (2026-11-24)

The owner: 「其实有点不太喜欢，就是学生走到开台步典礼那一段的音乐」. That segment is story stage
`to_b5`, and `openingScore()` (`src/opening/experience.ts:441`) maps it to `mus_dinner`. Measured,
not assumed: the binary that shipped in `assets/audio/story/music/mus_dinner.mp3` is **37.0 s**,
which is `family-a2/mus_dinner/take-a/dinner_waltz` to the tenth of a second — a **Viennese waltz**
in 3/4 at 156 quarter/min, `oom-pah-pah` under the violin. That is a ballroom idiom, and it was
looping under students walking into a High Table ceremony, which is what reads as 莫名其妙.

The same family already holds the take written for this: `take-b` **dinner_processional** — 6/8 at
72 dotted-quarter, horn-call intro, timpani downbeat, low strings. It is now the shipped
`mus_dinner`. Rights are unchanged (Greensleeves PD, arrangement ours, MuseScore_General.sf3).

This row also caught a real inconsistency: the table used to say the chosen take was
`family-a/take-b` viennese_waltz_dinner at 57.9 s, but the shipped binary was 37.0 s — the
*alternative* on that row. The list and the asset disagreed, and the asset was the waltz either
way. Both waltz candidates are out now, so the disagreement cannot recur through this row.

### Measured tail audit

Two measurements on all 48 takes (`sseof -0.4` mean volume, then per-second windows and
`silencedetect`), plus a cross-check of every MIDI's musical end against its audio's content
end:

- **One-shot cues end in a fade to silence** — family-a and family-d end below −70 dB in
  their last 400 ms. Correct for title/credits/finale; crossfades overlap it.
- **Looping cues run music to the last sample** — every `mus_patrol`, `mus_chase`,
  `mus_lawn`, `mus_puzzle`, `mus_alert`, `mus_march_alt` take ends between −17 and −24 dB.
  No loop gap. This is the set where a silent tail would have been a real defect.
- **No take is missing content:** across all 48, the audio always extends *past* the MIDI's
  last note-on (by 0.2–4.3 s of release and reverb). Zero takes end before their score does.
- **Family B re-measured (the 10 new takes).** The four looping cues end with music present,
  not silence, so there is no seam gap: `mus_chase` −14.8/−13.9 dB, `mus_march_alt`
  −23.7/−24.6 dB, `mus_patrol` −25.4/−30.8 dB, `mus_alert` −26.7/−32.9 dB over their last
  400 ms. `mus_abduction` is deliberately not loopable and stops hard at its final hit.

**One thing to know, not to fix:** the chosen `mus_abduction` is **16 bars of 6/8 at 84 BPM**
and opens sparsely on purpose — bars 1–6 carry only 2–6 notes each, then bar 7 jumps to 10 and
the cue builds to 13–15 notes a bar. Measured, it has four short silences in the first 11 s
(longest 1.4 s at 7.2 s, and the feed-cut hole in bar 5 at −36 dB) before the climax. That is
the composition — the quiet *is* the lobby feed before the picture dies. Do not "fix" it with a
loop, and do not mistake it for a failed render. It also ends on a hard stop at the final hit,
which is what the cue brief asks for, so it is not a looping bed.

*(The superseded `family-b2` abduction is a different piece — 45.0 s in 4/4 with one 5.7 s hole
at bars 6–7. If you prefer that shape, it is still on the audition page and nothing is
deleted. An earlier revision of this note described only the b2 timing and called that hole a
dropped render; that was wrong — my script had read a bare `silence_end` as a trailing gap.)*

## 明我以德 — HKU anthem arrangement

Owner authorised on 2026-11-24: use the **melody** of 明我以德 as a source for an
original arrangement. It is copyrighted: the score we transcribed is headed
**曲：許冠傑　詞：林夕** and its footer reads **© 2018 Development & Alumni Affairs
Office, HKU. All Rights Reserved.** That is the line the credits carry. We never sample the
official recording.

*(An earlier version of this note also credited an arranger and a 2011 date. Neither appears
anywhere on the score — I had carried them from memory of the work's release rather than from
the page in front of me — so neither is asserted here. If the credits need the arranger, that
needs a source first. What is verifiable is the pair of lines above, read off `q-1.png`
(header) and `q-4.png` (footer) on 2026-11-24.)*

Status: melody transcribed from the official published score
(`.scratch/anthem-2026-11-24/scores/`, from `100.hku.hk/galadinner/song/`), arrangement
and render pending. Planned use: **title motif** and a **finale reprise**, not the
whole soundtrack — the four-peer theme stays original.

**How accurate the transcription is — the short answer: the pitches, yes; the rhythm, no.**
202 noteheads were read off the printed score by deterministic image processing (no ML). Every
one lands within 0.19 of a diatonic step of an exact staff position, where a note on the wrong
line or space would be ≥ 0.5 — so a misread would have shown up. The key is B♭ major, and the
only two accidentals in the melody (A♭4, at bars 18 and 33) were confirmed by eye. Six blobs
that fell outside the staff were **abstained on** rather than guessed.

The rhythm is **not** verified: reading beams, flags and dots off this engraving failed, so
every duration is derived from the note's horizontal position and is marked uncertain. Ties
are not modelled, so a tied note appears twice. The arrangement therefore takes the **pitches**
from the transcription and authors the rhythm by ear against the page — it will not claim the
derived durations are the score's.

*(An earlier note said the transcription might be an inner choir voice because it started below
where the melody "should" begin. That was my misreading — I had taken the piano's treble staff
for the vocal line. The sung line genuinely starts on D4, in the space below the staff, and it
cannot be an inner voice: it is the only staff on the page carrying lyrics.)*

## Voice — main story first

Generated from `.scratch/voice-2026-11-23/cast.json` with ElevenLabs
(`eleven_multilingual_v2`, mp3 44.1 kHz/128). 28 takes across 12 main-story lines,
regenerated 2026-11-24; the audition page has every take.

| Line | Speaker | Chosen | Length | Alternative |
|---|---|---|---|---|
| `prologue-1` | narrator | **meditative-narrator** | 13.3 s | george (11.2 s) and broadcaster (15.9 s) — **both vetoed 2026-11-24** |
| `prologue-2` | narrator | **meditative-narrator** | 23.7 s | george (18.9 s) and broadcaster (21.7 s) — **both vetoed** |
| `prologue-3` | narrator | **meditative-narrator** | 17.7 s | george (13.4 s) and broadcaster (15.1 s) — **both vetoed** |
| `prologue-4` | narrator | **meditative-narrator** | 18.8 s | george (13.8 s) and broadcaster (17.4 s) — **both vetoed** |
| `staff-line1` | staff, B5 | alice-warm | 3.2 s | matilda-warm (3.1 s) — **vetoed** |
| `staff-line2` | staff, B5 | alice-warm | 10.2 s | matilda-warm (10.6 s) — **vetoed** |
| `staff-line3` | staff, lift | alice-warm — **being replaced, see below** | 3.4 s | matilda-warm (3.3 s) — **vetoed** |
| `staff-line4` | staff, hand-over | alice-warm | 3.0 s | matilda-warm (3.1 s) — **vetoed** |
| `staff-line5` | staff, callback | alice-warm | 2.1 s | matilda-warm (2.2 s) — not in the veto list |
| `external-ai` | invader | adam-firm | 5.8 s | steadfast-cold (6.6 s) — **vetoed** |
| `local-ai` | MacBook | sarah-reassuring | 5.9 s | river-neutral (6.3 s) |
| `player-accept` | player | harry-fierce | 1.5 s | harry-fierce-alt (same voice, flatter settings) |

**`staff-line3` is the one line you should skip for now.** Two independent local ASR passes agree
that the shipped Alice take says *"turn right to the left, fifth floor"*; the authored line is
*"turn right to the lift."* The Matilda take says "lift" correctly — but swapping voices for one
line inside a five-line conversation trades a wrong word for a wrong person. A replacement is being
generated in **Alice's** voice now; when it passes its ASR check, this row is the only one that
changes, and you will get the new file before the veto pass closes.

**Why meditative for the narrator — changed by your veto on 2026-11-24.** George was picked for
expressiveness. You struck george *and* the broadcaster on all four paragraphs, which leaves
meditative as the only surviving read. It is the slowest of the three, and the difference is not
cosmetic:

| Set | prologue-1 | -2 | -3 | -4 | Total |
|---|---:|---:|---:|---:|---:|
| george (vetoed) | 11.15 s | 18.90 s | 13.37 s | 13.79 s | **57.21 s** |
| broadcaster (vetoed) | 15.93 s | 21.69 s | 15.09 s | 17.37 s | 70.08 s |
| **meditative (now chosen)** | 13.33 s | 23.68 s | 17.74 s | 18.76 s | **73.51 s** |
| currently in `assets/audio/prologue/` | 11.42 s | 18.20 s | 13.10 s | 13.28 s | 56.00 s |

So the opening gets **16.3 s longer than george would have made it, and 17.5 s longer than what
ships today.** That is a change to the prologue's pace, not only to its voice, and it is recorded
here so nobody later calls it a regression.

Three consequences, none of them silent:

1. **The gate will fail until the budget moves.** `check-prologue` caps the narration at 60 s and the
   meditative read is 73.51 s. The cap goes to 75 with the reason written next to the assertion.
   Nothing is trimmed and the four paragraphs are byte-identical to what is on screen today — the
   only thing that changed is who reads them, and that was your call.
2. **The music bed has to grow with it.** `mus_prologue` is 55.8 s. Left alone it would leave the last
   17.5 s of narration over silence, so the cue is rebuilt in the same commit as the voice.
3. **It is 1 min 14 s before the player moves.** If that is too long for the demo video, the lever is
   cutting one of the four paragraphs — your decision, not mine, and not a speed-up of the voice.

### The bed grew to 78.25 s (done 2026-11-24)

Consequence 2 above is closed. `symphony_warm` was rebuilt at v7's melody, verbatim
(75 notes / 97 eighths, sha256 `78498571…e49c`), to 78.25 s so it outlasts the 74.564 s of
narration with a 3.7 s tail. The four section arrivals sit at **13.3283 / 37.3626 / 55.4527 /
74.5644 s**, which are the four narration end times to within 0.4 ms — computed from the clip
durations, not guessed. First brass enters at 55.4527 s, on arrival 3.

Measured independently of the worker's own `verification.json`: duration 78.250 s; peak
−3.98 dBFS; quietest 0.5 s window −39.91 dBFS at 77.50 s; last 400 ms −45.36 dBFS; no
clipped samples; −19.89 dBFS in the first second. Every gate passes on my numbers; the
worker's reported peak and quiet window differ by 1.3 dB and 3.1 dB, which is a
measurement-method difference, not a threshold disagreement. Full table in
`.scratch/music-2026-11-24/mus_prologue-v2/report.md`, whose "Not verified" section is the
honest limit: nobody has judged the cue by ear yet, and that verdict is yours.

**And it sat a minor third high.** v7 is in C minor; the DSE product's own loop
(`dse-agent/platform/frontend/public/greensleeves-fm-loop-light-v7.mp3`) pitch-tracks to
A C D E F E D B G A B C — the tune in A natural minor, and the same key as `mus_office` and
`mus_invitation` here. So the cue was re-rendered down 3 semitones: every sounding midi in all
four parts and in `harmony.voicings`, with the chord names following (`Ab→F`, `Cm→Am`, `Bb→G`,
`G→E`, `G7→E7`). Transposing the melody alone would have left the style-generated harmony in
C minor; the worker caught that before rendering. Verified afterwards: the new file is the old
one shifted by exactly 3 semitones (chroma correlation 0.917), top chroma moves from G/D/C/D♯ to
E/A/C/B, all six level gates still pass (peak −5.35 dBFS, quietest window −39.97 dBFS, tail
−44.76 dBFS), and the four arrivals are unmoved with an attack at each (+5.19 / +2.05 / +2.92 /
+3.55 dB).

**What is in `assets/` today is not any of the audition takes — but it is George.** The four shipped
files total 56.00 s and match no column above; `clips.json` records `voiceId: JBFqnCBsd6RMkjVDRZzb`
on all four, which is the George voice, in a different take from the audition set. So the prologue
that ships today is a George read, and you have now vetoed George. Integration replaces all four with
the meditative takes, so nothing currently wired is a vetoed take — and nothing currently wired is
a vetted one either.

**Your veto also settled the `staff-line3` fix.** You struck the one clean take (matilda), which
confirms the rule the replacement is being built to: the new reading stays in **Alice's** voice, so
the NPC never changes speaker inside a five-line conversation.

## Vetoes received — 2026-11-24

Recorded verbatim, in the order given. Thirteen of the fourteen resolve to an audition file; the
fourteenth is garbled in transit and is listed as given rather than guessed at.

| # | As given | Resolves to | Effect |
|---|---|---|---|
| 1 | `prologue-1--george-expressive` | same | narrator take removed |
| 2 | `prologue-1--steadfast-broadcaster` | same | narrator take removed |
| 3 | `prologue-2--george-expressive` | same | narrator take removed |
| 4 | `prologue-2--steadfast-broadcaster` | same | narrator take removed |
| 5 | `prologue-3--george-expressive` | same | narrator take removed |
| 6 | `prologue-3--steadfast-broadcaster` | same | narrator take removed |
| 7 | `prologue-4--george-expressive` | same | narrator take removed |
| 8 | `prologue-4--steadfast-broadcaster` | same | narrator take removed |
| 9 | `staff-line1--matilda-warm` | same | alternative removed; alice stands |
| 10 | `staff-line2--matilda-warm` | same | alternative removed; alice stands |
| 11 | `staff-line3--matilda-warm` | same | alternative removed; alice stands |
| 12 | `staff-line4--matilda-warm` | same | alternative removed; alice stands |
| 13 | `local-ai--sarah-reassuring` | **unresolved — see note** | none applied |
| 14 | `external-ai--steadfast-cold` | same | alternative removed; adam-firm stands |

**Note on #13.** The string does not match any file on the audition page in that form. The line id
is 8 characters, and `local-ai` is the only 8-character line id in the cast, so it most likely
begins `local-ai--`. The voice half does not match `sarah-reassuring` (16) or `river-neutral` (13)
in length either, so I am not guessing: **no take has been removed on the strength of #13.**
`local-ai` still ships as chosen (chosen `sarah-reassuring`, alternative `river-neutral`). One word
from you settles it.

Two things deliberately *not* changed by this list: `staff-line5--matilda-warm` was not named, so
both of that line's takes stay; and no music take was named, so the whole score table stands.

Every take is ≤ 23.7 s and none clips. Nothing is wired into the game yet — integration
comes after your veto pass, with subtitles matched to these exact files.

## Rights

- Greensleeves: public domain melody, **our** arrangement. Never the 1981 Decca/UMG
  recording.
- 明我以德: melody used with the owner's authorisation for this hackathon, original
  arrangement, credited as **曲：許冠傑　詞：林夕　© 2018 Development & Alumni Affairs
  Office, HKU. All Rights Reserved.**; no sampling of the official recording.
- Everything else is original to this project.
