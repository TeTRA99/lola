# Runbook — evaluating a model swap

Goal: decide "can I switch Lola to model X?" with scorecards instead of vibes.
Design + rationale: `docs/design/evaluation.md`. Harness details:
`app/evals/README.md`.

## 0. Prereqs

- `app/.env.local` has `EXPO_PUBLIC_OPENROUTER_API_KEY` (it does for dev).
- Stable network (latency numbers include the gateway retry budget).
- Everything below runs from `app/`.

## 1. Baseline the current model

```sh
npm run eval            # intent + guide + describe, scorecards → evals/results/
```

(Or per-suite: `npm run eval:intent` / `eval:guide` / `eval:describe`.)

## 2. Score the candidate

```sh
MODEL=google/gemini-2.5-flash-lite npm run eval
```

## 3. Compare

```sh
npm run eval:compare evals/results/<baseline>.json evals/results/<candidate>.json
```

One compare per suite (files are per-suite). Read, in order:

1. **regressed (pass→fail)** — each one is a concrete utterance/photo that got
   worse; the raw model output is printed. This is the go/no-go list.
2. **accuracy / passRate / null-recall deltas** — guide `nullRecall` dropping
   means the candidate invents labels for un-guidable objects (dangerous).
3. **latency p50/p95** — what dad feels per request.

Exit code 2 = at least one regression.

## 4. Describe with the judge (paid, optional)

```sh
EVAL_JUDGE=1 npm run eval:describe
EVAL_JUDGE=1 MODEL=<candidate> npm run eval:describe
```

Needs labeled photos in `evals/datasets/describe/` (see
`manifest.example.json`). Judge is pinned to `google/gemini-2.5-pro` — don't
change it between runs you compare. Re-run the same model twice once to learn
the judge's noise floor.

## 5. Room-ID (on-device, free)

Dev build → Home 🐞 → **Room-ID eval (CLIP)** → Run → Copy. Leave-one-out works
with whatever rooms are registered; for honest accuracy add holdout shots via
`src/eval/roomEvalAssets.ts` (instructions inside).

## Cost notes (~$30/mo budget, NFR-2a)

intent+guide ≈ <1¢/run. describe = 1 flash call/photo, judge adds 1 pro
call/photo (~$0.10–0.40 for 20 photos). Hundreds of full runs fit in budget;
the spend gate is `RUN_EVALS=1`, which only the `eval:*` scripts set.

## Troubleshooting

- All cases fail instantly with ~0ms latency → real fetch got clobbered again;
  see `evals/runner/setupAfterEnv.ts` (the beforeAll must win) or auth (key
  missing → `evals/runner/setup.ts` warning in output).
- `npm test` started hitting the network → someone moved eval files under
  `src/` or changed `jest.config.js` project `testMatch`; unit must never load
  `*.eval.ts`.
