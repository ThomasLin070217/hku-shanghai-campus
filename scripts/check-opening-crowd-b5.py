"""Browser check: the plaza crowd is really in the B5 hall at the b5 checkpoint.

Owner report, 2026-11-25: "why students disappear immediately after we get the macbook mission".
The headless gates prove the decisions (arrivals, routes, the shipped director); this probe
proves the SHIPPED RENDER: 52 instance matrices, feet on the hall floor, every student on its
cleared place, none gone, none moved for 30 s, no page errors.

  npm run -s build:review
  python3.13 -m http.server 5293 --bind 127.0.0.1 --directory dist-review
  CAMPUS_URL=http://127.0.0.1:5293/ CHROME_PATH=<chrome> python3 scripts/check-opening-crowd-b5.py

Screenshots go to SHOTS (default /tmp/one-world/crowd-b5/).
"""
import os

from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get('CAMPUS_URL', 'http://127.0.0.1:5293/')
CHROME = os.environ.get('CHROME_PATH')
SHOTS = os.environ.get('SHOTS', '/tmp/one-world/crowd-b5/')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
URL = ORIGIN.rstrip('/') + '/?experience=opening&intro=0&checkpoint=b5'
PREFIX = 'Sports_Hall_Students__'

CROWD = """() => {
  const C = window.__CAMPUS;
  const d = C.openingDebug.crowd();
  const meshes = [];
  C.viewer.scene.traverse(o => {
    if (o.isInstancedMesh && o.name.startsWith('Sports_Hall_Students__')) {
      const a = o.instanceMatrix.array, at = [];
      for (let i = 0; i < o.count; i++) { const b = i * 16; at.push([a[b + 12], a[b + 13], a[b + 14]]); }
      meshes.push({name: o.name, count: o.count, at});
    }
  });
  return {students: d.students, places: d.places, meshes,
          stage: C.openingDebug.state().story.stage};
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


def main():
    os.makedirs(SHOTS, exist_ok=True)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=ARGS)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        # Page errors are uncaught exceptions, as in the full playthrough. Resource noise from
        # the local relay bridges (127.0.0.1:8790/8788) is not a page error and is reported
        # separately by CHECK if it ever includes game code.
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL, wait_until='domcontentloaded', timeout=120000)
        page.wait_for_function('() => !!(window.__CAMPUS && window.__CAMPUS.ready && window.__CAMPUS.openingDebug && window.__CAMPUS.openingDebug.crowd)',
                               timeout=240000)
        # The b5 checkpoint restores `to_b5`, and the crowd must already be arrived there.
        page.wait_for_timeout(1500)
        first = page.evaluate(CROWD)
        page.wait_for_timeout(30000)
        second = page.evaluate(CROWD)
        page.screenshot(path=SHOTS + 'b5-crowd.png', timeout=90000)
        browser.close()

    check('the b5 checkpoint is the errand stage', first['stage'] == 'to_b5', first['stage'])
    students, places, meshes = first['students'], first['places'], first['meshes']
    check('the crowd is 52 students', len(students) == 52, str(len(students)))
    check('every student is arrived (none walking, none removed)', all(s['done'] for s in students),
          str(sum(1 for s in students if not s['done'])) + ' still walking')
    check('every student keeps its size', all(s['scale'] > 0 for s in students),
          str(sum(1 for s in students if s['scale'] <= 0)) + ' collapsed')
    floor = 0.02
    off_floor = [(round(s['x'], 2), round(s['z'], 2), round(s['y'], 3)) for s in students if abs(s['y'] - floor) > 0.02]
    check('every student has its feet on the hall floor (.02 m)', not off_floor,
          str(len(off_floor)) + ' off the floor: ' + str(off_floor[:5]))
    outside = [(round(s['x'], 2), round(s['z'], 2)) for s in students
               if not (60.8 <= s['x'] <= 80.6 and -78.4 <= s['z'] <= -56.4)]
    check('every student is inside the B5 hall', not outside, str(len(outside)) + ' outside: ' + str(outside[:5]))
    place_set = {(round(x, 3), round(z, 3)) for x, z in places}
    off_place = [(round(s['x'], 3), round(s['z'], 3)) for s in students
                 if (round(s['x'], 3), round(s['z'], 3)) not in place_set]
    check('every student stands on a cleared place (the chair/table check is headless)', not off_place,
          str(len(off_place)) + ' off their place: ' + str(off_place[:5]))
    # Two meshes per student share the same placement (skin + flat material), so the instance
    # total is twice the crowd, and each student appears once in each of its two meshes.
    check('the crowd renders from the cleared places, not build-time matrices',
          len(meshes) > 0 and sum(m['count'] for m in meshes) == 2 * len(students),
          str(sum(m['count'] for m in meshes)) + ' instances for ' + str(len(students)) + ' students')
    matrix_at = [tuple(round(v, 3) for v in at) for m in meshes for at in m['at']]
    student_at = {(round(s['x'], 3), round(s['y'], 3), round(s['z'], 3)) for s in students}
    unmatched = [at for at in matrix_at if at not in student_at]
    check('every rendered instance is at a student position', not unmatched,
          str(len(unmatched)) + ' unmatched: ' + str(unmatched[:5]))
    moved = sum(1 for a, b in zip(first['students'], second['students'])
                if abs(a['x'] - b['x']) > 1e-6 or abs(a['z'] - b['z']) > 1e-6)
    check('the crowd is stable for 30 s', moved == 0, str(moved) + ' students moved')
    check('no page errors', not errors, '\n         '.join(errors[:5]))

    print(f"\n{passed} passed, {len(failures)} failed  (screenshot {SHOTS}b5-crowd.png)", flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
