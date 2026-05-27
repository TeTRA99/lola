---
title: "Sprint Plan — Lola v0.9"
status: final
created: 2026-05-27
updated: 2026-05-27
revision: 1
source_epics_and_stories: "../../planning-artifacts/epics-and-stories/epics-and-stories-Lola-2026-05-26/epics-and-stories.md"
source_architecture: "../../planning-artifacts/architecture/architecture-Lola-2026-05-26/architecture.md"
---

# Sprint Plan: Lola v0.9

*Sequences the 30 stories from the epics-and-stories backlog into 7 one-week sprints plus a 3-day Pre-Sprint validation block. Honors the §3 dependency graph from epics-and-stories. Doubles as the running status tracker (`bmad-sprint-status` updates the **Actual** columns as work lands).*

## 1. Source Documents

- [Epics & Stories (final rev 1)](../../planning-artifacts/epics-and-stories/epics-and-stories-Lola-2026-05-26/epics-and-stories.md)
- [Architecture (final rev 3)](../../planning-artifacts/architecture/architecture-Lola-2026-05-26/architecture.md)
- [PRD (final rev 4)](../../planning-artifacts/prds/prd-Lola-2026-05-26/prd.md)
- [Brief (final rev 4)](../../planning-artifacts/briefs/brief-Image%20Recognition%20App-2026-05-25/brief.md)

## 2. Schedule at a Glance

| Sprint | Dates (Mon–Sun) | Theme | Story IDs | Days budget |
|---|---|---|---|---|
| Pre-Sprint | Wed 2026-05-27 → Fri 2026-05-29 | Pre-MVP validation + Apple Dev kickoff | V1, V2, V3, V4, E6.2 (start) | 3 |
| Sprint 1 | Mon 2026-06-01 → Sun 2026-06-07 | Foundation: scaffold + half the adapters | E1.1, E1.2, E1.3, E1.5, E1.7, E1.8 | ~3.25 |
| Sprint 2 | Mon 2026-06-08 → Sun 2026-06-14 | Foundation finish + Describe wiring | E1.4, E1.6, E2.1, E2.2 | ~5 |
| Sprint 3 | Mon 2026-06-15 → Sun 2026-06-21 | Describe complete + Remember-this | E2.3, E2.4, E2.5, E4.1, E4.2, E4.3, E4.4 | ~4.25 |
| Sprint 4 | Mon 2026-06-22 → Sun 2026-06-28 | Ask + start Where-is-X | E3.1, E3.2, E3.3, E3.4, E5.1, E5.4 | ~4.25 |
| Sprint 5 | Mon 2026-06-29 → Sun 2026-07-05 | Where-is-X finish + distribution scaffolding | E5.2, E5.3, E6.1, E6.3, E6.4 | ~3 |
| Sprint 6 | Mon 2026-07-06 → Sun 2026-07-12 | Sideload prep + buffer | E6.2 (finalize), E6.5, polish, manual E2E | ~3–5 |
| Sprint 7 | Mon 2026-07-13 → Sun 2026-07-19 | Sideload to dad + observe | sideload, week-1 observe, fixes | full sprint, partly reactive |

**Target sideload date:** Monday 2026-07-13 to dad's Android phone. **Hard ceiling:** Friday 2026-07-24 (8 weeks from today). Plan has ~1 sprint of true buffer (Sprint 6); anything beyond a 5-day slip in any prior sprint compresses Sprint 6 to zero or pushes sideload past the brief's 8-week ceiling.

## 3. Pre-Sprint — Validation week (Wed 2026-05-27 → Fri 2026-05-29)

Three days remaining this week. Purpose: every architecture assumption gets a reality check on real devices, AND Apple Developer Program enrollment is in motion before Sprint 1 starts (it has wait time outside our control).

| Day | Activity | Output |
|---|---|---|
| Wed 05-27 | V4 — confirm dad's Android model + OS, Charly's iOS device + iOS version. **Apple Dev status check** — Charly believes he may already have an account; if yes, V4 just verifies; if no, decide between (a) submit application now (~1–2 day wait), or (b) defer iOS target to v1.0 and ship Android-only v0.9. | `docs/validation/V4-devices.md`; Apple Dev path locked (existing / applying / Android-only). |
| Thu 05-28 | V1 — 90-min side-by-side with dad: Lookout + Be My AI (Seeing AI ✅ already done). Capture frustrations/delights. | `docs/validation/V1-competitor-side-by-side.md` |
| Fri 05-29 | V2 — Gemini 2.5 Flash latency test on 20 dad-home photos (target ≤2s button-to-audio). V3 — TTS/STT locale probes on both devices (does `es-AR` voice/locale exist? if not, which fallback fires?). | `docs/validation/V2-latency.md`; `docs/validation/V3-tts-stt.md` |

**Decisions locked at Pre-Sprint close:**
- TTS-fallback choice per platform (OS-native vs. ElevenLabs $5/mo) — sets `NFR-9` finalize and the value of `TTS_LOCALE_FALLBACKS` array.
- STT-fallback choice per platform — same shape, sets `STT_LOCALE_FALLBACKS`.
- Apple Dev application status (cleared / pending / blocked).

**Plan/Actual fields** (filled by `bmad-sprint-status`):
- Validation completion: ☐ V1 ☐ V2 ☐ V3 ☐ V4
- Apple Dev status: ☐ submitted ☐ approved
- Sprint 1 entry blockers: ___

## 4. Sprint 1 — Foundation, half pass (Mon 2026-06-01 → Sun 2026-06-07)

**Goal:** Scaffolded Expo project runs on both Charly's iOS device and his test Android, opens to splash with the FR-6.2 greeting, shows two unfunctioning Home buttons. CopyModule has every Spanish string; SQLite schema is created on first launch.

**Stories committed (6, ~3.25 days):**

| Story | Title | Est | Deps met? |
|---|---|---|---|
| E1.1 | Expo project scaffold + EAS config | M | yes |
| E1.2 | `es-AR` locale + CopyModule skeleton | S | yes |
| E1.3 | TTS adapter + greeting integration | S | E1.2 |
| E1.5 | Camera adapter | S | E1.1 |
| E1.7 | SQLite migrations + schema v1 | S | E1.1 |
| E1.8 | `Result<T,E>` type + service skeletons | XS | E1.1 |

**Deferred to Sprint 2:** E1.4 (STT — depends on V3 fallback decisions, lighter to do after V3 results land), E1.6 (Haptic adapter, L — biggest single story, deserves a dedicated half-sprint).

**Sprint 1 Definition of Done:**
- `expo prebuild && eas build -p ios --profile development` produces a runnable build on Charly's iOS.
- Same for Android local emulator at minimum.
- Cold start fires FR-6.2 greeting in Argentine Spanish at 0.85× speed.
- SQLite tables exist; verified via a manual select on `expo-sqlite` debug.
- No service throws raw exceptions in dev — `Result<T,E>` returned everywhere.

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 5. Sprint 2 — Foundation finish + Describe wiring (Mon 2026-06-08 → Sun 2026-06-14)

**Goal:** All adapters complete. Describe flow is plumbed end-to-end (button → snapshot → Gemini → TTS) but UI polish lives in Sprint 3.

**Stories committed (4, ~5 days):**

| Story | Title | Est | Deps |
|---|---|---|---|
| E1.4 | STT adapter + 20-utterance test fixture | M | V3 results |
| E1.6 | Haptic adapter with all five FR-5 patterns | L | E1.1 (the biggest single story) |
| E2.1 | OpenRouterClient + Lola prompt template | M | E1.1 |
| E2.2 | DescribeService orchestration | M | E1.3, E1.5, E1.6, E2.1 |

**Sprint 2 Definition of Done:**
- Voice command STT works on Charly's iOS for the 20-utterance fixture at ≥80% accuracy.
- All five FR-5 haptic patterns distinguishable by hand on both platforms.
- Pressing Describe (even with a temporary debug button) returns an Argentine-Spanish narration via TTS.

**Risk note:** E1.6 is L (1–2 days) — if CoreHaptics behavior on iOS is uncooperative, this could eat into E2 work. Mitigation: bench E1.6 first with a placeholder, ship the haptic-feedback-rich version by sprint end.

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 6. Sprint 3 — Describe complete + Remember-this in parallel (Mon 2026-06-15 → Sun 2026-06-21)

**Goal:** Describe is dad-presentable. FR-3 setup flow exists and Charly can run a real 5-object onboarding on the dev build.

**Stories committed (7, ~4.25 days):**

| Story | Title | Est | Deps |
|---|---|---|---|
| E2.3 | HomeScreen Describe button | S | E2.2 |
| E2.4 | Repeat / extend snapshot-cache layer | S | E2.2 |
| E2.5 | Confidence + network error copy wiring | XS | E2.2, E1.2 |
| E4.1 | LaunchSplash 5-second hold gesture | S | E1.1 |
| E4.2 | SetupScreen UI (English, Charly-facing) | M | E4.1 |
| E4.3 | Photo capture + reference image storage | S | E4.2, E1.5 |
| E4.4 | Catalog read/write to SQLite + display-name resolution | M | E1.7, E4.3 |

**Sprint 3 Definition of Done:**
- Dad-substitute (Charly) can press Describe; gets a snapshot-grounded Argentine-Spanish answer; hears "no estoy segura" copy when occluded.
- Charly can enter setup via the 5-second logo hold, tag 5 objects in <10 minutes (AC3.5), and exit. Catalog persists across restarts.

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 7. Sprint 4 — Ask + start Where-is-X (Mon 2026-06-22 → Sun 2026-06-28)

**Goal:** The full conversational loop is wired. Ask button works; the utterance router dispatches between repeat / extend / memory / model. Sightings start logging.

**Stories committed (6, ~4.25 days):**

| Story | Title | Est | Deps |
|---|---|---|---|
| E3.1 | Utterance router | M | E1.4 |
| E3.2 | AskService (snapshot-before-STT flow) | M | E3.1, E2.1, E1.4 |
| E3.3 | Ask button on HomeScreen | XS | E3.2 |
| E3.4 | Known-object catalog injection | S | E2.1, E4.4 |
| E5.1 | Sightings write path | S | E1.7, E2.2, E3.2 |
| E5.4 | Canonicalization fuzzy match | M | E5.1, E4.4 |

**Sprint 4 Definition of Done:**
- Dad-substitute can ask *"¿qué tengo en la mano?"* and get a correct Argentine-Spanish answer that references catalog objects by display name (AC2.3).
- Every successful Describe and Ask writes ≥1 sighting (AC4.1).

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 8. Sprint 5 — Where-is-X finish + distribution scaffolding (Mon 2026-06-29 → Sun 2026-07-05)

**Goal:** Memory recall works end-to-end. Distribution toolchain is ready; debug screen surfaces telemetry.

**Stories committed (5, ~3 days — intentional buffer):**

| Story | Title | Est | Deps |
|---|---|---|---|
| E5.2 | Memory recall pattern + AskService integration | S | E5.1, E3.1 |
| E5.3 | Freshness-window logic | S | E5.2 |
| E6.1 | EAS production profiles + secrets | S | E1.1 |
| E6.3 | Android APK + sideload runbook | S | E6.1 |
| E6.4 | DebugScreen with usage_events query + export | M | E1.7, E4.1 |

**Sprint 5 Definition of Done:**
- Asking *"¿dónde está mi cepillo?"* answers from memory if Lola has seen it within the freshness window; falls through to live model call otherwise.
- `eas build -p android --profile production` produces an installable APK.
- DebugScreen reachable via 10s logo hold; shows working-signal pass/fail.

**Sprint 5 has ~2 days of slack** built in — first real buffer to absorb spillover from Sprints 1–4.

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 9. Sprint 6 — Sideload prep + buffer (Mon 2026-07-06 → Sun 2026-07-12)

**Goal:** Ready to put Lola in dad's hand. TestFlight build out to Charly's iOS, APK ready to sideload to dad's Android, validation paper trail closed.

**Stories committed:**

| Story | Title | Est | Deps |
|---|---|---|---|
| E6.2 | Apple Developer enrollment **finalize** + TestFlight first submit | M | Apple Dev approval (from Pre-Sprint) |
| E6.5 | Validation V1–V4 results captured to repo | S | V1–V4 done earlier; this story is the consolidation step |
| — | Manual end-to-end testing pass on both platforms | — | all earlier sprints |
| — | Buffer / rework / polish | — | — |

**Sprint 6 Definition of Done:**
- TestFlight build installable on Charly's iOS device.
- Production APK installed on a non-dev Android device end-to-end.
- All 4 validation docs exist in `docs/validation/` and the architecture's open-items list points at them.
- Charly has sat with dad in person to walk through Lola for 30 minutes (acceptance check before formal sideload).

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 10. Sprint 7 — Sideload to dad + observe (Mon 2026-07-13 → Sun 2026-07-19)

**Goal:** Lola is on dad's phone. Week-1 observation begins. The brief's success criteria start counting.

**Activities:**
- **Mon 07-13:** Sideload APK to dad's Android. Charly present. Walk dad through the two buttons.
- **Tue–Sun:** Observe. Daily check-in call. Capture any frustrations dad voices. Pull `usage_events` via DebugScreen at end of week.
- **Mid-sprint:** Any P0 fixes go out as a re-sideloaded APK. Lower-priority issues queue for Sprint 8 (if needed).

**Sprint 7 Definition of Done:**
- Sideload completed Monday.
- Week-1 usage telemetry collected by Sunday.
- Working-signal check is *too early* (need 2 weeks per brief) — that's Sprint 8/post-MVP.

**Plan/Actual:**
- Start: ☐  · End: ☐  · Carry-over: ___

## 11. Post-MVP (Sprint 8+)

Out of scope for this plan, but mentioned so the runway is honest:

- **Week 2 post-sideload (~07-20 → 07-26):** Success-signal measurement window per brief. Dad uses Describe ≥3×/wk AND Ask ≥3×/wk = working; zero usage any full week = failure trigger.
- **v1.0 brief / retrospective:** What dad actually does with Lola is the next product brief. The real one.

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Apple Dev enrollment stalls on identity verification | medium | blocks Sprint 6 E6.2 | Pre-Sprint Day 1: confirm Charly's existing account, or submit application now. **Contingency: if no account by Sprint 5, switch to Android-only sideload for v0.9 and defer iOS to v1.0** — the hybrid codebase still builds for both, only the distribution channel changes. |
| V3 finds OS TTS quality unacceptable on dad's Android | medium | +$5/mo ElevenLabs, +0.5 day adapter work | ElevenLabs HTTP adapter is design-budgeted in AD-1; not an architecture surprise. |
| E1.6 Haptic adapter eats more than 2 days | medium | compresses Sprint 2 finish | Land Describe end-to-end with placeholder haptics by Sprint 2 mid-point; iterate. |
| Gemini 2.5 Flash latency exceeds 2s on dad's home Wi-Fi | low | NFR-1 miss; user-perceived sluggishness | V2 catches early. Mitigations: smaller image (already 1024×1024 q=0.85), shorter prompts, swap to `2.5-flash-lite`. |
| Dad's sight degrades faster than expected before sideload | low | promote Help-Now (#20) from v1.1 to MVP | Out of architectural scope; product call. Flagged in brief. |
| Solo dev illness / life event | medium | direct day-for-day slip | No mitigation — Sprint 6 is the buffer. >5 day slip kills 6-week-end, 7- or 8-week-end still possible. |
| ClickUp plan cap on custom task types (already hit once) | low (now known) | reorganization annoyance | Documented in reference memory. No new typed tasks beyond the 6 Epics this MVP. |

## 13. Definition of "MVP shipped"

Per brief Success Criteria and the dev cycle's terminal state:

- ✅ All 30 stories `done`.
- ✅ All AC bullets from PRD §4 verified (AC1.1 → AC6.4).
- ✅ TestFlight build on Charly's iOS device.
- ✅ Production APK installed on dad's Android.
- ✅ Validation docs V1–V4 in repo.
- ✅ Week-1 observation underway; week-2 measurement window scheduled.

## 14. Hand-off to Dev Cycle

After Pre-Sprint validation closes Friday, the per-story dev cycle begins:

```
bmad-create-story (next story in sequence per this plan)
   ↓
bmad-create-story:validate
   ↓
bmad-dev-story (implement + tests)
   ↓
bmad-code-review
   ↓ (issues? back to bmad-dev-story; approved? next story)
bmad-create-story (next)
   ...
   ↓ (epic complete?)
bmad-retrospective (optional)
```

ClickUp Tasks (the 30 plain-Task subtasks under the 6 Epic-typed parents in the MVP List) will update status as each story moves. Sprint planner's responsibility is *sequence*; sprint-status's responsibility is *progress*.

## 15. Sign-off

- [x] Charly accepts the sprint sequencing (2026-05-27).
- [x] Pre-Sprint kickoff scheduled (validation activities slotted in Wed/Thu/Fri this week).
- [x] Apple Dev contingency acknowledged (existing account / apply now / Android-only fallback; resolved Day 1).
- [x] Status: `final`. Hand off to [bmad-create-story](../../../../) (start E1.1 once Pre-Sprint closes Friday 2026-05-29).
