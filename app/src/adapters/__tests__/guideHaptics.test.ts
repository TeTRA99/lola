// Mock haptics + the time source so the smoothing/beat loops are deterministic
// under fake timers. (jest allows factory vars prefixed with `mock`.)

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Soft: 'Soft', Light: 'Light', Medium: 'Medium' },
}));

let mockNow = 0;
jest.mock('@/utils/time', () => ({ now: () => mockNow }));

import * as Haptics from 'expo-haptics';
import { CONFIG } from '@/config';
import { startGuide, updateGuide, stopGuide, _resetForTests, _debugState } from '../guideHaptics';

const mImpact = Haptics.impactAsync as jest.MockedFunction<typeof Haptics.impactAsync>;
const mSelection = Haptics.selectionAsync as jest.MockedFunction<typeof Haptics.selectionAsync>;

// Advance the fake clock + run timers in small chunks so setInterval steps see a
// realistic dt; optionally re-report a detection every `detPeriodMs` (simulating
// the ~7fps detector) so the freshness window stays satisfied.
function advance(totalMs: number, opts: { detect?: number; detPeriodMs?: number } = {}): void {
  const CH = 10;
  let left = totalMs;
  let sinceDet = 0;
  while (left > 0) {
    const c = Math.min(CH, left);
    mockNow += c;
    jest.advanceTimersByTime(c);
    left -= c;
    if (opts.detect !== undefined) {
      sinceDet += c;
      if (sinceDet >= (opts.detPeriodMs ?? 140)) {
        updateGuide(opts.detect);
        sinceDet = 0;
      }
    }
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockNow = 1_000_000; // realistic non-zero clock (0 is the "never seen" sentinel)
  _resetForTests();
});

afterEach(() => {
  _resetForTests();
  jest.useRealTimers();
});

describe('guideHaptics — smooth proximity loop', () => {
  it('eases the felt proximity toward a held target on the steady clock', () => {
    startGuide();
    updateGuide(1.0);
    advance(3 * CONFIG.GUIDE_SMOOTH_TAU_MS, { detect: 1.0 }); // ~3 time-constants
    expect(_debugState().smoothed).toBeGreaterThan(0.9);
  });

  it('a brief sub-fresh gap does not decay the proximity', () => {
    startGuide();
    updateGuide(1.0);
    // No further detections, but stay within GUIDE_FRESH_MS — proximity keeps rising.
    advance(CONFIG.GUIDE_FRESH_MS - 50);
    expect(_debugState().smoothed).toBeGreaterThan(0.4);
  });

  it('does NOT snap to the searching tick on target loss (smooth decay)', () => {
    startGuide();
    advance(1000, { detect: 1.0 }); // establish fast homing
    const homing = _debugState().interval;
    expect(homing).toBeLessThan(300); // fast pulse while centered

    // Stop detecting; advance through the decay window. Interval must GROW
    // gradually and stay well below the 1400ms searching tick (no snap).
    advance(CONFIG.GUIDE_DECAY_MS * 0.5);
    const decaying = _debugState().interval;
    expect(decaying).toBeGreaterThan(homing);
    expect(decaying).toBeLessThan(CONFIG.GUIDE_SEARCH_TICK_MS);
  });

  it('reaches the searching state after full decay', () => {
    startGuide();
    advance(1000, { detect: 1.0 });
    mSelection.mockClear();
    // Past FRESH + DECAY with no detection, then several beats to settle.
    advance(CONFIG.GUIDE_FRESH_MS + CONFIG.GUIDE_DECAY_MS + 4000);
    expect(_debugState().smoothed).toBeLessThan(0.05);
    expect(mSelection).toHaveBeenCalled(); // soft searching ticks resumed
  });

  it('stopGuide halts all haptics (both timers cleared)', () => {
    startGuide();
    advance(1000, { detect: 1.0 });
    stopGuide();
    mImpact.mockClear();
    mSelection.mockClear();
    advance(3000, { detect: 1.0 });
    expect(mImpact).not.toHaveBeenCalled();
    expect(mSelection).not.toHaveBeenCalled();
  });
});
