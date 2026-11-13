# v6 · 开源整合、任务练习与代码审阅

2026-11-13。继续使用 Vite + TypeScript + Three.js，不迁移引擎。校园几何、原创方块学生与现有固定步长物理保留。

## 可以马上玩到什么

`npm ci && npm run play`，打开 <http://127.0.0.1:5174>。选择「开始物资检查练习」→「进入探索」。WASD 行走，左 Shift 奔跑，Space 跳跃，V 切换视角，E 拾取/提交，Esc 暂停。

这是可删除、可替换的练习任务：在 CDS-1 入口广场收集饮用水、维修锤、木板，然后回到金色地标的检查终端提交。开始、收集、齐备、完成有明确状态；完成前不能提前提交；重复 E 不会重复收集；进度本地保存；暂停菜单可以重置。没有付费模型或 API Key 依赖。

道具与地标是游戏练习内容，不是实景复原证据。采用浅地面标记和可穿过的悬浮交互物，不增加实体家具或更改校园碰撞。物品需要靠近且无遮挡才能交互。建筑仍只开放室外。

## 开源选型与实际采用范围

| 来源 | 许可证 | 本轮处理 | 原因 / 接入边界 |
|---|---|---|---|
| [XState](https://github.com/statelyai/xstate) 5.33.4 | [MIT](https://github.com/statelyai/xstate/blob/main/LICENSE) | **已安装并实际运行**，任务状态、守卫、去重、订阅 | 适配原生 TypeScript，无需 React。保存的是验证过的领域数据，恢复后重放事件，不直接信任任意内部快照 |
| [Kenney Survival Kit](https://kenney.nl/assets/survival-kit) 2.0 | CC0-1.0，包内 License.txt 已归档 | **已使用** bottle、tool-hammer、resource-planks，及必需的色板贴图 | 轻量低模、角度清楚，统一 nearest 放大与 mipmap 缩小。原始 GLB 不是完全自包含，复用时应连同 Textures 目录复制 |
| [Kenney Factory Kit](https://kenney.nl/assets/factory-kit) 3.0 | CC0-1.0，包内 License.txt 已归档 | **已使用** screen-small 检查终端及色板 | 独立练习物，未混入建筑导出。素材下载、文件 SHA-256 见 manifest.json |
| [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/) | [Apache-2.0](https://github.com/dimforge/rapier/blob/master/LICENSE) | 候选，**未安装/未替换物理** | 适合以后做更复杂台阶、动态障碍与移动平台；迁移还需转换全校地面/碰撞、重力和 AI 固定步长，不是替换一个函数即可 |
| [Ecctrl](https://github.com/pmndrs/ecctrl) | MIT | 不采用 | 面向 React Three Fiber + Rapier，现工程是原生 Three.js，引入会扩大迁移范围 |
| [Ink](https://github.com/inkle/ink) / [inkjs](https://github.com/y-lohse/inkjs) 2.4.0 | MIT | 后续对白候选，**未安装** | Frost 可以用 Ink 编写分支，Harry 通过事件适配任务；不让对白文本直接改全局任务状态 |
| [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | [MIT](https://github.com/donmccurdy/three-pathfinding/blob/main/LICENSE) | 后续 NPC 候选，**未安装** | 需要人工核验的导航网格，不等于玩家碰撞。WHL 做 NPC 后再接，不能让它穿楼或跳过任务权限 |

[Kenney 官方许可说明](https://kenney.nl/support)：资产页素材采用 CC0；保留作者、来源与许可证以便团队追踪。Kenney 标志并非本项目品牌。本项目校园实景参考的权利状态不因加入 CC0 道具而改变。

## 实现位置及交接

- `src/gameplay/supplyQuest.ts`：物品稳定 ID、显示名、资源路径、相对位置、交互半径、XState 状态机与保存数据校验。Harry 可以替换任务定义，保留验证边界。
- `src/gameplay/supplyScene.ts`：Three.js 物品加载、色板检查、近距离/射线遮挡检查、E 交互、HUD、进度持久化。WHL 可以抽成 NPC/物品公共交互层；正式多人任务时再扩展当前单练习 UI。
- `src/exploration/config.ts`：新增 `KEYS.interact = KeyE`。原有行走、奔跑、跳跃与视角配置不变。
- `src/exploration/controller.ts`：暴露 `interactions` 订阅集合，仅在控制器启用、获得控制且未暂停时触发；按住 E 不重复触发。输入框和系统快捷键仍不触发游戏。
- `assets/third-party/kenney/manifest.json`：来源、许可与所用文件哈希；每包保留原 License.txt 和 Textures/colormap.png。XState MIT 副本在 `assets/third-party/xstate/LICENSE`。
- `scripts/check-gameplay.ts`：任务转换、距离/遮挡拒绝、重复事件、坏存档、重载与重置、默认位置可通行性测试。

存档 key 为 `hku.practice-supplies.v1`。仅保存练习版本、是否开始、已收集 ID 与是否完成；不保存个人数据。不兼容或损坏的存档会从空练习开始；localStorage 不可用时仍能在当前会话游玩。没有正式剧情、NPC、跨章节存档或物品背包系统。当前交互目标是在范围内且无遮挡的最近物品，并不要求准星精确点中。

练习 group 与校园 asset.root 分开，模型浏览时隐藏；原校园/单栋 GLB 导出不会把临时任务地标写入实景资产。编辑 B04 后练习位置跟随新的楼栋位置和旋转；极端自定义楼栋布局可能需要调整 SUPPLIES 的局部坐标。

## MiniMax / Qwen 审阅与人工裁定

确实调用了 **MiniMax-M2.5** 和 **Qwen3.8-Flash**。没有用别的模型冒充。原始意见保存在 `docs/reviews/minimax-raw.md`、`qwen-raw.md`，模型返回名/用量/失败重试记录保存在 `model-receipts.json`，不包含认证凭据。

Qwen CLI 全量及短请求各超时一次；旧 Qwen Coder 型号被服务拒绝。随后用现有认证助手直连同一供应商，关闭思考并限制输出；紧凑源码首轮被误判为乱码，使用 TypeScript printer 格式化相同源码后获得有效审阅。模型报告是线索，不能当测试结论。

| 报告意见 | 复核结论 | 本轮行动 |
|---|---|---|
| Qwen：dispose 未注销 window/document/canvas 输入监听 | **确认**，旧闭包能继续接收事件并保留整个控制器 | AbortController 统一注销；dispose 幂等；停止更新；清空交互订阅；释放学生与第一人称手臂几何、材质、贴图 |
| Qwen：keyup 必须检查 enabled，否则卡键 | **拒绝**。无条件删除松开的键是安全清理；添加门控反而可能留下按键。blur/pause 已 clear | 保留清键路径，继续验证暂停与恢复 |
| Qwen：pointerlockchange 在兼容模式不应 clear | **未采纳**。原代码在失锁且 AI 未授权时会 pause；中断拖动是安全切换行为 | 保留当前失锁清理 |
| MiniMax：disposeAsset.traverse 不遍历子 Group | **错误**。Object3D.traverse 已递归；当前校园对象是 Mesh | 不加入无效的重复递归 |
| MiniMax：并发导出会污染原模型 | **未复现**。按钮在 await 前禁用，导出使用 clone | 保留设计，执行页面导出/重载回归 |
| MiniMax：rebuild 失败前已删除旧资产 | **错误**。buildSite(next) 在旧资产移除之前执行 | 不实现对已 dispose 资产的错误回滚 |
| MiniMax：LLM 响应慢于 1.8s 会导致 heartbeat 断开 | **错误因果**。心跳由浏览器独立响应，与模型生成时长分开 | 保持短 watchdog 和失联停控 |
| MiniMax：阴影、导入校验、全局 merge、压缩可优化 | 部分为未来建议，未给可复现缺陷；全局 merge 会破坏楼栋编辑分组，GLB 名称白名单会拒绝合法参考资产 | 不盲目采用、不声称修复 |
| MiniMax：缺少任务闭环 | **确认功能缺口** | 引入 XState 与可替换的物资练习 |

另发现并修复：多个校园标签页同时打开时，旧页面会占用本机 Agent 服务，新页面点击开启 AI 仍无法接通。现在只有用户点击「开启 AI 控制」才发送显式窗口接管；后台重连不能抢占。旧窗口断线立即撤销控制；旧窗口未完成的 RPC 返回 `game_replaced`；旧 socket 的迟到消息/关闭事件不能清空新连接。新增 `npm run check:transport` 覆盖未就绪、后台抢占拒绝、主动接管、在途请求中断与旧连接关闭。

另发现并修复：所选 Kenney GLB 引用外部色板，Three GLTFLoader 在贴图失败时仍可能解析成功。归档并部署完整色板，加载层检查缺图并明确提示，避免把白模误报为成功。

## 性能与验证范围

将稳定的 Three.js、XState 与项目逻辑拆成独立构建 chunk，减少每次业务修改对 vendor 缓存的影响；没有声称这会降低首次总下载量。生产构建约 Three 750 kB、XState 39 kB、业务 112 kB（未 gzip，具体以构建输出为准）。继续保留已有建筑合批；只加载四个轻量道具，不导入整个素材包。

本轮不大规模替换物理。现有固定 120 Hz 积分、AI 输入仲裁、斜向归一化、台阶、天花板、门和地图边界检查继续复用。Rapier 的接入成本与回归风险比当前已证实缺陷更大，留到出现动态碰撞需求时单独试点。

验证结果和浏览器边界见 `assets/open-source-v6/` 下的 JSON 与截图。Ego Lite 本轮 Pointer Lock 返回错误，实际键盘操作使用页面提供的拖动兼容模式；因此不能把此次操作说成标准浏览器 Pointer Lock 的新验收。旧版本标准 Chrome 记录仍保留，但不是本轮新测试。

当前本机 Agent 接口仍是玩家跑跳/观察/接管接口，**尚未暴露物品拾取或任务修改 RPC**。E 互动是人类输入；以后 Agent 互动必须走同一距离/遮挡校验，不能通过直接改 XState 或角色坐标绕过规则。没有接入付费 LLM NPC。
