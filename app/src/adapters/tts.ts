// TTS adapter — voice persona consistency (FR-6.3) is enforced by always
// resolving locale through CONFIG.TTS_LOCALE + fallbacks and always defaulting
// to CONFIG.TTS_RATE. Consumers may override rate per-call but should not
// pass `language` — that would break the persona.

import * as Speech from 'expo-speech';
import { CONFIG } from '@/config';
import * as Settings from '@/services/Settings';
import { ok, err, type Result } from '@/utils/result';

/** Spanish voices installed on this device (for the Setup voice picker). */
export async function listSpanishVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices
      .filter(v => v.language?.toLowerCase().startsWith('es'))
      .sort((a, b) => (a.language + a.name).localeCompare(b.language + b.name));
  } catch {
    return [];
  }
}

// Tuning defaults — the system voice at 0.85 felt slow, so default to natural
// 1.0 speed/pitch; the Setup sliders persist overrides.
export const RATE_DEFAULT = 1.0;
export const PITCH_DEFAULT = 1.0;

function tunedRate(): number {
  const v = parseFloat(Settings.getStringSync(Settings.KEYS.ttsRate, ''));
  return Number.isFinite(v) && v > 0 ? v : RATE_DEFAULT;
}
function tunedPitch(): number {
  const v = parseFloat(Settings.getStringSync(Settings.KEYS.ttsPitch, ''));
  return Number.isFinite(v) && v > 0 ? v : PITCH_DEFAULT;
}

/** Speak a one-off preview line (Setup pickers/sliders). */
export function speakPreview(
  text: string,
  opts: { voice?: string; rate?: number; pitch?: number } = {},
): void {
  Speech.stop();
  Speech.speak(text, {
    rate: opts.rate ?? tunedRate(),
    pitch: opts.pitch ?? tunedPitch(),
    ...(opts.voice ? { voice: opts.voice } : {}),
  });
}

export type TTSError = 'no_voice_available' | 'engine_unavailable' | 'unknown';
export type SpeakOptions = { rate?: number };

let resolvedLocale: string | null = null;

// UI observers — the Home "speaking" state renders the exact line Lola is
// voicing. We emit the text when speech starts and `null` when it ends, so the
// panel can show the words and then return to idle in step with the audio.
const speechListeners = new Set<(text: string | null) => void>();

export function subscribeSpeech(fn: (text: string | null) => void): () => void {
  speechListeners.add(fn);
  return () => { speechListeners.delete(fn); };
}

function emitSpeech(text: string | null): void {
  speechListeners.forEach(fn => { try { fn(text); } catch { /* never break TTS */ } });
}

/** Test-only seam — clears the cached locale so resolveLocale() re-probes. */
export function _resetForTests(): void {
  resolvedLocale = null;
}

async function resolveLocale(): Promise<string> {
  if (resolvedLocale) return resolvedLocale;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const installed = new Set(voices.map(v => v.language));
    const candidates = [CONFIG.TTS_LOCALE, ...CONFIG.TTS_LOCALE_FALLBACKS];
    resolvedLocale = candidates.find(loc => installed.has(loc)) ?? CONFIG.TTS_LOCALE;
    if (resolvedLocale !== CONFIG.TTS_LOCALE) {
      // TODO(later): write usage_events row { action: 'tts_locale_fallback', from: CONFIG.TTS_LOCALE, to: resolvedLocale }
      // For now, a single console.warn so we see fallback in dev logs.
      console.warn('[tts] es-AR not installed, using fallback', resolvedLocale);
    }
  } catch {
    resolvedLocale = CONFIG.TTS_LOCALE;
  }
  return resolvedLocale;
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<Result<void, TTSError>> {
  try {
    const language = await resolveLocale();
    // Resolve only when speech finishes (or is stopped externally). Earlier
    // we resolved immediately, which made callers' `await speak(...)` return
    // before Lola actually spoke — busy gates cleared too early and the
    // "tap to interrupt" pattern stopped working.
    return await new Promise<Result<void, TTSError>>(resolve => {
      let settled = false;
      const settle = (r: Result<void, TTSError>) => {
        if (settled) return;
        settled = true;
        emitSpeech(null);
        resolve(r);
      };
      emitSpeech(text);
      // A caregiver-selected voice (Setup picker) overrides the resolved
      // locale; rate/pitch come from the Setup sliders (with sane defaults).
      const voiceId = Settings.getStringSync(Settings.KEYS.voice, '');
      Speech.speak(text, {
        language,
        rate: opts.rate ?? tunedRate(),
        pitch: tunedPitch(),
        ...(voiceId ? { voice: voiceId } : {}),
        onDone: () => settle(ok(undefined)),
        onStopped: () => settle(ok(undefined)),
        onError: () => settle(err('unknown')),
      });
    });
  } catch {
    return err('unknown');
  }
}

export function stop(): void {
  Speech.stop();
  emitSpeech(null);
}
