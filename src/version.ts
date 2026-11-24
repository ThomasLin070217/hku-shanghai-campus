/**
 * The game's version label — the one string the pause card, the credits and
 * `window.__CAMPUS.version` all read, so a build can never claim two versions.
 *
 * The value comes from the repo's `VERSION` file via `define` in `vite.config.ts`.
 * The `typeof` guard keeps the Node gates (`tsx`), which never run the Vite define,
 * from throwing: there the label is `dev`, and `check:version` compares the files
 * themselves rather than this fallback.
 */
export const BUILD_VERSION: string = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'dev';

/** The label as the UI prints it: `v9.1.0`. */
export const BUILD_LABEL = `v${BUILD_VERSION}`;
