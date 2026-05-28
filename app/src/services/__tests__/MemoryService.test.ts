jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: () => null,
  useSQLiteContext: () => null,
}));

jest.mock('@/adapters/storage', () => ({
  getDb: jest.fn(),
}));

import * as MemoryService from '../MemoryService';
import { getDb } from '@/adapters/storage';

const mGetDb = getDb as jest.MockedFunction<typeof getDb>;

function stubDb() {
  const runAsync = jest.fn();
  const getFirstAsync = jest.fn();
  return { runAsync, getFirstAsync };
}

beforeEach(() => { jest.clearAllMocks(); });

describe('MemoryService.recordSighting', () => {
  test('reuses existing object_id when canonical matches', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValueOnce({ id: 7 }); // existing object
    db.runAsync.mockResolvedValue({ lastInsertRowId: 99, changes: 1 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await MemoryService.recordSighting({
      canonical: 'taza_azul',
      display: 'la taza',
      observed_at: 1000,
      snapshot_uri: 'file:///x.jpg',
      room_hint: 'cocina',
      source_action: 'describe',
      excerpt: 'una taza azul',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe(99);
    // First call queries existing object; second inserts sighting.
    const sightingInsert = db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO sightings'),
    );
    expect(sightingInsert).toBeDefined();
    expect(sightingInsert?.[1]).toEqual([7, 1000, 'file:///x.jpg', 'cocina', 'describe', 'una taza azul']);
  });

  test('inserts observed-source object when canonical unknown', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValueOnce(null);  // no existing object
    db.runAsync
      .mockResolvedValueOnce({ lastInsertRowId: 42, changes: 1 })  // observed insert
      .mockResolvedValueOnce({ lastInsertRowId: 100, changes: 1 }); // sighting insert
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await MemoryService.recordSighting({
      canonical: 'objeto_nuevo',
      display: 'un objeto nuevo',
      observed_at: 2000,
      snapshot_uri: null,
      room_hint: null,
      source_action: 'ask',
      excerpt: null,
    });
    expect(r.ok).toBe(true);

    const inserts = db.runAsync.mock.calls.map(c => String(c[0]));
    expect(inserts[0]).toContain('INSERT INTO objects');
    expect(inserts[1]).toContain('INSERT INTO sightings');
    // The sighting points at the freshly-created observed object id.
    expect(db.runAsync.mock.calls[1][1]?.[0]).toBe(42);
  });

  test('returns storage_error on insert failure', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValue(null);
    db.runAsync.mockRejectedValue(new Error('disk full'));
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await MemoryService.recordSighting({
      canonical: 'x',
      display: 'x',
      observed_at: 0,
      snapshot_uri: null,
      room_hint: null,
      source_action: 'describe',
      excerpt: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('storage_error');
  });
});

describe('MemoryService.resolveObjectFromUtterance', () => {
  test('exact canonical match wins', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValueOnce({ id: 1 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const id = await MemoryService.resolveObjectFromUtterance('mi cepillo');
    expect(id).toBe(1);
    // First query was canonical match
    expect(db.getFirstAsync.mock.calls[0][0]).toContain('canonical_name = ?');
    expect(db.getFirstAsync.mock.calls[0][1]).toEqual(['cepillo']);
  });

  test('strips possessive before canonicalizing', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValueOnce({ id: 2 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    await MemoryService.resolveObjectFromUtterance('la pava');
    expect(db.getFirstAsync.mock.calls[0][1]).toEqual(['pava']);
  });

  test('falls through to display match when canonical misses', async () => {
    const db = stubDb();
    db.getFirstAsync
      .mockResolvedValueOnce(null)  // canonical
      .mockResolvedValueOnce({ id: 3 });  // display
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const id = await MemoryService.resolveObjectFromUtterance('cepillo');
    expect(id).toBe(3);
  });

  test('falls through to substring match', async () => {
    const db = stubDb();
    db.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 4 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const id = await MemoryService.resolveObjectFromUtterance('cepillo');
    expect(id).toBe(4);
    expect(db.getFirstAsync.mock.calls[2][0]).toContain('LIKE');
  });

  test('falls through to description substring', async () => {
    const db = stubDb();
    db.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 5 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const id = await MemoryService.resolveObjectFromUtterance('verde');
    expect(id).toBe(5);
    expect(db.getFirstAsync.mock.calls[3][0]).toContain('description');
  });

  test('returns null when all steps miss', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValue(null);
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const id = await MemoryService.resolveObjectFromUtterance('xyz no existe');
    expect(id).toBeNull();
  });

  test('empty noun → null', async () => {
    const id = await MemoryService.resolveObjectFromUtterance('   ');
    expect(id).toBeNull();
  });
});

describe('MemoryService.recall — E5.2 hit + E5.3 freshness', () => {
  const NOW = new Date('2026-05-27T15:00:00Z').getTime();
  const HOUR = 3_600_000;

  function setup(sightingAgeHours: number | null) {
    const db = stubDb();
    db.getFirstAsync
      .mockResolvedValueOnce({ id: 7 })  // resolveObjectFromUtterance: exact canonical
      .mockResolvedValueOnce(sightingAgeHours === null ? null : {
        id: 99, object_id: 7,
        observed_at: NOW - sightingAgeHours * HOUR,
        snapshot_uri: 'file:///x.jpg',
        room_hint: 'cocina',
        source_action: 'describe',
        excerpt: 'la pava',
      });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  }

  test('fresh: ≤24h → freshness=fresh with sighting', async () => {
    setup(2);  // 2h ago
    const r = await MemoryService.recall('mi pava', NOW);
    expect(r.freshness).toBe('fresh');
    if (r.freshness === 'fresh') expect(r.sighting.room_hint).toBe('cocina');
  });

  test('hedged: 24h < age ≤ 72h → freshness=hedged', async () => {
    setup(48);  // 2 days
    const r = await MemoryService.recall('mi pava', NOW);
    expect(r.freshness).toBe('hedged');
  });

  test('miss: >72h → freshness=miss', async () => {
    setup(100);  // ~4 days
    const r = await MemoryService.recall('mi pava', NOW);
    expect(r.freshness).toBe('miss');
  });

  test('miss when no sighting row exists', async () => {
    setup(null);
    const r = await MemoryService.recall('mi pava', NOW);
    expect(r.freshness).toBe('miss');
  });

  test('miss when noun does not resolve to any object', async () => {
    const db = stubDb();
    db.getFirstAsync.mockResolvedValue(null);  // all resolve steps miss
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
    const r = await MemoryService.recall('xyz inexistente', NOW);
    expect(r.freshness).toBe('miss');
  });
});
