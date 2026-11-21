# 2026-08-30 张江基地二期启用 · 活动照片参考

来源相册：[“此刻即未来——香港大学光耀张江巡礼”系列活动暨香港大学张江基地二期启用](https://m.alltuu.com/album/e1241aba6875f5ae8f851c9abd73a9e3/2306132542?from=qrCode&menu=live)（喔图图片直播，2026-08-30，上海）。

## 这是什么

从相册 5 个分类（热门/签约仪式/人才论坛/启用仪式/高桌晚宴，去重后约 311 张）里挑出的 17 张，只覆盖对本项目建模有用的场景：校区夜景与入口、论坛主会场、高桌晚宴大厅、主视觉与校徽。每张记录在 `manifest.json`（含相册 URL、`photoContentId`、原文件名、尺寸、SHA-256）。

## 使用边界

- 这批图是**第三方活动照片**（现场摄影师 / 喔图平台），下载的是平台 1600px 预览，右下角带 `HKU@Shanghai` 水印。
- 只作**内部建模参考**（比例、材质、灯光、陈设、配色、字形），**不要**直接放进运行包、宣传物料或对外分发；要正式使用需要向版权方取得授权与原图。
- 没有绕过水印或索取未授权原片；需要更清晰画面时请走官方“下载”流程。
- 照片记录的是 2026-08-30 的真实校区，游戏是 2030 年虚构时间线，冲突处以场景编号与实测数据为准。

## 分组与用途建议

| 组 | 文件 | 可用在 |
|---|---|---|
| 入口与夜景 | `entrance-canopy-night.jpg`、`street-night-crowd.jpg`、`plaza-night-crowd.jpg`、`facade-projection-rainbow.jpg`、`facade-crest-projection.jpg` | 校区入口雨棚、主视觉霓虹字样、夜间广场人流与楼体投影氛围（夜景光照、发光字材质） |
| 仪式与人物 | `gown-group-walking.jpg`、`podium-crest-banner.jpg`、`signing-stage-teal-backdrop.jpg` | 学位袍配色（红/蓝绿）、演讲台与校徽立牌、青绿电路纹理背板（可参考做 UI 纹理） |
| 论坛主会场 | `auditorium-tiered-seats.jpg`、`auditorium-wide-from-back.jpg`、`auditorium-stage-wide.jpg` | 讲堂/会场：阶梯座椅排布、木饰面墙、灯带与顶部光斑 |
| 高桌晚宴 | `dinner-hall-arched-wide.jpg`、`dinner-hall-long-tables.jpg`、`dinner-hall-perspective.jpg`、`dinner-crest-wall.jpg`、`dinner-hall-banners.jpg`、`dinner-podium-banner.jpg` | 开场“高桌晚宴”章节：连拱天花、吊灯、长桌纵深、蓝绿桌布与校旗、木墙校徽 |

## 与场景编号的挂接

`manifest.json` 里 `sceneIds` 暂为空。确认某张照片对应的楼栋/楼层后，把对应场景编号补进去（如 `B05`、`A014`），再按 `references/campus-media/README.md` 的流程登记，方便按编号反查参考。

## 生成方式

照片由相册接口的列表与 1600px 预览批量取回后人工筛选；`manifest.json` 由脚本写出，可用 `shasum -a 256` 复核。新增或替换图片后同步更新 SHA-256 与 `pixels`。
