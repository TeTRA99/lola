---
stepsCompleted: [1, 2, 3-phase1]
inputDocuments: []
session_topic: 'Assistive vision mobile app for a sight-losing parent — voice-described surroundings + ask-anything mode, MVP on-phone with two large buttons, future neck-worn wearable with BT remote, eventual on-device model for privacy'
session_goals: 'Validate feasibility, widen UX ideation for elderly/low-vision users, find sharp MVP angle, surface adjacent / commercial / future-sensor ideas to park for later'
selected_approach: 'progressive-flow'
techniques_used: ['Sensory Exploration', 'Mind Mapping', 'SCAMPER', 'Resource Constraints']
ideas_generated: 32
phase1_complete: true
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Charly
**Date:** 2026-05-23

## Session Overview

**Topic:** Assistive vision app for sight-losing parent
**Goals:** Feasibility check + UX ideation for elderly/blind users + sharp MVP scope + parked future ideas (commercial, sensors, on-device model)

### Session Setup

**Why this project exists**
Personal project to help Charly's father, who is progressively losing sight and may eventually be fully blind.

**End-state vision (long-term)**
- Hardware: phone worn around the neck (camera facing forward) + Bluetooth remote with two buttons.
- Button 1 — "Describe": instantly captures + speaks back what is in front of him.
- Button 2 — "Ask": captures + listens for a spoken question (e.g., *"Do you see my toothbrush?"*) and answers using the image.
- Privacy goal: on-device / embedded model in the long run so nothing leaves the phone.
- Intelligence goal: app learns the home over time — remembers object locations ("last saw toothbrush yesterday in bathroom"), learns to navigate the house.

**MVP (Stage 1)**
- Hybrid mobile app (Android primary user, but cross-platform for simplicity).
- Two large on-screen buttons mirroring the future remote's "Describe" and "Ask" behaviors.
- Online model OK for MVP (e.g., OpenRouter or similar vision-LLM).
- Primary context of use: at home.
- Must actually be usable by his dad — this isn't a prototype that gets shelved.

**Target audience**
Elderly people with progressive vision loss or full blindness. Primary user is his father; secondary is the broader low-vision elderly population (potential commercial angle to park).

**Parked / future ideas (Charly already flagged)**
- On-device vision model for privacy
- Home-aware memory ("where did I last see X?")
- Sensor fusion: LiDAR/radar pocket sensors, autonomous-car-style spatial awareness
- Commercial / B2C productization

**Meta-goal for Charly**
Exercise the full BMad methodology end-to-end as a PM/entrepreneur — brief → PRD → epics → stories → ClickUp integration → build → test — and ship something his dad can actually use.

**Stage gating**
Charly is comfortable splitting work into stages if simpler. MVP first, then iterate toward the wearable + on-device + home-memory long-term vision.

## Technique Selection

**Approach:** Progressive Technique Flow

**Journey Design:** Systematic development from divergent exploration through to MVP-shaped action planning, hand-off to `bmad-product-brief`.

**Progressive Techniques:**

- **Phase 1 — Exploration:** *Sensory Exploration* — generate ideas across non-visual modalities (audio, haptic, temporal, spatial, social, environmental) to counter sighted assumptions and PM-default semantic clustering.
- **Phase 2 — Pattern Recognition:** *Mind Mapping* — cluster raw ideas into 3–5 emergent themes, surface "MVP candidates" vs. "park for later" pile.
- **Phase 3 — Development:** *SCAMPER* — refine top theme(s) through 7 structured lenses (Substitute, Combine, Adapt, Modify, Put-to-other-uses, Eliminate, Reverse).
- **Phase 4 — Action Planning:** *Resource Constraints* — force a sharp shippable MVP scope under realistic limits, produce clean parked-pile, define concrete week-1 actions.

**Journey Rationale:** Charly's concept has a defined core (assistive vision, two buttons, dad as user) but several genuinely open frontiers (UX for blind users, edge cases, sensor extensions, commercial). Widening before narrowing maximizes the chance that the converged MVP is the best one, not the first one. Phase 4 output is shaped to hand off cleanly to `bmad-product-brief`.

## Technique Execution Results

### Phase 1 — Sensory Exploration

**Status:** complete (32 ideas generated)

**Senses / domains explored:** Hearing & soundscape; Task / goal-led interaction; Companion presence; Memory & legacy; Touch/haptic (parked to v2 except #18); Safety; Social/caregiver; Daily routine integration.

**Major revelation during Phase 1:** Story-mode (Charly describing his dad's daily life) surfaced that the *actual* ask from his father is **"help me identify what's in my hand, and help me find what I'm looking for, in my own house."** That is the MVP. Everything else extends from it.

**Architectural constraint surfaced:** MVP is **snapshot-based**, not continuous camera processing. Any idea requiring an always-on AI vision feed (continuous hazard detection, real-time spatial audio of moving objects, live navigation) is parked to v2 / wearable hardware / on-device model track.

**Hardware constraint surfaced:** Dad currently wears nothing on neck/wrist. MVP can only assume phone (pocket/lanyard/hand) + optional single pair of earbuds. Haptic = phone vibration only. Wearable is a v2 decision.

**Complete idea list (Phase 1 — 32 ideas):**

**Hearing & Output UX**
- **[Audio #1]** Whisper Mode — quiet single-earbud TTS that doesn't drown out the real room.
- **[Audio #2]** Sonic Map, not Sentence — spatial audio chimes by object type, no language.
- **[Audio #3]** Voice of the Object — each object class has a characteristic audio "voice"/timbre.
- **[Audio #4]** 3D Spatial Audio (*Charly*) — relevant objects emit sound from their actual position via head-tracked spatial audio. Feasible today on AirPods Pro / Pixel Buds Pro for snapshot-based use.
- **[Haptic #18]** Heartbeat of Things — phone vibration encodes system state (looking / thinking / answer-ready). MVP-feasible. **KEEP.**

**Task / Goal-Led & Core Use Cases**
- **[Task #5]** Goal-Led Companion Mode (*Charly*) — user states intent ("make breakfast"), companion actively guides through house.
- **[Task #10]** Smart-Home Awareness — vision is the fallback; the home already knows things via smart plugs/NFC/Google Home.
- **[Task #11]** "Where Was I Going?" Recovery — goal-led mode remembers current goal across distractions.
- **[Core #26]** "What is this?" — flagship daily action. Identify object in hand from a snapshot.
- **[Core #27]** "Remember this for me" — personalized recognition; pre-tag objects in dad's home so the model knows *his* yerba mate jar, his toothbrush, his meds.
- **[Core #28]** "Where is X?" — passive object-location memory built as a byproduct of normal use.
- **[Daily #29]** Morning Routine Lane — gentle sequenced guidance through getting-up tasks at his own pace.

**Framing**
- **[Frame #6]** Companion, Not Tool (*Charly*) — category-shifting framing decision. Product is a companion with assistive function as side effect, not the reverse.

**Companion & Daily Ritual**
- **[Companion #7]** She Has a Name — companion has a chosen name, voice, personality.
- **[Companion #8 — refined]** Ambient Comment with a Volume Dial (*Charly's nuance*) — volunteers observations; user picks Silent / Soft / Warm / Heavy; voice-changeable.
- **[Companion #12]** Bridging the Loneliness Loop — detects isolation signals, *routes him to humans* (reads, calls, music) rather than substituting for them.
- **[Daily #30]** Mate Mode — culturally specific: recognizes mate brand, knows the pava is heating, integrates with his ritual.
- **[Daily #31]** Soccer Companion — knows his team, alerts him to matches, narrates moments the radio misses.
- **[Daily #32]** Boredom as a First-Class Problem — idle-time engagement: audiobook chapters, family voice messages, memory prompts, language games.

**Legacy & Memory**
- **[Companion #13]** Prompted Reminiscence — companion gently elicits stories; weaves details back later.
- **[Memory #14]** Old Photos Brought Back to Life — describes dad's existing photo library; an assistive feature that produces something *better* than what sighted users get.
- **[Memory #15]** Story Bank — captured stories become a permanent family archive; voice preserved after he's gone.
- **[Legacy #19]** Letters to the Grandkids (*Charly*) — recorded stories/lessons addressed to specific named recipients; asynchronous voice-only inheritance.

**Safety & Family Trust**
- **[Safety #20]** Help, Now (*Charly*) — fall detection + verbal trigger + button-hold; escalation ladder to family then emergency services.
- **[Safety #25]** Has Dad Left the House? (*Charly*) — configurable geofence + family alert on unexpected exit; disarmable.
- **[Social #21]** Family Eyes — one-tap video call to family who can see his camera feed; Be My Eyes scoped to *his* family.
- **[Social #22]** Quiet Status — opt-in lightweight family dashboard; reduces anxiety without surveillance.
- **[Social #24]** Quiet Day Nudge (*Charly's reframe of killed #23*) — companion senses low engagement, sends private nudge to family suggesting they call. Better than substituting for the relationship.

**Parked (Future Hardware / Continuous AI Vision)**
- **[Haptic #16 — parked]** Compass on the Skin — requires neck/chest wearable to be stable; needs continuous vision.
- **[Haptic #17 — parked]** Hazard Pulse — requires continuous always-on camera feed; not MVP-shaped.

**Killed**
- **[Social #23 — killed]** Voice of Loved Ones — Charly's call: emotionally too much, voice-cloning of family/late wife is in the "uncanny / could backfire" zone. Reframed into #24 instead.

### Phase 2 — Mind Mapping

**Status:** complete

**Clustering result — 5 themes around the central need *"Help me identify what's in my hand, and find what I'm looking for, at home"*:**

- **🎯 Cluster A — CORE: Identify, Find, Navigate at Home** — #5, #10, #11, #26, #27, #28, #29
- **🎙️ Cluster B — OUTPUT UX (cross-cutting plumbing)** — #1, #2, #3, #4, #18
- **💛 Cluster C — Companion & Daily Ritual** — #6, #7, #8, #12, #30, #31, #32
- **📚 Cluster D — Legacy & Memory** — #13, #14, #15, #19
- **🤝🛡️ Cluster E — Family in the Loop + Safety (Trust Layer)** — #20, #21, #22, #24, #25

**MVP decision (Charly):** **Cluster A + #18 heartbeat only.** Everything else goes to later milestones. The PM-tight call: optimize for time-to-his-hands, not for cheap-to-add features.

**Pending sub-decision (flagged for confirmation):** Even though no companion *features* ship in MVP, the **companion *frame* (#6)** is a zero-cost decision that shapes app name, voice persona, splash, error copy, settings copy. Resolution to be captured at Phase 3 entry.

### Phase 3 — SCAMPER (on Cluster A)

**Status:** complete

**S — Substitute (locked decisions):**
- **Input trigger:** Two large on-screen buttons, split-screen 50/50 (Charly's choice — dad still has some sight; volume buttons deferred to v2)
- **Vision provider — MVP:** *Gemini 2.5 Flash* via Google AI Studio API or OpenRouter (cheapest SOTA tier, strong Spanish, low latency, natural migration path to on-device Gemma 4)
- **Vision provider — v2/v3 on-device:** *Google Gemma 4 E2B/E4B* (open-weight multimodal designed for mobile, same family as cloud model = clean migration)
- **Vision provider — budget alternative for A/B:** *Qwen2.5-VL-7B* via Replicate ($0.05/M tokens, 15–50× cheaper than SOTA tier) — flag-gated for cost-optimization testing post-MVP
- **Output channel:** Phone speaker by default, connected earbuds when paired
- **Framing:** Companion frame confirmed — name, voice persona, greetings, error-as-gentle-question shape MVP copy

**C — Combine:**
- #26 + #27 + #28 implemented as *one unified flow* (snapshot + LLM + memory log byproduct) — not three separate features
- #18 Heartbeat baked into every action as cross-cutting feedback layer
- #5 + #29 deferred — both require orchestration on top of primitives; v1.1

**A — Adapt:**
Study before designing: Microsoft Seeing AI (UX patterns), Google Lookout (Android-native gesture/contrast patterns), Be My Eyes "Be My AI" (description prompt quality). Action item for Charly: 1–2 hours of side-by-side testing with dad before writing PRD.

**M — Modify (tuned defaults for elderly low-vision Argentine Spanish user):**
- TTS speed: 0.85×
- Description length: short first, "tell me more" voice command for detail
- Confidence threshold: <70% → "I'm not quite sure — can you try a bit closer?"
- Repeat: single read by default; "Lola, again?" replays
- Language: Argentine Spanish, locale-set
- Buttons: 50/50 split-screen, high contrast, icons over text
- Launch greeting: *"Hola, listo cuando quieras"*

**P — Put to other uses:**
MVP scope = dad only. Spanish-speaking accessibility market is real and underserved (commercial moat parked for future). No cross-disability scope expansion in MVP.

**E — Eliminate (final MVP scope):**
- **KEEP:** #26 What is this · #27 Remember this · #28 Where is X · #18 Heartbeat
- **CUT to v1.1:** #5 Goal-led mode · #29 Morning Routine Lane
- **CUT to v2:** #10 Smart-home awareness · #11 Where was I going
- **Final MVP feature count: 4.**

**R — Reverse:**
- App speaks first on launch (companion frame, $0 cost)
- Errors phrased as gentle questions, not statements
- "Describe" button = proactive (scene-wide); "Ask" button = targeted (voice prompt)

### Phase 3 — MVP Spec (locked)

```
APP MVP v0.9 — "For Dad"

Two large buttons, split-screen 50/50:
  • TOP    — Describe (scene-wide narration on snapshot)
  • BOTTOM — Ask      (snapshot + voice question)

Core features:
  • #26 What is this?  (flagship action)
  • #27 Remember this for me (optional setup mode)
  • #28 Where is X?  (free byproduct memory)
  • #18 Heartbeat of Things (haptic feedback layer)

Vision: Gemini 2.5 Flash via API
TTS:    OS-native, 0.85× speed, Argentine Spanish
STT:    OS-native (Ask mode voice capture)
Output: Phone speaker; earbuds when paired
Frame:  Companion — chosen name, greeting on launch
Errors: Spoken as gentle questions
Platform: Hybrid (Capacitor / React Native / Flutter)
```

### Phase 4 — Resource Constraints

**Status:** complete

**Constraints imposed:** Solo builder (Charly) · 6–8 week timeline to "in dad's hands" · $30/month API budget · $0 new hardware for dad · Hybrid framework (Capacitor/React Native/Flutter) · Sideload distribution (no app store cycles for MVP).

**Constraint test result:** The 4-feature MVP (#26 + #27 + #28 + #18) holds. Gemini 2.5 Flash usage at expected volume stays well under budget. Solo dev with reasonable Capacitor/RN chops can ship in 6–8 weeks.

### Final Backlog (Brief-Ready)

**🚀 MVP — v0.9 "For Dad" (6–8 weeks):** #26, #27, #28, #18 + companion frame (name, greeting, gentle errors).

**🌱 v1.0 — Polish pass (~2 weeks post-MVP):** based on dad's actual usage feedback, not pre-decided.

**🎯 v1.1 — Daily Rhythm (1–2 months post-MVP):** #5, #29, #11, #8 (Soft level), #20 ← *promote to MVP if sight degrades faster than expected*.

**🤝 v1.5 — Family in the Loop (3–4 months post-MVP):** #21, #22, #25, #24.

**💛 v2.0 — Soul of the Product:** #12, #30, #31, #32, #13.

**📚 v2.5 — Legacy Module (potential commercial path):** #14, #15, #19.

**🔮 v3+ — Hardware & On-Device:** neck-worn holster + BT remote, Gemma 4 E2B migration, #10, #16, #17, full #4.

### Pre-MVP Validation Plan (Week 1, before PRD)

1. 90-min side-by-side test with dad: Microsoft Seeing AI, Google Lookout, Be My AI. Capture frustrations and delights.
2. Gemini 2.5 Flash latency test on 20 photos of dad's actual home objects. Target ≤2s button-to-audio.
3. Argentine Spanish TTS quality test on dad's phone. Fallback option: ElevenLabs Spanish ($5/mo) for companion voice if Android TTS is robotic.
4. Confirm dad's phone model and Android version. Locks framework choice, sensor availability, TTS ceiling.

### Week-by-Week Plan (Hand-off to BMad)

| Week | BMad Action |
|---|---|
| 1 | Pre-MVP validation + `bmad-product-brief` |
| 2 | `bmad-prd` (skip `bmad-create-ux-design` — UX is "two big buttons") |
| 3 | `bmad-create-architecture` + `bmad-create-epics-and-stories` + `bmad-sprint-planning` (sync ClickUp) |
| 4–7 | Story cycle: `bmad-create-story` → `bmad-dev-story` → `bmad-code-review` per story |
| 8 | Sideload to dad's phone. Observe. The real next product brief is what he says next. |

### Strategic Carry-Forward Notes

1. **The companion frame is the moat.** Without it: competing with Microsoft/Google = losing. With it: different category.
2. **Spanish-Argentine specificity is a feature, not a constraint.** Bake in day one. Resist "localize later."
3. **Identify + memory-log is unfair architecture.** Every "what is this?" silently builds "where is X?" for free. Lock in architecture doc.
4. **Two products in one roadmap.** MVP is assistive-vision. Long game is companion. Don't lose sight of the second one.
5. **Legacy module (v2.5) is the commercial spinoff path** — family-pays-for-grandparent's-stories is clean B2C with high ARPU. Park; revisit only post-v1.0.

### MVP Validation (post-session, 2026-05-25)

Charly validated MVP scope with his father directly and via comparative testing with Microsoft Seeing AI. Dad confirmed the three core actions are the right ones:

- "Describe what the camera sees" → maps to **#26 Describe button**
- "Ask a question about something" → maps to **#26 Ask button** (snapshot + voice prompt)
- "Remember where something was" → maps to **#28 Where is X?**

**Validation outcome: 4-feature MVP scope confirmed.** #27 (Remember this for me) retained as **mandatory first-launch onboarding** — done by Charly at sideload time with dad present, tagging ~5–10 most-used items (mate jar, toothbrush, key meds, kettle, radio, common tea boxes). Single linear flow, no skip logic. Dad never sees a setup screen again after first launch. #18 Heartbeat retained as cross-cutting feedback layer.

**Charly's decision: advance to `bmad-product-brief`.**

## Session Complete

**Total ideas generated:** 32 (Phase 1)
**Clusters identified:** 5 (Phase 2)
**Refined and scoped:** 4-feature MVP via SCAMPER (Phase 3)
**Constrained and roadmapped:** v0.9 → v3+ with week-1 actions (Phase 4)

### Creative Facilitation Narrative

Session went from "I have an idea for an image recognition app for my dad" to "the MVP is 4 features, the architecture is locked, the validation plan is written, and the next BMad skill is queued" — in 4 phases without losing the emotional core that makes the product worth building.

**Breakthrough moments:**
- *Phase 1 story-mode* surfaced the actual product anchor (identify-find-navigate-at-home) hidden under the broader assistive-vision frame.
- *Phase 1 companion frame (#6)* shifted the product category. Charly named the framing; the facilitator amplified it.
- *Phase 1 legacy theme* surfaced four times unprompted — flagged as the long-term commercial spinoff direction.
- *Phase 2* clarified that Output UX is a *cross-cutting concern*, not a standalone direction.
- *Phase 3 SCAMPER* tightened MVP from 7 features to 4 by deferring orchestration features to v1.1.
- *Phase 3 vision provider research* corrected stale model recommendations to current SOTA (Gemini 2.5 Flash + Gemma 4 migration path).

**User creative strengths:**
- Strong, fast critique of feasibility (haptic #16/#17 → continuous-camera issue).
- Ability to *kill* his own ideas with reframes (#23 → #24 nudge).
- Repeated return to emotional core (memory/legacy) showed real signal.
- Disciplined MVP scoping (rejected my "include cheap companion features" suggestion in favor of tighter scope).

**Energy flow:** Sustained engagement across 4 phases. Story-mode produced the densest idea generation. PM discipline took over at Phase 2/3.

### Next BMad Action

→ Run **`bmad-product-brief`** *(menu code `[CB]`)* in a fresh context window. This session file is the input. The brief will formalize the v0.9 scope, target user (dad + secondary audience), feasibility validation plan, and v1.1+ roadmap into the structured product-brief artifact that feeds `bmad-prd`.

**Optional first:** Run the **Pre-MVP Validation Plan** (90 min with dad + 30 min latency tests) before kicking off `bmad-product-brief`. The brief will be stronger if grounded in observed reality rather than assumed reality.




