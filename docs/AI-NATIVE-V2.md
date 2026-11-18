# AI-Native v2：不读屏幕也能玩的原生接口

> 结论先说：**这个游戏不需要 computer use。** AI 看到的是引擎序列化出来的结构化状态，不是像素；它下发的是语义动作（走到哪、看哪、交互什么），不是键鼠事件。截图仍然可以要，但它只是人工核对用的可选项，不在控制回路里。

本文对应协议版本 `hku-campus/2.0`，向后兼容 v1.3。实现代码在 `src/agent/`、`src/exploration/`、`scripts/agent-*.mjs`；接口契约在 [AI-NATIVE-V2-CONTRACT](../plans/AI-NATIVE-V2-CONTRACT.md)，市场对照见 [AI-NATIVE-GAME-INTERFACES](../research/AI-NATIVE-GAME-INTERFACES.md)。

## 1. 为什么不是 computer use

| 维度 | 截图像素 + 模拟键鼠（computer use） | 本项目原生接口 |
|---|---|---|
| AI 读到什么 | 渲染后的 2D 画面，需要自己做目标检测/OCR | `observe` 的结构化状态 + `perception` + 事件流 |
| 每步延迟 | 截图编码 + 网络 + 模型识图，通常数百 ms 到数秒 | 本机 HTTP/WS，观察 1–5 ms，动作入队即返回 |
| 精度 | 取决于分辨率、遮挡、光照、UI 缩放 | 米制坐标、稳定实体 ID、物理真值 |
| 可复现 | 画面抖动、字体渲染差异都会改结果 | frame/seq 可对齐，命令 ID 可去重，结果可查询 |
| 失败模式 | 点错、看不清、超时、窗口失焦 | 明确的 `stale_epoch` / `no_control` / `blocked` |
| 权限 | 等同于接管整台电脑 | 只暴露游戏动作，用户在页面显式开启，随时可接管 |

所以"AI native"的关键不是让模型看得更清楚，而是**让引擎愿意把状态说清楚**：结构化观察、稳定 ID、语义动作、实时事件。

## 2. 数据流

```
浏览器游戏循环 (120 Hz 固定步长)
  │  CampusGame.step()
  │    ├─ CharacterPhysics（人类与 AI 共用）
  │    ├─ Survey / Inventory / Scenario
  │    └─ 事件 → eventSeq 环形缓冲 (512)
  │            │
  │            ├─ bridge: 每 50 ms 批量推送 {type:'events',events:[...]} ──┐
  │            └─ observe(): perception + player + survey + ...            │
  │                                                                        ▼
  │                                                    scripts/agent-server.mjs
  │                                                    （127.0.0.1:8788）
  │                                                      ├─ GET /observe?afterSeq
  │                                                      ├─ GET /events /events/stream (SSE)
  │                                                      ├─ GET /world /entities /path
  │                                                      └─ POST /act /acquireControl /stop ...
  │                                                                        │
  └──────────────────────────── WebSocket /game ←──────────────────────────┘
                                                                           │
                                外部的 AI / 脚本 / MCP 客户端 ◄────────────┘
```

要点：
- **不轮询画面**：状态由浏览器主动推送事件；`observe` 只在你需要完整快照时调用。
- **不模拟键鼠**：`/act` 只接受动作 JSON，移动仍由 `CharacterPhysics` 按固定步长推进。
- **不写坐标**：没有任何传送、速度写入、任意执行 JS、文件写入接口。

## 3. 观察：`observe`

`GET /observe?afterSeq=<n>`（或 MCP `campus_observe`）返回一个快照。v2 新增：

| 字段 | 用途 |
|---|---|
| `perception` | AI 的"眼睛"：视线、可交互物、探针、附近碰撞体、HUD 文本等价物 |
| `eventSeq` / `events` | 事件游标。带 `afterSeq` 时只返回增量，可做"观察→行动→观察"闭环 |
| `directive` | 当前/最近一条语义动作的实时进度 |
| `pausedReason` | 为什么暂停（`window_blur`、`human_takeover`……），AI 不会误以为卡死 |

`perception` 示例（节选）：

```json
{
  "eye": [12.4, 1.64, 96.1],
  "forward": [0.0, -0.02, -1.0],
  "ground": "paving",
  "probes": [
    {"distance": 0.6, "supportY": 0.07, "blocked": false, "stepUp": 0.0, "drop": null},
    {"distance": 1.5, "supportY": 0.07, "blocked": false, "stepUp": 0.0, "drop": null},
    {"distance": 3.0, "supportY": 0.07, "blocked": true, "stepUp": null, "drop": null}
  ],
  "interactables": [
    {"id": "record-cds-entry", "name": "CDS-1 入口记录点", "verb": "collect",
     "distance": 2.31, "bearingDeg": -4.2, "inView": true, "lineOfSight": true,
     "reachable": true, "requiredDistance": 2.7}
  ],
  "hud": ["目标：靠近并瞄准记录点，按 F 采集", "背包：关闭", "AI 控制：已连接"],
  "target": {"id": "record-cds-entry", "name": "CDS-1 入口记录点", "actions": ["collect"], "distance": 2.31}
}
```

AI 不再需要"看懂画面里有没有交互提示"——`interactables`、`target`、`hud` 就是那个提示的结构化版本；`lineOfSight` 用引擎碰撞网格做射线，等于替代"从像素判断有没有被墙挡住"。

## 4. 实时事件流

- `GET /events?afterSeq=0&limit=100`：读取事件缓冲（无游戏连接时也返回空数组）。
- `GET /events/stream?afterSeq=0`：SSE，先补发历史，再实时推送；`event: campus` / `id: <seq>` / `data: <json>`，10 秒心跳 `: ping`。

事件类型：`command_accepted`、`command_running`、`command_finished`、`jump`、`landed`、`collision`、`survey`、`discovery`、`panel`、`inventory`、`hotbar`、`spawn`、`pause`、`control_acquired`、`control_released`、`control_revoked`、`ai_enabled`、`ai_disabled`、`world`。

```bash
curl -N 'http://127.0.0.1:8788/events/stream?afterSeq=0'
```

事件的意义：AI 不必高频轮询 `observe`。走到目标、撞到墙、采集成功、被人类接管，都会以事件形式立刻到达，延迟在 50 ms 量级（浏览器批量推送周期）。

## 5. 语义动作：`directive`

v1.3 的动作是"相机相对输入"（`move.forward`、`lookDelta`），适合逐帧控制但要求上层自己写闭环。v2 增加语义层，**仍然是同一套物理**：

```json
{
  "commandId": "patrol-001",
  "controlEpoch": 1732000000000,
  "durationMs": 20000,
  "directive": {"type": "walkTo", "entityId": "S001", "toleranceM": 2.2}
}
```

支持四种：

| 类型 | 语义 | 关键参数 |
|---|---|---|
| `walkTo` | 寻路走到目标点（A* 绕障，走台阶/坡道） | `position` 或 `entityId`、`toleranceM`、`sprint` |
| `approach` | 走到距目标指定距离，然后看向它 | `stopDistanceM` |
| `lookAt` | 以 540°/s 转向目标点 | `position` 或 `entityId`、`toleranceDeg` |
| `followPath` | 沿给定折线行走 | `path`（≤64 点） |

`entityId` 与 `observation.landmarks[].id` 同一套稳定 ID（`B01`–`B07`、`S001`、巡检记录点等），不会因为数组下标或 Three.js UUID 变化而失效。

执行结果在 `GET /commands/<id>` / `observe.lastCommand.directive`：

```json
{"commandId": "patrol-001", "type": "walkTo", "reached": true,
 "distanceRemaining": 0.31, "lookErrorDeg": 0, "waypoints": 9,
 "progress": 0.997, "reason": "goal_reached"}
```

状态语义：`completed`=到达；`blocked`=不可达/卡住；`expired`=超时；`interrupted`=被替换/停止/接管。

复杂的"走过去→看它→按 F"现在可以写成：`campus_walk_to` → `campus_look_at` → `campus_act {interact}`，每一步都有可查询的结果。

## 6. 寻路与世界摘要

- `GET /path?from=[x,y,z]&to=[x,y,z]`：1 m 栅格 A*（台阶/坡度可行、绕开玻璃和建筑），返回折线路径；不可达时返回 `partial:true` 和最近可达点，不抛错。
- `GET /world`：一次拿到建筑、道路、区域、地标、可行走范围、控制规则，用来做上下文预热，省掉逐条摸黑查询。

## 7. MCP：让支持 MCP 的 Agent 直接当工具用

15 个工具：`campus_observe`、`campus_entities`、`campus_entity`、`campus_acquire_control`、`campus_act`、`campus_command`、`campus_select_entity`、`campus_stop`、`campus_release_control`、`campus_screenshot`、`campus_events`、`campus_path`、`campus_world`、`campus_walk_to`、`campus_look_at`。

另外提供 MCP `resources`（`hku://docs/ai-start`、`hku://docs/interface`、`hku://docs/native-v2`）和 `prompts`（`campus-patrol`：一次完整巡检的标准调用顺序），客户端不需要先让用户复制粘贴文档。

## 8. 权限与安全（没有放宽）

- 服务只监听 `127.0.0.1:8788`；保留 Origin/Host 校验，HTTP 拒绝外站 Origin、非本机 Host。
- AI 控制必须由用户在页面点「开启 AI 控制」；API 没有自解锁入口。
- 人类按键、失焦、页面隐藏、暂停、人工接管都会立即撤销 epoch；旧命令返回 `stale_epoch`。
- 没有坐标写入、瞬移、穿墙、任意执行 JS、远端 shell、文件写入接口。
- 动作 TTL 上限：普通动作 1 s，语义动作 30 s；单标签页只允许一个游戏连接。

## 9. 实测：不截图完成任务

```bash
npm run play            # 启动游戏 + 本机 AI 服务
# 页面点「开启 AI 控制」后：
npm run agent:native -- --control
```

脚本会依次：读 `/world` → `observe` → 订阅 SSE → `acquireControl` → `/path` 规划 → `walkTo S001` → `lookAt S001` → `walkTo record-cds-entry` → `lookAt` → `interact` → 读事件 → 释放控制。全程 `screenshotsTaken: 0`、无 DOM 自动化、无大模型调用，日志写到 `evidence/ai-native/native-demo.json`。

真实浏览器 + 真实游戏循环的一次验收结果（2026-11-19）：

| 步骤 | 结果 |
|---|---|
| `campus_world` | 2.0 协议，7 栋楼 / 14 条路 / 19 个区域 / 3 个巡检目标，scene revision `9b095734b4d0` |
| `perception` | 视线、探针、可交互物、HUD 文本全部有值；`record-cds-entry` 距离/方位/视线遮挡可直接判定 |
| `/path` 到 S001 | `reachable:true`、`partial:false`、约 48 m 折线、A* 展开 214 节点 |
| `walkTo S001` | `completed`，`reached:true`，2 个路点，剩余 2.18 m（容差 2.2），`reason:'goal_reached'` |
| `lookAt S001` | `completed`，角度误差 0° |
| `walkTo record-cds-entry` | `completed`，`reached:true`，进度 0.91 |
| `interact record-cds-entry` | `completed`，`operation.code:'viewed'`（此前已采集过；首次为 `collected`） |
| SSE 事件流 | 控制期间推送 18 条事件：`control_acquired`、`command_accepted/running/finished`、`survey` |
| 总计 | 单次演示 < 30 s，**0 张截图、0 次键鼠模拟、0 次大模型调用** |

只读模式（不开 AI 也能跑）：`node scripts/agent-native-demo.mjs`，三次读请求合计约 90 ms。

另外两个可独立运行的验收：

```bash
npx tsx scripts/check-ai-runtime.ts     # 无浏览器：22/22 PASS（感知/寻路/语义指令）
node scripts/check-agent-tools.mjs      # 无浏览器：协议 2.0、15 工具、SSE、MCP resources/prompts
```

浏览器 + 已开启 AI 时的 live 验收：

```bash
node scripts/check-agent-live.mjs --directives   # MCP → HTTP → WS → 真实游戏移动与语义指令
node scripts/check-agent-live.mjs --takeover-test # 人工接管后旧 epoch 立即失效
```

## 10. 兼容性

- 协议版本 `hku-campus/2.0`；v1.3 的端点、字段、动作全部保留，旧脚本照常可用。
- `durationMs` 在无 `directive` 时仍然最多 1000 ms，避免老客户端误发超长动作。
- `observe` 默认不带 `events`，载荷不会因为事件流而膨胀。

## 11. 后续可以继续做的（按性价比排序）

1. **评测集**：把"走到 S001、采集、提交"固化成带断言的脚本，作为接口回归和模型能力基线。
2. **回放**：记录 `(frame, command, events)`，可确定性重放，便于定位"AI 为什么卡住"。
3. **更细的感知**：音频事件、NPC 朝向/视线、可交互物 affordance 词表、世界摘要压缩到上下文预算内。
4. **动作原语**：开关门、上下楼梯的电梯、坐下、拍照；仍然全部走物理。
5. **限流与配额**：给事件流加 per-client 速率限制，防止长连接堆积。
