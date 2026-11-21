# Staff NPC voice · DaVinci AI / ElevenLabs TTS V3

Generated 2026-11-21 from the normal DaVinci AI web UI with the account's one free
audio generation. No paid credits, subscription, top-up or voice cloning were used.

## Files

- `source/staff-take1.mp3` — original 21.159 s output (128 kbps, 44.1 kHz mono).
- `source/staff-take1.wav` — 44.1 kHz mono PCM conversion used for splitting.
- `source/generation-log.json` — quota before/after, hashes, output ID, request text.
- `staff-line1.wav` … `staff-line5.wav` — bundled in-game clips; 44.1 kHz mono
  16-bit PCM, +0.5 dB gain, 8 ms fade-in / 15 ms fade-out.
- `clips.json` — clip id, text, source start/end, duration, SHA-256, RMS/peak.

## Voice

- Provider: DaVinci AI
- Model: ElevenLabs TTS V3 (`eleven-v3` / `fal-ai/elevenlabs/tts/eleven-v3`)
- Voice: Asher (`tMvyQtpCVQ0DkixuYm6J`), English / American, middle-aged, casual
- Stability: 0.40
- Style: friendly university staff member, natural conversational English, slightly
  rushed but warm, subtle pauses, relaxed tone, no announcer voice.

## Why one take

The account showed Audio 1/1 before generation and 0/1 after. Generating five
separate lines would have required five paid calls, so the five lines were spoken
as one take and split at measured pauses. The split boundaries came from local
Vosk word timestamps, not text-length guesses. Each resulting clip was transcribed
again locally to confirm it contains the intended line.

## Reproduction

```sh
python3 scripts/audio/split-staff-take.py
npm run check:voice
```

The split script is stdlib-only Python and expects
`work/voice-generation/staff-take1.wav`. The original MP3 is kept in `source/`
for provenance.

## Limit

The agent could not subjectively listen to the voice. Technical checks (duration,
hashes, local transcript, browser playback counters, subtitles, ducking, stop)
passed; human timbre approval remains for the team.
