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

/** Pixel-space box as returned by executorch (top-left x1,y1 / bottom-right x2,y2). */
export type PixelBBox = { x1: number; y1: number; x2: number; y2: number };

/** A detection straight off the model — bbox in frame pixels. */
export type RawDetection = { bbox: PixelBBox; label: string; score: number };

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

/** Convert a pixel bbox + frame size into a normalized box (origin top-left). */
export function normalizePixelBox(b: PixelBBox, frameW: number, frameH: number): NormBox {
  if (frameW <= 0 || frameH <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const x1 = Math.min(b.x1, b.x2);
  const y1 = Math.min(b.y1, b.y2);
  const x2 = Math.max(b.x1, b.x2);
  const y2 = Math.max(b.y1, b.y2);
  return {
    x: x1 / frameW,
    y: y1 / frameH,
    width: (x2 - x1) / frameW,
    height: (y2 - y1) / frameH,
  };
}

// COCO-80 labels we can offer "guide me to it" for in v1. Describe should only
// surface the guide affordance when the named object maps to one of these.
// (Subset — populate from the model's full label map when the detector lands.)
export const GUIDABLE_COCO_LABELS = [
  'cup', 'bottle', 'book', 'cell phone', 'remote', 'chair', 'couch', 'laptop',
  'mouse', 'keyboard', 'tv', 'bowl', 'spoon', 'fork', 'knife', 'scissors',
  'backpack', 'handbag', 'sports ball', 'clock', 'vase', 'wine glass',
] as const;

/**
 * Pick the single detection to home in on: highest-score match for the target
 * COCO label, or — when no target is given — the highest-score guidable object.
 * Returns null when nothing relevant is in frame (→ "searching" haptic).
 */
export function bestDetectionFor(
  dets: RawDetection[],
  targetLabel: string | null,
): RawDetection | null {
  const guidable = GUIDABLE_COCO_LABELS as readonly string[];
  const pool = targetLabel
    ? dets.filter(d => d.label === targetLabel)
    : dets.filter(d => guidable.includes(d.label));
  let best: RawDetection | null = null;
  for (const d of pool) if (!best || d.score > best.score) best = d;
  return best;
}
