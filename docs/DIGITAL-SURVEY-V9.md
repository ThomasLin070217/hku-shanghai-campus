# 校园数字巡检 · v9

运行：`npm ci`，然后 `npm run play`。校园 http://127.0.0.1:5184/ ，本机 AI 服务 8788。维持原有方块校园、Kenney 人物、第一/第三人称、跑跳、玻璃外观和实体碰撞、背包及装备。

## 同学试玩

进入校园，在三个地标找到绿色记录牌：CDS-1 门前、HKU 标识广场、东侧露天步道。靠近、对准后按 F。小地图金色点是任务目标，绿色点已收集，蓝色箭头是玩家；北为 -Z。顺序不限。

新游戏将唯一 MacBook 放在快捷栏第 1 格，初始选中第 2 格空手。按 1 装备，C 打开电脑；地图、任务、线索三个页面直接反映实际状态。集齐三条后在任务页同步，解锁档案 001。线索保存在任务状态，不占物品格。电脑可以在任意室外可到达位置提交，无需返回起点。

WASD 行走、Shift 奔跑、空格跳跃、V 切换视角、E 背包、F 场景交互、C 电脑、Esc 关闭/暂停、1–9/滚轮选物品、[ ] 调整第三人称距离。按键由 `src/exploration/config.ts` 提供。打开背包、电脑或设置会清空输入、停下玩家并释放鼠标；关闭后必须点击继续游戏。若浏览器不支持鼠标锁定，页面提供拖动兼容模式。

## 新增任务 / 记录 / 地标

业务逻辑：`src/gameplay/survey.ts`。统一数据：`landmarks.ts` 的 `campusLandmarks(buildings, site)`。场景牌、小地图、电脑地图、发现状态和 AI 都读取这一函数；建筑轮廓读取运行时 BuildingSpec，主要路径读取 VIDEO_DETAILS。已校准参数改动会更新记录点的建筑/步道锚点。

示例：在 `campusLandmarks` 返回值中加入：

```ts
{
 id:'record-library-entrance', name:'未来图书馆入口',
 position:[building.x, 0, building.z + building.depth / 2 + 5],
 kind:'record', clueId:'clue-library',
 description:'这里填写一句新的线索。',
 source:'对应校方图、用户视频时间戳或明确的估计说明',
}
```

任务与解锁档案配置示例（同文件的 TASK，记录中的 clueId 对应稳定线索 ID）：

```ts
export const TASK = {
 id: 'campus-digital-survey', title: '校园数字巡检',
 archiveId: 'archive-campus-001', archiveTitle: '校园数字档案 001 · 未完的地图',
 archive: '三条记录已归档。这里填写下一段故事。',
};
export const CLUE_IDS = ['clue-learning', 'clue-belonging', 'clue-explore'];
export const recordIds = ['record-cds-entry', 'record-hku-square', 'record-east-walk'];
```

将新 clueId 加入 CLUE_IDS、记录 ID 加入 recordIds，并同步 Survey、存档校验与面板中的任务总数（当前体验明确固定三个）。Y 会由同一导航地面自动解析。新增实体模型不能只更新地图；必须在导航中维护对应碰撞。记录牌是虚构玩法设施，不声称校园真实存在。普通雕塑、树木、玻璃没有交互描边。

交互范围 2.7 世界单位、视线锥阈值 dot ≥ .90，从玩家眼位沿实际 yaw/pitch 射线检查导航实体；透明玻璃同样挡住射线。第三人称使用角色观察方向，不以越过墙面的追踪镜头绕开遮挡。重复记录转为查看，提交完成后返回 already_completed，没有重复发奖。

## 存档与设置

localStorage 键：`hku.digital-survey.v1`，schema version 1。含世界修订、位置朝向、36 格实际物品、当前槽位、视角、线索/发现/完成状态及设置。重要状态改变后保存，地面移动每 10 秒保存，pagehide/隐藏、面板关闭时保存。存储失败会明确提示，不影响当前会话游玩。

同一来源的多个窗口通过 `.writer` 键选出当前操作窗口。只有获得真实键盘/鼠标操作的窗口可写存档，取得写入权时先载入最新进度；后台或刚打开的只读窗口不覆盖存档。

读取校验版本、数组长度、稳定物品 ID、实例 ID 唯一性、数量上限及必要任务结构。缺失设置填默认值，音量、FOV、灵敏度限制在合理范围。未知版本/损坏存档不作为合法进度使用。位置须有有效支撑、地面高差合理且身体不与碰撞重叠；无效旧位置回到 CDS-1，保留任务和物品。速度、按键、AI 授权和在途命令从不恢复。

“继续游戏”沿用本地存档；“返回安全位置”只重置位置和输入；“重新开始游戏…”有单独确认，清空本轮任务/物品/位置，保留舒适度设置。设置包含灵敏度、FOV 60–90、轻微晃动（默认关闭）、总静音、环境/脚步/界面音量。

## 声音

`assets/audio/*.wav` 是本项目原创可复用 CC0 素材，使用 `scripts/generate-audio.py` 合成，无付费服务、音乐或第三方录音。来源及许可见同目录 LICENSE.txt。

单一 AudioContext、单一环境循环；点击开始/继续后解锁。落地且确实产生水平位移才累计脚步步幅，每 0.78 单位触发；跑步自然加快，空中/暂停/被墙阻挡不触发。铺装/草坪使用不同 WAV，环境为轻量风声/叶声；物品、背包、收集、查看、完成各有提示。

## 原生 AI 扩展

协议 `hku-campus/1.2`，继续使用 `/observe`、`/acquireControl`、`/act` 及原有 epoch/TTL/commandId。

```json
{"commandId":"record-1","controlEpoch":123,"durationMs":300,"interact":"record-cds-entry"}
```

```json
{"commandId":"submit-1","controlEpoch":123,"durationMs":300,"selectHotbar":0,"computer":"submit"}
```

computer 可为 map/tasks/clues/submit。AI 调用同一 `Survey.computer()` 资格检查与提交逻辑，结果在 `lastCommand.operation`。AI 页面读取为无界面操作，数据由 observe 提供；玩家 C 在同一资格检查成功后再打开暂停面板，撤销 AI。这样 AI 可以读取终端并提交，同时不能绕过装备、收集或空间交互条件。玩家打开任意面板后旧 epoch 立即作废，关闭不会恢复授权。

observe.survey 包含任务 ID、状态、数量、线索、档案、发现地标、目标及可执行动作；observe.landmarks 与 survey.objectives 提供同源位置。未来助手可用此数据，不需要新建任务系统或付费模型。

## 验证

新增 `scripts/check-survey.ts` 覆盖真实碰撞路线、空间交互拒绝、去重、AI 一致性与存档恢复。实际浏览器流程和时间记录见 `evidence/v9/`；以交付验收记录为准，未以自动逻辑测试替代实际试玩。
