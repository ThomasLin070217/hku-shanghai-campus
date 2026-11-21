# 项目内 LLM 端点（DeepSeek / Gemini / LiteLLM）

`scripts/llm.mjs` 是本项目唯一的 LLM 入口：零依赖、只做出站请求，**不把密钥放进源码、聊天记录或构建产物**。它支持三个 provider，其余脚本一律通过它调用：

| provider | 说明 | 需要的变量 |
| --- | --- | --- |
| `deepseek` | DeepSeek 平台 API（OpenAI 兼容），游戏 MacBook 助手的默认 | `DEEPSEEK_API_KEY` |
| `gemini` | 直连 Google Gemini API | `GEMINI_API_KEY` |
| `litellm` | 通过 LiteLLM 代理的 OpenAI 兼容端点 | `LITELLM_BASE_URL` + `LITELLM_API_KEY` |

选择顺序：`LLM_PROVIDER` 显式指定 → 有 DeepSeek 密钥则用 `deepseek` → 有 Gemini 密钥则用 `gemini` → 否则 `litellm`。单次调用可用 `--provider` 覆盖。

## 1. 本地配置

```sh
cp .env.example .env
```

`.env` 已被 `.gitignore` 忽略（`.env.example` 放行）。脚本先读 `.env`，**已存在的环境变量优先**，便于 CI 或临时覆盖。

### 1.1 DeepSeek 平台（游戏助手默认）

1. 在 <https://platform.deepseek.com> 创建 API Key。
2. 写入 `.env`：

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek 平台密钥 | `sk-…` |
| `DEEPSEEK_MODEL` | 模型 id，`--models` 能查到的名字 | `deepseek-flash` |
| `DEEPSEEK_BASE_URL` | 可选，OpenAI 兼容根地址，默认 `https://api.deepseek.com` | 自建网关 |
| `DEEPSEEK_TIMEOUT_MS` | 可选，请求超时（毫秒），默认 `60000` | `60000` |

```sh
npm run llm -- --provider deepseek --models
npm run llm -- --provider deepseek --ping
```

2026-11-21 实测该账号可见 `deepseek-flash` 与 `deepseek-v4-pro`，`deepseek-chat` 仍作为别名解析到 `deepseek-flash`；游戏内对话用 `deepseek-flash`（快），需要更强推理时用 `--model deepseek-v4-pro`。DeepSeek 在中国大陆/香港网络可直连，不需要 `LLM_PROXY`。

### 1.2 Gemini 直连

1. 在 <https://aistudio.google.com/apikey> 创建 API Key。
2. 写入 `.env`：

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google AI Studio 密钥 | `AQ.…` |
| `GEMINI_MODEL` | 模型 id，`--models` 能查到的名字 | `gemini-3.1-flash-lite` |
| `GEMINI_BASE_URL` | 可选，API 根地址，默认 `https://generativelanguage.googleapis.com/v1beta` | 自建网关 |
| `GEMINI_TRANSPORT` | 可选，`native`（默认，`generateContent`）或 `openai`（`/openai/chat/completions`） | `native` |
| `LLM_TIMEOUT_MS` | 可选，请求超时（毫秒），默认 `60000` | `60000` |

```sh
npm run llm -- --provider gemini --models
npm run llm -- --provider gemini --ping
npm run llm -- "用一句话说明学院石牌 S001 的位置"
```

模型名会随 Google 侧更新：若返回 `This model … is no longer available to new users`，用 `--models` 查当前名字并写入 `GEMINI_MODEL`。返回体在客户端内统一成 OpenAI 形状（`choices[0].message.content`），现有调用方无需区分 provider。

模型负载也会波动：2026-11-21 实测 `gemini-3.8-flash` / `gemini-3.7-flash` / `gemini-flash-latest` 返回 `503 UNAVAILABLE`（high demand）或长时间不返回；`gemini-3.5-flash` 时快时慢且偶尔截断；`gemini-3.1-flash-lite` 稳定返回。因此本地默认用后者，需要更强模型时用 `--model gemini-3.8-flash` 单独尝试。

### 1.3 代理出口（可选）

Gemini 的可用性取决于请求出口地区（见 1.4）。若本机有可用的 HTTP(S) 代理，写入：

```sh
LLM_PROXY=http://127.0.0.1:7897
```

- `LLM_PROXY` 优先于 `HTTPS_PROXY` / `https_proxy`；代理地址中的账号密码不会出现在任何输出里。
- 仅 CLI 生效：`scripts/llm.mjs` 会带 `NODE_USE_ENV_PROXY=1` 自动重启一次子进程，因为 Node 内置 fetch 只在启动时读取代理设置。需要 **Node.js 24+**（本项目当前为 24.11）；低版本会直接报错提示。
- 在代码里 `import { chat } from './scripts/llm.mjs'` 时不会自动重启；请让宿主进程以 `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=… node your-script.mjs` 启动。
- 只支持 HTTP(S) 代理，不支持 SOCKS；Clash 的混合端口（如 `7897`）可直接用其 HTTP 部分。

```sh
# 已验证：经本地代理（出口新加坡）可绕过地区限制
npm run llm -- --ping
```

### 1.4 网络位置限制（实测）

Gemini API 对调用来源有地区限制。在中国大陆、香港等不支持的区域网络里，请求会返回：

```json
{ "error": { "code": 400, "message": "User location is not supported for the API use.", "status": "FAILED_PRECONDITION" } }
```

这说明**密钥本身有效**（否则是 401/403），只是当前网络位置不可用。客户端会把这条错误转成带具体说明的提示（指出地区限制，并给出换区域、换网关、切 `GEMINI_TRANSPORT` 三条路径），而不是只丢一行 HTTP 文本。实测（2026-11-21，本机出口香港）：直连全部被拦；经本地代理（出口新加坡）后 `models`、`generateContent`、`--ping` 均正常。

可选的解决方式：

- 在 Gemini 支持的区域网络（或团队服务器）运行调用；
- 在能访问的区域架设网关，并把 `GEMINI_BASE_URL` 指向它；
- 用本机已有的 HTTP 代理，设 `LLM_PROXY`（见 1.3）。

项目不会内置 VPN、代理池或任何绕过地区限制的代码；`LLM_PROXY` 只复用你已在使用的出口。

### 1.5 LiteLLM 代理

LiteLLM 用 OpenAI API 格式代理 100+ 模型供应商。拿到访问信息：

1. 打开邀请邮件里的 **Accept Invitation**，用 `u3660124@connect.hku.hk` 注册并接受邀请。
2. 登录后在 LiteLLM 页面创建 **Virtual Key**（虚拟密钥）。
3. 记下代理地址（proxy base URL）。地址形如 `https://<host>`，也可以是 `https://<host>/v1`。

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `LITELLM_BASE_URL` | 代理根地址，也可填完整 `…/chat/completions` | `https://litellm.example.com` |
| `LITELLM_API_KEY` | 虚拟密钥 | `sk-...` |
| `LITELLM_MODEL` | 默认模型名，须与 `/v1/models` 返回一致 | `gpt-4o-mini` |
| `LITELLM_TIMEOUT_MS` | 可选，请求超时（毫秒） | `60000` |

本机无需认证的 OpenAI 兼容服务（llama.cpp、Ollama 的 `/v1` 等）可把 `LITELLM_BASE_URL` 指向环回地址（`127.0.0.1` / `localhost`），`LITELLM_API_KEY` 留空，再设置 `LITELLM_MODEL`。

```sh
npm run llm -- --provider litellm --models
npm run llm -- --provider litellm --ping
```

### 1.6 浏览器里的 MacBook AI（本机桥）

游戏页面不能持有 API 密钥，所以 `npm run play` 会同时启动：

```sh
node scripts/llm-bridge.mjs   # 或 npm run llm:bridge
```

- 监听 `http://127.0.0.1:8790`，只接受本机 Host 和页面 Origin 白名单（5184 / 5174 / 4174）。
- `POST /api/chat` 接收游戏现有的 `{messages:[...]}`（最多 24 条、64 KB），用 `scripts/llm.mjs` 调模型，返回 OpenAI 形状的 `choices[0].message.content`。
- provider 选择：`HKU_LLM_PROVIDER` 显式指定 → 有 `DEEPSEEK_API_KEY` 用 `deepseek` → `scripts/llm.mjs` 的默认 provider。primary 失败（密钥无效、超时、5xx）时会再试一个已配置的 fallback provider（默认 `LLM_PROVIDER`），响应里带 `fallback: true`。
- `GET /health` 返回 primary/fallback provider、实际模型名、是否已配置；前端用它在首条消息前显示正确的模型名，并在桥没起来时直接走内置角色。
- 游戏端默认 `http://127.0.0.1:8790/api/chat`、模型标签 `deepseek-flash`；桥不可达时前端冷却 15 秒，不把每条问题都拖满 40 秒超时。
- 角色设定集中在 `src/opening/persona.ts`（名字「岚 LAN」、来历、语气、事实边界、能力边界）；在线与离线回复都读同一份设定。
- 密钥只在桥进程内读取 `.env`，日志不打印提示词、密钥或完整响应；桥没启动或没有密钥时，游戏回退到内置校园规则。
- 桥是可选进程：`scripts/start.mjs` 里标记为非 fatal，桥退出不会停掉 Vite 或 agent server。
- 需要代理时仍用 `LLM_PROXY`；桥会像 CLI 一样用 `NODE_USE_ENV_PROXY=1` 重启一次（Node 24+）。DeepSeek 直连时通常不需要代理。
- 草坪 L001 的 Vibe Console 与岚共用同一套连接配置（`src/opening/modelTransport.ts`）。技能编译会额外发送 `response_format`（JSON Schema）和 `temperature: 0`；桥把两者转给 provider，provider 以 400/415/422 拒绝 `response_format` 时改用普通文本重试一次，再由游戏规则校验 JSON。页面关闭或取消请求时，桥会中止上游调用。
- 已发布的静态试玩（`build:playtest`）默认离线，Vibe Console 可手选三个离线预设。团队若部署了自己的同源模型代理，可在构建时设置 `VITE_CAMPUS_MODEL_ENDPOINT` 与 `VITE_CAMPUS_MODEL_NAME`；这两个前端字段只适合公开的路径和模型名。
- 旧的 Vite 开发服务器同源路由 `/api/campus-model` 已由本机桥取代；只跑 `npm run dev` 时请另开 `npm run llm:bridge`。

## 2. 命令行

```sh
npm run llm -- "把这段检查输出总结成三条" --system "你是校园工程的验收助手"
npm run llm -- "..." --model deepseek-v4-pro --provider deepseek --json
npm run llm -- "..." --model gpt-4o-mini --provider litellm --json
npm run llm -- --models                      # 默认 provider 的模型列表
npm run llm -- --ping                        # 列表 + 一次最小对话
npm run llm --                                # 打印用法与配置状态（不含密钥）
```

成功时输出正常结果（`--ping` 为 `{ "ok": true, … }`）；失败时输出 `{ "ok": false, "error": "…" }` 且退出码非 0。错误信息只含状态码和响应片段，不回显密钥。

## 3. 在脚本里调用

```js
import { chat, models, configured, activeProvider } from './scripts/llm.mjs';

if (!configured()) throw new Error('LLM 未配置');

const response = await chat([
  { role: 'system', content: '你是校园巡检助手' },
  { role: 'user', content: 'S001 在哪？' }
], { provider: 'gemini', model: 'gemini-3.8-flash', maxTokens: 256 });

console.log(response.choices[0].message.content);
```

`chat(messages, { model, temperature, maxTokens, provider, responseFormat, signal })` 接受 OpenAI 消息数组，三个 provider 都返回 OpenAI 形状；`models()` 列出模型；`configured()` 判断密钥是否就绪；`activeProvider()` 返回默认 provider。游戏里那位助手（岚）的系统提示词与离线话术由 `src/opening/persona.ts` 提供，不要在调用处另写一份人设。

## 4. 离线检查

```sh
npm run check:llm
npm run check:opening-assistant
```

`scripts/check-llm-client.mjs` 用 stub `fetch` 校验：DeepSeek/Gemini 原生/OpenAI 兼容各路径的 URL、鉴权头、消息映射与响应归一化；LiteLLM 路径未回归；provider 选择顺序；地区限制、模型下线、缺密钥的错误提示；以及错误信息不泄漏密钥。`scripts/check-opening-assistant.ts` 校验助手默认指向本机桥、系统提示词确实带上「岚」的人设与实时状态、桥不可达时回退到同人设的内置回答并进入冷却。两者都不联网、不需要真实密钥，已纳入 `npm run check:all`。

## 5. 边界

- 客户端只做出站调用，不监听端口，不扩展现有 `scripts/agent-server.mjs` 的 `/act` 权限模型，也不新增文件写入或任意代码执行入口。
- 密钥不落盘（除本地 `.env`）、不提交、不回显；错误只截取响应体片段，HTTP 错误带状态码。
- 场景几何修改仍走「源码参数 + 重新生成 + 视觉/碰撞核对」流程，LLM 不直接改模型。
- Gemini 的地区限制由 Google 侧判定，本项目只如实上报，不做绕过。
- DeepSeek 同样只做出站调用；密钥只在本机 `.env` 与桥进程内，浏览器、构建产物、日志和错误信息里都不出现。
- 与本项目无关的 `WLT_API_KEY`（World Labs，`npm run ai:atlas`）保持不变。
