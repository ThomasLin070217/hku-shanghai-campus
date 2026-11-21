#!/usr/bin/env python3
"""Normalise the local Piper player acceptance line for the game.

The raw file is produced offline with Piper (en_US-ryan-high, a CC BY-NC-SA 4.0
RyanSpeech voice; length_scale 1.0) from the text
"Yeah, I'll collect it." This script trims the peak to -3 dBFS and adds short
fades. It is stdlib-only so it can run without Piper.

Usage: python3 scripts/audio/prepare-player-voice.py
"""
from __future__ import annotations

import array
import hashlib
import json
import math
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/audio/npc/player/source/player-accept-ryan-raw.wav"
OUT = ROOT / "assets/audio/npc/player/player-accept-ryan.wav"
TEXT = "Yeah, I'll collect it."
TARGET_PEAK_DB = -3.0
FADE_IN_S = 0.008
FADE_OUT_S = 0.015


def read(path: Path) -> tuple[array.array, int]:
    with wave.open(str(path), "rb") as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise SystemExit("expected mono 16-bit input")
        data = array.array("h")
        data.frombytes(w.readframes(w.getnframes()))
        return data, w.getframerate()


def peak_db(samples: array.array) -> float:
    peak = max((abs(int(s)) for s in samples), default=0)
    return 20.0 * math.log10(peak / 32768.0 + 1e-12)


def rms_db(samples: array.array) -> float:
    acc = sum(float(s) * float(s) for s in samples) / max(1, len(samples))
    return 20.0 * math.log10(math.sqrt(acc) / 32768.0 + 1e-12)


def main() -> None:
    src, rate = read(SOURCE)
    gain = 10.0 ** ((TARGET_PEAK_DB - peak_db(src)) / 20.0)
    fade_in = max(1, round(FADE_IN_S * rate))
    fade_out = max(1, round(FADE_OUT_S * rate))
    out = array.array("h", (0 for _ in range(len(src))))
    for i, sample in enumerate(src):
        g = gain
        if i < fade_in:
            g *= i / fade_in
        if i >= len(src) - fade_out:
            g *= max(0.0, (len(src) - i) / fade_out)
        out[i] = max(-32768, min(32767, int(round(sample * g))))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(out.tobytes())
    meta = {
        "id": "player-accept-ryan",
        "text": TEXT,
        "file": "assets/audio/npc/player/player-accept-ryan.wav",
        "source": "assets/audio/npc/player/source/player-accept-ryan-raw.wav",
        "tts": "Piper (local neural TTS), en_US-ryan-high, length_scale 1.0",
        "provider": "local Piper, not DaVinci",
        "voiceLicense": "CC BY-NC-SA 4.0, RyanSpeech dataset (see Piper model card)",
        "duration": round(len(out) / rate, 3),
        "sampleRate": rate,
        "sha256": hashlib.sha256(OUT.read_bytes()).hexdigest(),
        "rmsDb": round(rms_db(out), 2),
        "peakDb": round(peak_db(out), 2),
        "targetPeakDb": TARGET_PEAK_DB,
    }
    (OUT.parent / "clip.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
