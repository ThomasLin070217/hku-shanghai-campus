from pathlib import Path
import json,html,hashlib
base=Path('references/video-followup');notes={
'U06':[(90,'frames/0090.0s.jpg','B04 / B05 连接体','白天校核玻璃、立柱和架空关系；沿用此前 U06 还原。'),(110,'frames/0110.0s.jpg','R005 步道与绿篱','带状铺装、低绿篱、支撑幼树。'),(140,'frames/0140.0s.jpg','A011 双弧梯','玻璃围护与低矮地被；完整尺寸仍不确定。'),(230,'frames/0230.0s.jpg','B04 门厅参考资产','只保存可见装潢参考，不扩展可进入楼层。')],
'U07':[(3,'frames/0003.0s.jpg','B01 / B02 夜间灯带','用户说明白天不亮；日间改中性灯槽，夜间发光。'),(27,'frames/0027.0s-upright.jpg','中央步道与台阶','小道到台阶距离较短；缺少可测完整平面，本轮不贸然改变高程。'),(39,'frames/0039.0s-upright.jpg','A005 / R011 台阶与种植带','保存为下一轮缩短平道、核对台阶衔接的重点证据。'),(66,'frames/0066.0s-upright.jpg','A006 圆孔连廊','从路上挪到西侧两楼间，模型与碰撞同步；中心坐标仍估计。')],
'U08':[(9,'frames/0009.0s.jpg','HKU 与 L001 狮子','前后关系可见，不把远近不同的物体当比例尺。'),(21,'frames/0021.0s.jpg','HKU 字母及三盏地灯','依据语音 H 宽 30–40cm 目测，暂取 .40m；增加三盏地灯。'),(30,'frames/0030.0s.jpg','A015 外围绿化','路外连续低绿篱；保留出入口空隙。'),(33,'frames/0033.0s.jpg','外围道路与绿地交界','只补有证据的植被连续性，未假定雨天路面是固定水体。')]}
def stamp(t):return f'{int(t)//60:02}:{t%60:05.2f}'
sections=[]
for id,items in notes.items():
 p=base/id;r=json.loads((p/'transcript-auto.json').read_text());segs=r['segments'];vtt='WEBVTT\n\n'
 for s in segs:
  def vt(t):return f'{int(t)//3600:02}:{int(t)%3600//60:02}:{t%60:06.3f}'
  vtt+=f"{vt(s['start'])} --> {vt(s['end'])}\n{s['text'].strip()}\n\n"
 (p/'transcript-auto.vtt').write_text(vtt)
 cards=''.join(f'<article><a href="{id}/{frame}"><img src="{id}/{frame}" loading="lazy" alt="{html.escape(title)}"></a><h3>{title}</h3><p>{desc}</p><button data-audio="{id}" data-time="{t}">播放原声 · {stamp(t)}</button></article>' for t,frame,title,desc in items)
 transcript=''.join(f'<li><button data-audio="{id}" data-time="{s["start"]}">{stamp(s["start"])}</button> {html.escape(s["text"])}</li>' for s in segs)
 sections.append(f'<section><h2>{id} · IMG_{dict(U06=4347,U07=4348,U08=4349)[id]}.MOV</h2><audio id="{id}" controls preload="metadata" src="{id}/voice-original.m4a"></audio><p><a href="{id}/voice-original.m4a" download>下载原声 AAC</a> · <a href="{id}/transcript-auto.txt">机器转写</a> · <a href="{id}/transcript-auto.vtt">时间轴字幕</a></p><div class="grid">{cards}</div><details><summary>展开带时间戳的原始转写</summary><p>未逐字人工听校；例如“棺木”应结合画面理解为灌木，“照在”疑为“罩在”。保留机器原稿，不把误识别当事实。</p><ol>{transcript}</ol></details></section>')
(base/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>校园实录 · 画面与原声</title><style>body{margin:auto;max-width:1100px;padding:24px;background:#f4f2e9;color:#213d31;font:16px/1.6 system-ui}h1{font-size:28px}section{border-top:1px solid #b5c3b2;margin-top:32px;padding-top:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:20px}article{min-width:0;padding:12px;background:white}img{width:100%;height:240px;object-fit:contain;background:#e5e7df}audio{width:min(100%,540px)}button{padding:8px;border:1px solid #73927a;background:#e4ecdf;color:#213d31;cursor:pointer}li{margin:10px 0}a{color:#245e40}summary{cursor:pointer}details{margin:20px 0}</style><h1>校园实录：画面、原声与修改依据</h1><p>三段本人实录 · 67 张时间轴抽帧 + 7 张方向校正版 · 12 张重点素材。点击时间戳即可听对应原声。</p><p>原声为原视频主 AAC 立体声轨直接复制，未降噪、未剪掉口述、未重新编码。完整 MOV（包含额外空间音轨）仍保留原路径，校验值见 <a href="manifest.json">来源清单</a>。照片经 HDR → SDR 转换，不能作为测光数据。没有上传至转写服务。</p>'''+''.join(sections)+'''<script>document.addEventListener('click',e=>{const b=e.target.closest('[data-audio]');if(!b)return;document.querySelectorAll('audio').forEach(a=>a.pause());const a=document.getElementById(b.dataset.audio);a.currentTime=Number(b.dataset.time);a.play().catch(()=>{});});</script></html>''')
manifest=json.loads((base/'manifest.json').read_text())
for m in manifest:
 p=base/m['id'];m['voiceSha256']=hashlib.sha256((p/'voice-original.m4a').read_bytes()).hexdigest();m['selected']=[dict(time=t,frame=f,feature=title,note=desc) for t,f,title,desc in notes[m['id']]];m['transcription']='local mlx-whisper large-v3-turbo, Chinese, word timestamps; not manually verbatim verified';m['rotationCorrections']='U07 timestamps >=18s selected frames rotated 90 degrees counterclockwise for viewing; raw frames retained' if m['id']=='U07' else None
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('catalog created')
