export const CONFIG = {
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
  DEBUG_GESTURE_HOLD_MS: 10000,

  // "Guide me to it" proximity haptics (feat/guide-me-to-it spike).
  // Pulse RATE (not amplitude) encodes closeness — Android amplitude control is
  // weak; faster ticks read clearly even on Charly's Galaxy.
  GUIDE_PULSE_MIN_MS: 170,     // fastest tick — centered (raised 110→170: centered buzz felt "violent")
  GUIDE_PULSE_MAX_MS: 500,     // slowest tick — target far from center
  GUIDE_SEARCH_TICK_MS: 1400,  // soft, sparse tick when no target is in frame
  GUIDE_LOCK_PROXIMITY: 0.82,  // ≥ this = fastest "you're on it" buzz (was 0.92, unreachable)
  GUIDE_FOUND_PROXIMITY: 0.7,  // ≥ this → say "¡ahí está!" once (reachable; centering to 100% is unreliable)
  GUIDE_REARM_PROXIMITY: 0.4,  // proximity must drop below this before "found" can fire again
  GUIDE_NOT_FOUND_MS: 12000,   // if the target is never seen within this, say "no la encuentro"
  GUIDE_SMOOTH_ALPHA: 0.35,    // EMA on the felt proximity (lower = smoother/laggier ramp)
  GUIDE_LOST_GRACE_MS: 500,    // keep homing this long after a dropped frame before "searching"
  GUIDE_AUTO_CLOSE_MS: 15000,  // after "found", auto-return home this long later (tap exits anytime)
  GUIDE_PREPARING_MS: 6000,    // if the model isn't ready by now, tell the user it's preparing
};

export type Config = typeof CONFIG;
