# Agent C — 红眼扫描与短追逐机器人

执行 `00-START-HERE.md`，做一个局部开场机器人，不能开发战斗系统或通用全校园 AI。

## 只允许修改

- `src/opening/robot.ts`
- `scripts/check-opening-robot.ts`

先读 layout、现有 exploration/navigation.ts、physics.ts、config.ts，以及 `evidence/opening-feasibility/probes/robot.ts`。已有探针只是可行性样例，不是生产模块，不能复制后把未验证内容说成完成。

## 固定接口：调用者已按此编写

```ts
export function createOpeningRobot(world: Navigation): {
  root: THREE.Group;
  update(dt: number, player: THREE.Vector3,
         active: boolean, paused: boolean): {
    caught: boolean;
    state: string;
    warning: number;
  };
  reset(): void;
  dispose(): void;
  readonly position: THREE.Vector3;
}
```

`state` 建议为 patrol/scanning/chase/search/caught。warning 归一化 0..1。

现有 experience：固定物理 tick 调用 `update(dt,...,true,false)`；渲染时还会调用 `update(0,...,active,true)` **只读当前结果/同步显隐**。因此 dt=0 或 paused 不能重置追逐、计时或 lastSeen，必须返回当前状态；active=false 隐藏模型、冻结状态。reset 才明确恢复初始巡逻。

## 玩法约束

- 方块风原创小型安保机器人，合理比例，红眼和可见扫描方向/扇区。不是网页图标，不加血条/武器/掉落。
- 巡逻点读取 `OPENING.patrol`。速度比 2.6m/s 玩家步行慢，首版约 1.2–1.4m/s；只能躲避/跑开，玩家不能击杀。
- 发现 = 距离 + 扇区 + 眼部到玩家上身的 raycast 遮挡。首版可用约 9m、半角35°、确认0.7s，参数集中并可调。
- 确认发现后进入追逐，**不能发现即失败**。追到约 .65m 且高差合理才 caught。
- 只有能看见玩家时更新 lastSeen。丢视线后走向最后可见位置、搜索约3秒、再回巡；不能暗中追踪墙后实时位置。
- 移动使用现有 CharacterPhysics/Navigation，不能每帧直接位置 += 速度。禁止使用玩家 acquireControl/act 控机器人。
- 必须考虑局部通路：B05 从外场进屋需要经 x≈58 的门洞。看到屋内玩家不能从外场斜穿实体墙；丢失目标后不能无限顶墙。可使用小型已核验路点图，不必做全校园 navmesh。
- 每个巡逻/追逐路径边用现有物理验证；不能看到目标就无条件走直线。路径选择只使用当前可见或 lastSeen 位置。
- paused/电脑/失焦由调用者传入暂停，冻结计时和移动；不自行操作 DOM、玩家坐标、flags 或物品。caught 只作为结果交给 experience。
- 模型更新和销毁不泄漏 GPU 资源；扫描锥不能投影穿墙误导玩家，可缩短到遮挡处或采用清楚的近身扫描表现。

## 必测

1. 视锥内无遮挡可见，背后/距离外不可见，墙体阻挡。
2. 发现触发追逐而非 caught。
3. paused 和 dt=0 不改变位置、计时和 lastSeen。
4. 玩家移到遮挡后，lastSeen 不继续更新；机器人到旧点搜索并回巡。
5. 捕获条件与高度正确；reset 后可重复遭遇。
6. B05 门口折线路径不会穿墙，不能一直顶墙。
7. active=false 隐藏且冻结；dispose 可正常释放。

用实际 Navigation/CharacterPhysics 写 `scripts/check-opening-robot.ts`，运行 `./node_modules/.bin/tsx scripts/check-opening-robot.ts`。报告实际通过项及未验证的浏览器视觉/难度，不以 stub 返回值替代机器人行为。
