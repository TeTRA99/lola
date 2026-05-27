// FR-1 Describe — orchestrates snapshot → OpenRouter → TTS → sighting log.
// Filled in by E2.2.

import type { Result } from '@/utils/result';

export type DescribeError = 'low_confidence' | 'network' | 'parse_fail' | 'unknown';

export type DescribedObject = {
  canonical: string;
  display: string;
  room_hint: string | null;
};

export type DescribeOutcome = {
  narration: string;
  objects: DescribedObject[];
  snapshotUri: string;
};

export async function run(): Promise<Result<DescribeOutcome, DescribeError>> {
  throw new Error('not_implemented');
}
