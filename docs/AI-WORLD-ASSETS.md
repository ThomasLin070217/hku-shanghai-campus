# 用 AI 3D 模型补充校园细节

核验日期：2026-11-14。沿用现有 Three.js 项目。

优先用 **Atlas 做局部空间、TRELLIS.2 做单件道具**。生成资产先单独检查，再进入校园。校区布局、建筑轮廓和门牌继续以真实资料为准。

| 工具 | 适合本项目的用途 | 接入与限制 |
| --- | --- | --- |
| [World Labs Atlas](https://worldlabs.ai/atlas) | 5 号楼四楼休闲区、入口附近的一小段空间 | 官方支持图片估计相机与深度、生成 SPZ，再转 GLB。网页需要账号，开发者 API 另外需要项目密钥。 |
| [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | 盆栽、座椅、垃圾桶等独立物件 | 开源 MIT；有官方 Hugging Face 演示。官方本地路线要求 Linux / NVIDIA 24 GB 显存，不能直接当成此 Mac 上可运行的工具。 |
| [腾讯 Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | 图片生成带 PBR 材质的道具 | 可自部署的备选；许可为腾讯专门许可，不能按 MIT/CC0 处理。本轮尚未运行。 |
| [Meshy](https://docs.meshy.ai/en/api/image-to-3d) | 控制面数的游戏道具、角色静态模型 | 当前文档列出 Meshy 7.1 和 Smart Topology T2.5，支持 GLB。API 创建任务需要付费计划，本轮未购买、未调用。 |

不直接用生成结果替换整座校园：单张图片未拍到的空间会被补全，网格也不自动具备可靠尺寸、闭合碰撞、角色绑定或可交互任务。

## 本轮实际测试

- **TRELLIS.2**：向 Microsoft 官方 Space 提交 `U02-00.71.jpg`，seed 1701、512 分辨率。`image_to_3d` 成功；`extract_glb` 被 ZeroGPU 免费配额拒绝。没有拿到可用 GLB，也没有把生成步骤成功描述成完整资产交付。[原始回执](../references/ai-world-v7/trellis-receipt.json)
- **Atlas 网页**：已实际打开。账号尚需手机号验证时已交给用户；尚未提交生成任务。
- **Atlas SDK**：接入官方 `@worldlabsai/client` 0.7.0，新增分步脚本，已通过离线计划与 TypeScript / Vite 构建。远程执行尚待项目 API Key；网页登录不等于 API 授权。
- 没有将样例资源、手工方块或现有 Kenney 道具冒充本轮 AI 生成成果。

## 第一块样例：5 号楼四楼休闲区

用户已确认楼栋及楼层。选取同一段 U02 视频的 4 帧，时间为 0.08、0.71、1.67、2.62 秒，保留原图和 SHA-256：[输入索引](../references/ai-world-v7/inputs.json)。已查看拼图，能看到木阶、侧楼梯、白桌、靠垫和玻璃护栏。

这段视频主要是转动镜头，平移视差有限，还有夜间模糊。因此先做重建实验，不把生成结果的尺寸和隐藏面当作实测。最终必须与现有 `assets/B05-4F-Stepped-Lounge.glb` 对照；目前仍保持现有资产不变。

## 使用已接好的 Atlas 脚本

```sh
npm install
npm run ai:atlas -- plan
```

`plan` 只核对输入和输出方案，不联网、不生成、不计费。

在 Atlas 开发者后台建立项目密钥，通过本机终端私密配置 `WLT_API_KEY`。不要发进聊天、放入 `VITE_*` 或提交 Git。官方区分网页会话和开发者密钥：[认证说明](https://docs.atlas.worldlabs.ai/authentication)。

```sh
npm run ai:atlas -- pose
# 查看 .atlas-local/pose.json 的相机/深度与参考画面后，再进行下一步。
npm run ai:atlas -- splat
npm run ai:atlas -- mesh
```

每一步会消耗账户积分。没有自动充值；实际价格按后台当时显示的费率判断，不能沿用转载文章的数字。[官方计费说明](https://docs.atlas.worldlabs.ai/billing)

脚本保存操作 ID 和幂等键，重跑会继续等待已有任务。中断本机等待不等于取消远端生成。`.atlas-local/` 被 Git 忽略，不存密钥或签名下载链接。输入发生变化时拒绝复用旧任务。

完成后输出：

- `assets/ai-generated/b05-lounge-study.glb`
- `assets/ai-generated/b05-lounge-study.provenance.json`

输出为最多 40,000 面、2048 贴图的实验网格。可在当前页面切到“模型浏览与导出”，使用“重载 GLB”检查。先核对正面、左右侧、台阶和护栏，再决定替换哪些视觉细节。生成网格不会自动覆盖角色碰撞。

## 下一批优先做什么

1. **休闲区家具**：从白桌、靠垫、盆栽中挑 2–3 件，先用照片做单件生成，确认轮廓后再压低面数、统一像素材质。
2. **CDS-1 入口细节**：门厅周边灯具、导视牌底座、花坛边缘。标牌文字仍用清晰原创贴图，不接受 AI 乱字。
3. **建筑之间的步道**：用相邻、重叠的白天照片重建一小段；验证比例后接回原来的道路和碰撞系统。

官方对视频输入的建议是从连续片段选清楚且重叠的帧，单房间通常先用 8–16 张；不能靠大量重复帧补足缺失角度。[Atlas 视频工作流](https://docs.atlas.worldlabs.ai/using-video-footage)

实现顺序：生成 → 对照实景 → 清理网格与贴图 → 定尺度 → 放入校园 → 验证行走/碰撞。整场景 splat 也可用于视觉参考，但本轮优先选现有 GLTFLoader 能直接读取的 GLB。[官方 splat 转网格接口](https://docs.atlas.worldlabs.ai/api-reference/splats2-mesh)
