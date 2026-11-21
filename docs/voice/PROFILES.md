# NPC voice profile system

## 文件

- `content/voice/profiles.json` — 所有 NPC 的 voice profile；Staff 为 `generated`，Michael / Ruibang / Lam 为 `planned`，玩家接受句为 `existing-local-synth`。
- `content/voice/staff-dialogue.ts` — Staff 的共享台词；UI 字幕和音频 manifest 都从这里取值。
- `content/voice/planned-dialogue.json` — Michael / Ruibang / Lam 的原始中文台词清单与生成顺序；英文改编未确认前 `english` 保持 `null`。
- `assets/audio/npc/staff/clips.json` — 每条 Staff 对白的文件、时长、边界、SHA-256、RMS/peak。
- `src/opening/voice.ts` — 固定对白播放器；只在本地加载 bundled WAV。
- `src/gameplay/audio.ts` — `playVoice` 与 `setDialogueDuck`；共用现有 mixer、mute、SFX 音量和 16 voice 预算。

## 每个 profile 至少包含

| 字段 | 说明 |
| --- | --- |
| `npcId` | 稳定 NPC ID，与场景/角色卡一致 |
| `displayName` | 角色名 |
| `provider` / `model` / `modelKey` | 生成平台和模型 |
| `voiceId` / `voiceName` | 平台稳定声音标识 |
| `language` / `accent` / `age` / `descriptive` | 声音元数据 |
| `stability` | 模型支持的正式参数；不改语速/音高 |
| `style` | 给下一轮生成用的角色声线描述 |
| `status` | `generated` / `planned` / `existing-local-synth` |
| `sourceFile` / `sourceFileHash` | 原始 take 和内容哈希 |
| `clipManifest` / `clips` | 对白 ID → 文件、时长、哈希 |
| `blockedBy` | 未生成时的真实原因 |

## 一致性规则

1. 同一 NPC 的所有场景复用同一个 `voiceId` + `stability` + language；不要按句子换声线。
2. 需要情绪变化时，优先用台词、标点和 v3 支持的正式参数；不要对音频做过度变速。
3. 每条对白有稳定 `dialogueId`（如 `staff.act1.line1`）和文件 SHA-256；文字/模型/声音/稳定性未变时复用缓存，不重新生成。
4. 不克隆真人声音；不使用未授权声音。
5. 游戏运行时只读 bundled 文件；不调用 DaVinci/ElevenLabs 在线接口。
6. 缺失音频时保留字幕和任务；`voice.play*` 失败只回调 `onError`，不阻塞 `transition`。
7. 关闭面板、失焦、pagehide、移动离开、重新开始都会 `voice.stop()`；不会重复排队。

## 新增一个 NPC 的最小步骤

1. 在 `content/voice/profiles.json` 加 profile，先设 `status: planned`，写清 `style` 和推荐 `voiceId`。
2. 确认 DaVinci 账号剩余免费额度；没有额度就停在 planned，不调用付费接口。
3. 生成一条短 take；用 `scripts/audio/split-staff-take.py` 同类方法按 word timestamps 拆句；写 `clips.json`。
4. 在 `src/opening/voice.ts` 的 URL 表加 clip；如果是新 NPC，新建一个和 `VoiceSequencePlayer` 类似的 profile player 或把 items 参数化。
5. 在 UI/剧情里接 `onItem` 字幕、`onDone` 任务推进、`stop()` 跳过；不要直接 `audio.play` 固定对白。
6. 跑 `npm run check:voice`、相关剧情检查、`npm run build`，并在浏览器实际试听/看字幕。
