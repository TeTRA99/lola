# Model & service usage — embedded vs. online

What runs **on-device** vs. what makes a **network call**, as of 2026-05-29.

| Purpose | Model / engine | Where |
|---|---|---|
| **Guide** ("guíame a X") — object detection | YOLO26n via `react-native-executorch` | 🟢 On-device |
| **Room ID** ("¿dónde estoy?") — image embeddings | CLIP ViT-B/32 INT8 via executorch | 🟢 On-device |
| **Describe / Ask** — scene description & visual Q&A | Gemini 2.5 Flash via **OpenRouter** | 🔵 Cloud |
| **Intent** (route the voice command) | Gemini 2.5 Flash (text) via OpenRouter | 🔵 Cloud |
| **Guide target resolution** (noun → COCO label) | Gemini 2.5 Flash (text) via OpenRouter | 🔵 Cloud |
| **Voice output (TTS)** | System TTS (`expo-speech`) | 🟢 On-device (OS) |
| **Speech input (STT)** | System speech recognition (`expo-speech-recognition`) | 🟢 On-device (OS service) |

`CONFIG.MODEL_ID = 'google/gemini-2.5-flash'` (cloud text+vision). `MODEL_ID_CHEAP`
= `gemini-2.5-flash-lite`. On-device models live behind `@/adapters/embeddings`
(CLIP) and `@/adapters/useGuideDetection` (YOLO26n), both via executorch.

## What leaves the device
- **Describe / Ask** send the **photo** to OpenRouter/Gemini.
- **Intent** and **guide-target resolution** send only the **transcribed text**.
- The **guide feature itself (YOLO26n), room ID (CLIP), TTS, STT** are fully local —
  the camera frames for "guíame a X" never leave the phone.

## Path to fully on-device (goal)
Achievable in principle, in phases — the trend is strongly this way, but quality
on low-end hardware (the Galaxy A12) is the gating factor:

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
