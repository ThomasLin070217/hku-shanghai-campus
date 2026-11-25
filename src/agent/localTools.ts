/**
 * Loopback-only tooling: the game-control bridge (`ws://127.0.0.1:8788/game`)
 * and the assistant's bridge (`http://127.0.0.1:8790`).
 *
 * A shipped build has no such service, so contacting one is not a feature —
 * it is noise at best and an error at worst. The WebSocket retries forever,
 * which produced eight red console lines in a seventeen-second opening run,
 * and on an https deployment the same socket is a mixed-content block.
 *
 * The gate is deliberately narrow: the page must be served from loopback AND
 * be a dev/review build, or carry an explicit `?agent=1` opt-in. Static demo
 * builds served from `127.0.0.1` therefore stay silent unless the runner asks
 * for the bridge. Outside a browser there is no page console to protect, so
 * the import-time default stays "allowed" and the headless checks keep their
 * old behaviour.
 */
type Env = {DEV?: boolean; MODE?: string};
const env = (import.meta as unknown as {env?: Env}).env;
const inPage = typeof location !== 'undefined';
const hostname = inPage ? location.hostname : '';
const params = new URLSearchParams(inPage ? location.search : '');
const loopback =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1';

export const LOCAL_TOOLS =
  !inPage ||
  (loopback && (env?.DEV === true || env?.MODE === 'review' || params.get('agent') === '1'));
