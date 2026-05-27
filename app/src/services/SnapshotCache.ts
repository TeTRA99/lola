// LRU snapshot cache backing FR-1 repeat / extend (architecture AD-5).
// Eviction: oldest first when count > CACHE_MAX_SNAPSHOTS OR total bytes
// > CACHE_MAX_BYTES. No persistence across cold restart by design — see
// AC2.4.4. E1.8's filesystem adapter pre-created the snapshots/ directory.

import { Directory, File, Paths } from 'expo-file-system';
import { CONFIG } from '@/config';

export type SnapshotEntry = {
  uri: string;
  sizeBytes: number;
  savedAt: number;
  narration?: string;
};

const DIR = new Directory(Paths.document, 'snapshots');

// Map preserves insertion order — naturally LRU-friendly.
const entries: Map<string, SnapshotEntry> = new Map();
let totalBytes = 0;

function ensureDir(): void {
  if (!DIR.exists) DIR.create({ intermediates: true });
}

function approxBase64Bytes(b64: string): number {
  // Each 4 base64 chars decode to 3 bytes (modulo padding).
  return Math.floor((b64.length * 3) / 4);
}

function evictIfNeeded(): void {
  while (
    entries.size > CONFIG.CACHE_MAX_SNAPSHOTS ||
    totalBytes > CONFIG.CACHE_MAX_BYTES
  ) {
    const oldestKey = entries.keys().next().value;
    if (!oldestKey) break;
    const e = entries.get(oldestKey);
    if (e) {
      totalBytes -= e.sizeBytes;
      try { new File(e.uri).delete(); } catch { /* file may already be gone */ }
    }
    entries.delete(oldestKey);
  }
}

/**
 * Writes a base64 snapshot to disk and registers it in the cache.
 * Returns the persisted file URI.
 */
export function saveSnapshot(base64: string): string {
  ensureDir();
  const ts = Date.now();
  const file = new File(DIR, `${ts}.jpg`);
  file.write(base64, { encoding: 'base64' });
  const sizeBytes = file.size ?? approxBase64Bytes(base64);
  const entry: SnapshotEntry = { uri: file.uri, sizeBytes, savedAt: ts };
  entries.set(file.uri, entry);
  totalBytes += sizeBytes;
  evictIfNeeded();
  return file.uri;
}

export function getEntry(uri: string): SnapshotEntry | null {
  return entries.get(uri) ?? null;
}

export function getLatest(): SnapshotEntry | null {
  let latest: SnapshotEntry | null = null;
  for (const e of entries.values()) {
    if (!latest || e.savedAt > latest.savedAt) latest = e;
  }
  return latest;
}

export function attachNarration(uri: string, narration: string): void {
  const e = entries.get(uri);
  if (e) e.narration = narration;
}

export function _resetForTests(): void {
  for (const uri of entries.keys()) {
    try { new File(uri).delete(); } catch { /* ignore */ }
  }
  entries.clear();
  totalBytes = 0;
}
