"""Browser check: the MacBook errand, side door to the 5F principal's office (Task E).

Needs a dev or review server (the `window.__CAMPUS` hooks) and Python Playwright:

    CAMPUS_URL=http://127.0.0.1:5288/ CHROME_PATH=<chromium binary> \\
        python3 scripts/check-b4-errand.py

Three pages, each one a separate fresh boot:

  * `?checkpoint=b6` — the **designed** run: side door → monitor (a 4.0 s look at the live
    feed) → call plate → wait for the car → ride → corridor → office door → desk, then the
    **return** run: desk → car → ride down → ground lobby. The screenshots come from this
    page: the side-door approach, the monitor close-up, and the 5F corridor with the trolley.
  * `?checkpoint=b6` — the **beeline**: the same errand with the monitor detour and the look
    removed. Reported, never padded.
  * `?checkpoint=b5` — before the errand is accepted: the beats must stay dark even with the
    player standing at the monitor and walking the 5F corridor (E-F3), and the office door
    must not be offered (C.3).

E.10's projection proxy lives in the first page. At the pinned approach pose it builds the
canvas-UV -> screen-pixel homography from the **screen mesh's own** four corners and their real
geometry UVs (never the bezel), checks the UV identity precondition, cross-checks the
homography against an independent 3D projection of the same canvas points, then measures the
convoy's span, the two eye bars, the group's contiguity and its clearance from both frame
edges. The bezel is measured geometrically, not through its UVs: this build's UV pass rewrites
the UVs of untextured meshes, so a UV-derived frame quad would be meaningless. The trolley's
screen box is measured at the corridor pose.

Every bound is a *requirement* stated in the requirement's own units — E.9's 30 px reading
floor, E.10's 2 px eye bars, the authored canvas proportions — and the measured value is
printed beside it as evidence about this build. No bound is derived from the measurement it
gates: a tolerance taken from the build's own error cannot fail for that build.

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

# E.10: the pinned evidence poses. Stored here and in the report so every shot is reproducible.
APPROACH = (47.72, 17.35)                    # the side-door walk, passing the monitor
SCREEN_FACE = (46.4065, 1.92, 16.0163)       # the lobby monitor's screen centre
TROLLEY_AIM = (52.35, 19.45, 12.30)          # the trolley mid-corridor, from the office-door end

# E.10: every bound below is a *requirement*, stated in the requirement's own units. The
# measured value is printed beside it as evidence about this build, and never defines the
# bound — a tolerance derived from the measurement cannot fail for the build that produced
# it, which makes the gate green by construction.
#
# The anchor is E.9's reading condition: "a student must read as an upright human at 30-40
# screen px". 30 px is the floor of that band, so anything smaller is unreadable by the
# stated requirement whatever this build happens to measure.
READING_FLOOR_PX = 30.0
# The authored canvas proportions (FEED_WIDTH.student 9 / FEED_HEIGHT.student 33.4): a
# student's width at the smallest legible height. A span narrower than that cannot contain
# one legible student, so it is not a group. 9 / 33.4 * 30 = 8.08 px.
STUDENT_ASPECT = 9 / 33.4
SPAN_FLOOR_PX = round(READING_FLOOR_PX * STUDENT_ASPECT, 3)
# E.10: "students + robots are one contiguous group" — both kinds must be present, and a
# group of one is not the composition the feed draws (FEED_ORDER authors 4 students, 2 robots).
FIGURES_PER_KIND_MIN = 2
# E.10, verbatim: "both eye bars >= 2 px".
EYE_BAR_MIN_PX = 2.0
# The homography is exact for a plane under perspective; the only error left is floating
# point. One pixel is the smallest error that can change which pixel a point falls in, so
# the requirement is sub-pixel.
HOMOGRAPHY_MAX_ERROR_PX = 1.0
# Condition 1: the bezel must be measurably larger than the picture on every side. One pixel
# is the smallest distinguishable separation; a frame-derived homography would put the
# screen's own corners on the frame's edge, giving a margin of 0 and failing here.
SCREEN_IN_FRAME_MIN_PX = 1.0
# The trolley must be identifiable as an object rather than the speck E.11 removes, so it
# gets the same 30 px reading floor in both dimensions.
TROLLEY_MIN_W_PX = READING_FLOOR_PX
TROLLEY_MIN_H_PX = READING_FLOOR_PX
# Stated aspect tolerance: the canvas is 192x112 (1.7143) and the authored screen plane
# 0.86x0.50 (1.72) — a 0.33 % difference from rounding the plate. 2 % admits that and still
# rejects a transposed or stretched mapping, which is off by ~194 %.
UV_ASPECT_TOLERANCE = .02

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
  /**
   * E.10: project the lobby monitor's canvas into screen pixels at whatever pose the camera
   * is in now, and measure what the player would see.
   *
   * The screen is a planar quad under perspective, so canvas UV -> screen pixels is exactly a
   * 3x3 homography, built from the *screen mesh's own* four corners and their real geometry
   * UVs. Reading the UVs rather than assuming an orientation is deliberate: a BoxGeometry's
   * u/v axes are not something to remember wrong, and a wrong assumption would silently map
   * the wrong part of the canvas. The quad corners come from the emissive +X face of the
   * screen box, never the frame: the bezel carries no picture and would inflate every span.
   */
  feedView() {
    const C = window.__CAMPUS, scene = C.viewer.scene, cam = C.explorer.camera;
    const W = innerWidth, H = innerHeight, EPS = 1e-6;
    const find = (prefix) => {
      let out = null;
      scene.traverse(o => {
        if (!out && typeof o.name === 'string' && (o.name === prefix || o.name.startsWith(prefix + '#'))) out = o;
      });
      return out;
    };
    const screen = find('B4_cctv_screen'), frame = find('B4_cctv_frame');
    if (!screen || !frame) return {ok: false, error: 'monitor mesh missing'};
    /** The +X face of a box: its four corners, each with the geometry's own u/v. */
    const face = (mesh) => {
      const g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, p = g.parameters;
      const x = p.width / 2, seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - x) > EPS) continue;
        const q = {y: pos.getY(i), z: pos.getZ(i), u: uv.getX(i), v: uv.getY(i)};
        seen.set([q.y, q.z, q.u, q.v].map(n => n.toFixed(6)).join('|'), q);
      }
      return {plane: {w: p.depth, h: p.height}, verts: [...seen.values()]};
    };
    const project = (mesh, q) => {
      const v = mesh.position.clone(); v.set(mesh.geometry.parameters.width / 2, q.y, q.z);
      mesh.localToWorld(v);
      const distance = v.distanceTo(cam.position);
      v.project(cam);
      return {x: (v.x * .5 + .5) * W, y: (-v.y * .5 + .5) * H, z: v.z, distance};
    };
    const tex = screen.material.map;
    // CanvasTexture flips the image by default: canvas row 0 (the picture's top) is v = 1.
    const flip = tex ? tex.flipY !== false : true;
    const canvasCorner = (u, v) => flip ? [u, 1 - v] : [u, v];
    const corners = (mesh, verts) => verts.map(q => {
      const c = canvasCorner(q.u, q.v);
      return {cu: c[0], cv: c[1], px: project(mesh, q)};
    });
    const pick = (list, cu, cv) => {
      const hit = list.find(c => Math.abs(c.cu - cu) < .002 && Math.abs(c.cv - cv) < .002);
      return hit ? hit.px : null;
    };
    const quad = (list) => {
      const q00 = pick(list, 0, 0), q10 = pick(list, 1, 0), q11 = pick(list, 1, 1), q01 = pick(list, 0, 1);
      return q00 && q10 && q11 && q01 ? {q00, q10, q11, q01} : null;
    };
    const sface = face(screen), fface = face(frame);
    const sc = corners(screen, sface.verts), sq = quad(sc);
    /** Order a projected rectangle's corners into a convex ring (no winding assumed). */
    const hull = (pts) => {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      return pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    };
    const area2 = (poly) => poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return s + p.x * q.y - q.x * p.y;
    }, 0);
    /** Smallest signed distance from `pts` to `poly`'s edges: positive means all inside. */
    const insideMargin = (pts, poly) => {
      const sense = Math.sign(area2(poly)) || 1;
      let best = Infinity;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1;
        for (const p of pts) {
          const cross = ex * (p.y - a.y) - ey * (p.x - a.x);
          best = Math.min(best, (sense * cross) / len);
        }
      }
      return best;
    };
    /** The +X face's four corners, deduped by position alone. The UV pass gives one corner
     *  several UVs, so a UV-keyed dedupe yields more than four verts and no quad. */
    const faceCorners = (mesh) => {
      const g = mesh.geometry, pos = g.attributes.position, p = g.parameters;
      const x = p.width / 2, seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - x) > EPS) continue;
        const y = pos.getY(i), z = pos.getZ(i);
        seen.set([y, z].map(n => n.toFixed(6)).join('|'), {y, z});
      }
      return [...seen.values()];
    };
    // Condition 1: the bezel is measured *geometrically*. A UV pass in this build rewrites
    // the UVs of every untextured mesh — the frame's +X face reads 0.12 / -0.12 / 0.00875,
    // i.e. local position x 0.25 — so a UV-derived frame quad would be meaningless and, worse,
    // could silently land anywhere. Four corners, projected; nothing assumed.
    const fq = (() => {
      const pts = faceCorners(frame);
      return pts.length === 4 ? hull(pts.map(q => project(frame, q))) : null;
    })();
    const inFrame = sq && fq
      ? {minMarginPx: insideMargin([sq.q00, sq.q10, sq.q11, sq.q01], fq), frameQuad: fq}
      : {minMarginPx: null, frameQuad: fq};
    const homography = (q) => {
      const dx1 = q.q10.x - q.q11.x, dx2 = q.q01.x - q.q11.x, dx3 = q.q00.x - q.q10.x + q.q11.x - q.q01.x;
      const dy1 = q.q10.y - q.q11.y, dy2 = q.q01.y - q.q11.y, dy3 = q.q00.y - q.q10.y + q.q11.y - q.q01.y;
      const det = dx1 * dy2 - dx2 * dy1;
      let g = 0, h = 0;
      if (Math.abs(det) > 1e-9) { g = (dx3 * dy2 - dx2 * dy3) / det; h = (dx1 * dy3 - dx3 * dy1) / det; }
      const a = q.q10.x - q.q00.x + g * q.q10.x, b = q.q01.x - q.q00.x + h * q.q01.x, c = q.q00.x;
      const d = q.q10.y - q.q00.y + g * q.q10.y, e = q.q01.y - q.q00.y + h * q.q01.y, f = q.q00.y;
      return (u, v) => {
        const den = g * u + h * v + 1;
        return {x: (a * u + b * v + c) / den, y: (d * u + e * v + f) / den};
      };
    };
    const map = sq ? homography(sq) : null;
    // Independent path to the same pixel: convert the canvas point to the rectangle's local
    // (y, z) through the mesh's own corner UVs and project it as a 3D point. A sign error or
    // a missing projective term in the 2D homography shows up at the interior probes even
    // though the four defining corners agree by construction.
    const probe = (cu, cv) => {
      const [u, v] = flip ? [cu, 1 - cv] : [cu, cv];
      const at = (uu, vv) => sface.verts.find(q => Math.abs(q.u - uu) < .002 && Math.abs(q.v - vv) < .002);
      const c00 = at(0, 0), c10 = at(1, 0), c11 = at(1, 1), c01 = at(0, 1);
      if (!c00 || !c10 || !c11 || !c01) return null;
      const y = c00.y * (1 - u) * (1 - v) + c10.y * u * (1 - v) + c11.y * u * v + c01.y * (1 - u) * v;
      const z = c00.z * (1 - u) * (1 - v) + c10.z * u * (1 - v) + c11.z * u * v + c01.z * (1 - u) * v;
      return project(screen, {y, z});
    };
    const homographyCheck = map ? (() => {
      const rows = [[.5, .5], [.25, .25], [.75, .25], [.75, .75], [.25, .75]].map(([cu, cv]) => {
        const a = map(cu, cv), b = probe(cu, cv);
        return b ? {cu, cv, homography: [a.x, a.y], projected: [b.x, b.y],
                    errorPx: Math.hypot(a.x - b.x, a.y - b.y)}
                 : {cu, cv, homography: [a.x, a.y], projected: null, errorPx: null};
      });
      return {rows, maxErrorPx: rows.every(r => r.errorPx !== null)
        ? Math.max(...rows.map(r => r.errorPx)) : null};
    })() : null;
    const rectPx = (r) => {
      const pts = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map(([u, v]) => map(u, v));
      return {
        x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)),
        x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)),
      };
    };
    const office = C.openingDebug.office();
    const figs = (office.feedFigures || []).map(f => ({
      kind: f.kind, dir: f.dir,
      rect: map ? rectPx(f.rect) : null,
      eye: f.eye && map ? rectPx(f.eye) : null,
    }));
    const rects = (list) => list.length ? {
      x0: Math.min(...list.map(r => r.x0)), y0: Math.min(...list.map(r => r.y0)),
      x1: Math.max(...list.map(r => r.x1)), y1: Math.max(...list.map(r => r.y1)),
    } : null;
    const all = rects(figs.map(f => f.rect).filter(Boolean));
    const students = rects(figs.filter(f => f.kind === 'student').map(f => f.rect).filter(Boolean));
    const robots = rects(figs.filter(f => f.kind === 'robot').map(f => f.rect).filter(Boolean));
    const sorted = figs.filter(f => f.rect).sort((a, b) => a.rect.x0 - b.rect.x0);
    let maxGap = 0;
    for (let i = 1; i < sorted.length; i++) maxGap = Math.max(maxGap, sorted[i].rect.x0 - sorted[i - 1].rect.x1);
    return {
      ok: !!(sq && fq && map && homographyCheck && homographyCheck.maxErrorPx !== null),
      viewport: {w: W, h: H},
      uv: {
        canvas: tex && tex.image ? {w: tex.image.width, h: tex.image.height} : null,
        repeat: tex ? [tex.repeat.x, tex.repeat.y] : null,
        offset: tex ? [tex.offset.x, tex.offset.y] : null,
        flipY: flip,
        screenPlane: sq ? sface.plane : null,
        framePlane: fface.plane,
        cornersOk: !!sq,
      },
      screenQuad: sq, frameQuad: fq,
      screenInFrame: inFrame,
      homographyCheck,
      feed: office.feed, feedDraws: office.feedDraws, feedFrame: office.feedFrame,
      figures: figs,
      group: all,
      groupWidth: all ? all.x1 - all.x0 : null,
      studentsSpan: students ? students.x1 - students.x0 : null,
      robotsSpan: robots ? robots.x1 - robots.x0 : null,
      eyeHeights: figs.filter(f => f.kind === 'robot' && f.eye).map(f => f.eye.y1 - f.eye.y0),
      dirs: figs.map(f => f.dir),
      maxGap,
      edgeClearance: all ? Math.min(all.x0, W - all.x1) : null,
      topClearance: all ? Math.min(all.y0, H - all.y1) : null,
    };
  },
  /** E.10/E.11: the trolley's screen-space box at the current pose. */
  trolleyView() {
    const C = window.__CAMPUS, scene = C.viewer.scene, cam = C.explorer.camera;
    const W = innerWidth, H = innerHeight;
    let group = null;
    scene.traverse(o => {
      if (!group && typeof o.name === 'string' && (o.name === 'B04_5f_trolley' || o.name.startsWith('B04_5f_trolley#'))) group = o;
    });
    if (!group) return {ok: false, error: 'trolley missing'};
    group.updateWorldMatrix(true, true);
    const min = {x: Infinity, y: Infinity, z: Infinity}, max = {x: -Infinity, y: -Infinity, z: -Infinity};
    const v = cam.position.clone();
    group.traverse(o => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        v.set(x, y, z); o.localToWorld(v);
        min.x = Math.min(min.x, v.x); min.y = Math.min(min.y, v.y); min.z = Math.min(min.z, v.z);
        max.x = Math.max(max.x, v.x); max.y = Math.max(max.y, v.y); max.z = Math.max(max.z, v.z);
      }
    });
    const pts = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const p = cam.position.clone(); p.set(x, y, z); p.project(cam);
      pts.push({x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H, z: p.z});
    }
    return {
      ok: true, viewport: {w: W, h: H}, world: {min, max}, behind: pts.some(p => p.z > 1),
      rect: {
        x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)),
        x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)),
      },
    };
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


def _width(r):
    return r['x1'] - r['x0']


def _height(r):
    return r['y1'] - r['y0']


def feed_checks(page):
    """E.10 at the pinned approach pose: the composition, measured, against required floors."""
    view = page.evaluate('() => window.__errand.feedView()')
    check('feed:projection-built',
          view.get('ok') is True and bool(view.get('screenQuad'))
          and bool(view.get('frameQuad')) and bool(view.get('homographyCheck')),
          {'ok': view.get('ok'), 'hasScreenQuad': bool(view.get('screenQuad')),
           'hasFrameQuad': bool(view.get('frameQuad')),
           'homography': view.get('homographyCheck')})
    uv = view.get('uv') or {}
    plane = uv.get('screenPlane') or {}
    frame_plane = uv.get('framePlane') or {}
    canvas = uv.get('canvas') or {}
    canvas_aspect = (canvas['w'] / canvas['h']) if canvas.get('h') else None
    plane_aspect = (plane['w'] / plane['h']) if plane.get('h') else None
    aspect_ok = (canvas_aspect is not None and plane_aspect is not None
                 and abs(canvas_aspect - plane_aspect) / canvas_aspect <= UV_ASPECT_TOLERANCE)
    check('feed:uv-identity',
          canvas.get('w') == 192 and canvas.get('h') == 112
          and uv.get('repeat') == [1, 1] and uv.get('offset') == [0, 0] and uv.get('flipY') is True,
          {'canvas': canvas, 'repeat': uv.get('repeat'), 'offset': uv.get('offset'),
           'flipY': uv.get('flipY'), 'why': 'canvas 192x112 filling UV 0..1 with no repeat/offset'})
    check('feed:uv-corners', uv.get('cornersOk') is True,
          {'why': 'the screen face UVs must land on the four canvas corners', 'uv': uv})
    check('feed:uv-aspect', aspect_ok,
          {'canvasAspect': canvas_aspect, 'planeAspect': plane_aspect,
           'tolerance': UV_ASPECT_TOLERANCE,
           'why': 'a transposed or stretched mapping is off by ~194 %, not 0.33 %'})
    check('feed:alive-at-read', view.get('feed') == 'playing',
          {'feed': view.get('feed'), 'draws': view.get('feedDraws'),
           'why': 'the rects describe the last drawn frame, so it must be live'})
    # Condition 1: the homography must be built from the picture's corners, never the bezel's.
    # The guard is containment — the screen's projected corners must sit inside the frame's
    # projected quad on every side. A frame-derived homography maps the canvas onto the bezel,
    # so the screen's corners land on the frame's edge and the margin collapses to 0.
    in_frame = view.get('screenInFrame') or {}
    margin = in_frame.get('minMarginPx')
    check('feed:screen-not-frame',
          margin is not None and margin >= SCREEN_IN_FRAME_MIN_PX
          and abs((frame_plane.get('w') or 0) - (plane.get('w') or 0)) >= .05
          and abs((frame_plane.get('h') or 0) - (plane.get('h') or 0)) >= .05,
          {'minMarginPx': margin, 'floor': SCREEN_IN_FRAME_MIN_PX,
           'screenPlane': plane, 'framePlane': frame_plane,
           'why': 'the bezel carries no picture; the picture must be strictly inside it'})
    # The homography is analytic, so the requirement is sub-pixel agreement with an
    # independent 3D projection of the same canvas points.
    hm = view.get('homographyCheck') or {}
    check('feed:homography-exact',
          hm.get('maxErrorPx') is not None and hm['maxErrorPx'] <= HOMOGRAPHY_MAX_ERROR_PX,
          {'maxErrorPx': hm.get('maxErrorPx'), 'ceiling': HOMOGRAPHY_MAX_ERROR_PX,
           'probes': hm.get('rows')})
    figs = [f for f in (view.get('figures') or []) if f.get('rect')]
    students = [f for f in figs if f.get('kind') == 'student']
    robots = [f for f in figs if f.get('kind') == 'robot']
    check('feed:kinds-present',
          len(students) >= FIGURES_PER_KIND_MIN and len(robots) >= FIGURES_PER_KIND_MIN,
          {'students': len(students), 'robots': len(robots), 'floor': FIGURES_PER_KIND_MIN,
           'why': 'both kinds must be in frame for their silhouettes to be comparable'})
    student_heights = [round(_height(f['rect']), 2) for f in students]
    check('feed:student-height',
          bool(students) and all(h >= READING_FLOOR_PX for h in student_heights),
          {'measured': student_heights, 'floor': READING_FLOOR_PX, 'band': '30-40 (E.9)',
           'why': 'smaller than the reading floor is unreadable by the stated requirement'})
    robot_heights = [round(_height(f['rect']), 2) for f in robots]
    check('feed:robot-taller',
          bool(students) and bool(robots) and min(robot_heights) > max(student_heights),
          {'robots': robot_heights, 'students': student_heights,
           'why': 'E.9: a robot must read as a machine, which includes being taller'})
    check('feed:students-span',
          view.get('studentsSpan') is not None and view['studentsSpan'] >= SPAN_FLOOR_PX,
          {'measured': view.get('studentsSpan'), 'floor': SPAN_FLOOR_PX,
           'why': 'narrower than one legible student is not a group'})
    check('feed:robots-span',
          view.get('robotsSpan') is not None and view['robotsSpan'] >= SPAN_FLOOR_PX,
          {'measured': view.get('robotsSpan'), 'floor': SPAN_FLOOR_PX,
           'why': 'narrower than one legible student is not a group'})
    eyes = view.get('eyeHeights') or []
    check('feed:eye-bars', len(eyes) == 2 and all(h >= EYE_BAR_MIN_PX for h in eyes),
          {'measured': eyes, 'floor': EYE_BAR_MIN_PX,
           'why': 'both red eye bars must survive the downscale'})
    dirs = view.get('dirs') or []
    check('feed:same-direction', bool(dirs) and all(d == 1 for d in dirs),
          {'measured': dirs, 'why': 'the convoy moves one way; a split reads as a crowd'})
    # Contiguity is relational: a gap wider than the narrower of the two figures it separates
    # reads as two groups. This is the bounded maximum gap, in the frame's own units.
    ordered = sorted(figs, key=lambda f: f['rect']['x0'])
    gaps = []
    for left, right in zip(ordered, ordered[1:]):
        gap = right['rect']['x0'] - left['rect']['x1']
        gaps.append({'gapPx': round(gap, 2),
                     'neighbourPx': round(min(_width(left['rect']), _width(right['rect'])), 2),
                     'pair': [left['kind'], right['kind']]})
    check('feed:contiguous-group',
          bool(gaps) and all(g['gapPx'] <= g['neighbourPx'] for g in gaps),
          {'gaps': gaps, 'why': 'a gap wider than the narrower figure reads as two groups'})
    # Clear of both edges, in the same relational units: the outermost figure is a full
    # figure-width inside the frame, so nothing is clipped and there is no "leading edge".
    vp = view.get('viewport') or {}
    left_fig, right_fig = ordered[0], ordered[-1]
    left_clear = left_fig['rect']['x0']
    right_clear = (vp.get('w') or 0) - right_fig['rect']['x1']
    check('feed:clear-of-edges',
          left_clear >= _width(left_fig['rect']) and right_clear >= _width(right_fig['rect']),
          {'leftClearPx': round(left_clear, 2), 'rightClearPx': round(right_clear, 2),
           'edgeFigureWidthPx': [round(_width(left_fig['rect']), 2), round(_width(right_fig['rect']), 2)],
           'viewport': vp, 'why': 'the group must not touch either edge'})
    return view


def trolley_checks(page):
    """E.10/E.11 at the corridor pose: the trolley is inside the frame with a real extent."""
    view = page.evaluate('() => window.__errand.trolleyView()')
    check('trolley:in-scene', view.get('ok') is True, view)
    rect = view.get('rect') or {}
    vp = view.get('viewport') or {}
    inside = bool(rect) and rect.get('x0', -1) >= 0 and rect.get('y0', -1) >= 0 \
        and rect.get('x1', 1e9) <= vp.get('w', 0) and rect.get('y1', 1e9) <= vp.get('h', 0) \
        and not view.get('behind')
    w = (rect.get('x1', 0) - rect.get('x0', 0)) if rect else 0
    h = (rect.get('y1', 0) - rect.get('y0', 0)) if rect else 0
    check('trolley:inside-frame', inside, {'rect': rect, 'viewport': vp})
    check('trolley:extent',
          w >= TROLLEY_MIN_W_PX and h >= TROLLEY_MIN_H_PX,
          {'measured': [round(w, 1), round(h, 1)], 'floors': [TROLLEY_MIN_W_PX, TROLLEY_MIN_H_PX],
           'why': 'both dimensions must clear the 30 px reading floor, or it is a speck'})
    return view


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
            """At the monitor, right after the look: beat 1, the approach projection, the shots."""
            check('walked to the CCTV monitor', out['monitor']['arrived'] == out['monitor']['legs'], out['monitor'])
            check('beat 1: the lobby feed starts on the first look',
                  out['watch']['office']['beats']['lobby_feed'] is not None, out['watch']['office'])
            check('the monitor is still live after the look', out['watch']['office']['feed'] == 'playing',
                  out['watch']['office'])
            face = SCREEN_FACE
            # E.10: the approach pose — the side-door walk, passing the monitor. The projection
            # is measured here from the real camera and the real screen quad, before the close-up.
            page.evaluate(f'() => window.__errand.place({APPROACH[0]}, {APPROACH[1]})')
            page.evaluate(f'() => window.__errand.look({face[0]}, {face[1]}, {face[2]})')
            settle(page, face)
            check('the feed is live at the approach pose',
                  page.evaluate(f'() => {D}.office().feed') == 'playing',
                  {'feed': page.evaluate(f'() => {D}.office().feed'),
                   'pose': APPROACH, 'face': face})
            out['feedView'] = feed_checks(page)
            pose = page.evaluate('() => { const p = window.__CAMPUS.explorer.game.body.position; return [p.x, p.z]; }')
            check('feed:approach-pose-pinned',
                  abs(pose[0] - APPROACH[0]) <= .05 and abs(pose[1] - APPROACH[1]) <= .05,
                  {'pose': pose, 'expected': APPROACH,
                   'why': 'the projection thresholds are authored for this pose'})
            shot(page, 'task-E-fix2-approach', vantages={
                '1280x800': APPROACH + face,
                '390x844': APPROACH + face,
            })
            # The close-up: at arm's length for 1280, a step back so the whole panel fits 390.
            page.evaluate('() => window.__errand.place(47.14, 16.34)')
            page.evaluate(f'() => window.__errand.look({face[0]}, {face[1]}, {face[2]})')
            settle(page, face)
            check('the feed is live in the monitor close-up',
                  page.evaluate(f'() => {D}.office().feed') == 'playing',
                  {'feed': page.evaluate(f'() => {D}.office().feed'),
                   'beats': page.evaluate(f'() => {D}.office().beats')})
            shot(page, 'task-E-fix2-monitor', vantages={
                '1280x800': (47.14, 16.34) + face,
                '390x844': (47.78, 16.63) + face,
            })
            page.evaluate('() => window.__errand.place(47.35, 16.00)')

        def on_corridor(out):
            """In the corridor, before the office door: beat 3, the order, the trolley shot."""
            o = out['corridor']['office']
            check('walked the 5F corridor to the office door', out['corridor']['arrived'] == out['corridor']['legs'], out['corridor'])
            check('beat 3: the corridor carries it by sound', o['beats']['corridor_sound'] is not None, o)
            check('all three beats fired BEFORE the office door opened',
                  all(o['beats'][k] is not None for k in ('lobby_feed', 'feed_dies', 'corridor_sound'))
                  and not o['doorOpen'], o)
            check('the beats latched in route order',
                  o['beatOrder'] == ['lobby_feed', 'feed_dies', 'corridor_sound'], o)
            check('the built corridor carries the dressing pieces',
                  page.evaluate('() => window.__errand.has("B4_lift_5f_evac_sign")'
                                ' && window.__errand.has("B4_lift_5f_flicker")'
                                ' && window.__errand.has("B04_5f_trolley")'),
                  'the evacuation sign, the flickering panel or the trolley is missing from the scene')
            # E.10/E.11: the trolley from the walk's own pose, aimed down the corridor at it.
            page.evaluate(f'() => window.__errand.look({TROLLEY_AIM[0]}, {TROLLEY_AIM[1]}, {TROLLEY_AIM[2]})')
            settle(page, TROLLEY_AIM)
            out['trolleyView'] = trolley_checks(page)
            shot(page, 'task-E-fix2-corridor-trolley', target=TROLLEY_AIM)

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
        lift_out = page.evaluate(f'() => {D}.office().lift')
        check('the ground doorway is open with the car there',
              abs(ret['out']['pos'][1] - lift_out['ground']) <= .05
              and ret['out']['pos'][0] > 46.5
              and lift_out['doors'] > .99 and abs(lift_out['y'] - lift_out['ground']) <= .005,
              {'out': ret['out']['pos'], 'lift': lift_out,
               'why': 'the walk crossed the x 46.13 doorway plane from inside the car, at ground level, '
                      'with the car stopped and its doors open'})

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
        # C.3: the door is gated on `state.armed`. An unarmed player standing at the office
        # door is not offered it; the staff item is what the unarmed story offers, and it is
        # still offered where the coordinator actually stands.
        check('b5: the office door is not offered before the errand',
              u['aimDoor']['target'] != 'opening-office-door' and dark['doorOpen'] is False,
              {'aim': u['aimDoor'], 'doorOpen': dark['doorOpen']})
        upage.evaluate('() => window.__errand.place(63.2, -59.8)')
        u_staff = upage.evaluate('() => window.__errand.aim(64, 1.32, -61)')
        check('b5: the unarmed story still offers the staff item',
              u_staff['target'] == 'opening-staff', u_staff)
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
        'projection': {
            'pose': {'approach': list(APPROACH), 'screenFace': list(SCREEN_FACE), 'trolleyAim': list(TROLLEY_AIM)},
            'approach': r.get('feedView'),
            'trolley': r.get('trolleyView'),
            'thresholds': {
                'readingFloorPx': READING_FLOOR_PX,
                'spanFloorPx': SPAN_FLOOR_PX,
                'figuresPerKindMin': FIGURES_PER_KIND_MIN,
                'eyeBarFloorPx': EYE_BAR_MIN_PX,
                'homographyMaxErrorPx': HOMOGRAPHY_MAX_ERROR_PX,
                'screenInFrameMinPx': SCREEN_IN_FRAME_MIN_PX,
                'trolleyFloorsPx': [TROLLEY_MIN_W_PX, TROLLEY_MIN_H_PX],
                'uvAspectTolerance': UV_ASPECT_TOLERANCE,
                'derivation': ('E.9 reading floor 30 px; span = 30 * 9/33.4 (authored canvas '
                               'proportions); eye bars and kinds from E.10; homography sub-pixel '
                               'because it is analytic; containment 1 px because that is the '
                               'smallest distinguishable separation'),
            },
        },
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
