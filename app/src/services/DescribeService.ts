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
import { COPY } from '@/services/CopyModule';
import * as OnboardingService from '@/services/OnboardingService';
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

const LOW_CONFIDENCE_PREFIXES = ['No estoy segura', 'No tengo', 'No puedo'];

let lastDescribe: { narration: string; snapshotUri: string } | null = null;

export function getLastDescribe(): { narration: string; snapshotUri: string } | null {
  return lastDescribe;
}

export function _resetForTests(): void {
  lastDescribe = null;
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
    const msg =
      snap.error === 'permission_denied' ? COPY.errors.cameraPermission : COPY.errors.generic;
    await speak(msg);
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
    const msg = resp.error === 'network' ? COPY.errors.noNetwork : COPY.errors.generic;
    await speak(msg);
    await logEvent('describe', false, now() - t0, resp.error);
    if (resp.error === 'network') return err('network');
    if (resp.error === 'parse_fail') return err('parse_fail');
    return err('unknown');
  }

  // 3. Low-confidence detection
  const { narration, objects } = resp.value;
  const isLowConfidence =
    objects.length === 0 &&
    LOW_CONFIDENCE_PREFIXES.some(p => narration.startsWith(p));

  // 4. Speak (even the gentle-question gets voiced)
  fire('answer_ready');
  await speak(narration);

  lastDescribe = { narration, snapshotUri: snap.value.uri };

  await logEvent('describe', !isLowConfidence, now() - t0, isLowConfidence ? 'low_confidence' : null);

  if (isLowConfidence) return err('low_confidence');
  return ok({ narration, objects, snapshotUri: snap.value.uri });
}
