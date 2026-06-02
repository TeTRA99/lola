// feat/guide-me-to-it — live on-device detection via VisionCamera v5 + executorch.
//
// Reports the RAW detections each frame (the screen computes proximity + draws a
// debug overlay) and surfaces any frame-processor error, so we can actually see
// what the model is doing. YOLO26n is a built-in executorch model.

import { useCallback, useEffect, useMemo } from 'react';
import { useObjectDetection } from 'react-native-executorch';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { type RawDetection } from '@/adapters/objectDetection';
import { presetForLevel, currentDetectionLevel, markModelDownloaded } from '@/adapters/detectionPresets';

export function useGuideDetection(
  onResult: (dets: RawDetection[], frameW: number, frameH: number) => void,
  onWorkletError?: (msg: string) => void,
) {
  // The detector model + input size come from the caregiver's "Detection quality"
  // level (Setup). Resolve once per mount — the level only changes from Setup, and
  // re-entering Guide remounts this hook, so a stable value per session is exactly
  // right (and keeps the frame-processor worklet's captured inputSize constant).
  const preset = useMemo(() => presetForLevel(currentDetectionLevel()), []);
  const inputSize = preset.inputSize;
  const model = useObjectDetection({ model: useMemo(() => preset.model(), [preset]) });

  // Once the model finishes loading, remember its .pte is on the device — Home
  // uses this to decide whether to show the one-time prep banner for a level.
  useEffect(() => {
    if (model.isReady) markModelDownloaded(preset.modelName);
  }, [model.isReady, preset.modelName]);
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
              inputSize,               // from the caregiver's Detection-quality preset
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
      [runOnFrame, handle, noteErr, inputSize],
    ),
  });

  return {
    frameOutput,
    isReady: model.isReady,
    downloadProgress: model.downloadProgress,
    error: model.error,
    // Active detector identity (for the dev spike banner — proves the Detection
    // quality level is actually switching the model).
    detectorLabel: `${preset.modelName}@${inputSize} · L${preset.level}`,
  };
}
