// Keep the screen awake during hands-free live flows (Guide me to it): the user
// is following haptics with the phone held up, not touching the screen, so iOS's
// (and Android's) idle timer would dim and lock mid-search.
//
// The native `ExpoKeepAwake` module is already compiled into the binary
// (autolinked via the `expo` package), so we call it directly through
// expo-modules-core instead of adding the `expo-keep-awake` JS package — that
// keeps this a JS-only change with no native rebuild. requireOptionalNativeModule
// returns null if the module is somehow absent, so every call is a safe no-op then.

import { requireOptionalNativeModule } from 'expo-modules-core';

type KeepAwakeNative = {
  activate(tag: string): Promise<boolean>;
  deactivate(tag: string): Promise<boolean>;
};

const Native = requireOptionalNativeModule<KeepAwakeNative>('ExpoKeepAwake');

/** Prevent screen sleep until releaseKeepAwake(tag) is called. Best-effort. */
export async function activateKeepAwake(tag: string): Promise<void> {
  try { await Native?.activate(tag); } catch { /* best effort — never break the flow */ }
}

/** Release the lock taken by activateKeepAwake(tag). Best-effort. */
export async function releaseKeepAwake(tag: string): Promise<void> {
  try { await Native?.deactivate(tag); } catch { /* best effort */ }
}
