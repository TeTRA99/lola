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
import { type RouteDecision } from '@/services/UtteranceRouter';
import { classifyIntent } from '@/services/IntentRouter';
import { resolveGuideTarget } from '@/services/GuideTargets';
import { COPY } from '@/services/CopyModule';
import { applyCatalogNarration } from '@/services/CatalogResolver';
import * as OnboardingService from '@/services/OnboardingService';
import * as SnapshotCache from '@/services/SnapshotCache';
import * as MemoryService from '@/services/MemoryService';
import * as RoomCatalog from '@/services/RoomCatalog';
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
  // Set on the "guíame a X" route when the object is guidable — the caller
  // opens the live guide screen with this target. Absent → no navigation.
  guide?: { cocoLabel: string; spoken: string };
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

  // 1. Listen first — many routes (repeat/memory) need no image, so don't
  // burn a snapshot + shutter sound when we don't have to.
  console.log('[ask] step 1: listen (STT)');
  fire('listening_start');
  const sttResult = await listen();
  fire('listening_stop');
  if (!sttResult.ok) {
    console.log('[ask] STT FAILED with:', sttResult.error);
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
  console.log('[ask] STT OK, utterance:', sttResult.value);

  const utterance = sttResult.value;
  const decision = await classifyIntent(utterance);
  console.log('[ask] routed to:', decision.type);

  // 2. Snapshot only for routes that always use the image (extend, model).
  // For memory we lazy-snapshot inside handleMemory only if recall misses.
  // repeat replays a cached narration — no camera needed at all.
  async function ensureSnapshot(): Promise<Result<string, AskError>> {
    console.log('[ask] step 2: snapshot');
    const snap = await captureSnapshot();
    if (!snap.ok) {
      console.log('[ask] snapshot FAILED with:', snap.error);
      fire('error');
      const kind: ErrorKind = snap.error === 'permission_denied' ? 'permission_denied_camera' : 'no_camera';
      await speak(errorCopyFor(kind));
      await logEvent(false, now() - t0, snap.error);
      return err(snap.error === 'permission_denied' ? 'permission_denied' : 'no_camera');
    }
    console.log('[ask] snapshot OK');
    return ok(snap.value.base64);
  }

  // 3. Dispatch
  switch (decision.type) {
    case 'chitchat':
      return handleChitchat(decision.kind, t0);
    case 'where_am_i': {
      const s = await ensureSnapshot();
      if (!s.ok) return s;
      return handleWhereAmI(s.value, t0);
    }
    case 'repeat':
      return handleRepeat(t0);
    case 'extend': {
      const s = await ensureSnapshot();
      if (!s.ok) return s;
      return handleExtend(s.value, t0);
    }
    case 'memory':
      return handleMemory(decision.object, utterance, t0, ensureSnapshot);
    case 'guide':
      return handleGuide(decision.object, t0);
    case 'model': {
      // If the question is about something already in cache (needsCurrent=false)
      // and we have a cached snapshot, skip the fresh capture — the user may
      // not even be looking at the original scene anymore.
      const latest = SnapshotCache.getLatest();
      const cachedB64 = latest?.uri ? SnapshotCache.readBase64(latest.uri) : null;
      if (decision.needsCurrent === false && cachedB64) {
        console.log('[ask] needsCurrent=false → skipping fresh snapshot, using cached only');
        return handleModel(cachedB64, utterance, t0, { skipFreshCapture: true });
      }
      const s = await ensureSnapshot();
      if (!s.ok) return s;
      return handleModel(s.value, utterance, t0);
    }
  }
}

// "Guíame a X": resolve the spoken object to a detectable target (LLM). If
// guidable, return it so the caller opens the live guide (which announces +
// homes by haptics); if not, say the graceful fallback and stay put.
async function handleGuide(noun: string, t0: number): Promise<Result<AskOutcome, AskError>> {
  fire('thinking_start');
  const target = await resolveGuideTarget(noun);
  fire('thinking_stop');
  if (!target) {
    fire('answer_ready');
    const line = COPY.guide.cannotGuide(noun);
    await speak(line);
    await logEvent(true, now() - t0, 'guide_unsupported');
    return ok({ narration: line, objects: [], route: 'guide' });
  }
  fire('answer_ready');
  await logEvent(true, now() - t0, null);
  return ok({ narration: '', objects: [], route: 'guide', guide: target });
}

const CHITCHAT_REPLIES: Record<import('./UtteranceRouter').ChitchatKind, string> = {
  thanks: 'De nada.',
  greeting: 'Hola, ¿en qué te ayudo?',
  goodbye: 'Chau, acá estoy si me necesitás.',
  affirm: 'Listo.',
  other: 'Estoy acá.',
};

async function handleWhereAmI(
  imageBase64: string,
  t0: number,
): Promise<Result<AskOutcome, AskError>> {
  // Save the snapshot first so identifyRoom can read it as a file URI.
  let uri: string;
  try {
    uri = SnapshotCache.saveSnapshot(imageBase64);
  } catch {
    await speak(errorCopyFor('unknown'));
    await logEvent(false, now() - t0, 'where_save_failed');
    return err('unknown');
  }
  const match = await RoomCatalog.identifyRoom(uri);
  const narration = match.ok && match.value
    ? `Estás en ${match.value.displayName}.`
    : 'No estoy segura en qué cuarto estás. Si querés, registrá este cuarto desde Setup.';
  fire('answer_ready');
  await speak(narration);
  await logEvent(true, now() - t0, match.ok && match.value ? 'where_hit' : 'where_miss');
  return ok({ narration, objects: [], route: 'model' });
}

async function handleChitchat(
  kind: import('./UtteranceRouter').ChitchatKind,
  t0: number,
): Promise<Result<AskOutcome, AskError>> {
  const narration = CHITCHAT_REPLIES[kind];
  fire('answer_ready');
  await speak(narration);
  await logEvent(true, now() - t0, `chitchat_${kind}`);
  return ok({ narration, objects: [], route: 'model' });
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
  // If the excerpt holds the full describe-narration (not just the noun), append
  // it as scene context so recall isn't only "when + where".
  const context = sighting.excerpt && sighting.excerpt.length > 30
    ? ` La escena era: ${sighting.excerpt}`
    : '';
  if (freshness === 'fresh') {
    const base = where
      ? `Lo vi ${when} en ${where}.`
      : `Lo vi ${when}, no estoy segura en qué cuarto.`;
    return base + context;
  }
  // hedged
  const base = where
    ? `Hace un tiempo lo vi en ${where}, pero puede haberse movido.`
    : `Lo vi ${when}, pero puede haberse movido.`;
  return base + context;
}

async function handleMemory(
  noun: string,
  utterance: string,
  t0: number,
  ensureSnapshot: () => Promise<Result<string, AskError>>,
): Promise<Result<AskOutcome, AskError>> {
  const outcome = await MemoryService.recall(noun);

  if (outcome.freshness === 'fresh' || outcome.freshness === 'hedged') {
    const narration = buildRecallNarration(outcome.sighting, outcome.freshness);
    fire('answer_ready');
    await speak(narration);
    await logEvent(true, now() - t0, `memory_${outcome.freshness}`);
    return ok({ narration, objects: [], route: 'memory_hit' });
  }

  // Miss — only now do we need a camera frame for the model fall-through.
  const s = await ensureSnapshot();
  if (!s.ok) return s;
  const r = await handleModel(s.value, utterance, t0);
  if (r.ok) {
    await logEvent(true, now() - t0, 'memory_miss');
    return ok({ ...r.value, route: 'memory_miss' });
  }
  return r;
}

function buildContextLine(prevNarration: string | null): string {
  // Light conversational continuity — include Lola's last spoken line so the
  // model can resolve references like "las papas" or "ese color" against it.
  if (!prevNarration) return '';
  return `\n\n[CONTEXTO DE CONVERSACIÓN — leelo antes de responder:
Hace unos segundos vos (Lola) le dijiste al usuario: "${prevNarration}"
Te mandé DOS imágenes:
  IMAGEN 1 = la escena de ese momento (la que describiste arriba)
  IMAGEN 2 = lo que el usuario ve AHORA (puede haberse movido o cambiado)
El usuario está pidiendo info sobre algo que YA describiste o sobre lo que ve ahora. Si la pregunta menciona algo que aparece en la IMAGEN 1 (la bolsa de papas, el termo, etc.) y NO está en la IMAGEN 2 — RESPONDÉ MIRANDO LA IMAGEN 1. Si lo que pregunta está en ambas, podés usar cualquiera. NUNCA repitas el contexto como respuesta — usá lo que ves en las imágenes para responder la pregunta directamente.]`;
}

async function handleModel(
  imageBase64: string,
  userText: string,
  t0: number,
  opts: { skipFreshCapture?: boolean } = {},
): Promise<Result<AskOutcome, AskError>> {
  fire('thinking_start');
  const catalog = await loadCatalogSafe();

  // skipFreshCapture: the caller already pulled the cached image and is using
  // it as the only frame (no fresh snapshot was taken). In that case don't
  // include the cached frame a second time as "previous".
  const latest = SnapshotCache.getLatest();
  const prevNarration = latest?.narration ?? null;
  const prevBase64 = !opts.skipFreshCapture && latest?.uri
    ? SnapshotCache.readBase64(latest.uri)
    : null;
  const images = prevBase64 ? [prevBase64, imageBase64] : [imageBase64];
  console.log('[ask] handleModel images count:', images.length, 'skipFresh:', !!opts.skipFreshCapture);

  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText: userText + buildContextLine(prevNarration),
    imagesBase64: images,
  });
  fire('thinking_stop');
  if (resp.ok) console.log('[ask] model narration:', resp.value.narration);

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
      excerpt: narration,
    });
  }

  await logEvent(!isLow, now() - t0, isLow ? 'low_confidence' : null);
  if (isLow) return err('low_confidence');
  return ok({ narration, objects: resp.value.objects, route: 'model' });
}
