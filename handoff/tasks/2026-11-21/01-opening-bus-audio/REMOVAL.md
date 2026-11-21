# 2026-11-21 追加决定：删除打开请柬的急促纸张声

Owner 在试听后确认：打开请柬时那声 **0.42 s 的急促纸张抖动**没有叙事价值，删除。以下是当前工作区已做的改动；如果你拿到的基线早于这条改动，先应用它，再开始巴士音效任务。

## 已改动

1. `src/opening/experience.ts` 的 `open()`：删掉
   ```ts
   if (next === 'invitation') audio.story?.cue('invitation_open', undefined, true);
   ```
   打开请柬现在**不播放任何 cue**；合上仍保留 `invitation_close`。
2. `src/opening/audioAssets.ts`：从 `OPENING_FOLEY` 删掉 `invitation_open` 的 URL 覆盖。
3. `src/gameplay/storyAudio.ts`：从 `OPENING_AUDIO_NAMES` 删掉 `'invitation_open'`，不再预加载这个 0.2 s 的 synth 版本。
4. 删除 `assets/audio/opening-foley/invitation-open.wav`（18,566 B）。
5. `scripts/audio/refine-opening-foley.py`：删掉 `paper` 生成段，文件数 13 → 12。
6. `scripts/check-story-audio.ts`：断言改为“不得请求 `/invitation-open.wav`”；请求数常量保持不变（URL 键本来就被覆盖，不是新增键）。

## 已验证

- `npm run typecheck` PASS
- `npm run check:audio-review` PASS（含 `check-story-audio`）
- `npm run check:opening` PASS
- 浏览器/headless：打开请柬后 `buffers.has('invitation_open') === false`、`counts.invitation_open === 0`，`modal === 'invitation'` 正常出现；没有 404，`failedFiles` 为空。

## 边界

- 不要恢复这个声音；如果未来要做纸张细节，只做“合上/翻页”的克制版本，不要快速抖动/短促“唰”声。
- 不要删除 `invitation_close`（合上仍有声音）。
- `assets/audio/story/synth/sfx/invitation_open.wav` 仍保留为通用素材，但开场不再加载；其他章节若要用，需单独评估。
