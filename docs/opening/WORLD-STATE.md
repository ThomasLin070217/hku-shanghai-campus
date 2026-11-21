# 世界状态：校园天幕 / BARRIER

天幕（AI 屏障）不是开场章节的装饰，而是**跨章节持久的世界状态**。开场、狮子战以及后续的控制室章节共享同一份记录。

## 存储

`localStorage["hku.world.v1"]`，由 `src/gameplay/worldThreat.ts` 独占读写。

```ts
interface WorldThreat {
  schemaVersion: 1;
  phase: 'clear' | 'sealed' | 'purged';
  sealedAt: number | null;
  purgedAt: number | null;
  flags: {
    lionDefeated: boolean;
    powerCut: boolean;
    localModelCleared: boolean;
  };
}
```

状态机：

```
clear ──sealWorld()──▶ sealed ──tryPurgeWorld()（三 flag 全 true）──▶ purged
  ▲                                                                   │
  └──────────────── resetWorldThreat()（新游戏 / 重玩）───────────────┘
```

规则：

- `sealWorld()` 只允许 `clear → sealed`；`sealed` 保持；`purged` 直接忽略。
- `markLionDefeated()` / `markPowerCut()` / `markLocalModelCleared()` 只做 OR 写入。
- `tryPurgeWorld()` 只在 `phase === 'sealed'` 且三个 flag 全 true 时迁移到 `purged`。
- `purged` 是终态。旧开场存档里的 `runtime.curtain_deployed=true` 不会重新封印；只有 `resetWorldThreat()` 会写回 `clear`。
- 刷新、关卡切换、重新进入开场都不会清空 `sealed`。

## 迁移

第一次运行且没有 `hku.world.v1` 时，读取旧 `hku.opening.v1`：

- `runtime.curtain_deployed === true` → `sealed`，`sealedAt` 沿用旧存档的 `savedAt`；
- 否则 → `clear`。

`hku.world.v1` 存在但解析失败时，先备份成 `hku.world.v1.unreadable.<timestamp>`，再按旧存档迁移，不静默丢失封印。

## 各入口

- 开场：`beginIncident()` 调 `sealWorld()`；启动时按 `loadWorldThreat()` 决定 `atmosphere.restoreSealed()`；`restart()` 调 `resetWorldThreat()`。
- 狮子战：创建同一个 `OpeningAtmosphere`；`restoreSealed()` 读回已封印天幕；`repaired === 3` 只调 `markLionDefeated()`，不解除。
- 后续控制室：断电步骤调 `markPowerCut()`，清本地 LM 调 `markLocalModelCleared()`；每次写入后调 `tryPurgeWorld()`，成功则 `atmosphere.release()`。

## 调试入口（仅 DEV / review）

开场：

```js
__CAMPUS.worldThreat()
__CAMPUS.openingDebug.sealWorld()
__CAMPUS.openingDebug.markLionDefeated()
__CAMPUS.openingDebug.markPowerCut()
__CAMPUS.openingDebug.markLocalModelCleared()
__CAMPUS.openingDebug.purgeWorld()
__CAMPUS.openingDebug.resetWorld()
__CAMPUS.openingDebug.tickAtmosphere(6)
```

狮子战：

```js
__LION_BOSS.worldThreat()
__LION_BOSS.atmosphere()
__LION_BOSS.markLionDefeated()
__LION_BOSS.markPowerCut()
__LION_BOSS.markLocalModelCleared()
__LION_BOSS.purgeWorld()
__LION_BOSS.resetWorld()
__LION_BOSS.tick(6)
```

## 测试

```sh
npm run check:opening   # 包含 scripts/check-world-threat.ts
npm run check:lion-boss
npm run typecheck
```

浏览器验收记录见 [evidence/world-threat-20261121](../../evidence/world-threat-20261121/README.md)。

注意：无头 SwiftShader 下狮子页帧率很低，天幕退场按 `dt` 播放，需要 `tick()` 或更长的等待；真实浏览器 5.2 秒完成。
