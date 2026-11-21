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

## Opening audio integration · 2026-11-19

The project-supplied WorkBuddy delivery adds 48 synthesized effects, 6 music stems,
9 processed CC0 recordings and one CC0 door-close OGG extracted from the supplied
StarNinjas archive. Individual authors, source pages, processing and license claims
are preserved in `assets/audio/story/SOURCES.md`; file hashes are in `IMPORT.json`.
The car-engine recording substitutes for a shuttle engine; the recordings are not
HKU field recordings. The CC0 claims apply to the listed external recordings, not
to the campus project or every file in the delivery. Synthesis sources are retained
in `scripts/audio/`. Raw archive bundles are excluded from the runtime distribution.

## AI study v7

- Spark 2.4.0 — World Labs, MIT. https://github.com/sparkjsdev/spark . Full license: `assets/third-party/spark/LICENSE`. Loaded only by the SPZ study page.
- World Labs client SDK 0.7.0 — Apache-2.0, server-side workflow scripts. https://www.npmjs.com/package/@worldlabsai/client . License remains in its npm distribution.
- Atlas-generated SPZ and RGBD-derived mesh originate from the user's authorized U02 video frames. They are project reference assets, not third-party CC0 assets. Atlas service terms apply; no broader open-content license is asserted.

## Central auditorium lettering

The south entrance uses a glyph subset from Noto Serif SC, © 2017–2023 Adobe. The subset is distributed under the SIL Open Font License, Version 1.1.
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

## NPC voice · DaVinci AI / ElevenLabs · 2026-11-21

The Act 1 Staff voice was generated on DaVinci AI using the ElevenLabs TTS V3
model and the Asher voice. It was produced with the account's one free audio
generation; no paid credits, subscription, top-up or voice cloning were used.
The bundled clips are in `assets/audio/npc/staff/`; provenance, hashes, quota
log and the dialogue text are in that directory and in
`docs/voice/DAVINCI-VOICE-REPORT.md`.

This is AI-generated voice content, not a CC0 recording and not a real person's
voice. DaVinci AI and ElevenLabs terms apply to the generated audio. The agent
could not subjectively audition the voice; only technical, transcript and browser
integration checks are claimed.
