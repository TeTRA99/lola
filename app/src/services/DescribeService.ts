// FR-1 Describe orchestration — snapshot → OpenRouter → TTS → telemetry.
// State machine: looking → thinking → answer_ready (or error) → speaking.
// E1.6's haptic adapter is currently a no-op stub; transitions still fire so
// the timing semantics are exercised.

import { speak } from '@/adapters/tts';
import { fire } from '@/adapters/haptics';
import { captureSnapshot } from '@/adapters/camera';
import { chat } from '@/gateways/openrouter';
import { buildSystemPrompt } from '@/prompts/lola';
import { getDb } from '@/adapters/storage';
import { errorCopyFor, isLowConfidenceResponse, type ErrorKind } from '@/services/errorCopy';
import * as OnboardingService from '@/services/OnboardingService';
import * as SnapshotCache from '@/services/SnapshotCache';
import { ok, err, type Result } from '@/utils/result';
import { now } from '@/utils/time';

export type DescribeError =
  | 'permission_denied'
  | 'no_camera'
  | 'low_confidence'
  | 'network'
  | 'parse_fail'
  | 'unknown';

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

/** Latest describe is derived from the cache; no module-local needed (E2.4). */
export function getLastDescribe(): { narration: string; snapshotUri: string } | null {
  const e = SnapshotCache.getLatest();
  if (!e || !e.narration) return null;
  return { narration: e.narration, snapshotUri: e.uri };
}

export function _resetForTests(): void {
  SnapshotCache._resetForTests();
}

async function loadCatalogSafe() {
  try {
    return await OnboardingService.getCatalog();
  } catch {
    // E4.4 hasn't shipped — getCatalog() throws 'not_implemented'.
    // Null catalog → prompt without catalog block; works fine.
    return null;
  }
}

async function logEvent(
  action: 'describe',
  success: boolean,
  latencyMs: number,
  errorKind: string | null,
): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO usage_events (occurred_at, action, success, latency_ms, error_kind) VALUES (?, ?, ?, ?, ?)',
      [now(), action, success ? 1 : 0, latencyMs, errorKind],
    );
  } catch {
    // Telemetry failures are silent — never block the user-facing flow.
  }
}

export async function run(): Promise<Result<DescribeOutcome, DescribeError>> {
  const t0 = now();
  fire('looking');

  // 1. Snapshot
  const snap = await captureSnapshot();
  if (!snap.ok) {
    fire('error');
    const kind: ErrorKind = snap.error === 'permission_denied' ? 'permission_denied_camera' : 'no_camera';
    await speak(errorCopyFor(kind));
    await logEvent('describe', false, now() - t0, snap.error);
    return err(snap.error === 'permission_denied' ? 'permission_denied' : 'no_camera');
  }

  // 2. Model call
  fire('thinking_start');
  const catalog = await loadCatalogSafe();
  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText: 'Describe esta escena.',
    imageBase64: snap.value.base64,
  });
  fire('thinking_stop');

  if (!resp.ok) {
    fire('error');
    const kind: ErrorKind = resp.error === 'network' ? 'network' : resp.error === 'parse_fail' ? 'parse_fail' : 'unknown';
    await speak(errorCopyFor(kind));
    await logEvent('describe', false, now() - t0, resp.error);
    if (resp.error === 'network') return err('network');
    if (resp.error === 'parse_fail') return err('parse_fail');
    return err('unknown');
  }

  // 3. Low-confidence detection
  const { narration, objects } = resp.value;
  const isLowConfidence = isLowConfidenceResponse(resp.value);

  // 4. Speak (even the gentle-question gets voiced)
  fire('answer_ready');
  await speak(narration);

  // 5. Persist snapshot for FR-1 repeat/extend (E2.4).
  let persistedUri = snap.value.uri;
  try {
    persistedUri = SnapshotCache.saveSnapshot(snap.value.base64);
    SnapshotCache.attachNarration(persistedUri, narration);
  } catch {
    // Snapshot persistence is best-effort — don't fail the describe flow on disk errors.
  }

  await logEvent('describe', !isLowConfidence, now() - t0, isLowConfidence ? 'low_confidence' : null);

  if (isLowConfidence) return err('low_confidence');
  return ok({ narration, objects, snapshotUri: persistedUri });
}
