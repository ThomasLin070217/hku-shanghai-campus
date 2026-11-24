# Which file carries the Greensleeves tune

Measured by `scripts/compare-greensleeves-sources.py`. Re-run it from the repo root; the numbers
below are its output.

## The table

| source | notes | eighths | motif | dotted `1.5+0.5` | anacrusis | keynote | bars |
|---|---:|---:|---|---:|---:|---|---|
| `references/example-score.json` (stub) | 75 | 132 | exact at 0 | **0** | **0** | A (pc 9) | — |
| `v7-score-notation/score.json` | 75 | 97 | exact at **+3** | **9** | **1** | **C** (pc 0) | — |
| `v11-faithful-full-score/score.json` | 397 | 569 | nearest 1 of 8 differ | 36 | none | F (pc 5) | 92 |
| `family-a/mus_prologue/take-a` (ships) | 80 | 162 | exact at 0 | **0** | **0** | A (pc 9) | 32 |

`v7` and `v11` live in `~/.claude/skills/vibe-compose-onezion/experiments/2026-09-19-greensleeves-version-suite/`,
not in this repo. The stub is `~/.claude/skills/vibe-compose-onezion/references/example-score.json`.

## What each row means

**The stub and the take have zero dotted figures.** Greensleeves' signature is the dotted rhythm —
`1.5 + 0.5` in the first phrase, at `[79,1.5],[80,0.5]` in v7. The stub's ABC is
`A2 | c2 d2 | e2 f e | d2 B2 …`: every note is an integer number of eighths, so **the transcription
cannot express a dotted figure at all**. Nine of them exist in v7. None survive into the stub, and so
none survive into the cue that ships. That is the defect the owner hears as "the beat is wrong" — not
a tempo error, a missing rhythm.

**v7 is the same tune, a minor third up.** 75 notes, matching the stub's 75 one for one, with the
motif exact at offset +3. So the stub is v7 transposed to A minor *with the rhythm flattened*. v7
declares `anacrusis: {"eighths": 1}` and says in its own words that v6's 2-eighth anacrusis "came
from the ABC's own barring" — an independent confirmation that the ABC's barring is the bad input.

**v11 is not the tune.** 397 melody notes against 75; nearest approach to the motif is one note wrong
in eight; keynote F against A or C; 92 bars against the tune's 16. v11 is Tamura's full *Fantasia*
arrangement — the source the ledger cites as the faithful remedy — and its melody line is a florid
line that never states the tune. **It cannot be the source for a Greensleeves cue.**

## The remedy this implies

Re-cut from **`v7-score-notation/score.json`**, not from the stub and not from v11:

- keep its 1-eighth anacrusis and its dotted figures;
- transpose if a different key is wanted — the tune's intervals survive transposition, its rhythm
  does not survive the ABC;
- its tempo is a `PLACEHOLDER` (`60, quarter`, "unmeasured"), so the tempo stays a stated choice, as
  v11's does.

## The two things this does not settle

1. **Which key the cues should be in.** v7 is C minor, the shipped takes are A minor, and the DSE
   product's version is the one the owner is comparing against. Nothing on this machine says what key
   the DSE product uses.
2. **Whether the shipped cues are worth re-cutting at all** rather than re-scoring only the ones with
   a melody line the player hears under dialogue. `mus_prologue` is the one that carries narration, so
   it is the one that must be right first.
