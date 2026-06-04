// FR-2 Ask orchestration. Mirror of DescribeService for the question-driven
// path, with utterance routing (E3.1) deciding between repeat / extend /
// memory recall / model call.

import { speak } from '@/adapters/tts';
import { listen, lastSttDiag } from '@/adapters/stt';
import { fire } from '@/adapters/haptics';
import { captureSnapshot } from '@/adapters/camera';
import { chat, inferenceMode } from '@/services/ModelRouter';
import { buildSystemPrompt } from '@/prompts/lola';
import { getDb } from '@/adapters/storage';
import { errorCopyFor, isLowConfidenceResponse, type ErrorKind } from '@/services/errorCopy';
import { type RouteDecision } from '@/services/UtteranceRouter';
import { classifyIntent } from '@/services/IntentRouter';
import { recordAskTrace } from '@/services/AskTrace';
import { resolveGuideTarget } from '@/services/GuideTargets';
import { COPY } from '@/services/CopyModule';
import { applyCatalogNarration } from '@/services/CatalogResolver';
import * as OnboardingService from '@/services/OnboardingService';
import * as SnapshotCache from '@/services/SnapshotCache';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MemoryService from '@/services/MemoryService';
import * as RoomCatalog from '@/services/RoomCatalog';
import { ok, err, type Result } from '@/utils/result';
import { now } from '@/utils/time';
import { ago } from '@/utils/relativeTime';
import { Linking } from 'react-native';
import * as ContactService from '@/services/ContactService';
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
  // cloudQuery/refImageUri are set only in the cloud spike (guideBackend='cloud'):
  // the open-vocab query and (when targeting='reference') the saved photo to send.
  guide?: { cocoLabel: string | null; spoken: string; cloudQuery?: string; refImageUri?: string | null };
};

async function loadCatalogSafe() {
  try { return await OnboardingService.getCatalog(); }
  catch { return null; }
}

// Downscale a saved reference photo to base64 for the model call (token cost).
async function loadRefBase64(uri: string): Promise<string | null> {
  try {
    const out = await manipulateAsync(uri, [{ resize: { width: 768 } }], {
      compress: 0.7, format: SaveFormat.JPEG, base64: true,
    });
    return out.base64 ?? null;
  } catch (e) {
    console.log('[ask] ref photo load failed:', e);
    return null;
  }
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
  // Fire the "listening" cue (haptic → Home flips to "Te escucho…") only when
  // the mic is actually open, not before — otherwise the user starts talking
  // during the engine's warm-up and the first words get clipped.
  const sttResult = await listen({ onReady: () => fire('listening_start') });
  fire('listening_stop');
  if (!sttResult.ok) {
    console.log('[ask] STT FAILED with:', sttResult.error);
    recordAskTrace({ at: now(), utterance: null, route: `STT_FAIL:${sttResult.error} [${lastSttDiag()}]` });
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
  // Pass saved-object names so the classifier can flag a question about one of
  // THE user's things ("mi yerba") → we attach its reference photo below. Also
  // pass the family-contact names so the classifier can map a badly-transcribed
  // spoken name ("sumi" → "Zoomy") to the right contact for the call_family route.
  const catalog = await loadCatalogSafe();
  const contacts = await ContactService.listContacts();
  const decision = await classifyIntent(
    utterance,
    (catalog ?? []).map(o => o.display_name),
    contacts.map(c => c.name),
  );
  console.log('[ask] routed to:', decision.type);
  recordAskTrace({ at: now(), utterance, route: describeRoute(decision) });

  // 2. Snapshot only for routes that always use the image (extend, model).
  // For memory we lazy-snapshot inside handleMemory only if recall misses.
  // repeat replays a cached narration — no camera needed at all.
  // Returns both the base64 (cloud path) and the file URI (on-device VLM path,
  // which reads a file rather than base64 over the bridge).
  async function ensureSnapshot(): Promise<Result<{ uri: string; base64: string }, AskError>> {
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
    return ok({ uri: snap.value.uri, base64: snap.value.base64 });
  }

  // 3. Dispatch
  switch (decision.type) {
    case 'chitchat':
      return handleChitchat(decision.kind, t0);
    case 'where_am_i': {
      const s = await ensureSnapshot();
      if (!s.ok) return s;
      return handleWhereAmI(s.value.base64, t0);
    }
    case 'repeat':
      return handleRepeat(t0);
    case 'extend': {
      const s = await ensureSnapshot();
      if (!s.ok) return s;
      return handleExtend(s.value.base64, t0, s.value.uri);
    }
    case 'memory':
      return handleMemory(decision.object, utterance, t0, ensureSnapshot);
    case 'guide':
      return handleGuide(decision.object, decision.savedObject ?? null, t0);
    case 'call_family':
      // No snapshot/STT needed — the utterance is already captured.
      return handleCallFamily(decision.contactName, decision.channel, decision.message, t0);
    case 'model': {
      // Reference-conditioned Ask: if the question is about a SAVED object
      // ("¿cuál es mi yerba?" / "describime mi yerba"), attach that object's
      // reference photo so the model can identify/describe THE user's one rather
      // than reciting the catalog text. Re-derives the live path (reinstall-proof).
      let ref: { base64: string; name: string } | null = null;
      if (decision.savedObject) {
        const uri = await OnboardingService.referencePhotoFor(decision.savedObject);
        const b64 = uri ? await loadRefBase64(uri) : null;
        if (b64) ref = { base64: b64, name: decision.savedObject };
      }
      // If the question is about something already in cache (needsCurrent=false)
      // and we have a cached snapshot, skip the fresh capture — the user may
      // not even be looking at the original scene anymore.
      const latest = SnapshotCache.getLatest();
      const cachedB64 = latest?.uri ? SnapshotCache.readBase64(latest.uri) : null;
      if (decision.needsCurrent === false && cachedB64) {
        console.log('[ask] needsCurrent=false → skipping fresh snapshot, using cached only');
        return handleModel(cachedB64, utterance, t0, { skipFreshCapture: true, imageUri: latest?.uri, ref });
      }
      const s = await ensureSnapshot();
      if (!s.ok) return s;
      return handleModel(s.value.base64, utterance, t0, { imageUri: s.value.uri, ref });
    }
  }
}

// "Guíame a X": route by WHAT the object is (same in Debug and prod):
//  • a SAVED personal object ("mi mate", "mi taza") → CLOUD open-vocab + its photo
//  • a generic COCO object ("una taza", "el control") → on-device Geiger
//  • anything else (arbitrary, not saved, not COCO) → CLOUD, name-only
// The intent classifier sets `savedObject` only when the user refers to one of their
// saved things (possessive/name), so "mi taza" → cloud while "una taza" → Geiger.
async function handleGuide(noun: string, savedObject: string | null, t0: number): Promise<Result<AskOutcome, AskError>> {
  fire('thinking_start');
  const target = await resolveGuideTarget(noun); // COCO label (exact/approx) or null
  fire('thinking_stop');

  const saved = !!savedObject;
  // Cloud when it's a saved personal object OR an arbitrary thing YOLO can't do.
  // A plain COCO object with no saved match stays on the fast on-device Geiger.
  const cloud = saved || !target;

  fire('answer_ready');
  // Approximate COCO proxy ("termo" → bottle) warning — on-device path only.
  if (!cloud && target?.approximate) await speak(COPY.guide.approxWarning);
  await logEvent(true, now() - t0, saved ? 'guide_cloud_saved' : cloud ? 'guide_cloud' : target?.approximate ? 'guide_approx' : null);

  // For a saved object: attach its reference photo and say it by its saved name.
  let refImageUri: string | null = null;
  let spoken = target?.spoken ?? noun;
  if (saved) {
    refImageUri = await OnboardingService.referencePhotoFor(savedObject!);
    spoken = savedObject!;
  }

  return ok({
    narration: '', objects: [], route: 'guide',
    guide: {
      cocoLabel: target?.cocoLabel ?? null,
      spoken,
      cloudQuery: cloud ? noun : undefined,
      refImageUri: cloud ? refImageUri : undefined,
    },
  });
}

// Local SOS / "call family": resolve the named (or emergency) contact and open
// the dialer (tel: — dad taps call) or a pre-filled WhatsApp chat. No backend,
// no snapshot. A misheard name is caught by ear: Lola says "Llamando a X" before
// the dialer opens, and tel: never auto-dials.
async function handleCallFamily(
  contactName: string | null,
  channel: ContactService.ContactChannel,
  message: string | null,
  t0: number,
): Promise<Result<AskOutcome, AskError>> {
  const contacts = await ContactService.listContacts();
  fire('answer_ready');

  if (contacts.length === 0) {
    await speak(COPY.sos.notConfigured);
    await logEvent(true, now() - t0, 'call_family_unconfigured');
    return ok({ narration: COPY.sos.notConfigured, objects: [], route: 'call_family' });
  }

  const match = ContactService.resolveContact(contactName, contacts);
  if (!match) {
    await speak(COPY.sos.notFound);
    await logEvent(true, now() - t0, 'call_family_no_match');
    return ok({ narration: COPY.sos.notFound, objects: [], route: 'call_family' });
  }

  const narration = channel === 'whatsapp' ? COPY.sos.messaging(match.name) : COPY.sos.calling(match.name);
  await speak(narration);
  try {
    await Linking.openURL(ContactService.contactUrl(match, channel, message));
  } catch {
    // Never leave the user in silence — speak a calm fallback for either channel.
    await speak(channel === 'whatsapp' ? COPY.sos.openFailed : COPY.sos.callFailed);
  }
  await logEvent(true, now() - t0, channel === 'whatsapp' ? 'whatsapp_family' : 'call_family');
  return ok({ narration, objects: [], route: 'call_family' });
}

// Compact human-readable route label for the Debug Ask-trace readout.
function describeRoute(d: RouteDecision): string {
  switch (d.type) {
    case 'chitchat': return `chitchat:${d.kind}`;
    case 'guide': return `guide:${d.object}`;
    case 'memory': return `memory:${d.object}`;
    case 'model': return `model${d.needsCurrent === false ? '(cached)' : ''}`;
    case 'call_family': return `call_family:${d.channel}:${d.contactName ?? 'emergency'}`;
    default: return d.type;
  }
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

async function handleExtend(imageBase64: string, t0: number, imageUri?: string): Promise<Result<AskOutcome, AskError>> {
  fire('thinking_start');
  const catalog = await loadCatalogSafe();
  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText: EXTEND_USER_TEXT,
    imageBase64,
    imageUri, // on-device VLM path (cloud ignores it)
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
  ensureSnapshot: () => Promise<Result<{ uri: string; base64: string }, AskError>>,
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
  const r = await handleModel(s.value.base64, utterance, t0, { imageUri: s.value.uri });
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
  opts: { skipFreshCapture?: boolean; imageUri?: string; ref?: { base64: string; name: string } | null } = {},
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
  // Reference-conditioned: image 1 = the saved object's reference photo, image 2 =
  // the current scene (skip the prior-scene frame to keep the comparison clean).
  // The addendum tells the model to identify/describe the user's specific object.
  let images: string[];
  let refLine = '';
  if (opts.ref) {
    images = [opts.ref.base64, imageBase64];
    refLine = `\n\n[La imagen 1 es la foto de referencia del objeto guardado del usuario, «${opts.ref.name}». La imagen 2 es la escena actual. Si el usuario pregunta cuál de los objetos de la escena es su «${opts.ref.name}», comparalo con la referencia y decí cuál es y dónde está. Si te pide que se lo describas, describilo a partir de la referencia.]`;
  } else {
    images = prevBase64 ? [prevBase64, imageBase64] : [imageBase64];
  }
  console.log('[ask] handleModel images count:', images.length, 'ref:', !!opts.ref, 'skipFresh:', !!opts.skipFreshCapture);

  const resp = await chat({
    systemPrompt: buildSystemPrompt(catalog),
    userText: userText + buildContextLine(prevNarration) + refLine,
    imagesBase64: images,
    // On-device VLM uses a single current frame (it can't do the cloud's
    // prior+current two-image trick); the text context line carries continuity.
    imageUri: opts.imageUri,
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

  // Local VLM is narration-only (objects:[]) → don't let the heuristic misfire.
  const isLow = inferenceMode() === 'local' ? false : isLowConfidenceResponse(resp.value);
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
      // Deliberately NO excerpt for Ask answers: a targeted reply ("el sillón es
      // gris") is not a scene description, and storing it would make a later
      // "¿dónde está el sillón?" recall recite that answer as "la escena era…".
      // The sighting still updates recency/room; the scene excerpt comes only
      // from Describe. (Memory recall discussion — Option B.)
      excerpt: null,
    });
  }

  await logEvent(!isLow, now() - t0, isLow ? 'low_confidence' : null);
  if (isLow) return err('low_confidence');
  return ok({ narration, objects: resp.value.objects, route: 'model' });
}
