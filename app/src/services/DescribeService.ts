// FR-1 Describe orchestration — snapshot → OpenRouter → TTS → telemetry.
// State machine: looking → thinking → answer_ready (or error) → speaking.
// E1.6's haptic adapter is currently a no-op stub; transitions still fire so
// the timing semantics are exercised.

import { speak } from '@/adapters/tts';
import { fire } from '@/adapters/haptics';
import { captureSnapshot } from '@/adapters/camera';
import { chat, inferenceMode } from '@/services/ModelRouter';
import { buildSystemPrompt } from '@/prompts/lola';
import { getDb } from '@/adapters/storage';
import { errorCopyFor, isLowConfidenceResponse, type ErrorKind } from '@/services/errorCopy';
import * as OnboardingService from '@/services/OnboardingService';
import * as SnapshotCache from '@/services/SnapshotCache';
import * as MemoryService from '@/services/MemoryService';
import * as RoomCatalog from '@/services/RoomCatalog';
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
  console.log('[describe] step 1: snapshot');
  const snap = await captureSnapshot();
  if (!snap.ok) {
    console.log('[describe] snapshot FAILED with:', snap.error);
    fire('error');
    const kind: ErrorKind = snap.error === 'permission_denied' ? 'permission_denied_camera' : 'no_camera';
    await speak(errorCopyFor(kind));
    await logEvent('describe', false, now() - t0, snap.error);
    return err(snap.error === 'permission_denied' ? 'permission_denied' : 'no_camera');
  }
  console.log('[describe] snapshot OK, base64 len:', snap.value.base64.length);

  // 2. Room identification (best-effort, runs in parallel with prompt build).
  // If the snapshot matches a tagged room, we inject "estás en X" into the
  // narration prompt so the model leads with location.
  const roomPromise = RoomCatalog.identifyRoom(snap.value.uri);

  // 3. Model call
  fire('thinking_start');
  const catalog = await loadCatalogSafe();
  const roomRes = await roomPromise;
  const roomName = roomRes.ok && roomRes.value ? roomRes.value.displayName : null;
  if (roomName) console.log('[describe] room identified:', roomName);
  const userText = roomName
    ? `Estás en ${roomName}. Describi esta escena, empezando por mencionar el cuarto.`
    : 'Describe esta escena.';
  // Sharper, item-focused instruction for the on-device VLM (it follows the user
  // turn better than the system prompt). Lola is the user's eyes at home: name the
  // things in front of them, not the "scene"/ambiance.
  const objectsTask = 'Nombrá los objetos principales que tengo adelante, en una o dos frases cortas separadas por comas, y decime dónde está cada cosa. Solo los objetos cotidianos que ves, sin describir la escena ni el ambiente ni para qué sirven.';
  const localUserText = roomName ? `Estás en ${roomName}. ${objectsTask}` : objectsTask;
  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText,
    localUserText,
    imageBase64: snap.value.base64,
    imageUri: snap.value.uri, // used by the on-device VLM path (cloud ignores it)
  });
  fire('thinking_stop');

  if (!resp.ok) {
    console.log('[describe] chat FAILED with:', resp.error);
    fire('error');
    const kind: ErrorKind = resp.error === 'network' ? 'network' : resp.error === 'parse_fail' ? 'parse_fail' : 'unknown';
    await speak(errorCopyFor(kind));
    await logEvent('describe', false, now() - t0, resp.error);
    if (resp.error === 'network') return err('network');
    if (resp.error === 'parse_fail') return err('parse_fail');
    return err('unknown');
  }
  console.log('[describe] chat OK');

  // 3. Low-confidence detection
  const { narration, objects } = resp.value;
  // The on-device VLM returns objects:[] (narration-only), which would falsely
  // trip the heuristic; trust the local narration instead.
  const isLowConfidence = inferenceMode() === 'local' ? false : isLowConfidenceResponse(resp.value);

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

  // 6. Write sightings (E5.1) — passive memory log byproduct.
  // Store the full describe narration as the excerpt so memory recall can
  // surface the scene context later ("the mug was on the white table…")
  // without needing a fresh camera frame.
  for (const o of objects) {
    void MemoryService.recordSighting({
      canonical: o.canonical,
      display: o.display,
      observed_at: now(),
      snapshot_uri: persistedUri,
      room_hint: o.room_hint,
      source_action: 'describe',
      excerpt: narration,
    });
  }

  await logEvent('describe', !isLowConfidence, now() - t0, isLowConfidence ? 'low_confidence' : null);

  if (isLowConfidence) return err('low_confidence');
  return ok({ narration, objects, snapshotUri: persistedUri });
}
