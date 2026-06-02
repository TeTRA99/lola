// Simple key/value preferences backed by SQLite. In-process cache for hot
// reads (camera-capture path, etc.) so we don't hit the DB on every snapshot.

import { getDb } from '@/adapters/storage';

const cache: Map<string, string> = new Map();
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings',
    );
    for (const r of rows) cache.set(r.key, r.value);
  } catch { /* leave cache empty */ }
  loaded = true;
}

export async function getBool(key: string, fallback = false): Promise<boolean> {
  await ensureLoaded();
  const v = cache.get(key);
  if (v === undefined) return fallback;
  return v === '1';
}

/** Synchronous read after a load() — used in latency-sensitive paths. */
export function getBoolSync(key: string, fallback = false): boolean {
  const v = cache.get(key);
  if (v === undefined) return fallback;
  return v === '1';
}

export async function getString(key: string, fallback = ''): Promise<string> {
  await ensureLoaded();
  return cache.get(key) ?? fallback;
}

/** Synchronous read after a load() — used by the i18n initial resolve. */
export function getStringSync(key: string, fallback = ''): string {
  return cache.get(key) ?? fallback;
}

export async function setString(key: string, value: string): Promise<void> {
  await ensureLoaded();
  cache.set(key, value);
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  } catch { /* swallow — cache still reflects */ }
}

export async function setBool(key: string, value: boolean): Promise<void> {
  await ensureLoaded();
  const v = value ? '1' : '0';
  cache.set(key, v);
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, v],
    );
  } catch { /* swallow — cache still reflects */ }
}

/** Force a fresh load on the next read (used by tests). */
export function _resetForTests(): void {
  cache.clear();
  loaded = false;
}

// Eagerly load on module import so getBoolSync() works in the camera path.
void ensureLoaded();

export const KEYS = {
  quietCapture: 'quiet_capture',
  language: 'language',
  voice: 'tts_voice',
  ttsRate: 'tts_rate',
  ttsPitch: 'tts_pitch',
  idleHeartbeat: 'idle_heartbeat',
  userName: 'user_name',
  // First-run onboarding flags (set once, then suppressed forever).
  welcomeSeen: 'onboarding_welcome_seen',
  describeHintSeen: 'onboarding_describe_hint_seen',
  askHintSeen: 'onboarding_ask_hint_seen',
  guideHintSeen: 'onboarding_guide_hint_seen',
  heartbeatHintSeen: 'onboarding_heartbeat_hint_seen',
  caregiverIntroSeen: 'onboarding_caregiver_intro_seen',
  // On-device inference (feat/on-device-models). inferenceMode picks cloud vs
  // local; vlmModel picks the VLM size; allowCloudFallback lets local errors
  // retry against the cloud when a key is present (off by default = zero credits).
  inferenceMode: 'inference_mode',
  vlmModel: 'vlm_model',
  textModel: 'text_model',
  allowCloudFallback: 'allow_cloud_fallback',
  // Guide on-device detector quality (1=Minimum … 5=Maximum). Maps to a
  // (model, input-size) preset — see adapters/detectionPresets. Default is
  // per-platform (iOS Maximum, Android Minimum) resolved at read time.
  detectionLevel: 'detection_level',
  // Comma-separated set of detection model names whose .pte is already downloaded
  // (e.g. "yolo26n,yolo26m"). Lets Home show a one-time prep banner only when the
  // chosen level needs a model that isn't on the device yet.
  detectionModelsReady: 'detection_models_ready',
} as const;
