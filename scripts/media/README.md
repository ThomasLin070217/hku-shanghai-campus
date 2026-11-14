# 本地实录素材整理

从项目根目录运行，Python 3 + Pillow + imageio-ffmpeg；转写额外需要支持 Metal 的 Apple Silicon macOS、mlx-whisper、numpy。本轮使用独立临时 Python 环境，没有加入网页运行依赖。

```sh
python scripts/media/extract-campus-videos.py /你的/视频目录
python scripts/media/transcribe-campus-videos.py
python scripts/media/catalog-campus-videos.py
```

输入 IMG_4347.MOV、IMG_4348.MOV、IMG_4349.MOV。输出 `references/video-followup/`，临时16k单声道转写副本在已忽略的 `work/video-followup/`。抽帧和音轨提取不会修改源视频；这三个脚本会覆盖本轮同名派生文件，审核后再运行。原声 M4A 使用 `-c:a copy`，转写 WAV 不作为原声交付。

首次转写需要下载公开 Whisper 模型权重；音频推理在本机进行，不上传录音。可用 `HF_HOME` 指定已有缓存。运行顺序不可倒置。转写保留机器原稿，不自动替换可疑词。HDR 转 SDR 与 U07 的方向校正逻辑已固定，仅适用于本轮三段视频。
