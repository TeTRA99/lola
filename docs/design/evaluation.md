# Evaluation — model-output quality scorecards

**Why.** Lola is headed for daily use by one low-vision user, and the quality of
what she *says* depends on swappable models (cloud Gemini via OpenRouter today;
on-device candidates keep improving). Before this, a model swap was judged by
vibes. The eval harness produces a per-run **scorecard** (model id + git sha +
timestamp) so two models can be diffed case by case — change models with
numbers, not anecdotes.

**What it deliberately is NOT.** The on-device math (Geiger proximity, haptic
smoothing, One Euro, COCO-label guard) was already unit-tested; physical-haptic
integration tests (Espresso/XCTest) are overkill for a solo project. The gap was
*model outputs* — that's all this measures.

## The three suites (`app/evals/`, run via Jest "evals" project)

| Suite | What runs (REAL code path) | Scorers | Cost |
| --- | --- | --- | --- |
| `intent.eval.ts` | `classifyIntent()` — real prompt + output guarding | intent exact-match per field, cross-intent confusion matrix, voseo on dictated WhatsApp bodies, latency | ~33 text calls, <1¢ |
| `guide.eval.ts` | `resolveGuideTarget()` — real prompt + COCO guard | label accuracy, exact/approx tier, null precision/recall (un-guidable must abstain), voseo on `spoken`, latency | ~23 text calls, <1¢ |
| `describe.eval.ts` | gateway `chat()` + `buildSystemPrompt()` (the Describe cloud path) | voseo, ≤25-word contract, mustMention/mustNotMention, optional LLM-as-judge grounding | 1 VLM call/photo; judge doubles it |

Mechanics, gating layers, env knobs (`MODEL`, `EVAL_JUDGE`, `JUDGE_MODEL`) and
how to add cases: **`app/evals/README.md`**. Scorecards land in
`app/evals/results/` (gitignored); diff with `npm run eval:compare a.json b.json`.

### Design decisions worth remembering

- **Jest project, not Node scripts.** `classifyIntent`/`resolveGuideTarget`
  import the ModelRouter seam → `react-native-executorch` + `expo-sqlite`, which
  only resolve under the jest-expo preset's mocks. Running under Jest means the
  evals exercise the *shipping* prompts/request-building/parsing with zero
  duplication. Trade-off: the preset's Expo "winter" runtime stubs global
  `fetch`, so `evals/runner/realFetch.ts` (node:https) is swapped in via a
  `beforeAll` (`setupAfterEnv.ts`).
- **Model under test is parametric.** `chat()` always took `input.model`;
  `classifyIntent`/`resolveGuideTarget` grew an optional trailing `model` param
  (app code never passes it). `MODEL=<id> npm run eval` scores a candidate
  without touching config.
- **Judge is pinned** (`google/gemini-2.5-pro`, separate from the subject so it
  isn't grading itself). Judge scores are a *trend* signal — same-model reruns
  set the noise floor; only deltas beyond that are real. Never change the judge
  between two scorecards you intend to compare.
- **Anchor vs novel cases.** Anchors are lifted from the prompts' own worked
  examples (a floor — failing one = something's badly wrong); novel paraphrases
  are the generalization signal. First live run caught gemini-2.5-flash
  returning null for "el sillón" — an anchor *in its own prompt*.
- **Voseo single source of truth:** `evals/scorers/voseo.ts` exports
  `TUTEO_PATTERNS`; the static copy test imports it, so static copy and live
  model output are held to the same ban list (FR-6.5).

## Room-ID eval (on-device, Debug screen — Phase 3)

CLIP room identification can't run in Jest (real executorch + device). The
Debug screen has a **"Room-ID eval (CLIP)"** panel (mirrors the trace-panel
pattern, copyable report):

- **Leave-one-out** over the registered catalog photos — instant and free
  (reuses stored embeddings), same best-similarity + `SIMILARITY_THRESHOLD`
  (0.55) rule as `identifyRoom()`. Catalog photos are same-session, so accuracy
  is optimistic — read it for *cross-room confusion*, not headline accuracy.
- **Holdout** — photos bundled via `src/eval/roomEvalAssets.ts` (drop files in
  `assets/eval/rooms/`) run through the full `identifyRoom()` pipeline including
  CLIP inference. `expected: null` photos must abstain — the
  "unknown-room abstain rate" line must read 1.00.

Pure scoring/formatting lives in `src/services/roomEvalCore.ts` (unit-tested);
orchestration in `src/services/RoomEval.ts`.

## Baseline (2026-06-10, sha 32b2292) and the first decision it drove

- intent / flash: **33/33**, p50 ≈ 1.4s (re-run on grown dataset: 34/35 — the
  miss was a labeling artifact, "anteojos"→"anteojo" singular per the prompt;
  the scorer now folds plurals).
- intent / flash-lite: intent-type accuracy **1.0**, p50 ≈ 0.9s. One contract
  quirk: with a SINGLE saved contact, "necesito ayuda" names that contact
  instead of null — behaviorally identical (resolveContact(null) → emergency ??
  contacts[0]); with MULTIPLE contacts (where a guess would misroute) it
  correctly returns null. Scored via `contactNameAnyOf`.
- guide / flash: **22/23** (flaked on anchor "el sillón"), null recall 1.0,
  p50 ≈ 1.3s.
- guide / flash-lite: **23/23**, p50 ≈ 0.7s. One borderline: "la compu" was
  sometimes tiered `approximate` — fixed in the PROMPT (added "compu"/"celu" to
  the GUIDABLE_ES hints), 23/23 twice after.
- describe: pending the labeled photo set (manifest is scaffolded).

**Decision (2026-06-10): text-only call sites moved to flash-lite.**
`IntentRouter` + `GuideTargets` now default to `CONFIG.MODEL_ID_CHEAP` — parity
accuracy, ~40–50% lower latency on every voice interaction, ~10× cheaper.
Vision (Describe/Ask) stays on `CONFIG.MODEL_ID` (flash) until the describe
photo set exists to verify a vision swap. The eval suites default to each call
site's production model (`subjectModel()` in the harness), so a plain
`npm run eval` always scores what ships.

## When to run

- Before swapping `CONFIG.MODEL_ID` (or the on-device default): baseline +
  candidate + compare. A regressed case list is the go/no-go.
- After editing any prompt (`prompts/lola.ts`, `INTENT_SYSTEM_PROMPT`,
  `buildResolvePrompt`): same-model before/after run.
- Room-ID panel: after registering/re-photographing rooms, or before changing
  `SIMILARITY_THRESHOLD` / the embedding model.
