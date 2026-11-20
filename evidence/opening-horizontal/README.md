# Opening feedback fixes — 2026-11-20

## Implemented

1. Invitation opening now uses quiet, unpitched paper rustle. Opening running footsteps use ten softened surface variants; takeoff uses a short cloth sound and landing a restrained impact. Ordinary campus walking and other chapters retain their shared audio pack. Files are under `assets/audio/opening-foley/`; generation is reproducible with `scripts/audio/refine-opening-foley.py`.
2. Any new key finishes reading the invitation, records `invitation_read`, closes it and returns control through the existing explorer entry method. The dismissal key and its repeats are consumed until keyup, preventing accidental movement, jump, hotbar selection or reopening. The dialog hides synchronously; the next press after release is accepted normally. Task acceptance in the Staff dialog remains explicit.
3. The Staff dialog plays a 12.297-second synthesized English voice using its existing text. Replay is available; closing, replacing the panel, hiding/blurring the page or disposal cancels playback/pending playback. Subtitles remain available. The clip uses the existing CampusAudio context, SFX volume, master mute and shot budget. UI explicitly labels it synthesized.
4. The entire dinner hall is now east–west: long tables, chairs, vaults, chandeliers, lights and end-wall crest rotate together. The lobby/entry stays in place, and collision positions use the same quarter-turn mapping. The route advances farther into the lobby before turning right; all five opening route walks pass. The world revision is `opening-2030-v4-b5-horizontal`; existing save recovery preserves story/inventory and restores safe positions.

## Verification

- `check:opening`, including the horizontal table extent and interior/exit physical walk: PASS.
- `check:audio-review`: PASS, including asset loading, airborne silence, landing deduplication, pause/mute and voice budget.
- `check:all`, TypeScript and final production build: PASS.
- Scene catalogs and GLB assets regenerated. GLB round trips pass; all validated files have 0 errors / 0 warnings.
- Browser isolated fixture: Space, Escape, Tab, Enter, Shift and digit keys all close the invitation without leaking input; holding W is consumed; a new W press after release reaches normal input.
- Browser audio context was running, Staff voice created one shot, and closing the panel stopped it. Reopening/replay did not stack voices. See `browser-checks.json` and `staff-voice-ui.png`.
- The full-campus preview screenshot is `after-hall.png`; `before-hall.png` is the previous delivered longitudinal layout. These use different viewing directions to show each hall's long axis and are not a same-camera overlay.
- Six static B5 part retirements from the previous opening catalog are mapped explicitly in `scene-id-migration.json`. The ordinary campus asset stays unchanged.

This verifies isolated UI/audio execution and offline physical paths, not a new continuous bus-to-B4 human playthrough. Voice pronunciation and mix can still be judged on the target speakers; signal levels are recorded in `audio-levels.json`.

## Voice provenance and reproduction

The environment has no OpenAI TTS API key. This delivery uses a locally rendered macOS Daniel English system voice, not a remote service or a cloned real person. Source text is:

> You're one of our Student Ambassadors, right? We need the presentation MacBook from Building 6 for tonight's dinner. Could you collect it and bring it back here? The device is waiting on the office table in Building 6.

Rendered with `say -v Daniel -r 165`, converted to mono 22050 Hz WAV, loudness target -19 LUFS and true-peak ceiling -3 dB. It is a bundled audio file: the player's computer does not need a speech engine or model endpoint. The existing spoken/subtitle story is deterministic.

## Reproduce UI verification

Run `npm run play` and open `/evidence/opening-horizontal/interaction.html`. This page constructs an isolated CampusGame and in-memory localStorage; it never edits a live player's save or AI control grant. The geometry preview is `/evidence/opening-horizontal/preview.html?full`.
