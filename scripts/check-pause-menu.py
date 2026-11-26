"""Browser check: the pause card owns chapter select, Replay intro and settings.

Owner report, 2026-11-25: "replay intro 不知道为什么不放在 chapter 里。chapter
为什么不放在暂停页面。现在 chapter 根本点不到。" The floating Chapters link sat
at z-index 11 under the full-screen pause overlay (z-index 12), so while paused
every click landed on the overlay, and while playing the pointer was locked. The
pause card is the one surface a player can always click, so the chapter list,
Replay intro and the settings a player reaches for most live there now.

This gate drives that card like a player, at 1280x800 and at 390x844:

  card        Chapter and Settings sections exist; Replay intro is inside
              Chapter, visible, focusable and at least 48 px tall
  overlay     the floating Chapters link and fullscreen button are hidden while
              paused and back while playing
  chapters    the list is collapsed by default, then opens to one chapter start
              and eight checkpoints
  navigation  a real click on "B4 · Fetch the MacBook" loads checkpoint=b6
  settings    each slider writes experience.settings, prints its value, and the
              full settings dialog shows the same value afterwards
  fullscreen  the card's Full screen button is there wherever the API is
  phone       the same open-and-go chapter flow through the touch pipeline
  epilogue    on ?checkpoint=ending a real Escape raises the card above the
              ending overlay: Continue and Return to checkpoint take real
              clicks, the refusal toast paints above it, and the clock advances
  errors      no page errors

Needs a review build served over HTTP:
  npm run build:review
  CAMPUS_URL=http://127.0.0.1:5294/ CHROME_PATH=<chrome> python3.13 scripts/check-pause-menu.py

`?shell=1` is required: the review build keeps the authoring chrome otherwise.
"""
import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5294/')
CHROME = os.environ.get('CHROME_PATH')
HEADLESS = os.environ.get('HEADLESS', '1') != '0'
SHOTS = os.environ.get('SHOTS', '/tmp/one-world/pause-menu/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
VIEW = {'width': 1280, 'height': 800}
PHONE = {'width': 390, 'height': 844}
BASE = ORIGIN + '?experience=opening&intro=0&shell=1'
CHECKPOINT_IDS = ['b5', 'b6', 'incident', 'b4', 'b4-inside', 'lawn', 'sports', 'ending']

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
        os.makedirs(SHOTS, exist_ok=True)
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


BOOT_JS = """() => window.__CAMPUS && window.__CAMPUS.explorer && window.__CAMPUS.ready
             && document.querySelector('.pause-card')"""
BOOT_STATE_JS = """() => ({
  campus: !!window.__CAMPUS,
  explorer: !!(window.__CAMPUS && window.__CAMPUS.explorer),
  ready: !!(window.__CAMPUS && window.__CAMPUS.ready),
  card: !!document.querySelector('.pause-card'),
  readyState: document.readyState,
})"""


def boot(page, budget=420, url=None):
    """Load `url` (default BASE) and wait for the app, reporting what the page is doing.

    A flat `wait_for_function` turned a slow first shader compile into a raw
    traceback with no evidence (2026-11-25). This polls in slices, prints the
    page's own state, and fails fast when the module finished loading without
    ever exporting `__CAMPUS` — that is an init-time throw, not a slow browser.
    """
    page.goto(url or BASE, wait_until='domcontentloaded')
    left = budget
    while left > 0:
        if until(page, BOOT_JS, timeout=min(30, left)):
            return until(page, "() => { const p = document.getElementById('pause-panel'); return !!p && !p.hidden; }",
                         timeout=60)
        left -= 30
        try:
            state = page.evaluate(BOOT_STATE_JS)
        except Exception as error:  # Navigation in flight, or the page is gone.
            state = {'evaluate': type(error).__name__}
        print('  boot', left, 's left', state, flush=True)
        if state.get('readyState') == 'complete' and not state.get('campus'):
            print('  boot: the module never exported __CAMPUS after load', flush=True)
            return False
    return False


def visible(page, selector):
    return page.evaluate("""(selector) => {
      const el = document.querySelector(selector);
      if (!el) return {found: false, visible: false};
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {found: true, visible: style.display !== 'none' && style.visibility !== 'hidden'
               && box.width > 0 && box.height > 0,
               display: style.display, box: {x: box.x, y: box.y, w: box.width, h: box.height}};
    }""", selector)


def hit(page, selector):
    """What a real pointer at the control's centre would reach."""
    return page.evaluate("""(selector) => {
      const el = document.querySelector(selector);
      if (!el) return {found: false};
      const box = el.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const top = document.elementFromPoint(x, y);
      return {found: true, x, y, reachable: !!top && (top === el || el.contains(top)),
              top: top ? (top.id || String(top.className) || top.tagName) : null,
              box: {x: box.x, y: box.y, w: box.width, h: box.height}};
    }""", selector)


def slide(page, input_id, value, output_id):
    return page.evaluate("""([inputId, value, outputId]) => {
      const input = document.getElementById(inputId);
      if (!input) return null;
      input.value = String(value);
      input.dispatchEvent(new Event('input', {bubbles: true}));
      const out = document.getElementById(outputId);
      return {value: Number(input.value), text: out ? out.textContent : null,
              settings: {...window.__CAMPUS.experience.settings}};
    }""", [input_id, value, output_id])


def run_desktop(page):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    # A chapter link is a real page load, and under SwiftShader a checkpoint
    # page has taken 54 s to fire `load` (measured 2026-11-25). The click's
    # post-navigation wait uses these budgets, not the 30 s default.
    page.set_default_timeout(120000)
    page.set_default_navigation_timeout(240000)
    check('boot: the pause card is the first screen', boot(page))

    # ---- The card owns the chapter actions and the settings it should.
    inside = page.evaluate("""() => {
      const card = document.querySelector('.pause-card');
      const chapters = document.querySelector('.pause-chapters');
      const settings = document.getElementById('pause-settings');
      const inCard = (node) => !!node && !!card && card.contains(node);
      return {
        chaptersInCard: inCard(chapters),
        settingsInCard: inCard(settings),
        settingsHidden: settings ? settings.hidden : null,
        replayInChapters: !!chapters && chapters.contains(document.getElementById('replay-intro')),
        checkpointInChapters: !!chapters && chapters.contains(document.getElementById('pause-checkpoint')),
        checkpointText: (document.getElementById('pause-checkpoint') || {}).textContent,
        groups: [...document.querySelectorAll('.pause-chapter-group')].map((n) => n.textContent),
        title: document.getElementById('pause-chapters-title')
          ? document.getElementById('pause-chapters-title').textContent : null,
      };
    }""")
    check('card: the Chapter section is on the card', inside['chaptersInCard'] and inside['title'] == 'Chapter', inside)
    check('card: Replay intro sits inside the Chapter section', inside['replayInChapters'], inside)
    check('card: Return to checkpoint sits inside the Chapter section',
          inside['checkpointInChapters'] and (inside['checkpointText'] or '').strip() == 'Return to checkpoint', inside)
    check('card: the Settings section is on the card and not hidden',
          inside['settingsInCard'] and inside['settingsHidden'] is False, inside)

    replay = visible(page, '#replay-intro')
    replay_hit = hit(page, '#replay-intro')
    check('replay: visible, at least 48 px tall and not covered by the overlay',
          replay['visible'] and replay['box']['h'] >= 48 and replay_hit['reachable'],
          {'box': replay.get('box'), 'hit': replay_hit})
    focusable = page.evaluate(
        "() => { const b = document.getElementById('replay-intro'); if (!b) return false; b.focus();"
        " return document.activeElement === b; }")
    check('replay: focusable from the keyboard', focusable)

    # ---- The floating link that could never be clicked is gone while paused.
    link = visible(page, '.shell-chapters')
    toggle = visible(page, '.fullscreen-toggle')
    check('overlay: the floating Chapters link exists but is hidden while paused',
          link['found'] and not link['visible'], link)
    check('overlay: the floating fullscreen button is hidden while paused',
          toggle['found'] and not toggle['visible'], toggle)

    # ---- The chapter list is collapsed by default, then complete. Chrome keeps
    #      closed-details children in layout (content-visibility: hidden), so a
    #      rect alone proves nothing: ask what a pointer at the centre would hit.
    REACHABLE = """() => {
      const reachable = (el) => {
        const box = el.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return !!top && (top === el || el.contains(top));
      };
      return [...document.querySelectorAll('a.pause-chapter-link')].filter(reachable)
        .map((a) => a.dataset.checkpoint);
    }"""
    collapsed = page.evaluate("""() => ({
      open: document.querySelector('.pause-chapter-select').open,
      links: document.querySelectorAll('a.pause-chapter-link').length,
    })""")
    collapsed_reachable = page.evaluate(REACHABLE)
    check('chapters: eight checkpoint links exist and stay collapsed until asked for',
          collapsed['links'] == len(CHECKPOINT_IDS) and collapsed['open'] is False
          and collapsed_reachable == [], {'details': collapsed, 'reachable': collapsed_reachable})

    page.click('.pause-chapter-select > summary')
    page.wait_for_timeout(200)
    opened = page.evaluate("""() => ({
      open: document.querySelector('.pause-chapter-select').open,
      ids: [...document.querySelectorAll('a.pause-chapter-link')].map((a) => a.dataset.checkpoint),
      start: [...document.querySelectorAll('a.pause-chapter-start')].map((a) => ({text: a.textContent, href: a.getAttribute('href')})),
      groups: [...document.querySelectorAll('.pause-chapter-group')].map((n) => n.textContent),
    })""")
    opened_reachable = page.evaluate(REACHABLE)
    check('chapters: opening the select lists every checkpoint, and they are clickable',
          opened['open'] is True and opened['ids'] == CHECKPOINT_IDS and 'b6' in opened_reachable,
          {'details': opened, 'reachable': opened_reachable})
    check('chapters: the chapter start points at the opening, not a checkpoint',
          len(opened['start']) == 1 and opened['start'][0]['href'] == '?experience=opening', opened['start'])
    check('chapters: the list is grouped by chapter',
          len(opened['groups']) == 4 and opened['groups'][0].startswith('Chapter 1'), opened['groups'])
    shot(page, '1280x800', '01-chapters-open')

    # ---- Settings on the card write through to the experience and the dialog.
    #      Done before the chapter click: that click is a full page load and,
    #      under SwiftShader, a second cold boot has cost minutes. The card is
    #      the same on both pages, so testing it here loses nothing.
    music = slide(page, 'pause-music', 0.5, 'pause-music-out')
    ambient = slide(page, 'pause-ambient', 0.4, 'pause-ambient-out')
    sensitivity = slide(page, 'pause-sensitivity', 0.0044, 'pause-sensitivity-out')
    check('settings: Music volume writes 0.50 and prints 50%',
          bool(music) and abs(music['settings'].get('music', -1) - 0.5) < 1e-9 and music['text'] == '50%', music)
    check('settings: Ambient volume writes 0.40 and prints 40%',
          bool(ambient) and abs(ambient['settings'].get('ambient', -1) - 0.4) < 1e-9
          and ambient['text'] == '40%', ambient)
    check('settings: Mouse sensitivity writes 0.0044 and prints 2.00x',
          bool(sensitivity) and abs(sensitivity['settings'].get('sensitivity', -1) - 0.0044) < 1e-9
          and sensitivity['text'] == '2.00×', sensitivity)

    page.click('#experience-settings')
    dialog_up = until(page, "() => !!document.querySelector('.opening-dialog--settings')", timeout=30)
    dialog = page.evaluate("""() => [...document.querySelectorAll('.opening-dialog--settings .opening-setting-input')]
      .map((input) => ({label: input.getAttribute('aria-label'), value: Number(input.value)}))""")
    values = {row['label']: row['value'] for row in dialog if row['label']}
    check('settings: the full dialog shows the card\'s three values',
          dialog_up and abs(values.get('Music volume', -1) - 0.5) < 1e-9
          and abs(values.get('Ambient volume', -1) - 0.4) < 1e-9
          and abs(values.get('Mouse sensitivity', -1) - 0.0044) < 1e-9, values)
    shot(page, '1280x800', '02-settings-dialog')
    close = visible(page, '.opening-dialog--settings .opening-dialog-close')
    if close['found']:
        page.click('.opening-dialog--settings .opening-dialog-close')
        until(page, "() => !document.querySelector('.opening-dialog--settings')", timeout=20)

    # ---- The card's own fullscreen button, where the API exists.
    card_back = until(page, "() => { const p = document.getElementById('pause-panel'); return !!p && !p.hidden; }",
                      timeout=20)
    fullscreen = page.evaluate("""() => {
      const button = document.getElementById('pause-fullscreen');
      if (!button) return {found: false};
      const box = button.getBoundingClientRect();
      return {found: true, api: !!window.__CAMPUS.fullscreen.api, text: button.textContent.trim(),
              visible: !button.hidden && getComputedStyle(button).display !== 'none'
                       && box.width > 0 && box.height > 0};
    }""")
    check('fullscreen: the card carries a working Full screen button',
          card_back and fullscreen['found'] and fullscreen['visible'] == fullscreen['api']
          and (not fullscreen['api'] or fullscreen['text'] == 'Full screen'), fullscreen)

    # ---- Playing hides the card and brings the floating controls back.
    #      Closing the settings dialog hands control back with enter(), which
    #      requests real pointer lock. Headless Chrome denies it and pauses with
    #      `pointer_lock_failed` — asynchronously, so one enterCompat() issued
    #      right after the close gets undone by that late pause (measured
    #      2026-11-25: panel still up, paused again). Let the failure land, then
    #      take the shipped drag-controls path the card offers as "Drag controls".
    page.wait_for_timeout(600)
    playing = False
    for _ in range(3):
        page.evaluate("() => { try { window.__CAMPUS.explorer.enterCompat(); } catch (error) {} }")
        if until(page, "() => window.__CAMPUS.explorer.game.paused === false", timeout=15):
            page.wait_for_timeout(400)  # a late pointer-lock failure must not re-pause silently
            playing = page.evaluate("() => window.__CAMPUS.explorer.game.paused === false")
            if playing:
                break
    # The card is hidden from the viewer's per-frame callback, not from
    # enterCompat() itself, so under SwiftShader contention a single slow frame
    # leaves it up after `paused` has already flipped false (measured 2026-11-25
    # at load 22: paused false, panelHidden false 400 ms after the call, gone a
    # frame later). Poll for the hide rather than sampling one moment — the
    # check below still fails if the card never goes away.
    card_gone = playing and until(
        page, "() => { const p = document.getElementById('pause-panel'); return !!p && p.hidden; }", timeout=20)
    back = page.evaluate("""() => {
      const shown = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = getComputedStyle(el);
        return style.display !== 'none' && el.getBoundingClientRect().width > 0;
      };
      const panel = document.getElementById('pause-panel');
      const game = window.__CAMPUS.explorer.game;
      return {panelHidden: !panel || panel.hidden, chapters: shown('.shell-chapters'),
              fullscreen: shown('.fullscreen-toggle'), paused: game.paused, reason: game.reason || null};
    }""")
    check('overlay: playing hides the card and shows the floating controls again',
          playing and card_gone and back['panelHidden'] and back['chapters'] is True
          and back['fullscreen'] is True, {**back, 'card_gone': card_gone})

    page.evaluate("() => { window.__CAMPUS.explorer.pause('gate'); }")
    paused_again = until(page, "() => { const p = document.getElementById('pause-panel'); return !!p && !p.hidden; }",
                         timeout=30)
    hidden_again = page.evaluate("""() => {
      const el = document.querySelector('.shell-chapters');
      return el ? getComputedStyle(el).display : null;
    }""")
    check('overlay: pausing hides the floating Chapters link again',
          paused_again and hidden_again == 'none', {'paused': paused_again, 'display': hidden_again})

    shot(page, '1280x800', '03-pause-card')
    check('desktop: no page errors so far', not errors, errors[:4])

    # ---- Last, because it replaces the document: a real click on a chapter row
    #      navigates, the thing the floating link could never do. "B4 · Fetch the
    #      MacBook" is checkpoint b6.
    #
    #      `wait_for_url` matches at navigation START, while the old document is
    #      still current and its `__CAMPUS.ready` is still true — so polling for
    #      ready right after it returns against the OLD page and the following
    #      evaluate lands in the NEW one mid-load (seen 2026-11-25:
    #      "Cannot read properties of undefined (reading 'explorer')").
    #      expect_navigation ends when the new document reaches `load`.
    if not page.evaluate("() => document.querySelector('.pause-chapter-select').open"):
        page.click('.pause-chapter-select > summary')
        page.wait_for_timeout(200)
    navigated = False
    try:
        with page.expect_navigation(wait_until='load', timeout=240000):
            page.click('a.pause-chapter-link[data-checkpoint="b6"]')
        navigated = 'checkpoint=b6' in page.url
    except PlaywrightTimeoutError:
        navigated = False
    check('navigation: clicking "B4 · Fetch the MacBook" loads checkpoint=b6', navigated, page.url)
    if navigated:
        booted = until(page, '() => !!(window.__CAMPUS && window.__CAMPUS.ready)', timeout=240)
        landed = page.evaluate("""() => ({
          copy: (document.querySelector('.pause-card p') || {}).textContent || '',
          replayHidden: document.getElementById('replay-intro')?.hidden === true,
          paused: window.__CAMPUS.explorer.game.paused,
        })""") if booted else {}
        check('navigation: the checkpoint build boots and names the checkpoint',
              booted and landed.get('copy', '').startswith('Checkpoint: B4'), {'booted': booted, **landed})
        check('navigation: a checkpoint hides Replay intro, which cannot play there',
              booted and landed.get('replayHidden') is True, {'booted': booted, **landed})
    check('desktop: no page errors', not errors, errors[:4])


def tap(page, selector):
    box = page.evaluate("""(selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {x: b.x + b.width / 2, y: b.y + b.height / 2};
    }""", selector)
    if not box:
        return False
    page.touchscreen.tap(box['x'], box['y'])
    return True


def run_phone(browser):
    context = browser.new_context(viewport=PHONE, has_touch=True, is_mobile=True, device_scale_factor=2)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(120000)
    page.set_default_navigation_timeout(240000)
    check('phone: the pause card opens on a 390x844 touch device', boot(page))
    replay = visible(page, '#replay-intro')
    check('phone: Replay intro is a 48 px touch target inside the Chapter section',
          replay['visible'] and replay['box']['h'] >= 48, replay)

    check('phone: tapping Chapter select opens the list', tap(page, '.pause-chapter-select > summary'))
    shown = until(page, """() => document.querySelector('.pause-chapter-select').open
        && document.querySelectorAll('a.pause-chapter-link').length === 8""", timeout=20)
    shot(page, '390x844', '01-chapters-open')
    check('phone: all eight checkpoints are in the list', shown)

    # A player scrolls the list to reach a row on a phone; so does the gate,
    # then the tap goes through the touch pipeline at the row's real position.
    try:
        page.locator('a.pause-chapter-link[data-checkpoint="b6"]').scroll_into_view_if_needed(timeout=20000)
        scrolled = True
    except PlaywrightTimeoutError:
        scrolled = False
    check('phone: the chapter row can be scrolled into reach', scrolled)
    # Same navigation race as on desktop: expect_navigation ends when the new
    # document loads, so the readiness wait below cannot be answered by the old
    # page and pass without the checkpoint ever booting.
    loaded = False
    try:
        with page.expect_navigation(wait_until='load', timeout=240000):
            tapped = tap(page, 'a.pause-chapter-link[data-checkpoint="b6"]')
        loaded = bool(tapped) and 'checkpoint=b6' in page.url
    except PlaywrightTimeoutError:
        loaded = False
    check('phone: tapping "B4 · Fetch the MacBook" navigates', loaded, page.url)
    check('phone: the checkpoint page loads', loaded and until(
        page, '() => window.__CAMPUS && window.__CAMPUS.ready && document.getElementById("pause-panel") && !document.getElementById("pause-panel").hidden',
        timeout=240), page.url)
    check('phone: no page errors', not errors, errors[:4])
    context.close()


def resume(page):
    """Resume through the shipped drag-controls path (headless refuses pointer lock)."""
    for _ in range(3):
        page.evaluate("() => { try { window.__CAMPUS.explorer.enterCompat(); } catch (error) {} }")
        if until(page, '() => window.__CAMPUS.explorer.game.paused === false', timeout=20):
            return True
    return False


EPILOGUE = ORIGIN + '?experience=opening&intro=0&shell=1&checkpoint=ending'


def run_epilogue(browser):
    """The pause card must stay usable above the epilogue overlay (2026-11-26).

    Playtest item 4: `#ending-overlay` is fixed, inset 0 and z-index 60, and it
    stays in the hit-test tree while its visuals fade (only its ::before and the
    Mac fade). The pause card at z-index 12 was therefore painted AND hit-tested
    underneath it: a mouse-only player could not click Continue, and the ending
    clock stayed frozen. The card is z-index 70 and the toast 71 now, and this
    gate drives the real epilogue: ?checkpoint=ending, a real Escape, a real
    pointer click, and the ending's own clock.
    """
    context = browser.new_context(viewport=VIEW)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(120000)
    check('epilogue: ?checkpoint=ending boots straight into the epilogue',
          boot(page, url=EPILOGUE))
    check('epilogue: the game runs before the overlay exists', resume(page))
    overlay = until(page, "() => !!document.getElementById('ending-overlay')", timeout=180)
    check('epilogue: the ending overlay is mounted', overlay)
    stage = page.evaluate('() => window.__CAMPUS.campaign.state().stage') if overlay else None
    check('epilogue: the campaign is at the ending stage', stage == 'ending', {'stage': stage})
    if overlay:
        # Pause at once: the 14 s ending holds still while the slow checks run.
        page.keyboard.press('Escape')
        card = until(page, """() => { const p = document.getElementById('pause-panel');
          return !!p && !p.hidden && getComputedStyle(p).display !== 'none'; }""", timeout=60)
        enter = hit(page, '#enter-game') if card else {'reachable': False}
        check('epilogue: the pause card is painted and hit-tested above the overlay',
              card and enter.get('reachable') is True, {'card': card, 'hit': enter})

        page.evaluate("""() => { window.__probe = 0;
          const b = document.getElementById('enter-game');
          if (b) b.addEventListener('click', () => { window.__probe += 1; }, {once: true}); }""")
        if enter.get('found'):
            page.mouse.click(enter['x'], enter['y'])
        clicked = until(page, '() => window.__probe > 0', timeout=20)
        check('epilogue: a real click on Continue reaches the button', clicked)

        page.keyboard.press('Escape')
        again = until(page, """() => { const p = document.getElementById('pause-panel');
          return !!p && !p.hidden && getComputedStyle(p).display !== 'none'; }""", timeout=60)
        checkpoint = hit(page, '#pause-checkpoint') if again else {'reachable': False}
        check('epilogue: Return to checkpoint is reachable on the epilogue card',
              again and checkpoint.get('reachable') is True, {'again': again, 'hit': checkpoint})
        if checkpoint.get('found'):
            page.mouse.click(checkpoint['x'], checkpoint['y'])
        toasted = until(page, """() => { const t = document.getElementById('toast');
          return !!t && t.classList.contains('show') && (t.textContent || '').includes('no checkpoint'); }""",
                        timeout=30)
        stage = page.evaluate('() => window.__CAMPUS.campaign.state().stage')
        check('epilogue: the refusal is spoken and the stage does not move',
              toasted and stage == 'ending', {'toast': toasted, 'stage': stage})
        # The toast is pointer-events:none by design, so hit-testing skips it even
        # when it paints on top. Re-enable pointer events for one hit test (paint
        # order is unchanged) and restore the real value.
        toast_hit = page.evaluate("""() => {
          const t = document.getElementById('toast');
          if (!t) return {found: false};
          t.style.pointerEvents = 'auto';
          const box = t.getBoundingClientRect();
          const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          t.style.pointerEvents = '';
          return {found: true, reachable: !!top && (top === t || t.contains(top)),
                  top: top ? (top.id || String(top.className) || top.tagName) : null};
        }""")
        check('epilogue: the toast paints above the overlay', toast_hit.get('reachable') is True, toast_hit)

        check('epilogue: the game resumes for the clock check', resume(page))
        page.evaluate("""() => { window.__raf = 0;
          const tick = () => { window.__raf += 1; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }""")
        before = page.evaluate('() => window.__CAMPUS.campaign.debug.ending.state().clock')
        # The ending steps at most 2 s per frame (the stalled-tab cap), and a
        # software-rasterised crane frame here takes ~3.2 s, so a fixed 2.5 s
        # sleep can land between two frames and read the same clock twice
        # (measured 2026-11-26). Poll for the increase instead.
        moved = until(page, f'() => window.__CAMPUS.campaign.debug.ending.state().clock > {before}', timeout=30)
        after = page.evaluate('() => window.__CAMPUS.campaign.debug.ending.state().clock')
        state = page.evaluate("""() => { const g = window.__CAMPUS.explorer.game;
          return {clock: window.__CAMPUS.campaign.debug.ending.state().clock,
            paused: g.paused, pauseReason: g.pauseReason || null,
            raf: window.__raf, stage: window.__CAMPUS.campaign.state().stage,
            credits: !!document.getElementById('ending-credits'),
            lastEvents: (g.events || []).slice(-10).map(e => [e.seq, e.type, e.data && e.data.reason])}; }""")
        check('epilogue: the ending clock advances after the resume',
              moved and before is not None and after > before,
              {'before': before, 'after': after, 'state': state})
    check('epilogue: no page errors', not errors, errors[:4])
    context.close()


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=HEADLESS, args=ARGS, executable_path=CHROME)
        page = browser.new_page(viewport=VIEW)
        run_desktop(page)
        # Close the desktop page before the phone run: its rAF loop keeps
        # rendering the campus, and under SwiftShader that contention alone
        # stretches the phone boot past its budget.
        page.close()
        run_phone(browser)
        run_epilogue(browser)
        browser.close()
    total = passed + len(failures)
    print(f'\ncheck-pause-menu: {passed}/{total} passed')
    if failures:
        print('failed: ' + ', '.join(failures))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
