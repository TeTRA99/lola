// On-device vision-language model via react-native-executorch + LFM2.5-VL.
// Replaces the cloud Describe/Ask `chat()` so scene description runs offline,
// free, and the user's photos never leave the phone.
//
// Two sizes are switchable from Settings/DebugScreen: 450m (the realistic Galaxy
// A12 default) and 1.6b (better quality, heavier). The quantized .pte is
// downloaded from HuggingFace on first use and cached by the executorch runtime;
// later launches reuse the cached file. Downloads broadcast progress so the Home
// "preparing" card can show it.
//
// Mirrors the lazy-singleton + progress-broadcast shape of `./embeddings.ts`.

import {
  LLMModule,
  models,
  isAvailable as executorchAvailable,
  type Message,
} from 'react-native-executorch/legacy';
import { CONFIG } from '@/config';
import * as Settings from '@/services/Settings';
import { LOCAL_VLM_SYSTEM_PROMPT } from '@/prompts/lola';
import { recordVlmTrace } from '@/adapters/vlmTrace';
import { ok, err, type Result } from '@/utils/result';
import type { ChatInput, ChatError, LolaResponse, LolaObject } from '@/gateways/openrouter';

// '450m'/'1.6b' = LFM2.5-VL (XNNPACK/CPU). 'gemma4' = Gemma 4 E2B multimodal —
// runs on the GPU backend (Android Vulkan / iOS MLX), stronger + multilingual but
// heavier; experimental, selectable from Debug (not the default). See
// docs/design/model-usage.md.
export type VlmSize = '450m' | '1.6b' | 'gemma4';
const VLM_SIZES: readonly VlmSize[] = ['450m', '1.6b', 'gemma4'];
// Lifecycle phase, so the UI can say exactly where we are:
//  idle        — nothing loaded yet
//  downloading — fetching the .pte from HuggingFace (progress 0..1, may bounce
//                per-file, so this is NOT done until phase flips to ready)
//  preparing   — download finished, loading the graph into memory (warm-up)
//  ready       — fromModelName resolved; inference can run
//  error       — load failed
export type VlmPhase = 'idle' | 'downloading' | 'preparing' | 'ready' | 'error';
export type VlmStatus = { phase: VlmPhase; progress: number; label: string; size: VlmSize };

let modulePromise: Promise<LLMModule> | null = null;
let loadedModule: LLMModule | null = null;
let loadedSize: VlmSize | null = null;
let ready = false;
let phase: VlmPhase = 'idle';
// Per-generation token counter for the runaway-generation guard (the model has
// no hard max-tokens knob; we interrupt once it overshoots VLM_MAX_NEW_TOKENS).
let genTokenCount = 0;

const downloadProgressListeners = new Set<(p: number) => void>();
const statusListeners = new Set<(s: VlmStatus) => void>();
let lastProgress = 0;

function currentSize(): VlmSize {
  const v = Settings.getStringSync(Settings.KEYS.vlmModel, CONFIG.LOCAL_VLM_DEFAULT_SIZE);
  return (VLM_SIZES as readonly string[]).includes(v) ? (v as VlmSize) : '450m';
}

const VLM_LABELS: Record<VlmSize, string> = {
  '450m': 'LFM2.5-VL 450M',
  '1.6b': 'LFM2.5-VL 1.6B',
  gemma4: 'Gemma 4 E2B',
};

/** Human-readable name of the VLM currently selected. */
export function modelLabel(): string {
  return VLM_LABELS[currentSize()];
}

/** Current lifecycle status (cheap, no load triggered). */
export function getStatus(): VlmStatus {
  return { phase, progress: lastProgress, label: modelLabel(), size: currentSize() };
}

/** Subscribe to lifecycle status changes. Fires immediately with the current
 *  status, then on every phase/progress change. Returns an unsubscribe fn. */
export function subscribeStatus(cb: (s: VlmStatus) => void): () => void {
  statusListeners.add(cb);
  cb(getStatus());
  return () => { statusListeners.delete(cb); };
}

function emitStatus(): void {
  const s = getStatus();
  for (const cb of statusListeners) { try { cb(s); } catch { /* ignore listener errors */ } }
}

function setPhase(p: VlmPhase): void {
  phase = p;
  emitStatus();
}

/** Subscribe to download progress only (0–1). Returns an unsubscribe fn. */
export function onDownloadProgress(cb: (p: number) => void): () => void {
  downloadProgressListeners.add(cb);
  cb(lastProgress); // replay so a late subscriber doesn't see 0
  return () => { downloadProgressListeners.delete(cb); };
}

function broadcastProgress(p: number): void {
  lastProgress = p;
  for (const cb of downloadProgressListeners) {
    try { cb(p); } catch { /* ignore listener errors */ }
  }
  emitStatus();
}

/** True if the native ExecuTorch runtime is available on this device. */
export function canDescribeLocally(): boolean {
  return executorchAvailable;
}

/** True once the model is downloaded and loaded (cheap, no load triggered). */
export function isReady(): boolean {
  return ready;
}

function sources(size: VlmSize) {
  if (size === 'gemma4') return models.llm.gemma4_e2b_multimodal();
  if (size === '1.6b') return models.llm.lfm2_5_vl_1_6b();
  return models.llm.lfm2_5_vl_450m();
}

/** Free the model from memory (e.g. before loading the other size, or for OOM tests). */
export async function unload(): Promise<void> {
  ready = false;
  const m = loadedModule;
  modulePromise = null;
  loadedModule = null;
  loadedSize = null;
  lastProgress = 0;
  setPhase('idle');
  if (m) {
    try { m.interrupt(); } catch { /* not generating */ }
    try { m.delete(); } catch { /* already gone */ }
  }
}

function loadModule(size: VlmSize): Promise<LLMModule> {
  if (modulePromise && loadedSize === size) return modulePromise;
  // Switching size — drop the resident model first so we don't hold two graphs.
  if (modulePromise && loadedSize !== size) void unload();

  loadedSize = size;
  lastProgress = 0;
  setPhase('downloading');
  modulePromise = LLMModule.fromModelName(
    sources(size),
    p => {
      console.log('[vlm] download', (p * 100).toFixed(0) + '%');
      broadcastProgress(p);
      // Progress can bounce per-file; treat hitting 1 as "now loading the graph"
      // rather than "done" — done is only when fromModelName resolves below.
      if (p >= 1 && phase === 'downloading') setPhase('preparing');
    },
    () => {
      // Token callback — safety interrupt so a small VLM can't run away.
      genTokenCount += 1;
      if (genTokenCount >= CONFIG.VLM_MAX_NEW_TOKENS && loadedModule) {
        try { loadedModule.interrupt(); } catch { /* ignore */ }
      }
    },
  ).then(m => {
    loadedModule = m;
    ready = true;
    lastProgress = 1;
    setPhase('ready');
    console.log('[vlm] ready —', modelLabel());
    return m;
  }).catch(e => {
    console.log('[vlm] fromModelName threw:', e);
    modulePromise = null;
    loadedModule = null;
    loadedSize = null;
    ready = false;
    setPhase('error');
    throw e;
  });
  return modulePromise;
}

/** Kick off the download/load without running inference (boot/Setup preload). */
export async function preload(): Promise<void> {
  if (!executorchAvailable) return;
  try { await loadModule(currentSize()); } catch { /* surfaced via onDownloadProgress / isReady */ }
}

/**
 * Map the VLM's free-text output to the LolaResponse shape Describe/Ask expect.
 * If the model happens to emit the {narration, objects} JSON we validate it the
 * same way the cloud gateway does; otherwise the whole reply is the narration and
 * objects is empty (sightings degrade gracefully — see plan).
 */
export function toLolaResponse(text: string): LolaResponse {
  const trimmed = text.trim();
  const parsed = tryParseLola(trimmed);
  if (parsed) return parsed;
  // Belt-and-suspenders: if the model emitted JSON anyway and it didn't fully
  // parse (e.g. token-capped mid-object), salvage just the narration string so we
  // never read raw braces/keys aloud.
  const salvaged = salvageNarration(trimmed);
  if (salvaged) return { narration: salvaged, objects: [] };
  return { narration: trimmed, objects: [] };
}

// Warm "Veo …" opener for on-device Describe (Lola is the user's eyes). Just a
// prefix + lowercased first letter — deliberately simple, no content rewriting.
export function warmWithVeo(narration: string): string {
  const s = narration.trim();
  if (!s || /^veo\b/i.test(s)) return s;
  return `Veo ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
}

// Pull the narration string out of partial/!-parseable JSON. Operating on model
// OUTPUT (allowed) — never on the user's words.
function salvageNarration(text: string): string | null {
  if (!text.includes('"narration"')) return null;
  const m = text.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
  if (!m || !m[1]) return null;
  const unescaped = m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
  return unescaped || null;
}

function tryParseLola(text: string): LolaResponse | null {
  // Strip code fences and pull the first balanced {...} block, then validate.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { narration?: unknown; objects?: unknown };
  if (typeof obj.narration !== 'string' || !Array.isArray(obj.objects)) return null;
  const objectsOk = obj.objects.every(o => {
    if (!o || typeof o !== 'object') return false;
    const lo = o as Partial<LolaObject>;
    return (
      typeof lo.canonical === 'string' &&
      typeof lo.display === 'string' &&
      (lo.room_hint === null || typeof lo.room_hint === 'string')
    );
  });
  if (!objectsOk) return null;
  return { narration: obj.narration, objects: obj.objects as LolaObject[] };
}

/**
 * Run Describe/Ask on-device. Router-shaped so ModelRouter.chat() is a thin
 * delegate. Uses the latest available image (a local file path); the small VLM
 * can't do the cloud's prior+current two-frame trick, so only the current frame
 * is sent — the text context line still carries prior-scene continuity.
 */
export async function describeLocal(input: ChatInput): Promise<Result<LolaResponse, ChatError>> {
  if (!executorchAvailable) return err('unknown');
  let mod: LLMModule;
  try {
    mod = await loadModule(currentSize());
  } catch {
    return err('network'); // download/load failure → "connection-ish" error copy
  }
  const uri = input.imageUris?.[input.imageUris.length - 1] ?? input.imageUri;
  try {
    genTokenCount = 0;
    // Use configure()+sendMessage(), NOT generate(): sendMessage applies the
    // model's chat template and treats systemPrompt as a real system instruction.
    // generate() is the raw path — it made the VLM echo the prompt back. We also
    // use the plain-prose on-device prompt (not the caller's JSON cloud prompt),
    // since the small VLM can't reliably emit/non-truncate the {narration,objects}
    // JSON. userText still carries the actual task + room/context.
    // Lower temperature + a repetition penalty rein in the small model's
    // tendency to hallucinate ("...consume sustancias sin pagar") and ramble.
    // Gemma 4 E2B invents objects more than the LFM sizes, so push it to
    // near-greedy (0.1) — fewer sampled tokens = fewer made-up things — while
    // keeping the LFM sizes at their tuned 0.3.
    const temperature = currentSize() === 'gemma4' ? 0.1 : 0.3;
    mod.configure({
      chatConfig: { systemPrompt: LOCAL_VLM_SYSTEM_PROMPT, initialMessageHistory: [] },
      generationConfig: { temperature, repetitionPenalty: 1.3 },
    });
    const started = Date.now();
    // Use the on-device-specific instruction when the caller supplies one (Describe
    // sends a sharper item-focused message — the small VLM obeys the user turn more).
    const message = input.localUserText ?? input.userText;
    console.log('[vlm] sendMessage start (image?', !!uri, ', size', loadedSize, ')');
    const history = await withTimeout(
      mod.sendMessage(message, uri ? { imagePath: uri } : undefined),
      CONFIG.VLM_INFERENCE_TIMEOUT_MS,
      () => { try { mod.interrupt(); } catch { /* ignore */ } },
    );
    const text = lastAssistantText(history);
    console.log('[vlm] sendMessage done in', Date.now() - started, 'ms, len', text.length);
    if (!text.trim()) return err('parse_fail');
    const resp = toLolaResponse(text);
    // Describe (caller set localUserText) gets a warm "Veo …" opener — Lola is the
    // user's eyes. Not for Ask (answering a question shouldn't start with "Veo").
    const narration = input.localUserText ? warmWithVeo(resp.narration) : resp.narration;
    // Capture the RAW model text + what we speak, for the Debug readout.
    recordVlmTrace({ at: Date.now(), raw: text, narration });
    return ok({ ...resp, narration });
  } catch (e) {
    console.log('[vlm] sendMessage failed/timed out:', e);
    return err('unknown');
  }
}

/** Last assistant turn from a message history (sendMessage's return value). */
function lastAssistantText(history: Message[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') return history[i].content ?? '';
  }
  return '';
}

/** Reject (after running onTimeout) if the promise doesn't settle within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      onTimeout();
      reject(new Error(`inference timed out after ${ms}ms`));
    }, ms);
    p.then(
      v => { clearTimeout(id); resolve(v); },
      e => { clearTimeout(id); reject(e); },
    );
  });
}
