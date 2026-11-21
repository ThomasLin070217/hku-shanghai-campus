"""Opening-only deterministic foley. Does not overwrite the shared source pack."""
import math,random,wave,struct,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2];out=ROOT/'assets/audio/opening-foley';out.mkdir(exist_ok=True);sr=22050

def save(name,values,peak):
 m=max(abs(x)for x in values)or 1;data=[int(max(-1,min(1,x/m*peak))*32767)for x in values]
 with wave.open(str(out/name),'wb')as f:f.setparams((1,2,sr,0,'NONE','not compressed'));f.writeframes(struct.pack('<'+'h'*len(data),*data))
def noise(seconds,seed,decay,low):
 r=random.Random(seed);v=0;result=[]
 for i in range(int(sr*seconds)):
  t=i/sr;v+=low*(r.uniform(-1,1)-v);envelope=min(1,t/.012)*math.exp(-decay*t)*(1-min(1,max(0,t-seconds+.025)/.025))
  result.append(v*envelope)
 return result
save('jump-cloth.wav',noise(.20,81,20,.10),.18)
land=noise(.24,93,18,.055)
for i in range(len(land)):
 t=i/sr;land[i]+=math.sin(2*math.pi*(62*t-13*t*t))*.13*min(1,t/.006)*math.exp(-29*t)
save('landing-soft.wav',land,.38)
for surface in ['paving','grass']:
 for n in range(5):
  with wave.open(str(ROOT/f'assets/audio/campus/step-{surface}-{n}.wav'))as f:
   assert f.getnchannels()==1 and f.getsampwidth()==2
   rate=f.getframerate();data=struct.unpack('<'+'h'*f.getnframes(),f.readframes(f.getnframes()))
  data=[data[min(len(data)-1,int(i*rate/sr))]for i in range(int(len(data)*sr/rate))]
  values=[];v=0
  for x in data:v+=.22*(x/32768-v);values.append(v)
  save(f'run-{surface}-{n}.wav',values,.42)
print('Created 12 opening-only foley files')
