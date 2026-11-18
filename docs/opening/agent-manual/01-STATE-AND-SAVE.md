# Agent A — 剧情状态与存档

请结合 `00-START-HERE.md` 公共要求，实际完成代码。现有两个文件是待审初稿，不是需要另起一套系统的空白工程。

## 可读与可改

先读 `contracts.ts`、`spatialLayout.ts`、`experience.ts`、现有 `src/items/inventory.ts` 和 `src/gameplay/save.ts`。

只允许修改：

- `src/opening/state.ts`（已有，审查并修正）
- `src/opening/persistence.ts`（已有，审查并修正）
- `scripts/check-opening-state.ts`（需要新增）

不得改现有背包类、旧巡检存档解析器、公共入口或 frozen contracts。

## 固定导出

```ts
// state.ts
createOpeningState(): OpeningState
reduceOpening(state: OpeningState, event: OpeningEvent): OpeningState
validOpeningState(raw: unknown): OpeningState | null

// persistence.ts
OPENING_SAVE_KEY // 'hku.opening.v1'
parseOpeningSave(raw: unknown): OpeningSave | null
captureOpeningSave(
  g: CampusGame, story: OpeningState, settings: Settings,
  position?: [number, number, number]
): OpeningSave
```

类型以实际 `src/opening/contracts.ts` 为准。Reducer 为纯函数，合法变更返回新对象；非法/重复事件返回原对象，不改原 events/flags。

## 状态顺序

| event | 前置 | 结果 |
| --- | --- | --- |
| `read_invitation` | bus，未读 | invitation_read=true，仍在 bus |
| `exit_bus` | bus，已读 | to_b5 |
| `accept_errand` | to_b5 | to_b6 |
| `take_laptop` | to_b6 | return_b5，laptop_acquired=true |
| `return_b5` | return_b5 | incident，campus_alert_triggered=true |
| `read_alert` | incident | to_b4，alert_read=true |
| `reach_b4` | to_b4 | complete |

事件日志依次为：`invitation_read`、`opening.bus_exited`、`opening.laptop_requested`、`laptop_acquired`、`campus_alert_triggered`、`opening.alert_acknowledged`、`opening.building4_reached`。不得发后续关卡完成事件。

## 存档行为

- 使用 opening 独立 key/mode/version；不能覆盖 `hku.digital-survey.v1`。
- 取电脑前空背包合法；laptop_acquired=true 时必须恰好一台 `macbook-air-13-silver`，不同 instanceId 的两台也非法。
- 校验 36 格、合法物品、count、唯一 instanceId、0..8 快捷栏、finite 坐标/朝向/时间及有效状态。设置复用 shared `readSettings`。
- 未知 version/mode 拒绝；worldRevision 不匹配应该交给调用方执行安全落点恢复，不静默把位置认成当前版本。说明你选用的恢复策略，不能只读错档。
- 当前 parser 把 revision 不一致直接拒绝，而 `experience.validPose()` 另有回到安全位置的逻辑；请审查两者一致性。优先保留可验证的故事/物品、令集成者恢复位置；涉及共享改动只提建议。
- capture 必须 clone，不修改游戏或故事。不要通过悄悄过滤非法重复电脑来隐藏运行时错误；如对初始种子电脑做兼容处理，明确说明并测试。
- 修复当前 persistence `itemId` 可空的 TypeScript 收窄问题。
- 不在这里写 localStorage/writer 锁、发奖励、切 UI 或改玩家位置；已有 experience 负责这些接线。

## 必测与交付

用 Node assert 编写真实用例：完整顺序、非法乱序、重复事件、初始档/已读但未下车档、缺失/重复电脑、重复实例、未知版本、坏状态 flags/events、NaN/Infinity、capture 不突变。直接运行：

```sh
./node_modules/.bin/tsx scripts/check-opening-state.ts
```

报告实际结果，不以返回常量或只测自己刚写的字段存在代替行为验证。最终交付三个文件与对 experience 的必要补丁建议，不直接改共享文件。
