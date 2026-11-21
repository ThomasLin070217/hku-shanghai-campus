# CC0 Audio Assets — HKU Shanghai Campus 3D Game

Downloaded 2026-11-19. All assets verified CC0 / public domain on their source pages.
No `pip install`, no ffmpeg: processing used Python 3.13 stdlib (`wave`, `struct`, `math`) only.
**Total raw download: ~33 MB** (under the 40 MB cap). Raw files in `raw/`, processed WAVs in `processed/`.

## Raw assets

| Filename | Source URL | Author | License | What it is | Format | Duration | Notes |
|---|---|---|---|---|---|---|---|
| `kenney_sci-fi-sounds.zip` | https://kenney.nl/assets/sci-fi-sounds | Kenney | CC0 | 73 sci-fi SFX: alerts, scans, energy hums, locks | OGG (in ZIP) | varies | Page states "CC0 licensed". Signed download link via kenney.nl/download-link. OGG — needs decode to WAV. |
| `kenney_impact-sounds.zip` | https://kenney.nl/assets/impact-sounds | Kenney | CC0 | 130 impact/hit SFX (metal, wood, thuds) | OGG (in ZIP) | varies | CC0 verified. OGG — needs decode. |
| `kenney_interface-sounds.zip` | https://kenney.nl/assets/interface-sounds | Kenney | CC0 | 100 UI/click/relay/beep SFX | OGG (in ZIP) | varies | CC0 verified. Includes `click_*.ogg`, `close_*.ogg` (relay/door). |
| `kenney_rpg-audio.zip` | https://kenney.nl/assets/rpg-audio | Kenney | CC0 | 52 RPG/ambient SFX | OGG (in ZIP) | varies | CC0 verified. |
| `kenney_ui-audio.zip` | https://kenney.nl/assets/ui-audio | Kenney | CC0 | 52 UI audio SFX | OGG (in ZIP) | varies | CC0 verified. |
| `kenney_casino-audio.zip` | https://kenney.nl/assets/casino-audio | Kenney | CC0 | 55 casino/celebration-style SFX | OGG (in ZIP) | varies | CC0 verified. |
| `oga_bird_chirping_syncopika.wav` | https://opengameart.org/content/bird-chirping-sounds | syncopika | CC0 | Bird chirping | WAV 16-bit stereo 44 kHz | 3.00 s | Source file `birdchirping071414.wav`. Posted 2014-07-15. |
| `oga_short_wind_remaxim.wav` | https://opengameart.org/content/short-wind-sound | remaxim | CC0 | Wind gust / trees | WAV 16-bit stereo 44.1 kHz | 4.24 s | Posted 2009-09-20. |
| `oga_rain_window_alxl.wav` | https://opengameart.org/content/rain-on-window-loop | alxl | CC0 | Rain on window, loopable | WAV 16-bit stereo 44.1 kHz | 10.87 s | Posted 2023-01-19. |
| `oga_dark_ambiences_ogrebane.zip` | https://opengameart.org/content/dark-ambiences | Ogrebane | CC0 | 5 dark ambience beds | WAV 24-bit stereo (in ZIP) | 1.4–4.6 s | Posted 2010-12-18. Extracted WAVs also in `raw/`. 24-bit — not processed by stdlib script. |
| `oga_dark_ambience_ogrebane_ambience-{1..5}.wav` | (extracted from ZIP above) | Ogrebane | CC0 | Dark ambience beds 1–5 | WAV 24-bit stereo 44.1 kHz | 4.63/1.81/1.69/1.40/3.44 s | Raw extracted copies. |
| `oga_car_engine_loop0_domasx2.wav` | https://opengameart.org/content/racing-car-engine-sound-loops | domasx2 | CC0 | Engine idle loop | WAV 16-bit mono 44.1 kHz | 0.86 s | Posted 2011-07-24. Source `loop_0.wav`. |
| `oga_car_engine_loop1_domasx2.wav` | (same page) | domasx2 | CC0 | Engine idle loop (variant) | WAV 16-bit mono 44.1 kHz | 0.67 s | Source `loop_1_0.wav`. |
| `oga_engine_startup_looneybits.wav` | https://opengameart.org/content/car-engine-start-up-02 | looneybits | CC0 | Engine start-up | WAV **32-bit float** stereo 44.1 kHz | ~0.6 s | Posted 2019-01-29. Python `wave` cannot read float WAV — needs 16-bit conversion. Kept raw. |
| `oga_motor_fan_qubodup.wav` | https://opengameart.org/content/defect-motor-loop | qubodup | CC0 | Defective motor / fan hum loop | WAV 16-bit stereo 44.1 kHz | 3.01 s | Posted 2010-04-09. Good for servo/electronic hum. |
| `oga_beep_qubodup.wav` | https://opengameart.org/content/beep-tone-sound-sfx | qubodup | CC0 | Short alert beep | WAV 16-bit mono 48 kHz | 0.10 s | Posted 2012-01-05. |
| `oga_warp_engine_bart.wav` | https://opengameart.org/content/warp-engine-engage-sound | bart | CC0 | Sci-fi engine engage/hum | WAV 16-bit stereo 44.1 kHz | 8.57 s | Posted 2010-11-03. Source 16-bit variant. |
| `oga_door_closes_starninjas.zip` | https://opengameart.org/content/4-door-closes | StarNinjas | CC0 | 4 door-close SFX | OGG (in ZIP) | varies | Posted 2021-03-09. Usable for bus door. OGG — needs decode. |
| `oga_retro_synth_sfx_rubberduck.zip` | https://opengameart.org/content/50-cc0-retro-synth-sfx | rubberduck | CC0 | 50 retro synth SFX (beeps/alarms) | OGG + `.xpf` (in ZIP) | varies | Posted 2018-09-10. OGG — needs decode. |
| `oga_applause_crowd_expl0it3r.wav` | https://opengameart.org/content/applause-in-a-large-hall-or-church | eXpl0it3r | CC0 | Crowd applause in hall | WAV 16-bit stereo 44.1 kHz | 39.15 s | Posted 2019-04-08. Celebration/ending. |
| `oga_metal_bing1.wav` | https://opengameart.org/content/metal-impact-sounds | BMacZero | CC0 | Metal "bing" impact | WAV 16-bit mono 44.1 kHz | 0.72 s | Posted 2020-10-04. |
| `oga_metal_bong1.wav` | (same page) | BMacZero | CC0 | Metal "bong" impact | WAV 16-bit mono 44.1 kHz | 2.11 s | Robot/boss hit. |
| `oga_metal_clink1_0.wav` | (same page) | BMacZero | CC0 | Metal clink | WAV 16-bit mono 44.1 kHz | 0.31 s | |
| `oga_metal_clink2.wav` | (same page) | BMacZero | CC0 | Metal clink | WAV 16-bit mono 44.1 kHz | 0.26 s | |
| `oga_metal_clink3.wav` | (same page) | BMacZero | CC0 | Metal clink | WAV 16-bit mono 44.1 kHz | 0.29 s | |
| `oga_metal_thud2.wav` | (same page) | BMacZero | CC0 | Heavy thud | WAV 16-bit mono 44.1 kHz | 0.58 s | |
| `oga_metal_thud3.wav` | (same page) | BMacZero | CC0 | Heavy thud | WAV 16-bit mono 44.1 kHz | 0.42 s | |

## Processed WAVs (`processed/`)

Treatment: **trim** (keep first N s), **fade in/out** (linear), **peak normalize** to target.
Peak/RMS are fractions of full scale, computed with stdlib over all samples.
Script logic: `/tmp/wavproc.py` (kept outside deliverable; reproducible from description above).

| Output | Source raw | Treatment | Before peak / RMS | After peak / RMS | Duration |
|---|---|---|---|---|---|
| `amb_birds_loop.wav` | `oga_bird_chirping_syncopika.wav` | fade 0.20 s, normalize 0.85 | 0.0968 / 0.0076 | 0.8499 / 0.0668 | 3.00 s |
| `amb_wind_loop.wav` | `oga_short_wind_remaxim.wav` | fade 0.30 s, normalize 0.80 | 0.0924 / 0.0101 | 0.8000 / 0.0874 | 4.24 s |
| `amb_rain_loop.wav` | `oga_rain_window_alxl.wav` | trim 8 s, fade 0.50 s, normalize 0.85 | 0.8016 / 0.0993 | 0.8372 / 0.1022 | 8.00 s |
| `celebration_applause_loop.wav` | `oga_applause_crowd_expl0it3r.wav` | trim 12 s, fade 0.50 s, normalize 0.90 | 0.9999 / 0.0503 | 0.9000 / 0.0578 | 12.00 s |
| `impact_metal_hit.wav` | `oga_metal_bong1.wav` | fade 0.05 s, normalize 0.90 | 0.9080 / 0.0985 | 0.9000 / 0.0948 | 2.11 s |
| `bus_engine_idle.wav` | `oga_car_engine_loop0_domasx2.wav` | fade 0.02 s, normalize 0.80 | 0.7183 / 0.3973 | 0.8000 / 0.4367 | 0.86 s |
| `mechanical_motor_hum.wav` | `oga_motor_fan_qubodup.wav` | fade 0.20 s, normalize 0.80 | 0.6991 / 0.1531 | 0.7830 / 0.1637 | 3.01 s |
| `alert_beep.wav` | `oga_beep_qubodup.wav` | normalize 0.90 | 0.1084 / 0.0419 | 0.9000 / 0.3482 | 0.10 s |
| `scifi_engine_hum.wav` | `oga_warp_engine_bart.wav` | trim 4 s, fade 0.30 s, normalize 0.80 | 0.2563 / 0.0628 | 0.8000 / 0.2245 | 4.00 s |

## Target coverage

1. **Ambient/campus** — birds (`amb_birds_loop`), wind (`amb_wind_loop`); distant crowd murmur **GAP** (only a speech-bearing crowd OGG found).
2. **Bus** — engine idle (`bus_engine_idle`), engine start (raw float WAV), door close (OGG zip); interior ambience **GAP**.
3. **Mechanical** — motor hum (`mechanical_motor_hum`), sci-fi hum (`scifi_engine_hum`), relay clicks (Kenney interface OGG).
4. **Alarm/alert** — `alert_beep`, Kenney sci-fi scan/lock-on OGG.
5. **Impact** — `impact_metal_hit` + 6 raw metal/hit WAVs + Kenney impact OGG.
6. **Rain/dark ambience** — `amb_rain_loop` + 5 dark-ambience WAVs.
7. **Celebration** — `celebration_applause_loop` + Kenney casino/UI OGG.

## GAPS / notes

- **No true campus-crowd murmur without intelligible speech** found in CC0. Suggested alternatives: Freesound.org CC0 "restaurant ambience" / "crowd murmur" (API token needed for direct download), or mixkit.co (license check required).
- **Bus interior ambience** not found; only engine/door SFX.
- **Servo/robot joint** specific sound not found; motor/fan loops used as substitute.
- Kenney packs and several OGA zips are **OGG-only**: no ffmpeg available, so they remain raw and require decoding before engine import. Prefer the WAV rows above.
- `oga_engine_startup_looneybits.wav` is **32-bit float WAV** — Python stdlib `wave` rejects it; convert externally if needed.
- Dark-ambience WAVs are **24-bit** — not processed by the stdlib script (kept raw).
- Freesound.org was reachable but direct asset downloads require an API token; not pursued per instructions.
