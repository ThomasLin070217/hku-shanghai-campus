# Asset packs — what we can legally use (owner question, 2026-11-23)

Owner, verbatim:
> 一些素材啊，一些视觉风格啊，一些音效啊，一些建模，你可以用我的世界那些资源包嘛，
> 肯定有很多人开源了这些东西，对不对？

Short answer: **the Minecraft style is fine; Minecraft's and Mojang-derived assets
are not.** The safe route is CC0 packs (Kenney, Quaternius, KayKit, Poly Haven,
ambientCG) plus original pixel textures drawn in the same palette. The repo
already ships Kenney CC0 kits (`assets/third-party/kenney/`).

## What the licences actually say

| Source | What it permits | Evidence |
|---|---|---|
| Minecraft / Mojang assets (vanilla textures, models, sounds) | Redistribution and commercial exploitation are not permitted; the Usage Guidelines define “assets” as including “graphics, textures, images, models, sounds and other audio”. Do not use in our own game/demo. | minecraft.net/en-us/usage-guidelines (page blocks extraction; quoted consistently by the results below) |
| Faithful resource pack | Licence v4 (2026-07-31) **does** allow “use, modify, and distribute our work for both Minecraft and non-Minecraft projects… and your own games or software”, with credit and no paywall/NFT. But requirement 4 under “may not” says: do **not** use it “as a substitute for Minecraft's graphics when default textures otherwise wouldn't be allowed… if Mojang wouldn't want you to use their work, we probably don't either.” A Minecraft-looking game using Faithful textures is exactly that case. | faithfulpack.net/license |
| Community “Minecraft resource packs” in general | Licences vary from “personal use only” to CC0; many repackage or derive from Mojang textures, so the pack licence cannot cure the underlying rights. Treat as **not usable** unless a pack states CC0 for every asset and contains no Mojang-derived files. | minecraftforum “List of Open License Resource Packs”; pack pages |
| Kenney | CC0, commercial use allowed, no attribution required. Already in the repo (Factory Kit, Survival Kit). | kenney.nl/support; existing `assets/third-party/kenney/*/LICENSE.txt` |
| Quaternius | CC0 low-poly models (characters, props, environments). | quaternius.com |
| KayKit | CC0, personal and commercial use, no attribution; the author asks not to resell unmodified copies. | kaylousberg.itch.io; godotengine.org asset library; OpenGameArt entry |
| Freesound | Filter by the CC0 tag; individual recordings have individual licences, check each. | freesound.org/browse/tags/cc0/ |
| Poly Haven / ambientCG / ShareTextures | CC0 PBR textures and HDRIs. | polyhaven.com; ambientcg.com; sharetextures.com |

Mark: the Mojang page itself could not be fetched through the extraction tool
(it returns an error); the quoted clause is from the search index and two
independent secondary sources, so treat it as verified at snippet level, not
as a full-page read.

## What to use for which need

| Need | Use | Notes |
|---|---|---|
| Props, sports equipment, furniture, signage, street furniture | Kenney kits (CC0), Quaternius packs (CC0), KayKit modular packs (CC0) | Normalise to the game's metre scale, merge per material, instance repeats; no per-object materials. |
| Buildings and the HKU look | Keep the existing parametric model | Imported asset packs would break the observed campus proportions; use them for interiors/props only. |
| Characters | Keep the existing rig | The cast is already custom and tied to gameplay; imported characters would need re-rigging. |
| Wall/floor/foliage textures | Original 16×16 / 32×32 pixel art in the existing palette, or CC0 PBR textures resampled | The “Minecraft look” is a technique (chunky texels, limited palette, nearest filtering), not Mojang's files. |
| SFX | Kenney audio packs (CC0), Freesound CC0 | Keep the 16-voice budget and the existing `StoryAudio` buses. |
| Music | `vibe-compose-onezion` original score (see `docs/plans/2026-11-23-music.md`) | Do not sample Minecraft music. |
| UI/fonts | OFL fonts (repo already uses NotoSansSC OFL), original UI | No Minecraft fonts or textures. |

## Integration rules (so “more assets” does not cost frames)

1. Import → normalise to metres → strip embedded lights/cameras → merge by
   material inside the zone → instance repeats.
2. Texture atlas per zone; 512 px cap for props, 1 024 px for signage.
3. Every imported asset gets `authorKey`, `sourceFile`, a licence line, and
   `confidence: 'third-party-cc0'` in its userData; the licence text goes to
   `docs/ASSET-LICENSES-V8.md`.
4. No new always-resident assets: imported packs live inside a zone and are
   unloaded with it (see `docs/plans/2026-11-23-world-scope-perf.md`).
5. The build must stay free of any Mojang file. A `check:assets` scan can
   assert that no `.png/.json/.ogg` under the vanilla paths or known pack
   hashes is present, and that every third-party file has a licence entry.

## Plan

### Task 1 — licence scanner and manifest

Files: `scripts/check-assets.ts` (new), `assets/third-party/manifest.json`,
`docs/ASSET-LICENSES-V8.md`, `package.json`.

- Every third-party file/dir has an entry: `id`, `sourceUrl`, `licence`
  (`CC0`, `CC-BY-4.0`, `OFL`…), `author`, `modified`, `sha256` (for single
  files) and `usedBy`.
- `check:assets` fails on: an unlisted file under `assets/third-party/`, a
  missing licence text, an entry with a non-allowlisted licence, or a file
  whose hash no longer matches (modified without updating the manifest).
- Explicit denylist check: no Mojang paths (`assets/minecraft/**`), no known
  Minecraft pack ids, no `Faithful` files.
- Wire into `check:all`; run it in CI.

### Task 2 — import pipeline

Files: `scripts/import-asset-pack.mjs` (new), `docs/ASSET-LICENSES-V8.md`.

- Input: a downloaded CC0 pack (Kenney/Quaternius/KayKit) in a staging dir;
  output: normalised glTF/GLB or textures under `assets/third-party/<pack>/`,
  scale in metres, no embedded lights/cameras, a manifest entry with the
  licence text and source URL.
- A `--strip` mode removes unused textures and compresses with the existing
  tooling; a `--report` mode prints triangles/materials/textures per asset so
  the zone budget can be checked before import.
- The script never downloads; the owner supplies the pack.

### Task 3 — first prototype (sports hall props)

- Use one CC0 pack for hoops/bleachers/lockers/equipment and original
  court-line textures; import, merge by material, instance repeats, place in
  the sports hall zone from `docs/plans/2026-11-23-world-scope-perf.md`.
- Measure the zone against the budget; screenshots; if the look clashes with
  the HKU model, keep the court and use original low-poly props instead.

## Recommended first move

Prototype the sports-hall fit-out with Kenney/Quaternius CC0 props (hoops,
bleachers, lockers, equipment) and original court-line textures, then measure
the zone against the budget. If the look is right, extend the same pipeline to
the B5 lounge and the B01–B03 lobbies.
