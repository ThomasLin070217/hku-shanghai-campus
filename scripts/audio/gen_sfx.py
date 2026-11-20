"""Generate SFX batch — pure stdlib. Covers ADS sections 4.2, 5.2, 6.2, 7.x.
Every scaled signal uses scale(sig, g); every envelope uses mul(sig, env).
"""
import sys, math, random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from synth_lib import *

OUT = Path(__file__).resolve().parents[2] / 'assets' / 'audio' / 'story' / 'synth' / 'sfx'
OUT.mkdir(parents=True, exist_ok=True)
report = []
def emit(name, sig, desc, cross=0.0):
    sig = loopify(sig, cross) if cross else fade(normalize(sig))
    p = write_wav(OUT / (name + '.wav'), sig)
    st = stats(p); report.append((name, st, desc))
    print(f'  {name:28s} {st["seconds"]:6.2f}s peak={st["peak"]:.3f}')

print('== Scene 03: AI awakening / veil ==')
n = int(4 * RATE)
s = mix(sine(42, n, vibrato=.01, vib_rate=.3), scale(sine(84, n), .3), scale(noise(n, 11, .96), .08))
e = [min(1, i / (RATE * 2.5)) * min(1, (n - i) / RATE) for i in range(n)]
emit('sfx_anomaly_low', mul(s, e), '40Hz anomaly drone, slow swell')

n = int(1.2 * RATE); burst = [0.0] * n; rnd = random.Random(7)
for k in range(46):
    at = rnd.randint(0, n - RATE // 8); dur = rnd.randint(30, 500)
    f = rnd.choice([220, 440, 660, 880, 1320, 1760]) * rnd.uniform(.9, 1.1)
    tone = sweep(f, f * rnd.uniform(.4, 1.3), dur)
    for i, v in enumerate(tone):
        if at + i < n: burst[at + i] += v * rnd.uniform(.3, .9) * (1 - i / dur)
emit('sfx_glitch_burst', mix(burst, scale(noise(n, 3, .5), .25)), 'digital glitch shreds music')

n = int(3 * RATE)
s = mix(sweep(180, 1400, n, 'quad'), scale(sine(60, n), .4))
for at in [0.4, 1.1, 1.9]: place(s, scale(note(90, .06, 'square', .001, .04), .7), at)
emit('sfx_ai_boot', s, 'AI boot: rising sweep + relays + hum')

n = int(5 * RATE); s = [0.0] * n
for f in [233, 349, 415, 622]: place(s, scale(sine(f, n, vibrato=.02, vib_rate=3), .25), 0)
crackle = noise(n, 19, .3)
for k in range(80):
    at = int((k / 80) * n) + int((k % 7) * 40)
    for i in range(min(240, n - at)):
        crackle[at + i] *= (1 - i / 240) if i < 60 else .05
emit('sfx_disturbance_spread', mix(s, scale(crackle, .5)), 'electronic interference spread')

n = int(6 * RATE)
s = sweep(80, 24, n, 'quad'); metal = scale(highpass(noise(n, 23, .995), .3), .35)
for at in [0.5, 2.0, 3.5, 4.6]: place(s, scale(note(55, .5, 'saw', .05, .3), .5), at)
env = [min(1, i / (RATE * 1.5)) * min(1, (n - i) / (RATE * 1.2)) for i in range(n)]
emit('sfx_veil_descend', mul(mix(s, metal), env), 'veil descending: sub-bass dive + metal grind')

n = int(1.5 * RATE)
s = mix(sweep(120, 22, n), scale(noise(n, 31, .7), .5))
emit('sfx_veil_seal', mul(s, [math.exp(-i / (RATE * .3)) for i in range(n)]), 'veil seal impact + cutoff point')

n = int(12 * RATE)
emit('amb_dark_hum', mix(sine(31, n), scale(sine(47, n), .25), scale(noise(n, 41, .995), .15)), 'dark lockdown ambience', cross=.05)

print('== Robot ==')
n = int(2 * RATE)
emit('robot_servo_loop', mix(scale(sine(115, n, vibrato=.08, vib_rate=7), .4), scale(sine(230, n), .15), scale(noise(n, 5, .9), .22)), 'servo motor + joints', cross=.05)
n = int(.25 * RATE)
emit('robot_patrol_step', mix(sweep(180, 55, n), scale(noise(n, 9, .6), .5)), 'heavy mechanical footstep')
emit('robot_scan', mix(sweep(900, 1500, int(.6 * RATE)), sweep(1500, 700, int(.6 * RATE))), 'red-eye scan sweep')
n = int(.8 * RATE); s = [0.0] * n
for k in range(3): place(s, scale(note(880, .16, 'square', .003, .06), .6), k * .22)
place(s, scale(sweep(1200, 400, .5), .3), 0)
emit('robot_lockon', s, 'lock-on alert (priority duck)')
n = int(2 * RATE)
s = mix(scale(saw(98, n), .35), scale(sweep(300, 900, n), .1), scale(noise(n, 13, .85), .3))
for at in [0, .5, 1, 1.5]: place(s, scale(note(660, .1, 'square', .002, .05), .4), at)
emit('robot_chase_loop', s, 'chase: motor load + alarm', cross=.05)
n = int(1.2 * RATE); s = mix(sine(58, n), sine(60, n))
emit('robot_near_danger', mul(s, [abs(math.sin(math.pi * 2.2 * i / RATE)) ** 3 for i in range(n)]), 'proximity heartbeat pulse')
n = int(.5 * RATE)
emit('robot_capture', mix(sweep(300, 80, n), scale(noise(n, 17, .5), .6), scale(note(120, .4, 'square', .002, .2), .4)), 'robot grabs player')
n = int(1.8 * RATE)
emit('sfx_blackout', mix(sweep(200, 30, n), scale(sine(45, n), .3)), 'blackout on capture')
n = int(1.5 * RATE)
emit('sfx_safe_restore', mix(sweep(180, 720, n), scale(note(523, .4, 'sine', .01, .5), .4), scale(note(784, .5, 'sine', .02, .6), .3)), 'safe checkpoint restore (gentle rise)')

print('== Actions ==')
emit('step_jump', mix(sweep(140, 260, int(.13 * RATE)), scale(noise(int(.13 * RATE), 29, .7), .2)), 'jump push-off')
emit('step_land', mix(sweep(120, 45, int(.18 * RATE)), scale(noise(int(.18 * RATE), 37, .6), .35)), 'landing impact')
emit('step_stair_up', mix(sweep(160, 220, int(.12 * RATE)), scale(noise(int(.12 * RATE), 43, .7), .2)), 'stairs up TBD')
emit('step_stair_down', mix(sweep(200, 120, int(.13 * RATE)), scale(noise(int(.13 * RATE), 47, .6), .25)), 'stairs down TBD')

print('== UI / devices ==')
emit('ui_confirm', mix(note(523, .12), scale(note(784, .14), .7)), 'confirm (upward)')
emit('ui_cancel', mix(note(440, .12), scale(note(294, .14), .7)), 'cancel (downward)')
emit('ui_error', mix(note(220, .15, 'square'), scale(note(233, .15, 'square'), .6)), 'error (dissonant)')
emit('invitation_open', mix(scale(noise(int(.2 * RATE), 53, .6), .5), scale(note(880, .08, 'sine', .01, .06), .2)), 'invitation open')
emit('invitation_page', scale(noise(int(.14 * RATE), 59, .55), .5), 'page turn')
emit('invitation_close', mix(scale(noise(int(.18 * RATE), 61, .6), .4), scale(note(660, .07, 'sine', .01, .05), .15)), 'invitation close')
emit('macbook_open', mix(sweep(220, 520, int(.25 * RATE)), scale(note(440, .12, 'sine', .01, .1), .3)), 'MacBook open')
emit('macbook_close', mix(sweep(480, 180, int(.2 * RATE)), scale(noise(int(.2 * RATE), 67, .7), .2)), 'MacBook close')
emit('macbook_type', mix(scale(note(1200, .03, 'square', .001, .02), .3), scale(noise(int(.04 * RATE), 71, .4), .3)), 'keyboard tap')
emit('agent_status', mix(note(660, .1, 'sine', .005, .08), scale(note(990, .08, 'sine', .005, .06), .5)), 'AI agent status')
emit('decrypt_tick', scale(note(880, .05, 'sine', .002, .04), .7), 'decrypt progress tick')
emit('decrypt_success', mix(note(523, .2), scale(note(659, .25), .8), scale(note(784, .3), .8), scale(note(1047, .4), .6)), 'decrypt success')
emit('decrypt_fail', mix(note(300, .18, 'square'), scale(note(280, .2, 'square'), .7)), 'decrypt fail')
emit('power_switch', mix(note(120, .08, 'square', .001, .06), scale(sweep(400, 100, .1), .3)), 'power switch')
n = int(.8 * RATE)
emit('power_surge', mix(sweep(60, 240, n), scale(noise(n, 73, .7), .3), scale(sine(120, n), .3)), 'power surge')
n = int(4 * RATE)
emit('supercomputer_hum', mix(scale(sine(75, n), .4), scale(sine(150, n), .2), scale(noise(n, 79, .95), .2)), 'supercomputer hum', cross=.05)

print('== Boss / gym / ending ==')
n = int(1.8 * RATE)
emit('boss_roar', mix(sweep(90, 38, n), scale(saw(70, n), .35), scale(noise(n, 83, .6), .4)), 'mechanical lion roar')
n = int(2 * RATE)
emit('boss_servo', mix(scale(saw(62, n), .4), scale(noise(n, 89, .9), .25)), 'large servo', cross=.05)
n = int(.4 * RATE)
emit('boss_footstep', mix(sweep(70, 28, n), scale(noise(n, 97, .5), .6)), 'boss heavy step')
emit('boss_attack_windup', sweep(200, 800, int(.7 * RATE)), 'attack telegraph')
n = int(.3 * RATE)
emit('boss_attack_hit', mix(sweep(400, 60, n), scale(noise(n, 101, .4), .7)), 'attack hit')
emit('boss_damage', mix(scale(noise(n, 103, .5), .6), scale(note(180, .25, 'saw', .002, .2), .5)), 'boss damaged')
n = int(2.5 * RATE)
emit('boss_defeat', mix(sweep(180, 25, n), scale(noise(n, 107, .7), .4)), 'boss collapse')
n = int(8 * RATE)
emit('gym_ambience', mix(scale(noise(n, 109, .98), .15), scale(sine(55, n), .1)), 'gym large-room ambience', cross=.05)
emit('bounce_ball', mix(sweep(320, 90, int(.18 * RATE)), scale(note(150, .12, 'sine', .002, .1), .4)), 'basketball bounce TBD')
emit('student_free', mix(note(523, .3), scale(note(659, .4), .8), scale(note(880, .5), .7)), 'students freed')
n = int(2 * RATE)
emit('sfx_lightshow_sweep', mix(sweep(300, 2400, n), scale(noise(n, 113, .8), .2)), 'light show sweep')
n = int(3 * RATE)
emit('sfx_crowd_cheer', mix(scale(noise(n, 127, .5), .5), scale(noise(n, 131, .85), .3)), 'crowd cheer (synthetic)')

import json
(OUT.parent / 'sfx-report.json').write_text(json.dumps([{'id': a, 'stats': b, 'desc': c} for a, b, c in report], indent=2, ensure_ascii=False))
print(f'\nPASS {len(report)} SFX generated')
