# Act 1 Staff voice · browser evidence

This folder records the first real in-game run of the new Staff voice.

## Recording

- `staff-in-game.wav` / `.webm` — 20.58 s of the game's final master mix, recorded
  with `CampusAudio.recordingStream()` while the auto Staff intro, player
  acceptance and Staff thanks played. Staff is DaVinci Asher; the player line is
  local Piper Kristin. The recording is stereo 48 kHz.
- `staff-repeat-in-game.wav` / `.webm` — 3.0 s of the repeat query after the player
  returns to the coordinator without the laptop.
- `browser-voice-trace.json` — 600 ms samples of line index, story stage, active
  voice shots, `npc-voice` count, music gain and subtitle text.
- `browser-repeat-trace.json` — the repeat interaction result and state.
- `audio-levels.json`, `transcripts.json` — measured levels and local Vosk
  transcripts of the recorded mixes.
- `player-accept-kristin.wav`, `player-options.html` — isolated player line and an
  audition page for the local Piper alternatives (Kristin is the current one).

## What the trace shows

- Line 0 → 1 → 2 at approximately 0 → 2.4 → 8.4 s, with the cinematic subtitle
  changing to the exact same line.
- `npc-voice` 1 → 2 → 3 as the three clips start; never more than one active
  voice at a time.
- Music/ambient duck from the saved 0.20 to about 0.084 while a voice is active,
  then return to 0.20.
- Stage changes `to_b5 → to_b6` only after the intro; the objective banner appears,
  then the player line and Staff thanks play (`npc-voice` reaches 5).
- The repeat target is available only after the acceptance sequence and plays
  `staff-line5`; the subtitle is `COORDINATOR — Hey — any luck with that laptop?`.
- `window.dispatchEvent(new Event('blur'))` during a line sets `activeShots` to 0
  immediately, so a skip/close does not leave a queued voice.
- Missing-audio test: rejecting all five `staff-line*.wav` fetches still advanced the
  subtitles and completed `to_b6`; no voice shots were left and the task was not blocked.

## Listening caveat

The agent cannot hear audio. The local Vosk transcript of the recorded mix
contains the full Staff text plus the player acceptance line, which proves the
voice is audible over the ducked music/ambient, but it is **not** a substitute
for a human timbre/acting review. Please listen to the WAV/WebM files above.

The Staff audio was generated once on DaVinci AI with the account's free Audio
1/1 allowance. No paid credits, upgrade, top-up or voice cloning were used.
See [the full report](../../docs/voice/DAVINCI-VOICE-REPORT.md).
