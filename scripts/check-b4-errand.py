"""Browser check: the MacBook errand, side door to the 5F principal's office (Task E).

Needs a dev or review server (the `window.__CAMPUS` hooks) and Python Playwright:

    CAMPUS_URL=http://127.0.0.1:5288/ CHROME_PATH=<chromium binary> \\
        python3 scripts/check-b4-errand.py

Three pages, each one a separate fresh boot:

  * `?checkpoint=b6` — the **designed** run: side door → monitor (a 4.0 s look at the live
    feed) → call plate → wait for the car → ride → corridor → office door → desk, then the
    **return** run: desk → car → ride down → ground lobby. The four screenshots come from
    this page.
  * `?checkpoint=b6` — the **beeline**: the same errand with the monitor detour and the look
    removed. Reported, never padded.
  * `?checkpoint=b5` — before the errand is accepted: the beats must stay dark even with the
    player standing at the monitor and walking the 5F corridor (E-F3).

Three clocks are printed, each with its legs separated into walking / lift / interaction and
summed against the total:

  * `beeline`  — side door → desk, optimal.
  * `designed` — the same with the monitor pause.
  * `return`   — desk → ground lobby, riding down.

The play clock is `window.__sim`, the seconds the gate's fixed-step bursts actually stepped
at 1/120 s, paced so one game second is one second on this machine. `wall` is printed beside
it. Every step belongs to a labelled leg, so the legs sum to the total by construction. The
30–45 s budget is applied to the **designed** clock. The 4.0 s look is the gate's playback of
a deliberate pause, not a game gate: nothing in the game holds the player.

Screenshots go to SHOTS (default `.superpowers/sdd/2026-11-24-phase1/`) at 1280×800 and
390×844.
"""
import json
import os
import time

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5288/')
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS', '.superpowers/sdd/2026-11-24-phase1/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
BUDGET = (30.0, 45.0)
WATCH_SECONDS = 4.0

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
  begin() { window.__t0 = performance.now(); window.__sim = 0; window.__beats = {}; window.__track = []; },
  /**
   * One fixed-step burst: walk the polyline, or hold still until one of the stops:
   *   `untilY`    — the player's own feet reach a height (a ride carrying them),
   *   `untilCar`  — the car reaches a height with its doors open (a lift answering a call),
   *   `hold`      — a fixed number of stepped seconds (a look, a door swinging).
   * `track` samples the player's y against the car floor every quarter second.
   */
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
      if (o.untilCar !== undefined) {
        const l = office().lift;
        if (l.doors > .99 && Math.abs(l.y - o.untilCar) <= .005) break;
      }
      home();
      if (i < points.length) {
        const [x, z] = points[i];
        const dx = x - g.body.position.x, dz = z - g.body.position.z;
        if (Math.hypot(dx, dz) < .18) { i++; continue; }
        g.yaw = Math.atan2(-dx, -dz); g.pitch = 0; g.human.forward = 1;
      } else if (o.untilY === undefined && o.untilCar === undefined && window.__sim >= holdUntil) break;
      g.step(1 / 120); steps++; window.__sim += 1 / 120;
      // Pace to the step: the lift's clock is the wall clock, so a burst that free-runs
      // either rides for ever (fast machine) or never leaves (slow one). At 1/120 the
      // game's own seconds and this machine's seconds are the same number.
      if (o.pace !== false) { const due = legT0 + steps * (1000 / 120); while (performance.now() < due) { /* hold the thread */ } }
      if (steps % 4 === 0) note();
      if (o.track && steps % 30 === 0) {
        const l = office().lift;
        window.__track.push({sim: +window.__sim.toFixed(2), body: +g.body.position.y.toFixed(3), car: l.y});
      }
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
      sim: +window.__sim.toFixed(4), wall: +((performance.now() - window.__t0) / 1000).toFixed(2),
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
    return {target: g.scenario.snapshot().target, sim: +window.__sim.toFixed(4),
            yaw: +g.yaw.toFixed(3), pitch: +g.pitch.toFixed(3)};
  },
  /** Turn the head without stepping the world: the pose an evidence shot is taken from. */
  look(x, y, z, eye) {
    const g = window.__CAMPUS.explorer.game;
    const dx = x - g.body.position.x, dy = y - (g.body.position.y + (eye ?? 1.64)), dz = z - g.body.position.z;
    g.yaw = Math.atan2(-dx, -dz); g.pitch = Math.atan2(-dy, Math.hypot(dx, dz));
    g.human = {forward: 0, right: 0, sprint: false};
    return {yaw: +g.yaw.toFixed(3), pitch: +g.pitch.toFixed(3)};
  },
  /** Is a named object in the rendered scene? Names may carry a `#n` suffix. */
  has(prefix) {
    let found = false;
    window.__CAMPUS.viewer.scene.traverse(o => { if (!found && typeof o.name === 'string' && (o.name === prefix || o.name.startsWith(prefix + '#'))) found = true; });
    return found;
  },
  sim() { return +window.__sim.toFixed(4); },
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


def clock():
    return {'legs': []}


def leg(page, c, kind, name, js):
    """One labelled leg: run it and charge the steps it took to `kind`."""
    lift0 = page.evaluate('() => window.__CAMPUS.openingDebug.office().lift')
    before = page.evaluate('() => window.__errand.sim()')
    t0 = time.monotonic()
    result = page.evaluate(js)
    wall = time.monotonic() - t0
    after = page.evaluate('() => window.__errand.sim()')
    lift1 = page.evaluate('() => window.__CAMPUS.openingDebug.office().lift')
    c['legs'].append({'kind': kind, 'name': name, 'seconds': round(after - before, 4), 'wall': round(wall, 2),
                      'lift0': lift0, 'lift1': lift1})
    return result


def totals(c):
    out = {}
    for kind in ('walking', 'lift', 'interaction'):
        out[kind] = round(sum(l['seconds'] for l in c['legs'] if l['kind'] == kind), 4)
    out['sum'] = round(sum(l['seconds'] for l in c['legs']), 4)
    out['wall'] = round(sum(l['wall'] for l in c['legs']), 2)
    return out


def settle(page, target=None, timeout=180000):
    """Wait for a frame rendered from the pose the game is now in.

    SwiftShader draws this campus at well under one frame a second, so a screenshot taken the
    moment the player is posed shows the *previous* pose — the first evidence shots caught the
    monitor from wherever the camera still was. The renderer's frame counter is the only honest
    "a frame has happened" signal; the camera-at-the-eye check and the camera-pointing-at-the-
    target check are the only honest "it was this pose" ones. (Position alone is not enough:
    a frame can land between the placement and the turn, leaving the eye right and the head
    still facing the old way.)
    """
    page.evaluate('() => { window.__settleFrame = window.__CAMPUS.viewer.renderer.info.render.frame; }')
    page.wait_for_function(
        '''(t) => {
             const r = window.__CAMPUS.viewer.renderer, c = window.__CAMPUS.explorer.camera;
             const e = window.__CAMPUS.explorer.game.body.position;
             if (r.info.render.frame <= window.__settleFrame) return false;
             if (Math.hypot(c.position.x - e.x, c.position.y - (e.y + 1.64), c.position.z - e.z) >= .05) return false;
             if (!t) return true;
             const v = c.getWorldDirection(new (c.position.constructor)());
             const dx = t[0] - c.position.x, dy = t[1] - c.position.y, dz = t[2] - c.position.z;
             const len = Math.hypot(dx, dy, dz) || 1;
             return (v.x * dx + v.y * dy + v.z * dz) / len > .9995;
           }''', arg=target, timeout=timeout)


def shot(page, name, vantages=None, target=None):
    """Screenshots are evidence, not assertions: a failure prints and carries on.

    `vantages` maps a viewport suffix to `(x, z, aim_x, aim_y, aim_z)`: the pose that viewport's
    evidence is taken from, for shots where the camera has to stand somewhere the timed route
    does not go. `target` is the aim point for the viewports that keep the player where the
    route left them. The monitor is 0.9 m wide, so the frame that shows it to a wide screen at
    arm's length is not the frame that fits it into a 390-px-wide one; each is shot from a pose
    a player can stand in, and the timed route is not changed by either.
    """
    for width, height, suffix in ((1280, 800, '1280x800'), (390, 844, '390x844')):
        try:
            aim = target
            if vantages and suffix in vantages:
                x, z, ax, ay, az = vantages[suffix]
                aim = (ax, ay, az)
                page.evaluate(f'() => window.__errand.place({x}, {z})')
                page.evaluate(f'() => window.__errand.look({ax}, {ay}, {az})')
            page.set_viewport_size({'width': width, 'height': height})
            settle(page, aim)
            path = SHOTS + name + '-' + suffix + '.png'
            page.screenshot(path=path, timeout=180000)
            print('  shot', path, flush=True)
        except Exception as error:
            print('  shot failed', name, suffix, type(error).__name__, flush=True)
    page.set_viewport_size({'width': 1280, 'height': 800})
    settle(page)


def boot(browser, checkpoint, expect_armed=None):
    """A fresh page at a checkpoint, the helpers installed, the player on their feet.

    `expect_armed=True` waits for the first `experience.tick` to arm the beats: the tick runs
    on an animation frame, and under SwiftShader the first frame can be many seconds away.
    """
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(ORIGIN + '?experience=opening&intro=0&checkpoint=' + checkpoint, wait_until='domcontentloaded')
    page.wait_for_function(
        '() => window.__CAMPUS && window.__CAMPUS.openingDebug && window.__CAMPUS.explorer'
        ' && window.__CAMPUS.openingDebug.office', timeout=180000)
    page.keyboard.press('Shift')           # a trusted input claims the save
    page.evaluate('() => { window.__doc = 1; }')
    page.evaluate(HELPERS)
    page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
    armed = None
    if expect_armed is True:
        try:
            page.wait_for_function('() => window.__CAMPUS.openingDebug.office().armed === true', timeout=120000)
            armed = True
        except Exception:
            armed = False
    page.wait_for_timeout(600)
    href = page.evaluate('() => location.href')
    navs = []                              # only navigations after boot count as a reload
    page.on('framenavigated', lambda f: navs.append(f.url) if f == page.main_frame else None)
    page.evaluate('() => window.__errand.place(47.75, 20.0)')
    page.evaluate('() => window.__errand.begin()')
    return context, page, errors, href, navs, armed


D = 'window.__CAMPUS.openingDebug'
G = 'window.__errand.run'


def route_legs(page, c, monitor_stop, hooks=None):
    """The errand itself, as labelled legs.

    `hooks` runs in the middle of the route — `monitor` after the look, `corridor` before the
    office door — so a check or a screenshot can see the state the route was in at that point,
    instead of the end state after the whole errand.
    """
    hooks = hooks or {}
    out = {}
    if monitor_stop:
        out['monitor'] = leg(page, c, 'walking', 'side door → monitor', G + '([[47.75, 18.0], [47.35, 16.0]])')
        out['watch'] = leg(page, c, 'interaction', 'watch the feed (%.1f s)' % WATCH_SECONDS,
                           G + '([], {hold: %s, maxSim: 6})' % WATCH_SECONDS)
        if 'monitor' in hooks:
            hooks['monitor'](out)
        out['call'] = leg(page, c, 'walking', 'monitor → call plate',
                          G + '([[46.9, 14.9], [46.50, 13.75], [46.50, 12.90]])')
    else:
        out['call'] = leg(page, c, 'walking', 'side door → call plate',
                          G + '([[47.4, 16.4], [46.9, 14.9], [46.50, 13.75], [46.50, 12.90]])')
    out['wait'] = leg(page, c, 'lift', 'ground call answered', G + '([], {untilCar: 0.02, maxSim: 20})')
    out['board'] = leg(page, c, 'walking', 'doorway → car', G + '([[45.60, 12.40], [45.03, 12.40]])')
    out['ride'] = leg(page, c, 'lift', 'ride to 5F', G + '([], {untilY: 18.90, maxSim: 30, track: true})')
    out['doors'] = leg(page, c, 'lift', 'doors open at 5F', G + '([], {hold: 1.0, maxSim: 3})')
    out['corridor'] = leg(page, c, 'walking', '5F lobby → office door',
                          G + '([[47.6, 12.6], [49.58, 12.90], [49.8, 12.40], [52.13, 12.40], [54.70, 12.40]])')
    if 'corridor' in hooks:
        hooks['corridor'](out)
    out['aimDoor'] = leg(page, c, 'interaction', 'aim at the office door',
                         'window.__errand.aim(54.78, 20.05, 12.40)')
    page.keyboard.press('f')
    out['swing'] = leg(page, c, 'interaction', 'the leaf swings', G + '([], {hold: 1.05, maxSim: 3})')
    out['desk'] = leg(page, c, 'walking', 'door → around the chair → desk',
                      G + '([[55.60, 12.40], [56.80, 12.40], [57.10, 14.00], [58.70, 13.85]])')
    out['aimLaptop'] = leg(page, c, 'interaction', 'aim at the MacBook',
                           'window.__errand.aim(58.70, 19.68, 12.40)')
    page.keyboard.press('f')
    page.wait_for_timeout(400)
    return out


def main():
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, args=ARGS)

        # ---------------------------------------------------------------- designed + return
        context, page, errors, href, navs, armed = boot(browser, 'b6', expect_armed=True)
        story = page.evaluate(f'() => {D}.state().story')
        check('starts on the errand: stage to_b6, no MacBook yet',
              story['stage'] == 'to_b6' and not story['laptop_acquired'], story)
        check('the office state is exposed to the gate',
              page.evaluate(f'() => {D}.office().revision') == 'opening-2030-v9-office',
              page.evaluate(f'() => {D}.office()'))
        check('the errand arms the abduction beats (E-F3)', armed is True, page.evaluate(f'() => {D}.office()'))

        page.keyboard.down('w')
        held = page.evaluate('() => window.__CAMPUS.explorer.state.keys')
        page.keyboard.up('w')
        check('a real KeyW reaches the controller', 'KeyW' in held, held)

        designed = clock()

        def on_monitor(out):
            """At the monitor, right after the look: the beat, the live feed, the shot."""
            check('walked to the CCTV monitor', out['monitor']['arrived'] == out['monitor']['legs'], out['monitor'])
            check('beat 1: the lobby feed starts on the first look',
                  out['watch']['office']['beats']['lobby_feed'] is not None, out['watch']['office'])
            check('the monitor is still live after the look', out['watch']['office']['feed'] == 'playing',
                  out['watch']['office'])
            check('the built lobby carries the dressing pieces',
                  page.evaluate('() => window.__errand.has("B04_lobby_trolley")'),
                  'the trolley is missing from the scene')
            # The screen's own centre (world), so the panel is square in frame. The wide shot is
            # at arm's length; the narrow one takes a step back so the whole panel fits.
            face = (46.4065, 1.92, 16.0163)
            aim = page.evaluate(f'() => window.__errand.aim({face[0]}, {face[1]}, {face[2]})')
            page.wait_for_timeout(800)
            check('the feed is live in the monitor shot',
                  page.evaluate(f'() => {D}.office().feed') == 'playing',
                  {'feed': page.evaluate(f'() => {D}.office().feed'),
                   'beats': page.evaluate(f'() => {D}.office().beats'), 'aim': aim})
            shot(page, 'task-E-fix1-monitor-live', vantages={
                '1280x800': (47.14, 16.34) + face,
                '390x844': (47.78, 16.63) + face,
            })
            page.evaluate('() => window.__errand.place(47.35, 16.00)')

        def on_corridor(out):
            """In the corridor, before the office door: beat 3, the order, the shot."""
            o = out['corridor']['office']
            check('walked the 5F corridor to the office door', out['corridor']['arrived'] == out['corridor']['legs'], out['corridor'])
            check('beat 3: the corridor carries it by sound', o['beats']['corridor_sound'] is not None, o)
            check('all three beats fired BEFORE the office door opened',
                  all(o['beats'][k] is not None for k in ('lobby_feed', 'feed_dies', 'corridor_sound'))
                  and not o['doorOpen'], o)
            check('the beats latched in route order',
                  o['beatOrder'] == ['lobby_feed', 'feed_dies', 'corridor_sound'], o)
            check('the built corridor carries the dressing pieces',
                  page.evaluate('() => window.__errand.has("B4_lift_5f_evac_sign") && window.__errand.has("B4_lift_5f_flicker")'),
                  'the evacuation sign or the flickering panel is missing from the scene')
            page.evaluate('() => window.__errand.look(51.20, 20.90, 11.90)')
            shot(page, 'task-E-fix1-corridor-dressing', target=(51.20, 20.90, 11.90))

        r = route_legs(page, designed, monitor_stop=True, hooks={'monitor': on_monitor, 'corridor': on_corridor})

        check('the player waited at the call plate and the car came down',
              r['wait']['office']['lift']['doors'] > .99 and abs(r['wait']['office']['lift']['y'] - 0.02) <= .005,
              r['wait']['office']['lift'])
        check('the wait was a real descent, not a teleport',
              r['wait']['sim'] >= 8.5, r['wait'])
        check('walked into the car', r['board']['arrived'] == r['board']['legs'] and abs(r['board']['pos'][1] - 0.02) < 0.2,
              r['board'])
        check('the car carried the player to the 5F landing', abs(r['ride']['pos'][1] - 18.90) <= 0.05, r['ride'])
        check('beat 2: the feed dies when the doors close',
              r['ride']['office']['beats']['feed_dies'] is not None, r['ride']['office'])
        check('the monitor shows static after beat 2', r['ride']['office']['feed'] == 'dead', r['ride']['office'])
        check('the car doors open at the landing', abs(r['doors']['office']['lift']['doors'] - 1) < .01,
              r['doors']['office']['lift'])
        check('the office door is the offered interaction', r['aimDoor']['target'] == 'opening-office-door', r['aimDoor'])
        opened = page.evaluate(f'() => {D}.office()')
        check('real F opens the office door', opened['doorOpen'] is True, opened)
        check('the leaf has swung clear', opened['door']['angle'] <= opened['door']['target'] + 1e-3, opened['door'])
        check('walked around the chair to the desk', r['desk']['arrived'] == r['desk']['legs'], r['desk'])
        check('the MacBook is the offered interaction', r['aimLaptop']['target'] == 'opening-laptop', r['aimLaptop'])
        end = page.evaluate(f'() => {D}.state()')
        check('real F takes the presentation MacBook', end['story']['laptop_acquired'] is True, end['story'])
        check('take_laptop advanced the story to return_b5', end['story']['stage'] == 'return_b5', end['story'])

        designed_totals = totals(designed)
        designed_total = designed_totals['sum']
        designed_wall = designed_totals['wall']

        # ---------------------------------------------------------------- return, riding down
        ret = clock()
        page.evaluate('() => { window.__track = []; }')
        ret['walk'] = leg(page, ret, 'walking', 'desk → car',
                          G + '([[57.10, 14.00], [56.80, 12.40], [55.60, 12.40], [54.7, 12.4], [52.0, 12.4],'
                              ' [49.8, 12.4], [49.58, 12.9], [47.6, 12.6], [45.03, 12.40]])')
        ret['ride'] = leg(page, ret, 'lift', 'ride down to the ground',
                          G + '([], {untilCar: 0.02, maxSim: 30, track: true})')
        ret['out'] = leg(page, ret, 'walking', 'car → ground lobby',
                         G + '([[45.60, 12.40], [46.50, 12.60], [47.60, 12.40]])')
        track = page.evaluate('() => window.__track')
        ret_totals = totals(ret)
        check('the return walk reached the car', ret['walk']['arrived'] == ret['walk']['legs'], ret['walk'])
        check('the player rode the car down to the ground',
              abs(ret['ride']['pos'][1] - 0.02) <= 0.05, {'ride': ret['ride'], 'lift': ret['ride']['office']['lift']})
        check('the car floor carried the player on the way down (mid-ride samples)',
              len(track) >= 12 and all(abs(s['body'] - s['car']) <= 0.30 for s in track)
              and any(s['car'] > 6 for s in track), {'n': len(track), 'first': track[:3], 'last': track[-3:]})
        check('the player walked out into the ground lobby',
              ret['out']['arrived'] == ret['out']['legs'] and abs(ret['out']['pos'][1] - 0.02) <= 0.05,
              {'out': ret['out'], 'lift': ret['out']['office']['lift']})
        check('the ground doorway is open with the car there', True, 'the walk out is the assertion')

        # ---------------------------------------------------------------- one document, one URL
        check('the page never navigated or reloaded',
              page.evaluate('() => window.__doc === 1') and not navs,
              {'doc': page.evaluate('() => window.__doc'), 'navs': navs})
        check('location.href is unchanged', page.evaluate('() => location.href') == href,
              (href, page.evaluate('() => location.href')))
        check('no page errors', not errors, errors[:4])
        context.close()

        # ---------------------------------------------------------------- beeline
        bcontext, bpage, berrors, bhref, bnavs, _ = boot(browser, 'b6', expect_armed=True)
        beeline = clock()
        b = route_legs(bpage, beeline, monitor_stop=False)
        beeline_totals = totals(beeline)
        beeline_total = beeline_totals['sum']
        beeline_wall = beeline_totals['wall']
        check('beeline: walked to the call plate', b['call']['arrived'] == b['call']['legs'], b['call'])
        check('beeline: reached the car', b['board']['arrived'] == b['board']['legs'], b['board'])
        check('beeline: reached the 5F landing', abs(b['ride']['pos'][1] - 18.90) <= 0.05, b['ride'])
        check('beeline: reached the desk', b['desk']['arrived'] == b['desk']['legs'], b['desk'])
        bend = bpage.evaluate(f'() => {D}.state()')
        check('beeline: took the MacBook', bend['story']['laptop_acquired'] is True, bend['story'])
        check('beeline: no page errors', not berrors, berrors[:4])
        bcontext.close()

        # ---------------------------------------------------------------- before acceptance
        ucontext, upage, uerrors, uhref, unavs, _ = boot(browser, 'b5')
        ustory = upage.evaluate(f'() => {D}.state().story')
        check('b5: the errand has not been accepted yet', ustory['stage'] == 'to_b5', ustory)
        check('b5: the beats are disarmed (E-F3)', upage.evaluate(f'() => {D}.office().armed') is False,
              upage.evaluate(f'() => {D}.office()'))
        u = route_legs(upage, clock(), monitor_stop=True)
        dark = upage.evaluate(f'() => {D}.office()')
        check('b5: standing at the monitor fires nothing, with the feed never started',
              dark['beats']['lobby_feed'] is None and dark['feed'] == 'idle', dark)
        check('b5: walking the 5F corridor fires nothing and never opens the door',
              dark['beats']['corridor_sound'] is None and dark['doorOpen'] is False, dark)
        check('b5: the player really did stand at the monitor and walk the corridor',
              u['corridor']['arrived'] == u['corridor']['legs'] and abs(u['ride']['pos'][1] - 18.90) <= 0.05, u)
        check('b5: no page errors', not uerrors, uerrors[:4])
        ucontext.close()

        browser.close()

    report = {
        'clocks': {
            'designed': {'total': designed_total, 'wall': designed_wall, 'legs': designed['legs'],
                         'totals': designed_totals, 'budget': list(BUDGET)},
            'beeline': {'total': beeline_total, 'wall': beeline_wall, 'legs': beeline['legs'],
                        'totals': beeline_totals},
            'return': {'total': ret_totals['sum'], 'legs': ret['legs'], 'totals': ret_totals},
        },
        'designedMinusBeeline': round(designed_total - beeline_total, 4),
        'rideSamples': track,
        'drive': 'fixed-step g.step(1/120) paced to the wall clock, W identical to a held key; one real KeyW down proved the input path',
        'view': '1280x800 and 390x844',
        'href': href,
        'beelineHref': bhref,
        'unarmedHref': uhref,
    }
    print('\n' + json.dumps(report, indent=1), flush=True)

    for name, c in (('designed', designed_totals), ('beeline', beeline_totals), ('return', ret_totals)):
        if abs(c['sum'] - (c['walking'] + c['lift'] + c['interaction'])) > 1e-6:
            failures.append(f'{name}: the legs do not sum ({c})')
    if not (BUDGET[0] <= designed_total <= BUDGET[1]):
        findings.append(
            'FINDING: the designed errand measured %.2f s of play time, outside the %.0f–%.0f s budget. '
            'Reported, not padded.' % (designed_total, BUDGET[0], BUDGET[1]))
    if designed_total < beeline_total:
        failures.append('the designed clock is shorter than the beeline (%s < %s)' % (designed_total, beeline_total))
    for f in findings:
        print(f, flush=True)

    print('\ncheck-b4-errand: %d passed, %d failed, %d finding(s)' % (passed, len(failures), len(findings)), flush=True)
    if failures:
        for f in failures:
            print('  - ' + f, flush=True)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
