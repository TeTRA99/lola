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

import { CONFIG } from '@/config';

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
 * Proximity 0..1 the haptic loop consumes — a blend of how CENTERED the box is
 * AND how BIG it is (a coarse distance proxy), so the pulse quickens both as you
 * aim at the target and as you physically approach it. Weighting is
 * CONFIG.GUIDE_CENTER_WEIGHT (centering) vs the remainder (size); a box whose
 * larger side reaches CONFIG.GUIDE_REACH_SIZE of the frame counts as "reached".
 */
export function proximityFromBox(box: NormBox): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = (cx - 0.5) * 2; // -1..1 across the frame
  const dy = (cy - 0.5) * 2;
  const centering = 1 - Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
  const size = Math.min(1, Math.max(box.width, box.height) / CONFIG.GUIDE_REACH_SIZE);
  const w = CONFIG.GUIDE_CENTER_WEIGHT;
  return w * centering + (1 - w) * size;
}

// ── Cloud grounding (feat: cloud "guide me to it" spike) ───────────────────
// A cloud VLM returns a box for an arbitrary object, but coordinate conventions
// differ by model: Gemini → NORMALIZED 0–1000 [ymin, xmin, ymax, xmax]; Qwen3-VL
// → ABSOLUTE PIXEL [x1, y1, x2, y2]. parseGroundingBox normalizes either into a
// NormBox so the rest of the guide pipeline (proximityFromBox) is unchanged.
// (The matching prompt-side instruction lives in gateways/openrouter.ts.)

/** True when the model emits absolute-pixel boxes (needs frame dims to normalize). */
export function groundingIsPixelBox(model: string): boolean {
  return /qwen/i.test(model);
}

/**
 * Normalize a raw 4-number grounding box into a NormBox (0..1, origin top-left).
 * Returns null if the array isn't a usable box. `frameW/H` are only needed for the
 * pixel-coordinate (Qwen) convention; Gemini's 0–1000 scale is frame-independent.
 */
export function parseGroundingBox(
  model: string,
  raw: number[] | null | undefined,
  frameW: number,
  frameH: number,
): NormBox | null {
  if (!Array.isArray(raw) || raw.length !== 4 || raw.some(n => typeof n !== 'number' || !isFinite(n))) {
    return null;
  }
  let x1: number, y1: number, x2: number, y2: number;
  if (groundingIsPixelBox(model)) {
    // Qwen: absolute pixels [x1, y1, x2, y2].
    if (frameW <= 0 || frameH <= 0) return null;
    [x1, y1, x2, y2] = [raw[0] / frameW, raw[1] / frameH, raw[2] / frameW, raw[3] / frameH];
  } else {
    // Gemini: normalized 0–1000 [ymin, xmin, ymax, xmax].
    const [ymin, xmin, ymax, xmax] = raw;
    [x1, y1, x2, y2] = [xmin / 1000, ymin / 1000, xmax / 1000, ymax / 1000];
  }
  const left = Math.max(0, Math.min(x1, x2));
  const top = Math.max(0, Math.min(y1, y2));
  const right = Math.min(1, Math.max(x1, x2));
  const bottom = Math.min(1, Math.max(y1, y2));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
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

/** A box in on-screen pixels. */
export type ScreenRect = { left: number; top: number; width: number; height: number };

/**
 * Map a frame-pixel box to on-screen pixels, accounting for the back camera's
 * 90° rotation (landscape frame → portrait display) and the preview's 'cover'
 * crop. Drawing the overlay AND computing proximity from this same rect keeps
 * them consistent: an object under the center reticle reads proximity ≈ 1.
 */
export function frameBoxToScreen(
  b: PixelBBox, frameW: number, frameH: number, screenW: number, screenH: number,
): ScreenRect {
  if (frameW <= 0 || frameH <= 0 || screenW <= 0 || screenH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  // executorch's runOnFrame already orients boxes to the (portrait) display via
  // frame.orientation — coords are in screen-space, NOT the native landscape
  // frame. So the screen-space size is portrait: width = smaller sensor dim,
  // height = larger. (App is portrait-locked.) No extra rotation here.
  const sw = Math.min(frameW, frameH);
  const sh = Math.max(frameW, frameH);
  const nx = Math.min(b.x1, b.x2) / sw;
  const ny = Math.min(b.y1, b.y2) / sh;
  const nw = Math.abs(b.x2 - b.x1) / sw;
  const nh = Math.abs(b.y2 - b.y1) / sh;
  // 'cover'-fit the portrait screen-space into the display.
  const scale = Math.max(screenW / sw, screenH / sh);
  const renderW = sw * scale;
  const renderH = sh * scale;
  const offX = (screenW - renderW) / 2;
  const offY = (screenH - renderH) / 2;
  return {
    left: offX + nx * renderW,
    top: offY + ny * renderH,
    width: nw * renderW,
    height: nh * renderH,
  };
}

/** Screen-space (portrait-oriented) dims for a sensor frame on a portrait phone. */
export function screenSpaceDims(frameW: number, frameH: number): { w: number; h: number } {
  return { w: Math.min(frameW, frameH), h: Math.max(frameW, frameH) };
}

/** Proximity 0..1 of a screen rect's center to the screen center (1 = centered). */
export function proximityFromScreenRect(r: ScreenRect, screenW: number, screenH: number): number {
  if (screenW <= 0 || screenH <= 0) return 0;
  const cx = (r.left + r.width / 2) / screenW;
  const cy = (r.top + r.height / 2) / screenH;
  const dx = (cx - 0.5) * 2;
  const dy = (cy - 0.5) * 2;
  return 1 - Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
}

// COCO-80 labels we can offer "guide me to it" for in v1. Describe should only
// surface the guide affordance when the named object maps to one of these.
// (Subset — populate from the model's full label map when the detector lands.)
export const GUIDABLE_COCO_LABELS = [
  // Small findables (hunt for on a surface)
  'cup', 'bottle', 'bowl', 'wine glass', 'fork', 'knife', 'spoon',
  'cell phone', 'remote', 'laptop', 'keyboard', 'mouse',
  'book', 'scissors', 'clock', 'vase', 'backpack', 'handbag', 'sports ball',
  // Key navigation landmarks (orient toward in a room)
  'chair', 'couch', 'dining table', 'bed', 'toilet', 'refrigerator', 'tv',
] as const;

// The model returns labels like "CUP", "DINING_TABLE"; our list is lowercase
// with spaces ("cup", "dining table"). Normalize both sides before comparing.
function normLabel(s: string): string {
  return s.toUpperCase().replace(/[\s_]+/g, '');
}
const GUIDABLE_NORM = new Set((GUIDABLE_COCO_LABELS as readonly string[]).map(normLabel));

/**
 * Pick the single detection to home in on: highest-score match for the target
 * COCO label, or — when no target is given — the highest-score guidable object.
 * Returns null when nothing relevant is in frame (→ "searching" haptic).
 * Label matching is case- and separator-insensitive (model emits "CUP").
 */
export function bestDetectionFor(
  dets: RawDetection[],
  targetLabel: string | null,
): RawDetection | null {
  const target = targetLabel ? normLabel(targetLabel) : null;
  const pool = target
    ? dets.filter(d => normLabel(String(d.label)) === target)
    : dets.filter(d => GUIDABLE_NORM.has(normLabel(String(d.label))));
  let best: RawDetection | null = null;
  for (const d of pool) if (!best || d.score > best.score) best = d;
  return best;
}
