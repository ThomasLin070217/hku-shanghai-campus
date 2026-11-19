# Thomas 开场 · 四路 Agent 交付汇总

> 汇总日期：2026-11-19 · 分支 `codex/thomas-opening` · 提交 `d62c299`
> 任务书：[agent-manual/00-START-HERE.md](agent-manual/00-START-HERE.md)；交接说明：[HANDOFF.md](HANDOFF.md)

本文件把 A / B / C / D 四路外部 Agent 的交付、集成结果与验证证据汇总在一起；
此前只有 `HANDOFF.md`（目标行为）和各自的 evidence README，没有统一的对照表。

## 一、总览

| Agent | 范围 | 交付文件 | 验证 | 状态 |
| --- | --- | --- | --- | --- |
| A | 剧情状态与存档 | `src/opening/state.ts`、`persistence.ts`、`scripts/check-opening-state.ts` | **PASS 20 组** | 完成 |
| B | 巴士与局部场景布景 | `src/opening/world.ts`、`scripts/check-opening-world.ts` | **PASS 7 组** | 完成 |
| C | 红眼扫描 / 短追逐机器人 | `src/opening/robot.ts`、`scripts/check-opening-robot.ts` | **PASS 13 项** | 完成 |
| D | 英文开场 UI 与内容 | `src/opening/ui.ts`、`opening.css`、`content/opening/en.ts` | mock harness + 真页面 | 完成 |
| 集成 | 入口、导航、交互路由、世界接线 | `main.ts`、`opening/experience.ts`、`buildSite.ts`、`spatialLayout.ts` 等 | **PASS 7 项**，4 处 ID 迁移 | 完成 |

整体命令结果：`npm run typecheck` = 0；`npm run check:opening`（state + robot + world + integration）= 0；
`npm run check:all`（含 build）= 0。

## 二、Agent A — 剧情状态与存档

**交付**：`src/opening/state.ts`（98 行）、`src/opening/persistence.ts`（109 行）、`scripts/check-opening-state.ts`（373 行）

- 纯函数 reducer：七拍严格顺序（`read_invitation` → `reach_b4`），非法/越级/重复事件返回**同一对象引用**，不改原 `events`/`flags`。
- 规范事件日志固定七项，止于 `opening.building4_reached`，绝不发 `chapter_01_completed` 等后续关卡事件。
- 严格校验：stage 与累积 flags 必须精确匹配；事件必须是指定前缀（唯一、有序）；NaN / Infinity / 负时间拒绝。
- 存档独立命名空间 `hku.opening.v1` / `mode:'opening'`：取电脑前空背包合法；`laptop_acquired` 时必须**恰好一台** MacBook；只认 `ITEMS` 自有键（挡 `ITEMS['toString']` 原型污染）；`worldRevision` 不匹配时保留故事与物品、不静默重写 revision，由调用方安全落点。
- `captureOpeningSave` 全量 clone，不修改游戏/故事/设置；只丢弃已记录的种子电脑。

**验证**：`tsx scripts/check-opening-state.ts` → PASS 20 组（完整顺序、乱序、幂等、坏档、坏设置、往返一致等）。

## 三、Agent B — 巴士与局部场景布景

**交付**：`src/opening/world.ts`（347 行）、`scripts/check-opening-world.ts`（217 行）

接口（与任务书一致，调用方已接线）：

```ts
createOpeningWorld(): {
  root: THREE.Group;
  update(state: { incident: boolean; laptopAcquired: boolean; doorOpen: boolean }, dt: number): void;
  dispose(): void;
}
```

### 3.1 校园巴士

- 车体中心/尺寸/地板高度全部读 `OPENING.bus`：车内地板顶面 = 0.54 m，与角色承托同高。
- 壳体分色：绿色下半 + 暖白上半；东 / 前 / 后墙各带窗带（玻璃用 `glassMaterial('clear')`）与竖框；西墙**围绕门洞切开**（z 31.9–33.3），不遮挡下车通道。
- 车外三级过渡台阶 0.54 → 0.36 → 0.18 → 地面，位置与 `opening/navigation.ts` 一致（check 断言到 1e-6）。
- 后排座椅只在 z > 34.9，避开门口通道；扶手在门洞两侧。
- 东侧车身「HKU SHUTTLE」用既有 `campusFont` + `TextGeometry`，无 DOM 依赖。
- 门叶铰接在北侧门边，向内折 1.75 rad，`DOOR_SECONDS=0.55`；`dt=0`（暂停帧）不推进动画。

### 3.2 Building 5 一楼晚宴区

- 房间范围读 `OPENING.b5`，地板顶面 = 0，与承托一致。
- 低矮玄关隔断（x≈60.1）让「进门右转」可读；北墙自助餐台；两条发光灯带。
- 4 张餐桌：桌布 / 桌旗 / 餐盘 / 杯子 / 烛台 / 每桌 4 把椅子 + 边角花箱。
- **正常 ↔ 异常两态**：3 把「站立椅子」通过 transform 切换为倒地姿态，3 件遗落物从餐台移动到地面，灯带亮度降到 0.12 —— 几何体不变，只改变换，导出 GLB 两种状态同构。
- 家具全部避开 `routeB5` / `routeB6` / `routeB4`（check 逐条验证）。

### 3.3 Building 6 取电脑空间

- 房间地面顶面 = 5.1 m（技术估算入口），天花板灯带、北墙矮柜、角落绿植。
- 演示桌在 `OPENING.laptop`，世界电脑用现有 `createMacBook()`，`laptopAcquired` 后**只隐藏显示**，不发放物品、不写 flags。
- 明确保留证据边界：5.1 m 技术入口 ≠ 现有约 9 m 的上部玻璃门。

### 3.4 元数据与资源

- 每个节点 `authorKey` / `sourceFile` / `source` / `confidence`（技术估算，非实测室内）。
- 构造全程 DOM-free，同一模块可用于浏览器、Node 几何检查与 GLB 导出。
- `dispose()` 只释放自己创建的 geometry / material，不碰共享 MacBook / NPC / 校园资源。

**验证**：`tsx scripts/check-opening-world.ts` → PASS 7 组

| 检查组 | 断言要点 |
| --- | --- |
| 1 世界构建 | 280 个网格、包围盒全部有限、落在校园范围内 |
| 2 巴士对位 | 地板顶面 .54、车宽/车长与 `OPENING.bus` 一致、台阶 0.18/0.36 与导航同源 |
| 3 车门 | 门叶在西面 x=63.5、只在时间推进时旋转、不挡出口 |
| 4 世界电脑 | 显示 → 隐藏 → 恢复跟随 `laptopAcquired` |
| 5 晚宴两态 | incident 往返切换、两种状态地板高度一致 |
| 6 家具不挡路 | 桌/柜/桌台不侵入三条步行路线 |
| 7 释放 | dispose 摘除 root 并释放资源 |

## 四、Agent C — 红眼扫描 / 短追逐机器人

**交付**：`src/opening/robot.ts`（599 行）、`scripts/check-opening-robot.ts`（434 行）

- 状态机 `patrol → scanning → chase → search → caught`；发现 = 距离 9 m + 半角 35° + 眼到上身射线；确认 0.7 s 才进追逐（**发现不等于失败**）；捕获需 ≤0.65 m 且高差 ≤0.9 m，并要求同一墙体视线测试通过。
- 移动全部走共享 `CharacterPhysics.step`；B5 环形巡逻每条边先用真实物理走通才入图（`verifiedEdges` / `rejectedEdges` 可在 evidence 中查），经门洞 x≈58 进出，13200 帧巡逻零顶墙。
- 丢失视线后只走向 `lastSeen`，搜索 3 s 后回巡，不暗中追踪墙后玩家。
- `paused` / `dt=0` / `active=false` 全程只读冻结；扫描楔形每帧用射线裁剪到遮挡物，不会穿墙误导。
- `dispose()` 释放 13 个几何、7 个材质。

**验证**：`tsx scripts/check-opening-robot.ts` → PASS 13 项（含视锥/遮挡、确认进追逐、捕获与高度、搜索回巡、暂停只读、门洞巡逻、资源释放）。

## 五、Agent D — 英文开场 UI 与内容

**交付**：`src/opening/ui.ts`（598 行）、`src/opening/opening.css`（965 行）、`content/opening/en.ts`（146 行）

- HUD（objective + 可折叠 detail + 小地图卡 + 机器人 warning）、7 种模态（invitation / staff / alert / computer / caught / complete / settings）全部对接 `contracts.ts`，只提交意图。
- 焦点陷阱、Esc/C 关闭、caught 只能 Retry、内联 restart 确认、滑块拖动不重建模态、地图节流 5 Hz、`aria-*` 完整。
- CSS 只作用 `.opening-*`（唯一非前缀规则是 `body:not(.exploring) .opening-*` 的隐藏守卫），不与既有 shell 冲突。
- 文案核对：Building 5 · Ground Floor / Turn right after entering / 2030；四条警报；MacBook 在 Building 6；不提前知道袭击。

**验证**：`evidence/opening-ui/README.md`（mock harness 12 个场景 + 真页面 1440×900 走查；修复 robot state `scan` → `scanning` 回归、威胁条 `aria-hidden`）。

## 六、集成与端到端

- 入口：`?experience=survey` 保留原巡检；默认进入开场，标题 `HKU Shanghai · High Table`。
- 交互：人类与 AI 共用 `CampusGame.interact/computer`，沿用 `/act` 字段；模态复用既有 pause/epoch 门禁。
- 完成：`opening.building4_reached` 浏览器事件 + 存档 + 只读观察三路一致；不发后续关卡事件。
- 存档：`hku.opening.v1` 与 `hku.digital-survey.v1` 互不覆盖；重启前先备份。
- 场景：开场专用道具标 `dynamicGameplay`，不进入静态编号 revision；`npm run scene:opening` 生成独立目录与 ID 迁移表（4 处显式迁移）。
- 实跑记录：
  - 第一轮（AI 通过 `/act` 驱动）：邀请函 → 巴士 → B5 晚宴 → B6 取电脑 → 返回遇袭 → 红屏警报 → B4 交接，截图见 [evidence/opening-review](../../evidence/opening-review/)；B 的巴士实景见 `agent-b-bus-interior.png`，晚宴区见 `demo-07-staff.png`。
  - 验收轮（真实键鼠输入，含被抓）：完整记录在 [playthrough-record.json](../../evidence/opening-implementation/playthrough-record.json)，八个节拍全部 pass，**包含 `caught_and_retry`**：机器人追上 → 「Caught by campus security」只给 Retry → Retry 回到 encounterSafe（58, -53.8）、保留 MacBook 与全部事件。

## 七、遗留与边界

- `caught` → `Retry` 已在真页面验收轮触发并通过（见 playthrough-record.json）；但该轮最后一段由 controller 的 QA 落点钩子 `explorer.inspectAt` 起步（机器人把玩家顶进了死角），最后一段本身仍是真实物理行走。
- 验收轮使用 5199 端口（5184 当时被无关 broker 占用），与非验收轮环境不同。
- 房间/巴士尺寸是技术估算，不写「实景还原」；B06 5.1 m 入口不等于上部约 9 m 玻璃门。
- 家具只做视觉摆放，未添加硬碰撞；路线空隙由 check 断言。
- 场景编号不变式：细部 ID 仍由 `authorKey` 派生，未按数组下标或 UUID 重新编号。
