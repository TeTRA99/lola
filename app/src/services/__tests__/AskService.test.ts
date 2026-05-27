jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: () => null,
  useSQLiteContext: () => null,
}));

jest.mock('@/adapters/tts', () => ({
  speak: jest.fn(async () => ({ ok: true, value: undefined })),
  stop: jest.fn(),
}));

jest.mock('@/adapters/stt', () => ({
  listen: jest.fn(),
  abort: jest.fn(),
}));

jest.mock('@/adapters/haptics', () => ({
  fire: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('@/adapters/camera', () => ({
  captureSnapshot: jest.fn(),
}));

jest.mock('@/gateways/openrouter', () => ({
  chat: jest.fn(),
}));

jest.mock('@/adapters/storage', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/services/OnboardingService', () => ({
  getCatalog: jest.fn(async () => []),
}));

jest.mock('@/services/SnapshotCache', () => ({
  saveSnapshot: jest.fn((b64: string) => `file:///snap/${b64.slice(0, 4)}.jpg`),
  attachNarration: jest.fn(),
  getLatest: jest.fn(),
}));

jest.mock('@/services/MemoryService', () => ({
  recordSighting: jest.fn(async () => ({ ok: true, value: { id: 1 } })),
  resolveObjectFromUtterance: jest.fn(async () => null),
  recall: jest.fn(async () => ({ freshness: 'miss' })),
}));

import { run } from '../AskService';
import { speak } from '@/adapters/tts';
import { listen } from '@/adapters/stt';
import { captureSnapshot } from '@/adapters/camera';
import { chat } from '@/gateways/openrouter';
import { getDb } from '@/adapters/storage';
import * as SnapshotCache from '@/services/SnapshotCache';

const mSpeak = speak as jest.MockedFunction<typeof speak>;
const mListen = listen as jest.MockedFunction<typeof listen>;
const mCapture = captureSnapshot as jest.MockedFunction<typeof captureSnapshot>;
const mChat = chat as jest.MockedFunction<typeof chat>;
const mGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mGetLatest = SnapshotCache.getLatest as jest.MockedFunction<typeof SnapshotCache.getLatest>;

const runAsync = jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 }));

beforeEach(() => {
  jest.clearAllMocks();
  mGetDb.mockResolvedValue({ runAsync } as unknown as Awaited<ReturnType<typeof getDb>>);
});

function snap() {
  mCapture.mockResolvedValue({
    ok: true, value: { uri: 'file:///p.jpg', base64: 'BASE', width: 100, height: 100 },
  });
}

function stt(transcript: string) {
  mListen.mockResolvedValue({ ok: true, value: transcript });
}

function chatOk(narration: string, objects: Array<{ canonical: string; display: string; room_hint: string | null }> = []) {
  mChat.mockResolvedValue({ ok: true, value: { narration, objects } });
}

describe('AskService.run — route: model', () => {
  test('happy path: snapshot → STT → model → speak', async () => {
    snap();
    stt('¿qué tengo en la mano?');
    chatOk('Una taza azul');

    const r = await run();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.route).toBe('model');
      expect(r.value.narration).toBe('Una taza azul');
    }
    expect(mSpeak).toHaveBeenCalledWith('Una taza azul');
  });

  test('low confidence: empty objects + gentle question → err("low_confidence")', async () => {
    snap();
    stt('¿qué es esto?');
    chatOk('No estoy segura — ¿podés acercarte?', []);

    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('low_confidence');
    expect(mSpeak).toHaveBeenCalledWith('No estoy segura — ¿podés acercarte?');
  });

  test('network error → noNetwork copy', async () => {
    snap();
    stt('¿qué es?');
    mChat.mockResolvedValue({ ok: false, error: 'network' });

    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('network');
    expect(mSpeak).toHaveBeenCalledWith('No tengo señal ahora — ¿probamos en un ratito?');
  });
});

describe('AskService.run — route: repeat', () => {
  test('reads back the last narration from SnapshotCache', async () => {
    snap();
    stt('Lola, ¿otra vez?');
    mGetLatest.mockReturnValue({
      uri: 'file:///prev.jpg', sizeBytes: 100, savedAt: Date.now(), narration: 'una pava sobre la mesa',
    });

    const r = await run();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.route).toBe('repeat');
    expect(mSpeak).toHaveBeenCalledWith('una pava sobre la mesa');
    // No new model call.
    expect(mChat).not.toHaveBeenCalled();
  });

  test('no prior describe → error', async () => {
    snap();
    stt('otra vez');
    mGetLatest.mockReturnValue(null);

    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('unknown');
  });
});

describe('AskService.run — route: extend', () => {
  test('re-queries with extend prompt', async () => {
    snap();
    stt('contame más');
    chatOk('Una pava de aluminio, vieja, sobre la mesa de la cocina, con el mate al lado.');

    const r = await run();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.route).toBe('extend');
    expect(mChat).toHaveBeenCalledWith(expect.objectContaining({
      userText: expect.stringContaining('Contame más'),
    }));
  });
});

describe('AskService.run — route: memory', () => {
  test('memory miss falls through to model with original utterance', async () => {
    snap();
    stt('¿dónde está mi cepillo?');
    chatOk('No lo veo ahora.', []);

    const r = await run();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.route).toBe('memory_miss');
  });
});

describe('AskService.run — error paths', () => {
  test('camera permission_denied → permission_denied_camera copy', async () => {
    mCapture.mockResolvedValue({ ok: false, error: 'permission_denied' });

    const r = await run();
    expect(r.ok).toBe(false);
    expect(mSpeak).toHaveBeenCalledWith('Necesito ver para ayudarte — ¿me dejás usar la cámara?');
  });

  test('STT permission denied → micPermission copy', async () => {
    snap();
    mListen.mockResolvedValue({ ok: false, error: 'permission_denied' });

    const r = await run();
    expect(r.ok).toBe(false);
    expect(mSpeak).toHaveBeenCalledWith('¿Me dejás escucharte?');
  });

  test('STT no_speech → generic copy', async () => {
    snap();
    mListen.mockResolvedValue({ ok: false, error: 'no_speech' });

    const r = await run();
    expect(r.ok).toBe(false);
    expect(mSpeak).toHaveBeenCalledWith('Algo se me cruzó — ¿lo intentamos de nuevo?');
  });
});
