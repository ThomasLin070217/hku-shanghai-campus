# 天幕跨章节状态：验收记录

日期：2026-11-21

## 目标

把“天幕”从开场章节的 `curtain_deployed` flag，升级为共享、持久、可解除的世界状态。

- 开场封印后，刷新页面仍然黑暗，且天幕是**已经合拢**的状态（不重播下降）。
- 进入 `?experience=lion-boss` 后，草坪仍然是同一片黑暗天幕。
- 狮子安全关机只写入 `lionDefeated`，**不解除**。
- 只有 `lionDefeated + powerCut + localModelCleared` 全为 true，才允许 `purged`：天幕上升、恢复白天。
- `purged` 终态：旧存档不能把天幕重新拉起来；只有“重新开始/重玩”写入 clear。

## 状态机

```
clear ──sealWorld()──▶ sealed ──三条件全满足──▶ purged
  ▲                                                │
  └──────────── resetWorldThreat()（重开/重玩）────┘
```

持久位置：`localStorage["hku.world.v1"]`。

从旧存档迁移：若没有 `hku.world.v1`，读取 `hku.opening.v1` 的 `runtime.curtain_deployed`；为 true 时按原 `savedAt` 迁移成 `sealed`。

## 浏览器验收步骤

用 `http://127.0.0.1:5199` 的 Vite dev server 和无头 Chrome（SwiftShader）执行：

1. 走完开场 debug 流程到 `complete`（邀请函 → 下车 → 接任务 → 拿 MacBook → 封印 → 回 5 号楼 → 读警报 → 到 4 号楼）。
2. 确认 `hku.world.v1.phase === "sealed"`，开场存档为 `complete`。
3. 刷新开场：确认天幕 `phase:night`、`curtainProgress:1`、`curtainVisible:true`，且 `releasing:false`。
4. 打开 `?experience=lion-boss`：确认 `__LION_BOSS.worldThreat().phase === "sealed"`，`atmosphere().sealed === true`，`progress === 1`。
5. 调用 `markLionDefeated()`：确认 flag 写入，phase 仍 sealed，进度仍 1。
6. 调用 `markPowerCut()`：仍 sealed。
7. 调用 `markLocalModelCleared()` + `purgeWorld()`：返回 true，`hku.world.v1.phase === "purged"`；天幕开始从 1 向 0 退场。
8. 等退场完成：`atmosphere().phase === "day"`、`progress === 0`。
9. 重新打开开场：`world.phase === "purged"`，天幕 `progress === 0`，不会重新封印。

## 截图

- `01-opening-reloaded-sealed.png`：开场刷新后仍处于封印章节（画面整体黑暗）。
- `02-lion-sealed.png`：狮子战页面沿用同一片黑暗天幕，笼状网格在建筑后方。
- `03-lion-purge-mid.png`：三条件满足后，天幕正在上升的中间帧。
- `04-lion-day.png`：同一机位，天幕解除后的白天。
- `05-opening-purged-day.png`：`purged` 后重新打开开场，保持白天。

## 结果

无页面异常（`errors: []`）。完整 JSON 见 `result.json`。

## 代码与测试

- `src/gameplay/worldThreat.ts`：状态机、迁移、单写入口、损坏记录备份。
- `src/opening/atmosphere.ts`：`restoreSealed()` / `release()`，以及 `releasing` 状态。
- `src/opening/experience.ts`：开场接入、`beginIncident` 落盘、刷新恢复、`restart` 清除。
- `src/lionBoss/play.ts`：狮子战接入、`repaired === 3` → `markLionDefeated()`、按需渲染时继续跑天幕动画。
- `scripts/check-world-threat.ts`：状态机与迁移的无头测试。
- `scripts/check-opening-atmosphere.ts`：半球、瞬时恢复、解除动画与暂停冻结。
- `npm run check:opening` 已包含 `check-world-threat`。
