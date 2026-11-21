# 任务 01 · 开场巴士音效重做

你是本项目的独立音频实现 Agent。仓库是私有的 HKU Shanghai Campus（Vite + TypeScript + Three.js 第一人称校园游戏），基线 `main @ 41dedea`。先读 `AGENTS.md`、`docs/AI-START.md`、`docs/opening/COD-INTRO-PASS.md`，再读随包 `BRIEF.md`。直接改代码、跑检查、交录音，不要只回复方案。

## 一、要解决的问题

玩家进入开场后坐在校巴里（`?experience=opening`），目前这一段**听起来不像“坐在一辆正在等客的校巴里”**。请把开场巴士段（从落到座位、读请柬、司机提示、开门、下车，到踏上 B4 前庭的最初几秒）做成一套完整、克制、可循环的室内声场；同时修掉音频加载在慢机器/自动播放受限时整批失败的问题。

## 二、已核对的现状（2026-11-21，不要重复调研）

- `src/gameplay/storyAudio.ts` 在 `stage === 'bus'` 时循环 `mus_safe`（music）和 `cc0_bus_engine_idle`（ambient）。这是目前唯一的巴士底噪。
- `CampusAudio.openingCue()` 里的 `wake`（3.0 s）和 `bus`（1.6 s）是**运行时代码合成的正弦+噪声**，不是录音；`wake` 在开场镜头抬起时播放，`bus` 在点击进入时播放。
- `door` 走 `bus_door.ogg`；请柬**打开现在按 owner 确认保持静音**，合上仍走 `invitation_close`；脚步走 `opening-foley` 的 run-paving/run-grass 系列。
- `CampusAudio.openingAmbience()` 在 `this.story` 存在时直接 `return`（`src/gameplay/audio.ts` 约 171 行），所以开场本来设计的 day/dark 合成底噪是**死代码**；目前白天底噪完全由 StoryAudio 承担。
- 没有：车厢空调/电流声、车窗与车身细响、座椅吱呀、上下车踏板声、车门气动/锁止层次、司机 PA 提示音、车内外声场切换、车内对车外环境声的闷化。
- 司机台词目前只有字幕（`experience.ts` 的 `showSubtitle('DRIVER — ...')`），没有声音。
- 加载：`CampusAudio.start()` 一次并发 fetch/decode 58 个文件，每个 10 s 超时；失败会永久进入 `failedFiles`，只在设置页有手动重试。自动播放被拦截时 `AudioContext` 可能保持 suspended。实际浏览器里如果任一环节超时，玩家会听到**整段静音**。
- 现有音频资产与授权：`assets/audio/SOURCES.md`、`assets/audio/story/SOURCES.md`。已有 `cc0_bus_engine_idle.wav`、`bus_door.ogg`、`campus-breeze.wav`、Kenney impact/footstep 包可复用。

## 三、必须实现

### A. 巴士内部声场（约 0–60 s，循环无缝）

按“坐在车里、车门还关着”的听感组织层次，至少包含：

1. **发动机怠速**：低转速、低通、稳定，不要像跑车；音量低于音乐，不能盖过请柬/司机字幕。
2. **车厢 room tone**：空调/电流/轻微车身共振，给“封闭空间”感。
3. **偶发细节**：座椅受力、车窗/车身轻响、远处校园被玻璃闷住的鸟声/风声。低频与高频都不要持续轰鸣。
4. **请柬与交互**：**不要恢复打开请柬时那个 0.42 s 的急促纸张声**（2026-11-21 已按 owner 确认删除）。合上/翻页可以有克制的纸张细节，但不能是快速抖动或“唰”的短促噪声；打开动作保持安静。
5. **音乐**：保留 `mus_safe`，但在车内压低；读请柬时按现有 dialogue duck 规则让位。
6. **司机提示**：在开门前给一个短 PA 提示音（chime），再接字幕；**不要**在没有 owner 授权的情况下用 TTS 新生成真人声音。可以复用已批准的声音，或只做 chime + 字幕。

### B. 上下车过渡

- 车门打开瞬间：气动/锁止/踏板层次，引擎和 room tone 稍降，车外校园环境声（鸟/风/远处脚步）从闷到开，做一个 0.6–1.2 s 的 crossfade。
- 下车踏上铺装：脚步材质切换要自然；不要出现“车内声突然切断”的硬切。
- 车门关闭/重新进入（如果玩家回头）要能反向过渡，不能只做一次性。

### C. 加载与可靠性

- 把音频加载改成**分批/优先级队列**：开场必需（bus engine、door、invitation、music、脚步）优先，其余后台加载；限制并发（建议 4–6），每个文件超时放宽到 20–30 s，失败自动重试 1–2 次。
- 自动播放被拦截时，解码仍应继续；不要因为 `resume()` 失败就把 58 个文件永久标失败。设置页的 Retry audio 必须能真正恢复。
- 首次进入时如果音频尚未 ready，HUD/设置页要给出明确但不打断游玩的状态；不能阻塞移动、读请柬或任务推进。
- 不要新建第二个 `AudioContext`；继续走 `CampusAudio` 的 master/groups/duck/visibility 规则。

### D. 混音与工程

- 全部使用 bundled 本地文件，运行时不请求外部 TTS/音频服务。
- 峰值 ≤ −1 dBFS；循环点无爆音；语音/字幕期间 music/ambient duck 与现有规则一致。
- 新素材只允许 CC0/已授权资源；在 `assets/audio/SOURCES.md` 补来源、作者、许可、处理脚本。不要用未授权采样。
- 保留 `assets/audio/npc/staff/` 的 DaVinci 五句，不要重生成、不要覆盖。

## 四、文件边界

**可改：**
- `src/gameplay/audio.ts`
- `src/gameplay/storyAudio.ts`
- `src/gameplay/storyAudioAssets.ts`
- `src/opening/audioAssets.ts`
- `src/opening/experience.ts`（只改音频触发与司机/开门时序，不碰任务状态机）
- `assets/audio/opening-foley/`、`assets/audio/story/`（新增文件）
- `assets/audio/SOURCES.md`
- 新增 `scripts/check-opening-audio.ts` 并在 `package.json` 注册；可加到 `check:opening`

**只读参考：**
- `src/opening/ui.ts`、`opening.css`（除必要的音频状态文案）
- `docs/opening/ROUND2-DELIVERY.md`、`docs/voice/DAVINCI-VOICE-REPORT.md`

**不要动：** 其他成员关卡、`src/opening/robot.ts`、`state.ts`、`persistence.ts`、`spatialLayout.ts` 的坐标、`/act` 协议、任何远端接口。

## 五、验收（必须实际执行）

1. `npm run check:audio-review`
2. `npm run check:story-audio`
3. `npm run check:voice`
4. `npm run check:opening`
5. `npm run check:all`
6. 浏览器实测：`npm run play` → `http://127.0.0.1:5184/?experience=opening`，用真实点击进入，确认：
   - 0–10 s 内能听出“车内”而非“空旷校园”；
   - 读请柬、开门、下车三个节点有明确声音变化；
   - 设置里静音/环境音量/重试音频都生效；
   - 慢速网络（DevTools Slow 4G + 6× CPU throttle）下进入不被音频阻塞，失败文件可重试。
7. 录一段 60–90 s 的开场音频（MediaRecorder 或系统录音，保留 WAV/WebM）放到 `evidence/opening-audio-20261121/`，附 `before/after` 与监听清单。
8. 主观试听由人完成；你只能报告技术检查，不要声称“已经好听”。

## 六、交付

- 实际修改文件列表与 diff 摘要。
- 新增素材清单、许可、响度/峰值/循环点数据。
- 检查命令与完整输出。
- 60–90 s 录音、3 张关键截图（车内/开门/下车）。
- `BRIEF.md` 里列出的未决问题回答。
- 不能完成的项明确写“未验证”，不要用估算冒充实测。

## 七、需要 owner 先确认（不阻塞开工，先按默认做）

1. 司机提示是否允许使用已批准的真人/TTS 声音？默认：**只做 PA chime + 字幕**，不新生成声音。
2. 巴士段是否允许加入非常轻的“校园远处人声/鸟声”？默认：**只做闷化的环境声，不加可辨认人声**。
3. 音乐是否保持 `mus_safe`？默认：**保持**，只调低车内电平。
