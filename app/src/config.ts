export const CONFIG = {
  // Dev tools (Debug 🐞 screen + Guide spike) are normally gated on __DEV__,
  // which is FALSE in the standalone Release builds Charly side-loads onto a
  // device for testing — so they'd be unreachable there. Flip this on to expose
  // them in a personal test build.
  // ⚠️ MUST be false for dad's production build (it's a Charly-only tool surface).
  SHOW_DEV_TOOLS: true,

  // Model + gateway (NFR-11, AD-4)
  MODEL_ID: 'google/gemini-2.5-flash',
  MODEL_ID_CHEAP: 'google/gemini-2.5-flash-lite',
  GATEWAY_BASE_URL: 'https://openrouter.ai/api/v1',

  // Locale + speech (NFR-4, NFR-9)
  TTS_LOCALE: 'es-AR',
  TTS_LOCALE_FALLBACKS: ['es-419', 'es-MX'] as const,
  TTS_RATE: 0.85,
  STT_LOCALE: 'es-AR',
  STT_LOCALE_FALLBACKS: ['es-419', 'es-MX'] as const,
  STT_END_OF_SPEECH_MS: 1200,
  STT_HARD_CAP_MS: 10000,

  // Vision + confidence
  CONFIDENCE_THRESHOLD: 0.70,

  // Snapshot cache (AD-5)
  CACHE_MAX_SNAPSHOTS: 50,
  CACHE_MAX_BYTES: 200 * 1024 * 1024,

  // Memory freshness (NFR-8, AD-3)
  MEMORY_FRESH_HOURS: 24,
  MEMORY_HEDGE_HOURS: 72,

  // Heartbeat haptic patterns (FR-5)
  HEARTBEAT_LOOKING_MS: 50,
  HEARTBEAT_THINKING_ON_MS: 200,
  HEARTBEAT_THINKING_OFF_MS: 400,
  HEARTBEAT_ANSWER_READY: [50, 100, 50] as const,
  HEARTBEAT_ERROR_MS: 600,

  // Hidden setup gestures (FR-3, AD-6)
  SETUP_GESTURE_HOLD_MS: 5000,

  // "Guide me to it" proximity haptics (feat/guide-me-to-it spike).
  // Pulse RATE (not amplitude) encodes closeness — Android amplitude control is
  // weak; faster ticks read clearly even on Charly's Galaxy.
  GUIDE_PULSE_MIN_MS: 170,     // fastest tick — centered (raised 110→170: centered buzz felt "violent")
  GUIDE_PULSE_MAX_MS: 500,     // slowest tick — target far from center
  GUIDE_SEARCH_TICK_MS: 1400,  // soft, sparse tick when no target is in frame
  GUIDE_LOCK_PROXIMITY: 0.82,  // ≥ this = fastest "you're on it" buzz (was 0.92, unreachable)
  GUIDE_FOUND_PROXIMITY: 0.7,  // ≥ this → say "¡ahí está!" once (reachable; centering to 100% is unreliable)
  GUIDE_REARM_PROXIMITY: 0.4,  // proximity must drop below this before "found" can fire again
  GUIDE_FOUND_COOLDOWN_MS: 11000, // min gap between "¡ahí está!" announcements (stops wobble-spam; still re-says if lost & re-found after this)
  GUIDE_NOT_FOUND_MS: 12000,   // if the target is never seen within this, say "no la encuentro"
  GUIDE_PREPARING_MS: 6000,    // if the model isn't ready by now, tell the user it's preparing
  // Pulse smoothing (rev: smooth Geiger ramp). The felt proximity is eased on a
  // STEADY clock (GUIDE_STEP_MS), decoupled from the beat AND from the ~7fps
  // detector, so the cadence glides instead of stepping. TAU is the time-constant
  // (ms) of the ease: lower = snappier/twitchier, higher = smoother/laggier.
  GUIDE_SMOOTH_TAU_MS: 220,       // proximity easing time-constant
  GUIDE_STEP_MS: 30,              // steady smoothing clock (must stay < GUIDE_PULSE_MIN_MS)
  // Lost-frame handling: instead of a hard "snap to searching", proximity stays
  // full for GUIDE_FRESH_MS (absorbs 1–2 dropped frames) then GLIDES to 0 over
  // GUIDE_DECAY_MS — no more fast→slow→fast lurch on detector dropouts.
  GUIDE_FRESH_MS: 250,            // detections newer than this hold full proximity
  GUIDE_DECAY_MS: 900,            // ease proximity → 0 over this once stale
  GUIDE_MAX_INTERVAL_DELTA_MS: 60, // cap how fast the beat may SLOW DOWN per beat (speed-ups free)
  // One Euro filter on the raw proximity (de-jitter when near-still, stay
  // responsive when sweeping fast). Tune on-device for a 0..1 signal at ~7fps.
  GUIDE_OE_MIN_CUTOFF: 1.0,       // Hz — smoothing when slow (lower = smoother/laggier)
  GUIDE_OE_BETA: 0.7,             // speed coefficient (higher = less lag when fast)
  GUIDE_OE_DCUTOFF: 1.0,          // Hz — derivative low-pass
  // Proximity = blend of how CENTERED the target is and how BIG it is (a distance
  // proxy) — so the pulse quickens as you approach, not only as you aim.
  GUIDE_CENTER_WEIGHT: 0.55,      // weight on centering vs object size (1 = centering only)
  GUIDE_REACH_SIZE: 0.6,          // box's larger side (frame fraction) that reads as "reached"
  // The Guide NEVER closes itself — a blind user must not be dropped silently
  // (FR/UX). Instead, after this long with the target not in view, Lola gives an
  // audible "still there? tap to exit" check-in and repeats it on this interval.
  // Tap is the only way out. GUIDE_CHECKIN_TICK_MS is just the poll granularity.
  GUIDE_CHECKIN_IDLE_MS: 60000, // idle (target unseen) this long → spoken check-in
  GUIDE_CHECKIN_TICK_MS: 5000,  // how often we poll the idle clock

  // Cloud "Guide me to it" SPIKE (open-vocab grounding via OpenRouter, Debug-only).
  // A cloud round-trip is ~1.5–3s, so this drives INTERMITTENT re-localization, not
  // the per-frame loop: capture a still every POLL_MS, ground it, refresh proximity.
  // The freshness/decay windows are stretched (vs the on-device ones above) so the
  // haptic rate rides between polls instead of collapsing to the "searching" tick.
  GUIDE_CLOUD_POLL_MS: 2500,         // re-localize cadence (one image request per poll)
  GUIDE_CLOUD_FRESH_MS: 1800,        // hold full proximity this long after a fresh box
  GUIDE_CLOUD_DECAY_MS: 2400,        // then glide proximity → 0 over this (no hard snap)
  GUIDE_CLOUD_MAX_DIM: 768,          // downscale captured frames to this before upload
  GUIDE_CLOUD_JPEG_QUALITY: 0.6,     // capture/compress quality for the uploaded frame
  GUIDE_CLOUD_MAX_POLLS: 60,         // hard cap on polls per session (cost backstop)
  GUIDE_CLOUD_MODEL_DEFAULT: 'google/gemini-3.5-flash',
  // Candidate grounding models (Debug picker). All do open-vocab boxes on OpenRouter;
  // box conventions differ — see groundingIsPixelBox()/parseGroundingBox in
  // adapters/objectDetection.ts (Gemini = normalized 0–1000 [ymin,xmin,ymax,xmax];
  // Qwen = absolute pixel [x1,y1,x2,y2]).
  GUIDE_CLOUD_MODELS: [
    'google/gemini-3.5-flash',
    'google/gemini-3.1-flash-lite',
    'qwen/qwen3-vl-8b-instruct',
    'google/gemini-2.5-flash',
  ] as const,

  // On-device inference (feat/on-device-models). Default mode flips to 'local'
  // in the final migration step; 450m is the realistic Galaxy A12 VLM size.
  LOCAL_INFERENCE_DEFAULT: 'cloud' as 'local' | 'cloud',
  LOCAL_VLM_DEFAULT_SIZE: '450m' as '450m' | '1.6b',
  // Text model for intent + guide-target. Llama 3.2 1B (non-thinking) — qwen3-0.6b
  // is a hybrid thinking model that errors in executorch's runner. Swappable via
  // Settings.textModel; ids: llama-3.2-1b | qwen2.5-0.5b | qwen2.5-1.5b | smollm2.1-360m.
  LOCAL_TEXT_MODEL: 'llama-3.2-1b',
  VLM_MAX_NEW_TOKENS: 128, // runaway guard only — high enough not to truncate a normal answer mid-sentence
  TEXT_LLM_MAX_NEW_TOKENS: 128,
  // Safety cap on a single on-device inference so a slow/hung run fails to a
  // calm error instead of sitting on "Un momento…" forever. Generous because the
  // first VLM call on a CPU-only A12 is slow (graph warmup + image encode).
  VLM_INFERENCE_TIMEOUT_MS: 120000,
  TEXT_LLM_INFERENCE_TIMEOUT_MS: 30000,
};

export type Config = typeof CONFIG;
