# What "too slow" actually is — measured, 2026-11-24

The forwarded review table named **Draco geometry + KTX2/WebP textures** as "the strongest direct
fix for 模型太慢". Measured against the build we actually ship, that fix would compress **zero
bytes**. The payload is not geometry. It is audio.

Everything below is a command result, not an estimate. Re-run any line to reproduce.

## The build

```
$ du -sh dist
47M   dist
```

| payload | size | how |
|---|---:|---|
| audio | **44.4 MB** | 98 `.wav` = 22.2 MB, 23 `.mp3` = 22.2 MB |
| JavaScript | 1.54 MB | 17 chunks; `three` is the only manual chunk |
| CSS | 0.2 MB | |
| **`.glb` / `.gltf` / `.ktx2` / `.bin`** | **0 files** | `find dist -type f \( -name '*.glb' -o -name '*.gltf' -o -name '*.ktx2' -o -name '*.bin' \)` → 0 |

The campus, the interiors and the opening are all built procedurally in `src/model/` and
`src/opening/`. `GLTFLoader` appears in exactly four places and none of them is the game loop:
`ai-study.ts` (separate demo page), `main.ts` (the user's "Reload GLB" import button),
`viewer/export.ts` (export round-trip), `interiorsPreview.ts` (export). No GLB is fetched at boot.

**So Draco/KTX2 has nothing to compress.** It is the right fix for a different project — one that
ships authored meshes. For this one it is a no-op with a build-time cost.

## What the first click actually fetches

`CampusAudio.start()` (`src/gameplay/audio.ts:60-66`) fetches **every** URL in `this.urls` — there is
no lazy path, no chapter gating, no priority:

```ts
const names=Object.keys(this.urls).filter(n=>!this.buffers.has(n)&&(retryFailed||!this.failedFiles.includes(n)));
this.loading=Promise.all(names.map(n=>this.load(n))).then(()=>{}).finally(()=>{this.loading=null;});
```

`this.urls` = the 17 entries in `audioUrls` + the 38 `OPENING_AUDIO_NAMES` merged in by
`enableStory()` + every entry in `OPENING_FOLEY`. My first pass parsed 55 files / 19.33 MB and **missed
`OPENING_FOLEY` entirely**; the build's own measurement of the same set is **65 URLs / 20.31 MB**. Use
the build's number. The split is roughly:

```
eager files: 65 total 20.31 MB
   wav ~11.0 MB
   mp3  ~8.3 MB
   ogg  ~0.01 MB
```

Top of that set:

| MB | group | name | codec |
|---:|---|---|---|
| 4.12 | core | `campus-breeze` | **wav** — pcm_s16le, 24 kHz, **stereo**, 45.0 s, 768 kbps |
| 1.79 | opening | `mus_prologue` | mp3 192 kbps stereo, 78.3 s |
| 1.60 | opening | `mus_sports` | mp3 |
| 1.53 | opening | `mus_patrol` | mp3 |
| 1.22 | opening | `mus_dinner` | mp3 |
| 1.12 ×4 | opening | `mus_safe` / `mus_unease` / `mus_tension` / `mus_hope` | **wav** |
| 0.83 | opening | `mus_office` | mp3 |
| 0.50 | opening | `cc0_amb_birds_loop` | **wav** |

`campus-breeze` is a 45-second ambience loop stored as uncompressed 768 kbps stereo PCM. It is the
single largest file the game downloads.

## It does not block the game — and that is not the good news it looks like

Callers use `void audio.start()`, so the opening is not gated on the download: the player can move
while it streams. The cost lands somewhere worse and less visible — 19.3 MB of fetch and
`decodeAudioData` (11 MB of it uncompressed PCM) runs concurrently with the opening sequence, on the
same main thread that is compiling shaders and building the scene. On a venue network that is the
first minute of the demo.

## The second cost: the set grows with every chapter

`storyAudioAssets.ts` registers **81 files / 35.75 MB**; only the 38 `OPENING_AUDIO_NAMES` are merged
into the eager set today. Every later chapter that adds cues to that list raises the first-click
download toward 40 MB — the full score is already in the repo, so this is a delay, not a risk.

## The fix, in payoff order

1. **WAV → MP3 at a sane bitrate, at build time.** 11.03 MB of PCM becomes ~1.2 MB at 96 kbps.
   Per-file targets: `campus-breeze` mono 64 kbps (~0.36 MB, from 4.12), the four `mus_*.wav` at
   128 kbps (~0.18 MB each, from 1.12), SFX mono 64 kbps.
   Must be a **build-time transform**: `assets/` stays the master, the audition pages keep working,
   and the owner's veto list can still point at the originals.
2. ~~**Re-encode the high-bitrate MP3s.**~~ **Struck after probing all 23 in `dist/assets`:** 18 are
   already 160 kbps, 2 are 192 (`mus_dinner`, `mus_prologue`), and the 4 prologue voice lines are 128.
   Total 1151 s / 22.2 MB. The MP3 side is already correctly encoded; re-encoding it would spend
   generation loss on music the owner still has to audition, to save ~1.4 MB. Leave it alone.
3. **Make the loader lazy.** Fetch a cue when its chapter starts. `start()` becomes "the cues the
   opening needs", not `Object.keys(this.urls)`. This is what keeps the future chapters free — and it
   is worth ~4.5 MB on its own, because the opening currently downloads `mus_sports`, `mus_patrol`,
   `mus_office` and `mus_alert` at the first click for chapters that arrive much later.

## Measured after step 1 landed (WAV transform only, MP3s untouched)

| | before | after step 1 | after step 1 + lazy split (target) |
|---|---:|---:|---:|
| `dist` total | 48.39 MB | **30.72 MB** | 30.72 MB |
| first-click transfer | 20.31 MB | **12.26 MB** | **≤ 6 MB** |
| oversized WAVs emitted | 98 | **0** | 0 |
| audio files decoding | 122 | 122 | 122 |

**30.72 MB is the floor for `dist`, not a failure.** All 81 `storyAudioAssets` entries are registered
in source and Vite must emit every one; the MP3s are already correctly encoded. The remaining first-
click win comes only from the lazy split — `mus_sports`, `mus_patrol`, `mus_office` and `mus_alert`
are ~4.5 MB of later-chapter music fetched at the first click today.

Do not set the eager gate at 6 MB and then stop after step 1; and do not relax it to match a result.
If the split lands above 6 MB, report the real number and what is still in the eager set.

Not on the list, because measurement does not support it: Draco, KTX2, WebP texture compression,
mesh decimation. There are no meshes in the payload. Re-open only if a hero GLB is ever added.

## What is still worth measuring before touching frames

The playtest at dist5 reported 60 fps at `resolutionScale 1.0` with 462 draw calls and 128,463
triangles. Frame rate is not the current complaint; load is. If the owner's "slow" turns out to be
frame rate after the audio work lands, the next measurement is per-zone draw calls, not compression.
