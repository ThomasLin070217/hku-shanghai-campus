/**
 * `__BUILD_VERSION__` is injected by `vite.config.ts` from the repo's `VERSION` file.
 * It is a plain string literal in every Vite build; under `tsx` (the Node gates) it is
 * simply not defined, which is why `src/version.ts` reads it behind a `typeof` guard.
 */
declare const __BUILD_VERSION__: string;
