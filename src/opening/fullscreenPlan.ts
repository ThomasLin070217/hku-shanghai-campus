/**
 * What the fullscreen control can do on this device. Pure, so the rules are
 * checked headless (`scripts/check-mobile.ts`); the DOM half lives in
 * `fullscreen.ts`, the same split as `touchInput.ts` / `touchControls.ts`.
 *
 * The owner asked for this on 2026-11-25: "on desktop you use the keyboard, so you
 * can't use full screen". The Fullscreen API only works from a real gesture, so
 * nothing requests it on load — the button (and the shortcut) are the gesture.
 *
 * The phase note said `F` on desktop, but F is the interact key (`KEYS.interact`),
 * so binding it there would break every interaction in the game. The keyboard
 * shortcut is `Alt+Enter`, the conventional fullscreen toggle in games; the
 * controller ignores Alt-modified keys, so it cannot collide with movement.
 *
 * iPhone Safari exposes the Fullscreen API only for video, so on a touch device
 * without it the control explains the one route that does work: Add to Home
 * Screen, where the manifest's `display: "standalone"` gives the game the whole
 * screen. The game never depends on fullscreen to be playable.
 */

export interface FullscreenPlan {
  /** Show the in-game fullscreen button. */
  button: boolean;
  /** The button drives the Fullscreen API (false = show the Add to Home Screen hint). */
  api: boolean;
  /** Show the dismissible Add to Home Screen hint. */
  hint: boolean;
}

export function fullscreenPlan(input: {
  fullscreenEnabled: boolean;
  requestAvailable: boolean;
  standalone: boolean;
  touch: boolean;
}): FullscreenPlan {
  // Already installed to the home screen: the game owns the screen; a fullscreen
  // button would be a no-op and the hint would be noise.
  const api = input.fullscreenEnabled && input.requestAvailable && !input.standalone;
  const hint = input.touch && !api && !input.standalone;
  return {button: api || hint, api, hint};
}

export function fullscreenLabel(active: boolean): string {
  return active ? 'Exit full screen' : 'Full screen';
}

export const FULLSCREEN_HINT = 'Add to Home Screen to play full screen';
