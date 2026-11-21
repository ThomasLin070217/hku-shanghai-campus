# Performance and memory

This document records what was measured, what was changed, and what was deliberately
left alone. The scene is unchanged: same entity IDs, same triangles, same rendered image.
Everything here reduces resident data or adapts resolution; nothing removes geometry.

## How to measure

Dev and review builds expose the diagnostics on `window.__CAMPUS`:

| Call | Returns |
| --- | --- |
| `__CAMPUS.perf()` | `renderer.info` counters for one frame (`calls`, `triangles`, `geometries`, `textures`, `programs`), the smoothed frame time, the device pixel ratio in use, and the governor step |
| `__CAMPUS.memory()` | `{geometries, textures, programs}` straight from `renderer.info.memory` |
| `__CAMPUS.resources()` | geometry/material/texture counts and the bytes held by attribute, index and image data on the loaded scene |
| `__CAMPUS.deferred()` | how many deferred reference images are decoding right now |

`perf()` reads counters the renderer actually submitted, so it reports cost; it does not
claim an improvement on its own. Compare two builds by running the same camera path on
the same machine.

`renderer.info.autoReset` is off and the counters are reset once at the top of each frame,
so shadow passes and nested device-screen render targets are included instead of wiping
each other's numbers.

## Changes

### Indexed merging inside `compact()`

`src/model/buildCampus.ts` used to flatten every merged bucket with `toNonIndexed()`,
tripling the vertex storage of indexed sources. It now keeps indices when every source
part in the bucket already has an index buffer; `mergeGeometries` then offsets indices
instead of duplicating vertices. Mixed buckets still flatten, because one merged geometry
cannot be partly indexed.

Measured on the full campus, identical mesh and triangle counts (1115 / 200,042):

- geometry bytes: 19,175,448 → 13,855,464 (−5.3 MB, −28%)
- `HKU-Shanghai-Campus.glb`: 25.4 MB → 19.1 MB
- `HKU-Shanghai-Campus-no-ground.glb`: 18.8 MB → 14.7 MB
- `HKU-Shanghai-Opening.glb`: 28.7 MB → 22.2 MB

Merging is still restricted to a single named group. Entity IDs derive from the group
path plus `authorKey` (`src/scene/authoring.ts`, `src/scene/registry.ts`), and `pick()`
maps face ranges back through that grouping. Merging across groups would repath every
entity and break picking, so it was skipped. Same reason applies to the ~414 glass panes:
their pane-level transforms are part of the ID path, and the transparent sort order
depends on the distinct quaternions.

### Shadow casters inside enclosed recesses

Scenic recesses built by `src/model/glazing.ts` with `shallowDepth()` mark their group
`surfaceRole='opaque-backing'`: backing, floor, ceiling, sides, posts and seating
silhouettes. They sit entirely behind the facade plane inside a building body that already
casts, so they can never contribute a visible shadow. `compact()` now clears `castShadow`
on them.

- shadow casters: 648 → 298 (350 meshes removed from the shadow pass)
- rendered image: unchanged (verified against the before/after screenshots)
- the one lobby protrusion reaches 0.23 m and stays inside the existing canopy shadow

This is a per-frame draw reduction, not a memory change.

### Adaptive resolution

`src/viewer/graphicsQuality.ts` gains a resolution governor and a pixel-ratio cap:

- `MAX_PIXEL_RATIO = 1.5` caps the device ratio (a 2× or 3× display no longer renders at
  native density in gameplay).
- `RESOLUTION_STEPS = [1, .85, .72, .6]` multiply into that capped ratio, floor 0.5.
- The threshold is relative to the device's own fast-frame floor, seeded at 60 Hz and only
  ever lowered, so a machine that is slow from the first frame cannot raise its own bar and
  escape adaptation. Step down after ~1.5 s of smoothed frames 40% above the floor; step
  back up after 4 s near the floor, doubling the evidence required after each restore so a
  borderline machine cannot oscillate.
- The governor only samples continuously rendered frames. An idle tab that redraws once is
  not a slow frame, and tab-restore stalls over 250 ms are ignored.
- Simulations, controls and gameplay timing are untouched: only the render target size
  changes.

Exports are unaffected. `screenshot()` restores the full capped ratio for the capture and
`capture()` still renders at pixel ratio 1, width 2000, so a degraded gameplay frame is
never what gets exported.

### Lifecycle and disposal

- `dispose()` now also releases `scene.environment` and `renderer.renderLists`, alongside
  the existing shadow map, PMREM target, controls and renderer disposal.
- `prepareModelTextures()` in `src/model/deferredTextures.ts` coalesces concurrent passes
  over the same root and exposes an in-flight counter. Startup and the export button can
  now request the same tree without walking every material twice. The 1×1 placeholder and
  the dispose-and-reupload at real size are unchanged (WebGL2 immutable storage cannot grow).

## Browser probe

Headless Chrome 157 with SwiftShader at 1440×900, 25 s after load:

```
calls 1947  triangles 374513  geometries 1884  textures 87  programs 15
frameMs 80.56  fps 12  pixelRatio 0.9 (base 1.5 × governor step 0.6)
heap used 95,406,196 B
resources: 2046 geometries / 730 materials / 91 textures / 16,082,888 geometry bytes / 1,055,224 texture bytes
```

SwiftShader is a software rasteriser, so `frameMs` and `fps` there say nothing about a GPU
machine; they do show the governor degrading to its floor step under sustained load. The
counter and byte figures are hardware-independent.

## Verification

```
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
npm run export:glb && node scripts/validate-glb.mjs
npm run check:scene   # and the other check:* suites
```

`npm run typecheck` and `npm run build` fail in this checkout for an environmental reason:
`node_modules` is a symlink and npm's binary lookup does not resolve `tsc`. Run the
binaries directly as above.

The GLB export asserts triangle/size round-trip equality and that no scene IDs are lost, so
the indexed-merge change is covered by the same gate that protects scene identity.
