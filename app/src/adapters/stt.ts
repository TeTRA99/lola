// STT adapter — imperative addListener (NOT the useSpeechRecognitionEvent hook,
// which only works in a React render context). Per E1.4 validation report rev 2.

import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  AVAudioSessionCategory,
  AVAudioSessionMode,
} from 'expo-speech-recognition';
import { CONFIG } from '@/config';
import { ok, err, type Result } from '@/utils/result';
import { micOpenEarcon, micCloseEarcon } from '@/adapters/earcon';

// iOS leaves the audio session in `playAndRecord` + `measurement` mode after
// recognition, which routes playback to the quiet earpiece and shifts the sample
// rate — so every later TTS line comes out faint and sped-up (Describe, Ask,
// Guide all poisoned for the rest of the session). Reset to a plain playback
// session the moment recognition ends so Lola's voice is full-volume and natural.
// (No-op off iOS; the library only manages an AVAudioSession there.)
function restoreIOSPlaybackSession(): void {
  if (Platform.OS !== 'ios') return;
  try {
    ExpoSpeechRecognitionModule.setCategoryIOS({
      category: AVAudioSessionCategory.playback,
      categoryOptions: [],
      mode: AVAudioSessionMode.default,
    });
  } catch { /* best effort — never break the listen() result on a reset hiccup */ }
}

export type STTError =
  | 'permission_denied' | 'no_locale' | 'no_speech'
  | 'timeout' | 'engine_unavailable' | 'unknown';

export type ListenOptions = {
  hardCapMs?: number;
  /** Fired once when the mic is actually capturing audio (engine `audiostart`/
   *  `start`), i.e. the moment it's safe to start talking. Lets the caller delay
   *  the "Te escucho…" cue until the mic is truly open instead of guessing. */
  onReady?: () => void;
};

// If the engine emits neither `audiostart` nor `start` (rare), surface "ready"
// anyway after this long so the listening cue never gets stuck.
const READY_FALLBACK_MS = 1500;

// iOS-only: how long the "mic open" chime plays before the recognizer seizes the
// audio session. ≈ the chime length (mic-open.wav is ~210 ms) so it isn't cut.
const MIC_OPEN_EARCON_LEAD_MS = 220;

let resolvedLocale: string | null = null;
let activeAbort: (() => void) | null = null;

export function _resetForTests(): void {
  resolvedLocale = null;
  activeAbort = null;
}

async function resolveLocale(): Promise<string | null> {
  if (resolvedLocale) return resolvedLocale;
  try {
    // The library's getSupportedLocales requires options on Android (service package).
    // On iOS it's optional. Pass empty to let the platform default.
    const result = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    const langs = new Set(result.locales);
    console.log('[stt] supported locales:', JSON.stringify(result.locales));
    console.log('[stt] spanish-ish supported:', result.locales.filter(l => l.toLowerCase().startsWith('es')));
    const candidates = [CONFIG.STT_LOCALE, ...CONFIG.STT_LOCALE_FALLBACKS];
    resolvedLocale = candidates.find(loc => langs.has(loc)) ?? null;
    console.log('[stt] picked locale:', resolvedLocale);
    // Unlike TTS, STT *requires* engine support for the locale — returning
    // err('no_locale') is intentional (a "best-effort" STT would produce garbage).
  } catch (e) {
    console.log('[stt] getSupportedLocales threw:', e);
    resolvedLocale = null;
  }
  return resolvedLocale;
}

export async function listen(opts: ListenOptions = {}): Promise<Result<string, STTError>> {
  // Force re-resolve so each tap shows the supported locale dump in logs.
  resolvedLocale = null;
  let lang = await resolveLocale();
  if (!lang) {
    // Engine returned empty supported-locales list (common on Android when no
    // service package is specified). Try our configured locale anyway — most
    // engines accept it at start() even if they don't report it in getSupportedLocales.
    console.log('[stt] supported locales empty, trying CONFIG.STT_LOCALE directly:', CONFIG.STT_LOCALE);
    lang = CONFIG.STT_LOCALE;
  }

  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) return err('permission_denied');

  return new Promise<Result<string, STTError>>(resolve => {
    let transcript = '';
    let settled = false;
    let hardTimeout: ReturnType<typeof setTimeout> | null = null;

    // Declare subscriptions before the settle helper closes over them.
    let subResult: { remove: () => void } | null = null;
    let subEnd: { remove: () => void } | null = null;
    let subError: { remove: () => void } | null = null;
    let subStart: { remove: () => void } | null = null;
    let subAudioStart: { remove: () => void } | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    // Fire onReady exactly once — whichever of audiostart / start / fallback hits first.
    let readyFired = false;
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; }
      subStart?.remove();
      subAudioStart?.remove();
      try { opts.onReady?.(); } catch { /* never break listen() */ }
    };

    const settle = (r: Result<string, STTError>) => {
      if (settled) return;
      settled = true;
      if (hardTimeout) clearTimeout(hardTimeout);
      if (readyTimer) clearTimeout(readyTimer);
      try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
      restoreIOSPlaybackSession();
      // iOS: "mic closed" chime — plays AFTER the session is restored to playback
      // so it comes out full-volume on the speaker, not faint in record mode.
      micCloseEarcon();
      subResult?.remove();
      subEnd?.remove();
      subError?.remove();
      subStart?.remove();
      subAudioStart?.remove();
      activeAbort = null;
      resolve(r);
    };

    type ResultEvent = { results?: { transcript: string }[]; isFinal?: boolean };
    type ErrorEvent = { error?: string; message?: string };

    subResult = ExpoSpeechRecognitionModule.addListener('result', (e: ResultEvent) => {
      const t = e.results?.[0]?.transcript;
      if (t) transcript = t;
    });
    subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
      settle(transcript ? ok(transcript) : err('no_speech'));
    });
    subError = ExpoSpeechRecognitionModule.addListener('error', (e: ErrorEvent) => {
      const code = e.error ?? '';
      settle(err(code === 'not-allowed' ? 'permission_denied' : 'unknown'));
    });
    // Mic-open signals — the real "you can talk now" moment.
    subAudioStart = ExpoSpeechRecognitionModule.addListener('audiostart', fireReady);
    subStart = ExpoSpeechRecognitionModule.addListener('start', fireReady);

    activeAbort = () => settle(err('timeout'));

    const startRecognizer = () => {
      if (settled) return; // aborted during the chime lead
      try {
        console.log('[stt] starting with lang:', lang);
        ExpoSpeechRecognitionModule.start({
          lang,
          interimResults: false,
          continuous: false,
          requiresOnDeviceRecognition: false,
        });
      } catch (e) {
        console.log('[stt] start threw:', e);
        settle(err('engine_unavailable'));
        return;
      }
      readyTimer = setTimeout(fireReady, READY_FALLBACK_MS);
      hardTimeout = setTimeout(
        () => settle(err('timeout')),
        opts.hardCapMs ?? CONFIG.STT_HARD_CAP_MS,
      );
    };

    // iOS: play the "mic open" chime NOW, while the audio session is still
    // playback (loud), then start the recognizer after a short lead — once the
    // recognizer seizes the session in record/measurement mode the chime would be
    // suppressed (which is why the close chime works but the open one didn't).
    // The lead ≈ the chime length so it isn't cut by the session switch. Android
    // gets its open beep from the system recognizer, so start immediately there.
    if (Platform.OS === 'ios') {
      micOpenEarcon();
      readyTimer = setTimeout(startRecognizer, MIC_OPEN_EARCON_LEAD_MS);
    } else {
      startRecognizer();
    }
  });
}

export function abort(): void {
  if (activeAbort) {
    activeAbort();
  } else {
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    restoreIOSPlaybackSession();
  }
}
