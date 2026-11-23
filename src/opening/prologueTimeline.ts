/**
 * Prologue narration timeline: the five recorded lines play back to back with
 * a short gap between them. Pure data math so the cinematic and the check
 * script agree on exactly when each line starts and the narration ends.
 */
export const PROLOGUE_GAP = 0.35;

export interface PrologueClip {
  id: string;
  speaker: 'narrator' | 'player';
  text: string;
  duration: number;
  file: string;
  voiceId: string;
}

export interface PrologueLine extends PrologueClip {
  start: number;
  end: number;
}

/** Lays the clips out in order: first at 0, each next one gap seconds after the
 * previous end. Total is the end of the last line; audioTotal is the recorded
 * time without gaps. A clip with no usable duration is a data error. */
export function prologueTimeline(
  clips: PrologueClip[],
  gap = PROLOGUE_GAP,
): {lines: PrologueLine[]; total: number; audioTotal: number} {
  const lines: PrologueLine[] = [];
  let cursor = 0;
  let audioTotal = 0;
  for (const clip of clips) {
    if (!Number.isFinite(clip.duration) || clip.duration < 0) {
      throw new Error(`prologue clip ${clip.id} has no valid duration`);
    }
    lines.push({...clip, start: cursor, end: cursor + clip.duration});
    cursor += clip.duration + gap;
    audioTotal += clip.duration;
  }
  return {lines, total: lines.length ? lines[lines.length - 1].end : 0, audioTotal};
}
