"""Record the demo video from the tagged release build: video and audio tracks.

`scripts/record-demo.md` describes the method. The two halves are now proven
separately — the CDP screencast in `scripts/lawn-recording.mjs`, the
`AudioContext` tap in `scripts/audio-tap-dryrun.py` — so this script runs both
at once on the same page and muxes them into one MP4:

  video  CDP `Page.startScreencast` at 1280x720, JPEG frames with their
         timestamps, ffmpeg concat at 18 fps.
  audio  an init script that feeds every node connected to `ctx.destination`
         into a `MediaStreamDestination`; `MediaRecorder` (Opus) chunks come
         back over `expose_binding`.

The take: click BEGIN (which starts the prologue's music), record the 74.6 s
prologue cinematic plus its 2 s hold, then hand control to the player, accept
the invitation and walk into the plaza. Headless by default; the owner's rule
is that tests run headless.

**Why the review build.** After the prologue the campaign's Start opening
button calls `explorer.enter()`, which requests pointer lock. Headless Chrome
denies it (measured 2026-11-26: `game.pauseReason === 'pointer_lock_failed'`
and the card reopens), so the capture drives `enterCompat()` — the game's own
drag-control mode for touch devices — exactly as the playthrough gate does.
That hook exists only in the review build; the pixels come from the same
commit. `--tail none` records the cinematic alone and works on either build.

    python3.13 scripts/record-demo.py --seconds 95 \
        --url http://127.0.0.1:5294/ --out demo/hku-barrier-2030-v9.1.0.mp4

Exit 0 means: frames exist, the video is the requested length within 10 %, the
audio track is not silence, and the muxed file plays. The sync offset between
the two tracks is printed so a bad take is visible before it is shipped.
"""
from __future__ import annotations

import argparse
import base64
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

CHROME = os.environ.get(
    'CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
# Hardware GL by default: this is a recording, not a gate. SwiftShader renders
# the cinematic at ~1.7 fps (measured 2026-11-26: 24 frames in 14 s), which
# encodes a slideshow. `--gl swiftshader` keeps parity with the browser gates.
GL = os.environ.get('CHROME_GL', 'hardware')
ARGS = ['--enable-webgl', '--window-size=1280,720', '--hide-scrollbars'] if GL == 'hardware' else [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
    '--enable-unsafe-swiftshader', '--window-size=1280,720', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required']

# Same tap as scripts/audio-tap-dryrun.py; keep the two in step.
TAP = r"""
(() => {
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig || window.__recTapped) return;
  window.__recTapped = true;
  window.__recState = { contexts: 0, connected: 0, chunks: 0, bytes: 0 };
  window.AudioContext = class extends Orig {
    constructor(...a) {
      super(...a);
      const ctx = this;
      window.__recState.contexts += 1;
      const dest = ctx.createMediaStreamDestination();
      window.__recDest = dest;
      window.__recCtx = ctx;
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (target, ...rest) {
        const out = connect.call(this, target, ...rest);
        if (target === ctx.destination) {
          try { connect.call(this, dest); window.__recState.connected += 1; } catch (e) {}
        }
        return out;
      };
      // Start on the same gesture that starts the music: no round trip through
      // Playwright, so the audio track begins within milliseconds of the click.
      setTimeout(() => { try { window.__startRec && window.__startRec(); } catch (e) {} }, 0);
    }
  };
  window.__startRec = () => {
    if (!window.__recDest) return 'no destination yet';
    if (window.__rec && window.__rec.state !== 'inactive') return 'already recording';
    const rec = new MediaRecorder(window.__recDest.stream, { mimeType: 'audio/webm;codecs=opus' });
    window.__rec = rec;
    rec.ondataavailable = async (e) => {
      if (!e.data || !e.data.size) return;
      const buf = new Uint8Array(await e.data.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      }
      window.__recState.chunks += 1;
      window.__recState.bytes += buf.length;
      window.__pushChunk(btoa(s));
    };
    rec.start(500);
    return 'started';
  };
})();
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default=os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5295/'))
    parser.add_argument('--out', default='demo/hku-barrier-2030-v9.1.0.mp4')
    parser.add_argument('--seconds', type=float, default=95.0)
    parser.add_argument('--tail', choices=('campaign', 'none'), default='campaign',
                        help="campaign: prologue then first-person play (needs the "
                             "review build); none: the cinematic alone")
    parser.add_argument('--fps', type=int, default=18)
    parser.add_argument('--quality', type=int, default=82)
    parser.add_argument('--keep-tracks', action='store_true',
                        help='keep the intermediate frames/audio next to the output')
    args = parser.parse_args()

    out = pathlib.Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    url = args.url
    if args.tail == 'campaign' and 'shell=1' not in url:
        # A review build keeps the campus authoring chrome (scene index, breadcrumb,
        # Campus tools) unless ?shell=1 asks for the shipped player shell. Without
        # it the video shows staff furniture that no player ever sees.
        url += ('&' if '?' in url else '?') + 'shell=1'
    work = pathlib.Path(tempfile.mkdtemp(prefix='demo-take-'))
    frames_dir = work / 'frames'
    frames_dir.mkdir()
    audio_path = work / 'audio.webm'
    video_path = work / 'video.mp4'

    frames: list[tuple[str, float]] = []
    chunks: list[bytes] = []
    dropped = 0

    def on_frame(frame) -> None:
        nonlocal dropped
        try:
            cdp.send('Page.screencastFrameAck', {'sessionId': frame['sessionId']})
        except Exception:
            pass
        t = float(frame['metadata']['timestamp'])
        if frames and t - frames[-1][1] < 0.06:
            dropped += 1
            return
        name = f'{len(frames):06d}.jpg'
        (frames_dir / name).write_bytes(base64.b64decode(frame['data']))
        frames.append((name, t))

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        errors: list[str] = []
        page.on('pageerror', lambda e: errors.append(str(e)[:200]))
        page.expose_binding('__pushChunk', lambda src, b64: chunks.append(base64.b64decode(b64)))
        page.add_init_script(TAP)
        cdp = page.context.new_cdp_session(page)
        cdp.on('Page.screencastFrame', on_frame)

        print(f'boot {url}', flush=True)
        page.goto(url, wait_until='domcontentloaded', timeout=240000)
        page.wait_for_selector('.prologue-begin', timeout=240000, state='visible')

        # Start the video before the click so the opening frame is the title
        # gate; the click constructs the mixer's AudioContext, and the tap
        # starts the recorder inside that same gesture. The measured gap is the
        # audio offset in the mux.
        page.wait_for_timeout(1200)
        cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': args.quality,
                                          'maxWidth': 1280, 'maxHeight': 720})
        t_video = time.time()
        page.locator('.prologue-begin').first.click()
        t_audio = time.time()
        page.wait_for_function('() => window.__rec && window.__rec.state === "recording"',
                               timeout=60000)
        print(f'recorder: running; tap: {page.evaluate("() => window.__recState")}', flush=True)

        # The prologue owns the screen for 74.56 s + a 2 s hold, then pauses the
        # game and shows the card. Hand control back the moment it lets go.
        began = time.time()
        handed = False
        reported = -1
        while time.time() - began < args.seconds:
            page.wait_for_timeout(250)
            elapsed = time.time() - began

            if args.tail == 'campaign' and not handed:
                if page.evaluate('() => !window.__CAMPUS || !window.__CAMPUS.prologue '
                                 '|| !window.__CAMPUS.prologue.active'):
                    handed = True
                    print(f'  t={elapsed:.1f}s: prologue over, handing control back', flush=True)
                    if page.evaluate('() => !!window.__CAMPUS && !!window.__CAMPUS.explorer'):
                        # A key, not the button: the opening experience only
                        # claims the save on trusted input, and Start opening
                        # would also request pointer lock, which headless
                        # denies with a visible "Pointer lock unavailable"
                        # notice (measured 2026-11-26).
                        page.keyboard.press('Shift')
                        page.wait_for_timeout(300)
                        page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
                        page.wait_for_timeout(400)
                        # The phone buzzes only after the player has walked 1.6 m
                        # (src/opening/experience.ts), so move first.
                        page.keyboard.down('w')
                        try:
                            page.wait_for_selector('.opening-phone-yes', state='visible',
                                                   timeout=15000)
                            page.keyboard.up('w')
                            print(f'  t={time.time() - began:.1f}s: phone invitation up', flush=True)
                            # The card fades in: Playwright calls an opacity-0
                            # element visible, so wait for the fade to finish
                            # before the click, or the take ships a blank phone.
                            page.wait_for_function(
                                "() => { const el = document.querySelector('.opening-phone'); "
                                "return el && Number(getComputedStyle(el).opacity) > 0.95; }",
                                timeout=8000)
                            page.wait_for_timeout(1200)
                            page.locator('.opening-phone-yes').click()
                            print(f'  t={time.time() - began:.1f}s: invitation accepted', flush=True)
                            # End on the objective updating and "Welcome,
                            # Ambassador." — the player now has a destination.
                            page.wait_for_timeout(2800)
                        except PlaywrightTimeoutError:
                            page.keyboard.up('w')
                            print('  note: no invitation appeared', flush=True)
                    else:
                        print('  note: no __CAMPUS on this build; ending at the cinematic',
                              flush=True)

            if int(elapsed) // 10 != reported:
                reported = int(elapsed) // 10
                print(f'  t={elapsed:.0f}s frames={len(frames)} audio={len(chunks)}', flush=True)

        cdp.send('Page.stopScreencast')
        try:
            page.evaluate('() => window.__rec && window.__rec.state !== "inactive" && window.__rec.stop()')
        except Exception:
            pass
        page.wait_for_timeout(1500)
        rec_state = page.evaluate('() => window.__recState')
        print(f'after stop: {rec_state} chunks={len(chunks)}', flush=True)
        if errors:
            print('page errors:', errors[:5], flush=True)
        browser.close()

    if not frames:
        print('FAIL: Chrome returned no video frames')
        return 1
    if not chunks:
        print('FAIL: no audio chunks — the tap never saw a connection to ctx.destination')
        return 1

    sequence = []
    for index, (name, t) in enumerate(frames):
        nxt = frames[index + 1][1] if index + 1 < len(frames) else t + 1.0
        sequence.append(f"file '{name}'")
        sequence.append(f'duration {max(0.04, nxt - t):.4f}')
    sequence.append(f"file '{frames[-1][0]}'")
    (frames_dir / 'frames.txt').write_text('\n'.join(sequence))

    print(f'encoding {len(frames)} frames at {args.fps} fps', flush=True)
    result = subprocess.run(
        ['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-f', 'concat',
         '-i', 'frames.txt',
         '-vf', f'fps={args.fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-movflags', '+faststart',
         str(video_path)],
        cwd=frames_dir, capture_output=True, text=True, timeout=1800)
    if result.returncode != 0:
        print('FAIL: ffmpeg could not encode the video:\n' + result.stderr[-2000:])
        return 1

    audio_path.write_bytes(b''.join(chunks))
    # The two tracks start slightly apart: the video rolls on the title gate,
    # the audio begins at the BEGIN click. Delay the audio by that measured gap.
    offset = max(-1.0, min(5.0, t_audio - t_video))
    print(f'sync offset: {offset:.3f} s (audio starts after video)', flush=True)
    if offset >= 0:
        audio_args = ['-itsoffset', f'{offset:.3f}', '-i', str(audio_path)]
    else:  # audio began first: trim its head so both tracks start together
        audio_args = ['-ss', f'{-offset:.3f}', '-i', str(audio_path)]
    result = subprocess.run(
        ['ffmpeg', '-nostdin', '-y', '-loglevel', 'error',
         '-i', str(video_path), *audio_args,
         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
         '-movflags', '+faststart', str(out)],
        capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        print('FAIL: ffmpeg could not mux the tracks:\n' + result.stderr[-2000:])
        return 1

    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries',
         'format=duration,size:stream=codec_type,codec_name,width,height,channels',
         '-of', 'default=noprint_wrappers=1', str(out)],
        capture_output=True, text=True, timeout=120)
    print(probe.stdout.strip(), flush=True)
    durations = re.findall(r'duration=(\d+(?:\.\d+)?)', probe.stdout)
    if not durations or not (args.seconds * 0.8 <= float(durations[0]) <= args.seconds * 1.2):
        print(f'FAIL: the take is not the requested length ({durations} vs {args.seconds})')
        return 1

    level = subprocess.run(
        ['ffmpeg', '-hide_banner', '-i', str(out), '-af', 'volumedetect', '-f', 'null', '-'],
        capture_output=True, text=True, timeout=300)
    means = re.findall(r'mean_volume:\s*(-?\d+(?:\.\d+)?) dB', level.stderr)
    if not means:
        print('FAIL: ffmpeg could not measure the muxed audio')
        return 1
    mean = float(means[-1])
    print(f'mean volume: {mean} dB', flush=True)
    if mean <= -55:
        print('FAIL: the muxed track is silence')
        return 1

    if args.keep_tracks:
        for source, name in ((video_path, 'video-only.mp4'), (audio_path, 'audio-only.webm')):
            shutil.copy(source, out.with_name(out.stem + '-' + name))
    shutil.rmtree(work, ignore_errors=True)
    print(f'OK: {out} ({out.stat().st_size / 1e6:.1f} MB, {float(durations[0]):.1f} s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
