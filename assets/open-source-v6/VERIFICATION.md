# v6 验证记录

- 构建：TypeScript 与 Vite 生产构建通过，Three/XState/业务独立 chunk，无 chunk 大小告警。
- `check:gameplay`：4 组任务守卫、重复操作、恢复、坏存档与场景可达性测试通过。
- `check:v4`：7 组物理与 AI 生命周期回归通过（30/60/144 渲染帧率、跑跳、头顶碰撞、门、台阶、边界、空中切镜、超时/接管）。
- `check:video`：原有五段视频参考步道、跑道与北侧台阶路线通过。
- `check:geometry`：7 栋建筑、下沉广场空洞和参数重建检查通过。
- `check:transport`：4 项传输检查通过：未连接返回 not_ready，后台连接不抢占，用户指定窗口替换旧连接，旧连接关闭不破坏新连接。
- 浏览器真实操作：WASD、Shift、Space、V、E，收齐三种物资并到终端提交；中途刷新保持 2/3 进度。完整 Canvas 录屏 `quest-playthrough.mp4`（约 70 秒，包含中间等待；HUD 见截图）。原始 WebM 全帧解码 1941 帧无错误后转为 H.264。
- 浏览器资源清理：75 个学生/手臂几何、材质和贴图资源各释放一次；重复 dispose 不再释放；已销毁控制器不再响应 blur、不再推进模拟。
- 真 HTTP → WS → 浏览器：原生脚本 `check-live-agent.mjs` 通过超时停止、奔跑中起跳、空中 V 事件、重复命令不重复触发、stop 后继续落地、CDS-1 入口门阻挡。详见 `../voxel/live-agent-checks.json`。
- 人工接管：HTTP 发出动作后，真实 W 按键撤销 AI、暂停并作废旧 epoch；迟到 act 返回 stale_epoch。见 `live-takeover.json`。
- 页面导出并重载：7 栋建筑、126456 三角面、190 网格；练习物品未混入校园 GLB。导出的校园和四个 Kenney 道具经 glTF Validator 检查均为 0 错误、0 警告（道具验证包含外部色板）。
- 实际限制：Ego Lite 的 Pointer Lock 返回错误；本轮实际键盘走跑跳测试用页面兼容模式。没有宣称本轮重新验收标准 Chrome Pointer Lock。NPC/正式剧情/LLM/Agent 拾取 RPC 尚未实现。

`before.png` 与 `after.png` 为同一校园总览，校园结构未作修改；道具与任务显示见 `supplies-in-campus.png`、`quest-ready.png`、`quest-completed.png`。
