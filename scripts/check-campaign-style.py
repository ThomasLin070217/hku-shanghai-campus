"""One look: every campaign overlay wears the opening dark HUD.

Run against a dev/review server (the checkpoints need `window.__CAMPUS`):
  CAMPUS_URL=http://127.0.0.1:5254/ python3 scripts/check-campaign-style.py

Asserts, at 960 x 540:
- the objective card, hearts, minimap, hotbar, chapter card, lock panel, rescue
  banner, credits and the chapter menu use the opening body font (Inter first)
  and the opening paper colour;
- display headings use Georgia;
- accent text is the opening green (#74e6b4) or gold (#ffb648);
- no visible overlay element still starts with Segoe UI or system-ui;
- the objective card is compact (<= 22% of the viewport height);
- the hotbar is docked inside the bottom 16% of the viewport, compact, and
  fades to low opacity after ~2 s without a selection change, then comes back
  on a number key;
- in a B4 focus view the objective card collapses to one line, the minimap is
  hidden and the vitals shrink to one compact row.

Screenshots for owner review land in /tmp/one-world/t5/ (override with
CAMPUS_SHOTS).
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5254/')
SHOTS = os.environ.get('CAMPUS_SHOTS', '/tmp/one-world/t5')
CHROME = os.environ.get('CHROME_PATH') or (
    '/Users/onezion12344/Library/Caches/ms-playwright/chromium-1208/'
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
VIEW = {'width': 960, 'height': 540}
CHECKPOINTS = ['b4', 'b4-inside', 'lawn', 'sports', 'ending']

INK = 'rgb(232, 244, 238)'
INK_SOFT = 'rgb(164, 188, 177)'
GREEN = 'rgb(116, 230, 180)'
GOLD = 'rgb(255, 182, 72)'
PAPER = 'rgba(8, 18, 15, 0.92)'

# Every overlay surface the one-world run can show. Hidden members are skipped.
SURFACES = (
    '.opening-hud, .opening-hud *, .opening-objective, .opening-distance, '
    '.opening-hearts, .opening-hearts *, .opening-mapcard, .opening-mapcard *, '
    '.opening-prompt, .opening-prompt *, .campaign-card, .campaign-card *, '
    '#inventory-hud, #inventory-hud *, #inventory-modal, #inventory-modal *, '
    '#door-prompt, #door-lock-panel, #door-lock-panel *, '
    '#rescue-banner, #rescue-banner *, '
    '#ending-overlay, #ending-overlay *, #ending-credits, #ending-credits *'
)

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


def first_family(font):
    return font.split(',')[0].strip().strip('"').strip("'").lower()


def is_paper(bg, image=''):
    """The opening paper colour: the token itself, its gradient, or the deep variant."""
    for value in (bg, image):
        if not value:
            continue
        if 'rgba(8, 18, 15' in value or 'rgb(8, 18, 15' in value:
            return True
        if 'rgba(11, 24, 20' in value or 'rgb(11, 24, 20' in value:
            return True
        if 'rgba(10, 23, 19' in value and 'rgba(5, 13, 11' in value:
            return True
    return False


STYLE = """sel => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    font: cs.fontFamily, color: cs.color, bg: cs.backgroundColor, image: cs.backgroundImage,
    display: cs.display, visibility: cs.visibility, opacity: Number(cs.opacity),
    width: Math.round(r.width), height: Math.round(r.height),
    top: Math.round(r.top), bottom: Math.round(r.bottom), hidden: el.hidden === true,
    text: (el.textContent || '').trim().slice(0, 80),
    whiteSpace: cs.whiteSpace, overflow: cs.overflow,
  };
}"""

VISIBLE = """sel => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return !el.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' &&
    Number(cs.opacity) > 0.02 && r.width > 1 && r.height > 1;
}"""

BAD_FONTS = """arg => {
  const [root, extra] = arg;
  const nodes = [];
  if (root) { const el = document.querySelector(root); if (el) nodes.push(...el.querySelectorAll('*')); }
  if (extra) nodes.push(...document.querySelectorAll(extra));
  const visible = el => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return !el.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' &&
      Number(cs.opacity) > 0.02 && r.width > 1 && r.height > 1;
  };
  const bad = [];
  for (const el of nodes) {
    if (!visible(el)) continue;
    const first = (getComputedStyle(el).fontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (first === 'segoe ui' || first === 'system-ui' || first === '-apple-system') {
      bad.push((el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : el.tagName) + ' -> ' + getComputedStyle(el).fontFamily);
    }
  }
  return [...new Set(bad)].slice(0, 8);
}"""


def style(page, selector):
    return page.evaluate(STYLE, selector)


def visible(page, selector):
    return page.evaluate(VISIBLE, selector)


def shot(page, name):
    os.makedirs(SHOTS, exist_ok=True)
    page.screenshot(path=os.path.join(SHOTS, name))


def open_checkpoint(page, checkpoint):
    page.goto(ORIGIN + '?experience=opening&checkpoint=' + checkpoint, wait_until='load')
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.campaign && window.__CAMPUS.openingDebug', timeout=90000)
    page.evaluate('() => { try { window.__CAMPUS.explorer.enterCompat(); } catch (e) {} }')
    page.wait_for_timeout(1200)


def assert_body_font(checkpoint, name, value):
    check(checkpoint + ': ' + name + ' uses the opening body font', bool(value) and first_family(value['font']) == 'inter',
          value and value['font'])


def assert_paper(checkpoint, name, value):
    check(checkpoint + ': ' + name + ' uses the opening paper colour', bool(value) and is_paper(value['bg'], value['image']),
          value and (value['bg'] + ' / ' + value['image'][:90]))


def assert_surfaces_fonts(page, checkpoint, root=None):
    bad = page.evaluate(BAD_FONTS, [root, SURFACES])
    check(checkpoint + ': no visible overlay element starts with Segoe UI / system-ui', not bad, bad)


def assert_hud(page, checkpoint):
    hud = style(page, '.opening-hud')
    check(checkpoint + ': objective card is visible', visible(page, '.opening-hud'), hud)
    assert_body_font(checkpoint, 'objective card', hud)
    assert_paper(checkpoint, 'objective card', hud)
    objective = style(page, '.opening-objective')
    assert_body_font(checkpoint, 'objective line', objective)
    check(checkpoint + ': objective card height <= 22% of the viewport (<= 118 px)',
          bool(hud) and hud['height'] <= VIEW['height'] * 0.22, hud and hud['height'])
    # The permanent save line is gone; saves are a toast.
    check(checkpoint + ': no permanent "Saved on this device." line', not visible(page, '.opening-save'),
          style(page, '.opening-save'))

    hearts = style(page, '.opening-hearts')
    check(checkpoint + ': vitals are visible', visible(page, '.opening-hearts'), hearts)
    assert_body_font(checkpoint, 'vitals', hearts)
    assert_paper(checkpoint, 'vitals', hearts)
    label = style(page, '.opening-hearts-label')
    check(checkpoint + ': vitals label is the opening gold', bool(label) and label['color'] == GOLD, label and label['color'])

    minimap = style(page, '.opening-mapcard')
    check(checkpoint + ': minimap is visible while walking', visible(page, '.opening-mapcard'), minimap)
    assert_paper(checkpoint, 'minimap', minimap)

    eyebrow = style(page, '.opening-hud .opening-eyebrow')
    check(checkpoint + ': HUD eyebrow is the opening green', bool(eyebrow) and eyebrow['color'] == GREEN, eyebrow and eyebrow['color'])

    if checkpoint == 'b4':
        # The save status now lives in a short toast, styled with the HUD tokens.
        toast = style(page, '.opening-save-toast')
        check('b4: save status is a toast on the opening paper',
              bool(toast) and is_paper(toast['bg'], toast['image']) and toast['color'] == GREEN,
              toast and (toast['bg'] + ' / ' + toast['color']))


def assert_hotbar(page, checkpoint):
    hud = style(page, '#inventory-hud')
    bar = style(page, '#inventory-hud .hotbar')
    check(checkpoint + ': hotbar is visible', visible(page, '#inventory-hud .hotbar'), bar)
    assert_body_font(checkpoint, 'hotbar dock', hud)
    assert_paper(checkpoint, 'hotbar', bar)
    check(checkpoint + ': hotbar is compact (<= 420 px wide)',
          bool(bar) and bar['width'] <= 420, bar and bar['width'])
    check(checkpoint + ': hotbar sits inside the bottom 16% of the viewport',
          bool(bar) and bar['bottom'] <= VIEW['height'] and bar['top'] >= VIEW['height'] * 0.84,
          bar and (bar['top'], bar['bottom']))
    # ~2 s after a selection change the bar fades; a number key brings it back.
    # Software WebGL can spend longer than the 0.35 s transition on one frame, so
    # disable the animation and read the rule's target opacity instead.
    selected = page.evaluate("() => window.__CAMPUS.explorer.game.inventory.selectedHotbar")
    page.evaluate("() => { document.getElementById('inventory-hud').style.transition = 'none'; }")
    faded = None
    try:
        page.wait_for_function(
            "() => { const e = document.getElementById('inventory-hud');"
            " return !!e && Number(getComputedStyle(e).opacity) <= 0.35; }", timeout=10000)
        faded = style(page, '#inventory-hud')
    except Exception:
        faded = style(page, '#inventory-hud')
    check(checkpoint + ': hotbar fades to low opacity when idle',
          bool(faded) and faded['opacity'] <= 0.35, faded and faded['opacity'])
    # Press the digit of the slot that is already selected: the selection does not
    # change, so only the hotbar's own number-key listener can wake the dock.
    # The keydown handler runs synchronously, so read before the next idle timer.
    page.keyboard.press(str(selected + 1))
    awake = page.evaluate(
        "() => { const e = document.getElementById('inventory-hud');"
        " return {opacity: Number(getComputedStyle(e).opacity),"
        " idle: e.classList.contains('is-idle')}; }")
    check(checkpoint + ': hotbar comes back on a number key',
          bool(awake) and awake['opacity'] >= 0.9 and not awake['idle'], awake)


def assert_chapter_card(page, checkpoint):
    title = style(page, '.campaign-card-title')
    card = style(page, '.campaign-card')
    if card is None:
        # The B4 approach and its interior sit inside Chapter 1: the host has no
        # boundary card there. Every later checkpoint is a boundary and must show one.
        check(checkpoint + ': chapter card is absent only inside a chapter',
              checkpoint in ('b4', 'b4-inside'), card)
        return
    check(checkpoint + ': chapter card title uses Georgia',
          bool(title) and first_family(title['font']) == 'georgia', title and title['font'])
    check(checkpoint + ': chapter card uses the opening paper colour',
          is_paper(card['bg'], card['image']), card)


def focus_checks(page):
    page.evaluate("() => window.__CAMPUS.campaign.debug.b4.focus('keyboard')")
    page.wait_for_timeout(500)
    hud = style(page, '.opening-hud')
    objective = style(page, '.opening-objective')
    check('b4 focus: objective card collapses to one line (<= 48 px)',
          bool(hud) and hud['height'] <= 48, hud and hud['height'])
    check('b4 focus: the minimap is hidden', not visible(page, '.opening-mapcard'), style(page, '.opening-mapcard'))
    check('b4 focus: objective text stays on one line',
          bool(objective) and objective['whiteSpace'] == 'nowrap', objective and objective['whiteSpace'])
    hearts = style(page, '.opening-hearts')
    check('b4 focus: vitals shrink to one compact row (<= 30 px)',
          bool(hearts) and hearts['height'] <= 30, hearts and hearts['height'])
    shot(page, 'check-b4-focus.png')
    page.evaluate('() => window.__CAMPUS.campaign.debug.b4.leave()')
    page.wait_for_timeout(300)
    check('b4 focus: minimap returns after stepping back', visible(page, '.opening-mapcard'), style(page, '.opening-mapcard'))


def sudoku_answer():
    """The four blank digits, derived from the puzzle rows (row-major blanks)."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    try:
        with open(os.path.join(root, 'content', 'puzzles', 'sports-hall-lock.json'), encoding='utf-8') as f:
            rows = json.load(f)['rows']
        digits = ''
        for row in rows:
            for ch in row:
                if ch == '*':
                    digits += next(d for d in '123456789' if d not in row)
        return digits
    except Exception:
        return ''


def sports_lock_checks(page):
    # Stand at the checkpoint's own objective point, face the door (west). The
    # walking leg attaches the sports chapter on a rendered frame, and software
    # WebGL runs at a few frames per second, so wait on state, never a fixed delay.
    page.evaluate("""() => {
      const o = window.__CAMPUS.campaign.objective();
      const g = window.__CAMPUS.explorer.game;
      if (o && o.target) { g.body.position.set(o.target[0], o.target[1], o.target[2]); g.body.velocity.set(0, 0, 0); }
      g.yaw = Math.PI / 2;
    }""")
    page.wait_for_function("() => window.__CAMPUS.campaign.state().stage === 'sports'", timeout=20000)
    page.wait_for_function(
        "() => { const p = document.getElementById('door-prompt'); return !!p && !p.hidden; }", timeout=20000)
    page.keyboard.press('f')
    page.wait_for_function(
        "() => { const p = document.getElementById('door-lock-panel'); return !!p && !p.hidden; }", timeout=20000)
    page.wait_for_timeout(300)
    panel = style(page, '#door-lock-panel > section')
    check('sports: the lock panel opens on F', visible(page, '#door-lock-panel > section'), panel)
    assert_body_font('sports', 'lock panel', panel)
    assert_paper('sports', 'lock panel', panel)
    heading = style(page, '#door-lock-panel h2')
    check('sports: lock panel heading uses Georgia', bool(heading) and first_family(heading['font']) == 'georgia',
          heading and heading['font'])
    eyebrow = style(page, '#door-lock-panel .eyebrow')
    check('sports: lock panel eyebrow is the opening green', bool(eyebrow) and eyebrow['color'] == GREEN,
          eyebrow and eyebrow['color'])
    shot(page, 'check-sports-lock.png')
    # Solve the real lock (sudoku answers come from the puzzle content), then read
    # the rescue banner. The chapter's debug `open()` bypasses the DOM runtime's
    # showRescue, so it cannot prove the banner's look.
    answer = sudoku_answer()
    check('sports: the puzzle answers are readable from the content file', len(answer) == 4, answer)
    inputs = page.locator('#door-lock-grid input')
    for i, digit in enumerate(answer):
        inputs.nth(i).fill(digit)
    page.click('#door-lock-confirm')
    page.wait_for_function(
        "() => { const s = document.getElementById('door-lock-password-step'); return !!s && !s.hidden; }",
        timeout=15000)
    for digit in answer:
        page.click('#door-lock-keypad [data-key="%s"]' % digit)
    page.click('#door-lock-keypad [data-key="ok"]')
    page.wait_for_function(
        "() => { const b = document.getElementById('rescue-banner'); return !!b && !b.hidden; }",
        timeout=20000)
    banner = style(page, '#rescue-banner > div')
    check('sports: the rescue banner shows after the door opens', visible(page, '#rescue-banner > div'), banner)
    assert_body_font('sports', 'rescue banner', banner)
    assert_paper('sports', 'rescue banner', banner)
    heading = style(page, '#rescue-banner h2')
    check('sports: rescue banner heading uses Georgia', bool(heading) and first_family(heading['font']) == 'georgia',
          heading and heading['font'])
    shot(page, 'check-sports-banner.png')


def credits_checks(page):
    # The epilogue runs on update(dt), and software WebGL only manages a handful
    # of frames per second, so the 14 s Mac sequence would need minutes of wall
    # clock. Render the 3D canvas smaller while waiting; the overlay is DOM and
    # the screenshot is taken at full size afterwards.
    try:
        page.evaluate("() => { const r = window.__CAMPUS.viewer.renderer;"
                      " r.setPixelRatio(0.5); r.setSize(480, 270, false); }")
    except Exception:
        pass
    try:
        page.wait_for_function("() => !!document.getElementById('ending-credits')", timeout=150000)
        # The card's own fade is a transition; frames are scarce here, so the
        # computed opacity is read with the animation off.
        page.evaluate("() => { const e = document.getElementById('ending-credits'); if (e) e.style.transition = 'none'; }")
        page.wait_for_function(
            "() => { const e = document.getElementById('ending-credits');"
            " return !!e && e.classList.contains('show'); }", timeout=20000)
    except Exception:
        pass
    try:
        page.evaluate("() => { const r = window.__CAMPUS.viewer.renderer;"
                      " r.setPixelRatio(1); r.setSize(960, 540, false); }")
    except Exception:
        pass
    page.wait_for_timeout(500)
    credits = style(page, '#ending-credits-card')
    check('ending: credits card appears', visible(page, '#ending-credits-card'), credits)
    assert_body_font('ending', 'credits', credits)
    heading = style(page, '#ending-credits-card h2')
    check('ending: credits title uses Georgia', bool(heading) and first_family(heading['font']) == 'georgia',
          heading and heading['font'])
    kicker = style(page, '#ending-credits-card .ending-kicker')
    check('ending: credits kicker is the opening green', bool(kicker) and kicker['color'] == GREEN,
          kicker and kicker['color'])
    shot(page, 'check-ending-credits.png')


def menu_checks(page):
    page.goto(ORIGIN + '?experience=levels', wait_until='load')
    page.wait_for_timeout(700)
    body = style(page, 'body')
    assert_body_font('menu', 'page', body)
    check('menu: page uses the opening ink', bool(body) and body['color'] == INK, body and body['color'])
    check('menu: page background is the opening paper',
          bool(body) and (is_paper(body['bg'], body['image']) or is_paper('', body['image'])),
          body and (body['bg'] + ' / ' + body['image'][:90]))
    h1 = style(page, '.levels h1')
    check('menu: display heading uses Georgia', bool(h1) and first_family(h1['font']) == 'georgia', h1 and h1['font'])
    link = style(page, '.levels-list a b')
    assert_body_font('menu', 'chapter link', link)
    reset = style(page, '.levels-reset button')
    assert_body_font('menu', 'reset button', reset)
    accent = style(page, '.levels-heading span:last-child')
    gold = style(page, '.levels-list small')
    check('menu: accent text is the opening green or gold',
          (bool(accent) and accent['color'] == GREEN) or (bool(gold) and gold['color'] == GOLD),
          accent and accent['color'])
    assert_surfaces_fonts(page, 'menu', root='.levels')
    shot(page, 'check-menu.png')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=ARGS, headless=True)
        try:
            page = browser.new_page(viewport=VIEW)
            for checkpoint in CHECKPOINTS:
                print('\n==', checkpoint)
                open_checkpoint(page, checkpoint)
                assert_hud(page, checkpoint)
                assert_hotbar(page, checkpoint)
                assert_chapter_card(page, checkpoint)
                assert_surfaces_fonts(page, checkpoint)
                if checkpoint == 'b4-inside':
                    focus_checks(page)
                if checkpoint == 'sports':
                    sports_lock_checks(page)
                if checkpoint == 'ending':
                    credits_checks(page)
                shot(page, 'check-' + checkpoint + '.png')
            print('\n== menu')
            menu_checks(page)
        finally:
            browser.close()
    print('\n%d passed, %d failed' % (passed, len(failures)))
    if failures:
        print('FAILED: ' + '; '.join(failures))
        return 1
    print('OK: every overlay wears the opening dark HUD')
    return 0


if __name__ == '__main__':
    sys.exit(main())
