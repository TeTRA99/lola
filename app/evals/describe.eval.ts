// LIVE eval: Describe narration quality over a labeled photo set, through the
// REAL gateway chat() + the REAL system prompt (the exact path DescribeService
// uses for cloud inference, minus camera/TTS). Gated by RUN_EVALS=1.
//
// Cost: one subject VLM call per photo; EVAL_JUDGE=1 adds one judge call per
// photo (the paid grounding/hallucination pass — see scorers/judge.ts).
//
// Dataset intake: drop home photos into evals/datasets/describe/images/ and
// label them in manifest.json (see manifest.example.json). Without entries this
// suite reports "no cases" and does nothing.
//
// Run:  npm run eval:describe
//       MODEL=<id> EVAL_JUDGE=1 npm run eval:describe

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chat } from '@/gateways/openrouter';
import { buildSystemPrompt } from '@/prompts/lola';
import { CONFIG } from '@/config';
import { evalDescribe, subjectModel, JUDGE_MODEL, JUDGE_ENABLED } from './runner/harness';
import { writeScorecard, type CaseResult } from './runner/report';
import { scoreVoseo } from './scorers/voseo';
import { scoreDescribeSchema, scoreMentions } from './scorers/jsonSchema';
import { judgeGrounding, type JudgeVerdict } from './scorers/judge';
import { timed, percentiles } from './scorers/latency';
import rawManifest from './datasets/describe/manifest.json';

type DescribeCase = {
  id: string;
  /** Path relative to datasets/describe/, e.g. "images/kitchen-01.jpg". */
  image: string;
  expect: { mustMention?: string[]; mustNotMention?: string[] };
  notes?: string;
};

const cases = rawManifest as DescribeCase[];
const DATASET_DIR = join(__dirname, 'datasets', 'describe');

// Same ChatInput DescribeService builds for the no-known-room cloud path
// (src/services/DescribeService.ts) — keep in sync so the eval tests what ships.
const SYSTEM_PROMPT = buildSystemPrompt(null);
const USER_TEXT = 'Describe esta escena.';

// Production vision (Describe/Ask) runs on the full flash model.
const SUBJECT_MODEL = subjectModel(CONFIG.MODEL_ID);

evalDescribe(`describe narration — live (${SUBJECT_MODEL}${JUDGE_ENABLED ? `, judge ${JUDGE_MODEL}` : ', no judge'})`, () => {
  const results: CaseResult[] = [];
  const verdicts: JudgeVerdict[] = [];

  afterAll(() => {
    if (results.length === 0) return;
    const judged = verdicts.length;
    writeScorecard(
      'describe',
      SUBJECT_MODEL,
      {
        n: results.length,
        passRate: results.filter(r => r.pass).length / results.length,
        latencyMs: percentiles(results.map(r => r.latencyMs)),
        ...(JUDGE_ENABLED
          ? {
              judged,
              judgeAvgScore: judged
                ? verdicts.reduce((s, v) => s + v.score, 0) / judged
                : null,
              hallucinationRate: judged
                ? verdicts.filter(v => v.hallucinated.length > 0).length / judged
                : null,
            }
          : {}),
      },
      results,
      JUDGE_ENABLED ? JUDGE_MODEL : undefined,
    );
  });

  if (cases.length === 0) {
    test('manifest has no cases yet', () => {
      console.warn(
        '[evals] describe: manifest.json is empty — add labeled photos under ' +
          'evals/datasets/describe/ (see manifest.example.json and evals/README.md)',
      );
    });
    return;
  }

  for (const c of cases) {
    test(`${c.id} (${c.image})`, async () => {
      const imageBase64 = readFileSync(join(DATASET_DIR, c.image)).toString('base64');
      const { value: resp, ms } = await timed(() =>
        chat({ systemPrompt: SYSTEM_PROMPT, userText: USER_TEXT, imageBase64, model: SUBJECT_MODEL }),
      );

      if (!resp.ok) {
        // Gateway-level failure (parse_fail = the model broke the JSON contract).
        results.push({ id: c.id, pass: false, scores: { gatewayError: resp.error }, latencyMs: ms });
        expect(resp).toEqual(expect.objectContaining({ ok: true }));
        return;
      }

      const voseo = scoreVoseo(resp.value.narration);
      const schema = scoreDescribeSchema(resp.value);
      const mentions = scoreMentions(
        resp.value,
        c.expect.mustMention ?? [],
        c.expect.mustNotMention ?? [],
      );
      const verdict = JUDGE_ENABLED
        ? await judgeGrounding({
            imageBase64,
            narration: resp.value.narration,
            objects: resp.value.objects,
            judgeModel: JUDGE_MODEL,
          })
        : null;
      if (verdict) verdicts.push(verdict);

      // The judge is a recorded trend signal, not a pass/fail gate (it's noisy).
      const pass = voseo.pass && schema.pass && mentions.pass;
      results.push({
        id: c.id,
        pass,
        scores: { voseo, schema, mentions, judge: verdict },
        latencyMs: ms,
        raw: resp.value,
      });

      expect(voseo.hits).toEqual([]);
      expect(schema.over25).toBe(false);
      expect(mentions.missing).toEqual([]);
      expect(mentions.forbidden).toEqual([]);
    });
  }
});
