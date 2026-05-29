// feat/guide-me-to-it — live on-device detection via VisionCamera v5 + executorch.
//
// Reports the RAW detections each frame (the screen computes proximity + draws a
// debug overlay) and surfaces any frame-processor error, so we can actually see
// what the model is doing. YOLO26n is a built-in executorch model.

import { useCallback } from 'react';
import { models, useObjectDetection } from 'react-native-executorch';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { type RawDetection } from '@/adapters/objectDetection';

export function useGuideDetection(
  onResult: (dets: RawDetection[], frameW: number, frameH: number) => void,
  onWorkletError?: (msg: string) => void,
) {
  const model = useObjectDetection({ model: models.object_detection.yolo26n() });
  const runOnFrame = model.runOnFrame;

  const handle = useCallback(
    (dets: RawDetection[], w: number, h: number) => onResult(dets, w, h),
    [onResult],
  );
  const noteErr = useCallback((msg: string) => onWorkletError?.(msg), [onWorkletError]);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',         // executorch vision models expect RGB
    dropFramesWhileBusy: true,  // skip frames while inference is mid-flight
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';
        try {
          if (runOnFrame) {
            const dets = runOnFrame(frame, false, {
              detectionThreshold: 0.3, // permissive while debugging
              inputSize: 640,          // YOLO: better accuracy than the 384 default
            }) as RawDetection[] | undefined;
            scheduleOnRN(handle, dets ?? [], frame.width, frame.height);
          }
        } catch (e) {
          // Report instead of silently swallowing — a real runOnFrame failure
          // (e.g. unsupported option) would otherwise look like "detects nothing".
          scheduleOnRN(noteErr, String(e));
        } finally {
          frame.dispose();
        }
      },
      [runOnFrame, handle, noteErr],
    ),
  });

  return {
    frameOutput,
    isReady: model.isReady,
    downloadProgress: model.downloadProgress,
    error: model.error,
  };
}
