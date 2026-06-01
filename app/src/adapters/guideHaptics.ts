// feat/guide-me-to-it — proximity haptic loop ("Geiger counter").
//
// A single phone motor can't render a *felt* direction (see
// docs/design/directional-haptics-notes.md), but it renders a 1-D proximity
// signal well: the pulse RATE rises as the target nears frame-center. Rate —
// not amplitude — is the lever (Android amplitude control is weak; Light is
// imperceptible on Charly's Galaxy, so we use Medium).
//
// Built on expo-haptics (no extra native dep). Two feel-smoothers, because raw
// per-frame proximity is noisy and low-fps:
//   • EMA easing → the rate ramps smoothly instead of jumping each detection.
//   • lost-grace → a dropped detection frame keeps homing briefly instead of
//     snapping to the slow "searching" tick (kills stutter).

import * as Haptics from 'expo-haptics';
import { CONFIG } from '@/config';
import { now } from '@/utils/time';

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let target = 0;       // last detected proximity, 0..1
let lastSeenAt = 0;   // ms timestamp of last detection (0 = never seen)
let smoothed = 0;     // eased proximity the buzz rate actually follows

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Tick interval for a proximity. Closer → faster. */
function intervalMs(p: number): number {
  const t = clamp01(p);
  return Math.round(
    CONFIG.GUIDE_PULSE_MAX_MS + (CONFIG.GUIDE_PULSE_MIN_MS - CONFIG.GUIDE_PULSE_MAX_MS) * t,
  );
}

function tick(): void {
  if (!running) return;
  const seen = lastSeenAt > 0 && now() - lastSeenAt < CONFIG.GUIDE_LOST_GRACE_MS;
  let interval: number;
  try {
    if (!seen) {
      // Searching — soft, sparse tick so silence doesn't read as "app died".
      smoothed = 0;
      void Haptics.selectionAsync();
      interval = CONFIG.GUIDE_SEARCH_TICK_MS;
    } else {
      // Homing — ease toward the target so the felt rate ramps smoothly.
      // Soft (gentler than Medium) — centered Medium pulses felt "violent".
      smoothed += (target - smoothed) * CONFIG.GUIDE_SMOOTH_ALPHA;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      interval = intervalMs(smoothed);
    }
  } catch {
    interval = CONFIG.GUIDE_SEARCH_TICK_MS; // haptics must never throw into the loop
  }
  timer = setTimeout(tick, interval);
}

/** Begin the loop. Starts in "searching" until updateGuide() reports a detection. */
export function startGuide(): void {
  if (running) return;
  running = true;
  target = 0;
  lastSeenAt = 0;
  smoothed = 0;
  tick();
}

/**
 * Report how centered the target is.
 * @param p 0..1 (1 = centered) or null when the target isn't detected this frame.
 *   A null is treated as a dropped frame: we keep the last target for the grace
 *   window before falling back to "searching".
 */
export function updateGuide(p: number | null): void {
  if (p === null) return;
  target = clamp01(p);
  lastSeenAt = now();
}

/** Stop the loop and clear state. */
export function stopGuide(): void {
  running = false;
  if (timer) { clearTimeout(timer); timer = null; }
  target = 0;
  lastSeenAt = 0;
  smoothed = 0;
}

/** Test seam — leave the module clean between tests. */
export function _resetForTests(): void {
  stopGuide();
}
