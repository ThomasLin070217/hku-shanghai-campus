# 现有实现与 Unity 实现路线调研

日期：2026-11-13。依据：当前仓库 v5 源码，以及本文直接链接的 Unity 官方文档。本轮完成代码核对和文档调研，**尚未建立或运行 Unity 原型**；兼容性与性能结论需要后续实测。本文是技术选型建议，不替代现有团队任务书，也未决定迁移。

## 1. 我们现在怎么实现

最初需求明确提出无现成工程时默认 Vite + TypeScript + Three.js，现有工程沿用了这个方案。

| 层 | 当前实现 | 源码 |
|---|---|---|
| 校园资产 | TypeScript参数生成真实3D网格；分组、合并重复几何；低分辨率像素材质；可导出GLB | `src/model/`、`src/voxel/materials.ts` |
| 画面与相机 | Three.js WebGLRenderer；浏览模式正交OrbitControls；探索模式透视镜头 | `src/viewer/siteViewer.ts`、`src/exploration/controller.ts` |
| 玩家运动 | 自写运动学圆柱角色、简化障碍代理和地面高度；固定1/120秒步进；统一处理人工与AI意图 | `physics.ts`、`navigation.ts`、`game.ts` |
| 角色动画 | 方块身体分组，通过代码按速度/落地状态旋转手脚与袍摆 | `src/exploration/student.ts` |
| 界面 | HTML/CSS与TypeScript事件处理 | `src/main.ts`、`src/style.css` |
| 外部Agent接口 | 本机Node HTTP服务 → WebSocket → 浏览器CampusGame；命令限时、去重、控制权epoch、人工接管 | `scripts/agent-server.mjs`、`src/agent/` |
| 内容进度 | 已有校园探索与资产工具；NPC、剧情、谜题、NPC LLM仍在团队设计交接阶段 | `docs/team/` |

Three.js在这里承担渲染与3D场景基础；碰撞、输入仲裁、任务等玩法需要我们自己维护。当前没有第三方完整物理引擎，也没有Unity场景/Prefab工程。视觉是方块风，未实现Minecraft式可破坏体素世界。

有两种不同的“AI”：现有的是外部Agent操作玩家；未来NPC LLM是对话与叙事服务。它们应保持独立。

## 2. 同样的游戏在 Unity 中怎样搭

建议验证组合：团队统一一个受支持的 Unity 6 LTS 具体补丁版本，URP、C#、Input System、Cinemachine 3、AI Navigation、glTFast。包版本按所选Editor兼容矩阵锁定，不盲目混用不同代教程。这里不承诺某个“最新版”或未经实测的包组合。

### 校园与像素风

通过 glTFast 导入现有GLB，逐栋组织成Prefab，将视觉模型、简化碰撞和互动锚点分开。Prefab可保存组件、属性和子对象作为复用模板。URP作为项目渲染管线候选；保留原创方块几何与低分辨率贴图，近处Point采样，结合mipmap及目标设备验证远处闪烁。灯光、曝光、玻璃与自发光需在Unity中重新匹配，不能保证自动与Three.js一致。[glTFast](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.0/manual/index.html)、[Prefab](https://docs.unity3d.com/6000.0/Documentation/Manual/Prefabs.html)、[URP](https://docs.unity3d.com/6000.0/Documentation/Manual/universal-render-pipeline.html)

不把每个可见像素都做成独立GameObject。校园按楼栋/区域拆分；重复窗格/树叶保留合并或实例化策略。普通墙体、雨棚、地面用简化Collider；特殊静态几何按需要用MeshCollider，避免给所有装饰逐件配置昂贵碰撞。

### 玩家控制

Input System定义Move/Look/Sprint/Jump/ToggleView/Interact/Pause动作；自己实现 `PlayerMotor`，将人工与外部AI意图送到同一入口，再调用CharacterController.Move。Unity官方将Input System列为更新、支持更充分的输入方案。[Input System](https://docs.unity.com/en-us/engine/6000.0/manual/input)

CharacterController提供碰撞约束与碰撞方向反馈，但 **Move本身不施加重力**。仍要写垂直速度、重力、落地、一次起跳与暂停输入规则，测试台阶/坡道/头碰雨棚。不能同时让Rigidbody、CharacterController和直接改transform争夺同一个角色位置。[CharacterController.Move](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/CharacterController.Move.html)

保留同一个角色物理状态；V只切换相机与自身显示。第一人称放眼高相机并隐藏头部；第三人称用Cinemachine Third Person Follow，它自带障碍调整。必要时选用Deoccluder处理遮挡，设置正确Collider层；不无条件叠加两套相机避障导致抖动。仍需自行驱动视角目标与处理鼠标锁定/失焦。[Third Person Follow](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineThirdPersonFollow.html)、[Deoccluder](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineDeoccluder.html)

可以用固定模拟步长保留逻辑帧/命令语义，但不能承诺Unity物理在不同平台逐位确定性。验收比较速度、距离、跳跃高度和阻挡结果，而不是要求浮点轨迹完全一致。

### NPC、动画与交互

NPC用Prefab组合：视觉模型、行为脚本、交互组件、可选NavMeshAgent。Animator以速度、Grounded、Talking等参数驱动待机/行走/交谈状态；方块人物也可以继续使用简单分组动画，无须强上复杂人体骨骼。[Animator参数](https://docs.unity.com/en-us/engine/6000.6/manual/animation-section/animation-mecanim/animation-animator-controller/animation-state-machines/animation-parameters)

AI Navigation负责NavMesh可走区域、寻路与障碍/连接；它不是LLM，也不提供人物性格。首版固定站位NPC即可；要巡逻时再烘焙道路NavMesh并测试窄道。不要同时让NavMeshAgent和另一个运动脚本直接改同一个NPC位置。[AI Navigation](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/index.html)

E交互仍需项目代码：视线Raycast + 范围校验 → IInteractable → 对话/线索/终端事件。对话界面可用Unity UI；UI框架选择在小样中验证中文输入、焦点、Esc和游戏输入切换。升级引擎不会自动解决对话误触移动。

### 剧情、谜题与存档

建议普通C#核心负责确定性任务状态机，Unity组件负责表现和接线。JSON作为Frost与Agent容易编辑的内容源；可用ScriptableObject承载编辑器中的NPC/任务定义。ScriptableObject是独立于GameObject的数据资产，不等于发行版玩家存档服务；运行进度单独序列化并加版本。[ScriptableObject](https://docs.unity3d.com/6000.0/Documentation/Manual/class-ScriptableObject.html)

LLM回答通过后端生成；关键任务状态、谜底、道具授予仍由规则校验。无key/断网使用固定对白。Unity客户端同样不能保存模型供应商密钥。

## 3. 保留原生Agent接口的方案

建议保留 `hku-campus/1.0` 的HTTP外部契约；将浏览器侧 `CampusGame` 规则移植为C#，并添加Unity传输适配器。现有本机Node服务继续作为外部Python/Node脚本的入口。

```text
人类 Input System ────────────────┐
                                 ↓
外部脚本 → 本机Node → Unity桥接 → 控制权仲裁 → PlayerMotor → CharacterController
                                 ↓
                           逻辑帧/状态/命令结果

NPC聊天UI → 独立对话后端 → LLM或固定对白
                   （不取得玩家移动控制权）
```

必须保留：observe、acquireControl、act、stop、releaseControl；持续时间上限、事件只消费一次、命令去重、epoch作废、人工接管、断线清输入、not_ready。网络接收回调只入队；在Unity主线程的游戏更新中消费动作，不能在网络线程操作场景对象。

**桌面版：** Unity客户端连接本机bridge；原服务目前只接受列出的网页Origin，原生客户端接入要补兼容握手及验证，不能宣称原样即可连上。保留127.0.0.1绑定和单游戏连接，不放开为任意公网控制。

**Web版：** 不能照搬桌面.NET socket/HttpListener方案。官方文档明确Web不支持这些常规.NET网络方式；HTTP用UnityWebRequest，WebSocket需浏览器JS插件等桥接。保留Node服务，增加 `.jslib` 与C#之间的消息适配，并验证Origin/CORS和HTTPS页面的连接策略。[Web网络](https://docs.unity.com/en-us/engine/6000.5/manual/platform-specific/webgl/develop/networking)、[Web .NET限制](https://docs.unity.com/en-us/engine/6000.5/manual/platform-specific/webgl/develop/web-dotnet-api-support)

编辑器里能连接不代表Web构建可用。UnityWebRequest在Web中依赖浏览器请求机制；Web构建也仍受浏览器沙箱/线程限制。此项目不需要为了LLM或本机单人Agent接口引入多人Netcode。[Web限制](https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-technical-overview.html)

## 4. 现有成果能带走多少

| 现有成果 | 迁移处理 |
|---|---|
| 七栋校园、环境、学生和B05-4F GLB | 通过glTFast导入试验；核查分组、材质和尺寸；不需要从照片全部重做 |
| 实景视频帧、参考索引、已确认/暂定信息 | 直接保留，继续作为造型依据 |
| 建筑参数、校园JSON、B01–B07稳定ID | 数据可保留；要写Unity导入/放置工具并明确坐标转换 |
| TypeScript参数化建模代码 | 可继续作为离线资产生成器，导出GLB给Unity；若要在Unity内编辑参数，需要移植为C#工具 |
| 程序生成的玩家动画 | 当前是每帧TS修改分组，并非已烘焙的AnimationClip；导入静态学生GLB不会自动获得跑跳动画，需重写或烘焙 |
| 简化障碍与地面支持逻辑 | 不会随视觉GLB变成Unity Collider；依据参数重建并测试 |
| `CampusGame`、控制、镜头 | 行为约定与用例可复用，实现需要C#重写和Unity适配 |
| HTML/CSS UI | 在Unity UI重做；不能当作Prefab直接导入 |
| Node bridge、外部示例脚本与JSON协议 | 可保留大部分协议/外围结构，但连接适配和验收必须重做 |
| NPC/剧情/谜题设计 | 当前主要是文档；可继续与引擎解耦。正式JSON内容待制作，不把规划当成现有资产 |

特别检查Three.js/glTF与Unity的坐标/朝向转换：选择明确的转换层，用已知出生点、B04入口、+X/+Z测试点与yaw正负验证。不要导入器已转换一次，又在每个模型上手工镜像，导致双重翻转。外部API应明确沿用旧坐标语义或升级版本。

## 5. 对四人团队的影响

| 成员 | Unity下保留的职责 | 交付形态变化 |
|---|---|---|
| Frost | 剧情/NPC内容 | Markdown/JSON保持；无需先学C#才能创作 |
| Thomas | 场地、碰撞、镜头与整合 | Scene、校园Prefab、Collider、C#适配与构建 |
| Harry | 谜题、任务、LLM | C#任务/装置组件；后端仍可用Node；协议保持跨引擎 |
| WHL | NPC与交互UI | NPC Prefab、Animator、交互组件、Unity UI |

需要统一Editor补丁与包锁定；提交Assets、Packages、ProjectSettings及对应.meta；缓存/构建目录不入库。建筑、NPC、谜题用各自Prefab与测试Scene协作，避免四个人同时改一个大Scene。Agent能写C#与编辑器工具，但必须经过Unity编译、Play模式和实际构建验证；不能只凭代码生成声明完成。

## 6. 判断与建议

以下是针对本项目的工程判断，不是厂商保证：

- **当前方案更适合：** 快速发网页试玩、以代码和Agent为主迭代、持续参数化修正建筑、优先完成一个小章节。
- **Unity更值得验证：** 长期做桌面游戏、明显增加NPC行为/动画/交互道具、希望成员可在编辑器中直接布置场景并维护可复用资产。
- **迁移代价：** 当前角色逻辑、UI与场景接线需要重写；Unity编辑器/资源序列化与构建链也有学习成本。没有本机原型测试，不给出“几天完成”或“快几倍”的估计。
- **不确定项：** 团队Unity熟练度、最终发行平台、实际材质导入表现、Web构建网络适配、目标设备性能。

建议下一步做独立分支的小切片，保留现有主版本：

1. 导入CDS-1和入口广场，确认尺度、正反面、像素材质、日夜灯光。
2. 同一个角色实现走/跑/跳、两种镜头、台阶与顶碰；用既有规则作为验收基准。
3. 一个学生NPC + E对话 + 一个离线谜题 + 一次任务结果，验证团队实际编辑工作流。
4. 接通原HTTP Agent脚本，测超时停止、接管、旧epoch拒绝与断线。
5. 构建目标平台并实测；如果目标是浏览器，必须交付真正Web构建，不能只测Editor。

通过后再决定是否把Unity作为正式游戏运行端；现有Three.js工程可保留为参数化资产生成/审阅工具。长期只维护一个正式游戏运行端，避免两套玩法同时演进。若小切片没有显示足够收益，继续现有方案先完成三NPC两谜题首章。
