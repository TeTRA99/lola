# Handoff: Lola — Assistive-Vision Voice Assistant (full redesign)

## Overview
Lola is a mobile assistant for a low-vision user ("Dad"). He points his phone at things and Lola
describes the scene or answers questions out loud. It is **voice-first** — the screen exists to support
the voice flow, not replace it. There are **two surfaces**:

- **Dad-facing** (Spanish, low-vision): a giant, ultra-high-contrast button board. Voice is the real
  interface; the screen is a thumb target.
- **Caregiver-facing** (English): a normal-density setup tool to teach Lola the objects and rooms in
  Dad's house. Reached **only** from the OS app-icon long-press menu — never from inside the app.

Target platform: **React Native + Expo** (Android + iOS, one codebase).

---

## About the Design Files
The files in this bundle are **design references created in HTML/React-for-web** — interactive prototypes
showing the intended look and behavior. **They are not production code to copy directly.** Your task is to
**recreate these designs in the Expo app** using its existing patterns (React Native `View`/`Text`/
`Pressable`, `StyleSheet`, Reanimated, `@expo/vector-icons`, `expo-camera`, etc.).

The prototype's component split maps cleanly onto RN components — but the prototype uses web `div`s and CSS;
you'll translate to RN primitives. The one file you use **as-is** is `theme/tokens.json`.

### How to read the prototype
Open `prototype/Prototype.html` in a browser. The left rail lists every screen and state. The component
source is split into:
- `prototype/data.jsx` — **final copy strings** (ES + EN) in a `COPY` shape, sample data, and the
  `toCanonical()` slug helper.
- `prototype/primitives.jsx` — tokens object `T`, icon set, `Phone` chrome, `PrimaryButton`,
  `Field`, `Tabs`, `ListRow`, `Toast`, `PhotoPlaceholder`, `LolaMark`.
- `prototype/dad.jsx` — Splash, AppIconShortcut vignette, Home (all states).
- `prototype/caregiver.jsx` — Setup tabs, Objects/Rooms lists, forms, Capture modal.
- `prototype/app.jsx` — navigation/orchestration + the Tweaks panel.

`Lola Design.html` (the hub) contains the **written UX rationale, the 4-question review, the copy deck,
and the recommended build order**. `Design System.html` is the visual token/component sheet.
`Logo & App Icon.html` shows the logo directions and exact launcher-asset specs.

---

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, motion, and copy are all decided. Recreate the
UI to match, using RN equivalents of the documented tokens. Where the prototype renders a striped-gradient
**PhotoPlaceholder**, that stands in for a real camera photo/thumbnail — wire it to `expo-camera` output.

---

## Locked decisions (don't re-litigate these)
1. **Home = two equal panels.** Top = **Describir** (white, camera) → describe the scene. Bottom =
   **Preguntar** (near-black, mic) → ask a question. 50/50 split. (A `dominant` 58/42 and a `single`-button
   variant exist in the prototype Tweaks but **equal is the chosen default.**)
2. **Active states play *inside* the tapped panel** — not as a full-screen takeover. Tapping Describir runs
   thinking → speaking within the white panel (soft gray glow); tapping Preguntar runs
   listening → thinking → speaking within the dark panel (blue glow). The other panel dims to opacity 0.32
   and is disabled. **Lola returns to idle on her own** when she finishes — there is no stop button.
3. **Setup is reached only via the OS app-icon shortcut** (Android App Shortcut / iOS Quick Action →
   "Configuración"). There is **no settings affordance anywhere inside the running app** — this is the
   safety guarantee so Dad can never feel his way into setup. The splash shows a legend pointing to it.
4. **Errors are calm.** Camera-can't-see error = Lola says "No veo nada" then returns to the menu (no
   button; retry = tap a panel again). Only permission-denied keeps a recovery button. Never a red/alarm
   full-screen.
5. **Logo = "geometric" lens mark** (see `LolaMark` variant `geometric`).
6. **Objects & Rooms are flat sibling tabs** (not hierarchical). Object rows show a derived, read-only
   "last seen in {room}" hint.
7. **No "internal name" (canonical slug) shown in the UI.** Still generate it under the hood as a stable
   key (`toCanonical()`), just don't display it.

---

## Screens / Views

### 1. Splash  (`Splash` in dad.jsx)
- **Purpose:** brand moment on launch; auto-advances to Home (~800ms in production).
- **Layout:** full-screen `ink` (#0C0D0F). Centered column: logo mark (92px, gentle float animation),
  "Lola" wordmark (46px / 800), greeting "Hola, soy Lola" (19px / 400, white @62%).
- **Bottom legend** (caregiver hint), two lines, centered, ~28px from bottom:
  - Line 1: gear icon + **"Configuración"** (13.5px / 700, white @62%)
  - Line 2: "Accedé manteniendo presionado el ícono de la app en tu teléfono" (12.5px / 500, white @40%)
- No gesture on the splash itself.

### 2. App-icon shortcut vignette  (`AppIconShortcut` in dad.jsx) — *handoff/demo aid*
- Mocks the OS home-screen long-press menu so everyone understands the setup entry. **You don't build this
  screen** — you implement it as a native shortcut in `app.json` (see Assets / Config). Menu rows:
  **"Abrir"** (opens app normally) and **"Configuración · Para el cuidador"** (deep-links to Setup).

### 3. Home — Dad  (`Home` in dad.jsx)  — states: idle / listening / thinking / speaking / error
- **Layout:** vertical flex, two equal `Pressable` panels, 1px hairline divider.
  - **Top (Describir):** background #FFFFFF. Idle content: 128px circle (bg `primary/50` #EAF2FE) with a
    blue (#1A73E8) camera icon (68px), then label "Describir" (44px / 800, ink, letter-spacing -0.5).
  - **Bottom (Preguntar):** background #0C0D0F. Idle content: 128px circle (bg rgba(90,162,245,.16)) with
    a #5AA2F5 mic icon (68px), then "Preguntar" (44px / 800, white).
- **Tap a panel → run that action.** The panel's content swaps to the active state in place:
  - *listening* (ask only): 112px ring (3px border, accent), pulsing (`lolaPulse`), mic icon; label
    "Te escucho…" (28px / 700).
  - *thinking*: 112px spinner ring (border-top accent, `lolaSpin` 1.2s) with the Lola mark (52px) centered;
    label "Un momento…".
  - *speaking*: animated waveform (7 bars, accent color, staggered) + the spoken text
    (23px / 600, line-height 1.34, max ~18ch, centered). Text color = ink on Describir, white on Preguntar.
  - A soft radial **glow** sits behind the active panel's content (`FieldGlow`): gray
    `radial-gradient(circle, rgba(96,110,132,.16), transparent 60%)` for Describir, blue
    `rgba(90,162,245,.24)` for Preguntar; animated with `lolaGlow` (opacity .65→1, scale 1→1.1, 3.6s).
  - The **inactive panel** sets opacity 0.32 and is disabled while the other runs.
- **Timings (prototype):** describe → thinking @0, speaking @1800ms, idle @9500ms. ask → listening @0,
  thinking @2200, speaking @4200, idle @11500. In production drive these off the real STT/LLM/TTS events.
- **error:** full-panel `ink`, 132px circle bg rgba(240,180,92,.14) with amber (#F0B45C) icon.
  - camera: alert icon, "No veo nada" (34/800) + "Probá de nuevo desde el menú." (22/500) — **no button**,
    auto-returns to idle.
  - permission: camera icon, "Necesito la cámara" + "Tocá para darme permiso." + **PrimaryButton**
    "Abrir ajustes".
- **Status/nav chrome:** status bar over the white top panel → **dark icons**; nav bar over the dark bottom
  panel → **light icons**. Keep this identical across idle and all active states.

### 4. Setup — Caregiver  (`Setup` in caregiver.jsx)
- **Header:** "Setup" (19/800) centered, "Done" link (primary) right. Bottom hairline.
- **Tabs:** segmented control on `sunken` (#EDF0F4) track, 5px padding; active pill = white + sm shadow.
  Items "Objects" (cube icon) / "Rooms" (home icon). **Tab state persists.**
- **Primary action:** full-width `PrimaryButton` "+ Add object" / "+ Add room" (no trailing arrow).
- **List:** vertical gap-10 `ListRow`s. Row = 56px rounded thumbnail + title (16/700, truncates 1 line) +
  subtitle (13, medium) + edit button (44×40 outline) + delete button (44×40, error red).
  - Object subtitle = description + " · visto en la {room}" (derived, lowercased) or "Not seen yet".
  - Room subtitle = description or "{n} photos".
- **Empty state:** 96px rounded-square icon tile (`primary/50`), title (24/800), body (15, medium, ~30ch),
  full-width primary CTA. Copy in `COPY.en.emptyObj*` / `emptyRoom*`.

### 5. Add/Edit Object  (`ObjectForm` in caregiver.jsx)
- Header "New object" / "Edit object" with back chevron.
- Fields (always-visible labels — see Components/Field):
  - **Display name (Spanish)** *(required)* — placeholder "Termo de Papá"; helper "What Lola says out loud."
  - **Description (optional)** — placeholder "el azul de tapa roja".
- **Reference photo** *(required)*, up to **3** photos, counter "n/3":
  - First photo shown large (196px tall, radius 16) with a "REFERENCE" badge (top-left) and a "Retake"
    button (bottom-right, dark pill).
  - Below: "More angles (optional)" + helper; a horizontal strip of 92px thumbnails (each with a top-right
    delete X) plus an "Add" dashed tile until 3 are reached.
  - Empty: a 168px dashed drop-tile "Take photo".
- Sticky footer: full-width `PrimaryButton` "Save object" (trailing arrow). Validates name + ≥1 photo;
  shows inline error text otherwise.

### 6. Add/Edit Room  (`RoomForm` in caregiver.jsx)
- Same field pattern (Display name + Description).
- **Reference photos** *(required)*, up to **5**, counter "n/5":
  - Horizontal strip of 104×128 thumbnails. First gets a "COVER" badge. Each has a top-right delete X.
    An "+ Take photo" dashed tile until 5 reached (then it disappears — clean stop, not an error).
  - A progress bar + encouraging copy: <3 → "n of 5 — add a couple more angles."; 3–4 → "looking good.";
    5 → "All 5 captured — that's plenty." (`COPY.en.photos*`). Plus "First photo is used as the cover."
- Sticky footer "Save room".

### 7. Capture modal  (`CaptureModal` in caregiver.jsx)
- Full-screen black. Live phase: viewfinder (use real camera), framing guide rect, top hint
  ("Fill the frame with the object" / "Step back — capture the whole room"), bottom bar with "Cancel"
  (left) and a 78px shutter button (center). Review phase: frozen shot + "Retake" / "Use photo".

### 8. Toasts  (`Toast` in primitives.jsx)
- Bottom-center pill, `ink` bg, white text, 24px success/error dot. Slide-up + fade, auto-dismiss 2.4s.
  Copy: `"<name>" saved`, "Deleted", or error "Couldn't save".

---

## Interactions & Behavior
- **Home:** tap panel → run action; panel animates the state cycle in place; other panel dims+disables;
  auto-returns to idle when TTS completes.
- **Tabs:** instant swap, state persists across navigation.
- **Forms:** required-field validation on Save (name + ≥1 photo); inline error text; capture modal is a
  full-screen overlay returning a photo to the strip; 3-photo (object) / 5-photo (room) caps hide the add
  tile when reached.
- **Save:** writes to the list, returns to the list, shows a success toast.
- **Delete:** removes the row + "Deleted" toast (add an undo or confirm if your platform conventions prefer).
- **Setup entry:** OS app-icon shortcut deep-links to the Setup stack. No in-app route to it.

## Motion (implement with Reanimated; tuples = { property, from→to, duration_ms, easing })
- Easing: standard `cubic-bezier(.2,0,0,1)`, decelerate `(0,0,0,1)`. Durations: fast 120 / base 200 /
  slow 320.
- Splash logo: gentle float loop (translateY 0→-7→0, 3600ms, ease-in-out).
- Panel glow: opacity .65→1 + scale 1→1.1, 3600ms, alternate.
- listening pulse: expanding ring shadow, 1500ms. thinking: 360° rotation, 1200ms linear.
- Tab switch: { opacity 0→1, 200, standard } + { translateX 12→0, 200, decelerate }.
- Toast: { translateY 24→0, 260, decelerate } + fade.
- Inactive panel dim: { opacity 1→0.32, 350, standard }.
- (Optional richer assets as Lottie: splash bloom, capture "got it" check.)

## State Management
- `tab: 'objects' | 'rooms'` (persisted).
- `objects[]`, `rooms[]` (each: id, displayName, canonicalName, description, photos[] / tint, lastSeenRoom).
- Home: `mode: 'describe'|'ask'`, `state: 'idle'|'listening'|'thinking'|'speaking'|'error'`, `errKind`.
- Form-local: name, description, photos[], validation `tried` flag, capture-open flag.
- Derived: object `lastSeenRoom` comes from recent snapshots, not a stored relationship.

## Design Tokens
Use **`theme/tokens.json`** verbatim (drop into `app/src/theme/`). It contains colors (hex + opacity),
the 4-based spacing scale, numeric type scale w/ line-heights for both surfaces, radii, **per-platform
shadows** (iOS shadow* / Android elevation), touch-target minimums (caregiver 56 / dad 88), motion, and
the **Ionicons** name map. Highlights: primary #1A73E8 (pressed #1557B0); ink #0C0D0F; canvas #F6F7F9;
text high/medium/low #1B1E24 / #5C6470 / #8A929E; amber heads-up #F0B45C; success #1E9E5A; error #D92D20.

## Typography
- Family: **Plus Jakarta Sans** (Google Font; bundle via `expo-font`) with system fallback (SF / Roboto).
  Weights used: 300 / 400 / 500 / 600 / 700 / 800. Mono accents: JetBrains Mono.
- The signature heading treatment is light (300) over bold (800) — see `Design System.html` and the
  `type` block in tokens.json.

## Assets
- **Icons:** Ionicons via `@expo/vector-icons` — reference by name (map in `tokens.json → icon.names`,
  e.g. camera-outline, mic-outline, settings-outline, add, create-outline, trash-outline, cube-outline,
  home-outline, chevron-back, arrow-forward, checkmark, refresh, alert-circle-outline, time-outline). The
  prototype draws look-alike inline SVGs; in RN just use the named Ionicons.
- **Logo:** "geometric" lens mark — rounded-square (#1A73E8) + white circle + #1A73E8 iris + offset white
  catchlight. Recreate as vector/SVG. Concepts & exact construction in `Logo & App Icon.html`.
- **Launcher icons & splash (Expo):**
  - Android adaptive: `ic_launcher_foreground.png` 432×432 (white lens centered in the 264×264 safe zone);
    `adaptiveIcon.backgroundColor: "#1A73E8"`; legacy mipmaps 48/72/96/144/192.
  - iOS: `Icon-1024.png` 1024×1024, full-bleed #1A73E8, no transparency, no rounded corners.
  - Splash: centered lens on `backgroundColor #0C0D0F`.
- **Setup app-icon shortcut (config, not a screen):**
  - Android: `expo.android.shortcuts` (or a `shortcuts.xml`) entry → intent/deep-link to the Setup route,
    label "Configuración".
  - iOS: `UIApplicationShortcutItems` in `app.json` → `expo-quick-actions` listener routing to Setup.
- **Photos:** the striped PhotoPlaceholder stands in for real `expo-camera` captures/thumbnails.

## Copy
Final strings live in `prototype/data.jsx → COPY` (`es` = Dad, `en` = caregiver). Wire these into your
`COPY`/i18n constants verbatim. Dad-facing copy uses Argentine **voseo** (Mantené, Tocá, Probá, Accedé).

## Recommended build order
1. Tokens + theme + fonts.
2. Logo, launcher/splash assets, and the OS setup shortcut (this is the only door to Setup, so it unblocks
   testing everything).
3. Dad Home — idle + the four in-panel active states (highest daily-use impact).
4. Setup shell — tabs + Objects list / add / edit + the shared Capture modal.
5. Rooms — multi-photo strip (reuses the object form + capture modal).
6. Empty/error states, toasts, motion polish.

## Files in this bundle
- `theme/tokens.json` — the code-ready design tokens (**use directly**).
- `assets/launcher/` — generated launcher/splash PNGs (iOS 1024, Android adaptive fg/bg, legacy mipmaps,
  splash-logo) + `README.txt` with the ready-to-paste `app.json` and the Setup-shortcut config.
- `screenshots/` — full-stage captures of every screen/state + `INDEX.md` mapping files to screens.
- `prototype/Prototype.html` (+ `data.jsx`, `primitives.jsx`, `dad.jsx`, `caregiver.jsx`, `app.jsx`,
  `tweaks-panel.jsx`) — the interactive reference. Open in a browser; use the left rail to see every state.
- `Lola Design.html` — UX rationale, 4-question review, copy deck, build order.
- `Design System.html` — visual token & component sheet.
- `Logo & App Icon.html` — logo directions + launcher asset specs.
```
