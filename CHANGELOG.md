# Changelog

All notable changes to HKU Shanghai at War (“BARRIER 2030”). The app version lives in `VERSION` and `package.json`; the save-schema version is separate.

## [9.2.0] — 2026-11-26

The three scenes the 9.1 line left as architecture are performed, and the two defects that hid the finale are fixed.

### Added
- **B5 High Table Dinner.** Guests within arm's reach of a chair take it, face the nearest table and sit; the forecourt pair stays standing by design. The coordinator's toast plays `mus_dinner_toast` once when the staff intro starts (`81d6364`).
- **Four-tower finale.** One instanced window family (3456 quads) across all four towers, six tower-to-tower beams and one flat atrium ring, all additive, no lights and no shadows, 5.6 s long; `mus_finale` fires once on the release beat; a reload after the credits restores the lit campus (`c3d64f7`).
- **CDS-1 gate bank** at the B4 plaza entrance: four brushed pedestals with top readers and three glass wings with metal edges, scenery only, no collision rect (`f251db8`).

### Fixed
- Finale windows were seated on the authored façade planes, but the built towers stand 2.8–5.8 m proud of them, so every quad sat inside the wall where the depth test hides it. The show now measures the built shells and seats the glass 0.22 m outside (`c3d64f7`).
- The ending played off-screen behind the three 25.5 m sports halls; a scripted 58 m camera crane lifts the view over their roofs before the Mac overlay clears, then releases to eye level (`c3d64f7`).
- The presentation MacBook was built from the office-door timber material and read as brown wood; it is aluminium now, with a near-black display, so the errand's object reads as the object it is named after.
- The epilogue advanced on frame time. The viewer caps frame dt at 0.1 s, so a software-rasterised browser running the 58 m crane view at 0.25–0.37 fps stretched the 17 s sequence to nearly eight minutes (measured: clock 15.2 of 17 s after 422 s, no credits). The cutscene now takes the wall-clock delta whenever the game is running (`85b0ee7`); the same 0.37 fps run finishes in 28 s.
- The dome release had the same defect and could not catch up with the ending: its 5.2 s transition advanced 0.1 s per frame, so the credits arrived with the curtain still 88.5% down (`end: dome released` failed). The atmosphere now takes the same wall-clock step (`f1d293c`); on the same 0.34 fps build the dome reads `day / 0 / false` two seconds before the credits.
- "Return to checkpoint" during Chapter 3 put the player back at the B4 handoff, 176 m from the sports hall, with the objective unchanged. The campaign host now names the checkpoint of the chapter you are in (`chapterEntry()`), the button places the body there, and the epilogue — which has no walking leg — refuses the move instead of teleporting to the origin under the finale's camera crane (`9c48dfe`).

### Changed
- 19 music cues are reachable: `mus_dinner_toast` and `mus_finale` are both requested at their beats.

## [9.1.1] — 2026-11-26

### Fixed
- A shipped build retried `ws://127.0.0.1:8788` and probed `127.0.0.1:8790/health` forever where no local service exists. Both sit behind the `LOCAL_TOOLS` gate now (loopback **and** dev/review mode, or `?agent=1`), and the bridge backoff is 2 s → 4 s → 8 s → 15 s (`f02b70c`, `0b14a35`). Same probe, same build: 8 WebSocket errors and 2 assistant errors → 0 and 0.

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
