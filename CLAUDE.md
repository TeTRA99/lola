# Lola — project guide for Claude (auto-loaded each session)

Lola is an assistive-vision app (Spanish, voseo) for a low-vision user — Charly's
father. Solo project. This file captures the non-obvious environment/build/
convention knowledge so sessions don't rediscover it. Keep it short; link out for
depth.

## Layout & stack
- **The app lives in `app/`** — `package.json`, `npm` (`package-lock.json`), and all
  source are there, NOT the repo root. `cd app` before npm/expo/eas commands.
- Expo **SDK 56**, React Native **0.85.3**, **New Architecture on**, TypeScript.
- Vision = cloud LLM via **OpenRouter** (`google/gemini-2.5-flash`); on-device
  **CLIP** (room ID) via `react-native-executorch`. Key from `.env.local`
  (`EXPO_PUBLIC_OPENROUTER_API_KEY`) for local dev.
- **Git is local-only — there is no remote.** "Push" = commit locally. Branch off
  the current feature branch; PRs/remote don't exist unless one is added.

## Build & run (see docs/runbooks/dev-build-and-run.md for the full walkthrough)
- **Dev client is built on EAS, not locally** — this machine has no Android NDK/
  CMake and no `ANDROID_HOME`. To get a dev build onto a device:
  `cd app && npx eas-cli@latest build --profile development --platform android`
  then `npx expo start --dev-client`. JS hot-reloads over Metro; only a new
  **native dependency** requires another EAS build.
- **iOS local build is broken by an RN-0.85 bug** (`React-Core-prebuilt` pod
  "Missing required attribute source"). Workaround: build RN from source via
  `RCT_USE_PREBUILT_RNCORE=0 npx expo run:ios`.
- Charly's test device is an **Android Galaxy** — it's the priority platform, and
  the floor for "does it actually work" (weak haptics: Light impact is
  imperceptible, use **Medium+**; iOS-only Core Haptics niceties won't show there).

## Verify before claiming done
From `app/`: `npx tsc --noEmit` · `npx jest` · `npx eslint src`. All three are
fast and expected to pass.

## Conventions
- **User-facing Spanish strings must live in `src/services/CopyModule.ts`** (voseo,
  enforced by an ESLint rule, FR-6.5). Inline Spanish = lint warning.
- **Charly-only/dev screens are English** (DebugScreen, the guide spike) — that
  sidesteps the i18n rule and signals "not for the end user."
- Navigation is a plain `screen` state machine in `src/app.tsx` (no
  react-navigation); one screen renders at a time.
- Result type (`@/utils/result`) for fallible adapters; adapters in `src/adapters`,
  orchestration in `src/services`.

## Where things are documented
- `docs/design/` — feature/design notes (TTS, directional-haptics, guide-me-to-it, model-usage).
- **Model usage / privacy:** see `docs/design/model-usage.md`. On-device: YOLO26n
  (guide), CLIP (room ID), TTS, STT. Cloud (OpenRouter → Gemini 2.5 Flash):
  Describe/Ask (sends the photo), intent + guide-target resolution (text only).
- `docs/runbooks/` — dev-build-and-run, eas-secrets, android-sideload, testflight.
- Decisions & rationale that aren't in code live in the per-session memory
  (`MEMORY.md` index).

## Current branch focus
`feat/guide-me-to-it` — "guide me to it" live homing feature. See
docs/design/guide-me-to-it-notes.md (scope = common-objects v1 / YOLO26n+COCO via
executorch; camera = VisionCamera v5; haptics = proximity "Geiger" loop).
