#!/usr/bin/env python3
"""Which file actually carries the Greensleeves tune?

The owner hears the shipped cues as "close but not the same" tune as the DSE
product. This prints, for each candidate source: the tune's first phrase in
pitch classes, its durations, whether the signature dotted figure (1.5 + 0.5
eighths) is present, the anacrusis each source declares, and its key.

Sources
  stub  references/example-score.json              — what every shipped cue was cut from
  v7    v7-score-notation/score.json               — the tune, renotated by hand
  v11   v11-faithful-full-score/score.json         — the full 92-bar arrangement
  take  family-a/mus_prologue/take-a/score.json    — what ships today

Run with `python3 -I scripts/compare-greensleeves-sources.py` from the repo root.
"""
import glob, json, os, re, sys

SKILL = os.path.expanduser('~/.claude/skills/vibe-compose-onezion')
SUITE = os.path.join(SKILL, 'experiments/2026-09-19-greensleeves-version-suite')
MOTIF = [9, 0, 2, 4, 5, 4, 2, 11]          # A C D E F E D B — Greene's opening
DOTTED = [(3, 1), (1, 3)]                   # 1.5:0.5 in half-eighths, either order

def abc_events(path):
    body = json.load(open(path))['provenance']['compiled_from']['abc'].split('K:Am', 1)[1]
    pc = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
    out = []
    for tok in re.findall(r"\^?[A-Ga-g][,']*[0-9]*", body):
        d = ''.join(c for c in tok if c.isdigit())
        out.append((pc[tok.lstrip('^')[0].lower()], int(d) if d else 1))
    return out, None

def score_events(path):
    j = json.load(open(path))
    ev = j['parts']['melody']['events']
    if ev and isinstance(ev[0], dict):
        ev = [(e.get('midi'), e.get('eighths')) for e in ev]
    out = []
    for e in ev:
        p, d = e[0], e[1]
        if isinstance(p, list):          # a chord event: take the top voice
            p = max(p)
        out.append((p, d))
    meta = {
        'bars': j.get('bars'),
        'anacrusis': (j.get('anacrusis') or {}).get('eighths', j.get('anacrusis_eighths')),
        'tempo': j.get('tempo_map'),
        'spans': [s['bar_zero_based'] for s in (j.get('meter_spans') or [])],
        # The first sounded pitch, NOT the key. v11 opens on F and later
        # modulates to A minor, so calling this "keynote" read a local fact as a
        # global one; the earlier table did exactly that.
        'first_pitch': next((p for p, _ in out if p is not None), None),
    }
    return out, meta

def analyse(label, events, meta):
    pitched = [(p, d) for p, d in events if p is not None]
    pcs = [p % 12 for p, _ in pitched]
    hits = [i for i in range(len(pcs) - len(MOTIF) + 1) if pcs[i:i + len(MOTIF)] == MOTIF]
    # transposition-invariant: search every offset, report the best
    best = (99, None, None)
    near = []
    for off in range(12):
        m = [(x + off) % 12 for x in MOTIF]
        for i in range(len(pcs) - len(m) + 1):
            d = sum(1 for a, b in zip(pcs[i:i + len(m)], m) if a != b)
            if d < best[0]: best = (d, i, off)
            # Report the near matches too, not only the single best one. An
            # earlier draft of the analysis read "nearest 1 of 8 wrong" as "the
            # tune is absent", when three separate windows are within one note:
            # a florid arrangement quoting the theme, not a piece that lacks it.
            if d <= 1: near.append((i, off, d))
    dotted = sum(1 for i in range(len(pitched) - 1)
                 if (round(pitched[i][1] * 2), round(pitched[i + 1][1] * 2)) in DOTTED)
    print('%-6s %d notes, %d eighths' % (label, len(pitched), sum(d for _, d in pitched)))
    print('       first 12 pcs    ', ' '.join(str(x) for x in pcs[:12]))
    print('       first 12 durs   ', ' '.join('%g' % d for _, d in pitched[:12]))
    print('       exact motif at  ', hits or 'not present')
    print('       nearest match    %d of 8 notes differ (index %d, offset %+d)' % best)
    print('       within 1 of 8    %d windows %s' % (
        len(near), [(i, '%+d' % off) for i, off, _ in near[:4]] or ''))
    print('       dotted 1.5+0.5   %d occurrences' % dotted)
    if meta:
        print('       bars %s, anacrusis %s, first-pitch pc %s' % (
            meta['bars'], meta['anacrusis'], None if meta['first_pitch'] is None else meta['first_pitch'] % 12))
        if meta['spans']: print('       metre spans at  ', meta['spans'])
    print()

print('=== sources of the tune ===\n')
analyse('stub', *abc_events(os.path.join(SKILL, 'references/example-score.json')))
analyse('v7', *score_events(os.path.join(SUITE, 'v7-score-notation/score.json')))
analyse('v11', *score_events(os.path.join(SUITE, 'v11-faithful-full-score/score.json')))
root = os.path.dirname(os.path.abspath(__file__))
pattern = os.path.join(root, '..', '.scratch/music-2026-11-23/family-a*/mus_prologue/take-a/score.json')
takes = sorted(glob.glob(pattern))
if not takes:
    print('!! no takes found under %s' % pattern)
    print('!! the take rows are the point of this script; an empty list is a failure, not a clean run')
for f in takes:
    # Label by family. family-a and family-a2 are different melodic lines and both
    # have a take-a for this cue, so an unlabelled "take" row is ambiguous — and an
    # earlier version's CWD-relative glob silently reported only family-a.
    analyse(f.split(os.sep)[-4], *score_events(f))
