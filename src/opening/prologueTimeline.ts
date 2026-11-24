/**
 * Prologue narration timeline: the four recorded lines play back to back with
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

/* ------------------------------------------------------------------ */
/* One-shot camera path                                                */
/* ------------------------------------------------------------------ */

export type Vec3 = [number, number, number];

/** A timed waypoint of the single continuous prologue take. `t` is prologue
 * clock seconds; `look` is the point the camera aims at. The first waypoint is
 * the aerial, the last is exactly the player's spawn pose, so control resumes
 * without a camera jump. */
export interface PrologueWaypoint {
  t: number;
  position: Vec3;
  look: Vec3;
}

export interface PrologueSpawnPose {
  position: Vec3;
  look: Vec3;
}

/**
 * The owner-approved one-take route (docs/plans/2026-11-23-prologue-story.md):
 * sunset aerial over the light show → descend the B4 approach → through the B4
 * south doorway → low along the server racks → close pass over the Keyboard
 * Wall → out the same doorway → low across the campus → through the B5 south
 * doorway and the lobby partition → dinner hall and dais → out of B5 → rise
 * over the dusk campus → settle on the spawn pose.
 *
 * Beat times are read from the recorded narration windows, so a re-record keeps
 * the shots on their lines. The waypoints are plain numbers: no three.js in
 * this module, so `scripts/check-prologue-path.ts` can sample the same table.
 *
 * Coordinates come from `spatialLayout.ts` where a door or room constant exists:
 * B4 south doorway (58, 20.5; cut to 22.95), B5 south doorway (58, −54.7; cut
 * z −58…−53.8), the B5 lobby partition opening (x 60, z −63…−57.6) and the
 * dinner-hall aisle between the table rows.
 */
export function prologuePath(
  lines: readonly {start: number; end: number}[],
  spawn: PrologueSpawnPose,
): PrologueWaypoint[] {
  const at = (line: number, fraction: number): number => {
    const window = lines[Math.min(line, lines.length - 1)];
    return window.start + (window.end - window.start) * fraction;
  };
  // Four recorded lines are the contract; a different count is a data error,
  // not a silently wrong camera.
  if (lines.length !== 4) throw new Error(`prologue path expects 4 narration lines, got ${lines.length}`);
  return [
    // Line 1 — the aerial. It sits in the central gap between the two tower
    // columns (the columns are centred on x = ±58, so the gap is x −28…28) and
    // looks north down it: B2/B3 bracket the right, B1/B4 the left, and the plaza
    // sits at the far end under the mesh. The first version stood south of B3 at
    // (30, 82, 118) looking at (12, 26, −18); from there B3's roof filled the
    // right half of the frame and the look pitched 22° down, which left 4° of
    // sky — the owner's "开场有问题", and the rooftop terrace in his screenshot.
    // The sight line stays inside the gap for its whole length, so no south
    // tower's roof can occlude the plaza. The descent stays above the B3 roof
    // (66.15 m) until it is south of the tower.
    {t: 0, position: [-16, 132, 246], look: [26, 32, -46]},
    {t: at(0, 0.22), position: [-6, 126, 216], look: [28, 30, -44]},
    {t: at(0, 0.5), position: [14, 108, 164], look: [30, 26, -42]},
    {t: at(0, 0.78), position: [38, 87, 106], look: [30, 17, -20]},
    {t: at(0, 1), position: [52, 73, 60], look: [34, 11, 10]},

    // Line 2 — mesh die-shot, then the dive into B4, the server racks, the
    // volumetric shaft and the Keyboard Wall. The dive stays above the B3 roof
    // (66.15 m) until the camera is south of the tower.
    {t: at(1, 0.04), position: [57, 70, 50], look: [52, 12, 28]},
    {t: at(1, 0.1), position: [59, 50, 45], look: [56, 8, 26]},
    {t: at(1, 0.14), position: [60, 32, 41], look: [58, 5, 24]},
    {t: at(1, 0.2), position: [60, 22, 39], look: [58, 4, 24]},
    {t: at(1, 0.3), position: [58.4, 9, 32], look: [58, 2.2, 21]},
    {t: at(1, 0.4), position: [58, 3.4, 27.2], look: [58, 1.8, 18]},
    {t: at(1, 0.46), position: [58, 2.0, 23.6], look: [58, 1.5, 14]},
    {t: at(1, 0.53), position: [58, 1.8, 19.6], look: [55, 1.3, 10]},
    {t: at(1, 0.62), position: [54.6, 1.45, 13.4], look: [48, 1.15, 8.5]},
    {t: at(1, 0.72), position: [51.0, 1.25, 10.9], look: [47.5, 1.15, 8.4]},
    {t: at(1, 0.8), position: [48.4, 1.35, 10.7], look: [50.5, 1.3, 8.4]},
    {t: at(1, 0.86), position: [52.4, 1.65, 11.4], look: [58, 1.7, 12.0]},
    {t: at(1, 0.9), position: [56.0, 2.0, 13.4], look: [58, 2.0, 18]},
    {t: at(1, 0.94), position: [58.0, 2.2, 16.6], look: [58, 2.2, 24]},
    {t: at(1, 0.97), position: [58.0, 2.4, 19.8], look: [58, 2.3, 30]},
    {t: at(1, 1), position: [58.0, 2.5, 23.6], look: [58, 2.3, 34]},

    // Line 3 — out through the same B4 door, around the west side of the tower
    // (the walkable x 24 route), in through the B5 doorway and the lobby
    // partition, and down the dinner-hall aisle to the dais.
    {t: at(2, 0.03), position: [57.6, 2.45, 26.6], look: [55, 2.4, 33]},
    {t: at(2, 0.08), position: [56.4, 2.6, 30.6], look: [49, 2.9, 34]},
    {t: at(2, 0.14), position: [53.6, 2.9, 33.6], look: [41, 3.5, 31]},
    {t: at(2, 0.22), position: [47.0, 3.2, 34.5], look: [33, 3.5, 27]},
    {t: at(2, 0.3), position: [40.0, 3.6, 33.5], look: [26, 3.4, 22]},
    {t: at(2, 0.4), position: [24.0, 3.6, 28.0], look: [24, 3.0, -8]},
    {t: at(2, 0.52), position: [24.0, 3.2, 0.0], look: [32, 2.8, -36]},
    {t: at(2, 0.62), position: [24.0, 2.8, -24.0], look: [40, 2.5, -46]},
    {t: at(2, 0.7), position: [36.0, 2.6, -46.0], look: [52, 2.2, -52]},
    {t: at(2, 0.74), position: [50.0, 2.1, -51.0], look: [58, 2.0, -58]},
    {t: at(2, 0.78), position: [58.0, 1.9, -54.2], look: [58, 1.7, -62]},
    {t: at(2, 0.83), position: [58.2, 1.75, -58.6], look: [60.5, 1.6, -62]},
    {t: at(2, 0.87), position: [60.3, 1.7, -60.3], look: [67, 1.5, -64]},
    {t: at(2, 0.92), position: [64.5, 1.6, -62.5], look: [72, 1.4, -66]},
    {t: at(2, 0.96), position: [69.0, 1.55, -64.6], look: [76, 1.4, -68]},
    {t: at(2, 1), position: [72.0, 1.55, -66.6], look: [80, 1.5, -66.6]},

    // Line 4 — the dais and the long tables, then out of B5, a low rising sweep
    // around the west side of B4 and a decelerating settle on the spawn pose.
    {t: at(3, 0.05), position: [76.5, 1.7, -66.6], look: [80.5, 1.7, -66.6]},
    {t: at(3, 0.1), position: [79.4, 1.9, -65.4], look: [79, 1.8, -60]},
    {t: at(3, 0.16), position: [75.6, 2.1, -61.6], look: [70, 1.8, -56]},
    {t: at(3, 0.22), position: [68.0, 2.0, -60.6], look: [62, 1.7, -58]},
    {t: at(3, 0.28), position: [60.3, 1.8, -60.3], look: [58, 1.7, -55]},
    {t: at(3, 0.34), position: [58.0, 1.8, -56.0], look: [58, 1.9, -48]},
    {t: at(3, 0.4), position: [58.0, 2.6, -50.0], look: [56, 8, -42]},
    {t: at(3, 0.47), position: [54.0, 10.0, -45.0], look: [46, 18, -40]},
    {t: at(3, 0.54), position: [46.0, 16.0, -41.0], look: [34, 24, -36]},
    {t: at(3, 0.62), position: [36.0, 21.0, -35.0], look: [26, 26, -25]},
    {t: at(3, 0.7), position: [26.0, 23.0, -24.0], look: [24, 27, -6]},
    {t: at(3, 0.78), position: [24.0, 24.0, -4.0], look: [26, 26, 6]},
    {t: at(3, 0.84), position: [25.0, 23.0, 8.0], look: [30, 24, 24]},
    {t: at(3, 0.87), position: [25.5, 21.5, 19.0], look: [38, 20, 32]},
    {t: at(3, 0.9), position: [30.0, 17.0, 25.0], look: [46, 15, 31]},
    {t: at(3, 0.925), position: [37.0, 13.5, 26.0], look: [52, 11, 27]},
    {t: at(3, 0.95), position: [44.0, 10.0, 26.5], look: [56, 7, 24]},
    {t: at(3, 0.97), position: [50.0, 6.5, 26.0], look: [58, 4, 19]},
    {t: at(3, 0.985), position: [54.5, 3.6, 25.6], look: [58, 2.6, 15]},
    {t: at(3, 0.993), position: [56.4, 2.4, 25.3], look: [58, 2.1, 14]},
    {t: at(3, 1), position: [...spawn.position], look: [...spawn.look]},
  ];
}
