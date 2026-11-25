# Recording the demo video

The video is recorded **after** the full playtest, from a tagged build — never from a dirty tree.
This note is the runbook; it names what exists and what still has to be proven.

## What exists

| Piece | Where | State |
|---|---|---|
| Video capture (silent) | `scripts/lawn-recording.mjs` — CDP `Page.startScreencast`, JPEG frames → `ffmpeg` concat → H.264 | **Proven** on the lawn chapter at 1280×720 |
| Video + audio recorder | `scripts/record-demo.py` — screencast and `AudioContext` tap in one take, muxed | **Proven** 2026-11-26: `demo/hku-barrier-2030-v9.1.0.mp4`, 84.5 s, 31 MB, mean −28.6 dB |
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

## What the 2026-11-26 take taught (read before re-recording)

- **Hardware GL, not SwiftShader.** SwiftShader renders the cinematic at ~1.7 fps — the concat
  turns that into a slideshow. `--gl hardware` (the default) measured ~15 fps at 1280×720 and
  produces a smooth 18 fps file. `scripts/record-demo.py` records; the gates keep SwiftShader.
- **`?shell=1` on the review build.** Without it the review build shows the campus authoring
  chrome — scene index, breadcrumb, "Campus tools" — which no player ever sees. `src/entry.ts`
  switches the player shell on for `?shell=1`.
- **Point lock is denied in headless Chrome.** Clicking *Start opening* calls
  `explorer.enter()`, which requests pointer lock; headless denies it, so the game pauses with
  `pointer_lock_failed` and shows "Pointer lock unavailable. Use drag mode to continue." The
  recorder claims the save with a key press and then drives `enterCompat()` — the game's own
  drag-control mode — so nothing extra appears on screen. Verified: `pauseReason` and the notice
  element were both read after the fact.
- **The phone invitation needs movement.** `src/opening/experience.ts` opens it only after the
  player has walked 1.6 m, so the recorder walks first and then waits for it.
- **The card fades in.** Playwright calls an opacity-0 element visible; wait for computed opacity
  > 0.95 or the take ships a blank phone.

## Still to prove

- A/V drift over a long take has not been measured. The mux applies the measured start offset
  (0.29 s on the 2026-11-26 take); if a later take drifts visibly, record a clap marker and trim
  by hand.
