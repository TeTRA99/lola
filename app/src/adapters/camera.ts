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

/** Called by the hidden CameraView component on mount. */
export function _registerCameraRef(ref: CameraView | null): void {
  cameraRef = ref;
}

/** Test-only seam. */
export function _setCameraRefForTests(ref: unknown): void {
  cameraRef = ref as CameraView | null;
}

export async function captureSnapshot(): Promise<Result<Snapshot, CameraError>> {
  // Lazy permission request.
  const perm = await CameraModule.requestCameraPermissionsAsync();
  if (!perm.granted) return err('permission_denied');

  if (!cameraRef) return err('no_camera');

  // takePictureAsync is on the CameraView instance via ref.
  type TakePictureResult = { uri: string; base64?: string; width: number; height: number };
  type CameraViewWithCapture = CameraView & {
    takePictureAsync(opts: { base64: boolean; quality: number; skipProcessing: boolean }): Promise<TakePictureResult | undefined>;
  };
  const photo = await (cameraRef as CameraViewWithCapture).takePictureAsync({
    base64: true,
    quality: JPEG_QUALITY,
    skipProcessing: false,
  });

  if (!photo || !photo.base64) return err('capture_failed');

  const longer = Math.max(photo.width ?? 0, photo.height ?? 0);
  if (longer <= MAX_DIMENSION) {
    return ok({ uri: photo.uri, base64: photo.base64, width: photo.width, height: photo.height });
  }

  // Resize via expo-image-manipulator.
  const ratio = MAX_DIMENSION / longer;
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
}
