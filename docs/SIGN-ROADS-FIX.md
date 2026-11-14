# 学院石牌与道路接缝修复 · 2026-11-14

本轮按用户反馈修复现有场景，不改变楼栋位置、体量或学院身份。

## 修复内容

- **学院石牌空白**：实际浏览器中确认，照片已解码为 512×272，但 WebGL2 的不可变纹理存储仍为最初的 1×1 占位尺寸。释放旧 GPU 存储后重新上传即可恢复；现已接入异步贴图加载流程，保留重试和卸载保护。
- **黑色字**：依据用户 U06（IMG_4347.MOV）02:55 的原牌文字，制作独立、不透明的黑色三维字：`SCHOOL OF / COMPUTING & / DATA SCIENCE / The University of Hong Kong`。保留原照片裁切校徽。文字置于浅色面板之前，有真实几何间隙；四行合并为一次绘制，即使照片尚未加载，文字仍在。
- **道路重叠**：横纵车道交叉口、两段带状步道接头采用矩形裁切，消除重复铺面；步道及排水边在车道处收口。车道移除被礼堂大阶梯占用的部分；车道标线避开交叉口。
- **庭院与入口细节**：中央高起的铺装条在庭院绿篱外结束，不再伸入下沉庭院和南侧车道。周围已有地面仍可通行。门前横纵铺装线的交点不再重叠；石牌草坪顶面调整至 0.14 m，避免入口铺装线露出草坪。
- **地面与碰撞**：道路、步道使用共用的布局参数生成模型和支撑高度。补齐北侧中央小路及石牌草坪的行走高度；石牌保持实体碰撞。

## 验证

- `npm run check:all` 通过，包括新增 `check:sign-roads`。新增检查覆盖铺面不重叠、黑字几何与面板间隙、射线实测地面与物理高度一致、路口连续移动、石牌碰撞、异步纹理重新分配。
- 浏览器真实按 W 接近并抵住石牌，被 `CDS-landscape-monument` 阻挡；实际按 W 从 `(24,-38)` 穿过横向车道和步道接头至 `(24,-50.20)`，保持落地、无卡住。测试起点使用调试定位，不将起点间跳转称为连续漫游。
- 第一、第三人称及固定视角检查：黑字可读，校徽正常，草坪不再露出铺装线。测试结果见 `evidence/sign-roads/browser-checks.json`。
- `npm run export:glb` 完成并逐项重载通过；`npm run validate:glb` 所检查的 17 个资产均为 0 errors / 0 warnings。

## 文件与截图

- 招牌代码：`src/model/monumentFace.ts`；贴图修复：`src/model/deferredTextures.ts`。
- 共用道路布局：`src/model/groundLayout.ts`；地面高度及碰撞：`src/exploration/navigation.ts`。
- 修改前 / 后：`evidence/sign-roads/sign-before.png`、`sign-after.png`。
- 步行视角：`evidence/sign-roads/sign-walking-first-clear.png`、`sign-walking-third.png`、`junction-walking.png`。
- 同角度总览：`evidence/sign-roads/roads-before.png`、`roads-after.png`。
- 当前完整资产：`assets/HKU-Shanghai-Campus.glb`。

本轮检查范围为石牌、入口铺装、车道交叉口和相邻步道，不代表已逐一排除全校每个模型的所有相交。牌体、草坪等尺寸仍为可修改估计值；新排字保留实景措辞，但未声称字体与字距是测量复刻。

启动：项目目录执行 `npm run play`；仅启动前端可用 `npm run dev -- --port 5184`。
