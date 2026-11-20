"""Generate adaptive music stems — pure stdlib. 6 layers, same key (A minor -> C major).
All stems share a common BPM grid so Codex can crossfade seamlessly.
"""
import sys, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from synth_lib import *

OUT = Path(__file__).resolve().parents[2] / 'assets' / 'audio' / 'story' / 'synth' / 'music'
OUT.mkdir(parents=True, exist_ok=True)
report = []

BPM = 72
BEAT = 60 / BPM
BAR = 4 * BEAT

NOTE = {  # A minor / C major shared pitch set (Hz)
 'A2':110, 'C3':130.81, 'D3':146.83, 'E3':164.81, 'F3':174.61, 'G3':196,
 'A3':220, 'B3':246.94, 'C4':261.63, 'D4':293.66, 'E4':329.63, 'F4':349.23,
 'G4':392, 'A4':440, 'B4':493.88, 'C5':523.25, 'D5':587.33, 'E5':659.25,
 'G5':783.99, 'A5':880,
}

def pad(freqs, total, gain=.12, detune=.003):
    """Sustained additive pad with slow amplitude breathe."""
    n = int(total * RATE); s = [0.0] * n
    for f in freqs:
        s = mix(s, sine(f * (1 + detune), n), gains=[1, 1][:2]) if False else s
        seg = sine(f * (1 + detune), n)
        for i, v in enumerate(seg): s[i] += v
        seg2 = sine(f * (1 - detune), n)
        for i, v in enumerate(seg2): s[i] += v * .7
    out = []
    for i, v in enumerate(s):
        breathe = .7 + .3 * math.sin(2 * math.pi * .12 * i / RATE)
        out.append(v * gain * breathe)
    return fade(out, .5, .5)

def pluck(freq, dur, gain=.2):
    n = int(dur * RATE)
    s = sine(freq, n)
    e = [math.exp(-i / (n * .18)) for i in range(n)]
    return [v * env * gain for v, env in zip(s, e)]

def bass(freq, dur, gain=.18):
    n = int(dur * RATE)
    return [v * gain for v in sine(freq, n)] + [0] * 0

def kick(at, track, gain=.3):
    n = int(.18 * RATE); s = sweep(140, 45, n)
    e = [math.exp(-i / (n * .28)) for i in range(n)]
    place(track, mul(s, e), at, gain)

def hat(at, track, gain=.08, seed=0):
    n = int(.06 * RATE); s = noise(n, seed, .4)
    e = [math.exp(-i / (n * .2)) for i in range(n)]
    place(track, mul(s, e), at, gain)

def clang(at, track, freq=520, gain=.12, seed=0):
    n = int(.35 * RATE)
    s = mix(sine(freq, n), scale(sine(freq * 1.41, n), .5), scale(noise(n, seed, .7), .3))
    e = [math.exp(-i / (n * .4)) for i in range(n)]
    place(track, mul(s, e), at, gain)

BARS = 8
TOTAL = BARS * BAR

print(f'== Music stems @ {BPM} BPM, {BARS} bars, A-minor/C-major ==')

# 1. mus_safe: bright pluck arpeggio + warm pad + soft hats
n = int(TOTAL * RATE); s = pad([NOTE['A3'], NOTE['C4'], NOTE['E4']], TOTAL, gain=.05)
arp = ['A3','C4','E4','A4','E4','C4','A3','E3']
for bar in range(BARS):
    for k, name in enumerate(arp):
        place(s, pluck(NOTE[name], BEAT * .9, .13), bar * BAR + k * BEAT)
for bar in range(BARS):
    for k in range(4):
        hat(bar * BAR + k * BEAT + BEAT / 2, s, seed=bar * 4 + k)
s = loopify(normalize(scale(s, .5)), .05)
p = write_wav(OUT / 'mus_safe.wav', s); report.append(('mus_safe', stats(p), 'bright academic arpeggio + pad'))

# 2. mus_unease: low drone + detuned harmonics + sparse pulses
s = pad([NOTE['A2'], NOTE['E3']], TOTAL, gain=.09, detune=.008)
for bar in range(BARS):
    place(s, scale(sine(NOTE['A2'], int(BEAT * RATE)), .12), bar * BAR)
    place(s, scale(sine(NOTE['A2'] * 1.414, int(BEAT * .5 * RATE)), .05), bar * BAR + BEAT * 2.5)
s = loopify(normalize(scale(s, .5)), .05)
p = write_wav(OUT / 'mus_unease.wav', s); report.append(('mus_unease', stats(p), 'low drone + detuned unease'))

# 3. mus_tension: bass pulse + metallic hits + dissonant chord
s = pad([NOTE['A2'], NOTE['B3'], NOTE['E3']], TOTAL, gain=.06, detune=.012)
for bar in range(BARS):
    for k in range(4): kick(bar * BAR + k * BEAT, s, .16)
    clang(bar * BAR + BEAT * 1.5, s, 554, .1, seed=bar)
    clang(bar * BAR + BEAT * 3.5, s, 622, .08, seed=bar + 50)
s = loopify(normalize(scale(s, .5)), .05)
p = write_wav(OUT / 'mus_tension.wav', s); report.append(('mus_tension', stats(p), 'alert: bass pulse + metal'))

# 4. mus_chase: fast bass + driving hats + rising siren motif (double-time feel)
CHASE_BEAT = BEAT / 2
s = [0.0] * n
chord = ['A2','A2','C3','A2','F3','F3','G3','E3']
for step in range(BARS * 16):
    t = step * CHASE_BEAT / 2
    place(s, scale(note(NOTE[chord[step % 8]], CHASE_BEAT * .8, 'saw', .002, .1), .1), t)
    if step % 2 == 0: kick(t, s, .13)
    hat(t + CHASE_BEAT / 2, s, .06, seed=step)
for bar in range(BARS):
    place(s, scale(sweep(440, 880, BEAT * 1.5), .06), bar * BAR + BEAT * 3)
s = loopify(normalize(scale(s, .5)), .05)
p = write_wav(OUT / 'mus_chase.wav', s); report.append(('mus_chase', stats(p), 'chase: driving bass + siren'))

# 5. mus_boss: heavy impacts + brass-like stabs + low choir pad
s = pad([NOTE['A2'], NOTE['C3'], NOTE['E3'], NOTE['G3']], TOTAL, gain=.07, detune=.01)
for bar in range(BARS):
    kick(bar * BAR, s, .32); kick(bar * BAR + BEAT * 2, s, .26)
    for k in range(4):
        place(s, scale(note(NOTE['A3'], BEAT * .7, 'saw', .01, .2), .12), bar * BAR + k * BEAT)
    clang(bar * BAR + BEAT * 3.5, s, 370, .16, seed=bar + 200)
s = loopify(normalize(scale(s, .5)), .05)
p = write_wav(OUT / 'mus_boss.wav', s); report.append(('mus_boss', stats(p), 'boss: heavy impacts + brass stabs'))

# 6. mus_hope: major-key arpeggio + bells, ascending resolution
s = pad([NOTE['C3'], NOTE['E3'], NOTE['G3'], NOTE['C4']], TOTAL, gain=.06)
major_arp = ['C4','E4','G4','C5','G4','E4','C4','G3']
for bar in range(BARS):
    for k, name in enumerate(major_arp):
        place(s, pluck(NOTE[name], BEAT * 1.2, .12), bar * BAR + k * BEAT)
    place(s, scale(note(NOTE['C5'], BEAT * 2, 'sine', .02, .9), .1), bar * BAR)
s = loopify(normalize(scale(s, .5)), .05)
p = write_wav(OUT / 'mus_hope.wav', s); report.append(('mus_hope', stats(p), 'hope: major arpeggio + bells'))

import json
(OUT.parent / 'music-report.json').write_text(json.dumps([{'id': a, 'stats': b, 'desc': c, 'bpm': BPM, 'bars': BARS, 'key': 'A-minor/C-major'} for a, b, c in report], indent=2, ensure_ascii=False))
for a, b, c in report: print(f'  {a:14s} {b["seconds"]:6.2f}s peak={b["peak"]:.3f} rms={b["rms"]:.3f}')
print(f'\nPASS {len(report)} music stems generated')
