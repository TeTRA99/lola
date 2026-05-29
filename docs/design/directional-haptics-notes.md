# Directional haptics — feasibility notes (vibration to signal object location)

**Status (2026-05-29):** Investigated. **Idea: use vibration to point the user to
where an object is in the frame** ("top-right", or just left/right). Conclusion:
a *genuinely felt* left/right is **not possible** on a single-motor phone; only a
*learned* pulse code is. Plus the real blocker is upstream — our vision pipeline
doesn't return object positions yet. **No work scheduled; this doc captures the
findings so we can pick it up fast.**

## The core question — can a phone make you *feel* left vs right?

No. Two distinct things, and only the second is achievable on a phone:
1. **A felt bearing** — the buzz seems to come *from* the left/right. ❌
2. **A learned code** — same buzz everywhere, but a *pattern* the brain decodes
   as "left." ✅

**Why #1 is impossible (hardware, not software):**
- Both the **iPhone Taptic Engine** and the **Samsung Galaxy** (Charly's father's
  device) have **one** vibration motor — a single linear actuator (LRA). The whole
  phone shakes as one rigid object; there is no "right side" to drive.
- A *felt* lateral position is the **phantom-sensation** illusion, which provably
  needs **two spatially-separated actuators**, with apparent location set by the
  amplitude ratio between them. Phones don't have this; the rare dual-actuator
  phones are gaming models and place motors top/bottom, not left/right.
- So whatever we fire feels **identical** for left and right — only **count /
  rhythm** can carry the meaning.

## What *is* possible — a learned code (with caveats for his Galaxy)
- Must be **coarse and strong**. Our own [haptics.ts](../../app/src/adapters/haptics.ts)
  notes Light impact is **imperceptible on his Galaxy** — code must live in
  **count/rhythm** (e.g. 1 strong pulse = left, 2 = right), **not** subtle
  intensity/sharpness ramps (those render mainly on iPhone Core Haptics).
- Always **pair haptics with speech**, never replace it.

## The real blocker is positional data, not the buzzing
- [DescribeService.ts](../../app/src/services/DescribeService.ts) gets objects from
  OpenRouter shaped `{ canonical, display, room_hint }` — **no coordinates**.
- Pointing anywhere first needs the model to return a **coarse region per object**
  (e.g. `left | center | right`, or a quadrant). LLMs are reliable at coarse
  regions; **pixel bounding boxes are unreliable** — don't bother for v1.
- That's a **prompt + response-schema change**, separate from any haptic work.

## Tooling — already installed, so buzzing is the easy 20%
| Library | In repo | Use | Notes |
|---|---|---|---|
| `expo-haptics` | ✅ | simple impact/selection/notification taps | what the heartbeat + state machine use today |
| `react-native-haptic-feedback@3.0.0` | ✅ | **custom `triggerPattern`** (time/type/duration/intensity/sharpness) | iOS 13+ Core Haptics; Android 6+ (API 23); richer primitives on **Android 12+ / API 31** (`VibrationEffect.Composition`) |

Both already wired in [haptics.ts](../../app/src/adapters/haptics.ts).

## What the source articles actually said
- **[Android 12 haptics](https://thomas--mcguire.medium.com/exploring-new-haptics-features-in-android-12-27844dba9635):**
  about *audio-coupled* haptics (`HapticGenerator`) + *multi-actuator game
  controllers* (`VibratorManager`). **Neither helps a handheld phone point** — and
  `HapticGenerator` was Pixel-4-only at launch.
- **[Core Haptics](https://developer.apple.com/documentation/corehaptics):**
  rich transient/continuous events with intensity + sharpness — but **device-level
  only; cannot target a region of the device.** Confirms #1 above.

## If/when we revisit — phased
1. **Phase 0 (no camera):** add a `direction` pattern to `haptics.ts` and validate
   Charly's father can **distinguish 1-pulse vs 2-pulse** on his Galaxy *before*
   touching vision.
2. **Phase 1:** extend the Describe prompt/schema to return `left|center|right`
   per object; fire the matching pattern + speak it.
3. **Phase 2:** quadrants or a "scan/sweep" through detected objects (likely beats
   encoding a 2-D grid into one motor).
4. **Trigger flow** (on-demand "where is the X?" vs auto-sweep): **deferred** —
   decide after Phase 0.

## If a *felt* bearing ever becomes a hard requirement
Only via off-device hardware: a **two-motor wearable** (wristband/belt) or **stereo
spatial audio** in earbuds (audio, not haptics). Both are large product changes and
out of scope for current Lola.

## Sources
- [Lofelt — iOS vs Android actuator sizes](https://medium.com/lofelt/an-evaluation-of-relative-actuator-sizes-in-apple-ios-and-android-devices-669595ea8bd7)
- [Phantom tactile sensation needs two actuators](https://link.springer.com/chapter/10.1007/978-3-030-58147-3_42)
- [Expo Haptics docs](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [react-native-haptic-feedback](https://github.com/mkuczera/react-native-haptic-feedback)
