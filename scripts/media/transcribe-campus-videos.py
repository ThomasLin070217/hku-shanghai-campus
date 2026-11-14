import os,json,pathlib,wave,numpy as np
# Uses the local Hugging Face cache; model audio never leaves this machine.
import mlx_whisper
for id in ['U07','U08','U06']:
 with wave.open(f'work/video-followup/{id}.wav') as w:samples=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
 r=mlx_whisper.transcribe(samples,path_or_hf_repo='mlx-community/whisper-large-v3-turbo',language='zh',word_timestamps=True,condition_on_previous_text=False,hallucination_silence_threshold=2)
 p=pathlib.Path(f'references/video-followup/{id}');(p/'transcript-auto.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));(p/'transcript-auto.txt').write_text('\n'.join(f"[{s['start']:.2f}–{s['end']:.2f}] {s['text']}" for s in r['segments']));print(id,r['text'],flush=True)
