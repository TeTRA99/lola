---
title: "Epics & Stories — Lola v0.9"
status: final
created: 2026-05-26
updated: 2026-05-26
revision: 1
source_architecture: "../../architecture/architecture-Lola-2026-05-26/architecture.md"
source_prd: "../../prds/prd-Lola-2026-05-26/prd.md"
---

# Epics & Stories: Lola v0.9

*Implementation backlog. Six epics, ~30 stories. Each story inherits PRD AC ids and architecture AD ids so the dev cycle (`bmad-create-story` → `bmad-dev-story` → `bmad-code-review`) has full context without reaching back. Sprint sequencing is `bmad-sprint-planning`'s job, not this doc's.*

## 1. Source Documents

- [Architecture (final rev 3)](../../architecture/architecture-Lola-2026-05-26/architecture.md)
- [PRD (final rev 4)](../../prds/prd-Lola-2026-05-26/prd.md)
- [Brief (final rev 4)](../../briefs/brief-Image%20Recognition%20App-2026-05-25/brief.md)

## 2. Epic Summary

| Epic | Name | Stories | Dependencies | T-shirt sum |
|---|---|---|---|---|
| E1 | Foundation | 8 | — | ~L |
| E2 | Describe | 5 | E1 | ~M |
| E3 | Ask | 4 | E1, E2 (shared model/TTS plumbing), E4 (catalog) | ~M |
| E4 | Remember-this-for-me | 4 | E1 | ~M |
| E5 | Where-is-X | 4 | E1, E2, E3 | ~M |
| E6 | Distribution & observe | 5 | E1 (for build), all others (for sideload) | ~M |

**Estimate convention** (solo dev, calibrated to 6–8 wk timeline):
- **XS** = <2h
- **S** = 2–4h
- **M** = half-day to full day
- **L** = 1–2 days
- **XL** = split before starting

**Status convention:** `pending` (default) → `ready` (deps met, ready to pick up) → `in-progress` → `done`. All stories start `pending`.

## 3. Cross-Epic Dependency Graph

```
                  ┌───────────┐
                  │    E1     │ Foundation
                  └────┬──────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌───────┐      ┌───────┐      ┌───────┐
    │  E2   │      │  E4   │      │  E6   │ (partial — EAS scaffolding can start in parallel)
    │Describe│     │Remember│     │Distrib│
    └───┬───┘      └───┬───┘      └───────┘
        │              │
        └──────┬───────┘
               ▼
           ┌───────┐
           │  E3   │  Ask  (uses E2 plumbing + E4 catalog)
           └───┬───┘
               │
               ▼
           ┌───────┐
           │  E5   │ Where-is-X (consumes E2 + E3 success paths)
           └───────┘
```

`bmad-sprint-planning` sequences from this graph. E4 can run in parallel with E2 once E1 closes. E3 waits on E2's prompt/HTTP plumbing.

---

## 4. Epic E1 — Foundation

**Goal:** Project skeleton, all platform adapters, persona copy module, persistence layer. Nothing dad-facing in this epic — when it closes, the codebase has every primitive needed but no flagship behavior yet.

**Dependencies:** None — this is the first epic.

**Exit criteria:** A development build runs on both Android and iOS, opens to a splash that fires the launch greeting (FR-6.2), shows two unfunctioning buttons on Home, and exposes the haptic patterns via a dev menu.

### E1.1 — Expo project scaffold + EAS config

**As Charly,** I want a fresh Expo SDK 56 project with EAS configured for both Android and iOS, **so that** I have a working build pipeline before writing any feature code.

- **PRD:** NFR-1, NFR-10 · **Arch:** AD-1, §7
- **Acceptance:**
  - `package.json` pins `"expo": "~56.0.5"` (latest stable, no canary). React 19.2, RN 0.85, New Architecture on.
  - `eas.json` has `development`, `preview`, and `production` profiles for both platforms.
  - `expo prebuild` runs cleanly; native projects are gitignored (managed workflow).
  - Source layout matches architecture §4.2 (`src/screens`, `src/services`, `src/adapters`, `src/gateways`, `src/prompts`, `src/utils`).
  - `src/config.ts` populated with every constant in architecture §11.
  - Git repo initialized with `.gitignore` covering `.env.local`, `node_modules`, `ios/`, `android/`, `.expo/`.
- **Estimate:** M · **Status:** pending

### E1.2 — `es-AR` locale + CopyModule skeleton

**As a developer,** I want a single Spanish-copy module containing every dad-facing string, **so that** voseo, gentle-question errors, and brand consistency (FR-6) are enforced at one place.

- **PRD:** FR-6.1, FR-6.4, FR-6.5, NFR-4 · **Arch:** §4.2 `CopyModule`
- **Acceptance:**
  - `src/services/CopyModule.ts` exports a typed `COPY` object with every string from FR-6.4 + launch greeting (FR-6.2) + low-confidence prompt + extend trigger phrase.
  - Voseo lint: a unit test fails if any string contains `tú`, `te`, `tienes`, `puedes`, `quieres`.
  - No string literal in any other source file (lint rule: warn on Spanish-looking strings outside CopyModule).
  - `es-AR` set as the app locale at boot.
- **Estimate:** S · **Status:** pending

### E1.3 — TTS adapter + greeting integration

**As dad,** I want Lola to say *"Hola, listo cuando quieras"* in Argentine Spanish every time I open the app, **so that** the companion frame establishes itself before I do anything.

- **PRD:** FR-6.2, FR-6.3, NFR-4, NFR-9 · **Arch:** AD-1 (expo-speech), §4.2 `TTSAdapter`
- **Acceptance:**
  - `src/adapters/tts.ts` wraps `expo-speech`, exposes `speak(text, opts?)`, `stop()`.
  - Default options: `language: 'es-AR'`, `rate: 0.85`.
  - On boot, probe `Speech.getAvailableVoicesAsync()`; if `es-AR` not present, fall back via `TTS_LOCALE_FALLBACKS` (`es-419`, `es-MX`). Log fallback decision to `usage_events` with `action: 'tts_locale_fallback'`.
  - LaunchSplash plays the FR-6.2 greeting on every cold start within 800ms of splash dismiss (AC6.3).
  - Manual test on Charly's iOS: greeting plays at recognizable Argentine speed.
- **Estimate:** S · **Status:** pending · **Risk:** voice-availability on Android pending V3.

### E1.4 — STT adapter + 20-utterance test fixture

**As a developer,** I want STT plumbing that handles Argentine Spanish reliably enough to detect the FR-2 question shapes, **so that** dad's "¿qué es esto?" is correctly transcribed.

- **PRD:** AC2.1, NFR-4 · **Arch:** AD-1 (expo-speech-recognition), §4.2 `STTAdapter`
- **Acceptance:**
  - `src/adapters/stt.ts` wraps `expo-speech-recognition` (jamsch).
  - Config: `lang: 'es-AR'`, end-of-speech 1.2s (`STT_END_OF_SPEECH_MS`), hard cap 10s (`STT_HARD_CAP_MS`).
  - On boot, probe `ExpoSpeechRecognition.getSupportedLocales()`; fall back via `STT_LOCALE_FALLBACKS` if `es-AR` absent. Log to `usage_events`.
  - Test fixture: a `docs/validation/stt-fixture.md` lists 20 utterances Charly will speak into the device during V3. Includes the three core shapes from AC2.1 plus repeat/extend triggers.
  - Microphone permission denial routes through FR-6.4 copy (AC6.4).
- **Estimate:** M · **Status:** pending · **Risk:** locale availability per AC2.1.

### E1.5 — Camera adapter

**As a developer,** I want a snapshot-only camera adapter, **so that** Describe and Ask can capture a single image without exposing video or live-preview surface to dad.

- **PRD:** FR-1, FR-2, AC1.1 · **Arch:** AD-1 (expo-camera `CameraView`), §4.2 `CameraAdapter`
- **Acceptance:**
  - `src/adapters/camera.ts` exposes `captureSnapshot(): Promise<Result<{ uri: string; base64: string }, CameraError>>`.
  - Uses `CameraView` API (post-legacy).
  - JPEG output, 1024×1024 max dimension, quality 0.85 — enough for vision model, small enough for fast upload.
  - Camera permission denial routes through FR-6.4 copy.
  - Test: occluded camera returns base64 of a dark image (verifies the surface works; the FR-6.4 routing for AC1.1 lives at the service layer).
- **Estimate:** S · **Status:** pending

### E1.6 — Haptic adapter with all five FR-5 patterns

**As dad,** I want to feel what Lola is doing at each step without listening for it, **so that** the rhythm of the interaction is comprehensible non-visually.

- **PRD:** FR-5 (all patterns), AC5.1, AC5.2, AC5.3 · **Arch:** AD-1 (`expo-haptics` + `react-native-haptic-feedback`), §4.3 state machine
- **Acceptance:**
  - `src/adapters/haptics.ts` exposes `fire(pattern: 'looking' | 'thinking_start' | 'thinking_stop' | 'answer_ready' | 'listening_start' | 'listening_stop' | 'error')`.
  - Android: backed by `Vibrator.vibrate(pattern[])`.
  - iOS: backed by `react-native-haptic-feedback` CHHapticEngine with AHAP patterns for the rhythmic `thinking` pulse.
  - All five FR-5 patterns implemented per the constants in `src/config.ts`.
  - Dev menu (debug-only) exposes buttons to fire each pattern in isolation for tuning on dad's phone (sideload tunability).
  - `answer_ready` respects DND (AC5.3).
- **Estimate:** L · **Status:** pending · **Risk:** CoreHaptics behavior across iOS device models.

### E1.7 — SQLite migrations + schema v1

**As a developer,** I want the SQLite schema from architecture §3 AD-3 created on first run, **so that** every other service can read/write without bootstrapping the DB itself.

- **PRD:** FR-3, FR-4, AC3.3, AC4.5, AD-6 · **Arch:** AD-3 (full schema), AD-6 (`usage_events` table)
- **Acceptance:**
  - `src/adapters/storage.ts` wraps `expo-sqlite` with `SQLiteProvider` + `useSQLiteContext` hook.
  - Schema v1 = all three tables (`objects`, `sightings`, `usage_events`) + `idx_sightings_recent` per AD-3.
  - `PRAGMA user_version = 1` enforced in `onInit`.
  - Re-running the app after schema creation is a no-op (idempotent).
  - Unit tests: each table accepts the documented column shape; the foreign key cascade works.
- **Estimate:** S · **Status:** pending

### E1.8 — `Result<T,E>` type + service skeletons

**As a developer,** I want a typed `Result` for every service call and empty skeleton files for every domain service, **so that** later stories slot work into a stable shape and no service throws raw exceptions to the UI.

- **PRD:** FR-6.4 (errors as gentle questions, never crashes), NFR-7 · **Arch:** §4.2 modules, `utils/result.ts`
- **Acceptance:**
  - `src/utils/result.ts` exports `Result<T, E>` = `{ ok: true, value: T } | { ok: false, error: E }` + `ok()`, `err()` helpers.
  - `src/services/` has empty skeletons for `DescribeService`, `AskService`, `MemoryService`, `OnboardingService`, `HeartbeatService` — exported, typed, throwing `'not_implemented'` errors that the test layer accepts.
  - `src/adapters/filesystem.ts` populated with `Paths.document` + `File`/`Directory` (new expo-file-system API, not legacy).
  - Lint rule: no `throw` in `src/services` outside of the not-implemented placeholders (replaced as stories complete).
- **Estimate:** XS · **Status:** pending

---

## 5. Epic E2 — Describe

**Goal:** Implement FR-1 end-to-end. Dad taps the top button; Lola describes the scene in Argentine Spanish; sightings get written.

**Dependencies:** E1 complete (all adapters + OpenRouter client base + config).

**Exit criteria:** AC1.1 through AC1.6 all pass on the dev build, on both iOS (Charly's device) and Android (Charly's test Android, then dad's phone).

### E2.1 — OpenRouterClient + Lola prompt template

**As a developer,** I want a single OpenRouter client and a versioned Lola system prompt, **so that** FR-1 and FR-2 share the wire format and the JSON-mode AD-4 contract is enforced.

- **PRD:** FR-1.4, FR-2.7, NFR-11 · **Arch:** §5.1 (request shape), AD-4 (JSON tail), `gateways/openrouter.ts`, `prompts/lola.ts`
- **Acceptance:**
  - `gateways/openrouter.ts`: `POST` to `${GATEWAY_BASE_URL}/chat/completions` with the architecture §5.1 body.
  - Sends `HTTP-Referer: https://lola.local` and `X-Title: Lola v0.9` headers.
  - `response_format: { type: 'json_object' }`.
  - Retry on transient 5xx + timeouts: exponential backoff, 2 attempts, then bubble error.
  - `prompts/lola.ts` exports `buildSystemPrompt(catalog: ObjectCatalog | null)` returning the AD-4 system prompt with the FR-3 catalog injected if present.
  - Unit test: a mock response with the exact AD-4 JSON shape parses into typed `{ narration, objects[] }`.
  - Unit test: a malformed response returns `err('parse_fail')`.
- **Estimate:** M · **Status:** pending

### E2.2 — DescribeService orchestration

**As dad,** I want pressing the top button to result in a short Argentine-Spanish description of what's in front of me, **so that** I know what I'm looking at without asking anyone.

- **PRD:** FR-1 (all behavior steps), AC1.1, AC1.2, AC1.4, AC1.5, AC1.6 · **Arch:** §4.3 state machine
- **Acceptance:**
  - `DescribeService.run()`: capture snapshot → heartbeat `thinking_start` → OpenRouter call → heartbeat `answer_ready` → TTS speak narration → log sighting (placeholder for E5) → return `Result`.
  - On low-confidence response (empty objects + low-confidence narration text), speak the FR-6.4 low-confidence copy instead. AC1.1.
  - On network failure, speak FR-6.4 network copy. AC1.5.
  - Last response (text + snapshot reference) cached in-memory for ≥5 min for FR-1 repeat/extend (AC1.6). E2.4 builds the persistence layer.
  - Heartbeat transitions never have >250ms silent gaps (AC1.4).
- **Estimate:** M · **Status:** pending · **Depends on:** E2.1, E1.3, E1.5, E1.6

### E2.3 — HomeScreen Describe button

**As dad,** I want a big button in the top half of the screen labeled and iconed for "Describe," **so that** I can find and tap it without seeing well.

- **PRD:** FR-1 trigger, NFR-3 (touch target, contrast) · **Arch:** §4.2 `HomeScreen`
- **Acceptance:**
  - Top 50% of screen, edge-to-edge.
  - Contrast ratio ≥7:1 between icon/label and background (verified with a contrast tool, screenshot saved to repo `docs/validation/contrast.md`).
  - Spanish label from CopyModule (no inline string).
  - Tap dispatches `DescribeService.run()`.
  - Touch target spec satisfies NFR-3 (massively — 50% of screen).
  - No settings icon, no menu, no gear (AC6.2).
- **Estimate:** S · **Status:** pending · **Depends on:** E2.2

### E2.4 — Repeat / extend snapshot-cache layer

**As dad,** I want to ask Lola to repeat or expand on what she just said, **so that** I don't have to point the camera again.

- **PRD:** FR-1 repeat, FR-1 extend, AC1.6 · **Arch:** AD-5 (LRU cache)
- **Acceptance:**
  - `services/SnapshotCache.ts`: LRU, `CACHE_MAX_SNAPSHOTS` entries or `CACHE_MAX_BYTES`, whichever first.
  - Storage at `Paths.document/snapshots/` via the expo-file-system new API.
  - `DescribeService` writes each capture to the cache + retains the latest narration.
  - `getLastDescribe()` returns `{ narration, snapshotUri } | null`.
  - LRU eviction tested with a fixture of 60 fake captures.
- **Estimate:** S · **Status:** pending

### E2.5 — Confidence + network error copy wiring

**As dad,** I want Lola to say a gentle question when she can't see clearly or doesn't have signal, **so that** I'm never confronted with a technical failure message.

- **PRD:** FR-6.4 (all five error lines), AC1.1, AC1.5, AC6.4 · **Arch:** AD-1 error contract
- **Acceptance:**
  - Each FR-6.4 copy line is reachable from a concrete failure path (test that exercises each).
  - Confidence threshold defined in `CONFIDENCE_THRESHOLD = 0.70` — applied as a heuristic on response (empty `objects` array OR explicit low-confidence narration text).
  - Camera permission denial → FR-6.4 camera-permission line.
  - Microphone permission denial (from S3.x but wired here for consistency) → FR-6.4 mic-permission line.
  - No path in the Describe flow can raise an English error to TTS.
- **Estimate:** XS · **Status:** pending

---

## 6. Epic E3 — Ask

**Goal:** Implement FR-2 end-to-end including the utterance router that dispatches between repeat, extend, memory recall, and model call.

**Dependencies:** E1 + E2 (shares model/TTS/cache plumbing). E4 should be substantially complete for the catalog-injection path to be useful, though the wiring works without it.

**Exit criteria:** AC2.1 through AC2.5 pass on both platforms.

### E3.1 — Utterance router

**As a developer,** I want a single router that classifies an STT result into `repeat`, `extend`, `memory_recall`, or `model_call`, **so that** AskService stays simple and the routing logic is unit-testable in isolation.

- **PRD:** FR-2 step 5 (repeat/extend interception), FR-2 step 6 (memory recall interception) · **Arch:** §4.2 (AskService) + AD-3 (memory queries)
- **Acceptance:**
  - `services/UtteranceRouter.ts` exports `route(utterance: string): RouteDecision`.
  - `RouteDecision = 'repeat' | 'extend' | { type: 'memory'; object: string } | 'model'`.
  - Pattern table: `(otra vez|de nuevo)` → repeat; `(contame más|seguí|más detalle)` → extend; `(¿?dónde está|¿?viste mi|¿?dónde puse) (.+?)\b` → memory; default → model.
  - Patterns tolerate leading "Lola, " optionally.
  - Unit tests: ≥10 fixture utterances per branch, including voseo phrasings and missing inverted question marks.
- **Estimate:** M · **Status:** pending

### E3.2 — AskService (snapshot-before-STT flow)

**As dad,** I want to point the camera, then ask the question, **so that** I can refer to "esto" without re-framing.

- **PRD:** FR-2 (all behavior), AC2.2, AC2.5 · **Arch:** §4.3 state machine
- **Acceptance:**
  - Order: `looking` heartbeat → snapshot → `listening_start` → STT open → STT close on silence/cap → route → dispatch (repeat/extend/memory/model paths) → TTS.
  - Snapshot must be captured *before* STT opens (AC2.2).
  - If route = repeat or extend → reuse E2.4 cache, skip model call.
  - If route = memory → query MemoryService (E5 stub returns null in early sprints; that's fine, falls through to model).
  - If route = model → OpenRouter call with snapshot + transcribed question + E3.4 catalog injection.
  - Heartbeat transitions are contiguous (no silent gaps >250ms).
- **Estimate:** M · **Status:** pending · **Depends on:** E3.1, E2.1, E1.4

### E3.3 — Ask button on HomeScreen

**As dad,** I want the bottom half of the screen to be a button labeled and iconed for "Ask," **so that** I can find it the same way I find Describe.

- **PRD:** FR-2 trigger, NFR-3 · **Arch:** §4.2 `HomeScreen`
- **Acceptance:**
  - Bottom 50% of screen, same treatment as Describe (E2.3) — contrast, label from CopyModule, distinct icon.
  - Tap dispatches `AskService.run()`.
- **Estimate:** XS · **Status:** pending · **Depends on:** E3.2

### E3.4 — Known-object catalog injection

**As dad,** I want Lola to know my mate jar from a generic jar, **so that** she answers in my words for my things.

- **PRD:** FR-3.use, AC2.3 · **Arch:** AD-4 catalog injection in system prompt
- **Acceptance:**
  - At Ask flow start, `OnboardingService.getCatalog()` returns the FR-3 catalog (E4 owns this; here we just consume).
  - Catalog is injected into the system prompt via `buildSystemPrompt(catalog)` from E2.1.
  - When the model response includes a canonical name that matches a catalog entry, the narration uses the catalog's `display_name` ("tu cepillo," not "un cepillo").
  - Unit test: mocked catalog + mocked model response with canonical match → narration substitutes display name.
- **Estimate:** S · **Status:** pending · **Depends on:** E2.1, E4 substantially complete

---

## 7. Epic E4 — Remember-this-for-me

**Goal:** Charly-run one-time onboarding flow that populates the FR-3 catalog with dad's specific objects.

**Dependencies:** E1.

**Exit criteria:** AC3.1 through AC3.5 pass; Charly can complete a 5-object setup in <10 minutes on his iOS device.

### E4.1 — LaunchSplash 5-second hold gesture

**As Charly,** I want a hidden way into the setup screen from the splash, **so that** dad can never accidentally reach it.

- **PRD:** FR-3 trigger, AC3.1 · **Arch:** §4.2 `LaunchSplash`
- **Acceptance:**
  - 5-second sustained press on the Lola logo during the splash period opens SetupScreen.
  - Any release before 5s, any tap anywhere else: splash dismisses normally (FR-6.2 greeting fires).
  - 10-second sustained press opens DebugScreen instead (E6.4); the timer hands off cleanly at 5s if Charly is going to 10s, no double-open.
  - Manual test: pass dad the phone, ask him to "play with it for a minute" — he never reaches SetupScreen.
- **Estimate:** S · **Status:** pending

### E4.2 — SetupScreen UI (English, Charly-facing)

**As Charly,** I want a clean setup UI in English with the affordances to add, edit, and remove tagged objects, **so that** I can run this flow efficiently while sitting with dad.

- **PRD:** FR-3 behavior, AC3.4 · **Arch:** §4.2 `SetupScreen`
- **Acceptance:**
  - Screen title and all buttons/labels in English.
  - List view of existing catalog entries with edit/delete icons.
  - "Add object" CTA opens a sub-screen for the per-object capture flow (E4.3).
  - "Done" closes setup; subsequent app launches go to HomeScreen.
- **Estimate:** M · **Status:** pending · **Depends on:** E4.1

### E4.3 — Photo capture + reference image storage

**As Charly,** I want to take 1–3 photos of each object and save them to the catalog, **so that** the model has visual references when answering Ask queries.

- **PRD:** FR-3 step 2 · **Arch:** AD-3 (`objects.reference_image_uri`), expo-file-system new API
- **Acceptance:**
  - Per object, capture up to 3 photos from the SetupScreen.
  - Photos saved to `Paths.document/catalog/<object_id>/<n>.jpg`.
  - Reference uri stored in the `objects` table (E4.4 handles DB write).
  - Photos persist across app restarts (AC3.3).
- **Estimate:** S · **Status:** pending · **Depends on:** E4.2, E1.5

### E4.4 — Catalog read/write to SQLite + display-name resolution

**As Charly,** I want each tagged object stored with a canonical id, a Spanish display name, and an optional description, **so that** the catalog can be injected into model prompts cleanly.

- **PRD:** FR-3 behavior, AC3.2, AC3.5 · **Arch:** AD-3 schema, AD-4 catalog injection
- **Acceptance:**
  - `OnboardingService` exposes `addObject({ canonical, display, description? })`, `updateObject`, `removeObject`, `getCatalog(): ObjectCatalog`.
  - Canonical names are snake_case, unique, generated from display name (e.g., "Cepillo de Papá" → `cepillo_de_papa`).
  - `getCatalog` returns the full list, used by E3.4 for prompt injection.
  - Per AC3.5: full setup of 5 objects (each with 2 photos + name + description) completes in <10 min on Charly's device (manual stopwatch).
  - `AC3.2`: tagged objects appear in model responses when present — validated with 5 manually-staged objects in dad's home environment.
- **Estimate:** M · **Status:** pending · **Depends on:** E1.7, E4.3

---

## 8. Epic E5 — Where-is-X

**Goal:** Implement FR-4 in both directions (write path on every successful Describe/Ask; read path through the utterance router).

**Dependencies:** E1, E2, E3.

**Exit criteria:** AC4.1 through AC4.5 all pass.

### E5.1 — Sightings write path

**As a developer,** I want every successful Describe and Ask to write one or more sighting rows, **so that** the memory log builds passively without a separate user action.

- **PRD:** FR-4 write path, AC4.1 · **Arch:** AD-3, AD-4
- **Acceptance:**
  - On every `DescribeService.run()` and `AskService.run()` success path, iterate the AD-4 `objects[]` array from the model response.
  - For each, `MemoryService.recordSighting({ canonical, observed_at: now, snapshot_uri, room_hint, source_action, excerpt })`.
  - Canonical name canonicalized against the FR-3 catalog when there's a match; otherwise stored as observed (`source: 'observed'`).
  - Unit test: a fake model response with 3 objects → 3 sightings inserted.
  - AC4.1: every successful run writes ≥1 sighting if the response mentions any object.
- **Estimate:** S · **Status:** pending · **Depends on:** E1.7, E2.2, E3.2

### E5.2 — Memory recall pattern + AskService integration

**As dad,** I want to ask *"¿dónde está mi cepillo?"* and get an answer from what Lola has already seen, **so that** I don't need to point the camera at empty rooms.

- **PRD:** FR-4 read path, AC2.4 · **Arch:** E3.1 router, AD-3 query
- **Acceptance:**
  - `MemoryService.recall(objectName)` returns the most recent matching sighting or null.
  - Match is fuzzy: exact canonical match first, then catalog `display_name` match, then loose substring on `objects.canonical_name`.
  - AskService router (E3.1) calls `MemoryService.recall` *before* the model call when route = memory (AC2.4).
  - If a hit is fresh (<24h per NFR-8), answer from memory (skip model call).
  - If stale (>72h per NFR-8), fall through to model call with the live snapshot.
- **Estimate:** S · **Status:** pending · **Depends on:** E5.1, E3.1

### E5.3 — Freshness-window logic

**As a developer,** I want the recall path to respect NFR-8's three-tier freshness window, **so that** Lola doesn't claim certainty about a sighting from last week.

- **PRD:** NFR-8, AC4.2, AC4.4 · **Arch:** §3 AD-3, `CONFIG.MEMORY_FRESH_HOURS / MEMORY_HEDGE_HOURS`
- **Acceptance:**
  - <24h: confident phrasing ("hace 2 horas, en la cocina").
  - 24–72h: hedged ("ayer lo vi en el baño").
  - >72h: returns null; AskService falls through to model call (AC4.4).
  - Recall query returns in <100ms on a 5k-row sightings table (AC4.2). Benchmark in unit test.
- **Estimate:** S · **Status:** pending · **Depends on:** E5.2

### E5.4 — Canonicalization fuzzy match

**As dad,** I want to say *"¿viste mi cepillo?"* and have Lola find it even though the model originally logged it as *"el cepillo de Charly Sr.,"* **so that** I can use my own words.

- **PRD:** FR-4 canonicalization, AC4.3 · **Arch:** AD-3 `objects.canonical_name` + `display_name`
- **Acceptance:**
  - At sighting-write time (E5.1), match the model's named object against the FR-3 catalog: canonical match (exact) > display-name match (case-insensitive) > description-substring match.
  - On match, the sighting `object_id` points at the catalog row; on no match, a new `objects` row is created with `source: 'observed'`.
  - At recall time, the same matching policy maps dad's utterance to the right `object_id`.
  - AC4.3: a sighting written immediately after a catalog add is searchable by canonical name.
- **Estimate:** M · **Status:** pending · **Depends on:** E5.1, E4.4

---

## 9. Epic E6 — Distribution & observe

**Goal:** Production builds, distribution channels, telemetry surface, and the validation paper trail.

**Dependencies:** E1 (for any build); all feature epics (E2–E5) for the sideload deliverable.

**Exit criteria:** APK + TestFlight build sideloaded/installed, DebugScreen accessible and reporting, V1–V4 results captured.

### E6.1 — EAS production profiles + secrets

**As Charly,** I want production-profile EAS builds for both platforms with `OPENROUTER_API_KEY` provided at build time, **so that** I can ship a build without baking secrets into source.

- **PRD:** NFR-5 (no secrets in repo), NFR-10 · **Arch:** §7.3
- **Acceptance:**
  - `eas.json` has `production` profile for android (APK output) and ios (archive output).
  - `OPENROUTER_API_KEY` set via `eas secret:create`. Confirmed *not* present in repo via `git grep`.
  - `eas build -p android --profile production` produces an installable APK.
  - `eas build -p ios --profile production` produces an archive ready for EAS Submit.
- **Estimate:** S · **Status:** pending

### E6.2 — Apple Developer enrollment + TestFlight first submit

**As Charly,** I want my Apple Developer Program enrollment complete and the first iOS build submitted to TestFlight, **so that** I can install Lola on my iOS device for parallel testing.

- **PRD:** NFR-2b ($99/yr), NFR-10 iOS · **Arch:** AD-2
- **Acceptance:**
  - Apple Developer Program enrolled (membership purchase + identity verification — both Charly-side actions).
  - `eas submit -p ios --profile production` completes upload to App Store Connect.
  - Internal-testing TestFlight build available on Charly's iOS device within ~24h of submit.
  - Runbook captured at `docs/runbooks/testflight.md`.
- **Estimate:** M (waiting time, not heads-down time) · **Status:** pending · **Risk:** Apple ID identity verification can stall first-time enrollees.

### E6.3 — Android APK + sideload runbook

**As Charly,** I want a documented sideload procedure for dad's phone, **so that** any future build can be installed without rediscovering the steps.

- **PRD:** NFR-10 Android · **Arch:** §7.2
- **Acceptance:**
  - `docs/runbooks/android-sideload.md` covers: enabling Install from Unknown Sources, USB-debug install via adb, and AirDrop/Drive-link install as a fallback.
  - One end-to-end test: install a fresh APK on a non-dev Android device.
- **Estimate:** S · **Status:** pending

### E6.4 — DebugScreen with usage_events query + export

**As Charly,** I want a hidden screen that shows the week-2 working / failure-signal metrics from `usage_events`, **so that** I can measure the NFR-defined outcome without setting up cloud analytics.

- **PRD:** Success Criteria (Brief §Success), NFR-5 (no cloud) · **Arch:** AD-6
- **Acceptance:**
  - DebugScreen reachable via 10-second logo hold from LaunchSplash (E4.1's sibling).
  - Displays: per-day action counts for last 14 days; working-signal check ("Describe ≥3×/wk AND Ask ≥3×/wk after week 2?" pass/fail); zero-week check; latest 20 error rows.
  - Export button copies the entire `usage_events` JSON to clipboard.
  - Screen is unreachable through any home-screen interaction.
- **Estimate:** M · **Status:** pending · **Depends on:** E1.7, E4.1

### E6.5 — Validation V1–V4 results captured

**As Charly,** I want the pre-MVP validation artifacts saved in the repo, **so that** later phases (PRD updates, retrospectives, the v1.0 brief) can refer back to what was actually observed.

- **PRD:** §8 Validation V1–V4 · **Arch:** §10
- **Acceptance:**
  - `docs/validation/V1-competitor-side-by-side.md` — best-effort notes from Microsoft Seeing AI ✅, plus Lookout / Be My AI if completed.
  - `docs/validation/V2-latency.md` — 20-photo latency table.
  - `docs/validation/V3-tts-stt.md` — TTS voice availability + STT locale availability on both platforms; fallback decisions logged.
  - `docs/validation/V4-devices.md` — dad's Android model + OS; Charly's iOS model + OS.
  - All four files referenced from the architecture's open-items list.
- **Estimate:** S · **Status:** pending (concurrent with E1)

---

## 10. Aggregate Estimate

Rolling up the T-shirts (XS=0.5, S=1, M=2, L=3 day-equivalents for a solo dev):

| Epic | Stories | Estimate (days) |
|---|---|---|
| E1 Foundation | 8 | ~10 |
| E2 Describe | 5 | ~6 |
| E3 Ask | 4 | ~5 |
| E4 Remember-this | 4 | ~6 |
| E5 Where-is-X | 4 | ~5 |
| E6 Distribution | 5 | ~6 |
| **Total** | **30** | **~38 days** |

At 4–5 productive heads-down days per week solo (the realistic ceiling when life also runs), that's **~8 weeks** — landing exactly at the brief's 6–8 week upper bound. No slack for rework, illness, or Apple Developer enrollment delays. Sprint planning should explicitly budget 1 week buffer or accept the upper bound.

## 11. Hand-off to `bmad-sprint-planning`

Inputs the sprint planner consumes from this artifact:
- Story IDs + estimates + dependencies (for sequencing).
- Epic-level dependency graph (§3) — for parallel work decisions.
- Risk flags (E1.3, E1.4, E1.6, E6.2 — V3/V4 outputs + Apple Dev timing).
- Aggregate timeline (§10) — for sprint count + buffer.

After sprint planning: ClickUp Tasks (one per story, with the story's ACs as task checklist) sync via the REST API. Folder-of-Lists restructure expected at epic time per the reference memory.

## 12. Sign-off

- [x] Charly accepts the story catalog as the implementation backlog (2026-05-26).
- [x] Estimates accepted as the input to sprint planning; revision happens at sprint-planning time if scope shifts.
- [x] Status: `final`. Hand off to [bmad-sprint-planning](../../../../).
