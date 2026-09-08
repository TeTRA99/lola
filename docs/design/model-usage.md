# Model & service usage — embedded vs. online

What runs **on-device** vs. what makes a **network call**, as of 2026-06-10.

| Purpose | Model / engine | Where |
|---|---|---|
| **Guide** ("guíame a X") — object detection | YOLO26n via `react-native-executorch` | 🟢 On-device |
| **Room ID** ("¿dónde estoy?") — image embeddings | CLIP ViT-B/32 INT8 via executorch | 🟢 On-device |
| **Describe / Ask** — scene description & visual Q&A | Gemini 2.5 Flash via **OpenRouter** | 🔵 Cloud |
| **Intent** (route the voice command) | Gemini 2.5 Flash-**Lite** (text) via OpenRouter | 🔵 Cloud |
| **Guide target resolution** (noun → COCO label) | Gemini 2.5 Flash-**Lite** (text) via OpenRouter | 🔵 Cloud |
| **Voice output (TTS)** | System TTS (`expo-speech`) | 🟢 On-device (OS) |
| **Speech input (STT)** | System speech recognition (`expo-speech-recognition`) | 🟢 On-device (OS service) |

`CONFIG.MODEL_ID = 'google/gemini-2.5-flash'` (cloud **vision**: Describe/Ask).
`MODEL_ID_CHEAP = 'gemini-2.5-flash-lite'` (cloud **text**: intent + guide-target
— moved 2026-06-10 after eval scorecards showed parity accuracy at ~40% lower
latency; see docs/design/evaluation.md). On-device models live behind
`@/adapters/embeddings` (CLIP) and `@/adapters/useGuideDetection` (YOLO26n),
both via executorch.

## What leaves the device
- **Describe / Ask** send the **photo** to OpenRouter/Gemini.
- **Intent** and **guide-target resolution** send only the **transcribed text**.
- The **guide feature itself (YOLO26n), room ID (CLIP), TTS, STT** are fully local —
  the camera frames for "guíame a X" never leave the phone.

## Path to fully on-device (goal)
Achievable in principle, in phases — the trend is strongly this way, but quality +
latency on the target device (**dad's Redmi Note 11**; the Galaxy A12 is only the
weaker test device) is the gating factor:

1. **Easy wins — text → small on-device LLM.** Intent classification and
   guide-target resolution are short text tasks a small LLM handles well.
   executorch already ships on-device LLMs (SmolLM, Llama 3.2, Qwen, etc.). Moving
   these off the cloud is low-risk and would make the **entire guide flow
   offline** (detection is already local; only the intent/target text hops out).
2. **The hard one — Describe/Ask needs an on-device VLM.** This is the core value
   of the app and currently a strong cloud model (Gemini 2.5 Flash). On-device
   vision-language models exist and are improving fast (Moondream, SmolVLM,
   Gemma 3n, FastVLM, Qwen2.5-VL-small), but matching cloud quality + acceptable
   latency on a low-end phone is the open question. Needs a feasibility spike like
   we did for YOLO26n — proven on the *actual* target device before committing.
   Better on a modern phone; marginal on the A12.

**Trade-offs of going fully local:** ✅ full privacy (photos never leave), offline,
zero API cost. ⚠️ lower description quality (vs Gemini), larger app (model
binaries), more CPU/battery, slower on weak hardware.

**Recommendation:** do (1) opportunistically (low risk, big privacy/offline win
for the guide flow); treat (2) as a deliberate R&D spike when targeting a capable
device or when on-device VLMs close the quality gap — re-evaluate periodically, the
space moves monthly. Keep everything behind the existing adapter seams
(`openrouter` gateway, `tts`, `stt`, executorch adapters) so swaps don't touch the
screens/services.

## On-device VLM candidates (researched 2026-05-29)
For moving Describe/Ask on-device. The space moves monthly — re-check before acting.

| Model | Sizes | Runtime | Mobile fit |
|---|---|---|---|
| **LFM2-VL / LFM2.5-VL** | **450M**, 1.6B (quantized) | **executorch — already in our 0.9.0** (`useLLM` + `LFM2_VL_450M_QUANTIZED` etc.) | 450M is the realistic A12 try; no rebuild |
| **Gemma 4** E2B / E4B | ~2B / ~4B effective (text+image, 140+ langs, QAT) | executorch export **in progress** (rn-executorch #1062); also LiteRT-LM | **QAT mobile: E2B ~1 GB RAM / ~1–3.2 GB disk** — plausible on the Redmi; E4B ~5 GB = flagship-only |
| Qwen3-VL | 2B / 4B (+MoE) | llama.cpp / others | current quality leader; 2B for mobile |
| SmolVLM2 | 256M / 500M / 2.2B | llama.cpp / transformers | tiniest; 256M/500M for weak phones |
| Moondream2 | 1.8B | llama.cpp | edge captioning/OCR/counting |
| MobileVLM V2 | 1.7B / 3B | mllm | purpose-built mobile (~21 tok/s Qualcomm CPU) |

**Cheapest next step:** A/B **LFM2-VL-450M (executorch)** vs Gemini for Describe —
same library, no rebuild, model downloads at runtime. Measure latency + quality.

### Update 2026-06-08 — Gemma 4 QAT + correct target device
- **Target device is dad's Redmi Note 11** (Snapdragon 680, 4–6 GB RAM), NOT the
  Galaxy A12 (that's Charly's weaker *test* device). Earlier notes wrongly treated
  the A12 as the floor and so under-scoped on-device models. Design for the Redmi.
- **Gemma 4 QAT shipped 2026-06-05.** vs our current LFM2.5-VL: E2B has *more*
  capability (2B effective, 140+ langs, QAT ≈ near-original quality — should finally
  name a *mate*) at **similar-or-less footprint than our 1.6B** (≈1 GB RAM mobile-QAT
  vs ~3 GB; smaller download than the 1.6B's 2.3 GB). It's a **replacement for the
  1.6B tier, not the 450M tier** — heavier than the 450M (so the 450M stays the
  fallback for the weakest device). On the Redmi, **RAM is fine; the only gate is CPU
  latency** (no flagship NPU) — but Describe/Ask is tap-and-wait, so a few seconds is
  acceptable. Likely the on-device default for dad *if* it lands in executorch.
- ⏰ **REMINDER — check periodically:** Gemma 4 isn't in `react-native-executorch`
  yet (LiteRT/llama.cpp only). Watch **rn-executorch issue #1062 "Gemma4 support"**
  and its releases; ExecuTorch core E2B/E4B export is in progress (PLE memory
  offload). When the `.pte` ships, drop E2B into the `visionLLM` adapter (loads
  LFM2.5-VL the same way) and **measure Describe latency on the Redmi Note 11** — that
  number decides whether it becomes the on-device default. Confirm fast/non-thinking
  mode works in executorch first (a hybrid-thinking model already errored once).

Sources: Google "Gemma 4 QAT" (2026-06-05), rn-executorch #1062, executorch gemma3
example, LFM2.5-VL-450M specs (Liquid AI).

## Full-embed build — candidate stack for the Redmi Note 11 (researched 2026-09-08)

"Full embed" = **zero OpenRouter calls**. Today the cloud carries four things:
Describe/Ask (VLM), intent, guide-target, and the open-vocab grounding spike.
STT and TTS are **already on-device** (OS services). So the gap is entirely
LLM/VLM-shaped, plus open-vocab detection.

**The wall is RAM, not compute.** Dad's phone is the **4 GB variant: 3.7 GB total**
(read over adb; Android 13 / MIUI 14, SD680 / SM6225, arm64). A foreground app on a
4 GB MIUI phone realistically gets ~1.5–2.2 GB before the low-memory killer acts.
Everything below is sized against that, using the real `.pte` sizes in the
react-native-executorch **0.10.0** Hugging Face repos and SWM's published peaks.

### What does NOT fit (be explicit, stop re-litigating)
| Model | Why not |
|---|---|
| **Gemma 4 E2B** (`gemma_4_e2b_xnnpack_8da4w` **2.6 GB**, Vulkan 2.57 GB) | File alone is ~70% of total RAM. SWM's export has a 2048-token context and PR #1162 reports TTFT growing across turns; no memory numbers published. PLE layers are claimed mmap-only after the first token — unmeasured. Expect an LMK kill; **measure once** with the dev build (the `'gemma4'` option exists) and move on. |
| LFM2.5-VL **1.6B** (2.4 GB) / **3B** (~3 GB, not in registry) | Same wall. 3B is the quality leader on paper (RefCOCO 87.9) — irrelevant here. |
| **Llama 3.2 1B** (current `textLLM` default) | SWM reports **3.3 GB peak** on a OnePlus 12. Drop it for the Redmi. |
| Qwen3-VL 2B+, Moondream 3 (2B), Qwen3 1.7B/4B | 1.3–2.7 GB files; no. |
| **Whisper small** (1.1 GB fp32 XNNPACK) | Spanish WER 9.7 — usable — but est. 10+ s per utterance on SD680 (S24: tiny decode 28 ms/token; small ≈5× that; SD680 ≈3–4× slower than S24). Tiny/base are fast but **Spanish WER 27.7 / 18.4** — unusable for commands. |
| Kokoro (es voices) **next to** a VLM | 272+59 MB files, **820 MB peak**; can't co-reside with the VLM. Only viable serialized through the residency coordinator, i.e. seconds of swap per utterance. Not worth it over OS TTS. |

### What fits — the v1 full-embed stack
| Slot | Pick | Size / peak | Notes |
|---|---|---|---|
| **Describe / Ask** | **LFM2.5-VL-450M** `8da4w` (already wired, `'450m'`) | 649 MB file; peak unpublished, est. ~1 GB | The only VLM that fits. Known blind spot: names a mate "una taza". **Fix it with specialists, not a bigger generalist** — see composition below. |
| **Intent + guide-target** | **The same resident VLM, text-only** | 0 extra | Removes the VLM↔text swap penalty that `llmResidency` exists to serialize. Needs an on-device eval (port the 35 intent + 23 guide cases to a Debug-screen panel like Room-ID). Fallback if it fails eval: **LFM2.5-350M `8da4w` (278 MB)** or Qwen3-0.6B `8da4w` (506 MB) — both cost a swap. |
| **Guide detection** | **YOLO26n** (keep) | 10 MB / 44 MB peak; 38 ms on Pixel 10 → est. 150–250 ms on SD680 (4–6 fps) | Unchanged. RF-DETR nano (112 MB fp32) is heavier for no gain on this CPU. |
| **Open-vocab guide (replaces the cloud spike)** | **YOLOE-26n with a folded household vocabulary** — SPIKE | 3.9M params ≈ YOLO26n speed | `set_classes([...])` bakes ~50–200 English prompts (mate gourd, thermos, glasses, keys, remote control, pill organizer, wallet, cane…) into a static detector; map to Spanish labels in-app. `useObjectDetection` already accepts a custom `.pte` + labels. **Risk:** YOLOE is not in Ultralytics' documented ExecuTorch export list (YOLO26 is, FP32-only) — the folded model is a plain detect graph, so it *should* export; 1–2 day spike to find out. Covers tier-2/3 targets offline with a fixed vocabulary; the cloud spike stays for truly arbitrary nouns. |
| **Personal objects** ("*tu* mate" vs "una taza") | **CLIP crop-matching against the catalog** (already have CLIP + reference photos) | 352 MB image encoder, load on demand | Detector crop → CLIP embedding → nearest catalog item. Cheap, fully local, and it's what the 450M VLM can't do. |
| **OCR** ("leeme lo que dice ahí") | **PP-OCRv6 small `int8`** — NEW | **24 MB**; charset has ñ á é í ó ú ü Ñ ¿ (not ¡) | In the 0.10 registry. Medication labels, bills, packaging — high value for a low-vision user, near-zero cost. Today this goes to the cloud VLM. |
| **STT** | OS recognizer (offline Spanish pack) — keep | 0 | Only if Google's service becomes unacceptable: Whisper-small **Vulkan int8 (508 MB)** is the sole candidate, untested on Adreno 610. |
| **TTS** | OS voice — keep | 0 | Piper `es_AR-daniela-high` (63 MB, 1.8 s TTFA measured on the A12) remains the neural option per on-device-tts-notes.md. Kokoro `ef_dora`/`em_alex` exist in the registry for a future device. |
| **Room ID** | CLIP ViT-B/32 (keep) | 352 MB fp32 | MobileCLIP2-S0 is ~5× faster / 3× smaller but needs a custom export; not a pain point. |

**Composition is the design idea.** On a 3.7 GB phone, capability comes from
several small specialists feeding one small generalist: YOLO/YOLOE facts ("mate,
mesa"), CLIP identity ("*tu* mate"), OCR text, room ID → prompt the 450M VLM (or a
template) to phrase it. That turns "una taza" into "Veo tu mate sobre la mesa"
without a model that can't fit.

**Rough resident budget:** RN + camera ~350 MB · YOLO26n 44 MB · VLM-450M ~1 GB ·
OCR 24 MB · CLIP 350 MB **on demand only** → ~1.5–1.9 GB. Feasible **only** with the
existing one-model-at-a-time residency; never two LLM-class graphs.

### Measure with the SDK-57 dev build (in this order)
1. `MemAvailable` on the Redmi at rest and with Lola in the foreground.
2. LFM2.5-VL-450M: peak RSS + Describe latency (tap → first word).
3. Gemma 4 E2B: one attempt; record where it dies.
4. YOLO26n fps in the guide loop; then the 450M **Vulkan** variant to learn whether
   Adreno 610 + ExecuTorch Vulkan works at all (SWM's FAQ: op coverage limited,
   often slower than XNNPACK).
5. OCR: PP-OCRv6 on a medication box under kitchen light.

### Still not in the registry (watch)
LFM2.5-VL-3B, Gemma 4 QAT, YOLOE, MobileCLIP2, Parakeet (no Spanish anyway).
Sources: SWM HF repos (`v0.10.0` tags), SWM 0.9.x benchmark pages, Ultralytics
ExecuTorch + YOLOE docs, Whisper CV13 Spanish WER table, rn-executorch PR #1162.
