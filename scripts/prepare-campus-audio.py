"""Prepare CC0 source assets. Requires FFmpeg + numpy. Sources/licenses: assets/audio/SOURCES.md.
No synthesis of footstep tones. Raw source archive stays in work/experience-fix.
"""
import os,shutil,subprocess,numpy as np,wave,pathlib,json,hashlib
F=os.environ.get('CAMPUS_FFMPEG') or shutil.which('ffmpeg')
if not F: raise SystemExit('Install FFmpeg or set CAMPUS_FFMPEG to its executable path.')
out=pathlib.Path('assets/audio/campus');out.mkdir(exist_ok=True);rate=24000
report=[]
def decode(path,channels=1,filters='highpass=f=90,lowpass=f=6500'):
 b=subprocess.check_output([F,'-v','error','-i',str(path),'-af',filters,'-ar',str(rate),'-ac',str(channels),'-f','f32le','-']);return np.frombuffer(b,dtype='<f4').reshape(-1,channels).copy()
def save(name,x,info):
 x=np.clip(x,-.98,.98);p=out/(name+'.wav')
 with wave.open(str(p),'wb')as w:w.setnchannels(x.shape[1]);w.setsampwidth(2);w.setframerate(rate);w.writeframes((x*32767).astype('<i2').tobytes())
 report.append(dict(name=name,seconds=len(x)/rate,peak=float(np.max(np.abs(x))),rms=float(np.sqrt(np.mean(x*x))),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),**info))
for surface,original in [('paving','concrete'),('grass','grass')]:
 for i in range(5):
  raw=pathlib.Path(f'assets/audio/kenney/footstep_{original}_{i:03}.ogg');x=decode(raw)
  active=np.where(np.abs(x[:,0])>max(.002,float(np.max(np.abs(x)))*.015))[0]
  x=x[max(0,active[0]-120):min(len(x),active[-1]+600)]
  x*=min(.28/np.max(np.abs(x)),.055/max(1e-6,np.sqrt(np.mean(x*x))))
  fade=min(240,len(x)//4);x[:fade]*=np.linspace(0,1,fade)[:,None];x[-fade:]*=np.linspace(1,0,fade)[:,None]
  save(f'step-{surface}-{i}',x,dict(source=str(raw),treatment='DC/highpass 90 Hz, lowpass 6.5 kHz, trim, gentle fades; peak/RMS capped'))
# Quietest 48 second section, excluding source start/end. No assumption it was recorded on campus.
raw=pathlib.Path('work/experience-fix/park_ambience_wind.wav');x=decode(raw,2,'highpass=f=220,lowpass=f=4500')
length=48*rate;candidates=range(10*rate,len(x)-length-5*rate,5*rate);start=min(candidates,key=lambda n:float(np.mean(x[n:n+length]**2)));y=x[start:start+length];y*=min(.18/np.max(np.abs(y)),.035/max(1e-6,np.sqrt(np.mean(y*y))))
# Crossfade overlap and remove it: end approaches the sample at new loop start, not old sample 0.
f=3*rate;a=np.linspace(0,1,f)[:,None];blend=y[-f:]*(1-a)+y[:f]*a;y=np.concatenate([y[f:-f],blend]);
save('campus-breeze',y,dict(source=str(raw),startSeconds=start/rate,sourceDurationSeconds=len(x)/rate,crossfadeSeconds=3,treatment='220 Hz highpass removes wind rumble, 4.5 kHz lowpass, restrained stereo ambience, quietest window'))
pathlib.Path('evidence/experience-fix/audio-assets.json').write_text(json.dumps(report,indent=2));print([(r['name'],round(r['seconds'],2),round(r['peak'],3))for r in report])
