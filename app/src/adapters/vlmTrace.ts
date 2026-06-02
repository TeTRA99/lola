// Charly-only diagnostics. In-memory ring buffer of the most recent on-device
// VLM (Describe/Ask) outputs: the RAW model text and the cleaned narration we
// actually speak. Surfaced + copyable on the Debug screen so we can fix the
// prompt / tightenNarration against what the 450M model truly emits, instead of
// guessing. Not persisted (no PII at rest).

export type VlmTrace = { at: number; raw: string; narration: string };

const MAX = 8;
const traces: VlmTrace[] = [];

export function recordVlmTrace(t: VlmTrace): void {
  traces.unshift(t);
  if (traces.length > MAX) traces.length = MAX;
}

export function getVlmTraces(): VlmTrace[] {
  return traces.slice();
}
