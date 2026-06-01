# Lola — Design Brief for Claude Design

> Paste this whole document into Claude Design. Attach the reference screenshots (`reference-*.png`) and current-state screenshots (`current-*.png`) alongside it.

---

## Project: Lola — assistive-vision voice assistant

Lola is a mobile assistant for a low-vision user (my father). He points his phone at things and Lola describes what's there or answers questions about it. The interaction is **voice-first** — visuals exist to support the voice flow, not replace it.

There are **two distinct UI surfaces** with very different design needs, and I want them treated separately.

---

## Platform

React Native (Expo) shipping to both **Android and iOS**. Produce **one design** that respects platform conventions where they actually matter — adaptive vs. iOS launcher icon, safe areas, Android system back gesture, native font fallback. Do **not** produce two parallel designs; do call out platform-specific bits inline where relevant.

---

## Two surfaces, two design tones

### Surface A — Dad-facing (end user, low vision)
- **Dead simple**, huge touch targets, very high contrast.
- He cannot read small text. He recognizes shapes, color blocks, and where his thumb lands.
- Voice is the real interface; the screen is mostly a giant button surface.
- **Spanish** copy, very short.

### Surface B — Caregiver-facing (me, setting things up)
- Normal-density UI, English copy.
- Reached via a **hidden gesture** on the splash (5-second press on the logo). No visible entry from the home screen.
- Used to teach Lola what objects and rooms exist in dad's house.

---

## What dad actually does with Lola — core use cases

Every screen should make at least one of these easier.

### UC-1 — "What's in front of me?" (Describe)
Dad points the phone, taps the top button, Lola describes the scene out loud. *("You're looking at the kitchen counter. There's a blue mug, a banana, and your reading glasses.")*
→ The home screen's "speaking" state may run for 10–20 seconds; needs a calm, non-distracting visual.

### UC-2 — "Lola, where is my thermos?" (Memory recall)
Dad taps the bottom button and asks a question. Lola searches her memory of tagged objects + recent snapshots and answers. *("Last time I saw your thermos it was on the kitchen table.")*
→ The catalog isn't decorative — every tagged object is a potential answer to a "where is X" question. Setup must make it easy to add many objects.

### UC-3 — "Which room am I in?" (Room recognition — what we're building now)
Dad walks into a room, points the phone, asks Lola where he is. Lola compares the live view against room reference photos and answers. *("You're in the living room.")*
→ Rooms need *multiple* reference photos from different angles. The Rooms tab must make multi-photo capture feel natural.

### UC-4 — "Read this to me" (Text in scene)
Dad points at a label, medication box, letter, mail — Lola reads it.
→ Same Describe button, but the speaking state may be long and dad may want to interrupt mid-read. Cancel-on-tap must be obvious.

### UC-5 — Caregiver setup (me, periodically)
I sit down with dad's phone, long-press the logo, spend 10 minutes tagging new objects (a new remote, his pills) or mapping a new room.
→ Setup should feel like a tool — fast list scanning, easy add, forgiving partial saves. Not a wizard.

### UC-6 — First-run onboarding (me, once)
First time we set up the app together. I tag the 5–10 most important objects and map the 3–4 main rooms before handing the phone back to dad.
→ Empty states should *teach* — "Add your first room" with an example, not just a blank screen.

---

## Screens to design

### 1. Splash + logo
- Design a **logo for "Lola"** — warm, friendly, slightly playful, suggests vision/eye/lens *without* being a literal eyeball. Must read at small sizes and as an app icon.
- **Splash screen**: logo center, greeting line below ("Hola, soy Lola"), auto-dismisses in ~800ms.
- The logo is the **hidden long-press target** for setup (5s) and debug (10s) — design a subtle pressed/holding affordance (ring fill, gentle pulse) that's visible if you're holding but invisible to a casual launch.
- Deliver the logo in **app-launcher-icon form**:
  - **Android adaptive icon**: foreground + background layers, safe zone respected.
  - **iOS**: 1024×1024 master, no transparency, no rounded corners (OS masks).
  - Must stay recognizable at 48×48 px on a busy home screen.

### 2. Home screen (dad-facing)
Currently: full-screen black, two stacked full-width buttons over a live camera preview.
- **Top button** = "Describe what I'm seeing" (camera icon). Light background.
- **Bottom button** = "Ask Lola a question" (mic icon). Dark background.
- States needed: idle, busy/listening, thinking, speaking, error.
- Tapping while Lola is talking should *visibly* cancel — design that feedback.

### 3. Setup screen (caregiver-facing) — tabbed
Top of screen: two tabs — **Objects** | **Rooms**. Tab state persists.

#### Objects tab
List rows showing: thumbnail (reference photo), display name (Spanish, e.g. *"Termo de Papá"*), and row actions (edit, delete). Tap row = edit. Primary action = **Add object**.

**Add/Edit Object form** — fields:
- **Display name** (Spanish, what Lola will say out loud) — required
- **Canonical name** (auto-generated snake_case, shown read-only as a hint) — e.g. `termo_de_papa`
- **Description** (optional free text, helps Lola disambiguate) — *"el azul de tapa roja"*
- **Reference photo** (one photo, opens capture modal) — required

#### Rooms tab *(new — this is what we're building now)*
Same list pattern: thumbnail (first photo), display name (*"Cocina"*, *"Living"*), edit/delete.

**Add/Edit Room form** — fields:
- **Display name** (Spanish) — required
- **Canonical name** (auto-generated, read-only hint)
- **Description** (optional)
- **Reference photos** — **up to 5 photos**, captured from different angles. Horizontal strip of thumbnails + an "add photo" tile. Each photo deletable. Order doesn't matter for recognition; first photo = list thumbnail.

The 5-photo cap matters — design needs to make "you have 3 of 5" feel encouraging, and "you've hit 5" feel like a clean stop, not an error.

### 4. Capture-photo modal
Full-screen camera with a big shutter button, retake/confirm states, clear cancel. Used by Objects and Rooms flows.

### 5. Empty states + success states
- First-run: "No objects yet" / "No rooms yet" — friendly, encouraging.
- Post-save confirmation (e.g. "Termo añadido") — short, warm, dismissible.

---

## Design system — first-class deliverable

Define and document a small, coherent system. Don't just style the screens — give me tokens I can implement.

- **Color palette** — primary, secondary, surface, text (high/medium/low emphasis), status (success/warn/error), camera-overlay variants. Include **dad-facing high-contrast pairings** that hit WCAG AAA, plus the lower-contrast caregiver palette.
- **Typography** — type scale (display / heading / body / caption), weights, line heights. Specifically include the **mixed-weight heading treatment** from the reference (light + bold in the same heading). Pick system-available fonts so RN can render without bundling.
- **Spacing scale** — 4/8 grid or similar, documented.
- **Components** — buttons (primary, secondary, full-width CTA with trailing arrow per reference), inputs, list rows, thumbnails, tabs, modals, toasts.
- **Iconography** — style guide (line weight, corner radius, fill rules).
- **Touch targets** — explicit minimums per surface (dad-facing min, caregiver min).
- **Motion principles** — easing curves, duration scale, when to animate vs. not.

Output as a usable reference (tokens table + component sheet), not just decoration on the screens.

---

## Look and feel (reference attached)

I'm attaching screenshots from a shoe-shop app whose visual language I really like (`reference-*.png`):
- Generous whitespace, calm composition.
- Mix of **light-weight** and **bold** type in the same heading ("Hurray! / Order placed") — I want that warmth.
- Rounded inputs, soft shadows.
- Primary blue CTA, full-width, with a trailing arrow icon.
- Friendly illustration as the hero element.

Adapt that warmth and clarity to Lola — but the **dad-facing surface needs even higher contrast and far bigger targets** than the reference. The caregiver-facing surface can lean closer to the reference density.

I'm also attaching current-state screenshots (`current-*.png`) — these are today's ugly state. **Redesign these.** The reference screenshots are the look-and-feel I want.

---

## Animations / motion

Propose motion for:
- Splash logo entrance + the long-press "filling" affordance.
- Home screen state transitions (idle → listening → thinking → speaking).
- Tab switch between Objects and Rooms.
- Photo capture confirmation (the "got it" moment).
- Success toast for save actions.

Subtle, purposeful, never blocking voice.

---

## UX review I want from you

Beyond visuals, **critique the current structure** and suggest improvements. Specifically:

1. **The two-button home division** (Describe on top, Ask on bottom, split 50/50). Right split for a low-vision, voice-first user? Should one dominate? Should there be a single button with voice-driven intent routing? Trade-offs?
2. **Setup access via 5-second logo hold** — works but undiscoverable. Is there a better pattern that still keeps entry invisible to dad? (He must never accidentally land in setup.)
3. **Objects vs Rooms as sibling tabs** — right mental model, or should rooms *contain* objects (hierarchical)?
4. Anything else you'd change about information architecture, naming, or flow.

Give me concrete recommendations, not just options.

---

## Handoff format — this gets implemented in React Native (Expo)

**Important:** every deliverable here will be implemented by an engineer (Claude Code) directly into the existing React Native + Expo app. Optimize the handoff for that — not for a Figma demo. Specifically:

### Design tokens (must be code-ready)
- All colors as **hex values** (`#1A73E8`), not names. Include opacity variants where used.
- All spacing/sizing in **numeric units** (a single `4`-based scale: 4, 8, 12, 16, 24, 32…), not "small/medium/large".
- All font sizes in **numeric points**, with line-height as a number or ratio.
- Border radii as numbers. Shadow specs broken out per-platform (iOS `shadowColor/shadowOffset/shadowOpacity/shadowRadius`, Android `elevation`) — RN renders shadows differently on each OS.
- Deliver tokens as a **JSON file** I can drop into `app/src/theme/tokens.json`, plus the visual reference sheet.

### Fonts
- Use **system fonts** (San Francisco / Roboto) or **Google Fonts** (Expo can bundle these via `expo-font`). No paid or web-only fonts.
- Specify family + weight pairs explicitly (e.g. `Inter-Regular 400`, `Inter-Bold 700`). The mixed-weight heading treatment is fine — just call out both weights as separate font assets.

### Icons
- Deliver as **SVG** (not PNG). If you use a known icon set (Lucide, Phosphor, Heroicons, Ionicons), name the set and the specific icon names — I'll install the RN package and reference them by name instead of bundling SVGs.
- For custom icons: provide individual SVG files at 24×24 with 1.5px stroke (or whatever your spec is), single-color, currentColor-fillable.

### Launcher icon — exact assets, not just a master
- **Android adaptive icon**:
  - `ic_launcher_foreground.png` at 432×432 (or SVG)
  - `ic_launcher_background.png` at 432×432, or a single background hex color
  - Legacy `ic_launcher.png` at 48 / 72 / 96 / 144 / 192 px (mipmap densities)
- **iOS**: single `Icon-1024.png` at 1024×1024, no transparency, no rounded corners
- Drop straight into `app.json` Expo config — call out the exact hex for `backgroundColor` if used.

### Splash screen
- Deliver assets sized for the **Expo splash plugin**: a centered image (1242×2436 max, transparent background) + a `backgroundColor` hex.
- If the splash animation is more than a fade, deliver as **Lottie JSON** (not video, not GIF).

### Animations
- For anything beyond simple state transitions (fades, slides, scales): deliver as **Lottie JSON** files I can drop into `lottie-react-native`.
- For simple state transitions: specify them as `{ property, from, to, duration_ms, easing }` tuples — I'll implement in Reanimated.
- Don't deliver video or GIF — neither maps cleanly to RN.

### Component specs
For each component, specify in this format:
```
Component: PrimaryButton
States: idle / pressed / disabled / loading
Padding: 16 vertical, 24 horizontal
Border radius: 12
Background: idle #1A73E8, pressed #1557B0, disabled #B0B8C4
Text: Inter-Bold 600, 18pt, color #FFFFFF
Icon (trailing): 24×24, 8pt gap from text
Min touch target: 56pt height (caregiver) / 88pt height (dad-facing)
```
This is what I need to implement it. Not "feels comfortable" — exact numbers.

### Copy
- Deliver **final Spanish strings** for dad-facing UI and **final English strings** for caregiver UI. No lorem ipsum. I'll wire these into the existing `CopyModule` / `COPY` constants.
- For each empty-state and error message, give me the actual text you want shipped.

### Edge cases — please mock these explicitly
- Long display names that wrap or truncate ("Termo de Papá Que Es Muy Grande de Color Azul")
- Rooms tab with 0 / 1 / 3 / 5 photos (the cap)
- Objects list with 0 / 1 / 20 items
- Home screen "speaking" state at 2s vs. 20s (does the visual hold?)
- Error states (camera permission denied, save failed, no network)
- Tap-to-cancel mid-speech feedback

### Source file
- Deliver the editable source (Figma share link with view access, or whatever Claude Design's native format is) so I can inspect specs as I implement. Inspection beats screenshots.

### Suggested implementation order
- Include a short note ranking the screens by build order — what should ship first, what depends on what. I want to implement in the order you'd recommend.

---

## Deliverables

1. **Logo + app launcher icon assets** — Android adaptive (foreground + background, all mipmap densities) + iOS 1024 master, ready to drop into Expo config.
2. **Design system** — `tokens.json` (colors, spacing, type, radii, shadows per-platform, motion) + visual reference sheet + component spec sheets in the format above.
3. **High-fidelity screens** for: splash, home (all states + edge cases), setup-objects (list + add/edit + empty), setup-rooms (list + add/edit + multi-photo at 0/1/3/5 + empty), capture modal, success/error states.
4. **Animation assets** — Lottie JSON for any non-trivial motion; transition specs as `{property, from, to, duration_ms, easing}` for the rest.
5. **Final copy** — Spanish (dad-facing) and English (caregiver-facing), final strings, ready to wire into the existing `COPY` constants.
6. **Written UX review** answering the four questions above with concrete recommendations.
7. **Editable source file** (Figma link or equivalent) for spec inspection during implementation.
8. **Implementation order note** — recommended build sequence.
