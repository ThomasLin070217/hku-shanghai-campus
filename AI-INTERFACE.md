# HKU Campus native Agent API · v1

该接口直接连接正在运行的浏览器游戏。无模型、API Key、浏览器自动化或模拟键盘依赖。

## 启动

Node 22+：`npm install`，然后 `npm run play`。打开 http://127.0.0.1:5174 。

游戏暂停界面点击 **开启 AI 控制** 后，运行 `npm run agent:demo`。演示依次读取状态、取得权限、转向、行走、奔跑、跳跃并切换视角、停止、释放权限。

`node scripts/agent-demo.mjs --takeover-test` 额外等待人工按 W 或点击“一键接管”，再提交旧 epoch 验证拒绝。启用 AI 是页面的用户操作，API 没有绕过它的入口。窗口失焦或页面隐藏会撤销 AI 授权，因此建议先启动演示脚本，再回到游戏点击开启 AI。

服务只监听 **127.0.0.1:8787**。HTTP 客户端无需账户或密钥；此服务面向可信的本机进程，不是公网服务。WS 只接受本机 5174/4174 页面 Origin，HTTP 拒绝外站 Origin、非本机 Host；POST 必须 application/json。只有一个游戏连接，避免多标签控制错误实例。

## HTTP 方法

所有返回 JSON。`ok:false` 时查看 `error`；未连接为 HTTP 503 `not_ready`，协议/权限拒绝为 409，未知路径为 404。

| 方法 | 路径 | 请求 |
|---|---|---|
| GET | `/health` | 服务与游戏就绪状态 |
| GET | `/observe` | 返回 `{ok:true,state:Observation}` |
| POST | `/acquireControl` | `{"agentId":"local-agent"}` |
| POST | `/act` | Action，见下文 |
| POST | `/stop` | `{"controlEpoch":…}` |
| POST | `/releaseControl` | `{"controlEpoch":…}` |
| GET | `/commands/<commandId>` | 查询命令执行结果 |
| POST | `/screenshot` | `{}`，单独返回 PNG dataUrl |

示例：

```js
const base='http://127.0.0.1:8787';
const post=(path,data)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
const observed=await fetch(base+'/observe').then(r=>r.json());
const grant=await post('/acquireControl',{agentId:'my-agent'});
if(!grant.ok) throw new Error(grant.error);
await post('/act',{
  commandId:'my-001',controlEpoch:grant.controlEpoch,durationMs:300,
  move:{forward:1,right:0},lookDelta:{yawDeg:0,pitchDeg:0},sprint:true,jump:true
});
```

完整可运行脚本：`scripts/agent-demo.mjs`。类型：`src/agent/protocol.ts`。动作 JSON Schema：`src/agent/action.schema.json`。

## 坐标、动作与时间

- Y 向上，米制估计场景。朝向 yaw=0 朝 -Z；正 yaw 向左转，正 pitch 向下看。俯仰最终限制约 ±80°。
- forward/right 相对于当前水平视线，范围各为 [-1,1]。组合向量长度超过 1 时归一化。0.5 为半速。
- 行走 2.6 m/s，奔跑 5.2 m/s。重力 22 m/s²，起跳速度 7.2 m/s；实测跳高约 1.15 m。相同控制器用于人类和 AI。
- durationMs 为整数 **1–1000**，从游戏接收动作时的墙钟开始计时。到期清除意图；没有网络续命式永久移动。
- `jump`、`lookDelta` 和 `switchView` **只在首次消费动作时执行一次**。空中 jump 忽略并记录 `airborne_ignored`。
- 新 act 替换旧 act，旧命令记为 interrupted/replaced。重复 commandId 返回原记录，绝不重复跳跃或转向。整个页面会话内 ID 唯一，最多保留 10000 条；达到上限拒绝新命令。
- HTTP 接收只入队，不推进游戏帧。下一次固定步长 1/120 秒更新消费动作；渲染帧与输入来源不改变规则。
- `accepted` 仅确认已入队；`running` 表示已开始执行。到期后 `completed` 或 `blocked`（曾接触障碍）。`expired` 表示尚未被游戏帧消费就已超时；`interrupted` 表示替换、stop、暂停、接管、断线等。`collisionIds` 和 `jumpResult` 提供实际结果。
- stop 清除动作意图，水平运动下一逻辑步停止；空中角色继续受重力落地。release 进一步撤销权限，须用户重新开启 AI。

## observe

包含协议版本 `hku-campus/1.0`、逻辑 frame、累计运行 timeMs、墙钟 wallTimeMs、mode、controlEpoch、aiEnabled、owner、paused、player.position/velocity/yawDeg/pitchDeg/grounded、view、160 m 内地标、lastCommand 与当前碰撞。

地标 ID 稳定为 B01–B07，CDS-1 为 **B04**。relativePosition 是世界坐标的“地标中心减角色位置”，不随镜头旋转；distance 为该向量长度。建筑 ID 与地图对应仍遵循项目参考档案的证据等级，不能视作校方楼栋 GIS。

截图独立按需读取，observe 不传图片。历史命令用 `/commands/<id>` 查询，不必依赖 lastCommand。

## 控制权与故障

只有用户开启 AI 后才能 acquire。成功返回当前 controlEpoch；每次接管/暂停/释放/重新授权都会使旧 epoch 作废。迟到命令先检查 epoch，即使它使用旧 commandId 也会拒绝。

W/A/S/D、左 Shift、Space 是明确人工输入，会立即撤销 AI，未锁定鼠标时暂停等待用户进入；输入框内输入不触发接管。UI“一键接管”也会立即撤销。窗口失焦、隐藏、Pointer Lock 释放清空输入；AI 模式无需 Pointer Lock。

浏览器连接关闭会清空授权，心跳失联约 1.8 秒也会暂停；已排队动作至多持续 1 秒。RPC 超过 2 秒不被浏览器执行，HTTP 等待 2.5 秒超时。not_ready 与 game_timeout 都应停止发送并重新 observe，不能假设动作成功。

外部 Agent 不拥有坐标写入、速度写入、穿墙、解锁 AI 或独立推进帧的能力。开发者调试对象 `window.__CAMPUS` 不属于这个协议，示例脚本不使用它。
