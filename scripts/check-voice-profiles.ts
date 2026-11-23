import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {STAFF_DIALOGUE} from '../content/voice/staff-dialogue';
import {ALERT_VOICE_TEXT, AI_VOICE_URLS, STAFF_INTRO_TIMING, STAFF_VOICE_TEXT, STAFF_VOICE_URLS} from '../src/opening/voice';
import profiles from '../content/voice/profiles.json';
import clips from '../assets/audio/npc/staff/clips.json';
import aiClips from '../assets/audio/npc/ai/clips.json';
import planned from '../content/voice/planned-dialogue.json';

const ROOT = new URL('../', import.meta.url);
const file = (path: string) => new URL(path, ROOT);
const bytes = (path: string) => readFileSync(file(path));
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function wavInfo(path: string) {
  const data = bytes(path);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', `${path}: RIFF header`);
  assert.equal(data.toString('ascii', 8, 12), 'WAVE', `${path}: WAVE header`);
  let offset = 12;
  let sampleRate = 0, channels = 0, bits = 0, byteRate = 0;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      channels = data.readUInt16LE(offset + 10);
      sampleRate = data.readUInt32LE(offset + 12);
      byteRate = data.readUInt32LE(offset + 16);
      bits = data.readUInt16LE(offset + 22);
    } else if (id === 'data') {
      assert.ok(byteRate > 0, `${path}: fmt chunk before data`);
      return {duration: size / byteRate, sampleRate, channels, bits, bytes: data.length};
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

// The manifest is the single source for clip ids, text and duration.
assert.equal(clips.clips.length, 5, 'five Staff clips');
const expectedIds = ['staff-line1', 'staff-line2', 'staff-line3', 'staff-line4', 'staff-line5'];
assert.deepEqual(clips.clips.map((clip) => clip.id), expectedIds);
assert.deepEqual(STAFF_VOICE_TEXT.intro, [...STAFF_DIALOGUE.intro]);
assert.equal(STAFF_VOICE_TEXT.thanks, STAFF_DIALOGUE.thanks);
assert.equal(STAFF_VOICE_TEXT.repeat, STAFF_DIALOGUE.repeat);
assert.equal(STAFF_VOICE_TEXT.playerAccept, STAFF_DIALOGUE.playerAccept);

for (const clip of clips.clips) {
  assert.ok(STAFF_VOICE_URLS[clip.id], `${clip.id}: URL registered`);
  const info = wavInfo(clip.file);
  assert.equal(info.sampleRate, 44100, `${clip.id}: 44.1 kHz`);
  assert.equal(info.channels, 1, `${clip.id}: mono`);
  assert.equal(info.bits, 16, `${clip.id}: 16-bit`);
  assert.ok(Math.abs(info.duration - clip.duration) < 0.02, `${clip.id}: duration ${info.duration.toFixed(3)} vs ${clip.duration}`);
  assert.equal(sha256(bytes(clip.file)), clip.sha256, `${clip.id}: sha256`);
}

// The campus alert has two voices: the invader and the local AI. They must be
// separate files — one speaker, one clip — so the local AI never inherits the
// invader's voice.
assert.equal(aiClips.clips.length, 2, 'two AI alert clips');
assert.deepEqual(aiClips.clips.map((clip) => clip.id).sort(), ['external-ai', 'local-ai']);
assert.equal(ALERT_VOICE_TEXT.invader, aiClips.clips.find((clip) => clip.id === 'external-ai')?.text);
assert.equal(ALERT_VOICE_TEXT.local, aiClips.clips.find((clip) => clip.id === 'local-ai')?.text);
for (const clip of aiClips.clips) {
  assert.ok(AI_VOICE_URLS[clip.id], `${clip.id}: URL registered`);
  const info = wavInfo(clip.file);
  assert.equal(info.sampleRate, 44100, `${clip.id}: 44.1 kHz`);
  assert.equal(info.channels, 1, `${clip.id}: mono`);
  assert.equal(info.bits, 16, `${clip.id}: 16-bit`);
  assert.ok(Math.abs(info.duration - clip.duration) < 0.02, `${clip.id}: duration ${info.duration.toFixed(3)} vs ${clip.duration}`);
  assert.ok(info.duration > 3 && info.duration < 9, `${clip.id}: 3-9 s`);
  assert.ok(clip.peakDb <= -2.9 && clip.peakDb >= -3.1, `${clip.id}: normalized to -3 dBFS`);
  assert.equal(sha256(bytes(clip.file)), clip.sha256, `${clip.id}: sha256`);
}

// Timing is derived from the manifest, so replacing a take cannot leave the
// subtitles on the previous take's clock.
const introDurations = clips.clips.slice(0, 3).map((clip) => clip.duration);
assert.ok(
  Math.abs(STAFF_INTRO_TIMING.total - (introDurations[0] + introDurations[1] + introDurations[2] + 0.36)) < 0.01,
  'intro timing includes two 0.18 s gaps',
);
assert.equal(STAFF_INTRO_TIMING.starts[0], 0);
assert.ok(Math.abs(STAFF_INTRO_TIMING.starts[1] - (introDurations[0] + 0.18)) < 0.01, 'line 2 starts after line 1 + gap');
assert.ok(
  Math.abs(STAFF_INTRO_TIMING.starts[2] - (introDurations[0] + introDurations[1] + 0.36)) < 0.01,
  'line 3 starts after lines 1-2 + two gaps',
);
assert.ok(STAFF_INTRO_TIMING.total > 10 && STAFF_INTRO_TIMING.total < 25, 'intro stays in the 10-25 s range');

const staff = profiles.profiles.find((profile) => profile.npcId === 'opening-staff');
assert.ok(staff, 'opening-staff profile');
assert.equal(staff.status, 'generated');
assert.equal(staff.provider, 'ElevenLabs');
assert.equal(staff.modelKey, 'eleven_multilingual_v2');
assert.equal(staff.voiceName, 'Alice — Clear, Engaging Educator');
assert.equal(staff.voiceId, 'Xb7hH8MSUJpSbSDYk0k2');
assert.equal(staff.stability, 0.4);
assert.equal(staff.clips.length, 5);
assert.deepEqual(
  staff.clips.map((clip: {dialogueId: string}) => clip.dialogueId),
  ['staff.act1.line1', 'staff.act1.line2', 'staff.act1.line3', 'staff.act1.line4', 'staff.act1.line5'],
);
for (const clip of staff.clips) {
  assert.equal(sha256(bytes(clip.file)), clip.sha256, `${clip.id}: profile hash matches file`);
}

// The 2026-11-21 DaVinci generation is historical provenance only. It is kept
// on disk, but no longer describes the shipped Staff clips.
const generationLog = JSON.parse(bytes('assets/audio/npc/staff/source/generation-log.json').toString('utf8'));
assert.equal(generationLog.quotaAfter.audio, '0/1');
assert.equal(generationLog.paidCreditsCharged, 0);
assert.equal(profiles.quota.historicalDavinci.after.audio, '0/1');
assert.equal(profiles.quota.historicalDavinci.paidCreditsCharged, 0);

for (const id of ['npc.student.guide', 'npc.campus.tech', 'npc.terminal.echo']) {
  const profile = profiles.profiles.find((entry) => entry.npcId === id);
  assert.ok(profile, `${id}: planned profile exists`);
  assert.equal(profile.status, 'planned');
  assert.equal(profile.voiceId, null);
  assert.equal(profile.clips.length, 0);
  assert.match(profile.blockedBy ?? '', /ElevenLabs cast pass/i);
}
const player = profiles.profiles.find((profile) => profile.npcId === 'player.student-ambassador');
assert.ok(player, 'player profile');
assert.equal(player.status, 'generated');
assert.equal(player.provider, 'ElevenLabs');
assert.equal(player.model, 'ElevenLabs Multilingual v2');
assert.equal(player.voiceName, 'Harry — Fierce Warrior');
assert.equal(player.clips[0]?.text, STAFF_DIALOGUE.playerAccept);
assert.equal(player.clips[0]?.file, 'assets/audio/npc/player/player-accept-harry.wav');
const playerWav = wavInfo(player.clips[0]!.file);
assert.equal(playerWav.sampleRate, 44100);
assert.equal(playerWav.channels, 1);
assert.ok(Math.abs(playerWav.duration - player.clips[0]!.duration) < 0.02);
assert.ok(Math.abs(playerWav.duration - 1.533) < 0.02, 'player clip is the 1.533 s Harry take');
assert.equal(sha256(bytes(player.clips[0]!.file)), player.clips[0]!.sha256);
assert.equal(player.sourceFile, null);
assert.equal(player.sourceDurationSeconds, player.clips[0]!.duration);

assert.equal(planned.npcs.length, 3, 'three planned NPCs');
assert.deepEqual(planned.npcs.map((npc) => npc.lines.length), [8, 11, 12]);
for (const npc of planned.npcs) {
  assert.equal(npc.status, 'awaiting-approved-english-localization');
  for (const line of npc.lines) {
    assert.ok(line.zh.length > 0, `${line.dialogueId}: authored Chinese line`);
    assert.equal(line.english, null, `${line.dialogueId}: no unapproved English rewrite`);
  }
}
assert.equal(planned.generationOrder.length, 3);
assert.match(planned.note, /quota is 0\/1/);

console.log('PASS Staff voice manifest: 5 ElevenLabs Alice clips, 2 AI alert clips (invader + local), WAV hashes/durations, derived intro timing, historical DaVinci log, planned NPC profiles and remaining dialogue queue');
