# Which file carries the Greensleeves tune

Measured by `scripts/compare-greensleeves-sources.py`. Re-run it from the repo root; the numbers
below are its output.

## The table

| source | notes | eighths | motif | dotted `1.5+0.5` | anacrusis | first pitch | bars |
|---|---:|---:|---|---:|---:|---|---|
| `references/example-score.json` (stub) | 75 | 132 | exact at 0 | **0** | **0** | A (pc 9) | — |
| `v7-score-notation/score.json` | 75 | 97 | exact at **+3** | **9** | **1** | C (pc 0) | — |
| `v11-faithful-full-score/score.json` | 397 | 569 | 3 windows within 1 of 8, all at +8 | 36 | none | F (pc 5), then modulates | 92 |
| `family-a/mus_prologue/take-a` (ships) | 80 | 162 | exact at 0 | **0** | **0** | A (pc 9) | 32 |

The last column is the **first sounded pitch**, not the key. v11 opens on F and later moves to A
minor (`meter_spans` at bars 0 / 31 / 59), so reading its first note as its key is a local fact
presented as a global one — an earlier version of this table did exactly that.

`v7` and `v11` live in `~/.claude/skills/vibe-compose-onezion/experiments/2026-09-19-greensleeves-version-suite/`,
not in this repo. The stub is `~/.claude/skills/vibe-compose-onezion/references/example-score.json`.

## What each row means

**The stub and the take have zero dotted figures.** Greensleeves' signature is the dotted rhythm —
`1.5 + 0.5` in the first phrase, at `[79,1.5],[80,0.5]` in v7. The stub's ABC is
`A2 | c2 d2 | e2 f e | d2 B2 …`: every note is an integer number of eighths, so **this transcription
uses no dotted value anywhere**. (ABC notation itself expresses dotted values perfectly well — the
limit is this ABC, not the syntax.) Nine of them exist in v7. None survive into the stub, and so
none survive into the cue that ships. That is the defect the owner hears as "the beat is wrong" — not
a tempo error, a missing rhythm.

**v7 is the same tune, a minor third up.** 75 notes, matching the stub's 75 one for one, with the
motif exact at offset +3. So the stub is v7 transposed to A minor *with the rhythm flattened*. v7
declares `anacrusis: {"eighths": 1}` and says in its own words that v6's 2-eighth anacrusis "came
from the ABC's own barring" — an independent confirmation that the ABC's barring is the bad input.

**v11 does state the tune — eleven times, across four parts — and an earlier version of this page was
wrong to say it never does.** Its melody alone has three eight-note windows within one note of the
opening motif,
at pitched indices **18, 37 and 300**, all at the same offset **+8**; each is the same figure
`5 8 10 0 2 0 10 7` against the motif's `5 8 10 0 1 0 10 7` — one note altered, the fifth (D for
D♭). Three other parts carry it as well — `vln2a` at 0 and 19, `vlaa` at 0, 19, 215 and 234, `vca`
at 169 and 188 — so v11 states the theme **eleven times across four parts**. What v11 is *not*
is a plain statement of the tune: 397 melody notes against 75, 92 bars against 16, the theme quoted
inside a florid arrangement rather than presented. Calling that "never states the tune" read a
one-number summary — "nearest 1 of 8 wrong" — as a categorical fact about the whole piece. It is the
same error as generalising from a prefix, one level up.

**So v7 against v11 is a real choice, and it is about texture, not about which file holds the tune.**
v7 states it plainly in 75 notes with its dotted figures and its pickup intact, which is what a cue
carrying narration wants. v11 offers a full arrangement that quotes the theme eleven times inside 92
bars. Both are legitimate; this page recommends **v7**, because the prologue
bed has to let the melody be heard under a voice rather than compete with it.

## The remedy this implies

Re-cut from **`v7-score-notation/score.json`** — not from the stub, which has no rhythm to give, and
not from v11 unless a full arrangement is what is wanted:

- keep its 1-eighth anacrusis and its nine dotted figures;
- transpose if a different key is wanted — the tune's intervals survive transposition; the stub's
  flattening of them is what has to be undone, not the tune's own rhythm;
- its tempo is a `PLACEHOLDER` (`60, quarter`, "unmeasured"), so the tempo stays a stated choice, as
  v11's does.

## The two things this does not settle

1. **Which key the cues should be in.** v7 is C minor, the shipped takes are A minor, and the DSE
   product's version is the one the owner is comparing against. Nothing on this machine says what key
   the DSE product uses.
2. **Whether the shipped cues are worth re-cutting at all** rather than re-scoring only the ones with
   a melody line the player hears under dialogue. `mus_prologue` is the one that carries narration, so
   it is the one that must be right first.
