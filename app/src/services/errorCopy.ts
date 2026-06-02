// Centralized mapping: service/adapter/gateway error code → FR-6.4 COPY line.
// Per E2.5 — keeps the dad-facing copy mapping in one auditable place so
// downstream services don't drift on the same kinds.

import { COPY } from './CopyModule';
import type { LolaResponse } from '@/gateways/openrouter';

export type ErrorKind =
  | 'low_confidence'
  | 'network'
  | 'parse_fail'
  | 'permission_denied_camera'
  | 'permission_denied_mic'
  | 'no_camera'
  | 'no_speech'
  | 'timeout'
  | 'no_locale'
  | 'engine_unavailable'
  | 'auth'
  | 'rate_limit'
  | 'unknown';

const MAP: Record<ErrorKind, keyof typeof COPY.errors> = {
  low_confidence: 'lowConfidence',
  network: 'noNetwork',
  permission_denied_camera: 'cameraPermission',
  permission_denied_mic: 'micPermission',
  parse_fail: 'generic',
  no_camera: 'generic',
  no_speech: 'generic',
  timeout: 'generic',
  no_locale: 'generic',
  engine_unavailable: 'generic',
  auth: 'generic',
  rate_limit: 'generic',
  unknown: 'generic',
};

export function errorCopyFor(kind: ErrorKind): string {
  const key = MAP[kind];
  // Generic errors rotate through a few phrasings so the retry prompt doesn't
  // feel repetitive when failures cluster.
  if (key === 'generic') {
    const v = COPY.errors.genericVariants;
    return v[Math.floor(Math.random() * v.length)];
  }
  return COPY.errors[key] as string;
}

const LOW_CONFIDENCE_PREFIXES = ['No estoy segura', 'No tengo', 'No puedo'];

export function isLowConfidenceResponse(resp: LolaResponse): boolean {
  return (
    resp.objects.length === 0 &&
    LOW_CONFIDENCE_PREFIXES.some(p => resp.narration.startsWith(p))
  );
}
