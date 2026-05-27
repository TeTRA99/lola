---
title: "Addendum — Lola Product Brief"
status: draft
created: 2026-05-25
updated: 2026-05-26
---

# Addendum — Lola Product Brief

Material that supports the brief but does not belong inside it. PRD, architecture, and later workflows draw from here.

Primary source: [`_bmad-output/brainstorming/brainstorming-session-2026-05-23-0955.md`](../../../brainstorming/brainstorming-session-2026-05-23-0955.md) — full Charly-led 4-phase brainstorming session, 32 ideas, MVP locked, roadmap to v3+. This addendum extracts what PRD/architecture will need quickly without re-loading the whole session.

## Contents

1. [Strategic Carry-Forward Notes](#strategic-carry-forward-notes-verbatim-from-brainstorming)
2. [Tuned Defaults for the Primary User](#tuned-defaults-for-the-primary-user)
3. [Vision-Provider Research Trail](#vision-provider-research-trail)
4. [Full Idea Inventory (32 ideas)](#full-idea-inventory-32-ideas-phase-1)
5. [Phase 2 Clustering Map](#phase-2-clustering-map)
6. [Pre-MVP Validation Plan](#pre-mvp-validation-plan-week-1-before-prd)
7. [Week-by-Week Plan](#week-by-week-plan-hand-off-to-bmad-pipeline)
8. [Rejected-Alternative Rationale](#rejected-alternative-rationale-so-prd-doesnt-relitigate)

## Strategic Carry-Forward Notes (verbatim from brainstorming)

1. **The companion frame is the moat.** Without it: competing with Microsoft/Google = losing. With it: different category.
2. **Spanish-Argentine specificity is a feature, not a constraint.** Bake in day one. Resist "localize later."
3. **Identify + memory-log is unfair architecture.** Every "what is this?" silently builds "where is X?" for free. Lock in architecture doc.
4. **Two products in one roadmap.** MVP is assistive-vision. Long game is companion. Don't lose sight of the second one.
5. **Legacy module (v2.5) is the commercial spinoff path** — family-pays-for-grandparent's-stories is clean B2C with high ARPU. Park; revisit only post-v1.0.

## Tuned Defaults for the Primary User

(Argentine Spanish, late-life progressive vision loss, limited tech tolerance — from SCAMPER M phase.)

- **TTS speed:** 0.85×
- **Description length:** short first; "Lola, contame más" command for detail.
- **Confidence threshold:** <70% → *"No estoy segura — ¿podés acercarte un poquito?"* (no guesses)
- **Repeat:** single read by default; *"Lola, ¿otra vez?"* replays.
- **Language:** Argentine Spanish, locale set.
- **Buttons:** 50/50 split-screen, high contrast, icons over text.
- **Launch greeting:** *"Hola, listo cuando quieras."*
- **Errors as gentle questions, never statements.**

## Vision-Provider Research Trail

Locked in SCAMPER S phase after correction from stale defaults. PRD/architecture should defend the choice using this:

- **MVP (cloud):** Gemini 2.5 Flash via Google AI Studio API or OpenRouter. SOTA multimodal tier, strong Spanish, low latency. Budget headroom: $30/mo at one-elderly-user volume.
- **v3+ (on-device):** Google Gemma 4 E2B/E4B. Open-weight multimodal designed for mobile. Same family as cloud model = clean migration without re-prompting the application surface.
- **Cost-optimization A/B post-MVP:** Qwen2.5-VL-7B via Replicate. $0.05/M tokens — 15–50× cheaper than SOTA tier. Flag-gated for cost testing when/if audience grows.

## Full Idea Inventory (32 ideas, Phase 1)

PRD may pull from this; architecture should be aware that the long-game roadmap (v1.1 → v3+) draws from these IDs.

### Hearing & Output UX (Cluster B)
- **#1 Whisper Mode** — quiet single-earbud TTS that doesn't drown out the room.
- **#2 Sonic Map, not Sentence** — spatial audio chimes by object type, no language.
- **#3 Voice of the Object** — each object class has a characteristic audio voice/timbre.
- **#4 3D Spatial Audio** — relevant objects emit sound from their actual position via head-tracked spatial audio. Feasible today on AirPods Pro / Pixel Buds Pro for snapshot-based use. → v3+.
- **#18 Heartbeat of Things** — phone vibration encodes system state. **MVP.**

### Task / Goal-Led & Core (Cluster A)
- **#5 Goal-Led Companion Mode** — user states intent ("make breakfast"), companion guides. → v1.1.
- **#10 Smart-Home Awareness** — smart plugs/NFC/Google Home as fallback context. → v2.0.
- **#11 "Where Was I Going?" Recovery** — goal-led mode remembers across distractions. → v1.1.
- **#26 What is this?** — flagship daily action. **MVP.**
- **#27 Remember this for me** — pre-tag dad's specific objects. **MVP (one-shot onboarding).**
- **#28 Where is X?** — passive object-location memory. **MVP (free byproduct of #26).**
- **#29 Morning Routine Lane** — gentle sequenced guidance through getting-up. → v1.1.

### Framing (Cluster C)
- **#6 Companion, Not Tool** — category-shifting framing decision. **MVP (zero-cost frame).**

### Companion & Daily Ritual (Cluster C)
- **#7 She Has a Name** — chosen name, voice, personality. **MVP (Lola).**
- **#8 Ambient Comment with a Volume Dial** — Silent / Soft / Warm / Heavy. → v1.1 at Soft.
- **#12 Bridging the Loneliness Loop** — detects isolation, routes to humans, doesn't substitute. → v2.0.
- **#30 Mate Mode** — recognizes mate brand, knows the pava is heating. → v2.0.
- **#31 Soccer Companion** — knows his team, alerts to matches. → v2.0.
- **#32 Boredom as First-Class Problem** — idle-time engagement. → v2.0.

### Legacy & Memory (Cluster D)
- **#13 Prompted Reminiscence** — companion elicits stories, weaves back. → v2.0.
- **#14 Old Photos Brought Back to Life** — describes existing photo library. → v2.5.
- **#15 Story Bank** — captured stories become a family archive. → v2.5.
- **#19 Letters to the Grandkids** — recorded stories addressed to named recipients. → v2.5.

### Safety & Family Trust (Cluster E)
- **#20 Help, Now** — fall detection + verbal trigger + button-hold + escalation. → v1.1 (promote to MVP if sight degrades faster than expected).
- **#21 Family Eyes** — one-tap video call to family; Be My Eyes scoped to *his* family. → v1.5.
- **#22 Quiet Status** — opt-in family dashboard; reduces anxiety without surveillance. → v1.5.
- **#24 Quiet Day Nudge** — senses low engagement, nudges family to call. → v1.5.
- **#25 Has Dad Left the House?** — geofence + family alert; disarmable. → v1.5.

### Parked (Future Hardware / Continuous AI Vision)
- **#16 Compass on the Skin** — requires neck/chest wearable + continuous vision. → v3+.
- **#17 Hazard Pulse** — requires continuous always-on camera feed. → v3+.

### Killed
- **#23 Voice of Loved Ones** — voice-cloning of family/late wife. Emotionally too much, uncanny risk. Reframed into #24. **Do not revive.**

## Phase 2 Clustering Map

For PRD's mental model of why the roadmap is shaped as it is:

- **🎯 Cluster A — CORE: Identify, Find, Navigate at Home** (#5, #10, #11, #26, #27, #28, #29) — **MVP draws here.**
- **🎙️ Cluster B — OUTPUT UX (cross-cutting plumbing)** (#1, #2, #3, #4, #18) — #18 is MVP; rest is v3+ wearable.
- **💛 Cluster C — Companion & Daily Ritual** (#6, #7, #8, #12, #30, #31, #32) — #6+#7 are MVP frame; rest is v2.0.
- **📚 Cluster D — Legacy & Memory** (#13, #14, #15, #19) — v2.0/v2.5 (commercial spinoff).
- **🤝🛡️ Cluster E — Family in the Loop + Safety (Trust Layer)** (#20, #21, #22, #24, #25) — v1.1 (#20) + v1.5 (rest).

## Pre-MVP Validation Plan (Week 1, before PRD)

1. 90-min side-by-side test with dad: Microsoft Seeing AI ✅ done 2026-05-25, Google Lookout pending, Be My AI pending. Capture frustrations and delights.
2. Gemini 2.5 Flash latency test on 20 photos of dad's actual home objects. Target ≤2s button-to-audio.
3. Argentine Spanish TTS quality test on dad's phone. Fallback option: ElevenLabs Spanish ($5/mo).
4. Confirm dad's phone model and Android version. Locks framework choice, sensor availability, TTS ceiling.

## Week-by-Week Plan (Hand-off to BMad pipeline)

| Week | BMad Action |
|---|---|
| 1 | Pre-MVP validation + `bmad-product-brief` (this brief) |
| 2 | `bmad-prd` (skip `bmad-create-ux-design` — UX is "two big buttons") |
| 3 | `bmad-create-architecture` + `bmad-create-epics-and-stories` + `bmad-sprint-planning` (sync ClickUp) |
| 4–7 | Story cycle: `bmad-create-story` → `bmad-dev-story` → `bmad-code-review` per story |
| 8 | Sideload to dad's phone. Observe. The real next product brief is what he says next. |

## Rejected-Alternative Rationale (so PRD doesn't relitigate)

- **Volume buttons as trigger** — deferred to v2. Dad still has some sight; on-screen buttons are sufficient and clearer.
- **Companion features in MVP (e.g. Mate Mode, Soccer Companion)** — Charly explicitly rejected the facilitator's suggestion to include cheap companion features in MVP. Tight scope wins; companion *frame* (zero-cost) ships; companion *features* wait.
- **Cross-disability scope expansion in MVP** — rejected. Dad-only. Spanish-speaking accessibility market parked for post-v1.0.
- **Continuous camera processing** — rejected for MVP architecturally. Snapshot-based only. Any "always-on" idea is v3+ wearable territory.
- **Voice cloning of family / late wife (#23)** — killed outright. Uncanny risk + emotional cost. Reframed to #24 nudge-the-family instead.
