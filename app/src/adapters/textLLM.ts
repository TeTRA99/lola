// On-device text LLM via react-native-executorch — backs the two text-only
// model tasks (intent routing + guide-target resolution) so the whole Ask/guide
// flow can run offline. Small model (default qwen3-0.6b-quantized) chosen to fit
// alongside the VLM on the Galaxy A12.
//
// Same lazy-singleton + progress-broadcast shape as ./visionLLM.ts and
// ./embeddings.ts. Returns parsed JSON (the callers — IntentRouter, GuideTargets
// — keep their own strict prompts and safe deterministic fallbacks).

import {
  LLMModule,
  models,
  isAvailable as executorchAvailable,
  type Message,
} from 'react-native-executorch/legacy';
import { CONFIG } from '@/config';
import * as Settings from '@/services/Settings';
import { ok, err, type Result } from '@/utils/result';
import type { ChatInput, ChatError } from '@/gateways/openrouter';

export type TextPhase = 'idle' | 'downloading' | 'preparing' | 'ready' | 'error';
export type TextStatus = { phase: TextPhase; progress: number; label: string };

let modulePromise: Promise<LLMModule> | null = null;
let loadedModule: LLMModule | null = null;
let ready = false;
let phase: TextPhase = 'idle';

const downloadProgressListeners = new Set<(p: number) => void>();
const statusListeners = new Set<(s: TextStatus) => void>();
let lastProgress = 0;

// Swappable text model. Default Llama 3.2 1B — a robust, non-"thinking" instruct
// model. (Qwen3-0.6B is a hybrid thinking model whose tokens make executorch's
// runner fail with "Failed to generate text" on both Android and iOS.)
const TEXT_MODEL_LABELS: Record<string, string> = {
  'llama-3.2-1b': 'Llama 3.2 1B',
  'qwen2.5-0.5b': 'Qwen2.5 0.5B',
  'qwen2.5-1.5b': 'Qwen2.5 1.5B',
  'smollm2.1-360m': 'SmolLM2 360M',
  'qwen3-0.6b': 'Qwen3 0.6B',
};

function currentModelId(): string {
  return Settings.getStringSync(Settings.KEYS.textModel, CONFIG.LOCAL_TEXT_MODEL);
}

function sources() {
  switch (currentModelId()) {
    case 'qwen2.5-0.5b': return models.llm.qwen2_5_0_5b();
    case 'qwen2.5-1.5b': return models.llm.qwen2_5_1_5b();
    case 'smollm2.1-360m': return models.llm.smollm2_1_360m();
    case 'qwen3-0.6b': return models.llm.qwen3_0_6b();
    case 'llama-3.2-1b':
    default: return models.llm.llama3_2_1b();
  }
}

/** Human-readable name of the text model currently selected. */
export function modelLabel(): string {
  return TEXT_MODEL_LABELS[currentModelId()] ?? currentModelId();
}

/** Current lifecycle status (cheap, no load triggered). */
export function getStatus(): TextStatus {
  return { phase, progress: lastProgress, label: modelLabel() };
}

/** Subscribe to lifecycle status changes (fires immediately, then on change). */
export function subscribeStatus(cb: (s: TextStatus) => void): () => void {
  statusListeners.add(cb);
  cb(getStatus());
  return () => { statusListeners.delete(cb); };
}

function emitStatus(): void {
  const s = getStatus();
  for (const cb of statusListeners) { try { cb(s); } catch { /* ignore listener errors */ } }
}

function setPhase(p: TextPhase): void {
  phase = p;
  emitStatus();
}

/** Subscribe to download progress only (0–1). Returns an unsubscribe fn. */
export function onDownloadProgress(cb: (p: number) => void): () => void {
  downloadProgressListeners.add(cb);
  cb(lastProgress);
  return () => { downloadProgressListeners.delete(cb); };
}

function broadcastProgress(p: number): void {
  lastProgress = p;
  for (const cb of downloadProgressListeners) {
    try { cb(p); } catch { /* ignore listener errors */ }
  }
  emitStatus();
}

export function canRunLocally(): boolean {
  return executorchAvailable;
}

/** Drop the cached module so each test can stub a fresh fromModelName result. */
export function _resetForTests(): void {
  modulePromise = null;
  loadedModule = null;
  ready = false;
  phase = 'idle';
  lastProgress = 0;
  downloadProgressListeners.clear();
  statusListeners.clear();
}

export function isReady(): boolean {
  return ready;
}

export async function unload(): Promise<void> {
  ready = false;
  const m = loadedModule;
  modulePromise = null;
  loadedModule = null;
  lastProgress = 0;
  setPhase('idle');
  if (m) {
    try { m.interrupt(); } catch { /* not generating */ }
    try { m.delete(); } catch { /* already gone */ }
  }
}

function loadModule(): Promise<LLMModule> {
  if (modulePromise) return modulePromise;
  lastProgress = 0;
  setPhase('downloading');
  modulePromise = LLMModule.fromModelName(
    sources(),
    p => {
      console.log('[textllm] download', (p * 100).toFixed(0) + '%');
      broadcastProgress(p);
      if (p >= 1 && phase === 'downloading') setPhase('preparing');
    },
  ).then(m => {
    loadedModule = m;
    ready = true;
    lastProgress = 1;
    setPhase('ready');
    console.log('[textllm] ready —', modelLabel());
    return m;
  }).catch(e => {
    console.log('[textllm] fromModelName threw:', e);
    modulePromise = null;
    loadedModule = null;
    ready = false;
    setPhase('error');
    throw e;
  });
  return modulePromise;
}

/** Kick off the download/load without running inference. */
export async function preload(): Promise<void> {
  if (!executorchAvailable) return;
  try { await loadModule(); } catch { /* surfaced via onDownloadProgress / isReady */ }
}

/**
 * Extract the first balanced JSON object from a model's free-text output and
 * parse it. Operating on model OUTPUT (allowed) — never on the user's words.
 */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Run a text-only structured-JSON task on-device. Router-shaped so
 * ModelRouter.chatJson() is a thin delegate. On any failure returns an error and
 * the callers apply their existing safe defaults (model route / null target).
 */
export async function generateJsonLocal<T>(input: ChatInput): Promise<Result<T, ChatError>> {
  if (!executorchAvailable) return err('unknown');
  let mod: LLMModule;
  try {
    mod = await loadModule();
  } catch {
    return err('network');
  }
  let text: string;
  try {
    // configure()+sendMessage() (not generate()): applies the chat template and
    // treats systemPrompt as a system instruction. generate() errored on-device.
    mod.configure({ chatConfig: { systemPrompt: input.systemPrompt, initialMessageHistory: [] } });
    const started = Date.now();
    const history = await withTimeout(
      mod.sendMessage(input.userText),
      CONFIG.TEXT_LLM_INFERENCE_TIMEOUT_MS,
      () => { try { mod.interrupt(); } catch { /* ignore */ } },
    );
    text = lastAssistantText(history);
    console.log('[textllm] sendMessage done in', Date.now() - started, 'ms');
  } catch (e) {
    console.log('[textllm] sendMessage failed/timed out:', e);
    return err('unknown');
  }
  const parsed = extractJson<T>(text);
  if (parsed === null) return err('parse_fail');
  return ok(parsed);
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
