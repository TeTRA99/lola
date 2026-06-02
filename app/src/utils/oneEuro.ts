// One Euro filter — adaptive low-pass for noisy interactive 1-D signals.
//
// The trick: the cutoff frequency rises with the signal's speed. When the value
// is near-still it filters hard (kills jitter); when it's moving fast it filters
// lightly (no lag). Perfect for a hand-aimed proximity signal: de-shimmer a
// resting target without adding drag while the user sweeps toward it.
//
// Reference: Casiez, Roussel & Vogel, "1€ Filter" (CHI 2012). Pure + injectable
// timestamps (pass now() in) so it's deterministic under fake timers.

export type OneEuroOptions = {
  minCutoff: number; // Hz — cutoff at zero speed (lower = smoother/laggier)
  beta: number;      // speed coefficient (higher = less lag when moving fast)
  dCutoff: number;   // Hz — cutoff for the derivative low-pass
};

export type OneEuroFilter = {
  /** Filter `value` sampled at `tMs` (ms). Returns the smoothed value. */
  filter(value: number, tMs: number): number;
  /** Forget history — next filter() call seeds fresh (e.g. after a long gap). */
  reset(): void;
};

const TWO_PI = 2 * Math.PI;

// Standard low-pass smoothing factor for a cutoff (Hz) over an interval (s).
function alpha(cutoffHz: number, dtSec: number): number {
  const tau = 1 / (TWO_PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

export function createOneEuro(opts: OneEuroOptions): OneEuroFilter {
  let hasPrev = false;
  let xPrev = 0;    // last filtered value
  let dxPrev = 0;   // last filtered derivative
  let tPrev = 0;    // last timestamp (ms)

  return {
    filter(value: number, tMs: number): number {
      if (!hasPrev) {
        hasPrev = true;
        xPrev = value;
        dxPrev = 0;
        tPrev = tMs;
        return value;
      }
      const dtSec = Math.max((tMs - tPrev) / 1000, 1e-3); // guard against 0/negative dt
      tPrev = tMs;

      // Filter the derivative, then derive a speed-adaptive cutoff for the value.
      const dx = (value - xPrev) / dtSec;
      const aD = alpha(opts.dCutoff, dtSec);
      dxPrev = dxPrev + aD * (dx - dxPrev);

      const cutoff = opts.minCutoff + opts.beta * Math.abs(dxPrev);
      const aX = alpha(cutoff, dtSec);
      xPrev = xPrev + aX * (value - xPrev);
      return xPrev;
    },
    reset(): void {
      hasPrev = false;
      xPrev = 0;
      dxPrev = 0;
      tPrev = 0;
    },
  };
}
