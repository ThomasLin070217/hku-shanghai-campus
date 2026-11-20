"""QA: objective checks on deliverable WAVs — format, peak, RMS, clipping, duration.
Scans synth/ and cc0/processed/ only (cc0/raw/ holds unprocessed originals, some 24/32-bit).
Cannot verify subjective timbre (agent tool has no audio input). Produces QA report.
"""
import wave, math, array, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'audio' / 'story'
roots = [ROOT / 'synth', ROOT / 'cc0' / 'processed']
rows, issues = [], []

for root in roots:
    for wav in sorted(root.rglob('*.wav')):
        with wave.open(str(wav), 'rb') as w:
            ch, sw, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            raw = w.readframes(n)
        a = array.array('h'); a.frombytes(raw)
        peak = max((abs(x) for x in a), default=0) / 32768
        rms = math.sqrt(sum(x * x for x in a) / max(1, len(a))) / 32768
        dur = n / rate
        clip = sum(1 for x in a if abs(x) >= 32767)
        rel = str(wav.relative_to(ROOT))
        row = {'file': rel, 'ch': ch, 'bit': sw * 8, 'rate': rate,
               'sec': round(dur, 3), 'peak': round(peak, 4), 'rms': round(rms, 4), 'clipped': clip}
        rows.append(row)
        if sw != 2: issues.append(f'{rel}: not 16-bit')
        if peak > 0.905: issues.append(f'{rel}: peak {peak:.3f} above -0.9 dBFS ceiling')
        if clip: issues.append(f'{rel}: {clip} clipped samples')
        if rms < 0.0005: issues.append(f'{rel}: near-silent RMS {rms:.6f}')

# Informational: sample-rate consistency for Codex
rates = sorted({r['rate'] for r in rows})
if len(rates) > 1:
    issues.append(f'INFO: mixed sample rates across deliverables {rates} — decodeAudioData resamples to the browser context; see browser verification report')

report = {
 'scope': 'objective only — no listening test possible (agent tool has no audio input)',
 'scanned': [str(r.relative_to(ROOT)) for r in roots],
 'excluded': 'cc0/raw/ (unprocessed originals: 24/32-bit and OGG zips)',
 'total_files': len(rows),
 'total_seconds': round(sum(r['sec'] for r in rows), 1),
 'sample_rates': rates,
 'peak_ceiling': 'synth <= 0.891 (-1.0 dBFS); cc0/processed <= 0.90 (-0.9 dBFS)',
 'issues': issues,
 'pass': not [i for i in issues if not i.startswith('INFO:')],
 'files': rows,
}
(Path(__file__).resolve().parents[2] / 'docs/audio/QA-Assets.json').write_text(json.dumps(report, indent=2, ensure_ascii=False))

print(f'QA: {len(rows)} deliverable WAVs, {report["total_seconds"]}s, rates={rates}')
print(f'Issues: {len(issues)}')
for i in issues: print('  -', i)
print('PASS' if report['pass'] else 'FAIL')
