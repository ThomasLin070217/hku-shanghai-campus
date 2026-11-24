#!/usr/bin/env node
/**
 * Generate the audition cast with ElevenLabs.
 *
 * Source of truth: .scratch/voice-2026-11-23/cast.json.
 * Output: .scratch/voice-2026-11-23/out/<line-id>--<take-slug>.mp3 plus
 * manifest.json with measured durations. Nothing here overwrites a shipped
 * voice asset.
 *
 * Key: ELEVENLABS_API_KEY, or the macOS keychain item service `elevenlabs-api`,
 * account `ELEVENLABS_API_KEY`. Never printed, never written to disk.
 *
 * Usage:
 *   node scripts/generate-voice-takes.mjs --dry-run
 *   node scripts/generate-voice-takes.mjs --only staff-line2,staff-line3
 *   node scripts/generate-voice-takes.mjs --main-first
 *   node scripts/generate-voice-takes.mjs --check
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const castPath = join(root, '.scratch/voice-2026-11-23/cast.json');
const outDir = join(root, '.scratch/voice-2026-11-23/out');
const manifestPath = join(outDir, 'manifest.json');
const MODEL = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const checkOnly = args.includes('--check');
const mainFirst = args.includes('--main-first');
const onlyFlag = args.indexOf('--only');
const onlyArg = onlyFlag === -1 ? null : (args[onlyFlag + 1] ?? '');
const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim()).filter(Boolean)) : null;

// Main-story dialogue first: the B4 5F errand, the local AI, the invader, the
// player's only spoken line. Prologue narration follows.
const MAIN_ORDER = ['staff-line2', 'staff-line3', 'local-ai', 'external-ai', 'player-accept', 'staff-line1', 'staff-line4', 'staff-line5'];

const cast = JSON.parse(readFileSync(castPath, 'utf8'));
if (!Array.isArray(cast.lines) || !cast.lines.length) fail('cast.json has no lines');

function fail(message) {
  console.error(`voice takes: ${message}`);
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

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function orderedLines() {
  let lines = cast.lines.filter((line) => !only || only.has(line.id));
  if (mainFirst) {
    const rank = (id) => {
      const index = MAIN_ORDER.indexOf(id);
      return index === -1 ? MAIN_ORDER.length : index;
    };
    lines = [...lines].sort((a, b) => rank(a.id) - rank(b.id));
  }
  return lines;
}

async function speak(line, take) {
  const key = apiKey();
  if (!key) fail('no ElevenLabs key: set ELEVENLABS_API_KEY or keychain elevenlabs-api / ELEVENLABS_API_KEY');
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${take.voiceId}?output_format=${OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          text: line.text,
          model_id: MODEL,
          voice_settings: take.settings,
        }),
      },
    );
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1024) fail(`${line.id}/${take.slug}: response is only ${bytes.length} bytes`);
      const file = join(outDir, `${line.id}--${take.slug}.mp3`);
      writeFileSync(file, bytes);
      const seconds = duration(file);
      console.log(`wrote ${line.id}--${take.slug}.mp3  ${seconds.toFixed(2)}s  ${(bytes.length / 1024).toFixed(0)} KB`);
      return {
        lineId: line.id,
        speaker: line.speaker,
        take: take.slug,
        voiceId: take.voiceId,
        text: line.text,
        file: `${line.id}--${take.slug}.mp3`,
        duration: seconds,
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    }
    const body = await response.text();
    if (response.status === 401 || response.status === 403) {
      // Some catalogue voices ("famous voices") are Reader-App-only. Skip the
      // take and keep the rest of the cast running; record it in the manifest.
      console.warn(`  skip ${line.id}/${take.slug}: HTTP ${response.status} ${body.slice(0, 200)}`);
      return {
        skipped: true,
        lineId: line.id,
        speaker: line.speaker,
        take: take.slug,
        voiceId: take.voiceId,
        reason: `HTTP ${response.status}`,
      };
    }
    if (response.status === 429 || response.status >= 500) {
      const wait = 1500 * attempt;
      console.warn(`  retry ${attempt}/4 after HTTP ${response.status}; waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    fail(`${line.id}/${take.slug}: HTTP ${response.status} ${body.slice(0, 300)}`);
  }
  fail(`${line.id}/${take.slug}: gave up after 4 attempts`);
}

mkdirSync(outDir, {recursive: true});
const lines = orderedLines();
if (!lines.length) fail('no lines matched --only');

if (dryRun) {
  let total = 0;
  for (const line of lines) {
    for (const take of line.takes) {
      total += 1;
      console.log(`would write ${line.id}--${take.slug}.mp3  ${take.voiceId}  ${line.speaker}`);
    }
  }
  console.log(`${total} takes across ${lines.length} lines; output ${outDir}`);
  process.exit(0);
}

if (checkOnly) {
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const problems = [];
  for (const entry of manifest?.takes ?? []) {
    const file = join(outDir, entry.file);
    if (!existsSync(file)) problems.push(`${entry.file}: missing`);
  }
  if (!manifest?.takes?.length) problems.push('manifest has no takes');
  if (problems.length) {
    for (const problem of problems) console.error(`  fail  ${problem}`);
    process.exit(1);
  }
  console.log(
    `voice takes: ${manifest.takes.length} files verified, ${manifest.skipped?.length ?? 0} skipped by the provider`,
  );
  process.exit(0);
}

const takes = [];
const skipped = [];
for (const line of lines) {
  for (const take of line.takes) {
    const result = await speak(line, take);
    if (result.skipped) skipped.push(result);
    else takes.push(result);
    await new Promise((r) => setTimeout(r, 350));
  }
}
if (!takes.length) fail('every take was skipped; nothing was written');

const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const merged = new Map((previous?.takes ?? []).map((t) => [t.file, t]));
for (const take of takes) merged.set(take.file, take);
const all = [...merged.values()].sort((a, b) => a.file.localeCompare(b.file));
const skippedMerged = new Map((previous?.skipped ?? []).map((t) => [`${t.lineId}--${t.take}`, t]));
for (const take of skipped) skippedMerged.set(`${take.lineId}--${take.take}`, take);
writeFileSync(
  manifestPath,
  `${JSON.stringify({version: 1, model: MODEL, outputFormat: OUTPUT_FORMAT, generated: new Date().toISOString().slice(0, 10), takes: all, skipped: [...skippedMerged.values()]}, null, 2)}\n`,
);
console.log(`wrote manifest.json  ${all.length} takes total  ${takes.length} new  ${skipped.length} skipped`);
