import {
  proximityFromBox,
  normalizePixelBox,
  bestDetectionFor,
  frameBoxToScreen,
  proximityFromScreenRect,
  screenSpaceDims,
  type RawDetection,
} from '@/adapters/objectDetection';

describe('proximityFromBox (blend of centering + size)', () => {
  // A centered box that fills the frame is fully "reached" (centering=1, size
  // clamps to 1) regardless of the GUIDE_REACH_SIZE tuning.
  it('is 1 for a centered, frame-filling box', () => {
    expect(proximityFromBox({ x: 0, y: 0, width: 1, height: 1 })).toBeCloseTo(1, 5);
  });

  // Size matters now: a bigger centered box reads closer than a smaller one.
  it('grows with object size (same center)', () => {
    const small = proximityFromBox({ x: 0.45, y: 0.45, width: 0.1, height: 0.1 });
    const big = proximityFromBox({ x: 0.3, y: 0.3, width: 0.4, height: 0.4 });
    expect(big).toBeGreaterThan(small);
  });

  // Centering still matters: centered reads closer than off-center, same size.
  it('grows with centering (same size)', () => {
    const centered = proximityFromBox({ x: 0.45, y: 0.45, width: 0.1, height: 0.1 });
    const offCenter = proximityFromBox({ x: 0.85, y: 0.85, width: 0.1, height: 0.1 });
    expect(centered).toBeGreaterThan(offCenter);
  });

  it('drops toward 0 as the box moves to a corner', () => {
    const center = proximityFromBox({ x: 0.45, y: 0.45, width: 0.1, height: 0.1 });
    const corner = proximityFromBox({ x: 0.85, y: 0.85, width: 0.1, height: 0.1 });
    expect(corner).toBeLessThan(center);
    expect(corner).toBeGreaterThanOrEqual(0);
  });

  it('is symmetric across the center for an equal-size box', () => {
    const left = proximityFromBox({ x: 0.1, y: 0.45, width: 0.1, height: 0.1 });
    const right = proximityFromBox({ x: 0.8, y: 0.45, width: 0.1, height: 0.1 });
    expect(left).toBeCloseTo(right, 5);
  });
});

describe('normalizePixelBox', () => {
  it('converts pixel corners to a normalized box', () => {
    const n = normalizePixelBox({ x1: 320, y1: 240, x2: 640, y2: 480 }, 1280, 960);
    expect(n).toEqual({ x: 0.25, y: 0.25, width: 0.25, height: 0.25 });
  });

  it('handles swapped corners', () => {
    const n = normalizePixelBox({ x1: 640, y1: 480, x2: 320, y2: 240 }, 1280, 960);
    expect(n).toEqual({ x: 0.25, y: 0.25, width: 0.25, height: 0.25 });
  });

  it('guards against a zero-sized frame', () => {
    expect(normalizePixelBox({ x1: 1, y1: 1, x2: 2, y2: 2 }, 0, 0)).toEqual({
      x: 0, y: 0, width: 0, height: 0,
    });
  });

  it('round-trips with proximityFromBox for a centered full-frame pixel box', () => {
    const n = normalizePixelBox({ x1: 0, y1: 0, x2: 1280, y2: 960 }, 1280, 960);
    expect(proximityFromBox(n)).toBeCloseTo(1, 5);
  });
});

describe('bestDetectionFor', () => {
  const cup1: RawDetection = { label: 'cup', score: 0.6, bbox: { x1: 0, y1: 0, x2: 10, y2: 10 } };
  const cup2: RawDetection = { label: 'cup', score: 0.9, bbox: { x1: 0, y1: 0, x2: 10, y2: 10 } };
  const chair: RawDetection = { label: 'chair', score: 0.95, bbox: { x1: 0, y1: 0, x2: 10, y2: 10 } };
  const person: RawDetection = { label: 'person', score: 0.99, bbox: { x1: 0, y1: 0, x2: 10, y2: 10 } };

  it('picks the highest-score detection of the target label', () => {
    expect(bestDetectionFor([cup1, cup2, chair], 'cup')).toBe(cup2);
  });

  it('returns null when the target label is absent', () => {
    expect(bestDetectionFor([chair, person], 'cup')).toBeNull();
  });

  it('with no target, picks the best GUIDABLE object (ignoring non-guidable)', () => {
    // person is not in GUIDABLE_COCO_LABELS, so chair (guidable) wins despite lower score.
    expect(bestDetectionFor([person, chair, cup2], null)).toBe(chair);
  });

  it('returns null when nothing guidable is present', () => {
    expect(bestDetectionFor([person], null)).toBeNull();
  });

  it('matches model labels case/separator-insensitively (CUP, DINING_TABLE)', () => {
    const cupUpper: RawDetection = { label: 'CUP', score: 0.3, bbox: { x1: 0, y1: 0, x2: 10, y2: 10 } };
    const table: RawDetection = { label: 'DINING_TABLE', score: 0.9, bbox: { x1: 0, y1: 0, x2: 10, y2: 10 } };
    // model emits UPPERCASE_UNDERSCORE; our labels are lowercase-with-spaces
    expect(bestDetectionFor([cupUpper, table], 'cup')).toBe(cupUpper);
    expect(bestDetectionFor([cupUpper, table], 'dining table')).toBe(table);
  });
});

describe('frameBoxToScreen + proximityFromScreenRect', () => {
  const FW = 1280, FH = 720;     // native landscape sensor dims (frame.width/height)
  const SW = 720, SH = 1545;     // portrait display
  // executorch returns screen-space (portrait) coords, so the space is 720×1280.

  it('maps a screen-space-centered box to the screen center → proximity ~1', () => {
    // centroid (360, 640) = center of the 720×1280 portrait screen-space
    const r = frameBoxToScreen({ x1: 340, y1: 600, x2: 380, y2: 680 }, FW, FH, SW, SH);
    const cx = (r.left + r.width / 2) / SW;
    const cy = (r.top + r.height / 2) / SH;
    expect(cx).toBeCloseTo(0.5, 2);
    expect(cy).toBeCloseTo(0.5, 2);
    expect(proximityFromScreenRect(r, SW, SH)).toBeCloseTo(1, 2);
  });

  it('an off-center box reads lower proximity than a centered one', () => {
    const centered = frameBoxToScreen({ x1: 340, y1: 600, x2: 380, y2: 680 }, FW, FH, SW, SH);
    const corner = frameBoxToScreen({ x1: 0, y1: 0, x2: 120, y2: 120 }, FW, FH, SW, SH);
    expect(proximityFromScreenRect(corner, SW, SH)).toBeLessThan(proximityFromScreenRect(centered, SW, SH));
  });

  it('guards a zero-sized frame/screen', () => {
    expect(frameBoxToScreen({ x1: 0, y1: 0, x2: 1, y2: 1 }, 0, 0, SW, SH)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(proximityFromScreenRect({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBe(0);
  });

  it('screenSpaceDims returns portrait (min,max)', () => {
    expect(screenSpaceDims(1280, 720)).toEqual({ w: 720, h: 1280 });
    expect(screenSpaceDims(720, 1280)).toEqual({ w: 720, h: 1280 });
  });
});
