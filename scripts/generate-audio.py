"""Original deterministic CC0 sound design; no third-party recordings. Python stdlib only."""
import random,math,wave,struct
from pathlib import Path
r=random.Random(904);rate=22050;out=Path('assets/audio');out.mkdir(exist_ok=True)
def save(name,data):
 with wave.open(str(out/(name+'.wav')),'wb')as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(b''.join(struct.pack('<h',round(max(-1,min(1,x))*32767))for x in data))
for name,dur,freq in [('step-paving',.13,115),('step-grass',.19,55)]:
 data=[];low=0
 for i in range(int(rate*dur)):
  t=i/rate;e=(1-t/dur)**3;noise=r.uniform(-1,1);low=.72*low+.28*noise
  data.append(e*(.35*math.sin(2*math.pi*freq*t)*math.exp(-t*40)+(.22*noise if 'grass'in name else .22*low)))
 save(name,data)
for name,freqs in [('select',[440]),('equip',[330,660]),('bag',[260,390]),('collect',[523,659,784]),('complete',[523,659,784,1047]),('view',[392,523])]:
 data=[]
 for f in freqs:
  for i in range(int(rate*.085)):
   t=i/rate;data.append(.19*math.sin(math.pi*t/.085)**2*(math.sin(2*math.pi*f*t)+.12*math.sin(2*math.pi*f*2*t)))
 save(name,data)
# Slowly filtered noise, periodic amplitude, seam crossfade for a quiet wind/leaves loop.
data=[];low=0
for i in range(rate*12):
 low=.985*low+.015*r.uniform(-1,1);data.append(low*.6*(.7+.3*math.sin(2*math.pi*i/(rate*12))))
for i in range(rate):
 a=i/rate;data[-rate+i]=data[-rate+i]*(1-a)+data[i]*a
save('wind-leaves',data)
