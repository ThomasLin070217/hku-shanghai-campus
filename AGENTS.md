# HKU Shanghai campus — Agent 接手入口

先读 `docs/AI-START.md`。这是现有 Vite + TypeScript + Three.js 校园项目，继续修改现有工程。

## 最短工作路径

1. `npm ci`；`npm run play`；打开 http://127.0.0.1:5184/。
2. 按用户给的编号查询：`npm run scene -- entity S001`。不需要浏览器；`npm run agent -- entity S001` 查询当前运行场景。
3. 读返回的 `sourceFile`，用 `sourceAnchor` / `authorKey` 定位构造代码。参考 `reference`，区分已确认与估算。
4. 修改源参数 / 生成代码；重新生成模型；检查视觉与碰撞一致。保留当前像素风。
5. `npm run check:all`；`npm run scene:catalog`；涉及几何则 `npm run export:glb && npm run validate:glb`。保存必要的同角度截图。

## 编号规则

- B01–B07 是现有楼号；R001… 是道路；A… 是区域；S001 是学院石牌；L001 是狮子。
- 细部使用 `所属编号-P-哈希`，Group 使用 `-G-哈希`。含义来自作者键，不能依据 Three.js UUID、世界坐标或当前数组下标来猜。
- `src/scene/authoring.ts` 在合并前保存部件范围，`registry.ts` 生成可查询索引。不要移除 `authorParts` / `sceneId` 元数据。
- 同名重复部件的顺序必须 append-only。插入、重排或重命名已有重复件时先显式保留其 `userData.authorKey`；涉及历史 ID 变化必须提供旧→新迁移表，不能静默重新编号。
- 场景 revision 会随范围变化；运行时选中请求必须携带当前 revision。JSON 索引是生成文件，不直接手改。

## 移动与权限

- 人类与 AI 共用 `CampusGame` / `CharacterPhysics`。动作只能走 `/act`，不能写坐标或模拟键盘绕过物理。
- AI 控制必须由用户在页面开启；保留 epoch、超时、去重、人工接管、失焦停止规则。
- 编号查询不需控制权；`/scene/select` 只做高亮，不传送、不改相机、不修改几何。
- 运行时几何修改仍走源代码/参数工作流。不要增加“任意执行 JS”、远端 shell 或文件写入接口。
- 服务仅监听 127.0.0.1，保留 Origin/Host 校验；密钥不提交。

## 模块入口

- 建筑/道路/景观：`src/model/`；道路与行走支撑共用 `groundLayout.ts`。
- 场景编号与 UI：`src/scene/`。
- 角色物理：`src/exploration/`；角色动画：`src/characters/`。
- 任务/声音/存档：`src/gameplay/`；物品：`src/items/`。
- HTTP/WebSocket：`scripts/agent-server.mjs`、`src/agent/bridge.ts`。
- MCP：`scripts/agent-mcp.mjs`；工具 Schema：`scripts/agent-tools.mjs`；动作 Schema：`src/agent/action.schema.json`。

保留他人修改和已有参考资料。普通运行包不复制大型证据；`npm run build:review` 才包含研究/验收入口。仓库保持 private；不要改变协作权限或自动发送消息。
