# Handoff — Home screen (Dad-facing)  ·  Lola

Single-screen spec for the **Dad-facing Home** ("cards" layout). React Native + Expo. All values are final
and exact. Use `theme/tokens.json` for the shared tokens; the specific numbers are repeated inline below so
this file stands on its own.

---

## What this screen is
The screen Dad uses every day. Two large stacked buttons on a light surface:
- **Describir** (top, white) → "describe what's in front of me." Runs **thinking → speaking**.
- **Preguntar** (bottom, dark) → "ask Lola a question." Runs **listening → thinking → speaking**.

Voice is the real interface; tapping a button just starts the flow. **Lola finishes and returns to idle on
her own** — there is no stop button.

States: `idle` / `listening` / `thinking` / `speaking` / `error` (camera, permission).

---

## Layout (idle)

```
┌─────────────────────────────┐
│ ¿Qué querés hacer?      ⚙   │  ← top bar: prompt left, gear right
│                             │
│   ┌───────────────────┐     │
│   │      (eye)         │     │  ← DESCRIBIR card (white), taller
│   │     Describir      │     │
│   └───────────────────┘     │
│            14px             │  ← gap = safe "dead zone"
│   ┌───────────────────┐     │
│   │     (ask ?)        │     │  ← PREGUNTAR card (near-black), shorter
│   │     Preguntar      │     │
│   └───────────────────┘     │
└─────────────────────────────┘
```

### Container
- Background: **#EDF0F4** (`sunken`). Vertical flex column.
- Padding: top 0, sides 16, bottom 26. (Status/nav safe areas handled by the frame.)

### Top bar (idle only — fades out, `opacity 0`, while a flow is running; 300ms)
- Row: height 46, margin 10 top & bottom, `space-between`, vertically centered.
- **Prompt (left):** text "¿Qué querés hacer?" — color **#1B1E24** (`high`), 21px, weight **800**,
  letterSpacing -0.2.
- **Gear (right):** 30×30 transparent button, Ionicon `settings-outline` 22px, color **#8A929E** (`low`),
  stroke ~1.7. Opens the caregiver Setup route.
  - ⚠️ Product note: this is a *visible* settings entry on Dad's screen. The agreed-safe alternative is the
    OS app-icon shortcut. If you keep the gear, consider gating it (e.g. long-press) so Dad can't trip into
    Setup. Implement per the team's call.

### Cards
Both: full width, `borderRadius` **34**, `minHeight` 190, padding 24, content centered (column, gap 18).
- **Describir (top):** background **#FFFFFF**, 1.5px border **#E0E4EA** (`border`), shadow
  `iOS: color #0C0D0F, offset {0,10}, opacity 0.12, radius 30` / `Android elevation 6`.
  Flex weight **1.32** (taller).
- **Preguntar (bottom):** background **#0C0D0F** (`ink`), no border, shadow
  `iOS: color #0C0D0F, offset {0,14}, opacity 0.40, radius 36` / `Android elevation 10`.
  Flex weight **0.92** (shorter).
- Gap between them: **14**.

### Card contents (idle)
- **Circle:** 150×150, fully round.
  - Describir: background **#EAF2FE** (`primary/50`).
  - Preguntar: background `rgba(90,162,245,0.16)`.
- **Icon:** 90px, stroke ~1.45, single-color (`currentColor`).
  - Describir = **eye** → SVG `assets/icons/describir-eye.svg`; color **#1A73E8**.
    Nearest Ionicon: `eye-outline`.
  - Preguntar = **ask bubble** (speech bubble + "?") → SVG `assets/icons/preguntar-ask.svg`;
    color **#5AA2F5**. Nearest Ionicon: `chatbubble-ellipses-outline`.
- **Label:** below the circle. 44px, weight **800**, letterSpacing -0.5.
  - "Describir" color **#1B1E24** (ink). "Preguntar" color **#FFFFFF**.

---

## Behavior

**Tap a card → start that flow.** The tapped card **grows to fill** (flex → 1) and the cycle plays inside
it; the other card **dims to opacity 0.26 and is disabled**. The top bar + prompt fade out. When the flow
ends, everything returns to idle (cards back to 1.32 / 0.92, top bar back). Transitions: `opacity 350ms`,
`flex 350ms`, ease.

**Timings in the prototype** (replace with real STT/LLM/TTS events in production):
- Describir: thinking @0 → speaking @1800ms → idle @9500ms.
- Preguntar: listening @0 → thinking @2200ms → speaking @4200ms → idle @11500ms.

### In-card state content (replaces the idle circle+label)
- **listening** (Preguntar only): 112×112 ring, 3px border in accent, pulsing (scale/opacity loop 1.5s),
  Ionicon `mic-outline` 48px centered. Label "Te escucho…" 28px / 700.
- **thinking**: 112×112 ring, 3px track (`rgba(12,13,15,.1)` on white / `rgba(255,255,255,.14)` on dark)
  with `borderTopColor` = accent, rotating 360° linear 1.2s; Lola mark 52px centered. Label
  "Un momento…" 28px / 700.
- **speaking**: 7-bar waveform (accent color, bars animate height with staggered `delay = i*0.12s`), then
  the spoken text 23px / 600, lineHeight 1.34, `text-wrap: balance`, max ~18ch, centered.
- Behind active content sits a soft radial **glow**: Describir
  `radial-gradient(circle, rgba(96,110,132,.16), transparent 60%)`, Preguntar
  `radial-gradient(circle, rgba(90,162,245,.24), transparent 60%)`; animated opacity .65→1 + scale 1→1.1,
  3.6s alternate.
- **Accent per card:** Describir **#1A73E8**, Preguntar **#5AA2F5**. Text on active: ink on Describir,
  white on Preguntar.

### Error states (full-card, calm — never red/alarm)
Surface **#0C0D0F**, centered. 132px circle bg `rgba(240,180,92,.14)` with amber **#F0B45C** icon.
- **Camera ("can't see"):** Ionicon `alert-circle-outline` 62px. Title "No veo nada" 34/800.
  Body "Probá de nuevo desde el menú." 22/500. **No button** — tap anywhere (or auto) returns to idle.
- **Permission denied:** `camera-outline` 62px. Title "Necesito la cámara" 34/800. Body
  "Tocá para darme permiso." 22/500. One full-width PrimaryButton "Abrir ajustes" → OS settings.

---

## Copy (final, Spanish — Argentine voseo)
| Key | String |
|-----|--------|
| homePrompt | ¿Qué querés hacer? |
| describe | Describir |
| ask | Preguntar |
| listening | Te escucho… |
| thinking | Un momento… |
| describeResult (sample) | Estás mirando la mesa de la cocina. Hay una taza azul, una banana y tus lentes de leer. |
| askResult (sample) | La última vez vi tu termo sobre la mesa de la cocina. |
| errCamera / errCameraSub | No veo nada / Probá de nuevo desde el menú. |
| errPerm / errPermSub / errPermBtn | Necesito la cámara / Tocá para darme permiso. / Abrir ajustes |

---

## Tokens used (from theme/tokens.json)
`ink #0C0D0F` · `sunken #EDF0F4` · `border #E0E4EA` · `primary #1A73E8` · `primary/50 #EAF2FE` ·
`high #1B1E24` · `low #8A929E` · accent-on-dark `#5AA2F5` · amber `#F0B45C`.

## Files
- `assets/icons/describir-eye.svg`, `assets/icons/preguntar-ask.svg` — the two card icons (24×24,
  currentColor; render at 90px here).
- `theme/tokens.json` — shared design tokens.
- Live reference: `prototype/Prototype.html` → rail "Home · idle / listening / thinking / speaking /
  error". Component source in `prototype/dad.jsx` (`Home` + `FieldStage`, the `homeDir === "cards"` branch).
