# 数据可视化 / 数据展示组件库调研（HKU 上海校园）

> 调研范围：可在本项目前端直接使用的轻量图表库、数据展示组件库与轻量 UI 组件库。
> 调研日期：2026-11-18。所有版本号 / 体积 / 许可证均通过 npm registry、Bundlephobia、jsDelivr 实际核实；
> 未核实的条目已在表中标注。**本次调研未安装任何依赖、未修改任何源码。**
>
> 项目约束（来自代码核实，非推测）：
> - Vite 7 + TypeScript 5.9（`module: ESNext`, `moduleResolution: Bundler`, `strict`），纯原生 TS，无 React/Vue。
> - 运行依赖仅 `three@0.181.2`、`@sparkjsdev/spark@2.4.0`、`ws`（见 `package.json`）。**当前没有任何图表/表格/UI 运行库。**
> - 构建体积基线（`dist/` 实测）：`main.js` 228,878 B raw / **88,361 B gzip**；`three.js` 766,297 B / 207,642 B gzip；`main.css` 47,001 B / 10,770 B gzip。
> - 视觉语言：纸感低饱和绿 `--survey-ink:#183f30` / `--survey-paper:#f3f2e5` / `--survey-green:#2d634c` / `--survey-line:#92a58e`，硬阴影 `3px 3px 0 #123c3147`，像素边框，物品图标 `image-rendering:pixelated`。
> - 无障碍要求已落地：`aria-*`、`role="dialog"` + `aria-modal`、Tab 焦点陷阱、`role="status"` live region、`prefers-reduced-motion`、`prefers-contrast`。

---

## 一、候选库总表（已核实）

体积列为 **gzip 后 min 主入口**（Bundlephobia API）；括号内为原始 min 体积（jsDelivr 文件大小）。
"原生 TS/ESM" 指 npm 包自带 `.d.ts` 且提供 ESM 入口。

| 库 | 最新稳定版 | 体积（gzip min） | 许可证 | 原生 TS / ESM | 打包器额外配置 | 离线可用 | 渲染形态 |
|---|---|---|---|---|---|---|---|
| **uplot** | 1.6.32 | **21,856 B**（ESM 101,268 B raw） | MIT | ✅ `dist/uPlot.d.ts` + `dist/uPlot.esm.js` | 无需 | ✅ | Canvas 2D |
| **chart.js** | 4.6.1 | **69,624 B**（含 `@kurkle/color`） | MIT | ✅ `dist/types.d.ts` | 无需（仅多一个色值依赖） | ✅ | Canvas 2D |
| **echarts**（全量） | 6.1.0 | **367,958 B**（`echarts.min.js` 1,121,883 B raw） | Apache-2.0 | ✅ `types/dist/all.d.ts` | 建议按需 `echarts/core` | ✅ | Canvas + SVG |
| **echarts**（Canvas 版 `simple`） | 6.1.0 | raw 500,315 B（gzip **未核实**） | Apache-2.0 | ✅ | 入口 `index.simple.js` | ✅ | **仅 CanvasRenderer** + line/bar/pie + GridSimple + **Aria** + Dataset |
| **@observablehq/plot** | 0.6.19 | **126,912 B**（含 d3-*） | ISC | ✅ `src/index.d.ts` | 无需 | ✅ | SVG |
| **vega-lite** | 6.5.0 | **89,903 B**（另需 `vega`） | BSD-3-Clause | ✅ `build/index.d.ts` | peer: `vega@^6.4.0` | ✅ | SVG / Canvas |
| **vega** | 6.4.0 | **181,871 B** | 未核实（同族 vega-lite / vega-embed 为 BSD-3-Clause） | ✅ | — | ✅ | SVG / Canvas |
| **vega-embed** | 7.3.0 | **21,116 B**（+vega +vega-lite ≈ 293 KB gzip 合计） | BSD-3-Clause | ✅ `build/embed.d.ts` | peer: vega + vega-lite | ✅ | SVG / Canvas |
| **gridjs** | 6.2.0 | **16,475 B** | MIT | ✅ `dist/index.d.ts` | 无需（内部依赖 preact） | ✅ | DOM 表格 |
| **tabulator-tables** | 6.7.1 | **104,913 B** | MIT | ✅ | 需引入 `tabulator.css` | ✅ | DOM 表格 |
| **@tanstack/table-core** | 9.3.1 | **27,975 B** | MIT | ✅ `dist/index.d.ts` | 无需（headless） | ✅ | 不渲染 |
| **sortablejs** | 1.15.7 | **18,314 B** | MIT | ⚠️ 包内无 `types` 字段（需 `@types/sortablejs`，版本**未核实**） | 无需 | ✅ | DOM 拖拽 |
| **dompurify** | 3.4.18 | **11,490 B** | (MPL-2.0 OR Apache-2.0) | ✅ `dist/purify.es.d.mts` | 无需 | ✅ | HTML 净化 |
| **billboard.js** | 4.1.5 | **144,391 B** | MIT | ✅ `types/index.d.ts` | 需 CSS | ✅ | SVG（另有 `./canvas` 子路径） |
| **apexcharts** | 8.9.0 | **278,795 B** | `SEE LICENSE IN LICENSE.md`（**非标准 SPDX，需法务确认**） | ✅ `types/apexcharts.d.ts` | 需 CSS | ✅ | SVG（可选 canvas renderer） |
| **frappe-charts** | 1.6.2 | **19,829 B** | MIT | ⚠️ 包内无 `types` 字段 | 无需 | ✅ | SVG |
| **@picocss/pico** | 2.1.1 | **15,528 B**（CSS） | MIT | N/A（纯 CSS） | 需引入 CSS | ✅ | CSS 框架 |
| **d3-shape** | 3.2.1 | **8,499 B** | ISC | ✅ | 无需 | ✅ | SVG path 生成 |
| **@visx/shape**（visx） | 4.0.0 | 不适用 | MIT | ✅ 但 `peerDependencies: react ^18 \|\| ^19` | **需 React** | — | React 组件 |

> 所有候选均为 npm 本地包，**无 CDN 运行时依赖**，离线可用 ✅（`vega-embed` 自带 `vega-themes` / `vega-tooltip`，无需外链）。
> `visx` 因 React peer 依赖**直接出局**（本项目无 React，引入即需重写整个渲染层）。

---

## 二、与 Three.js 同页共存（canvas 上下文 / z-index / CSS）

| 检查项 | 结论 |
|---|---|
| WebGL 上下文冲突 | **无风险**。Three.js 占用 `#viewport > canvas`（`src/style.css` 中 `#viewport{position:absolute;inset:0}`）。所有候选库都自建 `<canvas>` 元素或输出 SVG，不复用该节点。HTML5 规范下一块画布只能取一种上下文（`webgl` 或 `2d`），但本项目两者用不同画布。 |
| 2D 上下文冲突 | **无风险**。手写地图 `src/gameplay/map.ts` 用的是 `#mini-map canvas` 与 `.terminal-map canvas` 两块独立画布；图表库另建画布即可。 |
| 全局 CSS 陷阱（真实存在） | `src/style.css` 有全局规则 `canvas{display:block;width:100%;height:100%;touch-action:none}`，**会命中任何新插入的图表 canvas**，导致图表被拉伸变形、`touch-action:none` 还会吞掉滚轮/双指手势。现有代码已对 `#mini-map canvas`（`width:100%;height:auto`）与 `.terminal-map canvas`（`height:auto;max-height:53vh;object-fit:contain`）做了覆盖 —— 引入图表库后必须补同类覆盖规则。 |
| z-index 现状（`src/style.css` / `experience.css` / `inspector.css` / `exploration.css`） | `#mini-map` z=4；`#scene-id-labels` z=8；`#pause-panel` z=12；`#control-badge` z=14；`#scene-inspector` z=22；`#inventory-modal` z=30；`#campus-tools` z=30；`#campus-panel` z=40；`#viewport` 无 z-index（位于 `.stage` 内定位层底部）。结论：**图表放在 `#campus-panel`（z=40）内无需处理 z-index；放在 `.stage` 内做常驻小挂件则必须 z-index ≥ 5**，否则会被 WebGL 画布遮挡。 |
| 图表库内部样式 | Chart.js / ECharts / Grid.js / Tabulator 都会注入自己的 `<style>`（Chart.js 注入 canvas 外的内联样式、ECharts 注入 `div` 布局样式），与 `experience.css` 的 `*{box-sizing:border-box}`、`button{...}` 有潜在串扰，需限定作用域。 |

---

## 三、适配度评估（像素风 / 无障碍 / 增量价值）

评分：★ 越多越适合本项目；「增量价值」= 相对于本项目已有手写组件，引入后**多出来的**能力。

| 库 | 像素风化难度 | 无障碍支持 | 与现有手写组件的增量价值 | 结论 |
|---|---|---|---|---|
| uplot | 中。Canvas 绘制，可设 `stroke`/`fill`/字体，但像素栅格感（硬边框、无抗锯齿）需手工控制 `devicePixelRatio` 与整数坐标 | **弱**。Canvas 无语义，需自行加 `role="img"` + `aria-label`；无键盘焦点 | 中。若将来要画「探索时长 / 距离」时序曲线，可省掉坐标轴/缩放/十字线自写；但本项目当前数据量（3 条记录、36 格背包）用不上 | 备选 |
| chart.js | 中。Canvas，主题可整体换色；`font.family` 可设等宽字体模拟像素质感 | **弱（官方定位）**。Chart.js 文档明确写「canvas 内容对屏幕阅读器不可见，a11y 由使用方自己在 canvas 上加 `role`/`aria-label` 或写 fallback 内容」 | 中。可做雷达图/环形进度；自写成本不低 | 备选 |
| echarts（Canvas 版 simple） | 中高。`itemStyle`/`lineStyle` 可配 `borderRadius:0`、方角、贴图填充；`decal` 花纹可做「无障碍色盲友好」 | **最强（唯一内置）**。`AriaComponent` 会在图表容器生成 `aria-label` 描述，官方有专门的 aria 最佳实践页；`decal` 图案可在不靠颜色的情况下区分系列 | **低**。368 KB gzip 是 main chunk 的 4.2 倍；simple 版 500 KB raw 仍偏大；能力远超本项目需求 | 不推荐（全量）／仅在需要复杂图表时考虑 |
| @observablehq/plot | **高**。输出 SVG，天然可像素化（`shape-rendering: crispEdges`、整数坐标、`fill` 直接吃 CSS 变量 `--survey-ink` 等） | **强**。官方支持根 SVG 的 `ariaLabel` / `ariaDescription`，每个 mark 自动生成 `aria-label`（如 "dot"、"y-axis tick"），`ariaHidden` 可隐藏装饰性 mark | 中。声明式生成统计图很省代码；但 127 KB gzip 偏大 | 备选（若确需统计图） |
| vega-lite / vega / vega-embed | 高（SVG） | 中（SVG 语义好，但需自己补标题/描述） | **极低**。合计 ≈ 293 KB gzip，为声明式图表付出最重代价；且 vega 运行时表达式系统与本项目「不执行任意 JS」的安全原则相冲 | 不推荐 |
| gridjs | 高（DOM 表格，CSS 完全可控，可直接套 `--survey-*` 变量与像素边框） | **强**（真实 `<table>`，天然可读屏 / 可键盘 / 可缩放列） | **低**。`src/scene/inspector.ts` 已经是功能完整的可排序/分页/搜索结果列表 | 不推荐（现有手写已够） |
| tabulator-tables | 高（DOM + 主题 CSS） | 强 | 低，且 105 KB gzip 引入「交互表格」框架解决的是本项目没有的问题 | 不推荐 |
| @tanstack/table-core | **最高**（headless，只给状态机，渲染 100% 自己写 → 像素风与 a11y 完全自主） | 由自己实现（可控但要自己写） | **中**。若将来场景编号表要支持多列排序/筛选/虚拟滚动，这个库省掉的是排序/筛选**状态逻辑**，不是渲染 | 不推荐（现在）／未来备选 |
| sortablejs | 高（DOM 拖拽） | **弱**。SortableJS 默认**不提供键盘拖拽**，会破坏本项目现有「依次点击两个格子移动/交换」的无障碍替代路径 | **低且有负增量**。现有 `inventoryUI.ts` 已实现拖拽 + 点击双击式替代操作，Sortable 属于纯替换 | 不推荐 |
| dompurify | 无视觉影响 | — | **中（有安全价值）**。`src/main.ts:50` 已有手写 `escapeHTML`，但 `experience.ts` / `inspector.ts` / `inventoryUI.ts` 大量 `innerHTML` 插值（如 `c.text`、`e.name`、`b.title`）**未做转义**。DOMPurify 11.5 KB gzip 可统一收口 | **推荐引入（唯一）** |
| billboard.js / apexcharts / frappe-charts | 中 | 弱～中 | 低。apexcharts 许可证非标准 SPDX，billboard/frappe 无原生 TS 类型 | 不推荐 |
| @picocss/pico | **冲突**。Pico 是通用语义化 CSS 框架，会与 `experience.css` / `opening.css` 的像素风变量打架，需大量覆盖 | 中 | **低**。本项目已有 1052 行自写 CSS 与完整变量体系 | 不推荐 |
| d3-shape | 高 | 由自己写（SVG 语义可控） | **中**。8.5 KB gzip 换到「标准 SVG path 生成」，配合手写 SVG 可造出完全像素风 + 完全可控 a11y 的图表 | 备选（配合手写） |

---

## 四、手写已有组件清单（逐条从仓库代码核实，勿臆造）

| 组件 | 文件 | 已实现能力 | 已覆盖的无障碍点 |
|---|---|---|---|
| 校园小地图 / 大地图 | `src/gameplay/map.ts`（`drawCampusMap`） | 纯 Canvas 2D 手绘：道路、建筑矩形（带旋转）、绿地、广场、记录点三态（未发现/待收集/已收集）、玩家箭头与朝向、`N ↑` 指北针、两种尺寸模式 | `<canvas aria-label="北朝上的校园小地图">` / `"校园地图"`（由 `experience.ts` 写死） |
| 任务 HUD | `src/gameplay/experience.ts:28-29` | `#survey-hud`（`details/summary` 折叠、收集计数、目标清单、下一站提示）、`#survey-prompt` 交互提示 | `aria-label="校园数字巡检"`、`role="status"` |
| MacBook 终端面板 | `src/gameplay/experience.ts:31-55` | `#campus-panel`：`role="dialog" aria-modal="true"`、`nav#terminal-tabs` 三页（地图 / 任务 / 线索）、footer 存档状态、设置页（5 个 range + 2 个 checkbox）、重开确认流、剪贴板/任务复制 | `aria-labelledby="terminal-title"`、`aria-current="page"`、`role="status"` 反馈、`aria-valuetext` 滑杆数值 |
| 焦点陷阱 | `src/gameplay/experience.ts:56` | Tab / Shift+Tab 在 `button/input/summary` 间循环首尾闭合 | ✅ 焦点陷阱已手写 |
| 场景编号检索面板 | `src/scene/inspector.ts` | `#scene-inspector`：编号/名称搜索（`type=search`）、类型筛选 `select`、结果按钮列表、分页「显示更多」、详情区（源码 / 锚点 / 包围盒 / 依据）、导出完整编号表 JSON、3D 投影标签层 `#scene-id-labels` | `aria-label`、`aria-pressed`（选中态）、`role="status"` 计数、Escape 关闭、`:focus-visible` 描边 |
| 背包网格 | `src/items/inventoryUI.ts` | 9 格快捷栏 + 27 格储物区、HTML5 drag&drop、**点击两格移动/交换**（键盘可达替代路径）、数量角标、图标 `image-rendering:pixelated` | `role="dialog" aria-modal="true"`、每格 `aria-label` + `aria-pressed`、`aria-live="polite"` 持有物播报 |
| 最小 DOM 工具 | `src/ui/dom.ts` | `setText` / `setHidden` —— 避免冗余 DOM 变更（保护 live region 不抖动） | — |
| 开场 UI | `src/opening/ui.ts`（598 行）+ `opening.css`（965 行） | 独立一套 HUD / 弹窗 / 标签页 / 设置滑杆 / 地图卡片 | `aria-modal`、`aria-labelledby`、`aria-current`、`aria-hidden`、`aria-live`、`aria-valuetext`、焦点循环（`FOCUSABLE` 常量） |
| 其它 | `src/main.ts:50` | 手写 `escapeHTML` 转义 | — |

**结论：搜索框、筛选下拉、排序/分页列表、网格、标签页、对话框、焦点陷阱、live region、折叠面板、抽屉式菜单 —— 本项目全部已手写且已具备正确的 ARIA 语义。**

---

## 五、明确判断：哪些不用引入、继续手写更好

**继续手写更好，不要引入（本项目 0 增量或负增量）：**

1. **表格 / 列表类：gridjs、tabulator-tables、@tanstack/table-core —— 全部不引入。**
   `src/scene/inspector.ts` 的搜索 + 筛选 + 分页 + 详情已经是完整实现，且 `#scene-results` 用 `aria-pressed` 正确表达选中态；换成表格库要额外引入 CSS 主题、重新做选中/焦点样式、体积 +16～105 KB gzip，收益为零。
2. **拖拽：sortablejs —— 不引入。**
   `inventoryUI.ts` 已实现拖拽，并且额外做了「依次点击两个格子移动/交换」的**无键盘拖拽替代路径**。SortableJS 默认无键盘拖拽支持，引入只会削弱现有 a11y，同时替换掉一条已工作的代码路径。
3. **CSS 框架：@picocss/pico —— 不引入。**
   与 `experience.css` / `opening.css` 的像素风变量体系正面冲突，覆盖成本高于重写。
4. **声明式图表：vega-lite / vega / vega-embed —— 不引入。**
   ≈293 KB gzip，且 vega 的运行时表达式系统与本项目「不执行任意 JS / 远端 shell」的安全边界不兼容。
5. **重图表框架：echarts 全量 —— 不引入。**
   368 KB gzip = main chunk 的 4.2 倍，而项目当前**没有任何图表需求**；`echarts.simple`（Canvas 版）虽降到 500 KB raw 且自带 Aria 组件，仍然过重。
6. **apexcharts / billboard.js / frappe-charts —— 不引入。**
   体积不小、apexcharts 许可证非标准 SPDX、frappe 无原生 TS 类型，均无相对 uPlot/chart.js 的优势。
7. **chart.js —— 暂不引入。**
   69.6 KB gzip 换来的能力（雷达/环形/ Doughnut）本项目暂时用不到；官方 a11y 文档明确说明「无障碍要使用方自己在 canvas 上加 role/aria-label」，即**它并不省掉 a11y 工作**，反而多一层抽象。
8. **visx —— 直接出局**（React peer 依赖）。

**可以引入（唯一有净增量）：**

- **DOMPurify 3.4.18**（11,490 B gzip，(MPL-2.0 OR Apache-2.0)）：统一收口 `innerHTML` 插值的 XSS 面。`src/main.ts:50` 已有 `escapeHTML` 但只覆盖一处；`experience.ts`（`c.title` / `c.text` / `s.archive.text`）、`inspector.ts`（`e.name`）、`inventoryUI.ts`（`ITEMS[s.itemId].name`）都是模板直插。若这些字符串未来接入远端档案 / AI 助手输出，风险是实在的。代价只有 11.5 KB gzip，且不影响任何视觉。
  落地建议：把 `escapeHTML` 提升为 `src/ui/dom.ts` 的 `safeHtml()`，或对需要富文本的片段统一走 DOMPurify。

---

## 六、推荐结论（≤3 条）

### 1. 首选：`DOMPurify`（唯一的"引入"建议）
- 版本 3.4.18 / 11,490 B gzip / (MPL-2.0 OR Apache-2.0) / 原生 TS + ESM / 无打包器额外配置 / 离线可用 / 与 Three.js 无任何交互。
- 落点：`src/ui/dom.ts` 增加 `safeHtml()`（复用或替换现有 `src/main.ts:50` 的 `escapeHTML`），供 `src/gameplay/experience.ts`、`src/scene/inspector.ts`、`src/items/inventoryUI.ts` 的 `innerHTML` 赋值点调用。
- 只动一个依赖 + 一个工具文件，不触碰渲染层。

### 2. 备选：`uPlot`（仅当未来真的需要时序/统计曲线时）
- 版本 1.6.32 / **21,856 B gzip**（main chunk 增约 25%）/ MIT / 自带 `uPlot.d.ts` + ESM / 离线可用 / 自建 Canvas 2D，与 Three.js 无上下文冲突。
- 落点建议（**描述，未动手**）：新增 `src/gameplay/dataPanel/` 目录，把图表实例包成独立模块，例如 `src/gameplay/dataPanel/uplotPanel.ts`（只负责创建/销毁 chart 实例与数据映射），样式单独放 `src/gameplay/dataPanel/panel.css`；由 `src/gameplay/experience.ts` 的 `#campus-panel` 增加第 4 个标签页接入（`ComputerPage` 类型目前是 `'map'|'tasks'|'clues'`，需扩一项）。
- 必须补的两条工程约束：① 在 `src/style.css` 或新 CSS 中覆盖全局 `canvas{width:100%;height:100%}` 对图表 canvas 的影响，并恢复滚轮手势（`touch-action`）；② 图表外层给 `role="img"` + `aria-label`，因为 uPlot 是 Canvas 且不自带语义。
- 触发条件（不满足则不引入）：确实需要画「步行距离 / 探索时长 / 收集时间」这类多系列曲线，且手写坐标轴 + 缩放 + 十字线的成本已超过 21.9 KB gzip。

### 3. 不推荐（本次一律不引入）
`echarts`（含 Canvas 版 simple）、`vega-lite` / `vega` / `vega-embed`、`chart.js`、`@observablehq/plot`、`gridjs`、`tabulator-tables`、`@tanstack/table-core`、`sortablejs`、`billboard.js`、`apexcharts`、`frappe-charts`、`@picocss/pico`、`visx`。
理由见第五节：要么体积与项目规模严重失配（echarts/vega/apexcharts），要么与已有手写组件零增量甚至负增量（gridjs/tabulator/sortablejs/pico），要么需要框架（visx），要么许可证非标准 SPDX（apexcharts）。

### 补充：未来真要做"像素风统计图"的另一条路
若最终需要一张自制风格的图表（而非标准图表），**`d3-shape` 3.2.1（8,499 B gzip, ISC, 原生 TS/ESM）** 配合手写 SVG 是比任何图表库都更契合本项目的路线：输出 SVG 天然可吃 `--survey-ink` / `--survey-paper` 变量、可加 `shape-rendering:crispEdges` 做硬边像素感、可逐元素加 `aria-label`，且体积只有 uPlot 的 1/3。此项优先级低于 DOMPurify，仅在 uPlot 与手写之间二选一时才优于 uPlot。

---

## 附：核实方法与出处

- 版本 / 许可证：`https://registry.npmjs.org/<pkg>/latest`（逐包读取 `version`、`license`、`types`、`exports`、`peerDependencies` 字段）。
- 体积：`https://bundlephobia.com/api/size?package=<pkg>`（gzip 主入口）。
- ECharts 分包与文件体积：`https://data.jsdelivr.com/v1/packages/npm/echarts@6.1.0?structure=flat`；`index.simple.js` 源码核实其 `use([CanvasRenderer])` 与 `AriaComponent`（**无 SVG renderer**）。
- uPlot 定位与体积自述：`https://raw.githubusercontent.com/leeoniya/uPlot/master/README.md`（Canvas 2D、~50 KB min、无内置动画）。
- 无障碍事实来源：[Chart.js Accessibility](https://www.chartjs.org/docs/latest/general/accessibility.html)、[Observable Plot Accessibility](https://observablehq.github.io/plot/features/accessibility)、[ECharts ARIA 最佳实践](https://echarts.apache.org/handbook/en/best-practices/aria/)。
- 项目侧事实来源：`package.json`、`vite.config.ts`、`tsconfig.json`、`src/style.css`、`src/gameplay/experience.css`、`src/scene/inspector.css`、`src/ui/exploration.css`、`src/gameplay/map.ts`、`src/gameplay/experience.ts`、`src/scene/inspector.ts`、`src/items/inventoryUI.ts`、`src/ui/dom.ts`、`src/main.ts`、`src/opening/ui.ts`，以及 `dist/assets/` 实测体积。
