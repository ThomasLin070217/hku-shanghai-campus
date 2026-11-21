#!/usr/bin/env python3
"""Split the single DaVinci/ElevenLabs Staff take into line clips.

Input: work/voice-generation/staff-take1.wav (44.1 kHz, mono, 16-bit PCM).
The boundaries are the midpoints of the measured pauses from the local Vosk
word timestamps in work/voice-tools; they are not guessed from text length.

Usage: python3 scripts/audio/split-staff-take.py
"""
from __future__ import annotations

import array
import hashlib
import json
import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "work/voice-generation/staff-take1.wav"
OUT = ROOT / "assets/audio/npc/staff"
SOURCE_OUT = OUT / "source"

# start/end seconds; start includes a short breath/pad before the first word,
# end includes the natural tail. Speech bounds came from Vosk word timestamps.
CLIPS = [
    ("staff-line1", "Hey — you're one of the Student Ambassadors, right?", 0.00, 2.55),
    ("staff-line2", "Could you do me a quick favour? We need the presentation MacBook from Building 6 for tonight's dinner.", 3.12, 8.88),
    ("staff-line3", "It's on the office table. Mind picking it up? We're running a bit behind.", 9.24, 13.89),
    ("staff-line4", "Perfect, thanks! Just bring it back here when you've got it.", 14.61, 17.94),
    ("staff-line5", "Hey — any luck with that laptop?", 19.05, 21.159),
]
GAIN_DB = 0.5
FADE_IN_S = 0.008
FADE_OUT_S = 0.015


def read_mono(path: Path) -> tuple[array.array, int]:
    with wave.open(str(path), "rb") as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2 or w.getframerate() != 44100:
            raise SystemExit(f"expected 44.1 kHz mono 16-bit, got {w.getnchannels()}ch/{w.getsampwidth()*8}bit/{w.getframerate()}Hz")
        data = array.array("h")
        data.frombytes(w.readframes(w.getnframes()))
        return data, w.getframerate()


def write_mono(path: Path, samples: array.array, rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.tobytes())


def rms_db(samples: array.array) -> float:
    if not samples:
        return -120.0
    acc = sum(float(s) * float(s) for s in samples) / len(samples)
    return 20.0 * math.log10(math.sqrt(acc) / 32768.0 + 1e-12)


def peak_db(samples: array.array) -> float:
    peak = max((abs(int(s)) for s in samples), default=0)
    return 20.0 * math.log10(peak / 32768.0 + 1e-12)


def main() -> None:
    src, rate = read_mono(SOURCE)
    gain = 10.0 ** (GAIN_DB / 20.0)
    manifest = []
    for clip_id, text, start_s, end_s in CLIPS:
        a = max(0, min(len(src), round(start_s * rate)))
        b = max(a, min(len(src), round(end_s * rate)))
        chunk = src[a:b]
        faded = array.array("h", (0 for _ in range(len(chunk))))
        fade_in = max(1, round(FADE_IN_S * rate))
        fade_out = max(1, round(FADE_OUT_S * rate))
        for i, sample in enumerate(chunk):
            g = gain
            if i < fade_in:
                g *= i / fade_in
            if i >= len(chunk) - fade_out:
                g *= max(0.0, (len(chunk) - i) / fade_out)
            v = int(round(sample * g))
            faded[i] = max(-32768, min(32767, v))
        path = OUT / f"{clip_id}.wav"
        write_mono(path, faded, rate)
        duration = len(faded) / rate
        manifest.append({
            "id": clip_id,
            "text": text,
            "file": f"assets/audio/npc/staff/{clip_id}.wav",
            "sourceStart": round(start_s, 3),
            "sourceEnd": round(end_s, 3),
            "duration": round(duration, 3),
            "sampleRate": rate,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "rmsDb": round(rms_db(faded), 2),
            "peakDb": round(peak_db(faded), 2),
        })
        print(f"{clip_id}: {duration:.2f}s  RMS {rms_db(faded):.1f} dBFS  peak {peak_db(faded):.1f} dBFS  {path.relative_to(ROOT)}")
    SOURCE_OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "clips.json").write_text(json.dumps({"schemaVersion": 1, "source": "DaVinci AI · ElevenLabs TTS V3 · Asher", "gainDb": GAIN_DB, "clips": manifest}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT/'clips.json'}")


if __name__ == "__main__":
    main()
