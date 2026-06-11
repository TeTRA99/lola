// Voseo = Argentine "vos" form. Tuteo = "tú" form. Banning the unambiguous
// tuteo verb conjugations (tienes/puedes/quieres/eres) + the "tú" pronoun.
// Deliberately not banning `\bte\b` — it's a valid voseo object pronoun ("te dejo").
//
// SINGLE SOURCE OF TRUTH for the ban list (FR-6.5): the static copy check
// (src/services/__tests__/copy.voseo.test.ts) and the live model-output evals
// both import TUTEO_PATTERNS from here.

export const TUTEO_PATTERNS: readonly RegExp[] = [
  /\btú\b/i,
  /\btienes\b/i,
  /\bpuedes\b/i,
  /\bquieres\b/i,
  /\beres\b/i,
];

/** Scores a model-produced Spanish string. pass=false on any tuteo hit. */
export function scoreVoseo(text: string): { pass: boolean; hits: string[] } {
  const hits: string[] = [];
  for (const pat of TUTEO_PATTERNS) {
    const m = text.match(pat);
    if (m) hits.push(m[0]);
  }
  return { pass: hits.length === 0, hits };
}
