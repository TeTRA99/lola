// LIVE eval: intent classification through the REAL classifyIntent() pipeline
// (real prompt, real request building, real output guarding) against OpenRouter.
// Text-only → fractions of a cent per run. Gated by RUN_EVALS=1.
//
// Run:  npm run eval:intent            (model under test = CONFIG.MODEL_ID)
//       MODEL=<id> npm run eval:intent (candidate model)

// Narrow seams only — everything between classifyIntent() and fetch() stays real.
// storage: Settings catches the rejection and falls back to defaults (cloud mode).
// SnapshotCache: lets a case inject "recent context" narration for needsCurrent.
let mockContextNarration: string | null = null;
jest.mock('@/adapters/storage', () => ({
  getDb: jest.fn(async () => {
    throw new Error('evals run without a database');
  }),
}));
jest.mock('@/services/SnapshotCache', () => ({
  getLatest: () =>
    mockContextNarration
      ? { uri: 'eval://context', sizeBytes: 0, savedAt: 0, narration: mockContextNarration }
      : null,
}));

import { classifyIntent } from '@/services/IntentRouter';
import { CONFIG } from '@/config';
import { evalDescribe, subjectModel } from './runner/harness';
import { writeScorecard, type CaseResult } from './runner/report';
import { scoreIntent, ConfusionMatrix, type ExpectedIntent } from './scorers/intentMatch';
import { scoreVoseo } from './scorers/voseo';
import { timed, percentiles } from './scorers/latency';
import rawCases from './datasets/intent/cases.json';

type IntentCase = {
  id: string;
  utterance: string;
  /** Injected as the "recent narration" context block. */
  context?: string;
  /** Saved-object display names ([OBJETOS GUARDADOS]). */
  catalog?: string[];
  /** Saved contact names ([CONTACTOS GUARDADOS]). */
  contacts?: string[];
  expect: ExpectedIntent;
};

const cases = rawCases as IntentCase[];

// Production runs intent classification on the cheap model (IntentRouter).
const SUBJECT_MODEL = subjectModel(CONFIG.MODEL_ID_CHEAP);

evalDescribe(`intent classification — live (${SUBJECT_MODEL})`, () => {
  const results: CaseResult[] = [];
  const confusion = new ConfusionMatrix();

  afterAll(() => {
    if (results.length === 0) return;
    const latencies = results.map(r => r.latencyMs);
    writeScorecard(
      'intent',
      SUBJECT_MODEL,
      {
        n: results.length,
        accuracy: confusion.accuracy(),
        passRate: results.filter(r => r.pass).length / results.length,
        latencyMs: percentiles(latencies),
        confusion: confusion.toJSON(),
      },
      results,
    );
    console.log(`\n[evals] intent confusion (rows=expected, cols=predicted):\n${confusion.toTable()}`);
  });

  for (const c of cases) {
    test(`${c.id}: "${c.utterance}"`, async () => {
      mockContextNarration = c.context ?? null;
      const { value: decision, ms } = await timed(() =>
        classifyIntent(c.utterance, c.catalog ?? [], c.contacts ?? [], SUBJECT_MODEL),
      );
      const score = scoreIntent(decision, c.expect);
      // Dictated WhatsApp bodies are dad-facing Spanish the MODEL writes — they
      // must be voseo too, not just the static copy.
      const message = decision.type === 'call_family' ? decision.message : null;
      const voseo = message ? scoreVoseo(message) : null;
      const pass = score.pass && (voseo?.pass ?? true);
      results.push({
        id: c.id,
        pass,
        scores: { ...score, voseo },
        latencyMs: ms,
        raw: decision,
      });
      confusion.add(c.expect.type, decision.type);

      expect(decision.type).toBe(c.expect.type);
      expect(score.fieldMatches).toEqual(
        Object.fromEntries(Object.keys(score.fieldMatches).map(k => [k, true])),
      );
      if (voseo) expect(voseo.hits).toEqual([]);
    });
  }
});
