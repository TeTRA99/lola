// Charly-only diagnostics for the cloud "guide me to it" spike. In-memory ring
// buffer of the most recent cloud grounding polls: the query, model, raw box,
// confidence, round-trip latency, and any error. Surfaced on the Debug screen so
// we can see what each model actually returns (and how slow) when judging whether
// cloud guide is usable on small objects. Not persisted (no PII at rest).

export type GuideTrace = {
  at: number;
  query: string;
  model: string;
  found: boolean;
  box: number[] | null;
  confidence: number;
  latencyMs: number;
  error: string | null;
  /** Truncated raw model text — shown when a box wasn't parsed (diagnose misses). */
  raw?: string;
  /** Short landmark phrase the model reported ("al lado del termo"), or null. */
  near?: string | null;
};

const MAX = 16;
const traces: GuideTrace[] = [];

export function recordGuideTrace(t: GuideTrace): void {
  traces.unshift(t);
  if (traces.length > MAX) traces.length = MAX;
}

export function getGuideTraces(): GuideTrace[] {
  return traces.slice();
}
