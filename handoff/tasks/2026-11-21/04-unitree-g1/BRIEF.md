# BRIEF 04 · 宇树 G1（给执行者的事实底稿）

基线：`main @ 41dedea6dda94ac9ac57f9da56d90ca2c551ec4d`，2026-11-21。

## 1. 现状

- `content/npcs/unitree-helper.json`（581 B）：
  ```json
  {
    "schemaStatus": "draft-awaiting-runtime-schema",
    "id": "robot.helper.unitree",
    "displayName": "宇树机器人助手",
    "workingNickname": "阿树",
    "role": "未感染的四足机器人助手",
    "commands": ["follow", "scan", "distract"],
    "brandStatus": "team-proposal-pending-confirmation"
  }
  ```
- `docs/story/npc-bible.md`：控制中心解密后启动“没被感染的四足机器人”，可用跟随/扫描/牵制。
- `docs/story/chapter-01.md`：同一设定；第一章 Boss 战用“牵制”。
- `src/` 中没有 unitree/G1 代码、模型、音效、指令 UI 或存档字段。
- 开场世界是 `src/opening/world.ts` 程序化构建；`createOpeningWorld()` 返回 `{root, bus, dinner, office, ...}`。

## 2. 为什么需要先定案

“宇树助手”在文档里是**四足**；用户这次说的是**宇树 G1 人形**（1.32 m）。这是两种角色：

| 方案 | 结果 | 风险 |
| --- | --- | --- |
| A. 保留四足阿树，新增 8 台 G1 展示机组 | 剧情不变，开场多一批人形展示机 | 需要解释为什么学校有两批宇树 |
| B. 把阿树改成 G1 人形 | 设定统一 | 要改 npc-bible/chapter-01/内容 JSON，且第一章“四足”描述全部要改 |
| C. 只做 1 台 G1，不做 8 台 | 成本最低 | 开场“AI Labs 展示机组”的气氛弱 |

默认按 A 做；如果 owner 选 B，必须同时改文本，不能只换模型。

## 3. G1 官方数据（用于比例，不用于复制资产）

来源：
- https://www.unitree.com/g1
- https://github.com/unitreerobotics/unitree_ros/tree/master/robots/g1_description （URDF/STL，BSD-3）
- https://github.com/isri-aist/g1_description
- G1 Basic/EDU Datasheet（官方 PDF）
- 用户手册第 7 页有带尺寸机械图

关键尺寸：

| 项 | 数值 |
| --- | --- |
| 站立 | 1320 × 450 × 200 mm |
| 折叠 | 690 × 450 × 300 mm |
| 重量 | ≈35 kg |
| DoF | 23（EDU 23–43） |
| 腿长 | 0.60 m |
| 行走速度 | > 2 m/s |
| 骨盆/髋/膝/踝高 | 785 / 682 / 350 / 33 mm |
| 肩高/头顶 | 1077 / 1320 mm |
| 躯干 | 150 × 215 × 310 mm |
| 头 | 140 × 156 × 206 mm |
| 大腿/小腿 | 180 × 89 × 226 / 104 × 72 × 355 mm |
| 脚 | 208 × 76 × 59 mm |
| 手 | 132 × 67 × 106 mm |

视觉：白壳、黑关节、蓝色面灯/胸灯。官方模型/STL 可以看比例，但**不要直接导入**；本项目是像素/blocky 风，需重做低模。

## 4. 开场放置的坐标参考

`src/opening/spatialLayout.ts`：

- B5：`x0 54, x1 82, z0 -80, z1 -54.7`，门 `x=58, z≈-54.7`，晚宴厅在进门右转。
- B6：`x0 1, x1 10, z0 -62, z1 -52.625`，floor 5.1，门 `x=4`。
- B4 交接点 `O.handoff = [58, 0.08, 25]`。
- 安保机器人入口列队：`O.robotFormation`，x 55.3 与 60.7，z -53.2…-47.8。
- 玩家主路线：bus (64.4,30.9) → B5 门 (58,-54.7) → B6 → 回 B5 → B4 (58,25)。

放置要避开这些线和门洞；建议 G1 在 B5 门厅两侧靠墙、B4 前庭靠花池/立柱，不站在路中间。

## 5. 渲染预算

- 每台 ≤25 个盒体/胶囊；共享 geometry/material；每台合并到 2–3 个 draw call。
- 不加点光源；最多一个自发光面灯。
- 建议只让最近 2–3 台 `castShadow`，远处关闭。
- 8 台总 draw call 增量 ≤24；不要复制 8 份材质/几何。
- 可以用 `BufferGeometryUtils.mergeGeometries` 或项目现有 `compact()`（`src/opening/world.ts` 里使用）合并静态部件。

## 6. 待机行为

- 呼吸/重心轻微摆动（sin，幅度 < 1°）。
- 玩家在 5 m 内时头部看向玩家（限制 yaw/pitch，不要整机转）。
- 不做寻路、不做碰撞移动；可以没有碰撞，但放置不能挡路。
- 被玩家靠近时不弹 UI、不触发任务、不发声音（可选很轻的 servo 待机声，但不要新增常开循环）。

## 7. 检查与证据

- `npm run check:opening`（state/robot/fleet/runtime/atmosphere/world/integration/reference/npcs）
- `npm run check:all`
- `npm run scene:opening`（若新增编号）
- `npm run export:glb && npm run validate:glb`（若进入导出）
- 截图：B5 门厅、B4 前庭、与安保机器人同框。
- 现有参考照片：`references/event-20260830/`（内部资料，不要外发；如包内没有，按尺寸建，不要凭照片猜比例）。

## 8. 边界

- 不用官方 logo/商标/模型/贴图；授权未确认时用原创名称。
- 不改安保机器人 AI；不把 G1 接进追捕/战斗。
- 不改 `state.ts`/`persistence.ts`；如果做剧情助手，才需要新增运行时与存档字段，且要先与第一章负责人确认。
- 不改变开场主路线碰撞；新增静态物体不得挡路。
