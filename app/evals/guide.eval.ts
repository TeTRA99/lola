// LIVE eval: guide-target resolution through the REAL resolveGuideTarget()
// pipeline (real prompt, real COCO-label guard) against OpenRouter. Text-only →
// fractions of a cent per run. Gated by RUN_EVALS=1.
//
// Run:  npm run eval:guide             (model under test = CONFIG.MODEL_ID)
//       MODEL=<id> npm run eval:guide  (candidate model)

// Settings (via ModelRouter) falls back to defaults when the DB is unavailable.
jest.mock('@/adapters/storage', () => ({
  getDb: jest.fn(async () => {
    throw new Error('evals run without a database');
  }),
}));

import { resolveGuideTarget } from '@/services/GuideTargets';
import { CONFIG } from '@/config';
import { evalDescribe, subjectModel } from './runner/harness';
import { writeScorecard, type CaseResult } from './runner/report';
import { scoreGuide, nullStats, type ExpectedGuide } from './scorers/guideMatch';
import { scoreVoseo } from './scorers/voseo';
import { timed, percentiles } from './scorers/latency';
import rawCases from './datasets/guide/cases.json';

type GuideCase = { id: string; noun: string; expect: ExpectedGuide };

const cases = rawCases as GuideCase[];

// Production runs guide-target resolution on the cheap model (GuideTargets).
const SUBJECT_MODEL = subjectModel(CONFIG.MODEL_ID_CHEAP);

evalDescribe(`guide-target resolution — live (${SUBJECT_MODEL})`, () => {
  const results: CaseResult[] = [];
  const nullRows: Array<{ expectedNull: boolean; actualNull: boolean }> = [];

  afterAll(() => {
    if (results.length === 0) return;
    const passed = results.filter(r => r.pass).length;
    writeScorecard(
      'guide',
      SUBJECT_MODEL,
      {
        n: results.length,
        passRate: passed / results.length,
        labelAccuracy:
          results.filter(r => (r.scores as { labelMatch: boolean }).labelMatch).length /
          results.length,
        tierAccuracy:
          results.filter(r => (r.scores as { tierMatch: boolean }).tierMatch).length /
          results.length,
        ...nullStats(nullRows),
        latencyMs: percentiles(results.map(r => r.latencyMs)),
      },
      results,
    );
  });

  for (const c of cases) {
    test(`${c.id}: "${c.noun}" → ${c.expect.cocoLabel ?? 'null'}`, async () => {
      const { value: target, ms } = await timed(() => resolveGuideTarget(c.noun, SUBJECT_MODEL));
      const score = scoreGuide(target, c.expect);
      // `spoken` is read aloud to dad — keep it voseo-clean too.
      const voseo = target?.spoken ? scoreVoseo(target.spoken) : null;
      const pass = score.pass && (voseo?.pass ?? true);
      results.push({ id: c.id, pass, scores: { ...score, voseo }, latencyMs: ms, raw: target });
      nullRows.push({ expectedNull: c.expect.cocoLabel === null, actualNull: target === null });

      if (c.expect.cocoLabel === null) {
        expect(target).toBeNull();
      } else {
        expect(target?.cocoLabel).toBe(c.expect.cocoLabel);
        expect(target?.approximate === true).toBe(c.expect.approximate === true);
      }
      if (voseo) expect(voseo.hits).toEqual([]);
    });
  }
});
