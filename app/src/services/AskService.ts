// FR-2 Ask — snapshot + STT + utterance routing + model call.
// Filled in by E3.2.

import type { Result } from '@/utils/result';
import type { DescribedObject } from './DescribeService';

export type AskError =
  | 'low_confidence' | 'network' | 'parse_fail'
  | 'no_speech' | 'permission_denied' | 'unknown';

export type AskRoute = 'repeat' | 'extend' | { type: 'memory'; object: string } | 'model';

export type AskOutcome = {
  narration: string;
  objects: DescribedObject[];
  route: AskRoute;
};

export async function run(): Promise<Result<AskOutcome, AskError>> {
  throw new Error('not_implemented');
}
