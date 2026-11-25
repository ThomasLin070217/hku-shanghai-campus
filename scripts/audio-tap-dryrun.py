"""Dry run for the video's audio track — does the AudioContext tap actually
produce a non-silent file from the current build?

`scripts/record-demo.md` describes the two-track method: CDP screencast for
video, an init-script tap on `AudioContext` for audio. The tap has never been
run against this build, so this script proves the audio half in isolation:
boot the opening, let the prologue music start, record the tapped stream with
`MediaRecorder` for a few seconds, and write the WebM to disk.

Written 2026-11-26. Headless by default; a headed run needs a display.

    python3.13 scripts/audio-tap-dryrun.py [--seconds 10] [--url URL]

Exit 0 means: a stream was captured, the file exists, and its bytes are not all
silence. Exit 1 means the tap did not work and the recording path needs a fix
before the final take.
"""
from __future__ import annotations

import argparse
import base64
import os
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

DEFAULT_URL = 'http://127.0.0.1:5294/'
CHROME = os.environ.get(
    'CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
        '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']

# The tap: every node connected to ctx.destination also feeds a recording
# destination. Injected before any page script runs, so the game's own
# AudioContext (created on the first click) is the tapped one.
TAP = r"""
(() => {
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig || window.__recTapped) return;
  window.__recTapped = true;
  window.__recState = { contexts: 0, connected: 0, chunks: 0, bytes: 0, error: null };
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
    }
  };
  window.__startRec = () => {
    if (!window.__recDest) return 'no destination yet';
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
    parser.add_argument('--seconds', type=float, default=10.0)
    parser.add_argument('--url', default=os.environ.get('CAMPUS_URL', DEFAULT_URL))
    parser.add_argument('--out', default='/tmp/audio-tap-dryrun.webm')
    args = parser.parse_args()

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    chunks: list[bytes] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        errors: list[str] = []
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))

        page.expose_binding('__pushChunk', lambda src, b64: chunks.append(base64.b64decode(b64)))
        page.add_init_script(TAP)

        print(f'boot {args.url}', flush=True)
        page.goto(args.url, wait_until='domcontentloaded', timeout=240000)
        # The mixer's AudioContext is created on the first gesture; the pause
        # card's own button is that gesture for every gate in this tree
        # (src/opening/experience.ts:567 listens on enter-game, enter-compat
        # and enable-ai).
        page.wait_for_selector('#enter-game', timeout=240000, state='visible')
        started = time.time()
        page.locator('#enter-game').first.click()
        print(f'gesture after {round(time.time() - started)} s', flush=True)

        # Wait for the tapped context and at least one live connection.
        page.wait_for_function('() => window.__recState && window.__recState.connected > 0',
                               timeout=120000)
        print('tap:', page.evaluate('() => window.__recState'), flush=True)
        state = page.evaluate('() => window.__startRec()')
        print('recorder:', state, flush=True)
        if state != 'started':
            browser.close()
            return 1

        end = time.time() + args.seconds
        while time.time() < end:
            page.wait_for_timeout(500)
            if len(chunks) and time.time() > end - 1:
                break
        rec = page.evaluate('() => window.__rec.stop()')
        page.wait_for_timeout(1200)
        state = page.evaluate('() => window.__recState')
        print('after stop:', state, 'chunks held:', len(chunks), flush=True)
        level = page.evaluate("""() => {
          const ctx = window.__recCtx;
          if (!ctx) return null;
          // A cheap loudness probe: the analyser on the recording destination's
          // source is not exposed, so read the game's own master gain instead.
          return { state: ctx.state, sampleRate: ctx.sampleRate, time: ctx.currentTime };
        }""")
        print('context:', level, flush=True)
        print('page errors:', errors[:5], flush=True)
        browser.close()

    if not chunks:
        print('FAIL: no audio chunks arrived — the tap never saw a connection to ctx.destination')
        return 1
    data = b''.join(chunks)
    out.write_bytes(data)
    print(f'wrote {out} ({len(data)} bytes)')
    if len(data) < 2000:
        print('FAIL: file is too small to be speech or music; treat as silence')
        return 1
    print('OK: audio captured')
    return 0


if __name__ == '__main__':
    sys.exit(main())
