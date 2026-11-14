import subprocess,pathlib,json,re,hashlib,concurrent.futures,sys
from PIL import Image,ImageOps,ImageDraw
import imageio_ffmpeg
source_dir=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path.home()/'Downloads'
pathlib.Path('work/video-followup').mkdir(parents=True,exist_ok=True)
F=imageio_ffmpeg.get_ffmpeg_exe();out=pathlib.Path('references/video-followup');manifest=[];out.mkdir(parents=True,exist_ok=True)
for number,id in [(4347,'U06'),(4348,'U07'),(4349,'U08')]:
 source=source_dir/f'IMG_{number}.MOV';folder=out/id;folder.mkdir(exist_ok=True);(folder/'frames').mkdir(exist_ok=True)
 info=subprocess.run([F,'-hide_banner','-i',str(source)],capture_output=True,text=True).stderr
 h,m,s=map(float,re.search(r'Duration: (\d+):(\d+):([\d.]+)',info).groups());duration=h*3600+m*60+s
 subprocess.run([F,'-v','error','-y','-i',str(source),'-map','0:a:0','-vn','-c:a','copy','-map_metadata','-1',str(folder/'voice-original.m4a')],check=True)
 subprocess.run([F,'-v','error','-y','-i',str(source),'-map','0:a:0','-vn','-ar','16000','-ac','1',f'work/video-followup/{id}.wav'],check=True)
 times=list(range(0,int(duration),10 if id=='U06' else 3))
 def frame(t):
  dest=folder/'frames'/f'{t:06.1f}s.jpg'
  subprocess.run([F,'-v','error','-threads','2','-y','-ss',str(t),'-i',str(source),'-map','0:v:0','-frames:v','1','-vf','scale=960:-2,zscale=t=linear:npl=100,format=gbrpf32le,tonemap=tonemap=hable:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=pc,format=yuvj420p','-q:v','3',str(dest)],check=True)
  return dest
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:files=list(pool.map(frame,times))
 for offset in range(0,len(files),12):
  batch=files[offset:offset+12];board=Image.new('RGB',(1440,((len(batch)+3)//4)*330),'#eeeae0');draw=ImageDraw.Draw(board)
  for i,p in enumerate(batch):
   im=ImageOps.contain(Image.open(p),(350,300));x=i%4*360;y=i//4*330;board.paste(im,(x+(360-im.width)//2,y+25));draw.text((x+8,y+5),f'{id} / {p.stem}',fill='#173c30')
  board.save(folder/f'contact-{offset//12+1}.jpg',quality=92)
 hash=hashlib.sha256()
 with source.open('rb') as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b''):hash.update(chunk)
 manifest.append(dict(id=id,source=str(source),bytes=source.stat().st_size,sha256=hash.hexdigest(),seconds=duration,voice='AAC stereo primary track copied without re-encoding; original MOV including spatial track remains untouched',frames=times,treatment='HLG to SDR hable; not colour measurement',author='user',externalUpload=False))
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(id,duration,len(files),flush=True)

for t in [18,27,39,45,60,66,69]:
 p=out/'U07'/'frames'/f'{t:06.1f}s.jpg';Image.open(p).transpose(Image.Transpose.ROTATE_90).save(p.with_name(p.stem+'-upright.jpg'),quality=95)
