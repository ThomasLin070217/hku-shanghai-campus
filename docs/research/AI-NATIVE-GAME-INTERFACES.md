# AI 原生游戏接口：AI 如何不读屏幕就读到实时数据

日期：2026-11-19。范围：市面上"原生 AI 接口"做得好的游戏/平台，接口形态与"AI 到底读什么"；末尾映射到本仓库 v2 契约（[AI-NATIVE-V2-CONTRACT.md](../plans/AI-NATIVE-V2-CONTRACT.md)、[AI-INTERFACE.md](../../AI-INTERFACE.md)）。
证据标注：**【已确认】** = 官方文档/论文/README 可核对；**【推断】** = 本文基于已确认材料的推理，未找到一手出处。

## 0. 结论先行

**有——不靠 computer use 操控游戏的方法不仅存在，而且是游戏 AI 研究的主流做法：原生接口。它不"读屏幕"，而是引擎把内存里的世界状态序列化成数据。** 游戏本来就有完整、精确、带 ID 的世界状态（位置、血量、库存、可见性、事件）；原生接口做两件事：把状态按契约导出成 JSON/张量/协议包，把 AI 的意图翻译成引擎已有的动作入口。截图与 computer use 是可选旁路——用于人类核对、纯视觉类任务或没有源码的黑盒游戏——不是主通道。【已确认：下文每一家都可核对到原始出处；个别条目标"推断"】

**数据流五步**（各家实现都落在这五步里）：
1. 引擎内存里有权威世界状态（实体、位置、库存、可见性、计时器）；
2. 游戏侧适配层（mod/插件/官方 API）把这个状态序列化成 JSON / protobuf / 张量；
3. 通过本地 HTTP/WS、stdio（MCP）、进程内 step 调用、或 socket 传给 AI；
4. 模型只在自己的上下文里读文本化/张量化观测，按需查询细节；
5. AI 的意图被翻译成语义动作（走、看、交互、施法），交回引擎的同一套物理/规则入口执行。
截图只可能出现在第 2 步的替代方案里——把状态先渲染成像素再让模型"反推"回状态，等于人为加了一次有损压缩。

三条可迁移的规律：
1. **观测是"引擎视角的结构化快照"，不是像素。** Dota 2 的 OpenAI Five 明确不用屏幕像素，而用约 16,000 个数值/类别值编码"人类玩家能看到的信息"；不用像素的理由是聚焦策略而非视觉，且逐帧渲染成像素会让算力翻很多倍。【已确认，[arXiv:1912.06680](https://arxiv.org/abs/1912.06680)】
2. **动作是语义函数调用，不是坐标。** StarCraft II 把动作定义为带类型参数的函数调用（如 `Move_screen(queued, screen)`），并每帧告知哪些动作当前可用；Minecraft 的 Mineflayer 提供"走到坐标/挖方块/查背包"这种高层 API；Roblox Studio MCP 直接暴露 `character_navigation`、`inspect_instance`。【已确认，[PySC2 environment.md](https://github.com/google-deepmind/pysc2/blob/master/docs/environment.md)、[Mineflayer](https://github.com/PrismarineJS/mineflayer)、[Roblox 文档](https://create.roblox.com/docs/studio/mcp)】
3. **实时性靠"通道节奏"设计，而不是轮询截图。** 主流是三选一或混用：per-tick step 同步（PySC2、ML-Agents、MineDojo）、事件流/增量（Factorio 的 Lua 事件、本仓库 v2 的 `events`+SSE）、轮询快照（Dota bot 的 `Think()` 每帧、MCP 工具按需调用）。【已确认，见下文】

## 1. 先看反例：截图像素派贵在哪

像素派的代表是 SIMA、OSWorld、GameNGen，以及"computer use"类产品接口。

- **SIMA** 的设计目标就是"最小假设"：输入是图像观测 + 语言指令，输出是键鼠动作，实时交互。【已确认，[arXiv:2404.10179](https://arxiv.org/abs/2404.10179)】这是为了跨游戏泛化，代价是模型必须自己学会"看懂 UI 和数值"。
- **OSWorld** 用 369 个真实电脑任务做执行式评测，人类完成率 72.36%，当时最好的模型只有 12.24%，论文归因于 GUI grounding 与操作知识不足。【已确认，[arXiv:2404.07972](https://arxiv.org/abs/2404.07972)】
- **GameNGen** 用扩散模型直接生成 DOOM 下一帧，单 TPU 20 FPS、PSNR 29.4，说明"像素级世界模型"可行；但它输出的是画面，不是可查询的实体状态（血量、弹药、敌人坐标仍需从画面反推）。【已确认，[arXiv:2408.14837](https://arxiv.org/abs/2408.14837)】
- **computer use** 类产品的公开形态是"给截图、回鼠标键盘动作"的循环（[Claude computer use 文档](https://docs.claude.com/en/docs/agents-and-tools/computer-use)；该页在本文环境发生跳转，未逐字核对，机制按公开资料描述）。

为什么原生通道更可靠，四条原因（成本与延迟量级为推断）：
1. **信息损耗**：像素里没有稳定实体 ID、精确数值、遮挡关系；要拿血量/金币只能 OCR 或猜。原生观测直接给 `hp: 73`、`inventory: [...]`。
2. **可复现性**：视觉 grounding 对分辨率、字体、色差、动效敏感；同一任务换个皮肤就可能失败（OSWorld 的 12.24% 即证据）。原生状态在相同 seed + 相同输入下可重放（见 Factorio 的确定性锁步）。
3. **延迟与成本**：截图→编码→推理→点击的闭环每步都要传图、算图；容器化桌面还要渲染。【推断】图像按分辨率折算成 token，通常比等量文本贵一个量级以上；公开材料没有统一口径，故不引用具体倍数。【推断】
4. **上下文占用**：一帧 1080p 截图的信息量远大于一份 2 KB 的 JSON 快照，而后者已经包含 AI 决策真正需要的字段。原生接口可以"按需查询"（`/observe?afterSeq=`、`/path`、`/world`），把上下文花在世界摘要和事件上，而不是花在重复的画面上。

结论：**像素派适合"没有接口的黑盒游戏"和"研究视觉泛化"；做产品化的 AI 原生游戏，主通道必须是结构化状态 + 语义动作 + 事件流，截图只做可选核对。** 与本仓库 v2 的目标一致：`campus_screenshot` 仅保留为人工核对用途。【已确认，见契约 §7】

## 2. 逐家拆解：API 形态与"AI 读什么"

### 2.1 Factorio：Lua mod API + headless + 确定性

- **形态**：mod 用 Lua 5.2 修改版，分 settings/prototype/runtime 三阶段；runtime 阶段"基于事件（events）触发，通过各类对象访问世界"。【已确认，[Factorio API Docs](https://lua-api.factorio.com/latest/)】专用服务器可无 GUI 启动（`--start-server`），支持 `--run-replay`、`--benchmark`、`--until-tick`、`--rcon-port` 等。【已确认，[Command line parameters](https://wiki.factorio.com/Command_line_parameters)】
- **AI 读什么**：Lua 对象树里的实体、库存、表面、研究进度 + 事件回调；不是画面。
- **确定性**：多人用确定性锁步（只同步输入，不同步状态），任一 tick 不一致就 desync。【已确认，[Desynchronization](https://wiki.factorio.com/Desynchronization)】这是"可回放、可评测"的根基。
- **LLM 接入范例**：Factorio Learning Environment（FLE）让 agent 写 Python 程序，通过 REPL 观测（上一段程序的 stdout/stderr）并执行动作，论文见 [arXiv:2503.09617](https://arxiv.org/abs/2503.09617)，代码见 [GitHub](https://github.com/JackHopkins/factorio-learning-environment)。注意：其与游戏的具体 RPC 通道本文未核实。

### 2.2 Minecraft：Mineflayer / MineDojo / Voyager / MCP

- **Mineflayer** 是直接跑在 Minecraft 协议上的高层 JS API：实体追踪、方块查询（"毫秒级找到任意方块"）、物理与移动、库存、合成、挖掘放置、聊天。【已确认，[Mineflayer README](https://github.com/PrismarineJS/mineflayer)】
- **MineDojo** 是 Gym 风格接口，观测是"多模态（RGB、指南针、体素等）"，动作是复合动作空间，并提供 privileged observation 定制；3142 个任务（1581 个可用模拟器真值自动评分）。【已确认，[MineDojo README](https://github.com/MineDojo/MineDojo)、[arXiv:2206.08853](https://arxiv.org/abs/2206.08853)】"privileged observation"很关键：同一世界可以给 AI 不同信息权限。
- **Voyager** 把**代码当动作空间**：自动课程 + 技能库（可执行代码，按描述嵌入检索）+ 迭代提示（用环境反馈、执行错误、自我验证修程序）；技能库让能力可组合、可复用。【已确认，[Voyager 项目页](https://voyager.minedojo.org/)、[GitHub](https://github.com/MineDojo/Voyager)】Voyager 的运行时就是 Mineflayer（Mineflayer README 的"Projects Using Mineflayer"列出 Voyager）。
- **MineRL**：Minecraft 的 Gym 风格环境与人类示范数据集，NLE 的文档把它列为相关环境（[NLE](https://github.com/NetHack-LE/nle) 引出的 [minerl.io/docs](http://minerl.io/docs)）；其定位偏向"从示范/像素学习"，与 Mineflayer 的"直接读结构化状态"互补。【已确认：NLE README 列出；minerl.io 本文未能打开，细节未核实】
- **MCP 类方案**：`minecraft-mcp-server` 把 Mineflayer 包成 MCP 工具，暴露 `get-position`、`move-to-position`、`find-blocks`、`dig-block`、`list-inventory`、`find-entity`、`read-chat` 等语义工具。【已确认，[minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server)】

### 2.3 StarCraft II：PySC2 的 protobuf 观测/动作空间

- **形态**：PySC2 把暴雪的 StarCraft II Machine Learning API（protobuf，[s2client-proto](https://github.com/Blizzard/s2client-proto)）包装成 Python RL 环境，`step()` 一次推进若干游戏步。【已确认，[PySC2 README](https://github.com/google-deepmind/pysc2)】
- **AI 读什么**：空间观测（`rgb_screen`/`rgb_minimap`；约 25 个特征层，如 height_map、visibility、player_relative、unit_type、hit_points、selected）+ **结构化张量**（玩家 11 维、控制组 10×2、单选 7 维、多选、cargo、建造队列、`available_actions`、`last_actions`、`action_result`、`alerts`）。文档明确说：给结构化数据的理由是有大量文字与数字"不指望 agent 学会从低分辨率像素里读"，且回放很难还原人类看到的视觉。【已确认，[environment.md](https://github.com/google-deepmind/pysc2/blob/master/docs/environment.md)】
- **动作**：不是扁平离散空间，而是"带参数类型的函数调用"，每帧观测告知哪些函数可用；有通用能力与具体能力的区分。【已确认，同上】
- **节奏/确定性**：游戏模拟每秒 16–22 步，API 可控制时钟快进；`step_mul` 跳帧；随机种子可去除武器速度与更新顺序的随机。【已确认，同上】

### 2.4 Dota 2：bot 脚本 API + OpenAI Five

- **形态**：自定义大厅里用 Lua 写 bot，引擎每帧调用 `Think()`；提供 `GetBot()`、`GetNearbyHeroes(radius, enemies, mode)`、`GetHeroLastSeenInfo(playerID)`（返回位置与"多久没看到"）、`IsLocationVisible(vLoc)`、`IsLocationPassable/GetHeightLevel`、动作队列 `Action_*`/`ActionPush_*`/`ActionQueue_*` 等。【已确认，[Valve Dota Bot Scripting](https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting)；本文阅读的是其 GitHub 镜像 [BOT_API_REFERENCE.md](https://github.com/forest0xia/dota2bot-OpenHyperAI/blob/main/docs/BOT_API_REFERENCE.md)】
- **AI 读什么（OpenAI Five）**：每 4 帧取一次观测（约 0.133 秒一步），约 16,000 个值，**明确不是屏幕像素**，而是把"人类能看到的信息"编码成数据数组；动作是离散化后的 8,000–80,000 个候选之一。【已确认，[arXiv:1912.06680](https://arxiv.org/abs/1912.06680)】
- **值得抄的细节**：`GetHeroLastSeenInfo` 返回的是**带时间戳的过期信息**，不是全知地图——原生接口也可以主动模拟"不完全信息"。【已确认，镜像文档】

### 2.5 Unity ML-Agents：sensor 化观测 + Behavior

- **形态**：Agent 挂在 GameObject 上，负责"生成观测、执行收到的动作、给奖励"，Behavior 定义行为参数；观测可以是**数值或视觉**，细分为 vector、ray cast、visual 观测；还有 variable-length observations（变长实体列表 + attention），用于"敌人数量不固定"的场景；Python 低层 API / Gym / PettingZoo 负责训练侧。【已确认，[ML-Agents Theory](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.0/manual/ML-Agents-Overview.html)、[VectorSensor API](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.0/api/Unity.MLAgents.Sensors.VectorSensor.html)】
- **可迁移点**：`Behavior Parameters` 式的"能力声明"、观测通道可插拔、显式的"观测 ⊂ 世界状态"（文档特意区分 agent observation 与 environment state）。

### 2.6 Roblox Studio MCP（2025）

- **形态**：MCP server 内置在 Studio 里，stdio 传输；工具覆盖脚本读写（`script_read`/`multi_edit`/`script_grep`）、数据模型探索（`search_game_tree` 返回扁平 JSON、`inspect_instance` 返回可读属性与子节点摘要）、Luau 执行（`execute_luau`，可选 Edit/Client/Server 数据模型）、Playtest（`get_studio_state`、`start_stop_play`、`get_console_output`、`screen_capture`）、输入模拟（`character_navigation`、`user_keyboard_input`、`user_mouse_input`）。每个调用带 `studio_id` 以区分多个 Studio 实例。【已确认，[Roblox Studio MCP 文档](https://create.roblox.com/docs/studio/mcp)】
- **AI 读什么**：实例树 + 属性 + 控制台输出，而不是画面；`screen_capture` 只是工具之一。
- **时间点**：DevForum 公告《Introducing the Open Source Studio MCP Server》存在 2025-09-28 的存档快照，说明 2025 年已发布；官方文档本身未标日期。【已确认存档：[Web Archive](https://web.archive.org/web/20250928115512/https://devforum.roblox.com/t/introducing-the-open-source-studio-mcp-server/3649365)】
- **安全**：官方明确警告"MCP 客户端可以读写你打开的 place，只连接可信客户端"。【已确认，同上】

### 2.7 Unreal / Godot MCP 生态：偏编辑器，不是运行时状态

- **Godot MCP**：启动编辑器、运行/停止项目、抓调试输出、建场景/加节点/保存场景——是"给 AI 一个可编译可运行的项目反馈回路"。【已确认，[godot-mcp](https://github.com/Coding-Solo/godot-mcp)】
- **Unreal MCP**：编辑 Actor、改 Blueprint 组件与节点图、聚焦视口，插件 + Python TCP 桥；项目自标 EXPERIMENTAL。【已确认，[unreal-mcp](https://github.com/chongdashu/unreal-mcp)】
- **判断**：这类 MCP 解决的是"AI 改游戏"，不是"AI 玩游戏"；它们没有统一的结构化游戏状态/事件契约，运行时操控仍要自己加。Roblox 是少数把"Play 状态 + 输入模拟 + 实例树"一起包进 MCP 的官方实现。【推断】

## 3. 机制对比

| 机制 | 代表 | 节奏/时序 | 优点 | 代价 |
|---|---|---|---|---|
| per-tick step 同步 | PySC2（`step_mul`）、ML-Agents、MineDojo | 环境等你 step，可快进可暂停 | 严格因果、可复现、易训练 | 必须独占环境；AI 慢则世界停 |
| 事件流/增量 | Factorio Lua events、本仓库 v2 `events`+SSE | 引擎推进，事件推给 AI | 实时、带 seq 可补发、开销小 | 需要客户端处理增量与重连 |
| 轮询快照 | Dota bot `Think()`、MCP 工具按需调用、`/observe` | AI 自己决定频率 | 简单、无状态 | 可能错过瞬时事件；轮询过密浪费 |

跨通道的六个横切维度：

| 维度 | 主流做法 | 代表 / 本仓库 v2 | 证据 |
|---|---|---|---|
| 语义实体 ID / 场景图 | 给稳定 ID 或路径，AI 用 ID 引用而不是坐标 | SC2 单位类型 ID；Roblox 实例树路径；本仓库 `B01–B07`/`S001` | [PySC2](https://github.com/google-deepmind/pysc2/blob/master/docs/environment.md)、[Roblox](https://create.roblox.com/docs/studio/mcp) |
| 射线感知与视线遮挡 | 引擎算视锥/射线/可见性，AI 只读结果 | Dota `IsLocationVisible`；本仓库 `perception.lineOfSight` 打碰撞网格 | [Dota API 镜像](https://github.com/forest0xia/dota2bot-OpenHyperAI/blob/main/docs/BOT_API_REFERENCE.md) |
| 文本化观测（HUD/字幕等价物） | 把画面上的字变成字符串字段 | 本仓库 `perception.hud`；NLE Language Wrapper | [NLE](https://github.com/NetHack-LE/nle) |
| 回放 / 确定性 | seed + 输入/动作重放（注意版本绑定） | Factorio 锁步；SC2 seed+动作回放；本仓库 `eventSeq`+快照 | [Desync](https://wiki.factorio.com/Desynchronization)、[PySC2 README](https://github.com/google-deepmind/pysc2) |
| 权限与人类接管 | 显式授权 + 可撤销令牌；AI 不能自解锁 | 本仓库 `controlEpoch`；Roblox 信任警告 | [Roblox](https://create.roblox.com/docs/studio/mcp)、[AI-INTERFACE](../../AI-INTERFACE.md) |
| 时延与上下文成本 | 增量/按需/批量，避免每步传图 | `observe?afterSeq=`、`/path`、`/world`、事件批量 | 本仓库契约；成本倍数为【推断】 |

## 4. 可复用设计清单（P0/P1/P2 → 本仓库 v2）

状态：`hku-campus/2.0` 已实现并验收。协议与传输层（`/events/stream`、`/path`、`/world`、15 个 MCP 工具）在 `src/agent/protocol.ts`、`scripts/agent-server.mjs`、`src/exploration/game.ts`；`perception.ts`/`pathfind.ts`/`directives.ts` 在 `src/agent/`、`src/exploration/`。headless 验收 `npx tsx scripts/check-ai-runtime.ts` 22/22 PASS；浏览器实测见 `docs/AI-NATIVE-V2.md` §9 与 `evidence/ai-native/native-demo.json`。【已确认，仓库内核对】

| 优先级 | 能力 | 为什么需要 | v2 落点 | 证据 |
|---|---|---|---|---|
| P0 | 稳定实体 ID + 结构化快照 | 一切语义引用的基础 | `observe` 的 landmarks/inventory/survey/lastCommand；`/entities` 查询 | SC2/Minecraft/Roblox 均如此 |
| P0 | 每帧感知 `perception` | 让"看见"变成可计算字段，而非画面 | `eye/forward/ground/probes/interactables/nearby/hud/target`；射线判遮挡 | ML-Agents sensor、Dota 可见性 |
| P0 | 事件流 + `afterSeq` | 实时性，且不轮询画面 | 契约 §6：WS 50ms 批量、512/2048 环形缓冲、SSE 补发 | Factorio events、MCP 增量思路 |
| P0 | 权限/epoch/人工接管 | 安全边界，人与 AI 共用控制器 | `controlEpoch`、`pausedReason`、失焦撤销 | 本仓库既有设计；Roblox 信任警告 |
| P1 | 语义动作 `directive` | 让 AI 说"走到 S001"而不是搓 move 向量 | `walkTo/approach/lookAt/followPath`，1–30000ms，`DirectiveSnapshot` | Voyager 的"代码即动作"同向 |
| P1 | 寻路 `path` | 语义动作需要可解释的路径与失败原因 | `/path` 的 A*、partial、`reason` | Mineflayer-pathfinder、Dota `MoveToLocation` |
| P1 | 世界摘要 `/world` + MCP resources | 上下文预热，省 token | `bounds/buildings/roads/areas/landmarks/survey/rules`；`hku://docs/*` | Roblox `search_game_tree`、ML-Agents Behavior |
| P2 | 回放/评测 harness | 可复现，才能比较 agent | 事件日志 + 初始快照 + 动作序列重放 | Factorio 锁步、SC2 回放、OSWorld 执行式评测 |
| P2 | 文本化 HUD/字幕 | 低成本补齐"屏幕上的字" | `perception.hud` ≤6 行；事件 `message` 字段 | NLE Language Wrapper |
| P2 | 限流与预算 | 防刷、控制成本、模拟公平 | `maxQueryLimit`、事件 limit、动作时长上限 | PySC2 的 APM fairness 讨论 |

一个具体的"AI 读什么"例子——v2 `perception` 的字段形状（契约 §3）：

```json
{"eye":[12.4,1.62,-30.1],"forward":[0,0,-1],"ground":"paving","underfootY":0.0,
 "probes":[{"distance":0.6,"supportY":0.0,"blocked":false,"stepUp":null,"drop":null}],
 "interactables":[{"id":"record-cds-entry","name":"CDS 入口记录","verb":"collect",
   "distance":2.1,"bearingDeg":-8,"inView":true,"lineOfSight":true,"reachable":true,
   "requiredDistance":2.7}],
 "nearby":[{"name":"B04","distance":9.3,"bearingDeg":15,"top":18.0}],
 "hud":["交互：按 F 采集记录"],"target":{"id":"record-cds-entry","actions":["collect"]}}
```

对比一下：要让纯截图 agent 得到"距离 2.1 米、视线无遮挡、可交互"这三个判断，它得先渲染、再分割/OCR、再估深度。原生接口直接给答案，且答案来自同一个碰撞世界。

## 5. 对 HKU 校园游戏的下一步建议

1. **评测集先于新功能**：把现有数字巡检做成脚本化任务（从出生点走到 S001、采集 3 条记录、提交），用执行式判分（参考 OSWorld 的 execution-based eval）。有了固定任务，接口改动才有回归意义。
2. **回放与确定性**：记录"初始快照 + 带 seq 的事件 + 动作序列"，支持重放到任意 tick；这是调试 agent 与做对比实验的基础（Factorio/SC2 的做法）。
3. **NPC 也要"感知"**：让 NPC 复用同一个 `perceive()`，并加听觉/视线档位；对玩家隐藏信息用"last-seen + 时间戳"（Dota `GetHeroLastSeenInfo`），避免 NPC 全知。
4. **音频事件化**：把 3D 音源（脚步、门、提示音）变成 `sound` 类事件 + 一句文本字幕，AI 就能"听"；比让模型分析波形便宜得多。
5. **世界摘要分层**：`/world` 已给建筑/道路/地标；再加"区域级摘要"和"当前目标摘要"两档，让模型按需取，减少上下文。
6. **限流与配额**：给事件订阅、`/path`、动作频率设预算（类似 PySC2 对 APM 公平性的讨论），防止 agent 刷接口拖慢渲染。
7. **观测诚实性分级**：提供"人类可见档"（只返回视锥内 + 视线可达 + 已发现的地标）与"调试全知档"，默认前者，评测用后者。MineDojo 的 privileged observation 就是这种分层。【已确认，MineDojo】
8. **保持截图可选**：`campus_screenshot` 只做人工核对与视觉回归；任何"必须截图才能玩"的路径都应视为接口缺陷。

## 6. 证据强度与未核实项

- **强（一手文档/论文）**：Factorio API/命令行/锁步、PySC2 观测与动作、Mineflayer/MineDojo/Voyager、OpenAI Five 观测规模、ML-Agents sensor 分类、Roblox MCP 工具表、OSWorld/GameNGen/SIMA 的数字。
- **中（间接但有出处）**：Roblox 2025 时间点（DevForum 存档，官方文档未标日期）；Godot/Unreal MCP 的定位（README 自述，未实测）；Minecraft MCP 生态成熟度（单项目例证，非官方标准）。
- **弱/推断**：截图派的延迟与 token 成本倍数（无统一基准）；SIMA 2 的具体输入输出模态（官方博客正文未能完整读取，按 SIMA 系列推断仍是画面+键鼠，[SIMA 2 博客](https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/)）；Factorio FLE 与游戏的底层 RPC 通道（README 未展开）。
- **本仓库相关**：v2 已实现并通过 headless（22/22）与真实浏览器验收；实测日志见 `evidence/ai-native/native-demo.json`、`evidence/scene-ai/live-mcp.json`，协议细节见 `docs/AI-NATIVE-V2.md`。

## 参考链接

- Factorio：[API Docs](https://lua-api.factorio.com/latest/) · [命令行](https://wiki.factorio.com/Command_line_parameters) · [Desync/锁步](https://wiki.factorio.com/Desynchronization) · [FLE](https://github.com/JackHopkins/factorio-learning-environment) · [FLE 论文](https://arxiv.org/abs/2503.09617)
- Minecraft：[Mineflayer](https://github.com/PrismarineJS/mineflayer) · [minerl.io/docs](http://minerl.io/docs) · [MineDojo](https://github.com/MineDojo/MineDojo) · [Voyager](https://voyager.minedojo.org/) · [minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server)
- StarCraft II：[PySC2 README](https://github.com/google-deepmind/pysc2) · [environment.md](https://github.com/google-deepmind/pysc2/blob/master/docs/environment.md) · [s2client-proto](https://github.com/Blizzard/s2client-proto)
- Dota 2：[Valve Bot Scripting](https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting) · [API 镜像](https://github.com/forest0xia/dota2bot-OpenHyperAI/blob/main/docs/BOT_API_REFERENCE.md) · [OpenAI Five 论文](https://arxiv.org/abs/1912.06680) · [OpenAI Five 博客](https://openai.com/index/openai-five/)
- Unity：[ML-Agents Theory](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.0/manual/ML-Agents-Overview.html) · [VectorSensor](https://docs.unity3d.com/Packages/com.unity.ml-agents@4.0/api/Unity.MLAgents.Sensors.VectorSensor.html)
- Roblox：[Studio MCP 文档](https://create.roblox.com/docs/studio/mcp) · [DevForum 存档](https://web.archive.org/web/20250928115512/https://devforum.roblox.com/t/introducing-the-open-source-studio-mcp-server/3649365)
- Unreal/Godot：[unreal-mcp](https://github.com/chongdashu/unreal-mcp) · [godot-mcp](https://github.com/Coding-Solo/godot-mcp) · [MCP 简介](https://modelcontextprotocol.io/docs/getting-started/intro)
- 反例：[SIMA 论文](https://arxiv.org/abs/2404.10179) · [SIMA 博客](https://deepmind.google/blog/sima-generalist-ai-agent-for-3d-virtual-environments/) · [SIMA 2](https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/) · [OSWorld](https://arxiv.org/abs/2404.07972) · [GameNGen](https://arxiv.org/abs/2408.14837) · [Claude computer use](https://docs.claude.com/en/docs/agents-and-tools/computer-use)
- 文本化观测：[NLE](https://github.com/NetHack-LE/nle)
