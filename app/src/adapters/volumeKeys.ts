// Bridge to the local `ExpoVolumeKeys` native module, which emits one event per
// physical volume-key press (with direction). It's a LOCAL module under
// app/modules/expo-volume-keys, so it only exists once the app is rebuilt
// natively. requireOptionalNativeModule returns null until then — every call is
// a safe no-op, so tsc/jest/Metro and an un-rebuilt dev client keep working.
//
// The double-press windowing + Home-idle gating + routing all live in JS
// (useVolumeTrigger) — this adapter just forwards raw presses.

import { Platform } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type VolumeDir = 'up' | 'down';
type VolumeKeyEvent = { key: VolumeDir };

type VolumeKeysNative = {
  addListener(event: 'onVolumeKey', listener: (e: VolumeKeyEvent) => void): EventSubscription;
};

// ANDROID-ONLY. Android forwards real key events without consuming them, so the
// volume keeps working normally. iOS has no clean volume-key API — the only way
// to detect a press is to activate an audio session + a hidden MPVolumeView,
// which HIJACKS the system volume on the idle Home screen (ringer/media mismatch,
// presses doing nothing until TTS makes the session real). That's worse than the
// feature is worth on iOS (Charly's test device), so we never observe there and
// iOS volume behaves 100% normally. Revisit only with a non-intrusive iOS path.
const Native = Platform.OS === 'android'
  ? requireOptionalNativeModule<VolumeKeysNative>('ExpoVolumeKeys')
  : null;

/** True once the native module is usable (Android + in the binary). */
export function isVolumeKeysAvailable(): boolean {
  return Native != null;
}

/**
 * Subscribe to raw volume-key presses. Returns an unsubscribe fn. No-op on iOS
 * and when the native module is absent (no rebuild yet).
 */
export function subscribeVolumeKeys(fn: (dir: VolumeDir) => void): () => void {
  if (!Native) return () => {};
  const sub = Native.addListener('onVolumeKey', e => fn(e.key));
  return () => sub.remove();
}
