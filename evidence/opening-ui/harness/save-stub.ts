// Harness-only stand-in for src/gameplay/save.ts so the UI bundle stays small.
// Values match DEFAULT_SETTINGS in the real save module.
export const DEFAULT_SETTINGS = {sensitivity: 0.0022, fov: 72, bob: false, muted: false, ambient: 0.2, steps: 0.6, ui: 0.45, music: 0};
export type Settings = typeof DEFAULT_SETTINGS;
