# 任务 05 · 开场路线建模优化（像素风，不换引擎）

你是本项目的独立 3D 建模/场景实现 Agent。仓库是私有的 HKU Shanghai Campus（Vite + TypeScript + Three.js，像素/blocky 风），基线 `main @ 41dedea`。先读 `AGENTS.md`、`docs/AI-START.md`、`docs/modeling-reconstruction-report.md`、`docs/opening/NOV19-CORRECTIONS-TODO.md`，再读随包 `BRIEF.md`。直接改代码、重新导出、交同机位截图，不要只回复方案。

## 一、要解决的问题

用户要求“优化建模”。当前开场路线里最弱的是**校巴内部**：4 张平板座椅、空白侧墙/顶棚、没有司机区/仪表台/扶手/行李架/踏板细节；玻璃从车内看像实心绿墙；B5 晚宴厅虽然有拱顶/长桌/校徽，但仍是“临时 2030 布景”；B6 办公室只有桌子/柜子/一台电脑。请做一次**开场 10 分钟路线的建模质量 pass**，保持现有像素/blocky 风格，不换引擎、不引入写实资产。

## 二、已核对的现状（2026-11-21）

- 程序化开场世界：`src/opening/world.ts`
  - `buildBus()`：车身/玻璃/门/轮/座椅/扶手/招牌/目的地牌；座椅只有 4 组“座面+靠背+一条腿”，没有坐垫/头枕/扶手/椅腿细节；顶棚是整块 ivory；没有司机隔断/仪表台/方向盘/行李架/轮拱/踏板井。
  - `buildDinner()`：木地板、米白墙、深木端墙、连续拱顶、拱肋、吊灯、长桌、绿桌布、椅、校徽、讲台、横幅；但家具/布景偏“方块临时”，缺少坐垫、椅背弧线、桌面餐具层次、窗帘/门厅细节。
  - `buildOffice()`：地板、柜子、绿植、桌子、MacBook、纸；没有椅子/窗/线缆/架子/灯罩细节。
  - 巴士玻璃：`glassMaterial('clear')` + `DoubleSide`；车内看是整片绿色，缺少框架/橡胶/反光层次。
- 开场渲染基线（Chrome headless，1440×900，进入巴士后第一视角）：`renderer.info.render.calls ≈ 928`、triangles ≈ 184k、geometries ≈ 1891、textures ≈ 87。这个数字包含车外校园，不是巴士单独；但可以作为“不能明显变差”的上界参考。
- 场景编号/authorKey：`src/scene/authoring.ts` + `registry.ts`；`tag()` 给部件命名。新增/改名必须保留既有 `authorKey`，重复件 append-only；不要用 Three.js UUID 当编号。
- 导出：`npm run export:glb`（`assets/HKU-Shanghai-Opening.glb` 等）、`npm run validate:glb`、`npm run scene:catalog` / `scene:opening`。

## 三、优先级（按玩家实际看到的顺序）

### P1 校巴内部/外部（截图里的第一眼）

- 座椅：坐垫/靠背厚度、头枕、扶手、椅腿/支架；4 组座椅的朝向和间距合理；靠窗一侧不要穿模。
- 车厢：顶棚分块/灯带、侧墙软包、地板/通道、轮拱、踏板井、车门内侧机构、扶手/拉手、行李架（如果画面允许）、司机隔断/仪表台/方向盘/后视镜（从车内可见的部分）。
- 车门：门框/密封条/玻璃/把手/踏步，开门后从车内能看到车外；不要变成实心墙。
- 玻璃：从车内看应有框架、橡胶、轻微反射/透明度，而不是整块绿色；不要为了“看得透”把玻璃改成完全无材质。
- 第一人称手臂：实机截图里画面底部有两块很大的米色斜板/白袖口，来自 `src/characters/character.ts::createFirstPersonArms()`；检查 viewmodel 的缩放/位置/近裁剪面，让手留在画面下缘、不遮挡请柬。若只改 `world.ts` 解决不了，先报告，不要擅自重写角色系统。
- 外观：轮毂/轮拱、门缝、侧裙、前后灯、车顶空调/通风、`HKU SHUTTLE` 招牌、目的地牌。
- 保留：车身沿 X、车门朝北、平行停靠 R009、碰撞/可走面/台阶高度不变。

### P2 B5 门厅/晚宴厅

- 入口玻璃/门禁/门厅/右转进入大厅的空间关系；玻璃不要做成实心墙。
- 长桌/椅子：坐垫/椅背/桌腿/桌布垂坠/餐具层次；主通道和桌间通道不能被装饰堵住。
- 拱顶/拱肋/吊灯/壁灯：保持低面数，但轮廓更接近 4380 参考；灯的数量不要增加太多。
- 端墙校徽/讲台/横幅/舞台：位置与比例按现有 `DINNER_LAYOUT`，不要臆造细节。
- 正常/异常两态：翻倒椅、遗留物、灯光变化；不能堵逃离路线。

### P3 B6 办公室/走廊

- 桌子/椅子/柜子/窗/百叶/线缆/纸/电脑底座；让“取电脑”的房间像一个真实办公室，而不是空盒子。
- 如果时间允许，B6 走廊加一点灯/指示牌/门牌，但不要新增碰撞体。

### P4 沿途细节

- 铺装/路缘/花坛/灌木/指示牌，按 `docs/opening/NOV19-CORRECTIONS-TODO.md` 的 T17 执行；不要侵入行走路线。

## 四、硬约束

- **风格**：像素/blocky、低面数、纯色/程序化纹理；不要引入写实 PBR 扫描、外部 GLB 角色、未经授权贴图。
- **碰撞/导航**：不改变玩家可走面、台阶高度、门洞宽度、巴士碰撞；新增细节不得挡路。若必须改碰撞，同步改 `src/opening/navigation.ts`/`groundLayout.ts` 并跑路线检查。
- **编号**：保留 `authorParts`/`sceneId` 元数据；已有重复件顺序 append-only；改名/插入必须提供旧→新迁移表。
- **性能**：静态部件用 `compact()` 或合并几何；同机位 draw call 不得比基线增加超过 ~10%；不要给每个小件新建材质；纹理 ≤1024；灯光数量不增加（除非用现有灯替换）。
- **导出**：改了开场几何后跑 `npm run export:glb && npm run validate:glb`；跑 `npm run scene:opening` + `npm run scene:catalog`；检查 `assets/scene/opening-catalog.json` 的编号/范围变化。
- **不要动**：机器人 AI、音频、MacBook UI、任务/存档、其他成员关卡。

## 五、验收（必须实际执行）

1. `npm run check:opening`
2. `npm run check:all`
3. `npm run scene:opening`、`npm run scene:catalog`
4. `npm run export:glb && npm run validate:glb`
5. 同机位截图（1440×900，第一人称）：
   - 巴士内部（spawn 视角，含座椅/门/仪表台）
   - 巴士外部（南侧/北侧门）
   - B5 门厅/晚宴厅（正常/异常各一张）
   - B6 办公室
6. 性能记录：同机位 `renderer.info.render.calls/triangles`、`geometries/textures`，改前/改后各一次；不要只写“变好了”。
7. 路线：巴士→B5、B5→B6→B5、B5→B4 仍可走；不使用改坐标替代。

## 六、交付

- 修改文件、部件清单、新增/改名的 authorKey 与迁移表（如有）。
- 改前/改后同机位截图 + 性能数字。
- 检查/导出/validate 输出。
- 未验证的尺寸/角度明确标注“估算”，不要写成实测。

## 七、需要 owner 确认（不阻塞开工，先按默认）

1. “优化建模”的范围：默认 **开场路线 P1–P4**，不是全校园。若要做全校园，另开任务。
2. 巴士座椅布局：默认 **4 组**（现有），只加细节，不改变可走通道。
3. 是否允许新增外部 CC0 纹理：默认 **只用程序化/现有材质**，不新增外部贴图。
