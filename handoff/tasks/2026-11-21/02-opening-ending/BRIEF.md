# BRIEF 02 · 开场结尾（给执行者的事实底稿）

基线：`main @ 41dedea6dda94ac9ac57f9da56d90ca2c551ec4d`，2026-11-21。

## 1. 现在的结尾是什么样的

`experience.ts`：

```ts
function arriveB4(){ if(story.stage==='to_b4'){ transition('reach_b4'); open('complete'); } }
```

`open('complete')`：

```ts
modal='complete';
explorer.openPanel('computer', false);
audio.setActive(false);
audio.stopOpeningCues();
```

`ui.ts::completeDialog()`：标题 `Building 4 reached`、一段正文、三行 facts（MacBook / Handoff point / Progress）、`Close` + 两个关卡入口。没有 letterbox、镜头、stinger。

实测（Chrome headless，1440×900）：

- 到达 complete 后 `.opening-cinema` 仍然可见，文本停在上一句 Staff 台词（见本包 `evidence/ending-complete-20261121.png` 底部）；
- modal 立即出现，背景 blur；
- `StoryAudio` 的 `music` 切到 `hope`（因为 `frame.stage==='complete'`），但没有专门的完成提示音。

## 2. 可复用的现有机制

| 机制 | 位置 | 用途 |
| --- | --- | --- |
| `showTitle(title, subtitle, seconds)` | `experience.ts` | 设置 title 卡；每帧衰减 |
| `showSubtitle(text, seconds)` | `experience.ts` | 设置字幕 |
| `OpeningCinema` | `contracts.ts` | `mode: off/wake/title/subtitle`, `letterbox`, `opacity`, `title`, `subtitle`, `hint` |
| `updateCinema()` | `ui.ts` | 把 cinema 写到 `.opening-cinema`，控制 letterbox |
| `.opening-cinema-*` | `opening.css` | 黑场、上下 bar、标题/字幕/提示样式 |
| `showTitle` 的 title 分支 | `experience.ts` 每帧 | `titleSeconds>0` 时 HUD 隐藏、letterbox |
| `open('complete')` | `experience.ts` | 打开交接卡 + 暂停音频 |

开头的实际节拍见 `docs/opening/COD-INTRO-PASS.md`：wake → location card → physical invitation → title/subtitle → staff walk-and-talk。

## 3. 结尾需要修的具体问题

1. 硬切：`transition` 与 `open` 同帧，没有演出。
2. 字幕残留：`staffTalkStarted/staffTalkDone` 与 `subtitleSeconds` 没有在 complete 清掉。
3. HUD 未隐藏：`open()` 只是暂停/弹窗，HUD 仍在。
4. 没有镜头/标题/letterbox 的完整组合。
5. 没有完成 stinger（只有 music 切 hope）。
6. 跳过/重放语义未定义：现在 modal 一出现就能 Esc；如果加了演出，需要定义 `Space/Esc` 跳过。
7. 读档：`restore()` 在 `stage==='complete'` 时直接 `open('complete')`，加入结尾后要避免重放或只放一次轻量 card。

## 4. 建议的 beat sheet（可调整）

| 时间 | 画面 | 声音 | 实现 |
| --- | --- | --- | --- |
| 0.0 s | 到达 B4；输入锁定；HUD 淡出；letterbox 进入 | 环境声继续；music 走向 hope | `cinema.mode='ending'` 或 `showTitle` |
| 0.0–1.8 s | 镜头稳定/轻微推近，朝 B4 入口 | 低频收束 | 相机由 `explorer.camera` 当前姿态插值，不传送 |
| 1.8 s | 标题 `BUILDING 4`，副标题 `OPENING COMPLETE` | 完成 stinger | `showTitle` |
| 2.2 s | 第二行：MacBook 在背包 / 下一章从 B4 内部继续 | music 抬起 | `showSubtitle` |
| 5.5 s | 显示 `Press Space to continue` | — | `cinema.hint` |
| 8–12 s | 自然结束或跳过 → `open('complete')` | 交接卡出现时 duck/降低 | `open()` |
| 关闭 | 回到可控/结束态 | 恢复 | 现有 `close()` |

## 5. 验收脚本建议

新增 `scripts/check-opening-ending.ts`，用 `createOpeningExperience` 的 debug hooks：

```ts
debug.arriveB4() // 前置 stage 必须是 to_b4
// 断言：ending phase !== complete modal
// 快进 2 s / 8 s，断言 modal 出现
// 断言 events 中 opening.building4_reached 只出现一次
// 断言 Space 跳过
```

注意 `check:opening` 目前 13 项 robot + 8 项 fleet + state/persistence/runtime/atmosphere/world/integration；新检查不要破坏它们。

## 6. 证据

- `evidence/thomas-opening-round2/15-complete.png`（当前弹窗）
- `evidence/thomas-opening-round2/00-wake-up.png`（开头 title card）
- `evidence/thomas-opening-round2/opening-beat-reel.webm`
- `docs/opening/COD-INTRO-PASS.md`（开头 beat sheet）

## 7. 边界

- 不改 `opening.building4_reached` 的名字/载荷。
- 不触发 Building 4 内部谜题、不写章节完成事件。
- 不传送玩家；不用改坐标绕过 `reach_b4`。
- 不覆盖 `complete` 里的两个关卡入口。
- 不在结尾引入新的网络/LLM 依赖。
