# iOS local build & install (Charly's iPhone)

How to build, sign, and install Lola directly onto Charly's **iPhone 17 Pro** from
this Mac, via **Xcode free-provisioning** (NOT TestFlight, NOT SideStore — full
Xcode 26.5 is installed, so we sign locally). For App-Store/TestFlight distribution
see [testflight.md](./testflight.md); for the EAS dev-client flow see
[dev-build-and-run.md](./dev-build-and-run.md).

> **Prereq:** the iPhone must be **plugged in via USB and UNLOCKED** for any
> `devicectl` step (see the tunnel-error note at the bottom). Run everything from
> `app/` unless noted.

## Device & signing facts

| What | Value |
|------|-------|
| Device id (`--device`) | `B842796A-BCF4-55AA-A7F9-F5355C9B5D33` |
| UDID | `00008150-0016759C3484401C` |
| Bundle id | `com.carlosbernardi.lola` |
| Apple ID | `crbernardi@gmail.com` (free Personal Team `G5X698LB5Z`) |
| Signing cert | `Apple Development: crbernardi@gmail.com (P885982463)` |
| Cert hash (`-s`) | `ABD70A6DC59AA76B6E9DAC7FAF1E6278D7EE663C` |

Free-provisioning profiles **expire after 7 days** — when the app won't launch
("untrusted developer" / just dies), re-sign + reinstall to refresh. `codesign` may
prompt for the **Mac login password** (keychain) — hit "Always Allow" once.

## A. Fast JS-only update (~2 min) — use this for any JS/TS change

The app is **Hermes**, so the embedded `main.jsbundle` is *bytecode* — you rebuild
just the bundle and drop it into the already-installed `.app`, no Xcode. **No native
rebuild is needed unless a native dependency changed** (then do section B first once).

The signed app copy lives at `/tmp/LolaSign/Lola.app`. Sign/install from **/tmp**,
never from `~/Documents` — iCloud file-provider xattrs there break `codesign`.

```bash
cd app
IDENT=ABD70A6DC59AA76B6E9DAC7FAF1E6278D7EE663C
APP=/tmp/LolaSign/Lola.app
HERMESC=node_modules/hermes-compiler/hermesc/osx-bin/hermesc

# 1. JS bundle → 2. Hermes bytecode → 3. swap into the app → 4. re-sign → 5. install
rm -f /tmp/main.jsbundle /tmp/main.hbc
npx expo export:embed --platform ios --dev false --entry-file index.ts \
  --bundle-output /tmp/main.jsbundle --assets-dest /tmp/lola-ios-assets
"$HERMESC" -emit-binary -O -w -out /tmp/main.hbc /tmp/main.jsbundle
cp /tmp/main.hbc "$APP/main.jsbundle"; xattr -c "$APP/main.jsbundle"
codesign -f -s "$IDENT" --timestamp=none \
  --entitlements /tmp/lola_entitlements.plist --generate-entitlement-der "$APP"
codesign --verify --strict "$APP"

# 6. install (retry loop — see tunnel note)
for i in 1 2 3 4 5 6 7 8; do
  if xcrun devicectl device install app \
       --device B842796A-BCF4-55AA-A7F9-F5355C9B5D33 "$APP"; then
    echo "INSTALL OK"; break
  fi
  echo "attempt $i failed (unlock the phone?), retrying..."; sleep 4
done
```

> ⚠️ **Reinstalling can wipe cached on-device models.** Completed/partial executorch
> downloads live in the app's cache dir and may be cleared on app replace — a reinstall
> mid-download **restarts the download** (Charly finds this very annoying). Hold installs
> while a model (e.g. the 450M VLM) is downloading. The default `inferenceMode` is `cloud`,
> so a fresh install downloads no model until the user opts into on-device.

## B. Full native build (~30 min) — only when native deps change

```bash
cd app/ios
xcodebuild archive -workspace Lola.xcworkspace -scheme Lola \
  -configuration Release -archivePath build/Lola.xcarchive \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO
```

Requires `ios.buildReactNativeFromSource: true` (RN 0.85 prebuilt-pod bug) and
deployment target **17.0** (executorch floor) in the Expo config. If the project was
just moved, clear the stale-path artifacts first — see the
[Project path moved](../../README.md) note / session memory. After archiving, export
the `.app`, then sign + install it from `/tmp` exactly as in section A steps 4–6.

## Troubleshooting

- **`CoreDeviceError 4000` "tunnel was interrupted"** — the phone is **locked** or the
  USB tunnel dropped. Unlock the iPhone and let the retry loop re-attempt; it usually
  connects within a couple of tries.
- **`codesign` "resource fork / Finder info"** — you're signing under `~/Documents`
  (iCloud xattrs). Copy the app to `/tmp` first (`ditto --noextattr --norsrc src dst`).
- **App installs but won't launch / "untrusted developer"** — the 7-day free profile
  expired, or the first-ever launch needs trust: Settings → General → VPN & Device
  Management → trust the developer. Re-sign + reinstall to refresh the profile.

## Platform scoping (IMPORTANT)

Most dev historically targeted **Android** (Charly's dad's Galaxy = priority/floor).
iOS is the newer target. Guard iOS-only fixes with `Platform.OS === 'ios'` and call
them out, so Android behavior is never silently changed.
