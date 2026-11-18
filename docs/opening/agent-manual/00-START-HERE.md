# Thomas 开场：外部 Agent 执行手册

交接日期：2026-11-18。用户自行派发；本轮剩余外部调用已经停止。不要假设还有其他后台 agent 会自动补齐模块。

## 你应该给每个 Agent 什么

每个 Agent 需要 **当前开发快照 + 自己的任务书**。不能只给旧 GitHub main 或只给聊天中的任务描述。

- 原始基线提交：`f157e29`。
- 本机开发分支：`codex/thomas-opening`。
- 本次修改尚未提交或推送。远端分支不能代表当前本地内容。
- 配套 `thomas-opening-agent-handoff.zip` 是基于该提交的源码覆盖包，含当前 `src/`、`scripts/`、接口、配置及本手册，不含完整基础资产/实拍原片/依赖。它不是独立运行包。
- 有现有项目副本的 agent，在独立副本核对基线后接收当前覆盖包；已有其他改动时先保存并单独比较，不直接覆盖。没有项目权限或基础资产时，应明确报告缺少依赖。
- 同一机器可共用当前目录，但只编辑各自白名单；不同机器/不同 checkout 最终交付补丁和新增文件，由集成者汇总。不要四个人各自整体覆盖项目目录。

推荐分发：

| 收件 Agent | 发给他的文件 | 本轮目标 |
| --- | --- | --- |
| A | `01-STATE-AND-SAVE.md` | 审查补齐已有剧情/存档初稿及测试 |
| B | `02-WORLD.md` | 巴士、晚宴区、取电脑空间及正常/异常布景 |
| C | `03-ROBOT.md` | 红眼扫描、慢追逐、搜索和捕获逻辑 |
| D | `04-UI.md` | 英文请柬、对话、红屏、应急模式和失败界面 |

四项可以同时做。Agent B 与 C 都读取同一份布局，禁止各自发明坐标。Agent D 直接读取现有 UI 契约，不需要等待 A/B/C 实现完成。Agent A 接手现有初稿，先审查，不重复另建第二套状态机。

## 可以直接复制给每个 Agent 的公共前缀

> 你正在现有 HKU Shanghai Campus 项目完成 Thomas 的开场模块。先读根 AGENTS.md、docs/AI-START.md、docs/plans/THOMAS-OPENING-PLAN.md、src/opening/contracts.ts、src/opening/spatialLayout.ts，然后执行我发给你的任务书。请实际编写代码并验证，不只回复方案。只编辑任务书列出的文件。公共入口与共享 API 由集成者负责，发现问题请提供精确补丁建议，不自行改写或删除其他成员模块。当前是未完成快照，缺失模块造成的基线报错必须与自己新增的错误分开报告。不要安装新依赖、调用其他 Agent、发布、合并或发送消息。完成后交付实际修改文件、接口说明、测试命令/结果和未验证项。

## 已确认的产品事实：不用再问一遍

- 2030 年，AI 控制机器人并部署校园屏障。电脑里的本地 AI 因接入校园网络检测到攻击；主线不依赖真实 LLM 服务。
- 玩家是 Student Ambassador，前往 High Table Dinner。巴士停在 Building 4 门口。
- Building 5 一楼，进门右转是晚宴区。Staff/教授认出学生大使，委托去 Building 6 拿展示用 MacBook，取物不加谜题或复杂楼层。
- 返回 Building 5 听到混乱声音，场地无人、椅子倒地；前半温暖，后半诡异，不做血腥演出。
- 玩家主动按 C 打开电脑后看到红屏警报，随后由应急助手引导前往 Building 4。
- 机器人慢速、红眼扫描；发现后追逐，追上才失败。遮挡脱离后搜索最后可见位置，再恢复巡逻。玩家不能攻击，只能躲避和逃跑。
- Retry 回到遭遇前安全检查点，保留电脑和此前进度。
- Thomas 段止于 Building 4 正门外；不实现 Harry 的室内谜题、超算、备用电源、其他成员 Boss/救人关卡。
- 游戏可见文本全部英文，称 Building 4/5/6；代码稳定编号仍是 B04/B05/B06，真实历史资料中的名称不改。
- 10–11 分钟是控制开发范围的粗略参考，没有最低时长，不为时长凑任务。
- 保留像素/方块风、现有玩家控制、背包、MacBook 插槽、角色模板、音量/存档/AI 安全规则。

## 共享文件冻结

以下文件和目录已有未提交集成工作，四个外部 Agent **只能读取**，不能直接修改：

- `src/opening/contracts.ts`、`spatialLayout.ts`、`experience.ts`、`navigation.ts`、`geometry.ts`、`map.ts`、`npcs.ts`。
- `src/main.ts`、`src/exploration/*`、`src/items/*`、`src/gameplay/*`、`src/model/*`、`src/scene/*`、`src/agent/*`。
- `package.json`、锁文件、Vite/启动脚本、导出/场景目录脚本，以及不在任务白名单内的其他脚本。
- 所有其他成员关卡和历史参考原件。

遇到契约确实缺字段：在交付说明中写“文件 + 字段/签名 + 用途 + 最小补丁”，先保持任务模块按现有接口可用；不要为了自己方便改共享 API。

## 当前工程的真实状态

已写入但尚未联合验证：主入口开场分支、同源门洞/导航、交互路由、开场 experience、NPC 模板接线、英文地图与部分公共界面文案。

A 的 `state.ts` 和 `persistence.ts` 已有初稿，但尚未验收。B/C/D 的生产入口目前缺失：`world.ts`、`robot.ts`、`ui.ts`、`opening.css`；对应测试也未齐。当前 `npm run typecheck` **未通过**，不能声称开场能运行或已通关。

本次交接检查的主要错误：

- 缺失 `world.ts`、`robot.ts`、`ui.ts`。
- 缺失 UI 类型传播造成 experience 回调的隐式 any。
- `src/opening/persistence.ts` 中 `itemId: string | undefined` 未充分收窄。

此前基线 `check:all` 通过及可行性原型结果位于 `evidence/opening-feasibility/`，只证明旧基线与技术路径，不代表这些新模块已通过。更早 HANDOFF 中关于运行和存档的陈述是目标行为，以上交接状态优先。

## 每个人的交付格式

1. 修改清单：仅自己白名单的文件，附实际文件或补丁。
2. 精确导出签名，与调用者兼容；列出共享补丁建议。
3. 实际运行的验证命令、退出码及关键结果。没运行的写“未验证”。
4. 已知问题、素材假设、估算参数及真实资料待核处。
5. 如工具能提供，用独立 JSON 记录模型名称、输入/输出 tokens 和成功/失败；不要复制密钥、鉴权配置、授权 URL 或完整私人日志。

每个 agent 只运行自己负责的检查。单模块阶段不要反复 `npm run check:all`、重生成全仓库资源、导出全校园或手改 catalog。没有其他模块导致的完整项目报错原样记录，不用空文件/假返回值掩盖。

## 回收与集成顺序

1. A 先交状态/存档及测试；B/C/D 同时产出独立模块。
2. 集成者收齐四份修改，检查白名单和接口差异，再统一 `npm run typecheck`。
3. 运行 `npm run check:opening`，先修顺序、碰撞、唯一电脑、机器人和模态问题。
4. 完整流程离线/浏览器验收后再精修；AI 实机移动必须用户在页面开启控制，动作只走 `/act`，不能用写坐标/模拟键盘绕过物理。模态撤权规则保留。
5. 最终由集成者统一运行 `npm run check:all`、`npm run scene:catalog`、`npm run scene:opening`、`npm run export:glb && npm run validate:glb`，保存同机位截图和完整游玩记录。
6. 最终只发 `opening.building4_reached` 的待映射交接事件和三个既有 flags，不提前发 `chapter_01_completed`。
