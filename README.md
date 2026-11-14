# HKU Shanghai · 校园数字巡检 v9

**场景编号与 AI 接手：** 右上角“场景编号”可搜索、点选细部、定位和复制修改任务。楼栋 B01–B07、道路 R001…、学院牌 S001。团队及 Agent 先读 [AI 最短接手指南](docs/AI-START.md)，工程约定见 [AGENTS.md](AGENTS.md)。支持离线源码索引、HTTP 与 MCP。

**最近修复（2026-11-14）：** 学院石牌新增黑色三维字并修复贴图空白；修整道路与步道重叠、入口铺装及地面碰撞。包含近期 WorkBuddy 反馈复核、界面与音频恢复、存档和资源生命周期修复。详见 [石牌与道路修复](docs/SIGN-ROADS-FIX.md)、[评审逐项处理](docs/WORKBUDDY-REVIEW.md)、[后续修复及验证](docs/REMAINING-FIXES.md)。

**最新：11 月 14 日实录更新。** 双弧形下沉楼梯、北侧绿地、教学楼—5号楼连接体、连续绿篱与实拍石牌；按新视频目测将狮子本体暂定为 4.8 m。新增门厅及 13 层公共区的独立参考模型。查看 [修改说明](docs/NOV14-VIDEO-UPDATE.md)、[前后对照与实际通行录像](evidence/nov14-video/index.html)。室内预览 <http://127.0.0.1:5184/interiors.html>，校园关闭门碰撞保留。

**2026-11-14 体验修复：** 稳定头部与距离驱动步态、真实脚步采样/单实例环境音、分层绿化、狮子等比例暂定尺度。查看 [修复说明](docs/EXPERIENCE-FIX.md) 与 [带声录屏及前后对比](evidence/experience-fix/index.html)。该轮狮子为 5.8 米估算（已被下述新视频更新为 4.8 米）；音色主观试听尚未验证。

```sh
npm ci
npm run play
```

打开 **http://127.0.0.1:5184/**；人物预览 **http://127.0.0.1:5184/characters.html**。AI 服务端口为 **8788**，避免占用旧工程端口。

先前的 Atlas 室内重建小样也已保留：开发服务打开 `http://127.0.0.1:5184/ai-study.html`；需打包参考页时执行 `npm run build:review`。日常运行包不包含这份大型研究素材。

本目录从原有 `2026-11-12/codex-hku-shanghai-campus-hku-shanghai/outputs/hku-shanghai-campus` 工程复制并继续开发；旧工程未改动。

本轮可完整试玩：走访三个室外地标 → F 收集记录 → 1 装备 MacBook → C 打开任务页同步。加入统一交互、小地图、电脑地图/任务/线索、存档、声音与舒适度设置；保留既有角色、27+9 背包、跑跳、视角、卫星尺度及玻璃碰撞。

- [试玩与配置、存档、设置说明](docs/DIGITAL-SURVEY-V9.md)
- [实际操作及验证边界](docs/VALIDATION-V9.md)
- [本轮截图与完整任务操作记录](evidence/v9/index.html)
- 历史交付包：`HKU-Shanghai-v9-source.zip`（本轮修复前的归档；当前修复请使用本目录源码）。

浏览器完整操作用时约 **4 分 24 秒**，包含截图、界面阅读与工具衔接；纯步行路线约 103 秒。还需首次进入的同学确认独立游玩时间。

**E 背包；1–9 / 滚轮装备；F 收集/查看；C 电脑；V 视角；[ ] 镜头距离；WASD / Shift / Space 跑跳。关闭背包后点击进入探索恢复控制。**

- [角色与物品扩展说明](docs/CHARACTERS-AND-ITEMS-V8.md)
- [许可证与实际资产使用](docs/ASSET-LICENSES-V8.md)
- [视频时间戳修改清单与尺寸边界](references/nov13/CORRECTIONS.md)
- [v8 人物/装备历史验收](evidence/v8/index.html)

`npm run check:all` 验证；`npm run export:glb` 导出校准后的校园及单栋 GLB，`npm run export:v8` 导出人物与道具。

**卫星测距校准（2026-11-14）：** 高德原生测距得到 CDS-1 约60×45 m，保留模型59.7×45 m；北侧东西楼中心距104→116 m，两列各外移6 m，环境及碰撞同步。没有整体缩放；高度、地下深度和未测边界仍暂定。无需团队为此专程现场量楼宽。

- [原始测距与前后对照](references/scale-calibration/index.html) · [方法、误差与修改依据](references/scale-calibration/REPORT.md)
- 参数集中在 `src/model/scaleCalibration.ts`，`observe.world.scaleCalibration` 与导出元数据同步说明证据边界。
- 旧 DELIVERY-V8.json/压缩包是修改前快照；当前源码见 DELIVERY-V9.json；DELIVERY-SCALE.json 保留测距阶段记录。

**玻璃还原（2026-11-14 · glass1）：** 入口、首层幕墙、深色上层玻璃和连廊玻璃护栏分离建模；金属框及层间背板保持不透明，窗后增加封闭的简化纵深。门和玻璃仍阻挡角色。光学参数为依据照片调出的游戏表现，不是测量值。

- [实景—修改前—修改后（7 组）](references/glass/index.html) · [逐项依据及局限](references/glass/REPORT.md)
- [行走操作记录](evidence/glass/walking-checks.json) · [入口行走录像](evidence/glass/glass-entry-walk.webm)
- 参数：`src/model/glazing.ts`；校验：`npm run check:glass`；当前玻璃交付清单：`DELIVERY-GLASS.json`。之前的 DELIVERY-SCALE.json 保留为测距修改时的历史记录。

---

以下是历史版本说明，旧端口和旧按键以本文顶部 v9 为准。


旧版端口、按键和物资示例见 [历史说明](docs/HISTORY-PRE-V9.md)，当前操作以上文为准。

## Workbuddy 复核更新

`npm run play` 启动 http://127.0.0.1:5184，AI 服务为 8788。C 键自动取出电脑；工具入口位于右上「校园工具」。审计与验证见 `docs/WORKBUDDY-REVIEW.md`。

`npm run build` 生成运行版（不复制私有录像、研究和证据）；`npm run build:review` 生成仅供团队本机查看的完整证据版，包含开发检查接口。请勿把证据版直接公开发布。

### 最终评审补修（2026-11-14）

通过 `npm run play` 在 HTTP 页面运行，不要直接双击 `dist/index.html`。设置页可分别试听环境音、脚步和提示音；总静音对试听同样生效。声音失败可点“重试声音”。一个窗口接管存档后，其他窗口会暂停；再次操作会接续最新进度。

详见 [最终报告复核](docs/WORKBUDDY-FINAL-REVIEW.md)，原逐条审核保留在 [第一轮复核](docs/WORKBUDDY-REVIEW.md)。

### 剩余项收尾

招牌照片独立无损加载，主程序约139kB；参数导入加固与WebGL反射恢复已完成。完整结果、测试与仍待验收项见 [剩余问题与收尾](docs/REMAINING-FIXES.md)。

**最新代码卫生复核：** [逐项结论与验证](docs/REVIEW-FOLLOWUP-NOV14.md)。`npm test` 执行当前完整回归；CI 模板在 `docs/ci/campus-check.yml`；当前 GitHub 凭据缺少 workflow 权限，尚未启用自动运行。旧 v6 物资练习与重复 viewer 已移出当前代码，历史仍可在 Git 查询。
