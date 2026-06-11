// Scores classifyIntent() output against a labeled expectation, and accumulates
// the cross-intent confusion matrix — the key "did the new model start confusing
// guide vs memory" signal for a model swap.

import type { RouteDecision } from '@/services/UtteranceRouter';

export type ExpectedIntent = {
  type: RouteDecision['type'];
  /** memory/guide noun (compared lowercase, trimmed, plural-folded). */
  object?: string;
  savedObject?: string | null;
  needsCurrent?: boolean;
  /** chitchat kind. */
  kind?: string;
  contactName?: string | null;
  /** Use instead of contactName when several outcomes are behaviorally
   *  identical (e.g. single saved contact: null and that name call the same
   *  person — see resolveContact). */
  contactNameAnyOf?: Array<string | null>;
  channel?: 'call' | 'whatsapp';
  /** call_family: true when a dictated WhatsApp body must be present. */
  hasMessage?: boolean;
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

// The intent prompt asks for nouns "en singular", but models are inconsistent
// on plural-only-ish nouns (anteojos→anteojo, llaves→llaves) — both forms work
// downstream, so noun scoring folds simple Spanish plurals.
const singular = (s: string) => {
  const n = norm(s);
  if (n.length > 4 && n.endsWith('es')) return n.slice(0, -2);
  if (n.length > 3 && n.endsWith('s')) return n.slice(0, -1);
  return n;
};
const nounMatch = (a: string | null | undefined, b: string | null | undefined) =>
  norm(a) === norm(b) || singular(a ?? '') === singular(b ?? '');

export function scoreIntent(
  actual: RouteDecision,
  expected: ExpectedIntent,
): { pass: boolean; intentMatch: boolean; fieldMatches: Record<string, boolean> } {
  const intentMatch = actual.type === expected.type;
  const fieldMatches: Record<string, boolean> = {};

  if (intentMatch) {
    if (expected.object !== undefined && 'object' in actual) {
      fieldMatches.object = nounMatch(actual.object, expected.object);
    }
    if (expected.savedObject !== undefined && 'savedObject' in actual) {
      fieldMatches.savedObject = norm(actual.savedObject) === norm(expected.savedObject);
    }
    if (expected.needsCurrent !== undefined && actual.type === 'model') {
      fieldMatches.needsCurrent = (actual.needsCurrent === true) === expected.needsCurrent;
    }
    if (expected.kind !== undefined && actual.type === 'chitchat') {
      fieldMatches.kind = actual.kind === expected.kind;
    }
    if (expected.contactName !== undefined && actual.type === 'call_family') {
      fieldMatches.contactName = norm(actual.contactName) === norm(expected.contactName);
    }
    if (expected.contactNameAnyOf !== undefined && actual.type === 'call_family') {
      fieldMatches.contactName = expected.contactNameAnyOf.some(v =>
        v === null ? actual.contactName === null : norm(actual.contactName) === norm(v),
      );
    }
    if (expected.channel !== undefined && actual.type === 'call_family') {
      fieldMatches.channel = actual.channel === expected.channel;
    }
    if (expected.hasMessage !== undefined && actual.type === 'call_family') {
      fieldMatches.hasMessage = (actual.message !== null) === expected.hasMessage;
    }
  }

  return {
    pass: intentMatch && Object.values(fieldMatches).every(Boolean),
    intentMatch,
    fieldMatches,
  };
}

export class ConfusionMatrix {
  private m: Record<string, Record<string, number>> = {};
  private total = 0;
  private correct = 0;

  add(expected: string, predicted: string): void {
    (this.m[expected] ??= {})[predicted] = (this.m[expected][predicted] ?? 0) + 1;
    this.total++;
    if (expected === predicted) this.correct++;
  }

  accuracy(): number {
    return this.total === 0 ? 0 : this.correct / this.total;
  }

  toJSON(): Record<string, Record<string, number>> {
    return this.m;
  }

  /** Plain-text matrix (rows = expected, cols = predicted) for the jest console. */
  toTable(): string {
    const labels = [...new Set([
      ...Object.keys(this.m),
      ...Object.values(this.m).flatMap(r => Object.keys(r)),
    ])].sort();
    const w = Math.max(12, ...labels.map(l => l.length)) + 1;
    const pad = (s: string) => s.padEnd(w);
    const header = pad('exp\\pred') + labels.map(pad).join('');
    const rows = labels.map(exp =>
      pad(exp) + labels.map(pred => pad(String(this.m[exp]?.[pred] ?? ''))).join(''),
    );
    return [header, ...rows].join('\n');
  }
}
