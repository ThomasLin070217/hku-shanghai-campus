# Licences — HKU Shanghai at War (“BARRIER 2030”)

A one-page index. The full per-asset record lives in `../THIRD-PARTY-NOTICES.md`,
`../docs/ASSET-LICENSES-V8.md` and `../assets/audio/SOURCES.md`; this file states what
ships and under what terms.

## Code

**Our source code:** © 2026 HKU Shanghai campus project contributors, MIT (full text in
`../docs/ASSET-LICENSES-V8.md` §MIT).

**Runtime dependencies** — licence read from each installed package's `package.json`,
not from memory, on 2026-11-24:

| Package | Version | Licence | Ships in the build |
|---|---|---|---|
| `three` | 0.181.2 | MIT | yes |
| `@sparkjsdev/spark` | 2.4.0 | MIT | yes |
| `ws` | ^8.23.0 | MIT | no (local dev bridge) |

**Build/dev only** (not in `dist/`): `vite` MIT · `typescript` Apache-2.0 · `tsx` MIT ·
`@napi-rs/canvas` MIT · `@worldlabsai/client` Apache-2.0 · `gltf-validator` Apache-2.0 ·
`@types/*` MIT.

`vite.config.ts` copies the Three.js licence into `dist/licenses/three.txt` on every build,
so the distributed bundle carries the MIT text with it.

## Art and audio

| Component | Source | Terms |
|---|---|---|
| Character models | Kenney Blocky Characters 2.0 + our own HKU additions | CC0 base (Kenney); additions MIT |
| Props | Kenney Survival Kit 2.0, Factory Kit 3.0 | CC0 |
| Footsteps, ambience | Kenney Impact Sounds; Thimras Park ambiences | CC0 |
| Synthetic SFX | our `scripts/generate-audio.py` | CC0 1.0 |
| Campus geometry, MacBook prop, lion sculpture | original | MIT |

Campus photography and video are the owner's own references and are **not** redistributed
under any open licence. Every third-party pack keeps its original licence file beside the
assets it covers (`assets/characters/kenney/LICENSE.txt`, `assets/audio/kenney/License.txt`,
`assets/third-party/*/LICENSE`).

## Music — original, generated for this project

All 58 music takes are our own compositions: `score.json` and `style.json` authored in this
project, rendered by `vibe-compose-onezion`. **No existing recording is sampled or reused.**
The soundfont is a render-time instrument library and **is not shipped** — no `.sf2`/`.sf3`
is present in the tree; only rendered MP3s are distributed.

## Voice

All voice lines are synthetic TTS generated for this project through ElevenLabs from
`../.scratch/voice-2026-11-23/cast.json`. No real person's voice was cloned and no
recording was uploaded as a reference. The API key lives in the keychain / `.env` and is
never in a build artifact.

## 明我以德 (HKU anthem)

The melody of 明我以德 is used with the owner's authorisation as the source for an
**original arrangement** — never the official recording, which is never sampled.

Credit line, read off the published score (`q-1`/`q-4`, 2026-11-24):

> 曲：許冠傑　詞：林夕　© 2018 Development & Alumni Affairs Office, HKU. All Rights Reserved.

Our arrangement is a derivative of the melody and is used here under the authorisation
above; it is not offered under an open licence.

## Trademarks

“HKU”, “The University of Hong Kong”, “MacBook”, “MacBook Air” and “Apple” remain the
property of their owners. They appear as setting and reference, not as an endorsement.

## Open item

- ⚠️ The rendered music's soundfont is not distributed, but the terms under which
  `vibe-compose-onezion` renders with it have not been re-verified in this pass. Nothing
  in the shipped bundle depends on it beyond the MP3s themselves.
