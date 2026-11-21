# 任务 02 · 开场结尾电影化（和开头一个水准）

你是本项目的独立玩法/UI 实现 Agent。仓库是私有的 HKU Shanghai Campus（Vite + TypeScript + Three.js），基线 `main @ 41dedea`。先读 `AGENTS.md`、`docs/AI-START.md`、`docs/opening/COD-INTRO-PASS.md`、`docs/opening/ROUND2-DELIVERY.md`，再读随包 `BRIEF.md`。直接改代码、跑检查、交录屏，不要只回复方案。

## 一、要解决的问题

开头已经按 COD 式做了：黑场、letterbox、镜头抬起、标题卡、字幕先行、请柬是座位上的实体。**结尾却是一个普通弹窗**：玩家一进入 B4 交接点，画面立刻变暗、HUD 还在、字幕停在上一句 Staff 台词，然后弹出 “Building 4 reached” 的卡片。节奏和开头完全不对称。

请做一个 **8–12 秒的结尾段落**，让“到达 B4 → Mission Complete → 交给下一章”像开场一样有演出感，然后仍保留现在的交接信息与入口按钮。

## 二、已核对的现状（2026-11-21）

- `src/opening/experience.ts`：`arriveB4()` 里 `transition('reach_b4')` 后立即 `open('complete')`；`open()` 会 `audio.setActive(false)`、`explorer.openPanel(...)`，所以是硬切弹窗。
- `completeDialog()` 在 `src/opening/ui.ts`：标题、一段正文、3 行 facts、`Close` + “Play L001 lawn encounter” + “Rescue the sports hall students”。
- 背景只是被弹窗背后的 blur/暗化；没有 letterbox、没有镜头运动、没有标题卡、没有专属音效。
- `story.stage === 'complete'` 时 `StoryAudio` 自动切到 `mus_hope`；没有 mission-complete stinger。
- 实测（headless）到达 complete 时，`.opening-cinema` 仍显示上一句 Staff 字幕（`Hey — you're one of the Student Ambassadors, right?`），说明字幕状态没有在结尾清掉。
- `OpeningCinema` 目前支持 `off | wake | title | subtitle`，有 `letterbox`、`opacity`、`title`、`subtitle`、`hint`；`updateCinema()` 在 `ui.ts`。
- 事件 `opening.building4_reached` 通过 `transition('reach_b4')` 写入并 `window.dispatchEvent`；`runtime.go_to_building4_objective_unlocked`、`agent_chat_unlocked` 已在更早阶段设置。

## 三、必须实现

### A. 结尾段落（默认 8–12 s，可跳过）

到达 `O.handoff`（`experience.ts` 的 reach_b4 触发）后，按以下节拍演出：

1. **收束**：锁住移动/交互（可保留视角），HUD 与 crosshair 淡出，letterbox 进入；清掉残留字幕。
2. **镜头**：不瞬移玩家；用当前相机位置/朝向做一个短、克制的 settle 或 1.5–2 s 的轻微 dolly，朝向 B4 主入口/交接点。若当前相机角度不可用，做“视线锁定 + 极轻推近”，不要强行传送到新机位。
3. **标题卡**：`BUILDING 4` / `OPENING COMPLETE`（或同级措辞），副标题一句：MacBook 已在背包、下一章从 B4 内部继续。字体/letterbox 与开场一致。
4. **声音**：`mus_hope` 接住，给一个短 mission-complete stinger（可用现有 `ui_confirm`/`complete` 素材或新 CC0；不要新生成真人语音）；环境声继续，不静音。
5. **停留与跳过**：标题出现 1.5 s 后显示 `Press Space to continue`；按 Space/Enter/Esc 或点击可跳过。自然结束或跳过后，打开现有 `complete` 交接卡（保留 facts 与两个关卡入口）。
6. **收尾**：关掉交接卡后回到可控制状态（与现在 `Close` 行为一致），或按现有逻辑停在结束态；不要自动跳转别的 `?experience=`。

### B. 状态与边界

- `opening.building4_reached` 仍只发一次；不新增任务 flag；不改 `state.ts` 的 canonical beats。
- 结尾段不能再次触发 `reach_b4`；重载/读档回到 `complete` 时应直接显示交接卡，不重放整段（或只允许一次轻量 end card）。
- 保留 `Play L001 lawn encounter` / `Rescue the sports hall students` 两个入口。
- 不能把玩家传送到别处；不能用改坐标替代 `reach_b4` 的真实到达判定。
- 结尾段必须可跳过，且跳过不破坏事件/存档。

### C. 与开头共用语言

- 复用 `.opening-cinema` 的 letterbox/标题/字幕组件，不要另起一套全屏 UI。
- 可以扩展 `OpeningCinema` 的 `mode`（例如新增 `ending`），或在 `experience.ts` 里组合 `showTitle/showSubtitle` + `cinema`；但不要把结尾逻辑硬塞进每帧分支导致开头回归。
- 文案放进 `src/opening/en.ts` 的 `complete` 段或同文件常量，不要散落硬编码。
- 若需要新的 CSS，放 `src/opening/opening.css` 的 cinema 区，保持现有像素/HKU 绿金风格。

## 四、文件边界

**可改：**
- `src/opening/experience.ts`
- `src/opening/ui.ts`
- `src/opening/opening.css`
- `src/opening/contracts.ts`（仅 `OpeningCinema` 类型）
- `src/opening/en.ts`（只加结尾文案）
- `src/gameplay/storyAudio.ts`（只加结尾 stinger 的 cue/触发；不动 bus/robot 逻辑）
- 新增 `scripts/check-opening-ending.ts`，注册到 `check:opening`

**只读参考：**
- `src/opening/state.ts`、`persistence.ts`、`spatialLayout.ts`
- `docs/opening/HANDOFF.md`、`docs/opening/ROUND2-DELIVERY.md`

**不要动：** 机器人 AI、MacBook UI、音频加载、其他成员关卡、`/act` 协议。

## 五、验收（必须实际执行）

1. `npm run typecheck`
2. `npm run check:opening`
3. `npm run check:all`
4. 新增检查至少断言：
   - `reach_b4` 后先进入 ending 阶段，`complete` modal 在结尾段结束后才出现；
   - `opening.building4_reached` 只出现一次；
   - Space/Esc 可以跳过且 modal 正常出现；
   - 在 `complete` 状态重载不会重放整段；
   - 结尾期间移动/交互被锁，HUD 隐藏，letterbox 可见；
   - 关闭 modal 后回到原行为。
5. 浏览器实测：`npm run play` → `?experience=opening`，用 debug hook 或真实路线到达 B4，录 10–15 s 视频；同时保存 3 张截图（letterbox 标题、标题+副标题、交接卡）。
6. 对比开头：截一张开头的 title card 与结尾 title card，字体/letterbox/构图应同一套语言。

## 六、交付

- 修改文件与 diff 摘要。
- 结尾 beat sheet（时间轴）。
- 检查输出、视频/截图。
- 未验证项（尤其是真机连续试玩、不同分辨率）明确列出。
- 不要声称“已有人工试玩通过”，除非真的录了完整一遍。

## 七、需要 owner 确认（不阻塞开工，先按默认）

1. 结尾标题用 `OPENING COMPLETE` 还是 `MISSION COMPLETE`？默认：**OPENING COMPLETE**。
2. 结尾是否允许短暂锁输入？默认：**允许 8–12 s，可跳过**。
3. 交接卡是保留现有弹窗，还是改成全屏 end card？默认：**保留弹窗**，只把进入弹窗前加演出。
