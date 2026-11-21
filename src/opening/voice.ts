import type {CampusAudio} from '../gameplay/audio';
import clipManifest from '../../assets/audio/npc/staff/clips.json';
import {STAFF_DIALOGUE} from '../../content/voice/staff-dialogue';

/**
 * Fixed-dialogue Staff voice player.
 *
 * The five clips come from one DaVinci AI / ElevenLabs TTS V3 take. They are
 * bundled files; the game never calls an online TTS service at runtime.
 *
 * The player owns its sequence/epoch so closing a panel, moving away or a new
 * line immediately cancels the old clip and any pending gap. It uses the
 * existing CampusAudio mixer, SFX volume, mute and 16-voice budget.
 */

type Point = {x: number; y: number; z: number};

export interface VoiceItem {
  id: string;
  url: URL;
  text: string;
  duration?: number;
}

export interface StaffVoicePlayOptions {
  eligible?: () => boolean;
  position?: (item: VoiceItem, index: number) => Point | null;
  gain?: number;
  onStart?: () => void;
  onItem?: (index: number, item: VoiceItem, duration: number) => void;
  onDone?: () => void;
  onError?: () => void;
}

export const STAFF_VOICE_URLS: Record<string, URL> = {
  'staff-line1': new URL('../../assets/audio/npc/staff/staff-line1.wav', import.meta.url),
  'staff-line2': new URL('../../assets/audio/npc/staff/staff-line2.wav', import.meta.url),
  'staff-line3': new URL('../../assets/audio/npc/staff/staff-line3.wav', import.meta.url),
  'staff-line4': new URL('../../assets/audio/npc/staff/staff-line4.wav', import.meta.url),
  'staff-line5': new URL('../../assets/audio/npc/staff/staff-line5.wav', import.meta.url),
};

export const PLAYER_ACCEPT_URL = new URL('../../assets/audio/opening-foley/player-accept-english.wav', import.meta.url);

const clipById = new Map(clipManifest.clips.map((clip) => [clip.id, clip]));

function item(id: string): VoiceItem {
  const clip = clipById.get(id);
  const url = STAFF_VOICE_URLS[id];
  if (!clip || !url) throw new Error(`Missing Staff voice clip: ${id}`);
  return {id, url, text: clip.text, duration: clip.duration};
}

const INTRO_GAP_SECONDS = 0.18;
const INTRO_ITEMS: readonly VoiceItem[] = [item('staff-line1'), item('staff-line2'), item('staff-line3')];
const THANKS_ITEM = item('staff-line4');
const REPEAT_ITEM = item('staff-line5');
const PLAYER_ACCEPT_ITEM: VoiceItem = {
  id: 'player-accept',
  url: PLAYER_ACCEPT_URL,
  text: STAFF_DIALOGUE.playerAccept,
  duration: 1.53,
};

/** Test-only surface: the exact text that is bundled with the generated clips. */
export const STAFF_VOICE_TEXT = {
  intro: INTRO_ITEMS.map((entry) => entry.text),
  thanks: THANKS_ITEM.text,
  repeat: REPEAT_ITEM.text,
  playerAccept: PLAYER_ACCEPT_ITEM.text,
} as const;

/** Timeline the subtitles follow; the audio player uses the same clips and gap. */
export const STAFF_INTRO_TIMING = {
  gap: INTRO_GAP_SECONDS,
  starts: [
    0,
    (INTRO_ITEMS[0].duration ?? 0) + INTRO_GAP_SECONDS,
    (INTRO_ITEMS[0].duration ?? 0) + INTRO_GAP_SECONDS + (INTRO_ITEMS[1].duration ?? 0) + INTRO_GAP_SECONDS,
  ],
  total: (INTRO_ITEMS[0].duration ?? 0) + (INTRO_ITEMS[1].duration ?? 0) + (INTRO_ITEMS[2].duration ?? 0) + INTRO_GAP_SECONDS * 2,
} as const;

class VoiceSequencePlayer {
  private epoch = 0;
  private current: {stop: () => void} | null = null;
  private waiters = new Set<() => void>();
  private cache = new Map<string, Promise<AudioBuffer>>();
  private disposed = false;

  constructor(private audio: CampusAudio) {}

  private async load(entry: VoiceItem): Promise<AudioBuffer> {
    const cached = this.cache.get(entry.id);
    if (cached) return cached;
    const context = this.audio.context;
    if (!context) throw new Error('Audio context is not ready');
    const promise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(entry.url, {signal: controller.signal});
        if (!response.ok) throw new Error(`voice_http_${response.status}`);
        return await context.decodeAudioData(await response.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }
    })();
    this.cache.set(entry.id, promise);
    promise.catch(() => this.cache.delete(entry.id));
    return promise;
  }

  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let timer = 0;
      const wake = () => {
        window.clearTimeout(timer);
        this.waiters.delete(wake);
        resolve();
      };
      timer = window.setTimeout(wake, ms);
      this.waiters.add(wake);
    });
  }

  stop(): void {
    this.epoch++;
    const current = this.current;
    this.current = null;
    current?.stop();
    for (const wake of [...this.waiters]) wake();
    this.waiters.clear();
    this.audio.setDialogueDuck(false);
  }

  private async playItems(items: readonly VoiceItem[], gapSeconds: number, options: StaffVoicePlayOptions): Promise<boolean> {
    if (this.disposed) return false;
    this.stop();
    const ticket = this.epoch;
    try {
      await this.audio.start();
      if (ticket !== this.epoch || document.hidden || options.eligible?.() === false) return false;
      const buffers = await Promise.all(items.map((entry) => this.load(entry)));
      if (ticket !== this.epoch || document.hidden || options.eligible?.() === false) return false;
      this.audio.setDialogueDuck(true);
      options.onStart?.();
      for (let index = 0; index < items.length; index++) {
        if (ticket !== this.epoch) return false;
        const entry = items[index];
        const buffer = buffers[index];
        options.onItem?.(index, entry, buffer.duration);
        const position = options.position?.(entry, index) ?? null;
        let resolveEnded: () => void = () => {};
        const ended = new Promise<void>((resolve) => {
          resolveEnded = resolve;
          this.waiters.add(resolve);
        });
        const handle = this.audio.playVoice(buffer, {
          position: position ?? undefined,
          gain: options.gain ?? 1,
          onended: () => {
            this.waiters.delete(resolveEnded);
            resolveEnded();
          },
        });
        if (!handle) {
          this.waiters.delete(resolveEnded);
          resolveEnded();
          this.audio.setDialogueDuck(false);
          options.onError?.();
          return false;
        }
        this.current = handle;
        await ended;
        if (ticket !== this.epoch) return false;
        this.current = null;
        if (index < items.length - 1) {
          await this.wait(gapSeconds);
          if (ticket !== this.epoch) return false;
        }
      }
      this.audio.setDialogueDuck(false);
      options.onDone?.();
      return true;
    } catch {
      if (ticket === this.epoch) {
        this.audio.setDialogueDuck(false);
        options.onError?.();
      }
      return false;
    }
  }

  playIntro(options: StaffVoicePlayOptions = {}): Promise<boolean> {
    return this.playItems(INTRO_ITEMS, INTRO_GAP_SECONDS, options);
  }

  playAcceptance(options: StaffVoicePlayOptions = {}): Promise<boolean> {
    return this.playItems([PLAYER_ACCEPT_ITEM, THANKS_ITEM], 0.35, options);
  }

  playRepeat(options: StaffVoicePlayOptions = {}): Promise<boolean> {
    return this.playItems([REPEAT_ITEM], 0, options);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.cache.clear();
  }
}

export function createStaffVoice(audio: CampusAudio) {
  const player = new VoiceSequencePlayer(audio);
  return {
    playIntro: (options?: StaffVoicePlayOptions) => player.playIntro(options),
    playAcceptance: (options?: StaffVoicePlayOptions) => player.playAcceptance(options),
    playRepeat: (options?: StaffVoicePlayOptions) => player.playRepeat(options),
    stop: () => player.stop(),
    dispose: () => player.dispose(),
  };
}

export type StaffVoice = ReturnType<typeof createStaffVoice>;
