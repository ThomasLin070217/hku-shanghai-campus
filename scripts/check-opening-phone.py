"""Browser check: the playable opening starts in the crowd, the phone buzzes, and
its single Yes makes the player a Student Ambassador and hands control back.

Needs a review build (window.__CAMPUS.openingDebug / .prologue) and Python Playwright:
  npm run build:review
  npx vite preview --mode review --host 127.0.0.1 --port 5252
  CAMPUS_URL=http://127.0.0.1:5252/ CHROME_PATH=<chrome binary> PYTHON=python3.13 \
    python3.13 scripts/check-opening-phone.py

The run is deliberately driven by real input: a trusted key claims the save, W
walks the player into the plaza, the phone opens on its own after 2.4 m, Escape
is swallowed, and the single enabled button is clicked. The check runs the whole
flow twice, once at 1280x800 and once at 390x844, each in a fresh context, so the
mobile layout is exercised rather than resized into.

The prologue is skipped with ?intro=0; the cinematic itself is covered by
scripts/check-prologue.py.
"""
import os
import sys

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5252/')
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS', '/tmp/one-world/opening-phone/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
VIEWPORTS = [('1280x800', {'width': 1280, 'height': 800}), ('390x844', {'width': 390, 'height': 844})]

EYEBROW = 'HKU SHANGHAI · STUDENT AMBASSADOR PROGRAMME'
TITLE = 'High Table Dinner · Tonight · Building 5'
BODY = 'You are invited to serve as Student Ambassador for the evening.'
PROVISIONED = 'Your MacBook has been provisioned with campus root access.'
OBJECTIVE = 'Walk to the High Table Dinner · Building 5'

STATE = """() => {
  const c = window.__CAMPUS;
  const s = c.openingDebug.state();
  return {
    stage: s.story.stage,
    invitation: s.story.invitation_read,
    ambassador: s.story.ambassador,
    modal: s.modal,
    paused: c.explorer.game.paused,
    panel: c.explorer.game.panel,
    objective: c.explorer.game.scenario ? c.explorer.game.scenario.snapshot().goal : null,
    position: c.explorer.position.toArray(),
    toast: document.getElementById('toast')?.textContent ?? '',
  };
}"""

PHONE = """() => {
  const shell = document.querySelector('.opening-phone');
  if (!shell) return null;
  const buttons = [...shell.querySelectorAll('button')];
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  return {
    eyebrow: shell.querySelector('.opening-phone-app')?.textContent?.trim() ?? null,
    title: shell.querySelector('.opening-phone-title')?.textContent?.trim() ?? null,
    bodies: [...shell.querySelectorAll('.opening-phone-body')].map((el) => el.textContent.trim()),
    buttons: buttons.map((el) => ({text: el.textContent.trim(), disabled: el.disabled, visible: visible(el)})),
    enabled: buttons.filter((el) => !el.disabled && visible(el)).length,
    visible: visible(shell),
    box: (() => { const r = shell.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })(),
  };
}"""

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


def state(page):
    return page.evaluate(STATE)


def until(page, js, timeout=60):
    try:
        page.wait_for_function(js, timeout=timeout * 1000, polling=200)
        return True
    except PlaywrightTimeoutError:
        return False


def boot(page):
    page.goto(ORIGIN + '?experience=opening&intro=0', wait_until='domcontentloaded')
    page.wait_for_function(
        '() => window.__CAMPUS && window.__CAMPUS.openingDebug && window.__CAMPUS.explorer && window.__CAMPUS.ready',
        timeout=120000,
    )
    page.keyboard.press('Shift')  # claimSave needs a trusted input
    page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
    page.wait_for_timeout(400)


def hold(page, key, seconds):
    page.keyboard.down(key)
    page.wait_for_timeout(int(seconds * 1000))
    page.keyboard.up(key)


def frames(page, count=4):
    """Wait for rendered frames, not wall time: SwiftShader can spend over a
    second on one 1280x800 frame, and keyboard state is only read per frame."""
    page.evaluate(
        "(count) => new Promise(resolve => { let i = 0; const step = () => (++i >= count ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); })",
        count,
    )


def run_flow(page, label):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    boot(page)
    s = state(page)
    check(f'{label}: a fresh run starts in the plaza crowd, not at the bus',
          s['stage'] == 'crowd' and not s['invitation'] and not s['ambassador'], s)
    start = s['position']
    shot(page, label, '01-crowd')

    # The phone must open from walking, not from a debug hook.
    page.keyboard.down('w')
    opened = until(page, "() => !!document.querySelector('.opening-phone')", timeout=60)
    page.keyboard.up('w')
    check(f'{label}: walking a few steps opens the phone on its own', opened)

    s = state(page)
    phone = page.evaluate(PHONE)
    check(f'{label}: the phone overlay is visible', bool(phone) and phone['visible'] and phone['box']['w'] > 200, phone)
    check(f'{label}: the overlay has exactly one enabled button, and it says Yes',
          bool(phone) and phone['enabled'] == 1 and len(phone['buttons']) == 1
          and phone['buttons'][0]['text'] == 'Yes' and not phone['buttons'][0]['disabled'], phone)
    check(f'{label}: the invitation copy is exact',
          bool(phone) and phone['eyebrow'] == EYEBROW and phone['title'] == TITLE
          and phone['bodies'] == [BODY, PROVISIONED], phone)
    check(f'{label}: the walk is paused while the phone is open',
          s['modal'] == 'invitation' and (s['paused'] or s['panel']), s)

    frozen = s['position']
    page.keyboard.down('w')
    frames(page, 4)
    page.keyboard.up('w')
    moved = state(page)
    distance = sum((a - b) ** 2 for a, b in zip(frozen, moved['position'])) ** 0.5
    check(f'{label}: W does not move the player under the phone', distance < 0.02, f'moved {distance:.3f} m')

    page.keyboard.press('Escape')
    page.wait_for_timeout(250)
    still = page.evaluate(PHONE)
    check(f'{label}: Escape cannot dismiss the invitation without answering', bool(still), still)
    shot(page, label, '02-phone')

    # A trusted click at the button's centre. Playwright's actionability wait asks
    # for a stable box across frames; at 1280x800 on SwiftShader one frame can take
    # over a second, so the locator click times out even though the button is there.
    target = page.evaluate("""() => {
      const b = document.querySelector('.opening-phone-yes').getBoundingClientRect();
      return {x: b.x + b.width / 2, y: b.y + b.height / 2};
    }""")
    page.mouse.click(target['x'], target['y'])
    answered = until(page, "() => window.__CAMPUS.openingDebug.state().modal === null", timeout=30)
    # The UI rebuilds on the next rendered frame; the objective and the dialog
    # must both have caught up before keyboard input is meaningful again.
    painted = until(page, f"""() => {{
      const objective = document.querySelector('.opening-hud .opening-objective');
      return !document.querySelector('.opening-phone')
        && objective && objective.textContent.trim() === {OBJECTIVE!r};
    }}""", timeout=30)
    check(f'{label}: Yes closes the phone', answered)
    check(f'{label}: the HUD repaints after Yes', painted)

    s = state(page)
    check(f'{label}: Yes records the invitation and the Student Ambassador role',
          s['invitation'] and s['ambassador'], s)
    check(f'{label}: Yes moves the story to the walk to Building 5', s['stage'] == 'to_b5', s)
    check(f'{label}: the objective becomes the exact High Table Dinner line', s['objective'] == OBJECTIVE, s['objective'])
    dom_objective = page.evaluate(
        "() => document.querySelector('.opening-hud .opening-objective')?.textContent?.trim() ?? null")
    check(f'{label}: the HUD shows the same objective', dom_objective == OBJECTIVE, dom_objective)
    check(f'{label}: the acceptance is acknowledged',
          'Welcome, Ambassador.' in s['toast'], s['toast'])

    # The spawn faces B4's closed door, so the post-Yes control check backs away
    # instead of pushing into the wall; any real input proves the hand-back.
    before = s['position']
    page.keyboard.down('s')
    moved_after = until(page, f"""() => {{
      const p = window.__CAMPUS.explorer.position;
      return Math.hypot(p.x - {before[0]!r}, p.z - {before[2]!r}) > 0.25;
    }}""", timeout=30)
    page.keyboard.up('s')
    after = state(page)
    walked = sum((a - b) ** 2 for a, b in zip(before, after['position'])) ** 0.5
    check(f'{label}: the player can move again after Yes', moved_after and walked > 0.25, f'moved {walked:.3f} m')
    shot(page, label, '03-after-yes')

    page.wait_for_timeout(400)
    check(f'{label}: no page errors', not errors, errors[:4])


def main():
    os.makedirs(SHOTS, exist_ok=True)
    print(f'check-opening-phone: {ORIGIN} -> {SHOTS}', flush=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=CHROME, headless=True, args=ARGS) if CHROME else playwright.chromium.launch(
            headless=True, args=ARGS)
        try:
            for label, viewport in VIEWPORTS:
                print(f'\n{label}', flush=True)
                context = browser.new_context(viewport=viewport, device_scale_factor=1)
                page = context.new_page()
                try:
                    run_flow(page, label)
                except Exception as error:
                    check(f'{label}: flow completed', False, f'{type(error).__name__}: {error}')
                finally:
                    context.close()
        finally:
            browser.close()
    if failures:
        print(f'\ncheck-opening-phone: {len(failures)} failed', flush=True)
        sys.exit(1)
    print(f'\n{passed} checks, 0 failed', flush=True)


if __name__ == '__main__':
    main()
