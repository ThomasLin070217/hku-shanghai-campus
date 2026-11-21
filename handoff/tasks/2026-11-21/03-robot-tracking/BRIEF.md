# BRIEF 03 · 机器人追踪（给执行者的事实底稿）

基线：`main @ 41dedea6dda94ac9ac57f9da56d90ca2c551ec4d`，2026-11-21。

## 1. 当前 AI 的精确行为

`src/opening/robot.ts`：

- `ROBOT`（默认值）：
  - `patrolSpeed 1.25`、`chaseSpeed 1.35`、`searchSpeed 1.2`、`turnRate 4.2`
  - `range 9`、`halfAngle 35°`、`confirm 0.7 s`
  - `capture 0.65`、`captureRise 0.9`、`captureGrace 0.25`
  - `searchSeconds 3`、`replan 0.35`、`maxReplans 3`、`stall 1.2`
- `visibleNow()`：距离 → 扇区 → 遮挡 raycast，三步早退。
- `advance()`：
  - `seen` 时累加 `seenTime`，`>= confirm` 后进 `chase`；
  - `chase` 时 `goal = seen ? player : lastSeen`；
  - `!seen` 立刻 `state='search'`；
  - `search` 走到 lastSeen，原地转 3 s，回 patrol。
- `following()`：`planRoute()` 先直线、再图；stall 3 次放弃；`legAbandoned` 时 chase 转 search。

`src/opening/robots.ts`：

- 8 台，`O.robotRoutes` 各 4 个巡逻点；`approach` 是入侵后从入口列队走向巡逻区的物理路线。
- `rangeScale .82`、`angleScale .9`、`confirmScale 1.2`、`speedScale .95`。
- `fleet.update()` 在 `experience.ts` 的固定步长里逐台 `unit.update()`。

## 2. 为什么现在“跟不住”

1. **速度**：1.35 × 0.95 ≈ 1.28 m/s < 玩家 walk 2.6 m/s。玩家正常走就拉开。
2. **记忆只有 3 秒**：丢失后走到 lastSeen 转 3 s 就回巡逻；玩家绕一个角就永久丢失。
3. **图太稀疏**：`graphFor()` 只把该机器人自己的 4 个巡逻点 + approach（4–6 个）+ B5 门 3 个点作为节点。玩家在 B5 走廊、B6 连接或任意草坪位置时，最近的图节点可能在几十米外；`planRoute()` 的 tail 仍是直线，遇到墙就 stall，3 次后放弃。
4. **没有预测**：追逐目标是“上一帧看到的位置”，不是玩家速度外推。
5. **没有听觉**：sprint/开门/撞椅不产生任何 AI 信息。
6. **没有协同**：8 台完全独立；一个看见，其他不知道。
7. **捕获条件**：`capture 0.65 m` + 视线 + `captureGrace 0.25`；即使追上，玩家稍微侧移就可能躲开。

## 3. 可用的工程积木

- `src/exploration/navigation.ts`：
  - `support(x,z,maxStep)` 返回可站立高度或 null；
  - `blocked(x,z,h)`；
  - `meshes` 用于 raycast；
  - `step()`、`bounds`、`surface()`。
- `src/exploration/physics.ts`：`CharacterPhysics`，`step(dt,{forward,right,sprint},yaw,false)`；机器人已用它。
- `src/opening/robot.ts::graphFor()`：已有“真实物理走边”的验证思路，可复用/替换。
- `src/opening/robot.ts::segmentClear()`：沿线段采样 `support/blocked`，可做路径平滑。
- `src/opening/spatialLayout.ts`：`routeB5/routeB6/routeB4` 是已走的整条路线，可作为关键点骨架，但不要只靠它们。

## 4. 建议的实现顺序

1. **先做共享图**：`OpeningNavGraph`，覆盖 B4/B5/B6 开场区域；构建一次，缓存；提供 `nearestNode`、`path(from,to)`、`smooth(path)`。
2. **接 A***：二叉堆；节点数 < 2k 时足够快；只在 chase/search 单位上每 4–8 Hz 重规划。
3. **改 chase**：seen → 实时位置 + 0.6 s 速度预测；lost → lastSeen + 搜索点。
4. **改 search**：8–12 s，2–4 个围绕 lastSeen 的可达点，不原地转。
5. **加听觉**：`experience.ts` 在 sprint/开门/撞椅时调用 `fleet.hear(position, radius, strength)`；内部只更新 lastSeen/调查点。
6. **调速度**：2.4–2.8，保留 sprint 5.2 的逃脱窗口；用 3 次试玩记录。
7. **可选协同**：`fleet` 内共享 lastSeen，12–15 m 内、有视线才共享。
8. **性能**：A* 次数/帧时间打点；不要每帧 new Vector3/数组。

## 4.5 改参数会撞到的现有断言（必须同步改，不要静默删）

`scripts/check-opening-robot.ts` 末尾有两条和“追踪”直接冲突的断言：

```ts
assert.ok(ROBOT.patrolSpeed<2.6 && ROBOT.chaseSpeed<2.6 && ROBOT.searchSpeed<2.6,
  `the robot stays slower than the 2.6 m/s player walk (${...})`);
assert.equal(ROBOT.searchSeconds,3,'search lasts about three seconds');
```

以及第 4 组测试断言“丢失视线后约 3 s 回巡逻”。本任务会把 chase 速度提到 2.4–2.8、搜索延长到 8–12 s，因此这些断言**必须显式更新**，并在交付里说明“这是有意的设计变更”，而不是为了过测试删掉。`check-opening-fleet` 的连续位移/无入墙断言仍必须保留。

## 5. 测试思路（确定性）

- 用 `createOpeningRobot` + 真实 `Navigation` 在 Node 里跑固定 dt：
  - 玩家沿 B5 南侧走到东侧，机器人从西侧追，检查 `diagnostics.route` 是否绕过转角、`contacts` 是否有 wall、位置是否始终在 `support` 上；
  - 玩家在墙后静止，检查机器人到 lastSeen 后 search ≥ 8 s，且 `goal` 不是玩家实时位置；
  - 玩家 sprint 离开，检查 15 m 后回 patrol；
  - 8 台同时追逐 10 s，检查无穿墙/无瞬移（沿用 fleet 的连续位移断言）。
- 现有 `check-opening-robot.ts` 13 项、`check-opening-fleet.ts` 8 项不能静默删；新增断言可以追加。

## 6. 已知的性能事实

- 8 台 × 每台 12 个盒体 + 扫描扇区；约 104 个绘制对象、56 个材质、96 个投影体、8 个常开点光。
- 扫描扇区 `visualHz=8`，每次 11 条射线；8 台约 704 次/秒。
- 固定步长 1/120；FSM 每台每步跑。
- 共享图/A* 的构建应放在世界创建时，不要放在每帧/每台。

## 7. 边界

- 机器人仍然不是战斗单位：不攻击、不掉落、不血条。
- 不允许写坐标/瞬移；全部走 `CharacterPhysics`。
- 不允许隔墙读取玩家实时位置；协同也必须经过“看见/听见”的证据。
- 不改 `/act`，不新增远端接口，不改任务/存档。
- 不改 UI；HUD 的 `robotState/warning` 语义保持（可以增加状态，但要更新 `ui.ts` 文案映射）。
