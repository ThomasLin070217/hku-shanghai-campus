# DaVinci AI NPC voice report · Act 1 Staff

日期：2026-11-21 · 账号：Thomas · 页面：<https://davinci.ai/app/voice/voices>

## 1. 先说结论

- 当前账号没有付费计划（`No active plan`），免费额度为 **Audio 1/1**；Video / Photo / Music 各 1/1。
- 语音页当前只有 **ElevenLabs TTS V3** 一个 voiceover 模型：`key = eleven-v3`，上游 `fal-ai/elevenlabs/tts/eleven-v3`，标价 `25 base credits`。
- 没有找到 DaVinci 官方公开的语音生成 API 文档；本轮只使用已登录网页的正常 UI，没有调用未公开接口、没有充值、没有升级、没有购买 credits、没有克隆真人声音。
- 一次免费语音生成已经用掉，账号页面随后显示 **Audio 0/1**。因此本轮没有重试、没有换声音试听，也没有为 Michael / Ruibang / Lam 生成音频。
- 已生成 Staff 的五句英文，并拆成五个游戏内固定音频。游戏运行时不调用在线 TTS。
- 玩家接受句也从旧的 macOS Samantha 换成了本地 Piper 神经声线 Kristin（不是 DaVinci，因为 Audio 0/1）；生成句为 “Yeah, I'll collect it.”，可在 evidence 页面试听和对比其他本地声线（Kristin 为当前，Bryce/Amy/Lessac/Ryan 为备选）。

## 2. 生成前检查

| 项目 | 结果 |
| --- | --- |
| 登录状态 | 通过 Google SSO 正常进入已登录账号 |
| 计划 | `No active plan` |
| 免费额度 | Audio `1/1`，Video `1/1`，Photo `1/1`，Music `1/1` |
| 可选语音模型 | ElevenLabs TTS V3（唯一 voiceover 模型） |
| 模型标价 | 25 base credits / 次（账号无付费计划，本轮未扣付费 credits） |
| 稳定性参数 | 支持，0–100%，本轮 40% |
| 风格 prompt | UI 没有单独的 style prompt 字段；只有 Voice / Language / Stability。风格通过角色描述、标点、换行和声音元数据控制，没有伪造不存在的参数 |
| 公开 API | 未发现官方公开文档。公开前端 bundle 里能看到 `/voice/process` 的字段 `modelKey/text/voice/stability/languageCode`；仅用于能力说明，**没有直接调用**，生成全程走正常网页按钮 |
| 免费额度是否够试多个声音 | 否。只有 1 次音频生成，所以把五句合并成一条 take，再本地拆分 |

DaVinci 帮助中心说明新账号“前三次生成请求免费”，但本账号实际 UI 按类别给出 Audio 1/1。以账号页面实际显示为准，不假设有更多次数。

## 3. 本轮声音

| 字段 | 值 |
| --- | --- |
| Provider | DaVinci AI |
| Model | ElevenLabs TTS V3 (`eleven-v3`) |
| Voice | Asher |
| Voice ID | `tMvyQtpCVQ0DkixuYm6J` |
| 语言 / 口音 | English / American |
| 年龄感 / 描述 | Middle Aged / Casual |
| Stability | 0.40 |
| 使用场景 | 第一幕 Building 5 Dinner coordinator（Staff） |
| 角色设定 | 25–40 岁 HKU 校园工作人员，自然、友好、略微赶时间，不是播音员 |

候选声音（只读平台元数据，未逐个生成）：

| 声音 | 年龄感 | 描述 | 本轮判断 |
| --- | --- | --- | --- |
| **Asher** | Middle Aged | Casual | 选用；最接近自然、略赶时间的 staff |
| Josh | Young | Pleasant | 备选；可能更年轻、更轻快 |
| Jon | Middle Aged | Calm | 备选；偏稳，可能少一点赶时间感 |
| Kim | Middle Aged | Pleasant | 备选；女声版本 |
| Brian | Young | Gentle | 备选；偏柔，可能不够利落 |
| Adam | Middle Aged | Calm | 未选；容易偏旁白/播音 |

选择 Asher 的原因：在免费额度只有一次的前提下，需要一个偏 conversational、不过度播音腔的男声；Asher 的 Casual 描述最接近“friendly university staff, slightly rushed but warm”。这是基于平台声音元数据和风格描述的选择，不是多声音试听后的主观排名。

## 4. 实际请求与结果

- 请求时间：2026-11-21 14:22–14:25（Asia/Shanghai）
- 文本：五句合并，段落之间留空行；第一幕正式三句 + 接受后的 thanks + 再次询问
- 生成结果：1 条 MP3，21.159 s，128 kbps，44.1 kHz mono
- 输出源文件：`assets/audio/npc/staff/source/staff-take1.mp3`
- 输出 SHA-256：`d35a56117b1f5ede530f630a0d9f787114f2ac481bf78b1aaf105cad041218c4`
- take 内容哈希：`f01f8876bf96fb8f719d132d8330e3ebab74e89d285548acb729546a71df7578`
- 生成后额度：Audio `0/1`；Video/Photo/Music 未变
- 付费 credits：0；没有出现付费确认
- 是否重试：否。生成完成后立即下载并保存，避免额度和结果丢失。

生成后页面弹出 “Free limit reached 0 left” 的升级弹窗；没有点击任何购买/升级按钮，只用右上角关闭按钮关掉弹窗，然后从 Creations 的详情页保存音频。

## 5. 生成的五句

| ID | 文本 | 时长 |
| --- | --- | --- |
| `staff-line1` | Hey — you're one of the Student Ambassadors, right? | 2.55 s |
| `staff-line2` | Could you do me a quick favour? We need the presentation MacBook from Building 6 for tonight's dinner. | 5.76 s |
| `staff-line3` | It's on the office table. Mind picking it up? We're running a bit behind. | 4.65 s |
| `staff-line4` | Perfect, thanks! Just bring it back here when you've got it. | 3.33 s |
| `staff-line5` | Hey — any luck with that laptop? | 2.11 s |

拆分依据不是按字数猜，而是用本地 Vosk 英文小模型对整条 MP3 做 word-level 时间戳，取相邻句之间的停顿中点。每个 clip 的边界、SHA-256、RMS/peak 都在 `assets/audio/npc/staff/clips.json`。五个 clip 又分别做了一次本地转写，文本与上表一致。

## 6. 技术验证

可试听页面：`evidence/voice/index.html`（开发服务器打开 `http://127.0.0.1:5184/evidence/voice/index.html`）。页面包含两次实际游戏混音录音、五张字幕截图和 trace 摘要。

最终一次 20.58 s 的游戏内录音 trace（Staff = DaVinci Asher；玩家句 = 本地 Piper Kristin）：

| 时间 | Staff line | 字幕 | npc-voice | 任务 / 混音 |
| --- | --- | --- | --- | --- |
| 0.0 s | 0 | Hey — you're one of the Student Ambassadors, right? | 1 | `to_b5`；music duck 0.085 |
| 2.4 s | 1 | Could you do me a quick favour? … | 2 | `to_b5`；duck 0.084 |
| 8.4 s | 2 | It's on the office table. Mind picking it up? … | 3 | `to_b5`；duck 0.084 |
| ~13.2 s | 2 | objective banner | 0 | `to_b6`；duck 回到 0.2 |
| 13.8 s | 2 | YOU — Yeah, I'll collect it. | 4 | accepted；duck 0.108 → 0.084 |
| 15.0–18.6 s | 2 | COORDINATOR — Perfect, thanks! … | 5 | accepted；duck 0.084 → 0.2 |

重复询问单独录音 3.0 s：目标 `opening-staff-repeat`，字幕 `COORDINATOR — Hey — any luck with that laptop?`，`npc-voice` 6。



已经在浏览器里实际运行游戏并检查：

- Staff 初次接近时，cinematic 字幕依次显示 line1 → line2 → line3；
- `npc-voice` 计数从 1 → 2 → 3，说明三个 clip 按顺序播放；
- Staff 三句结束后进入 `to_b6`，显示 objective，随后播放玩家接受句 + Staff 的 “Perfect, thanks!”；
- 玩家接受句和 thanks 的字幕与音频对应，`npc-voice` 计数最终为 5；
- 玩家回到 Staff 附近时，出现 “Ask the coordinator about the laptop”，播放 line5，字幕为 “COORDINATOR — Hey — any luck with that laptop?”；
- 语音播放时 music/ambient 被 duck 到约 42%，结束后恢复；
- 触发 blur / 关闭 / 跳过时，当前 voice source 立即停止（activeShots 归 0），不会继续排队播放；
- 所有音频是 bundled WAV，游戏运行时不请求 DaVinci 或 ElevenLabs。
- 缺失音频测试：用页面测试钩子拒绝 5 个 `staff-line*.wav` 的 fetch，字幕仍按 0→1→2 推进，约 17 s 后 `to_b6` 完成，`npc-voice` 为 0，任务不被阻塞。

对应截图和记录在 `evidence/voice/`（本轮新增）。脚本：`npm run check:voice` 检查 manifest、WAV 头、时长、哈希、文本一致性和额度记录。

## 7. 主观试听边界

本 Agent 的输入通道不能听音频，因此**没有**完成“人耳主观试听通过”的结论。已经做的是：

- 本地离线转写（Vosk）确认五句都完整、没有被截断；
- 检查 WAV 头、时长、峰值和 RMS；
- 在浏览器里确认播放、字幕、ducking、停止和任务状态；
- 保存了原始 MP3 和五个 WAV，供团队用正常耳机/音箱试听。

建议人工试听顺序：`assets/audio/npc/staff/staff-line1.wav` → line2 → line3 → line4 → line5，或直接听 `source/staff-take1.mp3`。如果人耳认为 Asher 太成熟/太年轻/太慢，本轮已经没有免费 Audio 额度，不应偷偷重试；应在下一轮先确认额度，再决定是否换声音。

## 8. 玩家接受句的补充修复

原 `player-accept-english.wav` 是 macOS Samantha，保留为历史文件，但游戏已不再加载。新的玩家句：

| 字段 | 值 |
| --- | --- |
| 文本 | Yeah, I'll collect it. |
| Provider | Piper（本地神经 TTS，不是 DaVinci） |
| Model / voice | `en_US-kristin-medium`，Kristin |
| 参数 | length_scale 1.0；峰值归一化到 -3 dBFS |
| 时长 | 1.37 s；22.05 kHz mono |
| 许可 | public-domain LibriVox-derived Piper voice；没有克隆未授权真人，也没有付费调用 |
| 文件 | `assets/audio/npc/player/player-accept-kristin.wav` |

选 Kristin 的原因：原玩家句是女声 Samantha，保留女声连续性；Kristin 的 model card 写明训练语料来自 LibriVox、许可为 public domain，比 Amy（Cori Samuel 的 Hi-Fi TTS 声线）在“未授权真人克隆”上更稳妥。Staff 已经是 DaVinci 男声 Asher，玩家女声也形成清晰区分。

## 9. 未完成与下一步

- Michael Zhang、Ruibang、Lam：已在 `content/voice/profiles.json` 建立 planned profile，包含推荐声音方向、稳定性和风格；原始中文台词清单在 `content/voice/planned-dialogue.json`，共 8 + 11 + 12 条，英文改编仍待确认。没有生成音频。原因：Audio 0/1，且本轮禁止付费。
- 背景 guest/student：没有正式对白，不新增配音，避免给背景 NPC 编造剧情。
- 若下一轮获得新的免费额度，建议顺序：Michael 的 firstMeeting → assignment → repeat；Ruibang 的 firstMeeting/hint；Lam 的 firstMeeting/status。每条先生成 1 句试听，确认后再批量。
- 玩家接受句也不再使用旧的 macOS Samantha。因为 DaVinci Audio 已是 0/1，本轮改用**本地 Piper 神经 TTS** 重新生成 `Yeah, I'll collect it.`（`en_US-kristin-medium`，public-domain LibriVox voice，length_scale 1.0）。这不是 DaVinci 结果，也不是付费 API；profile 中标记为 `generated-local-neural`，与 Staff 的 DaVinci 声音明确区分。若下一轮拿到 DaVinci 免费额度，可以再把玩家句换成 DaVinci 声线。

## 10. 复现与文件

- 生成请求：`work/voice-generation/generation-request.json`
- 生成日志：`work/voice-generation/generation-log.json`（同时复制到 `assets/audio/npc/staff/source/`）
- 拆分脚本：`scripts/audio/split-staff-take.py`
- 音频清单：`assets/audio/npc/staff/clips.json`
- Voice profiles：`content/voice/profiles.json`
- 共享台词：`content/voice/staff-dialogue.ts`
- 玩家句：`assets/audio/npc/player/`、`scripts/audio/prepare-player-voice.py`
- 运行时：`src/opening/voice.ts`
- 接入：`src/opening/experience.ts`
- 混音：`src/gameplay/audio.ts` 的 `playVoice` / `setDialogueDuck`
