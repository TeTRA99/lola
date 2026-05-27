// Mock every adapter + gateway so DescribeService logic is testable in isolation.

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: () => null,
  useSQLiteContext: () => null,
}));

jest.mock('@/adapters/tts', () => ({
  speak: jest.fn(async () => ({ ok: true, value: undefined })),
  stop: jest.fn(),
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
  getCatalog: jest.fn(),
}));

jest.mock('@/services/SnapshotCache', () => ({
  saveSnapshot: jest.fn((b64: string) => `file:///snap/${b64.slice(0, 4)}.jpg`),
  attachNarration: jest.fn(),
  getLatest: jest.fn(),
  _resetForTests: jest.fn(),
}));

jest.mock('@/services/MemoryService', () => ({
  recordSighting: jest.fn(async () => ({ ok: true, value: { id: 1 } })),
  resolveObjectFromUtterance: jest.fn(async () => null),
  recall: jest.fn(async () => ({ freshness: 'miss' })),
}));

import { run, getLastDescribe, _resetForTests } from '../DescribeService';
import { speak } from '@/adapters/tts';
import { fire } from '@/adapters/haptics';
import { captureSnapshot } from '@/adapters/camera';
import { chat } from '@/gateways/openrouter';
import { getDb } from '@/adapters/storage';
import * as OnboardingService from '@/services/OnboardingService';
import * as SnapshotCache from '@/services/SnapshotCache';

const mSpeak = speak as jest.MockedFunction<typeof speak>;
const mFire = fire as jest.MockedFunction<typeof fire>;
const mCapture = captureSnapshot as jest.MockedFunction<typeof captureSnapshot>;
const mChat = chat as jest.MockedFunction<typeof chat>;
const mGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mGetCatalog = OnboardingService.getCatalog as jest.MockedFunction<
  typeof OnboardingService.getCatalog
>;

const runAsync = jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 }));

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
  mGetCatalog.mockRejectedValue(new Error('not_implemented'));  // E4.4 not yet shipped
  mGetDb.mockResolvedValue({ runAsync } as unknown as Awaited<ReturnType<typeof getDb>>);
});

function goodSnapshot() {
  mCapture.mockResolvedValue({
    ok: true,
    value: { uri: 'file:///photo.jpg', base64: 'BASE64', width: 1024, height: 768 },
  });
}

function chatOk(narration: string, objects: { canonical: string; display: string; room_hint: string | null }[] = []) {
  mChat.mockResolvedValue({ ok: true, value: { narration, objects } });
}

describe('DescribeService.run', () => {
  test('happy path: speaks narration, returns ok, caches lastDescribe', async () => {
    goodSnapshot();
    chatOk('Una taza azul sobre la mesa.', [
      { canonical: 'taza_azul', display: 'la taza', room_hint: 'cocina' },
    ]);

    const r = await run();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.narration).toBe('Una taza azul sobre la mesa.');
      expect(r.value.objects).toHaveLength(1);
    }
    expect(mSpeak).toHaveBeenCalledWith('Una taza azul sobre la mesa.');
    // SnapshotCache.saveSnapshot is called with the base64; attachNarration with the persisted uri + narration.
    expect(SnapshotCache.saveSnapshot).toHaveBeenCalledWith('BASE64');
    expect(SnapshotCache.attachNarration).toHaveBeenCalledWith(
      'file:///snap/BASE.jpg',
      'Una taza azul sobre la mesa.',
    );
    // getLastDescribe is now backed by SnapshotCache.getLatest — mock it.
    (SnapshotCache.getLatest as jest.Mock).mockReturnValue({
      uri: 'file:///snap/BASE.jpg',
      sizeBytes: 100,
      savedAt: Date.now(),
      narration: 'Una taza azul sobre la mesa.',
    });
    expect(getLastDescribe()).toEqual({
      narration: 'Una taza azul sobre la mesa.',
      snapshotUri: 'file:///snap/BASE.jpg',
    });
  });

  test('heartbeat transitions fire in order on happy path', async () => {
    goodSnapshot();
    chatOk('ok');
    await run();
    const calls = mFire.mock.calls.map(c => c[0]);
    expect(calls).toEqual(['looking', 'thinking_start', 'thinking_stop', 'answer_ready']);
  });

  test('camera permission_denied → speaks cameraPermission copy, returns permission_denied', async () => {
    mCapture.mockResolvedValue({ ok: false, error: 'permission_denied' });

    const r = await run();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('permission_denied');
    expect(mSpeak).toHaveBeenCalledWith('Necesito ver para ayudarte — ¿me dejás usar la cámara?');
    expect(mFire).toHaveBeenCalledWith('error');
  });

  test('camera no_camera path returns no_camera + generic copy', async () => {
    mCapture.mockResolvedValue({ ok: false, error: 'no_camera' });
    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no_camera');
    expect(mSpeak).toHaveBeenCalledWith('Algo se me cruzó — ¿lo intentamos de nuevo?');
  });

  test('network error → speaks noNetwork copy + heartbeat error, returns network', async () => {
    goodSnapshot();
    mChat.mockResolvedValue({ ok: false, error: 'network' });

    const r = await run();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('network');
    expect(mSpeak).toHaveBeenCalledWith('No tengo señal ahora — ¿probamos en un ratito?');
    expect(mFire).toHaveBeenCalledWith('error');
  });

  test('low confidence: empty objects + gentle-question prefix → returns low_confidence, still speaks narration', async () => {
    goodSnapshot();
    chatOk('No estoy segura — ¿podés acercarte un poquito?', []);

    const r = await run();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('low_confidence');
    expect(mSpeak).toHaveBeenCalledWith('No estoy segura — ¿podés acercarte un poquito?');
  });

  test('telemetry: writes usage_events on happy path', async () => {
    goodSnapshot();
    chatOk('ok');
    await run();
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO usage_events'),
      expect.arrayContaining([expect.any(Number), 'describe', 1]),
    );
  });

  test('telemetry: writes usage_events on error path', async () => {
    mCapture.mockResolvedValue({ ok: false, error: 'permission_denied' });
    await run();
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO usage_events'),
      expect.arrayContaining([expect.any(Number), 'describe', 0]),
    );
  });

  test('catalog graceful fallback: getCatalog throws → prompt built with null catalog', async () => {
    goodSnapshot();
    chatOk('ok');
    await run();
    // No assertion on the prompt content — buildSystemPrompt is pure and tested
    // in openrouter.test.ts. Here we just confirm the call didn't blow up when
    // getCatalog throws 'not_implemented' (E4.4 not yet shipped).
    expect(mChat).toHaveBeenCalled();
  });

  test('parse_fail surfaces as parse_fail outcome', async () => {
    goodSnapshot();
    mChat.mockResolvedValue({ ok: false, error: 'parse_fail' });
    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('parse_fail');
  });
});
