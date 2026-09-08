// Runtime CPU-feature probe — gates react-native-executorch on Android.
//
// The prebuilt ExecuTorch core that react-native-executorch ships (0.9.x AND 0.10,
// same binary) is compiled with inline ARMv8.1 LSE atomics: `Module::~Module()`
// executes `ldaddal` (a shared_ptr refcount decrement). ARMv8.0 cores — Cortex-A73/
// A53, i.e. Snapdragon 4xx/6xx like dad's Redmi Note 11 (SD680) — don't have LSE, so
// destroying ANY loaded model SIGILLs the whole process: explicit unload, hook
// unmount, llmResidency swaps, or a GC after a memory warning. Loading + inference
// are fine (XNNPACK kernels dispatch at runtime); only teardown dies. A model that
// can never be released is a crash waiting for a GC, so on such CPUs we don't touch
// executorch at all until SWM ships an outline-atomics core.
// Evidence + upstream status: docs/design/model-usage.md, memory `executorch-armv8-sigill`.
import { Platform } from 'react-native';
import { File } from 'expo-file-system';

let cached: Promise<boolean> | null = null;
let known: boolean | null = null;

/** `/proc/cpuinfo` → does the `Features` line advertise LSE (`atomics`)?
 *  null = no Features line (can't tell). Exported for tests. */
export function parseHasLseAtomics(cpuinfo: string): boolean | null {
  const line = cpuinfo.split('\n').find(l => /^Features\s*:/i.test(l));
  if (!line) return null;
  const flags = line.slice(line.indexOf(':') + 1).trim().split(/\s+/);
  return flags.includes('atomics');
}

async function probe(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const text = await new File('file:///proc/cpuinfo').text();
    const lse = parseHasLseAtomics(text);
    if (lse === null) {
      // Don't switch off on-device AI on every phone we can't read — assume OK.
      console.warn('[cpu] /proc/cpuinfo has no Features line; assuming LSE atomics present');
      return true;
    }
    console.log(`[cpu] LSE atomics: ${lse ? 'yes' : 'NO'} → executorch ${lse ? 'enabled' : 'DISABLED (ARMv8.0: model teardown would SIGILL)'}`);
    return lse;
  } catch (e) {
    console.warn('[cpu] could not read /proc/cpuinfo; assuming LSE atomics present', e);
    return true;
  }
}

/** True when ExecuTorch's prebuilt core can run on this CPU. Probed once, cached. */
export function canRunExecutorch(): Promise<boolean> {
  if (!cached) cached = probe().then(v => { known = v; return v; });
  return cached;
}

/** Sync view once probed (call canRunExecutorch() at boot). null = not probed yet. */
export function executorchSupportKnown(): boolean | null {
  return known;
}

export function _resetForTests(): void {
  cached = null;
  known = null;
}
