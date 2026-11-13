# HKU Shanghai · Voxel Campus Explorer v4

现有张江校园模型上的方块风室外探索版本。Vite + TypeScript + Three.js；原创方块学生穿 HKU 绿色长袍，第一／第三人称共用跑跳物理与碰撞。

## 启动

需要 Node.js 22 或更高版本：

```sh
npm install
npm run play
```

打开 **http://127.0.0.1:5174**。该命令同时启动游戏与仅监听本机的 AI 服务 8787。

只玩游戏可 `npm run dev`；单独控制服务为 `npm run agent:server`。如端口已占用，先关闭之前的该项目进程。

生产构建：`npm run build`，`npm run preview -- --port 4174`。AI 服务仍需另外运行。

## 操作

点击 **进入探索** 获取鼠标控制。WASD 行走、左 Shift 奔跑、Space 跳跃、V 切换第一／第三人称、鼠标观察、Esc 释放鼠标并暂停。第三人称可滚轮调整镜头距离；暂停界面可调整灵敏度。顶部返回入口按钮复位，V 不会复位任何物理状态。

标准 Chrome 已实测支持 Pointer Lock。Ego Lite 本次返回 `WrongDocumentError`；失败后会出现“拖动兼容模式”，可用 WASD/跑跳/V，按住左键拖动观察。这是兼容入口，默认仍请求 Pointer Lock。

建筑只开放外部观察；门、玻璃和墙体阻挡。可探索广场、步道、大台阶与下沉广场坡道。模型浏览／导出继续保留正交视图、参数修改、GLB 导出／重载和 PNG 保存。

## 本机 AI

暂停菜单点击“开启 AI 控制”，运行 `npm run agent:demo`。演示不需要付费模型或 API Key。可先运行脚本，再回游戏授权。

API 文档见 [AI-INTERFACE.md](AI-INTERFACE.md)，类型与 Schema 位于 `src/agent/`。`node scripts/agent-demo.mjs --takeover-test` 包含人工接管测试。

## 参数与代码

| 内容 | 位置 |
|---|---|
| 按键、走跑速度、重力、起跳、眼高、碰撞体、出生偏移、镜头距离 | `src/exploration/config.ts` |
| 固定步长物理、台阶、头顶碰撞、落地 | `src/exploration/physics.ts` |
| 权限仲裁、意图消费、状态与命令结果 | `src/exploration/game.ts` |
| Pointer Lock、失焦处理、两种镜头 | `src/exploration/controller.ts` |
| 方块短发角色与动作 | `src/exploration/student.ts` |
| 场景碰撞与地面标高 | `src/exploration/navigation.ts` |
| 楼栋位置、尺寸及样式 | `src/model/campusParameters.ts`、`buildSite.ts`、`buildCampus.ts` |
| 原创像素贴图、世界尺度 UV | `src/voxel/materials.ts` |
| HTTP／WS 服务与示例 | `scripts/agent-server.mjs`、`agent-demo.mjs` |

## 资产与证据

`assets/HKU-Shanghai-Campus.glb`、`assets/buildings/`、`assets/Student-Green-Gown.glb` 可重载，包含原创像素贴图。角色 GLB 是站立几何资产，运行时步行／奔跑／跳跃动画在源码中实现。

本轮未更改经参考整理的建筑布局和体量；立面窗格、入口、CDS-1 标识与之前实景依据沿用。改变主要是：完整方块短发与像素五官、开襟短袖绿色袍、方块树冠、方形栏杆、草地／铺装／墙体像素纹理、降低泛白光照。

服装依据 `references/exploration/gown-005.jpg` 与 `gown-009.jpg`（HKU 官方 Green Gown 实景）；建筑依据见 `references/campus-index.html`、`references/exploration/BASIS.md`。角色是原创通用年轻学生，不复刻照片中的具体人物。

16×16 原创材质使用 nearest 放大、mipmap 缩小和各向异性过滤。校园每纹理块 4 m，角色服装 0.32 m；静态建筑／树叶按材质合并，无整屏马赛克效果。历史 v3 截图和报告保留在 `assets/exploration/`，本轮位于 `assets/voxel/`。

## 检查

```sh
npm run build
npm run check:v4
npx tsx scripts/check-ramp-v4.ts
npm run export:glb
npm run validate:glb
```

详细实际操作记录见 `VALIDATION-V4.md`。本轮文件校验清单为 `DELIVERY-V4.json`；旧版报告和截图保留为历史记录。

图册：`references/voxel/index.html`；录像：`assets/voxel/run-jump-demo.mp4`。

## 仍属估计

建筑绝对尺寸、层数、隐藏立面、屋顶设备、步道连接节点与运动场精确边界沿用 v3 的暂定项。方块树冠与纹理是美术简化，不是植物测绘。碰撞为保守圆柱／定向盒近似，不含室内、复杂攀爬或布料模拟。校园范围受可见边界限制。
