# CDS-1 fixtures · merge package

Generated 2026-11-21 from `feat/cds1-keyboard-detach` by
`scripts/export-cds1-fixtures.ts`. These are standalone, meters-scale fixtures
extracted from the observed CDS-1 rooms; the room/preview scaffolding is not
included.

## Files

| File | Node | Pieces | Triangles | Notes |
|---|---|---|---|---|
| `CDS1-Keyboard-Wall.glb` | `CDS1_Keyboard_Wall` | 54 keycaps | 53,572 | panel, sockets, detachable keycaps + stool pedestals |
| `CDS1-HKU-Flip-Wall.glb` | `CDS1_HKU_Flip_Wall` | 561 tiles | 6,792 | panel + independently flippable tiles |
| `CDS1-Aux-Power-Closet.glb` | `CDS1_Aux_Power_Closet` | static | 516 | cavity + opening frame + auxiliary power rack |
| `fixtures.json` | — | — | — | sizes, SHA-256, dimensions, source transforms, capabilities |

## Coordinates

- Units: **metres**
- Origin: each fixture's **panel / opening centre**
- Forward: **+Z** faces the room
- `+X` right, `+Y` up
- `fixtures.json → roomTransform` records where each fixture sits in the
  observed room, if you need to put it back exactly.

## How to merge

### A. Load the GLBs

```ts
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('assets/cds1/CDS1-Keyboard-Wall.glb');
scene.add(gltf.scene); // already centred at panel origin, +Z into the room
```

- Keycaps are groups named `Keycap_r<row>c<col>` with `userData.label`,
  `userData.phrase`, `userData.marked`. Their local origin is the keycap face;
  moving a group along +Z detaches it.
- Flip tiles are groups named `FlipTile_r<row>c<col>` with `userData.row`,
  `userData.column`, `userData.front`, `userData.back`. Rotate the group around
  local **Y** to flip; front/back use opposite colours.
- The power closet is intentionally static; `compact()` merged its boxes by
  material in the GLB. Use the whole node for the reveal, not individual PSUs.

### B. Import the procedural builders

```ts
import {buildObservedFeatureRoom, keyboardKeycaps, flipWallTiles}
  from './model/observedFeatureRooms';
const room = buildObservedFeatureRoom('flipWall');
const wall = room.getObjectByName('HKU_flip_wall')!;
```

No new dependencies were added. Model changes are confined to
`src/model/observedFeatureRooms.ts`:

- `Keyboard_wall` / `HKU_flip_wall` carry `userData`
  (`id`, `units`, `origin`, `forward`, `dimensions`, `capabilities`, `source`).
- `keyboardKeycaps(root)` and `flipWallTiles(root)` return the controllable
  nodes without reaching into private geometry.
- The flip wall rear wall is now a frame around a service opening; the power
  closet is a sibling group (`Aux_power_closet`).

The **preview-only** interactions live in `src/interiorsPreview.ts` and
`interiors.html` (selection, hinge, checkmark, WebAudio, camera views). Do not
merge those into the game loop blindly; the game should own puzzle state and
audio policy.

## Regenerate

```sh
npx tsx scripts/export-cds1-fixtures.ts
```

The script rebuilds each fixture, exports binary GLB, reloads it, and checks
piece counts + triangle parity before writing `fixtures.json`.

## Caveats

- Dimensions follow the observed-photo estimate (keyboard wall 7.65 × 2.0 m;
  flip grid 33 × 17 at 0.219 m pitch). Building/floor/room placement remains
  unverified.
- The keyboard's metal USB socket is a fictional interpretation of the single
  pin visible in the 2026-11-15 WeChat photo.
- The flip wall's front/back colours are inverse; the reveal target pattern and
  puzzle trigger are **not** encoded here.
