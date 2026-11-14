# WorkBuddy 对照报告复核 · 2026-11-14

基线为 18d68d0（9 次提交，工作区干净）。报告是有用的历史快照，但部分描述已过时。以下只针对用户粘贴的结论，不声称读过未提供路径的交互报告。

| 反馈 | 当前复核与处理 |
|---|---|
| dist 424 MB → 5.4 MB | 当前实测 5.4 MiB，运行包与证据包分离已生效。 |
| 主 JS 降到约 158 KB | 成立，但 Three.js 分包仍约 766 KB；不能把主 chunk 当成全部下载量。共享字体主要减少解析重复，不宣称明显缩包或帧率收益。 |
| Git 0 → 8 次提交；49 文件未提交 | 基线已经是 9 次提交、干净工作区，属于时点变化。 |
| 每帧布局测量、context loss、dispose、存档保护 | 前轮已处理，现有回归继续通过。 |
| .git 883 MB | 本轮开始约 879 MiB。执行 git gc --no-prune 后约 674 MiB，并通过连通性检查；没有使用立即 prune、aggressive 或强推。 |
| 两个 285 MB ZIP 留在历史 | 文件分别 123,470,189 和 161,803,404 bytes，合计约 285 MB（272 MiB），不是每个 285 MB。确实可达历史仍包含它们；本地松散对象不是远端克隆大小。 |
| gc --prune=now --aggressive 零风险 | 不认可：立即删除未引用对象可能失去恢复机会，且与并发写入存在风险；aggressive 也不是常规清理必需。当前仅保留对象压缩，未重写历史。 |
| viewer/scene.ts、supplyScene.ts 无入口 | 成立。连同仅被旧模块/旧测试使用的 supplyQuest.ts 移除，卸载 xstate。它们原本不在运行 bundle，因此收益是维护与安装负担，不能称为运行性能大幅提升。 |
| 字体重复解析 6 次 | 成立，共享 src/model/fonts.ts 的常规字体和标识字体，各解析一次。保留不同字体，未替换字形。 |
| 没有 test / CI | 原本已有大量 check 脚本，不是没有自动测试。新增 npm test 统一入口；check:gameplay 兼容别名指向当前巡检验证；准备 GitHub CI 模板，执行回归、传输测试、索引一致性与 GLB 校验；当前 OAuth 凭据缺少 workflow 权限，GitHub 拒绝创建工作流，模板保存在 docs/ci/campus-check.yml，尚未启用。 |
| 没有 lint | 成立。暂未引入新 lint 工具；严格 TypeScript、构建和行为断言继续作为当前门槛。需要单独选择 lint 规则并分批治理，避免全仓格式改写掩盖功能变更。 |
| action.schema.json 无人读取 | 已过时。scripts/agent-tools.mjs 读取它，作为 MCP campus_act 输入 Schema。运行时动作还经过 protocol.ts 验证。 |
| 参数文件重复字面量 | 部分成立。单楼默认值与全校楼栋实例有重合，各楼尺寸又有独立证据。当前全校以 campusParameters.ts 为实例来源，buildSite 显式覆盖默认值；不为消除相同数字而绑定不同楼栋。尚可进一步整理，但没有证据表明本次存在参数同步故障。 |
| DELIVERY / VALIDATION 重叠 | 多为历史验收快照，保留追溯。当前入口为 README、docs/AI-START.md；本轮修正团队交接中仍指向已退出功能的链接。未把历史证据当当前结果。 |
| DPR 2、2048 阴影常开 | 当前确实为上限 2 与 2048；尚无具体设备性能数据证明应统一降画质。保留现有画面，低性能画质档位为后续优化，不假称已做帧率测试。 |

## 验证

`npm test`（完整 check:all 与生产构建）、`npm run check:transport`、`npm run scene:catalog` 和索引 git diff、`npm run validate:glb` 全通过。17,606 条索引与 revision 61f6ad18067c 完全不变，17 个已有 GLB 为 0 errors / 0 warnings。

本轮没有改变几何/渲染参数，也未重新进行浏览器动态或音频验收。记录见 `evidence/review-followup/checks.log`。CI 尚未远端运行：需获 workflow 权限后将 docs/ci/campus-check.yml 放入 .github/workflows/check.yml 并推送。

CI 参考 GitHub 官方 Node.js 工作流说明：https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs 。checkout / setup-node 使用经过 GitHub API 核对的 v6 提交固定值；仅授予 contents:read。

历史源码查询：`git show 18d68d0:src/gameplay/supplyQuest.ts`。当前任务逻辑为 `src/gameplay/survey.ts`，展示/交互接线为 `landmarks.ts` 与 `experience.ts`；团队文件已同步。
