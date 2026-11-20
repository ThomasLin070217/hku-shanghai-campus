# HKU Shanghai Campus — AI Uprising · 音频交付包（v0.1）

**交付方** WorkBuddy 音频团队 · **日期** 2026-11-19 · **对应** ADS 文档 `docs/ADS-Audio-Design.md`

> 本交付基于**被截断的任务书**先行完成：文档止于第 4 节表格「起跳」行，缺失场景 05+ 与全部交付规格。缺失规格由音频团队按专业标准补齐，推断内容标注 `〔TBD〕`。**职责边界**：WorkBuddy 交付声音文件与设计规范；触发接入、状态切换、音量、空间化、资源加载由 **Codex** 负责（见 ADS 第 9 节）。

---

## 目录结构

```
audio-out/
├── docs/
│   ├── ADS-Audio-Design.md      # 音频设计文档（11 大项 + 场景 + 混音规范 + 接口契约）
│   ├── QA-Report.json           # 客观核验结果
│   └── README.md                # 本文件
├── synth/                       # 程序化原创合成（纯 Python stdlib，CC0 等价）
│   ├── sfx/                     # 48 个音效
│   │   ├── sfx_anomaly_low.wav … sfx_crowd_cheer.wav
│   │   └── (见 sfx-report.json)
│   └── music/                   # 6 条自适应音乐 stem
│       ├── mus_safe.wav / mus_unease.wav / mus_tension.wav
│       ├── mus_chase.wav / mus_boss.wav / mus_hope.wav
│       └── (见 music-report.json)
├── cc0/                         # CC0 授权素材（39 MB）
│   ├── MANIFEST.md              # 逐项来源/作者/许可/处理记录 + GAPS
│   ├── raw/                     # 33 个原始下载（含 6 个 Kenney/OGA ZIP，OGG 需解码）
│   └── processed/               # 9 个处理后 WAV（鸟鸣/风/雨/巴士引擎/警报/金属撞击/电机/科幻嗡鸣/欢呼）
├── scripts/
│   ├── synth_lib.py             # 合成原语库
│   ├── gen_sfx.py               # 音效生成
│   ├── gen_music.py             # 音乐 stem 生成
│   └── qa_check.py              # 客观核验
└── audio-triggers.json          # 57 cues（含 9 CC0）+ 6 music layers + Scene 03 cue sheet
```

## 技术规格

- **格式** 16-bit PCM WAV · **采样率** 22050 Hz · **声道** 单声道（空间化由引擎 PannerNode 处理）
- **峰值** ≤ 0.891 线性（-1.0 dBFS 余量）· **循环** 首尾淡入淡出 + 3-5s 交叉淡化
- **音乐** 6 条 stem 统一 72 BPM、8 小节、A 小调/C 大调，可无缝 crossfade

## 覆盖清单（对应任务书 11 项）

| 任务书项 | 覆盖状态 | 主要文件 |
|---|---|---|
| 1 原创 BGM/配乐 | ✅ 6 条分层 stem | `synth/music/*` |
| 2 校园环境音与空间氛围 | ✅ 含真实素材 | `amb_dark_hum`, `cc0/processed/amb_birds_loop`, `amb_wind_loop`, `amb_rain_loop` |
| 3 人物动作音效 | ✅ 含高优先级修复 | `step_jump`, `step_land`（现有脚步在项目中） |
| 4 机器人音效 | ✅ 全套 | `robot_*` |
| 5 AI 入侵/帷幕剧情演出 | ✅ 八阶段 cue sheet | `sfx_anomaly_low` … `sfx_veil_seal` |
| 6 MacBook/AI/背包/UI | ✅ | `macbook_*`, `ui_*`, `decrypt_*`, `agent_status` |
| 7 解密/超算/电源 | ✅ | `decrypt_*`, `supercomputer_hum`, `power_*` |
| 8 机械狮 Boss | ✅ | `boss_*`, `mus_boss` |
| 9 篮球馆解谜/获救 | ⚠️ 推断（TBD 谜题细节） | `gym_ambience`, `bounce_ball`, `student_free` |
| 10 灯光秀/结尾 | ✅ | `sfx_lightshow_sweep`, `sfx_crowd_cheer`, `mus_hope` |
| 11 资源整理/混音规范/触发配置 | ✅ | `audio-triggers.json`, `docs/`, `MANIFEST.md` |

## 客观核验结果

QA 脚本（`scripts/qa_check.py`）检查全部 **63 个交付 WAV**（48 合成音效 + 6 音乐 stem + 9 CC0 处理素材）：**零** 格式错误、零削波、零近静音、峰值全部在限内。详见 `docs/QA-Report.json`。

**集成注意**：交付物采样率不统一（合成 22050 Hz / CC0 素材 44000-48000 Hz）。`audio.ts` 用 `decodeAudioData` 加载，通常能处理，但 Codex 需在浏览器实测；若要统一，导入时重采样到 22050 Hz。`cc0/raw/` 里有 6 个 ZIP 是 OGG-only（无 ffmpeg 环境无法解码），集成时优先用 `cc0/processed/` 的 WAV。

## ⚠️ 未验证项（必须如实说明）

1. **主观试听未做**：当前工具不支持音频输入，我无法辨别音色是否"自然/像校园/够恐怖"。数值检查不能替代人耳。**请你直接播放 WAV 验收**，特别是：脚步相关、Scene 03 演出序列、6 条音乐 stem。
2. **CC0 素材质量/许可**：见 `cc0/MANIFEST.md` 逐项来源；素材主观是否合适需你判断。
3. **游戏内实际效果**：需 Codex 按 `audio-triggers.json` 接入后在浏览器验证（空间化、ducking、状态切换、loop）。
4. **场景 05-08 细节**：依据故事梗概推断，任务书补全后需复核。

## Codex 接入要点（摘要，详见 ADS 第 9 节）

1. 把音效注册到 `CampusAudio` 的 `audioUrls` 表（`src/gameplay/audio.ts`）。
2. 按 `audio-triggers.json` 的 `cues[]` 设置 bus / spatial / loop / gain / priority / duck。
3. 音乐 stem 按 `musicLayers` 的 BPM/bars 对齐，crossfade 用配置的 ms 值。
4. Scene 03 按 `cueSheetScene03` 的相对时间轴触发（八阶段）。
5. 空间化沿用现有 `PannerNode` 参数（equalpower / inverse / refDistance 2 / rolloff 0.6）。
