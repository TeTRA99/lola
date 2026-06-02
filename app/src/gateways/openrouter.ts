// OpenRouter gateway — single provider-agnostic surface for vision-LLM calls.
// Per NFR-11: all model calls go through OpenRouter (not direct Google AI Studio).
// Architecture §5.1 spec'd the request shape, retry policy, headers.

import { CONFIG } from '@/config';
import { ok, err, type Result } from '@/utils/result';

export type ChatError = 'network' | 'auth' | 'rate_limit' | 'parse_fail' | 'unknown';

export type LolaObject = { canonical: string; display: string; room_hint: string | null };
export type LolaResponse = { narration: string; objects: LolaObject[] };

export type ChatInput = {
  systemPrompt: string;
  userText: string;
  imageBase64?: string;
  // Multi-image variant — pass an ordered list of base64 frames. Used by
  // AskService follow-ups to send the prior cached scene alongside the
  // current one so the model can resolve "las papas" / "el termo" references.
  imagesBase64?: string[];
  // Local-file image paths for the on-device VLM path (it reads a file, not
  // base64). The cloud gateway ignores these; the on-device adapter ignores the
  // base64 fields. Callers that may run either backend should set both.
  imageUri?: string;
  imageUris?: string[];
  // Optional message override for the ON-DEVICE VLM only (the small model follows
  // the user turn better than the system prompt, so Describe sends a sharper,
  // item-focused instruction here). The cloud path ignores this and uses userText.
  localUserText?: string;
  model?: string;
};

// EXPO_PUBLIC_* are inlined at build time and readable from client code.
// Set in EAS secret store for production; in .env.local for dev.
// Read dynamically so test code can override via process.env after import.
function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
}

// B4 fix (2026-05-27 review): NFR-1 says button-to-audio ≤2s. The previous
// 8s × 3-attempt budget meant worst-case ~25s before user heard the error.
// Reduced to a single retry with a tighter per-attempt timeout — worst case
// is now ~10.5s, still over NFR-1 in failure but felt-quickly instead of
// felt-eternally. If a consumer needs more patience, expose maxLatencyMs later.
const RETRY_DELAYS_MS = [500, 1500];
const PER_ATTEMPT_TIMEOUT_MS = 8000;

function buildBody(input: ChatInput): unknown {
  const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: input.userText }];
  const images = input.imagesBase64 ?? (input.imageBase64 ? [input.imageBase64] : []);
  for (const b64 of images) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    });
  }
  return {
    model: input.model ?? CONFIG.MODEL_ID,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400,
    temperature: 0.3,
  };
}

async function postOnce(input: ChatInput, signal: AbortSignal): Promise<Response> {
  return fetch(`${CONFIG.GATEWAY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': 'https://lola.local',
      'X-Title': 'Lola v0.9',
    },
    body: JSON.stringify(buildBody(input)),
    signal,
  });
}

/**
 * Shared request loop — returns the raw assistant message content string (with
 * retry/timeout). Callers parse it however they like. Factored out of chatJson so
 * groundObject can parse leniently (models often wrap JSON in ```fences``` / prose).
 */
async function requestContent(
  input: ChatInput,
  opts?: { timeoutMs?: number; retryDelays?: number[] },
): Promise<Result<string, ChatError>> {
  const key = apiKey();
  if (!key) return err('auth');
  const timeoutMs = opts?.timeoutMs ?? PER_ATTEMPT_TIMEOUT_MS;
  const retryDelays = opts?.retryDelays ?? RETRY_DELAYS_MS;

  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timeoutId = setTimeout(() => ctl.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await postOnce(input, ctl.signal);
    } catch {
      clearTimeout(timeoutId);
      if (attempt < retryDelays.length) {
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      return err('network');
    }
    clearTimeout(timeoutId);

    if (resp.status === 401 || resp.status === 403) return err('auth');
    if (resp.status === 429) return err('rate_limit');
    if (resp.status >= 500 && resp.status < 600) {
      if (attempt < retryDelays.length) {
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      return err('network');
    }
    if (!resp.ok) return err('unknown');

    let body: { choices?: Array<{ message?: { content?: string } }> };
    try {
      body = (await resp.json()) as typeof body;
    } catch {
      return err('parse_fail');
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) return err('parse_fail');
    return ok(content);
  }
}

/**
 * Parse a JSON object out of model text that may be wrapped in ```json fences```
 * or padded with prose: strip fences, else extract the first balanced {…} block.
 */
function parseLooseJsonObject<T>(text: string): T | null {
  const fenced = text.replace(/```(?:json)?/gi, '').trim();
  for (const candidate of [fenced, extractFirstBracedBlock(fenced)]) {
    if (!candidate) continue;
    try { return JSON.parse(candidate) as T; } catch { /* try next */ }
  }
  return null;
}

function extractFirstBracedBlock(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

/**
 * Generic JSON chat — returns the parsed JSON object without shape validation.
 * Callers decide what shape they expect. Used by IntentRouter (text-only) and
 * anything else that doesn't return LolaResponse.
 */
export async function chatJson<T = unknown>(input: ChatInput): Promise<Result<T, ChatError>> {
  const r = await requestContent(input);
  if (!r.ok) return err(r.error);
  try {
    return ok(JSON.parse(r.value) as T);
  } catch {
    return err('parse_fail');
  }
}

// ── Cloud object grounding (feat: cloud "guide me to it" spike) ────────────
// Ask a vision model to LOCATE an arbitrary, open-vocabulary object in a frame
// and return a single bounding box as strict JSON. Reuses chatJson() (POST +
// retry + JSON parse); only the prompt and the box-shape normalization differ.
// The box convention is model-specific and parsed downstream by
// objectDetection.parseGroundingBox — here we just tell the model which to use.

export type GroundOutput = {
  found: boolean;
  /** Raw 4-number box in the model's native convention (parsed downstream). */
  box: number[] | null;
  confidence: number;
  /** Short Spanish landmark phrase ("al lado del termo") — what it's next to/on. */
  near?: string | null;
  /** Truncated raw model text — for the dev preview/trace when a box isn't parsed. */
  raw?: string;
};

// Mirror of objectDetection.groundingIsXYXY — kept local so this gateway doesn't
// import an adapter (layering). Qwen uses [x1,y1,x2,y2]; Gemini [ymin,xmin,ymax,xmax].
// Both are normalized 0–1000.
function groundUsesXYXY(model: string): boolean {
  return /qwen/i.test(model);
}

function buildGroundPrompt(model: string, hasRef: boolean): string {
  const xyxy = groundUsesXYXY(model);
  const order = xyxy ? 'x1, y1, x2, y2' : 'ymin, xmin, ymax, xmax';
  const orderDesc = xyxy ? '(left, top, right, bottom)' : '(top, left, bottom, right)';
  const refLine = hasRef
    ? 'You are given a REFERENCE photo of the target object first, then the SCENE image to search. Find the SAME object in the scene.\n'
    : '';
  return `You locate a single object in an image for a blind-assistance app. ${refLine}Return STRICT JSON only, no prose:
{ "found": true|false, "box": [${order}], "confidence": 0.0-1.0, "near": "<short Spanish phrase or null>" }
- "box" is the tightest bounding box around the target, as normalized coordinates from 0 to 1000 in the order [${order}] ${orderDesc}.
- "near": a SHORT phrase in RIOPLATENSE SPANISH (max 6 words) saying what the target is next to or resting on, e.g. "al lado del termo", "sobre la mesa, cerca del plato". Use null if nothing clear.
- If the target is NOT visible, return { "found": false, "box": null, "confidence": 0, "near": null }.
- Pick the single best instance if several are visible. Do not invent a box when unsure.`;
}

/**
 * Locate `query` in `frameBase64` (optionally aided by a `refBase64` photo of the
 * object). Returns a raw box in the model's native convention — call
 * objectDetection.parseGroundingBox(model, out.box, w, h) to normalize it.
 */
export async function groundObject(args: {
  query: string;
  frameBase64: string;
  refBase64?: string | null;
  model: string;
}): Promise<Result<GroundOutput, ChatError>> {
  const hasRef = !!args.refBase64;
  const userText = hasRef
    ? `Reference photo (image 1) shows: "${args.query}". Find that same object in the scene (image 2).`
    : `Find this object in the image: "${args.query}".`;
  const images = hasRef ? [args.refBase64 as string, args.frameBase64] : [args.frameBase64];
  // Fail-fast: NO retries and a tight timeout. In a ~2.5s poll loop a retried/stale
  // grounding call is worthless and (with skip-while-in-flight) blocks fresh polls
  // — better to drop this poll and let the next frame be current.
  const resp = await requestContent({
    systemPrompt: buildGroundPrompt(args.model, hasRef),
    userText,
    imagesBase64: images,
    model: args.model,
  }, { timeoutMs: CONFIG.GUIDE_CLOUD_TIMEOUT_MS, retryDelays: [] });
  if (!resp.ok) return err(resp.error);
  const raw = resp.value.slice(0, 300);
  // Models often wrap JSON in ```fences``` or add a sentence — parse leniently.
  // If still unparseable, surface the raw text (don't hard-fail) so the dev
  // preview shows what the model actually said.
  const v = parseLooseJsonObject<{ found?: unknown; box?: unknown; confidence?: unknown; near?: unknown }>(resp.value);
  if (!v) return ok({ found: false, box: null, confidence: 0, near: null, raw });
  const box = Array.isArray(v.box) && v.box.length === 4 && v.box.every(n => typeof n === 'number')
    ? (v.box as number[])
    : null;
  const near = typeof v.near === 'string' && v.near.trim() ? v.near.trim().slice(0, 60) : null;
  return ok({
    found: v.found === true && box !== null,
    box,
    confidence: typeof v.confidence === 'number' ? v.confidence : 0,
    near,
    raw,
  });
}

/**
 * Multimodal image embedding via OpenRouter's /embeddings endpoint.
 * Used by RoomCatalog to fingerprint scenes for cosine-similarity room lookup.
 *
 * Model: google/gemini-embedding-2-preview returns 1408-d float vectors.
 * Cost ~$0.0001/image. Latency ~200–400ms warm.
 */
export type EmbedError = 'network' | 'auth' | 'rate_limit' | 'parse_fail' | 'unknown';

const EMBED_MODEL_ID = 'google/gemini-embedding-2-preview';
const EMBED_TIMEOUT_MS = 5000;

export async function embedImage(imageBase64: string): Promise<Result<number[], EmbedError>> {
  const key = apiKey();
  if (!key) return err('auth');
  const ctl = new AbortController();
  const timeoutId = setTimeout(() => ctl.abort(), EMBED_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${CONFIG.GATEWAY_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'HTTP-Referer': 'https://lola.local',
        'X-Title': 'Lola v0.9',
      },
      body: JSON.stringify({
        model: EMBED_MODEL_ID,
        input: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      }),
      signal: ctl.signal,
    });
  } catch {
    clearTimeout(timeoutId);
    return err('network');
  }
  clearTimeout(timeoutId);
  if (resp.status === 401 || resp.status === 403) return err('auth');
  if (resp.status === 429) return err('rate_limit');
  if (!resp.ok) return err('unknown');
  let body: { data?: Array<{ embedding?: number[] }> };
  try {
    body = (await resp.json()) as typeof body;
  } catch {
    return err('parse_fail');
  }
  const vec = body.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0 || vec.some(v => typeof v !== 'number')) {
    return err('parse_fail');
  }
  return ok(vec);
}

export async function chat(input: ChatInput): Promise<Result<LolaResponse, ChatError>> {
  const key = apiKey();
  console.log('[openrouter] chat called, apiKey present?', !!key, 'len:', key?.length ?? 0);
  if (!key) return err('auth');

  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timeoutId = setTimeout(() => ctl.abort(), PER_ATTEMPT_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await postOnce(input, ctl.signal);
    } catch {
      clearTimeout(timeoutId);
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return err('network');
    }
    clearTimeout(timeoutId);

    if (resp.status === 401 || resp.status === 403) return err('auth');
    if (resp.status === 429) return err('rate_limit');
    if (resp.status >= 500 && resp.status < 600) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return err('network');
    }
    if (!resp.ok) return err('unknown');

    let body: { choices?: Array<{ message?: { content?: string } }> };
    try {
      body = (await resp.json()) as typeof body;
    } catch {
      return err('parse_fail');
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) return err('parse_fail');

    let parsed: LolaResponse;
    try {
      parsed = JSON.parse(content) as LolaResponse;
    } catch {
      return err('parse_fail');
    }
    if (
      typeof parsed.narration !== 'string' ||
      !Array.isArray(parsed.objects)
    ) {
      return err('parse_fail');
    }
    // B2 fix (2026-05-27 review): validate each object shape so downstream
    // consumers (sightings log, catalog match) don't trip on undefined fields.
    const objectsOk = parsed.objects.every(o => {
      if (!o || typeof o !== 'object') return false;
      const obj = o as Partial<LolaObject>;
      return (
        typeof obj.canonical === 'string' &&
        typeof obj.display === 'string' &&
        (obj.room_hint === null || typeof obj.room_hint === 'string')
      );
    });
    if (!objectsOk) return err('parse_fail');
    return ok(parsed);
  }
}
