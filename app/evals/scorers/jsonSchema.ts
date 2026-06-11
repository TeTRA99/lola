// Output-contract checks the gateway does NOT already enforce.
//
// Shape validation itself lives in gateways/openrouter.chat() — a non-ok Result
// with 'parse_fail' IS the schema failure and eval files count it as such. What
// the gateway can't know is the PROMPT contract: narration ≤25 words (AD-4) and
// the must-mention/must-not-mention expectations of a labeled scene.

import type { LolaResponse } from '@/gateways/openrouter';

export function scoreDescribeSchema(r: LolaResponse): {
  pass: boolean;
  wordCount: number;
  over25: boolean;
} {
  const wordCount = r.narration.trim().split(/\s+/).filter(Boolean).length;
  const over25 = wordCount > 25;
  return { pass: !over25, wordCount, over25 };
}

/** Accent/case-insensitive haystack for mention checks. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Deterministic grounding floor (cheaper than the judge): every mustMention term
 * appears somewhere in narration+objects; no mustNotMention term does. Terms are
 * matched as folded substrings, so label with stems ("tasa de café" → "taza").
 */
export function scoreMentions(
  r: LolaResponse,
  mustMention: string[] = [],
  mustNotMention: string[] = [],
): { pass: boolean; missing: string[]; forbidden: string[] } {
  const haystack = fold(
    [r.narration, ...r.objects.flatMap(o => [o.canonical, o.display])].join(' '),
  );
  const missing = mustMention.filter(t => !haystack.includes(fold(t)));
  const forbidden = mustNotMention.filter(t => haystack.includes(fold(t)));
  return { pass: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}
