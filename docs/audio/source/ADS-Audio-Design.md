# HKU Shanghai Campus — AI Uprising · 音频设计文档（ADS）

**版本** v0.1（基于截断任务书的先行版） · **日期** 2026-11-19 · **负责** WorkBuddy 音频团队
**配套项目** `~/Documents/ChatGPT/shanghai campus`（v9.0 + Thomas 开场模块，分支 `codex/thomas-opening`）
**时长目标** 约 30 分钟 · **故事年份** 2030 · **类型** 第一人称 3D 像素风校园探索/解谜/追逐/Boss

---

## 0. 本版边界与待补事项（务必先读）

用户提供的任务书在**第 4 节动作音效表格中途截断**（止于「起跳」行），缺失：
- 第 4 节余下动作（落地、下蹲、上下楼梯等）
- Scene 05 及之后（Boss 战、篮球馆解谜、学生获救、灯光秀、结尾）的详细需求
- 第 5 节起全部交付规格（文件格式、命名、采样率、混音标准、触发配置格式）

**处理方式**（已与用户确认）：按专业标准补齐缺失规格，用 `〔TBD〕` 标记需要用户/Codex 确认的推断内容，缺失场景依据任务书第 1 节故事梗概合理推导。所有 `〔TBD〕` 项不影响已定部分的落地。

**职责边界**：WorkBuddy 负责声音本身与设计规范；**音效触发、状态切换、音量控制、循环、空间化、资源加载由 Codex 接入**。本文第 9 节给出接口契约。

**核心设计目标**：用声音呈现「安全轻松 → 孤立恐惧 → 恢复希望」的完整情绪曲线。

---

## 1. 声音美学总纲

### 1.1 三段式情绪曲线

| 阶段 | 场景 | 声音关键词 | 主音区 | 节奏 | 主要总线 |
|---|---|---|---|---|---|
| A · 安全 | Scene 01-02 | 温暖、通透、日常、轻 academic | 中高频明亮 | 舒缓 60-80 BPM | ambient + music(safe) |
| B · 封锁 | Scene 03-04 | 空旷、冰冷、压迫、电子失真 | 低频下沉 + 高频金属 | 悬疑 70→追逐 140 BPM | ambient(dark) + music(tension/chase) |
| C · 希望 | Scene 07-08〔TBD〕 | 开阔、上扬、释然 | 中高频回归 | 渐强 90→110 BPM | music(hope) + ambient(restored) |

### 1.2 三条设计铁律

1. **恐怖不靠音量**：Scene 03 的转折靠"音色被侵蚀 + 声场收窄 + 高频抽离"实现，不是把所有声音调大。峰值电平三段保持在同一量级（见第 8 节）。
2. **声场是叙事工具**：正常期声场开阔（左右 + 混响尾），封锁期声场压扁、外界声被"切除"（高频陡降 + 短混响 + 单声道化倾向），恢复期声场重新展开。
3. **信息性声音优先于装饰**：机器人位置、锁定警报、脚步材质、交互确认必须可辨；氛围层永远给它们让路（ducking，见 8.4）。

### 1.3 音乐系统：分层自适应（Adaptive Layers）

不做"一首曲子循环到底"，而做**同调性、可无缝切换的分层 stems**。所有层同一根音/调性（建议 A 小调 → C 大调的情绪转位，〔TBD 音乐总监确认调性〕），共用节拍网格，便于交叉淡化。

| 层 ID | 名称 | 编制（程序合成可实现） | 循环长度 | 使用场景 |
|---|---|---|---|---|
| `mus_safe` | 校园日常 | 拨弦琶音 + 柔和 pad + 轻打击 | 16 小节 | Scene 01-02 |
| `mus_unease` | 异常伏笔 | 低频 drone + 失谐泛音 + 稀疏脉冲 | 16 小节 | Scene 03 前半、封锁后探索底 |
| `mus_tension` | 被发现 | 低音脉冲 + 金属打击 + 不协和和弦 | 8 小节 | 机器人锁定/警戒 |
| `mus_chase` | 追逐 | 快速低音 + 切分打击 + 上扬警报动机 | 8 小节 | 追逐中 |
| `mus_boss` | 机械狮 | 重型打击 + 铜管式合成 + 合唱垫〔TBD〕 | 16 小节 | Boss 战 |
| `mus_hope` | 恢复 | 明亮琶音 + 大调和弦 + 钟声 | 16 小节 | 结尾灯光秀 |

切换规则见第 9 节触发契约。层间交叉淡化 1.5-3 秒；追逐→脱离采用 4 秒渐进回落，避免突变。

---

## 2. Scene 01 — 校园巴士入场

**情绪**：轻松、自然、期待 · **目标总线**：ambient + music(safe)

### 2.1 声音清单

| ID | 声音 | 类型 | 空间化 | 循环 | 说明 |
|---|---|---|---|---|---|
| `bus_engine_loop` | 小巴发动机怠速 + 车厢震动 | 授权素材优先 | 2D（车内） | 是 | 低频柔和，避免盖过对话 |
| `bus_ac_hum` | 空调出风底噪 | 合成 | 2D | 是 | 与 engine 混合为单一 ambient 源 |
| `bus_road_noise` | 道路行驶胎噪 | 授权素材 | 2D | 是 | 随车速轻微变化〔TBD 接口是否提供 speed〕 |
| `bus_brake` | 减速刹车 | 合成/授权 | 2D | 否 | 进场时一次性 |
| `bus_door_open` / `bus_door_close` | 小巴门开/关 | 授权素材 | 3D（门位置） | 否 | 气动门质感优先 |
| `campus_distant_voices` | 远处学生交谈 | 授权素材 | 3D（远处） | 是 | **低存在感**，不得可辨词句；用低通 + 低电平 |
| `invitation_open` / `invitation_page` / `invitation_close` | 请柬翻开/翻阅/合上 | 合成（纸张摩擦） | 2D UI | 否 | 轻微、克制 |
| `mus_safe` | 开场 BGM | 合成 stem | 2D | 是 | 年轻、学术、未来科技感，避免过度宏大 |

### 2.2 过渡设计（下车 → 室外）

采用**声场展开 crossfade**，约 3 秒：
1. 车内源（engine/ac/road）电平淡出 + 高频渐开（模拟从封闭车厢到开阔室外）。
2. 室外源（campus outdoor ambient，见 Scene 02）淡入。
3. `mus_safe` 保持连续，仅做 EQ 从"闷"到"亮"的过渡。

---

## 3. Scene 02 — 正常校园探索

**情绪**：明亮、安全、日常 · **关键要求**：自然空间层次，不能是一条重复噪音；远处人声低存在感。

### 3.1 分层环境系统（关键设计）

放弃"单条环境音循环"，改为**多层可独立调度的 ambient stems**，由 Codex 按位置/距离动态混音：

| 层 | 内容 | 空间化 | 调度规则 |
|---|---|---|---|
| `amb_breeze` | 树叶/微风基底 | 2D 全景 | 常驻，全区域 |
| `amb_birds_far` | 远处鸟鸣 | 3D（随机远处点） | 稀疏触发，间隔 4-12s 随机 |
| `amb_birds_near` | 近处鸟鸣 | 3D（树位置） | 靠近绿化区触发 |
| `amb_voices_far` | 远处交谈 | 3D（远处固定点） | 低电平，仅 B5/B6 周边 |
| `amb_steps_others` | 偶发他人脚步 | 3D | 稀疏，制造"有人在活动"感 |
| `amb_indoor_room` | 建筑入口/走廊室内感 | 2D | 进入建筑时切换（EQ 变闷 + 混响缩短） |

**实现要点**（给 Codex）：各层独立 GainNode，按距离公式（inverse，refDistance 2，rolloff 0.6——与现有 `audio.ts` 一致）衰减；鸟鸣层用随机间隔调度而非固定循环，避免"节奏感"。

### 3.2 建筑声学差异

- 室外：开阔，高频完整，长混响尾（模拟室外散射）。
- 入口/走廊：低通 ~2.5 kHz，短混响，脚步反射感增强。
- 需 Codex 提供"进入/离开建筑"事件或区域检测。

---

## 4. Scene 03 — AI 觉醒与帷幕降下（核心转折点）

**情绪**：异常、震惊、恐惧 · **设计铁律**：无缝过渡、不靠音量堆砌。

### 4.1 八阶段演出时间线（Cue Sheet）

这是全游戏最重要的声音演出，给出精确的相对时间轴（秒），Codex 按顺序触发：

| 阶段 | 时间 | 声音事件 | 设计手法 |
|---|---|---|---|
| ① 前兆 | T+0.0 ~ 2.0 | `amb_breeze` 开始轻微失真；出现极低频 `sfx_anomaly_low`（40 Hz drone 渐入）；鸟鸣停止 | "自然声被侵蚀"：对 ambient 总线做缓慢 lowpass 扫频 8 kHz→3 kHz + 轻微 detune |
| ② 音乐中断 | T+1.5 ~ 3.5 | `mus_safe` 被 `sfx_glitch_burst`（数字碎裂）打断并淡出 | 不是音量渐弱，是"被撕碎"：短促随机噪声脉冲 + 音高下滑 |
| ③ AI 启动 | T+2.5 ~ 5.0 | `sfx_ai_boot`（电子系统启动：上升扫频 + 继电器咔哒 + 低频嗡鸣） | 从远到近的空间感（音量 + 混响干湿比变化） |
| ④ 异常扩散 | T+4.0 ~ 8.0 | `sfx_disturbance_spread`（电子设备受干扰：多重不谐和音 + 电流噼啪） | 声场从中心向四周扩散（多声道 / 多次延迟触发） |
| ⑤ 帷幕降下 | T+6.0 ~ 11.0 | `sfx_veil_descend`（巨大低频下压 + 金属摩擦 + 空间压迫） | 频率持续下潜（80 Hz→25 Hz），伴随"包裹感"混响增强 |
| ⑥ 封闭瞬间 | T+11.0 | `sfx_veil_seal`（一次性冲击 + **所有外界声瞬间切除**） | 关键：ambient 总线做 0.1s 硬切 + 高频陡降，制造"被隔绝" |
| ⑦ 死寂 | T+11.2 ~ 13.5 | **几乎无声**，仅保留极低电平的 `amb_dark_hum` | 留白，让玩家感知"失去外界" |
| ⑧ 恐怖氛围 | T+13.5 ~ | `amb_dark_hum` + `mus_unease` 淡入 | 空旷、冰冷；低频 drone + 稀疏金属反射音 |

### 4.2 音效清单

| ID | 声音 | 类型 | 时长 | 说明 |
|---|---|---|---|---|
| `sfx_anomaly_low` | 异常低频 | 合成 | 4.0s | 40 Hz + 谐波，缓慢渐入 |
| `sfx_glitch_burst` | 音乐中断碎裂 | 合成 | 1.2s | 数字失真脉冲串 |
| `sfx_ai_boot` | AI 系统启动 | 合成 | 3.0s | 上升扫频 + 继电器 + 嗡鸣 |
| `sfx_disturbance_spread` | 电子设备干扰 | 合成 | 5.0s | 不谐和 + 电流声 |
| `sfx_veil_descend` | 帷幕降下 | 合成 | 6.0s | 频率下潜 + 金属摩擦 + 压迫 |
| `sfx_veil_seal` | 帷幕封闭冲击 | 合成 | 1.5s | 一次性冲击 + 切除点 |
| `amb_dark_hum` | 封锁后底噪 | 合成/授权 | 循环 | 空旷冰冷，极低电平 |
| `mus_unease` | 恐怖探索氛围 | 合成 stem | 16 小节 | 低频 drone + 失谐泛音 |

---

## 5. Scene 04 — 暗黑校园与机器人追捕

**情绪**：危险、孤立、紧张 · **约 8 台机器人**（巡逻/定点/追逐）

### 5.1 环境层

| ID | 声音 | 空间化 | 说明 |
|---|---|---|---|
| `amb_dark_hum` | 黑暗校园底音 | 2D | Scene 03 延续 |
| `amb_machine_distant` | 远处异常机械声 | 3D（远处） | 稀疏，提示机器人在活动 |
| `amb_electric_crackle` | 低频电流 + 偶发干扰 | 2D | 低电平，不规律 |
| `mus_unease` | 未发现时的悬疑 | 2D | 分层音乐基础层 |

### 5.2 机器人音效（空间化是关键）

**设计原则**：每台机器人用 3D PannerNode（与现有 `audio.ts` 一致），玩家能靠听觉判断方位与距离。不同机器人共用音色，但通过空间化 + 音高微调（±3%）区分，避免"每台音乐不同"的混乱。

| ID | 声音 | 触发 | 空间化 | 循环 | 说明 |
|---|---|---|---|---|---|
| `robot_servo_loop` | 伺服电机 + 关节 | 巡逻中 | 3D（机器人位置） | 是 | 移动时播放，静止停止 |
| `robot_patrol_step` | 机械足音 | 移动每步 | 3D | 否 | 重金属落地感 |
| `robot_scan` | 红眼扫描 | 扫描动作 | 3D | 否 | 电子扫频，方向性强 |
| `robot_lockon` | 发现玩家锁定 | 锁定瞬间 | 3D | 否 | 明确警报音，**关键预警** |
| `robot_chase_loop` | 追逐音 | 追逐中 | 3D | 是 | 电机负载升高 + 警报 |
| `robot_near_danger` | 接近危险提示 | 距离 < 阈值 | 2D | 否 | 心跳/低频脉冲，随距离加急 |
| `robot_capture` | 抓住玩家 | 被抓瞬间 | 2D | 否 | 冲击 + 金属夹持 |
| `sfx_blackout` | 黑屏 | 被抓后 | 2D | 否 | 低沉下坠 + 静音 |
| `sfx_safe_restore` | 安全点恢复 | 重生时 | 2D | 否 | 反向的"苏醒"音，温柔上扬 |

### 5.3 音乐分层切换（4 状态）

| 状态 | 音乐层 | 切换方式 |
|---|---|---|
| 未被发现 | `mus_unease` | 基础层 |
| 机器人警戒（扫描中） | `mus_tension` 淡入 | 1.5s crossfade |
| 追逐中 | `mus_chase` | 0.5s 快速切入 + 打击强调 |
| 成功脱离 | `mus_unease` | 4s 渐进回落（不突变） |

**追逐结束判定**由 Codex 提供（遮挡脱离 + 搜索结束），音频侧只响应状态事件。

---

## 6. 人物动作音效专项修复（高优先级）

任务书明确指出：走路音不自然、节奏与动画不匹配、校园环境音不合适。现有实现已部分修复（CC0 脚步 + 真实风声），本轮补齐缺失动作并优化。

### 6.1 脚步系统（现有基础 + 改进）

| 动作 | 音效 | 现有状态 | 改进方向 |
|---|---|---|---|
| 硬质地面行走 | 轻量鞋底落地 | ✅ 已有 5 变体（CC0 concrete） | 保持 |
| 草地行走 | 柔和草叶摩擦 | ✅ 已有 5 变体（CC0 grass） | 保持 |
| 奔跑 | 更快但不沉重 | ✅ 通过 playbackRate 1.08 | 保持 |
| 起跳 | 适度起跳反馈 | ❌ 缺失 | 新增 `step_jump` |
| 落地 | 单独落地音 | ✅ 已有（复用脚步 + 冲击参数） | 优化为独立 `step_land` |

**节奏匹配**：现有 `audio.ts` 由 Gait 事件驱动（`gait.steps` / `gait.landings`），这是正确做法——**必须保持事件驱动，不要改为定时器**。变体序列 `[0,3,1,4,2]` 已避免机械重复。

### 6.2 新增动作音效

| ID | 声音 | 说明 |
|---|---|---|
| `step_jump` | 起跳蹬地 | 短促、有弹性，比脚步轻 |
| `step_land` | 落地 | 比脚步重，带轻微冲击尾 |
| `step_stair_up` / `step_stair_down` | 上下楼梯〔TBD〕 | 若游戏有楼梯需提供 |
| `cloth_rustle` | 衣物摩擦〔TBD〕 | 奔跑/急停时，可选 |

---

## 7. 其余系统音频（任务书 6-11 项）

### 7.1 UI 与设备（对应任务书第 6、7 项）

| ID | 声音 | 类型 | 说明 |
|---|---|---|---|
| `ui_hover` / `ui_click` | 界面悬停/点击 | 合成 | 已有 `select` 可复用 |
| `ui_confirm` / `ui_cancel` | 确认/取消 | 合成 | 音高区分（上行/下行） |
| `ui_error` | 错误/失败 | 合成 | 不谐和短音 |
| `macbook_open` / `macbook_close` | MacBook 开合 | 合成/授权 | 电子设备和铰链感 |
| `macbook_type` | 键盘输入 | 合成 | 轻脆，短促 |
| `agent_status` | AI Agent 状态提示 | 合成 | 与 `sfx_ai_boot` 同源但更轻 |
| `bag_open` / `bag_close` | 背包 | ✅ 已有 | 保持 |
| `decrypt_tick` / `decrypt_success` / `decrypt_fail` | 电脑解密过程/成功/失败 | 合成 | 进度音阶上行；成功有解决感 |
| `supercomputer_hum` | 超级计算机运转 | 合成/授权 | 循环，低频 + 风扇 |
| `power_switch` / `power_surge` | 电源开关/涌流 | 合成 | 备用电源系统 |

### 7.2 Boss 战 — 巨型机械狮（对应任务书第 8 项，Scene 05〔TBD〕）

| ID | 声音 | 说明 |
|---|---|---|
| `boss_roar` | 机械狮吼叫 | 金属质感的低频咆哮，非生物吼叫 |
| `boss_servo` | 关节运动 | 大型伺服，比小机器人沉重 |
| `boss_footstep` | 重型踏步 | 地面震动感 |
| `boss_attack_windup` / `boss_attack_hit` | 攻击前摇/命中 | 前摇给玩家反应时间（听觉预警） |
| `boss_damage` | 受击 | 金属损伤 |
| `boss_defeat` | 击败 | 崩解 + 音乐解决 |
| `mus_boss` | Boss 战配乐 | 重型打击 + 铜管式合成 |

### 7.3 篮球馆解谜与学生获救（对应任务书第 9 项，Scene 06〔TBD〕）

| ID | 声音 | 说明 |
|---|---|---|
| `gym_ambience` | 篮球馆空间感 | 大空间混响、回声 |
| `bounce_ball` | 篮球弹地〔TBD 具体谜题待确认〕 | 若谜题涉及篮球 |
| `student_free` | 学生获救 | 如释重负的音效 + 短促人声反应（非对白） |
| `mus_relief` | 获救音乐 | 希望主题的第一次完整呈现 |

### 7.4 灯光秀与结尾（对应任务书第 10 项，Scene 07-08〔TBD〕）

| ID | 声音 | 说明 |
|---|---|---|
| `sfx_lightshow_sweep` | 灯光扫过 | 上扬扫频 + 闪烁音 |
| `sfx_crowd_cheer` | 人群欢呼 | 授权素材，无具体词句 |
| `mus_hope` | 结尾音乐 | 大调、开阔、释然 |
| `amb_restored` | 恢复后的校园 | 回归 Scene 02 的明亮音景，但更温暖 |

---

## 8. 混音规范（缺失规格，按专业标准补齐）

### 8.1 技术规格

| 项 | 规格 |
|---|---|
| 采样率 | 44100 Hz（音乐/环境）/ 22050 Hz 可用于短 UI 音效 |
| 位深 | 16-bit PCM WAV |
| 声道 | 环境/音乐立体声，UI/交互单声道，空间化音效单声道（由引擎 PannerNode 处理） |
| 峰值 | 单文件 ≤ -1.0 dBFS（留 1 dB 余量），最终混音 ≤ -1.0 dBFS |
| 响度 | 目标 -18 LUFS（游戏混音常用），对话/关键警报突出 2-3 LU |
| 循环点 | 无咔哒：首尾各 50ms 淡入淡出，或无缝 crossfade（环境层 3s overlap） |
| 命名 | `{类别}_{对象}_{动作}[_{变体}]`，如 `robot_servo_loop.wav`、`step_paving_0.wav` |

### 8.2 总线结构（与现有 `audio.ts` 对齐）

现有总线：`master` → `ambient` / `steps` / `ui` / `music`（+ 新增 `opening` 子总线）。
建议新增：
- `sfx` 总线（剧情/机器人/Boss 音效），介于 ambient 与 ui 之间
- `music` 下增加子层 gain（各 stem 独立控制，便于 crossfade）

### 8.3 频段分配（避免遮蔽）

| 总线 | 主要频段 | 说明 |
|---|---|---|
| ambient | 20 Hz - 8 kHz | 底噪，低频为主，高频供鸟鸣 |
| music | 80 Hz - 12 kHz | 中频旋律区优先 |
| sfx（机器人/Boss） | 40 Hz - 10 kHz | 与 music 竞争时 ducking |
| steps | 100 Hz - 6 kHz | 短促，瞬态 |
| ui | 400 Hz - 8 kHz | 高频，确保可辨 |

### 8.4 Ducking 规则

- 关键警报（`robot_lockon`、`sfx_veil_seal`）触发时：music -6 dB、ambient -4 dB，持续 0.8s 后 1.5s 恢复。
- 追逐状态：music(chase) 提升 2 dB，ambient 降低 3 dB。
- 剧情演出（Scene 03）：演出音效触发时 music 完全让路（淡出）。

---

## 9. 触发配置与接口契约（给 Codex）

### 9.1 配置文件格式

交付 `audio-triggers.json`（本批次产出），结构：

```json
{
  "version": "0.1",
  "buses": ["master","ambient","sfx","steps","ui","music"],
  "cues": [
    {
      "id": "robot_lockon",
      "file": "robot_lockon.wav",
      "bus": "sfx",
      "spatial": true,
      "loop": false,
      "gain": 0.9,
      "priority": "high",
      "duck": {"music": -6, "ambient": -4, "durationMs": 800, "recoverMs": 1500},
      "trigger": "robot.state == 'locked'"
    }
  ],
  "musicLayers": {
    "safe": {"file":"mus_safe.wav","bpm":72,"bars":16},
    "unease": {"file":"mus_unease.wav","bpm":70,"bars":16}
  }
}
```

### 9.2 状态机接口（音频侧需要的事件）

| 事件 | 来源 | 音频响应 |
|---|---|---|
| `scene.enter` / `scene.exit` | 场景管理 | 切换 ambient 层、music 层 |
| `robot.state` (patrol/scan/lock/chase/search) | 机器人 AI | 播放对应音效、切换音乐层 |
| `player.gait` (steps/landings/speed/surface) | Gait 系统 | 脚步/落地音（已实现，保持） |
| `story.beat` (veil/anomaly/ai_boot/...) | 剧情状态机 | 触发 Scene 03 演出时间线 |
| `ui.action` (click/confirm/error/...) | UI | UI 音效 |
| `zone.enter` (indoor/outdoor/bus) | 区域检测 | 声学 EQ 切换 |

### 9.3 关键实现约束

1. 空间化用 `PannerNode`（equalpower, inverse, refDistance 2, rolloff 0.6）——与现有 `audio.ts` 一致。
2. 音乐 stem 必须**同调性同 BPM**，才能无缝 crossfade。
3. 资源加载走现有 `CampusAudio` 的 `audioUrls` 注册机制；新增文件需注册到该表（Codex 负责）。
4. 并发音效上限 16（现有实现），机器人多时需注意优先级抢占。

---

## 10. 交付清单与本批次产出

### 10.1 本批次（v0.1）交付物

| 交付物 | 路径 | 状态 |
|---|---|---|
| 本 ADS 文档 | `audio-out/docs/ADS-Audio-Design.md` | ✅ 完成 |
| 程序合成音效（48） | `audio-out/synth/sfx/` | ✅ 完成（3.1 MB） |
| 分层音乐 stem（6） | `audio-out/synth/music/` | ✅ 完成（6.7 MB，72 BPM 同调性） |
| CC0 授权素材（9 处理 + 33 原始） | `audio-out/cc0/` | ✅ 完成（39 MB，见 MANIFEST.md） |
| 触发配置表 | `audio-out/audio-triggers.json` | ✅ 完成（57 cues + 6 layers + Scene03 cue sheet） |
| 客观核验报告 | `audio-out/docs/QA-Report.json` | ✅ 通过（63 WAV，零问题） |
| 交付说明 | `audio-out/docs/README.md` | ✅ 完成 |

### 10.2 优先级排序（建议 Codex 接入顺序）

1. **P0 — 动作音效修复**：脚步节奏、落地、跳跃（任务书明确高优先级）
2. **P0 — Scene 03 转折演出**：八阶段 cue sheet（核心情绪转折）
3. **P1 — 机器人音效 + 分层音乐**：追逐体验的核心
4. **P1 — 环境音分层系统**：Scene 02 的空间层次
5. **P2 — UI/剧情/Boss/结尾**：其余系统

### 10.3 未验证项（必须如实说明）

- **主观试听未验证**：当前工具不支持音频输入，我无法主观辨听音色/情绪是否达标。所有数值检查（峰值/RMS/时长/格式）不能替代人耳验收。**需用户直接播放验收。**
- 授权素材的主观质量、是否"像校园"需用户判断。
- Scene 05-08 细节为推断，需任务书补全后复核。
- 游戏内实际触发效果需 Codex 接入后在浏览器验收。

---

**文档结束 · v0.1** · 所有 `〔TBD〕` 项待任务书补全或 Codex 确认后更新。
