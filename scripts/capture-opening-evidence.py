"""Capture the owner-facing evidence frames for the prologue story build.

Needs a review build served at CAMPUS_URL (window.__CAMPUS.prologue) and Python Playwright:
  CAMPUS_URL=http://127.0.0.1:5252/ CHROME_PATH=<chrome binary> OUT=evidence/opening-story-<sha>/ \
    PYTHON=python3.13 python3.13 scripts/capture-opening-evidence.py

Frames, at 1280x800 and 390x844: the sunset aerial with the Magic Hour light
show, the interior volumetric beam, the dinner hall and dais, and the final
frame the player is handed at the spawn pose (cinematic stopped, control back).
The phone overlay frames are captured by scripts/check-opening-phone.py with
SHOTS pointed at the same directory.
"""
import os
import sys

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5252/')
CHROME = os.environ.get('CHROME_PATH')
OUT = os.environ.get('OUT', '/tmp/one-world/opening-evidence/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
VIEWPORTS = [('1280x800', {'width': 1280, 'height': 800}), ('390x844', {'width': 390, 'height': 844})]
LIGHT_SHOW = 6.0

# A waypoint is identified by its position, so a re-time of the path moves the
# frame with the beat instead of silently capturing the wrong moment.
FIND_WAYPOINT = """([x, z]) => {
  const w = window.__CAMPUS.prologue.debug.waypoints()
    .find((p) => Math.abs(p.position[0] - x) < 0.01 && Math.abs(p.position[2] - z) < 0.01);
  return w ? w.t : null;
}"""


def frames(page, count=2):
    page.evaluate(
        "(count) => new Promise(resolve => { let i = 0; const step = () => (++i >= count ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); })",
        count,
    )


def shot(page, name):
    page.screenshot(path=OUT + name, timeout=180000)
    print('  shot', OUT + name, flush=True)


def capture(page, label):
    page.goto(ORIGIN + '?experience=opening&intro=1', wait_until='domcontentloaded')
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.prologue', timeout=120000)
    page.click('.prologue-begin')
    page.wait_for_function('() => window.__CAMPUS.prologue.debug.state().t > 0', timeout=120000)

    page.evaluate('(t) => window.__CAMPUS.prologue.debug.seek(t)', LIGHT_SHOW)
    frames(page, 3)
    shot(page, f'{label}-light-show.png')

    beam = page.evaluate(FIND_WAYPOINT, [54.6, 13.4])
    if beam is None:
        raise RuntimeError('the interior-beam waypoint moved; update FIND_WAYPOINT')
    page.evaluate('(t) => window.__CAMPUS.prologue.debug.seek(t)', beam)
    frames(page, 3)
    shot(page, f'{label}-interior-beam.png')

    hall = page.evaluate(FIND_WAYPOINT, [76.5, -66.6])
    if hall is None:
        raise RuntimeError('the dinner-hall waypoint moved; update FIND_WAYPOINT')
    page.evaluate('(t) => window.__CAMPUS.prologue.debug.seek(t)', hall)
    frames(page, 3)
    shot(page, f'{label}-dinner-hall.png')

    # The last waypoint is exactly the spawn pose. Skipping removes the overlay
    # and hands control back; the explorer camera then follows the body there.
    last = page.evaluate("() => { const w = window.__CAMPUS.prologue.debug.waypoints(); return w[w.length - 1].t; }")
    page.evaluate('(t) => window.__CAMPUS.prologue.debug.seek(t)', last)
    frames(page, 2)
    page.click('.prologue-skip')
    page.wait_for_function("() => !document.querySelector('#prologue')", timeout=60000)
    page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
    frames(page, 4)
    pose = page.evaluate("() => ({position: window.__CAMPUS.explorer.position.toArray(), story: window.__CAMPUS.openingDebug.state().story.stage})")
    print('  spawn', pose, flush=True)
    shot(page, f'{label}-final-spawn.png')


def main():
    os.makedirs(OUT, exist_ok=True)
    print(f'capture-opening-evidence: {ORIGIN} -> {OUT}', flush=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=CHROME, headless=True, args=ARGS) if CHROME \
            else playwright.chromium.launch(headless=True, args=ARGS)
        try:
            for label, viewport in VIEWPORTS:
                print(f'\n{label}', flush=True)
                context = browser.new_context(viewport=viewport, device_scale_factor=1)
                page = context.new_page()
                try:
                    capture(page, label)
                finally:
                    context.close()
        finally:
            browser.close()
    print('\ncaptured', flush=True)


if __name__ == '__main__':
    main()
