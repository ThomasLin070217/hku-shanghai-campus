"""Browser check: the whole run in ONE document, from a fresh ?experience=opening to the credits.

Needs a dev or review server (window.__CAMPUS hooks) and Python Playwright:
  CAMPUS_URL=http://127.0.0.1:5255/ CHROME_PATH=<chromium binary> python3 scripts/check-campaign-playthrough.py

Chapter 1 is driven through window.__CAMPUS.openingDebug (as the handoff e2e does),
then the campaign through each chapter's debug hooks, with at least one real input
per chapter: Enter on the invitation, real F at the B4 stations plus typing the
Keyboard Wall phrase, real Q on the lawn, real F at the sports door plus a digit
typed into the lock panel. At every chapter boundary: the chapter card appeared,
location.href is unchanged, window.__doc===1 (same document), the stage advanced
and the view is first person. At the end: relay online for the device, core power
cut, world threat purged, dome released, credits visible, no page errors.

A second, short document covers the Building 4 handoff dialog (relay already
paired): "Continue to Chapter 2" is the focused primary, Close keeps the run
startable in-page (F reopens the dialog), and Continue starts Chapter 2 in-page.
Screenshots go to SHOTS (default /tmp/one-world/t6/).
"""
import json
import os
import time

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5255/')
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS', '/tmp/one-world/t6/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']

COUNT_CARDS = """
window.__cards = [];
const watch = () => new MutationObserver(records => {
  for (const r of records) {
    const v = r.target.getAttribute && r.target.getAttribute('data-chapter-card');
    if (r.attributeName === 'data-chapter-card' && v) window.__cards.push(v);
  }
}).observe(document, {subtree: true, attributes: true, attributeFilter: ['data-chapter-card']});
if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);
"""
HELPERS = """
window.__t6 = {
  place(x, z, top = 2) {
    const g = window.__CAMPUS.explorer.game, w = window.__CAMPUS.explorer.world;
    const y = w.support(x, z, top) ?? 0; g.body.position.set(x, y, z); g.body.velocity.set(0, 0, 0); g.body.grounded = true;
  },
  snap() {
    const C = window.__CAMPUS;
    return {stage: C.campaign.state()?.stage ?? null, story: C.openingDebug.state().story.stage, modal: C.openingDebug.state().modal,
      view: C.explorer.game.view, paused: C.explorer.game.paused, panel: C.explorer.game.panel, doc: window.__doc ?? null,
      href: location.href, cards: window.__cards.slice(), toast: document.getElementById('toast')?.textContent ?? ''};
  },
};
"""

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


def shot(page, name):
    try:
        page.screenshot(path=SHOTS + name, timeout=90000)
        print('  shot', SHOTS + name, flush=True)
    except Exception as error:  # Screenshots are evidence, not assertions.
        print('  shot failed', name, type(error).__name__, flush=True)


def until(page, js, timeout=120):
    try:
        page.wait_for_function(js, timeout=timeout * 1000, polling=400)
        return True
    except Exception:
        return False


def snap(page):
    return page.evaluate('() => window.__t6.snap()')


def boot(page, query):
    page.goto(ORIGIN + query, wait_until='domcontentloaded')
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.campaign && window.__CAMPUS.openingDebug && window.__CAMPUS.explorer', timeout=120000)
    page.keyboard.press('Shift')  # claimSave needs a trusted input
    page.evaluate('() => { window.__doc = 1; }')
    page.evaluate(HELPERS)
    page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
    page.wait_for_timeout(500)


def boundary(page, label, stage, card, href, shot_name):
    ok = until(page, f"() => window.__CAMPUS.campaign.state()?.stage === {json.dumps(stage)} && window.__cards.includes({json.dumps(card)})", 90)
    s = snap(page)
    check(f'{label}: stage is {stage}', s['stage'] == stage, s)
    check(f'{label}: chapter card "{card}" appeared', card in s['cards'], s['cards'])
    check(f'{label}: same document, same URL', s['href'] == href and s['doc'] == 1, (s['href'], s['doc']))
    check(f'{label}: first person', s['view'] == 'first', s['view'])
    shot(page, shot_name)
    return ok


def resume(page):
    page.evaluate('() => { const e = window.__CAMPUS.explorer; if (e.game.panel) e.closePanel(); e.enterCompat(); }')
    page.wait_for_timeout(300)


def main_run(browser):
    context = browser.new_context(viewport={'width': 1440, 'height': 810})
    context.add_init_script(COUNT_CARDS)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    boot(page, '?experience=opening')
    href = page.evaluate('() => location.href')
    D = 'window.__CAMPUS.openingDebug'
    check('fresh run starts on the shuttle', snap(page)['story'] == 'bus', snap(page))

    # ---- Chapter 1 (debug hooks, one real input: Enter on the invitation) ----
    page.evaluate(f'() => {D}.openInvitation()')
    until(page, "() => !!document.querySelector('.opening-dialog')", 30)
    page.wait_for_timeout(400)
    page.keyboard.press('Enter')
    until(page, f'() => {D}.state().story.invitation_read', 30)
    check('Chapter 1: Enter on the invitation reads it (real input)', page.evaluate(f'() => {D}.state().story.invitation_read'))
    resume(page)
    page.evaluate(f'() => {{ {D}.exitBus(); {D}.acceptErrand(); }}')
    page.evaluate(f'() => {D}.takeLaptop()')
    # The player opens the MacBook (C) and reads the alert inside it: open it through the
    # same path (openComputer -> open('computer') pauses and opens the panel), then readAlert.
    page.evaluate(f'() => {{ {D}.triggerIncident(); {D}.reachB5(); {D}.openComputer("tasks"); {D}.readAlert(); }}')
    page.wait_for_timeout(600)
    # Real keys close it: C closes the MacBook; Escape first closes an open app inside it.
    for key in ('c', 'Escape', 'Escape', 'c'):
        if page.evaluate(f'() => {D}.state().modal') is None:
            break
        page.keyboard.press(key)
        until(page, f'() => {D}.state().modal === null', 8)
    check('Chapter 1: the MacBook closes with real keys', page.evaluate(f'() => {D}.state().modal') is None, snap(page))
    resume(page)
    check('Chapter 1: story reached to_b4', page.evaluate(f'() => {D}.state().story.stage') == 'to_b4', snap(page))
    shot(page, '00-chapter1-to-b4.png')
    page.evaluate(f'() => {D}.arriveB4()')

    # ---- B4 Keyboard Wall ----
    boundary(page, 'Chapter 1 -> B4', 'b4_enter', 'CHAPTER 1 · BUILDING 4', href, '01-b4-card.png')
    resume(page)
    page.evaluate('() => window.__t6.place(58, 19.2)')
    check('B4: walking in through the door emits enter_b4', until(page, "() => window.__CAMPUS.campaign.state().stage === 'b4_keyboard'", 60), snap(page))
    B4 = 'window.__CAMPUS.campaign.debug.b4'
    stand = page.evaluate(f'() => {B4}.stations()')
    page.evaluate(f"() => window.__t6.place({stand['keyboard']['stand'][0]}, {stand['keyboard']['stand'][2]}, .7)")
    until(page, f"() => {B4}.state().near === 'keyboard'", 30)
    page.keyboard.press('f')
    focused = until(page, f"() => {B4}.state().focus === 'keyboard'", 30)
    check('B4: real F at the Keyboard Wall enters the focus view', focused, page.evaluate(f'() => {B4}.state()'))
    page.keyboard.type('ILOVECDS', delay=60)
    page.keyboard.press('Enter')
    check('B4: typing I LOVE CDS + Enter boots CPU 01 (real input)', until(page, "() => window.__CAMPUS.campaign.state().stage === 'b4_flip'", 30), page.evaluate(f'() => {B4}.state()'))
    resume(page)
    page.evaluate(f'() => {B4}.flipAll()')
    check('B4: flip wall solved', until(page, "() => window.__CAMPUS.campaign.state().stage === 'b4_breaker'", 60), snap(page))
    resume(page)
    for station, want in (('breaker', 'b4_connect'), ('port', 'to_lawn')):
        page.evaluate(f"() => window.__t6.place({stand[station]['stand'][0]}, {stand[station]['stand'][2]}, .7)")
        until(page, f"() => {B4}.state().near === {json.dumps(station)}", 30)
        page.keyboard.press('f')
        check(f'B4: real F at the {station}', until(page, f"() => window.__CAMPUS.campaign.state().stage === {json.dumps(want)}", 30), page.evaluate(f'() => {B4}.state()'))
    check('B4: room lights stay on at the port after connecting', page.evaluate("() => !!window.__CAMPUS.asset.root.getObjectByName('B4_room_lights')"))

    # ---- Chapter 2: the lawn ----
    boundary(page, 'B4 -> Chapter 2', 'to_lawn', 'CHAPTER 2', href, '02-lawn-card.png')
    resume(page)
    page.evaluate('() => window.__t6.place(58, 25)')
    page.wait_for_timeout(1500)
    check('B4: room lights go out once the player is outside B04', until(page, "() => !window.__CAMPUS.asset.root.getObjectByName('B4_room_lights')", 30))
    page.evaluate("() => { document.getElementById('toast').textContent = ''; }")
    page.keyboard.press('f')
    got = until(page, "() => /move closer/i.test(document.getElementById('toast').textContent)", 15)
    check('F with nothing in reach tells the player (one handler, campaign first)', got, snap(page)['toast'])
    entry = page.evaluate("() => window.__CAMPUS.campaign.objective().target")
    page.evaluate(f'() => window.__t6.place({entry[0]}, {entry[2]})')
    check('lawn: reaching the shelter emits reach_lawn', until(page, "() => window.__CAMPUS.campaign.state().stage === 'lawn'", 60), snap(page))
    L = 'window.__CAMPUS.campaign.debug.lawn'
    until(page, f"() => {L}.state().phase !== 'safe'", 30)
    page.evaluate("() => { document.getElementById('toast').textContent = ''; }")
    before = page.evaluate(f'() => {L}.state().phase')
    page.keyboard.press('q')
    page.wait_for_timeout(800)
    after = page.evaluate(f'() => ({{phase: {L}.state().phase, toast: document.getElementById("toast").textContent}})')
    check('lawn: a real Q press reaches the fight (interrupt or its rule notice)', after['phase'] == 'stunned' or bool(after['toast']), (before, after))
    shot(page, '03-lawn-fight.png')
    page.evaluate(f'() => {L}.complete()')

    # ---- Chapter 3: the sports hall ----
    boundary(page, 'Chapter 2 -> Chapter 3', 'to_sports', 'CHAPTER 3', href, '04-sports-card.png')
    resume(page)
    entry = page.evaluate("() => window.__CAMPUS.campaign.objective().target")
    # Stand at the east door outside point facing west, toward the door.
    page.evaluate(f'() => {{ window.__t6.place({entry[0]}, {entry[2]}); const g = window.__CAMPUS.explorer.game; g.yaw = Math.PI / 2; g.pitch = 0; }}')
    check('sports: reaching the east door emits reach_sports', until(page, "() => window.__CAMPUS.campaign.state().stage === 'sports'", 60), snap(page))
    until(page, "() => window.__CAMPUS.campaign.debug.sports && window.__CAMPUS.campaign.objective()?.text === 'Open the sports hall east door'", 30)
    page.wait_for_timeout(1500)
    page.keyboard.press('f')
    panel = until(page, "() => window.__CAMPUS.explorer.game.panel === 'door' && !!document.querySelector('input.sudoku-cell')", 30)
    check('sports: real F at the east door opens the lock panel', panel, snap(page))
    if panel:
        page.locator('input.sudoku-cell').first.click()
        page.keyboard.type('5')
        typed = page.evaluate("() => document.querySelector('input.sudoku-cell').value")
        check('sports: a digit typed into the lock panel lands in the cell (real input)', typed == '5', typed)
        shot(page, '05-sports-lock.png')
    page.evaluate('() => window.__CAMPUS.campaign.debug.sports.open()')
    resume(page)

    # ---- Ending ----
    boundary(page, 'Chapter 3 -> ending', 'ending', 'EPILOGUE', href, '06-ending-card.png')
    resume(page)
    t0 = time.time()
    done = until(page, "() => window.__CAMPUS.campaign.state()?.stage === 'done' && !!document.querySelector('#ending-credits.show')", 420)
    page.wait_for_timeout(1500)  # let the credits fade finish before the screenshot
    print(f'  ending took {time.time() - t0:.0f} s of wall time', flush=True)
    check('ending: the campaign reaches done', done, snap(page))
    final = page.evaluate("""() => {
      const mac = window.__CAMPUS.explorer.game.inventory.slots.find(s => s?.itemId === 'macbook-air-13-silver')?.instanceId;
      const credits = document.querySelector('#ending-credits-card');
      const box = credits?.getBoundingClientRect();
      return {mac, relay: localStorage.getItem('hku.b4.compute.' + mac), power: localStorage.getItem('hku.missions.core-power.v1.' + mac),
        threat: window.__CAMPUS.worldThreat().phase, atmosphere: window.__CAMPUS.atmosphere.snapshot(),
        // Visible = the overlay has faded in and is what the player sees at the card's centre (nothing on top).
        credits: !!credits && box.width > 0 && document.getElementById('ending-credits')?.classList.contains('show')
          && !!document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('#ending-credits'),
        href: location.href, doc: window.__doc, view: window.__CAMPUS.explorer.game.view};
    }""")
    check('end: relay online for the device', final['relay'] == 'online', final)
    check('end: core power cut for the device', final['power'] == 'ai_core_power_cut', final)
    check('end: world threat purged', final['threat'] == 'purged', final['threat'])
    atm = final['atmosphere']
    check('end: dome released', atm['phase'] == 'day' and not atm['curtainVisible'] and not atm['releasing'], {k: atm[k] for k in ('phase', 'curtainVisible', 'releasing', 'curtainProgress')})
    check('end: credits visible', final['credits'])
    check('end: same document, same URL, first person', final['href'] == href and final['doc'] == 1 and final['view'] == 'first', final)
    shot(page, '07-credits.png')
    check('no page errors', not errors, errors)
    context.close()


def handoff_dialog(browser):
    """Chapter 1 complete with the relay already paired: the completion dialog."""
    context = browser.new_context(viewport={'width': 1440, 'height': 810})
    context.add_init_script(COUNT_CARDS)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    boot(page, '?experience=opening&checkpoint=b4')
    href = page.evaluate('() => location.href')
    D = 'window.__CAMPUS.openingDebug'
    # The relay is paired beforehand (the key the B4 port writes), so the handoff shows the dialog.
    page.evaluate("() => { const mac = window.__CAMPUS.explorer.game.inventory.slots.find(s => s?.itemId === 'macbook-air-13-silver').instanceId; localStorage.setItem('hku.b4.compute.' + mac, 'online'); }")
    page.evaluate(f'() => {D}.arriveB4()')
    shown = until(page, "() => !!document.querySelector('.opening-handoff-dialog')", 30)
    check('handoff dialog shows when the relay is already paired', shown)
    page.wait_for_timeout(600)
    info = page.evaluate("""() => ({focus: document.activeElement?.textContent?.trim(), text: document.querySelector('.opening-handoff-dialog')?.innerText ?? '',
      primaries: [...document.querySelectorAll('.opening-handoff-dialog .opening-button--primary')].filter(b => !b.hidden).map(b => b.textContent.trim())})""")
    check('handoff: "Continue to Chapter 2" is the focused primary', info['focus'] == 'Continue to Chapter 2', info['focus'])
    check('handoff: one primary button', info['primaries'] == ['Continue to Chapter 2'], info['primaries'])
    check('handoff: no stale end-of-slice copy', 'End of the current slice' not in info['text'] and 'not implemented' not in info['text'], info['text'][:300])
    shot(page, '08-handoff-dialog.png')
    page.locator('.opening-handoff-dialog .opening-button--secondary', has_text='Close').click()
    until(page, f'() => {D}.state().modal === null', 15)
    check('handoff: Close leaves the run at Building 4 with no campaign', snap(page)['stage'] is None and snap(page)['modal'] is None, snap(page))
    page.evaluate("() => document.querySelector('.opening-epilogue button')?.click()")
    resume(page)
    page.keyboard.press('f')
    # Wait for the reopened dialog itself (modal state + its Continue focused), not for a node that may linger hidden.
    again = until(page, f"() => {D}.state().modal === 'complete' && !document.querySelector('.opening-modal-root')?.hidden && document.activeElement?.textContent?.trim() === 'Continue to Chapter 2'", 30)
    check('handoff: F at Building 4 reopens the dialog (campaign still startable in-page)', again, snap(page))
    focus = page.evaluate("""() => { const b = [...document.querySelectorAll('.opening-handoff-dialog .opening-button--primary')].find(x => /Chapter 2/.test(x.textContent));
      return {active: document.activeElement?.textContent?.trim() ?? null, activeTag: document.activeElement?.tagName, disabled: b?.disabled, hidden: b?.hidden,
        rootHidden: document.querySelector('.opening-modal-root')?.hidden ?? null, epilogue: !document.querySelector('.opening-epilogue')?.hidden}; }""")
    check('handoff: the reopened dialog focuses "Continue to Chapter 2"', focus['active'] == 'Continue to Chapter 2' and not focus['disabled'], focus)
    page.keyboard.press('Enter')
    started = until(page, "() => window.__CAMPUS.campaign.state()?.stage === 'to_lawn'", 30)
    s = snap(page)
    check('handoff: Continue starts Chapter 2 in this document', started and s['href'] == href and s['doc'] == 1, s)
    check('handoff: no page errors', not errors, errors)
    context.close()


NO_CINEMA = """() => { const c = document.querySelector('.opening-cinema');
  return {cinemaShown: !!c && !c.hidden, bodyClass: document.body.classList.contains('opening-cinema-active'),
    title: c && !c.hidden ? c.innerText.trim().slice(0, 80) : '', hudHidden: document.body.classList.contains('opening-cinema-active')}; }"""


def lawn_cinema(browser):
    """Chapter 1 rushed through its hooks right after the wake starts, then the lawn:
    no opening letterbox or title (wake, showTitle) may show while the campaign runs,
    also after a lawn capture."""
    context = browser.new_context(viewport={'width': 1440, 'height': 810})
    context.add_init_script(COUNT_CARDS)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    boot(page, '?experience=opening')
    D = 'window.__CAMPUS.openingDebug'
    page.evaluate(f'() => {{ {D}.readInvitation(); {D}.exitBus(); {D}.acceptErrand(); {D}.takeLaptop(); {D}.triggerIncident(); {D}.reachB5(); {D}.openComputer("tasks"); {D}.readAlert(); }}')
    page.wait_for_timeout(400)
    for key in ('c', 'Escape', 'Escape', 'c'):
        if page.evaluate(f'() => {D}.state().modal') is None:
            break
        page.keyboard.press(key)
        until(page, f'() => {D}.state().modal === null', 8)
    resume(page)
    page.evaluate(f'() => {D}.arriveB4()')
    until(page, "() => window.__CAMPUS.campaign.state()?.stage === 'b4_enter'", 30)
    page.evaluate('() => window.__CAMPUS.campaign.debug.b4.complete()')
    until(page, "() => window.__CAMPUS.campaign.state()?.stage === 'to_lawn'", 30)
    resume(page)
    entry = page.evaluate("() => window.__CAMPUS.campaign.objective().target")
    page.evaluate(f'() => window.__t6.place({entry[0]}, {entry[2]})')
    until(page, "() => window.__CAMPUS.campaign.state()?.stage === 'lawn'", 60)
    page.wait_for_timeout(2500)
    at_lawn = page.evaluate(NO_CINEMA)
    check('lawn: no opening letterbox or title while the campaign runs', not at_lawn['cinemaShown'] and not at_lawn['bodyClass'], at_lawn)
    shot(page, '09-lawn-no-cinema.png')
    hearts = page.evaluate('() => window.__CAMPUS.campaign.debug.lawn.hearts()')
    page.evaluate('() => window.__CAMPUS.campaign.debug.lawn.capture()')
    page.wait_for_timeout(2500)
    after = page.evaluate(NO_CINEMA)
    check('lawn: a capture happened', page.evaluate('() => window.__CAMPUS.campaign.debug.lawn.hearts()') < hearts)
    check('lawn: no opening letterbox or title after a capture', not after['cinemaShown'] and not after['bodyClass'], after)
    shot(page, '10-lawn-after-capture.png')
    # Reload at `lawn`: the restored run (opening save + campaign save, passed chapters re-attached).
    page.wait_for_timeout(5500)  # past the opening save throttle, so the reload restores this run
    page.evaluate(f'() => {D}.state() && window.__CAMPUS.experience.persist(true)')
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.campaign && window.__CAMPUS.openingDebug && window.__CAMPUS.explorer', timeout=120000)
    page.keyboard.press('Shift')
    page.evaluate(HELPERS)
    page.evaluate('() => window.__CAMPUS.explorer.enterCompat()')
    restored = until(page, "() => window.__CAMPUS.campaign.state()?.stage === 'lawn'", 60)
    page.wait_for_timeout(2500)
    reloaded = page.evaluate(NO_CINEMA)
    check('lawn: the reload restores the campaign at lawn', restored, snap(page))
    check('lawn: no opening letterbox or title after a reload at lawn', not reloaded['cinemaShown'] and not reloaded['bodyClass'], reloaded)
    shot(page, '11-lawn-after-reload.png')
    check('lawn cinema: no page errors', not errors, errors)
    context.close()


with sync_playwright() as p:
    os.makedirs(SHOTS, exist_ok=True)
    browser = p.chromium.launch(executable_path=CHROME, args=ARGS, headless=True) if CHROME else p.chromium.launch(args=ARGS, headless=True)
    started = time.time()
    try:
        if os.environ.get('ONLY') in (None, '', 'main'):
            main_run(browser)
        if os.environ.get('ONLY') in (None, '', 'handoff'):
            handoff_dialog(browser)
        if os.environ.get('ONLY') in (None, '', 'lawn'):
            lawn_cinema(browser)
    finally:
        browser.close()
    print(f'\ncheck-campaign-playthrough: {passed} passed, {len(failures)} failed ({time.time() - started:.0f} s)')
    if failures:
        raise SystemExit(1)
