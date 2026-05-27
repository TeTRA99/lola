// Filesystem adapter — uses the SDK 54+ class-based API (Paths + File + Directory).
// NOT the legacy `FileSystem.documentDirectory` style (removed from default export).
//
// LRU cache logic (CACHE_MAX_SNAPSHOTS / CACHE_MAX_BYTES) lands in E2.4.
// FR-3 catalog photo storage lands in E4.3.

import { Paths, Directory } from 'expo-file-system';

export const SNAPSHOTS_DIR = new Directory(Paths.document, 'snapshots');
export const CATALOG_DIR = new Directory(Paths.document, 'catalog');

/**
 * Idempotent: create the snapshots/ and catalog/ dirs if they don't exist.
 * Call once at app boot (probably from src/app.tsx after SQLite is up).
 */
export function ensureDirs(): void {
  if (!SNAPSHOTS_DIR.exists) SNAPSHOTS_DIR.create({ intermediates: true });
  if (!CATALOG_DIR.exists) CATALOG_DIR.create({ intermediates: true });
}
