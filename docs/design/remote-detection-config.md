# Remote detection-config table (future work)

Status: **proposed / not built.** Captured 2026-06-01 during iOS detector tuning.

## Motivation

The Guide's on-device object detector is tuned by a "Detection quality" level
(1=Minimum … 5=Maximum) that maps to a concrete `(model, inputSize)` preset. That
table currently lives in code — `app/src/adapters/detectionPresets.ts` — plus the
per-platform defaults (iOS=Maximum, Android=Minimum).

Baking it into the build means **every retune needs an app release**. We want to:

- Adjust the level→preset mapping (e.g. iOS "Maximum" = m@512 → m@640, or bump a
  level) without shipping a build.
- Swap in **newer models** as react-native-executorch / Ultralytics publish them
  (a new `.pte` is just a URL — see below).
- Fine-tune **per-platform / per-device** defaults as we learn what runs well
  (e.g. a capable Android flagship could default higher than the A12 floor).
- Roll changes out gradually / A-B without app-store latency.

## Design

A **versioned JSON table**, fetched at app start, with the build's embedded copy
as the always-available default and fallback.

### Table schema (illustrative)

```jsonc
{
  "version": 3,                         // monotonic; only adopt if > current
  "minAppVersion": "0.11.0",            // optional: ignore table if app is older
  "defaults": { "ios": 5, "android": 1 },
  "levels": {
    "1": { "model": "yolo26n", "inputSize": 384 },
    "2": { "model": "yolo26s", "inputSize": 384 },
    "3": { "model": "yolo26s", "inputSize": 512 },
    "4": { "model": "yolo26m", "inputSize": 384 },
    "5": { "model": "yolo26m", "inputSize": 512 }
    // future: { "modelSource": "https://…/yolo27_s.pte", "labelMap": "coco", "inputSize": 512 }
  }
}
```

Built-in models reference the executorch registry by name (`yolo26s` →
`models.object_detection.yolo26s()`). To ship a model **not** in the registry, the
entry carries a `modelSource` URL + a label-map id and we load it via
`ObjectDetectionModule.fromCustomModel(...)`. Supporting `modelSource` is what
unlocks true OTA model updates (the `.pte` is already downloaded-on-demand from a
URL today — HuggingFace — so a new URL "just works" once the loader supports it).

### Resolution order (always safe)

1. **Embedded default** (shipped in the build = today's `detectionPresets` values
   + a `version`). Guarantees the app works offline / on first run.
2. **Cached remote table** (last good download), if its `version` > embedded and it
   passed validation.
3. App start kicks a **best-effort, non-blocking** fetch of the remote table; if
   `version` is newer + schema-valid + `minAppVersion` satisfied → persist & adopt
   for next resolve. Never blocks Guide or launch.

Validate every remote payload against a strict schema (zod or hand-rolled) and
reject malformed/partial tables — a bad table must never break detection. Add a
remote `"enabled": false` / kill-switch field so we can force-fallback to embedded.

### Where to persist locally

Reuse what's already here: the `settings` SQLite table (a single
`detection_config_json` row) or a JSON file via `expo-file-system`. SQLite is
simplest given Settings already wraps it.

## Tooling options to host the table (the "where do the values live online" question)

| Option | Native dep? | UI / targeting | Cost | Notes |
|--------|-------------|----------------|------|-------|
| **Static JSON on a CDN** (GitHub raw / Releases, Cloudflare R2/Pages, S3+CloudFront, Firebase Hosting) | No | No (edit = commit/upload) | Free–cheap | **Recommended v1.** Dead simple, no backend, no SDK. Just `fetch(url)` + ETag/version. |
| **ConfigCat / Statsig** (remote-config SaaS) | Usually pure-JS SDK (no rebuild) | Yes (console, %-rollout, platform rules) | Free tier | Good if we want a dashboard + gradual rollout without a backend. |
| **Firebase Remote Config** | **Yes** (Firebase SDK → native rebuild) | Yes (console, conditions per platform/version) | Free tier | Purpose-built for exactly this, but pulls in Firebase + a native dep. |
| **Tiny serverless endpoint** (Cloudflare Workers / Vercel) | No | Custom | Free tier | Only if we want server-side logic (device-aware tiers, auth). Overkill for a static table. |

Given this is a solo project with **no backend** and a table that changes rarely,
**v1 = a static versioned JSON on GitHub/CDN**: zero native deps, free, trivial to
update (commit the file). Graduate to ConfigCat/Statsig if we later want a console
+ staged rollout; Firebase RC only if we accept the native dependency.

This composes cleanly with the existing stack — the app already makes cloud calls
(OpenRouter) and already downloads model `.pte`s from remote URLs, so neither the
network dependency nor remote model hosting is new ground.

## Effort estimate

| Piece | Est. |
|-------|------|
| Schema + embedded default table + version field | ~0.5 d |
| RemoteConfig service: fetch + validate + cache + version-compare + fallback | ~1 d |
| Rewire `detectionPresets` to resolve from the table (built-in models) | ~0.5 d |
| Support `modelSource` URLs + label maps (OTA *new* models, not just the 3 built-ins) | ~0.5–1 d |
| Tests (version compare, malformed JSON, fallback, offline) + on-device OTA test | ~0.5 d |
| Hosting setup (static JSON on GitHub/CDN) | ~0.25 d |

- **Minimal** (static JSON, built-in models only, no custom `modelSource`): **~1.5–2 days.**
- **Full** (incl. OTA arbitrary models via `modelSource`): **~3–4 days.**

## Risks / guardrails

- **Safety:** strict schema validation + `minAppVersion` gate + always-fallback to
  embedded + a remote kill-switch. A bad table can degrade to "use what shipped."
- **Supply chain:** if entries carry `modelSource` URLs, pin to trusted hosts
  (HuggingFace / our own bucket) and validate. Don't load arbitrary URLs blindly.
- **Offline / first run:** must be fully functional with the embedded table; the
  fetch is best-effort and never on the critical path.
- **Privacy:** one more startup network call — note it in
  [model-usage.md](model-usage.md). Benign (no user data), but document it.

## Relationship to current code

- `app/src/adapters/detectionPresets.ts` becomes the **embedded default** (it
  already has the ladder + per-platform defaults — just add a `version`).
- A new `RemoteDetectionConfig` service owns fetch/cache/resolve; `detectionPresets`
  (and `useGuideDetection`, `SetupScreen`) read the *resolved* table from it.
- Pairs naturally with the in-app "Detection quality" slider already shipped — the
  slider picks a level; the remote table defines what each level *means*.
