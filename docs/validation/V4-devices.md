# V4 — Device confirmation

Lock the physical-device assumptions Sprints 5+6 inherit. Both devices below must be confirmed before Sprint 6's TestFlight + APK builds go out.

## Dad's Android (primary user target)

- **Make + model:** _____
- **Android version:** _____
- **Available storage:** _____
- **RAM:** _____
- **TTS Spanish voices installed:** _____  (Settings → System → Languages → Text-to-speech output → Engines)
- **STT Spanish locales installed:** _____  (Settings → System → Languages → Voice typing)
- **Camera resolution (rear):** _____
- **Phone has consistent home Wi-Fi during waking hours?** _____  (NFR-1 latency assumes yes)
- **Earbuds dad uses (if any):** _____

## Charly's iOS (parallel-test target)

- **Make + model:** _____
- **iOS version:** _____
- **TestFlight installed:** _____
- **Apple Developer Program enrollment status:** _____  (see [testflight.md](../runbooks/testflight.md))

## Implications captured

After V4 results land, update:
- `app/eas.json` build profiles if any device-specific override needed
- This file's "Decision" line in [V3-tts-stt.md](./V3-tts-stt.md) per the actual locales installed
- Architecture rev 4 if assumptions shift (unlikely; the abstractions are device-agnostic)
