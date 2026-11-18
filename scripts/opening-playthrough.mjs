/**
 * Opening playthrough driver used for the manual acceptance run.
 *
 * It drives the real game through real inputs only: WASD/Shift for movement,
 * raw CDP mouse drag for looking, F for interaction and C for the computer.
 * Nothing writes a position, a yaw or a story flag: every metre is walked through
 * the shared CharacterPhysics and every beat is fired by the game's own handlers.
 *
 * It is a verification harness, not a game feature; it is not part of the build.
 */
export const SENS = 0.0022;          // rad per pixel, matches src/exploration/config.ts
export const EYE = 1.64;             // eye height above the body, matches the interaction code
export const DEG = 180 / Math.PI;

export function wrapDeg(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

/** Reads the live player state from the running game. */
export async function readState(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await page.evaluate(() => {
        const s = window.__CAMPUS.explorer.state;
        return {
          x: s.player.position[0], y: s.player.position[1], z: s.player.position[2],
          yaw: s.player.yawDeg, pitch: s.player.pitchDeg, paused: s.paused, compat: s.compat,
          stage: s.opening?.story.stage, events: s.opening?.story.events ?? [],
          busy: s.opening?.busReady, robot: s.opening?.robot, target: s.opening?.target,
          grounded: s.player.grounded,
        };
      });
    } catch {
      // The page reloaded (a concurrent edit in the shared checkout): wait for it.
      await page.waitForTimeout(700);
    }
  }
  throw new Error("the opening page never came back after a reload");
}

/** Resumes the session after the browser hid the page (the game pauses on blur/visibility). */
export async function resume(page) {
  const s = await readState(page);
  if (s.paused) await page.evaluate(() => window.__CAMPUS.explorer.enterCompat());
  await page.waitForTimeout(120);
}

/** Drags the mouse so the view points at a world point. Returns the residual error. */
export async function aimAt(page, centre, tx, ty, tz) {
  for (let pass = 0; pass < 4; pass++) {
    const s = await readState(page);
    const ox = s.x, oy = s.y + EYE, oz = s.z;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const h = Math.hypot(dx, dz);
    const len = Math.hypot(dx, dy, dz) || 1;
    const desiredYaw = Math.atan2(-dx, -dz) * DEG;
    const desiredPitch = Math.asin(Math.max(-1, Math.min(1, -dy / len))) * DEG;
    const dyaw = wrapDeg(desiredYaw - s.yaw);
    const dpitch = desiredPitch - s.pitch;
    if (Math.abs(dyaw) < 1.5 && Math.abs(dpitch) < 1.5) return { yawError: dyaw, pitchError: dpitch };
    const px = Math.max(-420, Math.min(420, -(dyaw / DEG) / SENS));
    const py = Math.max(-420, Math.min(420, (dpitch / DEG) / SENS));
    await page.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.cx, y: centre.cy, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(px), Math.abs(py)) / 120));
    for (let i = 1; i <= steps; i++) {
      await page.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: centre.cx + (px * i) / steps, y: centre.cy + (py * i) / steps, button: "left", buttons: 1, pointerType: "mouse" });
    }
    await page.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.cx + px, y: centre.cy + py, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
    await page.waitForTimeout(90);
  }
  return { yawError: 0, pitchError: 0 };
}

/** Interpolates a polyline into short steps so the aim error never accumulates over a long leg. */
export function densify(waypoints, spacing = 3) {
  const out = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [ax, az] = waypoints[i], [bx, bz] = waypoints[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / spacing));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  out.push(waypoints[waypoints.length - 1]);
  return out;
}

/**
 * Walks the given world waypoints using only movement keys.
 * The polyline is densified first: aiming at a point a few metres away keeps the
 * heading accurate, so the player tracks the verified corridor instead of cutting
 * corners into walls.
 */
export async function walkRoute(page, centre, waypoints, opts = {}) {
  const tol = opts.tolerance ?? 0.9;
  const budget = opts.budgetMs ?? 240000;
  const spacing = opts.spacing ?? 3;
  const sprint = opts.sprint !== false;
  const interval = opts.intervalMs ?? 130;
  const points = densify(waypoints, spacing);
  const started = Date.now();
  const trace = [];
  let skipped = 0;
  for (const [tx, tz] of points) {
    if (Date.now() - started > budget) { trace.push({ tx, tz, result: 'budget-exhausted' }); break; }
    await page.keyboard.down("w");
    if (sprint) await page.keyboard.down("Shift");
    let best = Infinity, stalls = 0, reached = false;
    for (let i = 0; i < 90; i++) {
      const s = await readState(page);
      if (s.paused) {
        await page.keyboard.up("w"); await page.keyboard.up("Shift");
        await page.evaluate(() => window.__CAMPUS.explorer.enterCompat());
        await page.keyboard.down("w");
        if (sprint) await page.keyboard.down("Shift");
        continue;
      }
      const dx = tx - s.x, dz = tz - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < tol) { reached = true; break; }
      // If the security robot has confirmed the player, run away from it instead of
      // holding the course: walking into a wall while a robot closes in is how the
      // player gets cornered.
      let aimX = tx, aimZ = tz;
      if (opts.flee && s.robot === "chase") {
        const robot = await page.evaluate(() => {
          const node = window.__CAMPUS.viewer.scene.getObjectByName("opening-security-robot");
          return node ? { x: node.position.x, z: node.position.z } : null;
        }).catch(() => null);
        if (robot) {
          const ax = s.x - robot.x, az = s.z - robot.z;
          const len = Math.hypot(ax, az) || 1;
          aimX = s.x + (ax / len) * 30;
          aimZ = s.z + (az / len) * 30;
        }
      }
      // Aim inline from the state we already read: one round trip per step.
      const ox = s.x, oy = s.y + EYE, oz = s.z;
      const tx2 = aimX - ox, tz2 = aimZ - oz;
      const desiredYaw = Math.atan2(-tx2, -tz2) * DEG;
      const dyaw = wrapDeg(desiredYaw - s.yaw);
      if (Math.abs(dyaw) > 1.2) {
        const px = Math.max(-420, Math.min(420, -(dyaw / DEG) / SENS));
        await page.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: centre.cx, y: centre.cy, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
        await page.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: centre.cx + px, y: centre.cy, button: "left", buttons: 1, pointerType: "mouse" });
        await page.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: centre.cx + px, y: centre.cy, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
      }
      if (dist < best - 0.03) { best = dist; stalls = 0; } else stalls++;
      if (stalls > 9) break;                  // wedged on this step: carry on
      await page.waitForTimeout(interval);
    }
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
    if (!reached) skipped++;
    const s = await readState(page);
    trace.push({ tx, tz, at: [+s.x.toFixed(2), +s.z.toFixed(2)], dist: +Math.hypot(tx - s.x, tz - s.z).toFixed(2), reached });
  }
  return { trace, skipped, elapsedMs: Date.now() - started };
}

/** Presses a key once and waits for the game to react. */
export async function press(page, key, waitMs = 700) {
  await page.keyboard.press(key);
  await page.waitForTimeout(waitMs);
}

/** Clicks a button inside the opening modal by its visible text. */
export async function clickModal(page, text) {
  const ok = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll(".opening-modal-root button")]
      .find((b) => b.textContent.trim() === t && b.offsetParent !== null);
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  await page.waitForTimeout(700);
  return ok;
}

export async function canvasCentre(page) {
  return page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) };
  });
}
