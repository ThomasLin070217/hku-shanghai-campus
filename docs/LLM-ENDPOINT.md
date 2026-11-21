# 项目内 LLM 端点（Gemini / LiteLLM）

`scripts/llm.mjs` 是本项目唯一的 LLM 入口：零依赖、只做出站请求，**不把密钥放进源码、聊天记录或构建产物**。它支持两个 provider，其余脚本一律通过它调用：

| provider | 说明 | 需要的变量 |
| --- | --- | --- |
| `gemini` | 直连 Google Gemini API | `GEMINI_API_KEY` |
| `litellm` | 通过 LiteLLM 代理的 OpenAI 兼容端点 | `LITELLM_BASE_URL` + `LITELLM_API_KEY` |

选择顺序：`LLM_PROVIDER` 显式指定 → 有 Gemini 密钥则用 `gemini` → 否则 `litellm`。单次调用可用 `--provider` 覆盖。

## 1. 本地配置

```sh
cp .env.example .env
```

`.env` 已被 `.gitignore` 忽略（`.env.example` 放行）。脚本先读 `.env`，**已存在的环境变量优先**，便于 CI 或临时覆盖。

### 1.1 Gemini 直连

1. 在 <https://aistudio.google.com/apikey> 创建 API Key。
2. 写入 `.env`：

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google AI Studio 密钥 | `AQ.…` |
| `GEMINI_MODEL` | 模型 id，`--models` 能查到的名字 | `gemini-3.8-flash` |
| `GEMINI_BASE_URL` | 可选，API 根地址，默认 `https://generativelanguage.googleapis.com/v1beta` | 自建网关 |
| `GEMINI_TRANSPORT` | 可选，`native`（默认，`generateContent`）或 `openai`（`/openai/chat/completions`） | `native` |
| `LLM_TIMEOUT_MS` | 可选，请求超时（毫秒），默认 `60000` | `60000` |

```sh
npm run llm -- --provider gemini --models
npm run llm -- --provider gemini --ping
npm run llm -- "用一句话说明学院石牌 S001 的位置"
```

模型名会随 Google 侧更新：若返回 `This model … is no longer available to new users`，用 `--models` 查当前名字并写入 `GEMINI_MODEL`。返回体在客户端内统一成 OpenAI 形状（`choices[0].message.content`），现有调用方无需区分 provider。

### 1.2 网络位置限制（实测）

Gemini API 对调用来源有地区限制。在中国大陆、香港等不支持的区域网络里，请求会返回：

```json
{ "error": { "code": 400, "message": "User location is not supported for the API use.", "status": "FAILED_PRECONDITION" } }
```

这说明**密钥本身有效**（否则是 401/403），只是当前网络位置不可用。客户端会把这条错误转成带具体说明的提示（指出地区限制，并给出换区域、换网关、切 `GEMINI_TRANSPORT` 三条路径），而不是只丢一行 HTTP 文本。可选的解决方式：

- 在 Gemini 支持的区域网络（或团队服务器）运行调用；
- 用自建网关代理 Gemini，并把 `GEMINI_BASE_URL` 指向它；
- 网关若只提供 OpenAI 格式，设 `GEMINI_TRANSPORT=openai`。

项目不会内置 VPN、代理池或任何绕过地区限制的代码。

### 1.3 LiteLLM 代理

LiteLLM 用 OpenAI API 格式代理 100+ 模型供应商。

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `LITELLM_BASE_URL` | 代理根地址，也可填完整 `…/chat/completions` | `https://litellm.example.com` |
| `LITELLM_API_KEY` | 虚拟密钥 | `sk-...` |
| `LITELLM_MODEL` | 默认模型名，须与 `/v1/models` 返回一致 | `gpt-4o-mini` |
| `LITELLM_TIMEOUT_MS` | 可选，请求超时（毫秒） | `60000` |

```sh
npm run llm -- --provider litellm --models
npm run llm -- --provider litellm --ping
```

## 2. 命令行

```sh
npm run llm -- "把这段检查输出总结成三条" --system "你是校园工程的验收助手"
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

`chat(messages, { model, temperature, maxTokens, provider })` 接受 OpenAI 消息数组，两个 provider 都返回 OpenAI 形状；`models()` 列出模型；`configured()` 判断密钥是否就绪；`activeProvider()` 返回默认 provider。

## 4. 离线检查

```sh
npm run check:llm
```

`scripts/check-llm-client.mjs` 用 stub `fetch` 校验：Gemini 原生/OpenAI 兼容两种传输的 URL、鉴权头、消息映射与响应归一化；LiteLLM 路径未回归；provider 选择顺序；地区限制、模型下线、缺密钥的错误提示；以及错误信息不泄漏密钥。不联网、不需要真实密钥，已纳入 `npm run check:all`。

## 5. 边界

- 客户端只做出站调用，不监听端口，不扩展现有 `scripts/agent-server.mjs` 的 `/act` 权限模型，也不新增文件写入或任意代码执行入口。
- 密钥不落盘（除本地 `.env`）、不提交、不回显；错误只截取响应体片段。
- 场景几何修改仍走「源码参数 + 重新生成 + 视觉/碰撞核对」流程，LLM 不直接改模型。
- Gemini 的地区限制由 Google 侧判定，本项目只如实上报，不做绕过。
- 与本项目无关的 `WLT_API_KEY`（World Labs，`npm run ai:atlas`）保持不变。
