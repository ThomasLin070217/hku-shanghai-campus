"""Synth primitives — pure Python stdlib (wave, math, struct). No numpy/ffmpeg.
Shared helpers for the HKU Shanghai Campus audio deliverable.
"""
import math, struct, wave, random
from pathlib import Path

RATE = 22050          # 22.05 kHz mono 16-bit; adequate for game SFX and stems
PEAK_LIMIT = 0.891    # -1.0 dBFS

def mul(sig, envelope):
    """Element-wise multiply signal by an envelope of equal length."""
    return [v * e for v, e in zip(sig, envelope)]

def scale(sig, g):
    """Multiply every sample by a scalar gain (list * float is invalid in Python)."""
    return [v * g for v in sig]

def clamp(x, lo=-1.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x

def env_ad(n, attack, decay, curve=2.0):
    """Attack-decay envelope over n samples, returns list of floats 0..1."""
    a = max(1, int(attack * RATE)); d = max(1, n - a)
    return [clamp((i / a) ** curve) for i in range(a)] + \
           [clamp((1 - i / d) ** curve) for i in range(d)]

def env_adsr(n, a, d, s, r):
    """ADSR envelope with sustain level s (0..1)."""
    ai = max(1, int(a * RATE)); di = max(1, int(d * RATE)); ri = max(1, int(r * RATE))
    si = max(0, n - ai - di - ri)
    out = []
    out += [i / ai for i in range(ai)]
    out += [1 + (s - 1) * i / di for i in range(di)]
    out += [s] * si
    out += [s * (1 - i / ri) for i in range(ri)]
    if len(out) < n: out += [0] * (n - len(out))
    return out[:n]

def sine(freq, n, phase=0.0, vibrato=0.0, vib_rate=5.0):
    out = [0.0] * n
    ph = phase
    step = 2 * math.pi / RATE
    if vibrato:
        for i in range(n):
            f = freq * (1 + vibrato * math.sin(2 * math.pi * vib_rate * i / RATE))
            ph += f * step
            out[i] = math.sin(ph)
    else:
        s = math.sin; c = step * freq
        for i in range(n):
            out[i] = s(ph); ph += c
    return out

def saw(freq, n):
    out = [0.0] * n; inc = freq / RATE; p = 0.0
    for i in range(n):
        out[i] = 2 * p - 1; p += inc
        if p >= 1: p -= 1
    return out

def square(freq, n, duty=0.5):
    out = [0.0] * n; inc = freq / RATE; p = 0.0
    for i in range(n):
        out[i] = 1.0 if p < duty else -1.0; p += inc
        if p >= 1: p -= 1
    return out

def noise(n, seed=0, lowpass=0.0):
    rnd = random.Random(seed or 904)
    out = [0.0] * n; prev = 0.0
    a = lowpass
    for i in range(n):
        v = rnd.uniform(-1, 1)
        if a:
            prev = prev * a + v * (1 - a); v = prev
        out[i] = v
    return out

def sweep(f0, f1, n, shape='linear'):
    """Frequency sweep. n is sample count; if < 100 it is treated as seconds."""
    if n < 100: n = int(n * RATE)
    out = [0.0] * n; ph = 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * (t if shape == 'linear' else t * t)
        ph += 2 * math.pi * f / RATE
        out[i] = math.sin(ph)
    return out

def mix(*signals, gains=None):
    n = max(len(s) for s in signals)
    out = [0.0] * n
    gs = gains or [1.0] * len(signals)
    for s, g in zip(signals, gs):
        for i, v in enumerate(s): out[i] += v * g
    return out

def lowpass(sig, a):
    out = [0.0] * len(sig); p = 0.0
    for i, v in enumerate(sig): p = p * a + v * (1 - a); out[i] = p
    return out

def highpass(sig, a):
    lp = lowpass(sig, a)
    return [v - l for v, l in zip(sig, lp)]

def fade(sig, fin=0.01, fout=0.03):
    n = len(sig); ai = int(fin * RATE); oi = int(fout * RATE)
    out = sig[:]
    for i in range(ai): out[i] *= i / max(1, ai)
    for i in range(oi): out[n - 1 - i] *= i / max(1, oi)
    return out

def normalize(sig, peak=PEAK_LIMIT):
    m = max((abs(v) for v in sig), default=0.0)
    if m < 1e-9: return sig[:]
    k = peak / m
    return [clamp(v * k) for v in sig]

def loopify(sig, cross=0.05):
    """Make a seamless loop by crossfading the tail into the head."""
    n = len(sig); c = int(cross * RATE)
    if c >= n // 4: return fade(sig)
    head = sig[:c]; tail = sig[-c:]
    body = sig[c:-c]
    blended = [tail[i] * (1 - i / c) + head[i] * (i / c) for i in range(c)]
    out = body + blended
    return normalize(out)

def note(freq, dur, kind='sine', attack=0.005, release=0.08, vibrato=0.0):
    n = int(dur * RATE)
    gen = {'sine': sine, 'saw': saw, 'square': square}[kind]
    s = gen(freq, n, vibrato=vibrato) if kind == 'sine' else gen(freq, n)
    e = env_ad(n, attack, release, curve=1.4)
    return [v * env for v, env in zip(s, e)]

def note_n(freq, dur, harmonics=(1.0,), kind='sine', attack=0.005, release=0.1):
    """Additive note with harmonic multipliers and weights."""
    n = int(dur * RATE); gen = {'sine': sine, 'saw': saw, 'square': square}[kind]
    parts = []
    for h, w in harmonics:
        seg = gen(freq * h, n, vibrato=vibrato) if kind == 'sine' else gen(freq * h, n)
        parts.append((seg, w))
    s = mix(*[p for p, _ in parts], gains=[w for _, w in parts])
    e = env_ad(n, attack, release, curve=1.4)
    return [v * env for v, env in zip(s, e)]

def place(track, sig, at_sec, gain=1.0):
    """Overlay sig into track at time offset (seconds)."""
    start = int(at_sec * RATE)
    for i, v in enumerate(sig):
        if start + i >= len(track): break
        track[start + i] += v * gain
    return track

def write_wav(path, sig, rate=RATE):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        frames = bytearray()
        for v in sig:
            frames += struct.pack('<h', int(clamp(v) * 32767))
        w.writeframes(bytes(frames))
    return path

def stats(path):
    with wave.open(str(path), 'rb') as w:
        n = w.getnframes(); data = w.readframes(n)
    import array
    a = array.array('h'); a.frombytes(data)
    peak = max((abs(x) for x in a), default=0) / 32768
    rms = math.sqrt(sum(x * x for x in a) / max(1, len(a))) / 32768
    return dict(seconds=round(n / RATE, 3), peak=round(peak, 4), rms=round(rms, 4))
