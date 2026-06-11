// Shared gating + model selection for eval suites.
//
// Gating (defense in depth, so evals only cost money on demand):
//   1. `npm test` selects the `unit` project — eval files never load.
//   2. Even `jest --selectProjects evals` is inert without RUN_EVALS=1:
//      every suite uses `evalDescribe`, which is describe.skip without the flag.
//
// Model selection:
//   MODEL=<openrouter-id>  — the model under test. Defaults to what PRODUCTION
//     uses for that suite (vision → CONFIG.MODEL_ID; text classification →
//     CONFIG.MODEL_ID_CHEAP) via subjectModel(); set MODEL to score a candidate
//     without touching config.ts.
//   JUDGE_MODEL=<id>       — the LLM-as-judge for describe grounding. PINNED to a
//     default that must NOT silently follow the subject model: two scorecards are
//     only comparable when the same judge graded both.
//   EVAL_JUDGE=1           — opt-in to the paid judge pass (describe suite). Off
//     by default so describe can iterate on deterministic scorers for free-ish.

export const RUN_EVALS = process.env.RUN_EVALS === '1';

export const evalDescribe: jest.Describe = RUN_EVALS ? describe : describe.skip;

/**
 * Model under test for a suite. Pass the model that PRODUCTION uses for that
 * call site so a default `npm run eval` scores what actually ships; MODEL=<id>
 * overrides it to score a candidate.
 */
export function subjectModel(productionDefault: string): string {
  return process.env.MODEL || productionDefault;
}

/** Grading model for describe. Keep pinned; change deliberately, never per-run. */
export const JUDGE_MODEL: string = process.env.JUDGE_MODEL || 'google/gemini-2.5-pro';

export const JUDGE_ENABLED = process.env.EVAL_JUDGE === '1';
