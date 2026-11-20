# 开场音频接入 · 2026-11-19

WorkBuddy 的音频交付已接入当前开场。运行 `npm run play`，打开
http://127.0.0.1:5184/，在 **Settings & save** 中调整音量、试听或重试加载。
新开场音乐默认 20%；旧存档保留原音量，原来为 0% 的音乐需要手动调高。

## 资产与实现范围

- `assets/audio/story/`：原交付的 63 个 WAV，加上从交付内 StarNinjas
  CC0 压缩包提取的一个关门 OGG。保留原采样率和文件内容，没有引入 raw ZIP。
- `IMPORT.json`：64 个文件的 SHA-256；`SOURCES.md`：随交付保留的作者、来源、许可和处理说明。
- `audio-triggers.json` 和 `docs/audio/source/`：原始设计配置和文档快照。
- `src/gameplay/storyAudio.ts`：当前游戏的实际接入，以这里和本说明为准。

开场启用 31 个新素材，加上原有 17 个素材，共预载 48 个。Boss、体育馆、
灯光秀等未来场景的素材保留在资产注册表中，当前关卡不预载、不触发。
普通构建会输出这些静态资产；大体积原始压缩包和研究材料不进入运行包。

## 当前触发

| 游戏事件 / 状态 | 声音 |
|---|---|
| 巴士阶段 | 引擎循环、safe 音乐；车门开启播放真实关门录音替代反馈 |
| 白天校园 | 现有校园风声 + 新鸟鸣，safe 音乐 |
| 取到电脑、异常前奏 | unease 音乐；低频异常、glitch、AI boot、扩散音 |
| 帷幕降下 | descend；在现有 4.6 秒帷幕动画完成时 seal，并压低环境和音乐 |
| 封锁后 | dark hum + tension 音乐 |
| 实际机器人扫描 / 锁定 / 追逐 | 空间化扫描、锁定、机械循环；实际移动距离触发脚步 |
| 任一机器人实际追逐 | chase 音乐，进入 0.5 秒、退出 4 秒交叉淡化 |
| 被捕 / 恢复检查点 | capture / safe restore；作为反馈可在暂停面板中播完 |
| 玩家起跳 / 落地 | 起跳上升沿、独立落地音；落地与脚步同帧只播一次 |
| 请柬 / MacBook 开关 | 对应界面音，跟随界面音量 |
| 到达当前开场终点 | hope 音乐；不表示未来完整结局已实现 |

原设计稿 Scene 03 的 13.5 秒时间线没有直接强加给现有游戏。
异常前奏相对当前 disturbance 事件分别在 0 / 0.5 / 1.4 / 2.4 秒播放，
curtain 事件开始新的 4.6 秒时间线。玩家提前触发帷幕时，未播的前奏被替换。
这与现有剧情和视觉时序一致。存档恢复到封锁阶段时直接恢复状态音，不重播演出。

## 混音与生命周期

复用唯一的 `CampusAudio` 和 AudioContext。新增 sfx 音量，保留 ambient /
steps / ui / music 及总静音；被捕反馈仍受 sfx 和总静音控制。
开场不再并行播放旧的程序化黑暗氛围和固定周期扫描、追逐提示。

音乐使用共同的 AudioContext 时基，以当前循环相位进入目标 stem。
循环最多 8 个，与瞬时音效共用 16 个声部预算；仅最近的两台、24 米内机器人
拥有空间声音，脚步限 16 米。Panner 使用 equalpower / inverse / 2 m / 0.6。
静止、暂停或位置重置不产生机器人脚步。

暂停立即释放循环并停止剧情音，待播时间线冻结；恢复按当前状态重建循环，
不会重播已触发的演出。切后台停止所有瞬时音、取消试听并挂起 AudioContext。
重开、恢复、关闭设置和 dispose 各自清理所拥有的节点 / 待播事件。
加载失败可以重试，仅请求缺失文件。音效失败不阻塞游戏。

总静音立即写入 AudioParam 的值；已暂停的 AudioContext 不能依靠渐变或等待
渲染时钟来更新静音状态。其他运行中的音量调整仍保留平滑变化。

## 验证与复现

已执行 `npm ci --cache /tmp/hku-campus-npm-cache`、`npm run check:all`、
`npm run check:opening`、`npm run scene:catalog`。最后音频修复之后再次通过
`npm run check:audio-review` 和 `npm run build`。本次没有修改几何。

```sh
# 重新导入原始交付（参数是现有 audio-out 目录）
python3 scripts/audio/import-pack.py /absolute/path/to/audio-out
python3 scripts/audio/qa_check.py
npm run check:audio-review
```

原合成脚本已改为仓库路径，可分别执行 `scripts/audio/gen_sfx.py`、
`scripts/audio/gen_music.py`。生成后需重新 QA，并刷新对应资产哈希；
`IMPORT.json` 记录的是导入交付时的文件内容。

浏览器采用 ego-browser，在游戏页先点击试听启用音频，然后：

```js
const {verifyAudio} = await import('/absolute/project/scripts/audio/browser-qa.mjs');
await verifyAudio(page, '/absolute/project/evidence/audio-integration');
```

- `docs/audio/QA-Assets.json`：63 个 WAV 的格式、峰值、RMS、削波检查。
- `evidence/audio-integration/browser-decode.json`：真实 Chromium 解码全部 64 个素材，
  零失败；22050 / 44000 / 44100 / 48000 Hz 被重采样到测试上下文的 48000 Hz。
- `browser-mix.json` / `opening-mix-preview.wav`：实际 CampusAudio 混音从
  recordingStream 录制，经 Opus 解码为试听 WAV；包括剧情、机器人、动作和暂停恢复。
  报告只验证该测试混音和默认增益，不代表所有可能组合的峰值保证。
- `ui.json` / `settings.png`：音乐滑块、暂停中试听、总静音和关闭面板的验证。
  验证后恢复原音量和静音设置，不推进玩家和剧情。

客观解码和数值检查不替代音色、情绪、循环听感的人耳验收。
