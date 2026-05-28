# Android sideload runbook (E6.3)

## 1. Build the production APK

```bash
cd app
npx eas-cli@latest build -p android --profile production
```

EAS reports a download URL when the build finishes (~10–15 min on free tier). Save the APK locally — you'll need it again for updates.

## 2. Transfer to dad's Android

Three options (pick whichever fits dad's phone setup):

- **USB + adb** (cleanest, fastest)
  ```bash
  adb install path/to/lola.apk
  ```
- **AirDrop / email / Google Drive link** — dad opens the link/attachment, downloads, taps.
- **Download direct on dad's phone** — open the EAS build URL in his browser, save, install.

## 3. First-install only: enable Install from Unknown Sources

Android Settings → Apps → Special access → Install unknown apps → pick the source app dad will install from (Chrome, Files, Drive, Gmail) → Allow.

Per-source toggle, so it survives uninstall of Lola.

## 4. Open & smoke test

- Cold-launch Lola
- Within ~800ms, hear *"Hola, listo cuando quieras"* in Argentine Spanish
- Tap **top button (Describe)**:
  - First time: grant Camera permission (Spanish prompt)
  - Should see/hear narration of the scene
- Tap **bottom button (Ask)**:
  - First time: grant Microphone permission
  - Say *"¿qué es esto?"* aimed at an object
  - Should hear the answer

If TTS sounds off (wrong accent, robotic), that's a V3 issue — log per `docs/validation/V3-tts-stt.md` and check whether `es-AR` is installed in Android Settings → System → Languages → Text-to-speech output.

## 5. Subsequent updates

Same flow — build, transfer, open the APK. Android prompts *"Update existing app?"* — accept. **App data (catalog + sightings + telemetry) persists across updates.**

## 6. Uninstall (only if necessary)

Settings → Apps → Lola → Uninstall. **Wipes** the SQLite DB and all catalog photos. Don't do this casually — Charly would need to re-run the FR-3 setup with dad.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "App not installed" on install | Signature mismatch with prior version | Uninstall first, then install fresh |
| Black screen on launch | JS bundle didn't compile | `expo-doctor` locally; rebuild |
| No greeting audio | Android TTS pack for `es-AR` missing | Settings → System → Text-to-speech → install Spanish voices |
| Camera prompt never appears | Permission was already denied | Settings → Apps → Lola → Permissions → Camera → Allow |
