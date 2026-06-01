jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: () => null,
  useSQLiteContext: () => null,
}));

jest.mock('@/adapters/storage', () => ({
  getDb: jest.fn(),
}));

import * as OnboardingService from '../OnboardingService';
import { canonicalize } from '../OnboardingService';
import { getDb } from '@/adapters/storage';

const mGetDb = getDb as jest.MockedFunction<typeof getDb>;

function stubDb() {
  const runAsync = jest.fn();
  const getAllAsync = jest.fn();
  // addObject now looks up an existing canonical first (auto-promote of an
  // 'observed' row to 'catalog'). Default: no existing row.
  const getFirstAsync = jest.fn(async () => null);
  return {
    runAsync,
    getAllAsync,
    getFirstAsync,
    _stub: { runAsync, getAllAsync, getFirstAsync },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('canonicalize', () => {
  test('strips accents + lowercases + underscore separators', () => {
    expect(canonicalize('Cepillo de Papá')).toBe('cepillo_de_papa');
  });
  test('drops non-alphanumeric symbols', () => {
    expect(canonicalize('Yerba Cruz de Malta!!')).toBe('yerba_cruz_de_malta');
  });
  test('collapses multiple spaces', () => {
    expect(canonicalize('  remedio   de   la   presión  ')).toBe('remedio_de_la_presion');
  });
  test('empty string in → empty string out', () => {
    expect(canonicalize('')).toBe('');
  });
  test('all-symbol input → empty', () => {
    expect(canonicalize('!!!')).toBe('');
  });
  test('mixed hyphens and spaces collapse to single underscore', () => {
    expect(canonicalize('mi taza - la nueva')).toBe('mi_taza_la_nueva');
  });
});

describe('OnboardingService.addObject', () => {
  test('inserts with auto-generated canonical and returns new id', async () => {
    const db = stubDb();
    db._stub.runAsync.mockResolvedValue({ lastInsertRowId: 42, changes: 1 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.addObject({ display: 'Cepillo de Papá' });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe(42);
    expect(db._stub.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO objects'),
      expect.arrayContaining(['cepillo_de_papa', 'Cepillo de Papá']),
    );
  });

  test('returns duplicate_canonical when an existing catalog row has the same canonical', async () => {
    const db = stubDb();
    // A row already exists in the catalog → real duplicate.
    db._stub.getFirstAsync.mockResolvedValue({ id: 7, source: 'catalog' } as never);
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.addObject({ display: 'mate' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('duplicate_canonical');
  });

  test('promotes an existing observed row to catalog instead of erroring', async () => {
    const db = stubDb();
    db._stub.getFirstAsync.mockResolvedValue({ id: 9, source: 'observed' } as never);
    db._stub.runAsync.mockResolvedValue({ changes: 1 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.addObject({ display: 'mate' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe(9);
    expect(db._stub.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE objects'),
      expect.arrayContaining(['mate']),
    );
  });

  test('returns storage_error on other failures', async () => {
    const db = stubDb();
    db._stub.runAsync.mockRejectedValue(new Error('disk full'));
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.addObject({ display: 'something' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('storage_error');
  });

  test('rejects display that canonicalizes to empty string', async () => {
    const r = await OnboardingService.addObject({ display: '!!!' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('storage_error');
  });
});

describe('OnboardingService.updateObject', () => {
  test('builds dynamic SET clause for partial patch', async () => {
    const db = stubDb();
    db._stub.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.updateObject(5, { display_name: 'nuevo' });
    expect(r.ok).toBe(true);
    const sql = db._stub.runAsync.mock.calls[0][0] as string;
    expect(sql).toContain('display_name = ?');
    expect(sql).toContain('updated_at = ?');
    expect(sql).toContain('WHERE id = ?');
  });

  test('returns not_found when row missing', async () => {
    const db = stubDb();
    db._stub.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.updateObject(999, { display_name: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_found');
  });

  test('empty patch is a no-op (returns ok)', async () => {
    const db = stubDb();
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.updateObject(5, {});
    expect(r.ok).toBe(true);
    expect(db._stub.runAsync).not.toHaveBeenCalled();
  });
});

describe('OnboardingService.removeObject', () => {
  test('deletes by id', async () => {
    const db = stubDb();
    db._stub.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.removeObject(7);
    expect(r.ok).toBe(true);
    expect(db._stub.runAsync).toHaveBeenCalledWith(
      'DELETE FROM objects WHERE id = ?',
      [7],
    );
  });

  test('returns not_found when no row', async () => {
    const db = stubDb();
    db._stub.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const r = await OnboardingService.removeObject(999);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_found');
  });
});

describe('OnboardingService.getCatalog', () => {
  test('returns catalog rows filtered by source', async () => {
    const db = stubDb();
    db._stub.getAllAsync.mockResolvedValue([
      { id: 1, canonical_name: 'pava', display_name: 'la pava', description: null, reference_image_uri: null },
    ]);
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const catalog = await OnboardingService.getCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].display_name).toBe('la pava');
    const sql = db._stub.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain("source = 'catalog'");
  });

  test('returns [] on storage failure', async () => {
    const db = stubDb();
    db._stub.getAllAsync.mockRejectedValue(new Error('boom'));
    mGetDb.mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    expect(await OnboardingService.getCatalog()).toEqual([]);
  });
});
