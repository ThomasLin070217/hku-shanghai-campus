# BRIEF 05 · 开场建模优化（给执行者的事实底稿）

基线：`main @ 41dedea6dda94ac9ac57f9da56d90ca2c551ec4d`，2026-11-21。

## 1. 当前模型在哪里

| 区域 | 构建函数 | 事实 |
| --- | --- | --- |
| 校巴 | `src/opening/world.ts::buildBus()` | 车身/屋顶/侧墙/玻璃/门/台阶/四轮/保险杠/灯/后视镜/路线牌/4 组座椅/请柬/扶手/招牌/目的地牌 |
| B5 晚宴厅 | `buildDinner()` | 木地板、米白墙、深木端墙、12 面拱顶、拱肋、壁灯、吊灯、长桌、绿桌布、椅、校徽、讲台、横幅、翻倒椅/遗留物 |
| B6 办公室 | `buildOffice()` | 地板、顶灯、柜子、绿植、桌子、MacBook、纸 |
| 车辆/入口/路线 | `spatialLayout.ts`, `geometry.ts`, `navigation.ts` | 巴士 `x 64.4, z 30.9, 长 7.0, 宽 2.7, 门 x 63.4, z 29.55`；B5 门 `58,-54.7`；B4 交接 `58,25` |

`buildBus()` 的座椅循环只创建：

```ts
for(const [x,z] of [[62.1,31.55],[63.8,31.55],[65.5,31.55],[66.9,31.55]]){
  box(..., .62,.10,.54, x, floor+.44, z, materials.seat);       // 座面
  box(..., .62,.50,.09, x, floor+.72, z+.24, materials.seat);  // 靠背
  box(..., .07,.40,.07, x, floor+.20, z-.18, materials.metal); // 一条腿
}
```

没有坐垫/头枕/扶手/第二条腿；顶棚是 `box(... BUS_WALL ... materials.ivory)` 一整块；没有司机隔断/仪表台/方向盘/行李架/轮拱/踏板井。

## 2. 巴士尺寸与可走面（不可改）

`spatialLayout.ts`：

- `bus.floor = 0.54`
- `width = 2.7`（Z 向）、`length = 7.0`（X 向）
- `doorX = 63.4`, `doorZ = 29.55`, `doorWidth = 1.5`
- 台阶：`step 1` z0-1.6..z0-0.8，高 0.18；`step 2` z0-0.8..z0，高 0.36
- 玩家 spawn `[66.6, .54, 30.6]`，请柬 `[65.5, 1.05, 31.55]`

任何座椅/扶手/仪表台都不能侵入 `spawn` 到车门、以及座位之间的可走通道。

## 2.5 第一人称手臂（顺带发现）

2026-11-21 的 headless 实机截图（本包 `evidence/bus-interior-play-20261121.png`）里，画面底部出现两块**很大的米色斜板 + 白色袖口**，是 `src/characters/character.ts::createFirstPersonArms()` 的第一人称前臂/手。它们不是请柬，也不是车辆部件；在开场镜头下会挡住画面下缘，阅读请柬/看座位时很出戏。请一并检查 viewmodel 的缩放/位置/近裁剪面，保持“手在画面下缘、不遮挡请柬”的构图。该函数不在本任务的主改文件内，如果只调 `world.ts` 不能解决，先报告，不要擅自重写角色系统。

## 3. 玻璃问题

- `busMaterials().glass = glassMaterial('clear')`，`side=DoubleSide`。
- 从车内截图（`evidence/thomas-opening-round2/02-bus-interior-hearts.png`）看，窗户像一整块深绿色不透明面。
- B5 入口玻璃同样用 `glassMaterial('clear')`，但视觉上容易读成实心墙。
- 需要检查：透明度/不透明度、`depthWrite`、环境反射、背面、车内外光照差；不要简单改成完全透明（会露出空洞/缺少内饰）。

## 4. 参考与现有截图

- `evidence/thomas-opening-round2/02-bus-interior-hearts.png`：当前车内第一视角（HUD 在）。
- `evidence/thomas-opening-round2/03-bus-exterior-south.png`、`04-bus-exterior-north.png`：车外。
- `evidence/thomas-opening-round2/09-empty-hall.png`：B5 异常态。
- `docs/opening/NOV19-CORRECTIONS-TODO.md`：B5/T14/T15/T17 的实景修正项。
- `references/opening-nov19/REVIEW.md`：实景审查。
- `docs/modeling-reconstruction-report.md`：建模重建边界（估算 vs 实测）。

## 5. 性能基线

Chrome headless（SwiftShader，1440×900，进入巴士第一视角）：

```
draw calls: 928
triangles: 184,092
geometries: 1,891
textures: 87
```

这是整帧（含车外校园），不是巴士单独。改完后同机位同分辨率复测；不要增加 >10%。真实浏览器（GPU）数字会更低，但只比较同一环境的前后值。

## 6. 编号/导出流程

- 部件用 `tag(node, 'opening-bus-...', 'Opening_bus_...')` 命名；场景目录由 `src/scene/authoring.ts` 记录范围，`registry.ts` 生成索引。
- 不要移除 `authorParts` / `sceneId`。
- 重复件 append-only；插入/重排/改名要保留原有 `authorKey`，并给旧→新迁移表。
- 改了几何后：
  ```sh
  npm run scene:opening
  npm run scene:catalog
  npm run export:glb
  npm run validate:glb
  ```
- 不要手改 `assets/scene/opening-catalog.json`。

## 7. 建议的建模清单

### 巴士内部

- 座椅：坐垫（略厚、圆角感用斜切盒体）、靠背、头枕、扶手、两条腿/支架；材质分座面/靠背/金属。
- 地板：通道防滑条/接缝；台阶防滑边。
- 顶棚：分块顶板 + 灯带/出风口（不新增点光）。
- 侧墙：窗下软包/扶手；轮拱包覆。
- 车门：门框、密封条、玻璃、把手、踏步、门内侧机构。
- 司机区：隔断/仪表台/方向盘/后视镜（只在车内可见范围；不要挡住 spawn 前方）。
- 行李架：如果高度允许，放在窗上沿，不要压低净空。
- 外观：轮毂/轮拱、门缝、侧裙、车顶空调/通风、灯罩、`HKU SHUTTLE` 与目的地牌。

### B5

- 椅子：坐垫/椅背/椅腿/扶手；长桌：桌腿/桌布垂坠/餐具；主通道保持 ≥1.2 m。
- 拱顶/拱肋/吊灯：现有 12 面拱顶保留；吊灯可加灯罩/线缆，不增加实时光。
- 入口：玻璃/门禁/门厅/右转关系；玻璃不要读成墙。

### B6

- 办公椅、窗/百叶、架子、线缆、纸、MacBook 底座/屏幕角度；不挡取电脑交互点。

### 沿途

- 铺装/路缘/花坛/灌木/指示牌；不侵入路线（T17）。

## 8. 边界

- 不改 `spatialLayout.ts` 的既有坐标；只加 `G1`/细节常量。
- 不改玩家可走面/台阶/门洞；若必须改，先跑 `check:opening-integration` + 路线检查。
- 不引入外部 GLB/贴图；只用程序化/现有材质。
- 不增加常开点光；不把像素风改成写实。
- 不改机器人/音频/MacBook/任务。
