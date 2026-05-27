// STT adapter — imperative addListener (NOT the useSpeechRecognitionEvent hook,
// which only works in a React render context). Per E1.4 validation report rev 2.

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { CONFIG } from '@/config';
import { ok, err, type Result } from '@/utils/result';

export type STTError =
  | 'permission_denied' | 'no_locale' | 'no_speech'
  | 'timeout' | 'engine_unavailable' | 'unknown';

export type ListenOptions = { hardCapMs?: number };

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
    const candidates = [CONFIG.STT_LOCALE, ...CONFIG.STT_LOCALE_FALLBACKS];
    resolvedLocale = candidates.find(loc => langs.has(loc)) ?? null;
    // Unlike TTS, STT *requires* engine support for the locale — returning
    // err('no_locale') is intentional (a "best-effort" STT would produce garbage).
  } catch {
    resolvedLocale = null;
  }
  return resolvedLocale;
}

export async function listen(opts: ListenOptions = {}): Promise<Result<string, STTError>> {
  const lang = await resolveLocale();
  if (!lang) return err('no_locale');

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

    const settle = (r: Result<string, STTError>) => {
      if (settled) return;
      settled = true;
      if (hardTimeout) clearTimeout(hardTimeout);
      try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
      subResult?.remove();
      subEnd?.remove();
      subError?.remove();
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

    activeAbort = () => settle(err('timeout'));

    try {
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: false,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch {
      settle(err('engine_unavailable'));
      return;
    }

    hardTimeout = setTimeout(
      () => settle(err('timeout')),
      opts.hardCapMs ?? CONFIG.STT_HARD_CAP_MS,
    );
  });
}

export function abort(): void {
  if (activeAbort) {
    activeAbort();
  } else {
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
  }
}
