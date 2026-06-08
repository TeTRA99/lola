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
- **Two Android devices — don't conflate them.** The PRIORITY/target device is
  **dad's Redmi Note 11** (Snapdragon 680, 4–6 GB RAM, mid-range) — design product
  decisions (e.g. which on-device model) for *that*. **Charly's test device is a
  Galaxy A12** (Helio P35/Exynos 850, 3–4 GB) — a weaker, conservative lower bound
  for "does it run at all," NOT dad's phone, so it shouldn't cap what the Redmi can
  handle. Android is the priority platform. Weak-haptics note (observed on the
  Galaxy): Light impact is imperceptible, use **Medium+**; iOS-only Core Haptics
  niceties won't show on Android.

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
- `docs/design/` — feature/design notes (TTS, directional-haptics, guide-me-to-it,
  model-usage, home-and-onboarding).
- **Home / settings / onboarding:** see `docs/design/home-and-onboarding.md`. Home
  is the "cards" layout; **Setup opens by long-pressing the Home gear** (a plain tap
  shows a hint) or the OS app-icon shortcut, and **Setup "Done" returns to Home**.
  **Debug** is reached from a dev-only 🐞 icon on Home (`__DEV__`); there is no
  splash gesture. First-run onboarding = welcome overlay + per-feature voice hints +
  a caregiver intro popup (reset from the Debug screen).
- **Model usage / privacy:** see `docs/design/model-usage.md`. On-device: YOLO26n
  (guide), CLIP (room ID), TTS, STT. Cloud (OpenRouter → Gemini 2.5 Flash):
  Describe/Ask (sends the photo), intent + guide-target resolution (text only).
- `docs/runbooks/` — dev-build-and-run, eas-secrets, android-sideload, testflight,
  **ios-local-build-and-install** (sign + install onto Charly's iPhone from this Mac:
  ~2-min Hermes JS-only cycle + the full native build, device id, free-provisioning).
- Decisions & rationale that aren't in code live in the per-session memory
  (`MEMORY.md` index).

## Current status
The "guide me to it" feature + the Home redesign and first-run onboarding are
**merged to `main`** (2026-06-01; app `version` 0.10.0). Integrate further work off
`main`. See docs/design/guide-me-to-it-notes.md (scope = common-objects v1 /
YOLO26n+COCO via executorch; camera = VisionCamera v5; haptics = proximity "Geiger"
loop; "guíame a X" has 3-tier target resolution — exact / approx-proxy / unsupported)
and docs/design/home-and-onboarding.md.
