# Opening story evidence · 99f18c0

Built from `99f18c0` on top of `93b6907` (score), `c73cb1b` (voice cast) and
`65bc0e1` (game renamed to **HKU Shanghai at War**, subtitle **BARRIER 2030**).
Served as the review build on `http://127.0.0.1:5252/`.

Captured with:

- `scripts/capture-opening-evidence.py` — cinematic frames. The prologue clock
  is frozen by suspending the AudioContext, so each seek lands on its beat.
- `scripts/check-opening-phone.py` with `SHOTS=evidence/opening-story-99f18c0/`
  — phone flow, 34 checks, 0 failed at both viewports.

| file | shows |
|---|---|
| `1280x800-light-show.png`, `390x844-light-show.png` | sunset aerial over B3's roofline, Magic Hour lasers and the mesh die-shot overlay |
| `1280x800-interior-beam.png`, `390x844-interior-beam.png` | B4 server hall with the volumetric shaft ahead; 1.5 s before the beam waypoint, because at the waypoint the camera is inside the shaft |
| `1280x800-dinner-hall.png`, `390x844-dinner-hall.png` | B5 dinner hall, long tables, dais and crest |
| `1280x800-final-spawn.png`, `390x844-final-spawn.png` | control returned at `[58, 0.08, 25]`, yaw 0, HUD objective "Join the crowd on the plaza" |
| `*-01-crowd.png` | fresh plaza start before any input |
| `*-02-phone.png` | the invitation phone, one enabled Yes, exact copy |
| `*-03-after-yes.png` | "Welcome, Ambassador." with the story's 3.2 s letterbox; the phone gate asserts the objective under it |

Known framing notes:

- The spawn faces B4's closed sliding doors 1.9 m ahead; the crowd route turns
  west around the tower. Owner decision still open: keep, angle the spawn, or
  open B4 for the opening.
- The establishing frame skims B3's roofline, so the four die-shot footprints
  read only in part; the overlay is visible on the roofs and links.
- The post-Yes frame hides the HUD because the acceptance subtitle deliberately
  uses the cinema letterbox for 3.2 s.

Superseded: `evidence/opening-story-b14aadb/` was the first capture run; its
light-show, interior-beam and dinner-hall frames were taken while the prologue
clock was still running and are mis-timed. Use this directory.
