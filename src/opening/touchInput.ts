/** Touch controls that are pure enough to check without a browser. */

export interface TouchAxes { forward: number; right: number }

/** Fraction of the stick radius that is treated as centred. */
export const TOUCH_DEAD_ZONE = 0.16;

const NEUTRAL: TouchAxes = { forward: 0, right: 0 };

/** Keep an axis exactly 0 rather than -0 when the other axis is the only one moving. */
const axis = (value: number) => value === 0 ? 0 : value;

/** Map a stick offset in screen pixels to movement axes.
 *
 * Screen up (negative `dy`) is forward and screen right (positive `dx`) is
 * right. The output length is the deflection as a fraction of `radius`, clamped
 * to 1; inside the dead zone both axes are 0, and a non-finite input or a
 * non-positive radius is neutral.
 */
export function joystickAxes(dx: number, dy: number, radius: number, deadZone = TOUCH_DEAD_ZONE): TouchAxes {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || !Number.isFinite(deadZone) || radius <= 0) return { ...NEUTRAL };
  const magnitude = Math.hypot(dx, dy) / radius;
  if (magnitude <= deadZone) return { ...NEUTRAL };
  const scale = Math.min(1, magnitude) / magnitude;
  return { forward: axis((-dy / radius) * scale), right: axis((dx / radius) * scale) };
}

/** True when the device should get the touch controls.
 *
 * A coarse primary pointer is enough (phone, tablet, touch-first hybrid). A
 * device that reports touch points but also reports hover is a touchscreen
 * laptop with a trackpad or mouse, and keeps the desktop path: its primary
 * pointer is fine. A fine pointer without touch points is a desktop. The
 * checks are passed in so this stays a pure function.
 */
export function useTouchControls(input: {coarsePointer: boolean; maxTouchPoints: number; hoverNone: boolean}): boolean {
  if (input.coarsePointer) return true;
  return input.maxTouchPoints > 0 && input.hoverNone;
}
