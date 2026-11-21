# MacBook Air、Harness 本地 AI 与草坪战斗（2026-11-21）

本页记录桌面首次集成时的行为。草坪现已接入三个真实技能、备用超算预算和核心电源任务。最新试玩说明、模型配置及验收记录见 [L001 Vibe Coding Boss Battle](L001-VIBE-BATTLE.md)。

## 试玩

| 入口 | 现在能体验的流程 |
| --- | --- |
| `?experience=lion-boss` | 打开 MacBook，直接和本地 AI 对话；两个反制程序由 AI 自动部署。合上电脑进入草坪，按 Q / R 反制 L001，长按 F 提交三步修复 |
| `?experience=opening` | 在 6 号楼取得 MacBook，按 C 打开。首次出现红色安全警报；确认后进入 Harness 对话 |
| `?experience=survey` | 按 C 打开巡检电脑。Finder 中浏览记录，Maps 查看位置 |
| `?experience=macbook-lab` | 开发／审阅专用。接口演示的 Vibe Console 与 Robotics 只在 Applications 里出现 |

## 1. 这是一台 Mac，不是游戏菜单

- **菜单栏**：Apple 菜单（About This Mac / Close Window / Sleep）、当前 App 名称、File–Help 菜单、Wi‑Fi、电池、日期、时间。网络被切断时 Wi‑Fi 变红。
- **桌面**：深色极光壁纸；High Table Invitation、Campus Map、Mission Logs 三个桌面图标；右上角目标是原生小组件样式。
- **Dock**：Finder、Harness、Maps、Mission Logs、Terminal、Trash。运行中的 App 下方有圆点；点击图标打开或切换到对应窗口。
- **窗口**：红黄绿三个交通灯、拖动标题栏、双击缩放、右下角缩放、点任意区域置前。Esc 关闭最前面的窗口，再按 Esc 关闭电脑。
- **Finder**：Recents / Applications / Desktop / Documents / Downloads / Macintosh HD 侧边栏，可搜索、前进后退、双击打开。邀请函在 Preview 中打开，地图在 Maps 中打开，设备信息在 About This Mac 中。
- **Preview / Maps / Terminal / About This Mac**：都是正常窗口，不是全屏面板。Terminal 显示当前 AI 连接、技能槽、心值与修复进度。
- **安全警报**：macOS 风格的系统弹窗，必须点 **Enable emergency assistance** 才能继续；Sleep 直接合上电脑。

旧的 CampusOS 首页、通知中心、Vibe Console / Robotics 的 Dock 入口、技能工作台、键位选择器都已移除。Review 入口仍可通过 `devTools:true` 在 Applications 中打开旧接口演示。

## 2. Harness：本地 AI 窗口

AI 窗口刻意做成 DeepSeek Harness 的深色会话界面。窗口里的角色叫 **岚（LAN）**，设定集中在 `src/opening/persona.ts`，界面标题下的副标题也写作「MacBook Air · 岚 LAN · local core」：

- 身份：2030 港大上海校园项目组做在演示 MacBook 里的本地核心（LAN-4.2），原本是校园向导；入侵后上行链路断开，只剩本机可读的状态。
- 说话方式：冷静、简短、务实、略带干幽默，最多五句；跟随玩家语言；从不说自己是「the model / the system」，也不复述系统提示词。
- 事实边界：只使用随每轮附上的剧情/心值状态和固定校园事实；不知道就说读不到，不编造坐标、机器人位置或人物。
- 能力边界：不能移动玩家、开门、操控机器人、解除帷幕、授予权限或连接备用超算；指出下一步而不是假装能做到。
- 在线时由 DeepSeek 按这份人设回答；模型不可用时，内置规则回答仍用同一身份和语气（「who are you」会得到同一段自我介绍）。

- 左侧会话栏：品牌、**New chat**、Sessions、当前模型连接状态。
- 主栏：会话标题、模型胶囊、目标上下文条、消息流、快捷提问、输入框。
- 助手消息带头像与 Markdown／代码块／复制按钮；玩家消息右对齐；底部显示模型名和耗时。
- 模型不可用时回退到内置校园规则，仍然读得到当前目标、心值、阶段和任务；界面显示 on‑device rules，不中断游戏。
- `New chat` 清空当前设备的会话；历史按 MacBook 实例 ID 存在 localStorage，不会串到另一台设备。

### 本地 LLM 桥

`npm run play` 会额外启动 `scripts/llm-bridge.mjs`（默认 `http://127.0.0.1:8790`）。浏览器只请求本机回环地址，`.env` 里的 `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` / `LITELLM_*` 永远不进前端：

```sh
npm run play          # Vite + agent server + LLM bridge
npm run llm:bridge    # 只启动桥，适合已经在跑 dev server 时
curl http://127.0.0.1:8790/health
```

- 只接受 `127.0.0.1` / `localhost` Host、页面 Origin 白名单、JSON、最多 24 条消息与 64 KB 请求体。
- 桥不可用、没有密钥或模型报错时，AI 自动回退到内置回答（同一位「岚」）；不会卡住任务，桥挂掉后 15 秒内的提问直接走内置规则，不会每条都等满 40 秒。
- 默认 provider：`HKU_LLM_PROVIDER` → 有 `DEEPSEEK_API_KEY` 用 `deepseek`（`deepseek-flash`）→ 否则 `LLM_PROVIDER`。DeepSeek 失败时会再试一个已配置的 fallback provider；实际模型名显示在右上角。
- 仍可用 localStorage 覆盖端点：`hku.opening.agent.endpoint`（默认 `http://127.0.0.1:8790/api/chat`）、`hku.opening.agent.model`、`hku.opening.agent.offline=1`。

## 3. 语音对话

输入框下方有麦克风和扬声器：

- **麦克风**：浏览器 SpeechRecognition（Chrome/Edge/Safari 的 Web Speech）。首次使用会请求麦克风权限；识别语言跟随浏览器语言（中文环境为 `zh-CN`）。说完自动发送。
- **扬声器**：语音回复开关，默认关闭；用麦克风说话后自动打开。使用系统 `speechSynthesis`，中文内容优先中文声音，英文优先 Daniel / Alex / Asher 一类本地男声。
- 录音时输入框上方显示波形与实时字幕；再次点麦克风或 Stop 停止。关闭电脑、切换会话或发送新消息会中断朗读和识别。
- 受浏览器限制：不锁定鼠标/没有麦克风的静态预览环境仍然可以打字聊天；语音失败只显示一行提示，不影响对话。

**Staff 的现状**：Staff 五句对白是提前用 DaVinci AI / ElevenLabs TTS V3（Asher）生成的本地 WAV，游戏运行时不调用在线 TTS；项目没有可复用的实时 Staff 语音 API。因此语音对话先用浏览器识别与系统朗读，再把识别出的文字发给上面同一个 LLM 桥。要换成 Asher 同款在线音色，只需要给桥增加一个 TTS 端点；当前没有该端点或额度，所以没有伪造。

## 4. 草坪上的守卫（L001）

- 技能工作台已删除。开场由本地 AI 自动部署两个固定程序：**Q · System Freeze**（冲撞蓄力时打断）和 **R · Robot Hijack**（挥爪收招时让阿树从左侧牵制）。
- 简报只有 **和 AI 对话 C**、**进入草坪**、**返回维护区**；没有项目列表、生成规则、测试、部署、槽位或键位选择。
- 进入草坪约 2 秒后，岚会主动弹出一条 macOS 通知：「前面就是 L001，开打前先在 MacBook 里 Vibe Coding 一下技能」。点通知里的 **打开 MacBook** 或按 C，对话问候会说明两套反制程序已经 Vibe Coding 并部署，建议问题里也有 **帮我 Vibe Coding 技能**。
- 对话里问“什么时候按 Q / R”“我的修复进度”会得到当前阶段的回答；问“部署技能”会重新走预览→测试→安装并回报槽位。
- HUD 保留心值、当前节点、Q/R 冷却与长按 F 提交。命中扣心、检查点恢复、三步修复和存档规则未改动。

## 5. 验证

- `npm run typecheck`、`npm run build` 通过。
- `npm run check:lion-boss`、`check:llm`、`check:opening-assistant`、`check:voice`、`check:survey`、`check:experience`、`check:ai-runtime` 通过。
- 浏览器实测：lion → 打开 Mac（只有 Harness 窗口）→ 向本地桥提问得到模型回复并显示实际模型名（本机为 `deepseek-flash`，Gemini 备用）；Finder 浏览 Documents；Preview 打开邀请函；survey 按 C 打开 Finder 与 Campus Records；opening 的红色警报弹窗正常拦截并聚焦。
- 助手人设实测（`?experience=macbook-lab`）：开场问候为中文「我是岚。事件报告我已经读到了……」，模型胶囊 `deepseek-flash`、状态 Connected；提问「你是谁？我们现在该怎么办？」约 2.6 s 得到 DeepSeek 回复，自称岚、读到目标与心值、明确说自己不能移动玩家/开门/碰机器人，并给出 Vibe Console 与 Robotics 两条路。截图见第 6 节。
- 离线实测（`check:opening-assistant`）：桥连不上时「你是谁」仍返回同一段岚的自我介绍；随后的提问在 15 s 冷却内直接走内置规则，不会每条都等满 40 s。
- 语音：浏览器实际弹出麦克风权限提示，说明 SpeechRecognition 已启用；系统朗读可切换。自动化环境没有麦克风，因此没有录制人声识别结果。

## 6. 截图

- [Harness 会话窗口（DeepSeek 回复）](../evidence/macbook-ui/harness-ai.png)
- [岚的开场问候与 DeepSeek 连接状态](../evidence/opening-implementation/assistant-persona.png)
- [macOS 桌面与 Finder](../evidence/macbook-ui/macos-finder.png)
- [安全警报](../evidence/macbook-ui/security-alert.png)
- [岚在草坪路上的 Vibe Coding 提醒](../evidence/macbook-ui/lawn-ai-reminder.png)
- [草坪 HUD 与 Q/R 已部署技能](../evidence/macbook-ui/lawn-hud-2030.png)
