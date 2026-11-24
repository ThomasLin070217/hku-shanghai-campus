/**
 * `__BUILD_VERSION__` is injected by `vite.config.ts` from the repo's `VERSION` file,
 * and `__BUILD_SHA__` from `git rev-parse --short=12 HEAD` (with `-dirty` appended when
 * the tree had uncommitted changes). Both are plain string literals in every Vite build;
 * under `tsx` (the Node gates) they are not defined, which is why `src/version.ts` reads
 * each behind a `typeof` guard.
 */
declare const __BUILD_VERSION__: string;
declare const __BUILD_SHA__: string;
