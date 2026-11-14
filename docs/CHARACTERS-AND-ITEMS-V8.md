# Character and inventory integration · v8

## Run

```sh
npm ci
npm run play
```

Game: http://127.0.0.1:5184/ · Character preview: http://127.0.0.1:5184/characters.html
Local AI: http://127.0.0.1:8788/ . These ports avoid the earlier project's 5174/8787 processes.
`npm run dev` starts only Vite. `npm run build` produces a standalone `dist/` directory; serve it with `npm run preview -- --port 4174`.

WASD / Shift / Space / V remain movement, run, jump and view. E opens inventory; E/Esc closes it. Closing leaves the game paused: click **进入探索** (or the explicit compatibility button after a browser pointer-lock failure). 1–9 and wheel select actual inventory slots 0–8; `[` / `]` change third-person camera distance. F is the existing quest interaction. Inventory changes are session-local and reset on page reload; persistence was not added in this round.

## Character template

`src/characters/character.ts` consumes `kenney-rig.json`, extracted from Kenney Blocky Characters 2.0 character-c. This is a **rigid joint hierarchy**, not a deforming skinned mesh: root → legs and torso → arms and head. It preserves original joint positions, geometry and locomotion animation clips. Reuse does not require a separate WebGL renderer or viewer controller.

Each `createCharacter(config)` creates independent nodes, materials, texture buffers, AnimationMixer, animation actions, pose and hand/back sockets. Only immutable geometry and animation clips are shared. `dispose()` avoids disposing shared geometry. Controller input is separate: players feed movement distance/grounded/vertical speed; the preview feeds its own per-actor state. Future NPC behavior can use the same visual API.

- `config.ts`: HKU green gown and two NPC appearance configurations; height is metres.
- `texture.ts`: original 16-pixel face art, full black crown/sides/back, pixel facial features, gown/shirt/trousers; no borrowed skin artwork.
- Animation mapping: `idle`, `walk`, `sprint` from Kenney; authored jump and blended two-hand carry overlay. Rigid arms taper to smaller authored hands; gown panels and back pleats are authored here.
- `sockets.leftHand`, `rightHand`, `back`: actual Object3D transforms. Slot scale cancels the character asset unit conversion.
- First-person sleeves use the same arm geometry, atlas generator and appearance colors as the player. First and third visual representations follow one equipped ID; only the active representation is visible.

```ts
import {createCharacter} from './src/characters/character';
import {STUDENT} from './src/characters/config';
const visitingStudent = createCharacter({
  ...STUDENT, id:'visiting-student', name:'Visiting student',
  height:1.76, build:.97, coat:0x345976, trim:0x203b51,
  hairStyle:'side-part', skin:0xc18b66,
});
scene.add(visitingStudent.root);
visitingStudent.animate(dt, travelledMetres, grounded, verticalSpeed);
visitingStudent.equip('macbook-air-13-silver');
// Never mutate shared geometry; create another configuration/instance instead.
```

Exported self-contained animated GLBs and PNG atlases live in `assets/characters/`. The runtime uses bundled rig data and authored local textures directly, eliminating asset-loading races. Re-export with `npm run export:v8`.

## Items / inventory

`Inventory.slots` is the only item collection: indices 0–8 are the hotbar, 9–35 are storage. `equipped` is derived from `slots[selectedHotbar]`. The drag operation stores only an index, and moves atomically on drop; cancel/outside-drop does not remove an item. Same-ID stackable items merge up to their limit; non-stackable items swap. The provided MacBook has a stable definition ID and an independent instance ID, count 1, max stack 1.

`src/items/definitions.ts` centralizes stable ID, name, local SVG icon, model ID/factory, stackability and hand position/rotation/scale. `macbook.ts` is independent, original metre-based geometry; `assets/items/macbook-air-13-silver.glb` is its portable export. The hinge is a separate named `Lid_Hinge`; `setLid()` already supports opening, while gameplay currently uses a fixed open carry pose. Width 0.3041 m, depth 0.215 m, closed height 0.0113 m; small keys/ports may project by fractions of a millimetre. Both views' transforms live in the item definition: `hold.firstPerson` is camera-relative; `hold.position/rotation/scale` attaches to a third-person hand socket.

To add an item: add an icon and `createModel(): Group`, register an ItemDefinition with a unique ID, and put `{itemId,instanceId,count}` into an inventory slot. Existing selection, UI movement and equipment logic do not need an item-specific branch. Current pose vocabulary contains `carry`; tools needing a different grip should add a named pose to the character template.

## AI

Protocol `hku-campus/1.1` extends the prior API. `observe.inventory` includes all 36 slots, selectedHotbar, equipped, revision and open. `observe.world` gives metre units and campus revision; landmarks include absolute and relative positions, including the new lion and directory.

```json
{"commandId":"equip-mac-1","controlEpoch":12345,"durationMs":400,"selectHotbar":0}
```

POST this through the existing `/act` endpoint after `/acquireControl`. Hotbar indices are **zero-based**. An accepted action is consumed once on the physics loop; expired or stale-epoch commands cannot select an item. Both input sources call `CampusGame.selectHotbar()`. Opening inventory pauses movement, zeros velocity and revokes AI; manual selection/view/movement also revokes AI. Rebuilding the campus preserves inventory but revokes authority and refreshes the world.

## Validation and evidence

`npm run check:v8`, `npm run check:nov13`, `check:exploration`, `check:v4`, `check:video`, `check:gameplay`, and production build. Browser receipts and images are under `evidence/v8/`. `equipment-demo.webm` / `.mp4` records live rendered gameplay, not a pre-baked animation. Unit and browser tests complement each other; exact real campus survey dimensions remain unverified (see `references/nov13/CORRECTIONS.md`).
