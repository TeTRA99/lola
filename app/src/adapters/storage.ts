// SQLite adapter — schema per architecture AD-3.
// Migration runner uses `PRAGMA user_version` to drive forward-only versioning.
//
// Two consumption surfaces:
//   - getDb() — singleton handle for service-layer code outside React tree
//   - SQLiteProvider + useSQLiteContext — for component-tree consumers (re-exported)

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'lola.db';

/** Forward-only schema migrations, indexed by target user_version. */
export const MIGRATIONS: Record<number, string> = {
  1: `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      reference_image_uri TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      observed_at INTEGER NOT NULL,
      snapshot_uri TEXT,
      room_hint TEXT,
      source_action TEXT NOT NULL,
      excerpt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sightings_recent
      ON sightings(object_id, observed_at DESC);

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at INTEGER NOT NULL,
      action TEXT NOT NULL,
      success INTEGER NOT NULL,
      latency_ms INTEGER,
      error_kind TEXT
    );

    PRAGMA user_version = 1;
  `,
  // Future migrations:
  // 2: `... PRAGMA user_version = 2;`
};

export const TARGET_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

let dbSingleton: SQLite.SQLiteDatabase | null = null;

/**
 * Idempotent: applies any pending migrations to reach TARGET_VERSION.
 * Safe to call on every app boot.
 */
export async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // Foreign keys must be enabled per-connection.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;

  for (let v = current + 1; v <= TARGET_VERSION; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) throw new Error(`No migration defined for v${v}`);
    await db.execAsync(sql);
  }
}

/**
 * Returns a singleton DB handle. Opens + migrates on first call.
 * Service-layer code uses this; React tree should use SQLiteProvider/useSQLiteContext.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbSingleton) return dbSingleton;
  // Open + migrate before caching — a half-migrated handle must not be cached
  // (B3 from the 2026-05-27 code review).
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await migrate(db);
  dbSingleton = db;
  return dbSingleton;
}

/** Test seam — clears the singleton so subsequent getDb() reopens. */
export function _resetForTests(): void {
  dbSingleton = null;
}

export { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
