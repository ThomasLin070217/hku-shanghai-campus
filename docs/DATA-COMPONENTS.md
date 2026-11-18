# 前端可用数据组件清单

> 盘点时间：2026-11-18 · 范围：`src/` 前端层 + 仓库内既有数据资产
> 目标：回答"哪些数据组件现在就能用、哪些值得新写、要不要引外部库"。
> 外部图表库调研见 [DATAVIZ-LIBS.md](./DATAVIZ-LIBS.md)。

## 0. 前端结构速览

项目是 Vite + TypeScript + Three.js 0.181，纯原生 TS DOM 前端（无 React/Vue），像素 / 纸感视觉。前端共四层：

| 层 | 入口 | 已有界面 |
| --- | --- | --- |
| 模型浏览层 | `src/main.ts` + `src/viewer/*` | 楼栋侧栏、总览/顶视/南北/广场视角、编号标签层、导出工具 |
| 室外探索层 | `src/exploration/*` + `src/gameplay/experience.ts` | HUD、MacBook 终端面板（地图/任务/线索）、小地图 canvas、背包 |
| 场景编号层 | `src/scene/inspector.ts` | 编号搜索、结果列表、详情块、JSON 导出、3D 浮标 |
| 研究 / 档案页 | `src/ai-study.ts`、`references/index.html`、`interiors.html` | AI 重建对照、证据来源卡片、实录室内 |

## 1. 仓库内现成可用的数据组件（零新增依赖）

| 组件 | 位置 | 已经产出什么 | 复用方式 |
| --- | --- | --- | --- |
| 校园地图渲染器 | `src/gameplay/map.ts:4` `drawCampusMap()` | canvas 2D 地图：道路、楼栋矩形、地标点、玩家箭头；已同时服务小地图（240×280）与大地图（620×670） | 加一个图层参数即可画"道路覆盖率 / 步道热区 / 记录点连线" |
| 场景注册表查询 | `src/scene/registry.ts:59` `SceneRegistry.query()` | 已实现 `q` / `kind` / `parentId` / `near` / `radius` / `offset` / `limit` 过滤、分页与 `total`；与 `catalog.json` 同源（`scripts/scene-catalog.ts` 用同一个 `sceneRegistry` 导出） | 现成的"数据表后端"，只缺表格 UI |
| 场景编号面板 | `src/scene/inspector.ts` | 搜索框 + 结果列表 + 详情块 + 复制修改任务 + 导出 JSON + 3D 浮标 | 任何"带定位的清单"直接照抄这套结构 |
| 巡检快照 | `src/gameplay/survey.ts:49` `snapshot()` | `status` / `count` / `total` / `collectedClues[]` / `discovered[]` / `objectives[]` / `elapsedSeconds` / `target` | 进度类组件的唯一数据源 |
| 运行时观察载荷 | `src/agent/protocol.ts` `Observation` | 玩家位置与速度、survey、inventory、landmarks（按距离排序）、collisions、`world.revision`、`scaleCalibration` | 前端自己也能读（当前只有 AI 在用） |
| 模型统计 | `src/model/buildCampus.ts:260` `modelStats()` | triangles / meshes / 包围盒 size·min·max | 已显示在 `#stats`，可直接升级成指标卡组 |
| 背包网格 | `src/items/inventoryUI.ts` | 36 格网格、堆叠计数、拖拽交换、完整 aria 标签 | 任何"格子型数据"（资产清单、记录点）的现成范式 |
| 对话框工具箱 | `src/opening/ui.ts` | dialog shell、焦点陷阱、Tab 页、Slider、确认替换、Esc 关闭 | 新数据弹窗直接复用，不要另写一套 |
| DOM 写入工具 | `src/ui/dom.ts` | `setText` / `setHidden`（避免无谓重排） | 所有高频刷新文本都走它 |
| HTML 转义 | `src/main.ts:50` `escapeHTML` | 字符串转义 | 拼 innerHTML 表格时必须用 |

## 2. 仓库内已有的数据源（可直接喂给前端组件）

| 数据源 | 结构 | 规模 | 适合的组件 |
| --- | --- | --- | --- |
| `assets/scene/catalog.json` | `schema` / `revision` / `entities[]`（id、kind、parentId、authorKey、bounds、size、sourceFile、sourceAnchor、reference、confidence） | 16 MB / 18,306 条（building 7、road 14、area 19、group 245、part 18,020） | 离线编号全表。**不要进 bundle**，运行时用 `SceneRegistry` |
| `assets/HKU-campus-parameters.json` | `glazing`、`scaleCalibration`、`buildings[]`、`site` | 4.4 KB | 楼栋尺寸表、玻璃参数表、尺度校准卡 |
| `src/model/scaleCalibration.ts` | `SCALE_CALIBRATION`（id、horizontalStatus、verticalStatus、source、globalScaleFactor） | 常量 | 尺度状态卡（`Observation.world.scaleCalibration` 已透出） |
| `assets/gltf-validation.json` | 21 个 GLB × `issues`（numErrors/Warnings/Infos、messages[] 带 severity+pointer） | 182 KB | 校验结果表 + 问题严重度分布条 |
| `evidence/experience-fix/browser-route.json` | `samples[]`：t、player.position/velocity、collisions、motion、steps、landings、audio.counts | 733 KB | 走位轨迹图 / 时间轴 |
| `assets/voxel/logic-checks.json` | `results[]`：name + detail | 2.3 KB | 检查项通过表 |
| `references/campus-sources.json` | `references[]`：id、title、file、publisher、supports、uncertainty、sha256、dimensions | 逐条证据 | 来源证据表（`references/index.html` 已有卡片版） |
| `references/*.csv` | label,url,dest,status,bytes,partial_bytes,error | 数行到十数行 | 资源下载状态表 |
| `DELIVERY-*.json` | version/date/scope/measured/limits/checks | 1–4 KB | 交付指标卡、限制清单 |

## 2.5 已实现的数据组件（本轮 UI 优化）

| 组件 | 文件 | 用途 | 已接入位置 |
| --- | --- | --- | --- |
| `createStatTiles` / `createKeyValueList` | `src/ui/statTiles.ts` | 指标卡行（label / value / unit / note） | 场景编号面板顶部「数据概览」：全部 18,306 / 楼栋 7 / 道路 14 / 区域 19 / 细部 18,020 |
| `createBarList` | `src/ui/bars.ts` | 纯 CSS 分布条，支持 tone 与自定义 display | 同一面板「部件来源 · 按源码文件」Top 6 |
| `createProgressBar` | `src/ui/bars.ts` | 单条进度 + `role="progressbar"` + aria 数值 | 巡检终端任务页「校园记录 n/3 条记录」 |
| `createDataTable` | `src/ui/dataTable.ts` | 可排序 / 过滤 / 分页表格，支持行点击与选中态 | 场景编号面板「表格视图」（编号 / 名称 / 类别 / 体积，点行定位模型） |
| `escapeHtml` / `safeHtml` | `src/ui/dom.ts` | innerHTML 插值的统一转义 | 巡检地图页、任务页、线索页、档案页 |
| 样式 | `src/ui/dataComponents.css` | 纸感 + 像素边框，沿用 `--survey-*` 变量 | 全部上述组件 |

验证：`npm run typecheck`、`npm run check:all` 均为 0；截图见 [evidence/ui-data-components](../evidence/ui-data-components/)。

## 3. 建议新增的数据组件（都有明确落点）

> 全部基于原生 DOM / canvas，不引图表库；视觉沿用 `--survey-ink:#183f30`、`--survey-paper:#f3f2e5`、`--survey-green:#2d634c`。

### 3.1 通用数据表 `DataTable`（新文件 `src/ui/dataTable.ts`）
- 能力：列定义 + 行数据 + 排序 + 过滤 + 分页 + `aria` 语义 + 空态。
- 后端：直接用 `SceneRegistry.query()`（已支持 `q`/`kind`/`offset`/`limit`/`near`）。
- 价值：场景编号面板的结果列表、校验结果表、来源证据表共用一套。

### 3.2 指标卡行 `StatTiles`（新文件 `src/ui/statTiles.ts`）
- 能力：一行若干卡片，label + 数值 + 单位 + 可选趋势/说明。
- 数据：`modelStats()`（三角面/网格/包围盒）、`SceneRegistry.entities` 聚合（各类别数量）、`Survey.snapshot()`（记录数/耗时）。
- 落点：模型浏览层 `#stats` 旁，或终端面板顶部。

### 3.3 分布条 `BarList` / `StackedBar`（新文件 `src/ui/bars.ts`）
- 能力：纯 CSS 条形，用于"按 kind / 按 sourceFile / 按 severity"的计数分布。
- 不引库的理由：只有 3–8 个类目，CSS 条比任何图表库更轻、更贴像素风。

### 3.4 「校园数据」终端第四个 Tab
- 落点：`src/gameplay/experience.ts` 的 tabs 数组（现为 `map`/`tasks`/`clues`）→ 新增 `data`；实现放 `src/gameplay/dataPanel.ts`。
- 内容：编号统计 StatTiles + 楼栋尺寸 DataTable + 尺度校准卡 + 巡检进度条。
- 注意：`src/agent/protocol.ts` 的 `Action.computer` 枚举目前是 `'map'|'tasks'|'clues'|'submit'`，加 tab 需要同步放开该枚举。

### 3.5 进度步进器 `Stepper`
- 落点：`src/gameplay/experience.ts` 任务页（现为纯 `<li>` 列表）。
- 数据：`survey.snapshot().objectives[]`（每项含 `collected`）+ `status`。
- 价值：把"3/3 收集"从文字升级成可视化进度。

### 3.6 走位轨迹图（研究页，非游戏内）
- 落点：新增 `src/pages/route.html` 一类页面（或挂到 `evidence/v9/`）。
- 数据：`evidence/experience-fix/browser-route.json` 的 `samples[]`，画 x–z 轨迹 + 碰撞点。
- 形态：canvas 2D，跟 `drawCampusMap` 同风格即可，不需要折线图库。

## 4. 不建议做的事

- 不要引入 React/Vue：项目是原生 TS DOM，前端层全部手写 DOM。
- 不要把 `assets/scene/catalog.json`（16 MB）打进前端 bundle：运行时用 `SceneRegistry` 从场景图生成即可。
- 不要为了几个条形图引入重量级图表库（ECharts 等）：`BarList` + `StatTiles` 足够。
- 不要在终端页之外新增全局状态层：现有模式是"组件自己读 `game` 快照"，保持一致。

## 5. 外部库结论（详见 [DATAVIZ-LIBS.md](./DATAVIZ-LIBS.md)）

调研了 19 个候选（npm registry + Bundlephobia + jsDelivr 实测），结论：

- **唯一推荐引入：DOMPurify 3.4.18（11,490 B gzip，MPL-2.0 OR Apache-2.0）**。
  `src/main.ts:50` 已有手写 `escapeHTML`，但 `src/gameplay/experience.ts`（`c.title` / `c.text` / `s.archive.text`）、`src/scene/inspector.ts`（`e.name`）、`src/items/inventoryUI.ts`（`ITEMS[s.itemId].name`）的 `innerHTML` 插值未转义。落点：`src/ui/dom.ts` 增加 `safeHtml()`。
- **备选：uPlot 1.6.32（21,856 B gzip，MIT）**，仅当真的需要"距离 / 时长"时序曲线时。落点建议 `src/gameplay/dataPanel/`。
- **不引入**：ECharts（含 simple 版）、vega 全家、Chart.js、Observable Plot、Grid.js、Tabulator、TanStack Table core、SortableJS、Pico CSS、visx（React peer）。
  搜索 / 筛选 / 分页列表 / 网格 / 标签页 / 对话框 / 焦点陷阱 / live region 本项目已全部手写且 ARIA 正确，引入是零或负增量。

## 6. 落地时的两个工程约束（已核实）

1. `src/style.css` 有全局规则 `canvas{display:block;width:100%;height:100%;touch-action:none}`，**会命中任何新插入的 canvas**（图表 / 新画布）。现有代码已对 `#mini-map canvas`、`.terminal-map canvas` 做了覆盖，新增画布必须补同类规则，否则图表会被拉伸变形、滚轮手势被吞掉。
2. z-index 现状：`#mini-map`=4、`#scene-id-labels`=8、`#pause-panel`=12、`#control-badge`=14、`#scene-inspector`=22、`#inventory-modal`/`#campus-tools`=30、`#campus-panel`=40。
   新增数据面板放进 `#campus-panel`（第 4 个 tab）最省事，无需处理 z-index；若做成 `.stage` 内常驻挂件，z-index 必须 ≥ 5，否则被 WebGL 画布遮挡。

## 7. 体积基线（`dist/` 实测）

| 产物 | raw | gzip |
| --- | --- | --- |
| `main.js` | 228,878 B | 88,392 B |
| `three.js` | 766,297 B | 207,642 B |
| `main.css` | 47,001 B | 10,770 B |

uPlot 约等于 main chunk 的 +25%；DOMPurify 约 +13%。
