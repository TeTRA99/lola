# Home redesign, settings access & first-run onboarding

**Status (2026-06-01):** Built and shipping on `main`. Covers the dad-facing Home
"cards" layout, how Setup/Debug are reached, and the first-run onboarding. Source
handoff: `designs/handoff_home/`. Verified with `tsc` + `eslint` + jest.

## Home — "cards" layout (`src/screens/HomeScreen.tsx`)
Replaces the old full-bleed two-panel split. A light **sunken** (`#EDF0F4`) surface
with:
- **Top bar:** prompt *"¿Qué querés hacer?"* (left) + settings gear (right). Fades
  out (`opacity 0`, 300ms) and stops taking touches while a flow runs.
- **Two rounded cards** with side margins (16) and a **14px dead-zone gap** between
  them, so taps near the screen edges / the seam don't land on the wrong action
  (the explicit "shrink the tap surface" goal):
  - **Describir** (white, `flex 1.32`, taller) — camera/describe.
  - **Preguntar** (near-black `#0C0D0F`, `flex 0.92`, shorter) — mic/ask.
  - Active card grows toward `flex 1`; the other dims to `opacity 0.26`.
- The active state cycle (listening → thinking → speaking) still plays **inside**
  the tapped card, driven by the same haptic/TTS lifecycle the services emit.
- Android note: the welcome overlay and any modal over the cards need a high
  `elevation` — cards carry `elevation` (shadow) and would otherwise paint on top
  regardless of `zIndex`/order.

## Settings & Debug access
- **Gear → Setup, long-press-gated.** The gear is visible on Home but opens Setup
  only on a **long-press** (500ms); a plain **tap shows a toast** hint
  (`COPY.home.settingsHint` — "Mantené presionado para ajustes"). This keeps Setup
  reachable in-app for the caregiver while stopping the low-vision end user from
  tripping into the (English) caregiver screen. The OS app-icon "Configuración"
  shortcut remains as a secondary path.
- **Setup "Done" always returns to Home** — for both the gear and the app-icon
  shortcut (previously the shortcut path exited the app). See `app.tsx` `closeSetup`.
- **Debug** is reached from a **dev-only 🐞 icon** in the Home top bar (`__DEV__`
  only; invisible in production). The old 10-second splash-hold gesture was removed
  (and its `DEBUG_GESTURE_HOLD_MS` config); the splash is now a clean auto-dismiss
  brand moment with no hidden gesture.

## First-run onboarding
Voice-first because we don't know whether the blind user or a helper opens the app
first. Two layers + a separate caregiver intro. All copy is centralized; flags
persist in `Settings.KEYS` and can be cleared from the Debug screen
("Reset onboarding").

1. **Welcome overlay** (`src/components/WelcomeOverlay.tsx`, once — `welcomeSeen`):
   shown over Home after the splash. Branded ink screen + soft pulse + big text;
   Lola **speaks** the orientation (queued after the splash greeting, so it doesn't
   re-greet) and it **dismisses on tap OR when the speech ends**. Copy:
   `COPY.onboarding.welcome` (core Describir/Preguntar + a gentle "pedí ayuda a
   alguien de confianza para configurar" nudge — never says "caregiver" — ending
   with "tocá la pantalla para empezar").
2. **Per-feature first-use hints** (spoken once each, before the flow):
   - Describir (`describeHintSeen`): *"Tocaste Describir. Apuntá el teléfono hacia
     adelante y ya te cuento qué veo."*
   - Preguntar (`askHintSeen`): *"Tocaste Preguntar. Cuando escuches el tono,
     preguntame en voz alta lo que quieras saber."*
   - Guide (`guideHintSeen`): explains the homing vibration — see
     [guide-me-to-it-notes.md](./guide-me-to-it-notes.md).
   - Heartbeat (`heartbeatHintSeen`): *"Ese latido suave soy yo, que estoy acá con
     vos."* — spoken the first time the idle heartbeat is felt.
3. **Caregiver intro** (`caregiverIntroSeen`): a one-time **overlay popup** the
   first time Setup opens — dimmed scrim, tap anywhere (or the "Entendido" CTA) to
   dismiss. English/Spanish via `i18n/setupStrings.ts` (`introTitle` / `introBody` /
   `introDismiss`).

### Copy locations
- Dad-facing Spanish (voseo): `src/services/CopyModule.ts` — `COPY.home.*`,
  `COPY.onboarding.*` (enforced by the inline-Spanish ESLint rule).
- Caregiver Setup (ES/EN): `src/i18n/setupStrings.ts`.

## Related fixes shipped in the same session
- **Mic-open timing** (`src/adapters/stt.ts` + `AskService`): `listen()` now fires
  an `onReady` callback when the engine actually starts capturing
  (`audiostart`/`start`, 1.5s fallback). The "Te escucho…" cue + haptic fire at that
  moment, and Home shows "Un momento…" until then — so the user no longer talks into
  a warming-up mic.
- **Memory recall** (`AskService`): Ask answers are no longer stored as a sighting
  `excerpt` (only Describe scenes are), so a follow-up like "¿de qué color es el
  sillón?" can't later be recited as "la escena era…" when recalling where the couch
  is. (Discussion "Option B" — see git history.)
- **Render-crash fix:** a hook (`topBarOpacity`) that had landed below the Home
  error early-return was moved above it ("rendered fewer hooks than expected").
