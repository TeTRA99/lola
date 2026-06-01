// v1.1 — Visual room recognition. Charly-tagged catalogue of rooms with
// reference photos; each photo carries a multimodal embedding so a snapshot
// can be classified against the catalog with a local cosine-similarity scan.
//
// Boundary: RoomCatalog owns *catalog state* + identification logic. Camera
// capture lives in CapturePhotoModal / camera adapter. Embeddings live in
// the openrouter gateway. SQL lives in adapters/storage.

import type { SQLiteBindValue } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { getDb } from '@/adapters/storage';
import { embedImageLocal } from '@/adapters/embeddings';
import { canonicalize } from './OnboardingService';
import { ok, err, type Result } from '@/utils/result';
import { now } from '@/utils/time';

const ROOT = new Directory(Paths.document, 'rooms');
const MAX_PHOTOS_PER_ROOM = 5;
// Match a snapshot against a stored room only if the best-photo similarity
// crosses this. Below = "no estoy segura" rather than guessing wrong.
const SIMILARITY_THRESHOLD = 0.55;

export type Room = {
  id: number;
  canonical_name: string;
  display_name: string;
  description: string | null;
  reference_image_uri: string | null;
};

export type RoomPhoto = {
  id: number;
  room_id: number;
  uri: string;
  embedding: number[];
};

export type RoomMatch = { roomId: number; displayName: string; similarity: number };

function ensureRoot(): void {
  if (!ROOT.exists) ROOT.create({ intermediates: true });
}

function roomDir(roomId: number): Directory {
  return new Directory(ROOT, String(roomId));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ----- CRUD -----

export async function addRoom(input: {
  display: string;
  description?: string;
}): Promise<Result<{ id: number }, 'duplicate_canonical' | 'storage_error'>> {
  const canonical = canonicalize(input.display);
  if (!canonical) return err('storage_error');
  const ts = now();
  try {
    const db = await getDb();
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM rooms WHERE canonical_name = ?',
      [canonical],
    );
    if (existing) return err('duplicate_canonical');
    const r = await db.runAsync(
      'INSERT INTO rooms (canonical_name, display_name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [canonical, input.display, input.description ?? null, ts, ts],
    );
    return ok({ id: r.lastInsertRowId });
  } catch {
    return err('storage_error');
  }
}

export async function updateRoom(
  id: number,
  patch: Partial<Pick<Room, 'display_name' | 'description' | 'reference_image_uri'>>,
): Promise<Result<void, 'not_found' | 'storage_error'>> {
  const sets: string[] = [];
  const args: SQLiteBindValue[] = [];
  if (patch.display_name !== undefined) { sets.push('display_name = ?'); args.push(patch.display_name); }
  if (patch.description !== undefined) { sets.push('description = ?'); args.push(patch.description); }
  if (patch.reference_image_uri !== undefined) { sets.push('reference_image_uri = ?'); args.push(patch.reference_image_uri); }
  if (sets.length === 0) return ok(undefined);
  sets.push('updated_at = ?'); args.push(now()); args.push(id);
  try {
    const db = await getDb();
    const r = await db.runAsync(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, args);
    if (r.changes === 0) return err('not_found');
    return ok(undefined);
  } catch {
    return err('storage_error');
  }
}

export async function removeRoom(id: number): Promise<Result<void, 'storage_error'>> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM rooms WHERE id = ?', [id]);
    const dir = roomDir(id);
    if (dir.exists) {
      try { dir.delete(); } catch { /* best-effort */ }
    }
    return ok(undefined);
  } catch {
    return err('storage_error');
  }
}

export async function listRooms(): Promise<Room[]> {
  try {
    const db = await getDb();
    return await db.getAllAsync<Room>(
      'SELECT id, canonical_name, display_name, description, reference_image_uri FROM rooms ORDER BY display_name ASC',
    );
  } catch {
    return [];
  }
}

// ----- Photos + embeddings -----

export async function addPhotoForRoom(
  roomId: number,
  base64: string,
): Promise<Result<{ uri: string }, 'limit_reached' | 'embed_failed' | 'storage_error'>> {
  ensureRoot();
  const dir = roomDir(roomId);
  if (!dir.exists) dir.create({ intermediates: true });
  // Cap at MAX to keep embedding cost + storage predictable.
  try {
    const db = await getDb();
    const count = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM room_photos WHERE room_id = ?',
      [roomId],
    );
    if ((count?.c ?? 0) >= MAX_PHOTOS_PER_ROOM) return err('limit_reached');

    // Write the file first so the embedding pipeline can read from disk
    // (cheaper than shuttling base64 across the JS bridge for inference).
    const idx = (count?.c ?? 0) + 1;
    const file = new File(dir, `${idx}.jpg`);
    file.write(base64, { encoding: 'base64' });

    const emb = await embedImageLocal(file.uri);
    if (!emb.ok) {
      console.log('[room] embedImageLocal failed:', emb.error);
      // The file is on disk but we couldn't embed it — clean up so we don't
      // leave a photo we can't classify against later.
      try { file.delete(); } catch { /* best-effort */ }
      return err('embed_failed');
    }

    const ts = now();
    await db.runAsync(
      'INSERT INTO room_photos (room_id, uri, embedding_json, created_at) VALUES (?, ?, ?, ?)',
      [roomId, file.uri, JSON.stringify(emb.value), ts],
    );
    // First photo becomes the reference image automatically.
    if (idx === 1) {
      await updateRoom(roomId, { reference_image_uri: file.uri });
    }
    return ok({ uri: file.uri });
  } catch {
    return err('storage_error');
  }
}

export async function listPhotosForRoom(roomId: number): Promise<RoomPhoto[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: number; room_id: number; uri: string; embedding_json: string }>(
      'SELECT id, room_id, uri, embedding_json FROM room_photos WHERE room_id = ? ORDER BY id ASC',
      [roomId],
    );
    return rows
      .map(r => {
        try {
          const v = JSON.parse(r.embedding_json) as number[];
          if (!Array.isArray(v)) return null;
          return { id: r.id, room_id: r.room_id, uri: r.uri, embedding: v };
        } catch { return null; }
      })
      .filter((r): r is RoomPhoto => r !== null);
  } catch {
    return [];
  }
}

export async function removePhoto(photoId: number): Promise<void> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ uri: string }>(
      'SELECT uri FROM room_photos WHERE id = ?',
      [photoId],
    );
    await db.runAsync('DELETE FROM room_photos WHERE id = ?', [photoId]);
    if (row?.uri) {
      try { new File(row.uri).delete(); } catch { /* best-effort */ }
    }
  } catch { /* swallow */ }
}

// ----- Identification -----

/**
 * Classify a fresh snapshot against the room catalog. Returns the best
 * matching room when similarity crosses SIMILARITY_THRESHOLD, otherwise null.
 *
 * Scans ALL stored embeddings for now — fine while the catalog is small
 * (≤10 rooms × ≤5 photos = 50 comparisons). If this grows large later,
 * cluster room photos into centroids.
 */
export async function identifyRoom(snapshotUri: string): Promise<Result<RoomMatch | null, 'embed_failed' | 'storage_error'>> {
  // Load the catalog first and short-circuit when empty — no point loading the
  // 96MB model or running inference if there are no rooms to match against.
  let rows: { room_id: number; display_name: string; embedding_json: string }[];
  try {
    const db = await getDb();
    rows = await db.getAllAsync<{
      room_id: number;
      display_name: string;
      embedding_json: string;
    }>(
      `SELECT rp.room_id AS room_id, r.display_name AS display_name, rp.embedding_json AS embedding_json
       FROM room_photos rp JOIN rooms r ON r.id = rp.room_id`,
    );
  } catch {
    return err('storage_error');
  }
  if (rows.length === 0) return ok(null);

  const emb = await embedImageLocal(snapshotUri);
  if (!emb.ok) return err('embed_failed');
  try {
    let best: RoomMatch | null = null;
    for (const row of rows) {
      let v: number[];
      try { v = JSON.parse(row.embedding_json) as number[]; }
      catch { continue; }
      if (!Array.isArray(v) || v.length !== emb.value.length) continue;
      const sim = cosineSimilarity(emb.value, v);
      if (!best || sim > best.similarity) {
        best = { roomId: row.room_id, displayName: row.display_name, similarity: sim };
      }
    }
    if (best && best.similarity >= SIMILARITY_THRESHOLD) {
      console.log('[room] identified as:', best.displayName, 'sim:', best.similarity.toFixed(3));
      return ok(best);
    }
    console.log('[room] no match — best sim:', best?.similarity.toFixed(3) ?? 'n/a');
    return ok(null);
  } catch {
    return err('storage_error');
  }
}
