// Bridge to the local `ExpoVolumeKeys` native module, which emits one event per
// physical volume-key press (with direction). It's a LOCAL module under
// app/modules/expo-volume-keys, so it only exists once the app is rebuilt
// natively. requireOptionalNativeModule returns null until then — every call is
// a safe no-op, so tsc/jest/Metro and an un-rebuilt dev client keep working.
//
// The double-press windowing + Home-idle gating + routing all live in JS
// (useVolumeTrigger) — this adapter just forwards raw presses.

import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type VolumeDir = 'up' | 'down';
type VolumeKeyEvent = { key: VolumeDir };

type VolumeKeysNative = {
  addListener(event: 'onVolumeKey', listener: (e: VolumeKeyEvent) => void): EventSubscription;
};

const Native = requireOptionalNativeModule<VolumeKeysNative>('ExpoVolumeKeys');

/** True once the native module is in the binary (i.e. after a native rebuild). */
export function isVolumeKeysAvailable(): boolean {
  return Native != null;
}

/**
 * Subscribe to raw volume-key presses. Returns an unsubscribe fn. When the
 * native module is absent (no rebuild yet), returns a no-op unsubscribe.
 */
export function subscribeVolumeKeys(fn: (dir: VolumeDir) => void): () => void {
  if (!Native) return () => {};
  const sub = Native.addListener('onVolumeKey', e => fn(e.key));
  return () => sub.remove();
}
