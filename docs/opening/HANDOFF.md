# Thomas opening integration

> 四路 Agent（A 状态/存档、B 场景布景、C 机器人、D UI）的交付与验证结果已汇总在
> [DELIVERY-SUMMARY.md](DELIVERY-SUMMARY.md)。

**Development snapshot, 2026-11-19 (round 2):** the opening is runnable. The interfaces below are implemented; see [ROUND2-DELIVERY.md](ROUND2-DELIVERY.md) for the shuttle, invitation, atmosphere, eight-robot fleet, hearts, MacBook and Local Agent changes. For external-agent file ownership history, read `agent-manual/00-START-HERE.md`.

2030 opening scope: Building 4 shuttle → Building 5 ground-floor dinner reception (turn right) → Building 6 presentation MacBook → Building 5 incident → Building 4 main entrance **outside**.

The application selects the opening by default. `?experience=survey` retains the previous survey experience and its original save. Gameplay-facing building names are English; source B04/B05/B06 IDs remain stable.

## Ownership and event contract

`src/opening/state.ts` owns ordered story facts. UI submits intents; world/NPC state is derived. `CampusGame.interact/computer` is the shared human/RPC route, using the original `/act` fields. Opening modal content reuses the existing panel pause/epoch gate. Closing a modal does not resume movement or authorize AI.

Stable public facts: `invitation_read`, `laptop_acquired`, `campus_alert_triggered`. Opening completion emits the browser `campus-opening-handoff` event with event key `opening.building4_reached`, the three facts, the existing laptop instance ID and `opening-building4-entrance` anchor. The same completion is persisted and available through the read-only opening observation, so a later loaded module can recover it without relying on a transient DOM event.

`opening.building4_reached` is the provisional adapter name until Harry's incoming contract is available. It must map to his agreed entry event without emitting `chapter_01_completed`. Building 4 puzzles, supercomputer, power and later chapters are outside this implementation.

## Saves and safety

Opening save: `hku.opening.v1`. Original survey save: `hku.digital-survey.v1`. Pre-laptop opening saves are legal. A laptop flag requires exactly one existing MacBook item; there is no second inventory or held-object system. Unknown data is protected until an explicit restart backs it up. Writer ownership prevents simultaneous tabs from silently saving over each other.

Robot capture restores the encounter checkpoint and keeps the laptop and earlier story. The robot scans, pursues only a visible/last-seen target, searches and returns to patrol. Opening a panel, pausing or losing focus stops the encounter. Retry remains paused until the player continues.

## Spatial evidence boundary

`spatialLayout.ts` is the shared source for gameplay anchors, portal bounds, support and map routes. Building 5's ground-floor right turn is user-confirmed; room dimensions and Building 6's simplified office are provisional 2030 gameplay scenery. Building 6's 5.1 m provisional entry is distinct from the existing upper glass doors near 9 m. See THOMAS-CAPTURE.md for missing field reference.

Original static building keys are retained where geometry is clipped. Fully removed opening-only parts are listed in the generated scene ID migration report. Animated bus/dinner/laptop props are marked dynamicGameplay and excluded from the static scene revision; they retain source metadata and stable interaction IDs. Separate opening catalog uses `npm run scene:opening`.


### 2026-11-19 实景修正

B5 的入口右转大厅已改为长桌、木椅、木地板、分段拱顶、吊灯和参考校徽；布局及碰撞共用参数。`OPENING_WORLD_REVISION` 更新为 `opening-2030-v3-b5-observed`，旧版本位置按原恢复流程回到合法检查点，剧情和物品保留。新增楼梯下穿通道仅在 opening 模式启用，其他成员关卡不变。事件名与三个交接 flags 未改。

验证、截图和 5 项静态编号迁移见 [本轮记录](../../evidence/nov19-corrections/README.md)；未完成事项见 [TODO](NOV19-CORRECTIONS-TODO.md)。


### 2026-11-20 横向大厅与开场交互

大厅已整体转为东西向，门厅保留，路线右转点同步调整；存档位置版本为 `opening-2030-v4-b5-horizontal`。请柬任意键确认阅读并消费关闭按键；Staff 配有可重播的英文合成语音。开场请柬/跑步/跳跃音效使用独立覆盖资源，公共背包、任务、交接事件保持原约定。详见 [验证与语音来源](../../evidence/opening-horizontal/README.md)。


### 2026-11-20 A012 退役

按用户游戏截图删除 B04—B05 架空连廊，包括桥面、顶板、侧面围护和立柱；可见模型和碰撞同步移除，原地面道路/花槽保留。普通校园与 opening 资产都已更新。A012 及其细部编号仅退役，不重新分配；迁移表见 `evidence/remove-link/scene-id-migration.json`。任务、存档格式和交接事件未改。


### 2026-11-20 开场人群与正脸

开场人物从 3 增至 12，复用现有角色模板及像素五官。修正视觉朝向：共享 rig 的脸朝局部 -Z，NPC 接近玩家时使用对应朝向并平滑转身。原协调员和两位学生 ID 保留，新增 9 位宾客使用独立 ID。人物分布避开门洞、桌面与主任务路线，入侵时整体隐藏，暂停时不更新姿态。仅修改 opening 配置，不改变公共角色 API。截图与测试见 `evidence/opening-npcs/`。


### 2026-11-20 机器人提前列队

同一批 8 台安保机器人从开场就位于 B5 晚宴入口两侧，每侧 4 台（`OPENING.robotFormation`）。友好状态为绿灯、无扫描/追逐；入侵时原位转红，沿经过物理验证的部署通路走向原巡逻范围，不生成新机器人、不传送到巡逻点。返回 B5 的剧情节点不再重置车队。保留检查点恢复/重开时的既有车队重置语义；未保存逐台机器人运行位置。单机器人的公开返回接口保持原样，主线事件和存档格式未改。截图与验证见 `evidence/robot-posts/`。


### 2026-11-20 整片右侧并入晚宴厅

按用户截图删除厅内侧墙和 42 根隔断竖条，将右侧空走廊并入横向晚宴厅，扩展拱顶/木地板/吊灯和端墙，长桌由 6 张增为 8 张。旧隔断碰撞同步删除，新增桌柱沿用共享参数；门厅入口保留。位置版本为 `opening-2030-v5-b5-full-hall`，旧档保留剧情物品并恢复到安全检查点。静态编号不变，动态作者键退役清单与同机位前后截图见 `evidence/full-hall/`。
