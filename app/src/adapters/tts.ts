// TTS adapter — voice persona consistency (FR-6.3) is enforced by always
// resolving locale through CONFIG.TTS_LOCALE + fallbacks and always defaulting
// to CONFIG.TTS_RATE. Consumers may override rate per-call but should not
// pass `language` — that would break the persona.

import * as Speech from 'expo-speech';
import { CONFIG } from '@/config';
import { ok, err, type Result } from '@/utils/result';

export type TTSError = 'no_voice_available' | 'engine_unavailable' | 'unknown';
export type SpeakOptions = { rate?: number };

let resolvedLocale: string | null = null;

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
    Speech.speak(text, { language, rate: opts.rate ?? CONFIG.TTS_RATE });
    return ok(undefined);
  } catch {
    return err('unknown');
  }
}

export function stop(): void {
  Speech.stop();
}
