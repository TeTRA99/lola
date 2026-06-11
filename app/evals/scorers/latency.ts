// Wall-clock timing around live model calls. Includes the gateway's retry/
// timeout budget — that's what ships, so it's the latency dad actually feels.
// Treat numbers as relative-between-models on the same network, not an SLA.

export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

export function percentiles(samples: number[]): { p50: number; p95: number; max: number } {
  if (samples.length === 0) return { p50: 0, p95: 0, max: 0 };
  const s = [...samples].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { p50: at(0.5), p95: at(0.95), max: s[s.length - 1] };
}
