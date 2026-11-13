# v4 验收记录 · 2026-11-13

## 已实际执行

- `npm run build`：TypeScript 严格检查及 Vite 生产构建通过。
- `npm run check:v4`：固定 120 Hz 物理在 30/60/144 渲染帧率下行程一致；走跑速度与对角线归一化；落地跳跃、空中重复 jump 忽略；头顶碰撞；门、墙、边界；台阶；空中视角切换；AI 权限与幂等。
- `npx tsx scripts/check-ramp-v4.ts`：通过动作方向驱动物理控制器沿下沉坡道下行及上行，最低 -4.158 m，回到 0 m，路径误差小于 0.025 m。
- `npm run check:geometry`：校园结构检查通过。
- `npm run export:glb`、`npm run validate:glb`：全校、无地面校区、7 栋楼、角色共 10 个 GLB 导出并重载，三角面数与包围盒一致；全部零错误、零警告。像素贴图内嵌。校园 117776 三角面，站立角色 660 三角面。

## 实际浏览器与键鼠

1. **标准 Google Chrome**（临时 Guest 窗口）：点击“进入探索”出现浏览器鼠标锁定提示，游戏进入第一人称。实际 W 按住 1 秒，Z 从 33.5 到 30.9，移动 2.6 m；松键后速度 [0,0,0]。保存于 `chrome-state-start.json` 与 `chrome-walk.json`。
2. Chrome 原生输入追踪捕获到跑跳，最高脚底 Y=1.218 m（含地面标高），见 `chrome-input-trace.json`。随后的原生界面工具超时、连接中断，因此**没有将这轮原生工具的 V 切换或后续鼠标回转判定为通过**。
3. **Ego Lite**：标准 Pointer Lock 调用明确返回 `WrongDocumentError: The root document of this element is not valid for pointer lock.`。没有绕过浏览器权限或伪造锁定成功。失败时界面显示可选“拖动兼容模式”。Chrome 默认路径仍为标准 Pointer Lock。
4. Ego 的兼容模式实际键盘操作：W 前进、Shift+S 奔跑后退、Shift+D 横跑+Space、腾空 V、松键、落地、Esc。切换瞬间前后位置均 `[52.6933,0.6458,33.5217]`、速度均 `[5.2,5.0,0]`，grounded 均 false，视角变 third。见 `human-input-checks.json`。
5. 实际鼠标拖动改变 yaw 至 -25.21°、pitch 至 2.52°，随后 W 按新水平朝向前进。整段视频 `run-jump-demo.mp4` 约 6.6 秒，是浏览器 canvas MediaRecorder 真实帧，未用脚本插值替代运动。
6. 贴墙镜头用现有场景代理体进行射线检测；凹槽外侧检查相机在障碍外，记录 `camera-wall-check.json`。极近墙体时缩短到安全距离并隐藏遮住镜头的人物；不是保证所有转角都能维持完整第三人称构图。

## 实际外部 API

- `npm run agent:demo` 通过 **独立 Node HTTP 客户端 → 127.0.0.1:8787 → WS → 浏览器游戏循环** 完成 observe、acquire、转向、走、跑、跳跃切视角、stop、release。首次完整演示从 X=52 到 X=42.943 m；所有动作 completed。`agent-demo.log`；最终修订示例再次通过，见 `agent-demo-final.log`。
- `scripts/check-live-agent.mjs` 对实际浏览器验证：动作到期后坐标保持不变且水平速度为零；跑跳途中切换只改变 view；重复 commandId 不重复 look/jump/view；空中 stop 后仍正常落地；连续奔跑撞 CDS-1 闭门后记录 blocked 和 `B04/closed-doors`。`live-agent-checks.json` 与日志。
- `--takeover-test` 运行中实际点击“一键接管”，epoch 变化、owner 清空、暂停；迟到的旧 epoch 动作被拒绝 `stale_epoch`，旧 release 也被拒绝。`agent-takeover.log`。
- 该接管录像首次启动编码器时曾发生渲染停顿，短命令正确落入 expired 而非虚报成功。示例脚本现已等待终态，非 completed/blocked 会明确失败。交付的主要视频是随后完整执行的键鼠跑跳录像。
- 另以实际 W 键触发接管，owner 清空、暂停、旧 epoch 拒绝，见 `manual-key-takeover.json`。
- 实际打开另一页隐藏游戏：运行命令 interrupted/page_hidden，授权清空；实际关闭本机服务：游戏暂停且授权清空。见 `page-hide-check.json`、`disconnect-check.json`。随后 `npm run play` 成功同时启动 5174 和 8787。
- 页面内按钮导出 GLB 并通过文件输入重载也已通过，117776 三角面、171 网格，见 `browser-export-check.json`。
- 服务未连接时实际返回 HTTP 503/not_ready。`scripts/check-transport.mjs` 验证本机 Host、拒绝外站 Origin、POST JSON 类型、坏 JSON，以及不存在 teleport 接口。

## 图片与证据

`student-front.png`、`student-side.png`、`student-back.png` 为当前实际角色的独立三维渲染，逐张查看确认黑发连续覆盖头顶、两侧和后脑。`first-person.png`、`third-person.png` 为运行游戏截图。`before.png` 是修改前保存，`after-same-view.png` 使用相同入口机位和视场角，未把新旧不同镜头冒充同视角。

集中图册：`references/voxel/index.html`。服装使用原已归档的官方 Green Gown 005/009 实景，本轮重新查看。建筑布局与结构未凭像素风自行改动，参考等级沿用前轮。

## 范围与尚未验证

- 未对所有校园角落、所有分辨率和低端 GPU 做穷尽性测试；未验证手机触摸、Safari、Firefox。
- 头顶碰撞通过相同导航世界内加入低顶测试碰撞体验证；未宣称在高度不可触及的真实入口雨棚下跳出了撞顶效果。
- 标准 Chrome 的 Pointer Lock、W 和跑跳有实测证据；原生鼠标长时间操作与 V 连续切换因工具超时未完成。V 的不瞬移已通过真实浏览器键盘兼容模式和外部 Agent 两条通路验证。
- 本地服务一次连接一个游戏页面。换浏览器测试 AI 时关闭旧游戏页；不要让多个预览页争抢同一服务。
- HKU 建筑精确尺寸、隐藏立面、屋顶设备与部分场地标高仍待实景测量。角色动画为轻量程序动画，无布料仿真；导出角色 GLB 为站立姿态，动画保存在可编辑代码中。
