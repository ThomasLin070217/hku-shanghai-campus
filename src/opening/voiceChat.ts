/**
 * Browser voice conversation for the MacBook assistant.
 *
 * Speech recognition and speech synthesis are deliberately local to the
 * browser: the project ships generated Staff clips for fixed dialogue, and the
 * chat model is reached through the existing on-device endpoint. No new key or
 * online TTS service is required for the microphone and the spoken replies.
 */

export interface VoiceState {
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  interim: string;
  error: string | null;
}

export interface VoiceChatOptions {
  language?: string | (() => string);
  onState?: (state: VoiceState) => void;
  onTranscript?: (text: string, final: boolean) => void;
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{isFinal: boolean; 0: {transcript: string}}>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: {error?: string}) => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

const hasCJK = (text: string) => /[\u3400-\u9fff]/.test(text);

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow it in the browser to speak.',
  'service-not-allowed': 'Voice recognition is blocked in this browser.',
  'no-speech': 'I did not hear anything. Try again.',
  'audio-capture': 'No microphone was found.',
  network: 'The browser could not reach its speech service.',
  aborted: '',
};

function detectionLanguage(): string {
  const tag = (typeof navigator !== 'undefined' ? navigator.language : '') || 'zh-CN';
  return tag.toLowerCase().startsWith('zh') ? 'zh-CN' : tag;
}

export function createVoiceChat(options: VoiceChatOptions = {}) {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const ctor: RecognitionCtor | null =
    typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition as RecognitionCtor | undefined) ??
        ((window as unknown as Record<string, unknown>).webkitSpeechRecognition as RecognitionCtor | undefined) ??
        null
      : null;
  let recognition: RecognitionLike | null = null;
  let listening = false;
  let speaking = false;
  let interim = '';
  let error: string | null = null;
  let disposed = false;
  let voices: SpeechSynthesisVoice[] = [];

  const language = () => {
    const value = typeof options.language === 'function' ? options.language() : options.language;
    return value || detectionLanguage();
  };
  const state = (): VoiceState => ({supported: Boolean(ctor || synth), listening, speaking, interim, error});
  const emit = () => { if (!disposed) options.onState?.(state()); };

  function refreshVoices() {
    if (!synth) return;
    try { voices = synth.getVoices().filter(Boolean); } catch { voices = []; }
  }
  if (synth) {
    refreshVoices();
    try { synth.addEventListener('voiceschanged', refreshVoices); } catch { /* Older Safari. */ }
  }

  function chooseVoice(text: string): SpeechSynthesisVoice | undefined {
    const lang = hasCJK(text) ? 'zh-cn' : 'en';
    const candidates = voices.filter(voice => voice.lang.toLowerCase().startsWith(lang));
    if (!candidates.length) return undefined;
    const preferred = [
      // The Staff voice is Asher; these are the closest distinct system voices.
      'daniel', 'alex', 'asher', 'google uk english male', 'google us english',
      'tingting', 'ting-ting', 'meijia', 'samantha',
    ];
    for (const name of preferred) {
      const match = candidates.find(voice => voice.name.toLowerCase().includes(name));
      if (match) return match;
    }
    return candidates.find(voice => voice.localService) ?? candidates[0];
  }

  function start() {
    if (disposed) return;
    if (!ctor) {
      error = 'This browser has no speech recognition. Type the message instead.';
      emit();
      return;
    }
    cancelSpeech();
    try { recognition?.abort(); } catch { /* Already stopped. */ }
    const next = new ctor();
    recognition = next;
    next.lang = language();
    next.continuous = false;
    next.interimResults = true;
    next.maxAlternatives = 1;
    next.onstart = () => { listening = true; interim = ''; error = null; emit(); };
    next.onresult = event => {
      let finalText = '', draft = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += text; else draft += text;
      }
      interim = draft || finalText;
      if (draft) options.onTranscript?.(draft, false);
      if (finalText.trim()) options.onTranscript?.(finalText.trim(), true);
      emit();
    };
    next.onerror = event => {
      const code = event.error ?? 'error';
      error = ERROR_TEXT[code] ?? 'Voice recognition failed.';
      listening = false;
      interim = '';
      emit();
    };
    next.onend = () => {
      listening = false; interim = ''; recognition = null;
      emit();
    };
    try { next.start(); } catch {
      error = 'The microphone is busy. Try again in a moment.';
      listening = false; emit();
    }
  }

  function stop() {
    if (!recognition) return;
    try { recognition.stop(); } catch { /* Already ended. */ }
  }

  function cancelSpeech() {
    if (!synth) return;
    try { synth.cancel(); } catch { /* Nothing speaking. */ }
    if (speaking) { speaking = false; emit(); }
  }

  function speak(text: string) {
    if (!synth || disposed) return false;
    const clean = text
      .replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, ' code block ')
      .replace(/[*_#>`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return false;
    refreshVoices();
    cancelSpeech();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 800));
    const voice = chooseVoice(clean);
    if (voice) utterance.voice = voice;
    utterance.lang = hasCJK(clean) ? 'zh-CN' : 'en-US';
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    utterance.onstart = () => { speaking = true; emit(); };
    utterance.onend = () => { speaking = false; emit(); };
    utterance.onerror = () => { speaking = false; emit(); };
    try { synth.speak(utterance); return true; } catch {
      speaking = false; emit(); return false;
    }
  }

  function dispose() {
    disposed = true;
    try { recognition?.abort(); } catch { /* Already ended. */ }
    recognition = null;
    cancelSpeech();
    try { synth?.removeEventListener('voiceschanged', refreshVoices); } catch { /* Older Safari. */ }
  }

  return {
    start, stop, toggle(){ if (listening) stop(); else start(); },
    speak, cancelSpeech, dispose,
    get listening(){ return listening; },
    get speaking(){ return speaking; },
    get supported(){ return Boolean(ctor || synth); },
    get listeningSupported(){ return Boolean(ctor); },
    get speakingSupported(){ return Boolean(synth); },
    state,
  };
}
export type VoiceChat = ReturnType<typeof createVoiceChat>;
