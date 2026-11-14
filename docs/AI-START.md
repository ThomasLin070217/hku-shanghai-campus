# 团队与 AI 最短接手指南

给 Agent 这句话即可：

> 先读仓库根目录 AGENTS.md。我要修改 S001（学院石牌）：〔填写问题〕。查询这个编号，找到源码和依据，再修改、运行、检查碰撞并交付对照图。

## 给团队：怎么报问题

页面右上角点 **场景编号** → 搜索或点选模型 → **复制修改任务**。把复制的文字和截图发给负责同学。编号模式暂停游戏，不改变玩家位置；退出编号后可从“校园工具”返回室外探索。

例如：`B04` 是 CDS-1；`B04-ENTRY` 是它的入口；`S001` 是学院石牌；`S001-TEXT` 是牌面黑字与校徽；`R005` 是东侧带状步道；`L001` 是狮子。完整主要编号见 [编号表](../assets/scene/major-index.md)。细部点选可获得独立编号。

## 给开发 Agent：离线查源码

```sh
npm ci
npm run scene -- entity S001
npm run scene -- find 石牌
npm run play
```

返回值含 `sourceFile`、`sourceAnchor`、`authorKey`、范围、父级和参考依据。`sourceAnchor` 是源码内搜索词，不依赖容易变化的行号；循环生成件需要同时看作者键与范围。完整 [catalog.json](../assets/scene/catalog.json) 可离线读取，修改后 `npm run scene:catalog` 更新。

## 给游戏 Agent：在线读状态和操作

先启动 `npm run play`，打开 http://127.0.0.1:5184/。HTTP 服务在 127.0.0.1:8788。

```sh
npm run agent -- capabilities
npm run agent -- entities '{"kind":"road","limit":20}'
npm run agent -- entity S001
npm run agent -- observe
node scripts/agent-scene-demo.mjs
```

上述操作都是只读。需要跑跳、转向或高亮时，用户在页面打开“重新开始 / AI 控制”，点“开启 AI 控制”，再运行：

```sh
node scripts/agent-scene-demo.mjs --control
```

示例实际查询道路和牌子 → 获取控制 → 按 ID 高亮 → 转向并短距离行走 → 查询执行结果 → 停止 → 释放。不需要 API Key。人物移动仍走同一套碰撞和重力。

## MCP：直接给支持 MCP 的 Agent 当工具

把下列配置加入 MCP 客户端；`args` 替换为该机器上脚本的绝对路径，不要带 `npm run` 的输出前缀：

```json
{
  "mcpServers": {
    "hku-campus": {
      "command": "node",
      "args": ["/你的项目目录/scripts/agent-mcp.mjs"]
    }
  }
}
```

提供 10 个工具：`campus_observe`、`campus_entities`、`campus_entity`、`campus_acquire_control`、`campus_act`、`campus_command`、`campus_select_entity`、`campus_stop`、`campus_release_control`、`campus_screenshot`。工具描述和输入 JSON Schema 会由 `tools/list` 返回。

MCP 使用 stdio JSON-RPC，初始化协议版本为 2024-11-05；底层仍调用同一个本机 HTTP/WebSocket 服务。仅接 MCP 不会自动启动校园或开启 AI 权限。浏览器未连时返回 `not_ready`。

## 边界

- 编号覆盖当前主校园的静态几何（包含合并前的细部），不会把每个三角形都做成一个编号。玩家稳定 ID 为 `PLAYER`，背包物品与任务继续使用 observe 中原有实例 ID。
- 独立室内研究页、未加载的未来 NPC 不伪装成已进入主校园索引。
- 这是可接入的工程与游戏工具层，不是内置付费大模型或自动建模服务。
- 本轮运行时只支持读取、选择、截图与既有游戏动作；建筑结构修改由开发 Agent 按返回的源文件完成，避免视觉移动但碰撞没更新。
- 尺寸/材质调整和无关对象插入不会改变已有作者键；改变重复序列的语义顺序需要显式保留作者键或迁移 ID。

高架步道和礼堂连接平台也有道路编号。编号表示已建模结构，不代表本轮新增了可行走路线；通行能力仍以现有物理控制器为准。
