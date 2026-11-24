/**
 * The game's version label — the one string the pause card, the credits and
 * `window.__CAMPUS.version` all read, so a build can never claim two versions.
 *
 * The version comes from the repo's `VERSION` file and the commit from `git rev-parse`,
 * both injected by `vite.config.ts`. The `typeof` guards keep the Node gates (`tsx`),
 * which never run the Vite define, from throwing: there the label is `dev`, and
 * `check:version` compares the files themselves rather than this fallback.
 */
export const BUILD_VERSION: string = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'dev';

/** The commit the build came from; `-dirty` when it was built over uncommitted work. */
export const BUILD_SHA: string = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : 'dev';

/** The label as the UI prints it: `v9.1.0`. */
export const BUILD_LABEL = `v${BUILD_VERSION}`;

/** The label with its provenance, for the pause card and the credits. */
export const BUILD_STAMP = `${BUILD_LABEL} · ${BUILD_SHA}`;
