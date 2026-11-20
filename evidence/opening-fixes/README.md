# Opening review fixes — 2026-11-19

## Changes

- A zero-heart save restores the blocking capture modal. Settings and computer actions cannot dismiss it. Checkpoint recovery keeps inventory/story, restores hearts when required, and leaves the game paused for explicit Continue.
- Recovery and save restoration grant 2.6 seconds of simulation-time protection; paused time does not consume it.
- MacBook quick prompts reuse their DOM nodes while suggestions are unchanged, preserving keyboard focus and reliable clicks.
- `robot_chase_started` records an actual fleet chase instead of being inferred from the campus incident. Its change participates in save invalidation.
- Fleet render-only reads reuse the last physics aggregate. Detection and capture remain at their existing simulation rate.

## Verification

- `npm run check:opening`: passed; see `opening-checks.log`.
- `npm run check:all`: passed, including TypeScript and production build; see `all-checks.log`.
- Browser: all 13 assertions passed; see `browser-results.json`.
- Reproduce the browser fixture with `npm run play`, then open `/evidence/opening-fixes/regressions.html`. It creates an isolated game with page-local in-memory storage; it never edits the player's saved game. The fixture covers zero-heart restoration, modal gates, checkpoint recovery, pause/grace timing, and prompt focus/click behavior.
- Fleet microbenchmark: 10,000 render-only reads after 100 simulation warmup steps took approximately 4.61 ms before and 0.25 ms after this change, with 10,000/10,000 returned objects reused afterward. These are local single-run query measurements, not overall frame-rate measurements.

This round used isolated regression fixtures and automated project checks. It does not claim a new full manual playthrough or real-campus geometry validation. No campus geometry was changed.
