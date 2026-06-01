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

// Routing now goes through the LLM classifier (chatJson); model answers via chat.
jest.mock('@/gateways/openrouter', () => ({
  chat: jest.fn(),
  chatJson: jest.fn(),
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
  readBase64: jest.fn(() => null),
}));

jest.mock('@/services/MemoryService', () => ({
  recordSighting: jest.fn(async () => ({ ok: true, value: { id: 1 } })),
  resolveObjectFromUtterance: jest.fn(async () => null),
  recall: jest.fn(async () => ({ freshness: 'miss' })),
}));

jest.mock('@/services/RoomCatalog', () => ({
  identifyRoom: jest.fn(async () => ({ ok: true, value: null })),
}));

import { run } from '../AskService';
import { speak } from '@/adapters/tts';
import { listen } from '@/adapters/stt';
import { captureSnapshot } from '@/adapters/camera';
import { chat, chatJson } from '@/gateways/openrouter';
import { getDb } from '@/adapters/storage';
import * as SnapshotCache from '@/services/SnapshotCache';
import * as RoomCatalog from '@/services/RoomCatalog';

const mSpeak = speak as jest.MockedFunction<typeof speak>;
const mListen = listen as jest.MockedFunction<typeof listen>;
const mCapture = captureSnapshot as jest.MockedFunction<typeof captureSnapshot>;
const mChat = chat as jest.MockedFunction<typeof chat>;
const mChatJson = chatJson as jest.MockedFunction<typeof chatJson>;
const mGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mGetLatest = SnapshotCache.getLatest as jest.MockedFunction<typeof SnapshotCache.getLatest>;
const mIdentifyRoom = RoomCatalog.identifyRoom as jest.MockedFunction<typeof RoomCatalog.identifyRoom>;

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

// The LLM intent classifier result.
function intent(value: {
  intent: 'model' | 'repeat' | 'extend' | 'memory' | 'chitchat' | 'where_am_i';
  noun?: string | null;
  needsCurrent?: boolean | null;
  chitchatKind?: string | null;
}) {
  mChatJson.mockResolvedValue({ ok: true, value });
}

function chatOk(narration: string, objects: Array<{ canonical: string; display: string; room_hint: string | null }> = []) {
  mChat.mockResolvedValue({ ok: true, value: { narration, objects } });
}

describe('AskService.run — route: model', () => {
  test('happy path: STT → classify(model) → snapshot → model → speak', async () => {
    stt('¿qué tengo en la mano?');
    intent({ intent: 'model', needsCurrent: true });
    snap();
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
    stt('¿qué es esto?');
    intent({ intent: 'model', needsCurrent: true });
    snap();
    chatOk('No estoy segura — ¿podés acercarte?', []);

    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('low_confidence');
    expect(mSpeak).toHaveBeenCalledWith('No estoy segura — ¿podés acercarte?');
  });

  test('network error → noNetwork copy', async () => {
    stt('¿qué es?');
    intent({ intent: 'model', needsCurrent: true });
    snap();
    mChat.mockResolvedValue({ ok: false, error: 'network' });

    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('network');
    expect(mSpeak).toHaveBeenCalledWith('No tengo señal ahora — ¿probamos en un ratito?');
  });

  test('needsCurrent=false with cached snapshot skips a fresh capture', async () => {
    stt('¿de qué color era la bolsa?');
    intent({ intent: 'model', needsCurrent: false });
    mGetLatest.mockReturnValue({
      uri: 'file:///prev.jpg', sizeBytes: 100, savedAt: Date.now(), narration: 'una bolsa de papas',
    });
    (SnapshotCache.readBase64 as jest.Mock).mockReturnValue('CACHEDB64');
    chatOk('Era roja');

    const r = await run();
    expect(r.ok).toBe(true);
    expect(mCapture).not.toHaveBeenCalled(); // used the cached frame
  });
});

describe('AskService.run — route: repeat', () => {
  test('reads back the last narration from SnapshotCache, no model call', async () => {
    stt('Lola, ¿otra vez?');
    intent({ intent: 'repeat' });
    mGetLatest.mockReturnValue({
      uri: 'file:///prev.jpg', sizeBytes: 100, savedAt: Date.now(), narration: 'una pava sobre la mesa',
    });

    const r = await run();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.route).toBe('repeat');
    expect(mSpeak).toHaveBeenCalledWith('una pava sobre la mesa');
    expect(mChat).not.toHaveBeenCalled();
    expect(mCapture).not.toHaveBeenCalled(); // repeat never needs the camera
  });

  test('no prior describe → error', async () => {
    stt('otra vez');
    intent({ intent: 'repeat' });
    mGetLatest.mockReturnValue(null);

    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('unknown');
  });
});

describe('AskService.run — route: extend', () => {
  test('re-queries with extend prompt', async () => {
    stt('contame más');
    intent({ intent: 'extend' });
    snap();
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
    stt('¿dónde está mi cepillo?');
    intent({ intent: 'memory', noun: 'cepillo' });
    snap();
    chatOk('No lo veo ahora.', []);

    const r = await run();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.route).toBe('memory_miss');
  });
});

describe('AskService.run — route: chitchat', () => {
  test('"gracias" answers locally without camera or model', async () => {
    stt('gracias');
    intent({ intent: 'chitchat', chitchatKind: 'thanks' });

    const r = await run();
    expect(r.ok).toBe(true);
    expect(mSpeak).toHaveBeenCalledWith('De nada.');
    expect(mCapture).not.toHaveBeenCalled();
    expect(mChat).not.toHaveBeenCalled();
  });
});

describe('AskService.run — route: where_am_i', () => {
  test('takes a fresh snapshot and answers from the room match', async () => {
    stt('¿dónde estoy?');
    intent({ intent: 'where_am_i' });
    snap();
    mIdentifyRoom.mockResolvedValue({ ok: true, value: { roomId: 1, displayName: 'la cocina', similarity: 0.9 } });

    const r = await run();
    expect(r.ok).toBe(true);
    expect(mCapture).toHaveBeenCalled();
    expect(mSpeak).toHaveBeenCalledWith('Estás en la cocina.');
  });
});

describe('AskService.run — error paths', () => {
  test('snapshot permission_denied (model route) → camera copy', async () => {
    stt('¿qué es esto?');
    intent({ intent: 'model', needsCurrent: true });
    mCapture.mockResolvedValue({ ok: false, error: 'permission_denied' });

    const r = await run();
    expect(r.ok).toBe(false);
    expect(mSpeak).toHaveBeenCalledWith('Necesito ver para ayudarte — ¿me dejás usar la cámara?');
  });

  test('STT permission denied → micPermission copy (before any classify)', async () => {
    mListen.mockResolvedValue({ ok: false, error: 'permission_denied' });

    const r = await run();
    expect(r.ok).toBe(false);
    expect(mSpeak).toHaveBeenCalledWith('¿Me dejás escucharte?');
    expect(mChatJson).not.toHaveBeenCalled();
  });

  test('STT no_speech → generic copy', async () => {
    mListen.mockResolvedValue({ ok: false, error: 'no_speech' });

    const r = await run();
    expect(r.ok).toBe(false);
    expect(mSpeak).toHaveBeenCalledWith('Algo se me cruzó — ¿lo intentamos de nuevo?');
  });
});
