// FR-2 Ask orchestration. Mirror of DescribeService for the question-driven
// path, with utterance routing (E3.1) deciding between repeat / extend /
// memory recall / model call.

import { speak } from '@/adapters/tts';
import { listen } from '@/adapters/stt';
import { fire } from '@/adapters/haptics';
import { captureSnapshot } from '@/adapters/camera';
import { chat } from '@/gateways/openrouter';
import { buildSystemPrompt } from '@/prompts/lola';
import { getDb } from '@/adapters/storage';
import { errorCopyFor, isLowConfidenceResponse, type ErrorKind } from '@/services/errorCopy';
import { route, type RouteDecision } from '@/services/UtteranceRouter';
import { applyCatalogNarration } from '@/services/CatalogResolver';
import * as OnboardingService from '@/services/OnboardingService';
import * as SnapshotCache from '@/services/SnapshotCache';
import * as MemoryService from '@/services/MemoryService';
import { ok, err, type Result } from '@/utils/result';
import { now } from '@/utils/time';
import { ago } from '@/utils/relativeTime';
import type { LolaObject } from '@/gateways/openrouter';

export type AskError =
  | 'permission_denied'
  | 'permission_denied_mic'
  | 'no_camera'
  | 'no_speech'
  | 'low_confidence'
  | 'network'
  | 'parse_fail'
  | 'unknown';

export type AskRoute = RouteDecision['type'] | 'memory_hit' | 'memory_miss';

export type AskOutcome = {
  narration: string;
  objects: LolaObject[];
  route: AskRoute;
};

async function loadCatalogSafe() {
  try { return await OnboardingService.getCatalog(); }
  catch { return null; }
}

async function logEvent(
  success: boolean,
  latencyMs: number,
  errorKind: string | null,
): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO usage_events (occurred_at, action, success, latency_ms, error_kind) VALUES (?, ?, ?, ?, ?)',
      [now(), 'ask', success ? 1 : 0, latencyMs, errorKind],
    );
  } catch { /* silent */ }
}

const EXTEND_USER_TEXT = 'Contame más sobre esta escena, hasta 80 palabras.';

export async function run(): Promise<Result<AskOutcome, AskError>> {
  const t0 = now();
  fire('looking');

  // 1. Snapshot first — dad refers to "esto" (AC2.2).
  const snap = await captureSnapshot();
  if (!snap.ok) {
    fire('error');
    const kind: ErrorKind = snap.error === 'permission_denied' ? 'permission_denied_camera' : 'no_camera';
    await speak(errorCopyFor(kind));
    await logEvent(false, now() - t0, snap.error);
    return err(snap.error === 'permission_denied' ? 'permission_denied' : 'no_camera');
  }

  // 2. STT
  fire('listening_start');
  const sttResult = await listen();
  fire('listening_stop');
  if (!sttResult.ok) {
    fire('error');
    const kind: ErrorKind =
      sttResult.error === 'permission_denied' ? 'permission_denied_mic' :
      sttResult.error === 'no_speech' ? 'no_speech' :
      sttResult.error === 'no_locale' ? 'no_locale' :
      sttResult.error === 'timeout' ? 'timeout' :
      'unknown';
    await speak(errorCopyFor(kind));
    await logEvent(false, now() - t0, sttResult.error);
    return err(sttResult.error === 'permission_denied' ? 'permission_denied_mic' :
               sttResult.error === 'no_speech' ? 'no_speech' : 'unknown');
  }

  const utterance = sttResult.value;
  const decision = route(utterance);

  // 3. Dispatch
  switch (decision.type) {
    case 'repeat':
      return handleRepeat(t0);
    case 'extend':
      return handleExtend(snap.value.base64, t0);
    case 'memory':
      return handleMemory(decision.object, snap.value.base64, utterance, t0);
    case 'model':
      return handleModel(snap.value.base64, utterance, t0);
  }
}

async function handleRepeat(t0: number): Promise<Result<AskOutcome, AskError>> {
  const latest = SnapshotCache.getLatest();
  if (!latest || !latest.narration) {
    fire('error');
    await speak(errorCopyFor('unknown'));
    await logEvent(false, now() - t0, 'repeat_no_prior');
    return err('unknown');
  }
  fire('answer_ready');
  await speak(latest.narration);
  await logEvent(true, now() - t0, 'repeat');
  return ok({ narration: latest.narration, objects: [], route: 'repeat' });
}

async function handleExtend(imageBase64: string, t0: number): Promise<Result<AskOutcome, AskError>> {
  fire('thinking_start');
  const catalog = await loadCatalogSafe();
  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText: EXTEND_USER_TEXT,
    imageBase64,
  });
  fire('thinking_stop');

  if (!resp.ok) {
    fire('error');
    const kind: ErrorKind = resp.error === 'network' ? 'network' : 'unknown';
    await speak(errorCopyFor(kind));
    await logEvent(false, now() - t0, resp.error);
    return err(resp.error === 'network' ? 'network' : 'unknown');
  }

  const narration = catalog
    ? applyCatalogNarration(resp.value.narration, resp.value.objects, catalog)
    : resp.value.narration;

  fire('answer_ready');
  await speak(narration);
  await logEvent(true, now() - t0, 'extend');
  return ok({ narration, objects: resp.value.objects, route: 'extend' });
}

/**
 * Speak a memory-recall sentence with freshness-aware hedging.
 * E5.2 (hit path) + E5.3 (freshness window).
 */
function buildRecallNarration(sighting: MemoryService.Sighting, freshness: 'fresh' | 'hedged'): string {
  const when = ago(sighting.observed_at);
  const where = sighting.room_hint;
  if (freshness === 'fresh') {
    return where
      ? `Lo vi ${when} en ${where}.`
      : `Lo vi ${when}, no estoy segura en qué cuarto.`;
  }
  // hedged
  return where
    ? `Hace un tiempo lo vi en ${where}, pero puede haberse movido.`
    : `Lo vi ${when}, pero puede haberse movido.`;
}

async function handleMemory(
  noun: string,
  imageBase64: string,
  utterance: string,
  t0: number,
): Promise<Result<AskOutcome, AskError>> {
  const outcome = await MemoryService.recall(noun);

  if (outcome.freshness === 'fresh' || outcome.freshness === 'hedged') {
    const narration = buildRecallNarration(outcome.sighting, outcome.freshness);
    fire('answer_ready');
    await speak(narration);
    await logEvent(true, now() - t0, `memory_${outcome.freshness}`);
    return ok({ narration, objects: [], route: 'memory_hit' });
  }

  // Miss — fall through to model call with the original utterance.
  const r = await handleModel(imageBase64, utterance, t0);
  if (r.ok) {
    await logEvent(true, now() - t0, 'memory_miss');
    return ok({ ...r.value, route: 'memory_miss' });
  }
  return r;
}

async function handleModel(
  imageBase64: string,
  userText: string,
  t0: number,
): Promise<Result<AskOutcome, AskError>> {
  fire('thinking_start');
  const catalog = await loadCatalogSafe();
  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText,
    imageBase64,
  });
  fire('thinking_stop');

  if (!resp.ok) {
    fire('error');
    const kind: ErrorKind =
      resp.error === 'network' ? 'network' :
      resp.error === 'parse_fail' ? 'parse_fail' :
      'unknown';
    await speak(errorCopyFor(kind));
    await logEvent(false, now() - t0, resp.error);
    return err(resp.error === 'network' ? 'network' :
               resp.error === 'parse_fail' ? 'parse_fail' : 'unknown');
  }

  const isLow = isLowConfidenceResponse(resp.value);
  const narration = catalog
    ? applyCatalogNarration(resp.value.narration, resp.value.objects, catalog)
    : resp.value.narration;

  fire('answer_ready');
  await speak(narration);

  // Persist + sightings — same byproduct pattern as DescribeService.
  let persistedUri: string | null = null;
  try {
    persistedUri = SnapshotCache.saveSnapshot(imageBase64);
    SnapshotCache.attachNarration(persistedUri, narration);
  } catch { /* best-effort */ }

  for (const o of resp.value.objects) {
    void MemoryService.recordSighting({
      canonical: o.canonical,
      display: o.display,
      observed_at: now(),
      snapshot_uri: persistedUri,
      room_hint: o.room_hint,
      source_action: 'ask',
      excerpt: o.display,
    });
  }

  await logEvent(!isLow, now() - t0, isLow ? 'low_confidence' : null);
  if (isLow) return err('low_confidence');
  return ok({ narration, objects: resp.value.objects, route: 'model' });
}
