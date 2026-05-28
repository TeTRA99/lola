# Pre-MVP Validation — index (E6.5)

The brief's PRD §8 gates Sprint 1+ dev on V1–V4 results in spirit; Charly's standing instruction (2026-05-26) accepts partial completion. Use this index to track status as each validation lands.

| ID | What | Status | File |
|---|---|---|---|
| V1 | Side-by-side with dad — Microsoft Seeing AI, Google Lookout, Be My AI | ☐ pending | [V1-competitor-side-by-side.md](./V1-competitor-side-by-side.md) |
| V2 | Gemini 2.5 Flash latency on 20 dad-home photos | ☐ pending | [V2-latency.md](./V2-latency.md) |
| V3 | TTS + STT locale availability on both devices | ☐ pending | [V3-tts-stt.md](./V3-tts-stt.md) (+ [stt-fixture.md](./stt-fixture.md)) |
| V4 | Device confirmation — model, OS version | ☐ pending | [V4-devices.md](./V4-devices.md) |

When a validation completes, flip its ☐ → ✅ here and write the outcome into its file.

## Architecture's open items reference back here

Per architecture rev 3 §10, V1–V4 results inform `src/config.ts` final values (e.g. NFR-9 TTS fallback decision per platform). Once V3 lands, update `TTS_LOCALE_FALLBACKS` / `STT_LOCALE_FALLBACKS` if needed.
