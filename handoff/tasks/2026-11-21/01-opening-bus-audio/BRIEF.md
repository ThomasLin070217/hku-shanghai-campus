# BRIEF 01 · 开场巴士音效（给执行者的事实底稿）

基线：`main @ 41dedea6dda94ac9ac57f9da56d90ca2c551ec4d`，2026-11-21。

## 1. 这段现在到底在响什么

| 时机 | 声音 | 代码 |
| --- | --- | --- |
| 进入 `?experience=opening`，bus 阶段 | `mus_safe` 循环 + `cc0_bus_engine_idle` 循环 | `src/gameplay/storyAudio.ts` 的 `update()`：`music:safe`、`ambient:cc0_bus_engine_idle` |
| 点击 Start | 1.6 s 合成“bus”低频+噪声 | `src/gameplay/audio.ts::openingCue('bus')` |
| 开场镜头抬起 | 3.0 s 合成“wake”引擎+噪声 | `openingCue('wake')`，由 `experience.ts::startWake()` 触发 |
| 开门 | `bus_door.ogg` | `openingCue('door')` → `story.cue('bus_door')` |
| 请柬打开 | **静音**（2026-11-21 删除 0.42 s 急促纸张声） | `open('invitation')` 不再 cue |
| 请柬关闭 | `invitation_close` | `close()` → `story.cue()` |
| 脚步 | `run-paving-*` / `run-grass-*` | `OPENING_FOLEY` |
| 司机台词 | **只有字幕** | `experience.ts` 的 `showSubtitle('DRIVER — ...')` |

## 2. 关键代码位置

- `src/gameplay/audio.ts`
  - `enableStory()`：把 `OPENING_AUDIO_NAMES` 与 `OPENING_FOLEY` 合并进 `urls`。
  - `start()`：一次创建 AudioContext、5 个 bus，然后并发 `load()` 所有 URL。
  - `load()`：`fetch` + `decodeAudioData`，10 s 超时，失败进 `failedFiles`，没有自动重试。
  - `openingCue()`：合成型一次性 cue；`wake`/`bus`/`door`/`curtain` 等。
  - `openingAmbience()`：**当 `this.story` 非空时直接 return**，所以 day/dark 合成底噪在开场不会执行。
  - `preview()` / `setActive()` / `apply()`：试听、暂停、静音、分组音量。
- `src/gameplay/storyAudio.ts`
  - `cues` 来自 `assets/audio/story/audio-triggers.json`，`bus_door` 在代码里追加。
  - `update(frame)` 决定 music/ambient；bus 阶段固定 `cc0_bus_engine_idle`。
  - 最多 8 个 loop、16 个 voice；有 dialogue duck 和距离衰减。
- `src/opening/experience.ts`
  - `startWake()`：镜头/时长/`openingCue('wake')`。
  - `tick()`：bus 阶段开门、司机字幕、切 stage。
  - `open()/close()`：请柬/电脑/Staff 时暂停音频与 cue。
  - `audio.story?.update({stage, dark, chasing, ...})`：每帧喂 StoryAudio。
- `src/opening/audioAssets.ts`：开场专用 foley 的 URL 覆盖。
- `assets/audio/story/SOURCES.md`：CC0 素材来源与处理说明。

## 3. 已确认的问题（不是猜测）

1. **加载风暴**：58 个文件同时 fetch/decode，单文件 10 s 超时；在慢机器/慢网络下会出现大面积 `failedFiles`。`start()` 里没有任何并发上限。
2. **自动播放失败会连累解码**：`context.resume()` 失败时，`start()` 仍继续加载，但某些浏览器/无音频设备环境下 `decodeAudioData` 会随 context 状态失败；失败后没有自动重试，只能手动点 Retry。
3. **`openingAmbience()` 是死路径**：因为 `enableStory()` 已设置 `story`，开场永远不会走合成 day/dark 底噪；如果设计上想保留这层，需要显式合并，而不是留着。
4. **没有车内/车外声场**：`cc0_bus_engine_idle` 是单一 loop，开门前后没有低通/音量/空间变化；`bus_door.ogg` 只是一次性关门声，不是气动开门。
5. **没有司机声音**：字幕出现时没有 PA/chime，也没有 voice，和“COD-style 声音先行”的开场语言不一致。
6. **没有座椅/踏板/车厢细节**：现有 foley 只有纸、布、脚步。
7. **音量与 duck**：`mus_safe` 0.5、ambient 0.32；司机字幕出现时没有 duck（只有 Staff 语音有 `setDialogueDuck`）。

## 4. 已有素材

- `assets/audio/story/cc0/processed/bus_engine_idle.wav`（0.86 s，mono 48 kHz，CC0）
- `assets/audio/story/cc0/processed/bus_door.ogg`（13 KB）
- `assets/audio/story/cc0/processed/amb_birds_loop.wav`（516 KB）
- `assets/audio/campus/campus-breeze.wav`、step-paving/grass 变体
- `assets/audio/kenney/` 的 impact/interface/footstep CC0 包
- `assets/audio/opening-foley/` 的纸/布/落地/脚步
- `assets/audio/story/synth/` 的 UI/机械/氛围合成音

## 5. 可参考的“好”标准

- 0–10 s：闭眼能说出“我在一辆停着的校巴里，车外是校园”。
- 开门：先听到气动/锁止，再听到车外声变亮；引擎与 room tone 略降。
- 下车：脚步从车内硬地过渡到室外铺装，不出现静音断层。
- 读请柬：打开动作保持安静；合上/翻页可以有克制细节，但不能是快速抖动或短促“唰”声。
- 全段没有“循环接缝”和低频轰鸣；长时间戴耳机不累。

## 6. 证据与基线

- `evidence/thomas-opening-round2/00-wake-up.png`（开场字幕）
- `evidence/thomas-opening-round2/02-bus-interior-hearts.png`（车内）
- `evidence/thomas-opening-round2/03-bus-exterior-south.png` / `04-bus-exterior-north.png`（车外/车门）
- `evidence/thomas-opening-round2/opening-beat-reel.webm`（70 s 分镜）
- 机器可读：`docs/opening/ROUND2-DELIVERY.md` §5、`docs/opening/COD-INTRO-PASS.md`

## 7. 现有检查

```sh
npm run check:audio-review
npm run check:story-audio
npm run check:voice
npm run check:opening
npm run check:all
```

`check:audio-review` 会验证 chase fades、curtain pause/resume、capture feedback；`check:story-audio` 会验证 bus 阶段的 loop 切换。改 loop/加载逻辑后这两个必须先过。

## 8. 给执行者的边界

- 不新增 npm 依赖（`npm ci` 后必须能跑）。
- 不新增远端服务、不在运行时下载音频。
- 不改 `spatialLayout.ts` 的巴士坐标；不把玩家移出座位。
- 不改 `state.ts` / `persistence.ts` 的任务与存档。
- 不覆盖 Staff 五句 DaVinci 音频。
- 音频失败不能阻塞移动或剧情；所有失败都要有可重试路径。
