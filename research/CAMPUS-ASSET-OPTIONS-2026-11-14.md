# 校园项目可借用的 3D、材质、声音与游戏基础

核查日期：2026-11-14。范围：官网、作者发布页、官方仓库及当前项目依赖/素材清单。本文是选型，不代表已试生成、试听或集成；未修改 Workbuddy 正在处理的 UI。

## 用普通话解释

- **3D 模型**：桌椅、树、狮子等有体积的物件。优先接收 GLB/glTF，这是我们现有工程能加载的格式。
- **材质/贴图**：铺装、墙、木头等表面怎么呈现；贴图通常是图片，材质还控制透明度、粗糙程度等。资源包不会自动修正楼体尺寸。
- **音效**：脚步、开门、按钮；**环境音**：树叶、风、远处交通；**背景音乐**：为气氛服务的曲子，三者应独立混音。
- **引擎/基座**：让场景、角色、碰撞和游戏规则运行的基础。换它比换一套素材工作量大得多。

## 优先推荐的素材

|来源|核实信息|校园用法与接入判断|
|---|---|---|
|[Quaternius Cube World Kit](https://quaternius.com/packs/cubeworldkit.html)|该包页面列 108 模型、glTF/FBX/OBJ/Blend、CC0|优先检查可用方块植物、动物及道具；与现有像素风相近，导入后仍要统一比例、调色、碰撞。108 并不等于 108 个都适合校园。|
|[Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit)|3D 家具包，页面列 140 文件，CC0|桌椅、柜子等室内通用资产；替换粗糙家具较划算。具体构型仍依实拍摆放。|
|[Kenney Nature Kit](https://kenney.nl/assets/nature-kit)|3D 树木/岩石/植被，330 文件，CC0|作为植物变体来源；需要改成校园树形，不能随机撒满地图，也不能保证天然都是立方体风格。|
|[Building Textures 16×16](https://opengameart.org/content/building-textures-16x16-tiles)|作者 Bennyboi_hack 发布的 3 张小型建筑贴图，CC0|小样测试用，不是完整 Minecraft 材质包。统一像素密度和调色后再铺到结构上。|
|[Poly Haven](https://polyhaven.com/license)|站内资产 CC0|可取材质与环境光参考；主要偏写实，需要美术处理，不建议把高清写实地面直接混进像素校园。|
|[Blockbench](https://blockbench.net/)|免费开源低模编辑器，支持方块建模、贴图绘制和动画|最适合把通用物件或 AI 粗模整理成统一方块风；它是制作工具，不是运行游戏的引擎。软件 GPL 与作品素材授权应分别记录。|

已排除一个常见误会：[Kenney Voxel Pack](https://kenney.nl/assets/voxel-pack) 页面明确分类为 **2D**、128×128 图片；不能将名称里的 Voxel 当成可直接加载的 3D 模型证明。

## 生成 3D 的 AI

|工具|已核实能力|授权/运行条件|建议|
|---|---|---|---|
|[Meshy](https://docs.meshy.ai/en)|文字/图片生成，贴图、重网格等流程；支持 GLB 导出和 API|[价格与授权页](https://www.meshy.ai/pricing)列免费方案 CC BY 4.0；模型版本/下载资格另有门槛，不能把免费生成等同于所有模型免费导出|先做一件有多角度照片的雕塑或独特花盆，检查轮廓、面数、贴图与背面，再考虑付费。|
|[Tripo](https://www.tripo3d.ai/)|文字/图片生成、模型整理、绑定动画；支持 GLB 等格式|[条款](https://www.tripo3d.ai/terms)本次显示更新于 2026-11-13；生成时记录当日方案和导出权限。本文不把商业服务称为开源|作为同一件物品的对比生成路线。官方“game-ready”描述不等于接入本项目后免检。|
|[Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2)|开源图生 3D，带材质的网格输出，仓库标 MIT|官方仅在 Linux 测试，要求 NVIDIA GPU 至少 24 GB 显存；代码、权重及依赖分别按其许可处理|开源候选，可考虑服务器；不是当前 Mac 上一键装好即可运行的方案。免费演示配额不能作为生产保障。|

我们的判断：AI 优先生成**单件道具**，不直接替代整个校园测绘。尺寸、门窗、标识、背面结构仍需实景核对。此前已尝试 World Labs 场景路线，本轮优先补充单件资产工具，不重复承诺生成场景就自带可走的碰撞、任务或 NPC。

建议小样：校园特色雕塑 1 件、侧通道花槽 1 件、茶水区设备 1 件。三视图比对通过后才入正式场景；无参考的隐藏面注明推断。普通桌椅已有合适素材时无需消耗生成额度。

## 声音

|来源|已核实授权|适合的内容与限制|
|---|---|---|
|[Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)|130 文件，CC0|接触、落脚等基础声音来源。项目已存在 Kenney 混凝土/草地脚步采样，应先复核触发与混音，不必为了换库再换一次。|
|[Freesound](https://freesound.org/help/faq/#licenses)|每条录音分别授权；存在 CC0、CC BY、CC BY-NC 等|筛选安静城市、风吹树叶、少量鸟鸣、门厅室内底噪；优先 CC0，保留原条目与作者。不是全站都能随意商用。|
|[Sonniss GameAudioGDC](https://sonniss.com/gameaudiogdc/)|[当前 bundle 许可](https://sonniss.com/gdc-bundle-license/)允许按条款用于游戏等成品、商用且无需署名；不是 CC0|备选环境/机械/拟音库。不能把原音效当素材包公开再分发；游戏项目与模板/素材库发布要分清。本轮未下载大包。|
|[OpenGameArt 音乐](https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12)|逐曲核对|探索型轻钢琴/环境音乐作为独立可关闭声道。搜索发现 Yoiyami 的 “First Light Particles” 页面索引标 CC0，但直开返回 403，尚未试听/下载核验，因此仅列候选，未选入正式项目。|

音乐候选索引：[First Light Particles](https://opengameart.org/content/first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track)。不能把“标签写 calm”当作已经试听适合；实际还要检查循环接缝、峰值、是否抢占脚步和交互提示。

校园混音建议：持续低音量风/树叶底音；少量间隔鸟鸣；道路附近才逐渐出现远处交通；门厅与电梯音源按区域或位置触发；背景音乐可关，不把现实校园一直配成冒险战斗场景。以上是制作建议，不是本轮已执行的音频改动。

## 游戏基座与引擎

|选择|官方事实|对当前项目的判断|
|---|---|---|
|保留 Three.js，按需引入 [Rapier](https://rapier.rs/docs/user_guides/javascript/character_controller/)|JS 角色控制器提供障碍处理、滑移、爬台阶与移动平台支持；官方也明确需按游戏调参|最值得单独试验的基础组件。可保留网页、UI、模型和 AI 接口；替换碰撞逻辑前需要复跑弧梯、玻璃门、跳跃/顶棚、暂停及 AI 同控制器测试。不能承诺接库即修复全部 bug。|
|[Godot](https://godotengine.org/features/)|完整场景编辑器与游戏引擎；[MIT](https://godotengine.org/license/)|若以后侧重室内、动画剧情、NPC 与大型关卡，值得评估；当前 TS 控制器、DOM UI、存档及 AI 桥接不能直接照搬。属于迁移项目，不是素材安装。|
|[Luanti（原 Minetest）](https://www.luanti.org/en/)|开源方块游戏平台，Lua 模组、纹理包与多人能力；[官方介绍和许可](https://docs.luanti.org/about/luanti/)|更接近“借一个类 Minecraft 基座”。适合方块建造/破坏/多人世界成为核心后的另一条路线。目前会牵涉重新实现既有校园系统；生态素材也须分别查授权。|
|[noa](https://github.com/fenomas/noa)|实验性网页体素引擎，MIT，使用 Babylon.js 渲染|适合研究真实体素玩法；不是当前 Three.js 项目可直接插入的小组件。现阶段不选作主基座。|

当前建议：**保留 Three.js，先用成熟素材丰满场景；物理问题用 Rapier 小场景对照试验决定是否替换。** 校园是可自由探索的固定建筑场景，不需要为了“看起来像 Minecraft”就引入完整挖矿、分块地形和合成体系。

## 已有资源与下一步

现有工程已用 Three.js、XState，拥有 Kenney Blocky Characters 派生角色、部分 Factory/Survival 道具、Kenney 脚步与独立环境音。依据 `package.json`、`docs/ASSET-LICENSES-V8.md` 和 `assets/`，以上不是本轮新增。

建议按小批验证推进：先选 5 件校园通用道具、6 种表面材质、3 类环境音；再做 1 件特色物体的 AI 生成比较。先放在独立资产预览页，确认风格与尺度后入校园，避免与 Workbuddy 的 UI 修改冲突。

不要直接提取 Minecraft 官方材质、音乐或音效；第三方 Minecraft 资源包也必须逐包核对作者授权。优先使用上面已明确许可的独立素材，记录来源而非仅写“网上下载”。
