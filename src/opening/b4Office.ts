import {B4_LIFT as L} from './spatialLayout';
import {LIFT, LIFT_LANDING, callLift, type LiftBox} from './lift';

/**
 * The fifth-floor principal's office and the three abduction beats (Task E).
 *
 * Everything here is measured from Task D's landing (`LIFT_LANDING`): the office hangs off the
 * corridor's closed door, so its floor, ceiling and door share the landing's planes and no
 * value is restated. Collision is a box list mounted by `navigation.ts` next to the landing's,
 * and the room's shell is rendered by `b4Shell.ts` from the same list.
 *
 * The beats are **state**, not timers: each fires once, latches, and is readable through
 * `officeDebug()`. Nothing is gated on elapsed time — the 30–45 s traversal is an outcome, not
 * a stopwatch. `tickOffice` is called from `openingSupport` with the queried point, the same
 * one hook the lift uses, so the beats advance at simulation rate with no per-frame owner.
 */

const WALL = L.wall;
/** Keep neighbouring collision boxes touching without sharing a plane (same trick as lift.ts). */
const HAIR = 1e-6;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const doorX0 = LIFT_LANDING.corridorX1;                 // 55.13, the corridor's end wall
const doorX1 = doorX0 + WALL;                           // 55.25
const zMid = (L.z0 + L.z1) / 2;                         // 12.40, the doorway centre
const floorTop = LIFT_LANDING.floorTop;                 // 18.90
const ceilBottom = LIFT_LANDING.ceilBottom;             // 21.50

/** The office interior: 5.0 m deep behind the door, 6.0 m across, the landing's clear height. */
const interior = {
 x0: doorX1, x1: doorX1 + 5.0,
 z0: zMid - 3.0, z1: zMid + 3.0,
} as const;

const desk = {x0: interior.x1 - 1.95, x1: interior.x1 - 1.15, z0: zMid - .90, z1: zMid + .90, h: .76} as const;
const shelf = {x0: interior.x0 + 1.05, x1: interior.x0 + 3.05, z0: interior.z0 + .05, z1: interior.z0 + .45, h: 2.00} as const;
const chair = {x: desk.x0 - .55, z: zMid, size: .54, seat: .46} as const;
const laptop = {x: (desk.x0 + desk.x1) / 2, z: zMid, y: floorTop + desk.h + .02} as const;

export const B4_OFFICE = {
 revision: 'opening-2030-v9-office',
 floorTop, ceilBottom, wall: WALL,
 door: {x0: doorX0, x1: doorX1, z0: LIFT_LANDING.officeZ0, z1: LIFT_LANDING.officeZ1, height: L.officeDoor.height, centre: zMid},
 interior, desk, shelf, chair, laptop,
 /**
  * Where the player stands to pick the MacBook up: directly south of the desk, facing north
  * across it. Not `desk.x0 - .45` — that lands on the chair, which is what turns the approach
  * into a step around it.
  */
 laptopStand: {x: laptop.x, z: desk.z1 + .55},
 /** Wall-mounted CCTV on the lobby's west wall, between the side door and the lift door. */
 cctv: {x: L.x1 + .015, z: 16.00, y: 1.92, w: .90, h: .54, tilt: -.42},
 /** The volume in front of the screen that fires beat 1. */
 cctvTrigger: {x0: L.x1 + .07, x1: L.x1 + 2.2, z0: 14.3, z1: 17.7},
 /** Ground call button, south of the lift doorway. */
 callGround: {x: L.x1 + .02, z: L.door.z1 + .35, y: 1.15, radius: .70},
 /** 5F call point: on the corridor's south wall, a step past the lobby mouth, so the car can
  * be called back down from the office side as well as from the car. */
 call5f: {x: LIFT_LANDING.lobbyX1 + .45, z: LIFT_LANDING.corridorZ1 - .40, y: L.landing + 1.15, radius: .95},
 /** Beat 3's volume: the 5F corridor, before the office door. */
 corridorTrigger: {x0: LIFT_LANDING.lobbyX1 + .2, x1: LIFT_LANDING.corridorX1 - .2, z0: LIFT_LANDING.corridorZ0 + .1, z1: LIFT_LANDING.corridorZ1 - .1},
 /**
  * The shaft's 5F landing guard. Task D leaves the doorway open when the car is elsewhere; at
  * the 5F plate that is an 18.9 m drop, so a leaf closes it whenever the car is away. It sits
  * 1 cm west of the plate edge so it never overlaps the landing footprint.
  */
 shaftGuard: {x0: L.x1 - .05, x1: L.x1, z0: L.z0, z1: L.z1},
} as const;

/* ------------------------------------------------------------------ */
/* Collision                                                           */
/* ------------------------------------------------------------------ */

/** Walkable office footprint: the floor box `b4OfficeBoxes()` mounts, threshold included. */
export function officeFloorContains(x: number, z: number): boolean {
 return x >= doorX0 && x <= interior.x1 && z >= interior.z0 && z <= interior.z1;
}

/** The office shell, its furniture and the 5F shaft guard: the boxes `navigation.ts` mounts. */
export function b4OfficeBoxes(): LiftBox[] {
 const {x0, x1, z0, z1} = interior, out: LiftBox[] = [];
 const push = (name: string, bx0: number, bx1: number, bz0: number, bz1: number, bottom: number, top: number) => {
  if (bx1 - bx0 > HAIR && bz1 - bz0 > HAIR && top - bottom > HAIR) out.push({name, x0: bx0, x1: bx1, z0: bz0, z1: bz1, bottom, top});
 };
 // Floor starts at the door wall so there is no gap in the threshold.
 push('opening-office-floor', doorX0, x1, z0, z1, floorTop - .30, floorTop);
 push('opening-office-wall-north', x0, x1, z0 - WALL, z0, floorTop, ceilBottom);
 push('opening-office-wall-south', x0, x1, z1, z1 + WALL, floorTop, ceilBottom);
 push('opening-office-wall-east', x1, x1 + WALL, z0 - WALL, z1 + WALL, floorTop, ceilBottom);
 push('opening-office-ceiling', doorX0, x1 + WALL, z0 - WALL, z1 + WALL, ceilBottom, ceilBottom + WALL);
 push('opening-office-desk', desk.x0, desk.x1, desk.z0, desk.z1, floorTop, floorTop + desk.h);
 push('opening-office-shelf', shelf.x0, shelf.x1, shelf.z0, shelf.z1, floorTop, floorTop + shelf.h);
 push('opening-office-chair', chair.x - chair.size / 2, chair.x + chair.size / 2, chair.z - chair.size / 2, chair.z + chair.size / 2, floorTop, floorTop + chair.seat);
 push('opening-office-shaft-guard', B4_OFFICE.shaftGuard.x0, B4_OFFICE.shaftGuard.x1, B4_OFFICE.shaftGuard.z0, B4_OFFICE.shaftGuard.z1, floorTop, ceilBottom);
 return out;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/** Wall-clock seconds (`performance.now()`), the same clock `lift.ts` rides on. */
function nowSeconds(): number {
 return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

export type OfficeBeat = 'lobby_feed' | 'feed_dies' | 'corridor_sound';
interface OfficeState {
 doorOpen: boolean;
 beats: Record<OfficeBeat, number | null>;
 /** The screen's last drawn frame and when it was drawn, so the feed animates without a frame loop. */
 feedFrame: number;
 feedDrawnAt: number;
 feedDead: boolean;
 startedAt: number;
}
const state: OfficeState = {
 doorOpen: false,
 beats: {lobby_feed: null, feed_dies: null, corridor_sound: null},
 feedFrame: 0, feedDrawnAt: -1, feedDead: false, startedAt: nowSeconds(),
};

/** Everything the gate reads. Plain data: no functions, no class instances. */
export function officeDebug() {
 return {
  revision: B4_OFFICE.revision,
  doorOpen: state.doorOpen,
  beats: {...state.beats},
  beatOrder: (Object.entries(state.beats) as [OfficeBeat, number | null][])
   .filter(([, at]) => at !== null).sort((a, b) => a[1]! - b[1]!).map(([name]) => name),
  feed: state.feedDead ? 'dead' : state.beats.lobby_feed === null ? 'idle' : 'playing',
  lift: {phase: LIFT.phase, y: +LIFT.y.toFixed(4), doors: +LIFT.doors.toFixed(3), call: LIFT.call},
  geometry: {
   door: B4_OFFICE.door, interior: B4_OFFICE.interior, laptop: B4_OFFICE.laptop,
   cctv: B4_OFFICE.cctv, callGround: B4_OFFICE.callGround, call5f: B4_OFFICE.call5f,
  },
 };
}

/* ------------------------------------------------------------------ */
/* Visuals (registered by b4Shell; absent in Node)                     */
/* ------------------------------------------------------------------ */

export interface OfficeVisual {
 /** The office door's hinge group: rotating it swings the leaf into the office. */
 doorHinge?: {rotation: {y: number}};
 /** The CCTV screen: a canvas the office redraws, or a plain material when there is no DOM. */
 screen?: {canvas?: HTMLCanvasElement; texture?: {needsUpdate: boolean}; material?: {emissiveIntensity: number}};
 /** The two call plates, lit while their call is pending. */
 callGround?: {material?: {emissiveIntensity: number}};
 call5f?: {material?: {emissiveIntensity: number}};
 /** The car's small screen, which carries the dying feed between floors. */
 carScreen?: {material?: {emissiveIntensity: number}};
}
let visual: OfficeVisual = {};

export function attachOfficeVisual(next: OfficeVisual): void {
 visual = {...visual, ...next};
 syncCallLamps();
 syncDoorVisual();
 drawFeed(true);
}

/** The cue sink `experience.ts` registers so a beat can use the game's own mixer. */
let cue: ((name: string, position?: [number, number, number]) => void) | null = null;
export function setOfficeCue(fn: typeof cue): void { cue = fn; }

/* ------------------------------------------------------------------ */
/* The beats                                                           */
/* ------------------------------------------------------------------ */

function fire(beat: OfficeBeat): void {
 if (state.beats[beat] !== null) return;                    // latches: once, ever
 state.beats[beat] = +(nowSeconds() - state.startedAt).toFixed(3);
 if (beat === 'feed_dies') {
  state.feedDead = true;
  drawFeed(true);
  cue?.('sfx_glitch_burst', [B4_OFFICE.cctv.x, B4_OFFICE.cctv.y, B4_OFFICE.cctv.z]);
 } else if (beat === 'lobby_feed') {
  cue?.('robot_servo_loop', [B4_OFFICE.cctv.x, B4_OFFICE.cctv.y, B4_OFFICE.cctv.z]);
 } else {
  // Placeholder abduction sound: a distant servo, then a door. Phase 2's SFX pass replaces both.
  cue?.('robot_servo_loop', [LIFT_LANDING.corridorX1 - .5, floorTop + 1.2, zMid]);
  cue?.('ui_cancel', [LIFT_LANDING.corridorX1 - .5, floorTop + 1.2, zMid]);
 }
}

const inside = (x: number, z: number, r: {x0: number; x1: number; z0: number; z1: number}) =>
 x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/**
 * Advance the office from one world query. `x,z,y` is the queried point, the same one the lift
 * uses: a player standing in a trigger volume is enough, so no input or frame hook is needed.
 */
export function tickOffice(x: number, z: number, y: number): void {
 const atGround = Math.abs(y - L.ground) <= .30;
 const atFifth = Math.abs(y - floorTop) <= .30;
 // Beat 1: the first clear look at the screen walking in from the side door.
 if (atGround && inside(x, z, B4_OFFICE.cctvTrigger)) fire('lobby_feed');
 // Beat 2: the feed dies the moment the car's doors start to close.
 if (state.beats.lobby_feed !== null && LIFT.phase === 'doors-closing') fire('feed_dies');
 // Beat 3: the corridor carries it by sound, before the office door.
 if (atFifth && inside(x, z, B4_OFFICE.corridorTrigger)) fire('corridor_sound');

 // Call points. `tickOffice` runs before `tickLift` in `openingSupport`, so a press set here
 // is honoured by the same frame's lift step.
 if (atGround && Math.hypot(x - B4_OFFICE.callGround.x, z - B4_OFFICE.callGround.z) <= B4_OFFICE.callGround.radius) callLift('ground');
 if (atFifth && Math.hypot(x - B4_OFFICE.call5f.x, z - B4_OFFICE.call5f.z) <= B4_OFFICE.call5f.radius) callLift('top');

 syncShaftGuard();
 syncCallLamps();
 syncDoorVisual();
 animateFeed();
}

/* ------------------------------------------------------------------ */
/* Door, guard, lamps                                                  */
/* ------------------------------------------------------------------ */

/** Open the office door. Returns false when it is already open. */
export function openOfficeDoor(): boolean {
 if (state.doorOpen) return false;
 state.doorOpen = true;
 cue?.('ui_confirm', [B4_OFFICE.door.x0, floorTop + 1.1, zMid]);
 syncDoorObstacle();
 syncDoorVisual();
 return true;
}

/** Close it again on a restart, so a fresh run starts at a closed office. */
export function resetOffice(): void {
 state.doorOpen = false;
 state.beats = {lobby_feed: null, feed_dies: null, corridor_sound: null};
 state.feedDead = false;
 state.feedFrame = 0;
 state.feedDrawnAt = -1;
 state.startedAt = nowSeconds();
 syncDoorObstacle();
 syncDoorVisual();
 syncCallLamps();
 drawFeed(true);
}

let doorObstacles: {obstacles: {name: string; x: number; z: number; w: number; d: number; bottom: number; top: number}[]; door: unknown; guard: unknown} | null = null;

/**
 * Capture the two obstacles the office animates, after `navigation.ts` has mounted them.
 * Both are rewritten in place, exactly like the lift's car, so nothing is rebuilt.
 */
export function installOffice(obstacles: {name: string; x: number; z: number; w: number; d: number; bottom: number; top: number}[]): void {
 const door = obstacles.find(o => o.name === 'opening-lift-5f-office-door') ?? null;
 const guard = obstacles.find(o => o.name === 'opening-office-shaft-guard') ?? null;
 doorObstacles = {obstacles, door, guard};
 syncDoorObstacle();
 syncShaftGuard();
}

function syncDoorObstacle(): void {
 const o = doorObstacles?.door as {x: number; z: number; w: number; d: number; bottom: number; top: number} | null | undefined;
 if (!o) return;
 if (state.doorOpen) { o.bottom = floorTop; o.top = floorTop; }     // no height, no collision
 else { o.bottom = floorTop; o.top = floorTop + L.officeDoor.height; }
}

function syncShaftGuard(): void {
 const o = doorObstacles?.guard as {bottom: number; top: number} | null | undefined;
 if (!o) return;
 // The car is at 5F: the doorway is a doorway. Anywhere else it is an 18.9 m drop.
 const carAtTop = Math.abs(LIFT.y - floorTop) <= .30;
 o.bottom = floorTop;
 o.top = carAtTop ? floorTop : ceilBottom;
}

/** The leaf swings 1.35 rad into the office; the hinge sits on the north jamb. */
const DOOR_SWING = -1.35;
function syncDoorVisual(): void {
 if (visual.doorHinge) visual.doorHinge.rotation.y = state.doorOpen ? DOOR_SWING : 0;
}

function syncCallLamps(): void {
 const ground = LIFT.call === 'ground' && Math.abs(LIFT.y - L.ground) > .30;
 const top = LIFT.call === 'top' && Math.abs(LIFT.y - floorTop) > .30;
 if (visual.callGround?.material) visual.callGround.material.emissiveIntensity = ground ? 1.4 : .25;
 if (visual.call5f?.material) visual.call5f.material.emissiveIntensity = top ? 1.4 : .25;
 if (visual.carScreen?.material) visual.carScreen.material.emissiveIntensity = state.feedDead ? 1.6 : 0;
}

/* ------------------------------------------------------------------ */
/* The feed (a procedural canvas texture, never a second render pass)  */
/* ------------------------------------------------------------------ */

const FEED_FPS = 8;

/** Redraw the monitor's canvas: robots walking people out of frame, left to right. */
function drawFeed(force = false): void {
 const screen = visual.screen;
 const canvas = screen?.canvas;
 if (!canvas || !screen) return;
 const now = nowSeconds();
 if (!force && now - state.feedDrawnAt < 1 / FEED_FPS) return;
 state.feedDrawnAt = now;
 state.feedFrame += 1;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;
 const w = canvas.width, h = canvas.height, f = state.feedFrame;
 ctx.fillStyle = '#05080a';
 ctx.fillRect(0, 0, w, h);
 if (state.feedDead) {
  // Cut to static: the feed is gone, the screen is not.
  for (let i = 0; i < 260; i++) {
   const v = Math.random() * 70 + 8;
   ctx.fillStyle = `rgb(${v},${v + 6},${v + 8})`;
   ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2);
  }
  screen.texture!.needsUpdate = true;
  return;
 }
 // Perspective floor and a back wall, so the frame reads as a corridor camera.
 ctx.fillStyle = '#0d1214';
 ctx.fillRect(0, 0, w, h * .62);
 ctx.fillStyle = '#1b2226';
 for (let i = 0; i < 6; i++) ctx.fillRect(0, h * .62 + i * (h * .38 / 6), w, 1);
 ctx.fillStyle = '#2a2118';
 ctx.fillRect(0, 0, w, h * .62);
 ctx.fillStyle = '#151b1e';
 ctx.fillRect(0, h * .25, w, h * .37);
 // Four students, two robots, all drifting right at slightly different speeds.
 const drift = (f * 2.1) % (w + 90);
 for (let i = 0; i < 4; i++) {
  const x = ((drift + i * 58) % (w + 90)) - 45;
  const base = h * .60 + (i % 2) * 6;
  ctx.fillStyle = i % 2 ? '#8e97a0' : '#a8b0b8';
  ctx.fillRect(x, base - 26, 7, 26);                      // body
  ctx.beginPath(); ctx.arc(x + 3.5, base - 31, 4, 0, Math.PI * 2); ctx.fill();  // head
  ctx.strokeStyle = '#8e97a0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 1, base - 6); ctx.lineTo(x + 1, base); ctx.moveTo(x + 6, base - 6); ctx.lineTo(x + 6, base); ctx.stroke();
 }
 for (let i = 0; i < 2; i++) {
  const x = ((drift + 40 + i * 120) % (w + 120)) - 60;
  const base = h * .60 + 2;
  ctx.fillStyle = '#20272b';
  ctx.fillRect(x, base - 40, 11, 40);                     // taller, squarer
  ctx.fillStyle = '#20272b'; ctx.fillRect(x + 1, base - 46, 9, 7);   // head unit
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(x + 3, base - 44, 5, 2);   // eye
  ctx.strokeStyle = '#20272b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 4, base - 30); ctx.lineTo(x + 14, base - 34); ctx.stroke();  // arm out
 }
 // Scanlines and a timestamp, so it reads as CCTV rather than as a poster.
 ctx.fillStyle = 'rgba(0,0,0,.22)';
 for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
 ctx.fillStyle = 'rgba(255,255,255,.55)';
 ctx.font = '7px monospace';
 ctx.fillText(`CAM 05  ${String(18 + Math.floor(f / 60)).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`, 4, h - 4);
 ctx.fillStyle = '#ff3b30';
 ctx.beginPath(); ctx.arc(w - 8, 6, 2.4, 0, Math.PI * 2); ctx.fill();
 screen.texture!.needsUpdate = true;
}

/** The feed keeps drawing only while the page is up: no renderer, no second pass. */
function animateFeed(): void {
 if (state.feedDead) return;
 drawFeed();
}
