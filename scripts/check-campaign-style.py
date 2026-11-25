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
  hidden and the vitals shrink to one compact row;
- the credits hide the pause card and the ending overlay behind them, and no
  line of copy appears twice on the credits or the Mac panel;
- the Chapter 1 completion dialog names the chapter the campaign names, and the
  epilogue it leaves behind uses the same dark tokens.

Screenshots for owner review land in /tmp/one-world/t5/ (override with
CAMPUS_SHOTS).
"""
import json
import os
import re
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


def rgb_triplet(value):
    try:
        return tuple(int(part) for part in value[value.index('(') + 1:value.index(')')].split(',')[:3])
    except Exception:
        return None


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
  const onScreen = r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  return !el.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' &&
    Number(cs.opacity) > 0.05 && r.width > 1 && r.height > 1 && onScreen;
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
    # Playwright's default screenshot timeout is 30 s. Under SwiftShader one
    # frame of the full campus can take longer than that on a loaded machine,
    # and a timed-out frame is not a style failure (seen 2026-11-26 on the
    # review build at 960x540: Page.screenshot Timeout 30000ms exceeded).
    page.screenshot(path=os.path.join(SHOTS, name), timeout=180000)


def open_checkpoint(page, checkpoint):
    page.goto(ORIGIN + '?experience=opening&checkpoint=' + checkpoint, wait_until='load')
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.campaign && window.__CAMPUS.openingDebug', timeout=240000)
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


def assert_no_stale_copy(page, label):
    text = page.evaluate("() => (document.body.innerText || '').toLowerCase()")
    hits = [phrase for phrase in ('current slice', 'not implemented') if phrase in text]
    check(label + ': no stale "current slice" / "not implemented" copy', not hits, text[:240])


def contrast(fg, bg):
    """WCAG contrast of two computed rgb()/rgba() colours (the card alpha is ignored: it sits on a dark scene)."""
    def lum(value):
        t = rgb_triplet(value) or (0, 0, 0)
        c = [x / 255 for x in t]
        c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    a, b = sorted((lum(fg), lum(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


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
    # FW2: the map inside the dark card is drawn on the dark tokens too.
    pixels = page.evaluate(MAP_PIXELS)
    check(checkpoint + ': the inner minimap is on dark ground (no light-cream plan)',
          bool(pixels) and pixels['mean'] < 70 and pixels['cream'] < 0.02, pixels)
    # The epilogue has no target (the objective's target is null), so no dot is drawn there.
    has_target = page.evaluate("() => { const c = window.__CAMPUS.campaign; const o = c && c.state() ? c.objective() : null;"
                               " return o ? !!o.target : true; }")
    check(checkpoint + ': the current target is the opening green on the minimap',
          bool(pixels) and (pixels['green'] > 0 or not has_target), {'pixels': pixels, 'target': has_target})

    # FU4: the distance line is readable on the dark card: ink-soft, contrast >= 4.5.
    dist = style(page, '.opening-hud .opening-distance-text')
    if dist and visible(page, '.opening-hud .opening-distance'):
        ratio = contrast(dist['color'], hud['bg'] if hud else PAPER)
        check(checkpoint + ': the distance line is the opening soft ink with contrast >= 4.5 (FU4)',
              dist['color'] == INK_SOFT and ratio >= 4.5, {'color': dist['color'], 'contrast': round(ratio, 2)})
    eyebrow = style(page, '.opening-hud .opening-eyebrow')
    check(checkpoint + ': HUD eyebrow is the opening green', bool(eyebrow) and eyebrow['color'] == GREEN, eyebrow and eyebrow['color'])

    if checkpoint == 'b4':
        # The save status now lives in a short toast, styled with the HUD tokens.
        toast = style(page, '.opening-save-toast')
        check('b4: save status is a toast on the opening paper',
              bool(toast) and is_paper(toast['bg'], toast['image']) and toast['color'] == GREEN,
              toast and (toast['bg'] + ' / ' + toast['color']))


MAP_PIXELS = """() => {
  const c = document.querySelector('.opening-mapcard canvas');
  if (!c || !c.width) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0, green = 0, cream = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    sum += 0.2126 * r + 0.7152 * g + 0.0722 * b; n++;
    if (Math.abs(r - 116) < 24 && Math.abs(g - 230) < 24 && Math.abs(b - 180) < 24) green++;
    if (r > 200 && g > 200 && b > 180) cream++;
  }
  return {mean: Math.round(sum / n), green, cream: +(cream / n).toFixed(3), size: [c.width, c.height]};
}"""


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
    # The slot tiles are what the player actually sees: the dark paper and the
    # small soft-ink numbers, not the survey mode's light 52 px tiles. Their
    # background has a 0.15 s transition; software WebGL can stall it mid-way,
    # so read the rule's target with the transition off.
    page.evaluate("() => { for (const s of document.querySelectorAll('#inventory-hud .item-slot'))"
                  " s.style.transition = 'none'; }")
    slot_style = page.evaluate("""() => {
      const slots = [...document.querySelectorAll('#inventory-hud .item-slot')];
      return slots.map(s => {
        const cs = getComputedStyle(s), num = s.querySelector('.slot-number');
        const ns = num ? getComputedStyle(num) : null;
        return {bg: cs.backgroundColor, numberColor: ns && ns.color, numberSize: ns && ns.fontSize};
      });
    }""")
    slot_bgs = [rgb_triplet(s['bg']) for s in slot_style]
    check(checkpoint + ': hotbar slots wear the opening dark paper',
          bool(slot_style) and all(c and max(c) <= 60 for c in slot_bgs),
          [s['bg'] for s in slot_style])
    check(checkpoint + ': slot numbers wear the opening soft ink at 8 px',
          bool(slot_style) and all(s['numberColor'] == INK_SOFT and s['numberSize'] == '8px' for s in slot_style),
          slot_style[:3])
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
    # The walking controls hint must not sit under the dock (nor show through
    # it while it is faded).
    boxes = page.evaluate("""() => {
      const bar = document.querySelector('#inventory-hud .hotbar');
      const hint = document.querySelector('.stage-bottom > span:first-child');
      const held = document.getElementById('held-name');
      if (!bar || !hint) return null;
      const b = bar.getBoundingClientRect(), h = hint.getBoundingClientRect();
      const heldBox = held ? held.getBoundingClientRect() : null;
      const hs = getComputedStyle(hint);
      return {
        bar: [Math.round(b.top), Math.round(b.bottom)],
        hint: [Math.round(h.top), Math.round(h.bottom)],
        held: heldBox && [Math.round(heldBox.top), Math.round(heldBox.bottom)],
        hintVisible: hs.display !== 'none' && hs.visibility !== 'hidden'
          && Number(hs.opacity) > 0.05 && h.width > 1 && h.height > 1,
        overlap: !(h.right <= b.left || h.left >= b.right || h.bottom <= b.top || h.top >= b.bottom),
        heldOverlap: !!heldBox && heldBox.height > 1
          && !(h.right <= heldBox.left || h.left >= heldBox.right || h.bottom <= heldBox.top || h.top >= heldBox.bottom),
      };
    }""")
    check(checkpoint + ': the controls hint stays clear of the faded hotbar',
          bool(boxes) and boxes['hintVisible'] and not boxes['overlap'] and not boxes['heldOverlap'], boxes)
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
        # The B4 approach sits inside Chapter 1: the host has no boundary card there.
        # b4-inside starts inside the B4 chapter and shows its card (M10).
        check(checkpoint + ': chapter card is absent only on the Building 4 approach',
              checkpoint == 'b4', card)
        return
    if checkpoint == 'b4-inside':
        kicker = page.evaluate("() => document.querySelector('.campaign-card-kicker')?.textContent ?? ''")
        check('b4-inside: the checkpoint shows the CHAPTER 1 · BUILDING 4 card',
              kicker == 'CHAPTER 1 · BUILDING 4', kicker)
    check(checkpoint + ': chapter card title uses Georgia',
          bool(title) and first_family(title['font']) == 'georgia', title and title['font'])
    check(checkpoint + ': chapter card uses the opening paper colour',
          is_paper(card['bg'], card['image']), card)


def toast_checks(page):
    """A save toast belongs to a real save, never to a load or a checkpoint start."""
    page.evaluate("() => { const t = document.querySelector('.opening-save-toast');"
                  " if (t) t.style.transition = 'none'; }")
    page.wait_for_timeout(700)
    # M2 / Ruling 33: the checkpoint start is an announced save, so at most that one
    # toast may have shown (at the first trusted input); a load never adds another.
    shows = page.evaluate("() => window.__toastShows || 0")
    check('toast: no save toast on load beyond the one checkpoint announcement', shows <= 1, shows)
    # The checkpoint toast is brief and can expire before this function runs, so
    # the init script on the page records every appearance from the first frame.
    log = page.evaluate("() => window.__toastLog || []")
    spurious = [text for text in log if not text.startswith('Saved on this device')]
    check('toast: no save toast before a real save', not spurious, log)
    # M2 / Ruling 33: the checkpoint start is an announced save. Before the first
    # trusted input this window does not own the save, so it lands (and shows) then.
    # The first trusted input on this page may already have been assert_hotbar's
    # number key; the observer counts every appearance since load.
    before = page.evaluate("() => window.__toastShows || 0")
    shown = before >= 1 or toast_after(page, lambda: page.keyboard.press('Shift'), 10000)
    check('toast: the checkpoint save is announced once, at the first input',
          shown and before <= 1, {'shows before Shift': before, 'shown': shown})
    # The fade is a fixed 2.4 s + 260 ms timer, not a per-frame animation, so the
    # rule's target is read with the transition disabled.
    page.wait_for_timeout(4000)
    check('toast: the save toast is gone 4 s after it appears',
          not visible(page, '.opening-save-toast'), style(page, '.opening-save-toast'))
    # Quiet saves: a hotbar switch and a hearts write both save, neither announces.
    revision = page.evaluate("() => window.__CAMPUS.explorer.game.inventory.revision")
    switched = toast_after(page, lambda: page.keyboard.press('Digit2'), 2500)
    switched_back = toast_after(page, lambda: page.keyboard.press('Digit1'), 2500)
    moved = page.evaluate("() => window.__CAMPUS.explorer.game.inventory.revision") != revision
    check('toast: no save toast on a hotbar switch', moved and not switched and not switched_back,
          {'revision moved': moved, 'toast': switched or switched_back})
    hurt = toast_after(page, lambda: page.evaluate("() => window.__CAMPUS.experience.hearts.damage(1)"), 2500)
    healed = toast_after(page, lambda: page.evaluate("() => window.__CAMPUS.experience.hearts.heal()"), 2500)
    check('toast: no save toast on a hearts write', not hurt and not healed, {'damage': hurt, 'heal': healed})


def toast_after(page, act, timeout):
    """Run `act`, then report whether a save toast appeared. Appearances are counted by a
    MutationObserver (init script), so a 2.4 s toast is never missed between slow frames."""
    since = page.evaluate("() => window.__toastShows || 0")
    act()
    try:
        page.wait_for_function("(n) => (window.__toastShows || 0) > n", arg=since, timeout=timeout)
        return True
    except Exception:
        return False


def boundary_toast_checks(page):
    """A campaign chapter boundary announces its save (M2); steps inside a chapter do not."""
    page.wait_for_timeout(4000)
    inside = toast_after(page, lambda: page.evaluate("() => window.__CAMPUS.campaign.emit('reach_lawn')"), 2500)
    check('toast: no save toast on a step inside a chapter (reach_lawn)', not inside,
          page.evaluate("() => window.__CAMPUS.campaign.state()?.stage"))
    # The CHAPTER 3 boundary attaches the sports chapter, which now builds the 100-student
    # crowd; its first frame uploads the atlas and compiles the crowd shaders under the
    # chapter card. Headless SwiftShader runs that frame at ~0.6 fps, and the toast lands
    # ~9 s after the emit (task-1-fix-report.md). This asserts the announcement, not latency.
    boundary = toast_after(page, lambda: page.evaluate("() => window.__CAMPUS.campaign.emit('guardian_shutdown')"), 15000)
    check('toast: the CHAPTER 3 boundary announces its save', boundary,
          page.evaluate("() => window.__CAMPUS.campaign.state()?.stage"))


VIEW_MODEL = """() => {
  try { const e = window.__CAMPUS.explorer, f = e.firstPerson;
    return {arms: f.root.visible, socket: f.socket.visible, held: !!f.held, view: e.game.view,
            panel: e.game.panel, pos: f.socket.position.toArray().map(n => +n.toFixed(3)),
            scale: +f.socket.scale.x.toFixed(3)}; } catch (e) { return null; }
}"""


def view_model(page):
    return page.evaluate(VIEW_MODEL)


def held_model_checks(page, checkpoint):
    """Ruling 36: in story mode the MacBook is stowed. No held model and no arms
    while walking; they show only while the player has it open with C."""
    page.wait_for_timeout(400)
    walking = view_model(page)
    check(checkpoint + ': no held MacBook and no arms while walking (story stow)',
          bool(walking) and walking['held'] and walking['view'] == 'first' and not walking['arms'], walking)
    if checkpoint != 'lawn':
        return
    shot(page, 'fw-lawn-walk.png')
    # FU0: pose and visibility are set together. The open is read in the same
    # evaluation that opens it, so no frame can come between them.
    same = page.evaluate("""() => { const e = window.__CAMPUS.explorer; e.openPanel('computer', true);
      const v = (""" + VIEW_MODEL + """)(); e.closePanel(); const w = (""" + VIEW_MODEL + """)(); return {open: v, closed: w}; }""")
    o, c = same['open'], same['closed']
    check('lawn: opening sets the authored pose on the same frame as visibility (FU0)',
          bool(o) and o['arms'] and abs(o['scale'] - 1) <= 0.02 and abs(o['pos'][1] + 0.30) <= 0.03, o)
    check('lawn: closing stows and restores the carry on the same frame (FU0)',
          bool(c) and not c['arms'] and c['scale'] <= 0.75, c)
    page.evaluate("() => { try { window.__CAMPUS.explorer.enterCompat(); } catch (e) {} }")
    page.wait_for_timeout(300)
    page.keyboard.press('KeyC')
    # Wait on the pose itself, not on visibility (the old race).
    try:
        page.wait_for_function("""() => { const s = window.__CAMPUS.explorer.firstPerson.socket;
          return window.__CAMPUS.explorer.firstPerson.root.visible && Math.abs(s.scale.x - 1) < .02; }""", timeout=8000)
    except Exception:
        pass
    opened = view_model(page)
    check('lawn: C opens the MacBook and shows it in the authored pose',
          bool(opened) and opened['arms'] and opened['socket'] and abs(opened['scale'] - 1) <= 0.02
          and abs(opened['pos'][1] + 0.30) <= 0.03, opened)
    os.makedirs('/tmp/one-world/fu', exist_ok=True)
    page.screenshot(path='/tmp/one-world/fu/fu0-open-macbook.png', timeout=180000)
    # FU7: the MacBook menu bar date is English, like its clock ("Sun 22 Nov").
    date = page.evaluate("() => document.querySelector('.mac-calendar')?.textContent ?? null")
    check('lawn: the MacBook menu-bar date is English, no CJK characters (FU7)',
          bool(date) and not re.search(r'[\u3000-\u9fff\uff00-\uffef]', date)
          and bool(re.match(r'^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$', date)), date)
    # C toggles the story MacBook closed (Escape may first close an app inside it).
    page.keyboard.press('KeyC')
    try:
        page.wait_for_function("() => window.__CAMPUS.openingDebug.state().modal === null && !window.__CAMPUS.explorer.game.panel", timeout=8000)
    except Exception:
        pass
    page.evaluate("() => { try { window.__CAMPUS.explorer.enterCompat(); } catch (e) {} }")
    page.wait_for_timeout(400)
    closed = view_model(page)
    check('lawn: closing the MacBook stows it again', bool(closed) and not closed['arms'] and not closed['panel'], closed)
    # FU6 (Ruling 39): from the door, the restored room reads as powered. Owner frame.
    page.evaluate("() => { const g = window.__CAMPUS.explorer.game; g.yaw = 0; g.pitch = 0; }")
    page.wait_for_timeout(1500)
    powered = page.evaluate("() => !!window.__CAMPUS.asset.root.getObjectByName('B4_powered_lights')")
    check('lawn: B4 keeps its powered lighting state after the player has left (FU6)', powered, powered)
    os.makedirs('/tmp/one-world/p1', exist_ok=True)
    page.screenshot(path='/tmp/one-world/p1/p1-door.png', timeout=180000)


def pause_bag_checks(page):
    """Esc and E are campaign overlays too: both wear the opening dark HUD."""
    page.keyboard.press('Escape')
    try:
        page.wait_for_function(
            "() => { const p = document.getElementById('pause-panel'); return !!p && !p.hidden; }",
            timeout=8000)
    except Exception:
        pass
    card = style(page, '.pause-card')
    check('pause: the Esc card opens', visible(page, '.pause-card'), card)
    assert_body_font('pause', 'card', card)
    assert_paper('pause', 'card', card)
    heading = style(page, '.pause-card h2')
    check('pause: card heading uses Georgia',
          bool(heading) and first_family(heading['font']) == 'georgia', heading and heading['font'])
    guide = style(page, '.pause-card .key-guide')
    check('pause: the key guide is the opening soft ink',
          bool(guide) and guide['color'] == INK_SOFT, guide and guide['color'])
    # The checkpoint action carries its own survey-paper background; story mode
    # must repaint every non-primary button dark, not leave a cream slab.
    light_buttons = page.evaluate("""() => [...document.querySelectorAll('#pause-panel .pause-card button')]
      .filter(b => b.getClientRects().length > 0 && getComputedStyle(b).display !== 'none'
                && !b.classList.contains('primary'))
      .map(b => ({label: b.textContent.trim(), bg: getComputedStyle(b).backgroundColor}))
      .filter(b => { const m = b.bg.match(/[\\d.]+/g); if (!m || m.length < 3) return false;
        const alpha = m.length > 3 ? +m[3] : 1;
        return alpha > 0.05 && Math.max(+m[0], +m[1], +m[2]) > 60; });""")
    check('pause: no non-primary card button keeps the survey paper background',
          not light_buttons, light_buttons)
    assert_surfaces_fonts(page, 'pause', root='#pause-panel')
    shot(page, 'check-pause.png')
    page.evaluate("() => { try { window.__CAMPUS.explorer.enterCompat(); } catch (e) {} }")
    page.wait_for_timeout(400)
    page.keyboard.press('e')
    try:
        page.wait_for_function(
            "() => { const m = document.getElementById('inventory-modal'); return !!m && !m.hidden; }",
            timeout=8000)
    except Exception:
        pass
    panel = style(page, '.bag-panel')
    check('bag: the E panel opens', visible(page, '.bag-panel'), panel)
    assert_body_font('bag', 'panel', panel)
    assert_paper('bag', 'panel', panel)
    heading = style(page, '.bag-panel h2')
    check('bag: panel heading uses Georgia',
          bool(heading) and first_family(heading['font']) == 'georgia', heading and heading['font'])
    bag_slots = page.evaluate("""() => {
      const slots = [...document.querySelectorAll('#inventory-modal .item-slot')].slice(0, 9);
      for (const s of slots) s.style.transition = 'none';
      return slots.map(s => getComputedStyle(s).backgroundColor);
    }""")
    check('bag: slots wear the opening dark paper',
          bool(bag_slots) and all(c and max(c) <= 60 for c in (rgb_triplet(bg) for bg in bag_slots)),
          bag_slots)
    assert_surfaces_fonts(page, 'bag', root='#inventory-modal')
    shot(page, 'check-bag.png')
    page.keyboard.press('e')
    page.wait_for_timeout(300)


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
    corner = page.evaluate("""() => {
      const hud = document.querySelector('.opening-hud');
      const cs = getComputedStyle(hud, '::after');
      return {content: cs.content, display: cs.display, width: cs.width, height: cs.height};
    }""")
    check('b4 focus: the collapsed card drops the corner bracket',
          bool(corner) and corner['display'] == 'none', corner)
    read_caps = """() => {
      try { const b = window.__CAMPUS.campaign.debug.b4; return b && b.caps ? b.caps() : null; }
      catch (e) { return null; }
    }"""
    caps = page.evaluate(read_caps)
    targets = [c for c in (caps or []) if c.get('phrase')]
    others = [c for c in (caps or []) if not c.get('phrase') and not c.get('enter')]
    check('b4 focus: every target cap glows gold under the red light',
          len(targets) == 8 and all(c['emissive'] == 0xffb648 and c['intensity'] >= 0.8 for c in targets),
          targets)
    check('b4 focus: non-target caps stay unlit',
          bool(others) and all(c['emissive'] == 0 for c in others), others[:4])
    enter_zero = [c for c in (caps or []) if c.get('enter')]
    check('b4 focus: Enter is not gold before any cap is typed',
          len(enter_zero) == 1 and enter_zero[0]['emissive'] != 0xffb648, enter_zero)
    shot(page, 'check-b4-focus.png')
    page.evaluate("() => { try { window.__CAMPUS.campaign.debug.b4.type('i'); } catch (e) {} }")
    typed = [c for c in (page.evaluate(read_caps) or []) if c['emissive'] == 0x74e6b4]
    check('b4 focus: a typed cap reads distinct from the gold targets',
          len(typed) == 1, typed)
    # The 8th cap makes the wall ready; the hint switches to "Press Enter to
    # boot", so Enter must glow the same gold as the targets.
    page.evaluate("() => { try { window.__CAMPUS.campaign.debug.b4.type('lovecds'); } catch (e) {} }")
    ready = page.evaluate("""() => { const s = window.__CAMPUS.campaign.debug.b4.state();
      return {typed: s.typed, solved: s.solved}; }""")
    enter_cap = [c for c in (page.evaluate(read_caps) or []) if c.get('enter')]
    check('b4 focus: at 8/8 the Enter cap glows gold like the targets',
          ready.get('typed') == 'ILOVECDS' and ready.get('solved') is False
          and len(enter_cap) == 1 and enter_cap[0]['emissive'] == 0xffb648
          and enter_cap[0]['intensity'] >= 0.8,
          {'ready': ready, 'enter': enter_cap})
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
    # The Mac panel runs before the credits; its visible copy names the machine once.
    try:
        page.wait_for_function(
            "() => { const o = document.getElementById('ending-overlay');"
            " return !!o && !o.hidden && Number(getComputedStyle(o).opacity) > 0.05"
            " && o.getBoundingClientRect().width > 1; }", timeout=120000)
    except Exception:
        pass
    ending_text = page.evaluate(
        "() => { const o = document.getElementById('ending-overlay');"
        " return o ? o.innerText.toUpperCase() : ''; }")
    check('ending: the Mac panel shows HKU SUPERCOMPUTER once',
          ending_text.count('HKU SUPERCOMPUTER') == 1, ending_text)
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
    # The credits settle over a paused game: the explorer's pause card and the
    # ending's own overlay must both be out of the way while they are up.
    check('ending: the pause card is hidden under the credits', not visible(page, '.pause-card'),
          style(page, '.pause-card'))
    check('ending: the ending overlay is hidden under the credits', not visible(page, '#ending-overlay'),
          style(page, '#ending-overlay'))
    check('ending: the barrier line is hidden under the credits', not visible(page, '.ending-barrier'),
          style(page, '.ending-barrier'))
    check('ending: the opening HUD is hidden under the credits', not visible(page, '.opening-hud'),
          style(page, '.opening-hud'))
    check('ending: the walking hint and shell chrome are hidden under the credits',
          not visible(page, '.stage-bottom > span:first-child') and not visible(page, '.shell-hint')
          and not visible(page, '.shell-chapters'),
          {'hint': style(page, '.stage-bottom > span:first-child'), 'esc': style(page, '.shell-hint'),
           'chapters': style(page, '.shell-chapters')})
    # The credits own the whole screen: no HUD element may peek through the dim layer.
    hud_selectors = ['.opening-hud', '.opening-hearts', '.opening-mapcard', '#inventory-hud',
                     '.stage-bottom', '.stage-top', '.shell-hint', '.shell-chapters',
                     '.opening-prompt', '.opening-warning', '.opening-save-toast',
                     '.pause-card', '#ending-overlay', '.ending-barrier']
    visible_hud = [selector for selector in hud_selectors if visible(page, selector)]
    check('ending: every HUD element is hidden under the credits', not visible_hud, visible_hud)
    credits_text = page.evaluate(
        "() => { const c = document.getElementById('ending-credits-card');"
        " return c ? c.textContent.toUpperCase() : ''; }")
    check('ending: the credits name HKU SHANGHAI · CDS once',
          credits_text.count('HKU SHANGHAI · CDS') == 1, credits_text)
    # What the player can see, not what the DOM holds: innerText skips the hidden
    # pause card, ending overlay and barrier line.
    visible_text = page.evaluate("() => document.body.innerText.toUpperCase()")
    check('ending: HKU SHANGHAI · CDS appears once on the visible screen',
          visible_text.count('HKU SHANGHAI · CDS') == 1, visible_text)
    assert_no_stale_copy(page, 'ending')
    shot(page, 'check-ending-credits.png')
    shot(page, 'fw-credits.png')
    # I2: Play again starts the game, not the checkpoint the run came in through.
    try:
        with page.expect_navigation(timeout=30000):
            page.click('#ending-play-again')
    except Exception:
        pass
    url = page.url
    check('ending: Play again goes to the opening without a checkpoint parameter',
          'experience=opening' in url and 'checkpoint' not in url, url)


def handoff_checks(page):
    """Chapter 1 completion: the dialog names the chapter the campaign names, and
    the epilogue it leaves behind wears the same dark HUD as every other panel."""
    open_checkpoint(page, 'b4')
    # A paired MacBook sends handOff() straight into Chapter 2. Empty the bag
    # first so the same code path opens the completion dialog instead: that is
    # what a player sees when the relay is already restored.
    page.evaluate("() => { const inv = window.__CAMPUS.explorer.game.inventory;"
                  " inv.slots.fill(null); inv.revision++; }")
    page.evaluate('() => window.__CAMPUS.experience.debug.arriveB4()')
    page.wait_for_function(
        "() => { const d = document.querySelector('.opening-handoff-dialog'); return !!d && !d.hidden; }",
        timeout=20000)
    chapter = page.evaluate(
        "() => { const c = document.querySelector('.opening-handoff-dialog .opening-brandlock-chapter');"
        " return c ? c.textContent.trim() : null; }")
    check('handoff: the completion dialog names the chapter the campaign names',
          chapter == 'Chapter 1', chapter)
    # Task 6 made "Continue to Chapter 2" the primary action, so the epilogue is
    # reached through Close; find the button by its label, never by its classes.
    labels = page.evaluate(
        "() => [...document.querySelectorAll('.opening-handoff-dialog button')]"
        ".map(b => b.textContent.trim())")
    check('handoff: the dialog offers Close and Continue to Chapter 2',
          {'Close', 'Continue to Chapter 2'}.issubset(set(labels)), labels)
    quick = page.evaluate("() => { const d = document.querySelector('.opening-handoff-dialog .opening-other-slices');"
                          " return d ? {shown: d.getClientRects().length > 0, items: d.querySelectorAll('button').length} : null; }")
    check('handoff: no empty "Quick restore" disclosure when there is nothing to restore',
          quick is None or (not quick['shown']) or quick['items'] > 0, quick)
    page.evaluate("""() => {
      const dialog = document.querySelector('.opening-handoff-dialog');
      const close = [...(dialog ? dialog.querySelectorAll('button') : [])]
        .find(b => b.textContent.trim().toLowerCase() === 'close');
      if (close) close.click();
    }""")
    page.wait_for_function(
        "() => { const e = document.querySelector('.opening-epilogue'); return !!e && !e.hidden; }",
        timeout=20000)
    page.wait_for_timeout(900)
    # The card fades in with a CSS animation; software WebGL can stall it, so the
    # final state is read with the animation off (same as the credits fade above).
    page.evaluate("() => { const e = document.querySelector('.opening-epilogue-inner');"
                  " if (e) e.style.animation = 'none';"
                  " for (const i of document.querySelectorAll('.opening-epilogue-ticker-item'))"
                  " { i.style.animation = 'none'; i.style.opacity = '1'; } }")
    inner = style(page, '.opening-epilogue-inner')
    check('handoff: the epilogue is visible', visible(page, '.opening-epilogue-inner'), inner)
    assert_body_font('handoff', 'epilogue', inner)
    assert_paper('handoff', 'epilogue', inner)
    title = style(page, 'h2.opening-epilogue-title')
    check('handoff: epilogue display heading uses Georgia',
          bool(title) and first_family(title['font']) == 'georgia', title and title['font'])
    eyebrow = style(page, '.opening-epilogue-eyebrow')
    check('handoff: epilogue eyebrow is the opening green',
          bool(eyebrow) and eyebrow['color'] == GREEN, eyebrow and eyebrow['color'])
    meta = style(page, '.opening-epilogue-meta')
    check('handoff: epilogue meta is the opening soft ink',
          bool(meta) and meta['color'] == INK_SOFT, meta and meta['color'])
    note_text = page.evaluate("() => document.querySelector('.opening-epilogue-note')?.textContent ?? ''")
    continue_label = page.evaluate("() => [...document.querySelectorAll('.opening-epilogue-actions button')].map(b => b.textContent.trim())")
    check('handoff: the epilogue note matches its Continue button (Continue closes, F starts Chapter 2)',
          'Continue' in continue_label and note_text.startswith('Continue, then press F'), (note_text, continue_label))
    note = style(page, '.opening-epilogue-note')
    check('handoff: epilogue note is the opening gold',
          bool(note) and note['color'] == GOLD, note and note['color'])
    assert_surfaces_fonts(page, 'handoff', root='.opening-epilogue')
    ticker = page.evaluate("""() => [...document.querySelectorAll('.opening-epilogue-ticker-item')].map(e => {
      const dot = e.querySelector('.opening-epilogue-ticker-dot');
      return {text: e.textContent.trim(), color: getComputedStyle(e).color,
              dot: dot ? getComputedStyle(dot).backgroundColor : null};
    })""")
    check('handoff: the core status chips read OFFLINE at the Building 4 handoff',
          len(ticker) == 4 and all(t['text'].endswith('OFFLINE') for t in ticker), ticker)
    check('handoff: the offline chips wear the opening gold, not the online green',
          bool(ticker) and all(t['color'] == GOLD and t['dot'] == GOLD for t in ticker), ticker)
    assert_no_stale_copy(page, 'handoff')
    shot(page, 'check-epilogue.png')


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
    assert_no_stale_copy(page, 'menu')
    shot(page, 'check-menu.png')


def survey_checks(page):
    """Survey mode keeps the hotbar it had before the campaign restyle."""
    page.goto(ORIGIN + '?experience=survey', wait_until='load')
    page.wait_for_function('() => window.__CAMPUS && document.getElementById("inventory-hud")', timeout=240000)
    page.wait_for_timeout(2600)
    body = page.evaluate('() => document.body.className')
    check('survey: the story-mode body class is absent', 'opening-mode' not in body.split(), body)
    hud = style(page, '#inventory-hud')
    dock = page.evaluate("() => getComputedStyle(document.getElementById('inventory-hud')).bottom")
    check('survey: the hotbar keeps its survey dock (bottom 48 px)',
          dock == '48px', {'css bottom': dock, 'box': hud and (hud['top'], hud['bottom'])})
    slot = page.evaluate("""() => {
      const e = document.querySelector('#inventory-hud .item-slot');
      if (!e) return null;
      const cs = getComputedStyle(e), n = e.querySelector('.slot-number');
      return {bg: cs.backgroundColor, width: cs.width, number: n ? getComputedStyle(n).fontSize : null};
    }""")
    check('survey: the hotbar keeps its 52 px slots',
          bool(slot) and slot['width'] == '52px', slot)
    check('survey: the hotbar keeps the light slot colour',
          bool(slot) and min(rgb_triplet(slot['bg']) or (0, 0, 0)) >= 120, slot)
    check('survey: the hotbar keeps 12 px numbers',
          bool(slot) and slot['number'] == '12px', slot)
    idle = page.evaluate("() => document.getElementById('inventory-hud').classList.contains('is-idle')")
    check('survey: the survey dock never takes the story idle fade', not idle, idle)
    # Ruling 36 is story-only: survey keeps its held item and arms in first person,
    # in the authored pose (no story carry, M6).
    page.evaluate("""() => { const e = window.__CAMPUS.explorer, inv = e.game.inventory;
      if (!inv.slots.some(s => s && s.itemId === 'macbook-air-13-silver'))
        inv.slots[0] = {itemId: 'macbook-air-13-silver', instanceId: 'survey-check-mac', count: 1};
      inv.select(inv.slots.findIndex(s => s && s.itemId === 'macbook-air-13-silver')); inv.revision++;
      e.setEnabled(true); e.game.view = 'first'; e.enterCompat(); }""")
    page.wait_for_timeout(1500)
    survey = view_model(page)
    check('survey: the held item and arms still show while walking',
          bool(survey) and survey['held'] and survey['arms'] and survey['socket'], survey)
    page.wait_for_timeout(2600)
    held_name = page.evaluate("() => { const e = document.getElementById('held-name');"
                              " return e ? {text: e.textContent, opacity: getComputedStyle(e).opacity} : null; }")
    check('survey: the held-item name stays on screen (the story fade is story-only, M6)',
          bool(held_name) and bool(held_name['text']) and float(held_name['opacity']) > 0.5, held_name)
    check('survey: the held item keeps the authored pose (no story carry)',
          bool(survey) and abs(survey['scale'] - 1) <= 0.02 and abs(survey['pos'][1] + 0.30) <= 0.03, survey)
    assert_no_stale_copy(page, 'survey')
    shot(page, 'check-survey.png')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=ARGS, headless=True)
        try:
            page = browser.new_page(viewport=VIEW)
            # Every toast that ever shows, from the first frame: the checkpoint
            # toast is short-lived and would otherwise expire before it is read.
            page.add_init_script("""(() => {
              window.__toastLog = [];
              window.__toastShows = 0;
              // updateSaveToast removes then re-adds is-visible in one task: count one show per callback.
              new MutationObserver(records => {
                if (records.some(r => r.target.classList && r.target.classList.contains('opening-save-toast')
                    && r.target.classList.contains('is-visible'))) window.__toastShows++;
              }).observe(document, {subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true});
              const start = () => {
                const tick = () => {
                  const t = document.querySelector('.opening-save-toast');
                  if (t && !t.hidden && t.classList.contains('is-visible')) {
                    const text = (t.textContent || '').trim();
                    if (text && window.__toastLog[window.__toastLog.length - 1] !== text) {
                      window.__toastLog.push(text);
                    }
                  }
                  requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
              };
              if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
              else start();
            })();""")
            for checkpoint in CHECKPOINTS:
                print('\n==', checkpoint)
                open_checkpoint(page, checkpoint)
                assert_hud(page, checkpoint)
                assert_hotbar(page, checkpoint)
                assert_chapter_card(page, checkpoint)
                assert_surfaces_fonts(page, checkpoint)
                assert_no_stale_copy(page, checkpoint)
                if checkpoint == 'lawn':
                    held_model_checks(page, checkpoint)
                    boundary_toast_checks(page)
                if checkpoint == 'ending':
                    door = page.evaluate("() => window.__CAMPUS.campaign.debug.sports?.door?.() ?? null")
                    check('ending: the sports door is already open at the ending checkpoint (M4)',
                          bool(door) and door.get('open') is True, door)
                if checkpoint == 'b4-inside':
                    toast_checks(page)
                    held_model_checks(page, checkpoint)
                    pause_bag_checks(page)
                    focus_checks(page)
                if checkpoint == 'sports':
                    sports_lock_checks(page)
                if checkpoint == 'ending':
                    credits_checks(page)
                shot(page, 'check-' + checkpoint + '.png')
            print('\n== handoff')
            handoff_checks(page)
            print('\n== menu')
            menu_checks(page)
            print('\n== survey')
            survey_checks(page)
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
