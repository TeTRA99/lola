# V2 — Gemini 2.5 Flash latency on 20 dad-home photos

Target: ≤2s button-to-audio (NFR-1) at p50; ≤4s at p95. Below target across platforms triggers escalation (model swap to `gemini-2.5-flash-lite`, or batching/streaming via OpenRouter).

## Method

20 representative photos from dad's home:
- 5 kitchen (mate jar, pava, tea boxes, mate gourd, sink)
- 5 living room (TV, sofa, magazines, lamp, his radio)
- 5 bathroom + bedroom (toothbrush, meds, towels, bed, dresser)
- 5 mixed lighting / occlusion edge cases

Method per photo:
1. Open Lola dev client
2. Hold phone over the scene
3. Tap Describe
4. Stopwatch from tap → first TTS audio
5. Record + classify the narration as ✅ correct / ⚠️ vague / ❌ wrong

## Results

| # | Scene | Latency (ms) | Narration | Pass |
|---|---|---|---|---|
| 1 | _(fill in)_ | _ms_ | _(transcribe)_ | _(✅/⚠️/❌)_ |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
| 14 | | | | |
| 15 | | | | |
| 16 | | | | |
| 17 | | | | |
| 18 | | | | |
| 19 | | | | |
| 20 | | | | |

## Summary

- p50 latency: _ms_
- p95 latency: _ms_
- Pass rate (✅): _/20_
- Pass + acceptable (✅ or ⚠️): _/20_

## Decision

- [ ] PASS — keep `gemini-2.5-flash` for v0.9
- [ ] FAIL (latency) — switch default to `gemini-2.5-flash-lite` (config flag already exists; one-line change in `app/src/config.ts`)
- [ ] FAIL (accuracy) — investigate prompt + image-resize policy; consider `gemini-3.5-flash` for v1.0 despite cost
