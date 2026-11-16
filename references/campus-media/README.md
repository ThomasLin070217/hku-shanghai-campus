# 校园实拍素材库

- [浏览素材](index.html) · [下一轮补拍清单](CAPTURE.md) · [机器可读清单](manifest.json)
- 2026-11-16 新增 6 张室内及夜景照片，见[照片与场景更新](UPDATE-20261116.md)。
- 首批为 2026-11-15 提供的 6 段视频、3 张校园照片和 1 张讨论背景截图。6 段原片均保留收音，说明基于画面，尚未逐句核对口述。
- `2026-11-15/originals/` 保存逐字节核验过的原件。`previews/` 为浏览用缩略图，`frames/` 内的文件名时间用毫秒表示。保留原件的 EXIF、容器和音轨，派生图仅作取景预览。
- 索引使用 `YYYYMMDD-Vnn`、`YYYYMMDD-Pnn`、`YYYYMMDD-Cnn` 稳定 ID。建模说明可引用 `素材 ID + 时间戳`，例如 `20261115-V01 @ 00:05.2`。知道确切场景编号后再补 `sceneIds`，确认地点后再更新 `location`。
- 新一批在新日期目录增加原件和预览，按已有字段向 `manifest.json` 追加条目。确认画面内容、时间戳和待核项后，从仓库根目录运行 `python3 scripts/media/render-campus-media.py`。它核对原件 SHA‑256、文件大小、索引 ID 和帧的时间范围，再生成浏览页。已引用的 ID 和路径应保留。
- 素材页可在仓库里直接打开，或用开发服务器访问 `/references/campus-media/index.html`。团队验收包 `npm run build:review` 包含素材库。普通运行包沿用现有配置，只带运行资源。
