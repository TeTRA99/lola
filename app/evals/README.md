# Lola evals — model-output quality scorecards

Live evaluations of the cloud-LLM outputs (intent routing, guide-target
resolution, Describe narration) so a model swap can be judged with numbers
instead of vibes. Full design: `docs/design/evaluation.md`.

**These suites call OpenRouter for real and cost money.** Gating, in layers:

1. `npm test` runs only the `unit` Jest project — eval files never load.
2. Even `jest --selectProjects evals` is inert: every suite is `describe.skip`
   unless `RUN_EVALS=1` (the npm `eval:*` scripts set it).
3. The describe judge (the priciest part) additionally needs `EVAL_JUDGE=1`.

## Running

```sh
cd app
npm run eval:intent       # ~33 text-only cases — fractions of a cent
npm run eval:guide        # ~23 text-only cases — fractions of a cent
npm run eval:describe     # 1 VLM call per photo; add EVAL_JUDGE=1 for grading
npm run eval              # all suites

MODEL=google/gemini-2.5-flash-lite npm run eval        # score a candidate model
EVAL_JUDGE=1 npm run eval:describe                     # paid grounding pass
```

Each run writes a scorecard JSON to `evals/results/` (gitignored), named
`<suite>__<model>__<gitSha>__<timestamp>.json`.

## Comparing two models

```sh
npm run eval:intent                                    # baseline (config model)
MODEL=<candidate-id> npm run eval:intent               # candidate
npm run eval:compare evals/results/<baseline>.json evals/results/<candidate>.json
```

`compare.mjs` prints summary deltas and the per-case flips (pass→fail =
regression; exits 2 when any case regressed). Compare like with like: same
suite, same dataset, and for describe the same judge model.

## Knobs (set as env vars)

| Var | Default | Meaning |
| --- | --- | --- |
| `RUN_EVALS` | unset | Master switch — nothing runs without `1`. |
| `MODEL` | per-suite production model | OpenRouter id of the model under test. Defaults to what production uses for that call site: intent/guide → `CONFIG.MODEL_ID_CHEAP`, describe → `CONFIG.MODEL_ID`. |
| `EVAL_JUDGE` | unset | `1` enables the LLM-as-judge pass on describe. |
| `JUDGE_MODEL` | `google/gemini-2.5-pro` | Grading model. Keep PINNED — scorecards graded by different judges are not comparable. |

## Adding cases

- **intent** — `datasets/intent/cases.json`. Keep both kinds: `*-anchor-*`
  (taken from the prompt's own examples — a floor; failing one means something
  is badly wrong) and `*-novel-*` (paraphrases NOT in the prompt — the real
  generalization signal). `context` injects a "recent narration" block;
  `catalog`/`contacts` feed the saved-objects/contacts blocks.
- **guide** — `datasets/guide/cases.json`. Three tiers: exact COCO match,
  `approximate: true` proxies (termo→bottle), and `cocoLabel: null` for
  un-guidable things (the dangerous direction is the model inventing labels
  for these — watch `nullRecall` in the scorecard).
- **describe** — drop photos in `datasets/describe/images/` and label them in
  `manifest.json` (see `manifest.example.json`). Use real shots from the
  apartment: counters, low light, clutter. `mustMention`/`mustNotMention` are
  accent-insensitive substring stems ("taza" matches "una taza azul").
  15–25 photos is plenty to start.

## How the harness works (and its one trap)

Eval suites import the REAL services (`classifyIntent`, `resolveGuideTarget`,
gateway `chat`) so the scored thing is the shipping prompt + request building +
output guarding. That works because they run under the `jest-expo` preset:
`__mocks__/react-native-executorch.js` satisfies the on-device-LLM import chain
and the storage/SnapshotCache seams are stubbed per suite, while the default
`inferenceMode` resolves to `cloud` → real `fetch`. If an adapter ever starts
doing native work at module-import time (today they're all lazy singletons),
the eval imports will break — keep imports side-effect-free.

The voseo tuteo ban list is shared: `scorers/voseo.ts` is the single source of
truth, imported by both the static copy test and these evals.

Latency numbers include the gateway's retry/timeout budget (that's what dad
feels) — compare them between models on the same network, don't read them as
an SLA.
