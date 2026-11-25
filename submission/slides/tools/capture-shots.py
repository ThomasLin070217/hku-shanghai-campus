"""Capture the four slide screenshots from the review build.

Run against the threaded review server after the playtest:
  CAMPUS_URL=http://127.0.0.1:5294/ \
  CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  python3.13 .scratch/slides-2026-11-25/capture-shots.py

Writes shots/bus.png, dinner.png, lobby.png, laptop.png next to the deck. The
finale slot is the four-tower prototype (.scratch/finale-mesh/hungerg/shot-t12.png),
copied separately and captioned as a prototype in the deck.

Poses are read off the source, not guessed: bus and tables from
`src/opening/spatialLayout.ts`, laptop and CCTV from `src/opening/b4Office.ts`
(verified by reading the scene graph for `B4_office_macbook`). Camera forward is
(-cos(pitch)·sin(yaw), ·, -cos(pitch)·cos(yaw)): yaw 0 faces north (-z), +pi/2
faces west (-x).
"""
import os

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5294/')
CHROME = os.environ.get('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
# Hardware GL: these are static frames, and SwiftShader returns blocky edges at
# 1280x720. The gates keep SwiftShader; this capture does not have to obey that.
ARGS = ['--enable-webgl', '--window-size=1280,720', '--hide-scrollbars']
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
VIEW = {'width': 1280, 'height': 720}
PI = 3.141592653589793


def enter(page):
    # Not #enter-game: that requests pointer lock, which headless Chrome denies,
    # leaving "Pointer lock unavailable" on screen. A key press claims the save
    # and enterCompat() is the game's own drag-control mode (verified 2026-11-26).
    page.keyboard.press('Shift')
    page.wait_for_timeout(300)
    page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
    page.wait_for_timeout(900)


def pose(page, x, z, yaw, pitch=-0.04, y=None):
    page.evaluate(
        "([x,z,yaw,pitch,y]) => { const g=window.__CAMPUS.explorer.game;"
        " g.body.position.set(x, y===null?g.body.position.y:y, z); g.body.velocity.set(0,0,0);"
        " g.yaw=yaw; g.pitch=pitch; }",
        [x, z, yaw, pitch, y])
    page.wait_for_timeout(1200)


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name))
    print('shot', name, flush=True)


def boot(pw, checkpoint):
    browser = pw.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
    page = browser.new_page(viewport=VIEW)
    # ?shell=1 shows the shipped player shell instead of the review build's
    # campus authoring chrome (scene index, breadcrumb, Campus tools) — see
    # src/entry.ts. Without it the slides would show staff furniture.
    page.goto(ORIGIN + f'?experience=opening&intro=0&checkpoint={checkpoint}&shell=1',
              wait_until='domcontentloaded', timeout=240000)
    page.wait_for_function(
        '() => window.__CAMPUS && window.__CAMPUS.explorer && window.__CAMPUS.openingDebug',
        timeout=180000)
    enter(page)
    return browser, page


def main():
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as pw:
        # B5 leg: the shuttle at the B4 forecourt, then the High Table Dinner.
        browser, page = boot(pw, 'b5')
        pose(page, 63.4, 24.5, PI, -0.04, 0.0)       # bus door is on its north face
        shot(page, 'bus.png')
        pose(page, 70.0, -57.5, 0.0, 0.04, 0.0)      # centre aisle, looking into the hall
        page.wait_for_timeout(1400)                  # the dinner line is a timed beat
        shot(page, 'dinner.png')
        browser.close()

        # B4 leg: the 5F MacBook, then the ground-lobby CCTV screen.
        browser, page = boot(pw, 'b6')
        pose(page, 58.70, 14.80, 0.0, 0.30, 18.90)   # south of the desk, across it
        shot(page, 'laptop.png')
        pose(page, 48.20, 16.00, PI / 2, -0.12, 0.02)  # face the west wall's monitor
        page.wait_for_timeout(1600)                  # let any caption clear
        shot(page, 'lobby.png')
        browser.close()


if __name__ == '__main__':
    main()
