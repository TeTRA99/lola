// feat/guide-me-to-it — proximity haptic loop ("Geiger counter").
//
// A single phone motor can't render a *felt* direction (see
// docs/design/directional-haptics-notes.md), but it renders a 1-D proximity
// signal well: the user pans the phone and the pulse RATE rises as the target
// nears frame-center, becoming a near-continuous buzz on lock. Rate — not
// amplitude — is the lever, because Android amplitude control is weak and
// Light impacts are imperceptible on Charly's Galaxy.
//
// Built on expo-haptics (already bundled) — NOT Pulsar — so it runs in the
// current dev client with no extra native dependency. Pulsar's
// useRealtimeComposer (smooth amplitude/frequency) is a later upgrade that
// would need a native rebuild.

import * as Haptics from 'expo-haptics';
import { CONFIG } from '@/config';

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
// null = searching (no target in frame); 0..1 = how centered the target is.
let proximity: number | null = null;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Tick interval for the current proximity. Closer → faster ticks. */
function intervalMs(p: number | null): number {
  if (p === null) return CONFIG.GUIDE_SEARCH_TICK_MS;
  const t = clamp01(p);
  return Math.round(
    CONFIG.GUIDE_PULSE_MAX_MS + (CONFIG.GUIDE_PULSE_MIN_MS - CONFIG.GUIDE_PULSE_MAX_MS) * t,
  );
}

function fireTick(p: number | null): void {
  try {
    if (p === null) {
      // Searching — soft + sparse so silence doesn't read as "app died".
      void Haptics.selectionAsync();
    } else if (p >= CONFIG.GUIDE_LOCK_PROXIMITY) {
      // Locked on — strongest tap, fired rapidly ≈ a sustained buzz.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      // Homing — Medium is the floor reliably felt on the Galaxy.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    /* haptics must never throw into the loop */
  }
}

function schedule(): void {
  if (!running) return;
  timer = setTimeout(() => {
    fireTick(proximity);
    schedule();
  }, intervalMs(proximity));
}

/** Begin the loop. Starts in "searching" until updateGuide() is called. */
export function startGuide(): void {
  if (running) return;
  running = true;
  proximity = null;
  schedule();
}

/**
 * Update how centered the target is.
 * @param p 0..1 (1 = dead-center / locked) or null when no target is detected.
 */
export function updateGuide(p: number | null): void {
  proximity = p === null ? null : clamp01(p);
}

/** Stop the loop and clear any pending tick. */
export function stopGuide(): void {
  running = false;
  if (timer) { clearTimeout(timer); timer = null; }
  proximity = null;
}

/** Test seam — leave the module clean between tests. */
export function _resetForTests(): void {
  stopGuide();
}
