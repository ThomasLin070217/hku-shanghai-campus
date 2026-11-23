#!/usr/bin/env node
/**
 * Generate the prologue voice clips with ElevenLabs.
 *
 * Source of truth: content/voice/prologue.json (lines, speakers, voice settings).
 * Output: assets/audio/prologue/<line-id>.mp3 plus clips.json with measured
 * durations, so the cinematic timeline and the subtitles are built from the
 * real audio instead of guesses.
 *
 * The API key is read from ELEVENLABS_API_KEY, or from the macOS keychain item
 * `elevenlabs-api` (account ELEVENLABS_API_KEY). It is never printed and never
 * written to disk. Run with --check to verify existing clips without calling
 * the API (no key needed).
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'content/voice/prologue.json');
const outDir = join(root, 'assets/audio/prologue');
const manifestPath = join(outDir, 'clips.json');
const MODEL = process.env.PROLOGUE_TTS_MODEL ?? 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';
const checkOnly = process.argv.includes('--check');

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const lines = source.lines ?? [];
if (!lines.length) fail('content/voice/prologue.json has no lines');

function fail(message) {
  console.error(`prologue voice: ${message}`);
  process.exit(1);
}

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-a', 'ELEVENLABS_API_KEY', '-s', 'elevenlabs-api', '-w'],
      {encoding: 'utf8'},
    ).trim();
  } catch {
    return '';
  }
}

function duration(file) {
  const seconds = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], {
      encoding: 'utf8',
    }).trim(),
  );
  if (!Number.isFinite(seconds) || seconds <= 0) fail(`ffprobe gave no duration for ${file}`);
  return Math.round(seconds * 1000) / 1000;
}

function readManifest() {
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function verify(clips) {
  const problems = [];
  for (const clip of lines) {
    const file = join(outDir, `${clip.id}.mp3`);
    if (!existsSync(file)) problems.push(`${clip.id}: missing ${file}`);
  }
  for (const entry of clips ?? []) {
    if (!entry.duration || entry.duration <= 0) problems.push(`${entry.id}: no duration`);
    if (!entry.text) problems.push(`${entry.id}: no text`);
  }
  if ((clips?.length ?? 0) !== lines.length) problems.push(`manifest has ${clips?.length ?? 0} clips, source has ${lines.length}`);
  const ids = new Set((clips ?? []).map((clip) => clip.id));
  for (const line of lines) if (!ids.has(line.id)) problems.push(`${line.id}: absent from clips.json`);
  return problems;
}

async function generate(clip) {
  const voice = source.voices?.[clip.speaker];
  if (!voice?.id) fail(`${clip.id}: no voice for speaker ${clip.speaker}`);
  const key = apiKey();
  if (!key) fail('no ElevenLabs key: set ELEVENLABS_API_KEY or the keychain item elevenlabs-api');

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      text: clip.text,
      model_id: MODEL,
      voice_settings: voice.settings,
      previous_text: undefined,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    fail(`${clip.id}: HTTP ${response.status} ${body.slice(0, 300)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) fail(`${clip.id}: response is only ${bytes.length} bytes`);
  const file = join(outDir, `${clip.id}.mp3`);
  writeFileSync(file, bytes);
  const seconds = duration(file);
  console.log(`wrote ${clip.id}.mp3  ${seconds.toFixed(2)}s  ${(bytes.length / 1024).toFixed(0)} KB  ${clip.speaker}`);
  return {
    id: clip.id,
    speaker: clip.speaker,
    voiceId: voice.id,
    voiceName: voice.name,
    text: clip.text,
    file: `${clip.id}.mp3`,
    duration: seconds,
  };
}

mkdirSync(outDir, {recursive: true});

if (checkOnly) {
  const problems = verify(readManifest()?.clips);
  if (problems.length) {
    for (const problem of problems) console.error(`  fail  ${problem}`);
    process.exit(1);
  }
  const clips = readManifest().clips;
  const total = clips.reduce((sum, clip) => sum + clip.duration, 0);
  console.log(`prologue voice: ${clips.length} clips, ${total.toFixed(2)}s total, all files present`);
  process.exit(0);
}

const clips = [];
for (const line of lines) clips.push(await generate(line));

const total = clips.reduce((sum, clip) => sum + clip.duration, 0);
if (total > 45) fail(`total narration is ${total.toFixed(1)}s; the prologue budget is 45s — shorten the lines`);

writeFileSync(
  manifestPath,
  `${JSON.stringify({version: 1, model: MODEL, outputFormat: OUTPUT_FORMAT, generated: new Date().toISOString().slice(0, 10), total, clips}, null, 2)}\n`,
);
console.log(`wrote clips.json  ${clips.length} clips  ${total.toFixed(2)}s total`);
