"""Browser check: reloading a campaign save keeps the campaign where it was.

Needs a dev or review server (window.__CAMPUS hooks) and Python Playwright:
  CAMPUS_URL=http://127.0.0.1:5250/ CHROME_PATH=<chromium binary> python3 scripts/check-campaign-reload.py

Saves are produced by playing through the real hooks, never written by hand:
the b4 checkpoint, a trusted key press (claimSave), arriveB4 (opening `complete`
+ campaign start), then campaign events.
"""
import os
import sys

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5250/')
CHROME = os.environ.get('CHROME_PATH')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
CAMPAIGN_KEY = 'hku.campaign.v1'

# Count every chapter card shown in this document (the card sets data-chapter-card when it shows).
COUNT_CARDS = """
window.__cards = [];
new MutationObserver(records => {
  for (const r of records) {
    const v = r.target.getAttribute && r.target.getAttribute('data-chapter-card');
    if (r.attributeName === 'data-chapter-card' && v) window.__cards.push(v);
  }
}).observe(document, {subtree: true, attributes: true, attributeFilter: ['data-chapter-card']});
"""

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


def ready(page):
    page.wait_for_function('() => window.__CAMPUS && window.__CAMPUS.campaign && window.__CAMPUS.openingDebug', timeout=90000)


def frames(page, n=6):
    page.evaluate(f'() => new Promise(r => {{ let i = 0; const f = () => (++i >= {n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }})')


SNAPSHOT = """() => ({
  stage: window.__CAMPUS.campaign.state()?.stage ?? null,
  story: window.__CAMPUS.openingDebug.state().story.stage,
  modal: window.__CAMPUS.openingDebug.state().modal,
  dialog: !!document.querySelector('.opening-handoff-dialog'),
  cards: window.__cards.slice(),
  toast: document.getElementById('toast')?.textContent ?? '',
  objective: document.querySelector('.opening-objective')?.textContent ?? '',
})"""


def seed_campaign(page, events):
    """Play to Chapter 1 complete from the b4 checkpoint, then advance the campaign."""
    page.goto(ORIGIN + '?experience=opening&checkpoint=b4', wait_until='load')
    ready(page)
    page.keyboard.press('Shift')  # trusted input: this window owns the save
    page.evaluate('() => __CAMPUS.openingDebug.arriveB4()')
    for e in events:
        page.evaluate(f"() => __CAMPUS.campaign.emit('{e}')")
    frames(page, 3)
    return page.evaluate(SNAPSHOT)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=ARGS, headless=True) if CHROME else p.chromium.launch(args=ARGS, headless=True)
    try:
        # 1. Opening save at `complete` + campaign save at `b4_flip`: a plain load continues at b4_flip.
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script(COUNT_CARDS)
        seeded = seed_campaign(page, ['enter_b4', 'keyboard_solved'])
        check('seed: opening complete, campaign at b4_flip', seeded['story'] == 'complete' and seeded['stage'] == 'b4_flip', seeded)
        page.goto(ORIGIN + '?experience=opening', wait_until='load')
        ready(page)
        frames(page)
        s = page.evaluate(SNAPSHOT)
        check('reload keeps the campaign stage', s['stage'] == 'b4_flip', s)
        check('reload opens no completion modal', s['modal'] is None and not s['dialog'], s)
        check('reload shows at most one chapter card', len(s['cards']) <= 1, s['cards'])
        check('reload asks for no gesture-less pointer lock', 'Pointer lock unavailable' not in s['toast'], s['toast'])
        page.keyboard.press('Shift')
        frames(page)
        s = page.evaluate(SNAPSHOT)
        check('still b4_flip after input', s['stage'] == 'b4_flip' and s['modal'] is None, s)
        # The campaign's hearts channel is the opening runtime: HUD and save follow it.
        h = page.evaluate("() => { const n = __CAMPUS.experience.hearts.damage(2); return {returned: n, runtime: __CAMPUS.openingDebug.state().runtime.hearts}; }")
        frames(page)
        hud = page.evaluate("() => document.querySelector('.opening-hearts-count')?.textContent ?? ''")
        check('ctx hearts damage lands in the opening runtime and the vitals HUD', h['returned'] == 8 and h['runtime'] == 8 and hud == '8 / 10', (h, hud))
        page.goto(ORIGIN + '?experience=opening', wait_until='load')
        ready(page)
        frames(page)
        kept = page.evaluate("() => ({hearts: __CAMPUS.openingDebug.state().runtime.hearts, stage: __CAMPUS.campaign.state()?.stage})")
        check('hearts damage is saved with the opening save', kept == {'hearts': 8, 'stage': 'b4_flip'}, kept)
        check('no page errors (saved campaign)', errors == [], errors)
        page.close()

        # 2. Relay already paired + campaign at `sports`: the Chapter 1 dialog never rewinds it.
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script(COUNT_CARDS)
        seed_campaign(page, ['enter_b4', 'keyboard_solved', 'flip_solved', 'breaker_pulled', 'macbook_connected', 'reach_lawn', 'guardian_shutdown', 'reach_sports'])
        page.evaluate("() => { const m = __CAMPUS.explorer.game.inventory.slots.find(s => s?.itemId === 'macbook-air-13-silver').instanceId; localStorage.setItem('hku.b4.compute.' + m, 'online'); }")
        page.goto(ORIGIN + '?experience=opening', wait_until='load')
        ready(page)
        frames(page)
        s = page.evaluate(SNAPSHOT)
        check('relay paired: reload keeps sports', s['stage'] == 'sports' and s['modal'] is None and not s['dialog'], s)
        check('no page errors (relay paired)', errors == [], errors)
        page.close()

        # 3. Opening save at `complete` with no campaign save (a save from before the campaign): one start, one card.
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script(COUNT_CARDS)
        seed_campaign(page, [])
        page.evaluate(f"() => localStorage.removeItem('{CAMPAIGN_KEY}')")
        page.goto(ORIGIN + '?experience=opening', wait_until='load')
        ready(page)
        frames(page)
        s = page.evaluate(SNAPSHOT)
        check('pre-campaign save starts the campaign once', s['stage'] == 'b4_enter' and s['cards'] == ['CHAPTER 1 · BUILDING 4'], s)
        check('pre-campaign save opens no completion modal', s['modal'] is None and not s['dialog'], s)
        check('no page errors (pre-campaign save)', errors == [], errors)
        page.close()
    finally:
        browser.close()

if failures:
    print(f'\ncheck-campaign-reload: {len(failures)} failed, {passed} passed')
    sys.exit(1)
print(f'\ncheck-campaign-reload: {passed} passed')
