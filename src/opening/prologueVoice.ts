/**
 * Prologue narration: the recorded clips, the timeline built from their real
 * durations (assets/audio/prologue/clips.json) and the bundled mp3 URLs the
 * cinematic plays. Every URL is static because Vite cannot analyse a template
 * path.
 */
import manifest from '../../assets/audio/prologue/clips.json';
import {prologueTimeline,type PrologueClip} from './prologueTimeline';

export const PROLOGUE_CLIPS: PrologueClip[] = manifest.clips.map((clip): PrologueClip => ({
  id: clip.id,
  speaker: clip.speaker as PrologueClip['speaker'],
  text: clip.text,
  duration: clip.duration,
  file: clip.file,
  voiceId: clip.voiceId,
}));

const timeline = prologueTimeline(PROLOGUE_CLIPS);

export const PROLOGUE_LINES = timeline.lines;
export const PROLOGUE_TOTAL = timeline.total;

export const PROLOGUE_URLS: Record<string, URL> = {
  'prologue-1': new URL('../../assets/audio/prologue/prologue-1.mp3', import.meta.url),
  'prologue-2': new URL('../../assets/audio/prologue/prologue-2.mp3', import.meta.url),
  'prologue-3': new URL('../../assets/audio/prologue/prologue-3.mp3', import.meta.url),
  'prologue-4': new URL('../../assets/audio/prologue/prologue-4.mp3', import.meta.url),
  'prologue-5': new URL('../../assets/audio/prologue/prologue-5.mp3', import.meta.url),
};
