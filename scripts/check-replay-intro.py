"""Replay-intro regression gate (owner report, 2026-11-25).

"Replay intro" from the pause card used to run under the score of the stage the player
left, with the dinner guests still standing in the hall and the robots still on patrol.
The opening must own the screen while it replays, and the stage's own state must come
back when the intro is skipped.

Boots a mid-story checkpoint (B5), enters through the real buttons, opens the pause card,
presses "Replay intro", and asserts:

  1. the prologue owns the screen (body.prologue-active),
  2. the score is mus_prologue, not the stage cue (mus_dinner for to_b5),
  3. every student is back on the plaza (not in the dinner hall),
  4. the robot fleet is hidden,
  5. after skipping: the stage cue is back, the hall crowd is back, the robots are back.

Two gate-side traps this script handles, both of which made earlier runs fail for the
wrong reason:
  * the score only exists once the audio context does — enter through `#enter-game`
    first, exactly like a player;
  * headless Chrome denies pointer lock, so the shipped drag-mode fallback appears and
    the game stays paused until `#enter-compat` is pressed.

The product fix lives in `src/opening/experience.ts`: the crowd swap must run in
`update()` (which runs on paused frames), not in `tick()` (`step()` returns before the
scenario tick while paused, and the prologue pauses the game for its whole run).

Run against the review build:
  CAMPUS_URL=http://127.0.0.1:5293/ \
  CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  python3.13 scripts/check-replay-intro.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5293/')
CHROME = os.environ.get('CHROME_PATH')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('SHOTS', os.path.join(ROOT, '.scratch', 'replay-intro-shots'))

errors = []
failures = []


def check(name, ok, detail=''):
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  ' + str(detail)), flush=True)
    if not ok:
        failures.append(name)


STATE = """() => {
  const c = window.__CAMPUS;
  const crowd = c.openingDebug.crowd().students.map(s => ({x: s.x, z: s.z, done: s.done}));
  const fleet = c.viewer.scene.getObjectByName('Opening_robot_fleet');
  return {
    prologue: document.body.classList.contains('prologue-active'),
    music: (c.experience.audio.diagnostics.story || {}).music || null,
    stage: c.openingDebug.state().story.stage,
    crowd,
    robots: fleet ? fleet.visible : null,
  };
}"""


def main():
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, args=ARGS)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(ORIGIN + '?experience=opening&intro=0&checkpoint=b5', wait_until='domcontentloaded')
        page.wait_for_function(
            '() => window.__CAMPUS && window.__CAMPUS.openingDebug && window.__CAMPUS.explorer'
            ' && window.__CAMPUS.experience.audio.diagnostics',
            timeout=180000)

        # Boot lands on the pause card ("Start opening"); enter the way a player does, which
        # is also what starts the audio context. Sampling before this reads `music: null`
        # because the story mixer has no context yet — not a replay defect.
        page.click('#enter-game')
        page.wait_for_timeout(800)
        # Headless Chrome denies pointer lock, so the shipped drag-mode fallback appears.
        # A player on such a browser clicks it; take the same path instead of forcing lock.
        if page.evaluate('() => window.__CAMPUS.explorer.game.paused'):
            page.click('#enter-compat')
        page.wait_for_function(
            "() => ((window.__CAMPUS.experience.audio.diagnostics.story || {}).music || '') !== ''",
            timeout=60000)
        page.wait_for_timeout(400)

        before = page.evaluate(STATE)
        check('the B5 checkpoint is a later stage with the hall crowd', before['stage'] == 'to_b5', before['stage'])
        check('before replay, the stage cue is mus_dinner', before['music'] == 'mus_dinner', before['music'])
        check('before replay, the crowd is in the hall', all(s['done'] for s in before['crowd']), before['crowd'][:3])

        # The pause card is the shipped way in: pause, then press the real button.
        page.evaluate("() => window.__CAMPUS.explorer.pause('replay_check')")
        page.wait_for_timeout(250)
        page.evaluate("() => document.getElementById('replay-intro').click()")
        page.wait_for_timeout(1500)

        during = page.evaluate(STATE)
        check('the prologue owns the screen', during['prologue'] is True, during['prologue'])
        check('the replay score is mus_prologue', during['music'] == 'mus_prologue', during['music'])
        check('the crowd is back on the plaza', bool(during['crowd']) and all(not s['done'] for s in during['crowd']), during['crowd'][:3])
        check('the plaza students stand outside the hall', all(s['z'] > 20 for s in during['crowd']), [s['z'] for s in during['crowd'][:3]])
        check('the robot fleet is hidden during the intro', during['robots'] is False, during['robots'])
        page.screenshot(path=os.path.join(SHOTS, 'replay-gate.png'))

        # Start the cinematic, then skip it with the real Escape key.
        page.evaluate("() => { const b = document.querySelector('.prologue-begin'); if (b) b.click(); }")
        page.wait_for_timeout(600)
        page.keyboard.press('Escape')
        page.wait_for_timeout(900)

        after = page.evaluate(STATE)
        check('skipping leaves the prologue', after['prologue'] is False, after['prologue'])
        check('the stage cue returns after the replay', after['music'] == 'mus_dinner', after['music'])
        check('the hall crowd returns after the replay', all(s['done'] for s in after['crowd']), after['crowd'][:3])
        check('the robots return after the replay', after['robots'] is True, after['robots'])
        page.screenshot(path=os.path.join(SHOTS, 'replay-after.png'))

        print('  pageerrors:', errors, flush=True)
        browser.close()

    if errors:
        failures.append('page errors')
    print('check-replay-intro: %d failed' % len(failures), flush=True)
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
