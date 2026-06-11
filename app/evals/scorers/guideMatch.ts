// Scores resolveGuideTarget() output: COCO label, exact-vs-approx tier, and the
// correct-null cases (un-guidable things like "el lápiz" MUST return null — a
// model that invents labels for them would walk dad toward the wrong object).

import type { GuideTarget } from '@/services/GuideTargets';

export type ExpectedGuide = {
  /** Expected COCO label, or null when the thing isn't guidable. */
  cocoLabel: string | null;
  /** True when the label is only a physical proxy ("termo" → bottle). */
  approximate?: boolean;
};

export function scoreGuide(
  actual: GuideTarget | null,
  expected: ExpectedGuide,
): { pass: boolean; labelMatch: boolean; tierMatch: boolean } {
  if (expected.cocoLabel === null) {
    const pass = actual === null;
    return { pass, labelMatch: pass, tierMatch: pass };
  }
  const labelMatch = actual?.cocoLabel === expected.cocoLabel;
  const tierMatch =
    actual !== null && (actual.approximate === true) === (expected.approximate === true);
  return { pass: labelMatch && tierMatch, labelMatch, tierMatch };
}

/**
 * Null-handling stats across a run. "null" here = the model abstained.
 *   precision: of the times it abstained, how often was abstaining right.
 *   recall:    of the cases that REQUIRED abstaining, how often it did.
 * Low recall is the dangerous direction (hallucinated labels for un-guidable things).
 */
export function nullStats(
  rows: Array<{ expectedNull: boolean; actualNull: boolean }>,
): { nullPrecision: number | null; nullRecall: number | null } {
  const predicted = rows.filter(r => r.actualNull);
  const actualNullExpected = rows.filter(r => r.expectedNull);
  return {
    nullPrecision: predicted.length
      ? predicted.filter(r => r.expectedNull).length / predicted.length
      : null,
    nullRecall: actualNullExpected.length
      ? actualNullExpected.filter(r => r.actualNull).length / actualNullExpected.length
      : null,
  };
}
