// Language store for the caregiver Setup UI. Resolution order:
//   1. explicit override saved in Settings (Language selector)
//   2. device language via Intl (Hermes ships Intl on Android — no native dep):
//      es-* → Spanish, en-* → English
//   3. any other device language → English
//
// Components subscribe via useSetupStrings(); changing the language re-renders
// them. The dad-facing surface is NOT routed through here (it stays Spanish).

import { useEffect, useState } from 'react';
import * as Settings from '@/services/Settings';
import { SETUP_STRINGS, type Lang, type SetupCopy } from './setupStrings';

function detectDeviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    if (locale.toLowerCase().startsWith('es')) return 'es';
  } catch { /* Intl unavailable — fall through */ }
  return 'en';
}

let current: Lang = detectDeviceLang();
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  void Settings.setString(Settings.KEYS.language, lang);
  listeners.forEach(fn => { try { fn(lang); } catch { /* ignore */ } });
}

/**
 * Apply a previously-saved override, if any. Call once at startup; a stored
 * value wins over the device default. No-op when nothing is saved.
 */
export async function loadStoredLang(): Promise<void> {
  const saved = await Settings.getString(Settings.KEYS.language, '');
  if (saved === 'es' || saved === 'en') {
    if (saved !== current) {
      current = saved;
      listeners.forEach(fn => { try { fn(saved); } catch { /* ignore */ } });
    }
  }
}

export function useLang(): Lang {
  const [lang, setLocal] = useState<Lang>(current);
  useEffect(() => {
    listeners.add(setLocal);
    // Sync in case it changed between initial render and effect.
    if (current !== lang) setLocal(current);
    return () => { listeners.delete(setLocal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return lang;
}

export function useSetupStrings(): SetupCopy {
  return SETUP_STRINGS[useLang()];
}

export { type Lang } from './setupStrings';
