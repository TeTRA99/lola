// "Detection quality" ladder for the Guide's on-device object detector.
//
// One abstract level (1=Minimum … 5=Maximum) maps to a concrete (model, input
// size) preset, trading accuracy for speed. The user never sees "yolo26m@512" —
// just a slider in Setup. Higher levels detect more (smaller/specific objects
// like a ball) but cost more compute, so the live haptic homing runs at a lower
// frame rate. These YOLO models are CPU/XNNPACK (no Neural Engine), so FPS is
// compute-bound; measured on an iPhone 17 Pro @512: n=29ms, s=60, m=134ms.
//
// Default is per-platform: iOS (a powerful iPhone) starts at Maximum; Android
// (dad's weak A12 Galaxy — the priority/floor) starts at Minimum. A capable
// Android flagship could go higher; that finer per-device tuning is left for
// later (the slider already lets the caregiver raise it manually).

import { Platform } from 'react-native';
import { models } from 'react-native-executorch';
import * as Settings from '@/services/Settings';

export type DetectionLevel = 1 | 2 | 3 | 4 | 5;

// Union of the model descriptors we use (each accessor returns a distinct literal
// type), so a preset factory can return any of them.
type DetectionModel =
  | ReturnType<typeof models.object_detection.yolo26n>
  | ReturnType<typeof models.object_detection.yolo26s>
  | ReturnType<typeof models.object_detection.yolo26m>;

type Preset = {
  level: DetectionLevel;
  /** Lazy factory — returns the executorch model descriptor for useObjectDetection. */
  model: () => DetectionModel;
  inputSize: 384 | 512 | 640;
  /** Identity of the underlying .pte (levels sharing a file share a download). */
  modelName: 'yolo26n' | 'yolo26s' | 'yolo26m';
};

// Monotonic in both accuracy and cost: step model capacity first (it matters most
// for small-object recall), then refine with input resolution.
export const DETECTION_PRESETS: Record<DetectionLevel, Preset> = {
  1: { level: 1, model: () => models.object_detection.yolo26n(), inputSize: 384, modelName: 'yolo26n' },
  2: { level: 2, model: () => models.object_detection.yolo26s(), inputSize: 384, modelName: 'yolo26s' },
  3: { level: 3, model: () => models.object_detection.yolo26s(), inputSize: 512, modelName: 'yolo26s' },
  4: { level: 4, model: () => models.object_detection.yolo26m(), inputSize: 384, modelName: 'yolo26m' },
  5: { level: 5, model: () => models.object_detection.yolo26m(), inputSize: 512, modelName: 'yolo26m' },
};

export const MIN_DETECTION_LEVEL: DetectionLevel = 1;
export const MAX_DETECTION_LEVEL: DetectionLevel = 5;

/** Per-platform starting level (see module note). */
export function defaultDetectionLevel(): DetectionLevel {
  return Platform.OS === 'ios' ? 5 : 1;
}

/** Clamp an arbitrary number/string to a valid level. */
export function clampDetectionLevel(v: number): DetectionLevel {
  if (!Number.isFinite(v)) return defaultDetectionLevel();
  const n = Math.round(v);
  return Math.min(MAX_DETECTION_LEVEL, Math.max(MIN_DETECTION_LEVEL, n)) as DetectionLevel;
}

export function presetForLevel(level: DetectionLevel): Preset {
  return DETECTION_PRESETS[level];
}

/** Resolve the caregiver's chosen level (with the per-platform default fallback). */
export function currentDetectionLevel(): DetectionLevel {
  const raw = Settings.getStringSync(Settings.KEYS.detectionLevel, String(defaultDetectionLevel()));
  return clampDetectionLevel(parseInt(raw, 10));
}

// "Is this model's .pte already on the device?" — tracked in a Settings set so
// Home only shows the prep banner when a genuinely new model must be downloaded.
export function isModelDownloaded(modelName: string): boolean {
  const set = Settings.getStringSync(Settings.KEYS.detectionModelsReady, '');
  return set.split(',').filter(Boolean).includes(modelName);
}

export function markModelDownloaded(modelName: string): void {
  const cur = Settings.getStringSync(Settings.KEYS.detectionModelsReady, '');
  const set = new Set(cur.split(',').filter(Boolean));
  if (set.has(modelName)) return;
  set.add(modelName);
  void Settings.setString(Settings.KEYS.detectionModelsReady, Array.from(set).join(','));
}
