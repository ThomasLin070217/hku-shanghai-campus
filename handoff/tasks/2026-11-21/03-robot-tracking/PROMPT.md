# 任务 03 · 安保机器人追踪算法（能真正跟住玩家）

你是本项目的独立 AI/玩法实现 Agent。仓库是私有的 HKU Shanghai Campus（Vite + TypeScript + Three.js，固定步长物理），基线 `main @ 41dedea`。先读 `AGENTS.md`、`docs/AI-START.md`、`docs/opening/NOV19-CORRECTIONS-TODO.md` 的 T24–T30，再读随包 `BRIEF.md`。直接改代码、跑检查、写回归，不要只回复方案。

## 一、要解决的问题

玩家反馈：机器人“追不上/不会追”。当前 8 台安保机器人的契约是**只向可见位置或 lastSeen 移动**，一旦失去视线，走到最后目击点、原地转 3 秒就回巡逻。它们没有听觉、没有预测、没有跨区域的寻路图；而且 `chaseSpeed=1.35 m/s` 低于玩家步行 `2.6 m/s`，正常走路就能甩掉。这不是“难度低”，是**追踪行为本身不成立**。

请把开场 8 台安保机器人改成会**持续追踪角色**的追捕单位：看见时沿可行走路径追实时位置/预测位置，丢失后根据最后目击、听觉和搜索行为继续找，能绕过 B5 转角/门洞/走廊，但**仍然公平、可躲、可跑掉**，且不穿墙、不瞬移、不读全图。

## 二、已核对的现状（2026-11-21）

- `src/opening/robot.ts`
  - 状态机：`patrol → scanning → chase → search → caught`。
  - 感知：`range=9 m`、`halfAngle=35°`、`confirm=0.7 s`、遮挡 raycast；只对 `world.meshes` 做线测。
  - `chase` 分支：`goalX = seen ? player.x : lastSeen.x`，用 `following()` 走；丢失立刻 `state='search'`。
  - `search`：走到 lastSeen，原地转 `searchSeconds=3 s`，然后回巡逻。
  - `ROBOT` 参数：`patrolSpeed=1.25`、`chaseSpeed=1.35`、`searchSpeed=1.2`、`turnRate=4.2`、`capture=0.65`、`captureGrace=0.25`。
  - 玩家：`C.speed=2.6`（walk）、`C.sprintSpeed=5.2`（sprint），见 `src/exploration/config.ts`。
  - 寻路：`graphFor()` 只为**每台机器人自己的 patrol route + approach + B5 门节点**建图；`shortestNodes()` 是 Dijkstra；`planRoute()` 先试直线，失败才用图；图节点通常只有 8–12 个，玩家在任意位置时最近节点可能很远，tail 仍是直线，容易 stall → 放弃。
  - 没有共享黑板；8 台完全独立。
- `src/opening/robots.ts`：8 台 `createOpeningRobot`，`rangeScale=.82`、`angleScale=.9`、`confirmScale=1.2`、`speedScale=.95`，每台 `visualHz=8`。
- `src/opening/experience.ts`：`fleet.update(dt, playerPos, active, paused)` 在固定步长里跑；`catchPlayer()` 扣 2 心并回检查点；`respawnGrace` 期间机器人暂停。
- 已有检查：`scripts/check-opening-robot.ts`（13 项）、`scripts/check-opening-fleet.ts`（8 台路线/阻塞/分布）、`check-opening-integration.ts`。
- 性能事实：8 台在 1/120 步长全量跑 FSM；扫描扇区 8 Hz × 11 射线；每台独立材质/几何；96 个投影体、8 个常开点光（见 `NOV19-CORRECTIONS-TODO.md` T24–T30）。

## 三、必须实现

### A. 共享的可行走寻路层（核心）

- 在开场区域（至少覆盖 B4 前庭、B5 内外、B5–B6 连接、B6 入口）建一张**共享**的导航图/网格，而不是每台机器人只用自己的 4 个巡逻点。
- 节点必须由 `Navigation` 的真实可走面推导：`world.support(x,z,maxStep)` 有值、`world.blocked(x,z,h)` 为假、台阶高差在 `C.maxStep/maxDrop` 内；边要做真实几何/物理验证（可复用 `CharacterPhysics` 走边，或 `segmentClear` + 采样），缓存到 `WeakMap<Navigation, ...>`，按世界 revision 失效。
- 图的大小与构建时间要可接受；建议 0.8–1.0 m 网格 + 8 邻接 + 路径平滑，或“巡逻点 + 门口/转角/走廊关键点 + 局部网格”的混合图。不要每帧重建。
- A*（二叉堆）优先于现在的线性 Dijkstra；追逐单位按 4–8 Hz 重规划即可，路径跟随仍走 1/120 物理。
- 目标点不可达时要有明确的降级（找最近可达点 + 搜索），不能原地 stall 后直接放弃。

### B. 追踪行为

1. **看见时**：目标 = 玩家实时位置 + 0.5–0.8 s 的速度预测（玩家速度从位置差分得到，限幅），沿路径追；不要穿墙，不要隔墙读实时位置。
2. **丢失时**：目标 = 最后目击点 + 预测出口；继续走到该点，然后做 8–12 s 的扩展搜索（围绕 lastSeen 的 2–4 个可达点，而不是原地转 3 秒）；搜索失败才回巡逻。
3. **听觉**：玩家 sprint 脚步、开门、撞倒椅子等事件产生“声源”；在 10–14 m 内、隔墙也允许把最后已知位置更新到声源附近（带误差/延迟），但**不能**因此获得实时位置。`robots.ts` 或 `experience.ts` 提供事件，不要直接读玩家坐标。
4. **协同（可选但建议）**：加一个共享黑板，只在 12–15 m 内、有视线/无线范围的单位之间共享 lastSeen；禁止“一个人看见，全队立刻知道精确坐标”。若时间不够，先不做协同，但要在交付里说明。
5. **逃逸公平性**：`chaseSpeed` 建议 2.2–3.0 m/s（高于 walk 2.6 或接近），低于 sprint 5.2；玩家 sprint / 关门 / 绕角仍能甩掉。具体值用 3 次人工试玩记录决定。不要做成“永远追到底”。
6. **捕获**：保留现有 `capture`/`captureGrace`/视线检测；抓捕只扣心/回检查点，不做战斗、不做伤害。

### C. 性能与边界

- 只有 `chase`/`search` 单位做重规划；`patrol` 单位不需要跑 A*。
- 共享图/共享堆/临时数组要复用，避免每帧分配；8 台同时追逐时不能掉帧。
- 继续使用 `CharacterPhysics` + `Navigation`；不得写坐标、瞬移、穿墙、读全图。
- 不改 `/act` 协议；不增加远端接口；不改任务/存档字段。
- 保留 13 项 single-robot 检查和 8 台 fleet 检查的语义（可以扩展，不可静默删断言）。注意 `check-opening-robot.ts` 现在明确断言 `chaseSpeed < 2.6`、`searchSeconds === 3` 和“约 3 s 回巡逻”；本任务会**有意**改变这些设计值，必须同步更新断言并在交付里说明，不要为了过测试偷偷删掉。

## 四、文件边界

**可改：**
- `src/opening/robot.ts`
- `src/opening/robots.ts`
- 新增 `src/opening/navGraph.ts`（或同等模块）
- `src/opening/experience.ts`（只接听觉事件/共享黑板，不碰剧情状态机）
- `scripts/check-opening-robot.ts`、`check-opening-fleet.ts`：只追加断言
- 新增 `scripts/check-opening-tracking.ts`，注册到 `check:opening`

**只读参考：**
- `src/exploration/navigation.ts`、`physics.ts`、`config.ts`
- `src/opening/spatialLayout.ts`（巡逻路线/坐标）
- `docs/opening/NOV19-CORRECTIONS-TODO.md`

**不要动：** UI、音频、MacBook、其他成员关卡、`state.ts`/`persistence.ts`、场景坐标。

## 五、验收（必须实际执行）

1. `npm run check:opening`
2. `npm run check:all`
3. 新增 `check-opening-tracking.ts`，至少覆盖：
   - 玩家从 B5 门口绕到墙角另一侧，机器人能绕过转角继续追（不是撞墙/原地）；
   - 玩家完全躲到墙后 2 s，机器人走向 lastSeen，搜索 ≥ 8 s，且不隔墙转向实时位置；
   - 玩家 sprint 离开 15 m 后能脱离，机器人回巡逻；
   - 8 台同时追逐 10 s，无穿墙、无瞬移、无离开可走面（沿用 fleet 断言）；
   - 抓捕仍只扣 2 心/回检查点。
4. 实际浏览器：`?experience=opening`，入侵后从 B5 门口绕 B5/B6 跑一圈，录 30–60 s；记录 3 次逃脱/被抓结果。
5. 性能：记录 0 台 / 8 台巡逻 / 8 台追逐的帧时间与 A* 调用次数；不要只写“应该更快”。

## 六、交付

- 修改文件、算法说明（图规模、A* 频率、参数）、diff 摘要。
- 新检查输出；浏览器录屏/截图。
- 3 次人工试玩的逃脱/被抓记录；未验证项明确写。
- 如果做了协同，给出“无隔墙先知”的反例测试；如果没做，说明原因。

## 七、需要 owner 确认（不阻塞开工，先按默认）

1. 机器人是否应该能追上**步行**玩家？默认：**能**（chase 2.4–2.8），但 sprint 能跑掉。
2. 是否要共享感知（T28）？默认：**先做单人可靠追踪，协同作为可选第二步**。
3. 是否允许“听觉隔墙更新 lastSeen”？默认：**允许，但只更新到声源附近，不给实时坐标**。
