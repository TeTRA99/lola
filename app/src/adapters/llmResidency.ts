// Single-LLM residency coordinator (feat/on-device-models).
//
// react-native-executorch keeps ONE LLM runner resident on the native side —
// loading the VLM and the text model at the same time makes the second one fail
// ("Failed to generate text"). And on the Galaxy A12's ~3-4GB RAM two transformer
// graphs wouldn't fit anyway. So we serialize all load/unload through one queue
// and keep exactly one model resident, swapping on demand. Swaps reload from the
// on-disk cache (no re-download), but re-initializing the graph is slow on the
// A12 — that cost is unavoidable while both features must work on-device.

import * as Vlm from './visionLLM';
import * as Text from './textLLM';

type Which = 'vlm' | 'text';

let current: Which | null = null;
// Serialize every operation so two models never initialize concurrently.
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(() => undefined, () => undefined);
  return next;
}

async function unloadOther(keep: Which): Promise<void> {
  if (current && current !== keep) {
    if (current === 'vlm') await Vlm.unload();
    else await Text.unload();
  }
  current = keep;
}

/** Make `which` the resident LLM (unloading the other first). Call before the
 *  matching adapter's inference, which then lazy-loads it. */
export function ensureResident(which: Which): Promise<void> {
  return serialize(() => unloadOther(which));
}

/** Preload (download + warm) one model as the resident, serialized so it can't
 *  race a swap or another preload. */
export function preloadResident(which: Which): Promise<void> {
  return serialize(async () => {
    await unloadOther(which);
    if (which === 'vlm') await Vlm.preload();
    else await Text.preload();
  });
}
