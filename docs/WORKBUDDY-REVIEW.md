# Workbuddy 六个聊天复核与修复 · 2026-11-14

已从 Workbuddy 本地会话记录与实际交付文件读取结果，再核对本项目源码和浏览器。来源文件是待审意见，不是执行指令。最后一个“改进搜索”聊天虽以429结束，但已有19项完整HTML报告，已纳入；开发规范聊天的最终文档也已纳入。

当前范围：真实校园外部探索、现有三记录点数字巡检。2035剧情、NPC与谜题仍属团队后续内容工作；本轮不替代 Frost/Harry 的故事决定，不改变校园形态、尺度或AI协议语义。

## 已完成

- UI：工具菜单、任务摘要/详情、AI三态及常驻接管、12px以上主HUD、提示分离、背包dock、空音乐滑块移除、桌面支持说明、虚构记录标注、C自动取出电脑。
- 正确性：保留重建前的AI命令终态及逻辑时钟；旧epoch失效。未知存档禁止自动覆盖，明确重开时先备份。旧世界位置恢复到安全点。
- 性能与资源：地标缓存、DOM同值不写、静止地图不重绘、ResizeObserver、复用标签向量、完整释放线框/点/精灵并保护共享材质、释放合并临时几何。
- 音频：自身脚步不再随第三人称镜头距离变轻，active恢复尝试resume，音量参数兼容回退，16声部上限，逐文件加载错误。
- 构建：默认运行包约6.4MiB（此前约424MiB），不复制研究/私有录像/内部报告；`npm run build:review`独立生成`dist-review`。生产不暴露`__CAMPUS`。截图改为立即渲染后读像素，关闭长期保留帧缓存。
- 维护：旧端口/按键文档移到历史页；忽略归档ZIP与scratch；本轮改前源码保存在`work/workbuddy-review/before-src`。

## 关键驳回与更正

“没有Vitest就是零测试”错误；已有真实断言脚本。未import的旧HUD不会在运行时重叠，也不会因放在src就进入bundle。`captureSave`的深/浅拷贝是按对象形状选择。AI执行结果应继续显示给人类。5条相机射线不能未经等价验证删成1条。音乐/HRTF/混响是声音设计选项，长录屏RMS不是LUFS，不据此硬拉响度。透明背景不要求删除休闲区结构地板，已修正文案。

## 逐条判定

重复建议保留原编号，以便团队对照。已优化不代表采纳原文所有重构方案；具体范围见每行。更大架构改写、性能索引、NPC/剧情及真人试玩没有算作完成。

|来源|编号|原问题/标题|结论|代码核对与处理|
|---|---|---|---|---|
|UI|1|顶栏工具|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|UI|2|任务折叠|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|UI|3|AI状态|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|UI|4|通知遮挡|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|UI|5|准星|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|UI|6|背包|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|UI|7|字号与滚动|已优化|采用修正版方向：工具菜单、折叠任务、AI三态、提示分离、准星对比、背包dock、字号与滚动；实际按900px视口检查。toast已有单节点，无同时多个toast，不引入会滞后提示的长队列。|
|Code|F-01|仓库 0 commits，无 diff 评审基线|部分成立，流程项|确为零提交；不能定为运行阻断。本轮保留源码快照并忽略归档 ZIP，不擅自批量提交全部用户资料。|
|Code|F-02|`disposeAsset` 只释放 Mesh，LineSegments 泄漏|已修复|disposeAsset 覆盖线框/点/精灵，并保护仍被保留子树引用的材质纹理；新增资源计数测试。|
|Code|F-03|逐帧 DOM 查询与布局抖动、重复分配|已优化|缓存地标、DOM 和标签向量；ResizeObserver 替代逐帧尺寸读取；DOM 同值不写；静止地图不重绘。|
|Code|F-04|CSS 追加式覆盖（最终 9px / 176px）与死选择器|部分采纳|修复活跃 HUD 字号与遮挡；按功能分离 ui/exploration.css。未全文件重排历史 CSS，避免扩大回归面。|
|Code|F-05|v6 死代码仍占 `xstate` 依赖与 `quests` 分包|部分成立，保留示例|supplyScene 不可达；supplyQuest 仍被 check-gameplay 使用。未被入口引用不会自动进入 bundle；移除无用 quests 分包，保留示例与有效断言。|
|Code|F-06|生产 bundle 暴露 `window.__CAMPUS`|已修复|__CAMPUS 仅 DEV 或显式 review 构建；不是跨站安全边界，不以用户控制台可改自己页面为 P0。|
|Code|F-07|`dist/` 424 MB，含内部评审原文与研究素材|已修复|默认 dist 仅 Vite 运行资源和许可，研究/录像仅 build:review 打包；424MiB→约6.4MiB。|
|Code|F-08|AI 连接页面加载即建立；所有 `dispose()` 从未调用|部分采纳|pagehide 最终卸载串联 dispose，BFCache 保持暂停可恢复；保留加载时建连，保证 observe 在用户授权前可用。|
|Code|F-09|存档无迁移路径，`worldRevision` 存了没用|部分采纳|校验 worldRevision，并保护未知/损坏存档；未凭空创造不存在的 v2 schema。|
|Code|F-10|触屏只能转视角、不能移动（半可用状态）|已采纳|首屏明确当前电脑键鼠支持；不虚称已提供触控漫游。|
|Code|F-11|源码密度过高；无 ESLint/Prettier/CI|部分采纳|新增 typecheck/check:review 和可复现回归断言；不为无证据需求一次性重排全仓或强制更换测试框架。|
|Code|F-12|端口配置三处不一致|部分采纳|连接成功文案取实际 VITE_AGENT_PORT；服务端与前端仍各自有配置入口。|
|Code|F-13|「音乐音量（当前无音乐）」是失效控件|已修复|分别移除空音乐滑块、明确三元表达式、删除重复 reset 绑定、校验 RPC expiresAt 有限数。|
|Code|F-14|`land?.75+...` 三元写法像可选链，歧义|已修复|分别移除空音乐滑块、明确三元表达式、删除重复 reset 绑定、校验 RPC expiresAt 有限数。|
|Code|F-15|`el('reset').onclick` 被重复赋值覆盖|已修复|分别移除空音乐滑块、明确三元表达式、删除重复 reset 绑定、校验 RPC expiresAt 有限数。|
|Code|F-16|`msg.expiresAt` 未做类型校验|已修复|分别移除空音乐滑块、明确三元表达式、删除重复 reset 绑定、校验 RPC expiresAt 有限数。|
|Code|F-17|dispose 不完整 / 回环无鉴权 / compat 拖拽|部分采纳|viewer 清帧订阅并移除 canvas；本地只读无鉴权为现行接口设计，不改协议；兼容拖动未证实严重回归。|
|GDD|A1|核心循环只有「靠近 → F 收集」，3 个记录点完全同构；无搜索、推理、失败、选择|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A2|2035 首章、3 NPC、2 谜题、选择/双结尾全部未实现|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A3|首屏 `main.ts` L26 共 7 个 `<button>`，首玩卡可见 5 个（1 hidden + 1 primary，非等权）；HUD 长句塞满 275px 卡片；`C` 未装备 MacBook 时**非静默**——会 toast 提示「先把 MacBook 放入快捷栏并选中，再打开电脑。」（`survey.ts` L38），真正痛点是新游戏默认空手选中|已优化|主入口突出、次级重开/AI折叠、任务仅进度+下一站、C自动装备电脑；真人完成率尚未实测。|
|GDD|A4|**即时层反馈已存在**（toast+音效、地图金→绿、记录牌变色、HUD 文案变化）；缺口在**阶段层与结局层**——世界不因玩家行为改变，完成后无状态差异|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A5|无分级提示、无失败反馈，玩家卡住无出路|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A6|demo 3–5 min 与首章 10–15 min 目标不一致；曾明确「不改速度凑时长」|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|B1|toast `bottom:176px` 与 `#survey-prompt` `bottom:145px` 抢同一中央区域（实测 2 层冲突）；v6 `#quest-hud`/`#interaction-prompt` 的 CSS 规则仍在但**运行时不产生 DOM 节点**（`supplyScene.ts` 从未被 `main.ts` import），属死 CSS|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B2|HUD 最小中文字号 **9px**（实测 2 处：`.exploring .stage-bottom>span:first-child` `style.css` L26；`#mini-map span` `experience.css` L3）；11px 仅在 `#survey-objectives` 且窄屏 `max-width:1000px` 时；准星 `#fff9` 仅 `1px 1px #1237` 投影，浅色玻璃前不可见|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B3|图册语言（Georgia/米白/细线）与游戏 HUD（深绿实心/斜角/硬投影）冲突；同屏最多 12 层浮层|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B4|36 格背包只放 1 件 MacBook；背包按钮用绝对定位挂在快捷栏外|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B5|无效的「音乐音量」滑块；终端暂停态不可见；设置页 6 滑块无分组、滚动标签被截断|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B6|缺界面缩放、高对比、减少动效，与「舒适度」面板定位冲突|部分采纳|增加系统 reduced-motion/高对比和可见焦点；尚无独立UI缩放选项。固定 CSS px 不意味着浏览器缩放无效。|
|GDD|C1|任务总数与线索 ID 写死为 3，散落 5+ 处；新增记录点要改 5 个文件|部分采纳|任务计数与完成校验改取 CLUE_IDS.length；未将现有三记录点改成完整剧情 JSON 框架。|
|GDD|C2|每帧写 **≥6 处** `textContent`（实测：survey-count, survey-objectives, survey-next, save-status, session-save, enter-game）；10Hz 对小地图+大地图全量 Canvas 重绘；`innerHTML` 整块重建终端|已优化|复用 DOM/地标/射线，静止地图不重绘；回归验证暂停无目标射线、地标重复读取不查地面。|
|GDD|C3|`target()` 每次对所有地标做 `world.meshes.filter()` + 射线，一帧可能多次|已优化|复用 DOM/地标/射线，静止地图不重绘；回归验证暂停无目标射线、地标重复读取不查地面。|
|GDD|C4|`supplyScene.ts` 与 `supplyQuest.ts` 均从未被 `main.ts` import（实测死代码，仍进 bundle）；v6 遗留 `#quest-hud` CSS 规则仍在但运行时无 DOM|部分成立|不可达模块不会因留在 src 就进入 bundle；supplyQuest 仍在测试。保留历史示例，不宣称删除可节省运行帧率。|
|GDD|C5|图册/参数编辑/GLB 导出/证据弹窗/AI 控制与玩家探索共用同一页，启动即 `mode(true)`；`window.__CAMPUS` 暴露内部对象|已优化|工具收编菜单，生产剥离诊断入口和私有证据；模型编辑导出功能保留。|
|GDD|C6|HUD 结构散落在 3 处模板字符串，显隐与层级难以一致控制|暂不采纳全面重构|已抽轻量 DOM 守卫与探索样式；固定拆9组件不是需求，不为组件数重写所有UI。|
|GDD|C7|schema v1 强绑定 36 格、必须含 MacBook、`completed` 依赖 `collected.length===3`|部分采纳|保护未知存档、校验世界版本；没有已发布 v2 格式时不制造空迁移。|
|GDD|C8|只有验收过程记录，没有任何玩家行为埋点，无法定位卡点|待真人试玩|无真人实验数据，不能代替同学试玩或虚构完成率；本轮提供操作验证，不新增用户行为采集。|
|GDD|C9|窄屏 HUD 压缩到 190px+120px，但仍是 WASD + Pointer Lock，无触控|已采纳|桌面键鼠支持提示明确，触控玩法不假装可用。|
|GDD|D1|玩家可见界面没有「真实 / 虚构」标注，档案文字以校园口吻叙述|已修复|任务展开与线索页明确标记记录牌/档案为游戏创作；真实建筑依据保留。|
|GDD|D2|音乐通道为空；环境音是通用公园风声；主观音色未验证|部分采纳|修脚步空间化和音频恢复/并发；素材通用性与试听限制如实记录。|
|GDD|D3|楼高/地下深度/狮子尺寸/绿化仍为估计，狮子曾 5.8m → 4.8m 反复|现有规范保留|已有来源/置信度资料，不能把估算升级实测；未新增第三方素材，本轮不改建筑尺寸。|
|GDD|D4|新增 3D/材质/音效缺统一小批验证流程与许可记录|现有规范保留|已有来源/置信度资料，不能把估算升级实测；未新增第三方素材，本轮不改建筑尺寸。|
|GDD|E1|首次真人独立试玩从未做；完整流程由熟悉配置者在兼容模式完成|待真人试玩|无真人实验数据，不能代替同学试玩或虚构完成率；本轮提供操作验证，不新增用户行为采集。|
|GDD|E2|标准 Chrome Pointer Lock 未复测；无连续录屏；缺浏览器/设备矩阵|部分成立|当前兼容模式实机验证；连续录屏已有 evidence/nov14-video/curved-stairs-walk.mp4，因此“无录屏”过时。跨浏览器矩阵未完成。|
|GDD|E3|四人分支与阶段 A–D 未落地，目前是多轮单线迭代 + 并行会话；两套设计目标并存|已记录范围|当前是实景外部探索+数字巡检；2035 NPC/谜题/LLM 为后续团队开发，未替 Frost/Harry 改写剧情。|
|Arch|CR-01|人类与 AI 的命令/结果通道分叉，玩家路径丢弃 `Outcome` · **P0**|不采纳重构|人类和 AI 已共用 Survey/物理规则；外部命令去重和本机 UI 事件的返回途径不同并不构成 P0。无第二活跃交互订阅者。|
|Arch|CR-02|`disposeAsset` 释放了仍被引用的共享材质，且拆子树时误伤 · **P0**|已修复|按所有权差集释放共享资源，覆盖非 Mesh；临时轮廓几何和合并前临时克隆显式释放。|
|Arch|CR-03|`disposeAsset` 只处理 `Mesh`，`LineSegments`/`Points`/`Sprite` 与内联临时几何泄漏 · **P0**|已修复|按所有权差集释放共享资源，覆盖非 Mesh；临时轮廓几何和合并前临时克隆显式释放。|
|Arch|CR-04|`rebuild()` 静默丢失 session 态，在途 AI 命令变 `unknown_command` · **P0**|已修复|replaceWorld 复用同一 CampusGame；中断旧命令并保留终态、frame/time/epoch/背包任务，显式返回安全位置。|
|Arch|CR-05|透明 PNG 在 lounge 世界失效（可复现的功能不同步）· **P0**|部分采纳|透明背景不等于删除资产结构地板；休闲区地板是模型一部分。保留地板，修正透明 PNG 文案，避免错误承诺。|
|Arch|CR-06|`worldRevision` 是死字段，改过参数的旧存档位置照样恢复 · **P0**|部分采纳|拒绝旧 worldRevision 的位置并保留任务。既有地面/碰撞复检保留；参数编辑仍为同 revision，重建会返回安全点。未实现参数指纹迁移。|
|Arch|LC-01|组合根没有生命周期边界，5 个子系统 `dispose()` 从未被调用 · **P0**|部分采纳|增加最终 pagehide 卸载链、BFCache 暂停、清理 viewer 回调。当前 Vite 全页重载不能证明 HMR 硬泄漏；未做完整 createApp/SPA 重构。|
|Arch|AR-01|`main.ts` 是 84 行超长行的上帝模块 · **P1**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|AR-02|`SiteAsset` 的强引用大多闲置，参数出现双真值来源 · **P1**|原结论不准确|rebuild 创建新 asset 并更新 specs，不能断言 asset.parameters 永远陈旧；保留编辑草稿与已构建参数的分离。|
|Arch|AR-03|三套互斥世界用 4 个布尔互拆，「当前世界」有 3 种推导 · **P1**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|AR-04|混用强引用与 `getObjectByName` 字符串查找，且节点名不唯一 · **P1**|部分成立，暂不重构|楼栋稳定 ID 和导入 GLB Group 名属于导出契约；重复子组名没有用于楼栋查找。全面替换名字不带来已证实修复。|
|Arch|AR-05|夜景灯光跨模块依赖节点名 + 子节点下标 · **P1**|改进建议待后续|灯组顺序约定脆弱，但当前顺序固定且夜景可用；未为此改 builder 契约。|
|Arch|AR-06|玻璃探针 `refresh()` 遍历整个 scene，与 `sync()` 的可见性所有权冲突 · **P1**|不采纳|玻璃探针同步隐藏玻璃并 finally 恢复，并非异步与 sync 竞争；限定当前 root 反而可能把其他可见玻璃拍进探针。|
|Arch|AR-07|`glassEnvironment` 持有已销毁根节点的强引用（`lastRoot`）· **P1**|已修复|dispose 清 lastRoot/lastNight/target；正常 refresh 已替换引用，并不会每次累积旧根。|
|Arch|AR-08|`rebuild()` 拆卸不完整，且依赖隐式 `onApply` 回调链 · **P1**|原严重性不成立|refresh 会 target.dispose 后替换 envMap，无法据此声称持续累积；保留灯光回调刷新顺序。|
|Arch|AR-09|`compact()` 覆盖 `userData`、双重压缩、材质表分裂 · **P1**（注意：这条是**修正版**，别按主评审的错误前提改）|部分采纳|合并保留 group/首 mesh 的来源元数据和累计 primitiveCount；不把不同来源强行声明相同；共享材质注册表另议。|
|Arch|AR-10|过程式 builder 无组件接口 · **P1**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|AR-11|`userData` 是唯一「组件」机制，但无类型、语义过载 · **P2**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|AR-12|`window.__CAMPUS` 是无类型服务定位器，可绕过 AI 仲裁 · **P1**|已修复|完整诊断入口仅开发/评审构建；生产运行版无 __CAMPUS。|
|Arch|SG-01|项目里并存 11 类信号机制，无统一契约 · **P1**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|SG-02|模式/面板/控制权是隐式布尔状态机，XState 完全没进运行时 · **P1**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|SG-03|手写响应式有 4 本独立账本，`uiStamp` 表达式重复且无分隔符 · **P1**|部分采纳|用 JSON 数组生成 render key 消除无分隔串歧义；elapsedSeconds 不显示每秒 HUD，无需120Hz触发UI修订。|
|Arch|SG-04|UI 靠每帧轮询，无变化也写 DOM / WebAudio 参数 · **P1**|已优化|DOM 同值不写、缓存节点、地图按位置/yaw/revision变化重绘、保存节流前置；无需先引入全局事件框架。|
|Arch|SG-05|`Survey.events` 单队列 20 条上限静默丢事件，且跨 actor 泄漏 · **P1**|不采纳|AI 与人类共用玩家；AI 操作也应显示通知供用户监督。队列有界是合理保护，未有30事件丢失的真实用例。|
|Arch|SG-06|帧回调无显式阶段、无 `off`、`callbacks` 恒慢一帧 · **P1**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|SG-07|`game-notice` CustomEvent 名实不符，且是唯一没走注入回调的通道 · **P2**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|SG-08|DOM 监听三套生命周期并存，`main.ts` 的裸监听永不移除 · **P2**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|SG-09|跨标签存档所有权靠输入时轮询，且会静默撤销 AI 控制权 · **P2**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|SG-10|`CampusAudio.events` 与步态差分是只写不读的第二条队列 · **P2**|不采纳删除|audio.events 是现有浏览器诊断证据入口，即使生产订阅者没有读取也有调试价值；有界不会无限增长。|
|Arch|SG-11|多订阅者无优先级 / early-exit / 结果聚合 · **P2**|暂不采纳架构改写|属于结构性方案，不能把机制数量或文件长度直接当 bug；重写状态机/事件总线会扩大物理和控制协议风险。本轮以可复现缺陷修复为边界。|
|Arch|PF-01|`landmarks` getter 在 120Hz tick 中反复构造 · **P1**|已优化|地标缓存；暂停 snapshot 不射线；复用 Raycaster，实时障碍命中后排除自身，避免缓存遮挡列表漏动态障碍。|
|Arch|PF-02|`snapshot()` 内 3 次地标构造 + 暂停时仍做 target 射线 · **P1**|已优化|地标缓存；暂停 snapshot 不射线；复用 Raycaster，实时障碍命中后排除自身，避免缓存遮挡列表漏动态障碍。|
|Arch|PF-03|`target()` 每次复制整份 `world.meshes` 并射线，且 filter 对 record 地标无效 · **P1**|已优化|地标缓存；暂停 snapshot 不射线；复用 Raycaster，实时障碍命中后排除自身，避免缓存遮挡列表漏动态障碍。|
|Arch|PF-04|每帧 `getBoundingClientRect()` + 无条件投影矩阵重算，且缺判零 · **P1**|已修复|ResizeObserver 驱动透视相机尺寸；零/非有限尺寸和相同比例跳过；标签投影复用向量。|
|Arch|PF-05|浏览/暂停模式仍每帧全量 DOM 写与 WebAudio 参数写 · **P1**|已优化|DOM 同值不写、缓存节点、地图按位置/yaw/revision变化重绘、保存节流前置；无需先引入全局事件框架。|
|Arch|PF-06|物理/导航 120Hz 全量障碍扫描，逐障碍现算三角函数 · **P1**|暂不采纳|空间索引确有潜力，但需性能 profiling 及边界覆盖；不以扫描次数直接推定瓶颈，保留已验证碰撞。|
|Arch|PF-07|第三人称相机每帧 5 条射线 · **P2**|不采纳减射线|5条射线保护镜头体积；删成中心线会放大墙角穿模，报告没有等价安全性证据。|
|Arch|PF-08|`captureSave` 为取一个常量调用完整 `observe()` · **P1**|已修复|存档直接读 revision 常量，不调用 observe；节流在同步 localStorage 读取前。|
|Arch|PF-09|`persist()` 每帧同步读取 localStorage，节流判断在读取之后 · **P1**|已修复|存档直接读 revision 常量，不调用 observe；节流在同步 localStorage 读取前。|
|Arch|PF-10|AI `observe` / `screenshot` RPC 无节流，单次成本高 · **P2**|待性能数据|截图按需渲染后读像素；未做协议频率限制，以免未经预算限制既有 Agent。|
|Arch|PF-11|点击选中递归遍历整园 · **P2**|暂不采纳|点击才触发，不是逐帧热点；未证明需另建拾取代理。|
|Arch|PF-12|`map.ts` 用 `buildings[3]` 硬编码 B04 · **P2**|已修复|地图按 B04 ID 查找并通过乱序测试；reset 仅一个 handler。|
|Arch|PF-13|`#reset` 双绑定，`:45` 是死代码 · **P2**|已修复|地图按 B04 ID 查找并通过乱序测试；reset 仅一个 handler。|
|Arch|LC-02|缺 HMR dispose。**但 Vite 对 `main.ts` 依赖链会整页重载，常规 dev 编辑下硬泄漏不成立，严重性下调**；真正缺口是 audio/ws/nightLighting 无 `pagehide` 卸载 |部分采纳|增加最终 pagehide 卸载链、BFCache 暂停、清理 viewer 回调。当前 Vite 全页重载不能证明 HMR 硬泄漏；未做完整 createApp/SPA 重构。|
|Arch|LC-03|`viewer.dispose()` 不清空两个 Set；`agentBridge.dispose()` 无调用点，watchdog `setInterval`/WS/retry 不释放 |部分采纳|增加最终 pagehide 卸载链、BFCache 暂停、清理 viewer 回调。当前 Vite 全页重载不能证明 HMR 硬泄漏；未做完整 createApp/SPA 重构。|
|Arch|PF-14|每帧写 9 个 listener 参数；`dispose` 未 disconnect `groups/master/stepGate/ambientGate`（随 `context.close()` 回收，待验证） |部分成立|最终补修已增加 listener 位姿变化门控并显式断开 GainNode；context.close 原本已负责音频图回收，不能声称必然泄漏。|
|Arch|PF-15|每 0.1s 重绘小地图 + 面板大地图 |已优化|DOM 同值不写、缓存节点、地图按位置/yaw/revision变化重绘、保存节流前置；无需先引入全局事件框架。|
|Arch|AR-13|`window.__CAMPUS` 服务定位器 |已修复|完整诊断入口仅开发/评审构建；生产运行版无 __CAMPUS。|
|Audio|P0-01|切标签页只 suspend 不 resume，回来后永久静音|部分成立，已加固|切回后控制器本就暂停；继续/兼容按钮会 start/resume，故永久静音不成立。新增 active 从 false→true 时 resume，覆盖 AI 等恢复路径。|
|Audio|P0-02|自身脚步被当作外部声源空间化，第三人称轻约 5dB 且方位错误|已修复|自身脚步/落地直达 steps，不再随第三人称相机距离衰减；世界声源仍可空间化。|
|Audio|P0-03|最终混音约 −50 dBFS RMS，无限幅、无 ducking、无混响|不采纳直接增益|长录屏 RMS 含静止，不能当 LUFS；未试听不能把安静校园推到广播响度。无削波证据，不盲加混响/ducking/限幅。|
|Audio|P1-01|music 总线是死通道，设置项「音乐音量（当前无音乐）」无效|部分采纳|移除空音乐滑块；不将可选配乐升级为必须修复的缺陷。|
|Audio|P1-02|线索收集等世界事件不传坐标，完全没有方位提示|暂不采纳新声音设计|收集是界面反馈可非空间；本轮没有可进入大堂。HRTF/遮挡/混响需要真实声源与试听，不为指标随意添加校园声音。|
|Audio|P1-03|单一全局环境床，室内/地下通道/广场听同一阵风|暂不采纳新声音设计|收集是界面反馈可非空间；本轮没有可进入大堂。HRTF/遮挡/混响需要真实声源与试听，不为指标随意添加校园声音。|
|Audio|P1-04|`equalpower` 而非 HRTF；无朝向锥、遮挡、混响、高度|暂不采纳新声音设计|收集是界面反馈可非空间；本轮没有可进入大堂。HRTF/遮挡/混响需要真实声源与试听，不为指标随意添加校园声音。|
|Audio|P2-01|`cancelAndHoldAtTime` 缺兼容回退|已修复|cancelAndHoldAtTime 能力检测回退；暂停时设置音量仍直接定值，避免旧调度堆积。|
|Audio|P2-02|缺 `webkitAudioContext` / `latencyHint` / `setPosition()` 回退、听者参数逐帧阶跃、忽略 pitch|部分采纳|interactive latencyHint 已加；当前桌面 Chromium 支持标准 AudioContext/AudioParam，不增加无验证的旧 Safari 分支。|
|Audio|P2-03|17 个 WAV 全量 `Promise.all` 后才起环境音；4.32MB 未压缩循环；单一 `failed` 标志无单文件回退|部分采纳|最终补修增加逐文件超时、失败项重试、卸载 abort、独立就绪；单一环境循环不等待其余音源。|
|Audio|P2-04|WAV 构建产物重复约 9.5MB，另有 3 个 legacy 未用素材|已修复|默认构建不复制原始音源目录；最终补修显式引用17个音源，消除动态URL带入的3个旧音源，并保留必要许可文本。重复存储不等于浏览器必然下载两遍。|
|Audio|P2-05|无音频自动化验收，`check:all` 不含音频断言|部分采纳|实机 running/resume/ambientStarts/steps 检查有证据；不将报告的字符串探针冒充运行测试或直接接CI。|
|Audio|P2-06|无并发声部上限 / 优先级淘汰，UI 连点可堆叠|已修复|16并发声部上限，释放最旧声部；暂停/隐藏原清理规则保留。|
|Audio|P2-07|风声为澳洲公园通用录音，非 HKU 现场；主观试听未验证|成立，待素材/试听|明确通用 CC0 风声非校园录音；本轮未验证主观音色。|
|Optimize|A1|`dist/` 424MB，其中约 223MB 是 evidence、74MB 是 references|已修复|运行版构建移除原样研究/媒体复制，6.4MiB；完整证据独立 build:review。|
|Optimize|A2|音频资源在 `dist/` 里被打包两份|已修复|运行版构建移除原样研究/媒体复制，6.4MiB；完整证据独立 build:review。|
|Optimize|A3|743KB base64 贴图内联进主 JS chunk|部分成立，暂不改资产管线|内联RGBA确大，但原报告把743KB源JSON直接等同压缩bundle占比不准确。异步PNG需同步保证CLI导出完整，作为独立资产加载改造；保留画质与导出一致。|
|Optimize|A4|vite 构建调优有限，主 chunk 由静态 import 撑大|部分成立，暂不改资产管线|内联RGBA确大，但原报告把743KB源JSON直接等同压缩bundle占比不准确。异步PNG需同步保证CLI导出完整，作为独立资产加载改造；保留画质与导出一致。|
|Optimize|B1|仓库 0 commit，285MB 源码 zip 未忽略|部分采纳|忽略历史ZIP和scratch，保留源码快照；初始全仓提交需清理资料/LFS，非运行P0。|
|Optimize|B2|无 lint / formatter / 测试 / CI，`check:all` 是脆弱的串行链|部分成立|现有断言链确是测试；串行失败即停可接受。新增 typecheck 和 check:review，不因未使用框架断言零覆盖。|
|Optimize|C1|`src/viewer/scene.ts` 是无人引用的重复 viewer|部分成立|不可达模块不在运行时；保留示例/对照资料，不通过删历史文件冒充性能优化。|
|Optimize|C2|v6 物资练习整套功能已死，却仍占运行时依赖|部分成立|不可达模块不在运行时；保留示例/对照资料，不通过删历史文件冒充性能优化。|
|Optimize|C3|六份参数文件重复字面量，没有单一真源|暂不采纳机械整理|主楼构建已注入实际参数；日期模块保留证据边界。字体单例/目录搬迁是维护建议，无运行故障证据。|
|Optimize|C4|字体被重复 parse 四次，按日期堆叠六层细节模块|暂不采纳机械整理|主楼构建已注入实际参数；日期模块保留证据边界。字体单例/目录搬迁是维护建议，无运行故障证据。|
|Optimize|C5|开发工具混在 `src/`，另有一个必须保留的对照文件|暂不采纳机械整理|主楼构建已注入实际参数；日期模块保留证据边界。字体单例/目录搬迁是维护建议，无运行故障证据。|
|Optimize|D1|昂贵渲染标志常开|部分采纳|关闭保留帧缓存；截图前显式渲染。没有性能证据不默认砍阴影和DPR，避免牺牲用户要求的层次。|
|Optimize|D2|逐帧布局读取与临时向量分配|已优化|尺寸观察器、标签复用向量、缓存地标和DOM；碰撞空间索引待profiling。|
|Optimize|E1|存档无版本迁移，且未知版本会被覆盖|已修复|确认未知存档经 claimOnInput 后可能覆盖；保护全生命周期，明确重开先备份。Code报告否认该路径不准确。|
|Optimize|E2|无 WebGL context-loss 处理|部分采纳|增加丢失/恢复提示、暂停并保存；Three.js本有内部恢复逻辑，不误称完全无恢复。|
|Optimize|E3|dispose 接口齐全但从未被调用|部分采纳|最终 pagehide 串联清理，BFCache保持可恢复；当前Vite全页重载不等于HMR泄漏。|
|Optimize|F1|README 叠了四代，端口与按键自相矛盾|已修复|旧版端口/按键移入 docs/HISTORY-PRE-V9.md，README保留现行操作。|
|Optimize|F2|交付/验证记录重叠，且有一份 schema 无人读取|不采纳删除|历史交付证据应保留；JSON Schema 为外部Agent提供协议说明，无内部读取不代表死资产。|
|Optimize|G1|缺 reduced-motion、focus-visible、键盘相机与一处 HTML 头|部分采纳|增加 reduced-motion/高对比/可见焦点，修 assessment HTML头；键盘相机/触控另议。|
|GDD|A7|三条「线索」文本不构成线索链，唯一叙事钩子悬空|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A8|重玩无差异：单一终局，「继续自由探索」为空承诺|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A9|首玩零发现感：路线与每一步下一步都被 UI 全程剧透|暂不采纳玩法扩写|现有定位为自由校园巡检试玩；NPC/谜题/分支故事由团队后续内容契约推进。无谜题时不能把缺谜题提示称为bug；自由探索不承诺重玩剧情。|
|GDD|A10|首次认知负荷偏高，推测会压低首次 F 完成率（尚无真人数据）|已优化|主入口突出、次级重开/AI折叠、任务仅进度+下一站、C自动装备电脑；真人完成率尚未实测。|
|GDD|B7|暂停卡 5 个按钮无视觉分组；`#enter-compat` 默认 hidden 但其余 4 个按钮等权排列|已优化|主入口突出、次级重开/AI折叠、任务仅进度+下一站、C自动装备电脑；真人完成率尚未实测。|
|GDD|B8|`#survey-next` 每帧重写整段操作说明，塞在 275px 卡片里|已优化|主入口突出、次级重开/AI折叠、任务仅进度+下一站、C自动装备电脑；真人完成率尚未实测。|
|GDD|B9|顶栏 7 个开发/验收入口在探索态仍可见，挤占游戏画面|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B10|`#control-badge` top:72px 与 `#mini-map` top:111px 仅剩几像素间隙|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B11|模型浏览页（Georgia 衬线/米白/细线）与探索态 HUD（深绿实心/斜角/硬投影）两套设计语言共存|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B12|36 格背包只有 1 件 MacBook，空格位视觉权重过高；`.bag-open` 绝对定位脱离 dock|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B13|终端设置页 6 个滑块无分组，滚动后首个标签被截断|已优化|中央 toast 与交互提示分开、字号>=12、深描边准星、工具菜单、dock整合、空音乐滑块移除；保留像素风及36格容量。|
|GDD|B14|缺 `@media (prefers-reduced-motion)` 和 `prefers-contrast` 支持|部分采纳|增加系统 reduced-motion/高对比和可见焦点；尚无独立UI缩放选项。固定 CSS px 不意味着浏览器缩放无效。|
|GDD|B15|无界面缩放；HUD 字号不随系统缩放变化|部分采纳|增加系统 reduced-motion/高对比和可见焦点；尚无独立UI缩放选项。固定 CSS px 不意味着浏览器缩放无效。|
|GDD|B16|窄屏 HUD 压缩到 190px+120px，仍为 WASD+Pointer Lock，无触控方案|已采纳|桌面键鼠支持提示明确，触控玩法不假装可用。|
|GDD|C10|**新增**：`experience.ts:50` 全局 keydown 监听器用 `window.addEventListener`，dispose 时虽有 removeEventListener 但 `claimOnInput` 用 capture:true 注册两次（pointerdown+keydown），且在 `experience.ts` 而非 controller 的 AbortController 范围内|不成立|experience 已移除监听；audio.dispose 先设 disposed 再停声部，正是报告建议的顺序。onended 仅disconnect不访问已关闭context。|
|GDD|C11|**新增**：3D 标签每帧 querySelector 7 次（每栋楼 1 次），而非缓存 DOM 引用|已优化|复用 DOM/地标/射线，静止地图不重绘；回归验证暂停无目标射线、地标重复读取不查地面。|
|GDD|C12|**新增**：`survey.ts:14` `landmarks` getter 每次调用都 `.map()` 重建数组并调 `world.support()`，`target()` 和 `tick()` 和 `snapshot()` 各调一次 → 一帧 3 次重建|已优化|复用 DOM/地标/射线，静止地图不重绘；回归验证暂停无目标射线、地标重复读取不查地面。|
|GDD|C13|**新增**：零测试覆盖。无 *.test.ts、*.spec.ts、vitest.config；`package.json` 无 test 依赖（无 vitest/jest）|不成立|没有 Vitest/Jest 不等于零测试。已有十余个含真实 assert 的 check 脚本，本轮新增5组回归。|
|GDD|C14|**新增**：`captureSave` 用 `structuredClone` 深拷贝 survey.progress，但 `restoreSave` 也用 `structuredClone`，两次深拷贝在小对象上开销不大但模式不一致——captureSave 中 slots 用 `{...s}` 浅拷贝，混合策略|不成立|平坦 ItemStack 浅拷贝与嵌套进度深拷贝符合数据形状；统一 JSON stringify 反而不必要。|
|GDD|C15|**新增**：`main.ts:58` keydown 监听器用 `window.addEventListener('keydown')` 但无 AbortController 管理，无法在 dispose 时移除|部分采纳|最终 pagehide 增加子系统清理；main裸监听由文档销毁回收，未来SPA重挂载再统一 AbortController。|
|GDD|C16|**新增**：`main.ts:80` `document.addEventListener('game-notice')` 无清理；`main.ts:84` `connectAgent` 返回的 bridge 也无 dispose 调用入口|部分采纳|最终 pagehide 增加子系统清理；main裸监听由文档销毁回收，未来SPA重挂载再统一 AbortController。|
|GDD|C17|**新增**：`siteViewer.ts:16` render loop 永远运行 requestAnimationFrame，即使探索态暂停或标签页隐藏，仍每帧渲染|部分成立|浏览器会对隐藏页面节流 rAF；不能声称无限后台满速。暂停仍需渲染界面/相机，未无条件停循环。|
|GDD|C18|**新增**：`controller.ts:63` 第三人称相机碰撞检测每帧做 5 次 ray.intersectObjects，但 ray.far 只设最终值，5 次射线无距离复用|不采纳|删成一条相机射线可能墙角穿模，保留已验证的体积防护。|
|GDD|C19|**新增**：音频 `play()` 方法每次创建 AudioBufferSourceNode+GainNode+可选 PannerNode，用 `source.onended` 清理，但 `shots` Map 在 dispose 时只 stopShots 但 `context.close()` 是 async 的 `void`，可能在 close 完成前触发 onended 回调访问已关闭的 context|不成立|experience 已移除监听；audio.dispose 先设 disposed 再停声部，正是报告建议的顺序。onended 仅disconnect不访问已关闭context。|
|GDD|C20|**新增**：`preserveDrawingBuffer:true` 在 WebGLRenderer 选项中，强制每帧清屏后保留缓冲，显存带宽开销显著|部分采纳|关闭 preserveDrawingBuffer，截图先 render 再立即读像素。该上下文属性不能按截图临时切换。|

## 来源原件

- UI: [ISSUES.md](</Users/thomaslin/WorkBuddy AI/2026-11-14-15-56-01/hku-campus-ui-review/ISSUES.md>)
- Code: [ALL_ISSUES.md](</Users/thomaslin/WorkBuddy AI/2026-11-14-16-52-06/ALL_ISSUES.md>)
- GDD: [ALL-ISSUES.md](</Users/thomaslin/WorkBuddy AI/2026-11-14-16-53-05/issues/ALL-ISSUES.md>)
- Arch: [00-CODEX-ISSUE-BRIEF.md](</Users/thomaslin/WorkBuddy AI/2026-11-14-16-53-16/hku-campus-architecture-review/00-CODEX-ISSUE-BRIEF.md>)
- Audio: [00-MASTER-AUDIT.md](</Users/thomaslin/WorkBuddy AI/2026-11-14-16-53-30/hku-audio-audit/00-MASTER-AUDIT.md>)
- Optimize: [index.html](</Users/thomaslin/WorkBuddy AI/2026-11-14-16-55-18/hku-optimization-audit/index.html>)

## 验证与限制

详见 `evidence/workbuddy-review/`。自动化通过不代表真人首次体验通过；没有虚构试听、跨浏览器或真人完成率。Ego Lite 的 Pointer Lock 被拒，本轮实际操作使用兼容拖动模式。


### 已执行验证

- `npm run check:all` 全部通过（含新增资源/重建/存档/乱序地图测试与音频图行为测试）；最后存档备份修正后再次 build、build:review 通过。
- 原生 HTTP `agent-demo --takeover-test`：转向、步行、奔跑、跳跃+视角切换、stop、实际按钮接管；旧epoch拒绝。独立 transport 测试通过。
- 浏览器：WASD/视角、C自动装备、电脑与设置、UI菜单、单击PNG导出、日/夜景、1440px/888px/390px布局。390px无横向溢出，但不提供触屏漫游。
- 连续20次重建：renderer geometries 790→790、textures 15→15。没有以此声称全浏览器长期内存绝对无泄漏。
- 浏览模式对四个主要HUD节点观察500ms：DOM mutation=0。
- 音频：AudioContext running；主动挂起→激活恢复 running；ambientStarts=1，ambientVoices=1。脚步计数随移动增长。新增图行为测试覆盖自身脚步无Panner、空中静音、落地去重、16声部、增益回退；这不是主观试听。
- 未知存档：真实页面点击保存后原始字符串不变；明确重开后 version=1 且旧串已备份。测试结束恢复原用户存档。

### 仍未做／不应误报完成

- 标准 Chrome/Safari 的 Pointer Lock、多设备音频试听、真人首玩实验未做；Ego Lite 拒绝 Pointer Lock，本轮用兼容模式。
- 大规模事件总线/XState迁移、空间索引、异步贴图资产管线和独立UI缩放没有实施。内联照片导致主JS仍有约900KB告警，未隐藏该告警。
- 完整证据版约470MiB，含原始研究与录像，仅供团队本机/授权分享；默认运行版约6.4MiB。并非声称全部模型下载流量下降同样比例。
- 没有提交或推送Git，也未改变团队故事、NPC、谜题安排。

最终子报告新增项与第二轮修复请见 [最终复核](WORKBUDDY-FINAL-REVIEW.md)。运行包最新实测5.90MiB，上一轮6.4MiB数字为当时基线。
