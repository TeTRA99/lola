// LLM-as-judge grounding check for Describe narrations. A stronger, PINNED
// vision model (runner/harness.JUDGE_MODEL) sees the same photo plus the
// narration and reports hallucinations / omissions. Judge scores are noisy —
// treat them as a trend across scorecards, not a hard pass/fail gate; two runs
// of the same subject model set the variance floor for a "real" regression.

import { chatJson, type LolaObject } from '@/gateways/openrouter';

export type JudgeVerdict = {
  /** 0..1 grounding quality; hallucinations weigh heavier than omissions. */
  score: number;
  /** Things the narration claims that are not clearly visible. */
  hallucinated: string[];
  /** Salient visible objects the narration omitted. */
  missed: string[];
  rationale: string;
};

const JUDGE_SYSTEM_PROMPT = `You are a strict grader for a vision-assistance app used by a person with very low vision. You receive a photo and the Spanish narration the app produced for it. The user cannot verify anything visually — an object the narration claims that is not actually there could make them reach for or trust something that doesn't exist.

Grade ONLY visual grounding, not style or grammar:
1. "hallucinated": objects or attributes the narration claims that are NOT clearly visible in the photo.
2. "missed": salient, useful objects clearly visible in the photo that the narration omits. The narration is capped at ~25 words, so only count obvious, important omissions — not minor background items.
3. "score": 0.0–1.0 overall. 1.0 = everything claimed is visible and nothing important is missing. Subtract heavily for hallucinations (they are more dangerous than omissions).

Respond ONLY with JSON:
{ "score": 0.0, "hallucinated": ["..."], "missed": ["..."], "rationale": "<one short sentence>" }`;

export async function judgeGrounding(args: {
  imageBase64: string;
  narration: string;
  objects: LolaObject[];
  judgeModel: string;
}): Promise<JudgeVerdict | null> {
  const objectList = args.objects.map(o => o.display).join(', ') || '(none)';
  const resp = await chatJson<Partial<JudgeVerdict>>({
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userText: `Narration: "${args.narration}"\nObjects the app extracted: ${objectList}`,
    imageBase64: args.imageBase64,
    model: args.judgeModel,
  });
  if (!resp.ok || typeof resp.value.score !== 'number') return null;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  return {
    score: Math.min(1, Math.max(0, resp.value.score)),
    hallucinated: strings(resp.value.hallucinated),
    missed: strings(resp.value.missed),
    rationale: typeof resp.value.rationale === 'string' ? resp.value.rationale : '',
  };
}
