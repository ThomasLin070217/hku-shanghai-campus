# v9 初始音频（历史版本）

以下描述仅适用于最初 v9 合成音，当前脚步和环境音已替换，见文末修复来源。

新增 9 个 WAV 及合成脚本由本项目原创，版本 v9、seed 904；CC0-1.0，见 [来源及许可](assets/audio/LICENSE.txt)。未使用外部录音、音乐、采样包或付费生成服务。角色、模型、贴图及动画继续沿用 v8 的逐项许可记录。

本轮角色及道具的分项许可见 [ASSET-LICENSES-V8](docs/ASSET-LICENSES-V8.md)。

# Third-party components added in v6

- XState 5.33.4 — Stately, MIT. https://github.com/statelyai/xstate . Full license: `assets/third-party/xstate/LICENSE`.
- Kenney Survival Kit 2.0 — Kenney, CC0-1.0. https://kenney.nl/assets/survival-kit . Selected bottle, hammer and planks models and palette; full license in package directory.
- Kenney Factory Kit 3.0 — Kenney, CC0-1.0. https://kenney.nl/assets/factory-kit . Selected screen-small model and palette; full license in package directory.

Downloaded file hashes and source pages are in `assets/third-party/kenney/manifest.json`. Original palettes remain intact; runtime adjusts scale, placement and texture filtering. When moving an original Kenney GLB, copy its sibling `Textures` directory too.

Other existing npm dependencies retain their own licenses in their distributions. Campus reference photography is not included in the above CC0 grant. Original campus geometry is not imported from Minecraft. The v8 student now adapts Kenney Blocky Characters 2.0 under CC0; see the current per-component license record above.

## Campus audio repair · 2026-11-14

Kenney Impact Sounds (2019-12-19), CC0: https://kenney.nl/assets/impact-sounds . Concrete/grass variants retain original files and license under `assets/audio/kenney`.

Thimras Park ambiences (2022-07-25), CC0: https://opengameart.org/content/park-ambiences . Used a filtered/crossfaded excerpt of open-field wind; this is not an HKU recording. Exact processing and source attribution: `assets/audio/SOURCES.md`.

运行包内 Three.js MIT 全文：`licenses/three.txt`。当前音频来源、CC0 声明和角色许可随运行包保留；不依赖整份研究目录。

## AI study v7

- Spark 2.4.0 — World Labs, MIT. https://github.com/sparkjsdev/spark . Full license: `assets/third-party/spark/LICENSE`. Loaded only by the SPZ study page.
- World Labs client SDK 0.7.0 — Apache-2.0, server-side workflow scripts. https://www.npmjs.com/package/@worldlabsai/client . License remains in its npm distribution.
- Atlas-generated SPZ and RGBD-derived mesh originate from the user's authorized U02 video frames. They are project reference assets, not third-party CC0 assets. Atlas service terms apply; no broader open-content license is asserted.
