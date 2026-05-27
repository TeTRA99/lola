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

  const nextIndex = existing.length + 1;
  const file = new File(dir, `${nextIndex}.jpg`);
  file.write(snap.value.base64, { encoding: 'base64' });
  return ok(file.uri);
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
