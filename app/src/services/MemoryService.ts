// FR-4 Where-is-X — sighting writes (E5.1) + recall (E5.2).

import type { Result } from '@/utils/result';

export type Sighting = {
  id: number;
  object_id: number;
  observed_at: number;          // unix ms
  snapshot_uri: string | null;
  room_hint: string | null;
  source_action: 'describe' | 'ask';
  excerpt: string | null;
};

export type RecallOutcome =
  | { freshness: 'fresh'; sighting: Sighting }      // <24h — confident
  | { freshness: 'hedged'; sighting: Sighting }     // 24–72h — hedge phrasing
  | { freshness: 'miss' };                          // >72h or no record

export async function recordSighting(_input: {
  canonical: string;
  observed_at: number;
  snapshot_uri: string | null;
  room_hint: string | null;
  source_action: 'describe' | 'ask';
  excerpt: string | null;
}): Promise<Result<{ id: number }, 'storage_error'>> {
  throw new Error('not_implemented');
}

export async function recall(_objectName: string): Promise<RecallOutcome> {
  throw new Error('not_implemented');
}
