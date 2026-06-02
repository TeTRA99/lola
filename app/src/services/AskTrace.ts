// Charly-only diagnostics. An in-memory ring buffer of the most recent Ask
// flows — what STT heard and how the intent router classified it — surfaced on
// the Debug screen. Not persisted (no PII at rest); it exists to answer "did
// iOS mis-hear me, or did the model mis-route a clean transcript?" when a
// question lands on the wrong intent (e.g. "encontrá mi termómetro" → chitchat).

export type AskTrace = {
  at: number;
  /** Raw STT transcript, or null when STT itself failed. */
  utterance: string | null;
  /** How it routed: e.g. "guide:termómetro", "chitchat:other", "model", or "STT_FAIL:no_speech". */
  route: string;
};

const MAX = 12;
const traces: AskTrace[] = [];

export function recordAskTrace(t: AskTrace): void {
  traces.unshift(t);
  if (traces.length > MAX) traces.length = MAX;
}

export function getAskTraces(): AskTrace[] {
  return traces.slice();
}
