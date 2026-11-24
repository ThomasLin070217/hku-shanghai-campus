# Recording the demo video

The video is recorded **after** the full playtest, from a tagged build — never from a dirty tree.
This note is the runbook; it names what exists and what still has to be proven.

## What exists

| Piece | Where | State |
|---|---|---|
| Video capture (silent) | `scripts/lawn-recording.mjs` — CDP `Page.startScreencast`, JPEG frames → `ffmpeg` concat → H.264 | **Proven** on the lawn chapter at 1280×720 |
| Route driver | `scripts/check-campaign-playthrough.py` — drives the whole route with real key events | **Proven** (gate, not a recorder) |
| Screenshot capture | `scripts/capture-opening-evidence.py` | Proven |

There is **no** audio track in the CDP screencast path. The game's music and dialogue are played
through one `AudioContext` created in `src/gameplay/audio.ts`; the recorder has to tap it in page.

## The two-track method (recommended)

1. **Video** — CDP screencast, as `lawn-recording.mjs` does, at the output resolution. Frames carry
   their own timestamps, so the concat list preserves pauses and any frame-rate drop.
2. **Audio** — inject before the page boots:

   ```js
   // add_init_script — taps every node that reaches the speakers.
   const Orig = window.AudioContext;
   window.AudioContext = class extends Orig {
     constructor(...a) {
       super(...a);
       const ctx = this;
       window.__recDest = ctx.createMediaStreamDestination();
       const connect = AudioNode.prototype.connect;
       AudioNode.prototype.connect = function (target, ...rest) {
         const out = connect.call(this, target, ...rest);
         if (target === ctx.destination) { try { connect.call(this, window.__recDest); } catch {} }
         return out;
       };
     }
   };
   ```

   Then record `__recDest.stream` with `MediaRecorder` (`audio/webm;codecs=opus`) and write chunks
   to disk as they arrive (`page.expose_binding`, one base64 chunk per `ondataavailable`). Audio-only
   chunks are small; do **not** try to push the video through the same channel.
3. **Mux** — `ffmpeg -i video.mp4 -i audio.webm -c:v copy -c:a aac -b:a 192k -shortest out.mp4`.
   Check A/V sync against a known beat (the dinner toast line is a clean marker).

Why not `canvas.captureStream(60)` + `MediaRecorder` for video too? It records the canvas only —
the HUD, subtitle cards and the MacBook overlay are DOM and would be lost. The CDP screencast
captures the composited page. Use `captureStream` only if a DOM-free canvas-only cut is wanted.

## Frame rate and resolution

SwiftShader (the headless WebGL path every gate uses) will not hold 60 fps at 1920×1080. Before a
take, read `window.__CAMPUS.perf()` and the frame times at the chosen size; if 1080p cannot hold,
record at 1280×720 and upscale in ffmpeg (`-vf scale=1920:1080:flags=lanczos`) rather than shipping
a stuttering take. A headed Chrome on the owner's machine with a real GPU is the better venue for
the final take.

## The take

- Boot the review build of the **tagged** commit (`npm run build`, then serve `dist/`).
- Start on a fresh profile with cleared storage: the opening prologue must play from the top.
- One continuous run, no chapter jumps, no reloads — the same route the playtest used.
- Name the output with the tag: `demo/hku-barrier-2030-v9.1.0.mp4`.
- After recording, verify: duration, no black frames at the head, audio present, and that the
  version label in the pause card matches the tag.

## Still to prove

- The audio tap above has **not** been run against the current build yet; the first dry run is a
  10-second capture with the prologue music, checked for a non-silent track.
- A/V drift over a 10-minute take has not been measured. If drift exceeds ~100 ms, record a clap
  marker at the start and trim by hand.
