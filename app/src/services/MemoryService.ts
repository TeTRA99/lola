// FR-4 Where-is-X — passive sightings log + recall.
// E5.1 implements recordSighting. E5.2 implements recall hit path. E5.3 layers
// the freshness window on top. E5.4 implements resolveObjectFromUtterance —
// bridges dad's noun phrasing to catalog object_ids via 4-step precedence.

import type { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '@/adapters/storage';
import { canonicalize } from './OnboardingService';
import { ok, err, type Result } from '@/utils/result';
import { now } from '@/utils/time';
import { CONFIG } from '@/config';

const HOUR_MS = 3_600_000;

export type Sighting = {
  id: number;
  object_id: number;
  observed_at: number;
  snapshot_uri: string | null;
  room_hint: string | null;
  source_action: 'describe' | 'ask';
  excerpt: string | null;
};

export type RecallOutcome =
  | { freshness: 'fresh'; sighting: Sighting }
  | { freshness: 'hedged'; sighting: Sighting }
  | { freshness: 'miss' };

async function findOrCreateObjectId(
  canonical: string,
  display: string,
): Promise<number | null> {
  try {
    const db = await getDb();
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM objects WHERE canonical_name = ?',
      [canonical],
    );
    if (existing) return existing.id;
    const ts = now();
    const r = await db.runAsync(
      'INSERT INTO objects (canonical_name, display_name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [canonical, display, 'observed', ts, ts],
    );
    return r.lastInsertRowId;
  } catch {
    return null;
  }
}

export async function recordSighting(input: {
  canonical: string;
  display: string;
  observed_at: number;
  snapshot_uri: string | null;
  room_hint: string | null;
  source_action: 'describe' | 'ask';
  excerpt: string | null;
}): Promise<Result<{ id: number }, 'storage_error'>> {
  try {
    const objectId = await findOrCreateObjectId(input.canonical, input.display);
    if (objectId === null) return err('storage_error');
    const db = await getDb();
    const args: SQLiteBindValue[] = [
      objectId,
      input.observed_at,
      input.snapshot_uri,
      input.room_hint,
      input.source_action,
      input.excerpt,
    ];
    const r = await db.runAsync(
      'INSERT INTO sightings (object_id, observed_at, snapshot_uri, room_hint, source_action, excerpt) VALUES (?, ?, ?, ?, ?, ?)',
      args,
    );
    return ok({ id: r.lastInsertRowId });
  } catch {
    return err('storage_error');
  }
}

// E5.4 — fuzzy match dad's spoken noun to a catalog/observed object_id.

const POSSESSIVE_RE = /^(mi|tu|su|el|la|los|las)\s+/i;

function stripPossessive(s: string): string {
  return s.replace(POSSESSIVE_RE, '').trim();
}

export async function resolveObjectFromUtterance(noun: string): Promise<number | null> {
  const cleaned = stripPossessive(noun);
  if (!cleaned) return null;
  const canonical = canonicalize(cleaned);
  const db = await getDb();

  // 1. exact canonical
  if (canonical) {
    const exact = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM objects WHERE canonical_name = ? LIMIT 1',
      [canonical],
    );
    if (exact) return exact.id;
  }

  // 2. exact display
  const disp = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM objects WHERE LOWER(display_name) = LOWER(?) LIMIT 1',
    [cleaned],
  );
  if (disp) return disp.id;

  // 3. display substring
  const dispSub = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM objects WHERE LOWER(display_name) LIKE LOWER(?) LIMIT 1',
    [`%${cleaned}%`],
  );
  if (dispSub) return dispSub.id;

  // 4. description substring
  const descSub = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM objects WHERE description IS NOT NULL AND LOWER(description) LIKE LOWER(?) LIMIT 1',
    [`%${cleaned}%`],
  );
  if (descSub) return descSub.id;

  return null;
}

/**
 * Derived "last seen in {room}" hint for the Setup objects list. Returns the
 * most-recent sighting room per object (only objects that have a room_hint).
 * Read-only — there is no stored object↔room relationship (handoff §6).
 */
export async function lastSeenRooms(objectIds: number[]): Promise<Record<number, string>> {
  if (objectIds.length === 0) return {};
  try {
    const db = await getDb();
    const placeholders = objectIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ object_id: number; room_hint: string }>(
      `SELECT s.object_id AS object_id, s.room_hint AS room_hint
         FROM sightings s
         JOIN (
           SELECT object_id, MAX(observed_at) AS mo
             FROM sightings
            WHERE room_hint IS NOT NULL AND object_id IN (${placeholders})
            GROUP BY object_id
         ) m ON s.object_id = m.object_id AND s.observed_at = m.mo`,
      objectIds,
    );
    const out: Record<number, string> = {};
    for (const r of rows) if (r.room_hint) out[r.object_id] = r.room_hint;
    return out;
  } catch {
    return {};
  }
}

/**
 * E5.2 + E5.3 — resolve the noun to an object_id (E5.4), look up the
 * most-recent sighting, and classify by NFR-8's freshness window:
 *   <= MEMORY_FRESH_HOURS  → 'fresh'
 *   <= MEMORY_HEDGE_HOURS  → 'hedged'
 *   older OR no sighting   → 'miss' (consumer falls through to model)
 */
export async function recall(
  noun: string,
  nowMs: number = now(),
): Promise<RecallOutcome> {
  // Whole body is guarded: any DB error (incl. a stale handle after a dev
  // hot-reload) must degrade to a 'miss' so the caller falls through to a live
  // model answer — never crash the Ask flow. resolveObjectFromUtterance also
  // touches the DB, so it must be inside the try.
  try {
    const objectId = await resolveObjectFromUtterance(noun);
    if (objectId === null) return { freshness: 'miss' };
    const db = await getDb();
    const row = await db.getFirstAsync<Sighting>(
      'SELECT id, object_id, observed_at, snapshot_uri, room_hint, source_action, excerpt FROM sightings WHERE object_id = ? ORDER BY observed_at DESC LIMIT 1',
      [objectId],
    );
    if (!row) return { freshness: 'miss' };

    const ageH = (nowMs - row.observed_at) / HOUR_MS;
    if (ageH <= CONFIG.MEMORY_FRESH_HOURS) return { freshness: 'fresh', sighting: row };
    if (ageH <= CONFIG.MEMORY_HEDGE_HOURS) return { freshness: 'hedged', sighting: row };
    return { freshness: 'miss' };
  } catch {
    return { freshness: 'miss' };
  }
}
