// Schema-shape unit tests. We can't open a real SQLite handle in Jest's
// Node env (expo-sqlite is a native module pulling in expo-asset etc.), so
// expo-sqlite is mocked at module load. These tests:
//   1. assert MIGRATIONS contains v1
//   2. parse the v1 SQL to verify all required tables, columns, index, and FK
//   3. confirm the migration runner calls the right APIs (via a stub)
//
// Real-device verification of CREATE/INSERT/SELECT round-trip happens at
// sideload (E6.3 sideload runbook includes a smoke-test step).

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: () => null,
  useSQLiteContext: () => null,
}));

import { MIGRATIONS, TARGET_VERSION, migrate } from '../storage';

describe('storage migrations', () => {
  test('v1 migration exists; TARGET_VERSION === 1', () => {
    expect(MIGRATIONS[1]).toBeDefined();
    expect(TARGET_VERSION).toBe(1);
  });

  describe('v1 SQL shape', () => {
    const sql = MIGRATIONS[1];

    test('creates `objects` table', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS objects/);
      // Required columns from AD-3
      for (const col of [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'canonical_name TEXT NOT NULL UNIQUE',
        'display_name TEXT NOT NULL',
        'description TEXT',
        'source TEXT NOT NULL',
        'reference_image_uri TEXT',
        'created_at INTEGER NOT NULL',
        'updated_at INTEGER NOT NULL',
      ]) {
        expect(sql).toContain(col);
      }
    });

    test('creates `sightings` table with FK cascade', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS sightings/);
      expect(sql).toContain('object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE');
      for (const col of [
        'observed_at INTEGER NOT NULL',
        'snapshot_uri TEXT',
        'room_hint TEXT',
        'source_action TEXT NOT NULL',
        'excerpt TEXT',
      ]) {
        expect(sql).toContain(col);
      }
    });

    test('creates idx_sightings_recent on (object_id, observed_at DESC)', () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS idx_sightings_recent[\s\S]*ON sightings\(object_id, observed_at DESC\)/,
      );
    });

    test('creates `usage_events` table', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS usage_events/);
      for (const col of [
        'occurred_at INTEGER NOT NULL',
        'action TEXT NOT NULL',
        'success INTEGER NOT NULL',
        'latency_ms INTEGER',
        'error_kind TEXT',
      ]) {
        expect(sql).toContain(col);
      }
    });

    test('sets PRAGMA user_version = 1', () => {
      expect(sql).toMatch(/PRAGMA user_version = 1/);
    });

    test('enables foreign_keys', () => {
      expect(sql).toMatch(/PRAGMA foreign_keys = ON/);
    });
  });

  describe('migrate() runner', () => {
    function stubDb(currentVersion: number) {
      const calls: string[] = [];
      return {
        execAsync: jest.fn(async (sql: string) => { calls.push(sql); }),
        getFirstAsync: jest.fn(async () => ({ user_version: currentVersion })),
        calls,
      };
    }

    test('applies v1 when current user_version = 0', async () => {
      const db = stubDb(0);
      await migrate(db as unknown as Parameters<typeof migrate>[0]);
      // First exec is the foreign_keys pragma; v1 SQL follows.
      expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
      expect(db.calls.some(c => /CREATE TABLE IF NOT EXISTS objects/.test(c))).toBe(true);
    });

    test('no-ops when already at TARGET_VERSION', async () => {
      const db = stubDb(1);
      await migrate(db as unknown as Parameters<typeof migrate>[0]);
      // Only the foreign_keys pragma should fire; no CREATE TABLE.
      expect(db.calls.some(c => /CREATE TABLE/.test(c))).toBe(false);
    });
  });
});
