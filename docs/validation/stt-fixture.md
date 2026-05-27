# V3 STT fixture — 20 Argentine-Spanish utterances

Record each utterance on both **dad's Android** and **Charly's iOS** during V3 validation. Mark hit (transcribed correctly) or miss in the checkboxes.

**Target:** ≥80% correct transcription (16/20) on each device. Below threshold → escalate to V3 result + evaluate ElevenLabs / OpenAI Whisper API as backup STT path (architecture-deferred).

## Core question shapes (AC2.1)

1. ¿Qué es esto?                                       [ ] Android   [ ] iOS
2. ¿Qué tengo en la mano?                              [ ] Android   [ ] iOS
3. ¿Dónde está mi cepillo?                             [ ] Android   [ ] iOS
4. ¿Viste mi yerba?                                    [ ] Android   [ ] iOS
5. ¿Dónde puse las llaves?                             [ ] Android   [ ] iOS

## Repeat / extend triggers (utterance router, E3.1)

6. Lola, ¿otra vez?                                    [ ] Android   [ ] iOS
7. Otra vez                                            [ ] Android   [ ] iOS
8. Lola, contame más                                   [ ] Android   [ ] iOS
9. Contame más                                         [ ] Android   [ ] iOS

## Object-name variations (catalog lookup robustness, E3.4)

10. ¿Cuál es la pava?                                  [ ] Android   [ ] iOS
11. ¿Es esta mi taza?                                  [ ] Android   [ ] iOS
12. ¿Dónde está el remedio de la presión?              [ ] Android   [ ] iOS

## Natural conversation (false-positive resistance)

13. Hola, ¿cómo estás?                                 [ ] Android   [ ] iOS
14. Gracias, Lola                                      [ ] Android   [ ] iOS
15. No, no es eso                                      [ ] Android   [ ] iOS

## Edge cases (background noise, partial)

16. (whispered) ¿Qué es?                               [ ] Android   [ ] iOS
17. (with TV) ¿Dónde está mi mate?                     [ ] Android   [ ] iOS
18. (incomplete) ¿Dónde…                               [ ] Android   [ ] iOS — should NOT transcribe
19. (silence after Lola)                               [ ] Android   [ ] iOS — should time out / no_speech
20. (dad clears throat first) Ehm… ¿Qué es esto?       [ ] Android   [ ] iOS

## Results summary

- Android hit rate: ___ / 20
- iOS hit rate: ___ / 20
- Final `es-AR` locale availability per device:
  - dad's Android (model: _______): es-AR / es-419 / es-MX / OTHER
  - Charly's iOS (model: _______): es-AR / es-419 / es-MX / OTHER
- Decision: keep OS-native STT / escalate to ElevenLabs / escalate to Whisper API
