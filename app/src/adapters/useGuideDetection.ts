// feat/guide-me-to-it — live on-device detection → proximity (UNVERIFIED ON
// DEVICE; wired per current docs, typechecked, but not yet run on hardware).
//
// Path (confirmed against react-native-executorch 0.9 + VisionCamera v5 docs +
// installed type defs):
//   useObjectDetection({ model: models.object_detection.yolo26n() }) → runOnFrame
//   useFrameOutput({ pixelFormat:'rgb', onFrame: <worklet> }) → CameraFrameOutput
//   inside the worklet: runOnFrame(frame, isFront) → detections (pixel bboxes),
//   then scheduleOnRN(...) hops back to JS to pick the target + compute proximity.
//
// YOLO26n is a BUILT-IN executorch model (no custom .pte export needed). The
// model binary downloads on first use — `downloadProgress` drives a UI hint.
// Mount this hook only while live mode is on, so mock-mode never downloads it.

import { useCallback } from 'react';
import { models, useObjectDetection } from 'react-native-executorch';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import {
  bestDetectionFor, normalizePixelBox, proximityFromBox, type RawDetection,
} from '@/adapters/objectDetection';

/**
 * @param targetLabel COCO label to home in on, or null for "any guidable object".
 * @param onProximity called with 0..1 (centered) or null (target not in frame).
 */
export function useGuideDetection(
  targetLabel: string | null,
  onProximity: (p: number | null) => void,
) {
  const model = useObjectDetection({ model: models.object_detection.yolo26n() });

  // Runs on the JS thread (via scheduleOnRN) — safe to touch state/closures here.
  const handleDetections = useCallback(
    (dets: RawDetection[], frameW: number, frameH: number) => {
      const best = bestDetectionFor(dets, targetLabel);
      onProximity(best ? proximityFromBox(normalizePixelBox(best.bbox, frameW, frameH)) : null);
    },
    [targetLabel, onProximity],
  );

  // runOnFrame is null until the model is ready — capture + guard it.
  const runOnFrame = model.runOnFrame;
  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',         // executorch vision models expect RGB
    dropFramesWhileBusy: true,  // skip frames while inference is mid-flight
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';
        try {
          if (runOnFrame) {
            const dets = runOnFrame(frame, false) as RawDetection[] | undefined;
            if (dets) scheduleOnRN(handleDetections, dets, frame.width, frame.height);
          }
        } catch {
          // Model mid-load or being torn down (live→mock toggle) — a frame can
          // still call in and throw "Model not loaded". Skip this frame quietly.
        } finally {
          frame.dispose();
        }
      },
      [runOnFrame, handleDetections],
    ),
  });

  return {
    frameOutput,
    isReady: model.isReady,
    downloadProgress: model.downloadProgress,
    error: model.error,
  };
}
