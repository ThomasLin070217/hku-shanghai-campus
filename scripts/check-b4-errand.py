"""Browser check: the MacBook errand, side door to the 5F principal's office (Task E).

Needs a dev or review server (the `window.__CAMPUS` hooks) and Python Playwright:

    CAMPUS_URL=http://127.0.0.1:5255/ CHROME_PATH=<chromium binary> \\
        python3 scripts/check-b4-errand.py

Boots straight into the errand (`?experience=opening&intro=0&checkpoint=b6`), puts the
player at the B4 side door, and then walks it for real: west to the CCTV monitor, north
to the lift call plate, into the car, up, out into the 5F corridor, F on the office door,
around the chair, F on the MacBook. Every leg is a tight `game.step(1/120)` burst with W
held, the same drive `check-lift.ts` uses: the burst holds the main thread so SwiftShader's
multi-second frames cannot slice the lift's wall clock into 50 ms steps.

Two clocks are reported and neither is faked:
  * `sim`  — the seconds the game itself stepped (what a player at 60 fps experiences),
  * `wall` — the seconds that passed on this machine while the burst ran.

The brief's 30–45 s budget is a play-time budget, so `sim` is the number to read. A total
outside the band is printed as a finding; it does not fail the gate unless the route itself
breaks. Screenshots go to SHOTS (default /tmp/one-world/tE/).
"""
import json
import os
import time

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5255/')
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS', '/tmp/one-world/tE/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
BUDGET = (30.0, 45.0)

HELPERS = r"""
/**
 * Walking. SwiftShader renders this campus at well under one frame a second, so a held key
 * would take minutes per metre. These legs drive the game's own fixed-step integrator with
 * the same `human` intent a held W produces — the drive `check-lift.ts` uses; nothing is
 * teleported and no position is written except by the physics.
 */
window.__errand = {
  /** Put the body down at a known spot: the setup for the timed walk, not part of it. */
  place(x, z) {
    const g = window.__CAMPUS.explorer.game, w = window.__CAMPUS.explorer.world;
    const y = w.support(x, z, 2) ?? 0;
    g.body.position.set(x, y, z); g.body.velocity.set(0, 0, 0); g.body.grounded = true;
  },
  begin() { window.__t0 = performance.now(); window.__sim = 0; window.__beats = {}; },
  /** One fixed-step burst: walk the polyline, or hold still until `untilY`. */
  run(points, opts) {
    const g = window.__CAMPUS.explorer.game, o = opts || {};
    g.paused = false;
    const t0 = performance.now(), wallEnd = t0 + (o.maxWall || 60) * 1000, simEnd = window.__sim + (o.maxSim || 60);
    const home = () => { g.human = {forward: 0, right: 0, sprint: false}; };
    const office = () => window.__CAMPUS.openingDebug.office();
    const now = () => ({wall: +((performance.now() - window.__t0) / 1000).toFixed(2), sim: +window.__sim.toFixed(2)});
    const note = () => {
      const b = office().beats;
      for (const name of Object.keys(b)) if (b[name] !== null && !window.__beats[name]) {
        window.__beats[name] = now();
        window.__beats[name].at = [+g.body.position.x.toFixed(2), +g.body.position.y.toFixed(2), +g.body.position.z.toFixed(2)];
      }
    };
    const holdUntil = window.__sim + (o.hold || 0);
    const legT0 = performance.now();
    let i = 0, steps = 0, stuck = 0, last = [g.body.position.x, g.body.position.z];
    while (performance.now() < wallEnd && window.__sim < simEnd) {
      if (o.untilY !== undefined && Math.abs(g.body.position.y - o.untilY) <= .005) break;
      home();
      if (i < points.length) {
        const [x, z] = points[i];
        const dx = x - g.body.position.x, dz = z - g.body.position.z;
        if (Math.hypot(dx, dz) < .18) { i++; continue; }
        g.yaw = Math.atan2(-dx, -dz); g.pitch = 0; g.human.forward = 1;
      } else if (o.untilY === undefined && window.__sim >= holdUntil) break;
      g.step(1 / 120); steps++; window.__sim += 1 / 120;
      // Pace to the step: the lift's clock is the wall clock, so a burst that free-runs
      // either rides for ever (fast machine) or never leaves (slow one). At 1/120 the
      // game's own seconds and this machine's seconds are the same number.
      if (o.pace !== false) { const due = legT0 + steps * (1000 / 120); while (performance.now() < due) { /* hold the thread */ } }
      if (steps % 4 === 0) note();
      const moved = Math.hypot(g.body.position.x - last[0], g.body.position.z - last[1]);
      // Only a walk leg can be stuck; a rider standing still in a moving car is not.
      stuck = i < points.length && moved < 1e-4 ? stuck + 1 : 0;
      last = [g.body.position.x, g.body.position.z];
      if (stuck > 240) break;                       // pressed against something for 2 s
    }
    home();
    note();
    return {
      arrived: i, legs: points.length, steps, stuck: stuck > 240,
      sim: +window.__sim.toFixed(2), wall: +((performance.now() - window.__t0) / 1000).toFixed(2),
      pos: [+g.body.position.x.toFixed(2), +g.body.position.y.toFixed(2), +g.body.position.z.toFixed(2)],
      office: office(), beats: window.__beats,
    };
  },
  /** Look at a world point and report what the interaction system offers there. */
  aim(x, y, z, eye) {
    const g = window.__CAMPUS.explorer.game;
    const dx = x - g.body.position.x, dy = y - (g.body.position.y + (eye ?? 1.64)), dz = z - g.body.position.z;
    const flat = Math.hypot(dx, dz);
    g.yaw = Math.atan2(-dx, -dz); g.pitch = Math.atan2(-dy, flat);
    g.human = {forward: 0, right: 0, sprint: false};
    g.step(1 / 120); window.__sim += 1 / 120;
    return g.scenario.snapshot().target;
  },
};
"""

failures = []
findings = []
passed = 0


def check(name, ok, detail=''):
    global passed
    if ok:
        passed += 1
        print('  ok  ', name, flush=True)
    else:
        failures.append(name)
        print('  FAIL', name, '\n        ', detail, flush=True)


def shot(page, name):
    try:
        page.screenshot(path=SHOTS + name, timeout=120000)
        print('  shot', SHOTS + name, flush=True)
    except Exception as error:  # Screenshots are evidence, not assertions.
        print('  shot failed', name, type(error).__name__, flush=True)


def main():
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, args=ARGS)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        page.goto(ORIGIN + '?experience=opening&intro=0&checkpoint=b6', wait_until='domcontentloaded')
        page.wait_for_function(
            '() => window.__CAMPUS && window.__CAMPUS.openingDebug && window.__CAMPUS.explorer'
            ' && window.__CAMPUS.openingDebug.office', timeout=180000)
        page.keyboard.press('Shift')           # a trusted input claims the save
        page.evaluate('() => { window.__doc = 1; }')
        page.evaluate(HELPERS)
        page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
        page.wait_for_timeout(600)
        href = page.evaluate('() => location.href')
        navs = []                              # only navigations after boot count as a reload
        page.on('framenavigated', lambda f: navs.append(f.url) if f == page.main_frame else None)
        D = 'window.__CAMPUS.openingDebug'
        story = page.evaluate(f'() => {D}.state().story')
        check('starts on the errand: stage to_b6, no MacBook yet',
              story['stage'] == 'to_b6' and not story['laptop_acquired'], story)
        check('the office state is exposed to the gate', page.evaluate(f'() => {D}.office().revision') == 'opening-2030-v9-office',
              page.evaluate(f'() => {D}.office()'))

        page.evaluate('() => window.__errand.place(47.75, 20.0)')
        page.evaluate('() => window.__errand.begin()')
        page.keyboard.down('w')
        held = page.evaluate('() => window.__CAMPUS.explorer.state.keys')
        page.keyboard.up('w')
        check('a real KeyW reaches the controller', 'KeyW' in held, held)

        # --- the ground leg: monitor, call plate, car -------------------------------------
        ground = page.evaluate("""() => window.__errand.run([[47.75, 18.0], [47.35, 16.0]])""")
        check('walked to the CCTV monitor', ground['arrived'] == ground['legs'], ground)
        check('beat 1: the lobby feed starts on the first look', ground['office']['beats']['lobby_feed'] is not None,
              ground['office'])
        shot(page, '01-monitor.png')

        plate = page.evaluate("""() => window.__errand.run([[46.9, 14.9], [46.50, 13.75]])""")
        check('walked to the lift call plate', plate['arrived'] == plate['legs'], plate)
        call = page.evaluate("""() => window.__errand.run([[46.50, 12.90], [45.60, 12.40], [45.03, 12.40]])""")
        check('walked into the car', call['arrived'] == call['legs'] and abs(call['pos'][1] - 0.02) < 0.2, call)

        # --- the ride ---------------------------------------------------------------------
        ride = page.evaluate("""() => window.__errand.run([], {untilY: 18.90, maxWall: 40, maxSim: 40})""")
        check('the car carried the player to the 5F landing', abs(ride['pos'][1] - 18.90) <= 0.05, ride)
        check('beat 2: the feed dies when the doors close', ride['office']['beats']['feed_dies'] is not None, ride['office'])
        check('the monitor shows static after beat 2', ride['office']['feed'] == 'dead', ride['office'])
        doors = page.evaluate('() => window.__errand.run([], {hold: 1.2, maxSim: 4})')
        check('the car doors open at the landing', abs(doors['office']['lift']['doors'] - 1) < .01, doors['office']['lift'])
        shot(page, '02-fifth-floor.png')

        # --- the 5F leg -------------------------------------------------------------------
        fifth = page.evaluate("""() => window.__errand.run([[47.6, 12.6], [49.58, 12.90], [49.8, 12.40], [52.13, 12.40], [54.70, 12.40]])""")
        check('walked the 5F corridor to the office door', fifth['arrived'] == fifth['legs'], fifth)
        check('beat 3: the corridor carries it by sound', fifth['office']['beats']['corridor_sound'] is not None,
              fifth['office'])
        beats_there = fifth['office']['beats']
        check('all three beats fired BEFORE the office door opened',
              all(beats_there[k] is not None for k in ('lobby_feed', 'feed_dies', 'corridor_sound')) and not fifth['office']['doorOpen'],
              fifth['office'])
        check('the beats latched in route order',
              fifth['office']['beatOrder'] == ['lobby_feed', 'feed_dies', 'corridor_sound'], fifth['office'])

        aim = page.evaluate('() => window.__errand.aim(54.78, 20.05, 12.40)')
        check('the office door is the offered interaction', aim == 'opening-office-door', aim)
        page.keyboard.press('f')
        opened = page.evaluate(f'() => {D}.office()')
        check('real F opens the office door', opened['doorOpen'] is True, opened)

        walk = page.evaluate("""() => window.__errand.run([[55.60, 12.40], [56.80, 12.40], [57.10, 14.00], [58.70, 13.85]])""")
        check('walked around the chair to the desk', walk['arrived'] == walk['legs'], walk)
        target = page.evaluate('() => window.__errand.aim(58.70, 19.68, 12.40)')
        check('the MacBook is the offered interaction', target == 'opening-laptop', target)
        shot(page, '03-desk.png')
        page.keyboard.press('f')
        page.wait_for_timeout(400)
        end = page.evaluate(f'() => {D}.state()')
        check('real F takes the presentation MacBook', end['story']['laptop_acquired'] is True, end['story'])
        check('take_laptop advanced the story to return_b5', end['story']['stage'] == 'return_b5', end['story'])
        final = page.evaluate('() => window.__errand.run([], {maxSim: 1})')

        page.keyboard.up('w')

        # --- one document, one URL --------------------------------------------------------
        check('the page never navigated or reloaded',
              page.evaluate('() => window.__doc === 1') and not navs, {'doc': page.evaluate('() => window.__doc'), 'navs': navs})
        check('location.href is unchanged', page.evaluate('() => location.href') == href,
              (href, page.evaluate('() => location.href')))
        check('no page errors', not errors, errors[:4])

        # --- the measured errand ----------------------------------------------------------
        beats = final['beats']
        total_sim, total_wall = final['sim'], final['wall']
        report = {
            'beats': beats,
            'total': {'sim': total_sim, 'wall': total_wall},
            'simAt': {'monitor': ground['sim'], 'callPlate': plate['sim'], 'inCar': call['sim'],
                      'landing': ride['sim'], 'corridor': fifth['sim'], 'desk': walk['sim']},
            'ride': {'sim': ride['sim'], 'wall': ride['wall'], 'steps': ride['steps']},
            'drive': 'fixed-step g.step(1/120) paced to the wall clock, W identical to a held key; one real KeyW down proved the input path',
            'budget': {'band': list(BUDGET), 'measuredSim': total_sim, 'measuredWall': total_wall},
            'view': page.evaluate('() => window.__CAMPUS.explorer.game.view'),
            'href': href,
        }
        print('\n' + json.dumps(report, indent=1), flush=True)
        if not (BUDGET[0] <= total_sim <= BUDGET[1]):
            findings.append(
                f'FINDING: the errand measured {total_sim} s of play time ({total_wall} s wall on SwiftShader), '
                f'outside the {BUDGET[0]:.0f}–{BUDGET[1]:.0f} s budget. Reported, not failed.')
        for f in findings:
            print(f, flush=True)

        browser.close()

    print(f'\ncheck-b4-errand: {passed} passed, {len(failures)} failed, {len(findings)} finding(s)', flush=True)
    if failures:
        for f in failures:
            print(f'  - {f}', flush=True)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
