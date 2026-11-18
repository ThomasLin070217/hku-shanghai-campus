# AI-Native v2 接口契约（并行开发冻结版）

目标：让外部 AI **完全不读屏幕、不截图、不用 computer use**，只用结构化状态流 + 语义动作完成观察和操控。v1.3 全部端点、字段、动作继续可用。

本文件是并行开发的唯一接口依据。谁改契约先在本文件加一节并通知 Lead。协议版本从 `hku-campus/1.3` 升到 **`hku-campus/2.0`**。

## 1. 文件归属（写作用域，勿越界）

| 负责人 | 文件 |
|---|---|
| Lead | `src/agent/protocol.ts`、`src/agent/action.schema.json`、`src/exploration/game.ts`、`src/agent/bridge.ts`、`src/main.ts`、`src/scene/service.ts`、`scripts/agent-native-demo.mjs`、`docs/AI-INTERFACE.md`、`docs/AI-START.md`、`docs/AI-NATIVE-V2.md`、`package.json`、本文件 |
| ai-runtime | `src/agent/perception.ts`（新）、`src/exploration/pathfind.ts`（新）、`src/exploration/directives.ts`（新）、`src/exploration/navigation.ts`（只允许追加 `bounds` 字段）、`scripts/check-ai-runtime.ts`（新） |
| server-dev | `scripts/agent-server.mjs`、`scripts/agent-tools.mjs`、`scripts/agent-mcp.mjs`、`scripts/agent-cli.mjs`、`scripts/check-agent-tools.mjs`、`scripts/check-agent-live.mjs`、`scripts/check-agent-transport.mjs`（仅必要时） |
| researcher | `docs/research/AI-NATIVE-GAME-INTERFACES.md`（新） |

Lead 负责把 ai-runtime 的模块接进 `game.ts` / `bridge.ts`；ai-runtime 不要改 `game.ts`、`bridge.ts`、`protocol.ts`。

## 2. 版本与观察（observe）

`PROTOCOL_VERSION = 'hku-campus/2.0'`。

`GET /observe?afterSeq=<n>`（或 RPC `observe`，args `{afterSeq?: number}`）返回原字段 + 新增：

```ts
interface Observation {
  // ...v1.3 全部字段保持不变...
  protocolVersion: string;          // 'hku-campus/2.0'
  eventSeq: number;                 // 已产生事件的最高 seq
  events?: GameEvent[];             // 仅当请求带 afterSeq：seq > afterSeq 的事件，最多 100 条
  perception: Perception;           // 每帧可重新计算，见 §3
  directive: DirectiveSnapshot | null; // 当前/最近一条 directive 动作的可读结果
  pausedReason: string | null;      // 暂停原因：window_blur/page_hidden/human_takeover/...
}
```

未带 `afterSeq` 时不返回 `events`（保持载荷小）；带了返回增量。`eventSeq` 始终返回。

## 3. 感知（perception）——AI 的"眼睛"，不经过画面

新文件 `src/agent/perception.ts`：

```ts
import type {CampusGame} from '../exploration/game';
export interface Affordance {
  id: string;                 // 稳定 ID：线索/地标 ID、'computer'、快捷栏物品 ID
  name: string;               // 中文可读名
  verb: 'collect' | 'view' | 'equip' | 'submit' | 'interact' | 'open';
  distance: number;           // 眼睛到目标（米）
  bearingDeg: number;         // 相对朝向，0=正前方，正=左侧（与 yaw 正方向一致），[-180,180]
  inView: boolean;            // 水平/垂直视锥内
  lineOfSight: boolean;       // 与世界碰撞网格做射线，无遮挡
  reachable: boolean;         // distance <= requiredDistance 且 lineOfSight
  requiredDistance: number;   // 示例：巡检交互 2.7；电脑/快捷栏 0
}
export interface Perception {
  eye: [number, number, number];             // 眼睛世界坐标（position + eyeHeight）
  forward: [number, number, number];         // 单位朝向（yaw+pitch）
  ground: 'grass' | 'paving';                // 脚下表面
  underfootY: number | null;                 // 脚下支撑高度
  probes: {distance: number; supportY: number | null; blocked: boolean; stepUp: number | null; drop: number | null}[];
                                             // 沿朝向 0.6 / 1.5 / 3.0 m 探测，判断能不能走过去
  interactables: Affordance[];               // 附近可执行动作，按 distance 升序
  nearby: {name: string; distance: number; bearingDeg: number; top: number}[]; // 12 m 内碰撞体，最多 8 条
  hud: string[];                             // 画面 HUD 的文本等价物（目标提示、背包、面板、暂停原因），≤6 行
  target: {id: string; name: string; actions: string[]; distance: number} | null; // 等同于 survey.target
}
export function perceive(game: CampusGame): Perception;
```

要点：
- 只用 `game.body.world`（`surface/support/blocked/contacts/obstacles/meshes`）、`game.body.position`、`game.yaw/pitch`、`game.survey`、`game.inventory`、`game.paused/panel`。
- 视线遮挡用 `THREE.Raycaster` 打 `game.body.world.meshes`（导航盒网格，名字对应碰撞体）。
- `hud` 是给模型的"字幕"：例如 `交互：按 F 采集记录`、`已装备：MacBook`、`背包：关闭`、`暂停：window_blur`。不要编造不存在的信息。

## 4. 寻路（path）

`src/exploration/pathfind.ts`（新）：

```ts
import type {Navigation} from '../exploration/navigation';
export interface PathOptions {cellSize?: number; clearance?: number; maxNodes?: number; maxStepHeight?: number; maxDrop?: number}
export interface PathResult {
  ok: boolean;                    // 是否找到到目标的完整路径
  path: [number, number, number][]; // 世界坐标 [x,y,z]，含起终点；最多 512 点
  length: number;                 // 折线长度（米）
  reachable: boolean;
  partial: boolean;               // 只到最近可达点
  reason?: string;                // 'unreachable' | 'limit' | 'blocked'
  visited: number;                // A* 展开节点数
}
export function findPath(world: Navigation, from: readonly number[], to: readonly number[], options?: PathOptions): PathResult;
```

要点：
- 1 m 栅格、8 邻域、A*；节点可行条件：`support(x,z,y+maxStep)` 非空、`blocked(x,z,h,clearance)` 为假、相邻高度差在 `[-maxDrop, +maxStep]` 内；对角线禁止穿角。
- 允许走台阶/坡道（高度差自然处理），不允许跳过 >0.24 m 台阶。
- 默认上限 `maxNodes=20000`，超限返回到当前最优节点的 `partial` 路径，不抛异常。
- 路径做直线可视性简化（string pulling）。
- `navigation.ts` 只追加 `bounds:{minX,maxX,minZ,maxZ}` 到返回对象，供栅格范围使用。

## 5. 语义动作 `directive`

`/act` 新增可选字段 `directive`。带 `directive` 时 `durationMs` 允许 **1–30000**（普通动作仍为 1–1000），动作跨多个固定步执行，直到到达/超时/受阻。`directive` 与 `move/lookDelta/interact/computer/selectHotbar/jump/switchView` 互斥（校验失败返回 `invalid_action`）。

```ts
type Directive =
  | {type: 'walkTo'; position: [number, number, number]; toleranceM?: number; sprint?: boolean; path?: [number, number, number][]}
  | {type: 'approach'; position: [number, number, number]; stopDistanceM?: number; sprint?: boolean}
  | {type: 'lookAt'; position: [number, number, number]; toleranceDeg?: number}
  | {type: 'followPath'; path: [number, number, number][]; sprint?: boolean; toleranceM?: number};
```

`position` 也可用 `entityId` 代替：`{type:'walkTo', entityId:'S001', toleranceM?:...}`。可接受 ID 与 `observation.landmarks[].id` 相同（建筑 B01–B07、地标、巡检记录点）。ID 未找到时 `/act` 立即返回 `{ok:false,error:'unknown_target'}`，不产生命令记录。

语义：
- `walkTo`：内部用 `findPath` 规划；到点判据为水平距离 ≤ `toleranceM`（默认 0.35）。路径不可达时沿 `partial` 走到最近点，再以直行靠近；仍无进展 2 s → `blocked`，`reason:'stuck'`。
- `lookAt`：以 540°/s 转向目标点，误差 ≤ `toleranceDeg`（默认 2°）完成；pitch 限制同游戏（约 ±80°）。
- `approach`：`walkTo`（停距 `stopDistanceM`，默认 2.4 为巡检交互预留）后自动 `lookAt` 目标；总超时同 `durationMs`。
- `followPath`：按给定折线走，点距 ≤ 0.8 m 视为经过。
- 移动仍走 `CharacterPhysics` / 既有碰撞与重力；不写坐标、不瞬移。

`CommandRecord` 追加：

```ts
interface DirectiveSnapshot {
  commandId: string; type: 'walkTo' | 'approach' | 'lookAt' | 'followPath';
  reached: boolean; distanceRemaining: number; lookErrorDeg: number;
  waypoints: number; progress: number; reason?: string; // 'goal_reached'|'stuck'|'timeout'|'unreachable'
}
```

命令状态沿用 v1.3 枚举：`completed`（到达）、`blocked`（无进展/不可达）、`expired`（超时）、`interrupted`。结果字段 `record.directive` 在 `observe.lastCommand`、`GET /commands/<id>` 中可读。

`src/exploration/directives.ts`（新）：

```ts
import type {Intent, CharacterPhysics} from './physics';
import type {Navigation} from './navigation';
export type Directive = /* 同上，position 必填（ID 解析由 game.ts 完成）*/;
export interface DirectiveSnapshot { /* 同上（不含 commandId）*/ }
export function validDirective(value: unknown): value is Directive;
export class DirectiveRunner {
  constructor(directive: Directive, now: number);
  /** 每个固定步调用一次；返回本步 intent 与更新后的 yaw/pitch（弧度）。 */
  step(dt: number, state: {world: Navigation; body: CharacterPhysics; yaw: number; pitch: number}): {
    intent: Intent; yaw: number; pitch: number; jump: boolean;
    done: boolean; reached: boolean; distanceRemaining: number; lookErrorDeg: number; reason?: string;
  };
  snapshot(): DirectiveSnapshot;
}
```

## 6. 事件流（实时状态，不轮询画面）

`src/exploration/game.ts` 内 512 条环形缓冲，递增 `seq`；`eventSink?: (events: GameEvent[]) => void` 由 bridge 设置。

```ts
interface GameEvent {seq: number; frame: number; timeMs: number; kind: EventKind; message: string; data?: Record<string, unknown>}
type EventKind =
  | 'ai_enabled' | 'ai_disabled' | 'control_acquired' | 'control_released' | 'control_revoked'
  | 'command_accepted' | 'command_running' | 'command_finished'
  | 'jump' | 'landed' | 'collision'
  | 'survey' | 'discovery' | 'panel' | 'inventory' | 'hotbar' | 'spawn' | 'pause' | 'world';
```

浏览器 → 服务端 WS 推送：`{type:'events', events: GameEvent[]}`（每 50 ms 批量，单条最多 64 个事件）。服务端存 2048 条环形缓冲，并向 SSE 订阅者广播。

HTTP 新增：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/events?afterSeq=0&limit=100` | 快照；游戏未连接也返回 `ok:true` + 空数组 |
| GET | `/events/stream?afterSeq=0` | SSE：先补发 `afterSeq` 之后的事件，再实时推送；`event: campus`，`id: <seq>`；10 s 心跳注释行 |
| GET | `/path?from=[x,y,z]&to=[x,y,z]&clearance=0.34&maxNodes=20000` | 调用浏览器内 `findPath` |
| GET | `/world` | 世界摘要：建筑/道路/区域/地标/可行走范围/控制规则，供上下文预热 |

`/world` 返回（`src/scene/service.ts` 实现）：

```ts
{schema:'hku-scene/1', revision, protocolVersion, units:'metres', axes:'-Z north, +Y up',
 bounds:{min:[x,0,z],max:[x,0,z]},
 buildings:{id,name,position,size,sourceFile}[],
 roads:{id,name,center,size}[],
 areas:{id,name,center,size}[],
 landmarks:[{id,name,position}],
 survey:{id,title,total,targets:[{id,name,position}]},
 rules:{control:'explicit user enable; epoch', maxActionMs:1000, maxDirectiveMs:30000, maxQueryLimit:100}}
```

## 7. 能力发现（capabilities）与 MCP

`GET /capabilities` 返回 `protocolVersion:'hku-campus/2.0'`、`features:['events-sse','perception','directives','path','world']`、`tools`（15 个）、`endpoints`、`mcp:{resources:3,prompts:1}`、`limits`。

MCP 工具（15 个，保持原 10 个名称与参数向后兼容）：
1. `campus_observe`（可选 `afterSeq`）
2. `campus_entities`
3. `campus_entity`
4. `campus_acquire_control`
5. `campus_act`（schema 读取 `src/agent/action.schema.json`，v2）
6. `campus_command`
7. `campus_select_entity`
8. `campus_stop`
9. `campus_release_control`
10. `campus_screenshot`（仍然可选，仅人工核对用）
11. `campus_events` `{afterSeq?,limit?}` → `GET /events`
12. `campus_path` `{from,to,clearance?,maxNodes?}` → `GET /path`
13. `campus_world` → `GET /world`
14. `campus_walk_to` `{commandId,controlEpoch,position|entityId,toleranceM?,sprint?,durationMs?}` → 转成 `/act` 的 `directive:{type:'walkTo'}`，`durationMs` 缺省 15000
15. `campus_look_at` `{commandId,controlEpoch,position|entityId,toleranceDeg?,durationMs?}` → `/act` 的 `directive:{type:'lookAt'}`，缺省 3000

MCP 还提供：
- `resources/list` / `resources/read`：`hku://docs/ai-start`、`hku://docs/interface`、`hku://docs/native-v2`（读仓库内 markdown，文件不存在时返回空文本+说明）。
- `prompts/list` / `prompts/get`：`campus-patrol`（一次完整巡检的标准调用顺序）。
- `initialize` 返回 `capabilities:{tools:{},resources:{},prompts:{}}`，`instructions` 写清"先 world/observe，需要移动时用户必须已开启 AI；用 walk_to/look_at 而不是手搓 move；事件流优先于轮询"。

## 8. 验收（各 owner 自测命令）

- ai-runtime：`npx tsx scripts/check-ai-runtime.ts`（无浏览器，构造 `createNavigation` + `CampusGame`，验证 perceive 字段/视线/探针、findPath 绕障与台阶、directive 到点与超时）。
- server-dev：`node scripts/check-agent-tools.mjs`（版本 2.0、15 工具、SSE 补发+实时、/path 参数、/world、MCP resources/prompts、walk_to 翻译），`node scripts/check-agent-transport.mjs` 不回归。
- Lead：`npm run typecheck`、`npm run build`、`npm run check:agent-tools`、`npm run check:agent-live`（有浏览器时）、`node scripts/agent-native-demo.mjs`。

## 9. 安全与边界（不得放宽）

- 继续只监听 `127.0.0.1`；保留 Origin/Host 校验；不新增任意执行 JS、远端 shell、文件写入、坐标写入、瞬移、解锁 AI 的接口。
- 事件流只读；SSE 不接受写操作；`/world` 只读。
- 人类按键、失焦、暂停、人工接管立即撤销 epoch 与 AI 移动；新端点同样检查 `controlEpoch`（directive 走 `/act` 已有检查）。
- 不改变现有存档、任务、物理和视觉；不得为了接口改动碰撞或几何。

## 10. 实现备注（落地差异，均向后兼容）

- **事件缓冲与重连**：服务端在建立新的游戏 WebSocket 连接时清空 2048 条事件缓冲与 seq 去重集合。浏览器刷新后游戏侧 `eventSeq` 从 1 重新开始，若不清空旧 seq 集合会把新事件全部当重复丢掉。重连后 agent 的旧游标可能大于新缓冲，应先不带 `afterSeq` 读一次 `observe` 再继续增量。
- **实体解析**：`main.ts` 给 `game.entityResolver` 注入场景注册表查找，因此任意稳定场景 ID（`S001`、`R005`、`B04-P-…`）都可以作为 `walkTo`/`lookAt` 的 `entityId`。`observation.landmarks` 只列主要地标，不是全部 1.8 万个部件；查细部用 `/entities` 或 `/entity/{id}`。
- **瞄准高度**：巡检记录点的 `position` 是地面点。`lookAt` / `approach` 对这类 landmark 自动把瞄准点抬高 1.3 m，与 `survey.target()` 的判定一致；显式传入的 `[x,y,z]` 不抬高。
- **followPath**：不需要 `position`/`entityId`，路径自身携带几何；`startDistance` 取最后一点用于进度。
- **只读端点不要求 AI 授权**：`/observe`、`/events`、`/events/stream`、`/path`、`/world`、`/entities` 均为只读，无需 `controlEpoch`；只有 `/act`、`/acquireControl`、`/stop`、`/releaseControl`、`/scene/select` 受现有 epoch/授权规则约束。
- **动作时长**：带 `directive` 时 `durationMs` 1–30000；不带时仍 1–1000，旧客户端行为不变。超时由游戏侧 `expiresAt` 先判定，`DirectiveRunner` 内部 30 s 上限只做兜底。
