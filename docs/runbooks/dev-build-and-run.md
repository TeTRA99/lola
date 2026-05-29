# Dev build & run runbook

How to get a **development** build of Lola onto a device and iterate. (Production
distribution is covered separately: android-sideload.md, testflight.md,
eas-secrets.md.)

## TL;DR
```bash
cd app
npx eas-cli@latest build --profile development --platform android   # cloud, ~15-20 min
# install the resulting APK on the device, then:
npx expo start --dev-client                                         # serves JS over Metro
```
JS changes hot-reload. You only need a **new EAS build** when you add/change a
**native dependency** (a new native module, or a config-plugin/permission change).

## Why EAS and not local `expo run:android`
This machine isn't set up for local Android native builds:
- No `ANDROID_HOME` / `local.properties` (fixable), AND
- **No NDK + CMake installed** — required because VisionCamera, Nitro, and
  ExecuTorch ship C++ that compiles locally (New Arch builds C++ regardless).

Local builds are possible but cost a ~1-2 GB NDK/CMake install plus a long first
C++ compile. Since native deps change rarely, **EAS dev builds are the default**.
If you do want local: install NDK 27 + CMake via `sdkmanager`, create
`app/android/local.properties` with `sdk.dir=$HOME/Library/Android/sdk`, then
`npx expo run:android`.

## The development EAS profile
`app/eas.json` → `build.development`: `developmentClient: true`,
`distribution: internal`, Android `buildType: apk`. The build uses the remote
keystore already stored in the Expo account (no interactive prompt).

**Env vars:** dev-client builds do NOT bake `EXPO_PUBLIC_OPENROUTER_API_KEY` — it's
read from local `.env.local` when you run `expo start`. Only `preview`/`production`
builds need the key set on EAS (see eas-secrets.md). The "No environment variables
found for development" line during the build is expected, not an error.

## Known gotchas (paid for in time — don't rediscover)
- **iOS local build fails: `React-Core-prebuilt` "Missing required attribute
  source".** RN 0.85's experimental precompiled iOS core ships a podspec without a
  download source. Build RN from source instead:
  `RCT_USE_PREBUILT_RNCORE=0 npx expo run:ios`. If pods are half-installed,
  `rm -rf ios/Pods ios/Podfile.lock` first.
- **CocoaPods missing (first iOS build):** Expo auto-installs it; the `gem` path
  often fails on macOS system Ruby (permissions) — let it fall back to Homebrew,
  or `brew install cocoapods` yourself.
- **iOS deployment target is 17.0** (raised by ExecuTorch 0.9.0) — simulator/device
  must be iOS 17+.
- **VisionCamera v5 ships no Expo config plugin** (the Nitro rewrite dropped it).
  Do NOT add `react-native-vision-camera` to `plugins` in app.json — it autolinks,
  and camera permission already comes from the `expo-camera` plugin. Listing it
  crashes `expo prebuild`.
- **Frame processors need the worklets babel plugin:** `react-native-worklets/plugin`
  must be **last** in `app/babel.config.js`.
- **zsh doesn't treat `#` as a comment by default** — don't paste command lines that
  include trailing `# comments`; they become bad arguments.

## Verify a change
From `app/`: `npx tsc --noEmit` · `npx jest` · `npx eslint src`.
