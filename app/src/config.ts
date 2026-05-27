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
};

export type Config = typeof CONFIG;
