// Double-press volume trigger for the two core actions:
//   Vol-Up  ×2 → Describe
//   Vol-Down ×2 → Ask
// Single presses still change the device volume (the native side never consumes
// the key). All the policy lives here in JS so it's unit-testable; the native
// module just forwards raw presses. Gated on Home being idle + the caregiver
// toggle, so it never fires mid-flow or off the Home screen.

import { useEffect, useRef } from 'react';
import { subscribeVolumeKeys, type VolumeDir } from '@/adapters/volumeKeys';
import { CONFIG } from '@/config';

export type VolumeAction = 'describe' | 'ask';
export type DoublePressState = { lastDir: VolumeDir | null; lastAt: number };

export const INITIAL_DOUBLE_PRESS: DoublePressState = { lastDir: null, lastAt: 0 };

/**
 * Pure double-press reducer (unit-tested without native). Two presses of the
 * SAME direction within `windowMs` fire the action; otherwise the press becomes
 * a fresh "first press". Firing resets the state so a third press doesn't
 * immediately re-fire.
 */
export function classifyVolumePress(
  now: number,
  dir: VolumeDir,
  state: DoublePressState,
  windowMs: number = CONFIG.VOLUME_DOUBLE_MS,
): { fired: VolumeAction | null; next: DoublePressState } {
  if (state.lastDir === dir && now - state.lastAt <= windowMs) {
    return { fired: dir === 'up' ? 'describe' : 'ask', next: INITIAL_DOUBLE_PRESS };
  }
  return { fired: null, next: { lastDir: dir, lastAt: now } };
}

/**
 * Wire the volume trigger to the two action callbacks. Only subscribes while
 * `enabled && idle` (Home mounted + idle), so volume keys behave normally
 * everywhere else.
 */
export function useVolumeTrigger(opts: {
  enabled: boolean;
  idle: boolean;
  onDescribe: () => void;
  onAsk: () => void;
}): void {
  const stateRef = useRef<DoublePressState>(INITIAL_DOUBLE_PRESS);
  // Keep the latest callbacks without re-subscribing every render.
  const cbRef = useRef(opts);
  cbRef.current = opts;

  const active = opts.enabled && opts.idle;
  useEffect(() => {
    if (!active) return;
    stateRef.current = INITIAL_DOUBLE_PRESS;
    return subscribeVolumeKeys(dir => {
      const { fired, next } = classifyVolumePress(Date.now(), dir, stateRef.current);
      stateRef.current = next;
      if (fired === 'describe') cbRef.current.onDescribe();
      else if (fired === 'ask') cbRef.current.onAsk();
    });
  }, [active]);
}
