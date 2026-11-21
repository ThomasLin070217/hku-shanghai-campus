# LiteLLM 接入（项目内 LLM 端点）

LiteLLM 用 OpenAI API 格式代理 100+ 模型供应商。本项目只通过一个零依赖的本地客户端调用它，**不把密钥放进源码、聊天记录或构建产物**。

## 1. 拿到访问信息

1. 打开邀请邮件里的 **Accept Invitation**，用 `u3660124@connect.hku.hk` 注册并接受邀请。
2. 登录后在 LiteLLM 页面创建 **Virtual Key**（虚拟密钥）。
3. 记下代理地址（proxy base URL）。地址形如 `https://<host>`，也可以是 `https://<host>/v1`。

密钥只在本地 `.env` 出现；`.gitignore` 已忽略 `.env` 与 `.env.*`，仅放行 `.env.example`。

## 2. 本地配置

```sh
cp .env.example .env
```

填入：

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `LITELLM_BASE_URL` | 代理根地址 | `https://litellm.example.com` |
| `LITELLM_API_KEY` | 虚拟密钥 | `sk-...` |
| `LITELLM_MODEL` | 默认模型名，须与 `/v1/models` 返回一致 | `gpt-4o-mini` |
| `LITELLM_TIMEOUT_MS` | 可选，请求超时（毫秒） | `60000` |

`.env` 会覆盖同名环境变量为空值之前的行为：脚本先读 `.env`，但**已存在的环境变量优先**，便于 CI 或临时覆盖。

## 3. 验证

```sh
npm run llm -- --models   # 列出该密钥可用的模型
npm run llm -- --ping     # 列表 + 一次最小对话，确认端到端连通
```

成功时输出 JSON（`ok: true`）。失败时输出 `{ "ok": false, "error": "..." }`，退出码非 0；401 会提示检查虚拟密钥。

## 4. 在脚本里调用

```sh
npm run llm -- "用一句话说明学院石牌 S001 的位置"
npm run llm -- "把这段检查输出总结成三条" --system "你是校园工程的验收助手"
npm run llm -- "..." --model gpt-4o-mini --json
```

在 Node 代码里：

```js
import { chat, models, configured } from './scripts/llm.mjs';
if (!configured()) throw new Error('LiteLLM 未配置');
const response = await chat([{ role: 'user', content: 'hello' }]);
console.log(response.choices[0].message.content);
```

## 在 MacBook 使用

配置本机 `.env` 后重启 `npm run dev` 或 `npm run play`。开发服务器自动把 AI Assistant 和 Vibe Console 接到同源的 `/api/campus-model`，只向页面提供路由和模型名。LiteLLM 密钥只在服务器上使用。本机无需认证的 OpenAI 兼容服务可将 `LITELLM_BASE_URL` 指向环回地址，再设置 `LITELLM_MODEL`。

Vibe Console 会请求结构化输出，再用游戏规则校验。服务不支持 `response_format` 时会重试普通 JSON 输出。已发布的静态试玩默认使用可手选的三个离线预设。团队若部署了自己的同源模型代理，可在构建时设置 `VITE_CAMPUS_MODEL_ENDPOINT` 与 `VITE_CAMPUS_MODEL_NAME`。这两个前端字段只适合公开的路径和模型名。

## 边界

- 客户端只做出站 HTTPS 调用，不监听端口，不扩展现有 `scripts/agent-server.mjs` 的 `/act` 权限模型，也不新增文件写入或任意代码执行入口。
- CLI 和游戏代理不回显密钥，HTTP 错误返回状态码。
- 场景几何修改仍走「源码参数 + 重新生成 + 视觉/碰撞核对」流程，LLM 不直接改模型。
- 与本项目无关的 `WLT_API_KEY`（World Labs，`npm run ai:atlas`）保持不变。
