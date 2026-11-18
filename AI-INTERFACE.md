# HKU Campus native Agent API · v2.0（兼容 v1.3）

该接口直接连接正在运行的浏览器游戏。无模型、API Key、浏览器自动化或模拟键盘依赖。

## 启动

Node 22+：`npm install`，然后 `npm run play`。打开 http://127.0.0.1:5184 。

游戏暂停界面点击 **开启 AI 控制** 后，运行 `npm run agent:demo`。演示依次读取状态、取得权限、转向、行走、奔跑、跳跃并切换视角、停止、释放权限。

`node scripts/agent-demo.mjs --takeover-test` 额外等待人工按 W 或点击“一键接管”，再提交旧 epoch 验证拒绝。启用 AI 是页面的用户操作，API 没有绕过它的入口。窗口失焦或页面隐藏会撤销 AI 授权，因此建议先启动演示脚本，再回到游戏点击开启 AI。

服务只监听 **127.0.0.1:8788**。HTTP 客户端无需账户或密钥；此服务面向可信的本机进程，不是公网服务。WS 只接受本机 5184/5174/4174 页面 Origin，HTTP 拒绝外站 Origin、非本机 Host；POST 必须 application/json。只有一个游戏连接，避免多标签控制错误实例。

## HTTP 方法

所有返回 JSON。`ok:false` 时查看 `error`；未连接为 HTTP 503 `not_ready`，协议/权限拒绝为 409，未知路径为 404。

| 方法 | 路径 | 请求 |
|---|---|---|
| GET | `/health` | 服务与游戏就绪状态 |
| GET | `/observe` | 返回 `{ok:true,state:Observation}` |
| POST | `/acquireControl` | `{"agentId":"local-agent"}` |
| POST | `/act` | Action，见下文 |
| POST | `/stop` | `{"controlEpoch":…}` |
| POST | `/releaseControl` | `{"controlEpoch":…}` |
| GET | `/commands/<commandId>` | 查询命令执行结果 |
| POST | `/screenshot` | `{}`，单独返回 PNG dataUrl |

示例：

```js
const base='http://127.0.0.1:8788';
const post=(path,data)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
const observed=await fetch(base+'/observe').then(r=>r.json());
const grant=await post('/acquireControl',{agentId:'my-agent'});
if(!grant.ok) throw new Error(grant.error);
await post('/act',{
  commandId:'my-001',controlEpoch:grant.controlEpoch,durationMs:300,
  move:{forward:1,right:0},lookDelta:{yawDeg:0,pitchDeg:0},sprint:true,jump:true
});
```

完整可运行脚本：`scripts/agent-demo.mjs`。类型：`src/agent/protocol.ts`。动作 JSON Schema：`src/agent/action.schema.json`。

## 坐标、动作与时间

- Y 向上，米制估计场景。朝向 yaw=0 朝 -Z；正 yaw 向左转，正 pitch 向下看。俯仰最终限制约 ±80°。
- forward/right 相对于当前水平视线，范围各为 [-1,1]。组合向量长度超过 1 时归一化。0.5 为半速。
- 行走 2.6 m/s，奔跑 5.2 m/s。重力 22 m/s²，起跳速度 7.2 m/s；实测跳高约 1.15 m。相同控制器用于人类和 AI。
- durationMs 为整数 **1–1000**，从游戏接收动作时的墙钟开始计时。到期清除意图；没有网络续命式永久移动。
- `jump`、`lookDelta` 和 `switchView` **只在首次消费动作时执行一次**。空中 jump 忽略并记录 `airborne_ignored`。
- 新 act 替换旧 act，旧命令记为 interrupted/replaced。重复 commandId 返回原记录，绝不重复跳跃或转向。整个页面会话内 ID 唯一，最多保留 10000 条；达到上限拒绝新命令。
- HTTP 接收只入队，不推进游戏帧。下一次固定步长 1/120 秒更新消费动作；渲染帧与输入来源不改变规则。
- `accepted` 仅确认已入队；`running` 表示已开始执行。到期后 `completed` 或 `blocked`（曾接触障碍）。`expired` 表示尚未被游戏帧消费就已超时；`interrupted` 表示替换、stop、暂停、接管、断线等。`collisionIds` 和 `jumpResult` 提供实际结果。
- stop 清除动作意图，水平运动下一逻辑步停止；空中角色继续受重力落地。release 进一步撤销权限，须用户重新开启 AI。

## observe

v1.3 起包含协议版本、逻辑 frame、累计运行 timeMs、墙钟 wallTimeMs、mode、controlEpoch、aiEnabled、owner、paused、player.position/velocity/yawDeg/pitchDeg/grounded、view、160 m 内地标、lastCommand 与当前碰撞；v2 追加 `perception`、`eventSeq/events`、`directive`、`pausedReason`（见文末 v2 章节）。

地标 ID 稳定为 B01–B07，CDS-1 为 **B04**。relativePosition 是世界坐标的“地标中心减角色位置”，不随镜头旋转；distance 为该向量长度。建筑 ID 与地图对应仍遵循项目参考档案的证据等级，不能视作校方楼栋 GIS。

截图独立按需读取，observe 不传图片。历史命令用 `/commands/<id>` 查询，不必依赖 lastCommand。

## 控制权与故障

只有用户开启 AI 后才能 acquire。成功返回当前 controlEpoch；每次接管/暂停/释放/重新授权都会使旧 epoch 作废。迟到命令先检查 epoch，即使它使用旧 commandId 也会拒绝。

W/A/S/D、左 Shift、Space 是明确人工输入，会立即撤销 AI，未锁定鼠标时暂停等待用户进入；输入框内输入不触发接管。UI“一键接管”也会立即撤销。窗口失焦、隐藏、Pointer Lock 释放清空输入；AI 模式无需 Pointer Lock。

浏览器连接关闭会清空授权，心跳失联约 1.8 秒也会暂停；已排队动作至多持续 1 秒。RPC 超过 2 秒不被浏览器执行，HTTP 等待 2.5 秒超时。not_ready 与 game_timeout 都应停止发送并重新 observe，不能假设动作成功。

外部 Agent 不拥有坐标写入、速度写入、穿墙、解锁 AI 或独立推进帧的能力。开发者调试对象 `window.__CAMPUS` 不属于这个协议，示例脚本不使用它。


## v6 多窗口连接

本机服务同一时刻只连接一个校园窗口。默认后台连接不抢占已有窗口；在想控制的页面点击「开启 AI 控制」会显式切换到此窗口（WebSocket `/game?claim=1`）。旧窗口收到关闭码 4001 并立即停控；在途 RPC 返回 `game_replaced`，脚本应重新 observe 并按用户授权重新 acquireControl，不重放旧 epoch 命令。普通重连不会自动夺回。HTTP 端点与协议版本保持兼容。v9 数字巡检交互与提交通过下方新增动作暴露，旧物资练习不再挂载到主场景。

## v8 背包与装备

`observe.inventory` 返回同一份 36 格槽位、`selectedHotbar`（0–8）、`equipped`、`revision` 和 `open`；`observe.world` 返回米制约定与校园修订版本。地标增加绝对坐标，包含入口狮子及导览牌。

```json
{"commandId":"equip-001","controlEpoch":12345,"durationMs":400,"selectHotbar":0}
```

通过 `/act` 提交，下一逻辑步仅消费一次，沿用 epoch、超时及去重检查。快捷栏为空会收起物品。v9 新试玩把 MacBook 放在快捷栏第 1 格（索引 0），初始选中空手第 2 格；旧人物/物品单元示例仍从储物区第 1 格开始。接口本轮不开放背包移动；用户可随时打开背包接管。

E 打开背包会清空输入、停止速度、暂停并撤销 AI；数字键、滚轮和界面物品操作也撤销 AI。关闭背包仍暂停，需点击进入探索。人类和 AI 调用同一个 `CampusGame.selectHotbar()`。示例和完整配置见 [v8 扩展说明](docs/CHARACTERS-AND-ITEMS-V8.md)。

2026-11-14 卫星测距校准后，`observe.world.revision` 为 `2026-11-14-v8-scale1`；新增只读 `world.scaleCalibration`（`id`、`horizontalStatus`、`verticalStatus`、`source` 等）。当前七栋稳定ID不变，东西两列x=±58，入口出生点自动跟随。Agent 应使用最新 `observe` 的位置，避免缓存旧 x=±52 地标。水平尺度核对不代表楼高或地下深度已经测量；详见[测距报告](references/scale-calibration/REPORT.md)。


## v9 数字巡检

`observe.survey` 返回稳定任务 ID、状态、count/total、collectedClues、discovered、archive、objectives 及当前 `target`（距离、可执行 collect/view）。`panel` 说明玩家面板状态；`landmarks` 与两张地图、记录牌共享坐标及实际地面 Y。

```json
{"commandId":"survey-collect-001","controlEpoch":123,"durationMs":500,"interact":"record-cds-entry"}
```

```json
{"commandId":"survey-submit-001","controlEpoch":123,"durationMs":500,"selectHotbar":0,"computer":"submit"}
```

`computer` 支持 `map`、`tasks`、`clues`、`submit`。动作在固定步长首次消费一次，结果查看 `/commands/<id>` 的 `operation`；HTTP accepted 不代表已经收集。目标须在 2.7 单位内、对准、无遮挡，玻璃同样阻挡；提交须装备真实 MacBook 且三条记录齐备。重复交互变为 viewed，重复提交返回 already_completed。AI 与玩家共用 `Survey.interact()` / `Survey.computer()`。

AI 页面读取为无界面业务动作，不自动打开玩家暂停面板；结果与 observe 同步。玩家 C、E 或设置面板会停止当前动作、撤销 epoch，关闭/载入不会恢复 AI。存档不包含 AI 控制权。扩展示例与存档规则见 [数字巡检说明](docs/DIGITAL-SURVEY-V9.md)。


## 场景编号与 MCP（v1.3，向后兼容原动作）

- `GET /capabilities`：无需浏览器也可取得工具列表、JSON Schema 和就绪状态。
- `GET /entities?q=石牌&kind=area&offset=0&limit=30`：查询，最多 100 项；可用 `parentId` 或 `near=[x,y,z]&radius=30`。
- `GET /entities/S001`：源码定位、范围、子部件、相对玩家坐标和 scene revision。
- `POST /scene/select`：`{"id":"S001","controlEpoch":123,"sceneRevision":"当前值"}`；同一控制权规则，只做高亮。旧控制权/旧场景分别返回 `stale_epoch` / `stale_scene`。
- 玩家 state.player.id 为 `PLAYER`；schema 为 `hku-scene/1`。

命令行、MCP 配置和本地示例见 [AI-START](docs/AI-START.md)。类型：`src/scene/registry.ts`；HTTP/MCP 工具 Schema：`scripts/agent-tools.mjs`。


## v2 AI-native 升级（2026-11）

v2 的目标是让外部 AI **完全不读屏幕、不截图** 也能观察和操控：结构化状态 + 实时事件流 + 语义动作。完整说明、设计理由和实测见 [docs/AI-NATIVE-V2.md](docs/AI-NATIVE-V2.md)，接口契约见 [docs/plans/AI-NATIVE-V2-CONTRACT.md](docs/plans/AI-NATIVE-V2-CONTRACT.md)。v1.3 全部端点与动作保持可用。

新增内容：

- `observe` 增加 `perception`（眼睛朝向、视线遮挡、可交互物、探针、附近碰撞体、HUD 文本等价物）、`eventSeq`/`events`（带 `afterSeq` 只返回增量）、`directive`、`pausedReason`。
- 事件流：`GET /events?afterSeq=` 与 `GET /events/stream?afterSeq=`（SSE 补发 + 实时 + 心跳）。事件含命令状态、跳跃/落地/碰撞、巡检、发现、控制权与暂停。
- 语义动作：`/act` 新增 `directive`（`walkTo` / `approach` / `lookAt` / `followPath`），允许 `durationMs` 1–30000，`entityId` 使用 `observe.landmarks` 的稳定 ID；仍走 `CharacterPhysics`，不写坐标。
- `GET /path?from&to`：1 m 栅格 A*，返回折线路径或 `partial` 最近可达点。
- `GET /world`：建筑/道路/区域/地标/可行走范围/规则摘要。
- MCP 15 个工具（新增 `campus_events`、`campus_path`、`campus_world`、`campus_walk_to`、`campus_look_at`），并新增 3 个文档 resources 与 `campus-patrol` prompt。

不截图完成任务：

```bash
npm run play
# 页面点「开启 AI 控制」后：
node scripts/agent-native-demo.mjs --control
```
