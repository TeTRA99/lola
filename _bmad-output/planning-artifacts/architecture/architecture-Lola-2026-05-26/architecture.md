---
title: "Architecture — Lola v0.9"
status: final
created: 2026-05-26
updated: 2026-05-26
revision: 3
source_prd: "../../prds/prd-Lola-2026-05-26/prd.md"
source_brief: "../../briefs/brief-Image Recognition App-2026-05-25/brief.md"
---

# Architecture: Lola v0.9

*Technical decision record for the four-feature MVP. Resolves the six deferred items from PRD §8 and lays the layering that epics + stories will be built against. Decisions are stated with the trade-off considered, not as bare verdicts — but they are decisions, not options.*

> **Versions verified against live docs and the npm registry on 2026-05-26.** Expo SDK 56 (current patch `expo@56.0.5`; baseline GA 2026-05-21), React Native 0.85, New Architecture mandatory. SDK 57 only exists as a canary, not stable — stay on 56. Library picks updated where the original draft was stale — see §3 AD-1 detail and the decision log for the diff.

## 1. Decision Summary

| ID | PRD §8 Item | Decision | Rationale (short) |
|---|---|---|---|
| AD-1 | Hybrid framework | **React Native 0.85 + Expo SDK 56, EAS Build** | Charly's JS familiarity; richer haptic library than Capacitor; EAS handles TestFlight in one command. New Architecture (Fabric/TurboModules) is on by default — legacy bridge disabled since RN 0.82. |
| AD-2 | iOS distribution mechanism | **TestFlight via EAS Submit** | Re-signing handled automatically; no UDID management; 10k tester ceiling vs. ad-hoc's 100. |
| AD-3 | Memory log schema | **SQLite, two tables (`objects`, `sightings`) + index** | Single source of truth for FR-3 catalog and FR-4 byproduct; LRU-friendly. |
| AD-4 | FR-4 noun-phrase extractor | **Structured JSON tail from Gemini** | One model call instead of two; no on-device NER weight; deterministic canonical names. |
| AD-5 | Snapshot cache | **LRU, 50 snapshots OR 200MB cap, app-private storage** | Sufficient for FR-1 repeat/extend and a week of FR-4 audit; trivial to bump at sideload. |
| AD-6 | Telemetry for week-2 measurement | **Local SQLite `usage_events` table + 10s-logo-hold debug screen** | Zero cloud surface; no analytics SDK; Charly inspects directly. |

Each row expands below in §3.

## 2. Source Documents

- [PRD — Lola v0.9 (final, rev 4)](../../prds/prd-Lola-2026-05-26/prd.md)
- [Brief — Lola (final, rev 4)](../../briefs/brief-Image%20Recognition%20App-2026-05-25/brief.md)
- [Brief addendum](../../briefs/brief-Image%20Recognition%20App-2026-05-25/addendum.md)
- [Brainstorming session](../../../brainstorming/brainstorming-session-2026-05-23-0955.md)

## 3. Architectural Decisions

### AD-1: Framework — React Native + Expo

**Considered:** Capacitor (Ionic), React Native + Expo, Flutter.

**Trade-off table:**

| Concern | Capacitor | RN + Expo | Flutter |
|---|---|---|---|
| Charly's existing skill curve | low (web) | low–med (JS/TS) | high (Dart) |
| Haptic pattern richness on iOS | basic only | rich (`react-native-haptic-feedback`) | basic only |
| Argentine Spanish TTS/STT | OK plugins | strong (`expo-speech`, `expo-speech-recognition`) | OK plugins |
| Camera capture | `@capacitor/camera` | `expo-camera` / `react-native-vision-camera` | `camera` |
| Local SQLite | `@capacitor-community/sqlite` | `expo-sqlite` | `sqflite` |
| iOS TestFlight handoff | manual Xcode | **EAS Submit one-command** | Xcode/Fastlane |
| OpenRouter HTTP from app | fine | fine | fine |
| UI complexity match (two big buttons) | overkill | fits | overkill |
| 6–8 week solo cost | low | low | medium |

**Decision:** **React Native 0.85 + Expo SDK 56**, managed workflow with EAS Build for native binaries.

**Version pinning for `package.json`:** use `"expo": "~56.0.5"` (tilde — track patch releases automatically, stay within SDK 56). Current published patch on 2026-05-26 is **`expo@56.0.5`** per the npm registry. SDK 57 only exists as a canary tag, not stable — do not pull from `canary` or `next` for production builds.

New Architecture (Fabric / TurboModules) is on by default; the legacy bridge was permanently disabled in RN 0.82. Every third-party native module locked below has been verified as New-Arch compatible as of 2026-05-26.

**Why this over Capacitor:** Capacitor's iOS haptic plugin exposes only `impact{Light,Medium,Heavy}` and `notification{Success,Warning,Error}` — no custom timing patterns. FR-5 requires five distinct patterns including a 200ms-on/400ms-off rhythm; RN's `react-native-haptic-feedback` plus `expo-haptics` covers this on iOS via CoreHaptics. Closing the gap in Capacitor would mean writing a custom native plugin, which negates the simplicity win.

**Why this over Flutter:** Dart learning curve eats ~1 week of the 6–8 week budget if Charly doesn't already write Dart. The UI is two buttons — Flutter's UI superiority buys nothing here.

**Concrete library lock for v0.9** (all confirmed current on 2026-05-26):
- **Camera:** `expo-camera` (SDK 56), `CameraView` API. [docs](https://docs.expo.dev/versions/latest/sdk/camera/)
- **TTS:** `expo-speech` (SDK 56), `language: 'es-AR'`, `rate: 0.85`. Argentine Spanish (Rioplatense) voice is available on iOS; Android depends on the installed Google TTS voice pack. **Adapter must fall back to `es-419` (LatAm neutral) or `es-MX` if `es-AR` voice is not installed on the device** — V3 validation confirms which actually fires on dad's Android. [docs](https://docs.expo.dev/versions/latest/sdk/speech/)
- **STT:** **`expo-speech-recognition` (jamsch, v56.0.0)**. The original draft picked `@react-native-voice/voice` — that library was **archived 2026-01-31 with a deprecation banner pointing to this exact replacement.** Expo config plugin, actively maintained, `es-AR` support subject to device locale (verify via `getSupportedLocales()`). [repo](https://github.com/jamsch/expo-speech-recognition)
- **Haptics:** `expo-haptics` for simple impacts and notifications; **`react-native-haptic-feedback` (mkuczera)** for the FR-5 rhythmic *thinking* pulse on iOS — got a 2026 rewrite using `CHHapticEngine` with AHAP pattern support, which is exactly what the 200/400ms rhythm needs. Two libraries because each does its half well. [haptic-feedback repo](https://github.com/mkuczera/react-native-haptic-feedback)
- **SQLite:** `expo-sqlite` (SDK 56), `SQLiteProvider` + `useSQLiteContext` hook, `PRAGMA user_version` in the `onInit` handler for migrations. [docs](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Filesystem:** `expo-file-system` **new class-based API** — `Paths.document` + `File`/`Directory` classes. The legacy `FileSystem.documentDirectory` API moved to `expo-file-system/legacy` in SDK 54 and is scheduled for removal. Do not write code against the legacy API in this v0.9 build. [docs](https://docs.expo.dev/versions/latest/sdk/filesystem/) · [migration blog](https://expo.dev/blog/expo-file-system)
- **HTTP:** native `fetch` — no axios.
- **State:** React Context + `useReducer`. No Redux.

### AD-2: iOS distribution — TestFlight via EAS Submit

**Considered:** TestFlight (via EAS Submit), ad-hoc signed IPA with manual install, free 7-day personal-team Xcode install.

**Decision:** **TestFlight via EAS Submit.**

**Why:** EAS handles signing certificates, provisioning profiles, App Store Connect upload, and TestFlight review submission in one CLI invocation. Apple Dev Program $99/yr is required either way for non-expiring installs. TestFlight gives Charly and dad both an "always installable" beta link without UDID registration; ad-hoc requires capturing dad's iOS device UDID and re-signing per device per build, which is more friction than the entire app warrants.

**Operational notes:**
- Apple Developer Program enrollment is a Charly-side prerequisite. EAS Submit will halt if not enrolled.
- TestFlight beta review is typically 1–2 days for first submission, faster for updates.
- Internal Testing (no review) is available for the developer's own team — Charly's iOS device qualifies immediately. External Testing (dad, if dad ends up using iOS later) requires the 1–2 day review per significant version.

### AD-3: Memory log schema — SQLite, two tables

**Considered:** single denormalized table; key-value store (AsyncStorage); SQLite normalized.

**Decision:** SQLite, normalized into `objects` and `sightings`.

```sql
-- v1 schema for v0.9
CREATE TABLE objects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name  TEXT NOT NULL UNIQUE,         -- e.g. "cepillo_de_papa"
  display_name    TEXT NOT NULL,                -- e.g. "tu cepillo"
  description     TEXT,                          -- Spanish, optional
  source          TEXT NOT NULL,                 -- 'catalog' | 'observed'
  reference_image_uri TEXT,                      -- nullable; catalog entries only
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE sightings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id       INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  observed_at     INTEGER NOT NULL,              -- unix ms
  snapshot_uri    TEXT,                          -- local file path, nullable if cache evicted
  room_hint       TEXT,                          -- 'cocina', 'baño', etc.; nullable
  source_action   TEXT NOT NULL,                 -- 'describe' | 'ask'
  excerpt         TEXT                           -- the phrase from the model response
);

CREATE INDEX idx_sightings_recent ON sightings(object_id, observed_at DESC);

CREATE TABLE usage_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at     INTEGER NOT NULL,
  action          TEXT NOT NULL,                 -- 'describe' | 'ask' | 'repeat' | 'extend' | 'memory_hit' | 'error'
  success         INTEGER NOT NULL,              -- 0|1
  latency_ms      INTEGER,                       -- nullable
  error_kind      TEXT                           -- nullable; one of NFR-6 / FR-6.4 mapped kinds
);
```

**Why two tables not one:** FR-3 catalog entries must persist independent of sightings (Charly creates them at setup before any sighting exists). FR-4 query path needs `MAX(observed_at) WHERE object_id = ?` — clean with the index above, awkward with a denormalized blob.

**Migrations:** Use `expo-sqlite`'s `useSQLiteContext` migration hook. Schema versioned via `PRAGMA user_version`. Initial version = 1 for v0.9.

### AD-4: FR-4 noun-phrase extractor — structured JSON tail from Gemini

**Considered:** regex/heuristic on Spanish response; on-device NER (e.g. spaCy-mini WASM); structured response from the model itself.

**Decision:** **Structured response from Gemini.** Every Describe/Ask call asks Gemini to return both the natural Argentine-Spanish narration AND a parallel JSON object identifying the objects it mentioned.

**Prompt shape:**

```
System: You are Lola, an Argentine-Spanish-speaking visual assistant for an elderly user with low vision.

Respond ONLY with a JSON object of this exact shape:

{
  "narration": "<≤25-word Argentine Spanish response, voseo, no preamble>",
  "objects": [
    {"canonical": "<snake_case_id>", "display": "<Spanish display name>", "room_hint": "<cocina|baño|living|...|null>"}
  ]
}

If asked to extend (longer description), narration may go up to 80 words.
If confidence is low, set narration to a gentle-question Spanish copy and objects to [].
The user has these tagged objects (refer to them by display name when relevant): {{FR-3 catalog injected here}}

User question (FR-2 only): {{transcribed STT or null for FR-1 Describe}}
```

**Why this beats heuristics:** Gemini already understands the scene; it can pick out objects with vastly better Spanish noun-handling than any regex. One model call per action, zero extraction code.

**Why this beats on-device NER:** Adds 30–80MB to the app bundle, costs latency, and the Spanish NER models we'd ship to mobile are not as good as Gemini at unfamiliar objects (mate jars, Argentine tea brands).

**Implementation:** Client parses the JSON. If parsing fails, fall back to FR-6.4 error copy ("algo se me cruzó — ¿lo intentamos de nuevo?") and log to `usage_events` with `error_kind = 'parse_fail'`. Don't read raw JSON to dad.

**OpenRouter compatibility:** Both Gemini's native `responseMimeType: application/json` and OpenRouter's `response_format: { type: 'json_object' }` are honored. We use the OpenRouter-flavor field to keep the call site provider-agnostic (NFR-11).

### AD-5: Snapshot cache — LRU, 50 photos or 200MB, app-private

**Considered:** keep all snapshots forever; clear on every launch; bounded LRU.

**Decision:** LRU eviction at **50 entries OR 200MB cap, whichever hits first.** Storage: app-private directory (Android: `FileSystem.documentDirectory`, iOS: app sandbox documents). Encrypted at rest by OS default on both platforms.

**Why bounded:** FR-1 repeat/extend only needs the last few snapshots; FR-4 audit can fall back to "no snapshot available" gracefully (the memory log has the response excerpt, which is enough for the Spanish answer).

**Tunability:** Both bounds are config constants exposed in `src/config.ts` — Charly can bump at sideload after observing usage. Default values picked for a phone with 32GB+ storage; smaller phones probably want lower caps but that's a V4 (device-confirmation) decision.

### AD-6: Telemetry — local SQLite + debug screen

**Considered:** PostHog/Mixpanel SDK; opt-in metric POST to Charly-controlled endpoint; nothing at all; local-only.

**Decision:** Local-only. `usage_events` table (schema above). Debug screen accessible via **10-second hold on the Lola splash logo** (different from FR-3's 5-second hold for the setup screen — same gesture family, different timing).

**Debug screen displays:**
- Counts by day for last 14 days, grouped by action.
- Working-signal check: "Describe ≥3×/week AND Ask ≥3×/week post-week-2?" pass/fail.
- Failure-signal check: any full calendar week with zero usage.
- Latest error events.
- Export-to-clipboard button (JSON dump of the table) for Charly to paste into a note.

**Why no cloud telemetry in v0.9:** Brief NFR-5 commits to no cloud sync. Adding even a single analytics POST violates that posture for one elderly user where the data is observable by a weekly check-in call. v1.0 may revisit.

## 4. System Architecture

### 4.1 Layered diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation layer (React Native screens)                   │
│    HomeScreen · SetupScreen · DebugScreen · LaunchSplash     │
├──────────────────────────────────────────────────────────────┤
│  Domain layer (services, platform-agnostic)                  │
│    DescribeService · AskService · MemoryService              │
│    OnboardingService · HeartbeatService · CopyModule         │
├──────────────────────────────────────────────────────────────┤
│  Adapter layer (platform shims, expo-flavored)               │
│    CameraAdapter · TTSAdapter · STTAdapter                   │
│    HapticAdapter · StorageAdapter · FilesystemAdapter        │
├──────────────────────────────────────────────────────────────┤
│  Gateway layer                                               │
│    OpenRouterClient (single client, model param swappable)   │
├──────────────────────────────────────────────────────────────┤
│  Storage                                                     │
│    SQLite (catalog, sightings, usage_events)                 │
│    Filesystem (snapshot blobs, FR-3 reference images)        │
└──────────────────────────────────────────────────────────────┘
```

**Dependency rule:** layers depend only downward. Domain never imports React Native APIs directly — it goes through adapters. This is what makes the haptic-API divergence (Android `Vibrator` vs. iOS `CoreHaptics`) invisible to domain code.

### 4.2 Module breakdown

```
src/
├── app.tsx                  # Root, providers, navigation (single stack)
├── config.ts                # All tunable constants (cache caps, thresholds, model name)
├── screens/
│   ├── HomeScreen.tsx       # Two buttons, FR-1 + FR-2 entry points
│   ├── SetupScreen.tsx      # FR-3, English UI, Charly-only
│   ├── DebugScreen.tsx      # AD-6 telemetry, Charly-only
│   └── LaunchSplash.tsx     # 5s-hold → Setup; 10s-hold → Debug; otherwise auto-dismiss + greeting
├── services/
│   ├── DescribeService.ts   # FR-1 orchestration
│   ├── AskService.ts        # FR-2 orchestration including utterance routing
│   ├── MemoryService.ts     # FR-4 read + write
│   ├── OnboardingService.ts # FR-3 catalog management
│   ├── HeartbeatService.ts  # FR-5 state machine
│   └── CopyModule.ts        # FR-6 all Spanish strings (single source of truth)
├── adapters/
│   ├── camera.ts            # expo-camera wrapper
│   ├── tts.ts               # expo-speech wrapper, locale + rate
│   ├── stt.ts               # @react-native-voice/voice wrapper
│   ├── haptics.ts           # FR-5 pattern dispatcher (Android Vibrator + iOS CoreHaptics)
│   ├── storage.ts           # expo-sqlite (SQLiteProvider + useSQLiteContext)
│   └── filesystem.ts        # expo-file-system new API (Paths.document + File class), LRU eviction
├── gateways/
│   └── openrouter.ts        # Single client, JSON-mode response, retry on transient
├── prompts/
│   └── lola.ts              # AD-4 system prompt template + catalog injection
└── utils/
    ├── result.ts            # Result<T, E> for adapter calls
    └── time.ts
```

### 4.3 State machine — Heartbeat (FR-5)

```
idle ──tap(Describe|Ask)──► looking
looking ──snapshot_done──► thinking         (or listening if Ask)
listening ──stt_done──► thinking
thinking ──response_ok──► answer_ready ──tts_start──► speaking
thinking ──response_err──► error ──tts_start──► speaking
speaking ──tts_done──► idle
```

`HeartbeatService` owns this state machine. `HapticAdapter` subscribes and emits the FR-5 patterns on each transition. Domain code dispatches events; it does not call `HapticAdapter` directly. This decoupling is what makes test unit-testing the patterns straightforward.

## 5. External Integrations

### 5.1 OpenRouter

- **Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions` (verified 2026-05-26). [reference](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)
- **Model id (default):** `google/gemini-2.5-flash` ($0.30 / $2.50 per 1M in/out). [model page](https://openrouter.ai/google/gemini-2.5-flash) Best vision-quality fit at MVP volume; well under $30/mo NFR-2a ceiling.
- **Model id (cheap-mode toggle, for the cost-A/B per brief Technical Approach):** `google/gemini-2.5-flash-lite` ($0.10 / $0.40 per 1M). Config-tunable in `src/config.ts`.
- **Why not Gemini 3.5 Flash (GA 2026-05-19):** 5× the cost ($1.50 / $9 per 1M) for capability we don't need (agentic / coding strength); not worth it for single-elderly-user visual narration in MVP. Revisit at v1.0+ if usage volume or capability needs change.
- **Auth:** `Authorization: Bearer ${OPENROUTER_API_KEY}` — stored in EAS env, never in repo. Local dev uses `.env.local` (gitignored).
- **Request shape:**
  ```json
  {
    "model": "google/gemini-2.5-flash",
    "messages": [
      {"role": "system", "content": "..."},
      {"role": "user", "content": [
        {"type": "text", "text": "..."},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
      ]}
    ],
    "response_format": {"type": "json_object"},
    "max_tokens": 400,
    "temperature": 0.3
  }
  ```
  Note: OpenRouter also supports `response_format: { type: 'json_schema', json_schema: {...} }` for strict-mode JSON. We use the simpler `json_object` mode for v0.9; can upgrade to `json_schema` if the AD-4 parser starts seeing field-shape drift.
- **Retry:** transient 5xx and timeouts → exponential backoff, 2 attempts, then FR-6.4 network error.
- **Headers:** include `HTTP-Referer: https://lola.local` and `X-Title: Lola v0.9` per OpenRouter convention so the spend is identifiable in their dashboard.

### 5.2 TTS / STT

- **TTS:** `expo-speech`, `language: 'es-AR'`, `rate: 0.85`. If V3 finds quality unacceptable, ElevenLabs fallback uses streaming TTS via HTTP — adapter swap, not call-site change.
- **STT:** `expo-speech-recognition` (jamsch), `lang: 'es-AR'`, end-of-speech timeout 1.2s, hard cap 10s. Permission prompts wired through FR-6.4 copy. Probe `getSupportedLocales()` at boot — if `es-AR` is not in the result on a given device, fall back to `es-419` / `es-MX` per the same policy as TTS.

## 6. Cross-Platform Divergence (Android vs. iOS)

| Concern | Android approach | iOS approach |
|---|---|---|
| Haptics | `Vibrator.vibrate(pattern[])` | CoreHaptics via `react-native-haptic-feedback` |
| Snapshot storage | `Paths.document` + `File` (expo-file-system new API) | Same — Expo abstracts the platform difference |
| TTS voice | Google TTS (system) | Apple TTS (system) — different voice persona by default; V3 evaluates per platform |
| STT engine | Android `SpeechRecognizer` | Apple Speech framework — same `voice` wrapper |
| Distribution | APK direct sideload | TestFlight via EAS Submit |
| Update channel | Charly re-sideloads | TestFlight auto-prompts |
| Permission prompts | system dialog at first use | system dialog at first use; Info.plist usage strings required |

All divergence is contained in the `adapters/` layer. Services and screens are platform-agnostic.

## 7. Build & Deployment

### 7.1 Dev loop

- Expo Go on Charly's iOS device for fast iteration of UI / non-native logic.
- **EAS Build *development client* required** for the haptics + STT + camera modules — Expo Go does not bundle `react-native-haptic-feedback` or `expo-speech-recognition`. Build the dev client once per platform; subsequent JS-only changes hot-reload over Wi-Fi.

### 7.2 Production builds

- **Android:** `eas build -p android --profile production` → produces APK. Charly downloads, sideloads via USB or transfer to dad's phone.
- **iOS:** `eas build -p ios --profile production` → archive. Then `eas submit -p ios` → TestFlight. Charly tests via TestFlight on his device.

### 7.3 Secrets management

- `OPENROUTER_API_KEY` — set in EAS via `eas secret:create`. Never in repo.
- `.env.local` (gitignored) for local dev.
- Apple Developer credentials stored by EAS in their managed credentials service.

### 7.4 Version & release cadence

- Semantic versioning: `0.9.0` for sideload-ready MVP; `0.9.1`+ for in-MVP patches.
- Builds are tied to git tags. No CI for v0.9 — Charly triggers EAS manually.

## 8. Test Strategy

Pragmatic given solo + 6–8 weeks:

- **Unit tests** (Jest) on `services/` layer. Mock adapters via `__mocks__/`. Target: each service has tests for the happy path + the AC bullets from PRD.
- **No E2E test framework** (Detox/Maestro) for v0.9. Manual smoke testing on Charly's iOS + ideally dad's Android substitute (Charly tests on a similar Android device before sideloading to dad).
- **Pre-MVP validation V1–V4** runs before E6 closes — captured in repo as `docs/validation/` markdown notes.
- **No crash reporting SDK** (privacy-first). If a crash occurs in dad's hands, Charly retrieves the device, plugs in, reads `adb logcat` or iOS device console.

## 9. Security & Privacy

- **No cloud user data.** All catalog, sightings, snapshots, usage events stay local. Honors NFR-5.
- **Snapshots in flight:** sent to OpenRouter → Google for inference, not retained server-side beyond request lifecycle. Acceptable per brief; future Play/App Store release will need an explicit privacy disclosure.
- **API key handling:** EAS-managed for production; `.env.local` for dev; gitignored.
- **Permissions:** camera + microphone required, requested on first use of each (FR-1 / FR-2). Permission denial routed through FR-6.4 copy.

## 10. Open Items Carried Forward

None blocking. All architecture-deferred items are resolved.

Items that remain ahead of architecture (validation, not architecture):
- V1: Lookout + Be My AI side-by-side testing — Charly's call to run partial.
- V2: Gemini 2.5 Flash latency on 20 dad-home photos.
- V3: Argentine Spanish TTS quality on dad's Android *and* Charly's iOS. **Now also includes: probe `Speech.getAvailableVoicesAsync()` (TTS) and `ExpoSpeechRecognition.getSupportedLocales()` (STT) on both devices; confirm `es-AR` voice/locale is actually installed, or which fallback (`es-419` / `es-MX`) fires.**
- V4: dad's phone model + Android version; Charly's iOS device + iOS version.

V3 and V4 can run in parallel with the start of E1 Foundation; no need to gate.

## 11. Architecture-Locked Constants (for `src/config.ts`)

```typescript
export const CONFIG = {
  MODEL_ID: 'google/gemini-2.5-flash',
  MODEL_ID_CHEAP: 'google/gemini-2.5-flash-lite',  // cost-A/B toggle per brief Technical Approach
  GATEWAY_BASE_URL: 'https://openrouter.ai/api/v1',
  TTS_LOCALE: 'es-AR',
  TTS_LOCALE_FALLBACKS: ['es-419', 'es-MX'] as const,
  TTS_RATE: 0.85,
  STT_LOCALE: 'es-AR',
  STT_LOCALE_FALLBACKS: ['es-419', 'es-MX'] as const,
  STT_END_OF_SPEECH_MS: 1200,
  STT_HARD_CAP_MS: 10000,
  CONFIDENCE_THRESHOLD: 0.70,
  CACHE_MAX_SNAPSHOTS: 50,
  CACHE_MAX_BYTES: 200 * 1024 * 1024,
  MEMORY_FRESH_HOURS: 24,
  MEMORY_HEDGE_HOURS: 72,
  HEARTBEAT_LOOKING_MS: 50,
  HEARTBEAT_THINKING_ON_MS: 200,
  HEARTBEAT_THINKING_OFF_MS: 400,
  HEARTBEAT_ANSWER_READY: [50, 100, 50] as const,
  HEARTBEAT_ERROR_MS: 600,
  SETUP_GESTURE_HOLD_MS: 5000,
  DEBUG_GESTURE_HOLD_MS: 10000,
};
```

Stories will reference these by name, not by literal. The architect's job is to fix the names; the values are sideload-tunable.

## 12. Suggested Story Slicing (for [bmad-create-epics-and-stories](../../../../))

Per the PRD's six epics. Sketch of expected stories:

- **E1 Foundation** — *E1.1* Expo project scaffold + EAS config; *E1.2* `es-AR` locale + CopyModule skeleton; *E1.3* TTS adapter + greeting integration; *E1.4* STT adapter + 20-utterance test fixture; *E1.5* Camera adapter; *E1.6* Haptic adapter with all five FR-5 patterns on both platforms; *E1.7* SQLite migrations + schema v1; *E1.8* Result type + service skeletons.
- **E2 Describe** — *E2.1* OpenRouterClient + prompt template; *E2.2* DescribeService orchestration; *E2.3* HomeScreen Describe button + AC1.1–1.6 wiring; *E2.4* repeat/extend cache layer; *E2.5* network/confidence error copy wiring.
- **E3 Ask** — *E3.1* utterance router (repeat/extend/memory/model); *E3.2* AskService snapshot-before-STT flow; *E3.3* Ask button on HomeScreen; *E3.4* known-object catalog injection.
- **E4 Remember-this-for-me** — *E4.1* LaunchSplash 5s gesture; *E4.2* SetupScreen UI (English); *E4.3* photo capture + storage; *E4.4* catalog read/write to SQLite + display name resolution.
- **E5 Where-is-X** — *E5.1* sightings write path on FR-1/FR-2 success; *E5.2* memory recall pattern match in utterance router; *E5.3* freshness-window logic; *E5.4* canonicalization fuzzy match against catalog.
- **E6 Distribution & observe** — *E6.1* EAS production profiles, secrets; *E6.2* Apple Developer enrollment + TestFlight first submission; *E6.3* Android APK build + sideload runbook; *E6.4* DebugScreen with usage_events query + export; *E6.5* validation V1–V4 results captured to repo.

Roughly 26 stories. Sprint planning sequences them.

## 13. Sign-off

- [x] Charly accepts AD-1 through AD-6 as the architecture lock (2026-05-26).
- [x] Versions verified against live docs and rev 2 patch accepted (2026-05-26).
- [x] V3, V4 results carry forward — to be folded into `src/config.ts` constants as they land (Charly's standing partial-validation instruction).
- [x] Status: `final`. Hand off to [bmad-create-epics-and-stories](../../../../).
