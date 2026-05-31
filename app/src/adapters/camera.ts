// Camera adapter — snapshot-only (no video, no live preview surface to dad).
// Pattern: a hidden CameraView is mounted somewhere in the tree (offscreen 1x1)
// and registers itself via _registerCameraRef. The adapter holds a singleton
// ref and exposes captureSnapshot() as a pure function for services to call.
//
// Permission is requested lazily on first capture, not eagerly at boot.

import {
  type CameraView,
  Camera as CameraModule,
} from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ok, err, type Result } from '@/utils/result';
import * as Settings from '@/services/Settings';

export type CameraError = 'permission_denied' | 'no_camera' | 'capture_failed' | 'unknown';

export type Snapshot = {
  uri: string;
  base64: string;
  width: number;
  height: number;
};

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

let cameraRef: CameraView | null = null;
let cameraReady = false;

/** Called by the hidden CameraView component on mount. */
export function _registerCameraRef(ref: CameraView | null): void {
  cameraRef = ref;
  if (!ref) cameraReady = false;
}

/** Called by the hidden CameraView's onCameraReady — the stream is live. */
export function _setCameraReady(v: boolean): void {
  cameraReady = v;
}

/** Test-only seam. */
export function _setCameraRefForTests(ref: unknown): void {
  cameraRef = ref as CameraView | null;
  cameraReady = !!ref;
}

// B5 fix (2026-05-27 review): poll briefly after a fresh "Allow" tap — the host
// re-render is async. Extended: also wait for the camera to actually be READY
// (onCameraReady), not just mounted. On MIUI/Xiaomi (Redmi) the hidden 1×1
// camera streams late, so takePictureAsync before ready can hang forever.
const REF_POLL_MAX_MS = 3000;
const REF_POLL_INTERVAL_MS = 50;
const CAPTURE_TIMEOUT_MS = 8000; // never let takePictureAsync hang the whole flow

async function awaitCameraReady(): Promise<boolean> {
  const deadline = Date.now() + REF_POLL_MAX_MS;
  while (Date.now() < deadline) {
    if (cameraRef && cameraReady) return true;
    await new Promise<void>(r => setTimeout(r, REF_POLL_INTERVAL_MS));
  }
  // Some devices don't fire onCameraReady reliably — if the ref exists, still
  // attempt (the capture timeout below is the backstop).
  return !!cameraRef;
}

export async function captureSnapshot(): Promise<Result<Snapshot, CameraError>> {
  // Lazy permission request.
  const perm = await CameraModule.requestCameraPermissionsAsync();
  if (!perm.granted) return err('permission_denied');

  if (!(await awaitCameraReady())) return err('no_camera');

  // takePictureAsync is on the CameraView instance via ref. Wrap so native
  // throws ("Failed to capture image", camera-in-use, etc.) come back as a
  // typed error instead of an unhandled promise rejection.
  type TakePictureResult = { uri: string; base64?: string; width: number; height: number };
  type CameraViewWithCapture = CameraView & {
    takePictureAsync(opts: { base64: boolean; quality: number; skipProcessing: boolean; shutterSound?: boolean }): Promise<TakePictureResult | undefined>;
  };
  let photo: TakePictureResult | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    photo = await Promise.race([
      (cameraRef as CameraViewWithCapture).takePictureAsync({
        base64: true,
        quality: JPEG_QUALITY,
        skipProcessing: false,
        shutterSound: !Settings.getBoolSync(Settings.KEYS.quietCapture, false),
      }),
      new Promise<undefined>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('capture_timeout')), CAPTURE_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    console.log('[camera] takePictureAsync threw/timed out:', e);
    return err('capture_failed');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!photo || !photo.base64) return err('capture_failed');

  const longer = Math.max(photo.width ?? 0, photo.height ?? 0);
  if (longer <= MAX_DIMENSION) {
    return ok({ uri: photo.uri, base64: photo.base64, width: photo.width, height: photo.height });
  }

  // Resize via expo-image-manipulator.
  const ratio = MAX_DIMENSION / longer;
  try {
    const resized = await manipulateAsync(
      photo.uri,
      [{ resize: { width: Math.round(photo.width * ratio), height: Math.round(photo.height * ratio) } }],
      { compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) return err('capture_failed');
    return ok({
      uri: resized.uri,
      base64: resized.base64,
      width: resized.width,
      height: resized.height,
    });
  } catch (e) {
    console.log('[camera] manipulateAsync threw:', e);
    return err('capture_failed');
  }
}
