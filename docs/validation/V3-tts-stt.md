# V3 — TTS + STT locale availability on both devices

## TTS (Argentine Spanish voice)

Test from dev client by triggering the launch greeting on each device. Note which voice actually plays.

| Device | `es-AR` voice installed? | Falls back to | Quality (1–5) | Decision |
|---|---|---|---|---|
| Charly's iOS (model: _____, iOS _____) | ☐ yes / ☐ no | _es-419 / es-MX / OTHER_ | _ | _OS-native / ElevenLabs_ |
| Dad's Android (model: _____, Android _____) | ☐ yes / ☐ no | _es-419 / es-MX / OTHER_ | _ | _OS-native / ElevenLabs_ |

If either platform fails the quality bar, switch that platform to ElevenLabs ($5/mo) — adapter swap only, no other code change.

## STT (Argentine Spanish recognizer)

See [stt-fixture.md](./stt-fixture.md) for the 20-utterance test set. Run it on both devices. Target: ≥80% transcription accuracy.

| Device | Locale used | Hit rate | Decision |
|---|---|---|---|
| Charly's iOS | _es-AR / es-419 / es-MX_ | _/20_ | _accept / escalate_ |
| Dad's Android | _es-AR / es-419 / es-MX_ | _/20_ | _accept / escalate_ |

If hit rate <16/20 on either platform: evaluate ElevenLabs / OpenAI Whisper API as backup (architecture-deferred, would land in v1.0).

## Final config delta (none expected; fill in if any)

If V3 surfaces that `es-419` is the only reliable locale, update `app/src/config.ts`:
- `TTS_LOCALE_FALLBACKS` order — put `es-419` first
- `STT_LOCALE_FALLBACKS` — same

Rebuild + re-sideload.
