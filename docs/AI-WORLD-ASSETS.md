# AI 实景重建：5 号楼四楼休闲区

完成日期：2026-11-14。沿用现有 Vite / TypeScript / Three.js 工程。

本轮已实际用 World Labs Atlas 处理四张获授权的视频截图，生成并下载三维 SPZ；项目新增独立对照页，可以旋转、缩放、对照原始照片和参数模型，保存 PNG，下载资产。它是局部细节参考，尚未替换游戏里的可行走校园或碰撞。

## 打开结果

```sh
npm ci
npm run play
```

- 校园：<http://127.0.0.1:5174/>
- **Atlas 三维小样**：<http://127.0.0.1:5174/ai-study.html>
- 可见面网格：<http://127.0.0.1:5174/ai-study.html?format=mesh>

校园顶部新增「AI 重建对照」入口。小样支持左键旋转、右键平移、滚轮缩放、重置视角、参考帧切换、参数模型切换和 PNG 保存。并排比较只用于深度网格；完整 splat 包含估计的周围空间，其包围盒不适合拿来比较实测尺寸。

## 实际交付的资产

| 文件 | 内容与限制 |
| --- | --- |
| `assets/ai-generated/b05-atlas.spz` | Atlas 四帧任务的真实输出，2,000,000 个高斯点，31,824,281 字节。视觉细节较完整，用 Spark 在 Three.js 中显示；不是闭合三角网格。 |
| `assets/ai-generated/b05-atlas-depth-study.glb` | 本地使用 Atlas 导出的相机、深度和原图重建的局部可见面网格，46,199 三角形、4 个命名网格、1,734,220 字节。不是官方 Splat-to-mesh 转换结果；遮挡和未拍到的面仍有缺口。 |
| `references/ai-world-v7/atlas-context/` | 已归档的相机估计、深度、置信度和图像；本地网格导出只使用四张实拍帧。 |
| `assets/ai-generated/previews/atlas-splat.png` | 本地预览页面截图。 |
| `assets/ai-generated/previews/atlas-orbit-short.mp4` | 实际浏览器旋转操作录屏，截取原录屏开头及结尾；没有生成视频或改变播放速度。完整记录为 `atlas-orbit.webm`。 |
| `assets/ai-generated/previews/depth-study.png` / `parameter-model.png` | 局部网格与原有参数模型的预览，二者不是等精度测绘比较。 |

照片里可辨认的木阶层次、白桌、彩色及条纹坐垫、两侧护栏和盆栽，在 SPZ 的实拍近似视角中都能查看。侧后方缺乏照片，生成结果可能有补全、模糊或漂浮区域。深度网格保留真实照片纹理，离开拍摄角度后可见缺口与接缝。这些缺陷没有通过虚构几何来掩盖。

## 来源与身份

用户确认视频 U02 拍摄于 **Building 5 / 4F**，并明确允许向 Atlas 上传 0.08、0.71、1.67、2.62 秒这四张截图。输入索引和哈希在 [inputs.json](../references/ai-world-v7/inputs.json)。它们是同一段视频的相邻画面，不能计作四份独立建筑证据。

[Atlas 原始会话](https://atlas.worldlabs.ai/workflows/viewfinder/wsess_50438e5a36834caea55ad4f6fd2399b1)中，交付使用 **Splats 1 / 4 frames**。用户接管期间出现额外生成视图与另一个五帧任务；第五张图是 AI 生成视图，不能当作实拍证据，也没有用于本地深度网格。任务与资产记录见 [atlas-receipt.json](../references/ai-world-v7/atlas-receipt.json)。

## 可编辑与复现

- `src/ai-study.ts`：独立场景、相机、原图对照、SPZ / GLB 加载及下载。
- `src/ai-study.css`：界面样式。
- `assets/ai-generated/manifest.json`：资产路径、初始参考相机、显示朝向和估计展示尺度。
- `scripts/export-atlas-depth.ts`：可见面 GLB 的完整生成代码。
- `src/model/buildLounge.ts`：原有参数化休闲区，仍可编辑并用于比较。

```sh
npm run ai:depth  # 从已归档 RGBD 数据重新生成局部 GLB；不联网、不计费
npm run build
npm run preview -- --port 4174
```

开发服务可访问 ai-study.html；`npm run build:review` 包含 AI 对照入口与必要参考和资产。日常 `npm run build` 保持轻量，不打包历史重建资料。Spark 为 MIT 开源渲染器，仅在 SPZ 页面动态加载。首个小样加载约 32 MB，暂未做移动端性能优化。

深度导出按 Atlas 的 RUB 相机约定、平面 Z 深度和 EXR 行翻转规则反投影，每 8 像素采样，剔除无效深度与剧烈断层，重叠区域优先保留较早实拍帧；不生成背面。材质使用原图和 unlit，以保留拍摄光照。置信度图一并存档，但当前导出尚未用它过滤。相机和尺度是 AI 估计，不能标成米制测量。依据：[官方相机与深度说明](https://docs.atlas.worldlabs.ai/cameras-and-posed-images)。

## 验证结果

- TypeScript / Vite 构建通过；原有 `check:v4`、`check:gameplay`、`check:video` 通过。
- 实际浏览器加载 SPZ，确认 2,000,000 个 splats；完成鼠标旋转、重置和截图，保存实际录屏。
- 深度 GLB 经 GLTFLoader 重载；Khronos glTF Validator **0 错误、0 警告**。4 条提示仅为 960×720 的非 2 次幂图像尺寸，详见 `depth-validation.json`。
- 原有校园物理与 Agent 控制未被替换；此轮没有宣称完成室内碰撞或室内任务。

## 尚未完成的官方网格转换

将下载后的 SPZ 回传同一 Atlas 服务进行 Splat-to-mesh 时，自动审批要求对衍生文件再次上传单独授权，操作未执行。之后读取到 **0 Studio credits**，本轮没有充值、购买或再提交生成。现有局部 GLB 来自已下载 RGBD 的本地处理，并非绕过上传审批。

还不能把小样当作可直接进入游戏的最终室内资产。下一步需要补齐有平移视差的白天照片、校正尺度、清理网格、统一像素风材质，并另外制作简化碰撞体。优先补拍：入口往座席的全景、左右侧各一个斜角、沿座席侧边平移的一段视频。

## 已尝试的其他路线

| 工具 | 实际状态 |
| --- | --- |
| [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | 公共演示 image_to_3d 成功，但 GLB 提取被免费 GPU 配额拦住；没有交付其模型。原始回执见 `trellis-receipt.json`。 |
| [Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | 单件道具备选，本轮未运行；需遵守腾讯专门许可。 |
| [Meshy](https://docs.meshy.ai/en/api/image-to-3d) | 单件道具备选，本轮未购买或调用。 |

保留 `scripts/atlas-campus.ts` 官方 SDK 分步工作流。`npm run ai:atlas -- plan` 只校验本地输入；`pose`、`splat`、`mesh` 需要私密配置服务端 `WLT_API_KEY`，会消耗对应账户积分，本轮未调用这些付费 API。网页登录不等于开发者 API 授权。不要把密钥放在 `VITE_*`、聊天或 Git 中。参考：[认证](https://docs.atlas.worldlabs.ai/authentication)、[计费](https://docs.atlas.worldlabs.ai/billing)。
