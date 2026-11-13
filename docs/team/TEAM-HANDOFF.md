# HKU Shanghai 校园探索游戏 · 四人分工与 Agent 交接

版本：2026-11-13 / 团队实施草案。基于现有 v5 工程（`ceb7375`）。

**怎么使用：** 四人先读本文，再把对应 `tasks/*.md` 和本仓库一起交给各自 Agent。不能只把任务文件发给一个无法访问仓库的 Agent，并假设它已拿到代码。职责是建议方案；NPC 名称、谜题与剧情梗概均为提案，尚未成为正式设定。

## 1. 四个人分别负责什么

| 成员 | 主责 | 必须交付 | 需要谁配合 |
|---|---|---|---|
| **Frost** | 叙事设计、世界观、NPC 人设与对白内容 | 首章流程图、3份NPC角色卡、线索与台词、两种结尾、结构化剧情数据 | 与Harry确认谜题逻辑，与WHL确认角色表现 |
| **Thomas（你）** | 校园场景、探索基础、技术整合与版本发布 | 实景依据、互动点空间位置、通路与碰撞、灯光/性能、可运行整合版本 | 接收Harry的谜题模块和WHL的NPC/界面模块 |
| **Harry** | 谜题玩法、任务状态、LLM对话服务 | 2个可独立验证的谜题、任务推进/存档、离线对白适配器、可选LLM接入与测试 | Frost提供剧情与线索；Thomas提供场地；WHL提供交互入口与界面 |
| **WHL** | NPC角色资产、NPC行为、玩家交互与叙事界面 | 3个可辨认NPC、待机/交谈动作、靠近交互、对话框、任务日志、提示与反馈 | Frost提供人物设定；Harry提供任务/对话接口；Thomas确认出生位置 |

**WHL 的核心工作是让“校园里有人、玩家知道怎么和人及线索互动”，不是只负责测试或零碎美术。** WHL 同时负责 NPC 到界面的完整体验验收；所有人仍对各自模块负责测试。

Thomas 和 Harry 都参与场地开发，但按层次拆开：Thomas 改建筑、地形、道路、碰撞及实景布局；Harry 做场地里的谜题装置、终端逻辑和交互状态。Harry 用局部原点制作可放置装置，由 Thomas 把它放到校园里，不直接重排建筑。

### 决策归属

- 故事事实、人物动机、对白口吻：Frost。
- 谜题是否成立、任务能否推进、LLM允许知道什么：Harry；故事含义与Frost确认。
- 场景位置、真实建筑对应、碰撞、性能和发布：Thomas。
- NPC视觉与动作、交互提示、对话与任务界面的可用性：WHL；人设与Frost确认。
- 一项改动涉及两个人时，原模块负责人合并；有冲突先给出具体差异和影响，不让两个Agent各自覆盖。

## 2. 已有工程，和还没有的东西

仓库：<https://github.com/ThomasLin070217/hku-shanghai-campus>（私有）。技术栈：Vite + TypeScript + Three.js；本机 AI bridge 为 Node + HTTP/WebSocket。

```sh
npm ci
npm run play
# 浏览器打开 http://127.0.0.1:5174
```

已实现：校园方块模型、绿色长袍玩家、第一/第三人称、跑跳与碰撞、日夜切换、模型浏览/导出、外部Agent操控玩家的接口。5号楼4楼阶梯休闲区是独立剖视参考资产，**没有接入可步行室内**。

尚未实现：故事系统、NPC交互系统、任务/谜题状态机、NPC LLM对话、剧情存档。下文描述的是要开发的目标，不能把它们写成现成功能。

先读：`README.md`、`VIDEO-DETAILS-V5.md`、`AI-INTERFACE.md`，以及当前任务涉及的源文件。新增场地必须区分“真实资料确认”与“2035年虚构剧情布置”。门、玻璃和建筑外墙继续封闭。

**特别注意：** `src/agent/*` 与 `scripts/agent-server.mjs` 的现有接口是外部Agent控制玩家移动。它不是 NPC 对话服务。NPC 对话及游戏任务不要复用玩家的 `acquireControl`，更不要为了聊天抢走玩家移动控制权。

## 3. 首轮范围：先交付一个完整的小章节

以下是建议的首轮范围，开始时由四人确认；未收到替代范围前，Agent可依此做可撤换的原型：

- 单人、室外、约10–15分钟；不是四名玩家在线联机。
- 3个NPC、2个谜题、1条主任务链、1次有明确结果的选择。
- 路线：CDS-1入口 → 中央步道附近 → 北侧运动区域 → 室外终端。具体互动坐标由Thomas核查。
- 玩家看到目标 → 交谈获取线索 → 观察环境并解谜 → 状态改变 → 反馈与结尾。
- 不接付费模型也能完整通关；真实LLM是可选增强。
- 本轮不做战斗、建造/破坏、多人联机、完整背包经济、全校园室内、无限自动生成支线。

### 建议的 NPC 原型（虚构，不影射真人；由 Frost 最终定稿）

| 稳定ID | 暂定角色 | 游戏作用 | WHL的视觉区分 | Harry的对话约束 |
|---|---|---|---|---|
| `npc.student.guide` | 学生联络员，暂名「林知」 | 交代当前目标、引导首次交互、根据进度提醒 | 绿色长袍、短发、浅色斜挎包 | 只知道当前任务公开信息；提示分级，不直接泄露后续谜底 |
| `npc.campus.tech` | 校园设施技术员，暂名「陈工」 | 提供设施线索、确认第一个谜题的结果 | 蓝灰工装、工具袋、完整发型 | 只解释已设计的设施规则，不虚构新通道或新钥匙 |
| `npc.terminal.echo` | 固定服务终端的AI人格，暂名「Echo」 | 接受验证结果、提供最后的剧情选择 | 原创方块终端与状态灯，不需要人形身体 | 已知信息与可信程度由Frost定义；实际解锁由确定性逻辑执行 |

Frost 为每个角色写：身份/动机、知道什么、不知道什么、秘密、说话风格、初见与通关后的变化、失败时的提示；WHL据此实现造型与表现。第3个NPC可以是非人形终端，避免把全部资源花在3套复杂骨骼上。

### 建议的两个谜题（可替换设计）

1. `puzzle.route-order`：观察3处虚构应急导视，推断校内通信节点的正确顺序。线索用符号+文字，不能只靠颜色；镜头曝光或真实楼牌模糊不应影响解答。
2. `puzzle.relay-restore`：按已获得的设施规则操作室外模拟中继终端；规则明确、有失败反馈、可重置，无不可逆软锁。

不是让LLM临时编谜底。Frost定义故事意义与线索文案，Harry定义输入/正确答案/前置条件/验证，WHL提供观察与操作界面，Thomas安排可达位置。

## 4. 代码与文件边界

这些目录有些尚不存在，应按分工新增；它们是所有权约定，不是现有实现声明。

| 负责人 | 首轮主要编辑区域 | 不直接修改的共享区域 |
|---|---|---|
| Frost | `docs/story/`、`content/story/`、`content/npcs/` | 主循环、物理、模型、服务端 |
| Harry | `src/gameplay/`、`src/dialogue/`、`src/props/puzzles/`、`server/dialogue/`、`scripts/check-gameplay*` | 校园基础几何、玩家控制器、NPC界面样式、Frost的正式内容 |
| WHL | `src/npc/`、`src/interaction/`、`src/ui/narrative/`、`assets/npcs/` | 任务权威状态、谜题判定、LLM服务、校园总体布局 |
| Thomas | `src/model/`、`src/exploration/`、`src/viewer/`、`src/integration/`、`references/` | 不重写队友模块内部实现；通过公开接口集成 |

**共享入口归 Thomas 整合：** `src/main.ts`、全局 `src/style.css`、`package.json`/lock、Vite配置、`scripts/start.mjs`。其他人如确需改动，提供最小接线补丁/导出函数和理由，由Thomas合并。模块自带局部CSS，避免无作用域的 `button`、`canvas`、`body` 样式。

**共享契约：** Harry先草拟 `src/contracts/narrative.ts` 和内容Schema，Thomas与WHL审阅后作为共同基线。此文件冻结后由Harry维护版本；不要每个分支都生成另一套不兼容类型。Frost先写Markdown和示例JSON，无须等待Schema才能创作；Harry负责帮助映射并验证数据。

每人独立克隆/分支开发，建议：`feat/story-ch1`、`feat/world-integration`、`feat/puzzles-dialogue`、`feat/npc-interaction`。不要让四个Agent在同一工作目录改同一分支。不强推、不自动合并、不默认把新依赖全量升级。

## 5. 模块之间怎样连接

Thomas在现有场景与主循环中挂载模块。WHL检测交互目标并提交事件；Harry检查状态、推进任务与谜题；WHL读取状态并显示反馈。Frost提供内容；模型输出不直接改游戏状态。

```text
Frost 内容 ──→ Harry 内容校验/任务与对话运行时 ──→ WHL 对话/任务界面
                       ↑                               │
                 校验交互事件 ←── WHL NPC/终端交互 ──────┘
Thomas 提供场景、合法锚点、玩家位置与统一挂载/卸载
```

下面是**待实现的 v0 契约建议**，不是可以直接调用的现有API。Harry应补齐类型及运行时校验，再由其余人使用。

```ts
type InteractEvent = {
  schemaVersion: 1;
  eventId: string; // 一次逻辑交互唯一，重发不重复发奖励/推进
  actorId: 'player';
  targetId: string; // npc.* / clue.* / terminal.*
  action: 'talk' | 'inspect' | 'submit';
  payload?: { optionId?: string; answer?: string[] };
};
type ProgressSnapshot = {
  schemaVersion: 1;
  revision: number;
  chapterId: 'chapter.01';
  stageId: string;
  flags: string[];
  discoveredClueIds: string[];
  puzzleStates: Record<string, 'locked' | 'available' | 'solved'>;
};
type InteractionResult = {
  eventId: string;
  accepted: boolean;
  reason?: 'out_of_range' | 'invalid_state' | 'invalid_payload' | 'unknown_target';
  feedbackKey: string; // 内容里的稳定键，而非LLM随意编造的系统指令
  snapshot: ProgressSnapshot;
};
type DialogueRequest = { npcId: string; text: string; conversationId: string };
type DialogueReply = {
  npcId: string;
  text: string;
  hintLevel: 0 | 1 | 2;
  source: 'scripted' | 'llm';
};
```

接口行为约定：

- `dispatchInteraction(event)` 返回 `InteractionResult`；`getSnapshot()` 和 `subscribe(listener)` 提供状态及取消订阅能力。禁止UI直接写flags或调用“强制解锁”。
- Harry验证目标存在、前置条件、答案、玩家与目标距离；位置从Thomas提供的受信游戏上下文读取，不信任事件自报坐标。单机验证不是联网反作弊承诺。
- 重复 `eventId` 返回第一次处理结果；未完成前置条件的终端提交被拒绝。失败不销毁必要线索，所有谜题可重试。
- `DialogueRequest`只提交身份与玩家输入，服务侧从受控会话/内容上下文构造可公开的事实，不接受前端自报“已通关”作为权威。首轮全部任务仍可在本地确定性运行。
- `DialogueReply`只影响表达，不带可执行JS、坐标、奖励或解锁指令。选项、任务变化仍通过校验后的交互事件实现。
- 对话UI打开时，Thomas提供统一“暂停玩家输入/恢复输入”的钩子；WHL使用它，不自己伪造键盘事件。Esc先关对话，再按原游戏暂停规则处理。恢复必须清空旧按键，不自动前进。
- 外部Agent已控玩家时，打开对话应撤销其控制权并使旧epoch失效；关闭对话不自动重新授权。沿用现有安全接管规则。
- NPC原型用固定站位、待机和转身交谈即可；若加巡逻，必须基于现有可走区域/碰撞，不使用玩家AI接口抢控制权。本轮不依赖全校园寻路。
- Thomas提供稳定锚点ID与位置/朝向：`anchor.spawn.cds1`、`anchor.npc.guide`、`anchor.npc.tech`、`anchor.terminal.echo`、`anchor.clue.route.01`至`.03`。锚点坐标未确认前，各模块使用自己的小型演示场景，不伪称已经接进校园。
- `B04` 是现有CDS-1 ID，`B05`是5号楼；米制估算、Y向上，+X约东、-Z约北。楼号/空间证据见旧参考资料，不能把估算当测绘事实。

### LLM职责和失败处理

Harry先做 `ScriptedDialogueAdapter`，再做可选 `LLMDialogueAdapter`。LLM负责把允许公开的事实说得自然、按角色口吻回答和适量提示；**不负责判谜底、改状态、生成关键道具或决定碰撞**。

真实模型的key只留服务端环境变量，不能用 `VITE_*` 暴露到前端、提交Git或进入日志。请求有限时、长度和频率上限；断网、无key、超时、格式错误均回落固定对白。默认不持久保存自由输入的原文；演示/调试日志不包含密钥。首轮无需指定付费供应商。

## 6. 按什么顺序交付

这是依赖顺序，不是未经确认的工时承诺。

### 阶段 A：内容与接口基线

Frost交首章梗概、NPC卡、线索列表；Harry交契约、任务状态图与离线对白骨架；Thomas交可达路线与锚点；WHL交一名NPC外观草模和对话UI演示。四人核对一次命名与ID。

**通过标准：** 从出生点到结尾的路径能说清楚，每个任务节点知道谁触发、谁判定、谁显示；关键ID没有歧义。

### 阶段 B：离线完整通关

接入3个NPC、2个谜题、任务日志、反馈、存档/重开。不依赖网络和LLM，能从头到尾玩完。

**通过标准：** 第一次玩的人不靠开发者口头解释能完成主线；乱序/重复交互不坏档，错误答案可重试，刷新能恢复进度，旧存档有明确版本处理。

### 阶段 C：角色与叙事打磨

Frost定稿台词；WHL统一外观/动作/阅读体验；Harry加入可选LLM与降级；Thomas处理灯光、碰撞和性能。

**通过标准：** 无key/断网仍可通关；对话不泄露未解锁剧情或授权系统操作；NPC不挡住必经道路；对话切换不导致人物继续走动。

### 阶段 D：联合验收与交接

各人开一个PR，说明“改了什么、怎么运行、实测了什么、仍缺什么”，附截图/短视频和示例数据。Thomas审阅共享入口并发布整合版本。

## 7. 统一验收清单

- 运行 `npm run build`；涉及角色/输入/状态时运行 `npm run check:v4`。
- 场景/碰撞改动运行 `npm run check:geometry`、`npm run check:video`，需要时复测下沉坡道。
- 新资产导出时做GLB重载及格式检查；不要求纯文案改动重新生成全部模型。
- Harry新增有效的状态转移、事件去重、错误答案、存档恢复与LLM降级测试；不能只有照抄实现的测试。
- WHL实测：3个NPC可识别、E交互、对话打字不走动、关闭对话不粘键、Esc行为、任务日志刷新、未知目标安全处理。
- Thomas实测：完整流程可达、不穿墙、不被NPC堵死；第一/第三人称、跑跳、日夜切换与导出未回归。
- Frost逐节点检查：线索足以推出答案、人物知道的内容不越界、结尾回应玩家选择。不要让玩家必须猜作者脑中的唯一词语。
- 未能实际运行的项目明确写“未验证”，不把编译成功写成完成体验验收。

## 8. 发给各自Agent的文件

- Frost：[`tasks/FROST.md`](tasks/FROST.md)
- Harry：[`tasks/HARRY.md`](tasks/HARRY.md)
- Thomas：[`tasks/THOMAS.md`](tasks/THOMAS.md)
- WHL：[`tasks/WHL.md`](tasks/WHL.md)

仓库权限：Harry为已确认账号 `onezion12344`，已发送write邀请，是否已接受需本人确认。Frost和WHL的GitHub账号尚未提供；不要猜账号或把仓库改成public来绕过权限。成员只拿到本文时可先做文案/接口草案；涉及工程实现时应先取得正确仓库访问权限。
