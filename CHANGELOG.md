# Changelog

All notable changes to HKU Shanghai at War (“BARRIER 2030”). The app version lives in `VERSION` and `package.json`; the save-schema version is separate.

## [9.1.0] — 2026-11-23

Submission build for the Vibe Coding Lab. **Not final until the annotated `v9.1.0` tag is cut.** There is no frozen archive, no checksum file and no upload from this repo; the owner pushes the tag and deploys.

### Added
- New title **HKU Shanghai at War**, with “BARRIER 2030” as the subtitle — title card, menu, credits, README and video intro; in-game story copy unchanged.
- Version number and build metadata (`VERSION`, `package.json`, `__APP_VERSION__`, `__GIT_SHA__`, `__BUILD_TIME__`) — Task 12.1.
- Visible version label in the pause card/credits and `window.__CAMPUS.version` — Task 12.1.
- Full score: 18-cue map, four composer families, two takes per cue, audition/veto page — Workstream 13.
- Expressive ElevenLabs voice cast (narrator, staff, player, local AI, invader); main-story lines first; audition/veto page.
- Tag-based release: annotated git tag per playable version and `scripts/pre-push-secret-scan.sh` — Task 12.2.
- Realism/perf pass: Draco/WebP asset compression, optional FogExp2/Bloom behind a quality flag, canvas-capture video recording — Tasks 7.6, 8.9, 11.5.

### Changed
- Release model: tag instead of frozen archive; owner pushes/deploys; no upload from this repo.
- Reconcile the eight humanoid robots from the teammate’s update — Task 6.4.
- Lion encounter story, quest and lawn arena pass — Task 9.4.

### Fixed
- Group-reported UI/details and bug triage from the 2026-11-23 chat — Task 12.5.

## [9.0.0] — before 2026-11-23

Pre-release prototype line. No tagged release; the package version was `9.0.0`.
