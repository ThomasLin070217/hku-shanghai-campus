# Thomas opening feasibility evidence

Date: 2026-11-18. Source baseline: `f157e29`.

This directory verifies the implementation approach. It does **not** contain a completed opening level or a full opening playthrough. No production `src/` files were changed for these probes.

## Baseline

- `npm run check:all`: exit 0; 17 existing checks plus the production TypeScript/Vite build completed. See [check-all.log](check-all.log).
- Browser loaded the existing survey page with `__CAMPUS.ready=true`, a live WebGL context, paused gameplay and AI disabled. See [browser-baseline.json](browser-baseline.json) and [screenshot](browser-baseline.png).
- The browser restored its existing survey save. Its player position is not a route measurement; no movement, coordinate write or AI enable action was performed.

## Reproduce the offline probes

From the project root with its installed dependencies:

```sh
./node_modules/.bin/tsx evidence/opening-feasibility/probes/state.ts
./node_modules/.bin/tsx evidence/opening-feasibility/probes/ui.ts
./node_modules/.bin/tsx evidence/opening-feasibility/probes/spatial.ts
./node_modules/.bin/tsx evidence/opening-feasibility/probes/dispatch.ts
./node_modules/.bin/tsx evidence/opening-feasibility/probes/robot.ts
```

- [state.ts](probes/state.ts) → [state-results.json](state-results.json): eight assertions diagnosing current save, item and RPC behavior. Some assertions deliberately confirm current limitations, such as rejection of a pre-laptop save. These are baseline diagnostics, not permanent regression expectations after implementation.
- [ui.ts](probes/ui.ts) → [ui-results.json](ui-results.json): two NPC character templates, finite walking transforms, height and sockets; mocked audio behavior showing that an ambient one-shot can start while `active=false`. No WebGL character visual or subjective sound assessment is claimed.
- [spatial.ts](probes/spatial.ts) → [spatial-results.json](spatial-results.json): six fixed-step CharacterPhysics routes/fixtures, retained walls and prototype doorway support. Each fixture initializes its own test body; no browser player is teleported.
- [dispatch.ts](probes/dispatch.ts) → [dispatch-results.json](dispatch-results.json): five isolated adapter assertions. The script copies the real CampusGame source into a temporary fixture, adds internal dispatch and same-frame pause checks, and verifies existing RPC fields, modal revocation, unique acquisition and Retry retention. It does not patch production source. Range authorization, DOM focus and complete persistence are outside this fixture.
- [robot.ts](probes/robot.ts) → [robot-results.json](robot-results.json): seven isolated perception/state assertions, current Navigation occlusion and CharacterPhysics movement, with a 65-frame trace. This is not the final NPC manager, patrol graph or integrated encounter.

The spatial prototype splits only an isolated Navigation instance, retains other walls and supplies same-height support. Doorways, room dimensions and bus stairs are technical fixtures, not measured campus geometry. Production geometry and render/collision synchronization still need implementation. In particular the B06 5.1 m fixture is not evidence that the existing upper glass doors at approximately 9 m are at that level.

The existing `check:all` regenerates some legacy evidence files. This verification restored the five timestamp-only tracked changes after confirming their other JSON content matched the initial baseline. New results are kept here.

The concrete work packages, ownership and acceptance gates are in [THOMAS-EXECUTION-PLAN.md](../../docs/plans/THOMAS-EXECUTION-PLAN.md).
