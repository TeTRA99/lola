import { createOneEuro } from '@/utils/oneEuro';

describe('createOneEuro', () => {
  it('returns the first sample unchanged (seeds from it)', () => {
    const f = createOneEuro({ minCutoff: 1, beta: 0.7, dCutoff: 1 });
    expect(f.filter(0.5, 0)).toBe(0.5);
  });

  it('damps a noisy near-still signal toward its mean', () => {
    const f = createOneEuro({ minCutoff: 1, beta: 0, dCutoff: 1 });
    f.filter(0.5, 0);
    let t = 0;
    let out = 0;
    for (let i = 1; i <= 30; i++) {
      t += 100;
      out = f.filter(i % 2 ? 0.6 : 0.4, t); // ±0.1 jitter around 0.5
    }
    // Output sits near the mean, with smaller deviation than the ±0.1 input.
    expect(out).toBeGreaterThan(0.45);
    expect(out).toBeLessThan(0.55);
  });

  it('tracks a fast ramp with less lag at higher beta', () => {
    const slow = createOneEuro({ minCutoff: 1, beta: 0, dCutoff: 1 });
    const fast = createOneEuro({ minCutoff: 1, beta: 3, dCutoff: 1 });
    slow.filter(0, 0);
    fast.filter(0, 0);
    let t = 0;
    let s = 0;
    let fst = 0;
    for (let i = 1; i <= 10; i++) {
      t += 50;
      s = slow.filter(i / 10, t); // ramp 0 → 1
      fst = fast.filter(i / 10, t);
    }
    expect(fst).toBeGreaterThan(s); // higher beta → closer to the latest value
    expect(fst).toBeLessThanOrEqual(1);
  });

  it('reset() forgets history', () => {
    const f = createOneEuro({ minCutoff: 1, beta: 0.7, dCutoff: 1 });
    f.filter(0.2, 0);
    f.filter(0.2, 100);
    f.reset();
    expect(f.filter(0.9, 200)).toBe(0.9); // first sample after reset returns as-is
  });
});
