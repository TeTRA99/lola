// jest.mock at top to dodge expo-modules-core native-init under Node.

type Handler = (e: unknown) => void;
type Sub = { remove: jest.Mock };

const listenersByEvent: Record<string, Handler[]> = {};
const subs: Sub[] = [];

jest.mock('expo-speech-recognition', () => {
  const fire = (event: string, payload: unknown) => {
    (listenersByEvent[event] ?? []).forEach(h => h(payload));
  };
  return {
    ExpoSpeechRecognitionModule: {
      __fire: fire,
      addListener: jest.fn((event: string, handler: Handler) => {
        (listenersByEvent[event] ??= []).push(handler);
        const sub = {
          remove: jest.fn(() => {
            const idx = listenersByEvent[event].indexOf(handler);
            if (idx >= 0) listenersByEvent[event].splice(idx, 1);
          }),
        };
        subs.push(sub);
        return sub;
      }),
      requestPermissionsAsync: jest.fn(),
      getSupportedLocales: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
  };
});

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { listen, abort, _resetForTests } from '../stt';

type MockedModule = typeof ExpoSpeechRecognitionModule & {
  __fire: (event: string, payload: unknown) => void;
};
const mod = ExpoSpeechRecognitionModule as MockedModule;

const mockedPerms = mod.requestPermissionsAsync as jest.MockedFunction<typeof mod.requestPermissionsAsync>;
const mockedLocales = mod.getSupportedLocales as jest.MockedFunction<typeof mod.getSupportedLocales>;
const mockedStart = mod.start as jest.MockedFunction<typeof mod.start>;

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(listenersByEvent)) delete listenersByEvent[k];
  subs.length = 0;
  _resetForTests();
});

function grantPermissions() {
  mockedPerms.mockResolvedValue({
    granted: true, status: 'granted', expires: 'never', canAskAgain: true,
  } as Awaited<ReturnType<typeof mod.requestPermissionsAsync>>);
}

function denyPermissions() {
  mockedPerms.mockResolvedValue({
    granted: false, status: 'denied', expires: 'never', canAskAgain: true,
  } as Awaited<ReturnType<typeof mod.requestPermissionsAsync>>);
}

function localeAvailable(langs: string[]) {
  mockedLocales.mockResolvedValue({ locales: langs } as Awaited<ReturnType<typeof mod.getSupportedLocales>>);
}

describe('STT adapter', () => {
  test('returns no_locale when es-AR + fallbacks all absent', async () => {
    localeAvailable(['en-US', 'pt-BR']);
    const r = await listen();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no_locale');
  });

  test('returns permission_denied when permissions denied', async () => {
    localeAvailable(['es-AR']);
    denyPermissions();
    const r = await listen();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('permission_denied');
  });

  test('resolves with transcript on `result` then `end`', async () => {
    localeAvailable(['es-AR']);
    grantPermissions();
    const p = listen();
    // microtask flush so addListener wires up
    await new Promise<void>(r => setImmediate(() => r()));
    mod.__fire('result', { results: [{ transcript: '¿qué es esto?' }] });
    mod.__fire('end', {});
    const r = await p;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('¿qué es esto?');
  });

  test('returns no_speech when end fires with no transcript', async () => {
    localeAvailable(['es-AR']);
    grantPermissions();
    const p = listen();
    await new Promise<void>(r => setImmediate(() => r()));
    mod.__fire('end', {});
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no_speech');
  });

  test('returns permission_denied on error event code=not-allowed', async () => {
    localeAvailable(['es-AR']);
    grantPermissions();
    const p = listen();
    await new Promise<void>(r => setImmediate(() => r()));
    mod.__fire('error', { error: 'not-allowed' });
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('permission_denied');
  });

  test('uses fallback locale when es-AR absent but es-419 present', async () => {
    localeAvailable(['es-419', 'en-US']);
    grantPermissions();
    const p = listen();
    await new Promise<void>(r => setImmediate(() => r()));
    expect(mockedStart).toHaveBeenCalledWith(expect.objectContaining({ lang: 'es-419' }));
    mod.__fire('end', {});
    await p;
  });

  test('abort() resolves with timeout', async () => {
    localeAvailable(['es-AR']);
    grantPermissions();
    const p = listen();
    await new Promise<void>(r => setImmediate(() => r()));
    abort();
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('timeout');
  });

  test('hard cap eventually fires timeout (real timer, short cap)', async () => {
    localeAvailable(['es-AR']);
    grantPermissions();
    const r = await listen({ hardCapMs: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('timeout');
  });
});
