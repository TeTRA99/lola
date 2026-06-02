// feat/guide-me-to-it — proximity haptic loop ("Geiger counter").
//
// A single phone motor can't render a *felt* direction (see
// docs/design/directional-haptics-notes.md), but it renders a 1-D proximity
// signal well: the pulse RATE rises as the target nears. Rate — not amplitude —
// is the lever (Android amplitude control is weak; Light is imperceptible on
// Charly's Galaxy, so homing uses Soft / searching uses selection).
//
// The raw proximity is noisy and low-fps (~7fps on the iOS detector), which used
// to make the cadence lurch. Three independent smoothers fix that:
//   • One Euro filter on the raw input — de-jitters a resting target without
//     adding lag while the user sweeps fast toward it.
//   • A STEADY ~30ms easing clock (decoupled from both the beat and the detector)
//     glides the felt proximity with an FPS-independent time-constant.
//   • A lost-frame DECAY (not a hard snap) — a dropped detection eases proximity
//     down over ~1s instead of jumping to the slow "searching" tick.
// Plus a per-beat slew cap so the felt period can't jump in a single beat.

import * as Haptics from 'expo-haptics';
import { CONFIG } from '@/config';
import { now } from '@/utils/time';
import { createOneEuro } from '@/utils/oneEuro';

let beatTimer: ReturnType<typeof setTimeout> | null = null;
let stepTimer: ReturnType<typeof setInterval> | null = null;
let running = false;
let rawTarget = 0;     // One-Euro-filtered last detected proximity, 0..1
let lastSeenAt = 0;    // ms timestamp of last detection (0 = never seen)
let smoothed = 0;      // eased proximity the buzz rate actually follows
let lastStepAt = 0;    // ms timestamp of the last smoothing step (for real dt)
let prevInterval = CONFIG.GUIDE_SEARCH_TICK_MS; // for the per-beat slew cap
let nextBeatAt = 0;    // ms timestamp the next beat is scheduled for (acquire pull-in)

const SEARCH_EPS = 0.03; // below this eased proximity → "searching" tick/feel

const prox = createOneEuro({
  minCutoff: CONFIG.GUIDE_OE_MIN_CUTOFF,
  beta: CONFIG.GUIDE_OE_BETA,
  dCutoff: CONFIG.GUIDE_OE_DCUTOFF,
});

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Beat interval for an eased proximity. Closer → faster. */
function intervalMs(p: number): number {
  const t = clamp01(p);
  return Math.round(
    CONFIG.GUIDE_PULSE_MAX_MS + (CONFIG.GUIDE_PULSE_MIN_MS - CONFIG.GUIDE_PULSE_MAX_MS) * t,
  );
}

// The freshness-decayed target: full proximity while recent, then a smooth glide
// to 0 once stale — so a dropped frame never causes a hard fast→slow snap.
function decayedLevel(): number {
  if (lastSeenAt <= 0) return 0;
  const ageMs = now() - lastSeenAt;
  if (ageMs <= CONFIG.GUIDE_FRESH_MS) return rawTarget;
  const over = ageMs - CONFIG.GUIDE_FRESH_MS;
  if (over >= CONFIG.GUIDE_DECAY_MS) return 0;
  return rawTarget * (1 - over / CONFIG.GUIDE_DECAY_MS);
}

// Steady clock: ease `smoothed` toward the decayed level with an FPS-independent
// time-constant. No haptics here — it only moves the number the beat reads.
function stepSmoothing(): void {
  if (!running) return;
  const t = now();
  const dt = Math.max(t - lastStepAt, 1);
  lastStepAt = t;
  const alpha = 1 - Math.exp(-dt / CONFIG.GUIDE_SMOOTH_TAU_MS);
  smoothed += (decayedLevel() - smoothed) * alpha;
}

// Cap how fast the beat can SLOW DOWN (the felt "decelerate" jerk — e.g. losing
// the target, or crossing into the searching tick). Speed-ups (acquiring,
// approaching) are unrestricted so homing stays responsive.
function slewClamp(targetInterval: number, prev: number): number {
  const d = CONFIG.GUIDE_MAX_INTERVAL_DELTA_MS;
  return targetInterval > prev + d ? prev + d : targetInterval;
}

// Beat: fire the actual pulse and reschedule. Reads `smoothed`, never mutates it.
function beat(): void {
  if (!running) return;
  const homing = smoothed > SEARCH_EPS;
  try {
    if (homing) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    else void Haptics.selectionAsync();
  } catch { /* haptics must never throw into the loop */ }
  const targetInterval = homing ? intervalMs(smoothed) : CONFIG.GUIDE_SEARCH_TICK_MS;
  const interval = slewClamp(targetInterval, prevInterval);
  prevInterval = interval;
  nextBeatAt = now() + interval;
  beatTimer = setTimeout(beat, interval);
}

/** Begin the loop. Starts in "searching" until updateGuide() reports a detection. */
export function startGuide(): void {
  if (running) return;
  running = true;
  rawTarget = 0;
  lastSeenAt = 0;
  smoothed = 0;
  prevInterval = CONFIG.GUIDE_SEARCH_TICK_MS;
  nextBeatAt = 0;
  lastStepAt = now();
  prox.reset();
  stepTimer = setInterval(stepSmoothing, CONFIG.GUIDE_STEP_MS);
  beat();
}

/**
 * Report how near/centered the target is this frame.
 * @param p 0..1 (1 = reached) or null when the target isn't detected this frame.
 *   null is a dropped frame: the last value rides the freshness/decay window
 *   rather than snapping to "searching".
 */
export function updateGuide(p: number | null): void {
  if (p === null) return;
  const t = now();
  // Re-seed the filter after a full loss so stale velocity doesn't kick the
  // re-acquired value around.
  if (lastSeenAt > 0 && t - lastSeenAt > CONFIG.GUIDE_FRESH_MS + CONFIG.GUIDE_DECAY_MS) {
    prox.reset();
  }
  rawTarget = clamp01(prox.filter(clamp01(p), t));
  lastSeenAt = t;
  // Snappy acquire: if the next beat is sitting far out on the slow searching
  // cadence and a target just appeared, pull it in (once) so homing engages
  // without a ~1.4s wait. Subsequent detections see it already near → no-op.
  if (running && beatTimer && nextBeatAt - t > CONFIG.GUIDE_PULSE_MAX_MS) {
    clearTimeout(beatTimer);
    prevInterval = CONFIG.GUIDE_PULSE_MAX_MS;
    nextBeatAt = t + CONFIG.GUIDE_PULSE_MAX_MS;
    beatTimer = setTimeout(beat, CONFIG.GUIDE_PULSE_MAX_MS);
  }
}

/** Stop the loop and clear state. */
export function stopGuide(): void {
  running = false;
  if (beatTimer) { clearTimeout(beatTimer); beatTimer = null; }
  if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
  rawTarget = 0;
  lastSeenAt = 0;
  smoothed = 0;
  prevInterval = CONFIG.GUIDE_SEARCH_TICK_MS;
  nextBeatAt = 0;
  prox.reset();
}

/** Test seam — leave the module clean between tests. */
export function _resetForTests(): void {
  stopGuide();
}

/** Test seam — observe the eased proximity and the last beat interval. */
export function _debugState(): { smoothed: number; interval: number } {
  return { smoothed, interval: prevInterval };
}
