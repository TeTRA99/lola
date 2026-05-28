// On-device image embeddings via react-native-executorch + CLIP-ViT-B/32 INT8.
// Replaces the cloud `embedImage()` so room identification is offline, free,
// and the user's photos never leave the phone.
//
// Lazy-load: the 96MB .pte model is downloaded from HuggingFace on first use
// and cached by the executorch runtime. Subsequent app launches reuse the
// cached file. Downloads run with a progress callback so the UI can show it.

import {
  ImageEmbeddingsModule,
  CLIP_VIT_BASE_PATCH32_IMAGE_QUANTIZED,
  isAvailable as executorchAvailable,
} from 'react-native-executorch';
import { ok, err, type Result } from '@/utils/result';

export type EmbedError = 'not_supported' | 'download_failed' | 'inference_failed';

let modulePromise: Promise<ImageEmbeddingsModule> | null = null;
let downloadProgressListeners = new Set<(p: number) => void>();
let lastProgress = 0;

/** Subscribe to download progress events (0–1). Returns an unsubscribe fn. */
export function onDownloadProgress(cb: (p: number) => void): () => void {
  downloadProgressListeners.add(cb);
  // Replay last known progress immediately so a late subscriber doesn't see 0.
  cb(lastProgress);
  return () => { downloadProgressListeners.delete(cb); };
}

function broadcastProgress(p: number): void {
  lastProgress = p;
  for (const cb of downloadProgressListeners) {
    try { cb(p); } catch { /* ignore listener errors */ }
  }
}

/** True if the runtime can load native ExecuTorch on this device. */
export function canEmbedLocally(): boolean {
  return executorchAvailable;
}

function loadModule(): Promise<ImageEmbeddingsModule> {
  if (modulePromise) return modulePromise;
  modulePromise = ImageEmbeddingsModule.fromModelName(
    CLIP_VIT_BASE_PATCH32_IMAGE_QUANTIZED,
    p => {
      console.log('[embeddings] download progress:', (p * 100).toFixed(0) + '%');
      broadcastProgress(p);
    },
  ).catch(e => {
    console.log('[embeddings] fromModelName threw:', e);
    modulePromise = null;
    throw e;
  });
  return modulePromise;
}

/**
 * Embed an image (file URI on disk) into a 512-d float vector.
 *
 * Use a file URI rather than base64 — the native side reads the file directly,
 * skipping the JS-bridge cost of shuttling 100KB+ of base64 across.
 */
export async function embedImageLocal(uri: string): Promise<Result<number[], EmbedError>> {
  if (!executorchAvailable) return err('not_supported');
  let mod: ImageEmbeddingsModule;
  try {
    mod = await loadModule();
  } catch {
    return err('download_failed');
  }
  try {
    const vec = await mod.forward(uri);
    return ok(Array.from(vec));
  } catch (e) {
    console.log('[embeddings] inference threw:', e);
    return err('inference_failed');
  }
}
