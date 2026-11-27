"""Browser check: the opening is playable on a phone, and fullscreen works.

Before 2026-11-25 a phone could drag to look but had no way to walk: the on-screen
gamepad was designed (`docs/plans/2026-11-23-mobile-shell.md`) but never built.
This check drives the real touch layer at 390x844 (full flow), 844x390
(landscape play) and 430x932 (a taller phone, layout only) — stick drags,
look drags and button taps, all through Chromium's touch pipeline, so the
pointerType is `touch` exactly as on a device.

Fullscreen: Chromium 157+ enables `SuppressFullscreenFromUnfocusedView`, so a
window launched by automation (never focused by the OS) rejects
`requestFullscreen` with `TypeError: not granted` even from a trusted tap. The
launch args below disable that feature for this browser only, which is exactly
the state of a real user's focused window; without it every fullscreen assertion
here would fail for a reason that cannot happen to a player. Measured
2026-11-25: with the flag, headless and headed both grant and exit.

Needs a review build served over HTTP:
  npm run build:review
  npx vite preview --mode review --host 127.0.0.1 --port 5252   (or any server)
  CAMPUS_URL=http://127.0.0.1:5252/ CHROME_PATH=<chrome> python3.13 scripts/check-fullscreen.py

`?shell=1` is required: the review build keeps the authoring chrome otherwise,
and the shell is the player's real page.
"""
import os
import sys

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from boot_retry import boot_with_retry

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5252/')
CHROME = os.environ.get('CHROME_PATH')
HEADLESS = os.environ.get('HEADLESS', '1') != '0'
SHOTS = os.environ.get('SHOTS', '/tmp/one-world/fullscreen/')
ARGS = [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader',
    # An automation window never gets OS focus; real players click a focused one.
    '--disable-features=SuppressFullscreenFromUnfocusedView',
]
URL = ORIGIN + '?experience=opening&intro=0&shell=1'

# An iPhone exposes no document.fullscreenEnabled to a page. Reporting the same
# in Chromium makes the fallback a real browser run, not only a unit test of the
# device rule.
HIDE_FULLSCREEN_API = """
Object.defineProperty(Document.prototype, 'fullscreenEnabled', {get: () => false, configurable: true});
Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', {get: () => false, configurable: true});
"""

# The player spawn faces Building 4's closed door, so the stick drag pulls back.
# Both values are CSS pixels; the stick is 132 px at left 16 / bottom 16.
STICK_CENTRE = (16 + 66, 844 - 16 - 66)

failures = []
passed = 0


def check(name, ok, detail=''):
    global passed
    if ok:
        passed += 1
        print('  ok  ', name, flush=True)
    else:
        failures.append(name)
        print('  FAIL', name, '\n        ', detail, flush=True)


def shot(page, label, name):
    try:
        page.screenshot(path=SHOTS + f'{label}-{name}.png', timeout=180000)
        print('  shot', SHOTS + f'{label}-{name}.png', flush=True)
    except Exception as error:  # Evidence, not an assertion.
        print('  shot failed', name, type(error).__name__, flush=True)


def until(page, js, timeout=60):
    try:
        page.wait_for_function(js, timeout=timeout * 1000, polling=200)
        return True
    except PlaywrightTimeoutError:
        return False


BOOT_STATE = """() => window.__CAMPUS && window.__CAMPUS.explorer && window.__CAMPUS.touchControls
             && window.__CAMPUS.ready && document.querySelector('.shell-chapters')"""


def boot(page):
    # One retry if the local server drops the app chunk; see scripts/boot_retry.py.
    boot_with_retry(page, URL, BOOT_STATE, label='boot')


def enter(page):
    """Tap the real Enter exploration button; the touch path goes through
    explorer.enter -> enterCompat, never pointer lock."""
    box = page.evaluate("""() => {
      const b = document.getElementById('enter-game').getBoundingClientRect();
      return {x: b.x + b.width / 2, y: b.y + b.height / 2};
    }""")
    page.touchscreen.tap(box['x'], box['y'])
    return until(page, "() => document.body.classList.contains('exploring')", timeout=30)


def touch_drag(page, start, end, steps=6, hold_ms=0):
    """A real touch drag through CDP, so every pointer event carries
    pointerType 'touch' and the stick sees one finger end to end."""
    client = page.context.new_cdp_session(page)
    x0, y0 = start
    x1, y1 = end
    client.send('Input.dispatchTouchEvent', {
        'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1}]})
    for i in range(1, steps + 1):
        t = i / steps
        client.send('Input.dispatchTouchEvent', {
            'type': 'touchMove',
            'touchPoints': [{'x': x0 + (x1 - x0) * t, 'y': y0 + (y1 - y0) * t, 'id': 1}]})
    if hold_ms:
        page.wait_for_timeout(hold_ms)
    client.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    client.detach()


def tap_button(page, selector):
    """Tap the control's centre, but only if the control is what a finger would
    actually hit there. A covered or collapsed control returns False instead of
    a tap that lands somewhere else (measured 2026-11-26: the fullscreen toggle
    was tapped one frame after the pause card resumed, while the card still
    covered it, and the tap went to the card)."""
    box = page.evaluate("""(selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return {x: b.x + b.width / 2, y: b.y + b.height / 2,
              reachable: !!hit && (hit === el || el.contains(hit))};
    }""", selector)
    if not box or not box['reachable']:
        return False
    page.touchscreen.tap(box['x'], box['y'])
    return True


def box_of(page, selector):
    return page.evaluate("""(selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {x: b.x, y: b.y, w: b.width, h: b.height, display: getComputedStyle(el).display};
    }""", selector)


def overlaps(a, b):
    """True when two visible rects share pixels. Hidden or missing rects never
    overlap: a display:none control is not in the player's way."""
    if not a or not b or a['display'] == 'none' or b['display'] == 'none':
        return False
    if a['w'] <= 0 or a['h'] <= 0 or b['w'] <= 0 or b['h'] <= 0:
        return False
    return (a['x'] < b['x'] + b['w'] and b['x'] < a['x'] + a['w']
            and a['y'] < b['y'] + b['h'] and b['y'] < a['y'] + a['h'])


def state(page):
    return page.evaluate("""() => {
      const c = window.__CAMPUS;
      return {
        pos: c.explorer.position.toArray(),
        yaw: c.explorer.state.yaw,
        paused: c.explorer.game.paused,
        touchMode: document.body.classList.contains('touch-mode'),
        exploring: document.body.classList.contains('exploring'),
        touchRoot: !!document.querySelector('.touch-controls'),
        buttons: [...document.querySelectorAll('.touch-button')].map((b) => b.dataset.touch),
        fullscreenApi: c.fullscreen ? c.fullscreen.api : null,
        fullscreenHint: c.fullscreen ? c.fullscreen.hint : null,
        fullscreenElement: !!document.fullscreenElement,
        shellHintShown: (() => {
          const el = document.querySelector('.shell-hint');
          return el ? getComputedStyle(el).display !== 'none' : null;
        })(),
        keyGuideShown: (() => {
          const el = document.querySelector('.pause-card .key-guide');
          return el ? getComputedStyle(el).display !== 'none' : null;
        })(),
        width: innerWidth, height: innerHeight,
      };
    }""")


def run_portrait(page):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    boot(page)
    # Count real Fullscreen API requests; see the auto-entry check below.
    page.evaluate("""() => {
      window.__fsRequests = 0;
      const original = Element.prototype.requestFullscreen;
      if (original) Element.prototype.requestFullscreen = function (...args) {
        window.__fsRequests += 1;
        return original.apply(this, args);
      };
    }""")
    s = state(page)
    check('portrait: a coarse touch device mounts the gamepad', s['touchMode'] and s['touchRoot'], s)
    # `computer` is the MacBook key (`C`): without it a phone reached the
    # "Open the MacBook" objective with no control that could satisfy it
    # (bug hunt T-01, 2026-11-26).
    check('portrait: the gamepad has stick, run, jump, bag, use, menu and mac',
          s['buttons'] == ['run', 'jump', 'bag', 'interact', 'menu', 'computer'], s['buttons'])
    check('portrait: a touch device without the API shows no dead button, and reports the hint',
          s['fullscreenApi'] is not None, s)
    check('portrait: the keyboard-only hints are hidden on a phone',
          s['shellHintShown'] is False and s['keyGuideShown'] is False, s)
    mapcard = box_of(page, '.opening-mapcard')
    bag_hint = box_of(page, '.bag-open')
    check('portrait: the desktop minimap and bag hint are hidden (the objective and the BAG button replace them)',
          bool(mapcard) and mapcard['display'] == 'none'
          and bool(bag_hint) and bag_hint['display'] == 'none', f'{mapcard} {bag_hint}')
    check('portrait: Enter exploration starts the game without pointer lock', enter(page))
    # Owner request, 2026-11-26: "entering the game should go fullscreen by
    # itself, and you can leave fullscreen by hand". The Start tap is the
    # gesture the Fullscreen API needs, so entry takes the whole screen.
    #
    # Both halves are asserted, because they failed apart: on the pre-fix build
    # the element never appeared *and* `window.__fsRequests` stayed 0 — the
    # request was skipped by an opt-out that a viewport resize had armed, not
    # refused by the browser. Counting calls keeps that distinction visible if
    # it ever returns.
    entries = until(page, '() => !!document.fullscreenElement', timeout=20)
    requested = page.evaluate("() => window.__fsRequests")
    check('portrait: entering the game goes fullscreen by itself',
          entries and requested >= 1, f'element={bool(entries)} requests={requested}')
    page.wait_for_timeout(500)
    # Geometry: every on-screen control must be reachable, and nothing may sit
    # on top of a thumb button. These are measured, not eyeballed.
    view = state(page)
    hotbar = box_of(page, '#inventory-hud .hotbar')
    stick = box_of(page, '.touch-stick')
    actions = box_of(page, '.touch-actions')
    rotate = box_of(page, '.touch-rotate')
    check('portrait: the hotbar is fully on screen',
          bool(hotbar) and hotbar['display'] != 'none'
          and hotbar['x'] >= 0 and hotbar['y'] >= 0
          and hotbar['x'] + hotbar['w'] <= view['width']
          and hotbar['y'] + hotbar['h'] <= view['height'], f'{hotbar} in {view["width"]}x{view["height"]}')
    check('portrait: the hotbar clears the stick and the buttons',
          not overlaps(hotbar, stick) and not overlaps(hotbar, actions),
          f'hotbar={hotbar} stick={stick} actions={actions}')
    check('portrait: the rotate hint clears the hotbar',
          not overlaps(rotate, hotbar), f'rotate={rotate} hotbar={hotbar}')
    shot(page, '390x844', '01-entered')

    # ---- Walking. Pull the stick down (backwards, away from the B4 door). The
    # walk reaches the 1.6 m invitation beat, so the phone opens on its own —
    # exactly the flow a phone player gets, with no debug hook involved.
    before = state(page)
    cx, cy = STICK_CENTRE
    touch_drag(page, (cx, cy), (cx, cy + 50), hold_ms=1500)
    walked = until(page, f"""() => {{
      const p = window.__CAMPUS.explorer.position;
      return Math.hypot(p.x - {before['pos'][0]!r}, p.z - {before['pos'][2]!r}) > 0.4;
    }}""", timeout=20)
    after = state(page)
    distance = sum((a - b) ** 2 for a, b in zip(before['pos'], after['pos'])) ** 0.5
    check('portrait: the stick walks the player (>0.4 m)', walked, f'moved {distance:.3f} m')
    shot(page, '390x844', '02-walked')

    # ---- The invitation the walk triggers. Answering it must hand control back
    # to the touch layer, or a phone player is stuck behind a dialog forever.
    invited = until(page, "() => !!document.querySelector('.opening-phone')", timeout=30)
    check('portrait: walking far enough opens the invitation phone', invited)
    if invited:
        check('portrait: tapping Yes answers the invitation',
              tap_button(page, '.opening-phone-yes')
              and until(page, "() => !document.querySelector('.opening-phone') && window.__CAMPUS.openingDebug.state().modal === null", timeout=20))
        stage = page.evaluate('() => window.__CAMPUS.openingDebug.state().story.stage')
        check('portrait: the invitation starts the walk to Building 5', stage == 'to_b5', stage)
        check('portrait: the game is running again after Yes',
              until(page, '() => !window.__CAMPUS.explorer.game.paused', timeout=20))

    # ---- Looking. Drag across the open sky, well clear of the stick and buttons.
    yaw_before = state(page)['yaw']
    touch_drag(page, (195, 300), (95, 300), steps=8)
    page.wait_for_timeout(300)
    yaw_after = state(page)['yaw']
    check('portrait: a touch drag turns the view', abs(yaw_after - yaw_before) > 0.05,
          f'yaw {yaw_before:.3f} -> {yaw_after:.3f}')

    # ---- Owner report, 2026-11-26: after dragging a pause-card slider, the
    # JUMP button stopped answering on a phone. Every slider here is an
    # <input type="range">; while one is being dragged the browser withholds
    # synthesized clicks, so the buttons act on pointerdown. This drives the
    # reported sequence through the real touch pipeline and counts the jump keys
    # the game receives — the key count is the game's own input path, not a log.
    page.evaluate("""() => { window.__jumpKeys = 0;
      window.addEventListener('keydown', (e) => { if (e.code === 'Space') window.__jumpKeys += 1; }, true); }""")
    check('portrait: MENU opens the card for the slider test',
          tap_button(page, '.touch-button[data-touch="menu"]')
          and until(page, """() => { const p = document.getElementById('pause-panel');
                       return !!p && !p.hidden; }""", timeout=20))
    page.evaluate("() => document.getElementById('pause-music').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(250)
    slider = box_of(page, '#pause-music')
    value_before = page.evaluate("() => document.getElementById('pause-music').value")
    if slider:
        touch_drag(page, (slider['x'] + slider['w'] * 0.2, slider['y'] + slider['h'] / 2),
                   (slider['x'] + slider['w'] * 0.85, slider['y'] + slider['h'] / 2))
    page.wait_for_timeout(250)
    value_after = page.evaluate("() => document.getElementById('pause-music').value")
    check('portrait: the pause-card slider takes a touch drag',
          value_before != value_after, f'{value_before} -> {value_after}')
    check('portrait: the card closes after the slider drag',
          tap_button(page, '#enter-game')
          and until(page, """() => { const p = document.getElementById('pause-panel');
                       return !!p && p.hidden; }""", timeout=30))
    keys_before = page.evaluate("() => window.__jumpKeys")
    check('portrait: JUMP answers straight after a slider drag',
          tap_button(page, '.touch-button[data-touch="jump"]')
          and until(page, f"() => window.__jumpKeys > {keys_before}", timeout=10),
          f'keys {keys_before} -> {page.evaluate("() => window.__jumpKeys")}')

    # ---- MENU pauses; Enter exploration resumes. (Escape is a one-way pause,
    # exactly as on desktop, so the resume is the pause card's own button.)
    check('portrait: tapping MENU pauses', tap_button(page, '.touch-button[data-touch="menu"]')
          and until(page, '() => window.__CAMPUS.explorer.game.paused', timeout=20))
    shot(page, '390x844', '03-menu')
    check('portrait: the pause card resumes the game', tap_button(page, '#enter-game')
          and until(page, '() => !window.__CAMPUS.explorer.game.paused', timeout=20))
    # `paused` flips inside the click handler; the card is hidden on the
    # viewer's next frame. A tap issued in between lands on the card, which now
    # reaches over the top-right toggle (measured 2026-11-26: enter and leave
    # both failed while the toggle itself was healthy). Wait for the hide.
    until(page, "() => { const p = document.getElementById('pause-panel'); return !!p && p.hidden; }", timeout=30)

    # ---- Fullscreen: entry already took the screen; the toggle is the player's
    # manual exit, and a manual exit must stay exited on the next Continue.
    #
    # `tap_until` retries: an automation window is never focused by the OS, and
    # Chromium answers the first `exitFullscreen()` after a programmatic entry
    # with "Document not active" until the transition settles (measured
    # 2026-11-26 — the same tap succeeds a moment later). A player's focused
    # window has no such window, so the check asserts the toggle's effect, not
    # one exact request's luck.
    def tap_until(selector, condition, tries=4, timeout=12):
        for _ in range(tries):
            if not tap_button(page, selector):
                return False
            if until(page, condition, timeout=timeout):
                return True
        return False

    before = state(page)
    check('portrait: this browser exposes the Fullscreen API',
          before['fullscreenApi'] is True, before)
    shot(page, '390x844', '04-fullscreen')
    check('portrait: the toggle leaves fullscreen',
          tap_until('.fullscreen-toggle', '() => !document.fullscreenElement'),
          f'element={state(page)["fullscreenElement"]}')
    check('portrait: the same toggle re-enters fullscreen',
          tap_until('.fullscreen-toggle', '() => !!document.fullscreenElement'),
          f'element={state(page)["fullscreenElement"]}')
    check('portrait: leaving again for the rest of the run',
          tap_until('.fullscreen-toggle', '() => !document.fullscreenElement'),
          f'element={state(page)["fullscreenElement"]}')
    after = state(page)
    check('portrait: the game is still running after the fullscreen round trip',
          after['exploring'] and not after['paused'], after)
    # The deliberate exit must stick: pausing and continuing again may not yank
    # the player back to fullscreen they just left by hand.
    check('portrait: MENU pauses after the manual exit',
          tap_button(page, '.touch-button[data-touch="menu"]')
          and until(page, '() => window.__CAMPUS.explorer.game.paused', timeout=20))
    until(page, """() => { const p = document.getElementById('pause-panel');
                return !!p && !p.hidden; }""", timeout=30)
    resumed = (tap_button(page, '#enter-game')
               and until(page, '() => !window.__CAMPUS.explorer.game.paused', timeout=20))
    page.wait_for_timeout(1500)
    check('portrait: Continue after a manual exit does not force fullscreen back',
          resumed and not state(page)['fullscreenElement'],
          f'resumed={resumed} element={state(page)["fullscreenElement"]}')

    page.wait_for_timeout(300)
    check('portrait: no page errors', not errors, errors[:4])


def run_landscape(page):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    boot(page)
    check('landscape: Enter exploration starts the game', enter(page))
    page.wait_for_timeout(500)
    s = state(page)
    stick = box_of(page, '.touch-stick')
    actions = box_of(page, '.touch-actions')
    check('landscape: the stick is fully on screen',
          bool(stick) and stick['display'] != 'none' and stick['x'] >= 0
          and stick['y'] >= 0 and stick['x'] + stick['w'] <= s['width']
          and stick['y'] + stick['h'] <= s['height'], f'{stick} in {s["width"]}x{s["height"]}')
    check('landscape: the action buttons are fully on screen',
          bool(actions) and actions['display'] != 'none' and actions['x'] >= 0
          and actions['y'] >= 0 and actions['x'] + actions['w'] <= s['width']
          and actions['y'] + actions['h'] <= s['height'], f'{actions} in {s["width"]}x{s["height"]}')
    overlap = bool(stick and actions
                   and stick['x'] < actions['x'] + actions['w']
                   and actions['x'] < stick['x'] + stick['w']
                   and stick['y'] < actions['y'] + actions['h']
                   and actions['y'] < stick['y'] + stick['h'])
    check('landscape: the stick and the buttons do not overlap', not overlap)

    # The minimap used to sit on top of RUN and MENU at this height; a phone
    # cannot afford it, so it is hidden exactly as in portrait.
    mapcard = box_of(page, '.opening-mapcard')
    check('landscape: the minimap is hidden instead of covering the buttons',
          bool(mapcard) and mapcard['display'] == 'none', mapcard)
    hotbar = box_of(page, '#inventory-hud .hotbar')
    bag_hint = box_of(page, '.bag-open')
    check('landscape: the hotbar is fully on screen and not empty',
          bool(hotbar) and hotbar['display'] != 'none' and hotbar['w'] > 0
          and hotbar['x'] >= 0 and hotbar['y'] >= 0
          and hotbar['x'] + hotbar['w'] <= s['width']
          and hotbar['y'] + hotbar['h'] <= s['height'], f'{hotbar} in {s["width"]}x{s["height"]}')
    check('landscape: the hotbar clears the stick and the buttons',
          not overlaps(hotbar, stick) and not overlaps(hotbar, actions),
          f'hotbar={hotbar} stick={stick} actions={actions}')
    check('landscape: the desktop bag hint is hidden on touch',
          bool(bag_hint) and bag_hint['display'] == 'none', bag_hint)
    shot(page, '844x390', '01-entered')

    before = state(page)
    touch_drag(page, (82, 390 - 16 - 66), (82, 390 - 16 - 66 + 50), hold_ms=1200)
    walked = until(page, f"""() => {{
      const p = window.__CAMPUS.explorer.position;
      return Math.hypot(p.x - {before['pos'][0]!r}, p.z - {before['pos'][2]!r}) > 0.3;
    }}""", timeout=20)
    check('landscape: the stick walks the player', walked)
    shot(page, '844x390', '02-walked')
    page.wait_for_timeout(300)
    check('landscape: no page errors', not errors, errors[:4])


def run_layout(page, label):
    """A second phone size: geometry only. The flow is covered at 390x844; this
    proves the stack still clears every control on a tall modern phone."""
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    boot(page)
    check(f'{label}: Enter exploration starts the game', enter(page))
    page.wait_for_timeout(500)
    view = state(page)
    stick = box_of(page, '.touch-stick')
    actions = box_of(page, '.touch-actions')
    hotbar = box_of(page, '#inventory-hud .hotbar')
    for name, box in (('stick', stick), ('action buttons', actions), ('hotbar', hotbar)):
        check(f'{label}: the {name} are fully on screen',
              bool(box) and box['display'] != 'none' and box['w'] > 0
              and box['x'] >= 0 and box['y'] >= 0
              and box['x'] + box['w'] <= view['width']
              and box['y'] + box['h'] <= view['height'], f'{box} in {view["width"]}x{view["height"]}')
    check(f'{label}: stick, buttons and hotbar do not overlap',
          not overlaps(stick, actions) and not overlaps(hotbar, stick)
          and not overlaps(hotbar, actions), f'stick={stick} actions={actions} hotbar={hotbar}')
    shot(page, label, '01-entered')
    page.wait_for_timeout(300)
    check(f'{label}: no page errors', not errors, errors[:4])


def run_fallback(page):
    """An iPhone: `document.fullscreenEnabled` is false. The game must offer the
    Add to Home Screen hint — and, just as important, no expand button that
    would do nothing when tapped."""
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    boot(page)
    # Count real API calls, so "asks for nothing" is a measurement and not an
    # absence: without a counter this check would also pass if the tap never
    # reached the fullscreen path at all. Chromium still has the method here —
    # only `fullscreenEnabled` is hidden, as on an iPhone.
    page.evaluate("""() => {
      window.__fsRequests = 0;
      const original = Element.prototype.requestFullscreen;
      if (original) Element.prototype.requestFullscreen = function (...args) {
        window.__fsRequests += 1;
        return original.apply(this, args);
      };
    }""")
    s = state(page)
    check('fallback: the game itself detects that fullscreen is unavailable', s['fullscreenApi'] is False, s)
    toggles = page.evaluate("() => document.querySelectorAll('.fullscreen-toggle').length")
    check('fallback: a device without the API gets no dead fullscreen button', toggles == 0, toggles)
    hint = box_of(page, '.fullscreen-hint')
    # The pill is a floating control, like the floating fullscreen button: the
    # pause card covers it on a phone, so the card hides it rather than leaving
    # a dead-looking Dismiss underneath. It must appear once play starts.
    check('fallback: the hint waits under the pause card instead of floating over it',
          bool(hint) and hint['display'] == 'none', hint)
    check('fallback: starting the game shows the hint', enter(page) and until(
        page, """() => { const h = document.querySelector('.fullscreen-hint');
                 const p = document.getElementById('pause-panel');
                 return !!h && (!p || p.hidden) && getComputedStyle(h).display !== 'none'
                        && h.getBoundingClientRect().width > 0; }""", timeout=30))
    hint = box_of(page, '.fullscreen-hint')
    check('fallback: the Add to Home Screen hint is shown instead',
          bool(hint) and hint['display'] != 'none' and hint['w'] > 0, hint)
    check('fallback: auto-fullscreen asks for nothing this device cannot give',
          page.evaluate("() => !document.fullscreenElement") and page.evaluate(
              "() => window.__fsRequests === 0"),
          f'element={state(page)["fullscreenElement"]} requests={page.evaluate("() => window.__fsRequests")}')
    text = page.evaluate("() => document.querySelector('.fullscreen-hint span')?.textContent")
    check('fallback: the hint says exactly what to do',
          text == 'Add to Home Screen to play full screen', text)
    dismiss = box_of(page, '.fullscreen-hint button')
    check('fallback: Dismiss meets the 44 px touch target',
          bool(dismiss) and dismiss['w'] >= 44 and dismiss['h'] >= 44, dismiss)
    shot(page, '390x844-fallback', '01-hint')
    # A tap the player cannot land is not a dismissal: the button has to be the
    # element under its own centre, not something drawn over it.
    reachable = page.evaluate("""() => { const b = document.querySelector('.fullscreen-hint button');
      if (!b) return null; const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {ok: !!hit && (hit === b || b.contains(hit)), hit: hit ? hit.tagName + '.' + (hit.className || '') : null}; }""")
    check('fallback: Dismiss is the element under its own tap point',
          bool(reachable) and reachable['ok'] is True, reachable)
    check('fallback: tapping Dismiss removes the hint',
          tap_button(page, '.fullscreen-hint button')
          and until(page, "() => !document.querySelector('.fullscreen-hint')", timeout=10))
    page.wait_for_timeout(300)
    check('fallback: no page errors', not errors, errors[:4])


def main():
    os.makedirs(SHOTS, exist_ok=True)
    print(f'check-fullscreen: {URL} -> {SHOTS} ({"headless" if HEADLESS else "headed"})', flush=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=CHROME, headless=HEADLESS, args=ARGS) if CHROME else playwright.chromium.launch(
            headless=HEADLESS, args=ARGS)
        try:
            print('\n390x844 portrait', flush=True)
            context = browser.new_context(
                viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                is_mobile=True, has_touch=True)
            page = context.new_page()
            try:
                run_portrait(page)
            except Exception as error:
                check('portrait: flow completed', False, f'{type(error).__name__}: {error}')
            finally:
                context.close()

            print('\n844x390 landscape', flush=True)
            context = browser.new_context(
                viewport={'width': 844, 'height': 390}, device_scale_factor=1,
                is_mobile=True, has_touch=True)
            page = context.new_page()
            try:
                run_landscape(page)
            except Exception as error:
                check('landscape: flow completed', False, f'{type(error).__name__}: {error}')
            finally:
                context.close()

            print('\n430x932 portrait (large phone)', flush=True)
            context = browser.new_context(
                viewport={'width': 430, 'height': 932}, device_scale_factor=1,
                is_mobile=True, has_touch=True)
            page = context.new_page()
            try:
                run_layout(page, '430x932')
            except Exception as error:
                check('430x932: layout completed', False, f'{type(error).__name__}: {error}')
            finally:
                context.close()

            print('\n390x844 iPhone fallback (no Fullscreen API)', flush=True)
            context = browser.new_context(
                viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                is_mobile=True, has_touch=True)
            context.add_init_script(HIDE_FULLSCREEN_API)
            page = context.new_page()
            try:
                run_fallback(page)
            except Exception as error:
                check('fallback: flow completed', False, f'{type(error).__name__}: {error}')
            finally:
                context.close()
        finally:
            browser.close()
    if failures:
        print(f'\ncheck-fullscreen: {len(failures)} failed, {passed} passed', flush=True)
        sys.exit(1)
    print(f'\n{passed} checks, 0 failed', flush=True)


if __name__ == '__main__':
    main()
