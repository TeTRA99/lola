// FR-3 Remember-this-for-me — Charly-run one-time catalog management.
// Backed by the `objects` table from architecture AD-3.

import type { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from '@/adapters/storage';
import { ok, err, type Result } from '@/utils/result';
import { now } from '@/utils/time';

export type CatalogObject = {
  id: number;
  canonical_name: string;
  display_name: string;
  description: string | null;
  reference_image_uri: string | null;
};

export type ObjectCatalog = CatalogObject[];

/**
 * Convert a Spanish display name into a snake_case canonical id.
 * Strips accents, lowercases, drops non-alphanumeric, collapses whitespace.
 *
 * "Cepillo de Papá"        → "cepillo_de_papa"
 * "Yerba Cruz de Malta!!"  → "yerba_cruz_de_malta"
 */
export function canonicalize(display: string): string {
  return display
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

export async function addObject(input: {
  canonical?: string;
  display: string;
  description?: string;
  reference_image_uri?: string;
}): Promise<Result<{ id: number }, 'duplicate_canonical' | 'storage_error'>> {
  const canonical = input.canonical ?? canonicalize(input.display);
  if (!canonical) return err('storage_error'); // display name produced an empty canonical
  const ts = now();
  try {
    const db = await getDb();

    // If a row already exists with this canonical (typically auto-created by
    // DescribeService when the model "observed" it in a scene), promote it to
    // 'catalog' and overwrite display/description with the user's input.
    // Same canonical already in 'catalog' is the real duplicate case.
    const existing = await db.getFirstAsync<{ id: number; source: string }>(
      'SELECT id, source FROM objects WHERE canonical_name = ?',
      [canonical],
    );
    if (existing) {
      if (existing.source === 'catalog') return err('duplicate_canonical');
      await db.runAsync(
        `UPDATE objects SET source = 'catalog', display_name = ?, description = ?,
           reference_image_uri = COALESCE(?, reference_image_uri), updated_at = ?
         WHERE id = ?`,
        [
          input.display,
          input.description ?? null,
          input.reference_image_uri ?? null,
          ts,
          existing.id,
        ],
      );
      return ok({ id: existing.id });
    }

    const result = await db.runAsync(
      'INSERT INTO objects (canonical_name, display_name, description, source, reference_image_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        canonical,
        input.display,
        input.description ?? null,
        'catalog',
        input.reference_image_uri ?? null,
        ts,
        ts,
      ],
    );
    return ok({ id: result.lastInsertRowId });
  } catch (e) {
    const msg = String(e);
    if (/UNIQUE/i.test(msg) && /canonical_name/i.test(msg)) {
      return err('duplicate_canonical');
    }
    return err('storage_error');
  }
}

export async function updateObject(
  id: number,
  patch: Partial<Pick<CatalogObject, 'display_name' | 'description' | 'reference_image_uri'>>,
): Promise<Result<void, 'not_found' | 'storage_error'>> {
  const sets: string[] = [];
  const args: SQLiteBindValue[] = [];
  if (patch.display_name !== undefined) { sets.push('display_name = ?'); args.push(patch.display_name); }
  if (patch.description !== undefined) { sets.push('description = ?'); args.push(patch.description); }
  if (patch.reference_image_uri !== undefined) { sets.push('reference_image_uri = ?'); args.push(patch.reference_image_uri); }
  if (sets.length === 0) return ok(undefined);
  sets.push('updated_at = ?');
  args.push(now());
  args.push(id);

  try {
    const db = await getDb();
    const result = await db.runAsync(`UPDATE objects SET ${sets.join(', ')} WHERE id = ?`, args);
    if (result.changes === 0) return err('not_found');
    return ok(undefined);
  } catch {
    return err('storage_error');
  }
}

export async function removeObject(
  id: number,
): Promise<Result<void, 'not_found' | 'storage_error'>> {
  try {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM objects WHERE id = ?', [id]);
    if (result.changes === 0) return err('not_found');
    // Filesystem cleanup is the caller's responsibility (E4.3's CatalogPhotos
    // exposes removeForObject) — kept loose so this service stays SQL-only.
    return ok(undefined);
  } catch {
    return err('storage_error');
  }
}

export async function getCatalog(): Promise<ObjectCatalog> {
  try {
    const db = await getDb();
    return await db.getAllAsync<CatalogObject>(
      `SELECT id, canonical_name, display_name, description, reference_image_uri
       FROM objects
       WHERE source = 'catalog'
       ORDER BY display_name ASC`,
    );
  } catch {
    return [];
  }
}
