import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {compressionPlan,encodingRole} from './compress-audio.mjs';

const root=join(import.meta.dirname,'..');
const fixtureDir=join(root,'.scratch/audio-compression-check');
await mkdir(fixtureDir,{recursive:true});
const sampleRate=44_100,channels=2,frames=4_410,dataBytes=frames*channels*2;
const wav=Buffer.alloc(44+dataBytes);
wav.write('RIFF',0);wav.writeUInt32LE(36+dataBytes,4);wav.write('WAVE',8);wav.write('fmt ',12);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(channels,22);wav.writeUInt32LE(sampleRate,24);
wav.writeUInt32LE(sampleRate*channels*2,28);wav.writeUInt16LE(channels*2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(dataBytes,40);
for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++)wav.writeInt16LE(Math.round(Math.sin(frame/sampleRate*Math.PI*2*220)*4_000),44+(frame*channels+channel)*2);
const voicePath=join(fixtureDir,'staff_prologue_line.wav');
await writeFile(voicePath,wav);

assert.equal(encodingRole('/score/music/theme.wav'),'music');
assert.equal(encodingRole('/audio/campus/campus-breeze.wav'),'ambience');
assert.equal(encodingRole('/audio/select.wav'),'effects');
assert.equal(encodingRole(voicePath),'voice','spoken prologue/dialogue/line basenames use the voice role');
const plan=await compressionPlan(voicePath);
assert.equal(plan.role,'voice');
assert.equal(plan.bitrate,128,'voice derivatives stay at 128 kbps');
assert.equal(plan.channels,1,'voice derivatives are mono');
assert.equal(plan.sampleRate,44_100,'44.1 kHz sources are not resampled');
assert.ok(plan.downmix?.includes('alimiter'),'stereo voice downmix remains peak-limited');
console.log('PASS music/ambience/effects/voice roles and 128 kbps mono voice plan');
