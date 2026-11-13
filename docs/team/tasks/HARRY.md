# Harry → Agent：谜题、任务状态与可选LLM对话

在现有Vite/TypeScript/Three.js项目上工作。先读 `docs/team/TEAM-HANDOFF.md`、`README.md`、`AI-INTERFACE.md`、现有玩家控制和状态代码，然后运行现有工程。不重建整个项目。

## 本轮直接完成，按顺序推进

1. 先提出 `src/contracts/narrative.ts` 和内容JSON Schema，包含稳定NPC/目标/线索/谜题ID、交互事件、任务快照、返回结果、对话请求与回复。按总交接的v0建议补齐；给Thomas和WHL一个最小可调用示例，再冻结契约。契约未合入时其他模块可做mock，不能声称已联通。
2. 在 `src/gameplay/` 做确定性主线状态机、目标/线索注册表、条件检查与订阅。重复事件不重复推进；未解锁任务不能绕过；错误答案可重试。提供存档/读取/重开，保存版本号；未知旧版本应安全提示重开或明确迁移，不能静默乱读。
3. 完成2个谜题模块，先按顺序导视与模拟中继原型；结合Frost内容定稿规则。为每个谜题写正确/错误/乱序/重复/恢复后的测试。
4. 在 `src/props/puzzles/` 做可复用室外装置，使用局部原点与原创方块资产。提供尺寸和碰撞需求，由Thomas布置。不得直接改七栋楼的位置或将终端埋入墙中。
5. 在 `src/dialogue/` 做 `ScriptedDialogueAdapter`，无key即可按NPC与任务阶段回答。WHL通过同一接口拿文本。玩家自由输入不直接改任务状态。
6. 再加 `server/dialogue/` 的可选LLM适配器：只接受允许的NPC身份和受控上下文；服务端加载已公开事实；密钥留服务端；请求限时/限长，错误或无key回落固定对白。给出 `.env.example` 变量说明但不填真实key。
7. 写 `docs/gameplay/HANDOFF.md`，包含API例子、状态流转图、安装/运行/测试步骤、存档格式、对Thomas/WHL的接线要求。

## 和别人怎么配合

Frost负责故事真相和台词，你负责它们什么时候能被读取，以及谜题何时成立。WHL负责交互检测/界面/角色行为，你提供 `dispatchInteraction/getSnapshot/subscribe` 与对话适配器。Thomas提供玩家真实位置和稳定锚点；距离与前置条件的判定不能信任客户端事件自报位置。

现有 `src/agent/*` 控制的是玩家移动。不要把它改成NPC聊天API，不要调用 `acquireControl` 让NPC说话，不绕过人类接管。真实LLM不判谜底、不发奖励、不改坐标或解锁权限。

## 代码边界

主改 `src/gameplay/`、`src/dialogue/`、`src/props/puzzles/`、`server/dialogue/`、`scripts/check-gameplay*`。共享契约先独立提案。不要覆盖Frost内容或WHL界面。对 `src/main.ts`、全局样式、package/lock、启动脚本的修改给Thomas最小接线说明；新增依赖说明用途，不全量升级。

## 验收

两谜题在无网络无key下可完成；状态转移、去重、拒绝越级、存档恢复、重开、错误答案重试、LLM超时/错误降级都有实际证据。运行 `npm run build` 和受影响的现有检查。LLM供应商尚未确定或真实API未调用时，明确写“适配器/mock已验证，真实供应商未验证”。

最终提交模块源码、测试、离线演示、接口文档、截图/短视频及限制。独立分支 `feat/puzzles-dialogue`，不要自行合并主分支。
