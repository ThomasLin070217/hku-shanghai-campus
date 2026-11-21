# 任务 04 · 宇树 G1 人形机器人（建模 + 开场展示）

你是本项目的独立 3D/玩法实现 Agent。仓库是私有的 HKU Shanghai Campus（Vite + TypeScript + Three.js，像素/blocky 风格），基线 `main @ 41dedea`。先读 `AGENTS.md`、`docs/AI-START.md`、`docs/story/npc-bible.md` 的宇树助手段、`content/npcs/unitree-helper.json`，再读随包 `BRIEF.md`。直接改代码、跑检查、交截图，不要只回复方案。

## 一、要解决的问题

用户希望开场里出现**宇树 G1 人形机器人**。目前仓库只有一份内容草稿（`content/npcs/unitree-helper.json`，设定是“未感染的四足机器人助手 阿树”），**没有模型、没有运行时、没有用法**。G1 是 1.32 m 的人形机，和现有四足设定是两种角色，不能直接替换掉剧情助手。

请做一批**低模、原创、可辨认的 G1 展示机组**，放进开场路线，并明确它与“阿树”四足助手的关系。

## 二、已核对的现状（2026-11-21）

- `content/npcs/unitree-helper.json`：`schemaStatus: draft-awaiting-runtime-schema`，`role: 未感染的四足机器人助手`，指令 follow/scan/distract，无口语对白，品牌状态 `team-proposal-pending-confirmation`。
- `src/` 内没有 unitree/G1 模块；`docs/story/npc-bible.md`、`chapter-01.md` 把助手写成四足，第一章控制中心解密后解锁，用来牵制狮子 Boss。
- 开场已有 8 台安保机器人（`src/opening/robot.ts` / `robots.ts`，红眼、巡逻/追捕），不要和 G1 混淆。
- 开场世界是程序化建模（`src/opening/world.ts`），不是 GLB；展示机组可以直接建在 `createOpeningWorld()` 里。
- 现有 G1 官方数据（下面第 3 节）足够做比例；官方没有 2D CAD/STEP，只有 URDF + STL（BSD-3），但**不要直接导入官方模型/贴图/商标**，按像素风重做。

## 三、G1 比例（建模用）

| 项 | 数值 |
| --- | --- |
| 站立尺寸（高×宽×厚） | 1320 × 450 × 200 mm |
| 重量 | ≈35 kg |
| 总自由度 | 23（EDU 23–43） |
| 骨盆 / 髋 / 膝 / 踝高度 | 785 / 682 / 350 / 33 mm |
| 肩高 / 头顶 | 1077 / 1320 mm |
| 躯干 | 150 × 215 × 310 mm（830–1140 mm） |
| 头 | 140 × 156 × 206 mm（1110–1320 mm） |
| 大腿 / 小腿 | 180 × 89 × 226 / 104 × 72 × 355 mm |
| 脚 | 208 × 76 × 59 mm |
| 手（橡胶手） | 132 × 67 × 106 mm |

视觉：白色外壳 + 黑色关节 + 蓝色面灯/胸部灯；可选的港大绿袍（Green Gown）由 owner 决定。不要使用 Unitree 官方 logo、官方 STL 或照片贴图。

## 四、必须实现

### A. 模型（默认 8 台展示机组）

- 新建 `src/opening/unitree.ts`，导出 `createUnitreeG1(options)`；在 `world.ts::createOpeningWorld()` 或 `experience.ts` 里实例化。
- 每台 1.32 m 站高，比例按上表；至少可辨认：头/面屏、颈、躯干、腰、肩、上臂/前臂/手、大腿/小腿/脚；关节处用深色，壳体白色，面灯蓝色自发光。
- 低模：盒体/胶囊为主，单台 ≤ 25 个部件；**共享几何/材质**，每台合并到 2–3 个 draw call；不要每台 new 材质/几何。
- 不加点光源；最多一个很弱的自发光面灯。阴影投射按预算（建议只让最近 2–3 台 castShadow）。
- 待机动画：轻微呼吸/重心摆动 + 头部在玩家 5 m 内看向玩家；不走路、不寻路、不参与追捕。若要“列队”，只做静态朝向。
- 每台有稳定 `userData.authorKey` / `name`（如 `Opening_g1_0` … `Opening_g1_7`），并进入场景编号；不要用 Three.js UUID 当 ID。

### B. 放置（默认，需 owner 可改）

- 4 台在 B5 一层晚宴厅入口两侧/门厅，4 台在 B4 前庭交接点附近；避开玩家主路线、门洞、碰撞体。
- 不要挡门、不要挡楼梯、不要和 8 台安保机器人的入口列队重叠。
- 若 owner 选择“只做 1 台助手”，则改为第一章控制中心的单台，不要做 8 台列队。

### C. 与现有设定/品牌的关系

- 默认方案：**保留“阿树”四足助手作为剧情助手**，新增的 8 台 G1 是“AI Labs 展示机组”，两者并存，不改变第一章解锁逻辑。
- 品牌：未确认授权前，显示名用 `G1-style humanoid` / `AI Labs demo unit`，不要写 Unitree 官方商标；代码/文件名可以用 `unitree` 作为内部标识，但 UI 文案要可切换。
- 若 owner 确认“把四足改成 G1”，则同步更新 `content/npcs/unitree-helper.json`、`npc-bible`、`chapter-01` 的设定；不要只改模型不改文本。

### D. 测试与元数据

- `npm run check:opening`
- `npm run check:all`
- `npm run scene:opening`（如果新增部件进入编号）
- 涉及导出几何：`npm run export:glb && npm run validate:glb`
- 新增检查（可写进 `check-opening-world.ts` 或新脚本）：8 台存在、身高 1.32±0.03、不挡主路线、draw call 增量在预算内、无点光源。
- 截图：B5 门厅、B4 前庭各一张；与安保机器人同框一张，能一眼区分。

## 五、文件边界

**可改：**
- 新增 `src/opening/unitree.ts`
- `src/opening/world.ts`（只加 G1 机组与放置）
- `src/opening/experience.ts`（只加待机/朝向更新）
- `src/opening/spatialLayout.ts`（只加 G1 放置常量，不动既有坐标）
- `content/npcs/unitree-helper.json`（仅在 owner 确认改设定时）
- `docs/story/npc-bible.md`、`chapter-01.md`（仅在确认改设定时）
- 相关检查脚本

**只读参考：**
- `src/opening/robot.ts`（安保机器人，不要改）
- `src/opening/robots.ts`
- `src/characters/`（角色骨架/动画参考，不要改）

**不要动：** 安保机器人 AI、任务/存档、UI、其他成员关卡、`/act` 协议。

## 六、验收

1. 8 台 G1 在开场可见，身高/比例可辨认，风格与像素校园一致。
2. 与安保机器人同框能区分：G1 白壳蓝面灯、无红眼/扫描扇区；安保机器人红眼/灰壳。
3. 不挡玩家从巴士到 B5、B5 到 B6、B5 到 B4 的路线；碰撞/导航不回归。
4. 性能：8 台总 draw call 增量 ≤ 24（每台 ≤ 3）；无新增常开点光；`check:opening`/`check:all` 通过。
5. 截图 + 一段 10 s 待机录屏；导出 GLB（若进入导出范围）并 validate。

## 七、交付

- 模型/放置/动画实现说明，文件列表。
- 8 台位置表、与四足助手的关系说明。
- 检查输出、截图/录屏。
- 品牌授权/显示名的未决项明确标注，不要假装已授权。

## 八、需要 owner 先确认（不阻塞开工，先按默认）

1. 数量：**8 台展示机组**，还是只做 1 台剧情助手？默认：8 台展示机组 + 保留四足阿树。
2. 位置：默认 **B5 门厅 4 台 + B4 前庭 4 台**；如要放晚宴厅内/入口列队，请给具体点。
3. 绿袍：默认 **不穿**；如要穿，给参考图/颜色。
4. 显示名：默认 **G1-style humanoid / AI Labs demo unit**，授权确认后再改。
