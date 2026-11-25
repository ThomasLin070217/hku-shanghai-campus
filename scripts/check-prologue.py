"""Browser check: the BARRIER 2030 prologue plays, seeks and hands control back.

Needs a review build (the window.__CAMPUS.prologue hooks) and Python Playwright:
  npm run build:review
  npx vite preview --mode review --host 127.0.0.1 --port 5251
  CAMPUS_URL=http://127.0.0.1:5251/ CHROME_PATH=<chrome binary> python3 scripts/check-prologue.py

`vite preview` serves dist-review only with --mode review: the review mode is what
puts the prologue on __CAMPUS, so a plain preview fails at the first wait.

The check groups are the Task 3 acceptance list in order, plus the Task 4
replay-button step (6b), the final-review groups: auto-play on a fresh first
load (0), game keys stay with the cinematic (5b), natural completion through
the endcard (6c) and the checkpoint exclusion with its hidden replay button
(7b), and the 390x844 phone step (8). The BEGIN timing is split in two and both
are printed in-page (performance.now marks, so Playwright round trips cannot
inflate them): BEGIN -> the prologue clock starting must be <= 10 s (the story
audio pack load; a cold cache within that bound is not a failure), and the
first subtitle must be within 1.5 s of that clock start.

GL backend: the subtitle appears on the first rendered frame after BEGIN, so the
1.5 s budget only means something at a real frame rate. SwiftShader turns one frame
of this scene into 1.5-2.6 s on this machine (measured: 5.2-7.4 s from BEGIN to
subtitle), which would fail every run for reasons that are not the prologue.
The gate therefore runs on the default GPU backend and prints the renderer it
got. CHROME_GL=swiftshader keeps parity with the other browser gates.

CHROME_PATH is optional: without it Playwright's bundled Chromium is used. The
shot-B screenshot and its .txt sidecar are named from EVIDENCE_SHA when set,
otherwise from the runtime git HEAD. The same run checks the 390x844 phone
layout and captures evidence/prologue-phone-<sha>.png.
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5251/')
CHROME = os.environ.get('CHROME_PATH')
GL = os.environ.get('CHROME_GL', 'hardware')
ARGS = ['--enable-webgl'] if GL == 'hardware' else [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader',
]
VIEW = {'width': 1280, 'height': 800}
PHONE = {'width': 390, 'height': 844}
CLOCK_BUDGET_MS = 10000  # BEGIN -> t>0 must be <= 10 s; a cold cache within that bound is not a failure
SUBTITLE_BUDGET_MS = 1500  # first subtitle, measured from the clock start, not from BEGIN
STAMP = os.environ.get('EVIDENCE_SHA')

# Instrument the page before any app code runs. The marks are in-page
# performance.now values so Playwright's own round trips cannot inflate them.
INSTRUMENT = """
window.__marks = {}; window.__subSeen = null;
new MutationObserver(() => {
  const s = document.querySelector('.prologue-subtitle');
  if (s && s.textContent.trim() && window.__subSeen === null) window.__subSeen = performance.now();
}).observe(document, {subtree: true, childList: true, characterData: true});
document.addEventListener('click', e => {
  if (e.target && e.target.closest && e.target.closest('.prologue-begin')) window.__marks.begin = performance.now();
}, true);
"""

# t > 0 means the clock is running: before BEGIN and while the pack decodes the
# prologue reports lastT, which is 0, so this cannot fire early. Polled on rAF so
# the mark is the first frame that sees the clock move; it is bounded by one
# frame, so treat it as frame-quantized (~16 ms at 60 Hz), not exact.
WATCH_CLOCK = """
window.__tStarted = null;
(function poll(){
  const t = window.__CAMPUS && __CAMPUS.prologue && __CAMPUS.prologue.debug.state().t;
  if (window.__marks.begin != null && window.__tStarted === null && t > 0) { window.__tStarted = performance.now(); return; }
  requestAnimationFrame(poll);
})();
"""

# Seek and read in one task: a frame cannot land between the seek and the read,
# so the value is the cinematic pose at exactly that time, not the live clock's.
SEEK_TEXT = """(t) => {
  __CAMPUS.prologue.debug.seek(t);
  const s = document.querySelector('.prologue-subtitle');
  return {text: s ? s.textContent : null, visible: s ? s.classList.contains('is-visible') : false};
}"""
READ_TEXT = """() => {
  const s = document.querySelector('.prologue-subtitle');
  return {text: s ? s.textContent : null, visible: s ? s.classList.contains('is-visible') : false};
}"""
SEEK_POSE = """(t) => {
  __CAMPUS.prologue.debug.seek(t);
  return {pos: __CAMPUS.explorer.camera.position.toArray(), shot: __CAMPUS.prologue.debug.state().shot};
}"""

failures = []
passed = 0


def check(name, ok, detail=''):
    global passed
    if ok:
        passed += 1
        print('  ok  ', name)
    else:
        failures.append(name)
        print('  FAIL', name, '\n        ', detail)


def fatal(message):
    print(f'\ncheck-prologue: {message}')
    sys.exit(1)


def ready(page):
    # 90 s was the old budget and it expired under SwiftShader contention while
    # the build was perfectly healthy (measured 2026-11-26: the same build boots
    # in 28 s on a quiet machine). Every other gate uses 240 s.
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.prologue', timeout=240000)


def ready_or_fatal(page):
    try:
        ready(page)
    except PlaywrightTimeoutError:
        fatal('__CAMPUS.prologue never appeared. The build must be review mode '
              '(npm run build:review) and the preview must use --mode review.')


def frames(page, n=2):
    page.evaluate(f'() => new Promise(r => {{ let i = 0; const f = () => (++i >= {n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }})')


def norm(text):
    return ' '.join((text or '').split())


def sha():
    """The evidence stamp: EVIDENCE_SHA when the caller knows the captured
    tree, otherwise the runtime git HEAD (printed, so the provenance is visible)."""
    if STAMP:
        return STAMP
    try:
        return subprocess.check_output(['git', '-C', ROOT, 'rev-parse', '--short', 'HEAD'], text=True).strip()
    except Exception:
        return 'local'


def sidecar(image_path, **fields):
    """A .txt next to a screenshot: what tree and build actually produced it."""
    target = os.path.splitext(image_path)[0] + '.txt'
    with open(target, 'w', encoding='utf-8') as handle:
        for key, value in fields.items():
            handle.write('{}: {}\n'.format(key, value))
    print('  ..   sidecar:', target)


def utc_now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


# The gap and the endcard hold are single-sourced from the module constants; a
# rename fails loudly instead of the gate silently seeking with stale numbers.
with open(os.path.join(ROOT, 'src/opening/prologueTimeline.ts'), encoding='utf-8') as handle:
    gap_match = re.search(r'export const PROLOGUE_GAP\s*=\s*([0-9.]+)', handle.read())
if not gap_match:
    fatal('src/opening/prologueTimeline.ts has no PROLOGUE_GAP constant')
GAP = float(gap_match.group(1))
with open(os.path.join(ROOT, 'src/opening/prologue.ts'), encoding='utf-8') as handle:
    hold_match = re.search(r'const END_HOLD = ([0-9.]+)', handle.read())
if not hold_match:
    fatal('src/opening/prologue.ts has no END_HOLD constant')
END_HOLD = float(hold_match.group(1))

# The same timeline math as prologueTimeline(): first line at 0, each next one
# GAP seconds after the previous end. The manifest is the narration source of
# truth, so the expected subtitle text cannot drift from the recording.
with open(os.path.join(ROOT, 'assets/audio/prologue/clips.json'), encoding='utf-8') as handle:
    manifest = json.load(handle)
LINES = []
cursor = 0.0
for clip in manifest['clips']:
    LINES.append({'id': clip['id'], 'text': clip['text'], 'start': cursor, 'end': cursor + clip['duration']})
    cursor += clip['duration'] + GAP
TOTAL = LINES[-1]['end']
# Both shot A samples must be inside line 1, so the window is taken from the
# recorded duration instead of two hardcoded seconds (review N7).
if LINES[0]['end'] <= 0.5:
    fatal(f"line 1 ({LINES[0]['id']}) ends at {LINES[0]['end']:.3f}s; the shot A samples need a window longer than 0.5 s")
SHOT_A = (LINES[0]['end'] * 0.4, LINES[0]['end'] * 0.75)  # both inside line 1's window: the first shot
SHOT_B = LINES[1]['start'] + 0.5  # inside line 2's window: the second shot

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=ARGS, headless=True) if CHROME \
        else p.chromium.launch(args=ARGS, headless=True)
    try:
        # 0. Auto-play: a fresh context (empty sessionStorage) with no intro
        #    override must show the prologue by itself. This is the production
        #    trigger the earlier gate never loaded positively (review M4).
        auto = browser.new_page(viewport=VIEW, reduced_motion='no-preference')
        auto_errors = []
        auto.on('pageerror', lambda e: auto_errors.append(str(e)))
        auto.add_init_script(INSTRUMENT)
        auto.goto(ORIGIN + '?experience=opening', wait_until='load')
        ready_or_fatal(auto)
        frames(auto, 2)
        auto_state = auto.evaluate("""() => ({
          overlay: !!document.getElementById('prologue'),
          gate: (() => { const el = document.querySelector('.prologue-gate'); return !!el && !el.hidden; })(),
          active: __CAMPUS.prologue.active,
        })""")
        check('auto-play: a fresh first load with no intro override shows the BEGIN gate',
              auto_state['overlay'] and auto_state['gate'] and auto_state['active'] is True, auto_state)
        check('auto-play: no page errors', auto_errors == [], auto_errors)
        auto.close()

        page = browser.new_page(viewport=VIEW, reduced_motion='no-preference')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script(INSTRUMENT)
        page.goto(ORIGIN + '?experience=opening&intro=1', wait_until='load')
        ready_or_fatal(page)

        renderer = page.evaluate("""() => {
          const g = window.__CAMPUS?.viewer?.renderer?.getContext?.();
          if (!g) return 'no webgl';
          const d = g.getExtension('WEBGL_debug_renderer_info');
          return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
        }""")
        print('  ..   renderer:', renderer)
        evidence_sha = sha()
        print('  ..   evidence sha: {} ({})'.format(evidence_sha, 'EVIDENCE_SHA' if STAMP else 'runtime git HEAD'))

        api = page.evaluate("""() => ({
          seek: typeof window.__CAMPUS.prologue?.debug?.seek,
          state: typeof window.__CAMPUS.prologue?.debug?.state,
          active: typeof window.__CAMPUS.prologue?.active,
        })""")
        check('debug API: __CAMPUS.prologue.debug.seek/state are callable', api == {'seek': 'function', 'state': 'function', 'active': 'boolean'}, api)
        if api['seek'] != 'function' or api['state'] != 'function':
            fatal(f'__CAMPUS.prologue.debug.seek/state missing: {api}. The build must be review mode (npm run build:review; vite preview --mode review).')

        # 1. The gate covers the screen, the pause card is hidden and the body is flagged.
        check('gate: #prologue is on screen', page.locator('#prologue').is_visible())
        check('gate: the BEGIN card is shown', page.locator('.prologue-gate').is_visible())
        check('gate: body.prologue-active is set', page.evaluate("() => document.body.classList.contains('prologue-active')"))
        check('gate: the pause card is hidden', not page.locator('#pause-panel').is_visible())
        paused_at_gate = page.evaluate("() => ({paused: __CAMPUS.explorer.game.paused, reason: __CAMPUS.explorer.game.pauseReason})")
        check('gate: the explorer is paused', paused_at_gate['paused'] is True, paused_at_gate)
        check('gate: __CAMPUS.prologue.active is true', page.evaluate('() => __CAMPUS.prologue.active') is True)

        # 2. BEGIN unlocks audio and starts the run. The clock stays at t=0 until
        #    audio.start() has decoded the whole story pack, so the pack load and
        #    the subtitle are measured separately: the pack is a cold-cache cost
        #    (printed, 10 s bound) and the subtitle has the 1.5 s budget from the
        #    moment the clock runs.
        page.evaluate('() => { __subSeen = null; __tStarted = null; __marks = {}; }')
        page.evaluate(WATCH_CLOCK)
        page.click('.prologue-begin')
        try:
            page.wait_for_selector('.prologue-gate', state='hidden', timeout=5000)
            gate_dismissed = True
        except PlaywrightTimeoutError:
            gate_dismissed = False
        check('begin: the BEGIN gate is dismissed', gate_dismissed)
        try:
            page.wait_for_function("() => __CAMPUS.experience.audio.context?.state === 'running'", timeout=5000)
            audio_running = True
        except PlaywrightTimeoutError:
            audio_running = False
        audio = page.evaluate("() => __CAMPUS.experience.audio.context?.state ?? null")
        check('begin: the click unlocked the audio context', audio_running, audio)
        clock_ms = None
        subtitle_ms = None
        try:
            page.wait_for_function('() => window.__tStarted !== null', timeout=30000)
            clock_ms = page.evaluate('() => window.__tStarted - window.__marks.begin')
            print(f'  ..   clock started {clock_ms:.0f} ms after BEGIN (story audio pack)')
            check(f'begin: the cinematic clock starts within {CLOCK_BUDGET_MS} ms of BEGIN',
                  clock_ms <= CLOCK_BUDGET_MS, f'{clock_ms} ms from the BEGIN click, renderer {renderer}')
        except Exception as error:
            check(f'begin: the cinematic clock starts within {CLOCK_BUDGET_MS} ms of BEGIN', False,
                  f't never passed 0 within 30 s: {str(error).splitlines()[0]}')
        if clock_ms is None:
            fatal('the prologue clock never started, so the seek checks cannot run')
        try:
            page.wait_for_function('() => window.__subSeen !== null', timeout=30000)
            subtitle_ms = page.evaluate('() => window.__subSeen - window.__tStarted')
            if subtitle_ms >= 0:
                print(f'  ..   first subtitle {subtitle_ms:.0f} ms after the clock started')
            else:
                print(f'  ..   first subtitle was already up {-subtitle_ms:.0f} ms before the clock started')
            check(f'begin: the first subtitle is within {SUBTITLE_BUDGET_MS} ms of the clock starting',
                  subtitle_ms <= SUBTITLE_BUDGET_MS,
                  f'{subtitle_ms} ms from t>0, {clock_ms:.0f} ms from BEGIN, renderer {renderer}')
        except Exception as error:
            check(f'begin: the first subtitle is within {SUBTITLE_BUDGET_MS} ms of the clock starting', False,
                  f'no subtitle within 30 s: {str(error).splitlines()[0]}')
        first = page.evaluate(READ_TEXT)
        check('begin: the subtitle text is not empty', norm(first['text']) != '' and first['visible'], first)

        # 3. Every line start seeks to that line's recorded text.
        for index, line in enumerate(LINES):
            seen = page.evaluate(SEEK_TEXT, line['start'])
            check(f'seek {line["start"]:.3f}s: subtitle is line {index + 1} ({line["id"]})',
                  seen['visible'] and norm(seen['text']) == norm(line['text']),
                  {'expected': norm(line['text'])[:80], 'actual': norm(seen['text'])[:80], 'visible': seen['visible']})

        # 4. The shot A camera moves between two cinematic times 1 s apart.
        a = page.evaluate(SEEK_POSE, SHOT_A[0])
        b = page.evaluate(SEEK_POSE, SHOT_A[1])
        moved = sum((x - y) ** 2 for x, y in zip(a['pos'], b['pos'])) ** 0.5
        check('camera: moves > 0.05 between two shot A seek points 1 s apart', moved > 0.05,
              {'from': a, 'to': b, 'distance': moved})
        check('camera: both shot A samples report shot 0', a['shot'] == 0 and b['shot'] == 0, {'from': a, 'to': b})

        # 5. Shot B is on screen without the endcard, and the frame is captured there.
        page.evaluate('(t) => __CAMPUS.prologue.debug.seek(t)', SHOT_B)
        frames(page, 2)
        state = page.evaluate("() => ({line: __CAMPUS.prologue.debug.state().line, endcard: document.querySelector('.prologue-endcard')?.hidden === false})")
        check('shot B: the second shot holds without the endcard', state['line'] == 1 and not state['endcard'], state)
        shot = os.path.join(ROOT, 'evidence', f'prologue-{evidence_sha}.png')
        page.screenshot(path=shot)
        print('  ..   screenshot:', shot)
        sidecar(shot, sha=evidence_sha, url=ORIGIN + '?experience=opening&intro=1', renderer=renderer,
                clock_ms=clock_ms, subtitle_ms=subtitle_ms, captured_utc=utc_now())

        # 5b. The controller acts on E and C before its paused guard, so the
        #     cinematic must swallow them: no backpack, no MacBook (review M2).
        page.keyboard.press('e')
        page.keyboard.press('c')
        frames(page, 2)
        keys = page.evaluate("() => ({inventoryOpen: __CAMPUS.explorer.game.inventoryOpen, panel: __CAMPUS.explorer.game.panel})")
        check('keys: e does not open the backpack during the cinematic', keys['inventoryOpen'] is False, keys)
        check('keys: c does not open the MacBook during the cinematic', keys['panel'] is None, keys)

        # 6. Skip is clickable before the endcard, removes the overlay and hands back to a paused game.
        skip_visible = page.locator('.prologue-skip').is_visible() and page.locator('.prologue-skip').is_enabled()
        check('skip: the button is on screen before the endcard', skip_visible,
              page.evaluate("() => ({endcard: document.querySelector('.prologue-endcard')?.hidden, skip: !!document.querySelector('.prologue-skip')})"))
        if not skip_visible:
            fatal('the Skip button is not clickable before the endcard, so the rest of the run cannot continue')
        page.click('.prologue-skip')
        frames(page, 2)
        after = page.evaluate("""() => ({
          overlay: !!document.getElementById('prologue'),
          body: document.body.classList.contains('prologue-active'),
          pause: (() => { const el = document.getElementById('pause-panel');
            if (!el) return false; const r = el.getBoundingClientRect();
            return !el.hidden && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })(),
          paused: __CAMPUS.explorer.game.paused,
          active: __CAMPUS.prologue.active,
        })""")
        check('skip: #prologue is removed', not after['overlay'], after)
        check('skip: body.prologue-active is gone', not after['body'], after)
        check('skip: the pause card is back', after['pause'] is True, after)
        check('skip: the game is left paused', after['paused'] is True and after['active'] is False, after)

        # 6b. The pause card's Replay intro button is focusable, tall enough on
        #     touch, and in the review build it calls play() instead of reloading.
        replay = page.locator('#replay-intro')
        replay_exists = replay.count() > 0
        replay_box = replay.bounding_box(timeout=2000) if replay_exists else None
        focusable = page.evaluate(
            "() => { const b = document.getElementById('replay-intro'); if (!b) return false; b.focus(); return document.activeElement === b; }")
        replay_ok = replay_exists and replay.is_visible() and replay.is_enabled() and focusable \
            and replay_box is not None and replay_box['height'] >= 48
        check('replay: the pause card shows a focusable Replay intro button at least 48 px tall',
              replay_ok,
              {'exists': replay_exists, 'visible': replay_exists and replay.is_visible(),
               'focusable': focusable, 'box': replay_box})
        if replay_ok:
            page.click('#replay-intro')
            frames(page, 2)
            replayed = page.evaluate("""() => ({
              overlay: !!document.getElementById('prologue'),
              gate: (() => { const el = document.querySelector('.prologue-gate'); return !!el && !el.hidden; })(),
              body: document.body.classList.contains('prologue-active'),
              paused: __CAMPUS.explorer.game.paused,
              active: __CAMPUS.prologue.active,
            })""")
            check('replay: clicking it brings the BEGIN gate back', replayed['overlay'] and replayed['gate'] and replayed['body'], replayed)
            check('replay: the game is paused for the prologue again', replayed['paused'] is True and replayed['active'] is True, replayed)
        else:
            print('  ..   replay click skipped: the button did not pass its own check')

        # 6c. Natural completion: the endcard shows over the last hold, then the
        #     clock crossing PROLOGUE_TOTAL + END_HOLD removes the cinematic and
        #     returns the pause card. Skip is not the only exit (review M5).
        if replay_ok:
            page.click('.prologue-begin')
            try:
                page.wait_for_function('() => __CAMPUS.prologue.debug.state().t > 0', timeout=30000)
                running_again = True
            except PlaywrightTimeoutError:
                running_again = False
            if running_again:
                page.evaluate('(t) => __CAMPUS.prologue.debug.seek(t)', TOTAL + 0.5)
                frames(page, 2)
                endcard = page.evaluate("""() => ({
                  shown: document.querySelector('.prologue-endcard')?.hidden === false,
                  overlay: !!document.getElementById('prologue'),
                })""")
                check('completion: the endcard shows over the last hold', endcard['shown'] and endcard['overlay'], endcard)
                page.evaluate('(t) => __CAMPUS.prologue.debug.seek(t)', TOTAL + END_HOLD - 0.25)
                try:
                    page.wait_for_function("() => !document.getElementById('prologue')", timeout=15000)
                    completed = True
                except PlaywrightTimeoutError:
                    completed = False
                ended = page.evaluate("""() => ({
                  overlay: !!document.getElementById('prologue'),
                  body: document.body.classList.contains('prologue-active'),
                  pause: (() => { const el = document.getElementById('pause-panel');
                    if (!el) return false; const r = el.getBoundingClientRect();
                    return !el.hidden && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })(),
                  paused: __CAMPUS.explorer.game.paused,
                  active: __CAMPUS.prologue.active,
                })""")
                check('completion: the cinematic removes itself at the end of the hold',
                      completed and not ended['overlay'], ended)
                check('completion: body.prologue-active is gone and __CAMPUS.prologue.active is false',
                      not ended['body'] and ended['active'] is False, ended)
                check('completion: the pause card is back and the game is left paused',
                      ended['pause'] is True and ended['paused'] is True, ended)
            else:
                check('completion: the replay run starts its clock', False,
                      'the replay run never reached t > 0, so the endcard path cannot run')

        # 7. A reload without intro=1 does not replay the prologue (the session already saw it).
        page.goto(ORIGIN + '?experience=opening', wait_until='load')
        ready_or_fatal(page)
        frames(page, 2)
        reload_state = page.evaluate("""() => ({
          overlay: !!document.getElementById('prologue'),
          body: document.body.classList.contains('prologue-active'),
          active: __CAMPUS.prologue.active,
        })""")
        check('reload without intro=1: no prologue overlay', not reload_state['overlay'], reload_state)
        check('reload without intro=1: no prologue-active body', not reload_state['body'], reload_state)
        check('reload without intro=1: __CAMPUS.prologue.active is false', reload_state['active'] is False, reload_state)

        # 7b. A checkpoint excludes the prologue even with intro=1, and the
        #     pause card hides the replay button where no prologue can play
        #     (review M1/N6).
        page.goto(ORIGIN + '?experience=opening&intro=1&checkpoint=b4', wait_until='load')
        ready_or_fatal(page)
        frames(page, 2)
        checkpoint_state = page.evaluate("""() => ({
          overlay: !!document.getElementById('prologue'),
          active: __CAMPUS.prologue.active,
          replayHidden: document.getElementById('replay-intro')?.hidden === true,
        })""")
        check('checkpoint: intro=1 does not force the prologue over a checkpoint',
              not checkpoint_state['overlay'] and checkpoint_state['active'] is False, checkpoint_state)
        check('checkpoint: the replay button is hidden where the prologue cannot play',
              checkpoint_state['replayHidden'], checkpoint_state)

        # 8. Phone layout, 390x844 portrait: BEGIN fills the gate width, the
        #    subtitle sits inside the safe area and Skip stays reachable. One
        #    screenshot, taken with the subtitle up, is the visual evidence.
        phone = browser.new_page(viewport=PHONE, reduced_motion='no-preference')
        phone_errors = []
        phone.on('pageerror', lambda e: phone_errors.append(str(e)))
        phone.goto(ORIGIN + '?experience=opening&intro=1', wait_until='load')
        ready_or_fatal(phone)
        gate_box = phone.evaluate("""() => {
          const g = document.querySelector('.prologue-gate');
          if (!g) return null;
          const s = getComputedStyle(g);
          return {client: g.clientWidth, padLeft: parseFloat(s.paddingLeft), padRight: parseFloat(s.paddingRight)};
        }""")
        content_width = (gate_box['client'] - gate_box['padLeft'] - gate_box['padRight']) if gate_box else 0
        begin_box = phone.locator('.prologue-begin').bounding_box()
        check('phone: BEGIN spans at least 95% of the gate content width at 390x844',
              begin_box is not None and content_width > 0 and begin_box['width'] >= 0.95 * content_width
              and abs(begin_box['x'] - (PHONE['width'] - begin_box['width']) / 2) <= 1,
              {'begin': begin_box, 'gate': gate_box, 'content': content_width})
        phone.click('.prologue-begin')
        try:
            phone.wait_for_function(
                "() => { const s = document.querySelector('.prologue-subtitle');"
                " return !!s && s.textContent.trim() !== '' && getComputedStyle(s).opacity !== '0'; }",
                timeout=30000)
            subtitle_up = True
        except PlaywrightTimeoutError:
            subtitle_up = False
        rect = phone.evaluate("""() => {
          const s = document.querySelector('.prologue-subtitle');
          if (!s) return null;
          const r = s.getBoundingClientRect();
          return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height};
        }""")
        # The letterbox bars are 8.5vh tall; a subtitle overlapping them would
        # pass a plain viewport containment check (review N10).
        safe_top = PHONE['height'] * 0.085
        safe_bottom = PHONE['height'] * (1 - 0.085)
        check('phone: the subtitle sits between the letterbox bars inside the 390x844 safe area',
              subtitle_up and rect is not None and rect['left'] >= 0 and rect['right'] <= PHONE['width']
              and rect['top'] >= safe_top and rect['bottom'] <= safe_bottom and rect['width'] > 0,
              {'subtitle': rect, 'top_min': safe_top, 'bottom_max': safe_bottom})
        check('phone: Skip is reachable during the cinematic',
              phone.locator('.prologue-skip').is_visible() and phone.locator('.prologue-skip').is_enabled())
        phone_shot = os.path.join(ROOT, 'evidence', f'prologue-phone-{evidence_sha}.png')
        phone.screenshot(path=phone_shot)
        print('  ..   phone screenshot:', phone_shot)
        sidecar(phone_shot, sha=evidence_sha, url=ORIGIN + '?experience=opening&intro=1',
                viewport='390x844', renderer=renderer, captured_utc=utc_now())
        check('phone: no page errors', phone_errors == [], phone_errors)
        phone.close()

        check('no page errors', errors == [], errors)
    finally:
        browser.close()

if failures:
    print(f'\ncheck-prologue: {len(failures)} failed, {passed} passed')
    sys.exit(1)
print(f'\ncheck-prologue: {passed} passed')
