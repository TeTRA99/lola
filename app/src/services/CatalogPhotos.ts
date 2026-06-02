// FR-3 catalog photo capture + persistence.
// Photos live at Paths.document/catalog/<object_id>/<n>.jpg.
// Max 3 photos per object (AC4.3.3). Never evicted — lifetime tied to the
// catalog row's existence.

import { Directory, File, Paths } from 'expo-file-system';
import { captureSnapshot } from '@/adapters/camera';
import { ok, err, type Result } from '@/utils/result';

const ROOT = new Directory(Paths.document, 'catalog');
const MAX_PHOTOS_PER_OBJECT = 3;

export type CatalogPhotoError = 'limit_reached' | 'capture_failed' | 'permission_denied';

function ensureRoot(): void {
  if (!ROOT.exists) ROOT.create({ intermediates: true });
}

function objectDir(objectId: number): Directory {
  return new Directory(ROOT, String(objectId));
}

function listFilesIn(dir: Directory): File[] {
  if (!dir.exists) return [];
  return (dir.list() as Array<File | Directory>)
    .filter((e): e is File => e instanceof File)
    .sort((a, b) => a.uri.localeCompare(b.uri));
}

export async function captureForObject(
  objectId: number,
): Promise<Result<string, CatalogPhotoError>> {
  ensureRoot();
  const dir = objectDir(objectId);
  if (!dir.exists) dir.create({ intermediates: true });

  const existing = listFilesIn(dir);
  if (existing.length >= MAX_PHOTOS_PER_OBJECT) return err('limit_reached');

  const snap = await captureSnapshot();
  if (!snap.ok) {
    return err(snap.error === 'permission_denied' ? 'permission_denied' : 'capture_failed');
  }

  return saveBase64ForObject(objectId, snap.value.base64);
}

/**
 * Save an already-captured base64 image as the next photo for the object.
 * Used by the SetupScreen CapturePhotoModal path so it can show a live preview
 * before pulling the trigger.
 */
export function saveBase64ForObject(
  objectId: number,
  base64: string,
): Result<string, CatalogPhotoError> {
  ensureRoot();
  const dir = objectDir(objectId);
  if (!dir.exists) dir.create({ intermediates: true });
  const existing = listFilesIn(dir);
  if (existing.length >= MAX_PHOTOS_PER_OBJECT) return err('limit_reached');
  const nextIndex = existing.length + 1;
  const file = new File(dir, `${nextIndex}.jpg`);
  try {
    file.write(base64, { encoding: 'base64' });
    return ok(file.uri);
  } catch {
    return err('capture_failed');
  }
}

export function removeForObject(objectId: number): void {
  const dir = objectDir(objectId);
  if (dir.exists) {
    try { dir.delete(); } catch { /* best-effort */ }
  }
}

export function listForObject(objectId: number): string[] {
  return listFilesIn(objectDir(objectId)).map(f => f.uri);
}

/**
 * Current absolute URI of the object's primary (first) photo, or null if none.
 * Re-derived from the live document directory every call — the stored
 * objects.reference_image_uri is an ABSOLUTE path whose iOS container UUID changes
 * across reinstalls, so it goes stale; the file itself stays at catalog/<id>/1.jpg.
 * Always resolve display/use paths through here, not the stored column.
 */
export function primaryUriFor(objectId: number): string | null {
  return listFilesIn(objectDir(objectId))[0]?.uri ?? null;
}
