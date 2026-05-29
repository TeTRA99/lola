# Launcher / splash assets

Generated from the "geometric" Lola mark. Background colour is **#1A73E8**, splash background **#0C0D0F**.

## Files
- `Icon-1024.png` — iOS master, 1024×1024, full-bleed, no transparency, no rounded corners (OS masks).
- `ic_launcher_foreground.png` — Android adaptive foreground, 432×432, transparent, lens inside the safe zone.
- `ic_launcher_background.png` — Android adaptive background, 432×432 solid #1A73E8 (or just set the colour).
- `ic_launcher_48/72/96/144/192.png` — legacy mipmap densities (mdpi → xxxhdpi), full-bleed.
- `splash-logo.png` — 512×512 transparent full mark for the Expo splash (centre it on #0C0D0F).

## app.json (Expo) — icons + splash + the Setup shortcut
```jsonc
{
  "expo": {
    "icon": "./assets/launcher/Icon-1024.png",
    "splash": {
      "image": "./assets/launcher/splash-logo.png",
      "resizeMode": "contain",
      "backgroundColor": "#0C0D0F"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/launcher/ic_launcher_foreground.png",
        "backgroundColor": "#1A73E8"
      }
    },
    "ios": {
      "icon": "./assets/launcher/Icon-1024.png"
    }
  }
}
```

## Setup shortcut (the only entry to caregiver setup)
- **Android** — App Shortcut that deep-links to the Setup route, label "Configuración".
  Use a config plugin or `app/src/main/res/xml/shortcuts.xml`:
  ```xml
  <shortcut android:shortcutId="setup"
            android:shortcutShortLabel="@string/setup_label">  <!-- "Configuración" -->
    <intent android:action="android.intent.action.VIEW"
            android:data="lola://setup" android:targetPackage="..." />
  </shortcut>
  ```
- **iOS** — Quick Action via `UIApplicationShortcutItems` (or `expo-quick-actions`), title "Configuración",
  routing to the Setup stack on launch/resume.
- There is intentionally **no in-app route** to Setup from the running app.
