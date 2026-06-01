# On-device TTS — investigation notes & future recipe

**Status (2026-05-29):** Shipping the **system TTS voice** (`expo-speech`) with
caregiver-tunable **speed + pitch** sliders (Settings). On-device neural TTS was
prototyped and proven feasible but **deferred** — keep this doc so we can pick it
back up quickly, since this space moves fast.

## Why we deferred on-device TTS (for now)
- The chosen Piper voice (`es_MX-claude-high`) sounded only *okay* subjectively.
- On-device adds real cost: APK grew **~155 MB → ~380 MB** (sherpa-onnx ships
  native libs for every ABI), a **~7 s** one-time model load, and **~1.8 s**
  time-to-first-audio per response on the low-end Galaxy A12.
- The app is **already online** for every Describe/Ask (cloud vision model), so
  going on-device for *voice only* doesn't buy offline capability we rely on.
- System voice + speed/pitch tuning was "good enough" and ships with zero extra
  size/latency.

## Options compared
| Option | Quality | Latency | Offline | Cost | Size | Notes |
|---|---|---|---|---|---|---|
| **System (`expo-speech`)** ✅ shipping | low | instant | ✅ | free | 0 | One locked voice on the A12; tunable rate/pitch only |
| **Cloud — ElevenLabs Flash / OpenAI tts** | best | ~75–300 ms + net | ❌ | ~$0.015–0.30 / 1k chars | 0 | Quality ceiling; app already online, so viable; per-line privacy trade-off |
| **Piper (VITS) on-device** ⭐ prototyped | good | ~1.8 s warm | ✅ | free | ~63 MB model | Safe on A12; has `es_AR-daniela-high` + `es_MX-claude-high` |
| **Supertonic v3 on-device** | higher | unproven on A12 | ✅ | free | ~404 MB | 99M params; riskier on budget CPU; 31 langs; no confirmed es_AR |
| Kokoro-82M on-device | higher | heavier | ✅ | free | ~300 MB | Quality-over-speed; likely too heavy for A12 |

## Piper feasibility — MEASURED on the Galaxy A12 (SM-A127M)
Proven working. Numbers from the on-device benchmark:
- **Library:** [`react-native-sherpa-onnx`](https://github.com/XDcobra/react-native-sherpa-onnx) `@0.4.3` (+ peer `@dr.pogodin/react-native-fs`). **Linked cleanly on RN 0.85 / Expo SDK 56** (New Arch / TurboModule). No Expo config plugin needed — it **autolinks** via prebuild. (Config plugin is only for the optional background download manager.)
- **Engine load (one-time per launch):** ~7 s. → Mitigate by **pre-warming on boot** and keeping a **single warm engine** (never destroy).
- **Generation (warm):** ~1.8 s time-to-first-audio for a short line; use **streaming** (`generateSpeechStream` + built-in PCM player) so long narrations start speaking at ~1.8 s and continue as they generate.
- **APK impact:** +~120 MB (all ABIs). **Trim to `arm64-v8a` only** to cut most of that (the A12 and modern phones are arm64).

## Integration recipe (to re-enable)
1. `npm i react-native-sherpa-onnx @dr.pogodin/react-native-fs`; rebuild (native).
2. Models = sherpa-onnx prepackaged Piper tarballs from GitHub releases
   `k2-fsa/sherpa-onnx` tag **`tts-models`**, e.g.
   `vits-piper-es_MX-claude-high.tar.bz2` / `vits-piper-es_AR-daniela-high.tar.bz2`
   (each ~64 MB: `*.onnx`, `*.onnx.json`, `tokens.txt`, `espeak-ng-data/`).
3. **Download on first run** (keeps APK lean + voice swappable without a rebuild),
   showing a non-blocking "Descargando voz…" indicator on the splash, and
   **fall back to system TTS until the model is cached**. The library has
   `download` + `extraction` modules (handles the tar), or use `expo-file-system`.
4. API: `createStreamingTTS({ modelPath: { type:'file', path }, modelType:'vits' })`
   → `startPcmPlayer(sr, 1)` → `generateSpeechStream(text, undefined, { onChunk: c => writePcmChunk(c.samples), onEnd: stopPcmPlayer, onError })`.
5. **Pre-warm** the engine at app boot; keep it warm for the session; serialize
   calls (rapid taps stacking inits inflated load times in the benchmark).
6. Same library also supports **Supertonic / Kokoro / Matcha / Kitten** model
   types via `modelType` — easy to A/B a different model later.

## Where the prototype code lived
Removed from `main` after the decision, but recoverable from git history:
- `app/src/adapters/ttsPiper.ts` (streaming adapter + benchmark harness)
- Dev A/B buttons in `SetupScreen` Settings (`🧪 Test Piper …`)
- Commits around the feasibility build (search log for "Piper").

## If/when we revisit
- **Best voice, least effort:** cloud (ElevenLabs Flash or OpenAI `gpt-4o-mini-tts`)
  behind the existing `speak()` seam — trivial for a single online user.
- **Offline/private/zero-cost:** Piper via the recipe above (re-evaluate Supertonic
  if A12-class perf has improved or we target better phones).
- The whole voice layer sits behind `adapters/tts.ts → speak()`, so swapping the
  engine never touches the screens/services.
