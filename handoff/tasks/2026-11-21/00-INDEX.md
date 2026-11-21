# 2026-11-21 · 五项优化任务的分发包

给 owner 的用法：每个任务有 **一份可直接转发的 Prompt** + **一份事实底稿 BRIEF** + **一个 overlay 包**。对方有仓库权限时，发 `PROMPT.md` + `<slug>-pack.zip` 即可；没有权限时，先给只读仓库权限或让对方按 `BRIEF.md` 里的文件清单阅读，不要把整个 4.8 GB 工作目录打包发出去。

## 先检查到的结论（2026-11-21）

1. **音效**：巴士段目前只有合成的 wake/bus 两声 + `cc0_bus_engine_idle` loop + `mus_safe`；没有车内 room tone、座椅/踏板/车门气动、司机 PA，也没有车内外过渡。打开请柬的 0.42 s 急促纸张声已按 owner 确认删除（2026-11-21），打开动作现在静音。更关键的是 `CampusAudio.start()` 一次并发解码 58 个文件、单文件 10 s 超时，失败后永久标记；自动播放受限/慢机器上可能整段静音。`openingAmbience()` 在 StoryAudio 存在时是死代码。
2. **结尾**：`arriveB4()` 同帧 `transition + open('complete')`，直接弹交接卡；没有 letterbox/标题/镜头/stinger，且实测残留上一句 Staff 字幕。开头是 COD 式演出，结尾不是。
3. **机器人追踪**：`chaseSpeed 1.35` < 玩家 walk 2.6；丢失视线后只走 lastSeen、原地转 3 s 就放弃；寻路图只有每台自己的 4 个巡逻点 + 部署点 + B5 门节点，玩家在任意位置时图太稀疏，tail 直线容易 stall。8 台也无协同/听觉。
4. **宇树**：只有 `content/npcs/unitree-helper.json` 的四足“阿树”草稿；没有 G1 模型/运行时/指令 UI。G1 是 1.32 m 人形，和四足设定冲突，需先定“新增展示机组”还是“替换四足”。
5. **建模**：开场第一眼的校巴内部最弱（4 组平板座椅、空白顶棚、无司机区/仪表台/行李架/踏板井，玻璃像实心绿墙）；B5 厅已有拱顶/长桌/校徽但仍是临时布景；B6 办公室很空。当前巴士第一视角约 **928 draw calls / 184k tris / 1891 geometries / 87 textures**（headless 1440×900，含车外校园），可作建模预算基线。

> 另：用户截图里那只蓝色 `>_` 小机器人**不在仓库源码/资产里**（全仓没有对应模型/材质/加载代码），看起来是浏览器插件或桌面宠物的叠加层。如果它是你想改的对象，请单独说明；本批任务不处理它。

## 任务表

| # | 任务 | 包 | 建议交给 | 依赖 |
| --- | --- | --- | --- | --- |
| 01 | 开场巴士音效重做 + 加载可靠性 | [01-opening-bus-audio](01-opening-bus-audio/PROMPT.md) | 音频/交互工程师 | 无；可与 02 并行 |
| 02 | 结尾电影化（对齐开头） | [02-opening-ending](02-opening-ending/PROMPT.md) | 玩法/UI 工程师 | 需要 01 的 `cinema` 不冲突；可并行 |
| 03 | 安保机器人追踪算法 | [03-robot-tracking](03-robot-tracking/PROMPT.md) | AI/玩法工程师 | 与 01/02 独立；建议先做 |
| 04 | 宇树 G1 人形展示机组 | [04-unitree-g1](04-unitree-g1/PROMPT.md) | 3D 建模 + 集成 | 需要 owner 定数量/位置/绿袍 |
| 05 | 开场路线建模优化 | [05-opening-modeling](05-opening-modeling/PROMPT.md) | 3D 建模/场景 | 与 04 共用 `world.ts`，建议串行或同一人 |

## 建议排期

1. **03 机器人追踪**：用户最直接的“能跟住”诉求，且是纯逻辑，风险最低。
2. **01 音效**：玩家第一分钟的感受；先修加载失败，再做声场。
3. **02 结尾**：纯前端演出，依赖少。
4. **04 + 05 建模**：同一批 3D 工作，先做 05 的巴士内部，再做 04 的 G1，最后统一导出/截图。

## 包内容

每个 `<slug>/` 目录：

```
PROMPT.md              可直接复制给执行者
BRIEF.md               现状、代码位置、证据、边界（给执行者读）
<slug>-pack.zip        overlay：PROMPT + BRIEF + 相关源码/文档/截图 + BASELINE.json
```

`<slug>-pack.zip` 里：

```
READ-FIRST.txt
PROMPT.md
BRIEF.md
BASELINE.json          基线 commit、文件清单、sha256、排除项
overlay/...            相关源码/文档，保持仓库路径
evidence/...           相关截图/日志
```

它不是完整运行环境；需要私有仓库 `main @ 41dedea`。包内 `overlay/` 是 **HEAD 干净版本**，不包含本机未提交的 MacBook/voice 改动（当前工作区另有未提交改动，和这五项任务无关）。对方没有仓库时，**不要**把 `work/`、`references/`、`evidence/`、`dist-review/`、`node_modules/` 或 250 MB GLB 一起发；需要可运行源码包时单独打，不要把半包说成完整环境。

## 快速转发

- 只发文案：`all-task-prompts.zip`（40 KB，含本索引 + 5 份 PROMPT + 5 份 BRIEF）。
- 发单个任务：对应目录里的 `PROMPT.md` + `<slug>-pack.zip`。
- 校验：`SHA256SUMS.txt`。
- 基线状态（2026-11-21 本机）：`npm run check:opening` **PASS**、`npm run check:audio-review` **PASS**；`check:all` 未在本轮重跑。日志在对应包 `evidence/` 里。

## 需要 owner 先拍板的 4 件事

1. **机器人难度**：是否允许机器人追上步行玩家（建议 chase 2.4–2.8，sprint 5.2 仍能逃）？还是保持“慢速压迫、走路可甩”？
2. **宇树 G1**：8 台展示机组，还是 1 台剧情助手？放 B5 门厅/B4 前庭还是晚宴厅？穿不穿绿袍？四足“阿树”保留还是替换？
3. **音效**：司机提示是否允许用已批准的声音？默认只做 PA chime + 字幕。
4. **建模范围**：默认只做开场路线（巴士 → B5 → B6 → B4），不是全校园。

## 共用验收底线

- 不改 `/act` 协议、不写坐标/瞬移、不增加远端接口。
- 机器人仍走 `CharacterPhysics` / `Navigation`。
- 保留 `authorParts` / `sceneId` / 既有 `authorKey`。
- 每个任务至少跑 `npm run check:opening` + `npm run check:all`；涉及几何再跑 `export:glb` + `validate:glb`。
- 主观听感/真机连续试玩只能由人确认；执行者不能把“技术检查通过”写成“人工验收通过”。
