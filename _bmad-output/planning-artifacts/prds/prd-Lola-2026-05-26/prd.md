---
title: "PRD — Lola v0.9 (MVP)"
status: final
created: 2026-05-26
updated: 2026-05-26
revision: 4
source_brief: "../../briefs/brief-Image Recognition App-2026-05-25/brief.md"
source_brainstorming: "../../../brainstorming/brainstorming-session-2026-05-23-0955.md"
---

# PRD: Lola v0.9 (MVP)

*Implementation contract for the four-feature MVP that ships to Charly's father in 6–8 weeks. The brief is the strategic argument; this PRD is the spec the architecture and stories will inherit.*

## 1. Overview

Lola is an Argentine-Spanish-speaking assistive-vision companion app. v0.9 ships four features (Describe, Ask, Remember-this, Where-is-X) plus a cross-cutting companion frame and haptic feedback layer, all backed by Gemini 2.5 Flash for vision, accessed via OpenRouter (see NFR-11).

**Platform posture:** The codebase is hybrid (Capacitor / React Native / Flutter — architecture phase locks the specific choice). v0.9 builds *both* Android and iOS targets:

- **Android — primary target.** APK sideloaded direct to dad's phone. Dad is the user-of-record; every v0.9 design constraint is calibrated to him.
- **iOS — parallel target (Charly's device).** Distribution via TestFlight or ad-hoc (architecture phase locks the mechanism; TestFlight is the leading candidate). Used by Charly for his own testing and as a fallback distribution path. Not a separate user-design target — feature parity with Android, behavior identical.

Public storefront distribution (Play Store, App Store) is out of scope per brief; v1.5+. Both v0.9 channels are invite-only.

This PRD specifies functional and non-functional requirements detailed enough for [bmad-create-architecture](../../../../) and [bmad-create-epics-and-stories](../../../../) to consume without re-discovery. Strategy, audience, and roadmap arguments are not re-litigated here — see the source brief.

**Source documents:**
- [Product brief (final)](../../briefs/brief-Image%20Recognition%20App-2026-05-25/brief.md)
- [Brief addendum (research trail, tuned defaults, idea inventory)](../../briefs/brief-Image%20Recognition%20App-2026-05-25/addendum.md)
- [Brainstorming session](../../../brainstorming/brainstorming-session-2026-05-23-0955.md)

## 2. Goals & Success Criteria

**Primary goal:** Dad uses Lola in his daily life for the three actions he has actually asked for help with — *identify what's in my hand, identify what's in front of me, recall where I last saw X.*

**Working signal (week 2 post-sideload):**
- Describe used ≥3×/week unprompted
- Ask used ≥3×/week unprompted
- Both required.

**Failure signal:** Zero usage in any full calendar week → retro + pivot-or-rebuild.

**Implicit (non-gating, watch-only):** Dad refers to "Lola" by name; observed frustration moments drop relative to pre-Lola baseline.

## 3. Personas

**Primary user — Dad (v0.9 is designed for him alone):**
Argentine Spanish speaker, late-life progressive vision loss (some sight remaining, may end in full blindness), limited tech tolerance, no neck/wrist hardware, may use one pair of earbuds. Lives in his own home. Cares about mate, his soccer team, his family. Never sees a settings screen.

**Sideloader — Charly:**
Solo builder, sideloads APK to dad's phone, runs the one-time Remember-this onboarding at sideload, observes telemetry, makes weekly check-in calls.

Secondary and tertiary audiences are parked per brief; v0.9 design treats them as downstream noise.

## 4. Functional Requirements

### FR-1: Describe button

The flagship daily action. Tap → snapshot → Gemini 2.5 Flash → Argentine Spanish narration of the scene.

**Trigger:** User taps the top half of the home screen (the Describe button — 50% screen area, icon over Spanish label, high contrast).

**Behavior:**
1. Heartbeat enters *looking* state (FR-5) the moment the button is pressed.
2. Capture single still snapshot from the rear camera.
3. Heartbeat enters *thinking* state.
4. POST snapshot to Gemini 2.5 Flash with a fixed system prompt that asks for a *short* Argentine-Spanish description of the scene (≤25 words, no preamble, no "I see…" framing).
5. Heartbeat enters *answer-ready* state.
6. TTS reads the response at 0.85× speed, locale `es-AR`, through the active output (speaker or paired earbuds).
7. The text response is silently logged to the Where-is-X memory store (FR-4 dependency).

**Confidence handling:** If the model response is empty, refuses, or self-flags low confidence (heuristic on response text + length), Lola does *not* guess. Instead she speaks: *"No estoy segura — ¿podés acercarte un poquito?"*

**Repeat:** After a Describe action, a follow-up Ask press where the spoken utterance is recognized as `"¿otra vez?"` or `"Lola, ¿otra vez?"` replays the last Describe TTS without re-snapshotting.

**Extend:** After a Describe action, a follow-up Ask press where the spoken utterance is recognized as `"contame más"` or `"Lola, contame más"` re-queries the same snapshot with a longer-description prompt (≤80 words).

**Acceptance criteria:**
- AC1.1: Pressing Describe with the camera occluded produces the gentle-question copy, never a fabricated description.
- AC1.2: Button-to-audio elapsed time is ≤2s on dad's phone with normal home Wi-Fi (NFR-1).
- AC1.3: TTS output is `es-AR` locale, played at 0.85× speed.
- AC1.4: Heartbeat haptic pattern matches the active state at every moment of the flow (no silent gaps >250ms while thinking).
- AC1.5: Network failure mid-request produces *"No tengo señal ahora — ¿probamos en un ratito?"*, not a stack trace or an English error.
- AC1.6: Last Describe response (text + snapshot reference) is retrievable for FR-1 repeat and FR-1 extend for ≥5 minutes after the action.

### FR-2: Ask button

Snapshot plus voice question, answered by Gemini 2.5 Flash.

**Trigger:** User taps the bottom half of the home screen (the Ask button — same dimensions and treatment as Describe, distinct icon, distinct Spanish label).

**Behavior:**
1. Heartbeat enters *looking*.
2. Capture single still snapshot.
3. Start STT listener (`es-AR` locale) with a soft start chime — no spoken prompt, dad already knows the rhythm. STT auto-stops on 1.2s of silence after speech begins, or after 10s hard cap.
4. Transcribe the user's utterance.
5. If the utterance matches a repeat/extend trigger (`"¿otra vez?"`, `"Lola, ¿otra vez?"`, `"contame más"`, `"Lola, contame más"`), invoke the FR-1 repeat/extend path with the *previous Describe*'s snapshot and skip steps 6–8.
6. If the utterance matches a memory-recall pattern (`"¿dónde está [X]?"`, `"¿viste mi [X]?"`, etc.), invoke FR-4 *first*; if memory has a recent hit, answer from memory and skip steps 7–8.
7. Otherwise: POST {snapshot, question, known-object catalog from FR-3} to Gemini 2.5 Flash. System prompt: answer the user's question in Argentine Spanish, ≤25 words, no preamble, no refusal-to-guess unless confidence is genuinely low.
8. Heartbeat *answer-ready*; TTS reads response.

**Confidence handling, network failure, locale, speed:** Same as FR-1.

**Acceptance criteria:**
- AC2.1: STT correctly transcribes Argentine-Spanish phrasing of the three core question shapes (*"¿qué es esto?"*, *"¿dónde está mi [X]?"*, *"¿qué tengo en la mano?"*) on dad's phone, validated on a fixed 20-utterance test set.
- AC2.2: Snapshot is captured *before* the STT listener opens — questions can refer to "esto" (this) without the user needing to re-frame the camera.
- AC2.3: Known-object catalog (FR-3) is injected into the model prompt when present; the model can resolve "mi cepillo" → "el cepillo de Charly Sr." reference image.
- AC2.4: Memory recall (FR-4) intercepts location questions *before* the model call when memory has a hit within freshness window (NFR-8).
- AC2.5: Button-to-audio ≤2s + STT capture time (≤10s hard cap), measured separately.

### FR-3: Remember-this-for-me (Charly-run, one-time)

A guided onboarding flow that lets Charly pre-tag dad's specific objects (mate jar, his toothbrush, his meds, kettle, radio, common tea boxes) so the Ask flow can reference them by his words.

**Trigger:** Dev/setup-only entry — *not* discoverable by dad. Activated by **tap-and-hold the Lola splash logo for 5 seconds during launch**. No menu, no settings icon, no on-screen affordance.

**Behavior:**
1. Charly is presented with a setup screen titled in English (this screen is for him, not dad).
2. For each object to tag (recommended 5–10):
   - Capture 1–3 reference photos from different angles.
   - Type a name (e.g., "yerba Cruz de Malta," "cepillo de papá," "pava," "remedio de la presión").
   - Optionally type a one-line description in Spanish (e.g., "es la verde con dorado").
3. On save: object name, description, and photo embeddings are stored locally (NFR-5).
4. The catalog is loaded on every Ask request and injected into the model prompt as context.
5. Charly can re-enter setup the same way to add, edit, or remove objects.

**Acceptance criteria:**
- AC3.1: The setup screen is unreachable through any normal home-screen interaction; dad cannot accidentally enter it.
- AC3.2: A tagged object's name appears in the model's response when the snapshot clearly contains it (validated on 5-object test set in dad's home).
- AC3.3: All catalog data persists across app restarts and survives OS-level cache clears that don't include app data.
- AC3.4: Setup screen language is English (Charly-facing); all dad-facing copy stays Argentine Spanish.
- AC3.5: Adding 5 objects with 2 photos each completes in <10 minutes of Charly's time.

### FR-4: Where-is-X (passive memory log)

Every Describe and every Ask silently builds a memory log of "when did Lola last see object X." Queryable through the Ask button.

**Behavior — write path:**
1. After every successful FR-1 or FR-2 model response, extract object mentions from the response text using a lightweight noun-phrase extractor (architecture phase chooses the exact mechanism).
2. For each extracted object, write `{object_canonical_name, timestamp, snapshot_reference, room_hint (if available)}` to local SQLite.
3. Canonicalize against the FR-3 catalog when possible (e.g., "el cepillo" + catalog match → "cepillo de papá"); otherwise store as observed.

**Behavior — read path (via FR-2):**
1. Ask flow detects location-query pattern (per AC2.4).
2. Lookup most recent memory entry matching the object (fuzzy match against canonical name).
3. If a hit is found within the freshness window (NFR-8), answer from memory: *"La última vez vi tu cepillo hace 2 horas, en la cocina."* TTS, FR-5 heartbeat as normal.
4. If multiple hits exist within freshness, return the most recent + a brief note: *"...y también lo vi esta mañana en el baño."*
5. If no hit: fall through to the standard model call with the live snapshot.

**Acceptance criteria:**
- AC4.1: Every successful Describe and Ask writes ≥1 memory entry when the response mentions any object.
- AC4.2: Memory queries return in <100ms (local SQLite, no model call required for the recall path).
- AC4.3: Memory written by FR-3 catalog adds is searchable by canonical name immediately.
- AC4.4: Stale memory (older than freshness window per NFR-8) is not surfaced as a confident answer; falls through to live model call.
- AC4.5: Memory log is purely local. No cloud sync in v0.9.

### FR-5: Heartbeat (haptic system-state feedback)

Cross-cutting haptic layer that gives dad a non-visual sense of what Lola is doing at every moment of every flow.

**States and patterns:**
- *Looking* (camera capturing): one short tap, 50ms.
- *Thinking* (model call in flight): slow rhythmic pulse, 200ms-on / 400ms-off, repeating until state changes.
- *Answer-ready* (TTS about to begin): double tap, 50ms / 100ms-gap / 50ms.
- *Listening* (STT open during Ask flow): one soft tap on listener-open + one on listener-close.
- *No signal / error*: long-soft pulse, 600ms.

**Acceptance criteria:**
- AC5.1: Every model call (FR-1, FR-2) transitions through *looking → thinking → answer-ready* with no silent gap >250ms.
- AC5.2: Patterns are distinguishable on dad's phone (validated by hand during sideload).
- AC5.3: Haptic respects the OS "do not disturb" silence rule — except that *answer-ready* still fires (it's the user-initiated response, not a notification).

### FR-6: Companion frame (Lola persona)

The frame is a zero-engineering-cost product decision that shapes every line of dad-facing copy and every TTS line. It is its own FR because it is the moat, not a polish pass.

**Requirements:**
- **FR-6.1 Name:** The app is "Lola." App icon, splash, launch greeting, all error copy, every TTS line refers to her by name where natural.
- **FR-6.2 Launch greeting:** On every app open, TTS speaks *"Hola, listo cuando quieras."* once. Locale `es-AR`, 0.85× speed.
- **FR-6.3 Voice persona:** Consistent across every TTS line. Whichever voice asset is locked at validation test 3 (NFR-9) is the *only* voice for v0.9. No mixed voices, no system-default fallback for a single line.
- **FR-6.4 Errors as gentle questions:** No error in v0.9 may be a statement of failure. Every failure mode has a Spanish copy line that is a gentle question, written in the brief's tone:
  - Low confidence → *"No estoy segura — ¿podés acercarte un poquito?"*
  - No network → *"No tengo señal ahora — ¿probamos en un ratito?"*
  - Camera permission missing → *"Necesito ver para ayudarte — ¿me dejás usar la cámara?"*
  - Microphone permission missing (FR-2 entry) → *"¿Me dejás escucharte?"*
  - Generic / unhandled → *"Algo se me cruzó — ¿lo intentamos de nuevo?"*
- **FR-6.5 Voseo:** All copy uses Argentine voseo (*vos*, *podés*, *querés*) not Iberian *tú*.
- **FR-6.6 No settings UI for dad:** Dad never sees a configuration screen. All tunable values (FR-3 catalog excepted, which is Charly-facing) are baked at build time or set during sideload.

**Acceptance criteria:**
- AC6.1: Every Spanish copy line in the app passes a voseo check (no second-person *tú* / *te* forms outside FR-3's English-language setup screen).
- AC6.2: There is no settings icon, no menu, no hamburger, no gear on any dad-facing screen.
- AC6.3: Launch greeting fires on every cold start of the app within 800ms of splash dismiss.
- AC6.4: All six error copy lines above are wired and reachable in their respective failure modes.

## 5. Non-Functional Requirements

- **NFR-1 Latency:** Describe button-to-audio ≤2s on dad's phone with normal home Wi-Fi. Ask flow: same, plus STT capture window (10s hard cap). Validated by pre-MVP test 2 on 20 photos of dad's actual home objects.
- **NFR-2 Cost:**
  - *NFR-2a Model/API spend:* ≤$30/month at expected one-elderly-user volume. Gemini 2.5 Flash accessed via OpenRouter (see NFR-11); gateway margin is small at this volume and absorbed within the $30 ceiling. Budget headroom validated in brainstorming.
  - *NFR-2b Platform tooling:* Apple Developer Program $99/year (~$8.25/mo amortized) required for iOS distribution (TestFlight or ad-hoc). No Android equivalent — direct APK sideload is free. If NFR-9 falls to ElevenLabs, add $5/mo there.
- **NFR-3 Accessibility:** Touch targets ≥88dp (each of the two buttons occupies ~50% of the screen, far exceeding minimum). Contrast ratio ≥7:1 between button label/icon and button background. No multi-finger gestures. No required text reading from dad — every action is haptic-confirmed and audio-narrated.
- **NFR-4 Language:** All dad-facing copy is Argentine Spanish, locale `es-AR`. TTS speed 0.85× by default. No English in any dad-facing surface. (Charly-facing FR-3 setup screen is English by design.)
- **NFR-5 Privacy & data:** Memory log, FR-3 catalog, and snapshot cache are local-only in v0.9. No cloud sync, no analytics SDK, no third-party telemetry. Snapshots sent to Gemini per request; not retained server-side beyond the request lifecycle (Google's standard ToS applies — call this out in any future store-distribution version).
- **NFR-6 Offline behavior:** Without network, app does not crash and does not silently fail. FR-6.4 error copy fires for any network-dependent action. FR-4 memory recall continues to work fully offline (local SQLite).
- **NFR-7 Reliability:** No crash on cold start. No unhandled exceptions reachable from dad's two-button flow. Crash, if it occurs, recovers to home screen on next launch without losing FR-3 catalog or FR-4 memory.
- **NFR-8 Memory freshness window:** FR-4 memory recall confidently answers from memory if last-seen is within 24 hours. 24–72 hours → answer with hedge ("ayer lo vi…"). >72 hours → fall through to live model call. Thresholds are config values — tunable at sideload after observing dad's usage rhythm.
- **NFR-9 TTS quality:** OS-native Argentine Spanish TTS is the v0.9 default on both platforms. Pre-MVP validation test 3 evaluates Android-side and iOS-side TTS independently — if either platform's OS TTS fails the quality bar on its target device, that platform falls back to ElevenLabs Spanish via HTTP API ($5/mo total, cross-platform). Same voice persona requirement (FR-6.3) applies regardless. Per-platform decision locked before architecture phase.
- **NFR-10 Distribution:**
  - *Android:* APK direct sideload to dad's phone. No Play Store. No update channel; new builds sideloaded by Charly.
  - *iOS:* TestFlight (leading candidate) or ad-hoc signing. Architecture phase locks the mechanism. No App Store.
  - No public storefronts in v0.9; both channels are invite-only.
- **NFR-11 Provider gateway:** All vision-model calls go through **OpenRouter**, not direct Google AI Studio API. Reasons: (a) provider-swappable for fallback if Gemini is down or degraded; (b) one-API-key + one-billing-line operational simplicity; (c) enables the cost-optimization A/B against Qwen2.5-VL-7B mentioned in brief Technical Approach without code rewrite, just a route swap; (d) keeps the migration story to on-device Gemma 4 (v3+) clean — only the gateway layer changes, not call sites. The specific OpenRouter client SDK or HTTP wrapper is the architect's call; the abstraction layer must remain gateway-agnostic so the cost-A/B path stays a configuration change, not a refactor.

## 6. User Flows

### Flow A: Describe at the kitchen counter
1. Dad opens Lola from home screen.
2. *Launch greeting:* "Hola, listo cuando quieras."
3. Dad taps the top button (Describe).
4. Phone: *looking* tap → snapshot captured → *thinking* pulse begins.
5. ~1.5s later: *thinking* stops, *answer-ready* double-tap.
6. TTS: "Estás frente a la mesada. Hay una taza, la pava, y la lata de yerba Cruz de Malta a tu derecha."
7. Where-is-X log silently writes entries for `taza`, `pava`, `yerba`.

### Flow B: Ask "where is my toothbrush?"
1. Dad opens Lola, hears greeting.
2. Taps Ask (bottom button).
3. Phone: *looking* → snapshot → *listening* tap.
4. Dad: "¿Dónde está mi cepillo?"
5. STT closes on silence; pattern matches memory-recall.
6. FR-4 lookup: `cepillo de papá` last seen 3 hours ago, room hint = "baño."
7. *Answer-ready* double-tap.
8. TTS: "La última vez vi tu cepillo hace 3 horas, en el baño."

### Flow C: Ask about object in hand
1. Dad picks up an unfamiliar tea box, opens Lola, taps Ask.
2. *Looking* → snapshot of the box → *listening*.
3. Dad: "¿Qué tengo en la mano?"
4. Snapshot + question + FR-3 catalog → Gemini.
5. Response: "Es una caja de té de manzanilla, marca La Virginia."
6. TTS reads response. Where-is-X logs `té de manzanilla`.

### Flow D: Repeat the last Describe
1. Dad taps Describe, hears response, didn't catch it.
2. Dad taps Ask, says "Lola, ¿otra vez?"
3. STT matches repeat pattern → FR-1 repeat path.
4. TTS re-reads the previous Describe response without re-snapshotting.

### Flow E: Charly runs Remember-this at sideload
1. Charly installs APK, hands dad the phone to test the splash.
2. Later, with dad watching, Charly tap-holds the splash logo for 5 seconds.
3. English setup screen opens.
4. Charly photographs the mate jar from two angles, types "yerba Cruz de Malta — la lata verde y dorada de la cocina."
5. Repeat for ~5–10 objects. Save. Exit.
6. Hands dad the phone. Dad sees the home screen with two buttons. Never sees setup again.

## 7. Out of Scope (v0.9)

Decisively out. PRD shall not re-litigate; architecture and stories shall reject scope creep on any of these:

- Public storefront distribution (Play Store, App Store). v0.9 ships invite-only on both platforms.
- Continuous / always-on camera vision.
- Any neck-worn, wrist-worn, or external sensor hardware.
- On-device vision model (Gemini cloud only in v0.9; Gemma 4 migration is v3+).
- Goal-led companion mode (#5) → v1.1.
- Morning routine lane (#29) → v1.1.
- "Where was I going?" recovery (#11) → v1.1.
- Smart-home awareness (#10) → v2.0.
- Help-Now safety / fall detection (#20) → v1.1 unless sight degrades faster than expected.
- Family-in-the-loop features (#21, #22, #24, #25) → v1.5.
- Soul-of-product features (#12, #30, #31, #32, #13, #8) → v2.0.
- Legacy module (#14, #15, #19) → v2.5.
- Multi-user accounts, family permissions, dad-facing settings UI.
- Volume-button input as alternative trigger.
- Voice cloning of family members (#23 — killed in brainstorming).
- Cloud sync of any user data.
- Cross-disability scope expansion.

## 8. Dependencies & Open Items

### Locked before architecture phase (pre-MVP validation, Week 1)
- **V1:** 90-min side-by-side test with dad — Microsoft Seeing AI ✅ done; Google Lookout *pending*; Be My AI *pending*. Complete before architecture.
- **V2:** Gemini 2.5 Flash latency on 20 dad-home photos. Target ≤2s button-to-audio (NFR-1).
- **V3:** Argentine Spanish TTS quality test on *both* dad's Android phone and Charly's iOS device. Outcome locks NFR-9 per platform — OS-native or ElevenLabs (independent decision per platform).
- **V4:** Confirm dad's Android phone model + OS version, *and* Charly's iOS device model + iOS version. Locks framework ceiling, sensor availability, TTS asset path on both platforms.

### Deferred to [bmad-create-architecture](../../../../)
- Hybrid framework selection: Capacitor / React Native / Flutter — must support both Android and iOS targets (V4 input gates this).
- iOS distribution mechanism: TestFlight (leading candidate) vs. ad-hoc signing. Apple Developer Program enrollment required either way.
- Memory log schema: per-object record shape, per-room scoping mechanism, decay/freshness policy enforcement (NFR-8 is the policy; schema is the architecture).
- Noun-phrase extractor for FR-4 write path: heuristic vs. small on-device model.
- Snapshot cache lifecycle and storage budget.
- Telemetry mechanism for week-2 success/failure measurement (local log + Charly check-in call vs. opt-in metric POST to Charly-controlled endpoint).

### Open for product decision after architecture
- Voice asset specifics if NFR-9 falls to ElevenLabs (which voice; tone calibration with two dad-targeted test lines).
- App icon and splash visual design (Charly's call; out of PRD scope).

## 9. Suggested Epic Decomposition

Hand-off to [bmad-create-epics-and-stories](../../../../). Six epics, ordered by build dependency:

- **E1 — Foundation:** Project scaffold (framework per architecture, building to both Android and iOS targets), `es-AR` locale, TTS plumbing at 0.85× on both platforms, STT plumbing on both, camera capture wrapper on both, Lola persona copy module, launch greeting (FR-6.2), heartbeat haptic primitive (FR-5 patterns on both platforms — vibration APIs differ between Android and iOS).
- **E2 — Describe:** FR-1 end-to-end. Snapshot → Gemini 2.5 Flash → TTS → memory write. Confidence/network error copy wired. (FR-6.4 partial.)
- **E3 — Ask:** FR-2 end-to-end on top of E2's shared model and TTS layer. STT capture, utterance routing (repeat / extend / memory / model), known-object catalog injection (depends on E4).
- **E4 — Remember-this-for-me:** FR-3 hidden setup flow, object catalog persistence, photo capture and storage. English UI for Charly. AC3.1 (un-discoverability) is a story-level testing concern.
- **E5 — Where-is-X:** FR-4 write path integrated into E2/E3 success paths; read path integrated into E3 utterance router. Local SQLite schema + freshness logic (NFR-8).
- **E6 — Distribution & observe:** Android APK build (debug-signed, direct install). iOS build via the architecture-locked mechanism (TestFlight or ad-hoc). Apple Developer Program enrollment. On-device telemetry per architecture's choice (cross-platform). Week-2 measurement hooks. Validation V1–V4 results captured in repo before this epic closes.

E1 blocks all others. E2 unblocks E3. E4 unblocks E3's catalog injection. E5 layers into E2 and E3. E6 is the closeout.

## 10. Resolved PRD-Level Decisions

The brief left these items unspecified; the PRD resolved them and Charly accepted at review pass 1 (2026-05-26). Canonical spec lives inline in the FRs/NFRs above; this section is the audit trail.

1. **FR-3 entry gesture — LOCKED:** Tap-and-hold the Lola splash logo for 5 seconds during launch. No on-screen affordance.
2. **FR-1 repeat / extend trigger routing — LOCKED:** Both `"¿otra vez?"` and `"contame más"` are detected through the Ask button's STT after the relevant prior action. No always-on wake word, no battery cost, no privacy footprint.
3. **NFR-8 memory freshness thresholds — LOCKED (config-tunable):** 24h confident answer · 24–72h hedged answer · >72h fall-through to live model call. Defaults; the thresholds are exposed as config values for tuning after observing dad's actual usage.
4. **FR-5 haptic patterns — LOCKED (sideload-tunable):** *looking* = 50ms tap; *thinking* = 200ms-on / 400ms-off pulse; *answer-ready* = 50ms / 100ms-gap / 50ms double-tap; *listening* = soft taps on open/close; *error* = 600ms long-soft pulse.

These four items, plus the brief inheritances captured in the decision log, are the full set of PRD decisions. Architecture phase inherits everything in Section 8 (still open) plus everything resolved here (locked).

## 11. Sign-off

- [x] Section 10 PRD-level decisions resolved (2026-05-26).
- [x] Platform posture: hybrid codebase, Android (dad, primary) + iOS (Charly, parallel) v0.9 targets (2026-05-26).
- [x] Charly final sign-off on FRs/NFRs as the implementation contract (2026-05-26).
- [x] Pre-MVP validation V1–V4 — partial accepted per Charly's standing instruction. V1 (competitor side-by-side) carries forward as best-effort; V2/V3/V4 to be completed in parallel with architecture work.
- [x] Status: `final`. Hand off to [bmad-create-architecture](../../../../).
