---
title: "Product Brief — Lola"
status: final
created: 2026-05-25
updated: 2026-05-26
revision: 4
---

# Product Brief: Lola

*An Argentine-Spanish-speaking companion for Charly's father, who is progressively losing his sight.*

## Executive Summary

Lola is a mobile app for one specific person — Charly's father, an Argentine Spanish-speaking man with late-life progressive vision loss — and, if she works for him, for an audience of millions like him. The MVP is four features that answer the only three things he has actually asked for help with: *what is in my hand, what is in front of me, where did I last see X.* The category move is that Lola is framed as a companion, not a tool: she has a name, she speaks first when the app opens, her errors are gentle questions, her Spanish is his Spanish. The assistive function is the side effect of a presence in his pocket.

Why now: vision-LLM cost and latency crossed the threshold in 2025–26 — Gemini 2.5 Flash gives state-of-the-art multimodal answers in Argentine Spanish for under $30/month at the volume one elderly user generates, with a clean migration path to on-device Gemma 4 when privacy matters more than capability. The technical lift is small. The product judgment is what's hard, and the brainstorming work (2026-05-23) already did most of it. Charly solo-builds v0.9 in 6–8 weeks: Android APK sideloaded to his dad's phone (primary target), plus an iOS build to Charly's own device for parallel testing.

## The Problem

Charly's father — Argentine, late-life, progressive vision loss that may end in full blindness — has a specific lived problem, narrower than the generic "blind people need help" framing of the assistive-tech category. Story-mode in the brainstorming session surfaced it, and side-by-side testing with him on 2026-05-25 confirmed it: the three things he actually asks for are *describe what you see, answer a question about it, remember where things are in my house.*

How he copes today: he asks family. He gives up. He uses the wrong jar. The dignity cost — being a grown man who needs help finding his own toothbrush — is real and motivating. As his sight degrades further, that cost compounds and the family burden grows.

Existing tools (Microsoft Seeing AI, Google Lookout, Be My Eyes' Be My AI) cover the technical surface but miss three things that matter for *him*: Argentine Spanish that sounds like his Spanish, a companion frame instead of a tool frame, and personalization to *his* objects (his mate jar, his meds, his toothbrush — not generic "a jar"). Seeing AI was tested with dad on 2026-05-25 and validated the action set; Lookout + Be My AI side-by-side testing is still pending per the brainstorming validation plan.

## The Solution

Lola lives on dad's Android phone. The home screen is two large buttons, split-screen 50/50, high contrast, icons over text — **Describe** (top: snapshot, Lola narrates the scene in Argentine Spanish) and **Ask** (bottom: snapshot plus voice question, e.g., "¿Ves mi cepillo de dientes?"). Four features underneath:

1. **#26 What is this? / Ask** — the flagship. Snapshot → Gemini 2.5 Flash → TTS, 0.85× speed.
2. **#27 Remember this for me** — one-shot onboarding flow run by Charly at sideload, tagging ~5–10 of dad's most-used objects (mate jar, toothbrush, key meds, kettle, radio, common tea boxes). Dad never sees a setup screen again.
3. **#28 Where is X?** — passive memory log built as a byproduct of every Describe/Ask. Queryable in natural language. Free, architecturally.
4. **#18 Heartbeat** — phone vibration as system-state feedback: *looking*, *thinking*, *answer ready*. Cross-cutting layer beneath the two buttons.

The companion frame sits over all of it. Lola has a name. She speaks first on launch — *"Hola, listo cuando quieras."* Her errors are gentle questions ("No estoy segura — ¿podés acercarte un poquito?"), not statements of failure. Her voice persona is consistent across every line of copy in the app. This is a zero-cost decision in MVP — it shapes greetings, button labels, error text, splash screen — but it is the foundation of what Lola becomes in v2.0 and beyond.

## What Makes This Different

Three differentiators, honestly framed (the brainstorming was explicit that we should not fabricate technical moats):

1. **Companion frame is the moat — and the moat is editorial, not technical.** Anyone can call Gemini. Microsoft Seeing AI is a tool; Google Lookout is a feature inside Android; Be My Eyes is a service. Lola is a presence — chosen name, consistent voice, learns this house. Builders default to tool-shaped framing; sustaining a companion frame requires consistency across thousands of small copy choices — every greeting, every error, every button label. That's an editorial standard held across the whole product, not a feature any single engineering ticket ships. Cheap to copy in the abstract; expensive to copy in practice.
2. **Argentine-Spanish specificity, day one.** Mate is not a beverage with a translation; it is a worldview. Existing tools are English-first → English-perfect, Spanish-acceptable. Lola is Spanish-Argentine-okay → English-not-yet. For the Spanish-speaking elderly low-vision audience (the parked secondary market), that direction of polish is the difference between "useful tool" and "the one that gets it."
3. **Identify + memory is unfair architecture.** Every "What is this?" silently logs "where was that object last seen." #28 Where-is-X is free relative to #26 — it is a byproduct of the core flow, not a separate feature requiring its own build. Three of the four MVP features ship for the engineering cost of two.

## Who This Serves

**Primary user (v0.9):** Charly's father. Argentine Spanish speaker, late-life progressive vision loss, limited tech tolerance. Lives in his own home. Android phone (model TBD pre-MVP). Currently wears no neck/wrist hardware; will use one pair of earbuds if paired. Cares about his mate ritual, his soccer team, his family. He is the only user the v0.9 design needs to satisfy. If Lola is wrong for him, every other user is downstream noise.

**Secondary (parked, post-v1.0):** The Spanish-speaking elderly low-vision audience. Real, underserved, commercial moat available if v1.0 validates with dad. Not a v0.9 design constraint — but the Argentine-Spanish-first decisions made in v0.9 (TTS, vocabulary, error tone, mate-jar awareness) are the foundation a commercial v2.0+ would build on.

**Tertiary (parked, post-v2.5):** Families who would pay to preserve a grandparent's stories — the legacy module is the cleanest B2C spinoff hypothesis (details in Vision). Different audience, different price point, same companion frame.

## Success Criteria

**Working signal (after week 2 post-sideload):**
- Dad uses **Describe ≥3×/week**, unprompted.
- Dad uses **Ask ≥3×/week**, unprompted.

Both required. These are the only numbers we need; they are observable from on-device telemetry (or a quick weekly check-in call). If both hit, Lola is doing her job.

**Failure signal:**
- **Zero usage in any full calendar week.** Triggers retro + pivot-or-rebuild decision. No second chances on this one — it means the product is not in his life.

**Implicit (per brainstorming, worth watching but not gating):**
- Dad refers to "Lola" by name in conversation about the app — the companion frame landed.
- Frustration moments (witnessed or self-reported) drop relative to pre-Lola baseline. Qualitative; not a number we'll hit cleanly.

## Scope

### In, v0.9 (6–8 weeks, solo build, sideload to dad's phone)

- Two on-screen buttons (Describe, Ask), 50/50 split, high contrast, icons + text.
- Four features: #26 Describe/Ask · #27 Remember-this-for-me (Charly-run, one-time) · #28 Where-is-X (passive) · #18 Heartbeat.
- Argentine Spanish TTS @ 0.85× speed (OS-native; fallback ElevenLabs Spanish at $5/mo if OS output is too robotic).
- Argentine Spanish STT for Ask flow (OS-native).
- Lola companion frame: name, launch greeting (*"Hola, listo cuando quieras"*), gentle-question error copy, consistent voice persona.
- Earbud passthrough when paired; phone speaker default.
- Distribution: Android APK sideloaded direct to dad's phone (primary target, no Play Store); iOS build to Charly's device via TestFlight or ad-hoc (mechanism deferred to architecture; TestFlight is the leading candidate).
- Local on-device storage for the Where-is-X memory log. No cloud sync in v0.9.
- Confidence-threshold UX: <70% triggers "no estoy segura — ¿podés acercarte?" rather than a guess.
- Repeat-last via "Lola, ¿otra vez?" voice command.

### Explicitly out, v0.9

(These are deferred decisively — not "we'll see if there's time." PRD should not relitigate.)

- Public store distribution (Google Play, Apple App Store). v0.9 ships via Android APK sideload + iOS TestFlight/ad-hoc only — invitation-only, no public listings. Public storefronts are v1.5+.
- Continuous camera processing / always-on vision. Snapshot-based only.
- Hardware: neck-worn phone holster, BT remote with two buttons, LiDAR/radar sensors. All v3+.
- On-device vision model. Cloud Gemini 2.5 Flash for MVP; Gemma 4 migration is v3+.
- Goal-led "make breakfast" companion mode (#5) → v1.1.
- Morning Routine Lane (#29) → v1.1.
- "Where was I going?" recovery (#11) → v1.1.
- Smart-home awareness (#10) → v2.0.
- Help-Now safety / fall detection (#20) → v1.1 *unless dad's sight degrades faster than expected, in which case promote*.
- Family-in-the-loop features: video call (#21), family dashboard (#22), geofence (#25), quiet-day nudge (#24) → v1.5.
- Soul-of-the-product features: loneliness routing (#12), Mate Mode (#30), Soccer Companion (#31), Boredom-as-problem (#32), prompted reminiscence (#13), volume-dial ambient comments (#8) → v2.0.
- Legacy module: old-photo description (#14), story bank (#15), letters to grandkids (#19) → v2.5 (commercial spinoff candidate).
- Multi-user accounts, family permissions, settings UI for dad — he never sees a settings screen. Charly configures at sideload.
- Volume-button input as alternative trigger → v2.
- Voice cloning of family members (#23 — killed in brainstorming; emotionally too much).

## Technical Approach

(Locked in brainstorming Phase 3 SCAMPER; PRD/architecture phase resolves the open items.)

- **Framework:** Hybrid mobile. Capacitor / React Native / Flutter. Specific choice deferred to architecture phase; pre-MVP validation (TTS/STT quality on *both* dad's Android phone and Charly's iOS device) feeds the decision. v0.9 builds and ships both targets.
- **Vision provider (MVP):** Gemini 2.5 Flash via Google AI Studio API or OpenRouter. SOTA tier, strong Spanish, low latency, $30/mo budget validated as sufficient at expected snapshot volume.
- **Vision provider (v3+):** Gemma 4 E2B/E4B on-device. Same family as cloud model = clean migration when privacy outweighs capability.
- **Cost-optimization A/B (post-MVP):** Qwen2.5-VL-7B via Replicate, flag-gated. 15–50× cheaper than SOTA — relevant if/when audience grows.
- **TTS:** OS-native Argentine Spanish @ 0.85× speed. Fallback: ElevenLabs Spanish ($5/mo) if OS quality fails the test on dad's phone.
- **STT:** OS-native, Argentine Spanish locale.
- **Output:** Phone speaker default; auto-route to earbuds when paired.
- **Storage:** Local SQLite (or framework-equivalent) for the Where-is-X memory log. No cloud sync in v0.9.

## Vision

Lola is two products in one roadmap. The MVP is assistive-vision; the long game is companion. Don't lose sight of the second one.

- **v1.0 — Polish pass (~2 weeks post-MVP).** Tuning from dad's actual usage. Not pre-decided.
- **v1.1 — Daily Rhythm (1–2 months post-MVP).** Goal-led companion mode (#5), morning routine lane (#29), where-was-I-going (#11), ambient comments at Soft level (#8). Promote Help-Now (#20) here if sight degrades faster than expected.
- **v1.5 — Family in the Loop (3–4 months post-MVP).** Family video call (#21), opt-in family dashboard (#22), geofence (#25), quiet-day nudges to family (#24).
- **v2.0 — Soul of the Product.** Loneliness routing (#12), Mate Mode (#30), Soccer Companion (#31), Boredom-as-problem (#32), prompted reminiscence (#13). This is where Lola stops being a vision tool and becomes a companion in full.
- **v2.5 — Legacy Module (commercial spinoff candidate).** Old-photo description (#14), story bank (#15), letters to grandkids (#19). Family-pays-for-grandparent's-stories is the cleanest B2C hypothesis. Revisit only post-v1.0.
- **v3+ — Hardware & On-Device.** Neck-worn phone holster + BT remote with two buttons, on-device Gemma 4 migration (privacy + offline), smart-home awareness (#10), hazard pulse and compass (#16, #17), full 3D spatial audio (#4).

## Open Questions & Pre-MVP Validation

**Validation to complete before PRD (per brainstorming):**

1. 90-min side-by-side test with dad: Microsoft Seeing AI ✅ (done 2026-05-25), Google Lookout (pending), Be My AI (pending). Complete before PRD kicks off.
2. Gemini 2.5 Flash latency test on 20 photos of dad's actual home objects. Target ≤2s button-to-audio.
3. Argentine Spanish TTS quality test on dad's Android phone *and* Charly's iOS device. Lock fallback decision per platform (OS-native vs. ElevenLabs).
4. Confirm dad's Android phone model + OS version, and Charly's iOS device model + iOS version. Locks framework choice + TTS ceiling on both platforms.

**Open for PRD / architecture phase:**

- Hybrid framework selection (Capacitor / React Native / Flutter).
- Memory log schema for #28 Where-is-X (per-object record, per-room scoping, decay/freshness policy, conflict resolution when an object is seen in multiple places).
- Companion voice asset decision: OS TTS vs. ElevenLabs, based on test 3.
- Whether to record on-device usage telemetry for the week-2 success/failure measurement, and how Charly accesses it (local log file, weekly check-in call, both).

**Settled (noted here so PRD inherits it):** "Lola" is the companion name and the product brand — app icon, splash, and any future store listing all say Lola. The "Image Recognition App" project folder name is administrative and dies at the brief.
