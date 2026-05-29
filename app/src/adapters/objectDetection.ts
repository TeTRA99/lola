// feat/guide-me-to-it — on-device object detection adapter (SPIKE STUB).
//
// Target runtime: react-native-executorch (already used for CLIP embeddings).
// v0.9 ships YOLO/SSDLite detection + a runOnFrame worklet for VisionCamera v5.
// Plan (docs/design/guide-me-to-it-notes.md): YOLO26n / COCO-80, INT8, imgsz
// 320–640, ByteTrack for stable IDs. COCO covers common household objects;
// arbitrary objects ("pencil") need the open-vocab track, out of v1 scope.
//
// For now this file exposes only the geometry the haptic loop consumes; the
// live detector (frame processor → executorch → boxes) is the open spike.

/** Normalized box, origin top-left, all fields 0..1 of frame width/height. */
export type NormBox = { x: number; y: number; width: number; height: number };

export type Detection = {
  label: string; // COCO label
  score: number; // 0..1 confidence
  box: NormBox;
};

/**
 * Proximity 0..1 of a box centroid to frame-center (1 = dead-center).
 * This is the single scalar the proximity haptic loop consumes — swap the mock
 * source in GuideScreen for `proximityFromBox(detection.box)` once the detector
 * lands.
 */
export function proximityFromBox(box: NormBox): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = (cx - 0.5) * 2; // -1..1 across the frame
  const dy = (cy - 0.5) * 2;
  const dist = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
  return 1 - dist;
}

// COCO-80 labels we can offer "guide me to it" for in v1. Describe should only
// surface the guide affordance when the named object maps to one of these.
// (Subset — populate from the model's full label map when the detector lands.)
export const GUIDABLE_COCO_LABELS = [
  'cup', 'bottle', 'book', 'cell phone', 'remote', 'chair', 'couch', 'laptop',
  'mouse', 'keyboard', 'tv', 'bowl', 'spoon', 'fork', 'knife', 'scissors',
  'backpack', 'handbag', 'sports ball', 'clock', 'vase', 'wine glass',
] as const;

// TODO(spike): wire VisionCamera v5 runOnFrame → executorch YOLO26n detector,
// returning the best `Detection` for the requested target each frame:
//   createDetector(target: string): (frame: Frame) => Detection | null
