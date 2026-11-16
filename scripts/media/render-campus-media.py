"""Verify the local campus media inventory and render its browsing page."""
from hashlib import file_digest
from html import escape
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'references' / 'campus-media'
KINDS = {'photo': '照片', 'video': '视频', 'context': '讨论背景'}


def local_file(relative):
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f'Missing library file: {relative}')
    return path


def timecode(seconds):
    minutes, seconds = divmod(seconds, 60)
    return f'{int(minutes):02d}:{seconds:04.1f}'


def render_card(item):
    media = local_file(item['original'])
    local_file(item['preview'])
    with media.open('rb') as stream:
        digest = file_digest(stream, 'sha256').hexdigest()
    if media.stat().st_size != item['bytes'] or digest != item['sha256']:
        raise ValueError(f"Original changed: {item['id']}")

    kind = item['kind']
    item_id = escape(item['id'])
    title = escape(item['title'])
    original = escape(item['original'])
    thumb = escape(item['preview'])
    tags = ' · '.join(escape(tag) for tag in item['tags'])
    evidence = escape(item['evidence'])
    limits = escape(item['limitations'])
    models = ', '.join(escape(model) for model in item['modelRefs'])
    meta = ' · '.join(part for part in (item_id, KINDS[kind], tags) if part)
    scene_ids = ', '.join(escape(scene_id) for scene_id in item['sceneIds'])
    refs = ' · '.join(part for part in (f'场景 <code>{scene_ids}</code>' if scene_ids else '',
                                     f'模型 <code>{models}</code>' if models else '') if part)
    model_line = f'<p class="meta">{refs}</p>' if refs else ''
    frame_list = ''

    if kind == 'video':
        meta += ' · ' + timecode(item['durationSeconds'])
        caption = '播放原片（含现场收音）' if item['hasOriginalAudio'] else '播放原片'
        cover_link = item['featuredFrame']
        frames = []
        for frame in item['frames']:
            path = escape(frame['path'])
            label = escape(frame['label'])
            seconds = frame['seconds']
            if not 0 <= seconds < item['durationSeconds']:
                raise ValueError(f"Invalid frame time: {item['id']} {seconds}")
            local_file(frame['path'])
            frames.append(f'<li><a href="{path}">{timecode(seconds)} {label}</a> '
                          f'<a href="{original}#t={seconds:g}">跳到原片</a></li>')
        local_file(cover_link)
        frame_list = '<details><summary>查看关键帧和时间戳</summary><ul>' + ''.join(frames) + '</ul></details>'
    else:
        caption = '打开原图'
        cover_link = item['original']

    return f"""<article id="{item_id}" data-kind="{kind}">
<a class="cover" href="{escape(cover_link)}"><img src="{thumb}" alt="{title}" loading="lazy"></a>
<div class="info"><p class="meta">{meta}</p><h3>{title}</h3>
<p>{evidence}</p><p class="limits">{limits}</p>{model_line}
<p><a href="{original}">{caption}</a></p>{frame_list}</div>
</article>"""


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['schemaVersion'] != 1:
        raise ValueError('Unsupported manifest schema')
    groups = {'photo': [], 'video': [], 'context': []}
    seen = set()
    for item in manifest['items']:
        if item['id'] in seen:
            raise ValueError(f"Duplicate ID: {item['id']}")
        seen.add(item['id'])
        groups[item['kind']].append(render_card(item))
    sections = '\n'.join(
        f'<section data-group="{kind}"><h2>{label}</h2><div class="cards">{"".join(groups[kind])}</div></section>'
        for kind, label in (('photo', '校园实拍照片'), ('video', '校园实拍视频'), ('context', '讨论背景'))
        if groups[kind]
    )
    template = (ROOT / 'index.template.html').read_text(encoding='utf-8')
    (ROOT / 'index.html').write_text(template.replace('<!-- MEDIA_CARDS -->', sections), encoding='utf-8')
    print(f'Verified and indexed {len(seen)} archived originals.')


if __name__ == '__main__':
    main()
