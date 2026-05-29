// Simple key/value preferences backed by SQLite. In-process cache for hot
// reads (camera-capture path, etc.) so we don't hit the DB on every snapshot.

import { getDb } from '@/adapters/storage';

const cache: Map<string, string> = new Map();
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings',
    );
    for (const r of rows) cache.set(r.key, r.value);
  } catch { /* leave cache empty */ }
  loaded = true;
}

export async function getBool(key: string, fallback = false): Promise<boolean> {
  await ensureLoaded();
  const v = cache.get(key);
  if (v === undefined) return fallback;
  return v === '1';
}

/** Synchronous read after a load() — used in latency-sensitive paths. */
export function getBoolSync(key: string, fallback = false): boolean {
  const v = cache.get(key);
  if (v === undefined) return fallback;
  return v === '1';
}

export async function getString(key: string, fallback = ''): Promise<string> {
  await ensureLoaded();
  return cache.get(key) ?? fallback;
}

/** Synchronous read after a load() — used by the i18n initial resolve. */
export function getStringSync(key: string, fallback = ''): string {
  return cache.get(key) ?? fallback;
}

export async function setString(key: string, value: string): Promise<void> {
  await ensureLoaded();
  cache.set(key, value);
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  } catch { /* swallow — cache still reflects */ }
}

export async function setBool(key: string, value: boolean): Promise<void> {
  await ensureLoaded();
  const v = value ? '1' : '0';
  cache.set(key, v);
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, v],
    );
  } catch { /* swallow — cache still reflects */ }
}

/** Force a fresh load on the next read (used by tests). */
export function _resetForTests(): void {
  cache.clear();
  loaded = false;
}

// Eagerly load on module import so getBoolSync() works in the camera path.
void ensureLoaded();

export const KEYS = {
  quietCapture: 'quiet_capture',
  language: 'language',
  voice: 'tts_voice',
  ttsRate: 'tts_rate',
  ttsPitch: 'tts_pitch',
  idleHeartbeat: 'idle_heartbeat',
} as const;
