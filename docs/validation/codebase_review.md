# Whole-codebase review — Lola (assistive-vision app)

## 1. Executive assessment
Lola is exceptionally well-aligned with its unique product context: a zero-latency, audio-first, heavily-accessibility-focused experience for a single end user. The core architecture is pragmatic and robust, successfully prioritizing user safety and a fail-graceful UX over traditional "purity" (e.g., opting for a hand-rolled screen state machine over heavy navigation libraries). The test coverage is impressively high, and error handling generally respects the contract of "errors are spoken, never silent." However, the rapid expansion of scope—adding on-device models, YOLO, and room recognition—has strained the original architecture, introducing complex dualities and platform-specific audio races. The biggest risk currently is the fragility of the shared iOS audio session between STT, TTS, and earcons, which directly undermines the core voice-first interaction loop. Despite this, the codebase remains remarkably clean, maintainable, and firmly rooted in the caregiver's actual needs.

## 2. Architecture review
- **What's right**: The adapter/service/gateway split is consistently applied and keeps side effects tightly contained. The `Result` type pattern ensures fallibility is modeled explicitly, preventing uncaught Promise rejections from crashing the app. The decision to use a hand-rolled screen state machine in `app.tsx` is brilliant for this context—it avoids focus-trapping and navigation stack bugs that often plague screen readers. The `llmResidency` queue is a clever, necessary abstraction to handle RAM constraints gracefully.
- **What's fragile**: The iOS audio pipeline is highly fragile due to competing singletons (`expo-speech`, `expo-speech-recognition`, `expo-audio`) fighting over the global `AVAudioSession` state. The cloud vs. on-device duality, while neatly hidden behind `ModelRouter`, leaks into service orchestration (e.g., `AskService` handling null objects and separate heuristic checks), creating parallel code paths. Finally, the growing list of `Settings.KEYS` and the overloaded `AskService` state are starting to stretch the limits of the simple orchestration layer.
- **Recommended changes**: Unify audio session management centrally rather than letting individual adapters mutate it implicitly. Refactor `AskService` to delegate the execution of specific intents to sub-services (e.g., `GuideIntentHandler`, `ExtendIntentHandler`) to reduce its bloat. Unify the payload shapes between local and cloud responses so that service-layer logic isn't littered with `inferenceMode() === 'local'` checks.

## 3. Findings

> [!WARNING]
> ### Blocker: iOS Audio Session Deactivation Fades TTS
> **Location:** [earcon.ts:25](file:///Users/carlosbernardi/Documents/lola/app/src/adapters/earcon.ts#L25) / [stt.ts:128](file:///Users/carlosbernardi/Documents/lola/app/src/adapters/stt.ts#L128)
> **Why it matters:** The user frequently hears generic STT errors or a fading TTS response because `expo-audio` automatically deactivates the `AVAudioSession` when the "mic close" chime finishes playing, silently cutting off the concurrently running `expo-speech` (TTS) output.
> **Concrete fix:** In `earcon.ts`, call `setAudioModeAsync({ playsInSilentMode: true, staysActiveInBackground: true })` (or configure `interruptionModeIOS`) to prevent `expo-audio` from seizing and deactivating the session. Alternatively, rewrite the earcon player to use a lower-level API that does not interfere with the active audio session.

> [!IMPORTANT]
> ### High: Unhandled/Swallowed Catch Blocks in Audio Adapters
> **Location:** [tts.ts:66](file:///Users/carlosbernardi/Documents/lola/app/src/adapters/tts.ts#L66) / [stt.ts:28](file:///Users/carlosbernardi/Documents/lola/app/src/adapters/stt.ts#L28)
> **Why it matters:** While swallowing errors prevents crashes, silent failures in TTS/STT break the "never go silent" accessibility contract. If `restoreIOSPlaybackSession()` silently fails, all subsequent audio could be stuck in "record" mode (faint and distorted).
> **Concrete fix:** Add minimal `console.warn` or telemetry logging inside these catch blocks so audio failures don't remain entirely invisible in production logs.

> [!NOTE]
> ### Medium: AskService Monolith Bloat
> **Location:** [AskService.ts](file:///Users/carlosbernardi/Documents/lola/app/src/services/AskService.ts)
> **Why it matters:** At >500 lines, `AskService.ts` orchestrates almost every feature (guide, chitchat, SOS, memory). It's accruing technical debt and making testing harder.
> **Concrete fix:** Extract `handleCallFamily`, `handleWhereAmI`, and `handleGuide` into their own domain modules (e.g., `SOSService`, `GuideService`), leaving `AskService` strictly as the router/orchestrator.

> [!NOTE]
> ### Medium: Race Condition in STT Abort/Timeout
> **Location:** [stt.ts:156](file:///Users/carlosbernardi/Documents/lola/app/src/adapters/stt.ts#L156)
> **Why it matters:** `listen` manages its own `activeAbort` and sets timeouts, but the `micOpenEarcon` lead delay (220ms on iOS) means `abort` could be called *before* `startRecognizer` fires. (The code handles this nicely with `if (settled) return;`, but the timeout could technically leak if the timing aligns poorly).
> **Concrete fix:** Ensure `readyTimer` and `hardTimeout` are reliably cleared inside `activeAbort`.

> [!TIP]
> ### Low: Unawaited Promise in `ensurePlayers`
> **Location:** [earcon.ts:25](file:///Users/carlosbernardi/Documents/lola/app/src/adapters/earcon.ts#L25)
> **Why it matters:** `void setAudioModeAsync(...)` is unawaited, meaning `createAudioPlayer` and subsequent `play()` calls might fire before the audio session is properly configured.
> **Concrete fix:** Await `setAudioModeAsync` if possible, or initialize it fully at app boot inside `app.tsx`.

## 4. Prioritized improvement roadmap
1. **Fix iOS Audio Session Bug (Effort: Low, Impact: High)**: Apply the `staysActiveInBackground` fix to `expo-audio` or migrate the earcons to an audio library that plays nicely with `AVAudioSession` concurrency. This resolves the primary user-facing bug and restores core stability.
2. **Centralize Audio Session Management (Effort: Medium, Impact: High)**: Create a unified `AudioSessionManager` to explicitly manage the transitions between `playback` and `playAndRecord` instead of scattering `setCategoryIOS` and `setAudioModeAsync` across `tts.ts`, `stt.ts`, and `earcon.ts`.
3. **Refactor AskService (Effort: Medium, Impact: Medium)**: Break out intent handlers (SOS, Guide, Memory) into separate files to curb the file length and complexity, ensuring the `AskService` orchestrator remains clean.
4. **Audit and Log Swallowed Errors (Effort: Low, Impact: Medium)**: Review all `catch {}` blocks across adapters and ensure they at least log to telemetry or console so that "silent" failures are visible to the developer.
5. **Optimize First-Run Model Load (Effort: Medium, Impact: Low)**: Evaluate if the on-device VLM `preloadResident` in `app.tsx` delays the UI thread; ensure it runs completely asynchronously or in a background isolate.

## 5. Answers to "Known concerns"

**1. iOS audio bug (active):**
- **Root-cause hypothesis:** The issue is a global `AVAudioSession` deactivation race caused by `expo-audio`. In `stt.ts`, `restoreIOSPlaybackSession` restores the session to `playback` mode, and then `micCloseEarcon()` is immediately called. `micCloseEarcon` uses `expo-audio` to play a chime. Right after this, `AskService` or `DescribeService` calls `tts.speak()`, which starts the `expo-speech` TTS engine. However, when the 210ms `expo-audio` chime finishes, `expo-audio` sees no more active players and automatically *deactivates* the `AVAudioSession` (this is its default behavior to be a good iOS citizen). Deactivating the session mid-speech causes the OS to dramatically fade out and silence the concurrently playing `expo-speech` TTS! Furthermore, the "STT fails to interpret" error stems from the unawaited `setAudioModeAsync` in `earcon.ts` clashing with `ExpoSpeechRecognitionModule.start()` trying to set `playAndRecord` simultaneously.
- **Fix:** In `earcon.ts`, initialize `expo-audio` with `setAudioModeAsync({ playsInSilentMode: true, staysActiveInBackground: true })` to prevent it from deactivating the session. Alternatively, use a non-intrusive sound API for the earcons to avoid touching `AVAudioSession` entirely.

**2. Scope vs intent:**
- The app's expansion into local inference, YOLO, and room ID is surprisingly well-managed and entirely justified by the product context (offline reliability for the primary user). The complexity is currently carried cleanly thanks to the strict `Result` type usage and the `ModelRouter` seam. However, it *is* accruing technical debt in orchestration files like `AskService.ts`. The scope drift is manageable, but the orchestration layer must be modularized before any new features are added.

**3. Cloud/on-device duality:**
- The seam in `ModelRouter.ts` is exactly the right abstraction point. It successfully isolates the API gateway from the business logic. However, supporting both paths does create slight fragility in prompt management (e.g., `localUserText` vs `userText` in `DescribeService`). The single-resident queue (`llmResidency.ts`) is rock-solid. To prevent further fragility, standardize the returned objects so that the orchestration layer (like `AskService`) doesn't have to check `inferenceMode() === 'local'` to override heuristics like `isLowConfidence`.
