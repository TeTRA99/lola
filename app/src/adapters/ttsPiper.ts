// Piper (VITS) on-device TTS via react-native-sherpa-onnx — FEASIBILITY HARNESS.
//
// Goal of this first pass: prove the native module links on our RN/Expo build
// and measure generation latency on the low-end Galaxy A12 before investing in
// the full download/extraction/fallback pipeline. It plays via the library's
// built-in streaming PCM player (play-while-generating).
//
// The sherpa-onnx import is dynamic + guarded so the *current* dev client
// (which predates this native module) doesn't crash if this code hot-reloads
// before the rebuild — it only works once rebuilt with the module.
//
// Feasibility model location: the app's external files dir, which `adb push`
// can write to without root. We drop an extracted Piper model folder there.

import { now } from '@/utils/time';

export const PIPER_TEST_DIR =
  '/storage/emulated/0/Android/data/com.carlosbernardi.lola/files/piper-voice';

type StreamingEngine = {
  getSampleRate(): Promise<number>;
  startPcmPlayer(sampleRate: number, channels: number): Promise<void>;
  writePcmChunk(samples: number[]): Promise<void>;
  stopPcmPlayer(): Promise<void>;
  generateSpeechStream(
    text: string,
    options: undefined,
    handlers: {
      onChunk: (c: { samples: number[]; sampleRate: number }) => void;
      onEnd: () => void;
      onError: (e: unknown) => void;
    },
  ): Promise<unknown>;
  destroy(): Promise<void>;
};

let engine: StreamingEngine | null = null;

/**
 * Speak `text` with the Piper model in `modelDir`, playing via the library's
 * PCM player. Logs init / first-chunk / total-generation timings so we can read
 * real on-device latency from logcat. Returns false if the native module or
 * model isn't available (so callers can fall back to system TTS).
 */
export async function speakPiperTest(text: string, modelDir = PIPER_TEST_DIR): Promise<boolean> {
  try {
    const t0 = now();
    if (!engine) {
      const mod = await import('react-native-sherpa-onnx/tts');
      engine = (await mod.createStreamingTTS({
        modelPath: { type: 'file', path: modelDir },
        modelType: 'vits',
      })) as unknown as StreamingEngine;
      console.log('[piper] engine init ms:', now() - t0);
    }
    const sr = await engine.getSampleRate();
    console.log('[piper] sampleRate:', sr);
    await engine.startPcmPlayer(sr, 1);

    const tGen = now();
    let firstChunkMs = 0;
    await new Promise<void>((resolve, reject) => {
      void engine!.generateSpeechStream(text, undefined, {
        onChunk: (c) => {
          if (!firstChunkMs) {
            firstChunkMs = now() - tGen;
            console.log('[piper] first chunk ms:', firstChunkMs);
          }
          void engine!.writePcmChunk(c.samples);
        },
        onEnd: () => {
          console.log('[piper] total generation ms:', now() - tGen);
          void engine!.stopPcmPlayer().then(resolve);
        },
        onError: (e) => {
          console.log('[piper] generate error:', e);
          void engine!.stopPcmPlayer().then(() => reject(e));
        },
      });
    });
    return true;
  } catch (e) {
    console.log('[piper] speakPiperTest failed:', e);
    return false;
  }
}
